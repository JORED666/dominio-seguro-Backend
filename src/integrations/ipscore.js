// Cliente de la API de reputación de IP (IP Score API). Solo recibe IPs públicas
// ya validadas por seguridad.js. Las variables se leen al llamar (no al importar)
// para que dotenv ya las haya cargado.
export async function consultarReputacion(ip) {
  const base = process.env.IPSCORE_URL;
  const llave = process.env.IPSCORE_API_KEY;
  if (!base || !llave) return null; // integración no configurada

  const res = await fetch(`${base}/api/v1/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": llave },
    body: JSON.stringify({ ip }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`IP Score respondió ${res.status}`);
  return res.json();
}
