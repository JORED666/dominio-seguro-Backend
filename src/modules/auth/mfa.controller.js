import { validar } from "../../lib/validar.js";
import { enviarSesion } from "./auth.controller.js";
import { activarSchema, desactivarSchema, verificarSchema } from "./mfa.schemas.js";
import * as servicio from "./mfa.service.js";

export async function configurar(req, res) {
  res.json(await servicio.configurar(req.usuario.id));
}

export async function activar(req, res) {
  const { codigo } = validar(activarSchema, req.body);
  res.json(await servicio.activar(req.usuario.id, codigo));
}

export async function desactivar(req, res) {
  res.json(await servicio.desactivar(req.usuario.id, validar(desactivarSchema, req.body)));
}

export async function verificarLogin(req, res) {
  enviarSesion(res, 200, await servicio.completarLogin(validar(verificarSchema, req.body, "Datos inválidos")));
}
