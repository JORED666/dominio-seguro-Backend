import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { ErrorHttp } from "../../lib/errores.js";
import { hashToken, nuevoTokenRefresco } from "../../lib/tokens.js";
import { enviarCorreo } from "../../integrations/mailer.js";
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

// Token corto que solo sirve para completar el segundo factor (audience "mfa": requiereAuth lo rechaza)
export const firmarTokenMfa = (usuario) =>
  jwt.sign({}, process.env.JWT_SECRET, {
    subject: usuario.id,
    audience: "mfa",
    expiresIn: "5m",
    algorithm: "HS256",
  });

// Cada inicio de sesión abre una "familia" de tokens de refresco; cada refresco la renueva
export async function crearSesion(usuario, familia = randomUUID()) {
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
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, mfaActivo: usuario.mfaActivo },
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
  // Con verificación en dos pasos activa, todavía no hay sesión: falta el código
  if (usuario.mfaActivo) return { mfaRequerido: true, mfaToken: firmarTokenMfa(usuario) };
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

// ---- Restablecer contraseña ----
const DURACION_RESTABLECER_MS = 30 * 60 * 1000;
const ENLACE_INVALIDO = "El enlace no es válido o ya expiró";

// Siempre hace lo mismo exista o no el correo; el controlador responde antes de esperarla
export async function solicitarRestablecimiento(correo) {
  const usuario = await repo.buscarPorCorreo(correo);
  if (!usuario) return;
  await repo.borrarRestablecimientos(usuario.id);
  const token = nuevoTokenRefresco();
  await repo.crearRestablecimiento({
    usuarioId: usuario.id,
    hash: hashToken(token),
    expiraEn: new Date(Date.now() + DURACION_RESTABLECER_MS),
  });
  const base = (process.env.PANEL_URL || "http://localhost:4200").replace(/\/$/, "");
  const enlace = `${base}/restablecer?token=${token}`;
  await enviarCorreo({
    para: usuario.correo,
    asunto: "Restablece tu contraseña de Dominio Seguro",
    texto:
      "Recibimos una solicitud para restablecer tu contraseña.\n\n" +
      `Abre este enlace (vale 30 minutos y sirve una sola vez):\n${enlace}\n\n` +
      "Si no fuiste tú, ignora este correo: tu contraseña no cambia.",
    html:
      "<p>Recibimos una solicitud para restablecer tu contraseña.</p>" +
      `<p><a href="${enlace}">Restablecer contraseña</a> (vale 30 minutos y sirve una sola vez).</p>` +
      "<p>Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>",
  });
}

export async function restablecerPassword({ token, password }) {
  const fila = await repo.buscarRestablecimiento(hashToken(token));
  if (!fila || fila.usadoEn || fila.expiraEn <= new Date()) throw new ErrorHttp(400, ENLACE_INVALIDO);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const hecho = await repo.aplicarRestablecimiento({ id: fila.id, usuarioId: fila.usuarioId, passwordHash });
  if (!hecho) throw new ErrorHttp(400, ENLACE_INVALIDO);
  // Aviso de seguridad: si no fue el dueño, se entera
  const usuario = await repo.buscarPorId(fila.usuarioId);
  if (usuario) {
    enviarCorreo({
      para: usuario.correo,
      asunto: "Tu contraseña de Dominio Seguro fue cambiada",
      texto: "Se cambió la contraseña de tu cuenta y se cerraron todas tus sesiones. Si no fuiste tú, restablécela de nuevo y activa la verificación en dos pasos.",
    }).catch(() => {});
  }
}
