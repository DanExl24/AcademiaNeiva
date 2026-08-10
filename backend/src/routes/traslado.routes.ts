import { Router } from 'express';
import { verifyToken, requireDirectivo } from '../middleware/authMiddleware';
import { validateDto } from '../middleware/validateDto';
import { CreateTrasladoSchema, ApproveTrasladoSchema } from '../dtos/traslado.dto';
import {
  createTraslado,
  approveTraslado,
  getTraslados,
  getTrasladoById,
  getMyVinculaciones
} from '../controllers/trasladoController';

const router = Router();

router.use(verifyToken);

router.get('/mis-vinculaciones', getMyVinculaciones);
router.get('/', getTraslados);
router.get('/:id', getTrasladoById);

router.post('/', validateDto(CreateTrasladoSchema), createTraslado);
router.post('/:id/aprobacion', validateDto(ApproveTrasladoSchema), approveTraslado);

export default router;
