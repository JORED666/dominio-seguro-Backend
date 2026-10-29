import dns from "node:dns/promises";
import net from "node:net";

// Formato básico de dominio (ej. ejemplo.com, www.ejemplo.com.mx)
const REGEX_DOMINIO = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function esDominioValido(dominio) {
  return typeof dominio === "string" && REGEX_DOMINIO.test(dominio);
}

// Protección anti-SSRF: rechaza IPs privadas, locales o reservadas
export function esIpPrivada(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

// Resuelve el dominio y devuelve una IP pública, o lanza error
export async function resolverIpPublica(host) {
  const { address } = await dns.lookup(host, { family: 4 });
  if (esIpPrivada(address)) {
    throw new Error("El dominio apunta a una dirección no permitida");
  }
  return address;
}
