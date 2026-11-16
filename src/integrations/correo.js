import { Resolver } from "node:dns/promises";

// Revisa SPF, DMARC y DKIM con consultas DNS TXT. No contacta ningún servicio externo.
// DKIM no se puede descubrir (el selector es privado), así que se prueban los más comunes.
const SELECTORES_DKIM = ["default", "google", "selector1", "selector2", "k1", "k2", "mail", "dkim", "s1", "s2", "mandrill", "smtp"];

const resolver = new Resolver({ timeout: 3000, tries: 2 });

// Devuelve los registros TXT de un nombre (cada uno con sus fragmentos unidos).
// "No existe" no es error: es una lista vacía. Un fallo real del DNS sí lanza.
export async function txtReal(nombre) {
  try {
    return (await resolver.resolveTxt(nombre)).map((partes) => partes.join(""));
  } catch (err) {
    if (err.code === "ENODATA" || err.code === "ENOTFOUND") return [];
    throw err;
  }
}

async function tieneMx(host) {
  try {
    return (await resolver.resolveMx(host)).length > 0;
  } catch (err) {
    if (err.code === "ENODATA" || err.code === "ENOTFOUND") return false;
    throw err;
  }
}

export function leerSpf(registros) {
  const spf = registros.filter((r) => /^v=spf1(\s|$)/i.test(r.trim()));
  if (!spf.length) return { presente: false, multiples: false, registro: null, todo: null, redirect: false };
  const registro = spf[0].trim();
  const todo = registro.match(/(?:^|\s)([+\-~?]?)all(?:\s|$)/i);
  return {
    presente: true,
    multiples: spf.length > 1,
    registro,
    todo: todo ? todo[1] || "+" : null, // sin signo equivale a "+"
    redirect: /(?:^|\s)redirect=/i.test(registro),
  };
}

export function leerDmarc(registros) {
  const reg = registros.find((r) => /^v=DMARC1\b/i.test(r.trim()));
  if (!reg) return { presente: false, registro: null, politica: null, pct: 100, rua: false };
  const etiquetas = Object.fromEntries(
    reg.split(";").map((p) => p.trim().split("=")).filter((p) => p.length >= 2).map(([k, ...v]) => [k.trim().toLowerCase(), v.join("=").trim()])
  );
  return {
    presente: true,
    registro: reg.trim(),
    politica: (etiquetas.p || "").toLowerCase() || null,
    pct: etiquetas.pct ? Number(etiquetas.pct) : 100,
    rua: Boolean(etiquetas.rua),
  };
}

export async function revisarCorreo(host, txt = txtReal, mx = tieneMx) {
  const [registrosSpf, registrosDmarc, recibeCorreo] = await Promise.all([txt(host), txt(`_dmarc.${host}`), mx(host)]);

  // DKIM: se prueban los selectores comunes; un selector que falla no tumba la revisión
  const dkim = [];
  await Promise.all(
    SELECTORES_DKIM.map(async (sel) => {
      try {
        const r = await txt(`${sel}._domainkey.${host}`);
        if (r.some((x) => /v=DKIM1|p=/i.test(x))) dkim.push(sel);
      } catch {
        /* ese selector no se pudo consultar: se ignora */
      }
    })
  );

  return { spf: leerSpf(registrosSpf), dmarc: leerDmarc(registrosDmarc), dkim: dkim.sort(), recibeCorreo };
}
