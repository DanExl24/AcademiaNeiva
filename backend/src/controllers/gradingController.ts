import { Request, Response } from "express";
import { pool } from "../config/db";
import {
  ensureCompetencyForContext,
  syncCompetencyAcrossGrade,
  TeachingContext,
} from "../config/competencyMigration";

const ensurePeriodOpen = async (periodId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT 1
     FROM periodo_academico
     WHERE id_periodo = $1
       AND estado = 'ABIERTO'`,
    [periodId]
  );

  return result.rows.length > 0;
};

const getCurrentAllowedPeriodForSchool = async (schoolId: number) => {
  const currentYearRes = await pool.query<{ id_año: number }>(
    `SELECT "id_año"
     FROM "año_lectivo"
     WHERE id_colegio = $1
     ORDER BY "id_año" DESC
     LIMIT 1`,
    [schoolId]
  );

  if (currentYearRes.rows.length === 0) {
    return null;
  }

  const periodsRes = await pool.query<{
    id_periodo: number;
    nombre: string;
    estado: "ABIERTO" | "CERRADO";
    porcentaje: number;
    id_año: number;
    trimestre: number | null;
    dia_inicio: number | null;
    dia_fin: number | null;
  }>(
    `SELECT id_periodo, nombre, estado, porcentaje, "id_año", trimestre, dia_inicio, dia_fin
     FROM periodo_academico
     WHERE id_colegio = $1
       AND "id_año" = $2
       AND estado = 'ABIERTO'
     ORDER BY id_periodo
     LIMIT 1`,
    [schoolId, Number(currentYearRes.rows[0].id_año)]
  );

  return periodsRes.rows[0] ?? null;
};

const ensureCurrentPeriodForSchool = async (schoolId: number, periodId: number): Promise<boolean> => {
  const currentPeriod = await getCurrentAllowedPeriodForSchool(schoolId);
  return Boolean(currentPeriod && Number(currentPeriod.id_periodo) === periodId);
};

const ensureCurrentPeriodOrRespond = async (
  res: Response,
  schoolId: number,
  periodId: number
): Promise<boolean> => {
  const currentPeriod = await getCurrentAllowedPeriodForSchool(schoolId);

  if (!currentPeriod) {
    res.status(409).json({ error: "No hay un periodo académico actual configurado para este colegio" });
    return false;
  }

  if (Number(currentPeriod.id_periodo) !== periodId) {
    res.status(409).json({
      error: `Solo está habilitado el periodo actual: ${currentPeriod.nombre}`,
      currentPeriod,
    });
    return false;
  }

  return true;
};

const resolveTeachingContext = async (
  gradeId: number,
  subjectId: number,
  periodId: number,
  userId?: number
): Promise<TeachingContext | null> => {
  const params: Array<number> = [gradeId, subjectId, periodId];
  let teacherFilter = "";

  if (typeof userId === "number" && !Number.isNaN(userId)) {
    teacherFilter = "AND d.id_usuario = $4";
    params.push(userId);
  }

  const result = await pool.query<TeachingContext>(
    `SELECT
       dg.id_detallegrado AS "idDetalleGrado",
       dg.id_grupo AS "idGrupo",
       dg.id_materia AS "idMateria",
       dg.id_colegio AS "idColegio",
       p."id_año" AS "idAnio"
     FROM detalle_grados dg
     JOIN periodo_academico p
       ON p.id_periodo = $3
      AND p.id_colegio = dg.id_colegio
     LEFT JOIN docente d ON dg.id_docente = d.id_docente
     WHERE dg.id_grupo = $1
       AND dg.id_materia = $2
       ${teacherFilter}
     LIMIT 1`,
    params
  );

  return result.rows[0] ?? null;
};

// Obtener periodos del colegio
export const getPeriods = async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.params;
  try {
    const currentPeriod = await getCurrentAllowedPeriodForSchool(Number(schoolId));
    res.json(currentPeriod ? [currentPeriod] : []);
  } catch (error: any) {
    console.error("Error fetching periods:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Obtener competencia y actividades de un curso/materia/periodo
export const getActivities = async (req: Request, res: Response): Promise<void> => {
  const gradeId = Number(req.params.gradeId);
  const subjectId = Number(req.params.subjectId);
  const periodId = Number(req.params.periodId);
  const userId = req.query.userId ? Number(req.query.userId) : undefined;

  try {
    const contextPreview = await resolveTeachingContext(gradeId, subjectId, periodId, userId);
    if (!contextPreview) {
      res.status(404).json({ error: "No se encontró la asignación académica" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, contextPreview.idColegio, periodId))) {
      return;
    }

    const context = contextPreview;

    const client = await pool.connect();
    try {
      const competencia = await ensureCompetencyForContext(client, context, periodId);
      const activities = await client.query(
        `SELECT *
         FROM actividad_materia
         WHERE id_competencia = $1
         ORDER BY id_actividadmateria ASC`,
        [competencia.id_competencia]
      );

      const evidencias = await client.query(
        `SELECT id_evidencia, descripcion, orden
         FROM evidencia_aprendizaje
         WHERE id_competencia = $1
         ORDER BY orden, id_evidencia`,
        [competencia.id_competencia]
      );

      const activityIds = activities.rows.map(a => a.id_actividadmateria);
      let criterios: any[] = [];
      if (activityIds.length > 0) {
        const critRes = await client.query(
          `SELECT * FROM criterio_evaluacion WHERE id_actividadmateria = ANY($1::int[]) ORDER BY id_criterio ASC`,
          [activityIds]
        );
        criterios = critRes.rows;
      }

      activities.rows.forEach(a => {
        a.criterios = criterios.filter(c => c.id_actividadmateria === a.id_actividadmateria);
      });

      res.json({
        competencia,
        activities: activities.rows,
        evidencias: evidencias.rows,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateCompetency = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { descripcion } = req.body;

  if (typeof descripcion !== "string" || !descripcion.trim()) {
    res.status(400).json({ error: "La descripción de la competencia es obligatoria" });
    return;
  }

  const client = await pool.connect();
  try {
    const periodRes = await client.query(
      `SELECT c.id_periodo, c.id_materia, c.id_grupo, c.id_año, c.id_colegio
       FROM competencias
       WHERE id_competencia = $1`,
      [id]
    );

    if (periodRes.rows.length === 0) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, Number(periodRes.rows[0].id_colegio), Number(periodRes.rows[0].id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(periodRes.rows[0].id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede modificar la competencia porque el periodo está cerrado" });
      return;
    }

    const context: TeachingContext = {
      idDetalleGrado: 0,
      idGrupo: Number(periodRes.rows[0].id_grupo),
      idMateria: Number(periodRes.rows[0].id_materia),
      idColegio: Number(periodRes.rows[0].id_colegio),
      idAnio: Number(periodRes.rows[0].id_año),
    };

    await client.query("BEGIN");
    const updated = await syncCompetencyAcrossGrade(
      client,
      context,
      Number(periodRes.rows[0].id_periodo),
      descripcion.trim()
    );
    await client.query("COMMIT");

    res.json(updated);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating competency:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

// Crear nueva actividad
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  const { id_competencia, nombre, porcentaje, id_colegio, id_evidencia } = req.body;

  if (!id_competencia) {
    res.status(400).json({ error: "La actividad debe estar asociada a una competencia" });
    return;
  }

  if (!id_evidencia) {
    res.status(400).json({ error: "La actividad debe estar asociada a una evidencia de aprendizaje" });
    return;
  }

  try {
    const competencyRes = await pool.query(
      "SELECT id_competencia, id_periodo, id_grupo, id_materia, id_colegio FROM competencias WHERE id_competencia = $1",
      [id_competencia]
    );

    if (competencyRes.rows.length === 0) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    const comp = competencyRes.rows[0];

    if (!(await ensureCurrentPeriodOrRespond(res, Number(comp.id_colegio), Number(comp.id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(comp.id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se pueden crear actividades porque el periodo está cerrado" });
      return;
    }

    // Resolver id_detallegrado desde el contexto de la competencia
    const dgRes = await pool.query(
      `SELECT id_detallegrado FROM detalle_grados
       WHERE id_grupo = $1 AND id_materia = $2 AND id_colegio = $3
       LIMIT 1`,
      [comp.id_grupo, comp.id_materia, comp.id_colegio]
    );
    const idDetalleGrado = dgRes.rows.length > 0 ? dgRes.rows[0].id_detallegrado : null;

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM actividad_materia
       WHERE id_competencia = $1`,
      [id_competencia]
    );

    const currentTotal = parseFloat(sumRes.rows[0].total || "0");
    if (currentTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({
        error: `La suma de porcentajes no puede exceder el 100%. Actual: ${currentTotal}%`,
      });
      return;
    }

    const newActivity = await pool.query(
      `INSERT INTO actividad_materia (id_competencia, id_evidencia, id_detallegrado, id_periodo, nombre, porcentaje, id_colegio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id_competencia, id_evidencia, idDetalleGrado, comp.id_periodo, nombre, porcentaje, id_colegio]
    );

    res.status(201).json(newActivity.rows[0]);
  } catch (error: any) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Actualizar actividad
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { nombre, porcentaje } = req.body;

  try {
    const currentActRes = await pool.query(
      `SELECT a.id_competencia, c.id_periodo
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`,
      [id]
    );

    if (currentActRes.rows.length === 0) {
      res.status(404).json({ error: "Actividad no encontrada" });
      return;
    }

    const schoolRes = await pool.query(
      `SELECT c.id_colegio
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`,
      [id]
    );

    if (!(await ensureCurrentPeriodOrRespond(res, Number(schoolRes.rows[0].id_colegio), Number(currentActRes.rows[0].id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(currentActRes.rows[0].id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado" });
      return;
    }

    const { id_competencia } = currentActRes.rows[0];
    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM actividad_materia
       WHERE id_competencia = $1
         AND id_actividadmateria != $2`,
      [id_competencia, id]
    );

    const otherTotal = parseFloat(sumRes.rows[0].total || "0");
    if (otherTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({
        error: `La suma de porcentajes no puede exceder el 100%. Otros: ${otherTotal}%`,
      });
      return;
    }

    const updated = await pool.query(
      `UPDATE actividad_materia
       SET nombre = $1, porcentaje = $2
       WHERE id_actividadmateria = $3
       RETURNING *`,
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
    const currentActRes = await pool.query(
      `SELECT c.id_periodo
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`,
      [id]
    );

    if (currentActRes.rows.length === 0) {
      res.status(404).json({ error: "Actividad no encontrada" });
      return;
    }

    const schoolRes = await pool.query(
      `SELECT c.id_colegio
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`,
      [id]
    );

    if (!(await ensureCurrentPeriodOrRespond(res, Number(schoolRes.rows[0].id_colegio), Number(currentActRes.rows[0].id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(currentActRes.rows[0].id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede eliminar la actividad porque el periodo está cerrado" });
      return;
    }

    await pool.query("DELETE FROM actividad_materia WHERE id_actividadmateria = $1", [id]);
    res.json({ message: "Actividad eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Crear nuevo criterio
export const createCriterion = async (req: Request, res: Response): Promise<void> => {
  const { id_actividadmateria, id_evidencia, descripcion, porcentaje, id_colegio } = req.body;

  if (!id_actividadmateria || !descripcion || !porcentaje || !id_colegio) {
    res.status(400).json({ error: "Faltan campos requeridos" });
    return;
  }

  try {
    const actRes = await pool.query(
      `SELECT a.id_competencia, c.id_periodo
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1 AND a.id_colegio = $2`,
      [id_actividadmateria, id_colegio]
    );

    if (actRes.rows.length === 0) {
      res.status(404).json({ error: "Actividad no encontrada" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, id_colegio, Number(actRes.rows[0].id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(actRes.rows[0].id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado" });
      return;
    }

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM criterio_evaluacion
       WHERE id_actividadmateria = $1`,
      [id_actividadmateria]
    );

    const currentTotal = parseFloat(sumRes.rows[0].total || "0");
    if (currentTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({
        error: `La suma de porcentajes de los criterios no puede exceder el 100%. Actual: ${currentTotal}%`,
      });
      return;
    }

    const newCrit = await pool.query(
      `INSERT INTO criterio_evaluacion (id_actividadmateria, id_evidencia, descripcion, porcentaje, id_colegio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id_actividadmateria, id_evidencia || null, descripcion, porcentaje, id_colegio]
    );

    res.status(201).json(newCrit.rows[0]);
  } catch (error: any) {
    console.error("Error creating criterion:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Eliminar criterio
export const deleteCriterion = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const critRes = await pool.query(
      `SELECT c.id_periodo, ce.id_colegio
       FROM criterio_evaluacion ce
       JOIN actividad_materia a ON a.id_actividadmateria = ce.id_actividadmateria
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE ce.id_criterio = $1`,
      [id]
    );

    if (critRes.rows.length === 0) {
      res.status(404).json({ error: "Criterio no encontrado" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, Number(critRes.rows[0].id_colegio), Number(critRes.rows[0].id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(critRes.rows[0].id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede eliminar el criterio porque el periodo está cerrado" });
      return;
    }

    await pool.query("DELETE FROM criterio_evaluacion WHERE id_criterio = $1", [id]);
    res.json({ message: "Criterio eliminado correctamente" });
  } catch (error: any) {
    console.error("Error deleting criterion:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Obtener todas las notas de un curso/periodo
export const getGrades = async (req: Request, res: Response): Promise<void> => {
  const gradeId = Number(req.params.gradeId);
  const subjectId = Number(req.params.subjectId);
  const periodId = Number(req.params.periodId);

  try {
    const context = await resolveTeachingContext(gradeId, subjectId, periodId);
    if (!context) {
      res.status(404).json({ error: "No se encontró la asignación académica" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, context.idColegio, periodId))) {
      return;
    }

    const grades = await pool.query(
      `SELECT n.*
       FROM notas_actividad n
       JOIN actividad_materia a ON n.id_actividadmateria = a.id_actividadmateria
       JOIN competencias c ON a.id_competencia = c.id_competencia
       WHERE c.id_grupo = $1
         AND c.id_materia = $2
         AND c.id_periodo = $3`,
      [gradeId, subjectId, periodId]
    );

    const criteriaGrades = await pool.query(
      `SELECT nc.*, ce.id_actividadmateria
       FROM nota_criterio nc
       JOIN criterio_evaluacion ce ON nc.id_criterio = ce.id_criterio
       JOIN actividad_materia a ON ce.id_actividadmateria = a.id_actividadmateria
       JOIN competencias c ON a.id_competencia = c.id_competencia
       WHERE c.id_grupo = $1
         AND c.id_materia = $2
         AND c.id_periodo = $3`,
      [gradeId, subjectId, periodId]
    );

    res.json({
      activityGrades: grades.rows,
      criteriaGrades: criteriaGrades.rows
    });
  } catch (error: any) {
    console.error("Error fetching grades:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const saveGrades = async (req: Request, res: Response): Promise<void> => {
  const { activityGrades = [], criteriaGrades = [], schoolId } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const activityIds = Array.from(
      new Set(
        (Array.isArray(activityGrades) ? activityGrades : [])
          .map((item) => Number(item.id_actividadmateria))
          .filter((value) => !Number.isNaN(value))
      )
    );

    const criteriaIds = Array.from(
      new Set(
        (Array.isArray(criteriaGrades) ? criteriaGrades : [])
          .map((item) => Number(item.id_criterio))
          .filter((value) => !Number.isNaN(value))
      )
    );

    if (activityIds.length === 0 && criteriaIds.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No hay notas válidas para guardar" });
      return;
    }

    let periodIds = new Set<number>();
    let colIds = new Set<number>();

    if (activityIds.length > 0) {
      const periodsRes = await client.query(
        `SELECT DISTINCT c.id_periodo, c.id_colegio
         FROM actividad_materia a
         JOIN competencias c ON c.id_competencia = a.id_competencia
         WHERE a.id_actividadmateria = ANY($1::int[])`,
        [activityIds]
      );
      periodsRes.rows.forEach(r => {
        periodIds.add(Number(r.id_periodo));
        colIds.add(Number(r.id_colegio));
      });
    }

    if (criteriaIds.length > 0) {
      const periodsRes = await client.query(
        `SELECT DISTINCT c.id_periodo, c.id_colegio
         FROM criterio_evaluacion ce
         JOIN actividad_materia a ON a.id_actividadmateria = ce.id_actividadmateria
         JOIN competencias c ON c.id_competencia = a.id_competencia
         WHERE ce.id_criterio = ANY($1::int[])`,
        [criteriaIds]
      );
      periodsRes.rows.forEach(r => {
        periodIds.add(Number(r.id_periodo));
        colIds.add(Number(r.id_colegio));
      });
    }

    for (const pId of Array.from(periodIds)) {
      for (const cId of Array.from(colIds)) {
        if (!(await ensureCurrentPeriodForSchool(cId, pId))) {
          await client.query("ROLLBACK");
          res.status(409).json({ error: "Solo se pueden guardar notas en el periodo académico actual" });
          return;
        }
      }
      
      const periodOpen = await ensurePeriodOpen(pId);
      if (!periodOpen) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: "No se pueden guardar notas porque el periodo está cerrado" });
        return;
      }
    }

    const escalaRes = await client.query(
      "SELECT id_escalavaloracion, valor_minimo, valor_maximo FROM escala_valoracion WHERE id_colegio = $1",
      [schoolId]
    );
    const escalas = escalaRes.rows;

    const settingsRes = await client.query(
      `SELECT nota_minima, nota_maxima
       FROM configuracion_colegio
       WHERE id_colegio = $1`,
      [schoolId]
    );

    const notaMinima = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].nota_minima) : 0;
    const notaMaxima = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].nota_maxima) : 5;

    // Guardar activityGrades
    for (const item of activityGrades) {
      const notaNum = Number(parseFloat(item.nota).toFixed(1));
      if (Number.isNaN(notaNum) || notaNum < notaMinima || notaNum > notaMaxima) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Todas las notas deben estar dentro del rango institucional ${notaMinima.toFixed(1)} - ${notaMaxima.toFixed(1)}`,
        });
        return;
      }

      const escala = escalas.find(
        (entry) =>
          notaNum >= parseFloat(entry.valor_minimo) &&
          notaNum <= parseFloat(entry.valor_maximo)
      );
      const idEscala =
        escala?.id_escalavaloracion ??
        escalas[escalas.length - 1]?.id_escalavaloracion;

      await client.query(
        `INSERT INTO notas_actividad (id_actividadmateria, id_estudiante, nota, id_escalavaloracion, id_colegio)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id_actividadmateria, id_estudiante)
         DO UPDATE SET nota = EXCLUDED.nota, id_escalavaloracion = EXCLUDED.id_escalavaloracion`,
        [item.id_actividadmateria, item.id_estudiante, notaNum, idEscala, schoolId]
      );
    }

    // Guardar criteriaGrades
    for (const item of criteriaGrades) {
      const notaNum = Number(parseFloat(item.nota).toFixed(1));
      if (Number.isNaN(notaNum) || notaNum < notaMinima || notaNum > notaMaxima) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Todas las notas deben estar dentro del rango institucional ${notaMinima.toFixed(1)} - ${notaMaxima.toFixed(1)}`,
        });
        return;
      }

      await client.query(
        `INSERT INTO nota_criterio (id_criterio, id_estudiante, nota, id_colegio)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_criterio, id_estudiante)
         DO UPDATE SET nota = EXCLUDED.nota`,
        [item.id_criterio, item.id_estudiante, notaNum, schoolId]
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
