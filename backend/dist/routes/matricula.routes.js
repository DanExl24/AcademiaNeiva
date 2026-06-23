"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const matriculaService_1 = require("../services/matriculaService");
const matriculaController_1 = require("../controllers/matriculaController");
const multer_1 = require("../config/multer");
const authMiddleware_1 = require("../middleware/authMiddleware");
const db_1 = require("../config/db");
const router = (0, express_1.Router)();
// Helper helper middleware to protect routes that request an integer ID, but bypass for UUID tokens
const protectIfIntegerId = (req, res, next) => {
    const { id } = req.params;
    if (id && id.length <= 20) {
        return (0, authMiddleware_1.verifyToken)(req, res, () => {
            return (0, authMiddleware_1.requireDirectivo)(req, res, next);
        });
    }
    next();
};
router.get("/", async (req, res) => {
    try {
        const result = await db_1.pool.query("SELECT id_colegio, nombre FROM colegio ORDER BY nombre");
        res.json(result.rows);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/school/:schoolId/enrollment-config", async (req, res) => {
    try {
        const { schoolId } = req.params;
        // Find active year for school
        const yearRes = await db_1.pool.query(`SELECT "id_año", calendario FROM "año_lectivo" WHERE id_colegio = $1 AND estado = 'ABIERTO' LIMIT 1`, [schoolId]);
        if (yearRes.rows.length === 0) {
            res.json({ config: null, yearLabel: null });
            return;
        }
        const yearId = yearRes.rows[0].id_año;
        const yearLabel = yearRes.rows[0].calendario;
        const approvedRes = await db_1.pool.query(`SELECT COUNT(*)::int AS count 
       FROM matricula 
       WHERE id_colegio = $1 AND "id_año" = $2 AND estado IN ('ACTIVA', 'TRASLADADA')`, [schoolId, yearId]);
        const hasApproved = approvedRes.rows[0].count > 0;
        const configRes = await db_1.pool.query(`SELECT id_configuracion, fecha_inicio, fecha_cierre, habilitada 
       FROM configuracion_inscripcion 
       WHERE id_colegio = $1 AND id_año = $2`, [schoolId, yearId]);
        if (configRes.rows.length === 0) {
            res.json({
                config: {
                    id_configuracion: null,
                    id_colegio: Number(schoolId),
                    id_año: yearId,
                    fecha_inicio: null,
                    fecha_cierre: null,
                    habilitada: true,
                    hasApproved
                },
                yearLabel
            });
            return;
        }
        res.json({
            config: {
                ...configRes.rows[0],
                hasApproved
            },
            yearLabel
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/submit", multer_1.upload.fields([
    { name: 'registroCivil', maxCount: 1 },
    { name: 'documentoIdentidad', maxCount: 1 },
    { name: 'documentoPadre', maxCount: 1 },
    { name: 'vacunas', maxCount: 1 },
    { name: 'salud', maxCount: 1 },
    { name: 'foto', maxCount: 1 },
    { name: 'visa', maxCount: 1 },
    { name: 'reciboPublico', maxCount: 1 },
    { name: 'certificadoDiscapacidad', maxCount: 1 },
    { name: 'certificadosEscolaridad', maxCount: 1 }
]), matriculaController_1.submitEnrollment);
router.get("/pending/:idColegio", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, matriculaController_1.getPendingMatriculas);
router.get("/filtered/:idColegio", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, async (req, res) => {
    try {
        const { estado } = req.query;
        const result = await matriculaService_1.MatriculaService.getFiltered(Number(req.params.idColegio), estado);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/:id", protectIfIntegerId, async (req, res) => {
    try {
        const id = req.params.id;
        let result;
        if (id.length > 20) { // Probablemente un UUID token
            result = await matriculaService_1.MatriculaService.getByToken(id);
        }
        else {
            result = await matriculaService_1.MatriculaService.getDetails(Number(id));
        }
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/document/:idDocumento", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, matriculaController_1.validateDocument);
router.post("/assign-grade/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, matriculaController_1.assignGrade);
router.post("/notify-inconsistencies/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, matriculaController_1.notifyInconsistencies);
router.post("/update-documents/:token", multer_1.upload.fields([
    { name: 'registroCivil', maxCount: 1 },
    { name: 'documentoIdentidad', maxCount: 1 },
    { name: 'documentoPadre', maxCount: 1 },
    { name: 'vacunas', maxCount: 1 },
    { name: 'salud', maxCount: 1 },
    { name: 'foto', maxCount: 1 },
    { name: 'visa', maxCount: 1 },
    { name: 'reciboPublico', maxCount: 1 },
    { name: 'certificadoDiscapacidad', maxCount: 1 },
    { name: 'certificadosEscolaridad', maxCount: 1 }
]), async (req, res) => {
    try {
        const result = await matriculaService_1.MatriculaService.updateDocumentsByToken(req.params.token, req.files);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/finalize/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, matriculaController_1.finalizeEnrollment);
router.post("/cancel/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, matriculaController_1.cancelEnrollment);
router.patch("/transfer-status/:id", authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, matriculaController_1.toggleTransfer);
exports.default = router;
