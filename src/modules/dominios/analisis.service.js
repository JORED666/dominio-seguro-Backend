import { ErrorHttp } from "../../lib/errores.js";
import { resolverIpPublica } from "../../lib/seguridad.js";
import { revisarCertificado } from "../../integrations/tls.js";
import { descubrirSubdominios } from "../../integrations/crtsh.js";
import { consultarReputacion } from "../../integrations/ipscore.js";
import { consultarExposicion } from "../../integrations/internetdb.js";
import { revisarCorreo } from "../../integrations/correo.js";
import { revisarCabeceras } from "../../integrations/observatory.js";
import { calcularPuntaje } from "../../domain/puntaje.js";

// Consulta las fuentes en paralelo: si una falla, el análisis sigue con lo demás
const valorDe = (r) => (r.status === "fulfilled" ? r.value : null);

/** Ejecuta el análisis completo de un host y devuelve puntaje, hallazgos y los datos recolectados. */
export async function analizarHost(host) {
  let ip;
  try {
    ip = await resolverIpPublica(host);
  } catch (err) {
    throw new ErrorHttp(400, err.message);
  }

  const [resCert, resCrt, resRep, resExp, resCorreo, resCabeceras] = await Promise.allSettled([
    revisarCertificado(ip, host),
    descubrirSubdominios(host),
    consultarReputacion(ip),
    consultarExposicion(ip),
    revisarCorreo(host),
    revisarCabeceras(host),
  ]);

  const cert = valorDe(resCert);
  const subdominios = valorDe(resCrt) ?? [];
  const reputacion = valorDe(resRep);
  const exposicion = valorDe(resExp);
  const correo = valorDe(resCorreo);
  const cabeceras = valorDe(resCabeceras);

  const { puntaje, categorias, hallazgos } = calcularPuntaje({
    cert,
    subdominios,
    errorCrt: resCrt.status === "rejected",
    reputacion,
    errorReputacion: resRep.status === "rejected",
    exposicion,
    errorExposicion: resExp.status === "rejected",
    correo,
    errorCorreo: resCorreo.status === "rejected",
    cabeceras,
    errorCabeceras: resCabeceras.status === "rejected",
  });

  return { puntaje, categorias, hallazgos, cert, subdominios, reputacion, exposicion };
}
