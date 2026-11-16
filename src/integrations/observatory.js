// MDN HTTP Observatory v2: evalúa las cabeceras de seguridad del sitio (CSP, HSTS, cookies...).
// Solo permite un escaneo por host cada 60 segundos, así que el resultado se guarda en caché
// (en memoria; la caché en PostgreSQL llegará junto con la migración de categorías).
const URL_BASE = "https://observatory-api.mdn.mozilla.net/api/v2/scan";
const TTL_MS = 60 * 60 * 1000;
const cache = new Map();

export async function revisarCabeceras(host, peticion = fetch) {
  const guardado = cache.get(host);
  if (guardado && Date.now() - guardado.t < TTL_MS) return guardado.datos;

  const res = await peticion(`${URL_BASE}?host=${encodeURIComponent(host)}`, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Observatory respondió ${res.status}`);

  const d = await res.json();
  // Si no pudo evaluar el sitio (caído, sin HTTPS...) no hay nota que usar
  if (d.error || typeof d.score !== "number") throw new Error(`Observatory: ${d.error || "sin resultado"}`);

  const datos = {
    nota: d.grade,
    puntaje: d.score,
    pruebasFallidas: d.tests_failed,
    pruebasTotales: d.tests_quantity,
    informe: d.details_url,
  };
  cache.set(host, { t: Date.now(), datos });
  return datos;
}
