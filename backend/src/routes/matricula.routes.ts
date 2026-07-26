import { Router } from "express";
import { MatriculaService } from "../services/matriculaService";
import { 
  submitEnrollment,
  getPendingMatriculas, 
  getMatriculaDetails, 
  validateDocument,
  assignGrade,
  notifyInconsistencies,
  finalizeEnrollment,
  cancelEnrollment,
  toggleTransfer
} from "../controllers/matriculaController";
import { upload } from "../config/multer";
import { verifyToken, requireDirectivo } from "../middleware/authMiddleware";

import { pool } from "../config/db";

const router = Router();

// Helper helper middleware to protect routes that request an integer ID, but bypass for UUID tokens
const protectIfIntegerId = (req: any, res: any, next: any) => {
  const { id } = req.params;
  if (id && id.length <= 20) {
    return verifyToken(req, res, () => {
      return requireDirectivo(req, res, next);
    });
  }
  next();
};

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id_colegio, nombre FROM colegio ORDER BY nombre");
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/school/:schoolId/enrollment-config", async (req, res) => {
  try {
    const { schoolId } = req.params;
    
    // Find active year for school
    const yearRes = await pool.query(
      `SELECT id_anio, calendario FROM anio_lectivo WHERE id_colegio = $1 AND estado = 'ABIERTO' ORDER BY id_anio DESC LIMIT 1`,
      [schoolId]
    );
    if (yearRes.rows.length === 0) {
      res.json({ config: null, yearLabel: null });
      return;
    }
    const yearId = yearRes.rows[0].id_anio;
    const yearLabel = yearRes.rows[0].calendario;
    
    const approvedRes = await pool.query(
      `SELECT COUNT(*)::int AS count 
       FROM matricula 
       WHERE id_colegio = $1 AND id_anio = $2 AND estado IN ('ACTIVA', 'TRASLADADA')`,
      [schoolId, yearId]
    );
    const hasApproved = approvedRes.rows[0].count > 0;

    const configRes = await pool.query(
      `SELECT id_configuracion, fecha_inicio, fecha_cierre, habilitada 
       FROM configuracion_inscripcion 
       WHERE id_colegio = $1 AND id_anio = $2`,
      [schoolId, yearId]
    );
    
    if (configRes.rows.length === 0) {
      res.json({
        config: {
          id_configuracion: null,
          id_colegio: Number(schoolId),
          id_anio: yearId,
          fecha_inicio: null,
          fecha_cierre: null,
          habilitada: true,
          hasApproved
        },
        yearLabel
      });
      return;
    }
    
    res.json({
      config: {
        ...configRes.rows[0],
        hasApproved
      },
      yearLabel
    });
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

router.get("/pending/:idColegio", verifyToken, requireDirectivo, getPendingMatriculas);

router.get("/filtered/:idColegio", verifyToken, requireDirectivo, async (req, res) => {
  try {
    const { estado } = req.query;
    const result = await MatriculaService.getFiltered(Number(req.params.idColegio), estado as string);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id", protectIfIntegerId, async (req, res) => {
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

router.patch("/document/:idDocumento", verifyToken, requireDirectivo, validateDocument);
router.post("/assign-grade/:id", verifyToken, requireDirectivo, assignGrade);
router.post("/notify-inconsistencies/:id", verifyToken, requireDirectivo, notifyInconsistencies);
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
    const result = await MatriculaService.updateDocumentsByToken(req.params.token as string, req.files);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
router.post("/finalize/:id", verifyToken, requireDirectivo, finalizeEnrollment);
router.post("/cancel/:id", verifyToken, requireDirectivo, cancelEnrollment);
router.patch("/transfer-status/:id", verifyToken, requireDirectivo, toggleTransfer);

export default router;
