import { Request, Response } from "express";
import { sql } from "kysely";
import { db } from "../config/kysely";
import { pool } from "../config/db";
import {
  ensureCompetencyForContext,
  syncCompetencyAcrossGrade,
  TeachingContext,
} from "../config/competencyMigration";

import {
  ensurePeriodOpen,
  ensureSubjectOpen,
  ensureCurrentPeriodForSchool,
  ensureCurrentPeriodOrRespond,
  getAllPeriodsForSchool,
} from "../utils/periodHelpers";

const resolveTeachingContext = async (
  gradeId: number,
  subjectId: number,
  periodId: number,
  userId?: number,
  allowAnyTeacher: boolean = false
): Promise<TeachingContext | null> => {
  let baseQuery = db
    .selectFrom("detalle_grados as dg")
    .innerJoin("periodo_academico as p", (join) =>
      join
        .onRef("p.id_colegio", "=", "dg.id_colegio")
        .onRef("p.id_anio", "=", "dg.id_anio")
        .on("p.id_periodo", "=", periodId)
    )
    .leftJoin("docente as d", "d.id_docente", "dg.id_docente")
    .where("dg.id_grupo", "=", gradeId)
    .where("dg.id_materia", "=", subjectId)
    .select([
      "dg.id_detallegrado as idDetalleGrado",
      "dg.id_grupo as idGrupo",
      "dg.id_materia as idMateria",
      "dg.id_colegio as idColegio",
      "p.id_anio as idAnio",
    ])
    .orderBy("dg.id_detallegrado", "desc")
    .limit(1);

  if (!allowAnyTeacher && typeof userId === "number" && !Number.isNaN(userId)) {
    const specificResult = await baseQuery.where("d.id_usuario", "=", userId).executeTakeFirst();
    if (specificResult && specificResult.idGrupo !== null && specificResult.idAnio !== null) {
      return {
        idDetalleGrado: specificResult.idDetalleGrado,
        idGrupo: specificResult.idGrupo,
        idMateria: specificResult.idMateria,
        idColegio: specificResult.idColegio,
        idAnio: specificResult.idAnio,
      };
    }
  }

  const result = await baseQuery.executeTakeFirst();
  if (!result || result.idGrupo === null || result.idAnio === null) {
    return null;
  }
  return {
    idDetalleGrado: result.idDetalleGrado,
    idGrupo: result.idGrupo,
    idMateria: result.idMateria,
    idColegio: result.idColegio,
    idAnio: result.idAnio,
  };
};

// Obtener periodos del colegio
export const getPeriods = async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.params;
  const authReq = req as any;
  const targetYearId = req.query.yearId
    ? Number(req.query.yearId)
    : (req.headers["x-academic-year-id"] ? Number(req.headers["x-academic-year-id"]) : (authReq.academicYearId ? Number(authReq.academicYearId) : undefined));
  const isSupervision = authReq.user && authReq.user.roles?.includes("admin_general");
  const userSchoolIds = (authReq.user?.schoolIds || []).map(Number);
  const targetId = Number(schoolId);
  const isAllowed =
    isSupervision ||
    (authReq.user?.schoolId && Number(authReq.user.schoolId) === targetId) ||
    userSchoolIds.includes(targetId);
  if (authReq.user && !isAllowed) {
    res.status(403).json({ error: "No tiene permiso para ver los periodos de este colegio." });
    return;
  }

  try {
    const periods = await getAllPeriodsForSchool(Number(schoolId), targetYearId);
    console.log(`[DEV] getPeriods - result count: ${periods.length}`);
    res.json(periods);
  } catch (error: any) {
    console.error(`[DEV] getPeriods ERROR - schoolId=${schoolId}:`, error.message, error.detail || "");
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Obtener competencia y actividades de un curso/materia/periodo
export const getActivities = async (req: Request, res: Response): Promise<void> => {
  const gradeId = Number(req.params.gradeId);
  const subjectId = Number(req.params.subjectId);
  const periodId = Number(req.params.periodId);
  const authReq = req as any;
  const isSupervision = authReq.user && (authReq.user.roles?.includes("admin_general") || authReq.user.roles?.includes("directivo"));
  const isMonitoring = req.headers['x-monitoring-mode'] === 'true' || req.headers['x-monitoring-mode'] === '1';
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  console.log(`[DEV] getActivities called - gradeId=${gradeId}, subjectId=${subjectId}, periodId=${periodId}, userId=${userId}`);

  if (Number.isNaN(gradeId) || Number.isNaN(subjectId) || Number.isNaN(periodId)) {
    res.status(400).json({ error: "Parámetros de consulta académicos no válidos" });
    return;
  }

  try {
    const contextPreview = await resolveTeachingContext(gradeId, subjectId, periodId, userId, isSupervision || isMonitoring);
    console.log(`[DEV] getActivities - resolveTeachingContext result: ${contextPreview ? JSON.stringify(contextPreview) : "null (not found)"}`);
    if (!contextPreview) {
      res.status(404).json({ error: "No se encontró la asignación académica" });
      return;
    }

    const context = contextPreview;
    const client = await pool.connect();
    try {
      const competenciaBase = await ensureCompetencyForContext(client, context, periodId);

      // Obtener todas las competencias del periodo/materia con sus evidencias anidadas y el número de DBA
      const allComps = await db
        .selectFrom("competencias as c")
        .where("c.id_anio", "=", context.idAnio)
        .where("c.id_grupo", "=", context.idGrupo)
        .where("c.id_materia", "=", context.idMateria)
        .where("c.id_periodo", "=", periodId)
        .where("c.id_colegio", "=", context.idColegio)
        .selectAll("c")
        .select((eb) => [
          eb.fn
            .coalesce(
              eb
                .selectFrom("evidencia_aprendizaje as ea")
                .leftJoin("evidencias_dba as edba", "edba.id_evidencia_dba", "ea.id_evidencia_dba")
                .leftJoin("dba as d", "d.id_dba", "edba.id_dba")
                .whereRef("ea.id_competencia", "=", "c.id_competencia")
                .select(
                  sql<any>`json_agg(
                     json_build_object(
                       'id_evidencia', ea.id_evidencia,
                       'id_evidencia_dba', ea.id_evidencia_dba,
                       'descripcion', ea.descripcion,
                       'orden', ea.orden,
                       'numero_dba', d.numero_dba
                     ) ORDER BY ea.orden, ea.id_evidencia
                   )`.as("evidencias")
                ),
              sql<any>`'[]'::json`
            )
            .as("evidencias"),
        ])
        .orderBy("c.id_competencia", "asc")
        .execute();

      // Filtrar competencias que tengan descripciones válidas (no vacías)
      const validComps = allComps.filter((c) => c.descripcion && c.descripcion.trim());

      // Unificar descripciones de las competencias
      let competencia = competenciaBase;
      if (competenciaBase && validComps.length > 1) {
        const descripcionUnificada = validComps
          .map((c, idx) => `${idx + 1}. ${c.descripcion!.trim()}`)
          .join("\n\n");
        competencia = {
          ...competenciaBase,
          descripcion: descripcionUnificada,
        };
      }

      const rawActivities = await db
        .selectFrom("actividad_materia as am")
        .where("am.id_detallegrado", "=", context.idDetalleGrado)
        .where("am.id_periodo", "=", periodId)
        .selectAll("am")
        .select((eb) => [
          eb.fn
            .coalesce(
              eb
                .selectFrom("actividad_evidencia_dba as aedba")
                .whereRef("aedba.id_actividadmateria", "=", "am.id_actividadmateria")
                .select(sql<any>`json_agg(aedba.id_evidencia_dba)`.as("evidencias_dba")),
              sql<any>`'[]'::json`
            )
            .as("evidencias_dba"),
        ])
        .orderBy("am.id_actividadmateria", "asc")
        .execute();

      // Traer las evidencias de aprendizaje de todas las competencias de este periodo
      const evidencias = await db
        .selectFrom("evidencia_aprendizaje as ea")
        .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
        .where("c.id_anio", "=", context.idAnio)
        .where("c.id_grupo", "=", context.idGrupo)
        .where("c.id_materia", "=", context.idMateria)
        .where("c.id_periodo", "=", periodId)
        .where("c.id_colegio", "=", context.idColegio)
        .select(["ea.id_evidencia", "ea.descripcion", "ea.orden"])
        .orderBy("c.id_competencia", "asc")
        .orderBy("ea.orden", "asc")
        .orderBy("ea.id_evidencia", "asc")
        .execute();

      const activityIds = rawActivities.map((a) => a.id_actividadmateria);
      let criterios: any[] = [];
      if (activityIds.length > 0) {
        criterios = await db
          .selectFrom("criterio_evaluacion")
          .where("id_actividadmateria", "in", activityIds)
          .selectAll()
          .orderBy("id_criterio", "asc")
          .execute();
      }

      const activities = rawActivities.map((a) => ({
        ...a,
        criterios: criterios.filter((c) => c.id_actividadmateria === a.id_actividadmateria),
      }));

      res.json({
        competencia,
        activities,
        evidencias,
        competenciasList: validComps,
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

  try {
    const periodRes = await db
      .selectFrom("competencias as c")
      .where("c.id_competencia", "=", Number(id))
      .select(["c.id_periodo", "c.id_materia", "c.id_grupo", "c.id_anio", "c.id_colegio"])
      .executeTakeFirst();

    if (!periodRes) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    const periodStatusRes = await db
      .selectFrom("periodo_academico")
      .where("id_periodo", "=", Number(periodRes.id_periodo))
      .select("estado")
      .executeTakeFirst();

    if (periodStatusRes && periodStatusRes.estado === "CERRADO") {
      res.status(409).json({ error: "No se puede modificar la competencia porque el periodo está cerrado institucionalmente" });
      return;
    }

    const dgRes = await db
      .selectFrom("detalle_grados")
      .where("id_grupo", "=", periodRes.id_grupo)
      .where("id_materia", "=", periodRes.id_materia)
      .where("id_colegio", "=", periodRes.id_colegio)
      .select("id_detallegrado")
      .limit(1)
      .executeTakeFirst();

    if (dgRes && !(await ensureSubjectOpen(dgRes.id_detallegrado, Number(periodRes.id_periodo)))) {
      res.status(409).json({ error: "No se puede modificar la competencia porque ya has cerrado esta materia para este periodo" });
      return;
    }

    const context: TeachingContext = {
      idDetalleGrado: 0,
      idGrupo: Number(periodRes.id_grupo),
      idMateria: Number(periodRes.id_materia),
      idColegio: Number(periodRes.id_colegio),
      idAnio: Number(periodRes.id_anio),
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await syncCompetencyAcrossGrade(
        client,
        context,
        Number(periodRes.id_periodo),
        descripcion.trim(),
        Number(id)
      );
      await client.query("COMMIT");
      res.json(updated);
    } catch (error: any) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error updating competency:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const isTeacherMutationBlocked = (req: Request): boolean => {
  const authReq = req as any;
  const isMonitoring = req.headers["x-monitoring-mode"] === "true" || req.headers["x-monitoring-mode"] === "1";
  const userRoles = authReq.user?.roles || [];
  const userRole = authReq.user?.role;
  const isDirectivoOnly = (userRoles.includes("directivo") || userRole === "directivo" || userRoles.includes("rector") || userRoles.includes("coordinador")) && !userRoles.includes("docente");
  const isAdminGeneral = userRoles.includes("admin_general") || userRole === "admin_general";
  return isMonitoring || isDirectivoOnly || isAdminGeneral;
};

// Crear nueva actividad
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  if (isTeacherMutationBlocked(req)) {
    res.status(403).json({ error: "Los directivos o usuarios en modo monitoreo no pueden crear actividades" });
    return;
  }

  const { id_competencia, id_detallegrado, id_periodo, nombre, porcentaje, id_colegio, id_evidencia, evidencias_dba, motivo_extra, justificacion_extra } = req.body;

  if (!id_evidencia && (!Array.isArray(evidencias_dba) || evidencias_dba.length === 0)) {
    res.status(400).json({ error: "La actividad debe estar asociada a una evidencia de aprendizaje" });
    return;
  }

  try {
    let finalIdPeriodo = id_periodo ? Number(id_periodo) : null;
    let finalIdDetalleGrado = id_detallegrado ? Number(id_detallegrado) : null;
    let finalIdColegio = id_colegio ? Number(id_colegio) : null;
    const finalIdCompetencia = id_competencia ? Number(id_competencia) : null;

    if (finalIdCompetencia) {
      const comp = await db
        .selectFrom("competencias")
        .where("id_competencia", "=", finalIdCompetencia)
        .select(["id_competencia", "id_periodo", "id_grupo", "id_materia", "id_colegio"])
        .executeTakeFirst();

      if (!comp) {
        res.status(404).json({ error: "Competencia no encontrada" });
        return;
      }

      if (!finalIdPeriodo) finalIdPeriodo = Number(comp.id_periodo);
      if (!finalIdColegio) finalIdColegio = Number(comp.id_colegio);

      // Resolver id_detallegrado desde el contexto de la competencia y el id_anio del periodo
      if (!finalIdDetalleGrado) {
        const dgRes = await db
          .selectFrom("detalle_grados as dg")
          .innerJoin("periodo_academico as p", (join) =>
            join
              .onRef("p.id_colegio", "=", "dg.id_colegio")
              .onRef("p.id_anio", "=", "dg.id_anio")
              .on("p.id_periodo", "=", finalIdPeriodo!)
          )
          .where("dg.id_grupo", "=", comp.id_grupo)
          .where("dg.id_materia", "=", comp.id_materia)
          .where("dg.id_colegio", "=", comp.id_colegio)
          .select("dg.id_detallegrado")
          .orderBy("dg.id_detallegrado", "desc")
          .limit(1)
          .executeTakeFirst();
        finalIdDetalleGrado = dgRes?.id_detallegrado ?? null;
      }
    }

    if (finalIdDetalleGrado && finalIdPeriodo) {
      const alignDgRes = await db
        .selectFrom("detalle_grados as dg1")
        .innerJoin("periodo_academico as p", (join) => join.on("p.id_periodo", "=", finalIdPeriodo!))
        .innerJoin("detalle_grados as dg2", (join) =>
          join
            .onRef("dg2.id_grupo", "=", "dg1.id_grupo")
            .onRef("dg2.id_materia", "=", "dg1.id_materia")
            .onRef("dg2.id_colegio", "=", "dg1.id_colegio")
            .onRef("dg2.id_anio", "=", "p.id_anio")
        )
        .where("dg1.id_detallegrado", "=", finalIdDetalleGrado)
        .select("dg2.id_detallegrado")
        .limit(1)
        .executeTakeFirst();

      if (alignDgRes) {
        finalIdDetalleGrado = alignDgRes.id_detallegrado;
      }
    }

    if (!finalIdPeriodo || !finalIdDetalleGrado || !finalIdColegio) {
      res.status(400).json({ error: "Faltan datos de asignación académica (periodo, grado/materia)" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, finalIdColegio, finalIdPeriodo))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(finalIdPeriodo);
    if (!periodOpen) {
      res.status(409).json({ error: "No se pueden crear actividades porque el periodo está cerrado" });
      return;
    }

    if (finalIdDetalleGrado && !(await ensureSubjectOpen(finalIdDetalleGrado, finalIdPeriodo))) {
      res.status(409).json({ error: "No se pueden crear actividades porque ya has cerrado esta materia para este periodo" });
      return;
    }

    const sumRes = await db
      .selectFrom("actividad_materia")
      .where("id_detallegrado", "=", finalIdDetalleGrado)
      .where("id_periodo", "=", finalIdPeriodo)
      .select((eb) => eb.fn.coalesce(eb.fn.sum<string>("porcentaje"), sql<string>`'0'`).as("total"))
      .executeTakeFirst();

    const currentTotal = parseFloat(sumRes?.total || "0");
    if (currentTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({
        error: `La suma de porcentajes no puede exceder el 100%. Actual: ${currentTotal}%`,
      });
      return;
    }

    // Validar si la evidencia es de otro periodo / extra y requiere justificación
    if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0) {
      const dgInfo = await db
        .selectFrom("detalle_grados")
        .where("id_detallegrado", "=", finalIdDetalleGrado)
        .select(["id_grupo", "id_materia"])
        .executeTakeFirst();

      if (dgInfo) {
        const { id_grupo, id_materia } = dgInfo;

        // 1. Obtener evidencias planificadas en el periodo ACTUAL para este grado/materia
        const currentPeriodAssigned = await db
          .selectFrom("evidencia_aprendizaje as ea")
          .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
          .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
          .where("c.id_colegio", "=", finalIdColegio)
          .where("p.id_anio", "=", (eb) =>
            eb.selectFrom("periodo_academico").where("id_periodo", "=", finalIdPeriodo!).select("id_anio")
          )
          .where("c.id_materia", "=", id_materia)
          .where("c.id_grupo", "in", (eb) =>
            eb
              .selectFrom("grupos as g1")
              .innerJoin("grupos as g2", (join) =>
                join.onRef("g2.id_nivel", "=", "g1.id_nivel").onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
              )
              .where("g1.id_grupo", "=", id_grupo)
              .where("g1.id_colegio", "=", finalIdColegio)
              .select("g2.id_grupo")
          )
          .where("c.id_periodo", "=", finalIdPeriodo)
          .where("ea.id_evidencia_dba", "in", evidencias_dba)
          .select("ea.id_evidencia_dba")
          .distinct()
          .execute();

        const plannedInCurrentIds = new Set(currentPeriodAssigned.map((r) => Number(r.id_evidencia_dba)));
        const unassignedInCurrent = evidencias_dba.filter((id: number) => !plannedInCurrentIds.has(Number(id)));

        // 2. Si hay evidencias NO planificadas en el periodo actual (extras), exigir motivo y justificación
        if (unassignedInCurrent.length > 0) {
          if (!motivo_extra || typeof motivo_extra !== "string" || !motivo_extra.trim()) {
            res.status(400).json({ error: "Debes seleccionar un motivo para evaluar evidencias extra o no planificadas en este periodo." });
            return;
          }
          if (motivo_extra === "OTRO" && (!justificacion_extra || typeof justificacion_extra !== "string" || !justificacion_extra.trim())) {
            res.status(400).json({ error: "Debes escribir una justificación detallada para el motivo 'Otro'." });
            return;
          }
        }
      }
    }

    // Resolver id_evidencia para compatibilidad con código antiguo
    let finalIdEvidencia = id_evidencia ? Number(id_evidencia) : null;
    if (!finalIdEvidencia && Array.isArray(evidencias_dba) && evidencias_dba.length > 0 && finalIdCompetencia) {
      const localEvRes = await db
        .selectFrom("evidencia_aprendizaje")
        .where("id_competencia", "=", finalIdCompetencia)
        .where("id_evidencia_dba", "=", evidencias_dba[0])
        .select("id_evidencia")
        .limit(1)
        .executeTakeFirst();
      if (localEvRes) {
        finalIdEvidencia = localEvRes.id_evidencia;
      }
    }

    const dgTeacherRes = await db
      .selectFrom("detalle_grados")
      .where("id_detallegrado", "=", finalIdDetalleGrado)
      .select("id_docente")
      .executeTakeFirst();
    const creatorTeacherId = dgTeacherRes?.id_docente ?? null;

    const newActivity = await db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto("actividad_materia")
        .values({
          id_competencia: finalIdCompetencia,
          id_evidencia: finalIdEvidencia,
          id_detallegrado: finalIdDetalleGrado,
          id_periodo: finalIdPeriodo,
          nombre,
          porcentaje,
          id_colegio: finalIdColegio!,
          motivo_extra: motivo_extra || null,
          justificacion_extra: justificacion_extra || null,
          id_docente_creador: creatorTeacherId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Vincular evidencias del DBA si vienen especificadas
      if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0) {
        for (const dbaEvId of evidencias_dba) {
          await trx
            .insertInto("actividad_evidencia_dba")
            .values({
              id_actividadmateria: inserted.id_actividadmateria,
              id_evidencia_dba: dbaEvId,
            })
            .onConflict((oc) => oc.doNothing())
            .execute();
        }
      }

      return inserted;
    });
    (newActivity as any).evidencias_dba = evidencias_dba || [];
    res.status(201).json(newActivity);
  } catch (error: any) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Actualizar actividad
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  if (isTeacherMutationBlocked(req)) {
    res.status(403).json({ error: "Los directivos o usuarios en modo monitoreo no pueden modificar actividades" });
    return;
  }

  const { id } = req.params;
  const { nombre, porcentaje, id_evidencia, evidencias_dba, motivo_extra, justificacion_extra } = req.body;

  try {
    const currentAct = await db
      .selectFrom("actividad_materia")
      .where("id_actividadmateria", "=", Number(id))
      .select(["id_competencia", "id_evidencia", "id_periodo", "id_detallegrado", "id_colegio", "motivo_extra", "justificacion_extra"])
      .executeTakeFirst();

    if (!currentAct) {
      res.status(404).json({ error: "Actividad no encontrada" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, Number(currentAct.id_colegio), Number(currentAct.id_periodo)))) {
      return;
    }

    const periodOpen = await db
      .selectFrom("periodo_academico")
      .where("id_periodo", "=", Number(currentAct.id_periodo))
      .select("estado")
      .executeTakeFirst();

    if (periodOpen && periodOpen.estado === "CERRADO") {
      res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado institucionalmente" });
      return;
    }

    if (currentAct.id_detallegrado && !(await ensureSubjectOpen(currentAct.id_detallegrado, Number(currentAct.id_periodo)))) {
      res.status(409).json({ error: "No se puede modificar la actividad porque ya has cerrado esta materia para este periodo" });
      return;
    }

    const sumRes = await db
      .selectFrom("actividad_materia")
      .where("id_detallegrado", "=", currentAct.id_detallegrado)
      .where("id_periodo", "=", currentAct.id_periodo)
      .where("id_actividadmateria", "!=", Number(id))
      .select((eb) => eb.fn.coalesce(eb.fn.sum<string>("porcentaje"), sql<string>`'0'`).as("total"))
      .executeTakeFirst();

    const otherTotal = parseFloat(sumRes?.total || "0");
    if (otherTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({
        error: `La suma de porcentajes no puede exceder el 100%. Otros: ${otherTotal}%`,
      });
      return;
    }

    // Validar si la evidencia es de otro periodo y requiere justificación
    if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0 && currentAct.id_detallegrado) {
      const dgInfo = await db
        .selectFrom("detalle_grados")
        .where("id_detallegrado", "=", currentAct.id_detallegrado)
        .select(["id_grupo", "id_materia"])
        .executeTakeFirst();

      if (dgInfo) {
        const { id_grupo, id_materia } = dgInfo;

        // 1. Obtener evidencias planificadas en el periodo ACTUAL para este grado/materia
        const currentPeriodAssigned = await db
          .selectFrom("evidencia_aprendizaje as ea")
          .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
          .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
          .where("c.id_colegio", "=", currentAct.id_colegio)
          .where("p.id_anio", "=", (eb) =>
            eb.selectFrom("periodo_academico").where("id_periodo", "=", currentAct.id_periodo!).select("id_anio")
          )
          .where("c.id_materia", "=", id_materia)
          .where("c.id_grupo", "in", (eb) =>
            eb
              .selectFrom("grupos as g1")
              .innerJoin("grupos as g2", (join) =>
                join.onRef("g2.id_nivel", "=", "g1.id_nivel").onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
              )
              .where("g1.id_grupo", "=", id_grupo)
              .where("g1.id_colegio", "=", currentAct.id_colegio)
              .select("g2.id_grupo")
          )
          .where("c.id_periodo", "=", currentAct.id_periodo)
          .where("ea.id_evidencia_dba", "in", evidencias_dba)
          .select("ea.id_evidencia_dba")
          .distinct()
          .execute();

        const plannedInCurrentIds = new Set(currentPeriodAssigned.map((r) => Number(r.id_evidencia_dba)));
        const unassignedInCurrent = evidencias_dba.filter((dbaId: number) => !plannedInCurrentIds.has(Number(dbaId)));

        // 2. Si hay evidencias NO planificadas en el periodo actual (extras), exigir motivo y justificación
        if (unassignedInCurrent.length > 0) {
          const checkMotivo = motivo_extra !== undefined ? motivo_extra : currentAct.motivo_extra;
          const checkJustificacion = justificacion_extra !== undefined ? justificacion_extra : currentAct.justificacion_extra;
          if (!checkMotivo || typeof checkMotivo !== "string" || !checkMotivo.trim()) {
            res.status(400).json({ error: "Debes seleccionar un motivo para evaluar evidencias extra o no planificadas en este periodo." });
            return;
          }
          if (checkMotivo === "OTRO" && (!checkJustificacion || typeof checkJustificacion !== "string" || !checkJustificacion.trim())) {
            res.status(400).json({ error: "Debes escribir una justificación detallada para el motivo 'Otro'." });
            return;
          }
        }
      }
    }

    // Resolver id_evidencia para compatibilidad con código antiguo
    let finalIdEvidencia = id_evidencia ? Number(id_evidencia) : currentAct.id_evidencia;
    if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0 && currentAct.id_competencia) {
      const localEvRes = await db
        .selectFrom("evidencia_aprendizaje")
        .where("id_competencia", "=", currentAct.id_competencia)
        .where("id_evidencia_dba", "=", evidencias_dba[0])
        .select("id_evidencia")
        .limit(1)
        .executeTakeFirst();
      if (localEvRes) {
        finalIdEvidencia = localEvRes.id_evidencia;
      } else {
        finalIdEvidencia = null;
      }
    } else if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0 && !currentAct.id_competencia) {
      finalIdEvidencia = null;
    }

    const finalMotivoExtra = motivo_extra !== undefined ? (motivo_extra || null) : currentAct.motivo_extra;
    const finalJustificacionExtra = justificacion_extra !== undefined ? (justificacion_extra || null) : currentAct.justificacion_extra;

    const updatedActivity = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable("actividad_materia")
        .set({
          nombre,
          porcentaje,
          id_evidencia: finalIdEvidencia,
          motivo_extra: finalMotivoExtra,
          justificacion_extra: finalJustificacionExtra,
        })
        .where("id_actividadmateria", "=", Number(id))
        .returningAll()
        .executeTakeFirstOrThrow();

      // Sincronizar evidencias del DBA si vienen en la petición
      if (Array.isArray(evidencias_dba)) {
        await trx
          .deleteFrom("actividad_evidencia_dba")
          .where("id_actividadmateria", "=", Number(id))
          .execute();

        for (const dbaEvId of evidencias_dba) {
          await trx
            .insertInto("actividad_evidencia_dba")
            .values({
              id_actividadmateria: Number(id),
              id_evidencia_dba: dbaEvId,
            })
            .onConflict((oc) => oc.doNothing())
            .execute();
        }
      }

      return updated;
    });

    const finalDbaEvsRes = await db
      .selectFrom("actividad_evidencia_dba")
      .where("id_actividadmateria", "=", Number(id))
      .select("id_evidencia_dba")
      .execute();
    (updatedActivity as any).evidencias_dba = finalDbaEvsRes.map((r) => r.id_evidencia_dba);

    res.json(updatedActivity);
  } catch (error: any) {
    console.error("Error updating activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Eliminar actividad
export const deleteActivity = async (req: Request, res: Response): Promise<void> => {
  if (isTeacherMutationBlocked(req)) {
    res.status(403).json({ error: "Los directivos o usuarios en modo monitoreo no pueden eliminar actividades" });
    return;
  }

  const { id } = req.params;

  try {
    const currentAct = await db
      .selectFrom("actividad_materia")
      .where("id_actividadmateria", "=", Number(id))
      .select(["id_periodo", "id_colegio", "id_detallegrado"])
      .executeTakeFirst();

    if (!currentAct) {
      res.status(404).json({ error: "Actividad no encontrada" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, Number(currentAct.id_colegio), Number(currentAct.id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(currentAct.id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede eliminar la actividad porque el periodo está cerrado institucionalmente" });
      return;
    }

    if (currentAct.id_detallegrado && !(await ensureSubjectOpen(currentAct.id_detallegrado, Number(currentAct.id_periodo)))) {
      res.status(409).json({ error: "No se puede eliminar la actividad porque ya has cerrado esta materia para este periodo" });
      return;
    }

    await db.deleteFrom("actividad_materia").where("id_actividadmateria", "=", Number(id)).execute();
    res.json({ message: "Actividad eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting activity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Crear nuevo criterio
export const createCriterion = async (req: Request, res: Response): Promise<void> => {
  if (isTeacherMutationBlocked(req)) {
    res.status(403).json({ error: "Los directivos o usuarios en modo monitoreo no pueden crear criterios" });
    return;
  }

  const { id_actividadmateria, id_evidencia, descripcion, porcentaje, id_colegio } = req.body;

  if (!id_actividadmateria || !descripcion || !porcentaje || !id_colegio) {
    res.status(400).json({ error: "Faltan campos requeridos" });
    return;
  }

  try {
    const actRes = await db
      .selectFrom("actividad_materia as a")
      .leftJoin("competencias as c", "c.id_competencia", "a.id_competencia")
      .where("a.id_actividadmateria", "=", Number(id_actividadmateria))
      .where("a.id_colegio", "=", Number(id_colegio))
      .select(["a.id_competencia", "a.id_periodo", "a.id_detallegrado"])
      .executeTakeFirst();

    if (!actRes) {
      res.status(404).json({ error: "Actividad no encontrada" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, Number(id_colegio), Number(actRes.id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(actRes.id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado institucionalmente" });
      return;
    }

    if (actRes.id_detallegrado && !(await ensureSubjectOpen(actRes.id_detallegrado, Number(actRes.id_periodo)))) {
      res.status(409).json({ error: "No se puede agregar criterios porque ya has cerrado esta materia para este periodo" });
      return;
    }

    const sumRes = await db
      .selectFrom("criterio_evaluacion")
      .where("id_actividadmateria", "=", Number(id_actividadmateria))
      .select((eb) => eb.fn.coalesce(eb.fn.sum<string>("porcentaje"), sql<string>`'0'`).as("total"))
      .executeTakeFirst();

    const currentTotal = parseFloat(sumRes?.total || "0");
    if (currentTotal + parseFloat(porcentaje) > 100) {
      res.status(400).json({
        error: `La suma de porcentajes de los criterios no puede exceder el 100%. Actual: ${currentTotal}%`,
      });
      return;
    }

    const newCrit = await db
      .insertInto("criterio_evaluacion")
      .values({
        id_actividadmateria: Number(id_actividadmateria),
        id_evidencia: id_evidencia || null,
        descripcion,
        porcentaje,
        id_colegio: Number(id_colegio),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    res.status(201).json(newCrit);
  } catch (error: any) {
    console.error("Error creating criterion:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// Eliminar criterio
export const deleteCriterion = async (req: Request, res: Response): Promise<void> => {
  if (isTeacherMutationBlocked(req)) {
    res.status(403).json({ error: "Los directivos o usuarios en modo monitoreo no pueden eliminar criterios" });
    return;
  }

  const { id } = req.params;

  try {
    const critRes = await db
      .selectFrom("criterio_evaluacion as ce")
      .innerJoin("actividad_materia as a", "a.id_actividadmateria", "ce.id_actividadmateria")
      .where("ce.id_criterio", "=", Number(id))
      .select(["a.id_periodo", "ce.id_colegio", "a.id_detallegrado"])
      .executeTakeFirst();

    if (!critRes) {
      res.status(404).json({ error: "Criterio no encontrado" });
      return;
    }

    if (!(await ensureCurrentPeriodOrRespond(res, Number(critRes.id_colegio), Number(critRes.id_periodo)))) {
      return;
    }

    const periodOpen = await ensurePeriodOpen(Number(critRes.id_periodo));
    if (!periodOpen) {
      res.status(409).json({ error: "No se puede eliminar el criterio porque el periodo está cerrado institucionalmente" });
      return;
    }

    if (critRes.id_detallegrado && !(await ensureSubjectOpen(critRes.id_detallegrado, Number(critRes.id_periodo)))) {
      res.status(409).json({ error: "No se puede eliminar el criterio porque ya has cerrado esta materia para este periodo" });
      return;
    }

    await db.deleteFrom("criterio_evaluacion").where("id_criterio", "=", Number(id)).execute();
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

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles?.includes("admin_general");
    const userSchoolIds = (authReq.user?.schoolIds || []).map(Number);
    const targetId = Number(context.idColegio);
    const isAllowed =
      isSupervision ||
      (authReq.user?.schoolId && Number(authReq.user.schoolId) === targetId) ||
      userSchoolIds.includes(targetId);
    if (authReq.user && !isAllowed) {
      res.status(403).json({ error: "No tiene permiso para ver las calificaciones de este colegio." });
      return;
    }

    // Traer notas de actividades directas
    const grades = await db
      .selectFrom("notas_actividad as na")
      .innerJoin("actividad_materia as a", "a.id_actividadmateria", "na.id_actividadmateria")
      .where("a.id_detallegrado", "=", context.idDetalleGrado)
      .where("a.id_periodo", "=", periodId)
      .selectAll("na")
      .execute();

    // Traer notas de criterios
    const criteriaGrades = await db
      .selectFrom("nota_criterio as nc")
      .innerJoin("criterio_evaluacion as ce", "ce.id_criterio", "nc.id_criterio")
      .innerJoin("actividad_materia as a", "a.id_actividadmateria", "ce.id_actividadmateria")
      .where("a.id_detallegrado", "=", context.idDetalleGrado)
      .where("a.id_periodo", "=", periodId)
      .selectAll("nc")
      .select("ce.id_actividadmateria")
      .execute();

    res.json({
      activityGrades: grades,
      criteriaGrades: criteriaGrades,
    });
  } catch (error: any) {
    console.error("Error fetching grades:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const saveGrades = async (req: Request, res: Response): Promise<void> => {
  if (isTeacherMutationBlocked(req)) {
    res.status(403).json({ error: "Los directivos o usuarios en modo monitoreo no pueden registrar calificaciones" });
    return;
  }

  const { activityGrades = [], criteriaGrades = [], schoolId } = req.body;

  try {
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
      res.status(400).json({ error: "No hay notas válidas para guardar" });
      return;
    }

    const periodIds = new Set<number>();
    const colIds = new Set<number>();

    if (activityIds.length > 0) {
      const periodsRes = await db
        .selectFrom("actividad_materia as a")
        .where("a.id_actividadmateria", "in", activityIds)
        .select(["a.id_periodo", "a.id_colegio"])
        .distinct()
        .execute();
      periodsRes.forEach((r) => {
        if (r.id_periodo) periodIds.add(Number(r.id_periodo));
        if (r.id_colegio) colIds.add(Number(r.id_colegio));
      });
    }

    if (criteriaIds.length > 0) {
      const periodsRes = await db
        .selectFrom("criterio_evaluacion as ce")
        .innerJoin("actividad_materia as a", "a.id_actividadmateria", "ce.id_actividadmateria")
        .where("ce.id_criterio", "in", criteriaIds)
        .select(["a.id_periodo", "a.id_colegio"])
        .distinct()
        .execute();
      periodsRes.forEach((r) => {
        if (r.id_periodo) periodIds.add(Number(r.id_periodo));
        if (r.id_colegio) colIds.add(Number(r.id_colegio));
      });
    }

    for (const pId of Array.from(periodIds)) {
      for (const cId of Array.from(colIds)) {
        if (!(await ensureCurrentPeriodForSchool(cId, pId))) {
          res.status(409).json({ error: "Solo se pueden guardar notas en el periodo académico actual" });
          return;
        }
      }

      const periodOpen = await ensurePeriodOpen(pId);
      if (!periodOpen) {
        res.status(409).json({ error: "No se pueden guardar notas porque el periodo está cerrado institucionalmente" });
        return;
      }

      // Lock por cierre de docente
      const actAssignments = activityIds.length > 0
        ? await db
            .selectFrom("actividad_materia")
            .where("id_actividadmateria", "in", activityIds)
            .where("id_detallegrado", "is not", null)
            .select("id_detallegrado")
            .distinct()
            .execute()
        : [];
      const critAssignments = criteriaIds.length > 0
        ? await db
            .selectFrom("criterio_evaluacion as ce")
            .innerJoin("actividad_materia as am", "am.id_actividadmateria", "ce.id_actividadmateria")
            .where("ce.id_criterio", "in", criteriaIds)
            .where("am.id_detallegrado", "is not", null)
            .select("am.id_detallegrado")
            .distinct()
            .execute()
        : [];

      const combinedAssignments = Array.from(
        new Set([...actAssignments.map((a) => a.id_detallegrado!), ...critAssignments.map((c) => c.id_detallegrado!)])
      );

      for (const detailGradeId of combinedAssignments) {
        if (!(await ensureSubjectOpen(detailGradeId, pId))) {
          res.status(409).json({ error: "No se pueden guardar notas porque ya has cerrado la materia para este periodo" });
          return;
        }
      }
    }

    const escalas = await db
      .selectFrom("escala_valoracion")
      .where("id_colegio", "=", Number(schoolId))
      .select(["id_escalavaloracion", "valor_minimo", "valor_maximo"])
      .execute();

    const settingsRes = await db
      .selectFrom("configuracion_colegio")
      .where("id_colegio", "=", Number(schoolId))
      .select(["nota_minima", "nota_maxima"])
      .executeTakeFirst();

    const notaMinima = settingsRes ? Number(settingsRes.nota_minima) : 0;
    const notaMaxima = settingsRes ? Number(settingsRes.nota_maxima) : 5;

    // Validar que todos los estudiantes a calificar tengan matrícula ACTIVA en el colegio
    const studentIds = Array.from(
      new Set([
        ...activityGrades.map((a: any) => Number(a.id_estudiante)),
        ...criteriaGrades.map((c: any) => Number(c.id_estudiante)),
      ])
    ).filter((id) => !isNaN(id) && id > 0);

    if (studentIds.length > 0) {
      const activeEnrollments = await db
        .selectFrom("matricula")
        .select("id_estudiante")
        .where("id_estudiante", "in", studentIds)
        .where("id_colegio", "=", Number(schoolId))
        .where("estado", "in", ["ACTIVA", "APROBADA"])
        .execute();

      const activeSet = new Set(activeEnrollments.map((e) => Number(e.id_estudiante)));
      const invalidStudents = studentIds.filter((id) => !activeSet.has(id));

      if (invalidStudents.length > 0) {
        const namesRes = await db
          .selectFrom("estudiante")
          .select(["nombre", "apellido"])
          .where("id_estudiante", "in", invalidStudents)
          .execute();
        const namesStr = namesRes.map((r) => `${r.nombre} ${r.apellido}`).join(", ");
        res.status(409).json({
          error: `No es posible registrar calificaciones. Los siguientes estudiantes no poseen matrícula activa en esta institución (trasladados o inactivos): ${namesStr}`,
        });
        return;
      }
    }

    await db.transaction().execute(async (trx) => {
      // Guardar activityGrades
      for (const item of activityGrades) {
        const notaNum = Number(parseFloat(item.nota).toFixed(1));
        if (Number.isNaN(notaNum) || notaNum < notaMinima || notaNum > notaMaxima) {
          throw new Error(`Todas las notas deben estar dentro del rango institucional ${notaMinima.toFixed(1)} - ${notaMaxima.toFixed(1)}`);
        }

        const escala = escalas.find(
          (entry) =>
            notaNum >= parseFloat(entry.valor_minimo) &&
            notaNum <= parseFloat(entry.valor_maximo)
        );
        const idEscala =
          escala?.id_escalavaloracion ??
          escalas[escalas.length - 1]?.id_escalavaloracion ??
          null;

        await trx
          .insertInto("notas_actividad")
          .values({
            id_actividadmateria: Number(item.id_actividadmateria),
            id_estudiante: Number(item.id_estudiante),
            nota: notaNum,
            id_escalavaloracion: idEscala,
            id_colegio: Number(schoolId),
          })
          .onConflict((oc) =>
            oc.columns(["id_actividadmateria", "id_estudiante"]).doUpdateSet({
              nota: sql`EXCLUDED.nota`,
              id_escalavaloracion: sql`EXCLUDED.id_escalavaloracion`,
            })
          )
          .execute();
      }

      // Guardar criteriaGrades
      const touchedActivities = new Set<number>();
      for (const item of criteriaGrades) {
        const notaNum = Number(parseFloat(item.nota).toFixed(1));
        if (Number.isNaN(notaNum) || notaNum < notaMinima || notaNum > notaMaxima) {
          throw new Error(`Todas las notas deben estar dentro del rango institucional ${notaMinima.toFixed(1)} - ${notaMaxima.toFixed(1)}`);
        }

        await trx
          .insertInto("nota_criterio")
          .values({
            id_criterio: Number(item.id_criterio),
            id_estudiante: Number(item.id_estudiante),
            nota: notaNum,
            id_colegio: Number(schoolId),
          })
          .onConflict((oc) =>
            oc.columns(["id_criterio", "id_estudiante"]).doUpdateSet({
              nota: sql`EXCLUDED.nota`,
            })
          )
          .execute();

        const actRes = await trx
          .selectFrom("criterio_evaluacion")
          .where("id_criterio", "=", Number(item.id_criterio))
          .select("id_actividadmateria")
          .executeTakeFirst();
        if (actRes) {
          touchedActivities.add(actRes.id_actividadmateria);
        }
      }

      // Sincronizar notas_actividad para actividades con criterios modificados
      for (const actId of touchedActivities) {
        const studentsRes = await trx
          .selectFrom("nota_criterio as nc")
          .innerJoin("criterio_evaluacion as ce", "ce.id_criterio", "nc.id_criterio")
          .where("ce.id_actividadmateria", "=", actId)
          .select("nc.id_estudiante")
          .distinct()
          .execute();

        for (const st of studentsRes) {
          const studentId = st.id_estudiante;
          const calcRes = await trx
            .selectFrom("criterio_evaluacion as ce")
            .leftJoin("nota_criterio as nc", (join) =>
              join.onRef("nc.id_criterio", "=", "ce.id_criterio").on("nc.id_estudiante", "=", studentId)
            )
            .where("ce.id_actividadmateria", "=", actId)
            .select([
              (eb) => eb.fn.count<string>("ce.id_criterio").as("total_criterios"),
              (eb) => eb.fn.count<string>("nc.id_nota_criterio").as("calificados"),
              (eb) => eb.fn.sum<string>("ce.porcentaje").as("total_peso"),
              (eb) => eb.fn.sum<string>(sql`nc.nota * ce.porcentaje`).as("suma_ponderada"),
            ])
            .executeTakeFirst();

          if (calcRes) {
            const { total_criterios, calificados, total_peso, suma_ponderada } = calcRes;
            if (Number(total_criterios) > 0 && Number(total_criterios) === Number(calificados) && Number(total_peso) > 0) {
              const notaPonderada = Number((Number(suma_ponderada) / Number(total_peso)).toFixed(1));

              const escala = escalas.find(
                (entry) =>
                  notaPonderada >= parseFloat(entry.valor_minimo) &&
                  notaPonderada <= parseFloat(entry.valor_maximo)
              );
              const idEscala =
                escala?.id_escalavaloracion ??
                escalas[escalas.length - 1]?.id_escalavaloracion ??
                null;

              await trx
                .insertInto("notas_actividad")
                .values({
                  id_actividadmateria: actId,
                  id_estudiante: studentId,
                  nota: notaPonderada,
                  id_escalavaloracion: idEscala,
                  id_colegio: Number(schoolId),
                })
                .onConflict((oc) =>
                  oc.columns(["id_actividadmateria", "id_estudiante"]).doUpdateSet({
                    nota: sql`EXCLUDED.nota`,
                    id_escalavaloracion: sql`EXCLUDED.id_escalavaloracion`,
                  })
                )
                .execute();
            }
          }
        }
      }
    });

    res.json({ message: "Notas guardadas correctamente" });
  } catch (error: any) {
    console.error("Error saving grades:", error);
    res.status(error.message?.includes("rango institucional") ? 400 : 500).json({
      error: error.message || "Error al guardar notas",
    });
  }
};

export const getClosureStatus = async (req: Request, res: Response): Promise<void> => {
  const detailGradeId = Number(req.params.detailGradeId);
  const periodId = Number(req.params.periodId);

  try {
    const closedRes = await db
      .selectFrom("cierre_materia as cm")
      .leftJoin("docente as d", "d.id_docente", "cm.id_docente_cierre")
      .where("cm.id_detallegrado", "=", detailGradeId)
      .where("cm.id_periodo", "=", periodId)
      .select([
        "cm.estado",
        "cm.fecha_cierre",
        sql<string>`d.nombre || ' ' || d.apellido`.as("docente_cierre_nombre"),
        "cm.id_docente_cierre",
      ])
      .executeTakeFirst();

    const isClosed = closedRes ? closedRes.estado === "CERRADO" : false;

    // También verificamos si faltan alumnos por calificar (soporta tanto notas directas como notas por criterios)
    const students = await db
      .selectFrom("estudiante as e")
      .innerJoin("matricula as m", "m.id_estudiante", "e.id_estudiante")
      .innerJoin("detalle_grados as dg", "dg.id_grupo", "m.id_grupo")
      .where("dg.id_detallegrado", "=", detailGradeId)
      .where("m.estado", "=", "ACTIVA")
      .select(["e.id_estudiante", "e.nombre", "e.apellido"])
      .execute();

    const missingGrades = [];
    for (const student of students) {
      const gradeCheck = await db
        .selectFrom("actividad_materia as am")
        .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
        .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
        .where("dg.id_detallegrado", "=", detailGradeId)
        .where("c.id_periodo", "=", periodId)
        .where((eb) =>
          eb.or([
            eb.and([
              eb.not(
                eb.exists(
                  eb.selectFrom("criterio_evaluacion as ce").whereRef("ce.id_actividadmateria", "=", "am.id_actividadmateria").select(sql`1`.as("one"))
                )
              ),
              eb.not(
                eb.exists(
                  eb.selectFrom("notas_actividad as na")
                    .whereRef("na.id_actividadmateria", "=", "am.id_actividadmateria")
                    .where("na.id_estudiante", "=", student.id_estudiante)
                    .select(sql`1`.as("one"))
                )
              ),
            ]),
            eb.and([
              eb.exists(
                eb.selectFrom("criterio_evaluacion as ce").whereRef("ce.id_actividadmateria", "=", "am.id_actividadmateria").select(sql`1`.as("one"))
              ),
              eb.exists(
                eb.selectFrom("criterio_evaluacion as ce")
                  .whereRef("ce.id_actividadmateria", "=", "am.id_actividadmateria")
                  .where((eb2) =>
                    eb2.not(
                      eb2.exists(
                        eb2.selectFrom("nota_criterio as nc")
                          .whereRef("nc.id_criterio", "=", "ce.id_criterio")
                          .where("nc.id_estudiante", "=", student.id_estudiante)
                          .select(sql`1`.as("one"))
                      )
                    )
                  )
                  .select(sql`1`.as("one"))
              ),
            ]),
          ])
        )
        .select((eb) => eb.fn.count<string>("am.id_actividadmateria").as("count"))
        .executeTakeFirst();

      const count = Number(gradeCheck?.count || 0);
      if (count > 0) {
        missingGrades.push({
          id_estudiante: student.id_estudiante,
          nombre: `${student.nombre} ${student.apellido}`,
          missing_count: count,
        });
      }
    }

    // Calcular suma de porcentajes y conteo de actividades
    const statsRes = await db
      .selectFrom("actividad_materia as am")
      .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
      .where("am.id_detallegrado", "=", detailGradeId)
      .where("c.id_periodo", "=", periodId)
      .select([
        (eb) => eb.fn.coalesce(eb.fn.sum<string>("am.porcentaje"), sql<string>`'0'`).as("total_percentage"),
        (eb) => eb.fn.count<string>("am.id_actividadmateria").as("activity_count"),
      ])
      .executeTakeFirst();

    const totalPercentage = Number(statsRes?.total_percentage || 0);
    const activityCount = Number(statsRes?.activity_count || 0);

    // Calcular promedio grupal actual (soporta notas directas y notas de criterios)
    let groupAverage = null;
    if (activityCount > 0) {
      const avgRes = await db
        .selectFrom(
          db
            .selectFrom("estudiante as est")
            .innerJoin("matricula as m", "m.id_estudiante", "est.id_estudiante")
            .innerJoin("detalle_grados as dg", "dg.id_grupo", "m.id_grupo")
            .innerJoin("actividad_materia as am", "am.id_detallegrado", "dg.id_detallegrado")
            .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
            .leftJoin("notas_actividad as na", (join) =>
              join.onRef("na.id_actividadmateria", "=", "am.id_actividadmateria").onRef("na.id_estudiante", "=", "est.id_estudiante")
            )
            .where("dg.id_detallegrado", "=", detailGradeId)
            .where("c.id_periodo", "=", periodId)
            .where("m.estado", "=", "ACTIVA")
            .groupBy("est.id_estudiante")
            .select((eb) =>
              eb.fn
                .sum(
                  sql`COALESCE(
                    na.nota,
                    (
                      SELECT SUM(nc.nota * (ce.porcentaje / 100))
                      FROM nota_criterio nc
                      JOIN criterio_evaluacion ce ON ce.id_criterio = nc.id_criterio
                      WHERE ce.id_actividadmateria = am.id_actividadmateria
                        AND nc.id_estudiante = est.id_estudiante
                    )
                  ) * (am.porcentaje / 100)`
                )
                .as("promedio_estudiante")
            )
            .as("promedios")
        )
        .select((eb) => eb.fn.avg<string>("promedio_estudiante").as("group_avg"))
        .executeTakeFirst();

      groupAverage = avgRes?.group_avg ? Number(Number(avgRes.group_avg).toFixed(2)) : null;
    }

    res.json({
      isClosed,
      closureData: closedRes || null,
      missingGrades,
      totalPercentage,
      activityCount,
      groupAverage,
    });
  } catch (error: any) {
    console.error("Error getting closure status:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const closeTeacherSubject = async (req: Request, res: Response): Promise<void> => {
  const { detailGradeId, periodId, justificacion_evidencias_pendientes } = req.body;
  const userId = (req as any).user.id;

  try {
    // 1. Obtener docente a partir de su id_usuario
    const docRes = await db
      .selectFrom("docente")
      .where("id_usuario", "=", Number(userId))
      .select("id_docente")
      .executeTakeFirst();

    if (!docRes) {
      res.status(403).json({ error: "No tienes perfil de docente" });
      return;
    }

    const teacherId = docRes.id_docente;

    // 2. Verificar que este id_detallegrado pertenece al docente
    const dgRes = await db
      .selectFrom("detalle_grados")
      .where("id_detallegrado", "=", Number(detailGradeId))
      .where("id_docente", "=", teacherId)
      .select(["id_grupo", "id_materia", "id_colegio"])
      .executeTakeFirst();

    if (!dgRes) {
      res.status(403).json({ error: "No tienes asignada esta materia" });
      return;
    }

    // 3. Verificar que el periodo institucional NO esté CERRADO (administrador)
    const periodRes = await db
      .selectFrom("periodo_academico")
      .where("id_periodo", "=", Number(periodId))
      .select("estado")
      .executeTakeFirst();

    if (!periodRes) {
      res.status(404).json({ error: "Periodo no encontrado" });
      return;
    }

    if (periodRes.estado === "CERRADO") {
      res.status(400).json({ error: "El periodo ya fue cerrado institucionalmente por el administrador." });
      return;
    }

    // 4. Verificar si la materia YA FUE CERRADA por el docente
    const existingClosure = await db
      .selectFrom("cierre_materia")
      .where("id_detallegrado", "=", Number(detailGradeId))
      .where("id_periodo", "=", Number(periodId))
      .select("id_cierremateria")
      .executeTakeFirst();

    if (existingClosure) {
      res.status(400).json({ error: "Ya has cerrado esta materia para este periodo." });
      return;
    }

    // 5. Validar que todos los estudiantes activos tengan todas las notas
    const students = await db
      .selectFrom("estudiante as e")
      .innerJoin("matricula as m", "m.id_estudiante", "e.id_estudiante")
      .innerJoin("detalle_grados as dg", "dg.id_grupo", "m.id_grupo")
      .where("dg.id_detallegrado", "=", Number(detailGradeId))
      .where("m.estado", "=", "ACTIVA")
      .select("e.id_estudiante")
      .execute();

    for (const student of students) {
      const gradeCheck = await db
        .selectFrom("actividad_materia as am")
        .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
        .where("am.id_detallegrado", "=", Number(detailGradeId))
        .where("c.id_periodo", "=", Number(periodId))
        .where((eb) =>
          eb.or([
            eb.and([
              eb.not(
                eb.exists(
                  eb.selectFrom("criterio_evaluacion as ce").whereRef("ce.id_actividadmateria", "=", "am.id_actividadmateria").select(sql`1`.as("one"))
                )
              ),
              eb.not(
                eb.exists(
                  eb.selectFrom("notas_actividad as na")
                    .whereRef("na.id_actividadmateria", "=", "am.id_actividadmateria")
                    .where("na.id_estudiante", "=", student.id_estudiante)
                    .select(sql`1`.as("one"))
                )
              ),
            ]),
            eb.and([
              eb.exists(
                eb.selectFrom("criterio_evaluacion as ce").whereRef("ce.id_actividadmateria", "=", "am.id_actividadmateria").select(sql`1`.as("one"))
              ),
              eb.exists(
                eb.selectFrom("criterio_evaluacion as ce")
                  .whereRef("ce.id_actividadmateria", "=", "am.id_actividadmateria")
                  .where((eb2) =>
                    eb2.not(
                      eb2.exists(
                        eb2.selectFrom("nota_criterio as nc")
                          .whereRef("nc.id_criterio", "=", "ce.id_criterio")
                          .where("nc.id_estudiante", "=", student.id_estudiante)
                          .select(sql`1`.as("one"))
                      )
                    )
                  )
                  .select(sql`1`.as("one"))
              ),
            ]),
          ])
        )
        .select((eb) => eb.fn.count<string>("am.id_actividadmateria").as("count"))
        .executeTakeFirst();

      if (Number(gradeCheck?.count || 0) > 0) {
        res.status(400).json({ error: "Existen estudiantes con actividades sin calificar" });
        return;
      }
    }

    // 5.1 Verificar si hay evidencias DBA planeadas para este periodo/materia que no fueron evaluadas en ninguna actividad
    const { id_grupo, id_materia, id_colegio } = dgRes;
    const unevaluatedEvidences = await db
      .selectFrom("evidencia_aprendizaje as ea")
      .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
      .innerJoin("evidencias_dba as edba", "edba.id_evidencia_dba", "ea.id_evidencia_dba")
      .innerJoin("dba as d", "d.id_dba", "edba.id_dba")
      .where("c.id_colegio", "=", id_colegio)
      .where("c.id_materia", "=", id_materia)
      .where("c.id_grupo", "in", (eb) =>
        eb
          .selectFrom("grupos as g1")
          .innerJoin("grupos as g2", (join) =>
            join.onRef("g2.id_nivel", "=", "g1.id_nivel").onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
          )
          .where("g1.id_grupo", "=", id_grupo)
          .where("g1.id_colegio", "=", id_colegio)
          .select("g2.id_grupo")
      )
      .where("c.id_periodo", "=", Number(periodId))
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("actividad_evidencia_dba as aedba")
              .innerJoin("actividad_materia as am", "am.id_actividadmateria", "aedba.id_actividadmateria")
              .whereRef("aedba.id_evidencia_dba", "=", "edba.id_evidencia_dba")
              .where("am.id_detallegrado", "=", Number(detailGradeId))
              .where("am.id_periodo", "=", Number(periodId))
              .select(sql`1`.as("one"))
          )
        )
      )
      .select(["edba.id_evidencia_dba", "d.numero_dba", "edba.descripcion"])
      .distinct()
      .execute();

    if (
      unevaluatedEvidences.length > 0 &&
      (!justificacion_evidencias_pendientes ||
        typeof justificacion_evidencias_pendientes !== "string" ||
        !justificacion_evidencias_pendientes.trim())
    ) {
      res.status(422).json({
        requires_justification: true,
        unevaluated_evidences: unevaluatedEvidences,
        error: `Existen ${unevaluatedEvidences.length} evidencia(s) DBA planeadas para este periodo que aún no han sido evaluadas en ninguna actividad.`,
      });
      return;
    }

    // 6. Marcar como CERRADO guardando la justificación si existían evidencias pendientes
    await db.transaction().execute(async (trx) => {
      const existingRes = await trx
        .selectFrom("cierre_materia")
        .where("id_detallegrado", "=", Number(detailGradeId))
        .where("id_periodo", "=", Number(periodId))
        .select("id_cierremateria")
        .executeTakeFirst();

      if (existingRes) {
        await trx
          .updateTable("cierre_materia")
          .set({
            estado: "CERRADO",
            fecha_cierre: sql`NOW()`,
            justificacion_evidencias_pendientes: justificacion_evidencias_pendientes || null,
            id_docente_cierre: teacherId,
          })
          .where("id_cierremateria", "=", existingRes.id_cierremateria)
          .execute();
      } else {
        await trx
          .insertInto("cierre_materia")
          .values({
            id_detallegrado: Number(detailGradeId),
            id_periodo: Number(periodId),
            estado: "CERRADO",
            fecha_cierre: sql`NOW()`,
            justificacion_evidencias_pendientes: justificacion_evidencias_pendientes || null,
            id_docente_cierre: teacherId,
          })
          .execute();
      }
    });

    res.json({ message: "Periodo cerrado exitosamente para esta materia" });
  } catch (error: any) {
    console.error("Error closing period:", error);
    res.status(500).json({ error: "Error al cerrar el periodo" });
  }
};

export const closePeriodForTeacher = closeTeacherSubject;

// ============================================================================
// ─── Evidencias DBA para el Docente (Fase 2) ────────────────────────────────
// ============================================================================

export const getCompetenciaEvidenciasDba = async (req: Request, res: Response): Promise<void> => {
  const competencyId = Number(req.params.competencyId);

  if (!competencyId) {
    res.status(400).json({ error: "ID de competencia es obligatorio" });
    return;
  }

  try {
    // 1. Obtener la competencia
    const comp = await db
      .selectFrom("competencias")
      .where("id_competencia", "=", competencyId)
      .select(["id_competencia", "id_grupo", "id_materia", "id_colegio"])
      .executeTakeFirst();

    if (!comp) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    // 2. Obtener versión curricular asignada al colegio para esta materia y grado
    const cvcRes = await db
      .selectFrom("colegio_version_curricular as cvc")
      .where("cvc.id_colegio", "=", comp.id_colegio)
      .where("cvc.area", "=", (eb) =>
        eb.selectFrom("materias").where("id_materia", "=", comp.id_materia).select("nombre")
      )
      .where("cvc.grado", "=", (eb) =>
        eb
          .selectFrom("grupos as g")
          .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
          .where("g.id_grupo", "=", comp.id_grupo)
          .select("tg.nombre")
      )
      .select("cvc.version_curricular")
      .executeTakeFirst();

    if (!cvcRes) {
      res.json({ usaDba: false, planeadas: [], extras: [] });
      return;
    }

    const versionCurricular = cvcRes.version_curricular;

    // 3. Obtener las evidencias planeadas (vinculadas a la competencia)
    const planeadasRes = await db
      .selectFrom("evidencia_aprendizaje as ea")
      .innerJoin("evidencias_dba as edba", "edba.id_evidencia_dba", "ea.id_evidencia_dba")
      .innerJoin("dba as d", "d.id_dba", "edba.id_dba")
      .where("ea.id_competencia", "=", competencyId)
      .where("ea.id_evidencia_dba", "is not", null)
      .select(["ea.id_evidencia", "ea.id_evidencia_dba", "ea.descripcion", "ea.orden", "d.numero_dba"])
      .orderBy("ea.orden", "asc")
      .orderBy("ea.id_evidencia", "asc")
      .execute();

    const planeadasIds = planeadasRes.map((r) => r.id_evidencia_dba!);

    // 4. Obtener todas las evidencias activas del DBA de este grado/área
    const dbaEvsRes = await db
      .selectFrom("evidencias_dba as e")
      .innerJoin("dba as d", "d.id_dba", "e.id_dba")
      .where("d.area", "=", (eb) =>
        eb.selectFrom("materias").where("id_materia", "=", comp.id_materia).select("nombre")
      )
      .where("d.grado", "=", (eb) =>
        eb
          .selectFrom("grupos as g")
          .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
          .where("g.id_grupo", "=", comp.id_grupo)
          .select("tg.nombre")
      )
      .where("d.version_curricular", "=", versionCurricular)
      .where("d.estado", "=", "ACTIVO")
      .where("e.estado", "=", "ACTIVO")
      .select(["e.id_evidencia_dba", "e.descripcion", "e.orden", "d.numero_dba"])
      .orderBy("d.numero_dba", "asc")
      .orderBy("e.orden", "asc")
      .execute();

    // Separar en planeadas y extras
    const planeadas = planeadasRes;
    const extras = dbaEvsRes.filter((r) => !planeadasIds.includes(r.id_evidencia_dba));

    res.json({
      usaDba: true,
      versionCurricular,
      planeadas,
      extras,
    });
  } catch (error: any) {
    console.error("Error al obtener evidencias DBA de la competencia:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getCourseEvidenciasDba = async (req: Request, res: Response): Promise<void> => {
  const gradeId = Number(req.params.gradeId);
  const subjectId = Number(req.params.subjectId);
  const schoolId = Number(req.query.schoolId);
  const periodId = req.query.periodId ? Number(req.query.periodId) : null;

  if (!gradeId || !subjectId || !schoolId) {
    res.status(400).json({ error: "Faltan parámetros obligatorios" });
    return;
  }

  try {
    // 1. Obtener versión curricular asignada al colegio para esta materia y grado
    const cvcRes = await db
      .selectFrom("colegio_version_curricular as cvc")
      .where("cvc.id_colegio", "=", schoolId)
      .where("cvc.area", "=", (eb) =>
        eb.selectFrom("materias").where("id_materia", "=", subjectId).select("nombre")
      )
      .where("cvc.grado", "=", (eb) =>
        eb
          .selectFrom("grupos as g")
          .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
          .where("g.id_grupo", "=", gradeId)
          .select("tg.nombre")
      )
      .select("cvc.version_curricular")
      .executeTakeFirst();

    if (!cvcRes) {
      res.json({ usaDba: false, dba: [] });
      return;
    }

    const versionCurricular = cvcRes.version_curricular;

    // 2. Obtener las evidencias planeadas (vinculadas a la competencia del periodo actual)
    let planeadasQuery = db
      .selectFrom("evidencia_aprendizaje as ea")
      .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
      .innerJoin("evidencias_dba as edba", "edba.id_evidencia_dba", "ea.id_evidencia_dba")
      .innerJoin("dba as d", "d.id_dba", "edba.id_dba")
      .where("c.id_grupo", "in", (eb) =>
        eb
          .selectFrom("grupos as g1")
          .innerJoin("grupos as g2", (join) =>
            join.onRef("g2.id_nivel", "=", "g1.id_nivel").onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
          )
          .where("g1.id_grupo", "=", gradeId)
          .where("g1.id_colegio", "=", schoolId)
          .select("g2.id_grupo")
      )
      .where("c.id_materia", "=", subjectId)
      .where("c.id_colegio", "=", schoolId)
      .where("ea.id_evidencia_dba", "is not", null)
      .select([
        "ea.id_evidencia",
        "ea.id_evidencia_dba",
        "ea.descripcion",
        "ea.orden",
        "d.numero_dba",
        "d.id_dba",
        "d.enunciado as dba_enunciado",
        "ea.id_competencia",
      ])
      .orderBy("d.numero_dba", "asc")
      .orderBy("ea.orden", "asc")
      .orderBy("ea.id_evidencia", "asc");

    if (periodId) {
      planeadasQuery = planeadasQuery.where("c.id_periodo", "=", periodId);
    }

    const planeadasRes = await planeadasQuery.execute();
    const planeadasIds = planeadasRes.map((r) => r.id_evidencia_dba!);

    // 3. Obtener evidencias ya evaluadas en periodos CERRADOS (para excluirlas de extras)
    let evaluadasEnCerradosIds: number[] = [];
    if (periodId) {
      const evaluadasRes = await db
        .selectFrom("actividad_evidencia_dba as aedba")
        .innerJoin("actividad_materia as am", "am.id_actividadmateria", "aedba.id_actividadmateria")
        .innerJoin("periodo_academico as p", "p.id_periodo", "am.id_periodo")
        .where("p.estado", "=", "CERRADO")
        .where("am.id_colegio", "=", schoolId)
        .where("am.id_periodo", "!=", periodId)
        .where("am.id_detallegrado", "in", (eb) =>
          eb
            .selectFrom("detalle_grados")
            .where("id_grupo", "=", gradeId)
            .where("id_materia", "=", subjectId)
            .where("id_colegio", "=", schoolId)
            .select("id_detallegrado")
        )
        .select("aedba.id_evidencia_dba")
        .distinct()
        .execute();

      evaluadasEnCerradosIds = evaluadasRes.map((r) => r.id_evidencia_dba);
    }

    // 4. Obtener todos los DBA con evidencias del catálogo para este grado/materia
    const dbaEvsRes = await db
      .selectFrom("evidencias_dba as e")
      .innerJoin("dba as d", "d.id_dba", "e.id_dba")
      .where("d.area", "=", (eb) =>
        eb.selectFrom("materias").where("id_materia", "=", subjectId).select("nombre")
      )
      .where("d.grado", "=", (eb) =>
        eb
          .selectFrom("grupos as g")
          .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
          .where("g.id_grupo", "=", gradeId)
          .select("tg.nombre")
      )
      .where("d.version_curricular", "=", versionCurricular)
      .where("d.estado", "=", "ACTIVO")
      .where("e.estado", "=", "ACTIVO")
      .select([
        "d.id_dba",
        "d.numero_dba",
        "d.enunciado as dba_enunciado",
        "e.id_evidencia_dba",
        "e.descripcion",
        "e.orden",
      ])
      .orderBy("d.numero_dba", "asc")
      .orderBy("e.orden", "asc")
      .execute();

    // Obtener evidencias ya asociadas a competencias en otros periodos para la misma asignatura, año lectivo y grado/grupo
    interface PlaneadaOtroPeriodo {
      id_evidencia_dba: number;
      id_periodo: number;
      periodo_nombre: string;
    }
    let planeadasOtrosPeriodos: PlaneadaOtroPeriodo[] = [];
    if (periodId) {
      const otrosRes = await db
        .selectFrom("evidencia_aprendizaje as ea")
        .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
        .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
        .where("c.id_colegio", "=", schoolId)
        .where("p.id_anio", "=", (eb) =>
          eb.selectFrom("periodo_academico").where("id_periodo", "=", periodId).select("id_anio")
        )
        .where("c.id_materia", "=", subjectId)
        .where("c.id_grupo", "in", (eb) =>
          eb
            .selectFrom("grupos as g1")
            .innerJoin("grupos as g2", (join) =>
              join.onRef("g2.id_nivel", "=", "g1.id_nivel").onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
            )
            .where("g1.id_grupo", "=", gradeId)
            .where("g1.id_colegio", "=", schoolId)
            .select("g2.id_grupo")
        )
        .where("c.id_periodo", "!=", periodId)
        .where("ea.id_evidencia_dba", "is not", null)
        .select(["ea.id_evidencia_dba", "c.id_periodo", "p.nombre as periodo_nombre"])
        .distinct()
        .execute();

      planeadasOtrosPeriodos = otrosRes.map((r) => ({
        id_evidencia_dba: Number(r.id_evidencia_dba),
        id_periodo: Number(r.id_periodo),
        periodo_nombre: r.periodo_nombre,
      }));
    }

    // 5. Agrupar por DBA y clasificar cada evidencia
    const dbaMap = new Map<
      number,
      {
        id_dba: number;
        numero_dba: number;
        enunciado: string;
        evidencias: Array<{
          id_evidencia_dba: number;
          descripcion: string;
          orden: number;
          tipo: "PLANEADA" | "EXTRA";
          evaluada_en_cerrado: boolean;
          id_competencia: number | null;
          planeada_otro_periodo_id?: number | null;
          planeada_otro_periodo_nombre?: string | null;
        }>;
      }
    >();

    for (const row of dbaEvsRes) {
      if (!dbaMap.has(row.id_dba)) {
        dbaMap.set(row.id_dba, {
          id_dba: row.id_dba,
          numero_dba: row.numero_dba,
          enunciado: row.dba_enunciado,
          evidencias: [],
        });
      }

      const esPlaneada = planeadasIds.includes(row.id_evidencia_dba);
      const evaluadaEnCerrado = evaluadasEnCerradosIds.includes(row.id_evidencia_dba);

      // Si fue evaluada en un periodo cerrado Y no fue re-planeada, la ocultamos de extras
      if (evaluadaEnCerrado && !esPlaneada) {
        continue;
      }

      const otroPeriodo = planeadasOtrosPeriodos.find((p) => p.id_evidencia_dba === row.id_evidencia_dba);
      const planeadaInfo = planeadasRes.find((p) => Number(p.id_evidencia_dba) === Number(row.id_evidencia_dba));
      const idCompetencia = planeadaInfo ? planeadaInfo.id_competencia : null;

      dbaMap.get(row.id_dba)!.evidencias.push({
        id_evidencia_dba: row.id_evidencia_dba,
        descripcion: row.descripcion,
        orden: row.orden,
        tipo: esPlaneada ? "PLANEADA" : "EXTRA",
        evaluada_en_cerrado: evaluadaEnCerrado,
        id_competencia: idCompetencia,
        planeada_otro_periodo_id: otroPeriodo ? otroPeriodo.id_periodo : null,
        planeada_otro_periodo_nombre: otroPeriodo ? otroPeriodo.periodo_nombre : null,
      });
    }

    // También incluir planeadas que no estaban en el catálogo filtrado (por seguridad)
    for (const pl of planeadasRes) {
      if (!dbaMap.has(pl.id_dba)) {
        dbaMap.set(pl.id_dba, {
          id_dba: pl.id_dba,
          numero_dba: pl.numero_dba,
          enunciado: pl.dba_enunciado,
          evidencias: [],
        });
      }
      const dbaEntry = dbaMap.get(pl.id_dba)!;
      if (!dbaEntry.evidencias.some((e) => e.id_evidencia_dba === pl.id_evidencia_dba)) {
        dbaEntry.evidencias.push({
          id_evidencia_dba: pl.id_evidencia_dba!,
          descripcion: pl.descripcion,
          orden: pl.orden,
          tipo: "PLANEADA",
          evaluada_en_cerrado: evaluadasEnCerradosIds.includes(pl.id_evidencia_dba!),
          id_competencia: pl.id_competencia,
        });
      }
    }

    // Ordenar DBA por numero_dba
    const dbaList = Array.from(dbaMap.values()).sort((a, b) => a.numero_dba - b.numero_dba);

    // Mantener compatibilidad: también enviar planeadas y extras planas
    const planeadasFlat = planeadasRes;
    const extrasFlat = dbaEvsRes
      .filter((r) => !planeadasIds.includes(r.id_evidencia_dba) && !evaluadasEnCerradosIds.includes(r.id_evidencia_dba))
      .map((row) => {
        const otroPeriodo = planeadasOtrosPeriodos.find((p) => p.id_evidencia_dba === row.id_evidencia_dba);
        return {
          ...row,
          planeada_otro_periodo_id: otroPeriodo ? otroPeriodo.id_periodo : null,
          planeada_otro_periodo_nombre: otroPeriodo ? otroPeriodo.periodo_nombre : null,
        };
      });

    res.json({
      usaDba: true,
      versionCurricular,
      dba: dbaList,
      planeadas: planeadasFlat,
      extras: extrasFlat,
    });
  } catch (error: any) {
    console.error("Error al obtener evidencias DBA del curso:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
