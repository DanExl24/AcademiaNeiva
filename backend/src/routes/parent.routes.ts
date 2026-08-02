import { Router } from "express";
import {
  getParentsManagementData,
  getParentDetail,
  updateParent,
  getDocumentTypes,
  updateParentAccountStatus,
} from "../controllers/parentManagementController";
import { verifyToken, requireDirectivo } from "../middleware/authMiddleware";

const router = Router();

router.use(verifyToken);
router.use(requireDirectivo);

// Listar todos los padres de familia del colegio (con busqueda opcional)
router.get("/school/:schoolId", getParentsManagementData);

// Detalle completo de un padre de familia (con hijos y estadisticas)
router.get("/:id/detail", getParentDetail);

// Actualizar datos del padre de familia
router.put("/:id", updateParent);

// Cambiar estado de la cuenta (activar / inactivar)
router.patch("/:id/status", updateParentAccountStatus);

// Tipos de documento
router.get("/document-types", getDocumentTypes);

export default router;
