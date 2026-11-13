import { ErrorHttp } from "../../lib/errores.js";
import { nivelDePuntaje } from "../../domain/puntaje.js";
import { analizarHost } from "./analisis.service.js";
import * as repo from "./dominios.repository.js";

const conNivel = (d) => ({
  ...d,
  nivel: d.ultimoPuntaje === null ? null : nivelDePuntaje(d.ultimoPuntaje),
});

async function dominioDelUsuario(id, usuarioId) {
  const dominio = await repo.buscarDeUsuario(id, usuarioId);
  if (!dominio) throw new ErrorHttp(404, "Dominio no encontrado");
  return dominio;
}

export async function listar(usuarioId) {
  return (await repo.listar(usuarioId)).map(conNivel);
}

export async function registrar(usuarioId, nombre) {
  try {
    return await repo.crear(usuarioId, nombre);
  } catch (err) {
    if (err.code === "P2002") throw new ErrorHttp(409, "Ese dominio ya está registrado");
    throw err;
  }
}

export async function analizar(id, usuarioId) {
  const dominio = await dominioDelUsuario(id, usuarioId);
  const inicio = Date.now();
  const { puntaje, hallazgos, cert, subdominios, reputacion, exposicion } = await analizarHost(dominio.nombreDominio);

  const analisis = await repo.guardarAnalisis({
    dominioId: dominio.id,
    puntaje,
    duracionMs: Date.now() - inicio,
    hallazgos,
  });

  return {
    ...analisis,
    nivel: nivelDePuntaje(puntaje),
    certificado: cert,
    subdominios,
    reputacion: reputacion && { riesgo: reputacion.risk_score, nivel: reputacion.risk_level, asn: reputacion.network?.asn_org },
    exposicion: exposicion && { puertos: exposicion.ports, vulnerabilidades: exposicion.vulns },
  };
}

export async function historial(id, usuarioId) {
  const dominio = await dominioDelUsuario(id, usuarioId);
  return (await repo.listarAnalisis(dominio.id)).map((a) => ({ ...a, nivel: nivelDePuntaje(a.puntaje) }));
}
