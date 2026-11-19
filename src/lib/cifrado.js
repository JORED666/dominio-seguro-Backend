import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado en reposo con AES-256-GCM. Formato guardado: v1:iv:etiqueta:datos (base64).
// GCM autentica el texto: si alguien altera lo guardado, descifrar falla en vez de devolver basura.
export const CLAVE_VALIDA = /^[0-9a-f]{64}$/i;

function clave() {
  const hex = process.env.CIFRADO_KEY ?? "";
  if (!CLAVE_VALIDA.test(hex)) throw new Error("CIFRADO_KEY debe tener 64 caracteres hexadecimales");
  return Buffer.from(hex, "hex");
}

export function cifrar(texto) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  return ["v1", iv, cifrador.getAuthTag(), datos].map((p, i) => (i ? p.toString("base64") : p)).join(":");
}

export function descifrar(guardado) {
  const [version, iv, etiqueta, datos] = String(guardado).split(":");
  if (version !== "v1" || !iv || !etiqueta || datos === undefined) throw new Error("Formato de cifrado desconocido");
  const descifrador = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64"));
  descifrador.setAuthTag(Buffer.from(etiqueta, "base64"));
  return Buffer.concat([descifrador.update(Buffer.from(datos, "base64")), descifrador.final()]).toString("utf8");
}
