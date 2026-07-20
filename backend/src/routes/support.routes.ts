import { Router } from 'express';
import { createTicket, getTickets, updateTicketStatus, escalateTicket, getTicketByCode, addTicketObservation, addVisitorObservation } from '../controllers/supportController';
import { verifyToken, verifyTokenOptional } from '../middleware/authMiddleware';

const router = Router();

// Híbrida: si hay sesión se asocian los datos del usuario logueado; si no, permite registro de visitantes
router.post('/tickets', verifyTokenOptional as any, createTicket);

// Consulta pública de seguimiento de ticket por código Base36 ofuscado
router.get('/tickets/track/:code', verifyTokenOptional as any, getTicketByCode);
router.post('/tickets/track/:code/observaciones', addVisitorObservation);

// Protegida para directivos/administradores generales
router.get('/tickets', verifyToken as any, getTickets);
router.put('/tickets/:id/status', verifyToken as any, updateTicketStatus);
router.post('/tickets/:id/escalar', verifyToken as any, escalateTicket);
router.post('/tickets/:id/observaciones', verifyToken as any, addTicketObservation);

export default router;
