import cron from "node-cron";
import { revisarTodos } from "../modules/dominios/revision.service.js";

let enCurso = false;

// Una sola revisión a la vez: si la anterior no ha terminado, se omite
export async function ejecutarRevision() {
  if (enCurso) return null;
  enCurso = true;
  try {
    const resumen = await revisarTodos();
    console.log(`Revisión terminada: ${resumen.revisados} dominios, ${resumen.avisos} avisos, ${resumen.errores} errores`);
    return resumen;
  } finally {
    enCurso = false;
  }
}

export function iniciarRevisionProgramada() {
  if (process.env.REVISION_ACTIVA === "false") {
    console.log("Revisión programada desactivada");
    return;
  }
  const expresion = process.env.REVISION_CRON || "0 7 * * *";
  if (!cron.validate(expresion)) throw new Error(`REVISION_CRON inválida: ${expresion}`);
  cron.schedule(expresion, ejecutarRevision, { timezone: "America/Mexico_City" });
  console.log(`Revisión programada de dominios: ${expresion}`);
}
