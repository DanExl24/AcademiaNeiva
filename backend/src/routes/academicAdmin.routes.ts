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
  getTeacherManagementData,
  assignTeacherCourseSubject,
  closeAcademicPeriod,
  upsertCompetencyByAdmin,
  updateAcademicPeriodPercentage,
  updateManualScaleConfiguration,
  updateSchoolDefaultSettings,
  updateScale,
  updateTeacherStatus,
} from "../controllers/academicAdminController";

const router = Router();

router.get("/catalogs", getAcademicCatalogs);
router.get("/grades/:schoolId", getGradeManagementData);
router.post("/grade-types", createGradeType);
router.delete("/grade-types/:id", deleteGradeType);
router.post("/groups", createGroup);
router.delete("/groups/:id", deleteGroup);
router.get("/subjects/:schoolId", getSubjects);
router.post("/subjects", createSubject);
router.delete("/subjects/:id", deleteSubject);
router.get("/teachers/:schoolId", getTeacherManagementData);
router.post("/teachers", createTeacher);
router.patch("/teachers/:id/status", updateTeacherStatus);
router.post("/teacher-assignments", assignTeacherCourseSubject);
router.delete("/teacher-assignments/:id", deleteTeacherAssignment);
router.get("/settings/:schoolId", getAcademicSettingsData);
router.post("/settings/years", createAcademicYear);
router.put("/settings/defaults", updateSchoolDefaultSettings);
router.put("/settings/scales/manual", updateManualScaleConfiguration);
router.post("/settings/periods", createAcademicPeriod);
router.patch("/settings/periods/:id/percentage", updateAcademicPeriodPercentage);
router.post("/settings/competencies", upsertCompetencyByAdmin);
router.post("/settings/periods/:id/close", closeAcademicPeriod);
router.post("/settings/scales", createScale);
router.put("/settings/scales/:id", updateScale);
router.delete("/settings/scales/:id", deleteScale);

export default router;
