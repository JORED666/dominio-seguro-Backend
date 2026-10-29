// Descubre subdominios a partir de certificados emitidos (crt.sh, API pública)
export async function descubrirSubdominios(dominio, maximo = 20) {
  const url = `https://crt.sh/?q=%25.${encodeURIComponent(dominio)}&output=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`crt.sh respondió ${res.status}`);

  const certificados = await res.json();
  const nombres = new Set();
  for (const cert of certificados) {
    for (const nombre of cert.name_value.split("\n")) {
      const limpio = nombre.trim().toLowerCase();
      if (!/^[a-z0-9.-]+$/.test(limpio)) continue;
      if (!limpio.startsWith("*") && limpio !== dominio) nombres.add(limpio);
    }
  }
  return [...nombres].slice(0, maximo);
}
