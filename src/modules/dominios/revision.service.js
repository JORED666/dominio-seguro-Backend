import { armarCorreo } from "../../domain/correo-alerta.js";
import { enviarCorreo } from "../../integrations/mailer.js";
import { ejecutarAnalisis } from "./dominios.service.js";
import * as repo from "./dominios.repository.js";

const urlPanel = () => `${process.env.PANEL_URL || process.env.CORS_ORIGIN || "http://localhost:4200"}/dominios`;

// Vuelve a analizar cada dominio y avisa por correo al dueño solo si algo importante cambió.
// Las dependencias se pueden reemplazar para probarlo sin red ni base de datos.
export async function revisarTodos({
  listar = repo.listarParaRevision,
  analizar = ejecutarAnalisis,
  enviar = enviarCorreo,
  log = console,
} = {}) {
  const resumen = { revisados: 0, avisos: 0, errores: 0 };
  for (const dominio of await listar()) {
    try {
      const { cambios } = await analizar(dominio);
      resumen.revisados++;
      if (cambios?.importante) {
        const correo = armarCorreo({
          dominio: dominio.nombreDominio,
          nombreUsuario: dominio.usuario.nombre,
          cambios,
          urlPanel: urlPanel(),
        });
        await enviar({ para: dominio.usuario.correo, ...correo });
        resumen.avisos++;
      }
    } catch (err) {
      resumen.errores++;
      log.error(`Revisión de ${dominio.nombreDominio} falló: ${err.message}`);
    }
  }
  return resumen;
}
