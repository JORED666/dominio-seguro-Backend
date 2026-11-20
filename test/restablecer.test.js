import test from "node:test";
import assert from "node:assert/strict";
import { olvideSchema, restablecerSchema } from "../src/modules/auth/auth.schemas.js";
import { hashToken, nuevoTokenRefresco } from "../src/lib/tokens.js";

const token = nuevoTokenRefresco();
const clave = "una-clave-larga-123";

test("olvide normaliza el correo a minúsculas y sin espacios", () => {
  assert.equal(olvideSchema.parse({ correo: "  Ana@Ejemplo.COM " }).correo, "ana@ejemplo.com");
});

test("olvide rechaza un correo inválido", () => {
  assert.equal(olvideSchema.safeParse({ correo: "no-es-correo" }).success, false);
});

test("restablecer exige contraseña de 12 caracteres o más", () => {
  assert.equal(restablecerSchema.safeParse({ token, password: "corta" }).success, false);
  assert.equal(restablecerSchema.safeParse({ token, password: clave }).success, true);
});

test("restablecer rechaza contraseñas de más de 128 caracteres", () => {
  assert.equal(restablecerSchema.safeParse({ token, password: "a".repeat(129) }).success, false);
});

test("restablecer rechaza un token ausente o demasiado corto", () => {
  assert.equal(restablecerSchema.safeParse({ password: clave }).success, false);
  assert.equal(restablecerSchema.safeParse({ token: "abc", password: clave }).success, false);
});

test("el token es aleatorio y en la base solo se guarda su hash", () => {
  assert.notEqual(nuevoTokenRefresco(), nuevoTokenRefresco());
  assert.notEqual(hashToken(token), token);
  assert.equal(hashToken(token).length, 64);
  assert.equal(hashToken(token), hashToken(token));
});
