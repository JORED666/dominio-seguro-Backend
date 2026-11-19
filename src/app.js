import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes.js";
import dominiosRoutes from "./modules/dominios/dominios.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import { manejadorErrores } from "./middleware/manejador-errores.js";

// Arma la aplicación Express (sin escuchar en un puerto, para poder probarla)
export const app = express();
app.use(helmet());
// credentials: true permite que el navegador envíe la cookie del token de refresco
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:4200", credentials: true }));
app.use(express.json({ limit: "10kb" }));

// Límite de intentos en login y registro (frena fuerza bruta)
const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, espera unos minutos" },
});

app.get("/api/salud", (_req, res) => res.json({ estado: "ok" }));
app.use("/api/auth", limitadorAuth, authRoutes);
app.use("/api/dominios", dominiosRoutes);
app.use("/api/admin", adminRoutes);

app.use(manejadorErrores);
