import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

const AUTORIZACION = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const EMISORES = ["https://accounts.google.com", "accounts.google.com"];

const base64url = (datos) => Buffer.from(datos).toString("base64url");

export const configurado = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function urlRedireccion() {
  const base = (process.env.PANEL_URL || "http://localhost:4200").replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

// state: protege contra CSRF; verifier y challenge: PKCE; nonce: liga el token de identidad a este intento
export function nuevoIntento() {
  const verifier = base64url(randomBytes(32));
  return {
    state: base64url(randomBytes(16)),
    nonce: base64url(randomBytes(16)),
    verifier,
    challenge: base64url(createHash("sha256").update(verifier).digest()),
  };
}

export function urlAutorizacion({ state, nonce, challenge }) {
  const parametros = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: urlRedireccion(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTORIZACION}?${parametros}`;
}

// Comprueba lo que dice el token de identidad antes de confiar en él
export function validarClaims(claims, { nonce, clienteId, ahora = Date.now() }) {
  if (!claims || typeof claims !== "object") throw new Error("Token de identidad inválido");
  if (!EMISORES.includes(claims.iss)) throw new Error("Emisor inesperado");
  if (claims.aud !== clienteId) throw new Error("Audiencia inesperada");
  if (!claims.exp || claims.exp * 1000 <= ahora) throw new Error("Token de identidad vencido");
  if (!nonce || claims.nonce !== nonce) throw new Error("Nonce no coincide");
  if (claims.email_verified !== true) throw new Error("Correo sin verificar en Google");
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") throw new Error("Faltan datos del perfil");
  return {
    sub: claims.sub,
    correo: claims.email.toLowerCase(),
    nombre: typeof claims.name === "string" ? claims.name.slice(0, 100) : "",
  };
}

export async function canjearCodigo({ code, verifier, nonce }) {
  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: urlRedireccion(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!respuesta.ok) throw new Error(`Google respondió ${respuesta.status}`);
  const { id_token: idToken } = await respuesta.json();
  // El token llega directo de Google por TLS en el flujo de código: OpenID Connect permite confiar en ese canal
  return validarClaims(jwt.decode(idToken), { nonce, clienteId: process.env.GOOGLE_CLIENT_ID });
}
