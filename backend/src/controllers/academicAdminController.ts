import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../config/db";
import bcrypt from "bcrypt";
import { NotificationService } from "../services/notificationService";
import { getDefaultMonthsLabelForPeriodOrder } from "../config/academicCalendarDefaults";
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

const ensureTeacherStatusColumn = async () => {
  await pool.query(`
    ALTER TABLE docente
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
  `);

  await pool.query(`
    UPDATE docente d
    SET estado = CASE
      WHEN u.activo = FALSE THEN 'INACTIVO'
      ELSE 'ACTIVO'
    END
    FROM usuario u
    WHERE d.id_usuario = u.id_usuario
      AND (d.estado IS NULL OR d.estado NOT IN ('ACTIVO', 'INACTIVO', 'DESVINCULADO'))
  `);
};

const ensureAcademicYearForSchool = async (schoolId: number): Promise<number> => {
  const existing = await pool.query(
    `SELECT "id_año"
     FROM "año_lectivo"
     WHERE id_colegio = $1
     ORDER BY "id_año" DESC
     LIMIT 1`,
    [schoolId]
  );

  if (existing.rows.length > 0) {
    return Number(existing.rows[0]["id_año"]);
  }

  const currentYear = new Date().getFullYear();
  const created = await pool.query(
    `INSERT INTO "año_lectivo" ("id_año", calendario, id_colegio)
     VALUES ($1, 'A', $2)
     RETURNING "id_año"`,
    [currentYear, schoolId]
  );

  return Number(created.rows[0]["id_año"]);
};

const ensureSchoolSettingsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion_colegio (
      id_colegio integer PRIMARY KEY REFERENCES colegio(id_colegio) ON DELETE CASCADE,
      nota_minima numeric(5,2) NOT NULL DEFAULT 0,
      nota_maxima numeric(5,2) NOT NULL DEFAULT 5,
      nota_aprobacion numeric(5,2) NOT NULL DEFAULT 3,
      escala_modo varchar(20) NOT NULL DEFAULT 'AUTOMATICO'
    )
  `);

  await pool.query(`
    ALTER TABLE configuracion_colegio
    ADD COLUMN IF NOT EXISTS escala_modo varchar(20) NOT NULL DEFAULT 'AUTOMATICO'
  `);
};

const ensureAcademicPeriodTrimesterColumn = async () => {
  await pool.query(`
    ALTER TABLE periodo_academico
    ADD COLUMN IF NOT EXISTS trimestre integer
  `);
};

const ensureAcademicPeriodDayColumns = async () => {
  await pool.query(`
    ALTER TABLE periodo_academico
    ADD COLUMN IF NOT EXISTS dia_inicio integer
  `);
  await pool.query(`
    ALTER TABLE periodo_academico
    ADD COLUMN IF NOT EXISTS dia_fin integer
  `);
};

const ensureSchoolDefaultSettings = async (schoolId: number) => {
  await ensureSchoolSettingsTable();

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
    `SELECT id_escalavaloracion
     FROM escala_valoracion
     WHERE id_colegio = $1`,
    [schoolId]
  );

  const previousScaleIds = previousScalesRes.rows.map((row) => Number(row.id_escalavaloracion));
  const nextScalesDraft =
    scaleMode === "MANUAL"
      ? buildManualScales(nextMin, nextMax, nextApproval, manualBreaks?.basicMax, manualBreaks?.altoMax)
      : buildAutomaticScales(nextMin, nextMax, nextApproval);
  const createdScalesRes = await client.query(
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

  const nextScales = createdScalesRes.rows;
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

  if (previousScaleIds.length > 0) {
    await client.query(
      `DELETE FROM escala_valoracion
       WHERE id_colegio = $1
         AND id_escalavaloracion = ANY($2::int[])`,
      [schoolId, previousScaleIds]
    );
  }

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

export const getAcademicSettingsData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    await ensureCompetencySchema();
    await ensureAcademicPeriodTrimesterColumn();
    await ensureAcademicPeriodDayColumns();
    const currentYearId = await ensureAcademicYearForSchool(schoolId);
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
        `SELECT "id_año", calendario
         FROM "año_lectivo"
         WHERE "id_año" = $1
           AND id_colegio = $2`,
        [currentYearId, schoolId]
      ),
      pool.query(
        `SELECT "id_año", calendario
         FROM "año_lectivo"
         WHERE id_colegio = $1
         ORDER BY "id_año" DESC`,
        [schoolId]
      ),
      ensureSchoolDefaultSettings(schoolId),
      pool.query(
        `SELECT id_periodo, nombre, estado, porcentaje, trimestre, dia_inicio, dia_fin, "id_año"
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
  const trimestre = Number(req.body.trimestre);
  const diaInicio = req.body.dia_inicio !== undefined && req.body.dia_inicio !== "" && req.body.dia_inicio !== null
    ? Number(req.body.dia_inicio)
    : null;
  const diaFin = req.body.dia_fin !== undefined && req.body.dia_fin !== "" && req.body.dia_fin !== null
    ? Number(req.body.dia_fin)
    : null;

  if (
    !schoolId ||
    !nombre ||
    Number.isNaN(porcentaje) ||
    porcentaje <= 0 ||
    !Number.isInteger(trimestre) ||
    trimestre < 1 ||
    trimestre > 3
  ) {
    res.status(400).json({ error: "Nombre, porcentaje y trimestre válido del periodo son obligatorios" });
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

  if (diaInicio !== null && diaFin !== null && diaFin < diaInicio) {
    res.status(400).json({ error: "El día de fin no puede ser menor al día de inicio" });
    return;
  }

  try {
    await ensureAcademicPeriodTrimesterColumn();
    await ensureAcademicPeriodDayColumns();
    const currentYearId = await ensureAcademicYearForSchool(schoolId);

    const totalsRes = await pool.query(
      `SELECT COALESCE(SUM(porcentaje), 0)::numeric AS total
       FROM periodo_academico
       WHERE id_colegio = $1`,
      [schoolId]
    );

    const currentTotal = Number(totalsRes.rows[0].total);
    if (currentTotal + porcentaje > 100) {
      res.status(409).json({
        error: `No es posible crear el periodo porque la suma de porcentajes excede 100%. Actual: ${currentTotal}%`,
      });
      return;
    }

    const duplicateRes = await pool.query(
      `SELECT id_periodo
       FROM periodo_academico
       WHERE id_colegio = $1
         AND UPPER(TRIM(nombre)) = UPPER(TRIM($2))`,
      [schoolId, nombre]
    );

    if (duplicateRes.rows.length > 0) {
      res.status(409).json({ error: "Ya existe un periodo académico con ese nombre" });
      return;
    }

    const created = await pool.query(
      `INSERT INTO periodo_academico (nombre, estado, porcentaje, trimestre, dia_inicio, dia_fin, "id_año", id_colegio)
       VALUES ($1, 'ABIERTO', $2, $3, $4, $5, $6, $7)
       RETURNING id_periodo, nombre, estado, porcentaje, trimestre, dia_inicio, dia_fin, "id_año"`,
      [nombre, porcentaje, trimestre, diaInicio, diaFin, currentYearId, schoolId]
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error creating academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
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

  try {
    const duplicateRes = await pool.query(
      `SELECT "id_año"
       FROM "año_lectivo"
       WHERE "id_año" = $1
         AND id_colegio = $2`,
      [yearId, schoolId]
    );

    if (duplicateRes.rows.length > 0) {
      res.status(409).json({ error: "Ese año lectivo ya está configurado para el colegio" });
      return;
    }

    const created = await pool.query(
      `INSERT INTO "año_lectivo" ("id_año", calendario, id_colegio)
       VALUES ($1, $2, $3)
       RETURNING "id_año", calendario`,
      [yearId, calendario || "A", schoolId]
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error creating academic year:", error);
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
    await ensureCompetencySchema();
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

export const updateAcademicPeriodPercentage = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const porcentaje = Number(req.body.porcentaje);
  const trimestre = Number(req.body.trimestre);
  const diaInicio = req.body.dia_inicio !== undefined && req.body.dia_inicio !== "" && req.body.dia_inicio !== null
    ? Number(req.body.dia_inicio)
    : null;
  const diaFin = req.body.dia_fin !== undefined && req.body.dia_fin !== "" && req.body.dia_fin !== null
    ? Number(req.body.dia_fin)
    : null;

  if (
    !periodId ||
    !schoolId ||
    Number.isNaN(porcentaje) ||
    porcentaje <= 0 ||
    !Number.isInteger(trimestre) ||
    trimestre < 1 ||
    trimestre > 3
  ) {
    res.status(400).json({ error: "Parámetros inválidos" });
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

  if (diaInicio !== null && diaFin !== null && diaFin < diaInicio) {
    res.status(400).json({ error: "El día de fin no puede ser menor al día de inicio" });
    return;
  }

  try {
    await ensureAcademicPeriodTrimesterColumn();
    await ensureAcademicPeriodDayColumns();
    const periodRes = await pool.query(
      `SELECT id_periodo, porcentaje, trimestre
       FROM periodo_academico
       WHERE id_periodo = $1
         AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const totalsRes = await pool.query(
      `SELECT COALESCE(SUM(porcentaje), 0)::numeric AS total
       FROM periodo_academico
       WHERE id_colegio = $1
         AND id_periodo <> $2`,
      [schoolId, periodId]
    );

    const otherTotal = Number(totalsRes.rows[0].total);
    if (otherTotal + porcentaje > 100) {
      res.status(409).json({
        error: `No es posible actualizar el porcentaje de este periodo. La suma total excede 100%. Otros periodos: ${otherTotal}%`,
      });
      return;
    }

    const updated = await pool.query(
      `UPDATE periodo_academico
       SET porcentaje = $1,
           trimestre = $2,
           dia_inicio = $3,
           dia_fin = $4
       WHERE id_periodo = $5
         AND id_colegio = $6
       RETURNING id_periodo, nombre, estado, porcentaje, trimestre, dia_inicio, dia_fin, "id_año"`,
      [porcentaje, trimestre, diaInicio, diaFin, periodId, schoolId]
    );

    res.json(updated.rows[0]);
  } catch (error: any) {
    console.error("Error updating academic period percentage:", error);
    res.status(500).json({ error: "Error en el servidor" });
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
    await ensureTeacherStatusColumn();
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
           u.email,
           COALESCE(u.activo, true) AS activo,
           COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count
         FROM docente d
         JOIN tipo_documento td ON td.id_tipodocumento = d.id_tipodocumento
         LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
         LEFT JOIN detalle_grados dg ON dg.id_docente = d.id_docente
         WHERE d.id_colegio = $1
         GROUP BY d.id_docente, td.tipo, d.estado, u.email, u.activo
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
    await client.query(`
      ALTER TABLE docente
      ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
    `);

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

  try {
    const duplicateRes = await pool.query(
      `SELECT id_materia
       FROM materias
       WHERE id_colegio = $1
         AND UPPER(TRIM(nombre)) = UPPER(TRIM($2))`,
      [schoolId, nombre]
    );

    if (duplicateRes.rows.length > 0) {
      res.status(409).json({ error: "Se encontró una materia con el mismo nombre" });
      return;
    }

    const created = await pool.query(
      `INSERT INTO materias (nombre, id_colegio)
       VALUES ($1, $2)
       RETURNING *`,
      [nombre, schoolId]
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
  const subjectId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!subjectId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const impactRes = await pool.query(
      `SELECT
         m.id_materia,
         COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count,
         COUNT(DISTINCT c.id_competencia)::int AS competencias_count
       FROM materias m
       LEFT JOIN detalle_grados dg ON dg.id_materia = m.id_materia
       LEFT JOIN competencias c ON c.id_materia = m.id_materia
       WHERE m.id_materia = $1
         AND m.id_colegio = $2
       GROUP BY m.id_materia`,
      [subjectId, schoolId]
    );

    if (impactRes.rows.length === 0) {
      res.status(404).json({ error: "Materia no encontrada" });
      return;
    }

    const impact = impactRes.rows[0];
    if (impact.asignaciones_count > 0 || impact.competencias_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar la materia porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    await pool.query("DELETE FROM materias WHERE id_materia = $1", [subjectId]);
    res.json({ message: "Materia eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting subject:", error);
    res.status(500).json({ error: "Error en el servidor" });
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
