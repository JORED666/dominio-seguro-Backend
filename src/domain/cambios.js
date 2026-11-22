import { nivelDePuntaje } from "./puntaje.js";

// Compara el análisis anterior con el nuevo y decide si vale la pena avisar al dueño.
// Función pura: no toca la base de datos ni la red.
const RANGO = { info: 0, baja: 1, media: 2, alta: 3, critica: 4 };
const ORDEN_NIVEL = { critico: 0, mejoras: 1, bueno: 2 };
const CAIDA_IMPORTANTE = 10;

// Los números del título cambian cada día ("vence en 14 días"): se ignoran para no avisar dos veces de lo mismo
const clave = (h) => `${h.categoria}|${h.titulo.replace(/\d+/g, "#")}`;
const relevante = (h) => RANGO[h.severidad] >= RANGO.media;

export function detectarCambios(anterior, actual) {
  if (!anterior) return null; // primer análisis: sin punto de comparación

  const antes = new Set(anterior.hallazgos.map(clave));
  const ahora = new Set(actual.hallazgos.map(clave));
  const nuevos = actual.hallazgos.filter((h) => relevante(h) && !antes.has(clave(h)));
  const resueltos = anterior.hallazgos.filter((h) => relevante(h) && !ahora.has(clave(h)));

  const delta = actual.puntaje - anterior.puntaje;
  const nivelAntes = nivelDePuntaje(anterior.puntaje);
  const nivelAhora = nivelDePuntaje(actual.puntaje);
  const empeoro = ORDEN_NIVEL[nivelAhora] < ORDEN_NIVEL[nivelAntes];

  return {
    importante: nuevos.length > 0 || delta <= -CAIDA_IMPORTANTE || empeoro,
    puntajeAntes: anterior.puntaje,
    puntajeAhora: actual.puntaje,
    delta,
    nivelAntes,
    nivelAhora,
    nuevos,
    resueltos,
  };
}
