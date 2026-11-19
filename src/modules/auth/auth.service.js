import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { ErrorHttp } from "../../lib/errores.js";
import { hashToken, nuevoTokenRefresco } from "../../lib/tokens.js";
import * as repo from "./auth.repository.js";

export const DURACION_REFRESCO_MS = 7 * 24 * 60 * 60 * 1000;
// Si el mismo token llega dos veces casi a la vez (dos pestañas) no se toma como robo
const GRACIA_MS = 10_000;
const SESION_INVALIDA = "Sesión inválida o expirada";

// Hash falso para que el tiempo de respuesta sea parecido si el correo no existe
const HASH_FALSO = await argon2.hash("contraseña-falsa-para-igualar-tiempos");

function firmarToken(usuario) {
  return jwt.sign({ rol: usuario.rol }, process.env.JWT_SECRET, {
    subject: usuario.id,
    expiresIn: "15m",
    algorithm: "HS256",
  });
}

// Cada inicio de sesión abre una "familia" de tokens de refresco; cada refresco la renueva
async function crearSesion(usuario, familia = randomUUID()) {
  const refresco = nuevoTokenRefresco();
  await repo.guardarRefresco({
    usuarioId: usuario.id,
    familia,
    hash: hashToken(refresco),
    expiraEn: new Date(Date.now() + DURACION_REFRESCO_MS),
  });
  return {
    token: firmarToken(usuario),
    refresco,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  };
}

export async function registrar({ nombre, correo, password }) {
  if (await repo.buscarPorCorreo(correo)) {
    throw new ErrorHttp(409, "No se pudo completar el registro");
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return crearSesion(await repo.crear({ nombre, correo, passwordHash }));
}

export async function iniciarSesion({ correo, password }) {
  const usuario = await repo.buscarPorCorreo(correo);
  const valido = await argon2.verify(usuario ? usuario.passwordHash : HASH_FALSO, password);
  // Mensaje genérico: no revela si el correo existe
  if (!usuario || !valido) throw new ErrorHttp(401, "Credenciales incorrectas");
  return crearSesion(usuario);
}

// Rotación: el token recibido se gasta y se entrega uno nuevo de la misma familia
export async function refrescar(refresco) {
  if (!refresco) throw new ErrorHttp(401, SESION_INVALIDA);
  const fila = await repo.buscarRefresco(hashToken(refresco));
  if (!fila) throw new ErrorHttp(401, SESION_INVALIDA);

  if (fila.usadoEn) {
    // Un token ya gastado que reaparece pasada la gracia indica robo: se cierra toda la familia
    if (Date.now() - fila.usadoEn.getTime() > GRACIA_MS) await repo.cerrarFamilia(fila.familia);
    throw new ErrorHttp(401, SESION_INVALIDA);
  }
  if (fila.expiraEn <= new Date()) {
    await repo.cerrarFamilia(fila.familia);
    throw new ErrorHttp(401, SESION_INVALIDA);
  }

  const usuario = await repo.buscarPorId(fila.usuarioId);
  if (!usuario || !(await repo.marcarUsado(fila.id))) throw new ErrorHttp(401, SESION_INVALIDA);
  repo.limpiarExpirados().catch(() => {});
  return crearSesion(usuario, fila.familia);
}

export async function cerrarSesion(refresco) {
  if (!refresco) return;
  const fila = await repo.buscarRefresco(hashToken(refresco));
  if (fila) await repo.cerrarFamilia(fila.familia);
}
