import { prisma } from "../../db.js";

export const listar = (usuarioId) =>
  prisma.dominio.findMany({ where: { usuarioId }, orderBy: { creadoEn: "desc" } });

export const crear = (usuarioId, nombreDominio) =>
  prisma.dominio.create({ data: { usuarioId, nombreDominio } });

// Solo devuelve el dominio si pertenece al usuario
export const buscarDeUsuario = (id, usuarioId) =>
  prisma.dominio.findFirst({ where: { id, usuarioId } });

export const listarAnalisis = (dominioId) =>
  prisma.analisis.findMany({
    where: { dominioId },
    orderBy: { fecha: "desc" },
    include: { hallazgos: true },
  });

// Guarda el análisis con sus hallazgos y actualiza el último puntaje del dominio
export async function guardarAnalisis({ dominioId, puntaje, duracionMs, categorias, hallazgos }) {
  const [analisis] = await prisma.$transaction([
    prisma.analisis.create({
      data: { dominioId, puntaje, duracionMs, categorias, hallazgos: { create: hallazgos } },
      include: { hallazgos: true },
    }),
    prisma.dominio.update({ where: { id: dominioId }, data: { ultimoPuntaje: puntaje } }),
  ]);
  return analisis;
}

export const listarSimilares = (dominioId) => prisma.similar.findMany({ where: { dominioId } });

// Variantes que el usuario marcó como suyas: no cuentan como amenaza
export async function nombresPropios(dominioId) {
  const filas = await prisma.similar.findMany({ where: { dominioId, propio: true }, select: { nombre: true } });
  return filas.map((s) => s.nombre);
}

export const buscarSimilar = (id, dominioId) => prisma.similar.findFirst({ where: { id, dominioId } });

export const actualizarSimilar = (id, data) => prisma.similar.update({ where: { id }, data });

// Guarda o actualiza las variantes. detectadoEn se fija la primera vez que la variante aparece
// registrada (mientras estaba libre no cuenta), y no cambia en los análisis siguientes.
export async function guardarSimilares(dominioId, lista) {
  const previas = new Map((await prisma.similar.findMany({ where: { dominioId } })).map((s) => [s.nombre, s]));
  const ahora = new Date();
  await prisma.$transaction(
    lista.map((s) => {
      const datos = { tecnica: s.tecnica, estado: s.estado, riesgo: s.riesgo, conCorreo: s.conCorreo, conCertificado: s.conCertificado, verificadoEn: ahora };
      const detectadoEn = previas.get(s.nombre)?.detectadoEn ?? (s.estado !== "libre" ? ahora : null);
      return prisma.similar.upsert({
        where: { dominioId_nombre: { dominioId, nombre: s.nombre } },
        create: { dominioId, nombre: s.nombre, ...datos, detectadoEn },
        update: { ...datos, detectadoEn },
      });
    })
  );
}
