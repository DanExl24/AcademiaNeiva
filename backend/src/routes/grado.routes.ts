import { Router } from "express";
import { GradoService } from "../services/gradoService";

const router = Router();

router.get("/available/:idColegio", async (req, res) => {
  try {
    const { idColegio } = req.params;
    const grados = await GradoService.getAvailable(Number(idColegio));
    res.json(grados);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
