import { Router } from "express";
import { 
  getAllStudents, 
  updateStudent, 
  updateStudentStatus, 
  changeStudentGrade, 
  deleteStudent,
  getStudentSummary
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

const router = Router();

router.get("/colegio/:idColegio", getAllStudents);
router.get("/:id/summary", getStudentSummary);
router.put("/:id", updateStudent);
router.patch("/:id/status", updateStudentStatus);
router.patch("/:id/change-grade", changeStudentGrade);
router.delete("/:id", deleteStudent);

// Student portal endpoints consumed by the frontend
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

