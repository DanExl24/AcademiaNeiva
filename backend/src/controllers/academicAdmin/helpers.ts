import { Request, Response } from "express";
import { db } from "../../config/kysely";
import { sql } from "kysely";
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
      const check = await db
        .selectFrom("estudiante")
        .select("id_estudiante")
        .where((eb) => eb.or([
          eb("id_usuario", "=", userId),
          eb("id_estudiante", "=", userId)
        ]))
        .where("id_colegio", "=", target)
        .limit(1)
        .executeTakeFirst();
      if (check) return true;
    }

    if (role === 'padre' || (user.roles && user.roles.includes('padre'))) {
      const check = await db
        .selectFrom("padre_familia as pf")
        .innerJoin("detalle_padrefamilia as dpf", "pf.id_padrefamilia", "dpf.id_padrefamilia")
        .innerJoin("estudiante as e", "dpf.id_estudiante", "e.id_estudiante")
        .select("pf.id_padrefamilia")
        .where((eb) => eb.or([
          eb("pf.id_usuario", "=", userId),
          eb("pf.id_padrefamilia", "=", userId)
        ]))
        .where("e.id_colegio", "=", target)
        .limit(1)
        .executeTakeFirst();
      if (check) return true;
    }

    const checkBinding = await db
      .selectFrom("usuario_colegio")
      .select("id_usuario")
      .where("id_usuario", "=", userId)
      .where("id_colegio", "=", target)
      .where("estado", "=", "ACTIVO")
      .limit(1)
      .executeTakeFirst();
    if (checkBinding) return true;
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

export const autoSwitchPeriodsForYear = async (
  clientOrSchoolId: any,
  schoolIdOrYearId?: number,
  maybeYearId?: number
): Promise<void> => {
  let client: any = db;
  let schoolId: number;
  let yearId: number;

  if (typeof clientOrSchoolId === "number") {
    schoolId = clientOrSchoolId;
    yearId = schoolIdOrYearId!;
  } else {
    client = clientOrSchoolId || db;
    schoolId = schoolIdOrYearId!;
    yearId = maybeYearId!;
  }

  const yearRow = await client
    .selectFrom("anio_lectivo")
    .select(["id_anio", "calendario", "tipo_calendario", "estado"])
    .where("id_anio", "=", yearId)
    .where("id_colegio", "=", schoolId)
    .executeTakeFirst();

  if (!yearRow || yearRow.estado === "CERRADO") return;
  const calendarType = yearRow.tipo_calendario || "A";

  const periods = await client
    .selectFrom("periodo_academico")
    .select([
      "id_periodo",
      "nombre",
      "estado",
      "porcentaje",
      "trimestre",
      "mes_inicio",
      "dia_inicio",
      "mes_fin",
      "dia_fin",
    ])
    .where("id_colegio", "=", schoolId)
    .where("id_anio", "=", yearId)
    .orderBy("trimestre", "asc")
    .orderBy("id_periodo", "asc")
    .execute();

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

      if (calendarType === "A") {
        const nowVal = currentMonth * 100 + currentDay;
        const startVal = mesInicio * 100 + diaInicio;
        const endVal = mesFin * 100 + diaFin;
        if (nowVal >= startVal && nowVal <= endVal) {
          periodIdToOpen = p.id_periodo;
          break;
        }
      } else {
        const normalizeMonth = (m: number) => (m >= 8 ? m - 7 : m + 5);
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
      if (p.estado === "PENDIENTE") {
        const previousPeriod = i > 0 ? periods[i - 1] : null;
        if (!previousPeriod || previousPeriod.estado === "CERRADO") {
          nextState = "ABIERTO";
        }
      } else if (p.estado === "CERRADO") {
        nextState = "CERRADO";
      } else {
        nextState = "ABIERTO";
      }
    } else {
      if (p.estado === "ABIERTO") {
        nextState = "CERRADO";
      }
    }

    if (nextState !== p.estado) {
      await client
        .updateTable("periodo_academico")
        .set({ estado: nextState as any })
        .where("id_periodo", "=", p.id_periodo)
        .execute();
    }
  }
};

export const ensureAcademicYearForSchool = async (schoolId: number): Promise<number> => {
  const existing = await db
    .selectFrom("anio_lectivo")
    .select("id_anio")
    .where("id_colegio", "=", schoolId)
    .where("estado", "=", "ABIERTO")
    .orderBy("id_anio", "desc")
    .limit(1)
    .executeTakeFirst();

  if (existing) {
    return Number(existing.id_anio);
  }

  const fallback = await db
    .selectFrom("anio_lectivo")
    .select("id_anio")
    .where("id_colegio", "=", schoolId)
    .orderBy("id_anio", "desc")
    .limit(1)
    .executeTakeFirst();

  if (fallback) {
    return Number(fallback.id_anio);
  }

  const currentYear = new Date().getFullYear();
  const created = await db
    .insertInto("anio_lectivo")
    .values({
      calendario: String(currentYear),
      id_colegio: schoolId,
      tipo_calendario: "A",
      estado: "ABIERTO",
    })
    .returning("id_anio")
    .executeTakeFirstOrThrow();

  return Number(created.id_anio);
};

export const ensureSchoolSettingsTable = async () => {
  try {
    await sql`ALTER TABLE public.configuracion_colegio 
       ADD COLUMN IF NOT EXISTS materias_reprobatorias_promocion INTEGER NOT NULL DEFAULT 3`.execute(db);
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

  const existing = await db
    .selectFrom("configuracion_colegio")
    .select([
      "id_colegio",
      "nota_minima",
      "nota_maxima",
      "nota_aprobacion",
      "escala_modo",
      sql<number>`COALESCE(materias_reprobatorias_promocion, 3)`.as("materias_reprobatorias_promocion"),
    ])
    .where("id_colegio", "=", schoolId)
    .executeTakeFirst();

  if (existing) {
    return existing;
  }

  const scaleBoundsRes = await db
    .selectFrom("escala_valoracion")
    .select([
      sql<string | number>`MIN(valor_minimo)::numeric`.as("nota_minima"),
      sql<string | number>`MAX(valor_maximo)::numeric`.as("nota_maxima"),
    ])
    .where("id_colegio", "=", schoolId)
    .executeTakeFirst();

  const inferredMin = scaleBoundsRes?.nota_minima !== null && scaleBoundsRes?.nota_minima !== undefined ? Number(scaleBoundsRes.nota_minima) : 0;
  const inferredMax = scaleBoundsRes?.nota_maxima !== null && scaleBoundsRes?.nota_maxima !== undefined ? Number(scaleBoundsRes.nota_maxima) : 5;
  const inferredApproval = inferredMin <= 3 && 3 <= inferredMax ? 3 : Number(((inferredMin + inferredMax) / 2).toFixed(1));

  const created = await db
    .insertInto("configuracion_colegio")
    .values({
      id_colegio: schoolId,
      nota_minima: inferredMin,
      nota_maxima: inferredMax,
      nota_aprobacion: inferredApproval,
      escala_modo: "AUTOMATICO",
      materias_reprobatorias_promocion: 3,
    })
    .returning([
      "id_colegio",
      "nota_minima",
      "nota_maxima",
      "nota_aprobacion",
      "escala_modo",
      "materias_reprobatorias_promocion",
    ])
    .executeTakeFirstOrThrow();

  return created;
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
  client: any,
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
  await sql`SET LOCAL my.app.bypass_triggers = 'true'`.execute(client);

  const previousScales = await client
    .selectFrom("escala_valoracion")
    .select(["id_escalavaloracion", "nivel"])
    .where("id_colegio", "=", schoolId)
    .orderBy("valor_minimo", "asc")
    .execute();

  const nextScalesDraft =
    scaleMode === "MANUAL"
      ? buildManualScales(nextMin, nextMax, nextApproval, manualBreaks?.basicMax, manualBreaks?.altoMax)
      : buildAutomaticScales(nextMin, nextMax, nextApproval);

  let nextScales: { id_escalavaloracion: number; nivel: string; valor_minimo: number; valor_maximo: number }[] = [];

  if (previousScales.length === nextScalesDraft.length) {
    for (let i = 0; i < previousScales.length; i++) {
      const existingId = previousScales[i].id_escalavaloracion;
      const draft = nextScalesDraft[i];
      await client
        .updateTable("escala_valoracion")
        .set({
          nivel: draft.nivel as any,
          valor_minimo: draft.valor_minimo,
          valor_maximo: draft.valor_maximo,
        })
        .where("id_escalavaloracion", "=", existingId)
        .execute();
      nextScales.push({ id_escalavaloracion: existingId, ...draft });
    }
  } else {
    await client
      .updateTable("notas_actividad")
      .set({ id_escalavaloracion: null })
      .where("id_colegio", "=", schoolId)
      .execute();

    if (previousScales.length > 0) {
      const oldIds = previousScales.map((r: any) => Number(r.id_escalavaloracion));
      await client
        .deleteFrom("escala_valoracion")
        .where("id_escalavaloracion", "in", oldIds)
        .execute();
    }

    const createdRes = await client
      .insertInto("escala_valoracion")
      .values(
        nextScalesDraft.map((d: any) => ({
          nivel: d.nivel as any,
          valor_minimo: d.valor_minimo,
          valor_maximo: d.valor_maximo,
          id_colegio: schoolId,
        }))
      )
      .returning(["id_escalavaloracion", "nivel", "valor_minimo", "valor_maximo"])
      .execute();

    nextScales = createdRes;
  }

  const notesRes = await client
    .selectFrom("notas_actividad")
    .select(["id_notaactividad", "nota"])
    .where("id_colegio", "=", schoolId)
    .execute();

  const previousRange = previousMax - previousMin;
  const nextRange = nextMax - nextMin;

  for (const row of notesRes) {
    const currentScore = Number(row.nota);
    const ratio = previousRange > 0 ? (currentScore - previousMin) / previousRange : 0;
    const normalizedRatio = clamp(ratio, 0, 1);
    const rescaledScore = roundToOne(nextMin + normalizedRatio * nextRange);
    const scale = assignScaleForScore(rescaledScore, nextScales);

    await client
      .updateTable("notas_actividad")
      .set({
        nota: rescaledScore,
        id_escalavaloracion: scale.id_escalavaloracion,
      })
      .where("id_notaactividad", "=", row.id_notaactividad)
      .execute();
  }

  const criteriaNotesRes = await client
    .selectFrom("nota_criterio")
    .select(["id_nota_criterio", "nota"])
    .where("id_colegio", "=", schoolId)
    .execute();

  for (const row of criteriaNotesRes) {
    const currentScore = Number(row.nota);
    const ratio = previousRange > 0 ? (currentScore - previousMin) / previousRange : 0;
    const normalizedRatio = clamp(ratio, 0, 1);
    const rescaledScore = roundToOne(nextMin + normalizedRatio * nextRange);

    await client
      .updateTable("nota_criterio")
      .set({
        nota: rescaledScore,
      })
      .where("id_nota_criterio", "=", row.id_nota_criterio)
      .execute();
  }

  const resultsRes = await client
    .selectFrom("resultado_academico as ra")
    .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
    .select(["ra.id_resultado", "ra.promedio"])
    .where("dg.id_colegio", "=", schoolId)
    .execute();

  for (const row of resultsRes) {
    const currentScore = Number(row.promedio);
    const ratio = previousRange > 0 ? (currentScore - previousMin) / previousRange : 0;
    const normalizedRatio = clamp(ratio, 0, 1);
    const rescaledScore = Number((nextMin + normalizedRatio * nextRange).toFixed(2));

    await client
      .updateTable("resultado_academico")
      .set({
        promedio: rescaledScore,
      })
      .where("id_resultado", "=", row.id_resultado)
      .execute();
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
    const allYears = await db
      .selectFrom("anio_lectivo")
      .select("id_anio")
      .where("id_colegio", "=", schoolId)
      .orderBy("id_anio", "desc")
      .execute();
    return allYears.map(r => Number(r.id_anio));
  }

  const eligibleYearIds = new Set<number>();

  // 1. Student enrollments
  if (userRoles.includes('estudiante')) {
    const studentYears = await db
      .selectFrom("matricula as m")
      .innerJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .leftJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .select("m.id_anio")
      .distinct()
      .where((eb) => eb.or([
        eb("e.id_usuario", "=", userId),
        eb(sql`UPPER(u.email)`, "=", userEmail.toUpperCase())
      ]))
      .where("m.id_colegio", "=", schoolId)
      .execute();
    studentYears.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // 2. Parent / Acudiente children enrollments
  if (userRoles.includes('padre')) {
    const parentYears = await db
      .selectFrom("matricula as m")
      .leftJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .leftJoin("detalle_padrefamilia as dpf", "dpf.id_estudiante", "e.id_estudiante")
      .leftJoin("padre_familia as pf", "pf.id_padrefamilia", "dpf.id_padrefamilia")
      .leftJoin("usuario as u", "u.id_usuario", "pf.id_usuario")
      .select("m.id_anio")
      .distinct()
      .where((eb) => eb.or([
        eb("pf.id_usuario", "=", userId),
        eb(sql`UPPER(u.email)`, "=", userEmail.toUpperCase()),
        eb(sql`UPPER(m.correo_padre)`, "=", userEmail.toUpperCase())
      ]))
      .where("m.id_colegio", "=", schoolId)
      .execute();
    parentYears.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // 3. Teacher participation in academic activities/evaluations/competencies/assignments
  if (userRoles.includes('docente')) {
    const teacherYears = await sql<{ id_anio: number }>`
      SELECT DISTINCT dg.id_anio
      FROM detalle_grados dg
      JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
      WHERE (d.id_usuario = ${userId} OR UPPER(u.email) = UPPER(${userEmail}))
        AND dg.id_colegio = ${schoolId}
        AND dg.id_anio IS NOT NULL

      UNION

      SELECT DISTINCT p.id_anio
      FROM periodo_academico p
      JOIN actividad_materia am ON am.id_periodo = p.id_periodo
      JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
      JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
      WHERE (d.id_usuario = ${userId} OR UPPER(u.email) = UPPER(${userEmail})) AND p.id_colegio = ${schoolId}
      
      UNION
      
      SELECT DISTINCT p.id_anio
      FROM registro_asistencia ra
      JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
      JOIN periodo_academico p ON p.id_colegio = dg.id_colegio
      JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
      WHERE (d.id_usuario = ${userId} OR UPPER(u.email) = UPPER(${userEmail})) AND p.id_colegio = ${schoolId}
      
      UNION
      
      SELECT DISTINCT p.id_anio
      FROM cierre_materia cm
      JOIN periodo_academico p ON p.id_periodo = cm.id_periodo
      JOIN detalle_grados dg ON dg.id_detallegrado = cm.id_detallegrado
      JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
      WHERE (d.id_usuario = ${userId} OR UPPER(u.email) = UPPER(${userEmail})) AND p.id_colegio = ${schoolId}

      UNION

      SELECT DISTINCT p.id_anio
      FROM observacion_estudiante oe
      JOIN detalle_grados dg ON dg.id_detallegrado = oe.id_detallegrado
      JOIN periodo_academico p ON p.id_periodo = oe.id_periodo
      JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
      WHERE (d.id_usuario = ${userId} OR UPPER(u.email) = UPPER(${userEmail})) AND p.id_colegio = ${schoolId}
    `.execute(db);
    teacherYears.rows.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // Filter out any academic years that ended before the user was registered
  if (eligibleYearIds.size > 0) {
    const validYearsRes = await sql<{ id_anio: number }>`
      SELECT al.id_anio
      FROM anio_lectivo al
      LEFT JOIN usuario u ON u.id_usuario = ${userId}
      WHERE al.id_anio = ANY(${Array.from(eligibleYearIds)}::int[])
        AND (
          u.fecha_creacion IS NULL OR
          NOT (
            EXTRACT(YEAR FROM u.fecha_creacion) > NULLIF(regexp_replace(al.calendario, '\\D', '', 'g'), '')::int
            OR (al.fecha_fin IS NOT NULL AND DATE(u.fecha_creacion) > al.fecha_fin)
          )
        )
    `.execute(db);
    eligibleYearIds.clear();
    validYearsRes.rows.forEach(r => eligibleYearIds.add(Number(r.id_anio)));
  }

  // Fallback: If no history found or filtered out, return active open year valid for creation date
  if (eligibleYearIds.size === 0) {
    const openYear = await sql<{ id_anio: number }>`
      SELECT al.id_anio
      FROM anio_lectivo al
      LEFT JOIN usuario u ON u.id_usuario = ${userId}
      WHERE al.id_colegio = ${schoolId}
        AND (
          u.fecha_creacion IS NULL OR
          NOT (
            EXTRACT(YEAR FROM u.fecha_creacion) > NULLIF(regexp_replace(al.calendario, '\\D', '', 'g'), '')::int
            OR (al.fecha_fin IS NOT NULL AND DATE(u.fecha_creacion) > al.fecha_fin)
          )
        )
      ORDER BY CASE WHEN al.estado = 'ABIERTO' THEN 0 ELSE 1 END, al.id_anio DESC
      LIMIT 1
    `.execute(db);
    if (openYear.rows.length > 0) {
      eligibleYearIds.add(Number(openYear.rows[0].id_anio));
    }
  }

  return Array.from(eligibleYearIds);
};

