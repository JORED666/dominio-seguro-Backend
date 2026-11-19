import test from "node:test";
import assert from "node:assert/strict";
import { detectarCambios } from "../src/domain/cambios.js";
import { armarCorreo } from "../src/domain/correo-alerta.js";

const h = (categoria, severidad, titulo) => ({ categoria, severidad, titulo, descripcion: "d", recomendacion: "r" });
const base = { puntaje: 85, hallazgos: [h("TLS", "info", "Certificado vigente"), h("TLS", "baja", "El certificado vence en 29 días")] };

test("el primer análisis no tiene con qué compararse", () => {
  assert.equal(detectarCambios(null, base), null);
});

test("sin cambios no avisa", () => {
  assert.equal(detectarCambios(base, { ...base }).importante, false);
});

test("los números del título no cuentan como problema nuevo", () => {
  const hoy = { puntaje: 84, hallazgos: [h("TLS", "info", "Certificado vigente"), h("TLS", "baja", "El certificado vence en 28 días")] };
  const c = detectarCambios(base, hoy);
  assert.equal(c.nuevos.length, 0);
  assert.equal(c.importante, false);
});

test("un problema nuevo de severidad alta avisa", () => {
  const c = detectarCambios(base, { puntaje: 80, hallazgos: [...base.hallazgos, h("Cabeceras", "alta", "Falta CSP")] });
  assert.equal(c.importante, true);
  assert.equal(c.nuevos.length, 1);
});

test("un problema nuevo de severidad baja no avisa", () => {
  const c = detectarCambios(base, { puntaje: 85, hallazgos: [...base.hallazgos, h("Similares", "baja", "algo menor")] });
  assert.equal(c.importante, false);
});

test("una caída de 10 puntos o más avisa aunque no haya hallazgos nuevos", () => {
  const c = detectarCambios({ puntaje: 95, hallazgos: [] }, { puntaje: 85, hallazgos: [] });
  assert.equal(c.delta, -10);
  assert.equal(c.importante, true);
});

test("una caída de 6 puntos sin cruzar de nivel no avisa", () => {
  assert.equal(detectarCambios({ puntaje: 90, hallazgos: [] }, { puntaje: 84, hallazgos: [] }).importante, false);
});

test("empeorar de nivel avisa aunque la caída sea pequeña", () => {
  const c = detectarCambios({ puntaje: 81, hallazgos: [] }, { puntaje: 79, hallazgos: [] });
  assert.equal(c.nivelAntes, "bueno");
  assert.equal(c.nivelAhora, "mejoras");
  assert.equal(c.importante, true);
});

test("mejorar no avisa y lista lo resuelto", () => {
  const c = detectarCambios({ puntaje: 60, hallazgos: [h("TLS", "alta", "Certificado vencido")] }, { puntaje: 90, hallazgos: [] });
  assert.equal(c.importante, false);
  assert.equal(c.delta, 30);
  assert.equal(c.resueltos.length, 1);
});

test("el correo de alerta escapa HTML de datos externos", () => {
  const cambios = {
    importante: true, puntajeAntes: 85, puntajeAhora: 60, delta: -25, nivelAntes: "bueno", nivelAhora: "mejoras",
    nuevos: [{ categoria: "X", severidad: "critica", titulo: "<script>alert(1)</script>", descripcion: 'a "b" & c', recomendacion: "r" }],
    resueltos: [],
  };
  const m = armarCorreo({ dominio: "ejemplo.com", nombreUsuario: "Ana <b>", cambios, urlPanel: "http://localhost:4200/dominios" });
  assert.equal(m.asunto, "Alerta de seguridad en ejemplo.com: 85 → 60");
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("&lt;script&gt;"));
  assert.ok(m.html.includes("Ana &lt;b&gt;"));
  assert.ok(m.html.includes("&quot;b&quot; &amp; c"));
  assert.ok(m.texto.includes("Puntaje: 85 → 60 (-25)"));
});
