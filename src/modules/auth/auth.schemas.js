import { z } from "zod";

export const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  correo: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(12, "Mínimo 12 caracteres").max(128),
});

export const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
