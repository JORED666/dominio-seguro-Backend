import argon2 from "argon2";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { cifrar, descifrar } from "../../lib/cifrado.js";
import { ErrorHttp } from "../../lib/errores.js";
import { nuevoSecreto, uriOtpauth, verificar } from "../../lib/totp.js";
import { crearSesion } from "./auth.service.js";
import * as repo from "./auth.repository.js";

const CODIGO_MALO = "Código incorrecto";

async function usuarioDe(id) {
  const usuario = await repo.buscarPorId(id);
  if (!usuario) throw new ErrorHttp(401, "Sesión inválida o expirada");
  return usuario;
}

// Paso 1: genera el secreto (guardado cifrado, todavía sin activar) y el QR para escanearlo
export async function configurar(usuarioId) {
  const usuario = await usuarioDe(usuarioId);
  if (usuario.mfaActivo) throw new ErrorHttp(409, "La verificación en dos pasos ya está activa");
  const secreto = nuevoSecreto();
  await repo.guardarMfa(usuarioId, { mfaSecreto: cifrar(secreto), mfaUltimoPaso: null });
  const otpauth = uriOtpauth(secreto, usuario.correo);
  return { secreto, otpauth, qr: await QRCode.toDataURL(otpauth) };
}

// Paso 2: el usuario demuestra que su app genera códigos válidos y se activa
export async function activar(usuarioId, codigo) {
  const usuario = await usuarioDe(usuarioId);
  if (usuario.mfaActivo) throw new ErrorHttp(409, "La verificación en dos pasos ya está activa");
  if (!usuario.mfaSecreto) throw new ErrorHttp(400, "Primero genera el código QR");
  const paso = verificar(descifrar(usuario.mfaSecreto), codigo);
  if (paso === null) throw new ErrorHttp(400, CODIGO_MALO);
  await repo.guardarMfa(usuarioId, { mfaActivo: true, mfaUltimoPaso: paso });
  return { mfaActivo: true };
}

export async function desactivar(usuarioId, { password, codigo }) {
  const usuario = await usuarioDe(usuarioId);
  if (!usuario.mfaActivo) throw new ErrorHttp(409, "La verificación en dos pasos no está activa");
  const paso = verificar(descifrar(usuario.mfaSecreto), codigo);
  if (!(await argon2.verify(usuario.passwordHash, password)) || paso === null) {
    throw new ErrorHttp(401, "Contraseña o código incorrectos");
  }
  await repo.guardarMfa(usuarioId, { mfaActivo: false, mfaSecreto: null, mfaUltimoPaso: null });
  return { mfaActivo: false };
}

// Segundo paso del login: valida el código y entrega la sesión completa
export async function completarLogin({ mfaToken, codigo }) {
  let id;
  try {
    id = jwt.verify(mfaToken, process.env.JWT_SECRET, { algorithms: ["HS256"], audience: "mfa" }).sub;
  } catch {
    throw new ErrorHttp(401, "Sesión inválida o expirada");
  }
  const usuario = await usuarioDe(id);
  if (!usuario.mfaActivo) throw new ErrorHttp(401, "Sesión inválida o expirada");
  const paso = verificar(descifrar(usuario.mfaSecreto), codigo);
  // Un código solo sirve una vez: el paso debe ser mayor que el último aceptado
  if (paso === null || !(await repo.registrarPaso(usuario.id, paso))) throw new ErrorHttp(401, CODIGO_MALO);
  return crearSesion(usuario);
}
