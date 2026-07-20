"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const multer_1 = require("../config/multer");
const dbaController_1 = require("../controllers/dbaController");
const router = (0, express_1.Router)();
// ============================================================================
// RUTAS DE DERECHOS BÁSICOS DE APRENDIZAJE (DBA)
// ============================================================================
// Listar metadatos generales
router.get("/dba/versiones", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.listarVersiones);
router.get("/dba/areas", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.listarAreas);
router.get("/dba/estadisticas", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.estadisticasDBA);
router.get("/dba/existentes", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.listarCombinacionesDba);
// CRUD de DBA
router.get("/dba", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.listarDBA);
router.get("/dba/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.detalleDBA);
router.post("/dba", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.crearDBA);
router.put("/dba/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.actualizarDBA);
router.patch("/dba/:id/estado", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.cambiarEstadoDBA);
router.delete("/dba/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.eliminarDBA);
// Importar PDF masivamente
router.post("/dba/importar", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, multer_1.upload.single("pdf"), dbaController_1.importarDBAPDF);
// CRUD de Evidencias asociadas a DBA
router.post("/dba/:id/evidencias", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.crearEvidencia);
router.put("/dba/evidencias/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.actualizarEvidencia);
router.patch("/dba/evidencias/:id/estado", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.cambiarEstadoEvidencia);
// Asignaciones de versión curricular a Colegios
router.post("/dba/asignar-version", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.asignarVersionColegio);
router.get("/dba/asignaciones/:colegioId", authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, dbaController_1.listarAsignaciones);
exports.default = router;
