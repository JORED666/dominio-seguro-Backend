import { prisma } from "../../db.js";

export const buscarPorCorreo = (correo) => prisma.usuario.findUnique({ where: { correo } });

export const crear = (datos) => prisma.usuario.create({ data: datos });
