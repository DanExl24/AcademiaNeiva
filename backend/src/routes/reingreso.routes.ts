import { Router } from "express";
import { verifyToken, requireDirectivo } from "../middleware/authMiddleware";
import {
  getStudentHistoryForReingreso,
  getTicketContextForReingreso,
  sendReingresoParentLink,
  notifyNonExistentStudent,
  getReingresoCatalogs,
  getReingresoGroups
} from "../controllers/reingresoController";

const router = Router();

// Catálogos generales (Accesible para acudientes en soporte, padres y directivos)
router.get("/catalogs", getReingresoCatalogs);

// Middleware: todas las rutas administrativas de este módulo requieren autenticación de Directivo o Admin General
router.use(verifyToken, requireDirectivo);

// Obtener grupos del colegio por nivel y año lectivo
router.get("/groups", getReingresoGroups);

// Obtener ficha e historial de documentos del estudiante retirado
router.get("/student-history/:idEstudiante", getStudentHistoryForReingreso);

// Obtener contexto de ticket y estudiantes sugeridos
router.get("/ticket-context/:ticketId", getTicketContextForReingreso);

import { validateDto } from "../middleware/validateDto";
import { SendParentReingresoLinkSchema, NotifyNonExistentStudentSchema } from "../dtos/reingreso.dto";

// Guardar matriz de renovación configurada por el directivo y enviar enlace al acudiente
router.post("/send-parent-link", validateDto(SendParentReingresoLinkSchema), sendReingresoParentLink);

// Notificar a un solicitante público que el estudiante no existe en los registros del colegio
router.post("/notify-nonexistent/:id", validateDto(NotifyNonExistentStudentSchema), notifyNonExistentStudent);

export default router;
