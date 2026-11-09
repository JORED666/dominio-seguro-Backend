// Shodan InternetDB: puertos abiertos, vulnerabilidades (CVE) y etiquetas por IP.
// Gratis y sin llave, con límite no publicado: por eso se guarda en caché 1 hora
// (los datos se actualizan semanalmente) y se usa timeout corto.
const cache = new Map();
const TTL_MS = 60 * 60 * 1000;

export async function consultarExposicion(ip) {
  const guardado = cache.get(ip);
  if (guardado && Date.now() - guardado.t < TTL_MS) return guardado.datos;

  const res = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
    signal: AbortSignal.timeout(5000),
  });

  let datos;
  if (res.status === 404) {
    datos = { ports: [], vulns: [], tags: [], hostnames: [], sinDatos: true };
  } else if (res.ok) {
    datos = await res.json();
  } else {
    throw new Error(`InternetDB respondió ${res.status}`);
  }
  cache.set(ip, { t: Date.now(), datos });
  return datos;
}
