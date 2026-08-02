import { Router } from "express";
import { login, studentLogin, getSchoolIdentity, verifySession, requestEmailChange, verifyEmailChange, updateProfilePassword, updateProfilePhone, getUserProfile } from "../controllers/authController";
import { checkDocument } from "../controllers/userController";
import { forgotPassword, resetPassword } from "../controllers/passwordResetController";
import { verifyToken } from "../middleware/authMiddleware";
import { validateDto } from "../middleware/validateDto";
import { updatePhoneSchema, requestEmailChangeSchema, verifyEmailChangeSchema } from "../dtos/profile.dto";

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
router.post("/profile/request-email-change", verifyToken, validateDto(requestEmailChangeSchema), requestEmailChange);
router.post("/profile/verify-email-change", verifyToken, validateDto(verifyEmailChangeSchema), verifyEmailChange);
router.put("/profile/phone", verifyToken, validateDto(updatePhoneSchema), updateProfilePhone);
router.put("/profile/password", verifyToken, updateProfilePassword);

export default router;

