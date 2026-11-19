import { prisma } from "../../db.js";

const VISIBLE = { id: true, nombre: true, correo: true, rol: true, creadoEn: true };

export const listar = () =>
  prisma.usuario.findMany({
    select: { ...VISIBLE, _count: { select: { dominios: true } } },
    orderBy: { creadoEn: "desc" },
  });

export const buscar = (id) => prisma.usuario.findUnique({ where: { id }, select: VISIBLE });

export const actualizarRol = (id, rol) => prisma.usuario.update({ where: { id }, data: { rol }, select: VISIBLE });
