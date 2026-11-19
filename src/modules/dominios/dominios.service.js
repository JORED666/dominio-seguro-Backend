import { ErrorHttp } from "../../lib/errores.js";
import { detectarCambios } from "../../domain/cambios.js";
import { nivelDePuntaje } from "../../domain/puntaje.js";
import { coincide, nombreRegistro, nuevoToken, valorRegistro } from "../../domain/verificacion.js";
import { consultarTxt } from "../../integrations/dns-txt.js";
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
    return await repo.crear(usuarioId, nombre, nuevoToken());
  } catch (err) {
    if (err.code === "P2002") throw new ErrorHttp(409, "Ese dominio ya está registrado");
    throw err;
  }
}

export async function analizar(id, usuarioId) {
  const dominio = await dominioDelUsuario(id, usuarioId);
  if (process.env.EXIGIR_VERIFICACION !== "false" && !dominio.verificadoEn) {
    throw new ErrorHttp(403, "Verifica que eres dueño del dominio antes de analizarlo");
  }
  return (await ejecutarAnalisis(dominio)).respuesta;
}

// Corre el análisis completo, lo guarda y lo compara con el anterior.
// Lo usan el botón "Analizar" y la revisión programada.
export async function ejecutarAnalisis(dominio) {
  const inicio = Date.now();
  const previo = await repo.ultimoAnalisis(dominio.id);
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

  const cambios = detectarCambios(previo, analisis);

  const respuesta = {
    ...analisis,
    cambios,
    nivel: nivelDePuntaje(puntaje),
    categorias,
    similares,
    certificado: cert,
    subdominios,
    reputacion: reputacion && { riesgo: reputacion.risk_score, nivel: reputacion.risk_level, asn: reputacion.network?.asn_org },
    exposicion: exposicion && { puertos: exposicion.ports, vulnerabilidades: exposicion.vulns },
  };
  return { cambios, respuesta };
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

const conToken = async (dominio) => dominio.tokenVerificacion ? dominio : repo.asegurarToken(dominio.id, nuevoToken());

const instrucciones = (d) => ({
  verificado: Boolean(d.verificadoEn),
  verificadoEn: d.verificadoEn,
  registro: { tipo: "TXT", nombre: nombreRegistro(d.nombreDominio), valor: valorRegistro(d.tokenVerificacion) },
});

export async function verificacion(id, usuarioId) {
  return instrucciones(await conToken(await dominioDelUsuario(id, usuarioId)));
}

export async function verificar(id, usuarioId) {
  let dominio = await conToken(await dominioDelUsuario(id, usuarioId));
  if (dominio.verificadoEn) return instrucciones(dominio);

  let registros;
  try {
    registros = await consultarTxt(nombreRegistro(dominio.nombreDominio));
  } catch {
    throw new ErrorHttp(502, "No pudimos consultar el DNS en este momento; intenta de nuevo");
  }
  if (!coincide(registros, dominio.tokenVerificacion)) {
    throw new ErrorHttp(422, "No encontramos el registro TXT. Puede tardar unos minutos en propagarse; revisa que el nombre y el valor sean exactos.");
  }
  dominio = await repo.marcarVerificado(dominio.id);
  return instrucciones(dominio);
}
