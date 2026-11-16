import { Router } from "express";
import { requiereAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import * as controlador from "./dominios.controller.js";

const router = Router();
router.use(requiereAuth);

router.get("/", asyncHandler(controlador.listar));
router.post("/", asyncHandler(controlador.crear));
router.post("/:id/analizar", asyncHandler(controlador.analizar));
router.get("/:id/analisis", asyncHandler(controlador.historial));
router.get("/:id/similares", asyncHandler(controlador.similares));
router.patch("/:id/similares/:similarId", asyncHandler(controlador.marcarSimilar));

export default router;
