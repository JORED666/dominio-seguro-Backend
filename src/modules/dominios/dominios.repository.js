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
export async function guardarAnalisis({ dominioId, puntaje, duracionMs, hallazgos }) {
  const [analisis] = await prisma.$transaction([
    prisma.analisis.create({
      data: { dominioId, puntaje, duracionMs, hallazgos: { create: hallazgos } },
      include: { hallazgos: true },
    }),
    prisma.dominio.update({ where: { id: dominioId }, data: { ultimoPuntaje: puntaje } }),
  ]);
  return analisis;
}
