"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supportController_1 = require("../controllers/supportController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Híbrida: si hay sesión se asocian los datos del usuario logueado; si no, permite registro de visitantes
router.post('/tickets', authMiddleware_1.verifyTokenOptional, supportController_1.createTicket);
// Consulta pública de seguimiento de ticket por código Base36 ofuscado
router.get('/tickets/track/:code', authMiddleware_1.verifyTokenOptional, supportController_1.getTicketByCode);
router.post('/tickets/track/:code/observaciones', supportController_1.addVisitorObservation);
// Protegida para directivos/administradores generales
router.get('/tickets', authMiddleware_1.verifyToken, supportController_1.getTickets);
router.put('/tickets/:id/status', authMiddleware_1.verifyToken, supportController_1.updateTicketStatus);
router.post('/tickets/:id/escalar', authMiddleware_1.verifyToken, supportController_1.escalateTicket);
router.post('/tickets/:id/observaciones', authMiddleware_1.verifyToken, supportController_1.addTicketObservation);
exports.default = router;
