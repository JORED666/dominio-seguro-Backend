import { validar } from "../../lib/validar.js";
import { rolSchema } from "./admin.schemas.js";
import * as servicio from "./admin.service.js";

export async function usuarios(_req, res) {
  res.json(await servicio.listarUsuarios());
}

export async function cambiarRol(req, res) {
  const { rol } = validar(rolSchema, req.body);
  res.json(await servicio.cambiarRol(req.params.id, rol, req.usuario.id));
}
