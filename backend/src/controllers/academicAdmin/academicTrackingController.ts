import { Request, Response } from "express";
import { db } from "../../config/kysely";
import { sql } from "kysely";
import { z } from "zod";

// --- ESQUEMAS DE VALIDACIÓN ZOD ---

const getPeriodTrackingSchema = z.object({
  schoolId: z.coerce.number().positive(),
  yearId: z.coerce.number().positive(),
  periodId: z.coerce.number().positive().optional(),
  cumulativeUpToPeriodOrder: z.coerce.number().positive().optional(),
  gradeId: z.coerce.number().positive().optional(),
  groupId: z.coerce.number().positive().optional()
});

const getAnnualConsolidationSchema = z.object({
  schoolId: z.coerce.number().positive(),
  yearId: z.coerce.number().positive(),
  gradeId: z.coerce.number().positive().optional(),
  groupId: z.coerce.number().positive().optional()
});

const checkWarningSchema = z.object({
  documento: z.string().min(1)
});

const recordDecisionSchema = z.object({
  schoolId: z.coerce.number().positive(),
  studentId: z.coerce.number().positive(),
  previousYearId: z.coerce.number().positive(),
  calculatedResult: z.string().min(1),
  decisionTaken: z.enum([
    "MANTENER_GRADO",
    "PROMOVER_SIGUIENTE_GRADO",
    "MATRICULA_CONDICIONADA",
    "OTRA_DECISION"
  ]),
  previousGradeId: z.coerce.number().positive().optional().nullable(),
  assignedGradeId: z.coerce.number().positive().optional().nullable(),
  observation: z.string().optional().nullable()
});

/**
 * Auxiliar para obtener el valor mínimo aprobatorio según la escala del colegio.
 */
async function getMinPassingScore(schoolId: number): Promise<number> {
  try {
    // 1. Consultar nota_aprobacion en configuracion_colegio
    const config = await db
      .selectFrom("configuracion_colegio")
      .select(["nota_aprobacion"])
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (config && config.nota_aprobacion != null) {
      const val = parseFloat(String(config.nota_aprobacion));
      if (!isNaN(val) && val > 0) return val;
    }

    // 2. Si no existe en la config, buscar el valor mínimo de la escala aprobatoria más baja (ej. Básico)
    const scale = await db
      .selectFrom("escala_valoracion")
      .select(["valor_minimo"])
      .where("id_colegio", "=", schoolId)
      .where(sql`LOWER(nivel)`, "not in", ["bajo", "insuficiente"])
      .orderBy("valor_minimo", "asc")
      .executeTakeFirst();

    if (scale && scale.valor_minimo != null) {
      const val = parseFloat(String(scale.valor_minimo));
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (err) {
    console.error("Error al obtener la nota mínima aprobatoria:", err);
  }
  return 3.0;
}

/**
 * Auxiliar para obtener el número de materias reprobatorias para no promoción según la configuración del colegio (o 3 por defecto).
 */
async function getMinFailingSubjectsCount(schoolId: number): Promise<number> {
  try {
    const config = await db
      .selectFrom("configuracion_colegio")
      .select(["materias_reprobatorias_promocion"])
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (config && config.materias_reprobatorias_promocion != null) {
      const val = Number(config.materias_reprobatorias_promocion);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (err) {
    console.error("Error al obtener materias reprobatorias de promoción:", err);
  }
  return 3;
}

/**
 * Auxiliar para obtener dinámicamente el id_tipo_grado del "último grado" de la institución.
 */
async function getMaxGradeIdForSchool(schoolId: number): Promise<number | null> {
  try {
    const maxGradeFromGroups = await db
      .selectFrom("grupos as g")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("nivel_escolar as n", "n.id_nivel", "g.id_nivel")
      .select([
        "tg.id_tipo_grado",
        "tg.nombre as grado_nombre",
        "n.nombre as nivel_nombre"
      ])
      .where("g.id_colegio", "=", schoolId)
      .orderBy("g.id_nivel", "desc")
      .orderBy("tg.id_tipo_grado", "desc")
      .executeTakeFirst();

    if (maxGradeFromGroups && maxGradeFromGroups.id_tipo_grado) {
      return maxGradeFromGroups.id_tipo_grado;
    }

    const maxGeneralGrade = await db
      .selectFrom("tipo_grado")
      .select(["id_tipo_grado", "nombre"])
      .orderBy("id_nivel", "desc")
      .orderBy("id_tipo_grado", "desc")
      .executeTakeFirst();

    return maxGeneralGrade?.id_tipo_grado || null;
  } catch (err) {
    console.error("Error al obtener el último grado del colegio:", err);
    return null;
  }
}

/**
 * 1. SEGUIMIENTO ACADÉMICO POR PERÍODO (INDIVIDUAL O ACUMULATIVO)
 */
export const getPeriodAcademicTracking = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = getPeriodTrackingSchema.safeParse({
      schoolId: req.query.schoolId || (req.body as any)?.schoolId,
      yearId: req.query.yearId || (req.body as any)?.yearId,
      periodId: req.query.periodId || (req.body as any)?.periodId,
      cumulativeUpToPeriodOrder: req.query.cumulativeUpToPeriodOrder || (req.body as any)?.cumulativeUpToPeriodOrder,
      gradeId: req.query.gradeId || (req.body as any)?.gradeId,
      groupId: req.query.groupId || (req.body as any)?.groupId
    });

    if (!parseResult.success) {
      res.status(400).json({ error: "Parámetros inválidos", details: parseResult.error.flatten() });
      return;
    }

    const { schoolId, yearId, periodId, cumulativeUpToPeriodOrder, gradeId, groupId } = parseResult.data;
    const minPassingScore = await getMinPassingScore(schoolId);
    const minFailingSubjects = await getMinFailingSubjectsCount(schoolId);
    const maxGradeId = await getMaxGradeIdForSchool(schoolId);

    // Obtener períodos del año
    const periodsInYear = await db
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre", "estado"])
      .where("id_colegio", "=", schoolId)
      .where("id_anio", "=", yearId)
      .orderBy("id_periodo", "asc")
      .execute();

    let targetPeriodIds: number[] = [];
    if (cumulativeUpToPeriodOrder) {
      targetPeriodIds = periodsInYear
        .slice(0, Math.min(cumulativeUpToPeriodOrder, periodsInYear.length))
        .map(p => p.id_periodo);
    } else if (periodId) {
      targetPeriodIds = [periodId];
    } else if (periodsInYear.length > 0) {
      targetPeriodIds = [periodsInYear[0].id_periodo];
    }

    // Consulta base de estudiantes matriculados
    let query = db
      .selectFrom("matricula as m")
      .innerJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .innerJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .leftJoin("grupos as g", "g.id_grupo", "m.id_grupo")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .select([
        "e.id_estudiante",
        "u.nombre",
        "u.apellido",
        "u.documento",
        "m.id_grupo",
        "s.nombre as grupo_nombre",
        "tg.id_tipo_grado as id_grado",
        "tg.nombre as grado_nombre",
        "j.nombre as jornada_nombre"
      ])
      .where("m.id_colegio", "=", schoolId)
      .where("m.id_anio", "=", yearId)
      .where("m.estado", "in", ["ACTIVA", "APROBADA", "CULMINADA"]);

    if (gradeId) {
      query = query.where("tg.id_tipo_grado", "=", gradeId);
    }
    if (groupId) {
      query = query.where("m.id_grupo", "=", groupId);
    }

    const students = await query.orderBy("u.apellido", "asc").orderBy("u.nombre", "asc").execute();

    if (students.length === 0 || targetPeriodIds.length === 0) {
      res.json({
        total_estudiantes: students.length,
        aprobados_count: students.length,
        pendientes_count: 0,
        reprobados_count: 0,
        sin_calificar_count: 0,
        min_passing_score: minPassingScore,
        periodos_analizados: targetPeriodIds,
        estudiantes: students.map(s => ({
          id_estudiante: s.id_estudiante,
          nombre: s.nombre,
          apellido: s.apellido,
          documento: s.documento,
          grado_nombre: s.grado_nombre || "Sin Grado",
          grupo_nombre: s.grupo_nombre || "Sin Grupo",
          jornada_nombre: s.jornada_nombre || null,
          id_grado: s.id_grado,
          is_final_grade: maxGradeId != null && s.id_grado === maxGradeId,
          es_ultimo_grado: maxGradeId != null && s.id_grado === maxGradeId,
          estado_academico: "SIN_NOTAS",
          promedio_general: null,
          cantidad_reprobadas: 0,
          asignaturas_reprobadas: [],
          todas_asignaturas: []
        }))
      });
      return;
    }

    const studentIds = students.map(s => s.id_estudiante);
    const uniqueGroupIds = Array.from(new Set(students.map(s => s.id_grupo).filter((id): id is number => id != null)));

    // 1. Obtener todas las materias asignadas a los grupos evaluados
    const groupSubjects = uniqueGroupIds.length > 0
      ? await db
          .selectFrom("detalle_grados as dg")
          .innerJoin("materias as mat", "mat.id_materia", "dg.id_materia")
          .leftJoin("docente as d", "d.id_docente", "dg.id_docente")
          .leftJoin("usuario as ud", "ud.id_usuario", "d.id_usuario")
          .select([
            "dg.id_grupo",
            "dg.id_detallegrado",
            "dg.id_materia",
            "mat.nombre as materia_nombre",
            sql<string>`COALESCE(ud.nombre || ' ' || ud.apellido, 'Sin Docente Asignado')`.as("docente_nombre")
          ])
          .where("dg.id_grupo", "in", uniqueGroupIds)
          .execute()
      : [];

    const groupSubjectsMap: Record<number, Array<{ id_materia: number; id_detallegrado: number; materia_nombre: string; docente_nombre: string }>> = {};
    const seenSubjectsPerGroup = new Set<string>();

    groupSubjects.forEach(gs => {
      const gId = Number(gs.id_grupo);
      const mId = Number(gs.id_materia);
      const groupMatKey = `${gId}_${mId}`;

      if (!seenSubjectsPerGroup.has(groupMatKey)) {
        seenSubjectsPerGroup.add(groupMatKey);
        if (!groupSubjectsMap[gId]) groupSubjectsMap[gId] = [];
        groupSubjectsMap[gId].push({
          id_materia: mId,
          id_detallegrado: Number(gs.id_detallegrado),
          materia_nombre: gs.materia_nombre,
          docente_nombre: gs.docente_nombre
        });
      }
    });

    // 2. Consulta de notas consolidadas en resultado_academico
    const consolidatedGrades = await db
      .selectFrom("resultado_academico as ra")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
      .select([
        "ra.id_estudiante",
        "ra.id_periodo",
        "dg.id_materia",
        "ra.promedio"
      ])
      .where("ra.id_estudiante", "in", studentIds)
      .where("ra.id_periodo", "in", targetPeriodIds)
      .execute();

    const consolidatedMap: Record<string, number> = {};
    consolidatedGrades.forEach(cg => {
      const key = `${cg.id_estudiante}_${cg.id_materia}_${cg.id_periodo}`;
      consolidatedMap[key] = parseFloat(String(cg.promedio || 0));
    });

    // 3. Consulta de notas por actividad en curso
    const activityGrades = await db
      .selectFrom("notas_actividad as na")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
      .select([
        "na.id_estudiante",
        "am.id_periodo",
        "dg.id_materia",
        sql<number>`COALESCE(SUM(na.nota * am.porcentaje / 100.0), 0)`.as("nota_ponderada_actividades")
      ])
      .where("na.id_estudiante", "in", studentIds)
      .where("am.id_periodo", "in", targetPeriodIds)
      .groupBy([
        "na.id_estudiante",
        "am.id_periodo",
        "dg.id_materia"
      ])
      .execute();

    const activityMap: Record<string, number> = {};
    activityGrades.forEach(ag => {
      const key = `${ag.id_estudiante}_${ag.id_materia}_${ag.id_periodo}`;
      activityMap[key] = parseFloat(String(ag.nota_ponderada_actividades || 0));
    });

    let aprobadosCount = 0;
    let pendientesCount = 0;
    let reprobadosCount = 0;
    let sinCalificarCount = 0;

    const studentResults = students.map(student => {
      const stId = student.id_estudiante;
      const gId = student.id_grupo ? Number(student.id_grupo) : null;
      const assignedSubjects = (gId && groupSubjectsMap[gId]) ? groupSubjectsMap[gId] : [];

      const failedSubjects: any[] = [];
      const allSubjects: any[] = [];
      let totalStudentSum = 0;
      let totalSubjectsEvaluated = 0;

      // Si el grupo tiene asignaturas estructuradas
      if (assignedSubjects.length > 0) {
        for (const sub of assignedSubjects) {
          const periodScores: number[] = [];

          for (const perId of targetPeriodIds) {
            const key = `${stId}_${sub.id_materia}_${perId}`;
            let periodGrade: number | null = null;

            if (consolidatedMap[key] !== undefined) {
              periodGrade = consolidatedMap[key];
            } else if (activityMap[key] !== undefined) {
              periodGrade = activityMap[key];
            }

            if (periodGrade !== null) {
              periodScores.push(periodGrade);
            }
          }

          const hasGrades = periodScores.length > 0;
          const avgGrade = hasGrades
            ? parseFloat((periodScores.reduce((a, b) => a + b, 0) / periodScores.length).toFixed(2))
            : null;

          const isFailed = avgGrade !== null && avgGrade < minPassingScore;

          const subjectItem = {
            id_materia: sub.id_materia,
            materia_nombre: sub.materia_nombre,
            docente_nombre: sub.docente_nombre,
            calificacion: avgGrade,
            periodos_evaluados: periodScores.length,
            estado_materia: avgGrade === null ? "SIN_NOTAS" : (isFailed ? "REPROBADA" : "APROBADA")
          };

          allSubjects.push(subjectItem);
          if (isFailed) {
            failedSubjects.push(subjectItem);
          }

          if (avgGrade !== null) {
            totalStudentSum += avgGrade;
            totalSubjectsEvaluated++;
          }
        }
      } else {
        // En caso de que no haya detalle_grados configurado, buscar asignaturas que tengan alguna nota
        const subjectIdsFound = new Set<number>();
        for (const perId of targetPeriodIds) {
          Object.keys(consolidatedMap).concat(Object.keys(activityMap)).forEach(k => {
            const [sId, mId, pId] = k.split("_").map(Number);
            if (sId === stId && pId === perId) {
              subjectIdsFound.add(mId);
            }
          });
        }

        for (const matId of subjectIdsFound) {
          const periodScores: number[] = [];
          for (const perId of targetPeriodIds) {
            const key = `${stId}_${matId}_${perId}`;
            const grade = consolidatedMap[key] ?? activityMap[key];
            if (grade !== undefined) periodScores.push(grade);
          }

          const hasGrades = periodScores.length > 0;
          const avgGrade = hasGrades
            ? parseFloat((periodScores.reduce((a, b) => a + b, 0) / periodScores.length).toFixed(2))
            : null;
          const isFailed = avgGrade !== null && avgGrade < minPassingScore;

          const subjectItem = {
            id_materia: matId,
            materia_nombre: `Materia ${matId}`,
            docente_nombre: "Docente no asignado",
            calificacion: avgGrade,
            periodos_evaluados: periodScores.length,
            estado_materia: avgGrade === null ? "SIN_NOTAS" : (isFailed ? "REPROBADA" : "APROBADA")
          };

          allSubjects.push(subjectItem);
          if (isFailed) failedSubjects.push(subjectItem);

          if (avgGrade !== null) {
            totalStudentSum += avgGrade;
            totalSubjectsEvaluated++;
          }
        }
      }

      // Clasificación según RN-19.3 & S.I.E.E. (0: APROBADO, 1 a (N-1): PENDIENTE, N+: REPROBADO)
      let estadoAcademico = "APROBADO";
      if (totalSubjectsEvaluated === 0) {
        estadoAcademico = "SIN_NOTAS";
        sinCalificarCount++;
      } else if (failedSubjects.length >= minFailingSubjects) {
        estadoAcademico = "REPROBADO";
        reprobadosCount++;
      } else if (failedSubjects.length > 0) {
        estadoAcademico = "PENDIENTE";
        pendientesCount++;
      } else {
        estadoAcademico = "APROBADO";
        aprobadosCount++;
      }

      const studentAverage = totalSubjectsEvaluated > 0
        ? parseFloat((totalStudentSum / totalSubjectsEvaluated).toFixed(2))
        : null;

      return {
        id_estudiante: student.id_estudiante,
        nombre: student.nombre,
        apellido: student.apellido,
        documento: student.documento,
        grado_nombre: student.grado_nombre || "Sin Grado",
        grupo_nombre: student.grupo_nombre || "Sin Grupo",
        jornada_nombre: student.jornada_nombre || null,
        id_grado: student.id_grado,
        is_final_grade: maxGradeId != null && student.id_grado === maxGradeId,
        es_ultimo_grado: maxGradeId != null && student.id_grado === maxGradeId,
        estado_academico: estadoAcademico,
        promedio_general: studentAverage,
        cantidad_reprobadas: failedSubjects.length,
        asignaturas_reprobadas: failedSubjects,
        todas_asignaturas: allSubjects
      };
    });

    res.json({
      total_estudiantes: students.length,
      aprobados_count: aprobadosCount,
      pendientes_count: pendientesCount,
      reprobados_count: reprobadosCount,
      sin_calificar_count: sinCalificarCount,
      min_passing_score: minPassingScore,
      min_failing_subjects: minFailingSubjects,
      periodos_analizados: targetPeriodIds,
      estudiantes: studentResults
    });
  } catch (error) {
    console.error("Error en getPeriodAcademicTracking:", error);
    res.status(500).json({ error: "Error interno al consultar seguimiento por período" });
  }
};

/**
 * 2. CONSOLIDACIÓN DEL RESULTADO ANUAL DE LOS ESTUDIANTES
 */
export const getAnnualConsolidation = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = getAnnualConsolidationSchema.safeParse({
      schoolId: req.query.schoolId || (req.body as any)?.schoolId,
      yearId: req.query.yearId || (req.body as any)?.yearId,
      gradeId: req.query.gradeId || (req.body as any)?.gradeId,
      groupId: req.query.groupId || (req.body as any)?.groupId
    });

    if (!parseResult.success) {
      res.status(400).json({ error: "Parámetros inválidos", details: parseResult.error.flatten() });
      return;
    }

    const { schoolId, yearId, gradeId, groupId } = parseResult.data;
    const minPassingScore = await getMinPassingScore(schoolId);
    const minFailingSubjects = await getMinFailingSubjectsCount(schoolId);
    const maxGradeId = await getMaxGradeIdForSchool(schoolId);

    const yearPeriods = await db
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre", "estado"])
      .where("id_colegio", "=", schoolId)
      .where("id_anio", "=", yearId)
      .orderBy("id_periodo", "asc")
      .execute();

    const periodIds = yearPeriods.map(p => p.id_periodo);
    const closedPeriodsCount = yearPeriods.filter(p => p.estado === "CERRADO").length;
    const totalPeriodsCount = yearPeriods.length;
    const isReadyForPromotion = totalPeriodsCount <= 1 || closedPeriodsCount >= totalPeriodsCount - 1;

    let query = db
      .selectFrom("matricula as m")
      .innerJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .innerJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .leftJoin("grupos as g", "g.id_grupo", "m.id_grupo")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .select([
        "e.id_estudiante",
        "u.nombre",
        "u.apellido",
        "u.documento",
        "m.id_grupo",
        "s.nombre as grupo_nombre",
        "tg.id_tipo_grado as id_grado",
        "tg.nombre as grado_nombre",
        "j.nombre as jornada_nombre"
      ])
      .where("m.id_colegio", "=", schoolId)
      .where("m.id_anio", "=", yearId)
      .where("m.estado", "in", ["ACTIVA", "APROBADA", "CULMINADA"]);

    if (gradeId) query = query.where("tg.id_tipo_grado", "=", gradeId);
    if (groupId) query = query.where("m.id_grupo", "=", groupId);

    const students = await query.orderBy("u.apellido", "asc").orderBy("u.nombre", "asc").execute();
    const studentIds = students.map(s => s.id_estudiante);

    if (students.length === 0) {
      res.json({
        total_estudiantes: 0,
        promovidos_count: 0,
        no_promovidos_count: 0,
        pendientes_count: 0,
        min_passing_score: minPassingScore,
        total_periodos: totalPeriodsCount,
        periodos_cerrados: closedPeriodsCount,
        habilitado_para_promocion: isReadyForPromotion,
        estudiantes: []
      });
      return;
    }

    const uniqueGroupIds = Array.from(new Set(students.map(s => s.id_grupo).filter((id): id is number => id != null)));

    // 1. Obtener materias asignadas a los grupos
    const groupSubjects = uniqueGroupIds.length > 0
      ? await db
          .selectFrom("detalle_grados as dg")
          .innerJoin("materias as mat", "mat.id_materia", "dg.id_materia")
          .leftJoin("docente as d", "d.id_docente", "dg.id_docente")
          .leftJoin("usuario as ud", "ud.id_usuario", "d.id_usuario")
          .select([
            "dg.id_grupo",
            "dg.id_detallegrado",
            "dg.id_materia",
            "mat.nombre as materia_nombre",
            sql<string>`COALESCE(ud.nombre || ' ' || ud.apellido, 'Sin Docente Asignado')`.as("docente_nombre")
          ])
          .where("dg.id_grupo", "in", uniqueGroupIds)
          .execute()
      : [];

    const groupSubjectsMap: Record<number, Array<{ id_materia: number; id_detallegrado: number; materia_nombre: string; docente_nombre: string }>> = {};
    const seenSubjectsPerGroup = new Set<string>();

    groupSubjects.forEach(gs => {
      const gId = Number(gs.id_grupo);
      const mId = Number(gs.id_materia);
      const groupMatKey = `${gId}_${mId}`;

      if (!seenSubjectsPerGroup.has(groupMatKey)) {
        seenSubjectsPerGroup.add(groupMatKey);
        if (!groupSubjectsMap[gId]) groupSubjectsMap[gId] = [];
        groupSubjectsMap[gId].push({
          id_materia: mId,
          id_detallegrado: Number(gs.id_detallegrado),
          materia_nombre: gs.materia_nombre,
          docente_nombre: gs.docente_nombre
        });
      }
    });

    // 2. Decisiones directivas previas
    const decisions = studentIds.length > 0
      ? await db
          .selectFrom("decision_promocion_directivo")
          .selectAll()
          .where("id_colegio", "=", schoolId)
          .where("id_anio_anterior", "=", yearId)
          .where("id_estudiante", "in", studentIds)
          .execute()
      : [];

    const decisionsMap: Record<number, any> = {};
    decisions.forEach((d: any) => {
      decisionsMap[d.id_estudiante] = d;
    });

    // 3. Notas de resultado_academico
    const consolidatedGrades = (studentIds.length > 0 && periodIds.length > 0)
      ? await db
          .selectFrom("resultado_academico as ra")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
          .select([
            "ra.id_estudiante",
            "ra.id_periodo",
            "dg.id_materia",
            "ra.promedio"
          ])
          .where("ra.id_estudiante", "in", studentIds)
          .where("ra.id_periodo", "in", periodIds)
          .execute()
      : [];

    const consolidatedMap: Record<string, number> = {};
    consolidatedGrades.forEach(cg => {
      const key = `${cg.id_estudiante}_${cg.id_materia}_${cg.id_periodo}`;
      consolidatedMap[key] = parseFloat(String(cg.promedio || 0));
    });

    // 4. Notas de actividades
    const activityGrades = (studentIds.length > 0 && periodIds.length > 0)
      ? await db
          .selectFrom("notas_actividad as na")
          .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
          .select([
            "na.id_estudiante",
            "am.id_periodo",
            "dg.id_materia",
            sql<number>`COALESCE(SUM(na.nota * am.porcentaje / 100.0), 0)`.as("nota_ponderada")
          ])
          .where("na.id_estudiante", "in", studentIds)
          .where("am.id_periodo", "in", periodIds)
          .groupBy([
            "na.id_estudiante",
            "am.id_periodo",
            "dg.id_materia"
          ])
          .execute()
      : [];

    const activityMap: Record<string, number> = {};
    activityGrades.forEach(ag => {
      const key = `${ag.id_estudiante}_${ag.id_materia}_${ag.id_periodo}`;
      activityMap[key] = parseFloat(String(ag.nota_ponderada || 0));
    });

    let promovidosCount = 0;
    let noPromovidosCount = 0;
    let pendientesCount = 0;

    const divisorPeriodos = Math.max(periodIds.length, 1);

    const studentConsolidated = students.map(student => {
      const stId = student.id_estudiante;
      const gId = student.id_grupo ? Number(student.id_grupo) : null;
      const assignedSubjects = (gId && groupSubjectsMap[gId]) ? groupSubjectsMap[gId] : [];

      const failedSubjects: any[] = [];
      const allSubjects: any[] = [];
      let totalAnnualSum = 0;
      let subjectsCount = 0;

      if (assignedSubjects.length > 0) {
        for (const sub of assignedSubjects) {
          const scoresPerPeriod: Record<number, number> = {};
          let subjectSum = 0;

          for (const perId of periodIds) {
            const key = `${stId}_${sub.id_materia}_${perId}`;
            let score: number | null = null;
            if (consolidatedMap[key] !== undefined) score = consolidatedMap[key];
            else if (activityMap[key] !== undefined) score = activityMap[key];

            if (score !== null) {
              scoresPerPeriod[perId] = score;
              subjectSum += score;
            }
          }

          const evaluatedCount = Object.keys(scoresPerPeriod).length;
          const annualAvg = evaluatedCount > 0
            ? parseFloat((subjectSum / (isReadyForPromotion ? divisorPeriodos : evaluatedCount)).toFixed(2))
            : null;

          const isFailed = annualAvg !== null && annualAvg < minPassingScore;

          const item = {
            id_materia: sub.id_materia,
            materia_nombre: sub.materia_nombre,
            docente_nombre: sub.docente_nombre,
            promedio_anual: annualAvg,
            periodos_registrados: evaluatedCount,
            estado: annualAvg === null ? "SIN_NOTAS" : (isFailed ? "REPROBADA" : "APROBADA")
          };

          allSubjects.push(item);
          if (isFailed) {
            failedSubjects.push(item);
          }

          if (annualAvg !== null) {
            totalAnnualSum += annualAvg;
            subjectsCount++;
          }
        }
      }

      // Regla de Negocio RN-19.3 & RN-19.12 (S.I.E.E. Institucional):
      let resultadoAnual = "APROBADO";
      if (subjectsCount === 0) {
        resultadoAnual = "SIN_CALIFICACIONES";
        pendientesCount++;
      } else if (failedSubjects.length >= minFailingSubjects) {
        resultadoAnual = "NO_PROMOVIDO";
        noPromovidosCount++;
      } else if (failedSubjects.length > 0) {
        resultadoAnual = "PENDIENTE_RECUPERACION";
        pendientesCount++;
      } else {
        resultadoAnual = "APROBADO";
        promovidosCount++;
      }

      const studentAnnualAverage = subjectsCount > 0
        ? parseFloat((totalAnnualSum / subjectsCount).toFixed(2))
        : null;

      return {
        id_estudiante: student.id_estudiante,
        nombre: student.nombre,
        apellido: student.apellido,
        documento: student.documento,
        grado_nombre: student.grado_nombre || "Sin Grado",
        grupo_nombre: student.grupo_nombre || "Sin Grupo",
        jornada_nombre: student.jornada_nombre || null,
        id_grado: student.id_grado,
        is_final_grade: maxGradeId != null && student.id_grado === maxGradeId,
        es_ultimo_grado: maxGradeId != null && student.id_grado === maxGradeId,
        resultado_anual: resultadoAnual,
        promedio_anual_general: studentAnnualAverage,
        cantidad_reprobadas: failedSubjects.length,
        asignaturas_reprobadas: failedSubjects,
        todas_asignaturas: allSubjects,
        decision_directivo: decisionsMap[stId] || null
      };
    });

    res.json({
      total_estudiantes: students.length,
      promovidos_count: promovidosCount,
      no_promovidos_count: noPromovidosCount,
      pendientes_count: pendientesCount,
      min_passing_score: minPassingScore,
      min_failing_subjects: minFailingSubjects,
      total_periodos: totalPeriodsCount,
      periodos_cerrados: closedPeriodsCount,
      habilitado_para_promocion: isReadyForPromotion,
      estudiantes: studentConsolidated
    });
  } catch (error) {
    console.error("Error en getAnnualConsolidation:", error);
    res.status(500).json({ error: "Error interno al calcular consolidación anual" });
  }
};

/**
 * 3. CONSULTAR HISTORIAL ACADÉMICO DEL ESTUDIANTE
 */
export const getStudentAcademicHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId || isNaN(studentId)) {
      res.status(400).json({ error: "ID de estudiante inválido" });
      return;
    }

    const studentInfo = await db
      .selectFrom("estudiante as e")
      .innerJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .leftJoin("colegio as c", "c.id_colegio", "e.id_colegio")
      .select([
        "e.id_estudiante",
        "e.id_colegio",
        "u.nombre",
        "u.apellido",
        "u.documento",
        "u.email",
        "u.telefono",
        "c.nombre as colegio_nombre"
      ])
      .where("e.id_estudiante", "=", studentId)
      .executeTakeFirst();

    if (!studentInfo) {
      res.status(404).json({ error: "Estudiante no encontrado" });
      return;
    }

    const schoolId = studentInfo.id_colegio || 1;
    const minPassingScore = await getMinPassingScore(schoolId);

    const enrollments = await db
      .selectFrom("matricula as m")
      .innerJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
      .leftJoin("grupos as g", "g.id_grupo", "m.id_grupo")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .leftJoin("decision_promocion_directivo as dpd", (join: any) =>
        join
          .onRef("dpd.id_estudiante", "=", "m.id_estudiante")
          .onRef("dpd.id_anio_anterior", "=", "m.id_anio")
      )
      .select([
        "m.id_matricula",
        "m.id_anio",
        "m.id_grupo",
        "al.calendario",
        "al.fecha_inicio",
        "al.fecha_fin",
        "tg.id_tipo_grado as id_grado",
        "tg.nombre as grado_nombre",
        "s.nombre as grupo_nombre",
        "j.nombre as jornada_nombre",
        "m.estado as estado_matricula",
        "dpd.resultado_calculado",
        "dpd.decision_tomada",
        "dpd.fecha_decision",
        "dpd.observacion"
      ])
      .where("m.id_estudiante", "=", studentId)
      .orderBy("al.fecha_inicio", "desc")
      .execute();

    res.json({
      estudiante: studentInfo,
      min_passing_score: minPassingScore,
      historial_matriculas: enrollments
    });
  } catch (error) {
    console.error("Error en getStudentAcademicHistory:", error);
    res.status(500).json({ error: "Error al obtener historial del estudiante" });
  }
};

/**
 * 4. CONSULTA Y ADVERTENCIA DE REPROBACIÓN DURANTE MATRÍCULA
 */
export const checkStudentAcademicWarning = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = checkWarningSchema.safeParse({
      documento: req.query.documento || (req.body as any)?.documento
    });

    if (!parseResult.success) {
      res.status(400).json({ error: "Documento inválido", details: parseResult.error.flatten() });
      return;
    }

    const { documento } = parseResult.data;

    const user = await db
      .selectFrom("usuario as u")
      .leftJoin("estudiante as e", "e.id_usuario", "u.id_usuario")
      .select([
        "u.id_usuario",
        "u.nombre",
        "u.apellido",
        "u.documento",
        "u.email",
        "u.telefono",
        "e.id_colegio",
        "e.id_estudiante"
      ])
      .where("u.documento", "=", documento)
      .executeTakeFirst();

    if (!user || !user.id_estudiante) {
      res.json({
        exists: false,
        warning: false,
        message: "Estudiante no registrado previamente en el sistema."
      });
      return;
    }

    const lastEnrollment = await db
      .selectFrom("matricula as m")
      .innerJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
      .leftJoin("grupos as g", "g.id_grupo", "m.id_grupo")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .select([
        "m.id_matricula",
        "m.id_colegio",
        "m.id_anio",
        "m.id_grupo",
        "al.calendario",
        "tg.id_tipo_grado as id_grado",
        "tg.nombre as grado_nombre",
        "s.nombre as grupo_nombre",
        "j.nombre as jornada_nombre"
      ])
      .where("m.id_estudiante", "=", user.id_estudiante)
      .where("m.estado", "not in", ["CANCELADA", "RECHAZADA"])
      .orderBy("al.fecha_inicio", "desc")
      .executeTakeFirst();

    if (!lastEnrollment) {
      res.json({
        exists: true,
        warning: false,
        estudiante: user,
        message: "El estudiante existe pero no posee matrículas previas registradas."
      });
      return;
    }

    const targetSchoolId = lastEnrollment.id_colegio || user.id_colegio || 1;
    const minPassingScore = await getMinPassingScore(targetSchoolId);
    
    const periods = await db
      .selectFrom("periodo_academico")
      .select("id_periodo")
      .where("id_colegio", "=", targetSchoolId)
      .where("id_anio", "=", lastEnrollment.id_anio)
      .execute();

    const periodIds = periods.map(p => p.id_periodo);

    let failedSubjectsCount = 0;
    const failedSubjectsList: any[] = [];

    if (periodIds.length > 0 && lastEnrollment.id_grupo) {
      // 1. Obtener materias del grupo
      const groupSubjects = await db
        .selectFrom("detalle_grados as dg")
        .innerJoin("materias as mat", "mat.id_materia", "dg.id_materia")
        .select([
          "dg.id_materia",
          "mat.nombre as materia_nombre"
        ])
        .where("dg.id_grupo", "=", lastEnrollment.id_grupo)
        .execute();

      // 2. Notas de resultado_academico
      const consolidatedGrades = await db
        .selectFrom("resultado_academico as ra")
        .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
        .select([
          "ra.id_periodo",
          "dg.id_materia",
          "ra.promedio"
        ])
        .where("ra.id_estudiante", "=", user.id_estudiante)
        .where("ra.id_periodo", "in", periodIds)
        .execute();

      const consolidatedMap: Record<string, number> = {};
      consolidatedGrades.forEach(cg => {
        consolidatedMap[`${cg.id_materia}_${cg.id_periodo}`] = parseFloat(String(cg.promedio || 0));
      });

      // 3. Notas de actividades
      const activityGrades = await db
        .selectFrom("notas_actividad as na")
        .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
        .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
        .select([
          "am.id_periodo",
          "dg.id_materia",
          sql<number>`COALESCE(SUM(na.nota * am.porcentaje / 100.0), 0)`.as("nota_ponderada")
        ])
        .where("na.id_estudiante", "=", user.id_estudiante)
        .where("am.id_periodo", "in", periodIds)
        .groupBy(["am.id_periodo", "dg.id_materia"])
        .execute();

      const activityMap: Record<string, number> = {};
      activityGrades.forEach(ag => {
        activityMap[`${ag.id_materia}_${ag.id_periodo}`] = parseFloat(String(ag.nota_ponderada || 0));
      });

      const seenWarningMatIds = new Set<number>();
      const uniqueGroupSubjects = groupSubjects.filter(gs => {
        const mId = Number(gs.id_materia);
        if (seenWarningMatIds.has(mId)) return false;
        seenWarningMatIds.add(mId);
        return true;
      });

      for (const gs of uniqueGroupSubjects) {
        const matId = Number(gs.id_materia);
        let matSum = 0;
        let pCount = 0;

        for (const perId of periodIds) {
          const key = `${matId}_${perId}`;
          const grade = consolidatedMap[key] ?? activityMap[key];
          if (grade !== undefined) {
            matSum += grade;
            pCount++;
          }
        }

        const avg = pCount > 0 ? parseFloat((matSum / Math.max(periodIds.length, 1)).toFixed(2)) : null;
        if (avg !== null && avg < minPassingScore) {
          failedSubjectsCount++;
          failedSubjectsList.push({
            id_materia: matId,
            materia_nombre: gs.materia_nombre,
            promedio: avg
          });
        }
      }
    }

    const existingDecision = await db
      .selectFrom("decision_promocion_directivo")
      .selectAll()
      .where("id_estudiante", "=", user.id_estudiante)
      .where("id_anio_anterior", "=", lastEnrollment.id_anio)
      .executeTakeFirst();

    const isNotPromoted = failedSubjectsCount >= 3 || (existingDecision && existingDecision.decision_tomada === "MANTENER_GRADO");
    const isWarning = failedSubjectsCount > 0 || isNotPromoted || Boolean(existingDecision);

    const calculatedResult = failedSubjectsCount >= 3
      ? "NO_PROMOVIDO"
      : (failedSubjectsCount > 0 ? "PENDIENTE_RECUPERACION" : "APROBADO");

    res.json({
      exists: true,
      warning: isWarning,
      estudiante: user,
      ultima_matricula: lastEnrollment,
      resultado_calculado: calculatedResult,
      cantidad_materias_reprobadas: failedSubjectsCount,
      materias_reprobadas: failedSubjectsList,
      decision_existente: existingDecision || null,
      message: isNotPromoted
        ? `El estudiante reprobó ${failedSubjectsCount} asignatura(s) en el año lectivo ${lastEnrollment.calendario || lastEnrollment.id_anio}.`
        : (failedSubjectsCount > 0
            ? `El estudiante tiene ${failedSubjectsCount} asignatura(s) pendiente(s) de recuperación en el año lectivo anterior.`
            : "El estudiante aprobó el año lectivo anterior satisfactoriamente.")
    });
  } catch (error) {
    console.error("Error en checkStudentAcademicWarning:", error);
    res.status(500).json({ error: "Error al verificar advertencia académica" });
  }
};

/**
 * 5. REGISTRO DE LA DECISIÓN DEL DIRECTIVO SOBRE LA PROMOCIÓN
 */
export const recordDirectiveDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = recordDecisionSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Datos de decisión inválidos", details: parseResult.error.flatten() });
      return;
    }

    const {
      schoolId,
      studentId,
      previousYearId,
      calculatedResult,
      decisionTaken,
      previousGradeId,
      assignedGradeId,
      observation
    } = parseResult.data;

    const user = (req as any).user;
    const userId = user?.id || user?.id_usuario;
    if (!userId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar estado del año lectivo evaluado
    const academicYear = await db
      .selectFrom("anio_lectivo")
      .select(["id_anio", "estado", "calendario"])
      .where("id_anio", "=", previousYearId)
      .executeTakeFirst();

    if (!academicYear) {
      res.status(404).json({ error: "El año lectivo evaluado no existe." });
      return;
    }

    if (academicYear.estado === "CERRADO") {
      res.status(400).json({
        error: `El año lectivo ${academicYear.calendario || previousYearId} se encuentra CERRADO. No es posible registrar ni modificar decisiones de promoción en un ciclo escolar cerrado.`
      });
      return;
    }

    // Verificar períodos del año lectivo evaluado
    const allPeriods = await db
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre", "estado"])
      .where("id_colegio", "=", schoolId)
      .where("id_anio", "=", previousYearId)
      .orderBy("id_periodo", "asc")
      .execute();

    if (allPeriods.length === 0) {
      res.status(400).json({ error: "El año lectivo evaluado no tiene períodos académicos registrados." });
      return;
    }

    const closedPeriodsCount = allPeriods.filter(p => p.estado === "CERRADO").length;
    const totalPeriodsCount = allPeriods.length;

    // Regla de Negocio RN-19.5: Cierre Mínimo de Períodos
    const isAtOrPastFinalPeriod = totalPeriodsCount <= 1 || closedPeriodsCount >= totalPeriodsCount - 1;

    if (!isAtOrPastFinalPeriod) {
      res.status(400).json({
        error: `No es posible registrar la decisión de promoción anual para el año lectivo ${academicYear.calendario} porque apenas se han completado ${closedPeriodsCount} de ${totalPeriodsCount} períodos. La promoción anual únicamente se puede evaluar y registrar cuando el año lectivo se encuentre en su período final o haya culminado todos sus períodos.`
      });
      return;
    }

    // Verificar si el estudiante está en el último grado de la institución
    const maxGradeId = await getMaxGradeIdForSchool(schoolId);
    let targetGradeId = previousGradeId;

    if (!targetGradeId) {
      const studentMat = await db
        .selectFrom("matricula as m")
        .innerJoin("grupos as g", "g.id_grupo", "m.id_grupo")
        .select(["g.id_tipo_grado"])
        .where("m.id_estudiante", "=", studentId)
        .where("m.id_colegio", "=", schoolId)
        .where("m.id_anio", "=", previousYearId)
        .executeTakeFirst();
      if (studentMat) {
        targetGradeId = studentMat.id_tipo_grado;
      }
    }

    const isFinalGradeStudent = maxGradeId != null && targetGradeId === maxGradeId;
    let finalAssignedGradeId = assignedGradeId || null;
    let autoGraduated = false;

    if (decisionTaken === "PROMOVER_SIGUIENTE_GRADO" && isFinalGradeStudent) {
      autoGraduated = true;
      finalAssignedGradeId = null;

      // 1. Actualizar estado del estudiante a GRADUADO
      await db
        .updateTable("estudiante")
        .set({ estado: "GRADUADO" as any })
        .where("id_estudiante", "=", studentId)
        .execute();

      // 2. Insertar o actualizar registro_graduados
      const existingGrad = await db
        .selectFrom("registro_graduados")
        .select("id_graduado")
        .where("id_estudiante", "=", studentId)
        .executeTakeFirst();

      const gradObs = observation || "Graduación procesada automáticamente por decisión de promoción del último año.";

      if (existingGrad) {
        await db
          .updateTable("registro_graduados")
          .set({
            fecha_graduacion: sql`CURRENT_TIMESTAMP`,
            observaciones: gradObs,
            id_usuario_registro: userId,
            id_anio: previousYearId
          })
          .where("id_graduado", "=", existingGrad.id_graduado)
          .execute();
      } else {
        await db
          .insertInto("registro_graduados")
          .values({
            id_estudiante: studentId,
            fecha_graduacion: sql`CURRENT_TIMESTAMP`,
            observaciones: gradObs,
            id_usuario_registro: userId,
            id_anio: previousYearId
          })
          .execute();
      }
    } else if (decisionTaken !== "PROMOVER_SIGUIENTE_GRADO" && isFinalGradeStudent) {
      // Revertir a ACTIVO si el directivo cambia la decisión de un estudiante previamente graduado
      const st = await db
        .selectFrom("estudiante")
        .select("estado")
        .where("id_estudiante", "=", studentId)
        .executeTakeFirst();

      if (st && st.estado === "GRADUADO") {
        await db
          .updateTable("estudiante")
          .set({ estado: "ACTIVO" as any })
          .where("id_estudiante", "=", studentId)
          .execute();
      }
    }

    const existingDecision = await db
      .selectFrom("decision_promocion_directivo")
      .select(["id_decision"])
      .where("id_estudiante", "=", studentId)
      .where("id_colegio", "=", schoolId)
      .where("id_anio_anterior", "=", previousYearId)
      .executeTakeFirst();

    let decisionResult;

    if (existingDecision) {
      decisionResult = await db
        .updateTable("decision_promocion_directivo")
        .set({
          resultado_calculado: calculatedResult as any,
          decision_tomada: decisionTaken as any,
          id_grado_anterior: previousGradeId || null,
          id_grado_asignado: finalAssignedGradeId,
          id_usuario_decision: userId,
          fecha_decision: sql`CURRENT_TIMESTAMP`,
          observacion: observation || (autoGraduated ? "Estudiante promovido y graduado exitosamente del ciclo escolar." : null)
        })
        .where("id_decision", "=", existingDecision.id_decision)
        .returningAll()
        .executeTakeFirst();
    } else {
      decisionResult = await db
        .insertInto("decision_promocion_directivo")
        .values({
          id_colegio: schoolId,
          id_estudiante: studentId,
          id_anio_anterior: previousYearId,
          resultado_calculado: calculatedResult as any,
          decision_tomada: decisionTaken as any,
          id_grado_anterior: previousGradeId || null,
          id_grado_asignado: finalAssignedGradeId,
          id_usuario_decision: userId,
          observacion: observation || (autoGraduated ? "Estudiante promovido y graduado exitosamente del ciclo escolar." : null)
        })
        .returningAll()
        .executeTakeFirst();
    }

    res.json({
      message: autoGraduated 
        ? "¡Estudiante promovido y graduado exitosamente! Su estado ha pasado a GRADUADO."
        : (existingDecision ? "Decisión del directivo actualizada correctamente." : "Decisión del directivo registrada correctamente."),
      decision: decisionResult,
      autoGraduated
    });
  } catch (error) {
    console.error("Error en recordDirectiveDecision:", error);
    res.status(500).json({ error: "Error al registrar la decisión del directivo" });
  }
};

