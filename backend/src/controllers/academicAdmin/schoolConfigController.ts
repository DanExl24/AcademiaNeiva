import { Request, Response } from "express";
import { db } from "../../config/kysely";
import { sql } from "kysely";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { NotificationService } from "../../services/notificationService";
import { validateDocumentUniqueness, normalizeDocument, validateDocumentFormatByTipo } from "../../utils/documentValidation";
import { formatFriendlyErrorMessage } from "../../utils/errorHelper";
import { normalizeGradeName, isDuplicateOrSimilarGrade } from "../../utils/gradeNormalization";
import { getDefaultMonthsLabelForPeriodOrder, getAcademicYearLabel } from "../../config/academicCalendarDefaults";
import {
  DEFAULT_COMPETENCY_TEXT,
  ensureCompetencySchema,
  harmonizeCompetenciesForSchoolYear,
  syncCompetencyAcrossGrade,
  TeachingContext,
} from "../../config/competencyMigration";
import {
  AuthRequest,
  path,
  parseSchoolId,
  ensureTeacherStatusColumn,
  autoSwitchPeriodsForYear,
  ensureAcademicYearForSchool,
  ensureSchoolSettingsTable,
  ensureAcademicPeriodTrimesterColumn,
  ensureAcademicPeriodDayColumns,
  ensureAcademicPeriodMonthColumns,
  ensureAcademicPeriodPendingStatus,
  ensureSchoolDefaultSettings,
  roundToOne,
  syncSchoolScalesAndGrades,
  getUserEligibleAcademicYears,
  isSchoolAccessAllowed
} from "./helpers";

export const getDirectivoDashboard = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const { periodId, yearId: yearIdParam } = req.query;

  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    // 0. Resolve target year
    let targetYearId = yearIdParam ? Number(yearIdParam) : null;
    if (!targetYearId || isNaN(targetYearId)) {
      targetYearId = await ensureAcademicYearForSchool(schoolId);
    }

    const schoolSettings = await ensureSchoolDefaultSettings(schoolId);
    const notaAprobacion = Number(schoolSettings?.nota_aprobacion ?? 3.0);

    // 1. Get active or latest period within the target year if not provided or if invalid for targetYearId
    let targetPeriodId = periodId ? Number(periodId) : null;
    if (targetPeriodId) {
      const validCheck = await db
        .selectFrom("periodo_academico")
        .select("id_periodo")
        .where("id_periodo", "=", targetPeriodId)
        .where("id_anio", "=", targetYearId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();
      if (!validCheck) {
        targetPeriodId = null;
      }
    }

    if (!targetPeriodId) {
      const defaultPeriod = await db
        .selectFrom("periodo_academico")
        .select("id_periodo")
        .where("id_anio", "=", targetYearId)
        .where("id_colegio", "=", schoolId)
        .orderBy(
          sql`CASE WHEN estado = 'ABIERTO' THEN 1 WHEN estado = 'CERRADO' THEN 2 ELSE 3 END`,
          "asc"
        )
        .orderBy("id_periodo", "desc")
        .limit(1)
        .executeTakeFirst();
      if (defaultPeriod) {
        targetPeriodId = defaultPeriod.id_periodo;
      }
    }

    let activePeriodInfo = null;
    if (targetPeriodId) {
      const activePeriodFull = await db
        .selectFrom("periodo_academico as pa")
        .innerJoin("anio_lectivo as al", "pa.id_anio", "al.id_anio")
        .select([
          "pa.id_periodo",
          "pa.nombre",
          "pa.estado",
          "pa.mes_inicio",
          "pa.dia_inicio",
          "pa.mes_fin",
          "pa.dia_fin",
          "pa.id_anio",
          "al.calendario",
          "al.estado as anio_estado",
        ])
        .where("pa.id_periodo", "=", targetPeriodId)
        .executeTakeFirst();
      activePeriodInfo = activePeriodFull || null;
    }

    // 2. Principal Indicators (Counters)
    const [
      studentsCountRes, teachersCountRes, disciplinaryRes, desertionRes,
      studentsByGradeRes, teachersByGradeRes, disciplinaryByGradeRes, desertionByGradeRes
    ] = await Promise.all([
      db.selectFrom("matricula")
        .select(db.fn.count("id_matricula").as("total"))
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", targetYearId)
        .where("estado", "not in", ["CANCELADA", "RECHAZADA", "TRASLADADA"])
        .executeTakeFirst(),
      db.selectFrom("docente")
        .select(db.fn.count("id_docente").as("total"))
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ACTIVO")
        .executeTakeFirst(),
      (() => {
        let q = db.selectFrom("observacion_estudiante")
          .select(db.fn.count("id_observacion").as("total"))
          .where("id_colegio", "=", schoolId)
          .where("tipo", "=", "DISCIPLINARIA");
        if (targetPeriodId) q = q.where("id_periodo", "=", targetPeriodId);
        return q.executeTakeFirst();
      })(),
      db.selectFrom("matricula")
        .select(db.fn.count("id_matricula").as("total"))
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", targetYearId)
        .where("estado", "=", "CANCELADA")
        .executeTakeFirst(),
      db.selectFrom("matricula as m")
        .innerJoin("grupos as g", "m.id_grupo", "g.id_grupo")
        .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
        .select(["tg.nombre as grade", sql<number>`COUNT(m.id_matricula)::int`.as("total")])
        .where("m.id_colegio", "=", schoolId)
        .where("m.id_anio", "=", targetYearId)
        .where("m.estado", "not in", ["CANCELADA", "RECHAZADA", "TRASLADADA"])
        .groupBy("tg.nombre")
        .execute(),
      db.selectFrom("detalle_grados as dg")
        .innerJoin("grupos as g", "dg.id_grupo", "g.id_grupo")
        .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
        .select(["tg.nombre as grade", sql<number>`COUNT(DISTINCT dg.id_docente)::int`.as("total")])
        .where("dg.id_colegio", "=", schoolId)
        .groupBy("tg.nombre")
        .execute(),
      (() => {
        let q = db.selectFrom("observacion_estudiante as o")
          .innerJoin("estudiante as e", "o.id_estudiante", "e.id_estudiante")
          .innerJoin("matricula as m", (join) =>
            join.onRef("e.id_estudiante", "=", "m.id_estudiante").on("m.id_anio", "=", targetYearId)
          )
          .innerJoin("grupos as g", "m.id_grupo", "g.id_grupo")
          .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
          .select(["tg.nombre as grade", sql<number>`COUNT(o.id_observacion)::int`.as("total")])
          .where("o.id_colegio", "=", schoolId)
          .where("o.tipo", "=", "DISCIPLINARIA")
          .where("m.estado", "not in", ["CANCELADA", "RECHAZADA", "TRASLADADA"]);
        if (targetPeriodId) q = q.where("o.id_periodo", "=", targetPeriodId);
        return q.groupBy("tg.nombre").execute();
      })(),
      db.selectFrom("matricula as m")
        .innerJoin("grupos as g", "m.id_grupo", "g.id_grupo")
        .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
        .select(["tg.nombre as grade", sql<number>`COUNT(m.id_matricula)::int`.as("total")])
        .where("m.id_colegio", "=", schoolId)
        .where("m.id_anio", "=", targetYearId)
        .where("m.estado", "=", "CANCELADA")
        .groupBy("tg.nombre")
        .execute(),
    ]);

    // 3. Attendance % Today
    const todayStr = new Date().toLocaleDateString("en-CA");
    const attendanceTodayRes = await sql<{ rate: string | number | null }>`
      SELECT 
        (COUNT(*) FILTER (WHERE estado = 'PRESENTE')::numeric / NULLIF(COUNT(*), 0) * 100) as rate
      FROM registro_asistencia 
      WHERE id_colegio = ${schoolId} AND fecha::date = ${todayStr}::date
    `.execute(db);

    const attendanceByGradeRes = await sql<{ grade: string; rate: string | number | null }>`
      SELECT 
        tg.nombre as grade,
        (COUNT(*) FILTER (WHERE ra.estado = 'PRESENTE')::numeric / NULLIF(COUNT(*), 0) * 100) as rate
      FROM registro_asistencia ra
      JOIN matricula m ON ra.id_estudiante = m.id_estudiante AND m.id_anio = ${targetYearId}
      JOIN grupos g ON m.id_grupo = g.id_grupo
      JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      WHERE ra.id_colegio = ${schoolId} AND ra.fecha::date = ${todayStr}::date AND m.estado NOT IN ('CANCELADA', 'RECHAZADA', 'TRASLADADA')
      GROUP BY tg.nombre
    `.execute(db);

    // Compile summaryByGrade
    const summaryByGrade: Record<string, any> = {};

    studentsByGradeRes.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].totalStudents = Number(r.total);
    });

    teachersByGradeRes.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].totalTeachers = Number(r.total);
    });

    disciplinaryByGradeRes.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].disciplinaryReports = Number(r.total);
    });

    desertionByGradeRes.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].desertionRate = Number(r.total);
    });

    attendanceByGradeRes.rows.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].attendanceToday = Number(Number(r.rate || 0).toFixed(1));    });

    // 4. Academic Performance & Risk (Live calculation fallback)
    let performanceMetrics: { average: number; atRisk: number } = { average: 0, atRisk: 0 };
    
    const buildLiveCTE = (extraCTEs = '') => `
      WITH current_results AS (
        SELECT ra.id_estudiante, ra.id_detallegrado, ra.id_periodo, ra.promedio
        FROM resultado_academico ra
        JOIN detalle_grados dg_ra ON ra.id_detallegrado = dg_ra.id_detallegrado
        JOIN matricula m ON ra.id_estudiante = m.id_estudiante AND m.id_anio = ${targetYearId} AND m.estado NOT IN ('CANCELADA', 'RECHAZADA', 'TRASLADADA')
        WHERE dg_ra.id_colegio = ${schoolId} AND ra.id_periodo = ${targetPeriodId}

        UNION ALL

        SELECT na.id_estudiante, am.id_detallegrado, am.id_periodo,
               ROUND(SUM(na.nota * am.porcentaje / 100.0)::numeric, 2) as promedio
        FROM notas_actividad na
        JOIN actividad_materia am ON na.id_actividadmateria = am.id_actividadmateria
        JOIN matricula m ON na.id_estudiante = m.id_estudiante AND m.id_anio = ${targetYearId} AND m.estado NOT IN ('CANCELADA', 'RECHAZADA', 'TRASLADADA')
        WHERE am.id_periodo = ${targetPeriodId} AND am.id_colegio = ${schoolId}
        AND NOT EXISTS (
          SELECT 1 FROM resultado_academico ra3
          WHERE ra3.id_estudiante = na.id_estudiante
          AND ra3.id_detallegrado = am.id_detallegrado
          AND ra3.id_periodo = am.id_periodo
        )
        GROUP BY na.id_estudiante, am.id_detallegrado, am.id_periodo
      )${extraCTEs}
    `;

    if (targetPeriodId) {
      const perfRes = await sql<any>`
        ${sql.raw(buildLiveCTE())}
        SELECT 
          AVG(promedio) as avg_general,
          COUNT(DISTINCT id_estudiante) FILTER (WHERE promedio < ${notaAprobacion}) as at_risk
        FROM current_results cr
        JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
        WHERE dg.id_colegio = ${schoolId}
      `.execute(db);
      performanceMetrics.average = Number(Number(perfRes.rows[0]?.avg_general || 0).toFixed(2));
      performanceMetrics.atRisk = Number(perfRes.rows[0]?.at_risk || 0);

      const perfByGradeRes = await sql<any>`
        ${sql.raw(buildLiveCTE())}
        SELECT 
          tg.nombre as grade,
          AVG(cr.promedio) as avg_general,
          COUNT(DISTINCT cr.id_estudiante) FILTER (WHERE cr.promedio < ${notaAprobacion}) as at_risk
        FROM current_results cr
        JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
        JOIN grupos g ON dg.id_grupo = g.id_grupo
        JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
        WHERE dg.id_colegio = ${schoolId}
        GROUP BY tg.nombre
      `.execute(db);

      perfByGradeRes.rows.forEach(r => {
        if (!summaryByGrade[r.grade]) {
          summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
        }
        summaryByGrade[r.grade].generalAverage = Number(Number(r.avg_general || 0).toFixed(2));
        summaryByGrade[r.grade].studentsAtRisk = Number(r.at_risk || 0);
      });
    }

    // Calculate approvalRate for summaryByGrade
    Object.keys(summaryByGrade).forEach(g => {
      const tot = summaryByGrade[g].totalStudents || 0;
      const risk = summaryByGrade[g].studentsAtRisk || 0;
      summaryByGrade[g].approvalRate = tot > 0 ? Number(((tot - risk) / tot * 100).toFixed(1)) : 100;
    });

    // 5. Observations & Convivencia Summary
    const obsRes = await sql<any>`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE o.tipo::text IN ('ACADEMICA', 'ACADEMICO'))::int as academicas,
        COUNT(*) FILTER (WHERE o.tipo::text IN ('DISCIPLINARIA', 'DISCIPLINARIO'))::int as disciplinarias,
        COUNT(*) FILTER (WHERE o.tipo::text IN ('CONVIVENCIA', 'CONVIVENCIAL'))::int as convivenciales
      FROM observacion_estudiante o
      JOIN detalle_grados dg ON o.id_detallegrado = dg.id_detallegrado
      WHERE dg.id_colegio = ${schoolId} ${targetPeriodId ? sql`AND o.id_periodo = ${targetPeriodId}` : sql``}
    `.execute(db);

    const sancionRes = await sql<any>`
      SELECT COUNT(DISTINCT s.id_sancion)::int as total
      FROM sancion s
      JOIN estudiante e ON s.id_estudiante = e.id_estudiante
      JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.id_anio = ${targetYearId} AND m.estado NOT IN ('CANCELADA', 'RECHAZADA', 'TRASLADADA')
      JOIN detalle_grados dg ON m.id_grupo = dg.id_grupo
      WHERE dg.id_colegio = ${schoolId} AND s.estado = 'ACTIVA'
    `.execute(db);

    const obsByGradeRes = await sql<any>`
      SELECT 
        tg.nombre as grado,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE o.tipo::text IN ('ACADEMICA', 'ACADEMICO'))::int as academicas,
        COUNT(*) FILTER (WHERE o.tipo::text IN ('DISCIPLINARIA', 'DISCIPLINARIO'))::int as disciplinarias,
        COUNT(*) FILTER (WHERE o.tipo::text IN ('CONVIVENCIA', 'CONVIVENCIAL'))::int as convivenciales
      FROM observacion_estudiante o
      JOIN detalle_grados dg ON o.id_detallegrado = dg.id_detallegrado
      JOIN grupos g ON dg.id_grupo = g.id_grupo
      JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      WHERE dg.id_colegio = ${schoolId} ${targetPeriodId ? sql`AND o.id_periodo = ${targetPeriodId}` : sql``}
      GROUP BY tg.id_tipo_grado, tg.nombre
      ORDER BY tg.id_tipo_grado
    `.execute(db);

    const observationsSummary = {
      total: Number(obsRes.rows[0]?.total || 0),
      academicas: Number(obsRes.rows[0]?.academicas || 0),
      disciplinarias: Number(obsRes.rows[0]?.disciplinarias || 0),
      convivenciales: Number(obsRes.rows[0]?.convivenciales || 0),
      sancionesActivas: Number(sancionRes.rows[0]?.total || 0),
      byGrade: obsByGradeRes.rows
    };

    // 6. Charts Data
    let charts: { performanceByGrade: any[]; performanceBySubject: any[]; performanceByCourse: any[]; performanceBySubjectCourse: any[]; evolution: any[]; evolutionByCourse: any[] } = { 
      performanceByGrade: [], 
      performanceBySubject: [], 
      performanceByCourse: [],
      performanceBySubjectCourse: [],
      evolution: [],
      evolutionByCourse: []
    };
    if (targetPeriodId) {
      const [gradePerfRes, subjectPerfRes, coursePerfRes, subjectCoursePerfRes] = await Promise.all([
        sql<any>`
          ${sql.raw(buildLiveCTE())}
          SELECT tg.nombre, ROUND(AVG(cr.promedio), 2) as average
          FROM current_results cr
          JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
          JOIN grupos g ON dg.id_grupo = g.id_grupo
          JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
          WHERE dg.id_colegio = ${schoolId}
          GROUP BY tg.id_tipo_grado, tg.nombre
          ORDER BY tg.id_tipo_grado
        `.execute(db),
        sql<any>`
          ${sql.raw(buildLiveCTE())}
          SELECT m.nombre, ROUND(AVG(cr.promedio), 2) as average
          FROM current_results cr
          JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
          JOIN materias m ON dg.id_materia = m.id_materia
          WHERE dg.id_colegio = ${schoolId}
          GROUP BY m.id_materia, m.nombre
          ORDER BY average DESC
          LIMIT 10
        `.execute(db),
        sql<any>`
          ${sql.raw(buildLiveCTE())}
          SELECT 
            g.id_grupo,
            tg.nombre as grado_nombre,
            s.nombre as seccion_nombre,
            j.nombre as jornada_nombre,
            ROUND(AVG(cr.promedio), 2) as average
          FROM current_results cr
          JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
          JOIN grupos g ON dg.id_grupo = g.id_grupo
          JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
          JOIN secciones s ON g.id_seccion = s.id_seccion
          JOIN jornada j ON g.id_jornada = j.id_jornada
          WHERE dg.id_colegio = ${schoolId}
          GROUP BY g.id_grupo, tg.nombre, s.nombre, j.nombre
          ORDER BY tg.nombre, LENGTH(s.nombre), s.nombre
        `.execute(db),
        sql<any>`
          ${sql.raw(buildLiveCTE())}
          SELECT 
            g.id_grupo,
            m.nombre as subject_nombre, 
            tg.nombre as grado_nombre,
            s.nombre as seccion_nombre,
            j.nombre as jornada_nombre,
            ROUND(AVG(cr.promedio), 2) as average
          FROM current_results cr
          JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
          JOIN materias m ON dg.id_materia = m.id_materia
          JOIN grupos g ON dg.id_grupo = g.id_grupo
          JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
          JOIN secciones s ON g.id_seccion = s.id_seccion
          JOIN jornada j ON g.id_jornada = j.id_jornada
          WHERE dg.id_colegio = ${schoolId}
          GROUP BY m.id_materia, m.nombre, g.id_grupo, tg.nombre, s.nombre, j.nombre
          ORDER BY tg.nombre, LENGTH(s.nombre), s.nombre, average DESC
        `.execute(db)
      ]);
      charts.performanceByGrade = gradePerfRes.rows.map(r => ({
        nombre: r.nombre,
        average: Number(r.average || 0)
      }));
      charts.performanceBySubject = subjectPerfRes.rows.map(r => ({
        nombre: r.nombre,
        average: Number(r.average || 0)
      }));
      charts.performanceByCourse = coursePerfRes.rows.map(r => ({
        id_grupo: Number(r.id_grupo),
        grado_nombre: r.grado_nombre,
        seccion_nombre: r.seccion_nombre,
        jornada_nombre: r.jornada_nombre,
        average: Number(r.average || 0)
      }));
      charts.performanceBySubjectCourse = subjectCoursePerfRes.rows.map(r => ({
        id_grupo: Number(r.id_grupo),
        subject_nombre: r.subject_nombre,
        grado_nombre: r.grado_nombre,
        seccion_nombre: r.seccion_nombre,
        jornada_nombre: r.jornada_nombre,
        average: Number(r.average || 0)
      }));
    }

    // Evolution (all periods of the current year) - Historical promedios
    // For evolution, we use already calculated averages when possible
    const evolutionRes = await sql<any>`
      SELECT p.nombre, ROUND(AVG(ra.promedio), 2) as average
      FROM resultado_academico ra
      JOIN periodo_academico p ON ra.id_periodo = p.id_periodo
      JOIN detalle_grados dg ON ra.id_detallegrado = dg.id_detallegrado
      WHERE dg.id_colegio = ${schoolId} AND p.id_anio = ${targetYearId}
      GROUP BY p.id_periodo, p.nombre
      ORDER BY p.id_periodo
    `.execute(db);
    charts.evolution = evolutionRes.rows.map(r => ({
      nombre: r.nombre,
      average: Number(r.average || 0)
    }));

    const evolutionByCourseRes = await sql<any>`
      SELECT 
        p.nombre as periodo_nombre, 
        g.id_grupo,
        tg.nombre as grado_nombre,
        s.nombre as seccion_nombre,
        j.nombre as jornada_nombre,
        ROUND(AVG(ra.promedio), 2) as average
      FROM resultado_academico ra
      JOIN periodo_academico p ON ra.id_periodo = p.id_periodo
      JOIN detalle_grados dg ON ra.id_detallegrado = dg.id_detallegrado
      JOIN grupos g ON dg.id_grupo = g.id_grupo
      JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      JOIN secciones s ON g.id_seccion = s.id_seccion
      JOIN jornada j ON g.id_jornada = j.id_jornada
      WHERE dg.id_colegio = ${schoolId} AND p.id_anio = ${targetYearId}
      GROUP BY p.id_periodo, p.nombre, g.id_grupo, tg.nombre, s.nombre, j.nombre
      ORDER BY p.id_periodo, tg.nombre, LENGTH(s.nombre), s.nombre
    `.execute(db);
    charts.evolutionByCourse = evolutionByCourseRes.rows.map(r => ({
      periodo_nombre: r.periodo_nombre,
      id_grupo: Number(r.id_grupo),
      grado_nombre: r.grado_nombre,
      seccion_nombre: r.seccion_nombre,
      jornada_nombre: r.jornada_nombre,
      average: Number(r.average || 0)
    }));

    // 7. Low Performance Analysis Block
    let lowPerformance: {
      criticalSubjects: { 
        nombre: string; 
        failures: number; 
        estudiantes_reprobados: {
          id_estudiante: number;
          nombre_completo: string;
          promedio: number;
          curso: string;
        }[];
      }[];
      gradeAlerts: { nombre: string; alerts: number }[];
      groupRisk: { 
        curso: string; 
        id_grupo: number;
        grado_nombre: string;
        seccion_nombre: string;
        jornada_nombre: string;
        at_risk: number; 
        safe: number; 
      }[];
      studentsAtRiskList: {
        id_estudiante: number;
        nombre_completo: string;
        id_grupo: number;
        grado_nombre: string;
        curso: string;
        materias_reprobadas: number;
        promedio_general: number;
        detalles_materias: { materia_nombre: string; promedio: number }[];
      }[];
    } = {
      criticalSubjects: [],
      gradeAlerts: [],
      groupRisk: [],
      studentsAtRiskList: []
    };

    if (targetPeriodId) {
      const [criticalRes, gradeAlertsRes, groupRiskRes, studentsAtRiskRes] = await Promise.all([
        // Top 5 subjects with most students failing
        sql<any>`
          ${sql.raw(buildLiveCTE())}
          SELECT 
            m.nombre, 
            COUNT(DISTINCT cr.id_estudiante)::int as failures,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'id_estudiante', e.id_estudiante,
                'nombre_completo', e.nombre || ' ' || e.apellido,
                'promedio', cr.promedio,
                'curso', tg.nombre || ' ' || s.nombre
              )
            ) as estudiantes_reprobados
          FROM current_results cr
          JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
          JOIN materias m ON dg.id_materia = m.id_materia
          JOIN estudiante e ON cr.id_estudiante = e.id_estudiante
          JOIN grupos g ON dg.id_grupo = g.id_grupo
          JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
          JOIN secciones s ON g.id_seccion = s.id_seccion
          WHERE dg.id_colegio = ${schoolId} AND cr.promedio < ${notaAprobacion}
          GROUP BY m.id_materia, m.nombre
          ORDER BY failures DESC
          LIMIT 5
        `.execute(db),
        // Concentration of unique students at risk by grade level
        sql<any>`
          ${sql.raw(buildLiveCTE())}
          SELECT tg.nombre, COUNT(DISTINCT cr.id_estudiante) as alerts
          FROM current_results cr
          JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
          JOIN grupos g ON dg.id_grupo = g.id_grupo
          JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
          WHERE dg.id_colegio = ${schoolId} AND cr.promedio < ${notaAprobacion}
          GROUP BY tg.id_tipo_grado, tg.nombre
          ORDER BY alerts DESC
        `.execute(db),
        // Per-group risk: students failing at least one subject vs students passing everything
        sql<any>`
          ${sql.raw(buildLiveCTE(`,
          student_status AS (
            SELECT 
              cr.id_estudiante,
              dg.id_grupo,
              bool_or(cr.promedio < ${notaAprobacion}) as is_at_risk
            FROM current_results cr
            JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
            WHERE dg.id_colegio = ${schoolId}
            GROUP BY cr.id_estudiante, dg.id_grupo
          )`))}
          SELECT 
            g.id_grupo,
            tg.nombre as grado_nombre,
            s.nombre as seccion_nombre,
            j.nombre as jornada_nombre,
            tg.nombre || ' ' || s.nombre as curso,
            COUNT(*) FILTER (WHERE ss.is_at_risk) as at_risk,
            COUNT(*) FILTER (WHERE NOT ss.is_at_risk) as safe
          FROM student_status ss
          JOIN grupos g ON ss.id_grupo = g.id_grupo
          JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
          JOIN secciones s ON g.id_seccion = s.id_seccion
          JOIN jornada j ON g.id_jornada = j.id_jornada
          GROUP BY g.id_grupo, tg.nombre, s.nombre, j.nombre
          ORDER BY at_risk DESC
        `.execute(db),
        sql<any>`
          ${sql.raw(buildLiveCTE())}
          SELECT 
            cr.id_estudiante,
            e.nombre || ' ' || e.apellido as nombre_completo,
            dg.id_grupo,
            tg.nombre as grado_nombre,
            (tg.nombre || ' ' || s.nombre) as curso,
            COUNT(*) FILTER (WHERE cr.promedio < ${notaAprobacion})::int as materias_reprobadas,
            ROUND(AVG(cr.promedio), 2)::numeric as promedio_general,
            JSON_AGG(
              JSON_BUILD_OBJECT('materia_nombre', m.nombre, 'promedio', cr.promedio)
            ) FILTER (WHERE cr.promedio < ${notaAprobacion}) as detalles_materias
          FROM current_results cr
          JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
          JOIN materias m ON dg.id_materia = m.id_materia
          JOIN estudiante e ON cr.id_estudiante = e.id_estudiante
          JOIN grupos g ON dg.id_grupo = g.id_grupo
          JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
          JOIN secciones s ON g.id_seccion = s.id_seccion
          WHERE dg.id_colegio = ${schoolId}
          GROUP BY cr.id_estudiante, e.nombre, e.apellido, dg.id_grupo, tg.nombre, s.nombre
          HAVING bool_or(cr.promedio < ${notaAprobacion})
          ORDER BY materias_reprobadas DESC, promedio_general ASC
        `.execute(db)
      ]);

      lowPerformance.criticalSubjects = criticalRes.rows.map(r => ({
        nombre: r.nombre,
        failures: Number(r.failures),
        estudiantes_reprobados: Array.isArray(r.estudiantes_reprobados) ? r.estudiantes_reprobados : []
      }));
      lowPerformance.gradeAlerts = gradeAlertsRes.rows;
      lowPerformance.groupRisk = groupRiskRes.rows.map(r => ({
        curso: r.curso,
        id_grupo: Number(r.id_grupo),
        grado_nombre: r.grado_nombre,
        seccion_nombre: r.seccion_nombre,
        jornada_nombre: r.jornada_nombre,
        at_risk: Number(r.at_risk),
        safe: Number(r.safe)
      }));
      lowPerformance.studentsAtRiskList = studentsAtRiskRes.rows.map(r => ({
        id_estudiante: Number(r.id_estudiante),
        nombre_completo: r.nombre_completo,
        id_grupo: Number(r.id_grupo),
        grado_nombre: r.grado_nombre,
        curso: r.curso,
        materias_reprobadas: Number(r.materias_reprobadas),
        promedio_general: Number(r.promedio_general),
        detalles_materias: Array.isArray(r.detalles_materias) ? r.detalles_materias : []
      }));
    }

    const totalStuds = Number(studentsCountRes?.total || 0);
    const atRiskStuds = performanceMetrics.atRisk;
    const calcApprovalRate = totalStuds > 0 ? Number(((totalStuds - atRiskStuds) / totalStuds * 100).toFixed(1)) : 100;

    const summaryData = {
      totalStudents: totalStuds,
      totalTeachers: Number(teachersCountRes?.total || 0),
      attendanceToday: Number(Number(attendanceTodayRes?.rows?.[0]?.rate || 0).toFixed(1)),
      generalAverage: performanceMetrics.average,
      approvalRate: calcApprovalRate,
      studentsAtRisk: atRiskStuds,
      disciplinaryReports: Number(disciplinaryRes?.total || 0),
      desertionRate: Number(desertionRes?.total || 0),
    };

    res.json({
      summary: summaryData,
      stats: summaryData,
      summaryByGrade,
      observationsSummary,
      charts,
      lowPerformance,
      activePeriodInfo,
      defaultSettings: schoolSettings
    });
  } catch (error: any) {
    console.error("Error fetching directivo dashboard:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getMySchoolData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  const authReq = req as AuthRequest;
  if (!(await isSchoolAccessAllowed(authReq.user, schoolId))) {
    res.status(403).json({ error: "No tiene permiso para acceder a la información de este colegio." });
    return;
  }

  try {
    const [school, studentsCount, teachersCount, parentsCount] = await Promise.all([
      db.selectFrom("colegio")
        .select([
          "id_colegio",
          "nombre",
          "tipo_colegio",
          "sede",
          "contacto",
          "correo",
          "dane",
          "tipo_calendario",
          "escudo_url",
          "color_primario",
          "color_secundario",
        ])
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst(),
      db.selectFrom("estudiante")
        .select(sql<number>`COUNT(*)::int`.as("count"))
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ACTIVO")
        .executeTakeFirst(),
      db.selectFrom("docente")
        .select(sql<number>`COUNT(*)::int`.as("count"))
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ACTIVO")
        .executeTakeFirst(),
      db.selectFrom("padre_familia")
        .select(sql<number>`COUNT(*)::int`.as("count"))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst(),
    ]);

    if (!school) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }

    res.json({
      ...school,
      school,
      kpis: {
        totalEstudiantes: studentsCount?.count ?? 0,
        totalDocentes: teachersCount?.count ?? 0,
        totalPadres: parentsCount?.count ?? 0,
      }
    });
  } catch (error: any) {
    console.error("Error fetching my school data:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateMySchoolIdentity = async (req: Request, res: Response): Promise<void> => {
  const schoolId = Number(req.params.schoolId);
  const { escudo_url, color_primario, color_secundario, motivo_cambio } = req.body;
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      if (!motivo_cambio) {
        res.status(400).json({ error: "Se requiere justificar el cambio para registrar en la auditoría." });
        return;
      }
      const audit = await db
        .selectFrom("auditoria_supervision")
        .select("id_auditoria")
        .where("id_colegio", "=", schoolId)
        .where("id_admin_general", "=", authReq.user!.id)
        .where("estado_supervision", "=", "ACTIVA")
        .executeTakeFirst();
      if (audit) {
        activeAuditoriaId = audit.id_auditoria;
      }
    }

    const currentVal = await db
      .selectFrom("colegio")
      .select(["escudo_url", "color_primario", "color_secundario"])
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!currentVal) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }

    await db
      .updateTable("colegio")
      .set({
        escudo_url: escudo_url || null,
        color_primario: color_primario || null,
        color_secundario: color_secundario || null,
      })
      .where("id_colegio", "=", schoolId)
      .execute();

    if (activeAuditoriaId) {
      const valorAntiguo = {
        escudo_url: currentVal.escudo_url,
        color_primario: currentVal.color_primario,
        color_secundario: currentVal.color_secundario
      };
      const valorNuevo = {
        escudo_url: escudo_url || null,
        color_primario: color_primario || null,
        color_secundario: color_secundario || null
      };
      
      await db
        .insertInto("auditoria_acciones_realizadas")
        .values({
          id_auditoria: activeAuditoriaId,
          modulo: "CONFIGURACION",
          tipo_accion: "MODIFICACION",
          accion: "Modificación de Identidad Institucional",
          recurso_afectado: `Colegio ID: ${schoolId}`,
          valor_antiguo: JSON.stringify(valorAntiguo),
          valor_nuevo: JSON.stringify(valorNuevo),
          motivo_cambio,
        })
        .execute();
    }

    res.json({ message: "Identidad del colegio actualizada exitosamente" });
  } catch (error: any) {
    console.error("Error updating my school identity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const resetMySchoolIdentity = async (req: Request, res: Response): Promise<void> => {
  const schoolId = Number(req.params.schoolId);
  const { motivo_cambio } = req.body;
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para restablecer la identidad de este colegio." });
    return;
  }

  try {
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      if (!motivo_cambio) {
        res.status(400).json({ error: "Se requiere justificar el cambio para registrar en la auditoría." });
        return;
      }
      const audit = await db
        .selectFrom("auditoria_supervision")
        .select("id_auditoria")
        .where("id_colegio", "=", schoolId)
        .where("id_admin_general", "=", authReq.user!.id)
        .where("estado_supervision", "=", "ACTIVA")
        .executeTakeFirst();
      if (audit) {
        activeAuditoriaId = audit.id_auditoria;
      }
    }

    const currentVal = await db
      .selectFrom("colegio")
      .select(["escudo_url", "color_primario", "color_secundario"])
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!currentVal) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }

    await db
      .updateTable("colegio")
      .set({
        escudo_url: null,
        color_primario: null,
        color_secundario: null,
      })
      .where("id_colegio", "=", schoolId)
      .execute();

    if (activeAuditoriaId) {
      const valorAntiguo = {
        escudo_url: currentVal.escudo_url,
        color_primario: currentVal.color_primario,
        color_secundario: currentVal.color_secundario
      };
      const valorNuevo = {
        escudo_url: null,
        color_primario: null,
        color_secundario: null
      };
      
      await db
        .insertInto("auditoria_acciones_realizadas")
        .values({
          id_auditoria: activeAuditoriaId,
          modulo: "CONFIGURACION",
          tipo_accion: "MODIFICACION",
          accion: "Restablecer Identidad Institucional por defecto",
          recurso_afectado: `Colegio ID: ${schoolId}`,
          valor_antiguo: JSON.stringify(valorAntiguo),
          valor_nuevo: JSON.stringify(valorNuevo),
          motivo_cambio,
        })
        .execute();
    }

    res.json({ message: "Identidad del colegio restablecida por defecto" });
  } catch (error: any) {
    console.error("Error resetting my school identity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const uploadMySchoolEscudo = async (req: Request, res: Response): Promise<void> => {
  const schoolId = Number(req.params.schoolId);
  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para gestionar el escudo de este colegio." });
    return;
  }

  try {
    const reqAny = req as any;
    if (!reqAny.file) {
      res.status(400).json({ error: 'No se ha subido ningún archivo' });
      return;
    }

    const ext = reqAny.file.originalname ? path.extname(reqAny.file.originalname).toLowerCase() : '';
    const allowedExts = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
    if (ext && !allowedExts.includes(ext) && !reqAny.file.mimetype?.startsWith('image/')) {
      res.status(400).json({ error: 'Formato no soportado. Solo se permiten JPG, JPEG, PNG, SVG y WEBP.' });
      return;
    }

    const mimeType = reqAny.file.mimetype || 'image/png';
    const base64Data = reqAny.file.buffer.toString('base64');
    const fileUrl = `data:${mimeType};base64,${base64Data}`;

    res.json({ url: fileUrl });
  } catch (error: any) {
    console.error('Error al subir escudo:', error);
    res.status(500).json({ error: 'Error al subir el escudo del colegio' });
  }
};

export const updateSchoolDefaultSettings = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const notaMinima = roundToOne(Number(req.body.nota_minima));
  const notaMaxima = roundToOne(Number(req.body.nota_maxima));
  const notaAprobacion = roundToOne(Number(req.body.nota_aprobacion));
  const requestedScaleMode = String(req.body.escala_modo || "").trim().toUpperCase();

  if (!schoolId || Number.isNaN(notaMinima) || Number.isNaN(notaMaxima) || Number.isNaN(notaAprobacion)) {
    res.status(400).json({ error: "Todos los valores de configuración son obligatorios" });
    return;
  }

  const yearId = req.body.yearId ? Number(req.body.yearId) : null;
  if (yearId && schoolId) {
    const yearCheck = await db
      .selectFrom("anio_lectivo")
      .select(["estado", "calendario"])
      .where("id_anio", "=", yearId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (yearCheck?.estado === 'CERRADO') {
      res.status(400).json({ 
        error: `El año lectivo ${yearCheck.calendario || ''} se encuentra CERRADO. No es posible modificar la configuración en un ciclo escolar cerrado.` 
      });
      return;
    }
  }

  if (notaMinima >= notaMaxima) {
    res.status(400).json({ error: "La nota mínima debe ser menor que la nota máxima" });
    return;
  }

  if (notaAprobacion < notaMinima || notaAprobacion > notaMaxima) {
    res.status(400).json({ error: "La nota aprobatoria debe estar dentro del rango configurado" });
    return;
  }

  if (requestedScaleMode && !["AUTOMATICO", "MANUAL"].includes(requestedScaleMode)) {
    res.status(400).json({ error: "El modo de escalas es inválido" });
    return;
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      await ensureSchoolSettingsTable();

      const existingSettingsRes = await trx
        .selectFrom("configuracion_colegio")
        .select([
          "nota_minima",
          "nota_maxima",
          "nota_aprobacion",
          "escala_modo",
          sql<number>`COALESCE(materias_reprobatorias_promocion, 3)`.as("materias_reprobatorias_promocion")
        ])
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      const previous =
        existingSettingsRes ??
        (await ensureSchoolDefaultSettings(schoolId));
      const nextScaleMode = (requestedScaleMode || previous.escala_modo || "AUTOMATICO") as "AUTOMATICO" | "MANUAL";
      const nextMateriasReprobatorias = req.body.materias_reprobatorias_promocion !== undefined && !Number.isNaN(Number(req.body.materias_reprobatorias_promocion))
        ? Math.max(1, Math.min(10, Math.round(Number(req.body.materias_reprobatorias_promocion))))
        : Number(previous.materias_reprobatorias_promocion || 3);

      const currentScalesRes = await trx
        .selectFrom("escala_valoracion")
        .select(["nivel", "valor_maximo"])
        .where("id_colegio", "=", schoolId)
        .execute();

      const currentBasic = currentScalesRes.find((row) => row.nivel === "BASICO");
      const currentHigh = currentScalesRes.find((row) => row.nivel === "ALTO");

      const updated = await trx
        .insertInto("configuracion_colegio")
        .values({
          id_colegio: schoolId,
          nota_minima: notaMinima,
          nota_maxima: notaMaxima,
          nota_aprobacion: notaAprobacion,
          escala_modo: nextScaleMode,
          materias_reprobatorias_promocion: nextMateriasReprobatorias,
        })
        .onConflict((oc) =>
          oc.column("id_colegio").doUpdateSet({
            nota_minima: notaMinima,
            nota_maxima: notaMaxima,
            nota_aprobacion: notaAprobacion,
            escala_modo: nextScaleMode,
            materias_reprobatorias_promocion: nextMateriasReprobatorias,
          })
        )
        .returning([
          "id_colegio",
          "nota_minima",
          "nota_maxima",
          "nota_aprobacion",
          "escala_modo",
          "materias_reprobatorias_promocion"
        ])
        .executeTakeFirstOrThrow();

      const scalesChanged =
        Number(previous.nota_minima) !== notaMinima ||
        Number(previous.nota_maxima) !== notaMaxima ||
        Number(previous.nota_aprobacion) !== notaAprobacion ||
        (previous.escala_modo || "AUTOMATICO") !== nextScaleMode;

      let syncedScales;
      if (scalesChanged) {
        syncedScales = await syncSchoolScalesAndGrades(
          trx,
          schoolId,
          Number(previous.nota_minima),
          Number(previous.nota_maxima),
          notaMinima,
          notaMaxima,
          notaAprobacion,
          nextScaleMode,
          nextScaleMode === "MANUAL"
            ? {
                basicMax: currentBasic ? Number(currentBasic.valor_maximo) : undefined,
                altoMax: currentHigh ? Number(currentHigh.valor_maximo) : undefined,
              }
            : undefined
        );
      } else {
        syncedScales = await trx
          .selectFrom("escala_valoracion")
          .select(["id_escalavaloracion", "nivel", "valor_minimo", "valor_maximo"])
          .where("id_colegio", "=", schoolId)
          .orderBy("valor_minimo", "asc")
          .execute();
      }

      return { updated, syncedScales };
    });

    res.json({
      ...result.updated,
      scales: result.syncedScales,
      message: "Configuración institucional aplicada y notas sincronizadas correctamente",
    });
  } catch (error: any) {
    console.error("Error updating school default settings:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updatePromotionPolicy = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const rawMaterias = Number(req.body.materias_reprobatorias_promocion);

  if (!schoolId || Number.isNaN(rawMaterias) || rawMaterias < 1 || rawMaterias > 10) {
    res.status(400).json({ error: "Debe especificar un número válido de materias reprobatorias entre 1 y 10" });
    return;
  }

  const materiasReprobatorias = Math.round(rawMaterias);
  const yearId = req.body.yearId ? Number(req.body.yearId) : null;

  if (yearId && schoolId) {
    const yearCheck = await db
      .selectFrom("anio_lectivo")
      .select(["estado", "calendario"])
      .where("id_anio", "=", yearId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (yearCheck?.estado === 'CERRADO') {
      res.status(400).json({ 
        error: `El año lectivo ${yearCheck.calendario || ''} se encuentra CERRADO. No es posible modificar la política de promoción en un ciclo escolar cerrado.` 
      });
      return;
    }
  }

  try {
    await ensureSchoolSettingsTable();
    await ensureSchoolDefaultSettings(schoolId);

    const updated = await db
      .updateTable("configuracion_colegio")
      .set({ materias_reprobatorias_promocion: materiasReprobatorias })
      .where("id_colegio", "=", schoolId)
      .returning([
        "id_colegio",
        "nota_minima",
        "nota_maxima",
        "nota_aprobacion",
        "escala_modo",
        "materias_reprobatorias_promocion"
      ])
      .executeTakeFirstOrThrow();

    res.json({
      success: true,
      ...updated,
      message: "Criterio de promoción institucional (S.I.E.E.) actualizado correctamente"
    });
  } catch (error: any) {
    console.error("Error updating promotion policy:", error);
    res.status(500).json({ error: "Error al actualizar la política de promoción" });
  }
};

export const getEnrollmentConfig = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const yearId = Number(req.params.yearId);
  if (!schoolId || !yearId) {
    res.status(400).json({ error: "Colegio o año lectivo inválido" });
    return;
  }

  try {
    const config = await db
      .selectFrom("configuracion_inscripcion")
      .select([
        "id_configuracion",
        "id_colegio",
        "id_anio",
        "fecha_inicio",
        "fecha_cierre",
        "habilitada"
      ])
      .where("id_colegio", "=", schoolId)
      .where("id_anio", "=", yearId)
      .executeTakeFirst();

    const hasApproved = false;

    if (config) {
      res.json({
        ...config,
        hasApproved
      });
    } else {
      res.json({
        id_configuracion: null,
        id_colegio: schoolId,
        id_anio: yearId,
        fecha_inicio: null,
        fecha_cierre: null,
        habilitada: true,
        hasApproved
      });
    }
  } catch (error: any) {
    console.error("Error in getEnrollmentConfig:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const saveEnrollmentConfig = async (req: Request, res: Response): Promise<void> => {
  const { id_colegio, id_anio, fecha_inicio, fecha_cierre, habilitada, motivo_cambio } = req.body;
  
  if (!id_colegio || !id_anio || !fecha_inicio || !fecha_cierre) {
    res.status(400).json({ error: "Todos los campos (colegio, año, fecha de inicio y cierre) son obligatorios." });
    return;
  }

  const start = new Date(fecha_inicio);
  const end = new Date(fecha_cierre);

  if (end <= start) {
    res.status(400).json({ error: "La fecha de cierre debe ser posterior a la fecha de inicio." });
    return;
  }

  // Validate that enrollment dates match the year of the target academic year
  try {
    const yearInfo = await db
      .selectFrom("anio_lectivo")
      .select("calendario")
      .where("id_anio", "=", id_anio)
      .where("id_colegio", "=", id_colegio)
      .executeTakeFirst();

    if (yearInfo) {
      const calStr = yearInfo.calendario || '';
      const yearMatch = calStr.match(/\d{4}/g);
      if (yearMatch && yearMatch.length > 0) {
        const allowedYears = yearMatch.map((y: string) => parseInt(y));
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        if (!allowedYears.includes(startYear) || !allowedYears.includes(endYear)) {
          res.status(400).json({ 
            error: `Las fechas de inscripción deben corresponder al año lectivo ${calStr} (año en fecha de inicio: ${startYear}, en cierre: ${endYear}).` 
          });
          return;
        }
      }
    }
  } catch (err) {
    console.error("Error validating academic year dates:", err);
  }

  try {
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      if (!motivo_cambio) {
        res.status(400).json({ error: "Se requiere justificar el cambio para registrar en la auditoría." });
        return;
      }
      const audit = await db
        .selectFrom("auditoria_supervision")
        .select("id_auditoria")
        .where("id_colegio", "=", id_colegio)
        .where("id_admin_general", "=", authReq.user!.id)
        .where("estado_supervision", "=", "ACTIVA")
        .executeTakeFirst();
      if (audit) {
        activeAuditoriaId = audit.id_auditoria;
      }
    }

    // Fetch existing configuration for audit logging
    const oldConfig = await db
      .selectFrom("configuracion_inscripcion")
      .select(["fecha_inicio", "fecha_cierre", "habilitada"])
      .where("id_colegio", "=", id_colegio)
      .where("id_anio", "=", id_anio)
      .executeTakeFirst();

    // Save/Update config
    const newConfig = await db
      .insertInto("configuracion_inscripcion")
      .values({
        id_colegio,
        id_anio,
        fecha_inicio,
        fecha_cierre,
        habilitada: habilitada !== undefined ? Boolean(habilitada) : true,
      })
      .onConflict((oc) =>
        oc.columns(["id_colegio", "id_anio"]).doUpdateSet({
          fecha_inicio,
          fecha_cierre,
          habilitada: habilitada !== undefined ? Boolean(habilitada) : true,
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    // Logging action if supervised
    if (activeAuditoriaId) {
      await db
        .insertInto("auditoria_acciones_realizadas")
        .values({
          id_auditoria: activeAuditoriaId,
          modulo: "CONFIGURACION",
          tipo_accion: "MODIFICACION",
          accion: "Modificación de Fechas de Inscripción",
          recurso_afectado: `Colegio ID: ${id_colegio}, Año ID: ${id_anio}`,
          valor_antiguo: oldConfig ? JSON.stringify(oldConfig) : null,
          valor_nuevo: JSON.stringify(newConfig),
          motivo_cambio,
        })
        .execute();
    }

    res.json({ message: "Configuración de inscripción guardada exitosamente", config: newConfig });
  } catch (error: any) {
    console.error("Error in saveEnrollmentConfig:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getActivePeriodInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const schoolId = req.query.schoolId 
      ? Number(req.query.schoolId) 
      : (authUser?.schoolId ? Number(authUser.schoolId) : (authUser?.id_colegio ? Number(authUser.id_colegio) : null));
    const yearId = req.query.yearId ? Number(req.query.yearId) : null;

    let query = db
      .selectFrom("periodo_academico as pa")
      .innerJoin("anio_lectivo as al", "pa.id_anio", "al.id_anio")
      .select([
        "pa.id_periodo",
        "pa.nombre",
        "pa.estado",
        "pa.mes_inicio",
        "pa.dia_inicio",
        "pa.mes_fin",
        "pa.dia_fin",
        "pa.id_anio",
        "al.calendario",
        "al.estado as anio_estado",
      ])
      .where("pa.estado", "=", "ABIERTO");

    if (schoolId) {
      query = query.where("pa.id_colegio", "=", schoolId);
    }

    if (yearId) {
      query = query.where("pa.id_anio", "=", yearId);
    }

    const activePeriod = await query
      .orderBy("pa.id_periodo", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!activePeriod) {
      res.json({ activePeriod: null });
      return;
    }

    res.json({ activePeriod });
  } catch (error: any) {
    console.error("Error in getActivePeriodInfo:", error);
    res.status(500).json({ error: "Error al obtener periodo activo" });
  }
};


