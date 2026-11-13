import { validar } from "../../lib/validar.js";
import { loginSchema, registroSchema } from "./auth.schemas.js";
import * as servicio from "./auth.service.js";

export async function registro(req, res) {
  const datos = validar(registroSchema, req.body);
  res.status(201).json(await servicio.registrar(datos));
}

export async function login(req, res) {
  const datos = validar(loginSchema, req.body, "Datos inválidos");
  res.json(await servicio.iniciarSesion(datos));
}
