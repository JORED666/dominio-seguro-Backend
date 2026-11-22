import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// TOTP (RFC 6238): código de 6 dígitos que cambia cada 30 segundos, compatible con Google Authenticator, Authy, etc.
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const VENTANA_MS = 30_000;

function aBase32(buf) {
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
    valor &= (1 << bits) - 1;
  }
  return bits > 0 ? salida + ALFABETO[(valor << (5 - bits)) & 31] : salida;
}

function deBase32(texto) {
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const letra of texto) {
    const i = ALFABETO.indexOf(letra);
    if (i < 0) continue;
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
    valor &= (1 << bits) - 1;
  }
  return Buffer.from(bytes);
}

export const nuevoSecreto = () => aBase32(randomBytes(20));

export const pasoActual = (ahora = Date.now()) => Math.floor(ahora / VENTANA_MS);

export function codigoEn(secreto, paso) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = createHmac("sha1", deBase32(secreto)).update(contador).digest();
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

// Devuelve el paso de tiempo que coincide (tolera ±1 ventana por desfase de reloj) o null
export function verificar(secreto, codigo, ahora = Date.now()) {
  if (!/^\d{6}$/.test(codigo)) return null;
  const actual = pasoActual(ahora);
  for (const delta of [0, -1, 1]) {
    const paso = actual + delta;
    if (timingSafeEqual(Buffer.from(codigoEn(secreto, paso)), Buffer.from(codigo))) return paso;
  }
  return null;
}

export const uriOtpauth = (secreto, correo) =>
  `otpauth://totp/${encodeURIComponent(`Dominio Seguro:${correo}`)}?secret=${secreto}&issuer=${encodeURIComponent("Dominio Seguro")}`;
