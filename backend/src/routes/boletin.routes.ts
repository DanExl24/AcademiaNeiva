import { Router } from 'express';
import { 
  validatePeriodClosed, 
  getStudentBoletin, 
  getGradeBoletines,
  getStudentTransferPartialReport 
} from '../controllers/boletinController';

import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

router.use(verifyToken);

// Validate if period is closed (used for enabling bulk generation button)
router.get('/validate/:id_colegio/:id_periodo', validatePeriodClosed);

// Get boletin for a specific student (Requiere periodo CERRADO)
router.get('/student/:id_estudiante/:id_periodo', getStudentBoletin);

// Get boletines mass generation for a grade limit (Requiere periodo CERRADO)
router.get('/grade/:id_grupo/:id_periodo', getGradeBoletines);

// Get informe académico parcial de notas para traslados y retiros (Decreto 1075 Art. 2.3.3.3.3.17)
router.get('/transfer-partial-report/:id_estudiante', getStudentTransferPartialReport);

export default router;
