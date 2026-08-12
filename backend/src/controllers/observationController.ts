import { Request, Response } from "express";
import { db } from "../config/kysely";
import { sql } from "kysely";

// Helper to check if period/class is editable
const checkEditability = async (
  detailGradeId: number,
  schoolId: number,
  periodId: number
): Promise<{ editable: boolean; error?: string }> => {
  // 1. Check period and academic year are open
  const periodRes = await db
    .selectFrom("periodo_academico as pa")
    .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
    .select(["pa.estado as periodo_estado", "al.estado as anio_estado"])
    .where("pa.id_periodo", "=", periodId)
    .where("pa.id_colegio", "=", schoolId)
    .executeTakeFirst();

  if (!periodRes) {
    return { editable: false, error: "Periodo académico no encontrado." };
  }

  const { periodo_estado, anio_estado } = periodRes;

  if (anio_estado === "CERRADO") {
    return {
      editable: false,
      error: "El año lectivo correspondiente se encuentra CERRADO. No se permiten modificaciones.",
    };
  }

  if (periodo_estado !== "ABIERTO") {
    const isPending = periodo_estado === "PENDIENTE";
    return {
      editable: false,
      error: isPending
        ? "El periodo académico está pendiente de aprobación. No se pueden registrar observaciones."
        : "El periodo académico está cerrado. No se pueden modificar observaciones.",
    };
  }

  // 2. Check if subject is closed for this period
  const closureRes = await db
    .selectFrom("cierre_materia")
    .select("estado")
    .where("id_detallegrado", "=", detailGradeId)
    .where("id_periodo", "=", periodId)
    .executeTakeFirst();

  if (closureRes && closureRes.estado === "CERRADO") {
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
  const periodRes = await db
    .selectFrom("periodo_academico")
    .select(["mes_inicio", "dia_inicio", "mes_fin", "dia_fin", "id_anio"])
    .where("id_periodo", "=", periodId)
    .executeTakeFirst();

  if (!periodRes) {
    return { valid: false, error: "Periodo académico no encontrado." };
  }

  const { mes_inicio, dia_inicio, mes_fin, dia_fin, id_anio } = periodRes;
  let year = id_anio ? Number(id_anio) : new Date().getFullYear();
  
  if (year < 2000) {
    year = new Date().getFullYear();
  }

  if (!mes_inicio || !dia_inicio || !mes_fin || !dia_fin) {
    return { valid: true }; 
  }

  const startDate = new Date(year, mes_inicio - 1, dia_inicio, 0, 0, 0);
  let endDate = new Date(year, mes_fin - 1, dia_fin, 23, 59, 59);

  // Si el fin es menor que el inicio, cruza el año
  if (endDate < startDate) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  const checkDate = new Date(dateInput);

  if (checkDate < startDate || checkDate > endDate) {
    const formatDateString = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    return {
      valid: false,
      error: `La fecha de la observación (${formatDateString(checkDate)}) está fuera del rango de fechas permitido para este periodo académico (del ${formatDateString(startDate)} al ${formatDateString(endDate)}).`,
    };
  }

  return { valid: true };
};

// GET /api/teacher/observations/types
export const getObservationTypes = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await sql<{ tipo: string }>`
      SELECT enumlabel AS tipo
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'tipo_observacion'
      ORDER BY e.enumsortorder ASC
    `.execute(db);

    const types = result.rows.map((r) => r.tipo);
    res.json({ types });
  } catch (error: any) {
    console.error("Error fetching observation types:", error);
    res.status(500).json({ error: "Error al obtener los tipos de observación" });
  }
};

// GET /api/teacher/observations/:detailGradeId/:periodId
export const getObservations = async (
  req: Request,
  res: Response
): Promise<void> => {
  const detailGradeId = Number(req.params.detailGradeId);
  const periodId = Number(req.params.periodId);
  console.log(`[DEV] getObservations called - detailGradeId=${detailGradeId}, periodId=${periodId}`);

  try {

    // Get school id from teaching assignment
    const dgRes = await db
      .selectFrom("detalle_grados")
      .select(["id_colegio", "id_grupo"])
      .where("id_detallegrado", "=", detailGradeId)
      .executeTakeFirst();

    if (!dgRes) {
      res.status(404).json({ error: "Asignación académica no encontrada" });
      return;
    }

    const { id_colegio } = dgRes;

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== id_colegio) {
      res.status(403).json({ error: "No tiene permiso para consultar observaciones de este colegio." });
      return;
    }

    // Check editability
    const editCheck = await checkEditability(detailGradeId, id_colegio, periodId);

    // Get all observations for this detailGrade and period, joined with student info
    const observationsRows = await db
      .selectFrom("observacion_estudiante as o")
      .innerJoin("estudiante as e", "e.id_estudiante", "o.id_estudiante")
      .leftJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .select([
        "o.id_observacion",
        "o.id_estudiante",
        "e.nombre",
        "e.apellido",
        "u.documento",
        "e.codigo",
        "o.fortalezas",
        "o.debilidades",
        "o.recomendaciones",
        "o.fecha",
        "o.tipo",
      ])
      .where("o.id_detallegrado", "=", detailGradeId)
      .where("o.id_periodo", "=", periodId)
      .orderBy("o.fecha", "desc")
      .execute();

    const observations = observationsRows.map((r) => {
      let clientTipo = 'ACADEMICA';
      if (r.tipo === 'DISCIPLINARIA') {
        clientTipo = 'DISCIPLINARIO';
      } else if (r.tipo === 'CONVIVENCIA') {
        clientTipo = 'CONVIVENCIAL';
      } else if (r.tipo) {
        clientTipo = r.tipo;
      }
      return {
        id_observacion: r.id_observacion,
        id_estudiante: r.id_estudiante,
        nombre: `${r.nombre} ${r.apellido}`,
        documento: r.documento,
        codigo: r.codigo,
        fortalezas: r.fortalezas || null,
        debilidades: r.debilidades || null,
        recomendaciones: r.recomendaciones || null,
        fecha: r.fecha,
        tipo: clientTipo,
      };
    });

    console.log(`[DEV] getObservations - editable=${editCheck.editable}, observations=${observations.length}, error=${editCheck.error || 'none'}`);
    res.json({
      editable: editCheck.editable,
      error: editCheck.error,
      observations,
    });
  } catch (error: any) {
    console.error(`[DEV] getObservations ERROR - detailGradeId=${detailGradeId}, periodId=${periodId}:`, error.message, error.detail || '');
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// POST /api/teacher/observations
export const createObservation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { detailGradeId, periodId, studentId, fortalezas, debilidades, recomendaciones, fecha, tipo } =
    req.body;
  console.log(`[DEV] createObservation called - detailGradeId=${detailGradeId}, periodId=${periodId}, studentId=${studentId}, tipo=${tipo}`);

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
    const dgRes = await db
      .selectFrom("detalle_grados")
      .select("id_colegio")
      .where("id_detallegrado", "=", detailGradeId)
      .executeTakeFirst();

    if (!dgRes) {
      res.status(404).json({ error: "Asignación académica no encontrada" });
      return;
    }

    const schoolId = dgRes.id_colegio;

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
      res.status(403).json({ error: "No tiene permiso para registrar observaciones en este colegio." });
      return;
    }

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

    let dbTipo = 'ACADEMICA';
    if (tipo === 'DISCIPLINARIO') {
      dbTipo = 'DISCIPLINARIA';
    } else if (tipo === 'CONVIVENCIAL' || tipo === 'CONVIVENCIA') {
      dbTipo = 'CONVIVENCIA';
    } else if (tipo === 'ACADEMICA') {
      dbTipo = 'ACADEMICA';
    } else if (tipo) {
      dbTipo = tipo;
    }

    const inserted = await db
      .insertInto("observacion_estudiante")
      .values({
        id_estudiante: studentId,
        id_detallegrado: detailGradeId,
        id_periodo: periodId,
        fortalezas: hasFortalezas ? fortalezas.trim() : null,
        debilidades: hasDebilidades ? debilidades.trim() : null,
        recomendaciones: hasRecomendaciones ? recomendaciones.trim() : null,
        fecha: dateValue,
        id_colegio: schoolId,
        tipo: dbTipo as any,
      })
      .returning("id_observacion")
      .executeTakeFirstOrThrow();

    res.json({
      message: "Observación registrada exitosamente",
      id_observacion: inserted.id_observacion,
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
  const { fortalezas, debilidades, recomendaciones, tipo } = req.body;

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
    const obsRes = await db
      .selectFrom("observacion_estudiante")
      .select(["id_detallegrado", "id_periodo", "id_colegio"])
      .where("id_observacion", "=", observationId)
      .executeTakeFirst();

    if (!obsRes) {
      res.status(404).json({ error: "Observación no encontrada" });
      return;
    }

    const { id_detallegrado, id_periodo, id_colegio } = obsRes;

    // Validate editability
    const editCheck = await checkEditability(id_detallegrado, id_colegio, id_periodo);
    if (!editCheck.editable) {
      res.status(409).json({ error: editCheck.error });
      return;
    }

    let dbTipo = 'ACADEMICA';
    if (tipo === 'DISCIPLINARIO') {
      dbTipo = 'DISCIPLINARIA';
    } else if (tipo === 'CONVIVENCIAL' || tipo === 'CONVIVENCIA') {
      dbTipo = 'CONVIVENCIA';
    } else if (tipo === 'ACADEMICA') {
      dbTipo = 'ACADEMICA';
    } else if (tipo) {
      dbTipo = tipo;
    }

    await db
      .updateTable("observacion_estudiante")
      .set({
        fortalezas: hasFortalezas ? fortalezas.trim() : null,
        debilidades: hasDebilidades ? debilidades.trim() : null,
        recomendaciones: hasRecomendaciones ? recomendaciones.trim() : null,
        tipo: dbTipo as any,
      })
      .where("id_observacion", "=", observationId)
      .execute();

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
    const obsRes = await db
      .selectFrom("observacion_estudiante")
      .select(["id_detallegrado", "id_periodo", "id_colegio"])
      .where("id_observacion", "=", observationId)
      .executeTakeFirst();

    if (!obsRes) {
      res.status(404).json({ error: "Observación no encontrada" });
      return;
    }

    const { id_detallegrado, id_periodo, id_colegio } = obsRes;

    // Validate editability
    const editCheck = await checkEditability(id_detallegrado, id_colegio, id_periodo);
    if (!editCheck.editable) {
      res.status(409).json({ error: editCheck.error });
      return;
    }

    await db
      .deleteFrom("observacion_estudiante")
      .where("id_observacion", "=", observationId)
      .execute();

    res.json({ message: "Observación eliminada exitosamente" });
  } catch (error: any) {
    console.error("Error deleting observation:", error);
    res.status(500).json({ error: "Error al eliminar la observación" });
  }
};
