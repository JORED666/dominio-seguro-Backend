import { randomBytes } from "node:crypto";

// Verificación de propiedad: el usuario publica un TXT en _dominio-seguro.<su dominio>
const PREFIJO = "dominio-seguro-verificacion=";

export const nuevoToken = () => randomBytes(16).toString("hex");
export const nombreRegistro = (dominio) => `_dominio-seguro.${dominio}`;
export const valorRegistro = (token) => PREFIJO + token;

// resolveTxt entrega cada registro en pedazos (el DNS parte los textos largos): se unen antes de comparar
export function coincide(registros, token) {
  if (!token) return false;
  const esperado = valorRegistro(token);
  return registros.some((trozos) => trozos.join("").trim() === esperado);
}
