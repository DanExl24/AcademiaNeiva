import { Router } from 'express';
import {
  getStudentAcademicYears,
  getStudentClosedPeriods,
  getStudentGrades,
  getStudentInfo,
  getParentChildren,
  getStudentIdByUserId,
  getGradeDetails,
  getStudentAttendance,
  getStudentObservations,
  getParentDashboardData
} from '../controllers/studentPortalController';

const router = Router();

// Student routes
router.get('/years/:id_estudiante', getStudentAcademicYears);
router.get('/periods/:id_estudiante/:id_anio', getStudentClosedPeriods);
router.get('/grades/:id_estudiante/:id_periodo', getStudentGrades);
router.get('/grade-details/:id_estudiante/:id_periodo/:id_materia', getGradeDetails);
router.get('/attendance/:id_estudiante/:id_periodo', getStudentAttendance);
router.get('/observations/:id_estudiante/:id_periodo', getStudentObservations);
router.get('/info/:id_estudiante', getStudentInfo);
router.get('/user-id/:id_usuario', getStudentIdByUserId);

// Parent routes
router.get('/parent-children/:id_usuario', getParentChildren);
router.get('/parent-dashboard/:id_usuario', getParentDashboardData);

export default router;
