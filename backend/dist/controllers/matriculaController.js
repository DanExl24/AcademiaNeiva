"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadDocumentFile = exports.toggleTransfer = exports.cancelEnrollment = exports.finalizeEnrollment = exports.notifyInconsistencies = exports.assignGrade = exports.validateDocument = exports.getMatriculaDetails = exports.getPendingMatriculas = exports.submitEnrollment = void 0;
const matriculaService_1 = require("../services/matriculaService");
const db_1 = require("../config/db");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const submitEnrollment = async (req, res) => {
    try {
        const data = req.body;
        const files = req.files;
        console.log('=== SUBMIT ENROLLMENT ===');
        console.log('Body:', JSON.stringify(data));
        console.log('Files keys:', files ? Object.keys(files) : 'NONE');
        const result = await matriculaService_1.MatriculaService.createEnrollment(data, files);
        res.status(201).json(result);
    }
    catch (error) {
        console.error('=== ERROR en submitEnrollment ===');
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: error.message });
    }
};
exports.submitEnrollment = submitEnrollment;
const getPendingMatriculas = async (req, res) => {
    try {
        const { idColegio } = req.params;
        const { yearId } = req.query;
        const authReq = req;
        const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
        if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== Number(idColegio)) {
            res.status(403).json({ error: "No tiene permiso para consultar las matrículas de este colegio." });
            return;
        }
        const matriculas = await matriculaService_1.MatriculaService.getAllPending(Number(idColegio), yearId ? Number(yearId) : undefined);
        res.json(matriculas);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPendingMatriculas = getPendingMatriculas;
const getMatriculaDetails = async (req, res) => {
    try {
        const idStr = String(req.params.id || "");
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idStr)) {
            const details = await matriculaService_1.MatriculaService.getByToken(idStr);
            res.json(details);
            return;
        }
        const details = await matriculaService_1.MatriculaService.getDetails(Number(idStr));
        const authReq = req;
        const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
        if (authReq.user && !isSupervision && authReq.user.schoolId && details && details.id_colegio !== authReq.user.schoolId) {
            res.status(403).json({ error: "No tiene permiso para acceder al expediente de esta matrícula." });
            return;
        }
        res.json(details);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getMatriculaDetails = getMatriculaDetails;
const validateDocument = async (req, res) => {
    try {
        const { idDocumento } = req.params;
        const { estado } = req.body; // 'VALIDADO' o 'RECHAZADO'
        const updated = await matriculaService_1.MatriculaService.updateDocumentStatus(Number(idDocumento), estado);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.validateDocument = validateDocument;
const assignGrade = async (req, res) => {
    try {
        const { id } = req.params;
        const { idGrado } = req.body;
        const result = await matriculaService_1.MatriculaService.assignGrade(Number(id), Number(idGrado));
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.assignGrade = assignGrade;
const notifyInconsistencies = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await matriculaService_1.MatriculaService.notifyInconsistencies(Number(id));
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.notifyInconsistencies = notifyInconsistencies;
const finalizeEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const result = await matriculaService_1.MatriculaService.finalizeEnrollment(Number(id), data);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.finalizeEnrollment = finalizeEnrollment;
const cancelEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body; // { motivo, detalles }
        const result = await matriculaService_1.MatriculaService.cancelEnrollment(Number(id), data);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.cancelEnrollment = cancelEnrollment;
const toggleTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { es_traslado } = req.body;
        const result = await matriculaService_1.MatriculaService.toggleTransferStatus(Number(id), Boolean(es_traslado));
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.toggleTransfer = toggleTransfer;
const downloadDocumentFile = async (req, res) => {
    try {
        const { idDocumento } = req.params;
        const queryRes = await db_1.pool.query(`SELECT id_documento, contenido, mime_type, nombre_original, url 
       FROM documento_matriculas 
       WHERE id_documento = $1`, [idDocumento]);
        if (queryRes.rows.length === 0) {
            res.status(404).json({ error: "Documento no encontrado" });
            return;
        }
        const doc = queryRes.rows[0];
        // If file binary bytea exists in DB
        if (doc.contenido && Buffer.isBuffer(doc.contenido)) {
            const filename = doc.nombre_original || doc.url || `documento-${idDocumento}`;
            let contentType = doc.mime_type;
            if (!contentType) {
                const ext = path_1.default.extname(filename).toLowerCase();
                if (ext === '.pdf')
                    contentType = 'application/pdf';
                else if (ext === '.png')
                    contentType = 'image/png';
                else if (ext === '.jpg' || ext === '.jpeg')
                    contentType = 'image/jpeg';
                else if (ext === '.svg')
                    contentType = 'image/svg+xml';
                else
                    contentType = 'application/octet-stream';
            }
            res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.send(doc.contenido);
            return;
        }
        // Fallback for legacy files stored on local disk
        if (doc.url && doc.url !== 'PENDIENTE') {
            const diskFilename = path_1.default.basename(doc.url);
            const filePath = path_1.default.join(process.cwd(), 'uploads', diskFilename);
            if (fs_1.default.existsSync(filePath)) {
                res.sendFile(filePath);
                return;
            }
        }
        res.status(404).json({ error: "El archivo adjunto no existe o está pendiente de carga" });
    }
    catch (error) {
        console.error("Error al descargar documento:", error);
        res.status(500).json({ error: "Error en el servidor al obtener el archivo" });
    }
};
exports.downloadDocumentFile = downloadDocumentFile;
