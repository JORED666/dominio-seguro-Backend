import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { nuevoIntento, urlAutorizacion, validarClaims } from "../src/integrations/google.js";

const CLIENTE = "cliente-prueba.apps.googleusercontent.com";
const bueno = () => ({
  iss: "https://accounts.google.com",
  aud: CLIENTE,
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: "n1",
  email_verified: true,
  sub: "123",
  email: "Persona@Ejemplo.com",
  name: "Persona Prueba",
});
const validar = (claims) => validarClaims(claims, { nonce: "n1", clienteId: CLIENTE });

test("google: acepta un token correcto y normaliza el correo", () => {
  assert.deepEqual(validar(bueno()), { sub: "123", correo: "persona@ejemplo.com", nombre: "Persona Prueba" });
});

test("google: rechaza audiencia, emisor, nonce, vencimiento y correo sin verificar", () => {
  assert.throws(() => validar({ ...bueno(), aud: "otro" }), /Audiencia/);
  assert.throws(() => validar({ ...bueno(), iss: "https://malo.com" }), /Emisor/);
  assert.throws(() => validar({ ...bueno(), nonce: "x" }), /Nonce/);
  assert.throws(() => validar({ ...bueno(), exp: 1 }), /vencido/);
  assert.throws(() => validar({ ...bueno(), email_verified: false }), /sin verificar/);
  assert.throws(() => validar(null), /inválido/);
});

test("google: el challenge PKCE es el SHA-256 del verifier", () => {
  const i = nuevoIntento();
  assert.equal(i.challenge, createHash("sha256").update(i.verifier).digest("base64url"));
  assert.notEqual(i.state, nuevoIntento().state);
});

test("google: la URL de autorización lleva state, nonce y PKCE", () => {
  process.env.GOOGLE_CLIENT_ID = CLIENTE;
  process.env.PANEL_URL = "https://panel.ejemplo.com";
  const i = nuevoIntento();
  const url = new URL(urlAutorizacion(i));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("state"), i.state);
  assert.equal(url.searchParams.get("nonce"), i.nonce);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("redirect_uri"), "https://panel.ejemplo.com/api/auth/google/callback");
});
