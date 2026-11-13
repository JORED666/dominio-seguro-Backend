import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes.js";
import dominiosRoutes from "./modules/dominios/dominios.routes.js";
import { manejadorErrores } from "./middleware/manejador-errores.js";

// Arma la aplicación Express (sin escuchar en un puerto, para poder probarla)
export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:4200" }));
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

app.use(manejadorErrores);
