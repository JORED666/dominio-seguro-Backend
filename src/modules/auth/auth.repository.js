import { prisma } from "../../db.js";

export const buscarPorCorreo = (correo) => prisma.usuario.findUnique({ where: { correo } });

export const buscarPorId = (id) => prisma.usuario.findUnique({ where: { id } });

export const crear = (datos) => prisma.usuario.create({ data: datos });

export const guardarMfa = (id, data) => prisma.usuario.update({ where: { id }, data });

// Acepta un código solo si es más nuevo que el último usado (evita reutilizarlo)
export async function registrarPaso(id, paso) {
  const r = await prisma.usuario.updateMany({
    where: { id, OR: [{ mfaUltimoPaso: null }, { mfaUltimoPaso: { lt: paso } }] },
    data: { mfaUltimoPaso: paso },
  });
  return r.count === 1;
}

export const guardarRefresco = (data) => prisma.tokenRefresco.create({ data });

export const buscarRefresco = (hash) => prisma.tokenRefresco.findUnique({ where: { hash } });

// Marca el token como usado solo si nadie lo usó antes (un token de refresco sirve una vez)
export async function marcarUsado(id) {
  const r = await prisma.tokenRefresco.updateMany({ where: { id, usadoEn: null }, data: { usadoEn: new Date() } });
  return r.count === 1;
}

export const cerrarFamilia = (familia) => prisma.tokenRefresco.deleteMany({ where: { familia } });

export const limpiarExpirados = () => prisma.tokenRefresco.deleteMany({ where: { expiraEn: { lt: new Date() } } });
