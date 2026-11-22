import { z } from "zod";

const codigo = z.string().regex(/^\d{6}$/, "El código tiene 6 dígitos");

export const activarSchema = z.object({ codigo }).strict();
export const verificarSchema = z.object({ mfaToken: z.string().min(10).max(2000), codigo }).strict();
export const desactivarSchema = z.object({ password: z.string().min(1).max(128), codigo }).strict();
