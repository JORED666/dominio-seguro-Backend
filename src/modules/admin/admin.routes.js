import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requiereAuth, requiereRol } from "../../middleware/auth.js";
import * as controlador from "./admin.controller.js";

const router = Router();
router.use(requiereAuth, requiereRol("admin"));

router.get("/usuarios", asyncHandler(controlador.usuarios));
router.patch("/usuarios/:id", asyncHandler(controlador.cambiarRol));

export default router;
