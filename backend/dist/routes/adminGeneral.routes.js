"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = require("../config/multer");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validateDto_1 = require("../middleware/validateDto");
const adminUser_dto_1 = require("../dtos/adminUser.dto");
const adminGeneralController_1 = require("../controllers/adminGeneralController");
const router = (0, express_1.Router)();
// ─────────────────────────────────────────────────────────────
// DASHBOARD (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/dashboard/stats', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.obtenerStatsDashboard);
// ─────────────────────────────────────────────────────────────
// COLEGIOS (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/colegios', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.listarColegios);
router.get('/colegios/:id', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.detalleColegio);
router.post('/colegios', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.registrarColegio);
router.post('/colegios/upload-escudo', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, multer_1.upload.single('escudo'), adminGeneralController_1.uploadEscudo);
router.put('/colegios/:id', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.actualizarColegio);
router.patch('/colegios/:id/estado', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.cambiarEstadoColegio);
router.delete('/colegios/:id', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.eliminarColegio);
// ─────────────────────────────────────────────────────────────
// USUARIOS (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/usuarios', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.listarUsuarios);
router.post('/usuarios', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, (0, validateDto_1.validateDto)(adminUser_dto_1.createAdminUserSchema), adminGeneralController_1.crearUsuarioByAdminGeneral);
router.get('/usuarios/:id', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.detalleUsuario);
router.patch('/usuarios/:id/estado', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.cambiarEstadoUsuario);
router.post('/usuarios/:id/restablecer-password', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.restablecerPassword);
router.post('/usuarios/:id/cerrar-sesion', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.forzarCierreSesion);
router.post('/usuarios/:id/validar-ticket', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.validarTicketParaUsuario);
router.put('/usuarios/:id/credenciales-con-ticket', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.modificarCredencialesConTicket);
router.patch('/usuarios/:id/eliminar', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.eliminarUsuario);
// ─────────────────────────────────────────────────────────────
// DIRECTIVOS (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/colegios/:colegioId/directivos', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.listarDirectivos);
router.post('/directivos', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.registrarDirectivo);
router.put('/directivos/:id', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.actualizarDirectivo);
router.patch('/directivos/:id/desvincular', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.desvincularDirectivo);
router.delete('/directivos/:id', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.eliminarDirectivo);
// ─────────────────────────────────────────────────────────────
// SUPERVISIÓN
// ─────────────────────────────────────────────────────────────
// Admin General solicita, entra, sale, historial, exporta
router.post('/supervision/solicitar', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.solicitarSupervision);
router.get('/supervision/verificar-activa', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.verificarSupervisionActiva);
router.post('/supervision/:id/entrar', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.entrarSupervision);
router.post('/supervision/:id/salir', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.salirSupervision);
router.get('/supervision/:id/acciones', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.verAccionesSupervision);
router.get('/supervision/historial', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.historialSupervision);
router.post('/supervision/:id/exportar', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.exportarAuditoria);
// Directivo aprueba o revoca
router.post('/supervision/:id/aprobar', authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, adminGeneralController_1.aprobarSupervision);
router.post('/supervision/:id/revocar', authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, adminGeneralController_1.revocarSupervision);
router.get('/colegio/:colegioId/supervisiones', authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, adminGeneralController_1.listarSupervisionesColegio);
router.get('/supervision/:id/acciones-directivo', authMiddleware_1.verifyToken, authMiddleware_1.requireDirectivo, adminGeneralController_1.verAccionesSupervisionDirectivo);
// Global Auditorias logs query (Admin General)
router.get('/auditorias', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.listarAuditoriasAcciones);
// Global Notifications logs query (Admin General)
router.get('/notificaciones', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.listarNotificacionesSistema);
// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE PLATAFORMA (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/configuracion', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.obtenerConfiguracion);
router.put('/configuracion', authMiddleware_1.verifyToken, authMiddleware_1.requireAdminGeneral, adminGeneralController_1.actualizarConfiguracion);
exports.default = router;
