import { Router } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../db.js";

const router = Router();

// Hash falso para que el tiempo de respuesta sea parecido si el correo no existe
const HASH_FALSO = await argon2.hash("contraseña-falsa-para-igualar-tiempos");

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  correo: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(12, "Mínimo 12 caracteres").max(128),
});

const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

function firmarToken(usuario) {
  return jwt.sign({ rol: usuario.rol }, process.env.JWT_SECRET, {
    subject: usuario.id,
    expiresIn: "15m",
    algorithm: "HS256",
  });
}

router.post("/registro", async (req, res) => {
  const datos = registroSchema.safeParse(req.body);
  if (!datos.success) {
    return res.status(400).json({ error: datos.error.issues[0].message });
  }
  const { nombre, correo, password } = datos.data;

  const existente = await prisma.usuario.findUnique({ where: { correo } });
  if (existente) return res.status(409).json({ error: "No se pudo completar el registro" });

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const usuario = await prisma.usuario.create({ data: { nombre, correo, passwordHash } });

  res.status(201).json({
    token: firmarToken(usuario),
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
  });
});

router.post("/login", async (req, res) => {
  const datos = loginSchema.safeParse(req.body);
  if (!datos.success) return res.status(400).json({ error: "Datos inválidos" });
  const { correo, password } = datos.data;

  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  const hash = usuario ? usuario.passwordHash : HASH_FALSO;
  const valido = await argon2.verify(hash, password);

  // Mensaje genérico: no revela si el correo existe
  if (!usuario || !valido) return res.status(401).json({ error: "Credenciales incorrectas" });

  res.json({
    token: firmarToken(usuario),
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
  });
});

export default router;
