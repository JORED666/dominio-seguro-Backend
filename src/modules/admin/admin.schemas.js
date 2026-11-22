import { z } from "zod";

export const rolSchema = z.object({ rol: z.enum(["usuario", "admin"]) }).strict();
