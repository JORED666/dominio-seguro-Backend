import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requiereAuth } from "../../middleware/auth.js";
import * as controlador from "./auth.controller.js";
import * as mfa from "./mfa.controller.js";

const router = Router();

router.post("/registro", asyncHandler(controlador.registro));
router.post("/login", asyncHandler(controlador.login));
router.post("/refresh", asyncHandler(controlador.refrescar));
router.post("/logout", asyncHandler(controlador.salir));

router.post("/mfa/verificar", asyncHandler(mfa.verificarLogin));
router.post("/mfa/configurar", requiereAuth, asyncHandler(mfa.configurar));
router.post("/mfa/activar", requiereAuth, asyncHandler(mfa.activar));
router.post("/mfa/desactivar", requiereAuth, asyncHandler(mfa.desactivar));

export default router;
