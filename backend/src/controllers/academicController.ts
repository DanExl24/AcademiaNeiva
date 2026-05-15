import { Request, Response } from "express";
import { pool } from "../config/db";

export const getTeacherCourses = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params; // id_usuario del docente

  try {
    // 1. Obtener el id_docente vinculado al usuario
    const docenteRes = await pool.query(
      "SELECT id_docente FROM docente WHERE id_usuario = $1",
      [userId]
    );

    if (docenteRes.rows.length === 0) {
      res.status(404).json({ error: "Docente no encontrado" });
      return;
    }

    const idDocente = docenteRes.rows[0].id_docente;

    // 2. Obtener la jerarquía de Grados -> Materias
    const result = await pool.query(
      `SELECT 
        dg.id_detallegrado,
        g.id_grado, 
        g.tipo_grado as grado_nombre, 
        g.nivel, 
        g.seccion,
        m.id_materia, 
        m.nombre as materia_nombre
       FROM detalle_grados dg
       JOIN grados g ON dg.id_grado = g.id_grado
       JOIN materias m ON dg.id_materia = m.id_materia
       WHERE dg.id_docente = $1`,
      [idDocente]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching teacher courses:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getStudentsByGrade = async (req: Request, res: Response): Promise<void> => {
  const { gradeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id_estudiante, nombre, apellido, documento, codigo 
       FROM estudiante 
       WHERE id_grado = $1
       ORDER BY apellido, nombre`,
      [gradeId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
