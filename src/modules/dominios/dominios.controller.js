import { validar } from "../../lib/validar.js";
import { dominioSchema, similarSchema } from "./dominios.schemas.js";
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

export async function similares(req, res) {
  res.json(await servicio.similares(req.params.id, req.usuario.id));
}

export async function marcarSimilar(req, res) {
  const cambios = validar(similarSchema, req.body);
  res.json(await servicio.marcarSimilar(req.params.id, req.params.similarId, req.usuario.id, cambios));
}
