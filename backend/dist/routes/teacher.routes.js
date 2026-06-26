"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const academicController_1 = require("../controllers/academicController");
const gradingController_1 = require("../controllers/gradingController");
const attendanceController_1 = require("../controllers/attendanceController");
const observationController_1 = require("../controllers/observationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.verifyToken);
router.get("/dashboard/:userId", academicController_1.getTeacherDashboard);
router.get("/courses/:userId", academicController_1.getTeacherCourses);
router.get("/students/:gradeId", academicController_1.getStudentsByGrade);
// Rutas de Calificaciones - Actividades
router.get("/activities/:gradeId/:subjectId/:periodId", gradingController_1.getActivities);
router.post("/activities", gradingController_1.createActivity);
router.put("/activities/:id", gradingController_1.updateActivity);
router.delete("/activities/:id", gradingController_1.deleteActivity);
// Rutas de Calificaciones - Criterios
router.post("/activities/criteria", gradingController_1.createCriterion);
router.delete("/activities/criteria/:id", gradingController_1.deleteCriterion);
router.put("/competencies/:id", gradingController_1.updateCompetency);
router.get("/competencies/:competenciaId/evidencias-dba", gradingController_1.getCompetenciaEvidenciasDba);
router.get("/courses/:gradeId/:subjectId/evidencias-dba", gradingController_1.getCourseEvidenciasDba);
router.get("/periods/:schoolId", gradingController_1.getPeriods);
// Rutas de Calificaciones - Notas
router.get("/grades/:gradeId/:subjectId/:periodId", gradingController_1.getGrades);
router.post("/grades", gradingController_1.saveGrades);
// Rutas de Cierre de Periodo
router.get("/closure-status/:detailGradeId/:periodId", gradingController_1.getClosureStatus);
router.post("/close-period", gradingController_1.closePeriodForTeacher);
// Rutas de Asistencia
router.get("/attendance/:detailGradeId/:date", attendanceController_1.getAttendanceByDate);
router.post("/attendance", attendanceController_1.saveAttendance);
router.get("/attendance-history/:detailGradeId", attendanceController_1.getAttendanceHistory);
// Rutas de Observaciones
router.get("/observations/:detailGradeId/:periodId", observationController_1.getObservations);
router.post("/observations", observationController_1.createObservation);
router.put("/observations/:id", observationController_1.updateObservation);
router.delete("/observations/:id", observationController_1.deleteObservation);
exports.default = router;
