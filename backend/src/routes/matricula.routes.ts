import { Router } from "express";
import { MatriculaService } from "../services/matriculaService";
import { 
  submitEnrollment,
  getPendingMatriculas, 
  getMatriculaDetails, 
  validateDocument,
  assignGrade,
  notifyInconsistencies,
  finalizeEnrollment
} from "../controllers/matriculaController";
import { upload } from "../config/multer";

import { pool } from "../config/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id_colegio, nombre FROM colegio ORDER BY nombre");
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/submit", upload.fields([
  { name: 'registroCivil', maxCount: 1 },
  { name: 'documentoIdentidad', maxCount: 1 },
  { name: 'documentoPadre', maxCount: 1 },
  { name: 'vacunas', maxCount: 1 },
  { name: 'salud', maxCount: 1 },
  { name: 'foto', maxCount: 1 },
  { name: 'visa', maxCount: 1 },
  { name: 'reciboPublico', maxCount: 1 },
  { name: 'certificadoDiscapacidad', maxCount: 1 },
  { name: 'certificadosEscolaridad', maxCount: 1 }
]), submitEnrollment);

router.get("/pending/:idColegio", getPendingMatriculas);
router.get("/filtered/:idColegio", async (req, res) => {
  try {
    const { estado } = req.query;
    const result = await MatriculaService.getFiltered(Number(req.params.idColegio), estado as string);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let result;
    if (id.length > 20) { // Probablemente un UUID token
       result = await MatriculaService.getByToken(id);
    } else {
       result = await MatriculaService.getDetails(Number(id));
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/document/:idDocumento", validateDocument);
router.post("/assign-grade/:id", assignGrade);
router.post("/notify-inconsistencies/:id", notifyInconsistencies);
router.post("/update-documents/:token", upload.fields([
  { name: 'registroCivil', maxCount: 1 },
  { name: 'documentoIdentidad', maxCount: 1 },
  { name: 'documentoPadre', maxCount: 1 },
  { name: 'vacunas', maxCount: 1 },
  { name: 'salud', maxCount: 1 },
  { name: 'foto', maxCount: 1 },
  { name: 'visa', maxCount: 1 },
  { name: 'reciboPublico', maxCount: 1 },
  { name: 'certificadoDiscapacidad', maxCount: 1 },
  { name: 'certificadosEscolaridad', maxCount: 1 }
]), async (req, res) => {
  try {
    const result = await MatriculaService.updateDocumentsByToken(req.params.token, req.files);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
router.post("/finalize/:id", finalizeEnrollment);

export default router;
