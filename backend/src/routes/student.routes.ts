import { Router } from "express";
import { 
  getAllStudents, 
  updateStudent, 
  updateStudentStatus, 
  changeStudentGrade, 
  deleteStudent 
} from "../controllers/studentController";

const router = Router();

router.get("/colegio/:idColegio", getAllStudents);
router.put("/:id", updateStudent);
router.patch("/:id/status", updateStudentStatus);
router.patch("/:id/change-grade", changeStudentGrade);
router.delete("/:id", deleteStudent);

export default router;
