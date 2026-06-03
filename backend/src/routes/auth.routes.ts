import { Router } from "express";
import { login, studentLogin } from "../controllers/authController";
import { checkDocument } from "../controllers/userController";

const router = Router();

router.post("/login", login);
router.post("/student-login", studentLogin);
router.get("/check-document/:document", checkDocument);

export default router;
