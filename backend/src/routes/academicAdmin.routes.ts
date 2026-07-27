import { Router } from "express";
import {
  createGradeType,
  createGroup,
  createSubject,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  createAcademicPeriod,
  approveAcademicPeriod,
  createAcademicYear,
  createScale,
  deleteGradeType,
  deleteGroup,
  deleteScale,
  deleteSubject,
  deleteTeacherAssignment,
  getAcademicCatalogs,
  getAcademicSettingsData,
  getGradeManagementData,
  getSubjects,
  getSubjectTrash,
  getTeacherManagementData,
  assignTeacherCourseSubject,
  closeAcademicPeriod,
  reopenAcademicPeriod,
  reopenSubjectClosure,
  upsertCompetencyByAdmin,
  getSubjectCurriculumDetails,
  deleteCompetencyByAdmin,
  checkCompetenciaUsage,
  updateAcademicPeriodPercentage,
  getPeriodClosureDetails,
  updateManualScaleConfiguration,
  updateSchoolDefaultSettings,
  updateScale,
  updateTeacherStatus,
  updateGroupCupos,
  createEvidencia,
  updateEvidencia,
  deleteEvidencia,
  getDirectivoDashboard,
  deleteAcademicYear,
  updateAcademicYearStatus,
  deleteAcademicPeriod,
  updateAcademicYearCalendarType,
  getMySchoolData,
  updateMySchoolIdentity,
  resetMySchoolIdentity,
  uploadMySchoolEscudo,
  getEnrollmentConfig,
  saveEnrollmentConfig,
  createExtraordinaryEnrollment,
  approveExtraordinaryEnrollment,
  rejectExtraordinaryEnrollment,
  createReingresoEnrollment,
  approveReingresoEnrollment,
  rejectReingresoEnrollment,
  renameSingleCourse,
  bulkRenameCourses,
  getDbaPlaneacionDisponibles,
  vincularEvidenciasDbaACompetencia,
} from "../controllers/academicAdminController";
import {
  obtenerReporteCoherenciaCurricular,
  obtenerReporteCoberturaDba,
  obtenerCatalogoDbaDirectivo
} from "../controllers/dbaReportsController";
import { upload } from "../config/multer";
import { verifyToken, requireDirectivo } from "../middleware/authMiddleware";

const router = Router();

// Public routes
router.get("/catalogs", getAcademicCatalogs);

// Protected routes (require verification)
router.use(verifyToken);

// Expose read-only routes to all authenticated users (Docentes need these settings to show scales and branding)
router.get("/my-school/:schoolId", getMySchoolData);
router.get("/settings/:schoolId", getAcademicSettingsData);

// Require Directivo role for administrative actions
router.use(requireDirectivo);

router.get("/settings/enrollment-config/:schoolId/:yearId", getEnrollmentConfig);
router.post("/settings/enrollment-config", saveEnrollmentConfig);


router.put("/my-school/:schoolId/identidad", updateMySchoolIdentity);
router.post("/my-school/:schoolId/identidad/reset", resetMySchoolIdentity);
router.post("/my-school/:schoolId/identidad/upload-escudo", upload.single("escudo"), uploadMySchoolEscudo);

router.get("/grades/:schoolId", getGradeManagementData);
router.post("/grade-types", createGradeType);
router.delete("/grade-types/:id", deleteGradeType);
router.post("/groups", createGroup);
router.patch("/groups/:id/cupos", updateGroupCupos);
router.patch("/groups/:id/rename", renameSingleCourse);
router.patch("/grade-types/:id/bulk-rename", bulkRenameCourses);
router.delete("/groups/:id", deleteGroup);
router.get("/subjects/:schoolId", getSubjects);
router.get("/subjects/:id/curriculum-details", getSubjectCurriculumDetails);
router.get("/subjects/trash/:schoolId", getSubjectTrash);
router.post("/subjects", createSubject);
router.delete("/subjects/:id", deleteSubject);
router.get("/teachers/:schoolId", getTeacherManagementData);
router.post("/teachers", createTeacher);
router.put("/teachers/:id", updateTeacher);
router.delete("/teachers/:id", deleteTeacher);
router.patch("/teachers/:id/status", updateTeacherStatus);
router.post("/teacher-assignments", assignTeacherCourseSubject);
router.delete("/teacher-assignments/:id", deleteTeacherAssignment);
router.post("/settings/years", createAcademicYear);
router.delete("/settings/years/:id", deleteAcademicYear);
router.patch("/settings/years/:id/status", updateAcademicYearStatus);
router.patch("/settings/years/:id/calendar-type", updateAcademicYearCalendarType);
router.put("/settings/defaults", updateSchoolDefaultSettings);
router.put("/settings/scales/manual", updateManualScaleConfiguration);
router.post("/settings/periods", createAcademicPeriod);
router.delete("/settings/periods/:id", deleteAcademicPeriod);
router.patch("/settings/periods/:id/percentage", updateAcademicPeriodPercentage);
router.get("/settings/closure-details/:schoolId/:periodId", getPeriodClosureDetails);
router.post("/settings/competencies", upsertCompetencyByAdmin);
router.get("/settings/competencies/:id/usage-check", checkCompetenciaUsage);
router.delete("/settings/competencies/:id", deleteCompetencyByAdmin);
router.post("/settings/periods/:id/close", closeAcademicPeriod);
router.post("/settings/periods/:id/approve", approveAcademicPeriod);
router.post("/settings/periods/:id/reopen", reopenAcademicPeriod);
router.post("/settings/periods/:periodId/reopen-subject/:detailGradeId", reopenSubjectClosure);
router.post("/settings/scales", createScale);
router.put("/settings/scales/:id", updateScale);
router.delete("/settings/scales/:id", deleteScale);

// Evidencias de aprendizaje
router.post("/settings/competencies/:competenciaId/evidencias", createEvidencia);
router.put("/settings/evidencias/:evidenciaId", updateEvidencia);
router.delete("/settings/evidencias/:evidenciaId", deleteEvidencia);

// Integración de DBA en Colegios (Fase 2)
router.get("/settings/dba-planeacion/disponibles/:schoolId", getDbaPlaneacionDisponibles);
router.post("/settings/competencias/:competenciaId/vincular-evidencias-dba", vincularEvidenciasDbaACompetencia);
router.get("/settings/dba-reportes/coherencia/:schoolId", obtenerReporteCoherenciaCurricular);
router.get("/settings/dba-reportes/cobertura/:schoolId", obtenerReporteCoberturaDba);
router.get("/settings/dba-catalogo/:schoolId", obtenerCatalogoDbaDirectivo);

// Dashboard Analítico
router.get("/dashboard/:schoolId", getDirectivoDashboard);

// Matrícula Extraordinaria
router.post("/matriculas/extraordinaria", createExtraordinaryEnrollment);
router.post("/matriculas/extraordinaria/:id/aprobar", approveExtraordinaryEnrollment);
router.post("/matriculas/extraordinaria/:id/rechazar", rejectExtraordinaryEnrollment);

// Reingreso
router.post("/matriculas/reingreso", createReingresoEnrollment);
router.post("/matriculas/reingreso/:id/aprobar", approveReingresoEnrollment);
router.post("/matriculas/reingreso/:id/rechazar", rejectReingresoEnrollment);

export default router;
