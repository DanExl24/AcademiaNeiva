import { PoolClient } from "pg";
import { pool } from "./db";

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
`;

export const ensureCompetencySchema = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(migrationSql);
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

export const ensureCompetencyForContext = async (
  client: PoolClient,
  context: TeachingContext,
  periodId: number
): Promise<CompetencyRow> => {
  const result = await client.query<CompetencyRow>(
    `INSERT INTO competencias (id_año, id_grupo, id_materia, id_periodo, descripcion, id_colegio)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id_año, id_grupo, id_materia, id_periodo, id_colegio)
     DO UPDATE SET descripcion = competencias.descripcion
     RETURNING *`,
    [
      context.idAnio,
      context.idGrupo,
      context.idMateria,
      periodId,
      DEFAULT_COMPETENCY_DESCRIPTION,
      context.idColegio,
    ]
  );

  return result.rows[0];
};
