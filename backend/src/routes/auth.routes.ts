import { Router } from "express";
import { login, studentLogin, getSchoolIdentity, verifySession, updateProfileEmail, updateProfilePassword, getUserProfile } from "../controllers/authController";
import { checkDocument } from "../controllers/userController";
import { forgotPassword, resetPassword } from "../controllers/passwordResetController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/login", login);
router.post("/student-login", studentLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/check-document/:document", checkDocument);
router.get("/school-identity/:schoolId", verifyToken, getSchoolIdentity);
router.get("/verify", verifySession);

// Endpoints de gestión de perfil de usuario logueado
router.get("/profile", verifyToken, getUserProfile);
router.put("/profile/email", verifyToken, updateProfileEmail);
router.put("/profile/password", verifyToken, updateProfilePassword);

export default router;

