import test from "node:test";
import assert from "node:assert/strict";
import { calcularPuntaje, nivelDePuntaje } from "../src/domain/puntaje.js";

// Entrada "todo bien": cada fuente respondió y no hay problemas
const sano = () => ({
  cert: { autorizado: true, diasRestantes: 90, protocolo: "TLSv1.3" },
  subdominios: [],
  reputacion: { flags: {}, risk_score: 5 },
  exposicion: { ports: [443], vulns: [] },
  correo: { recibeCorreo: true, spf: { presente: true, todo: "-" }, dmarc: { presente: true, politica: "reject", pct: 100 }, dkim: ["google"] },
  cabeceras: { puntaje: 100, nota: "A+", pruebasFallidas: 0, pruebasTotales: 10, informe: "https://ejemplo/informe" },
  similares: { similares: [], revisadas: 20, fallidas: 0 },
});
const puntajeDe = (r, id) => r.categorias.find((c) => c.id === id).puntaje;

test("un dominio sin problemas obtiene 100 en todo", () => {
  const r = calcularPuntaje(sano());
  assert.equal(r.puntaje, 100);
  assert.ok(r.categorias.every((c) => c.puntaje === 100));
});

test("los pesos de las categorías suman 100", () => {
  const r = calcularPuntaje(sano());
  assert.equal(r.categorias.reduce((s, c) => s + c.peso, 0), 100);
});

test("sin HTTPS la categoría TLS queda en 0 y el total también", () => {
  const r = calcularPuntaje({ cert: null, subdominios: [] });
  assert.equal(puntajeDe(r, "tls"), 0);
  assert.equal(r.puntaje, 0);
  assert.equal(nivelDePuntaje(r.puntaje), "critico");
});

test("un certificado vencido es crítico y limita el total a 59", () => {
  const entrada = sano();
  entrada.cert = { autorizado: false, error: "CERT_HAS_EXPIRED", diasRestantes: -3, protocolo: "TLSv1.3" };
  const r = calcularPuntaje(entrada);
  assert.equal(puntajeDe(r, "tls"), 0);
  // Sin el tope sería (0*25 + 100*75) / 100 = 75
  assert.equal(r.puntaje, 59);
  assert.ok(r.hallazgos.some((h) => h.severidad === "critica" && h.titulo === "Certificado vencido"));
});

test("un certificado que vence en 10 días resta 35 a TLS", () => {
  const entrada = sano();
  entrada.cert.diasRestantes = 10;
  const r = calcularPuntaje(entrada);
  assert.equal(puntajeDe(r, "tls"), 65);
  assert.equal(r.puntaje, 91); // (65*25 + 100*75) / 100 = 91.25
});

test("TLS 1.0 resta 40 aunque el certificado sea válido", () => {
  const entrada = sano();
  entrada.cert.protocolo = "TLSv1";
  assert.equal(puntajeDe(calcularPuntaje(entrada), "tls"), 60);
});

test("puertos sensibles expuestos restan hasta 70 a Exposición", () => {
  const entrada = sano();
  entrada.exposicion = { ports: [443, 3306, 6379], vulns: [] };
  const r = calcularPuntaje(entrada);
  assert.equal(puntajeDe(r, "exposicion"), 30);
  assert.equal(r.puntaje, 86); // (100*25 + 100*25 + 100*20 + 30*20 + 100*10) / 100
  assert.ok(r.hallazgos.some((h) => h.titulo.includes("Servicios sensibles")));
});

test("la penalización de dominios similares depende del riesgo, no se acumula sin límite", () => {
  const entrada = sano();
  const muchos = Array.from({ length: 12 }, (_, i) => ({ nombre: `x${i}.com`, riesgo: "alto" }));
  entrada.similares = { similares: muchos, revisadas: 40, fallidas: 0 };
  assert.equal(puntajeDe(calcularPuntaje(entrada), "similares"), 30); // tope de resta: 70
});

test("SPF con +all es un problema alto", () => {
  const entrada = sano();
  entrada.correo.spf = { presente: true, todo: "+" };
  const r = calcularPuntaje(entrada);
  assert.equal(puntajeDe(r, "correo"), 40);
  assert.ok(r.hallazgos.some((h) => h.severidad === "alta" && h.titulo.includes("+all")));
});

test("sin SPF ni DMARC en un dominio sin correo pesa menos", () => {
  const entrada = sano();
  entrada.correo = { recibeCorreo: false, spf: { presente: false }, dmarc: { presente: false }, dkim: [] };
  assert.equal(puntajeDe(calcularPuntaje(entrada), "correo"), 60); // 100 - 20 - 20
  entrada.correo.recibeCorreo = true;
  assert.equal(puntajeDe(calcularPuntaje(entrada), "correo"), 20); // 100 - 40 - 40
});

test("una categoría sin datos no suma ni resta", () => {
  const entrada = sano();
  entrada.cabeceras = null; // Observatory no respondió
  const r = calcularPuntaje(entrada);
  assert.equal(puntajeDe(r, "cabeceras"), null);
  assert.equal(r.puntaje, 100);
});

test("las cabeceras con nota baja generan un hallazgo alto", () => {
  const entrada = sano();
  entrada.cabeceras = { puntaje: 20, nota: "F", pruebasFallidas: 8, pruebasTotales: 10, informe: "x" };
  const r = calcularPuntaje(entrada);
  assert.equal(puntajeDe(r, "cabeceras"), 20);
  assert.ok(r.hallazgos.some((h) => h.categoria === "Cabeceras" && h.severidad === "alta"));
});

test("el campo interno `resta` no sale en los hallazgos", () => {
  const entrada = sano();
  entrada.cert.diasRestantes = 10;
  const r = calcularPuntaje(entrada);
  assert.ok(r.hallazgos.length > 0);
  assert.ok(r.hallazgos.every((h) => !("resta" in h)));
});

test("niveles: 80+ bueno, 50-79 mejoras, menos de 50 crítico", () => {
  assert.equal(nivelDePuntaje(100), "bueno");
  assert.equal(nivelDePuntaje(80), "bueno");
  assert.equal(nivelDePuntaje(79), "mejoras");
  assert.equal(nivelDePuntaje(50), "mejoras");
  assert.equal(nivelDePuntaje(49), "critico");
  assert.equal(nivelDePuntaje(0), "critico");
});
