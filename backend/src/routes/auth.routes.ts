import { Router } from "express";
import { login, studentLogin, getSchoolIdentity } from "../controllers/authController";
import { checkDocument } from "../controllers/userController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/login", login);
router.post("/student-login", studentLogin);
router.get("/check-document/:document", checkDocument);
router.get("/school-identity/:schoolId", verifyToken, getSchoolIdentity);

export default router;

