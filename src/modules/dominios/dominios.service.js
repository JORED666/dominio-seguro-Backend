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
  const propios = new Set(await repo.nombresPropios(dominio.id));
  const { puntaje, categorias, hallazgos, cert, subdominios, reputacion, exposicion, similares } = await analizarHost(dominio.nombreDominio, propios);

  const analisis = await repo.guardarAnalisis({
    dominioId: dominio.id,
    puntaje,
    duracionMs: Date.now() - inicio,
    categorias,
    hallazgos,
  });

  if (similares.length) await repo.guardarSimilares(dominio.id, similares);

  return {
    ...analisis,
    nivel: nivelDePuntaje(puntaje),
    categorias,
    similares,
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

const RANGO_RIESGO = { alto: 0, medio: 1, bajo: 2 };

export async function similares(id, usuarioId) {
  const dominio = await dominioDelUsuario(id, usuarioId);
  const lista = await repo.listarSimilares(dominio.id);
  return lista.sort((a, b) => RANGO_RIESGO[a.riesgo] - RANGO_RIESGO[b.riesgo] || a.nombre.localeCompare(b.nombre));
}

export async function marcarSimilar(id, similarId, usuarioId, cambios) {
  const dominio = await dominioDelUsuario(id, usuarioId);
  if (!(await repo.buscarSimilar(similarId, dominio.id))) throw new ErrorHttp(404, "Dominio similar no encontrado");
  return repo.actualizarSimilar(similarId, cambios);
}
