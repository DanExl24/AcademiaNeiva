"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const parentManagementController_1 = require("../controllers/parentManagementController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.verifyToken);
router.use(authMiddleware_1.requireDirectivo);
// Listar todos los padres de familia del colegio (con busqueda opcional)
router.get("/school/:schoolId", parentManagementController_1.getParentsManagementData);
// Detalle completo de un padre de familia (con hijos y estadisticas)
router.get("/:id/detail", parentManagementController_1.getParentDetail);
// Actualizar datos del padre de familia
router.put("/:id", parentManagementController_1.updateParent);
// Cambiar estado de la cuenta (activar / inactivar)
router.patch("/:id/status", parentManagementController_1.updateParentAccountStatus);
// Tipos de documento
router.get("/document-types", parentManagementController_1.getDocumentTypes);
exports.default = router;
