import { Router } from 'express';
import { verifyToken, requireAdminGeneral } from '../middleware/authMiddleware';
import { validateDto } from '../middleware/validateDto';
import { CreateTrasladoSchema, ApproveTrasladoSchema } from '../dtos/traslado.dto';
import {
  createTraslado,
  approveTraslado,
  getTraslados,
  getTrasladoById,
  getMyVinculaciones,
  getAdminTrasladosGlobal,
  getAdminEstadisticas,
  intervenirTraslado
} from '../controllers/trasladoController';

const router = Router();

router.use(verifyToken);

// Rutas exclusivas del Administrador General (deben ir ANTES de /:id para evitar conflictos de captura)
router.get('/admin/global', requireAdminGeneral, getAdminTrasladosGlobal);
router.get('/admin/estadisticas', requireAdminGeneral, getAdminEstadisticas);

// Rutas generales (directivos, padres, usuarios)
router.get('/mis-vinculaciones', getMyVinculaciones);
router.get('/', getTraslados);
router.get('/:id', getTrasladoById);

router.post('/', validateDto(CreateTrasladoSchema), createTraslado);
router.post('/:id/aprobacion', validateDto(ApproveTrasladoSchema), approveTraslado);
router.post('/:id/intervencion', requireAdminGeneral, intervenirTraslado);

export default router;
