# Modelo de amenazas de Dominio Seguro

Metodología: STRIDE sobre el flujo de datos del sistema, con un apartado propio para SSRF, que es el riesgo
más específico de una plataforma que consulta dominios elegidos por el usuario.

## 1. Alcance y fronteras de confianza

    Navegador ──► Nginx (Angular, :8080) ──/api──► API Express (:3001) ──► PostgreSQL
                                                        │
                                                        ├──► DNS y TLS del dominio analizado
                                                        ├──► Observatory (MDN), crt.sh, InternetDB
                                                        ├──► Servicio IP Score (del curso)
                                                        └──► SMTP (alertas)

Fronteras: (1) Internet ↔ Nginx, (2) Nginx ↔ API, (3) API ↔ base de datos, (4) API ↔ servicios externos y dominios
de terceros (la frontera más peligrosa: el usuario controla a dónde se conecta el servidor).

Activos: credenciales y sesiones de usuarios, secretos TOTP, historial de análisis, claves del servidor
(`JWT_SECRET`, `CIFRADO_KEY`), disponibilidad del servicio de análisis.

## 2. STRIDE

| Amenaza | Escenario | Mitigación implementada | Riesgo residual |
|---|---|---|---|
| **S**poofing | Robo o adivinación de credenciales; reutilización de un token de refresco robado | Contraseñas con argon2id; JWT de acceso de 15 min; refresco opaco de 32 bytes, rotado en cada uso, con detección de reutilización (cierra toda la familia); MFA TOTP (RFC 6238) con protección anti-reenvío; límite de 20 intentos por 15 min en `/api/auth` | Sin códigos de respaldo de MFA; sin verificación del correo al registrarse |
| **S**poofing | Un usuario pide vigilar un dominio que no es suyo | Verificación de propiedad por registro DNS TXT en `_dominio-seguro.<dominio>`, exigida con `EXIGIR_VERIFICACION=true` | Un dominio sin verificar puede analizarse cuando la exigencia se desactiva (solo pruebas) |
| **T**ampering | Alterar datos en tránsito o en la base de datos; inyección SQL | Validación de toda entrada con zod; Prisma con consultas parametrizadas; secretos TOTP con AES-256-GCM (integridad autenticada, etiqueta de 16 bytes exigida); tokens de refresco guardados solo como hash SHA-256 | El tráfico interno entre contenedores no va cifrado (red privada de Docker) |
| **R**epudiation | Negar haber ejecutado un análisis o un cambio de rol | Historial de análisis con fecha por dominio; los cambios de rol exigen administrador | No hay bitácora de auditoría dedicada para acciones administrativas |
| **I**nformation disclosure | Fuga de secretos, de datos de otro usuario o de detalles internos | Cada consulta se acota al usuario autenticado; errores genéricos hacia el cliente; cabeceras de `helmet` y de seguridad en Nginx; CORS restringido al origen del panel; cookie de refresco `HttpOnly`, `SameSite=Strict` y `Secure` en producción; `.env` fuera del repositorio | La clave `CIFRADO_KEY` vive en una variable de entorno, sin gestor de secretos |
| **D**enial of service | Inundar login o análisis; cuerpos enormes; análisis lentos | Límite de intentos en autenticación; cuerpo máximo de 10 KB; tiempos de espera en cada consulta externa; consultas de dominios similares en lotes acotados | No hay límite global por IP fuera de `/api/auth` |
| **E**levation of privilege | Un usuario normal accede a rutas de administración | Roles `usuario`/`admin` con `requiereRol`; un administrador no puede cambiar su propio rol; el token de MFA pendiente (`aud: mfa`) es rechazado como token de sesión | El primer administrador se crea por línea de comandos (`npm run admin`) |

## 3. SSRF (Server-Side Request Forgery)

**Riesgo:** el usuario escribe un dominio y el servidor se conecta a él. Un atacante podría intentar que el
servidor consulte `localhost`, la red interna o el servicio de metadatos de una nube (`169.254.169.254`).

**Controles:**

1. **Validación estricta del nombre** (`esDominioValido`): solo nombres de dominio con etiquetas válidas.
   Se rechazan direcciones IP, `localhost`, URLs, rutas, puertos, espacios y nombres sin punto.
2. **Bloqueo de IP privadas** (`esIpPrivada`): tras resolver el DNS se descartan direcciones de loopback,
   `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, enlace local (`169.254.0.0/16`, incluye metadatos de nube),
   `0.0.0.0` e IPv6 equivalentes.
3. **Conexión a la IP ya validada**: la conexión TLS se abre contra la dirección resuelta y comprobada, con el
   nombre del dominio solo como SNI. Así un cambio de DNS entre la comprobación y el uso (DNS rebinding) no
   redirige la conexión.
4. **Destinos externos fijos**: las demás integraciones (Observatory, crt.sh, InternetDB, IP Score) usan
   direcciones configuradas en el servidor, nunca valores del usuario.
5. **Tiempos de espera** en todas las consultas.

**Evidencia:** pruebas unitarias de los puntos 1 y 2 (`test/seguridad.test.js`) y escaneo con OWASP ZAP
(`docs/zap/`, categorías de inyección y SSRF sin hallazgos).

## 4. Pruebas de seguridad realizadas

| Prueba | Resultado |
|---|---|
| 46 pruebas unitarias (puntaje, cambios, cifrado, TOTP con vectores del RFC 6238, tokens, SSRF) | 46 de 46 correctas |
| OWASP ZAP, escaneo de API con sesión autenticada (1630 peticiones, 24 URLs) | 0 fallos, 0 avisos, 120 reglas aprobadas |
| Semgrep (reglas JavaScript, Node.js y OWASP Top 10) | Detectó el uso de GCM sin largo de etiqueta; corregido y verificado con una prueba nueva |
| `npm audit` | Aviso en la cadena del CLI de Prisma (`effect`); versión corregida forzada con `overrides` |

## 5. Trabajo futuro

Códigos de respaldo de MFA, verificación del correo, bitácora de auditoría, límite global de peticiones,
gestor de secretos, política CSP en Nginx y actualización a Prisma 7.
