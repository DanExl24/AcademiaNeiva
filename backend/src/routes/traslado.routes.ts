import { Router } from 'express';
import { verifyToken, requireAdminGeneral } from '../middleware/authMiddleware';
import { validateDto } from '../middleware/validateDto';
import { CreateTrasladoSchema, ApproveTrasladoSchema } from '../dtos/traslado.dto';
import {
  createTraslado,
  approveTraslado,
  getTraslados,
  getTrasladoById,
  getDatosAcademicosTraslado,
  getMyVinculaciones,
  getPersonalColegio,
  getDirectivosColegio,
  getAdminTrasladosGlobal,
  getAdminEstadisticas,
  intervenirTraslado
} from '../controllers/trasladoController';

const router = Router();

router.use(verifyToken);

// Rutas exclusivas del Administrador General (deben ir ANTES de /:id para evitar conflictos de captura)
router.get('/admin/global', requireAdminGeneral, getAdminTrasladosGlobal);
router.get('/admin/estadisticas', requireAdminGeneral, getAdminEstadisticas);
router.get('/directivos/:schoolId', requireAdminGeneral, getDirectivosColegio);

// Rutas generales (directivos, padres, usuarios)
router.get('/mis-vinculaciones', getMyVinculaciones);
router.get('/personal/:schoolId', getPersonalColegio);
router.get('/datos-academicos/:id', getDatosAcademicosTraslado);
router.get('/', getTraslados);
router.get('/:id', getTrasladoById);

router.post('/', validateDto(CreateTrasladoSchema), createTraslado);
router.post('/:id/aprobacion', validateDto(ApproveTrasladoSchema), approveTraslado);
router.post('/:id/intervencion', requireAdminGeneral, intervenirTraslado);

export default router;
