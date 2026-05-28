import { Request, Response } from "express";
import { pool } from "../config/db";

// Helper to check if period/class is editable (same logic as attendanceController)
const checkEditability = async (
  detailGradeId: number,
  schoolId: number,
  periodId: number
): Promise<{ editable: boolean; error?: string }> => {
  // 1. Check period is open
  const periodRes = await pool.query(
    `SELECT estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`,
    [periodId, schoolId]
  );

  if (periodRes.rows.length === 0) {
    return { editable: false, error: "Periodo académico no encontrado." };
  }

  if (periodRes.rows[0].estado !== "ABIERTO") {
    return {
      editable: false,
      error: "El periodo académico está cerrado. No se pueden modificar observaciones.",
    };
  }

  // 2. Check if subject is closed for this period
  const closureRes = await pool.query(
    `SELECT estado FROM cierre_materia WHERE id_detallegrado = $1 AND id_periodo = $2`,
    [detailGradeId, periodId]
  );

  if (closureRes.rows.length > 0 && closureRes.rows[0].estado === "CERRADO") {
    return {
      editable: false,
      error:
        "El docente ya marcó como completado el registro académico para esta materia en este periodo.",
    };
  }

  return { editable: true };
};

// Helper to check if a date falls within the period's trimester and dia_inicio/dia_fin range
const checkDateInPeriod = async (
  periodId: number,
  dateInput: string | Date
): Promise<{ valid: boolean; error?: string }> => {
  const periodRes = await pool.query(
    `SELECT trimestre, dia_inicio, dia_fin, "id_año" FROM periodo_academico WHERE id_periodo = $1`,
    [periodId]
  );

  if (periodRes.rows.length === 0) {
    return { valid: false, error: "Periodo académico no encontrado." };
  }

  const { trimestre, dia_inicio, dia_fin, id_año } = periodRes.rows[0];
  const year = id_año ? Number(id_año) : new Date().getFullYear();

  // Determine months based on trimestre
  let startMonth = 0; // Jan
  let endMonth = 2;   // Mar
  if (trimestre === 2) {
    startMonth = 3;   // Apr
    endMonth = 5;     // Jun
  } else if (trimestre === 3) {
    startMonth = 6;   // Jul
    endMonth = 11;    // Dec
  }

  const startDay = dia_inicio !== null ? Number(dia_inicio) : 1;
  const startDate = new Date(Date.UTC(year, startMonth, startDay, 0, 0, 0, 0));

  let endDate: Date;
  if (dia_fin !== null) {
    endDate = new Date(Date.UTC(year, endMonth, Number(dia_fin), 23, 59, 59, 999));
  } else {
    endDate = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));
  }

  const checkDate = new Date(dateInput);

  if (checkDate < startDate || checkDate > endDate) {
    const formatDateString = (d: Date) => {
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    return {
      valid: false,
      error: `La fecha de la observación (${formatDateString(checkDate)}) está fuera del rango de fechas permitido para este periodo académico (del ${formatDateString(startDate)} al ${formatDateString(endDate)}).`,
    };
  }

  return { valid: true };
};

// GET /api/teacher/observations/:detailGradeId/:periodId
export const getObservations = async (
  req: Request,
  res: Response
): Promise<void> => {
  const detailGradeId = Number(req.params.detailGradeId);
  const periodId = Number(req.params.periodId);

  try {
    // Get school id from teaching assignment
    const dgRes = await pool.query(
      `SELECT id_colegio, id_grupo FROM detalle_grados WHERE id_detallegrado = $1`,
      [detailGradeId]
    );

    if (dgRes.rows.length === 0) {
      res.status(404).json({ error: "Asignación académica no encontrada" });
      return;
    }

    const { id_colegio } = dgRes.rows[0];

    // Check editability
    const editCheck = await checkEditability(detailGradeId, id_colegio, periodId);

    // Get all observations for this detailGrade and period, joined with student info
    const observationsRes = await pool.query(
      `SELECT 
         o.id_observacion,
         o.id_estudiante,
         e.nombre,
         e.apellido,
         e.documento,
         e.codigo,
         o.fortalezas,
         o.debilidades,
         o.recomendaciones,
         o.fecha
       FROM observacion_estudiante o
       JOIN estudiante e ON e.id_estudiante = o.id_estudiante
       WHERE o.id_detallegrado = $1 AND o.id_periodo = $2
       ORDER BY o.fecha DESC`,
      [detailGradeId, periodId]
    );

    const observations = observationsRes.rows.map((r) => ({
      id_observacion: r.id_observacion,
      id_estudiante: r.id_estudiante,
      nombre: `${r.nombre} ${r.apellido}`,
      documento: r.documento,
      codigo: r.codigo,
      fortalezas: r.fortalezas || null,
      debilidades: r.debilidades || null,
      recomendaciones: r.recomendaciones || null,
      fecha: r.fecha,
    }));

    res.json({
      editable: editCheck.editable,
      error: editCheck.error,
      observations,
    });
  } catch (error: any) {
    console.error("Error fetching observations:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// POST /api/teacher/observations
export const createObservation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { detailGradeId, periodId, studentId, fortalezas, debilidades, recomendaciones, fecha } =
    req.body;

  if (!detailGradeId || !periodId || !studentId) {
    res.status(400).json({ error: "Parámetros obligatorios faltantes (grado, periodo, estudiante)." });
    return;
  }

  // Validate at least one observation field
  const hasFortalezas = fortalezas && fortalezas.trim().length > 0;
  const hasDebilidades = debilidades && debilidades.trim().length > 0;
  const hasRecomendaciones = recomendaciones && recomendaciones.trim().length > 0;

  if (!hasFortalezas && !hasDebilidades && !hasRecomendaciones) {
    res
      .status(400)
      .json({ error: "Rellene por lo menos un tipo de observación (fortalezas, debilidades o recomendaciones)." });
    return;
  }

  try {
    // Get school id
    const dgRes = await pool.query(
      `SELECT id_colegio FROM detalle_grados WHERE id_detallegrado = $1`,
      [detailGradeId]
    );

    if (dgRes.rows.length === 0) {
      res.status(404).json({ error: "Asignación académica no encontrada" });
      return;
    }

    const schoolId = dgRes.rows[0].id_colegio;

    // Validate editability
    const editCheck = await checkEditability(detailGradeId, schoolId, periodId);
    if (!editCheck.editable) {
      res.status(409).json({ error: editCheck.error });
      return;
    }

    const dateValue = fecha || new Date().toISOString();

    // Validate date falls within period range
    const dateCheck = await checkDateInPeriod(periodId, dateValue);
    if (!dateCheck.valid) {
      res.status(400).json({ error: dateCheck.error });
      return;
    }

    const result = await pool.query(
      `INSERT INTO observacion_estudiante 
         (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp with time zone, $8)
       RETURNING id_observacion`,
      [
        studentId,
        detailGradeId,
        periodId,
        hasFortalezas ? fortalezas.trim() : null,
        hasDebilidades ? debilidades.trim() : null,
        hasRecomendaciones ? recomendaciones.trim() : null,
        dateValue,
        schoolId,
      ]
    );

    res.json({
      message: "Observación registrada exitosamente",
      id_observacion: result.rows[0].id_observacion,
    });
  } catch (error: any) {
    console.error("Error creating observation:", error);
    res.status(500).json({ error: "Error al registrar la observación" });
  }
};

// PUT /api/teacher/observations/:id
export const updateObservation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const observationId = Number(req.params.id);
  const { fortalezas, debilidades, recomendaciones } = req.body;

  // Validate at least one observation field
  const hasFortalezas = fortalezas && fortalezas.trim().length > 0;
  const hasDebilidades = debilidades && debilidades.trim().length > 0;
  const hasRecomendaciones = recomendaciones && recomendaciones.trim().length > 0;

  if (!hasFortalezas && !hasDebilidades && !hasRecomendaciones) {
    res
      .status(400)
      .json({ error: "Rellene por lo menos un tipo de observación (fortalezas, debilidades o recomendaciones)." });
    return;
  }

  try {
    // Get current observation to check ownership
    const obsRes = await pool.query(
      `SELECT id_detallegrado, id_periodo, id_colegio FROM observacion_estudiante WHERE id_observacion = $1`,
      [observationId]
    );

    if (obsRes.rows.length === 0) {
      res.status(404).json({ error: "Observación no encontrada" });
      return;
    }

    const { id_detallegrado, id_periodo, id_colegio } = obsRes.rows[0];

    // Validate editability
    const editCheck = await checkEditability(id_detallegrado, id_colegio, id_periodo);
    if (!editCheck.editable) {
      res.status(409).json({ error: editCheck.error });
      return;
    }

    await pool.query(
      `UPDATE observacion_estudiante 
       SET fortalezas = $1, debilidades = $2, recomendaciones = $3
       WHERE id_observacion = $4`,
      [
        hasFortalezas ? fortalezas.trim() : null,
        hasDebilidades ? debilidades.trim() : null,
        hasRecomendaciones ? recomendaciones.trim() : null,
        observationId,
      ]
    );

    res.json({ message: "Observación actualizada exitosamente" });
  } catch (error: any) {
    console.error("Error updating observation:", error);
    res.status(500).json({ error: "Error al actualizar la observación" });
  }
};

// DELETE /api/teacher/observations/:id
export const deleteObservation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const observationId = Number(req.params.id);

  try {
    // Get current observation
    const obsRes = await pool.query(
      `SELECT id_detallegrado, id_periodo, id_colegio FROM observacion_estudiante WHERE id_observacion = $1`,
      [observationId]
    );

    if (obsRes.rows.length === 0) {
      res.status(404).json({ error: "Observación no encontrada" });
      return;
    }

    const { id_detallegrado, id_periodo, id_colegio } = obsRes.rows[0];

    // Validate editability
    const editCheck = await checkEditability(id_detallegrado, id_colegio, id_periodo);
    if (!editCheck.editable) {
      res.status(409).json({ error: editCheck.error });
      return;
    }

    await pool.query(
      `DELETE FROM observacion_estudiante WHERE id_observacion = $1`,
      [observationId]
    );

    res.json({ message: "Observación eliminada exitosamente" });
  } catch (error: any) {
    console.error("Error deleting observation:", error);
    res.status(500).json({ error: "Error al eliminar la observación" });
  }
};
