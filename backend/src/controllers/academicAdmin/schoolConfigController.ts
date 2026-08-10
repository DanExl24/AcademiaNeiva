import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../../config/db";
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

    // 1. Get active period within the target year if not provided or if invalid for targetYearId
    let targetPeriodId = periodId ? Number(periodId) : null;
    if (targetPeriodId) {
      const validCheck = await pool.query(
        `SELECT id_periodo FROM periodo_academico WHERE id_periodo = $1 AND id_anio = $2 AND id_colegio = $3`,
        [targetPeriodId, targetYearId, schoolId]
      );
      if (validCheck.rows.length === 0) {
        targetPeriodId = null;
      }
    }
    if (!targetPeriodId) {
      const activePeriodRes = await pool.query(
        `SELECT id_periodo FROM periodo_academico WHERE id_colegio = $1 AND id_anio = $2 AND estado = 'ABIERTO' ORDER BY id_periodo DESC LIMIT 1`,
        [schoolId, targetYearId]
      );
      if (activePeriodRes.rows.length > 0) {
        targetPeriodId = activePeriodRes.rows[0].id_periodo;
      } else {
        // Fallback to the most recent period in this year even if not open
        const lastPeriodRes = await pool.query(
          `SELECT id_periodo FROM periodo_academico WHERE id_colegio = $1 AND id_anio = $2 ORDER BY id_periodo DESC LIMIT 1`,
          [schoolId, targetYearId]
        );
        targetPeriodId = lastPeriodRes.rows.length > 0 ? lastPeriodRes.rows[0].id_periodo : null;
      }
    }

    // 2. Principal Indicators (Counters)
    const [
      studentsCountRes, teachersCountRes, disciplinaryRes, desertionRes,
      studentsByGradeRes, teachersByGradeRes, disciplinaryByGradeRes, desertionByGradeRes
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total FROM matricula WHERE id_colegio = $1 AND id_anio = $2 AND estado = 'ACTIVA'`, [schoolId, targetYearId]),
      pool.query("SELECT COUNT(*) as total FROM docente WHERE id_colegio = $1 AND estado = 'ACTIVO'", [schoolId]),
      pool.query(
        `SELECT COUNT(*) as total FROM observacion_estudiante 
         WHERE id_colegio = $1 AND tipo = 'DISCIPLINARIA' ${targetPeriodId ? "AND id_periodo = $2" : ""}`,
        targetPeriodId ? [schoolId, targetPeriodId] : [schoolId]
      ),
      pool.query(
        `SELECT COUNT(*) as total FROM matricula WHERE id_colegio = $1 AND id_anio = $2 AND estado = 'CANCELADA'`,
        [schoolId, targetYearId]
      ),
      pool.query(
        `SELECT tg.nombre as grade, COUNT(m.id_matricula)::int as total
         FROM matricula m
         JOIN grupos g ON m.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE m.id_colegio = $1 AND m.id_anio = $2 AND m.estado = 'ACTIVA'
         GROUP BY tg.nombre`,
        [schoolId, targetYearId]
      ),
      pool.query(
        `SELECT tg.nombre as grade, COUNT(DISTINCT dg.id_docente)::int as total
         FROM detalle_grados dg
         JOIN grupos g ON dg.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE dg.id_colegio = $1
         GROUP BY tg.nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT tg.nombre as grade, COUNT(o.id_observacion)::int as total
         FROM observacion_estudiante o
         JOIN estudiante e ON o.id_estudiante = e.id_estudiante
         JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.id_anio = $2
         JOIN grupos g ON m.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE o.id_colegio = $1 AND o.tipo = 'DISCIPLINARIA' AND m.estado = 'ACTIVA' ${targetPeriodId ? "AND o.id_periodo = $3" : ""}
         GROUP BY tg.nombre`,
        targetPeriodId ? [schoolId, targetYearId, targetPeriodId] : [schoolId, targetYearId]
      ),
      pool.query(
        `SELECT tg.nombre as grade, COUNT(m.id_matricula)::int as total
         FROM matricula m
         JOIN grupos g ON m.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE m.id_colegio = $1 AND m.id_anio = $2 AND m.estado = 'CANCELADA'
         GROUP BY tg.nombre`,
        [schoolId, targetYearId]
      )
    ]);

    // 3. Attendance % Today
    const todayStr = new Date().toLocaleDateString("en-CA");
    const attendanceTodayRes = await pool.query(
      `SELECT 
         (COUNT(*) FILTER (WHERE estado = 'PRESENTE')::numeric / NULLIF(COUNT(*), 0) * 100) as rate
       FROM registro_asistencia 
       WHERE id_colegio = $1 AND fecha::date = $2::date`,
      [schoolId, todayStr]
    );

    const attendanceByGradeRes = await pool.query(
      `SELECT 
         tg.nombre as grade,
         (COUNT(*) FILTER (WHERE ra.estado = 'PRESENTE')::numeric / NULLIF(COUNT(*), 0) * 100) as rate
       FROM registro_asistencia ra
       JOIN matricula m ON ra.id_estudiante = m.id_estudiante AND m.id_anio = $3
       JOIN grupos g ON m.id_grupo = g.id_grupo
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       WHERE ra.id_colegio = $1 AND ra.fecha::date = $2::date AND m.estado = 'ACTIVA'
       GROUP BY tg.nombre`,
      [schoolId, todayStr, targetYearId]
    );

    // Compile summaryByGrade
    const summaryByGrade: Record<string, any> = {};

    studentsByGradeRes.rows.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].totalStudents = Number(r.total);
    });

    teachersByGradeRes.rows.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].totalTeachers = Number(r.total);
    });

    disciplinaryByGradeRes.rows.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].disciplinaryReports = Number(r.total);
    });

    desertionByGradeRes.rows.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].desertionRate = Number(r.total);
    });

    attendanceByGradeRes.rows.forEach(r => {
      if (!summaryByGrade[r.grade]) {
        summaryByGrade[r.grade] = { totalStudents: 0, totalTeachers: 0, attendanceToday: 0, generalAverage: 0, studentsAtRisk: 0, disciplinaryReports: 0, desertionRate: 0 };
      }
      summaryByGrade[r.grade].attendanceToday = Number(Number(r.rate || 0).toFixed(1));
    });

    // 4. Academic Performance & Risk (Live calculation fallback)
    let performanceMetrics: { average: number; atRisk: number } = { average: 0, atRisk: 0 };
    
    const buildLiveCTE = (extraCTEs = '') => `
      WITH current_results AS (
        SELECT ra.id_estudiante, ra.id_detallegrado, ra.id_periodo, ra.promedio
        FROM resultado_academico ra
        JOIN detalle_grados dg_ra ON ra.id_detallegrado = dg_ra.id_detallegrado
        JOIN matricula m ON ra.id_estudiante = m.id_estudiante AND m.id_anio = ${targetYearId} AND m.estado = 'ACTIVA'
        WHERE dg_ra.id_colegio = $1 AND ra.id_periodo = $2

        UNION ALL

        SELECT na.id_estudiante, am.id_detallegrado, am.id_periodo,
               ROUND(SUM(na.nota * am.porcentaje / 100.0)::numeric, 2) as promedio
        FROM notas_actividad na
        JOIN actividad_materia am ON na.id_actividadmateria = am.id_actividadmateria
        JOIN matricula m ON na.id_estudiante = m.id_estudiante AND m.id_anio = ${targetYearId} AND m.estado = 'ACTIVA'
        WHERE am.id_periodo = $2 AND am.id_colegio = $1
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
      const perfRes = await pool.query(
        `${buildLiveCTE()}
         SELECT 
           AVG(promedio) as avg_general,
           COUNT(*) FILTER (WHERE promedio < 3.0) as at_risk
         FROM current_results cr
         JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
         WHERE dg.id_colegio = $1`,
        [schoolId, targetPeriodId]
      );
      performanceMetrics.average = Number(Number(perfRes.rows[0].avg_general || 0).toFixed(2));
      performanceMetrics.atRisk = Number(perfRes.rows[0].at_risk || 0);

      const perfByGradeRes = await pool.query(
        `${buildLiveCTE()}
         SELECT 
           tg.nombre as grade,
           AVG(cr.promedio) as avg_general,
           COUNT(DISTINCT cr.id_estudiante) FILTER (WHERE cr.promedio < 3.0) as at_risk
         FROM current_results cr
         JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
         JOIN grupos g ON dg.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE dg.id_colegio = $1
         GROUP BY tg.nombre`,
        [schoolId, targetPeriodId]
      );

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
    const obsRes = await pool.query(
      `SELECT 
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE o.tipo::text IN ('ACADEMICA', 'ACADEMICO'))::int as academicas,
         COUNT(*) FILTER (WHERE o.tipo::text IN ('DISCIPLINARIA', 'DISCIPLINARIO'))::int as disciplinarias,
         COUNT(*) FILTER (WHERE o.tipo::text IN ('CONVIVENCIA', 'CONVIVENCIAL'))::int as convivenciales
       FROM observacion_estudiante o
       JOIN detalle_grados dg ON o.id_detallegrado = dg.id_detallegrado
       WHERE dg.id_colegio = $1 ${targetPeriodId ? `AND o.id_periodo = $2` : ''}`,
      targetPeriodId ? [schoolId, targetPeriodId] : [schoolId]
    );

    const sancionRes = await pool.query(
      `SELECT COUNT(DISTINCT s.id_sancion)::int as total
       FROM sancion s
       JOIN estudiante e ON s.id_estudiante = e.id_estudiante
       JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.id_anio = $2 AND m.estado = 'ACTIVA'
       JOIN detalle_grados dg ON m.id_grupo = dg.id_grupo
       WHERE dg.id_colegio = $1 AND s.estado = 'ACTIVA'`,
      [schoolId, targetYearId]
    );

    const obsByGradeRes = await pool.query(
      `SELECT 
         tg.nombre as grado,
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE o.tipo::text IN ('ACADEMICA', 'ACADEMICO'))::int as academicas,
         COUNT(*) FILTER (WHERE o.tipo::text IN ('DISCIPLINARIA', 'DISCIPLINARIO'))::int as disciplinarias,
         COUNT(*) FILTER (WHERE o.tipo::text IN ('CONVIVENCIA', 'CONVIVENCIAL'))::int as convivenciales
       FROM observacion_estudiante o
       JOIN detalle_grados dg ON o.id_detallegrado = dg.id_detallegrado
       JOIN grupos g ON dg.id_grupo = g.id_grupo
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       WHERE dg.id_colegio = $1 ${targetPeriodId ? `AND o.id_periodo = $2` : ''}
       GROUP BY tg.id_tipo_grado, tg.nombre
       ORDER BY tg.id_tipo_grado`,
      targetPeriodId ? [schoolId, targetPeriodId] : [schoolId]
    );

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
        pool.query(
          `${buildLiveCTE()}
           SELECT tg.nombre, ROUND(AVG(cr.promedio), 2) as average
           FROM current_results cr
           JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
           JOIN grupos g ON dg.id_grupo = g.id_grupo
           JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
           WHERE dg.id_colegio = $1
           GROUP BY tg.id_tipo_grado, tg.nombre
           ORDER BY tg.id_tipo_grado`,
          [schoolId, targetPeriodId]
        ),
        pool.query(
          `${buildLiveCTE()}
           SELECT m.nombre, ROUND(AVG(cr.promedio), 2) as average
           FROM current_results cr
           JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
           JOIN materias m ON dg.id_materia = m.id_materia
           WHERE dg.id_colegio = $1
           GROUP BY m.id_materia, m.nombre
           ORDER BY average DESC
           LIMIT 10`,
          [schoolId, targetPeriodId]
        ),
        pool.query(
          `${buildLiveCTE()}
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
            WHERE dg.id_colegio = $1
           GROUP BY g.id_grupo, tg.nombre, s.nombre, j.nombre
           ORDER BY tg.nombre, LENGTH(s.nombre), s.nombre`,
          [schoolId, targetPeriodId]
        ),
        pool.query(
          `${buildLiveCTE()}
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
           WHERE dg.id_colegio = $1
           GROUP BY m.id_materia, m.nombre, g.id_grupo, tg.nombre, s.nombre, j.nombre
           ORDER BY tg.nombre, LENGTH(s.nombre), s.nombre, average DESC`,
          [schoolId, targetPeriodId]
        )
      ]);
      charts.performanceByGrade = gradePerfRes.rows;
      charts.performanceBySubject = subjectPerfRes.rows;
      charts.performanceByCourse = coursePerfRes.rows;
      charts.performanceBySubjectCourse = subjectCoursePerfRes.rows;
    }

    // Evolution (all periods of the current year) - Historical promedios
    // For evolution, we use already calculated averages when possible
    const evolutionRes = await pool.query(
      `SELECT p.nombre, ROUND(AVG(ra.promedio), 2) as average
       FROM resultado_academico ra
       JOIN periodo_academico p ON ra.id_periodo = p.id_periodo
       JOIN detalle_grados dg ON ra.id_detallegrado = dg.id_detallegrado
       WHERE dg.id_colegio = $1 AND p.id_anio = $2
       GROUP BY p.id_periodo, p.nombre
       ORDER BY p.id_periodo`,
      [schoolId, targetYearId]
    );
    charts.evolution = evolutionRes.rows;

    const evolutionByCourseRes = await pool.query(
      `SELECT 
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
       WHERE dg.id_colegio = $1 AND p.id_anio = $2
       GROUP BY p.id_periodo, p.nombre, g.id_grupo, tg.nombre, s.nombre, j.nombre
        ORDER BY p.id_periodo, tg.nombre, LENGTH(s.nombre), s.nombre`,
      [schoolId, targetYearId]
    );
    charts.evolutionByCourse = evolutionByCourseRes.rows;

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
        pool.query(
          `${buildLiveCTE()}
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
           WHERE dg.id_colegio = $1 AND cr.promedio < 3.0
           GROUP BY m.id_materia, m.nombre
           ORDER BY failures DESC
           LIMIT 5`,
          [schoolId, targetPeriodId]
        ),
        // Concentration of unique students at risk by grade level
        pool.query(
          `${buildLiveCTE()}
           SELECT tg.nombre, COUNT(DISTINCT cr.id_estudiante) as alerts
           FROM current_results cr
           JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
           JOIN grupos g ON dg.id_grupo = g.id_grupo
           JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
           WHERE dg.id_colegio = $1 AND cr.promedio < 3.0
           GROUP BY tg.id_tipo_grado, tg.nombre
           ORDER BY alerts DESC`,
          [schoolId, targetPeriodId]
        ),
        // Per-group risk: students failing at least one subject vs students passing everything
        pool.query(
          `${buildLiveCTE(`,
           student_status AS (
             SELECT 
               cr.id_estudiante,
               dg.id_grupo,
               bool_or(cr.promedio < 3.0) as is_at_risk
             FROM current_results cr
             JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
             WHERE dg.id_colegio = $1
             GROUP BY cr.id_estudiante, dg.id_grupo
           )`)}
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
            ORDER BY at_risk DESC`,
          [schoolId, targetPeriodId]
        ),
        pool.query(
          `${buildLiveCTE()}
           SELECT 
             cr.id_estudiante,
             e.nombre || ' ' || e.apellido as nombre_completo,
             dg.id_grupo,
             tg.nombre as grado_nombre,
             (tg.nombre || ' ' || s.nombre) as curso,
             COUNT(*) FILTER (WHERE cr.promedio < 3.0)::int as materias_reprobadas,
             ROUND(AVG(cr.promedio), 2)::numeric as promedio_general,
             JSON_AGG(
               JSON_BUILD_OBJECT('materia_nombre', m.nombre, 'promedio', cr.promedio)
             ) FILTER (WHERE cr.promedio < 3.0) as detalles_materias
           FROM current_results cr
           JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
           JOIN materias m ON dg.id_materia = m.id_materia
           JOIN estudiante e ON cr.id_estudiante = e.id_estudiante
           JOIN grupos g ON dg.id_grupo = g.id_grupo
           JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
           JOIN secciones s ON g.id_seccion = s.id_seccion
           WHERE dg.id_colegio = $1
           GROUP BY cr.id_estudiante, e.nombre, e.apellido, dg.id_grupo, tg.nombre, s.nombre
           HAVING bool_or(cr.promedio < 3.0)
           ORDER BY materias_reprobadas DESC, promedio_general ASC`,
          [schoolId, targetPeriodId]
        )
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

    const totalStuds = Number(studentsCountRes.rows[0].total);
    const atRiskStuds = performanceMetrics.atRisk;
    const calcApprovalRate = totalStuds > 0 ? Number(((totalStuds - atRiskStuds) / totalStuds * 100).toFixed(1)) : 100;

    const summaryData = {
      totalStudents: totalStuds,
      totalTeachers: Number(teachersCountRes.rows[0].total),
      attendanceToday: Number(Number(attendanceTodayRes.rows[0].rate || 0).toFixed(1)),
      generalAverage: performanceMetrics.average,
      approvalRate: calcApprovalRate,
      studentsAtRisk: atRiskStuds,
      disciplinaryReports: Number(disciplinaryRes.rows[0].total),
      desertionRate: Number(desertionRes.rows[0].total),
    };

    res.json({
      summary: summaryData,
      stats: summaryData,
      summaryByGrade,
      observationsSummary,
      charts,
      lowPerformance,
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
  if (!isSchoolAccessAllowed(authReq.user, schoolId)) {
    res.status(403).json({ error: "No tiene permiso para acceder a la información de este colegio." });
    return;
  }

  try {
    const [schoolRes, studentsRes, teachersRes, parentsRes] = await Promise.all([
      pool.query(
        `SELECT id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane, tipo_calendario, escudo_url, color_primario, color_secundario 
         FROM colegio 
         WHERE id_colegio = $1`,
        [schoolId]
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM estudiante WHERE id_colegio = $1 AND estado = 'ACTIVO'`, [schoolId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM docente WHERE id_colegio = $1 AND estado = 'ACTIVO'`, [schoolId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM padre_familia WHERE id_colegio = $1`, [schoolId])
    ]);

    if (schoolRes.rows.length === 0) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }

    res.json({
      ...schoolRes.rows[0],
      school: schoolRes.rows[0],
      kpis: {
        totalEstudiantes: studentsRes.rows[0].count,
        totalDocentes: teachersRes.rows[0].count,
        totalPadres: parentsRes.rows[0].count
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
      const auditRes = await pool.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    const currentRes = await pool.query(
      "SELECT escudo_url, color_primario, color_secundario FROM colegio WHERE id_colegio = $1",
      [schoolId]
    );
    if (currentRes.rows.length === 0) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }
    const currentVal = currentRes.rows[0];

    await pool.query(
      `UPDATE colegio 
       SET escudo_url = $1, color_primario = $2, color_secundario = $3 
       WHERE id_colegio = $4`,
      [escudo_url || null, color_primario || null, color_secundario || null, schoolId]
    );

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
      
      await pool.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Modificación de Identidad Institucional', $2, $3, $4, $5)`,
        [activeAuditoriaId, `Colegio ID: ${schoolId}`, JSON.stringify(valorAntiguo), JSON.stringify(valorNuevo), motivo_cambio]
      );
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
      const auditRes = await pool.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    const currentRes = await pool.query(
      "SELECT escudo_url, color_primario, color_secundario FROM colegio WHERE id_colegio = $1",
      [schoolId]
    );
    if (currentRes.rows.length === 0) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }
    const currentVal = currentRes.rows[0];

    await pool.query(
      `UPDATE colegio 
       SET escudo_url = NULL, color_primario = NULL, color_secundario = NULL 
       WHERE id_colegio = $1`,
      [schoolId]
    );

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
      
      await pool.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Restablecer Identidad Institucional por defecto', $2, $3, $4, $5)`,
        [activeAuditoriaId, `Colegio ID: ${schoolId}`, JSON.stringify(valorAntiguo), JSON.stringify(valorNuevo), motivo_cambio]
      );
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureSchoolSettingsTable();

    const existingSettingsRes = await client.query(
      `SELECT nota_minima, nota_maxima, nota_aprobacion, escala_modo
       FROM configuracion_colegio
       WHERE id_colegio = $1
       FOR UPDATE`,
      [schoolId]
    );

    const previous =
      existingSettingsRes.rows[0] ??
      (await ensureSchoolDefaultSettings(schoolId));
    const nextScaleMode = (requestedScaleMode || previous.escala_modo || "AUTOMATICO") as "AUTOMATICO" | "MANUAL";

    const currentScalesRes = await client.query(
      `SELECT nivel, valor_maximo
       FROM escala_valoracion
       WHERE id_colegio = $1`,
      [schoolId]
    );

    const currentBasic = currentScalesRes.rows.find((row) => row.nivel === "BASICO");
    const currentHigh = currentScalesRes.rows.find((row) => row.nivel === "ALTO");

    const updated = await client.query(
      `INSERT INTO configuracion_colegio (id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id_colegio)
       DO UPDATE SET
         nota_minima = EXCLUDED.nota_minima,
         nota_maxima = EXCLUDED.nota_maxima,
         nota_aprobacion = EXCLUDED.nota_aprobacion,
         escala_modo = EXCLUDED.escala_modo
       RETURNING id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo`,
      [schoolId, notaMinima, notaMaxima, notaAprobacion, nextScaleMode]
    );

    const syncedScales = await syncSchoolScalesAndGrades(
      client,
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

    await client.query("COMMIT");
    res.json({
      ...updated.rows[0],
      scales: syncedScales,
      message: "Configuración institucional aplicada y notas sincronizadas correctamente",
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating school default settings:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
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
    const result = await pool.query(
      `SELECT id_configuracion, id_colegio, id_anio, fecha_inicio, fecha_cierre, habilitada 
       FROM configuracion_inscripcion 
       WHERE id_colegio = $1 AND id_anio = $2`,
      [schoolId, yearId]
    );

    const hasApproved = false;

    if (result.rows.length > 0) {
      res.json({
        ...result.rows[0],
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
    const yearInfoRes = await pool.query(
      `SELECT calendario FROM anio_lectivo WHERE id_anio = $1 AND id_colegio = $2`,
      [id_anio, id_colegio]
    );
    if (yearInfoRes.rows.length > 0) {
      const calStr = yearInfoRes.rows[0].calendario || '';
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
      const auditRes = await pool.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [id_colegio, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    // Fetch existing configuration for audit logging
    const existingRes = await pool.query(
      `SELECT fecha_inicio, fecha_cierre, habilitada 
       FROM configuracion_inscripcion 
       WHERE id_colegio = $1 AND id_anio = $2`,
      [id_colegio, id_anio]
    );
    const oldConfig = existingRes.rows[0] || null;

    // Save/Update config
    const result = await pool.query(
      `INSERT INTO configuracion_inscripcion (id_colegio, id_anio, fecha_inicio, fecha_cierre, habilitada)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id_colegio, id_anio)
       DO UPDATE SET 
         fecha_inicio = EXCLUDED.fecha_inicio, 
         fecha_cierre = EXCLUDED.fecha_cierre, 
         habilitada = EXCLUDED.habilitada
       RETURNING *`,
      [id_colegio, id_anio, fecha_inicio, fecha_cierre, habilitada !== undefined ? Boolean(habilitada) : true]
    );

    const newConfig = result.rows[0];

    // Logging action if supervised
    if (activeAuditoriaId) {
      await pool.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Modificación de Fechas de Inscripción', $2, $3, $4, $5)`,
        [
          activeAuditoriaId, 
          `Colegio ID: ${id_colegio}, Año ID: ${id_anio}`, 
          oldConfig ? JSON.stringify(oldConfig) : null, 
          JSON.stringify(newConfig), 
          motivo_cambio
        ]
      );
    }

    res.json({ message: "Configuración de inscripción guardada exitosamente", config: newConfig });
  } catch (error: any) {
    console.error("Error in saveEnrollmentConfig:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

