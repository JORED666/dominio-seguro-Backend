import { validar } from "../../lib/validar.js";
import { dominioSchema } from "./dominios.schemas.js";
import * as servicio from "./dominios.service.js";

export async function listar(req, res) {
  res.json(await servicio.listar(req.usuario.id));
}

export async function crear(req, res) {
  const { nombre } = validar(dominioSchema, req.body);
  res.status(201).json(await servicio.registrar(req.usuario.id, nombre));
}

export async function analizar(req, res) {
  res.status(201).json(await servicio.analizar(req.params.id, req.usuario.id));
}

export async function historial(req, res) {
  res.json(await servicio.historial(req.params.id, req.usuario.id));
}
