import { Router } from 'express';
import { upload } from '../config/multer';
import { verifyToken, requireAdminGeneral, requireDirectivo } from '../middleware/authMiddleware';
import {
  // Colegios
  listarColegios,
  detalleColegio,
  registrarColegio,
  actualizarColegio,
  uploadEscudo,
  cambiarEstadoColegio,
  eliminarColegio,
  // Usuarios
  listarUsuarios,
  detalleUsuario,
  cambiarEstadoUsuario,
  restablecerPassword,
  forzarCierreSesion,
  eliminarUsuario,
  // Directivos
  listarDirectivos,
  registrarDirectivo,
  actualizarDirectivo,
  desvincularDirectivo,
  eliminarDirectivo,
  // Supervisión
  solicitarSupervision,
  aprobarSupervision,
  entrarSupervision,
  salirSupervision,
  revocarSupervision,
  verAccionesSupervision,
  historialSupervision,
  exportarAuditoria,
  obtenerStatsDashboard,
  listarAuditoriasAcciones,
  listarNotificacionesSistema,
} from '../controllers/adminGeneralController';

const router = Router();

// ─────────────────────────────────────────────────────────────
// DASHBOARD (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/dashboard/stats', verifyToken, requireAdminGeneral, obtenerStatsDashboard);

// ─────────────────────────────────────────────────────────────
// COLEGIOS (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/colegios', verifyToken, requireAdminGeneral, listarColegios);
router.get('/colegios/:id', verifyToken, requireAdminGeneral, detalleColegio);
router.post('/colegios', verifyToken, requireAdminGeneral, registrarColegio);
router.post('/colegios/upload-escudo', verifyToken, requireAdminGeneral, upload.single('escudo'), uploadEscudo);
router.put('/colegios/:id', verifyToken, requireAdminGeneral, actualizarColegio);
router.patch('/colegios/:id/estado', verifyToken, requireAdminGeneral, cambiarEstadoColegio);
router.delete('/colegios/:id', verifyToken, requireAdminGeneral, eliminarColegio);

// ─────────────────────────────────────────────────────────────
// USUARIOS (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/usuarios', verifyToken, requireAdminGeneral, listarUsuarios);
router.get('/usuarios/:id', verifyToken, requireAdminGeneral, detalleUsuario);
router.patch('/usuarios/:id/estado', verifyToken, requireAdminGeneral, cambiarEstadoUsuario);
router.post('/usuarios/:id/restablecer-password', verifyToken, requireAdminGeneral, restablecerPassword);
router.post('/usuarios/:id/cerrar-sesion', verifyToken, requireAdminGeneral, forzarCierreSesion);
router.delete('/usuarios/:id', verifyToken, requireAdminGeneral, eliminarUsuario);

// ─────────────────────────────────────────────────────────────
// DIRECTIVOS (requiere Admin General)
// ─────────────────────────────────────────────────────────────
router.get('/colegios/:colegioId/directivos', verifyToken, requireAdminGeneral, listarDirectivos);
router.post('/directivos', verifyToken, requireAdminGeneral, registrarDirectivo);
router.put('/directivos/:id', verifyToken, requireAdminGeneral, actualizarDirectivo);
router.patch('/directivos/:id/desvincular', verifyToken, requireAdminGeneral, desvincularDirectivo);
router.delete('/directivos/:id', verifyToken, requireAdminGeneral, eliminarDirectivo);

// ─────────────────────────────────────────────────────────────
// SUPERVISIÓN
// ─────────────────────────────────────────────────────────────
// Admin General solicita, entra, sale, historial, exporta
router.post('/supervision/solicitar', verifyToken, requireAdminGeneral, solicitarSupervision);
router.post('/supervision/:id/entrar', verifyToken, requireAdminGeneral, entrarSupervision);
router.post('/supervision/:id/salir', verifyToken, requireAdminGeneral, salirSupervision);
router.get('/supervision/:id/acciones', verifyToken, requireAdminGeneral, verAccionesSupervision);
router.get('/supervision/historial', verifyToken, requireAdminGeneral, historialSupervision);
router.post('/supervision/:id/exportar', verifyToken, requireAdminGeneral, exportarAuditoria);

// Directivo aprueba o revoca
router.post('/supervision/:id/aprobar', verifyToken, requireDirectivo, aprobarSupervision);
router.post('/supervision/:id/revocar', verifyToken, requireDirectivo, revocarSupervision);

// Global Auditorias logs query (Admin General)
router.get('/auditorias', verifyToken, requireAdminGeneral, listarAuditoriasAcciones);

// Global Notifications logs query (Admin General)
router.get('/notificaciones', verifyToken, requireAdminGeneral, listarNotificacionesSistema);

export default router;
