import { timingSafeEqual } from "node:crypto";
import * as google from "../../integrations/google.js";
import { leerCookie } from "../../lib/cookies.js";
import { COOKIE, opcionesCookie } from "./auth.controller.js";
import * as servicio from "./auth.service.js";

const COOKIE_OAUTH = "ds_oauth";

// Lax y no Strict: Google regresa al usuario desde otro sitio y una cookie Strict no viajaría
const opcionesOauth = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/google",
});

const panel = () => (process.env.PANEL_URL || "http://localhost:4200").replace(/\/$/, "");

const iguales = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function iniciar(req, res) {
  if (!google.configurado()) return res.redirect(`${panel()}/login?error=google`);
  const intento = google.nuevoIntento();
  const { state, nonce, verifier } = intento;
  const valor = Buffer.from(JSON.stringify({ state, nonce, verifier })).toString("base64url");
  res.cookie(COOKIE_OAUTH, valor, { ...opcionesOauth(), maxAge: 10 * 60 * 1000 });
  res.redirect(google.urlAutorizacion(intento));
}

export async function callback(req, res) {
  const falla = () => res.redirect(`${panel()}/login?error=google`);
  let guardado = null;
  try {
    guardado = JSON.parse(Buffer.from(leerCookie(req, COOKIE_OAUTH) || "", "base64url").toString());
  } catch {
    guardado = null;
  }
  res.clearCookie(COOKIE_OAUTH, opcionesOauth());

  const { code, state } = req.query;
  const valido =
    guardado &&
    typeof guardado.state === "string" &&
    typeof code === "string" &&
    typeof state === "string" &&
    iguales(state, guardado.state);
  if (!valido) return falla();

  try {
    const perfil = await google.canjearCodigo({ code, verifier: guardado.verifier, nonce: guardado.nonce });
    const resultado = await servicio.iniciarSesionConGoogle(perfil);
    if (resultado.mfaRequerido) {
      // Sin sesión todavía: el token de verificación viaja en el fragmento (#), que no llega a ningún servidor
      return res.redirect(`${panel()}/acceso/google#mfa=${encodeURIComponent(resultado.mfaToken)}`);
    }
    const { refresco } = resultado;
    res.cookie(COOKIE, refresco, { ...opcionesCookie(), maxAge: servicio.DURACION_REFRESCO_MS });
    res.redirect(`${panel()}/acceso/google`);
  } catch (e) {
    console.error("Google:", e.message);
    falla();
  }
}
