import { ErrorHttp } from "../../lib/errores.js";
import * as repo from "./admin.repository.js";

export async function listarUsuarios() {
  return (await repo.listar()).map(({ _count, ...u }) => ({ ...u, dominios: _count.dominios }));
}

export async function cambiarRol(id, rol, solicitanteId) {
  // Evita que un admin se quite el acceso a sí mismo por accidente
  if (id === solicitanteId) throw new ErrorHttp(400, "No puedes cambiar tu propio rol");
  if (!(await repo.buscar(id))) throw new ErrorHttp(404, "Usuario no encontrado");
  return repo.actualizarRol(id, rol);
}
