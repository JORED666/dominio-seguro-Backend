import { z } from "zod";
import { esDominioValido } from "../../lib/seguridad.js";

export const dominioSchema = z.object({
  nombre: z.string().trim().toLowerCase().refine(esDominioValido, "Dominio inválido"),
});
