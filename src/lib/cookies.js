// Lee una cookie de la petición (evita agregar una dependencia solo para esto)
export function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const par of cabecera.split(";")) {
    const i = par.indexOf("=");
    if (i > 0 && par.slice(0, i).trim() === nombre) {
      try {
        return decodeURIComponent(par.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
