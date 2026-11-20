// Especificación OpenAPI 3.0 de la API. Se muestra en /api/docs (Swagger UI) y se descarga en /api/openapi.json.
const ref = (nombre) => ({ $ref: `#/components/schemas/${nombre}` });
const cuerpo = (nombre) => ({ required: true, content: { "application/json": { schema: ref(nombre) } } });
const ok = (descripcion, nombre) => ({ description: descripcion, content: { "application/json": { schema: nombre ? ref(nombre) : { type: "object" } } } });
const lista = (descripcion, nombre) => ({ description: descripcion, content: { "application/json": { schema: { type: "array", items: ref(nombre) } } } });
const error = (descripcion) => ({ description: descripcion, content: { "application/json": { schema: ref("Error") } } });
const protegido = [{ bearerAuth: [] }];
const id = { name: "id", in: "path", required: true, description: "Identificador del dominio", schema: { type: "string", format: "uuid" } };

const cadena = { type: "string" };
const entero = { type: "integer" };
const fecha = { type: "string", format: "date-time" };

export const especificacion = {
  openapi: "3.0.3",
  info: {
    title: "Dominio Seguro API",
    version: "1.0.0",
    description:
      "API REST para analizar la seguridad de los dominios de pequeños negocios.\n\n" +
      "**Autenticación:** inicia sesión en `/api/auth/login` y usa el `token` (JWT, 15 min) con el botón *Authorize*. " +
      "El token de refresco viaja en una cookie `HttpOnly` (`ds_refresh`) y se rota en cada uso (`/api/auth/refresh`). " +
      "Si la cuenta tiene verificación en dos pasos (TOTP), el login devuelve `mfaRequerido` y la sesión se completa en `/api/auth/mfa/verificar`.\n\n" +
      "**Límite de peticiones:** `/api/auth/*` permite 20 intentos cada 15 minutos por IP.",
  },
  servers: [{ url: "/", description: "Servidor actual" }],
  tags: [
    { name: "Sistema" },
    { name: "Autenticación", description: "Registro, sesión, tokens de refresco y MFA" },
    { name: "Dominios", description: "Dominios del usuario, propiedad por DNS TXT y análisis" },
    { name: "Administración", description: "Solo rol admin" },
  ],
  paths: {
    "/api/salud": {
      get: { tags: ["Sistema"], summary: "Estado del servicio", responses: { 200: ok("Servicio en línea") } },
    },
    "/api/auth/registro": {
      post: {
        tags: ["Autenticación"],
        summary: "Crear cuenta",
        requestBody: cuerpo("Registro"),
        responses: { 201: ok("Cuenta creada. Devuelve sesión y la cookie ds_refresh", "Sesion"), 400: error("Datos inválidos"), 409: error("No se pudo completar el registro") },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Autenticación"],
        summary: "Iniciar sesión",
        description: "Con MFA activo no entrega sesión: responde `mfaRequerido` y un `mfaToken` de 5 minutos.",
        requestBody: cuerpo("Login"),
        responses: {
          200: { description: "Sesión, o petición del segundo factor", content: { "application/json": { schema: { oneOf: [ref("Sesion"), ref("MfaPendiente")] } } } },
          400: error("Datos inválidos"),
          401: error("Credenciales incorrectas"),
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Autenticación"],
        summary: "Renovar el token de acceso",
        description: "Usa la cookie `ds_refresh` (rotación: cada token sirve una sola vez; reutilizar uno ya gastado cierra toda la sesión).",
        responses: { 200: ok("Nuevo token de acceso y nueva cookie", "Sesion"), 401: error("Sesión inválida o expirada") },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Autenticación"], summary: "Cerrar sesión (revoca los tokens de refresco)", responses: { 204: { description: "Sesión cerrada" } } },
    },
    "/api/auth/olvide": {
      post: {
        tags: ["Autenticación"],
        summary: "Pedir un enlace para restablecer la contraseña",
        description: "Responde siempre lo mismo, exista o no el correo, para no revelar qué cuentas existen. El enlace llega por correo, vale 30 minutos y sirve una sola vez.",
        requestBody: cuerpo("Olvide"),
        responses: { 202: ok("Solicitud recibida", "Mensaje"), 400: error("Datos inválidos"), 429: error("Demasiados intentos") },
      },
    },
    "/api/auth/restablecer": {
      post: {
        tags: ["Autenticación"],
        summary: "Cambiar la contraseña con el enlace recibido por correo",
        description: "Gasta el enlace, guarda la nueva contraseña (argon2id) y cierra todas las sesiones abiertas de la cuenta.",
        requestBody: cuerpo("Restablecer"),
        responses: { 200: ok("Contraseña actualizada", "Mensaje"), 400: error("Datos inválidos, o enlace inválido, usado o expirado"), 429: error("Demasiados intentos") },
      },
    },
    "/api/auth/mfa/verificar": {
      post: {
        tags: ["Autenticación"],
        summary: "Completar el login con el código TOTP",
        requestBody: cuerpo("MfaVerificar"),
        responses: { 200: ok("Sesión completa", "Sesion"), 400: error("Datos inválidos"), 401: error("Código incorrecto o sesión expirada") },
      },
    },
    "/api/auth/mfa/configurar": {
      post: {
        tags: ["Autenticación"],
        summary: "Generar el secreto TOTP y el código QR",
        security: protegido,
        responses: { 200: ok("Secreto (se guarda cifrado con AES-256-GCM) y QR", "MfaConfiguracion"), 401: error("No autenticado"), 409: error("MFA ya activo") },
      },
    },
    "/api/auth/mfa/activar": {
      post: {
        tags: ["Autenticación"],
        summary: "Activar MFA confirmando un código",
        security: protegido,
        requestBody: cuerpo("MfaCodigo"),
        responses: { 200: ok("MFA activo", "MfaEstado"), 400: error("Código incorrecto"), 401: error("No autenticado"), 409: error("MFA ya activo") },
      },
    },
    "/api/auth/mfa/desactivar": {
      post: {
        tags: ["Autenticación"],
        summary: "Desactivar MFA (contraseña y código)",
        security: protegido,
        requestBody: cuerpo("MfaDesactivar"),
        responses: { 200: ok("MFA desactivado", "MfaEstado"), 401: error("Contraseña o código incorrectos"), 409: error("MFA no activo") },
      },
    },
    "/api/dominios": {
      get: { tags: ["Dominios"], summary: "Listar mis dominios", security: protegido, responses: { 200: lista("Dominios del usuario", "Dominio"), 401: error("No autenticado") } },
      post: {
        tags: ["Dominios"],
        summary: "Registrar un dominio",
        security: protegido,
        requestBody: cuerpo("NuevoDominio"),
        responses: { 201: ok("Dominio registrado (con su token de verificación)", "Dominio"), 400: error("Dominio inválido"), 401: error("No autenticado"), 409: error("Ya registrado") },
      },
    },
    "/api/dominios/{id}/verificacion": {
      get: {
        tags: ["Dominios"],
        summary: "Instrucciones para verificar la propiedad (registro DNS TXT)",
        security: protegido,
        parameters: [id],
        responses: { 200: ok("Registro TXT que debes crear", "Verificacion"), 401: error("No autenticado"), 404: error("Dominio no encontrado") },
      },
    },
    "/api/dominios/{id}/verificar": {
      post: {
        tags: ["Dominios"],
        summary: "Comprobar el registro DNS TXT y marcar el dominio como verificado",
        security: protegido,
        parameters: [id],
        responses: { 200: ok("Estado de verificación", "Verificacion"), 404: error("Dominio no encontrado"), 422: error("No se encontró el registro TXT"), 502: error("No se pudo consultar el DNS") },
      },
    },
    "/api/dominios/{id}/analizar": {
      post: {
        tags: ["Dominios"],
        summary: "Analizar el dominio ahora",
        description: "Revisa TLS, cabeceras (Observatory), SPF/DKIM/DMARC, subdominios (crt.sh), exposición (InternetDB), reputación y dominios similares. Compara con el análisis anterior (`cambios`).",
        security: protegido,
        parameters: [id],
        responses: { 201: ok("Resultado del análisis", "Analisis"), 400: error("Dominio no resoluble o no público"), 403: error("Dominio sin verificar"), 404: error("Dominio no encontrado") },
      },
    },
    "/api/dominios/{id}/analisis": {
      get: { tags: ["Dominios"], summary: "Historial de análisis", security: protegido, parameters: [id], responses: { 200: lista("Análisis, del más reciente al más antiguo", "Analisis"), 404: error("Dominio no encontrado") } },
    },
    "/api/dominios/{id}/similares": {
      get: { tags: ["Dominios"], summary: "Dominios similares (typosquatting)", security: protegido, parameters: [id], responses: { 200: lista("Variantes detectadas, de mayor a menor riesgo", "Similar"), 404: error("Dominio no encontrado") } },
    },
    "/api/dominios/{id}/similares/{similarId}": {
      patch: {
        tags: ["Dominios"],
        summary: "Marcar una variante como propia o revisada",
        security: protegido,
        parameters: [id, { name: "similarId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: cuerpo("MarcaSimilar"),
        responses: { 200: ok("Variante actualizada", "Similar"), 400: error("Nada que actualizar"), 404: error("No encontrado") },
      },
    },
    "/api/admin/usuarios": {
      get: { tags: ["Administración"], summary: "Listar usuarios", security: protegido, responses: { 200: lista("Usuarios con su número de dominios", "UsuarioAdmin"), 401: error("No autenticado"), 403: error("Requiere rol admin") } },
    },
    "/api/admin/usuarios/{id}": {
      patch: {
        tags: ["Administración"],
        summary: "Cambiar el rol de un usuario",
        security: protegido,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: cuerpo("CambioRol"),
        responses: { 200: ok("Usuario actualizado", "UsuarioAdmin"), 400: error("Rol inválido o cambio del propio rol"), 403: error("Requiere rol admin"), 404: error("Usuario no encontrado") },
      },
    },
    "/api/admin/revision": {
      post: {
        tags: ["Administración"],
        summary: "Ejecutar ahora la revisión programada",
        description: "Vuelve a analizar los dominios y envía correo de alerta si hay cambios importantes (la misma tarea que corre cada día a las 7:00).",
        security: protegido,
        responses: { 200: ok("Resumen de la revisión", "ResumenRevision"), 403: error("Requiere rol admin"), 409: error("Ya hay una revisión en curso") },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: { type: "object", properties: { error: cadena }, required: ["error"] },
      Registro: {
        type: "object",
        required: ["nombre", "correo", "password"],
        properties: { nombre: { type: "string", minLength: 2, maxLength: 80 }, correo: { type: "string", format: "email", maxLength: 120 }, password: { type: "string", minLength: 12, maxLength: 128 } },
      },
      Login: { type: "object", required: ["correo", "password"], properties: { correo: { type: "string", format: "email" }, password: cadena } },
      Usuario: {
        type: "object",
        properties: { id: { type: "string", format: "uuid" }, nombre: cadena, correo: cadena, rol: { type: "string", enum: ["usuario", "admin"] }, mfaActivo: { type: "boolean" } },
      },
      Sesion: { type: "object", properties: { token: { type: "string", description: "JWT de acceso (15 minutos)" }, usuario: ref("Usuario") } },
      MfaPendiente: { type: "object", properties: { mfaRequerido: { type: "boolean", example: true }, mfaToken: { type: "string", description: "Válido 5 minutos; solo sirve en /api/auth/mfa/verificar" } } },
      MfaVerificar: { type: "object", required: ["mfaToken", "codigo"], properties: { mfaToken: cadena, codigo: { type: "string", pattern: "^\\d{6}$" } } },
      MfaCodigo: { type: "object", required: ["codigo"], properties: { codigo: { type: "string", pattern: "^\\d{6}$", example: "123456" } } },
      MfaDesactivar: { type: "object", required: ["password", "codigo"], properties: { password: cadena, codigo: { type: "string", pattern: "^\\d{6}$" } } },
      MfaConfiguracion: { type: "object", properties: { secreto: { type: "string", description: "Clave en base32 para escribirla a mano" }, otpauth: cadena, qr: { type: "string", description: "Imagen PNG en data URL" } } },
      MfaEstado: { type: "object", properties: { mfaActivo: { type: "boolean" } } },
      Olvide: { type: "object", required: ["correo"], properties: { correo: { type: "string", format: "email" } } },
      Restablecer: {
        type: "object",
        required: ["token", "password"],
        properties: { token: { type: "string", description: "Valor del parámetro token del enlace recibido por correo" }, password: { type: "string", minLength: 12, maxLength: 128 } },
      },
      Mensaje: { type: "object", properties: { mensaje: cadena } },
      NuevoDominio: { type: "object", required: ["nombre"], properties: { nombre: { type: "string", example: "mitienda.mx" } } },
      Dominio: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          nombreDominio: cadena,
          ultimoPuntaje: { type: "integer", nullable: true },
          nivel: { type: "string", nullable: true, enum: ["bueno", "mejoras", "critico"] },
          verificadoEn: { ...fecha, nullable: true },
          creadoEn: fecha,
        },
      },
      Verificacion: {
        type: "object",
        properties: {
          verificado: { type: "boolean" },
          verificadoEn: { ...fecha, nullable: true },
          registro: { type: "object", properties: { tipo: { type: "string", example: "TXT" }, nombre: { type: "string", example: "_dominio-seguro.mitienda.mx" }, valor: { type: "string", example: "dominio-seguro-verificacion=3fda85cb213acd56336002dc9060aa65" } } },
        },
      },
      Hallazgo: {
        type: "object",
        properties: { categoria: cadena, severidad: { type: "string", enum: ["info", "baja", "media", "alta", "critica"] }, titulo: cadena, descripcion: cadena, recomendacion: cadena },
      },
      Categoria: { type: "object", properties: { id: cadena, nombre: cadena, peso: entero, puntaje: { type: "integer", nullable: true } } },
      Cambios: {
        type: "object",
        nullable: true,
        description: "Comparación con el análisis anterior (null en el primer análisis)",
        properties: { importante: { type: "boolean" }, puntajeAntes: entero, puntajeAhora: entero, delta: entero, nivelAntes: cadena, nivelAhora: cadena, nuevos: { type: "array", items: ref("Hallazgo") }, resueltos: { type: "array", items: ref("Hallazgo") } },
      },
      Analisis: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          fecha,
          puntaje: { type: "integer", minimum: 0, maximum: 100 },
          nivel: { type: "string", enum: ["bueno", "mejoras", "critico"] },
          duracionMs: entero,
          categorias: { type: "array", items: ref("Categoria") },
          hallazgos: { type: "array", items: ref("Hallazgo") },
          cambios: ref("Cambios"),
          similares: { type: "array", items: ref("Similar") },
          certificado: { type: "object", nullable: true },
          subdominios: { type: "array", items: cadena },
          reputacion: { type: "object", nullable: true },
          exposicion: { type: "object", nullable: true },
        },
      },
      Similar: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          nombre: cadena,
          tecnica: cadena,
          estado: { type: "string", description: "libre, registrado, etc." },
          riesgo: { type: "string", enum: ["alto", "medio", "bajo"] },
          conCorreo: { type: "boolean" },
          conCertificado: { type: "boolean" },
          propio: { type: "boolean" },
          revisado: { type: "boolean" },
          detectadoEn: { ...fecha, nullable: true },
        },
      },
      MarcaSimilar: { type: "object", properties: { propio: { type: "boolean" }, revisado: { type: "boolean" } } },
      UsuarioAdmin: { type: "object", properties: { id: cadena, nombre: cadena, correo: cadena, rol: cadena, creadoEn: fecha, dominios: entero } },
      CambioRol: { type: "object", required: ["rol"], properties: { rol: { type: "string", enum: ["usuario", "admin"] } } },
      ResumenRevision: { type: "object", properties: { revisados: entero, avisos: entero, errores: entero } },
    },
  },
};
