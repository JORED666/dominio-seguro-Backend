import test from "node:test";
import assert from "node:assert/strict";

process.env.CIFRADO_KEY = "ab".repeat(32);
const { cifrar, descifrar } = await import("../src/lib/cifrado.js");
const { codigoEn, nuevoSecreto, pasoActual, uriOtpauth, verificar } = await import("../src/lib/totp.js");

test("AES-256-GCM: cifra y descifra", () => {
  for (const texto of ["secreto", "", "ñandú 🔐 con acentos", "x".repeat(5000)]) {
    assert.equal(descifrar(cifrar(texto)), texto);
  }
});

test("AES-256-GCM: formato v1 y vector de inicialización distinto en cada cifrado", () => {
  const a = cifrar("mismo texto");
  const b = cifrar("mismo texto");
  assert.ok(a.startsWith("v1:"));
  assert.equal(a.split(":").length, 4);
  assert.notEqual(a, b);
  assert.ok(!a.includes("mismo texto"));
});

test("AES-256-GCM: detecta si alguien altera lo guardado", () => {
  const partes = cifrar("secreto").split(":");
  const datos = Buffer.from(partes[3], "base64");
  datos[0] ^= 1;
  partes[3] = datos.toString("base64");
  assert.throws(() => descifrar(partes.join(":")));
});

test("AES-256-GCM: no descifra con otra clave", () => {
  const guardado = cifrar("secreto");
  process.env.CIFRADO_KEY = "cd".repeat(32);
  try {
    assert.throws(() => descifrar(guardado));
  } finally {
    process.env.CIFRADO_KEY = "ab".repeat(32);
  }
});

test("AES-256-GCM: rechaza claves mal formadas y formatos desconocidos", () => {
  const buena = process.env.CIFRADO_KEY;
  try {
    process.env.CIFRADO_KEY = "corta";
    assert.throws(() => cifrar("x"), /64 caracteres/);
    delete process.env.CIFRADO_KEY;
    assert.throws(() => cifrar("x"), /64 caracteres/);
  } finally {
    process.env.CIFRADO_KEY = buena;
  }
  assert.throws(() => descifrar("v2:a:b:c"), /Formato/);
  assert.throws(() => descifrar("basura"), /Formato/);
});

// Secreto ASCII "12345678901234567890" en base32: vectores de prueba del RFC 6238 (SHA-1, 6 dígitos)
const RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("TOTP: coincide con los vectores del RFC 6238", () => {
  const vectores = [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"], [20000000000, "353130"]];
  for (const [segundos, esperado] of vectores) assert.equal(codigoEn(RFC, Math.floor(segundos / 30)), esperado, `t=${segundos}`);
});

test("TOTP: acepta el código actual y tolera una ventana de desfase, no dos", () => {
  const ahora = 1_700_000_000_000;
  const paso = pasoActual(ahora);
  assert.equal(verificar(RFC, codigoEn(RFC, paso), ahora), paso);
  assert.equal(verificar(RFC, codigoEn(RFC, paso - 1), ahora), paso - 1);
  assert.equal(verificar(RFC, codigoEn(RFC, paso + 1), ahora), paso + 1);
  assert.equal(verificar(RFC, codigoEn(RFC, paso - 2), ahora), null);
  assert.equal(verificar(RFC, codigoEn(RFC, paso + 2), ahora), null);
});

test("TOTP: rechaza códigos con formato inválido", () => {
  for (const c of ["", "12345", "1234567", "abcdef", "12 456", null, undefined]) assert.equal(verificar(RFC, c), null, String(c));
});

test("TOTP: los secretos nuevos son base32 de 32 caracteres y distintos", () => {
  const s = nuevoSecreto();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.notEqual(s, nuevoSecreto());
  assert.equal(verificar(s, codigoEn(s, pasoActual())), pasoActual());
});

test("TOTP: la URI otpauth lleva emisor, cuenta y secreto", () => {
  const uri = uriOtpauth("ABC234", "ana@ejemplo.com");
  assert.ok(uri.startsWith("otpauth://totp/"));
  assert.ok(uri.includes(encodeURIComponent("Dominio Seguro:ana@ejemplo.com")));
  assert.ok(uri.includes("secret=ABC234"));
  assert.ok(uri.includes("issuer=Dominio%20Seguro"));
});

test("AES-256-GCM: rechaza una etiqueta de autenticación más corta de lo esperado", () => {
  const partes = cifrar("secreto").split(":");
  partes[2] = Buffer.from(partes[2], "base64").subarray(0, 8).toString("base64");
  assert.throws(() => descifrar(partes.join(":")));
});
