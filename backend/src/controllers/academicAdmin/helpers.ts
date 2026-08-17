import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../../config/db";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import path from "path";
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

export interface AuthRequest extends Request {
  user?: {
    id: number;
    id_usuario?: number;
    email: string;
    role?: string;
    roles: string[];
    schoolId?: number | null;
    schoolIds?: number[];
  };
}

export { path };

export const isSchoolAccessAllowed = async (user: any, targetSchoolId: number | null | undefined): Promise<boolean> => {
  if (!user || !targetSchoolId) return false;
  const target = Number(targetSchoolId);

  if (user.roles && user.roles.includes('admin_general')) return true;
  if (user.schoolId && Number(user.schoolId) === target) return true;
  if (user.schoolIds && Array.isArray(user.schoolIds) && user.schoolIds.map(Number).includes(target)) return true;

  const userId = Number(user.id || user.id_usuario || 0);
  if (!userId) return false;

  const role = String(user.role || '').toLowerCase();

  try {
    if (role === 'estudiante' || (user.roles && user.roles.includes('estudiante'))) {
      const check = await pool.query(
        `SELECT 1 FROM estudiante WHERE (id_usuario = $1 OR id_estudiante = $1) AND id_colegio = $2 LIMIT 1`,
        [userId, target]
      );
      if (check.rows.length > 0) return true;
    }

    if (role === 'padre' || (user.roles && user.roles.includes('padre'))) {
      const check = await pool.query(
        `SELECT 1 FROM padre_familia pf
         JOIN detalle_padrefamilia dpf ON pf.id_padrefamilia = dpf.id_padrefamilia
         JOIN estudiante e ON dpf.id_estudiante = e.id_estudiante
         WHERE (pf.id_usuario = $1 OR pf.id_padrefamilia = $1) AND e.id_colegio = $2 LIMIT 1`,
        [userId, target]
      );
      if (check.rows.length > 0) return true;
    }

    const checkBinding = await pool.query(
      `SELECT 1 FROM usuario_colegio WHERE id_usuario = $1 AND id_colegio = $2 AND estado = 'ACTIVO' LIMIT 1`,
      [userId, target]
    );
    if (checkBinding.rows.length > 0) return true;
  } catch (err) {
    console.error('Error in isSchoolAccessAllowed query:', err);
  }

  return false;
};

export const parseSchoolId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

export const ensureTeacherStatusColumn = async () => {};

export const autoSwitchPeriodsForYear = async (client: any, schoolId: number, yearId: number): Promise<void> => {
  const yearRes = await client.query(
    `SELECT id_anio, calendario, tipo_calendario, estado
     FROM anio_lectivo
     WHERE id_anio = $1 AND id_colegio = $2`,
    [yearId, schoolId]
  );
  if (!yearRes.rows.length || yearRes.rows[0].estado === 'CERRADO') return;
  const yearRow = yearRes.rows[0];
  const calendarType = yearRow.tipo_calendario || 'A';

  const periodsRes = await client.query(
    `SELECT id_periodo, nombre, estado, porcentaje, trimestre, mes_inicio, dia_inicio, mes_fin, dia_fin
     FROM periodo_academico
     WHERE id_colegio = $1 AND id_anio = $2
     ORDER BY trimestre ASC, id_periodo ASC`,
    [schoolId, yearId]
  );
  const periods = periodsRes.rows;

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();
  let periodIdToOpen: number | null = null;

  for (const p of periods) {
    if (p.mes_inicio && p.dia_inicio && p.mes_fin && p.dia_fin) {
      const mesInicio = Number(p.mes_inicio);
      const diaInicio = Number(p.dia_inicio);
      const mesFin = Number(p.mes_fin);
      const diaFin = Number(p.dia_fin);

      if (calendarType === 'A') {
        const nowVal = currentMonth * 100 + currentDay;
        const startVal = mesInicio * 100 + diaInicio;
        const endVal = mesFin * 100 + diaFin;
        if (nowVal >= startVal && nowVal <= endVal) {
          periodIdToOpen = p.id_periodo;
          break;
        }
      } else {
        const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
        const nowNorm = normalizeMonth(currentMonth) * 100 + currentDay;
        const startNorm = normalizeMonth(mesInicio) * 100 + diaInicio;
        const endNorm = normalizeMonth(mesFin) * 100 + diaFin;
        if (nowNorm >= startNorm && nowNorm <= endNorm) {
          periodIdToOpen = p.id_periodo;
          break;
        }
      }
    }
  }

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    let nextState = p.estado;

    if (p.id_periodo === periodIdToOpen) {
      if (p.estado === 'PENDIENTE') {
        const previousPeriod = i > 0 ? periods[i - 1] : null;
        if (!previousPeriod || previousPeriod.estado === 'CERRADO') {
          nextState = 'ABIERTO';
        }
      } else if (p.estado === 'CERRADO') {
        nextState = 'CERRADO';
      } else {
        nextState = 'ABIERTO';
      }
    } else {
      if (p.estado === 'ABIERTO') {
        nextState = 'CERRADO';
      }
    }

    if (nextState !== p.estado) {
      await client.query(
        `UPDATE periodo_academico SET estado = $1::estado_periodo WHERE id_periodo = $2`,
        [nextState, p.id_periodo]
      );
    }
  }
};

export const ensureAcademicYearForSchool = async (schoolId: number): Promise<number> => {
  const existing = await pool.query(
    `SELECT id_anio
     FROM anio_lectivo
     WHERE id_colegio = $1 AND estado = 'ABIERTO'
     ORDER BY id_anio DESC
     LIMIT 1`,
    [schoolId]
  );

  if (existing.rows.length > 0) {
    return Number(existing.rows[0].id_anio);
  }

  const fallback = await pool.query(
    `SELECT id_anio
     FROM anio_lectivo
     WHERE id_colegio = $1
     ORDER BY id_anio DESC
     LIMIT 1`,
    [schoolId]
  );

  if (fallback.rows.length > 0) {
    return Number(fallback.rows[0].id_anio);
  }

  const currentYear = new Date().getFullYear();
  const created = await pool.query(
    `INSERT INTO anio_lectivo (calendario, id_colegio, tipo_calendario, estado)
     VALUES ($1, $2, 'A', 'ABIERTO')
     RETURNING id_anio`,
    [String(currentYear), schoolId]
  );

  return Number(created.rows[0].id_anio);
};

export const ensureSchoolSettingsTable = async () => {
  try {
    await pool.query(
      `ALTER TABLE public.configuracion_colegio 
       ADD COLUMN IF NOT EXISTS materias_reprobatorias_promocion INTEGER NOT NULL DEFAULT 3`
    );
  } catch (err) {
    console.error("Error al asegurar columna materias_reprobatorias_promocion:", err);
  }
};
export const ensureAcademicPeriodTrimesterColumn = async () => {};
export const ensureAcademicPeriodDayColumns = async () => {};
export const ensureAcademicPeriodMonthColumns = async () => {};
export const ensureAcademicPeriodPendingStatus = async () => {};

export const ensureSchoolDefaultSettings = async (schoolId: number) => {
  await ensureSchoolSettingsTable();

  const existing = await pool.query(
    `SELECT id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo, COALESCE(materias_reprobatorias_promocion, 3) AS materias_reprobatorias_promocion
     FROM configuracion_colegio
     WHERE id_colegio = $1`,
    [schoolId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const scaleBoundsRes = await pool.query(
    `SELECT
       MIN(valor_minimo)::numeric AS nota_minima,
       MAX(valor_maximo)::numeric AS nota_maxima
     FROM escala_valoracion
     WHERE id_colegio = $1`,
    [schoolId]
  );

  const inferredMin = scaleBoundsRes.rows[0]?.nota_minima !== null ? Number(scaleBoundsRes.rows[0].nota_minima) : 0;
  const inferredMax = scaleBoundsRes.rows[0]?.nota_maxima !== null ? Number(scaleBoundsRes.rows[0].nota_maxima) : 5;
  const inferredApproval = inferredMin <= 3 && 3 <= inferredMax ? 3 : Number(((inferredMin + inferredMax) / 2).toFixed(1));

  const created = await pool.query(
    `INSERT INTO configuracion_colegio (id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo, materias_reprobatorias_promocion)
     VALUES ($1, $2, $3, $4, 'AUTOMATICO', 3)
     RETURNING id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo, materias_reprobatorias_promocion`,
    [schoolId, inferredMin, inferredMax, inferredApproval]
  );

  return created.rows[0];
};

export const roundToOne = (value: number): number => Number(value.toFixed(1));

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const buildAutomaticScales = (notaMinima: number, notaMaxima: number, notaAprobacion: number) => {
  const min = roundToOne(notaMinima);
  const max = roundToOne(notaMaxima);
  const approval = roundToOne(notaAprobacion);
  const failMax = roundToOne(Math.max(min, approval - 0.1));
  const approvedSpan = Math.max(0, max - approval);
  const basicMax = roundToOne(clamp(approval + approvedSpan / 3, approval, max));
  const altoMin = roundToOne(clamp(basicMax + 0.1, approval, max));
  const altoMax = roundToOne(clamp(approval + (approvedSpan * 2) / 3, altoMin, max));
  const superiorMin = roundToOne(clamp(altoMax + 0.1, altoMin, max));

  return [
    { nivel: "BAJO", valor_minimo: min, valor_maximo: failMax },
    { nivel: "BASICO", valor_minimo: approval, valor_maximo: basicMax },
    { nivel: "ALTO", valor_minimo: altoMin, valor_maximo: altoMax },
    { nivel: "SUPERIOR", valor_minimo: superiorMin, valor_maximo: max },
  ];
};

export const buildManualScales = (
  notaMinima: number,
  notaMaxima: number,
  notaAprobacion: number,
  basicMaxInput?: number | null,
  altoMaxInput?: number | null
) => {
  const min = roundToOne(notaMinima);
  const max = roundToOne(notaMaxima);
  const approval = roundToOne(notaAprobacion);
  const failMax = roundToOne(Math.max(min, approval - 0.1));

  if (max - approval < 0.2) {
    throw new Error("El rango aprobado es demasiado corto para construir escalas manuales válidas");
  }

  const defaultBasicMax = roundToOne(clamp(approval + (max - approval) / 3, approval, max - 0.2));
  const basicMax = roundToOne(clamp(basicMaxInput ?? defaultBasicMax, approval, max - 0.2));
  const altoMin = roundToOne(basicMax + 0.1);
  const defaultAltoMax = roundToOne(clamp(altoMin + (max - altoMin) / 2, altoMin, max - 0.1));
  const altoMax = roundToOne(clamp(altoMaxInput ?? defaultAltoMax, altoMin, max - 0.1));
  const superiorMin = roundToOne(altoMax + 0.1);

  return [
    { nivel: "BAJO", valor_minimo: min, valor_maximo: failMax },
    { nivel: "BASICO", valor_minimo: approval, valor_maximo: basicMax },
    { nivel: "ALTO", valor_minimo: altoMin, valor_maximo: altoMax },
    { nivel: "SUPERIOR", valor_minimo: superiorMin, valor_maximo: max },
  ];
};

export const assignScaleForScore = <T extends { id_escalavaloracion: number; valor_minimo: number | string; valor_maximo: number | string }>(
  score: number,
  scales: T[]
) => {
  const normalized = roundToOne(score);
  return (
    scales.find((item) => {
      const min = Number(item.valor_minimo);
      const max = Number(item.valor_maximo);
      return normalized >= min && normalized <= max;
    }) ?? scales[scales.length - 1]
  );
};

export const syncSchoolScalesAndGrades = async (
  client: PoolClient,
  schoolId: number,
  previousMin: number,
  previousMax: number,
  nextMin: number,
  nextMax: number,
  nextApproval: number,
  scaleMode: "AUTOMATICO" | "MANUAL" = "AUTOMATICO",
  manualBreaks?: { basicMax?: number | null; altoMax?: number | null }
) => {
  // Permitir bypass administrativo de triggers para sincronización global de escalas
  await client.query("SET LOCAL my.app.bypass_triggers = 'true'");

  const previousScalesRes = await client.query(
    `SELECT id_escalavaloracion, nivel
     FROM escala_valoracion
     WHERE id_colegio = $1
     ORDER BY valor_minimo`,
    [schoolId]
  );

  const nextScalesDraft =
    scaleMode === "MANUAL"
      ? buildManualScales(nextMin, nextMax, nextApproval, manualBreaks?.basicMax, manualBreaks?.altoMax)
      : buildAutomaticScales(nextMin, nextMax, nextApproval);

  let nextScales: { id_escalavaloracion: number; nivel: string; valor_minimo: number; valor_maximo: number }[] = [];

  if (previousScalesRes.rows.length === nextScalesDraft.length) {
    for (let i = 0; i < previousScalesRes.rows.length; i++) {
      const existingId = previousScalesRes.rows[i].id_escalavaloracion;
      const draft = nextScalesDraft[i];
      await client.query(
        `UPDATE escala_valoracion
         SET nivel = $1, valor_minimo = $2, valor_maximo = $3
         WHERE id_escalavaloracion = $4`,
        [draft.nivel, draft.valor_minimo, draft.valor_maximo, existingId]
      );
      nextScales.push({ id_escalavaloracion: existingId, ...draft });
    }
  } else {
    await client.query(
      `UPDATE notas_actividad SET id_escalavaloracion = NULL WHERE id_colegio = $1`,
      [schoolId]
    );
    if (previousScalesRes.rows.length > 0) {
      const oldIds = previousScalesRes.rows.map((r) => Number(r.id_escalavaloracion));
      await client.query(
        `DELETE FROM escala_valoracion WHERE id_escalavaloracion = ANY($1::int[])`,
        [oldIds]
      );
    }
    const createdRes = await client.query(
      `INSERT INTO escala_valoracion (nivel, valor_minimo, valor_maximo, id_colegio)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $4), ($8, $9, $10, $4), ($11, $12, $13, $4)
       RETURNING id_escalavaloracion, nivel, valor_minimo, valor_maximo`,
      [
        nextScalesDraft[0].nivel, nextScalesDraft[0].valor_minimo, nextScalesDraft[0].valor_maximo,
        schoolId,
        nextScalesDraft[1].nivel, nextScalesDraft[1].valor_minimo, nextScalesDraft[1].valor_maximo,
        nextScalesDraft[2].nivel, nextScalesDraft[2].valor_minimo, nextScalesDraft[2].valor_maximo,
        nextScalesDraft[3].nivel, nextScalesDraft[3].valor_minimo, nextScalesDraft[3].valor_maximo,
      ]
    );
    nextScales = createdRes.rows;
  }

  const notesRes = await client.query(
    `SELECT id_notaactividad, nota
     FROM notas_actividad
     WHERE id_colegio = $1
     FOR UPDATE`,
    [schoolId]
  );

  const previousRange = previousMax - previousMin;
  const nextRange = nextMax - nextMin;

  for (const row of notesRes.rows) {
    const currentScore = Number(row.nota);
    const ratio = previousRange > 0 ? (currentScore - previousMin) / previousRange : 0;
    const normalizedRatio = clamp(ratio, 0, 1);
    const rescaledScore = roundToOne(nextMin + normalizedRatio * nextRange);
    const scale = assignScaleForScore(rescaledScore, nextScales);

    await client.query(
      `UPDATE notas_actividad
       SET nota = $1,
           id_escalavaloracion = $2
       WHERE id_notaactividad = $3`,
      [rescaledScore, scale.id_escalavaloracion, row.id_notaactividad]
    );
  }

  const criteriaNotesRes = await client.query(
    `SELECT id_nota_criterio, nota
     FROM nota_criterio
     WHERE id_colegio = $1
     FOR UPDATE`,
    [schoolId]
  );

  for (const row of criteriaNotesRes.rows) {
    const currentScore = Number(row.nota);
    const ratio = previousRange > 0 ? (currentScore - previousMin) / previousRange : 0;
    const normalizedRatio = clamp(ratio, 0, 1);
    const rescaledScore = roundToOne(nextMin + normalizedRatio * nextRange);

    await client.query(
      `UPDATE nota_criterio
       SET nota = $1
       WHERE id_nota_criterio = $2`,
      [rescaledScore, row.id_nota_criterio]
    );
  }

  const resultsRes = await client.query(
    `SELECT ra.id_resultado, ra.promedio
     FROM resultado_academico ra
     JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
     WHERE dg.id_colegio = $1
     FOR UPDATE OF ra`,
    [schoolId]
  );

  for (const row of resultsRes.rows) {
    const currentScore = Number(row.promedio);
    const ratio = previousRange > 0 ? (currentScore - previousMin) / previousRange : 0;
    const normalizedRatio = clamp(ratio, 0, 1);
    const rescaledScore = Number((nextMin + normalizedRatio * nextRange).toFixed(2));

    await client.query(
      `UPDATE resultado_academico
       SET promedio = $1
       WHERE id_resultado = $2`,
      [rescaledScore, row.id_resultado]
    );
  }

  return nextScales;
};

export const getUserEligibleAcademicYears = async (
  userId: number,
  userEmail: string,
  userRoles: string[],
  schoolId: number
): Promise<number[]> => {
  const isDirectivoOrAdmin = userRoles.some(r =>
    ['directivo', 'admin_general', 'rector', 'coordinador'].includes(r.toLowerCase())
  );
  
  if (isDirectivoOrAdmin) {
    const allYears = await pool.query<{ id_anio: number }>(
      `SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 ORDER BY id_anio DESC`,
      [schoolId]
    );
    return allYears.rows.map(r => Number(r.id_anio));
  }

  const eligibleYearIds = new Set<number>();

  // 1. Student enrollments
  if (userRoles.includes('estudiante')) {
    const studentYears = await pool.query<{ id_anio: number }>(
      `SELECT DISTINCT m.id_anio 
       FROM matricula m
       JOIN estudiante e ON e.id_estudiante = m.id_estudiante
       LEFT JOIN usuario u ON u.id_usuario = e.id_usuario
       WHERE (e.id_usuario = $1 OR UPPER(u.email) = UPPER($2)) AND m.id_colegio = $3`,
      [userId, userEmail, schoolId]
    );
    studentYears.rows.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // 2. Parent / Acudiente children enrollments
  if (userRoles.includes('padre')) {
    const parentYears = await pool.query<{ id_anio: number }>(
      `SELECT DISTINCT m.id_anio
       FROM matricula m
       LEFT JOIN estudiante e ON e.id_estudiante = m.id_estudiante
       LEFT JOIN detalle_padrefamilia dpf ON dpf.id_estudiante = e.id_estudiante
       LEFT JOIN padre_familia pf ON pf.id_padrefamilia = dpf.id_padrefamilia
       LEFT JOIN usuario u ON u.id_usuario = pf.id_usuario
       WHERE (pf.id_usuario = $1 OR UPPER(u.email) = UPPER($2) OR UPPER(m.correo_padre) = UPPER($2))
         AND m.id_colegio = $3`,
      [userId, userEmail, schoolId]
    );
    parentYears.rows.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // 3. Teacher participation in academic activities/evaluations/competencies/assignments
  if (userRoles.includes('docente')) {
    const teacherYears = await pool.query<{ id_anio: number }>(
      `SELECT DISTINCT dg.id_anio
       FROM detalle_grados dg
       JOIN docente d ON d.id_docente = dg.id_docente
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE (d.id_usuario = $1 OR UPPER(u.email) = UPPER($2))
         AND dg.id_colegio = $3
         AND dg.id_anio IS NOT NULL

       UNION

       SELECT DISTINCT p.id_anio
       FROM periodo_academico p
       JOIN actividad_materia am ON am.id_periodo = p.id_periodo
       JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
       JOIN docente d ON d.id_docente = dg.id_docente
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE (d.id_usuario = $1 OR UPPER(u.email) = UPPER($2)) AND p.id_colegio = $3
       
       UNION
       
       SELECT DISTINCT p.id_anio
       FROM registro_asistencia ra
       JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
       JOIN periodo_academico p ON p.id_colegio = dg.id_colegio
       JOIN docente d ON d.id_docente = dg.id_docente
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE (d.id_usuario = $1 OR UPPER(u.email) = UPPER($2)) AND p.id_colegio = $3
       
       UNION
       
       SELECT DISTINCT p.id_anio
       FROM cierre_materia cm
       JOIN periodo_academico p ON p.id_periodo = cm.id_periodo
       JOIN detalle_grados dg ON dg.id_detallegrado = cm.id_detallegrado
       JOIN docente d ON d.id_docente = dg.id_docente
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE (d.id_usuario = $1 OR UPPER(u.email) = UPPER($2)) AND p.id_colegio = $3

       UNION

       SELECT DISTINCT p.id_anio
       FROM observacion_estudiante oe
       JOIN detalle_grados dg ON dg.id_detallegrado = oe.id_detallegrado
       JOIN periodo_academico p ON p.id_periodo = oe.id_periodo
       JOIN docente d ON d.id_docente = dg.id_docente
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE (d.id_usuario = $1 OR UPPER(u.email) = UPPER($2)) AND p.id_colegio = $3`,
      [userId, userEmail, schoolId]
    );
    teacherYears.rows.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // Filter out any academic years that ended before the user was registered
  if (eligibleYearIds.size > 0) {
    const validYearsRes = await pool.query<{ id_anio: number }>(
      `SELECT al.id_anio
       FROM anio_lectivo al
       LEFT JOIN usuario u ON u.id_usuario = $1
       WHERE al.id_anio = ANY($2::int[])
         AND (
           u.fecha_creacion IS NULL OR
           NOT (
             EXTRACT(YEAR FROM u.fecha_creacion) > NULLIF(regexp_replace(al.calendario, '\\D', '', 'g'), '')::int
             OR (al.fecha_fin IS NOT NULL AND DATE(u.fecha_creacion) > al.fecha_fin)
           )
         )`,
      [userId, Array.from(eligibleYearIds)]
    );
    eligibleYearIds.clear();
    validYearsRes.rows.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // Fallback: If no history found or filtered out, return active open year valid for creation date
  if (eligibleYearIds.size === 0) {
    const openYear = await pool.query<{ id_anio: number }>(
      `SELECT al.id_anio
       FROM anio_lectivo al
       LEFT JOIN usuario u ON u.id_usuario = $1
       WHERE al.id_colegio = $2
         AND (
           u.fecha_creacion IS NULL OR
           NOT (
             EXTRACT(YEAR FROM u.fecha_creacion) > NULLIF(regexp_replace(al.calendario, '\\D', '', 'g'), '')::int
             OR (al.fecha_fin IS NOT NULL AND DATE(u.fecha_creacion) > al.fecha_fin)
           )
         )
       ORDER BY CASE WHEN al.estado = 'ABIERTO' THEN 0 ELSE 1 END, al.id_anio DESC
       LIMIT 1`,
      [userId, schoolId]
    );
    if (openYear.rows.length > 0) {
      eligibleYearIds.add(Number(openYear.rows[0].id_anio));
    }
  }

  return Array.from(eligibleYearIds);
};

