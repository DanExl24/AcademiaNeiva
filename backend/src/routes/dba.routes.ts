import { Router } from "express";
import { verifyToken, requireAdminGeneral } from "../middleware/authMiddleware";
import { upload } from "../config/multer";
import {
  listarDBA,
  detalleDBA,
  crearDBA,
  actualizarDBA,
  cambiarEstadoDBA,
  crearEvidencia,
  actualizarEvidencia,
  cambiarEstadoEvidencia,
  listarVersiones,
  listarAreas,
  asignarVersionColegio,
  listarAsignaciones,
  estadisticasDBA,
  importarDBAPDF
} from "../controllers/dbaController";

const router = Router();

// ============================================================================
// RUTAS DE DERECHOS BÁSICOS DE APRENDIZAJE (DBA)
// ============================================================================

// Listar metadatos generales
router.get("/dba/versiones", verifyToken, requireAdminGeneral, listarVersiones);
router.get("/dba/areas", verifyToken, requireAdminGeneral, listarAreas);
router.get("/dba/estadisticas", verifyToken, requireAdminGeneral, estadisticasDBA);

// CRUD de DBA
router.get("/dba", verifyToken, requireAdminGeneral, listarDBA);
router.get("/dba/:id", verifyToken, requireAdminGeneral, detalleDBA);
router.post("/dba", verifyToken, requireAdminGeneral, crearDBA);
router.put("/dba/:id", verifyToken, requireAdminGeneral, actualizarDBA);
router.patch("/dba/:id/estado", verifyToken, requireAdminGeneral, cambiarEstadoDBA);

// Importar PDF masivamente
router.post("/dba/importar", verifyToken, requireAdminGeneral, upload.single("pdf"), importarDBAPDF);

// CRUD de Evidencias asociadas a DBA
router.post("/dba/:id/evidencias", verifyToken, requireAdminGeneral, crearEvidencia);
router.put("/dba/evidencias/:id", verifyToken, requireAdminGeneral, actualizarEvidencia);
router.patch("/dba/evidencias/:id/estado", verifyToken, requireAdminGeneral, cambiarEstadoEvidencia);

// Asignaciones de versión curricular a Colegios
router.post("/dba/asignar-version", verifyToken, requireAdminGeneral, asignarVersionColegio);
router.get("/dba/asignaciones/:colegioId", verifyToken, requireAdminGeneral, listarAsignaciones);

export default router;
