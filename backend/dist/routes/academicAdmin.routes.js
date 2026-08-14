"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const academicAdminController_1 = require("../controllers/academicAdminController");
const dbaReportsController_1 = require("../controllers/dbaReportsController");
const academicTrackingController_1 = require("../controllers/academicAdmin/academicTrackingController");
const multer_1 = require("../config/multer");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public routes
router.get("/catalogs", academicAdminController_1.getAcademicCatalogs);
// Protected routes (require verification)
router.use(authMiddleware_1.verifyToken);
// Expose read-only routes to all authenticated users (Docentes, Padres, Estudiantes need these settings)
router.get("/my-school/:schoolId", academicAdminController_1.getMySchoolData);
router.get("/settings/:schoolId", academicAdminController_1.getAcademicSettingsData);
router.get("/active-period-info", academicAdminController_1.getActivePeriodInfo);
// Require Directivo role for administrative actions
router.use(authMiddleware_1.requireDirectivo);
router.get("/settings/enrollment-config/:schoolId/:yearId", academicAdminController_1.getEnrollmentConfig);
router.post("/settings/enrollment-config", academicAdminController_1.saveEnrollmentConfig);
router.put("/my-school/:schoolId/identidad", academicAdminController_1.updateMySchoolIdentity);
router.post("/my-school/:schoolId/identidad/reset", academicAdminController_1.resetMySchoolIdentity);
router.post("/my-school/:schoolId/identidad/upload-escudo", multer_1.upload.single("escudo"), academicAdminController_1.uploadMySchoolEscudo);
router.get("/grades/:schoolId", academicAdminController_1.getGradeManagementData);
router.get("/groups/:groupId/members", academicAdminController_1.getGroupMembers);
router.post("/grade-types", academicAdminController_1.createGradeType);
router.delete("/grade-types/:id", academicAdminController_1.deleteGradeType);
router.post("/groups", academicAdminController_1.createGroup);
router.patch("/groups/:id/cupos", academicAdminController_1.updateGroupCupos);
router.patch("/groups/:id/rename", academicAdminController_1.renameSingleCourse);
router.patch("/groups/:id/jornada", academicAdminController_1.reassignGroupJornada);
router.patch("/grade-types/:id/bulk-rename", academicAdminController_1.bulkRenameCourses);
router.delete("/groups/:id", academicAdminController_1.deleteGroup);
router.post("/jornadas", academicAdminController_1.createJornada);
router.delete("/jornadas/:id", academicAdminController_1.deleteJornada);
router.get("/subjects/:schoolId", academicAdminController_1.getSubjects);
router.get("/subjects/:id/curriculum-details", academicAdminController_1.getSubjectCurriculumDetails);
router.get("/subjects/trash/:schoolId", academicAdminController_1.getSubjectTrash);
router.post("/subjects", academicAdminController_1.createSubject);
router.delete("/subjects/:id", academicAdminController_1.deleteSubject);
router.get("/teachers/:schoolId", academicAdminController_1.getTeacherManagementData);
router.get("/users/lookup", academicAdminController_1.lookupUserIdentity);
router.post("/teachers", academicAdminController_1.createTeacher);
router.put("/teachers/:id", academicAdminController_1.updateTeacher);
router.delete("/teachers/:id", academicAdminController_1.deleteTeacher);
router.patch("/teachers/:id/status", academicAdminController_1.updateTeacherStatus);
router.post("/teacher-assignments", academicAdminController_1.assignTeacherCourseSubject);
router.delete("/teacher-assignments/:id", academicAdminController_1.deleteTeacherAssignment);
router.post("/settings/years", academicAdminController_1.createAcademicYear);
router.delete("/settings/years/:id", academicAdminController_1.deleteAcademicYear);
router.patch("/settings/years/:id/status", academicAdminController_1.updateAcademicYearStatus);
router.patch("/settings/years/:id/calendar-type", academicAdminController_1.updateAcademicYearCalendarType);
router.put("/settings/defaults", academicAdminController_1.updateSchoolDefaultSettings);
router.put("/settings/scales/manual", academicAdminController_1.updateManualScaleConfiguration);
router.post("/settings/periods", academicAdminController_1.createAcademicPeriod);
router.delete("/settings/periods/:id", academicAdminController_1.deleteAcademicPeriod);
router.patch("/settings/periods/:id/percentage", academicAdminController_1.updateAcademicPeriodPercentage);
router.get("/settings/closure-details/:schoolId/:periodId", academicAdminController_1.getPeriodClosureDetails);
router.post("/settings/competencies", academicAdminController_1.upsertCompetencyByAdmin);
router.get("/settings/competencies/:id/usage-check", academicAdminController_1.checkCompetenciaUsage);
router.delete("/settings/competencies/:id", academicAdminController_1.deleteCompetencyByAdmin);
router.post("/settings/periods/:id/close", academicAdminController_1.closeAcademicPeriod);
router.post("/settings/periods/:id/approve", academicAdminController_1.approveAcademicPeriod);
router.post("/settings/periods/:id/reopen", academicAdminController_1.reopenAcademicPeriod);
router.post("/settings/periods/:periodId/reopen-subject/:detailGradeId", academicAdminController_1.reopenSubjectClosure);
router.post("/settings/scales", academicAdminController_1.createScale);
router.put("/settings/scales/:id", academicAdminController_1.updateScale);
router.delete("/settings/scales/:id", academicAdminController_1.deleteScale);
// Evidencias de aprendizaje
router.post("/settings/competencies/:competenciaId/evidencias", academicAdminController_1.createEvidencia);
router.put("/settings/evidencias/:evidenciaId", academicAdminController_1.updateEvidencia);
router.delete("/settings/evidencias/:evidenciaId", academicAdminController_1.deleteEvidencia);
// Integración de DBA en Colegios (Fase 2)
router.get("/settings/dba-planeacion/disponibles/:schoolId", academicAdminController_1.getDbaPlaneacionDisponibles);
router.post("/settings/competencias/:competenciaId/vincular-evidencias-dba", academicAdminController_1.vincularEvidenciasDbaACompetencia);
router.get("/settings/dba-reportes/coherencia/:schoolId", dbaReportsController_1.obtenerReporteCoherenciaCurricular);
router.get("/settings/dba-reportes/cobertura/:schoolId", dbaReportsController_1.obtenerReporteCoberturaDba);
router.get("/settings/dba-catalogo/:schoolId", dbaReportsController_1.obtenerCatalogoDbaDirectivo);
// Dashboard Analítico
router.get("/dashboard/:schoolId", academicAdminController_1.getDirectivoDashboard);
// Matrícula Extraordinaria
router.post("/matriculas/extraordinaria", academicAdminController_1.createExtraordinaryEnrollment);
router.post("/matriculas/extraordinaria/:id/aprobar", academicAdminController_1.approveExtraordinaryEnrollment);
router.post("/matriculas/extraordinaria/:id/rechazar", academicAdminController_1.rejectExtraordinaryEnrollment);
// Reingreso
router.post("/matriculas/reingreso", academicAdminController_1.createReingresoEnrollment);
router.post("/matriculas/reingreso/:id/aprobar", academicAdminController_1.approveReingresoEnrollment);
router.post("/matriculas/reingreso/:id/corregir", academicAdminController_1.correctReingresoEnrollment);
router.post("/matriculas/reingreso/:id/rechazar", academicAdminController_1.rejectReingresoEnrollment);
// Seguimiento Académico y Consolidación de Promoción
router.get("/academic-tracking/period-tracking", academicTrackingController_1.getPeriodAcademicTracking);
router.get("/academic-tracking/annual-consolidation", academicTrackingController_1.getAnnualConsolidation);
router.get("/academic-tracking/student-history/:studentId", academicTrackingController_1.getStudentAcademicHistory);
router.get("/academic-tracking/check-warning", academicTrackingController_1.checkStudentAcademicWarning);
router.post("/academic-tracking/record-decision", academicTrackingController_1.recordDirectiveDecision);
exports.default = router;
