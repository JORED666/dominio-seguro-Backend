import { validar } from "../../lib/validar.js";
import { rolSchema } from "./admin.schemas.js";
import { ejecutarRevision } from "../../jobs/revision.js";
import * as servicio from "./admin.service.js";

export async function usuarios(_req, res) {
  res.json(await servicio.listarUsuarios());
}

export async function cambiarRol(req, res) {
  const { rol } = validar(rolSchema, req.body);
  res.json(await servicio.cambiarRol(req.params.id, rol, req.usuario.id));
}

export async function revision(_req, res) {
  const resumen = await ejecutarRevision();
  if (!resumen) return res.status(409).json({ error: "Ya hay una revisión en curso" });
  res.json(resumen);
}
