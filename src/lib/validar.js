import { ErrorHttp } from "./errores.js";

// Valida con un esquema de zod; si falla lanza 400 (con mensaje fijo si se indica)
export function validar(esquema, datos, mensaje) {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorHttp(400, mensaje ?? r.error.issues[0].message);
  return r.data;
}
