import { leerCookie } from "../../lib/cookies.js";
import { validar } from "../../lib/validar.js";
import { loginSchema, registroSchema } from "./auth.schemas.js";
import * as servicio from "./auth.service.js";

const COOKIE = "ds_refresh";

// El token de refresco viaja en una cookie httpOnly: el JavaScript de la página no puede leerlo
const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth",
});

export function enviarSesion(res, estado, { refresco, ...cuerpo }) {
  if (cuerpo.mfaRequerido) return res.status(estado).json(cuerpo);
  res.cookie(COOKIE, refresco, { ...opcionesCookie(), maxAge: servicio.DURACION_REFRESCO_MS });
  res.status(estado).json(cuerpo);
}

export async function registro(req, res) {
  const datos = validar(registroSchema, req.body);
  enviarSesion(res, 201, await servicio.registrar(datos));
}

export async function login(req, res) {
  const datos = validar(loginSchema, req.body, "Datos inválidos");
  enviarSesion(res, 200, await servicio.iniciarSesion(datos));
}

export async function refrescar(req, res) {
  enviarSesion(res, 200, await servicio.refrescar(leerCookie(req, COOKIE)));
}

export async function salir(req, res) {
  await servicio.cerrarSesion(leerCookie(req, COOKIE));
  res.clearCookie(COOKIE, opcionesCookie());
  res.status(204).end();
}
