import { Router } from "express";
import { AcademicController } from "../controllers/academicController";

const router = Router();

router.get("/parent/:padreId/students", AcademicController.getStudentsByParent);
router.get("/student/:studentId/grades", AcademicController.getGrades);
router.get("/student/:studentId/attendance", AcademicController.getAttendance);
router.get("/student/:studentId/observations", AcademicController.getObservations);
router.get("/periods/:schoolId", AcademicController.getActivePeriods);
router.post("/update-email", AcademicController.updateEmail);

export default router;
