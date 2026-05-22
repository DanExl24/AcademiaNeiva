"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const academicController_1 = require("../controllers/academicController");
const gradingController_1 = require("../controllers/gradingController");
const router = (0, express_1.Router)();
router.get("/courses/:userId", academicController_1.getTeacherCourses);
router.get("/students/:gradeId", academicController_1.getStudentsByGrade);
// Rutas de Calificaciones - Actividades
router.get("/activities/:gradeId/:subjectId/:periodId", gradingController_1.getActivities);
router.post("/activities", gradingController_1.createActivity);
router.put("/activities/:id", gradingController_1.updateActivity);
router.delete("/activities/:id", gradingController_1.deleteActivity);
router.put("/competencies/:id", gradingController_1.updateCompetency);
router.get("/periods/:schoolId", gradingController_1.getPeriods);
// Rutas de Calificaciones - Notas
router.get("/grades/:gradeId/:subjectId/:periodId", gradingController_1.getGrades);
router.post("/grades", gradingController_1.saveGrades);
exports.default = router;
