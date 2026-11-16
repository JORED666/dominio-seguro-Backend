import { z } from "zod";
import { esDominioValido } from "../../lib/seguridad.js";

export const dominioSchema = z.object({
  nombre: z.string().trim().toLowerCase().refine(esDominioValido, "Dominio inválido"),
});

export const similarSchema = z
  .object({ propio: z.boolean().optional(), revisado: z.boolean().optional() })
  .strict()
  .refine((d) => d.propio !== undefined || d.revisado !== undefined, "No hay nada que actualizar");
