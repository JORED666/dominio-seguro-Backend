import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes.js";
import dominiosRoutes from "./modules/dominios/dominios.routes.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Falta JWT_SECRET (mínimo 32 caracteres) en el archivo .env");
  process.exit(1);
}

const app = express();
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

// Manejo de errores: no expone detalles internos
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => console.log(`API escuchando en http://localhost:${puerto}`));
