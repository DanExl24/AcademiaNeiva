"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const matriculaService_1 = require("../services/matriculaService");
const matriculaController_1 = require("../controllers/matriculaController");
const multer_1 = require("../config/multer");
const db_1 = require("../config/db");
const router = (0, express_1.Router)();
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
        const configRes = await db_1.pool.query(`SELECT id_configuracion, fecha_inicio, fecha_cierre, habilitada 
       FROM configuracion_inscripcion 
       WHERE id_colegio = $1 AND id_año = $2`, [schoolId, yearId]);
        if (configRes.rows.length === 0) {
            res.json({ config: null, yearLabel });
            return;
        }
        res.json({
            config: configRes.rows[0],
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
router.get("/pending/:idColegio", matriculaController_1.getPendingMatriculas);
router.get("/filtered/:idColegio", async (req, res) => {
    try {
        const { estado } = req.query;
        const result = await matriculaService_1.MatriculaService.getFiltered(Number(req.params.idColegio), estado);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/:id", async (req, res) => {
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
router.patch("/document/:idDocumento", matriculaController_1.validateDocument);
router.post("/assign-grade/:id", matriculaController_1.assignGrade);
router.post("/notify-inconsistencies/:id", matriculaController_1.notifyInconsistencies);
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
router.post("/finalize/:id", matriculaController_1.finalizeEnrollment);
router.post("/cancel/:id", matriculaController_1.cancelEnrollment);
router.patch("/transfer-status/:id", matriculaController_1.toggleTransfer);
exports.default = router;
