# Dominio Seguro

Plataforma web para el monitoreo continuo de la seguridad de sitios web y dominios en pequeñas empresas.

**Stack:** Angular · Node.js (Express) · PostgreSQL (Prisma) · JWT + Argon2

## Estructura

- `backend/`: API REST en Node.js (repositorio `dominio-seguro-Backend`)
- `frontend/`: aplicación Angular (repositorio `dominio-seguro-Frontend`)

Dentro de `backend/src/`:

- `modules/<modulo>/`: cada módulo (`auth`, `dominios`) se divide en `routes` → `controller` → `service` → `repository`, más `schemas` para validar la entrada
- `domain/`: lógica pura (cálculo del puntaje)
- `integrations/`: servicios externos (TLS, crt.sh, InternetDB, IP Score)
- `middleware/` y `lib/`: autenticación, manejo de errores y utilidades de seguridad
- `app.js` arma Express; `index.js` valida el `.env` y escucha en el puerto

## Cómo correr el backend

1. `docker compose up -d` (levanta PostgreSQL)
2. `cd backend && cp .env.example .env` y edita los valores (ver abajo)
3. `npm install`
4. `npx prisma migrate dev`
5. `npm run dev`

La API queda en `http://localhost:<PORT>/api` (por defecto el puerto 3000).

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Secreto para firmar tokens, mínimo 32 caracteres. Genera uno con `openssl rand -hex 48` y no lo compartas ni lo subas al repositorio |
| `PORT` | Puerto de la API (por defecto 3000) |
| `CORS_ORIGIN` | Origen permitido del frontend (por defecto `http://localhost:4200`) |
| `IPSCORE_URL` | URL del servicio de reputación de IP (por defecto `http://localhost:8000`) |
| `IPSCORE_API_KEY` | Clave del servicio de reputación de IP |

El archivo `.env` nunca se sube a Git: está en `.gitignore`.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/salud` | Estado de la API |
| POST | `/api/auth/registro` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión (devuelve JWT) |
| GET | `/api/dominios` | Listar dominios del usuario |
| POST | `/api/dominios` | Registrar dominio |
| POST | `/api/dominios/:id/analizar` | Ejecutar análisis (TLS, subdominios, reputación y exposición) |
| GET | `/api/dominios/:id/analisis` | Historial de análisis |

## Estado del proyecto

- [x] Autenticación con JWT y Argon2
- [x] Validación de entradas y protección anti-SSRF
- [x] Análisis de certificado TLS y subdominios (crt.sh)
- [x] Reputación de la IP (IP Score) y exposición (Shodan InternetDB)
- [x] Backend en capas (controller, service, repository)
- [x] Frontend: Mis dominios, Resultado, Historial, Alertas, Mi cuenta y campana de alertas
- [ ] Dominios similares con datos reales (hoy la vista usa datos de ejemplo)
- [ ] Verificación de propiedad del dominio (DNS TXT)
- [ ] MFA (TOTP)
- [ ] Cabeceras de seguridad (Mozilla Observatory)
- [ ] SPF / DKIM / DMARC
- [ ] Puntaje ponderado por categorías
- [ ] Reporte PDF
- [ ] Pruebas de seguridad (OWASP ZAP)
