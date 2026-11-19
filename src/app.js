import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes.js";
import dominiosRoutes from "./modules/dominios/dominios.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import swaggerUi from "swagger-ui-express";
import { especificacion } from "./docs/openapi.js";
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

// Documentación interactiva. helmet sin "upgrade-insecure-requests" solo aquí: en http local el navegador
// intentaría cargar los recursos de Swagger por https y fallaría.
const cspDocs = helmet({
  contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), "upgrade-insecure-requests": null } },
});
app.get("/api/openapi.json", (_req, res) => res.json(especificacion));
app.use("/api/docs", cspDocs, swaggerUi.serve, swaggerUi.setup(especificacion, { customSiteTitle: "Dominio Seguro - API" }));

app.get("/api/salud", (_req, res) => res.json({ estado: "ok" }));
app.use("/api/auth", limitadorAuth, authRoutes);
app.use("/api/dominios", dominiosRoutes);
app.use("/api/admin", adminRoutes);

app.use(manejadorErrores);
