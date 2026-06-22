import { PoolClient } from "pg";
import { pool } from "./db";

const evidenciaMigrationSql = `
CREATE TABLE IF NOT EXISTS public.evidencia_aprendizaje (
  id_evidencia    SERIAL PRIMARY KEY,
  id_competencia  INTEGER NOT NULL REFERENCES public.competencias(id_competencia) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  orden           INTEGER NOT NULL DEFAULT 0,
  id_colegio      INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'evidencia_aprendizaje'
      AND indexname  = 'idx_evidencia_competencia'
  ) THEN
    CREATE INDEX idx_evidencia_competencia
      ON public.evidencia_aprendizaje(id_competencia);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.criterio_evaluacion (
  id_criterio          SERIAL PRIMARY KEY,
  id_actividadmateria  INTEGER NOT NULL REFERENCES public.actividad_materia(id_actividadmateria) ON DELETE CASCADE,
  id_evidencia         INTEGER REFERENCES public.evidencia_aprendizaje(id_evidencia) ON DELETE SET NULL,
  descripcion          TEXT NOT NULL,
  porcentaje           NUMERIC(5,2) NOT NULL,
  id_colegio           INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.nota_criterio (
  id_nota_criterio  SERIAL PRIMARY KEY,
  id_criterio       INTEGER NOT NULL REFERENCES public.criterio_evaluacion(id_criterio) ON DELETE CASCADE,
  id_estudiante     INTEGER NOT NULL REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE,
  nota              NUMERIC(5,2) NOT NULL,
  id_colegio        INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE,
  UNIQUE(id_criterio, id_estudiante)
);
`;

const DEFAULT_COMPETENCY_DESCRIPTION = "Competencia pendiente por definir.";

const migrationSql = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'competencias'
  ) THEN
    CREATE TABLE public.competencias (
      id_competencia SERIAL PRIMARY KEY,
      id_año integer NOT NULL REFERENCES public."año_lectivo"("id_año") ON DELETE CASCADE,
      id_grupo integer NOT NULL REFERENCES public.grupos(id_grupo) ON DELETE CASCADE,
      id_materia integer NOT NULL REFERENCES public.materias(id_materia) ON DELETE CASCADE,
      id_periodo integer NOT NULL REFERENCES public.periodo_academico(id_periodo) ON DELETE CASCADE,
      descripcion text NOT NULL DEFAULT '${DEFAULT_COMPETENCY_DESCRIPTION}',
      id_colegio integer NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE
    );
  END IF;
END $$;

ALTER TABLE public.competencias
  ADD COLUMN IF NOT EXISTS descripcion text NOT NULL DEFAULT '${DEFAULT_COMPETENCY_DESCRIPTION}';

ALTER TABLE public.competencias
  ADD COLUMN IF NOT EXISTS id_colegio integer;

UPDATE public.competencias c
SET id_colegio = p.id_colegio
FROM public.periodo_academico p
WHERE c.id_periodo = p.id_periodo
  AND c.id_colegio IS NULL;

ALTER TABLE public.competencias
  ALTER COLUMN id_colegio SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'competencias_unique_context'
  ) THEN
    ALTER TABLE public.competencias
      ADD CONSTRAINT competencias_unique_context
      UNIQUE (id_año, id_grupo, id_materia, id_periodo, id_colegio);
  END IF;
END $$;

ALTER TABLE public.actividad_materia
  ADD COLUMN IF NOT EXISTS id_competencia integer;

ALTER TABLE public.actividad_materia
  ALTER COLUMN id_detallegrado DROP NOT NULL;

ALTER TABLE public.actividad_materia
  ALTER COLUMN id_periodo DROP NOT NULL;

ALTER TABLE public.actividad_materia
  ADD COLUMN IF NOT EXISTS id_evidencia integer REFERENCES public.evidencia_aprendizaje(id_evidencia) ON DELETE SET NULL;

WITH aggregated_competencies AS (
  SELECT
    p."id_año" AS id_año,
    dg.id_grupo AS id_grupo,
    dg.id_materia AS id_materia,
    a.id_periodo AS id_periodo,
    a.id_colegio AS id_colegio,
    COALESCE(
      NULLIF(string_agg(DISTINCT btrim(d.descripcion), E'\\n' ORDER BY btrim(d.descripcion)), ''),
      '${DEFAULT_COMPETENCY_DESCRIPTION}'
    ) AS descripcion
  FROM public.actividad_materia a
  JOIN public.detalle_grados dg ON dg.id_detallegrado = a.id_detallegrado
  JOIN public.periodo_academico p ON p.id_periodo = a.id_periodo
  LEFT JOIN public.desempeno d ON d.id_actividadmateria = a.id_actividadmateria
  GROUP BY p."id_año", dg.id_grupo, dg.id_materia, a.id_periodo, a.id_colegio
)
INSERT INTO public.competencias (id_año, id_grupo, id_materia, id_periodo, descripcion, id_colegio)
SELECT id_año, id_grupo, id_materia, id_periodo, descripcion, id_colegio
FROM aggregated_competencies
ON CONFLICT (id_año, id_grupo, id_materia, id_periodo, id_colegio)
DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.competencias (id_año, id_grupo, id_materia, id_periodo, descripcion, id_colegio)
SELECT
  p."id_año",
  dg.id_grupo,
  dg.id_materia,
  p.id_periodo,
  '${DEFAULT_COMPETENCY_DESCRIPTION}',
  dg.id_colegio
FROM public.detalle_grados dg
JOIN public.periodo_academico p ON p.id_colegio = dg.id_colegio
ON CONFLICT (id_año, id_grupo, id_materia, id_periodo, id_colegio) DO NOTHING;

WITH activity_targets AS (
  SELECT
    a.id_actividadmateria,
    c.id_competencia
  FROM public.actividad_materia a
  JOIN public.detalle_grados dg ON dg.id_detallegrado = a.id_detallegrado
  JOIN public.periodo_academico p ON p.id_periodo = a.id_periodo
  JOIN public.competencias c
    ON c.id_año = p."id_año"
   AND c.id_grupo = dg.id_grupo
   AND c.id_materia = dg.id_materia
   AND c.id_periodo = a.id_periodo
   AND c.id_colegio = a.id_colegio
)
UPDATE public.actividad_materia a
SET id_competencia = t.id_competencia
FROM activity_targets t
WHERE a.id_actividadmateria = t.id_actividadmateria
  AND a.id_competencia IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'actividad_materia'
      AND column_name = 'id_competencia'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'actividad_materia_id_competencia_fkey'
  ) THEN
    ALTER TABLE public.actividad_materia
      ADD CONSTRAINT actividad_materia_id_competencia_fkey
      FOREIGN KEY (id_competencia)
      REFERENCES public.competencias(id_competencia)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'actividad_materia'
      AND column_name = 'id_competencia'
  ) AND EXISTS (
    SELECT 1
    FROM public.actividad_materia
    WHERE id_competencia IS NOT NULL
  ) THEN
    ALTER TABLE public.actividad_materia
      ALTER COLUMN id_competencia SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_actividad_estudiante'
  ) THEN
    DELETE FROM public.notas_actividad n1
    USING public.notas_actividad n2
    WHERE n1.id_notaactividad < n2.id_notaactividad
      AND n1.id_actividadmateria = n2.id_actividadmateria
      AND n1.id_estudiante = n2.id_estudiante;

    ALTER TABLE public.notas_actividad
      ADD CONSTRAINT unique_actividad_estudiante UNIQUE (id_actividadmateria, id_estudiante);
  END IF;
END $$;

`;

const enrollmentConfigMigrationSql = `
CREATE TABLE IF NOT EXISTS public.configuracion_inscripcion (
  id_configuracion  SERIAL PRIMARY KEY,
  id_colegio        INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE,
  id_año            INTEGER NOT NULL REFERENCES public."año_lectivo"("id_año") ON DELETE CASCADE,
  fecha_inicio      TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_cierre      TIMESTAMP WITH TIME ZONE NOT NULL,
  habilitada        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_fechas CHECK (fecha_cierre > fecha_inicio),
  CONSTRAINT uq_colegio_anio UNIQUE (id_colegio, id_año)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'configuracion_inscripcion'
      AND indexname  = 'idx_config_inscripcion_colegio'
  ) THEN
    CREATE INDEX idx_config_inscripcion_colegio
      ON public.configuracion_inscripcion(id_colegio);
  END IF;
END $$;
`;

export const ensureCompetencySchema = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(migrationSql);
    await client.query(evidenciaMigrationSql);
    await client.query(enrollmentConfigMigrationSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export interface TeachingContext {
  idDetalleGrado: number;
  idGrupo: number;
  idMateria: number;
  idColegio: number;
  idAnio: number;
}

export interface CompetencyRow {
  id_competencia: number;
  id_año: number;
  id_grupo: number;
  id_materia: number;
  id_periodo: number;
  descripcion: string;
  id_colegio: number;
}

export const DEFAULT_COMPETENCY_TEXT = DEFAULT_COMPETENCY_DESCRIPTION;

const getGradePeerGroups = async (
  client: PoolClient,
  schoolId: number,
  groupId: number
): Promise<number[]> => {
  const groupRes = await client.query<{ id_nivel: number; id_tipo_grado: number }>(
    `SELECT id_nivel, id_tipo_grado
     FROM grupos
     WHERE id_grupo = $1
       AND id_colegio = $2`,
    [groupId, schoolId]
  );

  if (groupRes.rows.length === 0) {
    return [];
  }

  const { id_nivel, id_tipo_grado } = groupRes.rows[0];
  const peersRes = await client.query<{ id_grupo: number }>(
    `SELECT id_grupo
     FROM grupos
     WHERE id_colegio = $1
       AND id_nivel = $2
       AND id_tipo_grado = $3
     ORDER BY id_grupo`,
    [schoolId, id_nivel, id_tipo_grado]
  );

  return peersRes.rows.map((row) => Number(row.id_grupo));
};

const normalizeCompetencyDescription = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export const ensureDefaultEvidencias = async (
  client: PoolClient,
  competencyId: number,
  schoolId: number
): Promise<void> => {
  const checkRes = await client.query(
    "SELECT 1 FROM evidencia_aprendizaje WHERE id_competencia = $1 LIMIT 1",
    [competencyId]
  );
  if (checkRes.rows.length === 0) {
    await client.query(
      `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
       VALUES 
         ($1, 'Reconoce y aplica los conceptos fundamentales de la unidad temática.', 1, $2),
         ($1, 'Demuestra capacidad analítica y pensamiento crítico en la resolución de problemas.', 2, $2),
         ($1, 'Participa activamente y colabora con sus compañeros en el entorno de aprendizaje.', 3, $2)`,
      [competencyId, schoolId]
    );
  }
};

export const syncCompetencyAcrossGrade = async (
  client: PoolClient,
  context: TeachingContext,
  periodId: number,
  descripcion?: string
): Promise<CompetencyRow> => {
  const peerGroups = await getGradePeerGroups(client, context.idColegio, context.idGrupo);
  if (peerGroups.length === 0) {
    throw new Error("No se encontraron cursos para sincronizar la competencia del grado");
  }

  const chosenDescription =
    descripcion && normalizeCompetencyDescription(descripcion)
      ? normalizeCompetencyDescription(descripcion)
      : null;

  const existingRes = await client.query<CompetencyRow>(
    `SELECT *
     FROM competencias
     WHERE id_colegio = $1
       AND id_año = $2
       AND id_materia = $3
       AND id_periodo = $4
       AND id_grupo = ANY($5::int[])
     ORDER BY
       CASE
         WHEN UPPER(TRIM(TRAILING '.' FROM descripcion)) <> UPPER(TRIM(TRAILING '.' FROM $6)) THEN 0
         ELSE 1
       END,
       id_competencia ASC`,
    [context.idColegio, context.idAnio, context.idMateria, periodId, peerGroups, DEFAULT_COMPETENCY_TEXT]
  );

  const sharedDescription =
    chosenDescription ??
    existingRes.rows.find(
      (row) =>
        normalizeCompetencyDescription(row.descripcion).replace(/\.+$/, "").toUpperCase() !==
        normalizeCompetencyDescription(DEFAULT_COMPETENCY_TEXT).replace(/\.+$/, "").toUpperCase()
    )?.descripcion ??
    DEFAULT_COMPETENCY_DESCRIPTION;

  const syncedRows: CompetencyRow[] = [];
  for (const peerGroupId of peerGroups) {
    const syncedRes = await client.query<CompetencyRow>(
      `INSERT INTO competencias (id_año, id_grupo, id_materia, id_periodo, descripcion, id_colegio)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id_año, id_grupo, id_materia, id_periodo, id_colegio)
       DO UPDATE SET descripcion = EXCLUDED.descripcion
       RETURNING *`,
      [context.idAnio, peerGroupId, context.idMateria, periodId, sharedDescription, context.idColegio]
    );
    const compRow = syncedRes.rows[0];
    syncedRows.push(compRow);
    
    // Ensure default evidences for each synced competency
    await ensureDefaultEvidencias(client, compRow.id_competencia, compRow.id_colegio);
  }

  const currentGroupRow = syncedRows.find((row) => Number(row.id_grupo) === context.idGrupo);
  if (!currentGroupRow) {
    throw new Error("No se pudo resolver la competencia sincronizada para el curso actual");
  }

  return currentGroupRow;
};

export const harmonizeCompetenciesForSchoolYear = async (
  client: PoolClient,
  schoolId: number,
  yearId: number
): Promise<void> => {
  const contextsRes = await client.query<{
    id_grupo: number;
    id_materia: number;
    id_periodo: number;
  }>(
    `SELECT
       MIN(c.id_grupo)::int AS id_grupo,
       c.id_materia,
       c.id_periodo
     FROM competencias c
     JOIN grupos g ON g.id_grupo = c.id_grupo
     WHERE c.id_colegio = $1
       AND c.id_año = $2
     GROUP BY g.id_nivel, g.id_tipo_grado, c.id_materia, c.id_periodo
     ORDER BY MIN(c.id_grupo), c.id_materia, c.id_periodo`,
    [schoolId, yearId]
  );

  for (const row of contextsRes.rows) {
    await syncCompetencyAcrossGrade(
      client,
      {
        idDetalleGrado: 0,
        idGrupo: Number(row.id_grupo),
        idMateria: Number(row.id_materia),
        idColegio: schoolId,
        idAnio: yearId,
      },
      Number(row.id_periodo)
    );
  }
};

export const ensureCompetencyForContext = async (
  client: PoolClient,
  context: TeachingContext,
  periodId: number
): Promise<CompetencyRow> => {
  return syncCompetencyAcrossGrade(client, context, periodId);
};
