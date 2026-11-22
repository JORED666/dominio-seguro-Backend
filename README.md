# Dominio Seguro — API

Plataforma que analiza la seguridad del dominio de una pequeña empresa y se la explica en lenguaje claro:
qué está mal, qué tan grave es y qué hacer primero. Proyecto del curso **Seguridad Informática**
(Universidad Politécnica de Chiapas, grupo 7C).

- Frontend (Angular): https://github.com/JORED666/dominio-seguro-Frontend
- Documentación de la API (Swagger): `http://localhost:8080/api/docs` con el sistema levantado
- Modelo de amenazas: [`docs/modelo-amenazas.md`](docs/modelo-amenazas.md)
- Escaneo OWASP ZAP: [`docs/zap/`](docs/zap/)

## Qué hace

- **Análisis del dominio:** cifrado TLS, cabeceras de seguridad (Observatory de MDN), correo (SPF, DKIM, DMARC),
  subdominios (crt.sh), reputación y exposición de la IP (InternetDB y el servicio IP Score del curso).
- **Puntaje de 0 a 100** por categorías ponderadas: TLS 25, cabeceras 25, correo 20, exposición 20, dominios
  similares 10. Un hallazgo crítico limita el total a 59. Niveles: bueno (80 o más), mejoras (50 a 79), crítico.
- **Dominios similares** (typosquatting): genera variantes, comprueba cuáles están activas y estima el riesgo.
- **Detección de cambios y alertas por correo:** una revisión programada (cron, 7:00 hora de México) compara
  cada análisis con el anterior y avisa por correo solo cuando algo empeora.
- **Propiedad del dominio** comprobada con un registro DNS TXT en `_dominio-seguro.<dominio>`.
- **Cuentas seguras:** contraseñas con argon2id, sesión con JWT y refresco rotado, MFA con TOTP y roles.

## Arquitectura

    Navegador ──► Nginx (Angular, :8080) ──/api──► API Express (:3001) ──► PostgreSQL 16
                                                        ├──► DNS y TLS del dominio analizado
                                                        ├──► Observatory, crt.sh, InternetDB
                                                        ├──► Servicio IP Score (del curso)
                                                        └──► SMTP (alertas)

Capas del backend: `routes` → `controller` → `service` → `repository` (Prisma), más `domain/` (lógica pura:
puntaje, cambios, similares), `integrations/` (servicios externos), `lib/` (cifrado, TOTP, tokens), `middleware/`
y `jobs/` (revisión programada).

## Puesta en marcha con Docker

Requisitos: Docker con Compose, y el servicio **ip-score-api** del curso corriendo en el puerto 8000.

    cp .env.example .env
    # Edita .env: JWT_SECRET (openssl rand -hex 48), CIFRADO_KEY (openssl rand -hex 32),
    # POSTGRES_PASSWORD, IPSCORE_API_KEY y, si quieres alertas reales, SMTP_*
    docker compose up -d --build
    # Panel en http://localhost:8080

Para convertir a un usuario en administrador: `docker compose exec backend npm run admin -- correo@ejemplo.com`.
Con `EXIGIR_VERIFICACION=true` solo se vigilan dominios cuya propiedad se comprobó por DNS.

## Desarrollo local

    docker compose up -d db          # solo la base de datos (puerto 5433)
    npm ci
    npx prisma migrate dev
    npm run dev                      # API en http://localhost:3001
    npm test                         # 46 pruebas unitarias

El frontend (`npm start` en su carpeta) usa un proxy de `/api` hacia el puerto 3001.

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL`, `POSTGRES_PASSWORD` | Conexión a PostgreSQL |
| `JWT_SECRET` | Firma de los tokens de acceso (obligatoria) |
| `CIFRADO_KEY` | Clave AES-256 de 64 caracteres hexadecimales para secretos en reposo (obligatoria) |
| `CORS_ORIGIN`, `ORIGEN_PUBLICO`, `PANEL_URL` | Origen del panel y enlaces de los correos |
| `IPSCORE_URL`, `IPSCORE_API_KEY` | Servicio de reputación de IP |
| `EXIGIR_VERIFICACION` | `true` exige comprobar la propiedad del dominio por DNS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CORREO_DE` | Envío de alertas (en desarrollo usa Ethereal) |
| `REVISION_CRON`, `REVISION_ACTIVA` | Horario y activación de la revisión programada |
| `LIMITE_AUTH`, `TRUST_PROXY` | Límite de intentos en `/api/auth` y confianza en el proxy Nginx |

## API

Documentación interactiva en `/api/docs` y especificación en `/api/openapi.json`.

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/salud` | Público |
| POST | `/api/auth/registro`, `/api/auth/login` | Público |
| POST | `/api/auth/refresh`, `/api/auth/logout` | Cookie de refresco |
| POST | `/api/auth/mfa/verificar` | Token de MFA pendiente |
| POST | `/api/auth/mfa/configurar`, `/activar`, `/desactivar` | Sesión |
| GET, POST | `/api/dominios` | Sesión |
| GET | `/api/dominios/{id}/verificacion` | Sesión |
| POST | `/api/dominios/{id}/verificar`, `/analizar` | Sesión |
| GET | `/api/dominios/{id}/analisis`, `/similares` | Sesión |
| PATCH | `/api/dominios/{id}/similares/{similarId}` | Sesión |
| GET | `/api/admin/usuarios` | Administrador |
| PATCH | `/api/admin/usuarios/{id}` | Administrador |
| POST | `/api/admin/revision` | Administrador |

## Seguridad

- **Autenticación:** argon2id; JWT HS256 de 15 minutos; refresco opaco con rotación, detección de reutilización
  y cookie `HttpOnly`, `SameSite=Strict`; MFA TOTP (RFC 6238) con protección anti-reenvío.
- **Autorización:** roles `usuario` y `admin`; cada consulta se acota al usuario autenticado.
- **Datos en reposo:** secretos TOTP cifrados con AES-256-GCM; tokens de refresco guardados solo como hash.
- **Entrada y red:** validación con zod, cuerpo máximo de 10 KB, `helmet`, CORS restringido, límite de intentos
  en autenticación, defensa contra SSRF (validación del dominio y bloqueo de IP privadas).
- **Pruebas:** 46 unitarias, OWASP ZAP (0 fallos, 0 avisos), Semgrep y `npm audit` (ver `docs/`).
- **CI:** flujo de GitHub Actions en `.github/workflows/ci.yml` (pruebas, auditoría, Semgrep y construcción de la imagen).

## Limitaciones conocidas

Sin códigos de respaldo de MFA, sin verificación del correo al registrarse y sin bitácora de auditoría.
El CLI de Prisma arrastra un aviso de `effect`; se fuerza una versión corregida y queda pendiente pasar a Prisma 7.

## Licencia

[MIT](LICENSE). El servicio **ip-score-api** es un proyecto externo del curso con su propia licencia.
