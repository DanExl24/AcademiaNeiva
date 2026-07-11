import { Router } from "express";
import { 
  getAllStudents, 
  updateStudent, 
  updateStudentStatus, 
  changeStudentGrade, 
  deleteStudent,
  getStudentSummary,
  graduateStudent,
  getTipoSanciones
} from "../controllers/studentController";
import {
  getStudentAcademicYears,
  getStudentClosedPeriods,
  getStudentGrades,
  getGradeDetails,
  getStudentInfo,
  getParentChildren,
  getStudentAttendance,
  getStudentObservations,
  getParentDashboardData,
  getStudentIdByUserId,
  getStudentDashboardStats,
  getStudentAllPeriods
} from "../controllers/studentPortalController";

import { verifyToken, requireDirectivo } from "../middleware/authMiddleware";

const router = Router();

// Administrative CRUD operations (require Directivo or Admin General)
router.get("/sanctions/types", verifyToken, requireDirectivo, getTipoSanciones);
router.get("/colegio/:idColegio", verifyToken, requireDirectivo, getAllStudents);
router.get("/:id/summary", verifyToken, requireDirectivo, getStudentSummary);
router.put("/:id", verifyToken, requireDirectivo, updateStudent);
router.patch("/:id/status", verifyToken, requireDirectivo, updateStudentStatus);
router.patch("/:id/change-grade", verifyToken, requireDirectivo, changeStudentGrade);
router.post("/:id/graduate", verifyToken, requireDirectivo, graduateStudent);
router.delete("/:id", verifyToken, requireDirectivo, deleteStudent);

// Student portal endpoints (require authentication)
router.use(verifyToken);

router.get("/user-id/:id_usuario", getStudentIdByUserId);
router.get("/info/:id_estudiante", getStudentInfo);
router.get("/periods/:id_estudiante/:id_anio", getStudentClosedPeriods);
router.get("/all-periods/:id_estudiante/:id_anio", getStudentAllPeriods);
router.get("/grades/:id_estudiante/:id_periodo", getStudentGrades);
router.get("/grade-details/:id_estudiante/:id_periodo/:id_materia", getGradeDetails);
router.get("/attendance/:id_estudiante/:id_periodo", getStudentAttendance);
router.get("/observations/:id_estudiante/:id_periodo", getStudentObservations);
router.get("/parent-dashboard/:id_usuario", getParentDashboardData);
router.get("/dashboard-stats/:id_estudiante/:id_periodo", getStudentDashboardStats);
router.get("/parent-children/:id_usuario", getParentChildren);
router.get("/academic-years/:id_estudiante", getStudentAcademicYears);
router.get("/years/:id_estudiante", getStudentAcademicYears);

export default router;

