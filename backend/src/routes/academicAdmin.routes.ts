import { Router } from "express";
import {
  createGradeType,
  createGroup,
  createSubject,
  createTeacher,
  createAcademicPeriod,
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
} from "../controllers/academicAdminController";

const router = Router();

router.get("/catalogs", getAcademicCatalogs);
router.get("/grades/:schoolId", getGradeManagementData);
router.post("/grade-types", createGradeType);
router.delete("/grade-types/:id", deleteGradeType);
router.post("/groups", createGroup);
router.patch("/groups/:id/cupos", updateGroupCupos);
router.delete("/groups/:id", deleteGroup);
router.get("/subjects/:schoolId", getSubjects);
router.get("/subjects/trash/:schoolId", getSubjectTrash);
router.post("/subjects", createSubject);
router.delete("/subjects/:id", deleteSubject);
router.get("/teachers/:schoolId", getTeacherManagementData);
router.post("/teachers", createTeacher);
router.patch("/teachers/:id/status", updateTeacherStatus);
router.post("/teacher-assignments", assignTeacherCourseSubject);
router.delete("/teacher-assignments/:id", deleteTeacherAssignment);
router.get("/settings/:schoolId", getAcademicSettingsData);
router.post("/settings/years", createAcademicYear);
router.delete("/settings/years/:id", deleteAcademicYear);
router.patch("/settings/years/:id/status", updateAcademicYearStatus);
router.put("/settings/defaults", updateSchoolDefaultSettings);
router.put("/settings/scales/manual", updateManualScaleConfiguration);
router.post("/settings/periods", createAcademicPeriod);
router.patch("/settings/periods/:id/percentage", updateAcademicPeriodPercentage);
router.get("/settings/closure-details/:schoolId/:periodId", getPeriodClosureDetails);
router.post("/settings/competencies", upsertCompetencyByAdmin);
router.post("/settings/periods/:id/close", closeAcademicPeriod);
router.post("/settings/periods/:id/reopen", reopenAcademicPeriod);
router.post("/settings/periods/:periodId/reopen-subject/:detailGradeId", reopenSubjectClosure);
router.post("/settings/scales", createScale);
router.put("/settings/scales/:id", updateScale);
router.delete("/settings/scales/:id", deleteScale);

// Evidencias de aprendizaje
router.post("/settings/competencies/:competenciaId/evidencias", createEvidencia);
router.put("/settings/evidencias/:evidenciaId", updateEvidencia);
router.delete("/settings/evidencias/:evidenciaId", deleteEvidencia);

// Dashboard Analítico
router.get("/dashboard/:schoolId", getDirectivoDashboard);

export default router;
