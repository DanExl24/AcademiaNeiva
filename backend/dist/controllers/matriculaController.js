"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleTransfer = exports.cancelEnrollment = exports.finalizeEnrollment = exports.notifyInconsistencies = exports.assignGrade = exports.validateDocument = exports.getMatriculaDetails = exports.getPendingMatriculas = exports.submitEnrollment = void 0;
const matriculaService_1 = require("../services/matriculaService");
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
        const matriculas = await matriculaService_1.MatriculaService.getAllPending(Number(idColegio));
        res.json(matriculas);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPendingMatriculas = getPendingMatriculas;
const getMatriculaDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const details = await matriculaService_1.MatriculaService.getDetails(Number(id));
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
