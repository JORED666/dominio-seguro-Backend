import tls from "node:tls";
import { Resolver } from "node:dns/promises";
import { esIpPrivada } from "../lib/seguridad.js";
import { generarVariantes, riesgoDe } from "../domain/similares.js";

// Revisa con DNS cuáles variantes de un dominio existen y qué tan peligrosas son.
// "No existe" no es error; un fallo real del DNS (timeout, SERVFAIL) sí cuenta como fallido.
const resolver = new Resolver({ timeout: 3000, tries: 1 });
const CONCURRENCIA = 8;

async function lista(consulta) {
  try {
    return await consulta();
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") return [];
    throw err;
  }
}

// ¿Responde HTTPS? Solo se conecta a IPs públicas: una variante podría apuntar a la red interna
function tieneCertificado(ip, host) {
  if (esIpPrivada(ip)) return Promise.resolve(false);
  return new Promise((resolve) => {
    // Riesgo aceptado: es un analizador y debe leer certificados inválidos. Solo se hace el saludo TLS, no se envían datos, y el destino ya pasó la validación anti-SSRF.
    // nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification
    const socket = tls.connect({ host: ip, port: 443, servername: host, rejectUnauthorized: false, timeout: 4000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

export async function revisarVariante(nombre, dns = resolver, certificado = tieneCertificado) {
  const [ips, mx, ns] = await Promise.all([
    lista(() => dns.resolve4(nombre)),
    lista(() => dns.resolveMx(nombre)),
    lista(() => dns.resolveNs(nombre)),
  ]);
  const estado = ips.length ? "activo" : mx.length || ns.length ? "registrado" : "libre";
  const conCorreo = mx.length > 0;
  const conCertificado = ips.length ? await certificado(ips[0], nombre) : false;
  return { estado, conCorreo, conCertificado, riesgo: riesgoDe({ estado, conCorreo, conCertificado }) };
}

// Reparte el trabajo en un grupo limitado de consultas simultáneas
async function enLotes(items, limite, fn) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      const k = siguiente++;
      resultados[k] = await fn(items[k]).then((v) => ({ ok: true, v }), () => ({ ok: false }));
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

export async function revisarSimilares(dominio, revisar = revisarVariante) {
  const variantes = generarVariantes(dominio);
  const resultados = await enLotes(variantes, CONCURRENCIA, (v) => revisar(v.nombre));
  const fallidas = resultados.filter((r) => !r.ok).length;
  // Si el DNS no respondió para ninguna, no hay nada que evaluar
  if (variantes.length && fallidas === variantes.length) throw new Error("El DNS no respondió");
  const similares = variantes.flatMap((v, i) => (resultados[i].ok ? [{ ...v, ...resultados[i].v }] : []));
  return { similares, revisadas: variantes.length, fallidas };
}
