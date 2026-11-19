import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import * as controlador from "./auth.controller.js";

const router = Router();

router.post("/registro", asyncHandler(controlador.registro));
router.post("/login", asyncHandler(controlador.login));
router.post("/refresh", asyncHandler(controlador.refrescar));
router.post("/logout", asyncHandler(controlador.salir));

export default router;
