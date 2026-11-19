# Escaneo con OWASP ZAP

Resultado del 19/11/2026 (ZAP estable, `zap-api-scan.py`, contra el backend local con sesión de administrador):
**1630 peticiones, 24 URLs, 0 fallos, 0 avisos, 120 reglas aprobadas.**
Informes: `reporte-zap.html`, `reporte-zap.json`, `reporte-zap.md`.

Hallazgo corregido durante las pruebas: las rutas inexistentes respondían una página HTML; ahora responden JSON (404).

Alcance: reglas activas y pasivas sobre las 20 operaciones del OpenAPI, con ejemplos válidos de cuerpos e identificadores.
Durante la prueba se relajó el límite de intentos de `/api/auth` con `LIMITE_AUTH`; en uso normal vale 20 por 15 minutos.

## Cómo repetirlo

1. Backend con `LIMITE_AUTH=100000 npm run dev`.
2. Iniciar sesión y guardar el token en `TOKEN` (dura 15 minutos).
3. `TOKEN="$TOKEN" python3 docs/zap/preparar-spec.py` genera `openapi-zap.json` con ejemplos.
4. `TOKEN_ZAP="$TOKEN" python3 docs/zap/proxy.py &` (proxy que añade el token y apunta al backend).
5. `docker run --rm --network host -v "$PWD/docs/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t openapi-zap.json -f openapi -r reporte-zap.html -J reporte-zap.json -w reporte-zap.md -T 10`
