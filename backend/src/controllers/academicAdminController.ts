import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../config/db";
import bcrypt from "bcrypt";
import { NotificationService } from "../services/notificationService";
import { getDefaultMonthsLabelForPeriodOrder, getAcademicYearLabel } from "../config/academicCalendarDefaults";
import {
  DEFAULT_COMPETENCY_TEXT,
  ensureCompetencySchema,
  harmonizeCompetenciesForSchoolYear,
  syncCompetencyAcrossGrade,
  TeachingContext,
} from "../config/competencyMigration";

const parseSchoolId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const ensureTeacherStatusColumn = async () => {};

const autoSwitchPeriodsForYear = async (client: any, schoolId: number, yearId: number): Promise<void> => {
  const yearRes = await client.query(
    `SELECT "id_año", calendario, tipo_calendario
     FROM "año_lectivo"
     WHERE "id_año" = $1 AND id_colegio = $2`,
    [yearId, schoolId]
  );
  if (!yearRes.rows.length) return;
  const yearRow = yearRes.rows[0];
  const calendarType = yearRow.tipo_calendario || 'A';

  const periodsRes = await client.query(
    `SELECT id_periodo, nombre, estado, porcentaje, trimestre, mes_inicio, dia_inicio, mes_fin, dia_fin
     FROM periodo_academico
     WHERE id_colegio = $1 AND "id_año" = $2
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
        // Compare month/day numerically — no dependency on the year label
        const nowVal = currentMonth * 100 + currentDay;
        const startVal = mesInicio * 100 + diaInicio;
        const endVal = mesFin * 100 + diaFin;
        if (nowVal >= startVal && nowVal <= endVal) {
          periodIdToOpen = p.id_periodo;
          break;
        }
      } else {
        // Normalize months to a linear scale: Aug(8)→1, Sep(9)→2, ..., Dec(12)→5, Jan(1)→6, ..., Jul(7)→12
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

const ensureAcademicYearForSchool = async (schoolId: number): Promise<number> => {
  const existing = await pool.query(
    `SELECT "id_año"
     FROM "año_lectivo"
     WHERE id_colegio = $1 AND estado = 'ABIERTO'
     ORDER BY "id_año" DESC
     LIMIT 1`,
    [schoolId]
  );

  if (existing.rows.length > 0) {
    return Number(existing.rows[0]["id_año"]);
  }

  // Fallback to highest year regardless of state if none are open
  const fallback = await pool.query(
    `SELECT "id_año"
     FROM "año_lectivo"
     WHERE id_colegio = $1
     ORDER BY "id_año" DESC
     LIMIT 1`,
    [schoolId]
  );

  if (fallback.rows.length > 0) {
    return Number(fallback.rows[0]["id_año"]);
  }

  const currentYear = new Date().getFullYear();
  const created = await pool.query(
    `INSERT INTO "año_lectivo" (calendario, id_colegio, tipo_calendario, estado)
     VALUES ($1, $2, 'A', 'ABIERTO')
     RETURNING "id_año"`,
    [String(currentYear), schoolId]
  );

  return Number(created.rows[0]["id_año"]);
};

const ensureSchoolSettingsTable = async () => {};
const ensureAcademicPeriodTrimesterColumn = async () => {};
const ensureAcademicPeriodDayColumns = async () => {};
const ensureAcademicPeriodMonthColumns = async () => {};

const ensureSchoolDefaultSettings = async (schoolId: number) => {

  const existing = await pool.query(
    `SELECT id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo
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
    `INSERT INTO configuracion_colegio (id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo)
     VALUES ($1, $2, $3, $4, 'AUTOMATICO')
     RETURNING id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo`,
    [schoolId, inferredMin, inferredMax, inferredApproval]
  );

  return created.rows[0];
};

const roundToOne = (value: number): number => Number(value.toFixed(1));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const buildAutomaticScales = (notaMinima: number, notaMaxima: number, notaAprobacion: number) => {
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

const buildManualScales = (
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

const assignScaleForScore = <T extends { id_escalavaloracion: number; valor_minimo: number | string; valor_maximo: number | string }>(
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

const syncSchoolScalesAndGrades = async (
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
    // Actualizar en sitio — preserva los IDs que notas_actividad referencia
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
    // Caso raro: número de niveles cambió → SET NULL en notas, borrar, reinsertar
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

  // Escalar tabla nota_criterio
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

  // Escalar tabla resultado_academico (promedio)
  // resultado_academico no tiene id_colegio directo — filtramos por colegio via detalle_grados
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
    // Para el promedio podemos usar 2 decimales para mayor precisión
    const rescaledScore = Number((nextMin + normalizedRatio * nextRange).toFixed(2));

    await client.query(
      `UPDATE resultado_academico
       SET promedio = $1
       WHERE id_resultado = $2`,
      [rescaledScore, row.id_resultado]
    );
  }

  console.log(`[syncSchoolScalesAndGrades] Processed ${notesRes.rows.length} activity notes, ${criteriaNotesRes.rows.length} criteria notes, and ${resultsRes.rows.length} results for school ${schoolId}`);
  return nextScales;
};



export const getAcademicCatalogs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [sectionsRes, levelsRes] = await Promise.all([
      pool.query("SELECT id_seccion, nombre FROM secciones ORDER BY nombre"),
      pool.query("SELECT id_nivel, nombre, id_colegio FROM nivel_escolar ORDER BY nombre"),
    ]);

    res.json({
      secciones: sectionsRes.rows,
      niveles: levelsRes.rows,
    });
  } catch (error: any) {
    console.error("Error fetching academic catalogs:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getGradeManagementData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const [jornadasRes, levelsRes, gradeTypesRes, groupsRes] = await Promise.all([
      pool.query(
        `SELECT id_jornada, nombre
         FROM jornada
         WHERE id_colegio = $1
         ORDER BY nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT id_nivel, nombre
         FROM nivel_escolar
         WHERE id_colegio = $1
         ORDER BY nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           tg.id_tipo_grado,
           tg.nombre,
           tg.id_nivel,
           ne.nombre AS nivel_nombre,
           COUNT(DISTINCT g.id_grupo)::int AS cursos_count
         FROM tipo_grado tg
         JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
         LEFT JOIN grupos g
           ON g.id_tipo_grado = tg.id_tipo_grado
          AND g.id_colegio = ne.id_colegio
         WHERE ne.id_colegio = $1
         GROUP BY tg.id_tipo_grado, tg.nombre, tg.id_nivel, ne.nombre
         ORDER BY ne.nombre, tg.nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           g.id_grupo,
           g.id_nivel,
           g.id_jornada,
           g.id_seccion,
           g.id_tipo_grado,
           g.cupos_totales,
           ne.nombre AS nivel_nombre,
           tg.nombre AS tipo_grado_nombre,
           j.nombre AS jornada_nombre,
           s.nombre AS seccion_nombre,
           COUNT(DISTINCT m.id_matricula)::int AS matriculas_count,
           COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count,
           COUNT(DISTINCT c.id_competencia)::int AS competencias_count
         FROM grupos g
         JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
         JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
         JOIN jornada j ON j.id_jornada = g.id_jornada
         JOIN secciones s ON s.id_seccion = g.id_seccion
         LEFT JOIN matricula m ON m.id_grupo = g.id_grupo
         LEFT JOIN detalle_grados dg ON dg.id_grupo = g.id_grupo
         LEFT JOIN competencias c ON c.id_grupo = g.id_grupo
         WHERE g.id_colegio = $1
         GROUP BY
           g.id_grupo, g.id_nivel, g.id_jornada, g.id_seccion, g.id_tipo_grado, g.cupos_totales,
           ne.nombre, tg.nombre, j.nombre, s.nombre
         ORDER BY ne.nombre, tg.nombre, j.nombre, s.nombre`,
        [schoolId]
      ),
    ]);

    res.json({
      jornadas: jornadasRes.rows,
      niveles: levelsRes.rows,
      tiposGrado: gradeTypesRes.rows,
      grupos: groupsRes.rows,
    });
  } catch (error: any) {
    console.error("Error fetching grade management data:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createGradeType = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const levelId = Number(req.body.id_nivel);
  const nombre = String(req.body.nombre || "").trim().toUpperCase();

  if (!schoolId || !levelId || !nombre) {
    res.status(400).json({ error: "Nivel y nombre del grado son obligatorios" });
    return;
  }

  try {
    const levelRes = await pool.query(
      "SELECT id_nivel FROM nivel_escolar WHERE id_nivel = $1 AND id_colegio = $2",
      [levelId, schoolId]
    );

    if (levelRes.rows.length === 0) {
      res.status(404).json({ error: "Nivel académico no encontrado para este colegio" });
      return;
    }

    const duplicateRes = await pool.query(
      `SELECT id_tipo_grado
       FROM tipo_grado
       WHERE id_nivel = $1
         AND UPPER(TRIM(nombre)) = $2`,
      [levelId, nombre]
    );

    if (duplicateRes.rows.length > 0) {
      res.status(409).json({ error: "Ya existe un grado con ese nombre en el nivel seleccionado" });
      return;
    }

    const created = await pool.query(
      `INSERT INTO tipo_grado (nombre, id_nivel)
       VALUES ($1, $2)
       RETURNING id_tipo_grado, nombre, id_nivel`,
      [nombre, levelId]
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error creating grade type:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const deleteGradeType = async (req: Request, res: Response): Promise<void> => {
  const gradeTypeId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!gradeTypeId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const impactRes = await pool.query(
      `SELECT
         tg.id_tipo_grado,
         COUNT(DISTINCT g.id_grupo)::int AS cursos_count,
         COUNT(DISTINCT m.id_matricula)::int AS matriculas_count,
         COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count
       FROM tipo_grado tg
       JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
       LEFT JOIN grupos g ON g.id_tipo_grado = tg.id_tipo_grado AND g.id_colegio = ne.id_colegio
       LEFT JOIN matricula m ON m.id_grupo = g.id_grupo
       LEFT JOIN detalle_grados dg ON dg.id_grupo = g.id_grupo
       WHERE tg.id_tipo_grado = $1
         AND ne.id_colegio = $2
       GROUP BY tg.id_tipo_grado`,
      [gradeTypeId, schoolId]
    );

    if (impactRes.rows.length === 0) {
      res.status(404).json({ error: "Grado no encontrado" });
      return;
    }

    const impact = impactRes.rows[0];
    if (impact.cursos_count > 0 || impact.matriculas_count > 0 || impact.asignaciones_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar el grado porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    await pool.query("DELETE FROM tipo_grado WHERE id_tipo_grado = $1", [gradeTypeId]);
    res.json({ message: "Grado eliminado correctamente" });
  } catch (error: any) {
    console.error("Error deleting grade type:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const idNivel = Number(req.body.id_nivel);
  const idJornada = Number(req.body.id_jornada);
  const idSeccion = Number(req.body.id_seccion);
  const idTipoGrado = Number(req.body.id_tipo_grado);
  const cuposTotales = Number(req.body.cupos_totales);

  if (!schoolId || !idNivel || !idJornada || !idSeccion || !idTipoGrado || cuposTotales < 0) {
    res.status(400).json({ error: "Todos los campos del curso son obligatorios" });
    return;
  }

  try {
    const validationRes = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM nivel_escolar WHERE id_nivel = $1 AND id_colegio = $2) AS nivel_ok,
         EXISTS(SELECT 1 FROM jornada WHERE id_jornada = $3 AND id_colegio = $2) AS jornada_ok,
         EXISTS(SELECT 1 FROM secciones WHERE id_seccion = $4) AS seccion_ok,
         EXISTS(
           SELECT 1
           FROM tipo_grado tg
           JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
           WHERE tg.id_tipo_grado = $5
             AND ne.id_colegio = $2
             AND tg.id_nivel = $1
         ) AS tipo_ok`,
      [idNivel, schoolId, idJornada, idSeccion, idTipoGrado]
    );

    const validation = validationRes.rows[0];
    if (!validation.nivel_ok || !validation.jornada_ok || !validation.seccion_ok || !validation.tipo_ok) {
      res.status(400).json({ error: "La combinación de nivel, jornada, sección y grado no es válida" });
      return;
    }

    const duplicateRes = await pool.query(
      `SELECT id_grupo
       FROM grupos
       WHERE id_colegio = $1
         AND id_nivel = $2
         AND id_jornada = $3
         AND id_seccion = $4
         AND id_tipo_grado = $5`,
      [schoolId, idNivel, idJornada, idSeccion, idTipoGrado]
    );

    if (duplicateRes.rows.length > 0) {
      res.status(409).json({ error: "Ya existe un curso con esta combinación de jornada, grado y sección" });
      return;
    }

    const created = await pool.query(
      `INSERT INTO grupos (id_nivel, id_jornada, id_colegio, id_seccion, cupos_totales, id_tipo_grado)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [idNivel, idJornada, schoolId, idSeccion, cuposTotales, idTipoGrado]
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error creating group:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const deleteGroup = async (req: Request, res: Response): Promise<void> => {
  const groupId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!groupId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const impactRes = await pool.query(
      `SELECT
         g.id_grupo,
         COUNT(DISTINCT m.id_matricula)::int AS matriculas_count,
         COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count,
         COUNT(DISTINCT c.id_competencia)::int AS competencias_count
       FROM grupos g
       LEFT JOIN matricula m ON m.id_grupo = g.id_grupo
       LEFT JOIN detalle_grados dg ON dg.id_grupo = g.id_grupo
       LEFT JOIN competencias c ON c.id_grupo = g.id_grupo
       WHERE g.id_grupo = $1
         AND g.id_colegio = $2
       GROUP BY g.id_grupo`,
      [groupId, schoolId]
    );

    if (impactRes.rows.length === 0) {
      res.status(404).json({ error: "Curso no encontrado" });
      return;
    }

    const impact = impactRes.rows[0];
    if (impact.matriculas_count > 0 || impact.asignaciones_count > 0 || impact.competencias_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar el curso porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    await pool.query("DELETE FROM grupos WHERE id_grupo = $1", [groupId]);
    res.json({ message: "Curso eliminado correctamente" });
  } catch (error: any) {
    console.error("Error deleting group:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateGroupCupos = async (req: Request, res: Response): Promise<void> => {
  const groupId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const newCupos = Number(req.body.cupos_totales);

  if (!groupId || !schoolId || isNaN(newCupos) || newCupos < 0) {
    res.status(400).json({ error: "Parámetros inválidos. Los cupos deben ser un número positivo." });
    return;
  }

  try {
    // 1. Verificar existencia y pertenencia al colegio
    const groupRes = await pool.query(
      "SELECT id_grupo FROM grupos WHERE id_grupo = $1 AND id_colegio = $2",
      [groupId, schoolId]
    );

    if (groupRes.rows.length === 0) {
      res.status(404).json({ error: "Curso no encontrado o no pertenece a su institución" });
      return;
    }

    // 2. Contar matrículas actuales
    const matriculasRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM matricula WHERE id_grupo = $1",
      [groupId]
    );
    const matriculadosActuales = matriculasRes.rows[0].count;

    if (newCupos < matriculadosActuales) {
      res.status(400).json({ 
        error: `No se puede reducir el cupo a ${newCupos} porque ya existen ${matriculadosActuales} estudiantes matriculados en este curso.` 
      });
      return;
    }

    // 3. Actualizar
    await pool.query(
      "UPDATE grupos SET cupos_totales = $1 WHERE id_grupo = $2",
      [newCupos, groupId]
    );

    res.json({ message: "Capacidad del curso actualizada exitosamente", cupos_totales: newCupos });
  } catch (error: any) {
    console.error("Error updating group cupos:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getSubjects = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const subjectsRes = await pool.query(
      `SELECT
         m.id_materia,
         m.nombre,
         COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count,
         COUNT(DISTINCT c.id_competencia)::int AS competencias_count
       FROM materias m
       LEFT JOIN detalle_grados dg ON dg.id_materia = m.id_materia
       LEFT JOIN competencias c ON c.id_materia = m.id_materia
       WHERE m.id_colegio = $1
       GROUP BY m.id_materia, m.nombre
       ORDER BY m.nombre`,
      [schoolId]
    );

    res.json(subjectsRes.rows);
  } catch (error: any) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const ensureAcademicPeriodPendingStatus = async () => {};

export const getAcademicSettingsData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const currentYearId = await ensureAcademicYearForSchool(schoolId);

    // Auto-switch periods based on current date
    await autoSwitchPeriodsForYear(pool, schoolId, currentYearId);

    const competencyClient = await pool.connect();
    try {
      await competencyClient.query("BEGIN");
      await harmonizeCompetenciesForSchoolYear(competencyClient, schoolId, currentYearId);
      await competencyClient.query("COMMIT");
    } catch (error) {
      await competencyClient.query("ROLLBACK");
      throw error;
    } finally {
      competencyClient.release();
    }

    const [yearRes, academicYearsRes, defaultSettingsRes, periodsRes, scalesRes, assignmentsRes, competenciesRes, closureSummaryRes] = await Promise.all([
      pool.query(
        `SELECT "id_año", calendario, tipo_calendario, estado
         FROM "año_lectivo"
         WHERE "id_año" = $1
           AND id_colegio = $2`,
        [currentYearId, schoolId]
      ),
      pool.query(
        `SELECT "id_año", calendario, tipo_calendario, estado
         FROM "año_lectivo"
         WHERE id_colegio = $1
         ORDER BY "id_año" DESC`,
        [schoolId]
      ),
      ensureSchoolDefaultSettings(schoolId),
      pool.query(
        `SELECT id_periodo, nombre, estado, porcentaje, trimestre, dia_inicio, dia_fin, mes_inicio, mes_fin, "id_año"
         FROM periodo_academico
         WHERE id_colegio = $1
         ORDER BY id_periodo`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           ev.id_escalavaloracion,
           ev.nivel,
           ev.valor_minimo,
           ev.valor_maximo,
           COUNT(DISTINCT n.id_notaactividad)::int AS notas_count
         FROM escala_valoracion ev
         LEFT JOIN notas_actividad n ON n.id_escalavaloracion = ev.id_escalavaloracion
         WHERE ev.id_colegio = $1
         GROUP BY ev.id_escalavaloracion
         ORDER BY ev.valor_minimo DESC, ev.valor_maximo DESC`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           dg.id_detallegrado,
           dg.id_grupo,
           dg.id_materia,
           m.nombre AS materia_nombre,
           ne.nombre AS nivel_nombre,
           tg.nombre AS tipo_grado_nombre,
           s.nombre AS seccion_nombre,
           j.nombre AS jornada_nombre
         FROM detalle_grados dg
         JOIN materias m ON m.id_materia = dg.id_materia
         JOIN grupos g ON g.id_grupo = dg.id_grupo
         JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
         JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
         JOIN secciones s ON s.id_seccion = g.id_seccion
         JOIN jornada j ON j.id_jornada = g.id_jornada
         WHERE dg.id_colegio = $1
           AND dg.id_grupo IS NOT NULL
         ORDER BY ne.nombre, tg.nombre, j.nombre, s.nombre, m.nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           c.id_competencia,
           c.id_grupo,
           c.id_materia,
           c.id_periodo,
           c.descripcion,
           CASE
             WHEN EXISTS (
               SELECT 1
               FROM competencias c2
               JOIN grupos g2 ON g2.id_grupo = c2.id_grupo
               WHERE c2.id_colegio = c.id_colegio
                 AND c2.id_materia = c.id_materia
                 AND c2.id_periodo = c.id_periodo
                 AND g2.id_nivel = g.id_nivel
                 AND g2.id_tipo_grado = g.id_tipo_grado
                 AND UPPER(TRIM(TRAILING '.' FROM c2.descripcion)) <> UPPER(TRIM(TRAILING '.' FROM $2))
             ) THEN 'DEFINIDA'
             ELSE 'PENDIENTE'
           END AS estado,
           m.nombre AS materia_nombre,
           p.nombre AS periodo_nombre,
           ne.nombre AS nivel_nombre,
           tg.nombre AS tipo_grado_nombre,
           s.nombre AS seccion_nombre,
           j.nombre AS jornada_nombre,
           COALESCE(
             (
               SELECT json_agg(
                 json_build_object(
                   'id_evidencia', ev.id_evidencia,
                   'descripcion',  ev.descripcion,
                   'orden',        ev.orden
                 )
                 ORDER BY ev.orden, ev.id_evidencia
               )
               FROM evidencia_aprendizaje ev
               WHERE ev.id_competencia = c.id_competencia
             ),
             '[]'::json
           ) AS evidencias
         FROM competencias c
         JOIN materias m ON m.id_materia = c.id_materia
         JOIN periodo_academico p ON p.id_periodo = c.id_periodo
         JOIN grupos g ON g.id_grupo = c.id_grupo
         JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
         JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
         JOIN secciones s ON s.id_seccion = g.id_seccion
         JOIN jornada j ON j.id_jornada = g.id_jornada
         WHERE c.id_colegio = $1
         ORDER BY p.id_periodo, ne.nombre, tg.nombre, m.nombre`,
        [schoolId, DEFAULT_COMPETENCY_TEXT]
      ),
      pool.query(
        `SELECT
           p.id_periodo,
           p.nombre,
           p.estado,
           COUNT(DISTINCT dg.id_detallegrado)::int AS total_asignaciones,
           COUNT(DISTINCT CASE WHEN cm.estado = 'CERRADO' THEN cm.id_detallegrado END)::int AS asignaciones_cerradas
         FROM periodo_academico p
         LEFT JOIN detalle_grados dg
           ON dg.id_colegio = p.id_colegio
          AND dg.id_grupo IS NOT NULL
         LEFT JOIN cierre_materia cm
           ON cm.id_periodo = p.id_periodo
          AND cm.id_detallegrado = dg.id_detallegrado
         WHERE p.id_colegio = $1
         GROUP BY p.id_periodo
         ORDER BY p.id_periodo`,
        [schoolId]
      ),
    ]);

    const periodsWithDefaults = periodsRes.rows.map((period, index) => ({
      ...period,
      meses_referencia: getDefaultMonthsLabelForPeriodOrder(index + 1),
    }));

    res.json({
      currentYear: yearRes.rows[0] || null,
      activeYear: yearRes.rows[0] || null,
      academicYears: academicYearsRes.rows,
      defaultSettings: defaultSettingsRes,
      periods: periodsWithDefaults,
      scales: scalesRes.rows,
      assignments: assignmentsRes.rows,
      competencies: competenciesRes.rows,
      closureSummary: closureSummaryRes.rows,
    });
  } catch (error: any) {
    console.error("Error fetching academic settings:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();
  const porcentaje = Number(req.body.porcentaje);
  const mesInicio = Number(req.body.mes_inicio);
  const diaInicio = Number(req.body.dia_inicio);
  const mesFin = Number(req.body.mes_fin);
  const diaFin = Number(req.body.dia_fin);
  const targetYearId = req.body.id_año ? Number(req.body.id_año) : null;
  const estadoInput = req.body.estado;
  const estado = (estadoInput === 'ABIERTO' || estadoInput === 'CERRADO' || estadoInput === 'PENDIENTE') ? estadoInput : 'PENDIENTE';
  const { motivo_cambio } = req.body;

  if (
    !schoolId ||
    !nombre ||
    Number.isNaN(porcentaje) ||
    porcentaje <= 0 ||
    !mesInicio || !diaInicio || !mesFin || !diaFin
  ) {
    res.status(400).json({ error: "Nombre, porcentaje y rango de fechas (mes/día) son obligatorios" });
    return;
  }

  if (diaInicio !== null && (!Number.isInteger(diaInicio) || diaInicio < 1 || diaInicio > 31)) {
    res.status(400).json({ error: "El día de inicio debe ser un número entre 1 y 31" });
    return;
  }

  if (diaFin !== null && (!Number.isInteger(diaFin) || diaFin < 1 || diaFin > 31)) {
    res.status(400).json({ error: "El día de fin debe ser un número entre 1 y 31" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await ensureAcademicPeriodTrimesterColumn();
    await ensureAcademicPeriodDayColumns();
    await ensureAcademicPeriodPendingStatus();
    const finalYearId = targetYearId || await ensureAcademicYearForSchool(schoolId);

    // Get school year info for calendar type
    const yearRes = await client.query(
      `SELECT tipo_calendario FROM "año_lectivo" WHERE "id_año" = $1 AND id_colegio = $2`,
      [finalYearId, schoolId]
    );
    const calendarType = yearRes.rows[0]?.tipo_calendario || 'A';

    // Validate ranges don't overlap with other periods
    const otherPeriodsRes = await client.query(
      `SELECT id_periodo, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin
       FROM periodo_academico
       WHERE id_colegio = $1 AND "id_año" = $2`,
      [schoolId, finalYearId]
    );

    const getNormalizedDateVal = (month: number, day: number, calType: string) => {
      if (calType === 'B') {
        const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
        return normalizeMonth(month) * 100 + day;
      }
      return month * 100 + day;
    };

    const newStartVal = getNormalizedDateVal(mesInicio, diaInicio, calendarType);
    const newEndVal = getNormalizedDateVal(mesFin, diaFin, calendarType);

    if (newStartVal > newEndVal) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "La fecha de inicio no puede ser posterior a la fecha de fin" });
      return;
    }

    for (const other of otherPeriodsRes.rows) {
      if (other.mes_inicio && other.dia_inicio && other.mes_fin && other.dia_fin) {
        const otherStartVal = getNormalizedDateVal(other.mes_inicio, other.dia_inicio, calendarType);
        const otherEndVal = getNormalizedDateVal(other.mes_fin, other.dia_fin, calendarType);

        const overlap = !(newEndVal < otherStartVal || otherEndVal < newStartVal);
        if (overlap) {
          await client.query("ROLLBACK");
          res.status(409).json({
            error: `El rango de fechas se superpone con el periodo '${other.nombre}' (${other.dia_inicio}/${other.mes_inicio} - ${other.dia_fin}/${other.mes_fin})`
          });
          return;
        }
      }
    }

    // If pending state: "Un periodo en estado pendiente no puede tener un rango de fechas anterior al periodo actual"
    if (estado === 'PENDIENTE') {
      const activePeriodRes = await client.query(
        `SELECT id_periodo, nombre, mes_inicio, mes_fin, dia_inicio, dia_fin
         FROM periodo_academico
         WHERE id_colegio = $1 AND "id_año" = $2 AND estado = 'ABIERTO'
         LIMIT 1`,
        [schoolId, finalYearId]
      );

      if (activePeriodRes.rows.length > 0) {
        const active = activePeriodRes.rows[0];
        if (active.mes_fin && active.dia_fin) {
          const activeEndVal = getNormalizedDateVal(active.mes_fin, active.dia_fin, calendarType);
          if (newStartVal < activeEndVal) {
            await client.query("ROLLBACK");
            res.status(400).json({
              error: `Un periodo en estado Pendiente no puede tener un rango de fechas anterior al periodo actual (${active.nombre})`
            });
            return;
          }
        }
      }
    }

    const totalsRes = await client.query(
      `SELECT COALESCE(SUM(porcentaje), 0)::numeric AS total
       FROM periodo_academico
       WHERE id_colegio = $1 AND "id_año" = $2`,
      [schoolId, finalYearId]
    );

    const currentTotal = Number(totalsRes.rows[0].total);
    if (currentTotal + porcentaje > 100) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: `No es posible crear el periodo porque la suma de porcentajes excede 100%. Actual: ${currentTotal}%`,
      });
      return;
    }

    const duplicateRes = await client.query(
      `SELECT id_periodo
       FROM periodo_academico
       WHERE id_colegio = $1
         AND "id_año" = $2
         AND UPPER(TRIM(nombre)) = UPPER(TRIM($3))`,
      [schoolId, finalYearId, nombre]
    );

    if (duplicateRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Ya existe un periodo académico con ese nombre en este año" });
      return;
    }

    // Determine the next trimestre number
    const maxTrimestreRes = await client.query(
      `SELECT COALESCE(MAX(trimestre), 0) as max_trim
       FROM periodo_academico
       WHERE id_colegio = $1 AND "id_año" = $2`,
      [schoolId, finalYearId]
    );
    const nextTrimestre = Number(maxTrimestreRes.rows[0].max_trim) + 1;

    const created = await pool.query(
      `INSERT INTO periodo_academico (nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, "id_año", id_colegio, trimestre)
       VALUES ($1, $2::estado_periodo, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, "id_año", trimestre`,
      [nombre, estado, porcentaje, mesInicio, diaInicio, mesFin, diaFin, finalYearId, schoolId, nextTrimestre]
    );

    const newPeriod = created.rows[0];

    // Audit check (if in supervision mode)
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      const auditRes = await client.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    if (activeAuditoriaId) {
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'CREACION', 'Creación de periodo académico', $2, NULL, $3, $4)`,
        [activeAuditoriaId, `Periodo ID: ${newPeriod.id_periodo} (${nombre})`, JSON.stringify(newPeriod), motivo_cambio || 'Creación inicial']
      );
    }

    await client.query("COMMIT");
    res.status(201).json(newPeriod);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creating academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const createAcademicYear = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const yearId = Number(req.body.id_año);
  const calendario = String(req.body.calendario || "A").trim().toUpperCase();

  if (!schoolId || Number.isNaN(yearId) || yearId < 2000 || yearId > 2100) {
    res.status(400).json({ error: "El año lectivo es inválido" });
    return;
  }

  if (calendario !== "A" && calendario !== "B") {
    res.status(400).json({ error: "El tipo de calendario debe ser A o B" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const yearLabel = getAcademicYearLabel(yearId, calendario as "A" | "B");

    const duplicateRes = await client.query(
      `SELECT "id_año"
       FROM "año_lectivo"
       WHERE calendario = $1
         AND id_colegio = $2`,
      [yearLabel, schoolId]
    );

    if (duplicateRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Ese año lectivo ya está configurado para el colegio" });
      return;
    }

    const createdYear = await client.query(
      `INSERT INTO "año_lectivo" (calendario, id_colegio, tipo_calendario)
       VALUES ($1, $2, $3)
       RETURNING "id_año", calendario, tipo_calendario`,
      [yearLabel, schoolId, calendario]
    );

    const newYearId = Number(createdYear.rows[0]["id_año"]);

    // Auto-generate standard periods based on chosen calendar type
    const periodsTemplate = calendario === "A" ? [
      { nombre: "Primer Periodo", porcentaje: 25, trimestre: 1, mes_inicio: 2, dia_inicio: 1, mes_fin: 3, dia_fin: 28 },
      { nombre: "Segundo Periodo", porcentaje: 25, trimestre: 2, mes_inicio: 4, dia_inicio: 1, mes_fin: 6, dia_fin: 28 },
      { nombre: "Tercer Periodo", porcentaje: 25, trimestre: 3, mes_inicio: 7, dia_inicio: 1, mes_fin: 9, dia_fin: 28 },
      { nombre: "Cuarto Periodo", porcentaje: 25, trimestre: 4, mes_inicio: 10, dia_inicio: 1, mes_fin: 12, dia_fin: 28 }
    ] : [
      { nombre: "Primer Periodo", porcentaje: 25, trimestre: 1, mes_inicio: 8, dia_inicio: 1, mes_fin: 10, dia_fin: 15 },
      { nombre: "Segundo Periodo", porcentaje: 25, trimestre: 2, mes_inicio: 10, dia_inicio: 16, mes_fin: 12, dia_fin: 15 },
      { nombre: "Tercer Periodo", porcentaje: 25, trimestre: 3, mes_inicio: 1, dia_inicio: 15, mes_fin: 3, dia_fin: 31 },
      { nombre: "Cuarto Periodo", porcentaje: 25, trimestre: 4, mes_inicio: 4, dia_inicio: 1, mes_fin: 6, dia_fin: 15 }
    ];

    const generatedPeriods = [];
    for (const p of periodsTemplate) {
      const pRes = await client.query(
        `INSERT INTO periodo_academico (nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, "id_año", id_colegio, trimestre)
         VALUES ($1, 'CERRADO', $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, trimestre`,
        [p.nombre, p.porcentaje, p.mes_inicio, p.dia_inicio, p.mes_fin, p.dia_fin, newYearId, schoolId, p.trimestre]
      );
      generatedPeriods.push(pRes.rows[0]);
    }

    await autoSwitchPeriodsForYear(client, schoolId, newYearId);

    const updatedPeriodsRes = await client.query(
      `SELECT id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, trimestre
       FROM periodo_academico
       WHERE "id_año" = $1 AND id_colegio = $2
       ORDER BY id_periodo`,
      [newYearId, schoolId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...createdYear.rows[0],
      periods: updatedPeriodsRes.rows,
      message: `Año lectivo ${yearLabel} creado con Calendario ${calendario}. Se han generado automáticamente sus 4 periodos estándar.`
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creating academic year:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const deleteAcademicYear = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const yearId = Number(req.params.id);

  if (!schoolId || Number.isNaN(yearId)) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if there are any active enrollments (matriculas) for this year
    const matriculaCheck = await client.query(
      `SELECT id_matricula
       FROM matricula
       WHERE "id_año" = $1 AND id_colegio = $2
       LIMIT 1`,
      [yearId, schoolId]
    );

    if (matriculaCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: "No es posible eliminar el año lectivo porque ya tiene matrículas asociadas en el sistema.",
      });
      return;
    }

    // Delete associated periods first
    await client.query(
      `DELETE FROM periodo_academico
       WHERE "id_año" = $1 AND id_colegio = $2`,
      [yearId, schoolId]
    );

    // Delete the year
    await client.query(
      `DELETE FROM "año_lectivo"
       WHERE "id_año" = $1 AND id_colegio = $2`,
      [yearId, schoolId]
    );

    await client.query("COMMIT");
    res.json({ message: "Año lectivo y sus periodos eliminados exitosamente." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error deleting academic year:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const updateAcademicYearStatus = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const yearId = Number(req.params.id);
  const nuevoEstado = String(req.body.estado || "").trim().toUpperCase();

  if (!schoolId || Number.isNaN(yearId) || (nuevoEstado !== "ABIERTO" && nuevoEstado !== "CERRADO")) {
    res.status(400).json({ error: "Parámetros de cambio de estado inválidos" });
    return;
  }

  try {
    const resUpdate = await pool.query(
      `UPDATE "año_lectivo"
       SET estado = $1
       WHERE "id_año" = $2 AND id_colegio = $3
       RETURNING "id_año", calendario, tipo_calendario, estado`,
      [nuevoEstado, yearId, schoolId]
    );

    if (resUpdate.rows.length === 0) {
      res.status(404).json({ error: "Año lectivo no encontrado" });
      return;
    }

    res.json(resUpdate.rows[0]);
  } catch (error: any) {
    console.error("Error updating academic year status:", error);
    res.status(500).json({ error: "Error en el servidor" });
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

export const updateManualScaleConfiguration = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const basicoMax = roundToOne(Number(req.body.basico_max));
  const altoMax = roundToOne(Number(req.body.alto_max));

  if (!schoolId || Number.isNaN(basicoMax) || Number.isNaN(altoMax)) {
    res.status(400).json({ error: "Los cortes manuales de las escalas son obligatorios" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureSchoolSettingsTable();

    const settingsRes = await client.query(
      `SELECT nota_minima, nota_maxima, nota_aprobacion
       FROM configuracion_colegio
       WHERE id_colegio = $1
       FOR UPDATE`,
      [schoolId]
    );

    const settings = settingsRes.rows[0] ?? (await ensureSchoolDefaultSettings(schoolId));
    const notaMinima = Number(settings.nota_minima);
    const notaMaxima = Number(settings.nota_maxima);
    const notaAprobacion = Number(settings.nota_aprobacion);

    if (basicoMax < notaAprobacion || basicoMax > notaMaxima - 0.2) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "El máximo de BASICO deja sin espacio válido al resto de escalas" });
      return;
    }

    if (altoMax < basicoMax + 0.1 || altoMax > notaMaxima - 0.1) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "El máximo de ALTO debe quedar por encima de BASICO y por debajo de SUPERIOR" });
      return;
    }

    await client.query(
      `UPDATE configuracion_colegio
       SET escala_modo = 'MANUAL'
       WHERE id_colegio = $1`,
      [schoolId]
    );

    const syncedScales = await syncSchoolScalesAndGrades(
      client,
      schoolId,
      notaMinima,
      notaMaxima,
      notaMinima,
      notaMaxima,
      notaAprobacion,
      "MANUAL",
      { basicMax: basicoMax, altoMax }
    );

    await client.query("COMMIT");
    res.json({
      message: "Escalas manuales actualizadas correctamente",
      scales: syncedScales,
      escala_modo: "MANUAL",
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating manual scale configuration:", error);
    res.status(500).json({ error: error.message || "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const upsertCompetencyByAdmin = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const groupId = Number(req.body.id_grupo);
  const subjectId = Number(req.body.id_materia);
  const periodId = Number(req.body.id_periodo);
  const descripcion = String(req.body.descripcion || "").trim();

  if (!schoolId || !groupId || !subjectId || !periodId || !descripcion) {
    res.status(400).json({ error: "Curso, materia, periodo y descripción son obligatorios" });
    return;
  }

  try {
    const contextRes = await pool.query(
      `SELECT p."id_año"
       FROM periodo_academico p
       WHERE p.id_periodo = $1
         AND p.id_colegio = $2`,
      [periodId, schoolId]
    );

    if (contextRes.rows.length === 0) {
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const client = await pool.connect();
    try {
      const context: TeachingContext = {
        idDetalleGrado: 0,
        idGrupo: groupId,
        idMateria: subjectId,
        idColegio: schoolId,
        idAnio: Number(contextRes.rows[0]["id_año"]),
      };

      await client.query("BEGIN");
      const created = await syncCompetencyAcrossGrade(client, context, periodId, descripcion);
      await client.query("COMMIT");

      res.json(created);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error upserting competency by admin:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const closeAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const force = Boolean(req.body.force);

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const periodRes = await client.query(
      `SELECT id_periodo, nombre, estado
       FROM periodo_academico
       WHERE id_periodo = $1
         AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const period = periodRes.rows[0];
    if (period.estado === 'PENDIENTE') {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Un periodo en estado Pendiente no se puede cerrar directamente. Debe ser aprobado primero." });
      return;
    }

    const assignmentsRes = await client.query(
      `SELECT
         dg.id_detallegrado,
         m.nombre AS materia_nombre,
         ne.nombre AS nivel_nombre,
         tg.nombre AS tipo_grado_nombre,
         s.nombre AS seccion_nombre,
         j.nombre AS jornada_nombre
       FROM detalle_grados dg
       JOIN materias m ON m.id_materia = dg.id_materia
       JOIN grupos g ON g.id_grupo = dg.id_grupo
       JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       JOIN secciones s ON s.id_seccion = g.id_seccion
       JOIN jornada j ON j.id_jornada = g.id_jornada
       WHERE dg.id_colegio = $1
         AND dg.id_grupo IS NOT NULL`,
      [schoolId]
    );

    const closedRes = await client.query(
      `SELECT id_detallegrado
       FROM cierre_materia
       WHERE id_periodo = $1
         AND estado = 'CERRADO'`,
      [periodId]
    );

    const closedIds = new Set(closedRes.rows.map((row) => Number(row.id_detallegrado)));
    const pending = assignmentsRes.rows.filter((row) => !closedIds.has(Number(row.id_detallegrado)));

    if (pending.length > 0 && !force) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: "No se puede cerrar el periodo porque hay asignaciones pendientes",
        pending,
      });
      return;
    }

    if (force && pending.length > 0) {
      for (const row of pending) {
        await client.query(
          `INSERT INTO cierre_materia (id_detallegrado, id_periodo, estado, fecha_cierre)
           SELECT $1, $2, 'CERRADO', NOW()
           WHERE NOT EXISTS (
             SELECT 1
             FROM cierre_materia
             WHERE id_detallegrado = $1
               AND id_periodo = $2
           )`,
          [row.id_detallegrado, periodId]
        );
      }
    }

    await client.query(
      `UPDATE periodo_academico
       SET estado = 'CERRADO'
       WHERE id_periodo = $1
         AND id_colegio = $2`,
      [periodId, schoolId]
    );

    await client.query("COMMIT");
    res.json({
      message: force ? "Periodo cerrado con cierre forzado" : "Periodo cerrado correctamente",
      pendingResolved: pending.length,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error closing academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const reopenAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const updated = await pool.query(
      `UPDATE periodo_academico
       SET estado = 'ABIERTO'
       WHERE id_periodo = $1
         AND id_colegio = $2
         AND estado = 'CERRADO'`,
      [periodId, schoolId]
    );

    if (updated.rowCount === 0) {
      res.status(404).json({ error: "Periodo no encontrado o no está cerrado" });
      return;
    }

    res.json({ message: "Periodo reabierto con éxito" });
  } catch (error: any) {
    console.error("Error reopening academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const reopenSubjectClosure = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  const detailGradeId = Number(req.params.detailGradeId);
  const schoolId = parseSchoolId(req.body.schoolId);

  if (!periodId || !detailGradeId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    // 1. Verify period is from the same school
    const periodCheck = await pool.query(
      `SELECT id_periodo
       FROM periodo_academico
       WHERE id_periodo = $1
         AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodCheck.rows.length === 0) {
      res.status(404).json({ error: "Periodo no encontrado o no es de tu colegio" });
      return;
    }

    // 2. Erase teacher closure history for this period & detail
    const deleted = await pool.query(
      `DELETE FROM cierre_materia
       WHERE id_detallegrado = $1
         AND id_periodo = $2`,
      [detailGradeId, periodId]
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ error: "La materia no estaba cerrada para este periodo" });
      return;
    }

    res.json({ message: "Desbloqueado con éxito de cierre" });
  } catch (error: any) {
    console.error("Error reopening subject closure:", error);
    res.status(500).json({ error: "Error en el servidor al deshacer cierre de materia" });
  }
};

export const updateAcademicPeriodPercentage = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const porcentaje = Number(req.body.porcentaje);
  const mesInicio = Number(req.body.mes_inicio);
  const diaInicio = Number(req.body.dia_inicio);
  const mesFin = Number(req.body.mes_fin);
  const diaFin = Number(req.body.dia_fin);
  const { motivo_cambio } = req.body;

  if (!periodId || !schoolId || Number.isNaN(porcentaje) || porcentaje <= 0 || !mesInicio || !diaInicio || !mesFin || !diaFin) {
    res.status(400).json({ error: "Todos los campos (porcentaje y rango de fechas) son obligatorios" });
    return;
  }

  if (diaInicio !== null && (!Number.isInteger(diaInicio) || diaInicio < 1 || diaInicio > 31)) {
    res.status(400).json({ error: "El día de inicio debe ser un número entre 1 y 31" });
    return;
  }

  if (diaFin !== null && (!Number.isInteger(diaFin) || diaFin < 1 || diaFin > 31)) {
    res.status(400).json({ error: "El día de fin debe ser un número entre 1 y 31" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get current period data
    const periodRes = await client.query(
      `SELECT id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, "id_año"
       FROM periodo_academico
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const period = periodRes.rows[0];

    // Get school year info for calendar type
    const yearRes = await client.query(
      `SELECT tipo_calendario FROM "año_lectivo" WHERE "id_año" = $1 AND id_colegio = $2`,
      [period.id_año, schoolId]
    );
    const calendarType = yearRes.rows[0]?.tipo_calendario || 'A';

    // Validate ranges don't overlap with other periods
    const otherPeriodsRes = await client.query(
      `SELECT id_periodo, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin, estado
       FROM periodo_academico
       WHERE id_colegio = $1 AND "id_año" = $2 AND id_periodo != $3`,
      [schoolId, period.id_año, periodId]
    );

    const getNormalizedDateVal = (month: number, day: number, calType: string) => {
      if (calType === 'B') {
        const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
        return normalizeMonth(month) * 100 + day;
      }
      return month * 100 + day;
    };

    const newStartVal = getNormalizedDateVal(mesInicio, diaInicio, calendarType);
    const newEndVal = getNormalizedDateVal(mesFin, diaFin, calendarType);

    if (newStartVal > newEndVal) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "La fecha de inicio no puede ser posterior a la fecha de fin" });
      return;
    }

    for (const other of otherPeriodsRes.rows) {
      if (other.mes_inicio && other.dia_inicio && other.mes_fin && other.dia_fin) {
        const otherStartVal = getNormalizedDateVal(other.mes_inicio, other.dia_inicio, calendarType);
        const otherEndVal = getNormalizedDateVal(other.mes_fin, other.dia_fin, calendarType);

        const overlap = !(newEndVal < otherStartVal || otherEndVal < newStartVal);
        if (overlap) {
          await client.query("ROLLBACK");
          res.status(409).json({
            error: `El rango de fechas se superpone con el periodo '${other.nombre}' (${other.dia_inicio}/${other.mes_inicio} - ${other.dia_fin}/${other.mes_fin})`
          });
          return;
        }
      }
    }

    // If pending state: "Un periodo en estado pendiente no puede tener un rango de fechas anterior al periodo actual"
    if (period.estado === 'PENDIENTE') {
      const activePeriodRes = await client.query(
        `SELECT id_periodo, nombre, mes_inicio, mes_fin, dia_inicio, dia_fin
         FROM periodo_academico
         WHERE id_colegio = $1 AND "id_año" = $2 AND estado = 'ABIERTO' AND id_periodo != $3
         LIMIT 1`,
        [schoolId, period.id_año, periodId]
      );

      if (activePeriodRes.rows.length > 0) {
        const active = activePeriodRes.rows[0];
        if (active.mes_fin && active.dia_fin) {
          const activeEndVal = getNormalizedDateVal(active.mes_fin, active.dia_fin, calendarType);
          if (newStartVal < activeEndVal) {
            await client.query("ROLLBACK");
            res.status(400).json({
              error: `Un periodo en estado Pendiente no puede tener un rango de fechas anterior al periodo actual (${active.nombre})`
            });
            return;
          }
        }
      }
    }

    // Validate percentage sum <= 100
    const totalsRes = await client.query(
      `SELECT COALESCE(SUM(porcentaje), 0)::numeric AS total
       FROM periodo_academico
       WHERE id_colegio = $1 AND "id_año" = $2 AND id_periodo != $3`,
      [schoolId, period.id_año, periodId]
    );
    const otherTotal = Number(totalsRes.rows[0].total);
    if (otherTotal + porcentaje > 100) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: `No es posible actualizar el porcentaje porque la suma de porcentajes excede 100%. Actual del resto de periodos: ${otherTotal}%`
      });
      return;
    }

    // Audit check (if in supervision mode)
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      if (!motivo_cambio) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Se requiere justificar el cambio para registrar en la auditoría." });
        return;
      }
      const auditRes = await client.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    // Perform UPDATE
    const updated = await client.query(
      `UPDATE periodo_academico
       SET porcentaje = $1,
           mes_inicio = $2,
           dia_inicio = $3,
           mes_fin = $4,
           dia_fin = $5
       WHERE id_periodo = $6 AND id_colegio = $7
       RETURNING id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, "id_año"`,
      [porcentaje, mesInicio, diaInicio, mesFin, diaFin, periodId, schoolId]
    );

    // Record in audit
    if (activeAuditoriaId) {
      const valorAntiguo = {
        porcentaje: period.porcentaje,
        mes_inicio: period.mes_inicio,
        dia_inicio: period.dia_inicio,
        mes_fin: period.mes_fin,
        dia_fin: period.dia_fin
      };
      const valorNuevo = {
        porcentaje: porcentaje,
        mes_inicio: mesInicio,
        dia_inicio: diaInicio,
        mes_fin: mesFin,
        dia_fin: diaFin
      };
      
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Modificación de fechas y porcentaje de periodo académico', $2, $3, $4, $5)`,
        [activeAuditoriaId, `Periodo ID: ${periodId} (${period.nombre})`, JSON.stringify(valorAntiguo), JSON.stringify(valorNuevo), motivo_cambio]
      );
    }

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating academic period percentage:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const approveAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const { motivo_cambio } = req.body;

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get current period
    const periodRes = await client.query(
      `SELECT id_periodo, nombre, estado, "id_año", trimestre
       FROM periodo_academico
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const period = periodRes.rows[0];
    if (period.estado !== 'PENDIENTE') {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Solo se pueden activar periodos en estado Pendiente." });
      return;
    }

    // 2. Validate previous period is Closed
    const previousPeriodRes = await client.query(
      `SELECT id_periodo, nombre, estado
       FROM periodo_academico
       WHERE id_colegio = $1 AND "id_año" = $2 AND trimestre < $3
       ORDER BY trimestre DESC
       LIMIT 1`,
      [schoolId, period.id_año, period.trimestre]
    );

    if (previousPeriodRes.rows.length > 0) {
      const prev = previousPeriodRes.rows[0];
      if (prev.estado !== 'CERRADO') {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: `El periodo anterior (${prev.nombre}) debe estar Cerrado para activar este periodo.`
        });
        return;
      }
    }

    // 3. Audit check (if in supervision mode)
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      if (!motivo_cambio) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Se requiere justificar el cambio para registrar en la auditoría." });
        return;
      }
      const auditRes = await client.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    // 4. Deactivate any currently ABIERTO periods to CERRADO (only one can be open)
    await client.query(
      `UPDATE periodo_academico
       SET estado = 'CERRADO'
       WHERE id_colegio = $1 AND "id_año" = $2 AND estado = 'ABIERTO'`,
      [schoolId, period.id_año]
    );

    // 5. Activate this period
    await client.query(
      `UPDATE periodo_academico
       SET estado = 'ABIERTO'
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    // 6. Record in audit
    if (activeAuditoriaId) {
      const valorAntiguo = { estado: period.estado };
      const valorNuevo = { estado: 'ABIERTO' };
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Aprobación y activación de periodo académico', $2, $3, $4, $5)`,
        [activeAuditoriaId, `Periodo ID: ${periodId} (${period.nombre})`, JSON.stringify(valorAntiguo), JSON.stringify(valorNuevo), motivo_cambio]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Periodo académico aprobado y activado con éxito", id_periodo: periodId, estado: 'ABIERTO' });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error approving academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const createScale = async (req: Request, res: Response): Promise<void> => {
  res.status(409).json({
    error: "Las escalas de valoración se generan automáticamente desde la configuración predeterminada del colegio",
  });
};

export const updateScale = async (req: Request, res: Response): Promise<void> => {
  res.status(409).json({
    error: "Las escalas de valoración se actualizan automáticamente desde la configuración predeterminada del colegio",
  });
};

export const deleteScale = async (req: Request, res: Response): Promise<void> => {
  res.status(409).json({
    error: "Las escalas de valoración se administran automáticamente desde la configuración predeterminada del colegio",
  });
};

export const getTeacherManagementData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const [documentTypesRes, teachersRes, subjectsRes, groupsRes, assignmentsRes] = await Promise.all([
      pool.query(
        `SELECT id_tipodocumento, tipo
         FROM tipo_documento
         ORDER BY tipo`
      ),
      pool.query(
        `SELECT
           d.id_docente,
           d.nombre,
           d.apellido,
           d.documento,
           d.id_tipodocumento,
           td.tipo AS tipo_documento,
           d.estado,
           u.id_usuario,
           u.email,
           COALESCE(u.activo, true) AS activo,
           COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count
         FROM docente d
         JOIN tipo_documento td ON td.id_tipodocumento = d.id_tipodocumento
         LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
         LEFT JOIN detalle_grados dg ON dg.id_docente = d.id_docente
         WHERE d.id_colegio = $1
         GROUP BY d.id_docente, td.tipo, d.estado, u.id_usuario, u.email, u.activo
         ORDER BY d.nombre, d.apellido`,
        [schoolId]
      ),
      pool.query(
        `SELECT id_materia, nombre
         FROM materias
         WHERE id_colegio = $1
         ORDER BY nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           g.id_grupo,
           ne.nombre AS nivel_nombre,
           tg.nombre AS tipo_grado_nombre,
           s.nombre AS seccion_nombre,
           j.nombre AS jornada_nombre
         FROM grupos g
         JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
         JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
         JOIN secciones s ON s.id_seccion = g.id_seccion
         JOIN jornada j ON j.id_jornada = g.id_jornada
         WHERE g.id_colegio = $1
         ORDER BY ne.nombre, tg.nombre, j.nombre, s.nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           dg.id_detallegrado,
           dg.id_docente,
           dg.id_materia,
           dg.id_grupo,
           m.nombre AS materia_nombre,
           d.nombre AS docente_nombre,
           d.apellido AS docente_apellido,
           ne.nombre AS nivel_nombre,
           tg.nombre AS tipo_grado_nombre,
           s.nombre AS seccion_nombre,
           j.nombre AS jornada_nombre
         FROM detalle_grados dg
         JOIN docente d ON d.id_docente = dg.id_docente
         JOIN materias m ON m.id_materia = dg.id_materia
         JOIN grupos g ON g.id_grupo = dg.id_grupo
         JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
         JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
         JOIN secciones s ON s.id_seccion = g.id_seccion
         JOIN jornada j ON j.id_jornada = g.id_jornada
         WHERE dg.id_colegio = $1
           AND dg.id_grupo IS NOT NULL
         ORDER BY d.nombre, d.apellido, ne.nombre, tg.nombre, m.nombre`,
        [schoolId]
      ),
    ]);

    res.json({
      documentTypes: documentTypesRes.rows,
      teachers: teachersRes.rows,
      subjects: subjectsRes.rows,
      groups: groupsRes.rows,
      assignments: assignmentsRes.rows,
    });
  } catch (error: any) {
    console.error("Error fetching teacher management data:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createTeacher = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();
  const apellido = String(req.body.apellido || "").trim();
  const documento = String(req.body.documento || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const documentTypeId = Number(req.body.id_tipodocumento);
  let schoolName = "la institución";

  if (!schoolId || !nombre || !apellido || !documento || !email || !password || !documentTypeId) {
    res.status(400).json({ error: "Todos los campos del docente son obligatorios" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const documentTypeRes = await client.query(
      "SELECT id_tipodocumento, tipo FROM tipo_documento WHERE id_tipodocumento = $1",
      [documentTypeId]
    );
    const existingTeacherRes = await client.query(
      `SELECT id_docente
       FROM docente
       WHERE id_colegio = $1
         AND documento = $2`,
      [schoolId, documento]
    );
    const existingUserRes = await client.query(
      `SELECT id_usuario
       FROM usuario
       WHERE LOWER(email) = $1`,
      [email]
    );
    const roleRes = await client.query(
      `SELECT id_rol
       FROM rol
       WHERE LOWER(nombre) = 'docente'
       LIMIT 1`
    );
    const schoolRes = await client.query(
      `SELECT nombre
       FROM colegio
       WHERE id_colegio = $1`,
      [schoolId]
    );

    if (documentTypeRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Tipo de documento no encontrado" });
      return;
    }

    if (existingTeacherRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Ya existe un docente con ese documento en este colegio" });
      return;
    }

    if (existingUserRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Ya existe un usuario registrado con ese correo" });
      return;
    }

    if (roleRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "No existe el rol docente configurado en el sistema" });
      return;
    }

    schoolName = schoolRes.rows[0]?.nombre || schoolName;

    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO usuario (email, password, nombre, apellido, id_colegio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_usuario, email, activo`,
      [email, passwordHash, nombre, apellido, schoolId]
    );

    await client.query(
      `INSERT INTO usuario_rol (id_usuario, id_rol)
       VALUES ($1, $2)`,
      [userRes.rows[0].id_usuario, roleRes.rows[0].id_rol]
    );

    const teacherRes = await client.query(
      `INSERT INTO docente (nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
       RETURNING id_docente, nombre, apellido, documento, id_tipodocumento, estado`,
      [nombre, apellido, documento, documentTypeId, schoolId, userRes.rows[0].id_usuario]
    );

    await client.query("COMMIT");

    await NotificationService.sendTeacherWelcomeEmail(
      userRes.rows[0].email,
      `${nombre} ${apellido}`,
      schoolName,
      documentTypeRes.rows[0].tipo,
      documento,
      password
    );

    res.status(201).json({
      ...teacherRes.rows[0],
      tipo_documento: documentTypeRes.rows[0].tipo,
      email: userRes.rows[0].email,
      activo: userRes.rows[0].activo,
      estado: teacherRes.rows[0].estado,
      asignaciones_count: 0,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creating teacher:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const assignTeacherCourseSubject = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const teacherId = Number(req.body.id_docente);
  const subjectId = Number(req.body.id_materia);
  const groupId = Number(req.body.id_grupo);
  const replaceExisting = Boolean(req.body.replaceExisting);

  if (!schoolId || !teacherId || !subjectId || !groupId) {
    res.status(400).json({ error: "Docente, materia y curso son obligatorios" });
    return;
  }

  try {
    const validationRes = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM docente WHERE id_docente = $1 AND id_colegio = $4) AS teacher_ok,
         EXISTS(SELECT 1 FROM materias WHERE id_materia = $2 AND id_colegio = $4) AS subject_ok,
         EXISTS(SELECT 1 FROM grupos WHERE id_grupo = $3 AND id_colegio = $4) AS group_ok`,
      [teacherId, subjectId, groupId, schoolId]
    );

    const validation = validationRes.rows[0];
    if (!validation.teacher_ok || !validation.subject_ok || !validation.group_ok) {
      res.status(400).json({ error: "La asignación solicitada no es válida para este colegio" });
      return;
    }

    const contextRes = await pool.query(
      `SELECT
         c.nombre AS colegio_nombre,
         u.email,
         d.nombre,
         d.apellido,
         m.nombre AS materia_nombre,
         ne.nombre AS nivel_nombre,
         tg.nombre AS tipo_grado_nombre,
         s.nombre AS seccion_nombre,
         j.nombre AS jornada_nombre
       FROM docente d
       JOIN usuario u ON u.id_usuario = d.id_usuario
       JOIN colegio c ON c.id_colegio = d.id_colegio
       JOIN materias m ON m.id_materia = $2
       JOIN grupos g ON g.id_grupo = $3
       JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       JOIN secciones s ON s.id_seccion = g.id_seccion
       JOIN jornada j ON j.id_jornada = g.id_jornada
       WHERE d.id_docente = $1
         AND d.id_colegio = $4`,
      [teacherId, subjectId, groupId, schoolId]
    );

    const context = contextRes.rows[0];
    const courseName = `${context.tipo_grado_nombre} ${context.seccion_nombre} - ${context.jornada_nombre} - ${context.nivel_nombre}`;

    const existingRes = await pool.query(
      `SELECT
         dg.id_detallegrado,
         dg.id_docente,
         d.nombre,
         d.apellido
       FROM detalle_grados dg
       JOIN docente d ON d.id_docente = dg.id_docente
       WHERE dg.id_colegio = $1
         AND dg.id_materia = $2
         AND dg.id_grupo = $3`,
      [schoolId, subjectId, groupId]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (Number(existing.id_docente) === teacherId) {
        res.status(409).json({ error: "El docente ya tiene asignada esta materia en este curso" });
        return;
      }

      if (!replaceExisting) {
        res.status(409).json({
          error: "La combinación curso y materia ya está asignada a otro docente",
          currentTeacher: {
            id_docente: existing.id_docente,
            nombre: existing.nombre,
            apellido: existing.apellido,
          },
        });
        return;
      }

      const updated = await pool.query(
        `UPDATE detalle_grados
         SET id_docente = $1
         WHERE id_detallegrado = $2
         RETURNING id_detallegrado, id_docente, id_materia, id_grupo`,
        [teacherId, existing.id_detallegrado]
      );

      await NotificationService.sendTeacherAssignmentEmail(
        context.email,
        `${context.nombre} ${context.apellido}`,
        context.colegio_nombre,
        context.materia_nombre,
        courseName,
        "assigned"
      );

      res.json(updated.rows[0]);
      return;
    }

    const created = await pool.query(
      `INSERT INTO detalle_grados (id_materia, id_docente, id_colegio, id_grupo)
       VALUES ($1, $2, $3, $4)
       RETURNING id_detallegrado, id_docente, id_materia, id_grupo`,
      [subjectId, teacherId, schoolId, groupId]
    );

    await NotificationService.sendTeacherAssignmentEmail(
      context.email,
      `${context.nombre} ${context.apellido}`,
      context.colegio_nombre,
      context.materia_nombre,
      courseName,
      "assigned"
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error assigning teacher course subject:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const deleteTeacherAssignment = async (req: Request, res: Response): Promise<void> => {
  const assignmentId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!assignmentId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const assignmentRes = await pool.query(
      `SELECT
         dg.id_detallegrado,
         u.email,
         d.nombre,
         d.apellido,
         c.nombre AS colegio_nombre,
         m.nombre AS materia_nombre,
         ne.nombre AS nivel_nombre,
         tg.nombre AS tipo_grado_nombre,
         s.nombre AS seccion_nombre,
         j.nombre AS jornada_nombre
       FROM detalle_grados dg
       JOIN docente d ON d.id_docente = dg.id_docente
       JOIN usuario u ON u.id_usuario = d.id_usuario
       JOIN colegio c ON c.id_colegio = dg.id_colegio
       JOIN materias m ON m.id_materia = dg.id_materia
       JOIN grupos g ON g.id_grupo = dg.id_grupo
       JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       JOIN secciones s ON s.id_seccion = g.id_seccion
       JOIN jornada j ON j.id_jornada = g.id_jornada
       WHERE dg.id_detallegrado = $1
         AND dg.id_colegio = $2`,
      [assignmentId, schoolId]
    );

    if (assignmentRes.rows.length === 0) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    const deleted = await pool.query(
      `DELETE FROM detalle_grados
       WHERE id_detallegrado = $1
         AND id_colegio = $2
       RETURNING id_detallegrado`,
      [assignmentId, schoolId]
    );

    if (deleted.rows.length === 0) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    const assignment = assignmentRes.rows[0];
    await NotificationService.sendTeacherAssignmentEmail(
      assignment.email,
      `${assignment.nombre} ${assignment.apellido}`,
      assignment.colegio_nombre,
      assignment.materia_nombre,
      `${assignment.tipo_grado_nombre} ${assignment.seccion_nombre} - ${assignment.jornada_nombre} - ${assignment.nivel_nombre}`,
      "unassigned"
    );

    res.json({ message: "Asignación eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting teacher assignment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateTeacherStatus = async (req: Request, res: Response): Promise<void> => {
  const teacherId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const estado = String(req.body.estado || "").trim().toUpperCase();
  const reason = String(req.body.reason || "").trim();

  if (!teacherId || !schoolId || !["ACTIVO", "INACTIVO", "DESVINCULADO"].includes(estado)) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    await ensureTeacherStatusColumn();
    const teacherRes = await pool.query(
      `SELECT
         d.id_docente,
         d.nombre,
         d.apellido,
         d.estado,
         u.id_usuario,
         u.email,
         c.nombre AS colegio_nombre
       FROM docente d
       JOIN usuario u ON u.id_usuario = d.id_usuario
       JOIN colegio c ON c.id_colegio = d.id_colegio
       WHERE d.id_docente = $1
         AND d.id_colegio = $2`,
      [teacherId, schoolId]
    );

    if (teacherRes.rows.length === 0) {
      res.status(404).json({ error: "Docente no encontrado" });
      return;
    }

    const active = estado === "ACTIVO";

    await pool.query(
      `UPDATE usuario SET activo = $1 WHERE id_usuario = $2`,
      [active, teacherRes.rows[0].id_usuario]
    );

    await pool.query(
      `UPDATE docente
       SET estado = $1
       WHERE id_docente = $2`,
      [estado, teacherId]
    );

    if (estado === "DESVINCULADO") {
      await pool.query(
        `DELETE FROM detalle_grados
         WHERE id_docente = $1
           AND id_colegio = $2`,
        [teacherId, schoolId]
      );
    }

    await NotificationService.sendTeacherStatusEmail(
      teacherRes.rows[0].email,
      `${teacherRes.rows[0].nombre} ${teacherRes.rows[0].apellido}`,
      teacherRes.rows[0].colegio_nombre,
      estado,
      reason || undefined
    );

    res.json({
      message:
        estado === "ACTIVO"
          ? "Docente activado correctamente"
          : estado === "INACTIVO"
            ? "Docente inactivado correctamente"
            : "Docente desvinculado correctamente",
    });
  } catch (error: any) {
    console.error("Error updating teacher status:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createSubject = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();

  if (!schoolId || !nombre) {
    res.status(400).json({ error: "El nombre de la materia es obligatorio" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('SET search_path TO public, "$user"');
    const trashId = req.body.trashId ? Number(req.body.trashId) : null;

    await client.query("BEGIN");

    // 1. Verificar duplicado dentro de la transacción
    const duplicateRes = await client.query(
      `SELECT id_materia FROM materias WHERE id_colegio = $1 AND UPPER(TRIM(nombre)) = UPPER(TRIM($2))`,
      [schoolId, nombre]
    );

    if (duplicateRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Se encontró una materia con el mismo nombre" });
      return;
    }

    // 2. Crear materia
    const created = await client.query(
      `INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2) RETURNING *`,
      [nombre, schoolId]
    );

    const newSubjectId = created.rows[0].id_materia;

    if (trashId) {
      // RESTAURACIÓN PROFUNDA
      const trashRes = await client.query(
        "SELECT data_respaldo FROM papelera_materias WHERE id_papelera = $1 AND id_colegio = $2",
        [trashId, schoolId]
      );

      if (trashRes.rows.length > 0) {
        const backup = trashRes.rows[0].data_respaldo;

        // 1. Restaurar Asignaciones
        if (backup.assignments && Array.isArray(backup.assignments)) {
          for (const asig of backup.assignments) {
            await client.query(
              "INSERT INTO detalle_grados (id_materia, id_docente, id_grupo, id_colegio) VALUES ($1, $2, $3, $4)",
              [newSubjectId, asig.id_docente, asig.id_grupo, schoolId]
            );
          }
        }

        // 2. Restaurar Competencias
        if (backup.competencies && Array.isArray(backup.competencies)) {
          for (const comp of backup.competencies) {
            await client.query(
              'INSERT INTO competencias (descripcion, id_materia, id_periodo, "id_año", id_grupo, id_colegio) VALUES ($1, $2, $3, $4, $5, $6)',
              [comp.descripcion, newSubjectId, comp.id_periodo, comp.id_año, comp.id_grupo, schoolId]
            );
          }
        }

        // 3. Limpiar papelera
        await client.query("DELETE FROM papelera_materias WHERE id_papelera = $1", [trashId]);
      }
    }

    await client.query("COMMIT");
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    if (client) await client.query("ROLLBACK");
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    if (client) client.release();
  }
};

export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
  const subjectId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);
  const force = req.query.force === "true";

  if (!subjectId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();

  try {
    // Asegurar visibilidad del esquema public
    await client.query('SET search_path TO public, "$user"');

    // 1. Obtener información básica de la materia
    const subjectRes = await client.query(
      "SELECT nombre FROM materias WHERE id_materia = $1 AND id_colegio = $2",
      [subjectId, schoolId]
    );

    if (subjectRes.rows.length === 0) {
      res.status(404).json({ error: "Materia no encontrada" });
      return;
    }

    const subjectName = subjectRes.rows[0].nombre;

    // 2. Analizar impacto (Recolección de datos con subconsultas independientes para evitar duplicados)
    const impactRes = await client.query(
      `SELECT
         (SELECT COUNT(DISTINCT id_detallegrado)::int FROM detalle_grados WHERE id_materia = $1) as asignaciones_count,
         (SELECT COUNT(DISTINCT id_competencia)::int FROM competencias WHERE id_materia = $1) as competencias_count,
         (SELECT COUNT(DISTINCT aa.id_actividadmateria)::int FROM actividad_materia aa 
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1) as actividades_count,
         (SELECT COUNT(DISTINCT na.id_notaactividad)::int FROM notas_actividad na
          JOIN actividad_materia aa ON aa.id_actividadmateria = na.id_actividadmateria
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1) as notas_count
      `,
      [subjectId]
    );

    const impact = impactRes.rows[0];
    const hasRelations = (impact.asignaciones_count > 0) || (impact.competencias_count > 0);

    if (hasRelations && !force) {
      res.status(409).json({
        error: "No se puede eliminar la materia porque tiene relaciones académicas activas",
        impact
      });
      return;
    }

    if (force) {
      await client.query("BEGIN");

      // OBTENER DATOS PARA RESPALDO DETALLADO ANTES DE BORRAR (Granularidad mejorada con Grado y Sección)
      const assignmentsBackupRes = await client.query(`
        SELECT DISTINCT dg.id_docente, dg.id_grupo, n.nombre as nivel_nombre,
               tg.nombre as grado_nombre, s.nombre as seccion_nombre,
               d.nombre || ' ' || d.apellido as docente_nombre
        FROM detalle_grados dg
        JOIN grupos gr ON gr.id_grupo = dg.id_grupo
        JOIN nivel_escolar n ON n.id_nivel = gr.id_nivel
        JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
        JOIN secciones s ON s.id_seccion = gr.id_seccion
        JOIN docente d ON d.id_docente = dg.id_docente
        WHERE dg.id_materia = $1
      `, [subjectId]);

      const competenciesBackupRes = await client.query(`
        SELECT DISTINCT descripcion, id_periodo, id_año, id_grupo
        FROM competencias
        WHERE id_materia = $1
      `, [subjectId]);

      const detailedBackup = {
        impact,
        assignments: assignmentsBackupRes.rows,
        competencies: competenciesBackupRes.rows
      };

      // 1. Notas
      await client.query(`
        DELETE FROM nota_criterio 
        WHERE id_criterio IN (
          SELECT c.id_criterio FROM criterio_evaluacion c
          JOIN actividad_materia aa ON aa.id_actividadmateria = c.id_actividadmateria
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM notas_actividad 
        WHERE id_actividadmateria IN (
          SELECT aa.id_actividadmateria FROM actividad_materia aa
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1
        )
      `, [subjectId]);

      // 2. Criterios y Actividades
      await client.query(`
        DELETE FROM criterio_evaluacion 
        WHERE id_actividadmateria IN (
          SELECT aa.id_actividadmateria FROM actividad_materia aa
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM actividad_materia 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      // 3. Competencias y Evidencias
      await client.query(`
        DELETE FROM evidencia_aprendizaje 
        WHERE id_competencia IN (
          SELECT id_competencia FROM competencias WHERE id_materia = $1
        )
      `, [subjectId]);

      await client.query("DELETE FROM competencias WHERE id_materia = $1", [subjectId]);

      // 4. Observación y Resultados Académicos
      await client.query(`
        DELETE FROM observacion_estudiante 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM resultado_academico 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      // 5. Cierres de materia y Asistencia
      await client.query(`
        DELETE FROM registro_asistencia 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM cierre_materia 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      // 6. Asignaciones (detalle_grados)
      await client.query("DELETE FROM detalle_grados WHERE id_materia = $1", [subjectId]);

      // 7. La materia en sí
      await client.query("DELETE FROM materias WHERE id_materia = $1", [subjectId]);

      // 8. Crear respaldo en papelera con DATA DETALLADA
      await client.query(
        "INSERT INTO papelera_materias (id_colegio, nombre_materia, data_respaldo) VALUES ($1, $2, $3)",
        [schoolId, subjectName, JSON.stringify(detailedBackup)]
      );

      await client.query("COMMIT");

      res.json({
        message: "Materia y todas sus relaciones eliminadas correctamente",
        report: {
          subjectName,
          timestamp: new Date().toISOString(),
          details: impact
        }
      });
    } else {
      await client.query("DELETE FROM materias WHERE id_materia = $1", [subjectId]);
      res.json({ message: "Materia eliminada correctamente" });
    }
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error deleting subject:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

// ─── Evidencias de Aprendizaje ────────────────────────────────────────────────

export const createEvidencia = async (req: Request, res: Response): Promise<void> => {
  const competenciaId = Number(req.params.competenciaId);
  const descripcion = String(req.body.descripcion || "").trim();
  const schoolId = parseSchoolId(req.body.schoolId);

  if (!competenciaId || !descripcion || !schoolId) {
    res.status(400).json({ error: "Competencia, descripción y colegio son obligatorios" });
    return;
  }

  try {
    // Verificar que la competencia pertenece a este colegio
    const check = await pool.query(
      `SELECT id_competencia FROM competencias WHERE id_competencia = $1 AND id_colegio = $2`,
      [competenciaId, schoolId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    // Calcular el siguiente orden
    const ordenRes = await pool.query(
      `SELECT COALESCE(MAX(orden), -1) + 1 AS next_orden FROM evidencia_aprendizaje WHERE id_competencia = $1`,
      [competenciaId]
    );
    const orden = Number(ordenRes.rows[0].next_orden);

    const result = await pool.query(
      `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [competenciaId, descripcion, orden, schoolId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating evidencia:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateEvidencia = async (req: Request, res: Response): Promise<void> => {
  const evidenciaId = Number(req.params.evidenciaId);
  const descripcion = String(req.body.descripcion || "").trim();
  const schoolId = parseSchoolId(req.body.schoolId);

  if (!evidenciaId || !descripcion || !schoolId) {
    res.status(400).json({ error: "ID, descripción y colegio son obligatorios" });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE evidencia_aprendizaje
       SET descripcion = $1
       WHERE id_evidencia = $2 AND id_colegio = $3
       RETURNING *`,
      [descripcion, evidenciaId, schoolId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating evidencia:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const deleteEvidencia = async (req: Request, res: Response): Promise<void> => {
  const evidenciaId = Number(req.params.evidenciaId);
  const schoolId = parseSchoolId(req.query.schoolId as string);

  if (!evidenciaId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const result = await pool.query(
      `DELETE FROM evidencia_aprendizaje
       WHERE id_evidencia = $1 AND id_colegio = $2
       RETURNING id_evidencia`,
      [evidenciaId, schoolId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }
    res.json({ message: "Evidencia eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting evidencia:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getPeriodClosureDetails = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  const schoolId = parseSchoolId(req.params.schoolId);

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    const periodRes = await client.query(
      `SELECT nombre, estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const query = `
      SELECT
        d.id_docente,
        u.nombre AS docente_nombre,
        u.email AS docente_email,
        dg.id_detallegrado,
        m.nombre AS materia_nombre,
        tg.nombre AS grado_nombre,
        s.nombre AS seccion_nombre,
        j.nombre AS jornada_nombre,
        COALESCE(cm.estado::VARCHAR, 'PENDIENTE') AS estado_cierre
      FROM docente d
      JOIN usuario u ON u.id_usuario = d.id_usuario
      JOIN detalle_grados dg ON dg.id_docente = d.id_docente
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN grupos g ON g.id_grupo = dg.id_grupo
      JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
      JOIN secciones s ON s.id_seccion = g.id_seccion
      JOIN jornada j ON j.id_jornada = g.id_jornada
      LEFT JOIN cierre_materia cm ON cm.id_detallegrado = dg.id_detallegrado AND cm.id_periodo = $1
      WHERE dg.id_colegio = $2
      ORDER BY u.nombre, m.nombre, tg.nombre
    `;
    const detailsRes = await client.query(query, [periodId, schoolId]);

    const teachersMap = new Map();
    detailsRes.rows.forEach(row => {
      if (!teachersMap.has(row.id_docente)) {
        teachersMap.set(row.id_docente, {
          id_docente: row.id_docente,
          docente_nombre: row.docente_nombre,
          docente_email: row.docente_email,
          asignaciones: [],
          total_asignaciones: 0,
          cerradas: 0,
        });
      }
      const teacher = teachersMap.get(row.id_docente);
      teacher.asignaciones.push({
        id_detallegrado: row.id_detallegrado,
        materia_nombre: row.materia_nombre,
        grado: `${row.grado_nombre} ${row.seccion_nombre} · ${row.jornada_nombre}`,
        estado: row.estado_cierre
      });
      teacher.total_asignaciones++;
      if (row.estado_cierre === 'CERRADO') {
        teacher.cerradas++;
      }
    });

    const teachers = Array.from(teachersMap.values());

    res.json({
      periodo: periodRes.rows[0],
      teachers
    });
  } catch (error: any) {
    console.error("Error fetching closure details:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

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

    // 1. Get active period within the target year if not provided
    let targetPeriodId = periodId ? Number(periodId) : null;
    if (!targetPeriodId) {
      const activePeriodRes = await pool.query(
        `SELECT id_periodo FROM periodo_academico WHERE id_colegio = $1 AND "id_año" = $2 AND estado = 'ABIERTO' ORDER BY id_periodo DESC LIMIT 1`,
        [schoolId, targetYearId]
      );
      if (activePeriodRes.rows.length > 0) {
        targetPeriodId = activePeriodRes.rows[0].id_periodo;
      } else {
        // Fallback to the most recent period in this year even if not open
        const lastPeriodRes = await pool.query(
          `SELECT id_periodo FROM periodo_academico WHERE id_colegio = $1 AND "id_año" = $2 ORDER BY id_periodo DESC LIMIT 1`,
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
      pool.query(`SELECT COUNT(*) as total FROM matricula WHERE id_colegio = $1 AND "id_año" = $2 AND estado = 'ACTIVA'`, [schoolId, targetYearId]),
      pool.query("SELECT COUNT(*) as total FROM docente WHERE id_colegio = $1 AND estado = 'ACTIVO'", [schoolId]),
      pool.query(
        `SELECT COUNT(*) as total FROM observacion_estudiante 
         WHERE id_colegio = $1 AND tipo = 'DISCIPLINARIO' ${targetPeriodId ? "AND id_periodo = $2" : ""}`,
        targetPeriodId ? [schoolId, targetPeriodId] : [schoolId]
      ),
      pool.query(
        `SELECT COUNT(*) as total FROM matricula WHERE id_colegio = $1 AND "id_año" = $2 AND estado = 'CANCELADA'`,
        [schoolId, targetYearId]
      ),
      pool.query(
        `SELECT tg.nombre as grade, COUNT(m.id_matricula)::int as total
         FROM matricula m
         JOIN grupos g ON m.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE m.id_colegio = $1 AND m."id_año" = $2 AND m.estado = 'ACTIVA'
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
         JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m."id_año" = $2
         JOIN grupos g ON m.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE o.id_colegio = $1 AND m.estado = 'ACTIVA' ${targetPeriodId ? "AND o.id_periodo = $3" : ""}
         GROUP BY tg.nombre`,
        targetPeriodId ? [schoolId, targetYearId, targetPeriodId] : [schoolId, targetYearId]
      ),
      pool.query(
        `SELECT tg.nombre as grade, COUNT(m.id_matricula)::int as total
         FROM matricula m
         JOIN grupos g ON m.id_grupo = g.id_grupo
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE m.id_colegio = $1 AND m."id_año" = $2 AND m.estado = 'CANCELADA'
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
       JOIN matricula m ON ra.id_estudiante = m.id_estudiante AND m."id_año" = $3
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
    
    // Shared CTE template that calculates live projected grades when official results are not yet available
    // NOTE: This produces a query prefix of the form:
    //   WITH current_results AS ( ... )
    // It is designed to be prefixed before a SELECT statement.
    const buildLiveCTE = (extraCTEs = '') => `
      WITH current_results AS (
        SELECT ra.id_estudiante, ra.id_detallegrado, ra.id_periodo, ra.promedio
        FROM resultado_academico ra
        JOIN detalle_grados dg_ra ON ra.id_detallegrado = dg_ra.id_detallegrado
        WHERE dg_ra.id_colegio = $1 AND ra.id_periodo = $2

        UNION ALL

        SELECT na.id_estudiante, am.id_detallegrado, am.id_periodo,
               ROUND(SUM(na.nota * am.porcentaje / 100.0)::numeric, 2) as promedio
        FROM notas_actividad na
        JOIN actividad_materia am ON na.id_actividadmateria = am.id_actividadmateria
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

    // 5. Charts Data
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
           ORDER BY tg.nombre, s.nombre`,
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
           ORDER BY tg.nombre, s.nombre, average DESC`,
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
       WHERE dg.id_colegio = $1 AND p."id_año" = $2
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
       WHERE dg.id_colegio = $1 AND p."id_año" = $2
       GROUP BY p.id_periodo, p.nombre, g.id_grupo, tg.nombre, s.nombre, j.nombre
       ORDER BY p.id_periodo, tg.nombre, s.nombre`,
      [schoolId, targetYearId]
    );
    charts.evolutionByCourse = evolutionByCourseRes.rows;

    // 6. Low Performance Analysis Block
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
             COUNT(*) FILTER (WHERE cr.promedio < 3.0)::int as materias_reprobadas,
             ROUND(AVG(cr.promedio), 2)::numeric as promedio_general,
             JSON_AGG(
               JSON_BUILD_OBJECT('materia_nombre', m.nombre, 'promedio', cr.promedio)
             ) FILTER (WHERE cr.promedio < 3.0) as detalles_materias
           FROM current_results cr
           JOIN detalle_grados dg ON cr.id_detallegrado = dg.id_detallegrado
           JOIN materias m ON dg.id_materia = m.id_materia
           JOIN estudiante e ON cr.id_estudiante = e.id_estudiante
           WHERE dg.id_colegio = $1
           GROUP BY cr.id_estudiante, e.nombre, e.apellido, dg.id_grupo
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
        materias_reprobadas: Number(r.materias_reprobadas),
        promedio_general: Number(r.promedio_general),
        detalles_materias: Array.isArray(r.detalles_materias) ? r.detalles_materias : []
      }));
    }

    res.json({
      summary: {
        totalStudents: Number(studentsCountRes.rows[0].total),
        totalTeachers: Number(teachersCountRes.rows[0].total),
        attendanceToday: Number(Number(attendanceTodayRes.rows[0].rate || 0).toFixed(1)),
        generalAverage: performanceMetrics.average,
        studentsAtRisk: performanceMetrics.atRisk,
        disciplinaryReports: Number(disciplinaryRes.rows[0].total),
        desertionRate: Number(desertionRes.rows[0].total),
      },
      summaryByGrade,
      charts,
      lowPerformance,
    });
  } catch (error: any) {
    console.error("Error fetching directivo dashboard:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getSubjectTrash = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);

  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const result = await pool.query(
      "SELECT id_papelera, nombre_materia, data_respaldo, fecha_borrado FROM papelera_materias WHERE id_colegio = $1 ORDER BY fecha_borrado DESC",
      [schoolId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching subject trash:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

import * as path from 'path';
import * as fs from 'fs';
import { AuthRequest } from '../middleware/authMiddleware';

export const getMySchoolData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
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
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se ha subido ningún archivo' });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.svg'];
    if (!allowedExts.includes(ext)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Formato no soportado. Solo se permiten JPG, JPEG, PNG y SVG.' });
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error: any) {
    console.error('Error al subir escudo:', error);
    res.status(500).json({ error: 'Error al subir el escudo del colegio' });
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
      `SELECT id_configuracion, id_colegio, id_año, fecha_inicio, fecha_cierre, habilitada 
       FROM configuracion_inscripcion 
       WHERE id_colegio = $1 AND id_año = $2`,
      [schoolId, yearId]
    );

    const approvedRes = await pool.query(
      `SELECT COUNT(*)::int AS count 
       FROM matricula 
       WHERE id_colegio = $1 AND "id_año" = $2 AND estado IN ('ACTIVA', 'TRASLADADA')`,
      [schoolId, yearId]
    );
    const hasApproved = approvedRes.rows[0].count > 0;

    if (result.rows.length > 0) {
      res.json({
        ...result.rows[0],
        hasApproved
      });
    } else {
      res.json({
        id_configuracion: null,
        id_colegio: schoolId,
        id_año: yearId,
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
  const { id_colegio, id_año, fecha_inicio, fecha_cierre, habilitada, motivo_cambio } = req.body;
  
  if (!id_colegio || !id_año || !fecha_inicio || !fecha_cierre) {
    res.status(400).json({ error: "Todos los campos (colegio, año, fecha de inicio y cierre) son obligatorios." });
    return;
  }

  const start = new Date(fecha_inicio);
  const end = new Date(fecha_cierre);

  if (end <= start) {
    res.status(400).json({ error: "La fecha de cierre debe ser posterior a la fecha de inicio." });
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
        [id_colegio, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    // Check if approved matriculas exist for this school and year
    const approvedRes = await pool.query(
      `SELECT COUNT(*)::int AS count 
       FROM matricula 
       WHERE id_colegio = $1 AND "id_año" = $2 AND estado IN ('ACTIVA', 'TRASLADADA')`,
      [id_colegio, id_año]
    );
    const hasApproved = approvedRes.rows[0].count > 0;

    // Fetch existing configuration
    const existingRes = await pool.query(
      `SELECT fecha_inicio, fecha_cierre, habilitada 
       FROM configuracion_inscripcion 
       WHERE id_colegio = $1 AND id_año = $2`,
      [id_colegio, id_año]
    );
    const oldConfig = existingRes.rows[0] || null;

    if (hasApproved && oldConfig) {
      // Validate that dates are not being changed
      const oldStart = new Date(oldConfig.fecha_inicio).getTime();
      const oldEnd = new Date(oldConfig.fecha_cierre).getTime();
      const newStart = start.getTime();
      const newEnd = end.getTime();
      
      if (oldStart !== newStart || oldEnd !== newEnd) {
        res.status(400).json({ error: "No se pueden modificar las fechas de inscripción porque ya existen matrículas aprobadas para este año académico." });
        return;
      }
    }

    // Save/Update config
    const result = await pool.query(
      `INSERT INTO configuracion_inscripcion (id_colegio, id_año, fecha_inicio, fecha_cierre, habilitada)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id_colegio, id_año)
       DO UPDATE SET 
         fecha_inicio = EXCLUDED.fecha_inicio, 
         fecha_cierre = EXCLUDED.fecha_cierre, 
         habilitada = EXCLUDED.habilitada
       RETURNING *`,
      [id_colegio, id_año, fecha_inicio, fecha_cierre, habilitada !== undefined ? Boolean(habilitada) : true]
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
          `Colegio ID: ${id_colegio}, Año ID: ${id_año}`, 
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

export const createExtraordinaryEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const {
    correo_padre,
    id_nivel,
    id_grupo,
    id_año,
    id_estudiante,
    motivo,
    motivo_extraordinaria,
    observaciones,
    observaciones_extraordinaria,
    tiene_discapacidad,
    es_extranjero,
    motivo_cambio
  } = req.body;

  const actualMotivo = motivo || motivo_extraordinaria;
  const actualObservaciones = observaciones || observaciones_extraordinaria;

  if (!correo_padre || !id_nivel || !id_grupo || !id_año || !actualMotivo) {
    res.status(400).json({ error: "Los campos correo_padre, id_nivel, id_grupo, id_año y motivo son obligatorios." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If existing student is provided, check their status
    if (id_estudiante) {
      const studentRes = await client.query(
        "SELECT estado FROM estudiante WHERE id_estudiante = $1 AND id_colegio = $2",
        [id_estudiante, schoolId]
      );
      if (studentRes.rows.length === 0) {
        res.status(400).json({ error: "El estudiante especificado no pertenece a esta institución." });
        return;
      }
      const studentStatus = studentRes.rows[0].estado;
      if (studentStatus === 'EXPULSADO' || studentStatus === 'GRADUADO') {
        res.status(400).json({ error: `El estudiante se encuentra en estado ${studentStatus} y no puede ser matriculado` });
        return;
      }

      // Check if student already has an active or transferred enrollment for this year
      const activeEnrollmentRes = await client.query(
        `SELECT id_matricula FROM matricula 
         WHERE id_estudiante = $1 AND id_colegio = $2 AND "id_año" = $3 AND estado IN ('ACTIVA', 'TRASLADADA')`,
        [id_estudiante, schoolId, id_año]
      );
      if (activeEnrollmentRes.rows.length > 0) {
        res.status(400).json({ error: "El estudiante ya cuenta con una matrícula ACTIVA o TRASLADADA para este año lectivo." });
        return;
      }
    }

    // Insert matricula
    const matRes = await client.query(
      `INSERT INTO matricula 
         (id_estudiante, id_nivel, id_grupo, id_colegio, "id_año", estado, correo_padre, tiene_discapacidad, es_extranjero, tipo, motivo, observaciones, id_usuario_responsable, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', $6, $7, $8, 'EXTRAORDINARIA', $9, $10, $11, NOW())
       RETURNING *`,
      [
        id_estudiante || null,
        id_nivel,
        id_grupo,
        schoolId,
        id_año,
        correo_padre,
        tiene_discapacidad === true || tiene_discapacidad === 'true',
        es_extranjero === true || es_extranjero === 'true',
        actualMotivo,
        actualObservaciones || null,
        authReq.user!.id
      ]
    );

    const newMat = matRes.rows[0];
    const idMatricula = newMat.id_matricula;

    // Retrieve level name to determine required documents
    const levelRes = await client.query('SELECT nombre FROM nivel_escolar WHERE id_nivel = $1', [id_nivel]);
    if (levelRes.rows.length === 0) throw new Error("Nivel escolar no válido");
    const levelName = levelRes.rows[0].nombre;

    const ALWAYS_REQUIRED = ['documentoPadre', 'salud', 'foto', 'reciboPublico'];
    const REQUIRED_FOR_LOWER_LEVELS = ['registroCivil', 'vacunas'];
    const REQUIRED_NOT_INFANT = ['documentoIdentidad', 'certificadosEscolaridad'];

    const isHigher = levelName === 'SECUNDARIA' || levelName === 'MEDIA';
    const isPre    = levelName === 'PREESCOLAR';

    const requiredDocs: string[] = [...ALWAYS_REQUIRED];
    if (!isHigher) requiredDocs.push(...REQUIRED_FOR_LOWER_LEVELS);
    if (!isPre)    requiredDocs.push(...REQUIRED_NOT_INFANT);
    if (es_extranjero === true || es_extranjero === 'true') requiredDocs.push('visa');
    if (tiene_discapacidad === true || tiene_discapacidad === 'true') requiredDocs.push('certificadoDiscapacidad');

    for (const doc of requiredDocs) {
      await client.query(
        `INSERT INTO documento_matriculas (id_matricula, tipo_documento, url, estado, fecha, id_colegio)
         VALUES ($1, $2, 'PENDIENTE', 'PENDIENTE', NOW(), $3)`,
        [idMatricula, doc, schoolId]
      );
    }

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'CREACION', 'Creación de Matrícula Extraordinaria', $2, NULL, $3, $4)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${idMatricula}`,
            JSON.stringify(newMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Matrícula extraordinaria creada exitosamente", matricula: newMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in createExtraordinaryEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const approveExtraordinaryEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'EXTRAORDINARIA' || mat.estado !== 'PENDIENTE') {
      res.status(400).json({ error: "Solo se pueden aprobar excepciones de matrículas extraordinarias en estado PENDIENTE." });
      return;
    }

    // Update state to APROBADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'APROBADA' WHERE id_matricula = $1 RETURNING *",
      [id]
    );
    const updatedMat = updatedRes.rows[0];

    // Notification: send email to parent with tracking token
    await NotificationService.sendExtraordinaryApprovalEmail(
      mat.correo_padre,
      'Acudiente',
      mat.token_seguimiento
    );

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Aprobación de Excepción de Matrícula Extraordinaria', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Excepción aprobada exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in approveExtraordinaryEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const rejectExtraordinaryEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'EXTRAORDINARIA' || mat.estado !== 'PENDIENTE') {
      res.status(400).json({ error: "Solo se pueden rechazar excepciones de matrículas extraordinarias en estado PENDIENTE." });
      return;
    }

    // Update state to RECHAZADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'RECHAZADA' WHERE id_matricula = $1 RETURNING *",
      [id]
    );
    const updatedMat = updatedRes.rows[0];

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Rechazo de Excepción de Matrícula Extraordinaria', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Excepción rechazada exitosamente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in rejectExtraordinaryEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const createReingresoEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const {
    id_estudiante,
    id_nivel,
    id_grupo,
    id_año,
    motivo,
    observaciones,
    tiene_discapacidad,
    es_extranjero,
    motivo_cambio
  } = req.body;

  if (!id_estudiante || !id_nivel || !id_grupo || !id_año || !motivo) {
    res.status(400).json({ error: "Los campos id_estudiante, id_nivel, id_grupo, id_año y motivo son obligatorios." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check student status
    const studentRes = await client.query(
      "SELECT estado FROM estudiante WHERE id_estudiante = $1 AND id_colegio = $2",
      [id_estudiante, schoolId]
    );

    if (studentRes.rows.length === 0) {
      res.status(400).json({ error: "El estudiante especificado no pertenece a esta institución." });
      return;
    }

    const studentStatus = studentRes.rows[0].estado;
    if (studentStatus === 'EXPULSADO' || studentStatus === 'GRADUADO' || studentStatus === 'SANCIONADO') {
      res.status(400).json({ error: `El estudiante se encuentra en estado ${studentStatus} y no es elegible para reingreso.` });
      return;
    }

    if (studentStatus !== 'RETIRADO') {
      res.status(400).json({ error: `Solo estudiantes con estado 'RETIRADO' pueden solicitar reingreso.` });
      return;
    }

    // Check if there is already an active or pending enrollment for this student in the current year
    const existingEnrollmentRes = await client.query(
      `SELECT id_matricula, estado FROM matricula 
       WHERE id_estudiante = $1 AND id_colegio = $2 AND "id_año" = $3 AND estado IN ('ACTIVA', 'TRASLADADA', 'PENDIENTE', 'CORRECCION')`,
      [id_estudiante, schoolId, id_año]
    );
    if (existingEnrollmentRes.rows.length > 0) {
      res.status(400).json({ error: "El estudiante ya cuenta con una matrícula activa, trasladada o pendiente para este año lectivo." });
      return;
    }

    // Fetch the parent's email
    const parentRes = await client.query(
      `SELECT u.email FROM detalle_padrefamilia dp
       JOIN padre_familia pf ON dp.id_padrefamilia = pf.id_padrefamilia
       JOIN usuario u ON pf.id_usuario = u.id_usuario
       WHERE dp.id_estudiante = $1 AND dp.id_colegio = $2
       LIMIT 1`,
      [id_estudiante, schoolId]
    );

    if (parentRes.rows.length === 0) {
      res.status(400).json({ error: "No se encontró un acudiente asociado al estudiante para notificar." });
      return;
    }

    const correo_padre = parentRes.rows[0].email;

    // Insert matricula
    const matRes = await client.query(
      `INSERT INTO matricula 
         (id_estudiante, id_nivel, id_grupo, id_colegio, "id_año", estado, correo_padre, tiene_discapacidad, es_extranjero, tipo, motivo, observaciones, id_usuario_responsable, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', $6, $7, $8, 'REINGRESO', $9, $10, $11, NOW())
       RETURNING *`,
      [
        id_estudiante,
        id_nivel,
        id_grupo,
        schoolId,
        id_año,
        correo_padre,
        tiene_discapacidad === true || tiene_discapacidad === 'true',
        es_extranjero === true || es_extranjero === 'true',
        motivo,
        observaciones || null,
        authReq.user!.id
      ]
    );

    const newMat = matRes.rows[0];
    const idMatricula = newMat.id_matricula;

    // Retrieve level name to determine required documents
    const levelRes = await client.query('SELECT nombre FROM nivel_escolar WHERE id_nivel = $1', [id_nivel]);
    if (levelRes.rows.length === 0) throw new Error("Nivel escolar no válido");
    const levelName = levelRes.rows[0].nombre;

    const ALWAYS_REQUIRED = ['documentoPadre', 'salud', 'foto', 'reciboPublico'];
    const REQUIRED_FOR_LOWER_LEVELS = ['registroCivil', 'vacunas'];
    const REQUIRED_NOT_INFANT = ['documentoIdentidad', 'certificadosEscolaridad'];

    const isHigher = levelName === 'SECUNDARIA' || levelName === 'MEDIA';
    const isPre    = levelName === 'PREESCOLAR';

    const requiredDocs: string[] = [...ALWAYS_REQUIRED];
    if (!isHigher) requiredDocs.push(...REQUIRED_FOR_LOWER_LEVELS);
    if (!isPre)    requiredDocs.push(...REQUIRED_NOT_INFANT);
    if (es_extranjero === true || es_extranjero === 'true') requiredDocs.push('visa');
    if (tiene_discapacidad === true || tiene_discapacidad === 'true') requiredDocs.push('certificadoDiscapacidad');

    for (const doc of requiredDocs) {
      await client.query(
        `INSERT INTO documento_matriculas (id_matricula, tipo_documento, url, estado, fecha, id_colegio)
         VALUES ($1, $2, 'PENDIENTE', 'PENDIENTE', NOW(), $3)`,
        [idMatricula, doc, schoolId]
      );
    }

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'CREACION', 'Creación de Solicitud de Reingreso', $2, NULL, $3, $4)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${idMatricula}`,
            JSON.stringify(newMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Solicitud de reingreso creada exitosamente", matricula: newMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in createReingresoEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const approveReingresoEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'REINGRESO' || mat.estado !== 'PENDIENTE') {
      res.status(400).json({ error: "Solo se pueden aprobar solicitudes de reingreso en estado PENDIENTE." });
      return;
    }

    // Update state to APROBADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'APROBADA' WHERE id_matricula = $1 RETURNING *",
      [id]
    );
    const updatedMat = updatedRes.rows[0];

    // Notification: send email to parent with tracking token for reingreso
    await NotificationService.sendReingresoApprovalEmail(
      mat.correo_padre,
      'Acudiente',
      mat.token_seguimiento
    );

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Aprobación de Solicitud de Reingreso', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Solicitud de reingreso aprobada exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in approveReingresoEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const rejectReingresoEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'REINGRESO' || mat.estado !== 'PENDIENTE') {
      res.status(400).json({ error: "Solo se pueden rechazar solicitudes de reingreso en estado PENDIENTE." });
      return;
    }

    // Update state to RECHAZADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'RECHAZADA' WHERE id_matricula = $1 RETURNING *",
      [id]
    );
    const updatedMat = updatedRes.rows[0];

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Rechazo de Solicitud de Reingreso', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Solicitud de reingreso rechazada exitosamente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in rejectReingresoEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};


