import { ErrorHttp } from "../lib/errores.js";

// Manejador global: los ErrorHttp salen con su código; el resto no expone detalles internos
export function manejadorErrores(err, _req, res, _next) {
  if (err instanceof ErrorHttp) return res.status(err.status).json({ error: err.message });
  // JSON mal formado o cuerpo demasiado grande (errores de express.json)
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Cuerpo demasiado grande" });
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
