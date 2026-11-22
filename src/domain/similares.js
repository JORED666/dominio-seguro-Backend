import { esDominioValido } from "../lib/seguridad.js";

// Dominios parecidos al tuyo (typosquatting): se generan variantes con los trucos más comunes.
// Lógica pura, sin red: la revisión con DNS está en integrations/similares.js.
const HOMOGLIFOS = { o: ["0"], l: ["1"], i: ["l"], a: ["4"], e: ["3"], m: ["rn"], w: ["vv"] };
const TLDS = ["com", "net", "org", "mx", "com.mx"];
const MAX_POR_TECNICA = 4;

// Toma n elementos repartidos a lo largo de la lista (siempre los mismos para el mismo dominio)
function muestreo(lista, n) {
  if (lista.length <= n) return lista;
  return Array.from({ length: n }, (_, k) => lista[Math.floor((k * lista.length) / n)]);
}

export function generarVariantes(dominio) {
  const punto = dominio.indexOf(".");
  if (punto < 2) return [];
  const etiqueta = dominio.slice(0, punto);
  const tld = dominio.slice(punto + 1);
  const grupos = { omision: [], repeticion: [], intercambio: [], homoglifo: [], guion: [], tld: [] };
  const agregar = (tecnica, et, t = tld) => grupos[tecnica].push(`${et}.${t}`);

  for (let i = 0; i < etiqueta.length; i++) {
    const antes = etiqueta.slice(0, i);
    const despues = etiqueta.slice(i + 1);
    if (etiqueta.length > 3) agregar("omision", antes + despues);
    agregar("repeticion", antes + etiqueta[i] + etiqueta[i] + despues);
    if (i < etiqueta.length - 1 && etiqueta[i] !== etiqueta[i + 1]) {
      agregar("intercambio", antes + etiqueta[i + 1] + etiqueta[i] + etiqueta.slice(i + 2));
    }
    for (const r of HOMOGLIFOS[etiqueta[i]] ?? []) agregar("homoglifo", antes + r + despues);
    if (i >= 2 && i <= etiqueta.length - 2) agregar("guion", etiqueta.slice(0, i) + "-" + etiqueta.slice(i));
  }
  for (const t of TLDS) if (t !== tld) agregar("tld", etiqueta, t);

  const vistos = new Set([dominio]);
  const salida = [];
  for (const [tecnica, lista] of Object.entries(grupos)) {
    const validas = [...new Set(lista)].filter((n) => !vistos.has(n) && esDominioValido(n));
    for (const nombre of muestreo(validas, MAX_POR_TECNICA)) {
      vistos.add(nombre);
      salida.push({ nombre, tecnica });
    }
  }
  return salida;
}

// Qué tan peligrosa es una variante según lo que se encontró en DNS
export function riesgoDe({ estado, conCorreo, conCertificado }) {
  if (estado === "activo") return conCorreo || conCertificado ? "alto" : "medio";
  if (estado === "registrado") return conCorreo ? "medio" : "bajo";
  return "bajo"; // libre: no hay nadie usándola
}
