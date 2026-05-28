import { Request, Response } from "express";
import { pool } from "../config/db";

export const checkDocument = async (req: Request, res: Response): Promise<void> => {
  const { document } = req.params;

  try {
    // 1. Buscar en docentes
    const docenteRes = await pool.query(
      `SELECT u.nombre, u.apellido, r.nombre as role
       FROM docente d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE d.documento = $1`,
      [document]
    );

    if (docenteRes.rows.length > 0) {
      res.json({
        exists: true,
        user: docenteRes.rows[0],
        role: 'docente'
      });
      return;
    }

    // 2. Buscar en directivos (si tienen documento, si no, se podría buscar por otro campo si existiera)
    // Nota: La tabla directivo no parece tener campo documento directo en el SQL mostrado, 
    // pero si el usuario es docente y directivo ya lo habríamos encontrado.
    
    res.json({ exists: false });
  } catch (error: any) {
    console.error("Error checking document:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
