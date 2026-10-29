# Dominio Seguro

Plataforma web para el monitoreo continuo de la seguridad de sitios web y dominios en pequeñas empresas.

**Stack:** Angular · Node.js (Express) · PostgreSQL (Prisma) · JWT + Argon2

## Estructura

- `backend/`: API REST en Node.js
- `frontend/`: aplicación Angular (en desarrollo)

## Cómo correr el backend

1. `docker compose up -d` (levanta PostgreSQL)
2. `cd backend && cp .env.example .env` y edita `JWT_SECRET`
3. `npm install`
4. `npx prisma migrate dev --name init`
5. `npm run dev`

La API queda en `http://localhost:3000/api`.

## Endpoints del avance

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/registro` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión (devuelve JWT) |
| GET | `/api/dominios` | Listar dominios del usuario |
| POST | `/api/dominios` | Registrar dominio |
| POST | `/api/dominios/:id/analizar` | Ejecutar análisis (TLS + subdominios) |
| GET | `/api/dominios/:id/analisis` | Historial de análisis |

## Estado del proyecto

- [x] Autenticación con JWT y Argon2
- [x] Validación de entradas y protección anti-SSRF
- [x] Análisis de certificado TLS y subdominios (crt.sh)
- [ ] Verificación de propiedad del dominio (DNS TXT)
- [ ] MFA (TOTP)
- [ ] Cabeceras (Mozilla Observatory) y exposición (Shodan InternetDB)
- [ ] SPF / DKIM / DMARC
- [ ] Alertas, reporte PDF, dominios similares
- [ ] Pruebas de seguridad (OWASP ZAP)
