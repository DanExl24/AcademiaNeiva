import { Request, Response } from "express";
import { pool } from "../config/db";
import bcrypt from "bcrypt";

export class AcademicController {
  
  static async getStudentsByParent(req: Request, res: Response) {
    const { padreId } = req.params;
    try {
      const result = await pool.query(
        `SELECT e.*, g.nivel as grado_nombre, g.seccion
         FROM estudiante e
         JOIN detalle_padrefamilia dp ON e.id_estudiante = dp.id_estudiante
         JOIN grados g ON e.id_grado = g.id_grado
         WHERE dp.id_padrefamilia = $1`,
        [padreId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener estudiantes" });
    }
  }

  static async getGrades(req: Request, res: Response) {
    const { studentId } = req.params;
    const { periodId } = req.query;
    try {
      const result = await pool.query(
        `SELECT v.*, m.nombre as materia_nombre
         FROM vw_notas_enriquecidas v
         JOIN materias m ON v.id_materia = m.id_materia
         WHERE v.id_estudiante = $1 AND v.id_periodo = $2`,
        [studentId, periodId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener notas" });
    }
  }

  static async getAttendance(req: Request, res: Response) {
    const { studentId } = req.params;
    const { periodId } = req.query;
    try {
      // Nota: Necesitamos filtrar por periodo, pero registro_asistencia no tiene id_periodo directamente.
      // Usaremos un filtro de fecha basado en el periodo si fuera necesario, 
      // pero por ahora traemos todas las del estudiante en ese detallegrado (asociado a sus materias)
      const result = await pool.query(
        `SELECT ra.*, m.nombre as materia_nombre
         FROM registro_asistencia ra
         JOIN detalle_grados dg ON ra.id_detallegrado = dg.id_detallegrado
         JOIN materias m ON dg.id_materia = m.id_materia
         WHERE ra.id_estudiante = $1
         ORDER BY ra.fecha DESC`,
        [studentId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener asistencia" });
    }
  }

  static async getObservations(req: Request, res: Response) {
    const { studentId } = req.params;
    const { periodId } = req.query;
    try {
      const result = await pool.query(
        `SELECT o.*, m.nombre as materia_nombre
         FROM observacion_estudiante o
         JOIN detalle_grados dg ON o.id_detallegrado = dg.id_detallegrado
         JOIN materias m ON dg.id_materia = m.id_materia
         WHERE o.id_estudiante = $1 AND o.id_periodo = $2`,
        [studentId, periodId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener observaciones" });
    }
  }

  static async updateEmail(req: Request, res: Response) {
    const { userId, newEmail, password } = req.body;
    try {
      // Verificar password primero
      const userRes = await pool.query("SELECT password FROM usuario WHERE id_usuario = $1", [userId]);
      if (userRes.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
      
      const validPass = await bcrypt.compare(password, userRes.rows[0].password);
      if (!validPass) return res.status(401).json({ message: "Contraseña incorrecta" });

      await pool.query("UPDATE usuario SET correo = $1 WHERE id_usuario = $2", [newEmail, userId]);
      res.json({ success: true, message: "Correo actualizado correctamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar correo" });
    }
  }

  static async getActivePeriods(req: Request, res: Response) {
    const { schoolId } = req.params;
    try {
      const result = await pool.query(
        "SELECT * FROM periodo_academico WHERE id_colegio = $1 ORDER BY id_periodo ASC",
        [schoolId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener periodos" });
    }
  }
}

