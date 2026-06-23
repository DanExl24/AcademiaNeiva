import { Router } from 'express';
import { validatePeriodClosed, getStudentBoletin, getGradeBoletines } from '../controllers/boletinController';

import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

router.use(verifyToken);

// Validate if period is closed (used for enabling bulk generation button)
router.get('/validate/:id_colegio/:id_periodo', validatePeriodClosed);

// Get boletin for a specific student
router.get('/student/:id_estudiante/:id_periodo', getStudentBoletin);

// Get boletines mass generation for a grade limit
router.get('/grade/:id_grupo/:id_periodo', getGradeBoletines);

export default router;
