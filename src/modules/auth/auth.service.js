import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { ErrorHttp } from "../../lib/errores.js";
import * as repo from "./auth.repository.js";

// Hash falso para que el tiempo de respuesta sea parecido si el correo no existe
const HASH_FALSO = await argon2.hash("contraseña-falsa-para-igualar-tiempos");

function firmarToken(usuario) {
  return jwt.sign({ rol: usuario.rol }, process.env.JWT_SECRET, {
    subject: usuario.id,
    expiresIn: "15m",
    algorithm: "HS256",
  });
}

function sesionDe(usuario) {
  return {
    token: firmarToken(usuario),
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
  };
}

export async function registrar({ nombre, correo, password }) {
  if (await repo.buscarPorCorreo(correo)) {
    throw new ErrorHttp(409, "No se pudo completar el registro");
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return sesionDe(await repo.crear({ nombre, correo, passwordHash }));
}

export async function iniciarSesion({ correo, password }) {
  const usuario = await repo.buscarPorCorreo(correo);
  const valido = await argon2.verify(usuario ? usuario.passwordHash : HASH_FALSO, password);
  // Mensaje genérico: no revela si el correo existe
  if (!usuario || !valido) throw new ErrorHttp(401, "Credenciales incorrectas");
  return sesionDe(usuario);
}
