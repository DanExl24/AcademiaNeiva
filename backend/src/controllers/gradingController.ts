import { Request, Response } from "express";
import { pool } from "../config/db";

// Obtener periodos del colegio
export const getPeriods = async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query(
      "SELECT id_periodo, nombre, estado, porcentaje FROM periodo_academico WHERE id_colegio = $1 ORDER BY id_periodo",
      [schoolId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching periods:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Obtener actividades de un curso/materia/periodo
export const getActivities = async (req: Request, res: Response): Promise<void> => {
  const { gradeId, subjectId, periodId } = req.params;
  const { userId } = req.query; // ID del usuario docente para validar

  try {
    // 1. Encontrar id_detallegrado
    const detalleRes = await pool.query(
      `SELECT id_detallegrado 
       FROM detalle_grados dg
       JOIN docente d ON dg.id_docente = d.id_docente
       WHERE dg.id_grupo = $1 AND dg.id_materia = $2 AND d.id_usuario = $3`,
      [gradeId, subjectId, userId]
    );

    if (detalleRes.rows.length === 0) {
      res.status(404).json({ error: "No se encontró la asignación académica" });
      return;
    }

    const idDetalleGrado = detalleRes.rows[0].id_detallegrado;

    // 2. Obtener actividades
    const activities = await pool.query(
      `SELECT * FROM actividad_materia 
       WHERE id_detallegrado = $1 AND id_periodo = $2
       ORDER BY id_actividadmateria ASC`,
      [idDetalleGrado, periodId]
    );

    res.json(activities.rows);
  } catch (error: any) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Crear nueva actividad
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  const { id_detallegrado, id_periodo, nombre, porcentaje, id_colegio } = req.body;

  try {
    // 1. Validar suma de porcentajes (Regla de negocio: no debe exceder 100%)
    const sumRes = await pool.query(
      `SELECT SUM(porcentaje) as total FROM actividad_materia 
       WHERE id_detallegrado = $1 AND id_periodo = $2`,
      [id_detallegrado, id_periodo]
    );

    const currentTotal = parseFloat(sumRes.rows[0].total || "0");
    if (currentTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({ error: `La suma de porcentajes no puede exceder el 100%. Actual: ${currentTotal}%` });
      return;
    }

    // 2. Insertar actividad
    const newActivity = await pool.query(
      `INSERT INTO actividad_materia (id_detallegrado, id_periodo, nombre, porcentaje, id_colegio)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id_detallegrado, id_periodo, nombre, porcentaje, id_colegio]
    );

    res.status(201).json(newActivity.rows[0]);
  } catch (error: any) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Actualizar actividad (incluyendo porcentaje)
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { nombre, porcentaje } = req.body;

  try {
    // 1. Obtener datos actuales para validación de suma
    const currentActRes = await pool.query("SELECT id_detallegrado, id_periodo, porcentaje FROM actividad_materia WHERE id_actividadmateria = $1", [id]);
    if (currentActRes.rows.length === 0) {
      res.status(404).json({ error: "Actividad no encontrada" });
      return;
    }

    const { id_detallegrado, id_periodo, porcentaje: oldPorcentaje } = currentActRes.rows[0];

    // 2. Validar nueva suma
    const sumRes = await pool.query(
      `SELECT SUM(porcentaje) as total FROM actividad_materia 
       WHERE id_detallegrado = $1 AND id_periodo = $2 AND id_actividadmateria != $3`,
      [id_detallegrado, id_periodo, id]
    );

    const otherTotal = parseFloat(sumRes.rows[0].total || "0");
    if (otherTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({ error: `La suma de porcentajes no puede exceder el 100%. Otros: ${otherTotal}%` });
      return;
    }

    // 3. Actualizar
    const updated = await pool.query(
      `UPDATE actividad_materia SET nombre = $1, porcentaje = $2 WHERE id_actividadmateria = $3 RETURNING *`,
      [nombre, porcentaje, id]
    );

    res.json(updated.rows[0]);
  } catch (error: any) {
    console.error("Error updating activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Eliminar actividad
export const deleteActivity = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Nota: El sistema debería validar si ya hay notas puestas antes de borrar, 
    // pero por ahora permitimos borrado en cascada o simple.
    await pool.query("DELETE FROM actividad_materia WHERE id_actividadmateria = $1", [id]);
    res.json({ message: "Actividad eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Obtener todas las notas de un curso/periodo
export const getGrades = async (req: Request, res: Response): Promise<void> => {
  const { gradeId, subjectId, periodId } = req.params;

  try {
    // 1. Obtener id_detallegrado
    const detalleRes = await pool.query(
      `SELECT id_detallegrado FROM detalle_grados dg 
       WHERE id_grupo = $1 AND id_materia = $2`,
      [gradeId, subjectId]
    );

    if (detalleRes.rows.length === 0) {
      res.status(404).json({ error: "Configuración académica no encontrada" });
      return;
    }

    const idDetalleGrado = detalleRes.rows[0].id_detallegrado;

    // 2. Obtener todas las notas de las actividades de este detallegrado y periodo
    const grades = await pool.query(
      `SELECT n.* 
       FROM notas_actividad n
       JOIN actividad_materia a ON n.id_actividadmateria = a.id_actividadmateria
       WHERE a.id_detallegrado = $1 AND a.id_periodo = $2`,
      [idDetalleGrado, periodId]
    );

    res.json(grades.rows);
  } catch (error: any) {
    console.error("Error fetching grades:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Guardar notas en lote (Upsert)
export const saveGrades = async (req: Request, res: Response): Promise<void> => {
  const { grades, schoolId } = req.body; // grades: [{id_estudiante, id_actividadmateria, nota}]

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Obtener escala de valoración del colegio para asignar automáticamente
    const escalaRes = await client.query(
      "SELECT id_escalavaloracion, valor_minimo, valor_maximo FROM escala_valoracion WHERE id_colegio = $1",
      [schoolId]
    );
    const escalas = escalaRes.rows;

    for (const item of grades) {
      const notaNum = parseFloat(item.nota);
      
      // Encontrar la escala que corresponde a esta nota
      const escala = escalas.find(e => notaNum >= parseFloat(e.valor_minimo) && notaNum <= parseFloat(e.valor_maximo));
      const idEscala = escala ? escala.id_escalavaloracion : escalas[escalas.length - 1]?.id_escalavaloracion;

      // UPSERT manual (PostgreSQL 9.5+)
      await client.query(
        `INSERT INTO notas_actividad (id_actividadmateria, id_estudiante, nota, id_escalavaloracion, id_colegio)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id_actividadmateria, id_estudiante) 
         DO UPDATE SET nota = EXCLUDED.nota, id_escalavaloracion = EXCLUDED.id_escalavaloracion`,
        [item.id_actividadmateria, item.id_estudiante, item.nota, idEscala, schoolId]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Notas guardadas correctamente" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error saving grades:", error);
    res.status(500).json({ error: "Error al guardar notas" });
  } finally {
    client.release();
  }
};
