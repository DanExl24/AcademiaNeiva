"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const reingresoController_1 = require("../controllers/reingresoController");
const router = (0, express_1.Router)();
// Catálogos generales (Accesible para acudientes en soporte, padres y directivos)
router.get("/catalogs", reingresoController_1.getReingresoCatalogs);
// Middleware: todas las rutas administrativas de este módulo requieren autenticación de Directivo o Admin General
router.use(authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo);
// Obtener grupos del colegio por nivel y año lectivo
router.get("/groups", reingresoController_1.getReingresoGroups);
// Obtener ficha e historial de documentos del estudiante retirado
router.get("/student-history/:idEstudiante", reingresoController_1.getStudentHistoryForReingreso);
// Obtener contexto de ticket y estudiantes sugeridos
router.get("/ticket-context/:ticketId", reingresoController_1.getTicketContextForReingreso);
const validateDto_1 = require("../middleware/validateDto");
const reingreso_dto_1 = require("../dtos/reingreso.dto");
// Guardar matriz de renovación configurada por el directivo y enviar enlace al acudiente
router.post("/send-parent-link", (0, validateDto_1.validateDto)(reingreso_dto_1.SendParentReingresoLinkSchema), reingresoController_1.sendReingresoParentLink);
// Notificar a un solicitante público que el estudiante no existe en los registros del colegio
router.post("/notify-nonexistent/:id", (0, validateDto_1.validateDto)(reingreso_dto_1.NotifyNonExistentStudentSchema), reingresoController_1.notifyNonExistentStudent);
exports.default = router;
