import { Router } from "express";
import { login } from "../controllers/authController";
import { checkDocument } from "../controllers/userController";

const router = Router();

router.post("/login", login);
router.get("/check-document/:document", checkDocument);

export default router;
