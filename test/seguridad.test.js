import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { esDominioValido, esIpPrivada } from "../src/lib/seguridad.js";
import { generarVariantes, riesgoDe } from "../src/domain/similares.js";
import { coincide, nombreRegistro, nuevoToken, valorRegistro } from "../src/domain/verificacion.js";
import { hashToken, nuevoTokenRefresco } from "../src/lib/tokens.js";
import { leerCookie } from "../src/lib/cookies.js";

test("acepta dominios válidos", () => {
  for (const d of ["mitienda.mx", "sub.ejemplo.com.mx", "a-b.org", "EJEMPLO.COM"]) assert.equal(esDominioValido(d), true, d);
});

test("rechaza entradas que no son un dominio (anti-SSRF)", () => {
  const malos = ["localhost", "http://ejemplo.com", "ejemplo.com/ruta", "ejemplo.com:8080", "-malo.com", "con espacios.com", "ejemplo", "", "1.2.3.4", "a..com", "x@y.com"];
  for (const d of malos) assert.equal(esDominioValido(d), false, d);
  assert.equal(esDominioValido(null), false);
  assert.equal(esDominioValido(undefined), false);
});

test("reconoce direcciones IP privadas y reservadas", () => {
  for (const ip of ["10.0.0.1", "127.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1"]) {
    assert.equal(esIpPrivada(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1"]) assert.equal(esIpPrivada(ip), false, ip);
});

test("las variantes de typosquatting son válidas, distintas del original y acotadas", () => {
  const variantes = generarVariantes("mitienda.mx");
  assert.ok(variantes.length > 5);
  const nombres = variantes.map((v) => v.nombre);
  assert.ok(!nombres.includes("mitienda.mx"));
  assert.equal(new Set(nombres).size, nombres.length);
  assert.ok(nombres.every(esDominioValido));
  const porTecnica = {};
  for (const v of variantes) porTecnica[v.tecnica] = (porTecnica[v.tecnica] ?? 0) + 1;
  assert.ok(Object.values(porTecnica).every((n) => n <= 4));
  assert.ok(variantes.some((v) => v.tecnica === "tld"));
});

test("las variantes son deterministas", () => {
  assert.deepEqual(generarVariantes("mitienda.mx"), generarVariantes("mitienda.mx"));
});

test("sin etiqueta usable no se generan variantes", () => {
  assert.deepEqual(generarVariantes("sinpunto"), []);
  assert.deepEqual(generarVariantes("a.mx"), []);
});

test("riesgo de una variante según lo que se encontró en DNS", () => {
  assert.equal(riesgoDe({ estado: "activo", conCorreo: true, conCertificado: false }), "alto");
  assert.equal(riesgoDe({ estado: "activo", conCorreo: false, conCertificado: true }), "alto");
  assert.equal(riesgoDe({ estado: "activo", conCorreo: false, conCertificado: false }), "medio");
  assert.equal(riesgoDe({ estado: "registrado", conCorreo: true, conCertificado: false }), "medio");
  assert.equal(riesgoDe({ estado: "registrado", conCorreo: false, conCertificado: false }), "bajo");
  assert.equal(riesgoDe({ estado: "libre", conCorreo: false, conCertificado: false }), "bajo");
});

test("verificación de propiedad: formato del registro TXT", () => {
  const token = nuevoToken();
  assert.match(token, /^[0-9a-f]{32}$/);
  assert.notEqual(token, nuevoToken());
  assert.equal(nombreRegistro("mitienda.mx"), "_dominio-seguro.mitienda.mx");
  assert.equal(valorRegistro(token), `dominio-seguro-verificacion=${token}`);
});

test("verificación de propiedad: compara el valor exacto, aunque el DNS lo parta en trozos", () => {
  const token = "abc123";
  const valor = valorRegistro(token);
  assert.equal(coincide([[valor]], token), true);
  assert.equal(coincide([["otro"], [valor.slice(0, 10), valor.slice(10)]], token), true);
  assert.equal(coincide([[` ${valor} `]], token), true);
  assert.equal(coincide([[valor + "x"]], token), false);
  assert.equal(coincide([["dominio-seguro-verificacion=otro"]], token), false);
  assert.equal(coincide([], token), false);
  assert.equal(coincide([[valor]], null), false);
});

test("tokens de refresco: aleatorios, opacos y solo se guarda su hash", () => {
  const a = nuevoTokenRefresco();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, nuevoTokenRefresco());
  assert.equal(hashToken(a), hashToken(a));
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(a), a);
  assert.notEqual(hashToken(a), hashToken(randomBytes(8).toString("hex")));
});

test("lectura de cookies", () => {
  const req = (c) => ({ headers: { cookie: c } });
  assert.equal(leerCookie(req("ds_refresh=abc"), "ds_refresh"), "abc");
  assert.equal(leerCookie(req("otra=1; ds_refresh=abc; mas=2"), "ds_refresh"), "abc");
  assert.equal(leerCookie(req("  ds_refresh = abc "), "ds_refresh"), "abc");
  assert.equal(leerCookie(req("ds_refresh=a%20b"), "ds_refresh"), "a b");
  assert.equal(leerCookie(req("otra=1"), "ds_refresh"), null);
  assert.equal(leerCookie({ headers: {} }, "ds_refresh"), null);
  assert.equal(leerCookie(req("ds_refresh=%E0%A4%A"), "ds_refresh"), null); // codificación rota
});
