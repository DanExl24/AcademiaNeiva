import { Router } from "express";
import { getDocsModules, getDocContent, searchDocs } from "../controllers/docsController";

const router = Router();

// Rutas públicas de lectura de documentación
router.get("/modules", getDocsModules);
router.get("/content", getDocContent);
router.get("/search", searchDocs);

export default router;
