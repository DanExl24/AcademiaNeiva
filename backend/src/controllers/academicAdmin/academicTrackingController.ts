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

interface SubjectAccumulator {
  materia_nombre: string;
  docente_nombre: string;
  notasPerPeriod: Record<number, number>;
}

interface AnnualSubjectAccumulator {
  materia_nombre: string;
  docente_nombre: string;
  periodos: Record<number, number>;
}

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

    // Obtener períodos del año
    const periodsInYear = await db
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre"])
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
      .select([
        "e.id_estudiante",
        "u.nombre",
        "u.apellido",
        "u.documento",
        "m.id_grupo",
        "s.nombre as grupo_nombre",
        "tg.id_tipo_grado as id_grado",
        "tg.nombre as grado_nombre"
      ])
      .where("m.id_colegio", "=", schoolId)
      .where("m.id_anio", "=", yearId)
      .where("m.estado", "not in", ["CANCELADA", "RECHAZADA"]);

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
        reprobados_count: 0,
        min_passing_score: minPassingScore,
        periodos_analizados: targetPeriodIds,
        estudiantes: students.map(s => ({
          id_estudiante: s.id_estudiante,
          nombre: s.nombre,
          apellido: s.apellido,
          documento: s.documento,
          grado_nombre: s.grado_nombre || "Sin Grado",
          grupo_nombre: s.grupo_nombre || "Sin Grupo",
          estado_academico: "APROBADO",
          cantidad_reprobadas: 0,
          asignaturas_reprobadas: [],
          todas_asignaturas: []
        }))
      });
      return;
    }

    const studentIds = students.map(s => s.id_estudiante);

    // Consulta de notas por actividad
    const gradesData = await db
      .selectFrom("notas_actividad as na")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
      .innerJoin("materias as mat", "mat.id_materia", "dg.id_materia")
      .leftJoin("docente as d", "d.id_docente", "dg.id_docente")
      .leftJoin("usuario as ud", "ud.id_usuario", "d.id_usuario")
      .select([
        "na.id_estudiante",
        "am.id_periodo",
        "dg.id_materia",
        "mat.nombre as materia_nombre",
        sql<string>`MAX(COALESCE(ud.nombre || ' ' || ud.apellido, 'Sin Asignar'))`.as("docente_nombre"),
        sql<number>`COALESCE(SUM(na.nota * am.porcentaje / 100.0), 0)`.as("nota_ponderada_actividades")
      ])
      .where("na.id_estudiante", "in", studentIds)
      .where("am.id_periodo", "in", targetPeriodIds)
      .groupBy([
        "na.id_estudiante",
        "am.id_periodo",
        "dg.id_materia",
        "mat.nombre"
      ])
      .execute();

    const studentGradesMap: Record<number, Record<number, SubjectAccumulator>> = {};

    for (const row of gradesData) {
      const stId = Number(row.id_estudiante);
      const matId = Number(row.id_materia);
      const perId = Number(row.id_periodo);
      const nota = parseFloat(String(row.nota_ponderada_actividades || 0));

      if (!studentGradesMap[stId]) studentGradesMap[stId] = {};
      if (!studentGradesMap[stId][matId]) {
        studentGradesMap[stId][matId] = {
          materia_nombre: row.materia_nombre,
          docente_nombre: row.docente_nombre,
          notasPerPeriod: {}
        };
      }
      studentGradesMap[stId][matId].notasPerPeriod[perId] = nota;
    }

    let aprobadosCount = 0;
    let reprobadosCount = 0;

    const studentResults = students.map(student => {
      const stId = student.id_estudiante;
      const subjectsMap = studentGradesMap[stId] || {};
      
      const failedSubjects: any[] = [];
      const allSubjects: any[] = [];

      for (const [matIdStr, subjectData] of Object.entries(subjectsMap)) {
        const matId = Number(matIdStr);
        const periodScores = Object.values(subjectData.notasPerPeriod) as number[];
        
        const avgGrade = periodScores.length > 0
          ? parseFloat((periodScores.reduce((a: number, b: number) => a + b, 0) / periodScores.length).toFixed(2))
          : 0;

        const isFailed = avgGrade < minPassingScore;

        const subjectItem = {
          id_materia: matId,
          materia_nombre: subjectData.materia_nombre,
          docente_nombre: subjectData.docente_nombre,
          calificacion: avgGrade,
          estado_materia: isFailed ? "REPROBADA" : "APROBADA"
        };

        allSubjects.push(subjectItem);
        if (isFailed) {
          failedSubjects.push(subjectItem);
        }
      }

      const estadoAcademico = failedSubjects.length > 0 ? "REPROBADO" : "APROBADO";
      if (estadoAcademico === "APROBADO") aprobadosCount++;
      else reprobadosCount++;

      return {
        id_estudiante: student.id_estudiante,
        nombre: student.nombre,
        apellido: student.apellido,
        documento: student.documento,
        grado_nombre: student.grado_nombre || "Sin Grado",
        grupo_nombre: student.grupo_nombre || "Sin Grupo",
        estado_academico: estadoAcademico,
        cantidad_reprobadas: failedSubjects.length,
        asignaturas_reprobadas: failedSubjects,
        todas_asignaturas: allSubjects
      };
    });

    res.json({
      total_estudiantes: students.length,
      aprobados_count: aprobadosCount,
      reprobados_count: reprobadosCount,
      min_passing_score: minPassingScore,
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

    const yearPeriods = await db
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre"])
      .where("id_colegio", "=", schoolId)
      .where("id_anio", "=", yearId)
      .execute();

    const periodIds = yearPeriods.map(p => p.id_periodo);

    let query = db
      .selectFrom("matricula as m")
      .innerJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .innerJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .leftJoin("grupos as g", "g.id_grupo", "m.id_grupo")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .select([
        "e.id_estudiante",
        "u.nombre",
        "u.apellido",
        "u.documento",
        "m.id_grupo",
        "s.nombre as grupo_nombre",
        "tg.id_tipo_grado as id_grado",
        "tg.nombre as grado_nombre"
      ])
      .where("m.id_colegio", "=", schoolId)
      .where("m.id_anio", "=", yearId)
      .where("m.estado", "not in", ["CANCELADA", "RECHAZADA"]);

    if (gradeId) query = query.where("tg.id_tipo_grado", "=", gradeId);
    if (groupId) query = query.where("m.id_grupo", "=", groupId);

    const students = await query.orderBy("u.apellido", "asc").execute();
    const studentIds = students.map(s => s.id_estudiante);

    if (students.length === 0) {
      res.json({
        total_estudiantes: 0,
        promovidos_count: 0,
        no_promovidos_count: 0,
        pendientes_count: 0,
        min_passing_score: minPassingScore,
        estudiantes: []
      });
      return;
    }

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

    const gradesData = (studentIds.length > 0 && periodIds.length > 0)
      ? await db
          .selectFrom("notas_actividad as na")
          .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
          .innerJoin("materias as mat", "mat.id_materia", "dg.id_materia")
          .leftJoin("docente as d", "d.id_docente", "dg.id_docente")
          .leftJoin("usuario as ud", "ud.id_usuario", "d.id_usuario")
          .select([
            "na.id_estudiante",
            "am.id_periodo",
            "dg.id_materia",
            "mat.nombre as materia_nombre",
            sql<string>`MAX(COALESCE(ud.nombre || ' ' || ud.apellido, 'Sin Asignar'))`.as("docente_nombre"),
            sql<number>`COALESCE(SUM(na.nota * am.porcentaje / 100.0), 0)`.as("nota_ponderada")
          ])
          .where("na.id_estudiante", "in", studentIds)
          .where("am.id_periodo", "in", periodIds)
          .groupBy([
            "na.id_estudiante",
            "am.id_periodo",
            "dg.id_materia",
            "mat.nombre"
          ])
          .execute()
      : [];

    const gradesMap: Record<number, Record<number, AnnualSubjectAccumulator>> = {};
    
    for (const row of gradesData) {
      const stId = Number(row.id_estudiante);
      const matId = Number(row.id_materia);
      const perId = Number(row.id_periodo);
      const nota = parseFloat(String(row.nota_ponderada || 0));

      if (!gradesMap[stId]) gradesMap[stId] = {};
      if (!gradesMap[stId][matId]) {
        gradesMap[stId][matId] = {
          materia_nombre: row.materia_nombre,
          docente_nombre: row.docente_nombre,
          periodos: {}
        };
      }
      gradesMap[stId][matId].periodos[perId] = nota;
    }

    let promovidosCount = 0;
    let noPromovidosCount = 0;
    let pendientesCount = 0;

    const studentConsolidated = students.map(student => {
      const stId = student.id_estudiante;
      const subjects = gradesMap[stId] || {};

      const failedSubjects: any[] = [];
      const allSubjects: any[] = [];

      for (const [matIdStr, subjectData] of Object.entries(subjects)) {
        const matId = Number(matIdStr);
        const scores = Object.values(subjectData.periodos) as number[];
        const annualAvg = scores.length > 0
          ? parseFloat((scores.reduce((a: number, b: number) => a + b, 0) / Math.max(yearPeriods.length, 1)).toFixed(2))
          : 0;

        const isFailed = annualAvg < minPassingScore;

        const item = {
          id_materia: matId,
          materia_nombre: subjectData.materia_nombre,
          docente_nombre: subjectData.docente_nombre,
          promedio_anual: annualAvg,
          periodos_registrados: Object.keys(subjectData.periodos).length,
          estado: isFailed ? "REPROBADA" : "APROBADA"
        };

        allSubjects.push(item);
        if (isFailed) {
          failedSubjects.push(item);
        }
      }

      let resultadoAnual = "APROBADO";
      if (failedSubjects.length >= 3) {
        resultadoAnual = "NO_PROMOVIDO";
      } else if (failedSubjects.length > 0) {
        resultadoAnual = "PENDIENTE_RECUPERACION";
      }

      if (resultadoAnual === "APROBADO") promovidosCount++;
      else if (resultadoAnual === "NO_PROMOVIDO") noPromovidosCount++;
      else pendientesCount++;

      return {
        id_estudiante: student.id_estudiante,
        nombre: student.nombre,
        apellido: student.apellido,
        documento: student.documento,
        grado_nombre: student.grado_nombre || "Sin Grado",
        grupo_nombre: student.grupo_nombre || "Sin Grupo",
        resultado_anual: resultadoAnual,
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

    const enrollments = await db
      .selectFrom("matricula as m")
      .innerJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
      .leftJoin("grupos as g", "g.id_grupo", "m.id_grupo")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("decision_promocion_directivo as dpd", (join: any) =>
        join
          .onRef("dpd.id_estudiante", "=", "m.id_estudiante")
          .onRef("dpd.id_anio_anterior", "=", "m.id_anio")
      )
      .select([
        "m.id_matricula",
        "m.id_anio",
        "al.calendario",
        "al.fecha_inicio",
        "al.fecha_fin",
        "tg.nombre as grado_nombre",
        "s.nombre as grupo_nombre",
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
      .select([
        "m.id_matricula",
        "m.id_colegio",
        "m.id_anio",
        "al.calendario",
        "tg.id_tipo_grado as id_grado",
        "tg.nombre as grado_nombre",
        "s.nombre as grupo_nombre"
      ])
      .where("m.id_estudiante", "=", user.id_estudiante)
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

    if (periodIds.length > 0) {
      const gradesData = await db
        .selectFrom("notas_actividad as na")
        .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
        .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
        .innerJoin("materias as mat", "mat.id_materia", "dg.id_materia")
        .select([
          "dg.id_materia",
          "mat.nombre as materia_nombre",
          sql<number>`COALESCE(SUM(na.nota * am.porcentaje / 100.0), 0)`.as("nota_ponderada")
        ])
        .where("na.id_estudiante", "=", user.id_estudiante)
        .where("am.id_periodo", "in", periodIds)
        .groupBy(["dg.id_materia", "mat.nombre"])
        .execute();

      const subjectScores: Record<number, { materia_nombre: string; total: number; count: number }> = {};
      for (const row of gradesData) {
        const matId = Number(row.id_materia);
        if (!subjectScores[matId]) {
          subjectScores[matId] = { materia_nombre: row.materia_nombre, total: 0, count: 0 };
        }
        subjectScores[matId].total += parseFloat(String(row.nota_ponderada || 0));
        subjectScores[matId].count += 1;
      }

      for (const [matId, data] of Object.entries(subjectScores)) {
        const avg = data.count > 0 ? parseFloat((data.total / Math.max(periodIds.length, 1)).toFixed(2)) : 0;
        if (avg < minPassingScore) {
          failedSubjectsCount++;
          failedSubjectsList.push({
            id_materia: Number(matId),
            materia_nombre: data.materia_nombre,
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

    res.json({
      exists: true,
      warning: isNotPromoted,
      estudiante: user,
      ultima_matricula: lastEnrollment,
      resultado_calculado: isNotPromoted ? "NO_PROMOVIDO" : (failedSubjectsCount > 0 ? "PENDIENTE_RECUPERACION" : "APROBADO"),
      cantidad_materias_reprobadas: failedSubjectsCount,
      materias_reprobadas: failedSubjectsList,
      decision_existente: existingDecision || null
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

    // Regla de Negocio: Para registrar la decisión de promoción anual, el año lectivo debe:
    // 1) Haber cerrado al menos N-1 períodos (ej: tener cerrados P1, P2 y P3 para estar evaluando P4), O
    // 2) Haber completado/cerrado TODOS los períodos del año.
    // Aunque el directivo haya cerrado el año antes de tiempo, si solo pasaron 1 o 2 períodos de 4, no es válido promocionar.
    const isAtOrPastFinalPeriod = totalPeriodsCount <= 1 || closedPeriodsCount >= totalPeriodsCount - 1;

    if (!isAtOrPastFinalPeriod) {
      res.status(400).json({
        error: `No es posible registrar la decisión de promoción anual para el año lectivo ${academicYear.calendario} porque apenas se han completado ${closedPeriodsCount} de ${totalPeriodsCount} períodos. La promoción anual únicamente se puede evaluar y registrar cuando el año lectivo se encuentre en su 4° período final o haya culminado todos sus períodos.`
      });
      return;
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
          id_grado_asignado: assignedGradeId || null,
          id_usuario_decision: userId,
          fecha_decision: sql`CURRENT_TIMESTAMP`,
          observacion: observation || null
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
          id_grado_asignado: assignedGradeId || null,
          id_usuario_decision: userId,
          observacion: observation || null
        })
        .returningAll()
        .executeTakeFirst();
    }

    res.json({
      message: existingDecision ? "Decisión del directivo actualizada correctamente." : "Decisión del directivo registrada correctamente.",
      decision: decisionResult
    });
  } catch (error) {
    console.error("Error en recordDirectiveDecision:", error);
    res.status(500).json({ error: "Error al registrar la decisión del directivo" });
  }
};
