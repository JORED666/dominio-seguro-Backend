import { Resolver } from "node:dns/promises";

const resolver = new Resolver({ timeout: 4000, tries: 1 });

// Registros TXT de un nombre. "No existe" devuelve []; un fallo real del DNS lanza el error.
export async function consultarTxt(nombre) {
  try {
    return await resolver.resolveTxt(nombre);
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") return [];
    throw err;
  }
}
