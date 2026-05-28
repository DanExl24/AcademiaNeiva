import { Router } from "express";
import { getTeacherCourses, getStudentsByGrade } from "../controllers/academicController";
import {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  createCriterion,
  deleteCriterion,
  getPeriods,
  getGrades,
  saveGrades,
  updateCompetency,
} from "../controllers/gradingController";
import {
  getAttendanceByDate,
  saveAttendance,
  getAttendanceHistory,
} from "../controllers/attendanceController";
import {
  getObservations,
  createObservation,
  updateObservation,
  deleteObservation,
} from "../controllers/observationController";

const router = Router();

router.get("/courses/:userId", getTeacherCourses);
router.get("/students/:gradeId", getStudentsByGrade);

// Rutas de Calificaciones - Actividades
router.get("/activities/:gradeId/:subjectId/:periodId", getActivities);
router.post("/activities", createActivity);
router.put("/activities/:id", updateActivity);
router.delete("/activities/:id", deleteActivity);

// Rutas de Calificaciones - Criterios
router.post("/activities/criteria", createCriterion);
router.delete("/activities/criteria/:id", deleteCriterion);

router.put("/competencies/:id", updateCompetency);
router.get("/periods/:schoolId", getPeriods);

// Rutas de Calificaciones - Notas
router.get("/grades/:gradeId/:subjectId/:periodId", getGrades);
router.post("/grades", saveGrades);

// Rutas de Asistencia
router.get("/attendance/:detailGradeId/:date", getAttendanceByDate);
router.post("/attendance", saveAttendance);
router.get("/attendance-history/:detailGradeId", getAttendanceHistory);

// Rutas de Observaciones
router.get("/observations/:detailGradeId/:periodId", getObservations);
router.post("/observations", createObservation);
router.put("/observations/:id", updateObservation);
router.delete("/observations/:id", deleteObservation);

export default router;
