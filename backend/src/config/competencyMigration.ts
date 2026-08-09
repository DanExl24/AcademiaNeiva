import { PoolClient } from "pg";
import { pool } from "./db";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";


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
      id_anio integer NOT NULL REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE,
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

ALTER TABLE public.competencias DROP CONSTRAINT IF EXISTS competencias_unique_context;
ALTER TABLE public.competencias ADD COLUMN IF NOT EXISTS sync_uuid UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'competencias'
      AND indexname  = 'idx_competencias_sync_uuid'
  ) THEN
    CREATE INDEX idx_competencias_sync_uuid
      ON public.competencias(sync_uuid);
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

ALTER TABLE public.actividad_materia
  ADD COLUMN IF NOT EXISTS fecha_creacion timestamp with time zone DEFAULT now();

WITH aggregated_competencies AS (
  SELECT
    p.id_anio AS id_anio,
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
  WHERE p.estado = 'CERRADO'
  GROUP BY p.id_anio, dg.id_grupo, dg.id_materia, a.id_periodo, a.id_colegio
)
INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio)
SELECT id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio
FROM aggregated_competencies ac
WHERE NOT EXISTS (
  SELECT 1 FROM public.competencias c
  WHERE c.id_anio = ac.id_anio
    AND c.id_grupo = ac.id_grupo
    AND c.id_materia = ac.id_materia
    AND c.id_periodo = ac.id_periodo
    AND c.id_colegio = ac.id_colegio
);

INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio)
SELECT
  p.id_anio,
  dg.id_grupo,
  dg.id_materia,
  p.id_periodo,
  '${DEFAULT_COMPETENCY_DESCRIPTION}',
  dg.id_colegio
FROM public.detalle_grados dg
JOIN public.periodo_academico p ON p.id_colegio = dg.id_colegio
WHERE p.estado = 'CERRADO'
  AND NOT EXISTS (
    SELECT 1 FROM public.competencias c
    WHERE c.id_anio = p.id_anio
      AND c.id_grupo = dg.id_grupo
      AND c.id_materia = dg.id_materia
      AND c.id_periodo = p.id_periodo
      AND c.id_colegio = dg.id_colegio
  );

WITH activity_targets AS (
  SELECT
    a.id_actividadmateria,
    c.id_competencia
  FROM public.actividad_materia a
  JOIN public.detalle_grados dg ON dg.id_detallegrado = a.id_detallegrado
  JOIN public.periodo_academico p ON p.id_periodo = a.id_periodo
  JOIN public.competencias c
    ON c.id_anio = p.id_anio
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

-- NOT NULL constraint on id_competencia removed for Phase 3 evaluation independence

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
  id_anio            INTEGER NOT NULL REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE,
  fecha_inicio      TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_cierre      TIMESTAMP WITH TIME ZONE NOT NULL,
  habilitada        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_fechas CHECK (fecha_cierre > fecha_inicio),
  CONSTRAINT uq_colegio_anio UNIQUE (id_colegio, id_anio)
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

const extraordinaryMigrationSql = `
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matricula' AND column_name = 'motivo_extraordinaria') THEN
      ALTER TABLE public.matricula RENAME COLUMN motivo_extraordinaria TO motivo;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matricula' AND column_name = 'observaciones_extraordinaria') THEN
      ALTER TABLE public.matricula RENAME COLUMN observaciones_extraordinaria TO observaciones;
    END IF;
  END $$;

  ALTER TABLE public.matricula ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'REGULAR';
  ALTER TABLE public.matricula ADD COLUMN IF NOT EXISTS motivo TEXT;
  ALTER TABLE public.matricula ADD COLUMN IF NOT EXISTS observaciones TEXT;
  ALTER TABLE public.matricula ADD COLUMN IF NOT EXISTS id_usuario_responsable INTEGER REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;
  ALTER TABLE public.matricula ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT NOW();
`;

export const ensureCompetencySchema = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    // 1. Check/create enum values (must be outside transaction)
    const checkEnum = await client.query(`
      SELECT 1 FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'estado_matricula' AND e.enumlabel = 'APROBADA'
    `);
    if (checkEnum.rows.length === 0) {
      console.log("Adding 'APROBADA' to estado_matricula enum...");
      await client.query("ALTER TYPE estado_matricula ADD VALUE 'APROBADA'");
    }

    const checkCorregidaEnum = await client.query(`
      SELECT 1 FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'estado_matricula' AND e.enumlabel = 'CORREGIDA'
    `);
    if (checkCorregidaEnum.rows.length === 0) {
      console.log("Adding 'CORREGIDA' to estado_matricula enum...");
      await client.query("ALTER TYPE estado_matricula ADD VALUE 'CORREGIDA'");
    }

    // Cleanup redundant table if it was created
    await client.query(`DROP TABLE IF EXISTS public.historial_documento_matricula CASCADE;`);

    const checkPeriodEnum = await client.query(`
      SELECT 1 FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'estado_periodo' AND e.enumlabel = 'PENDIENTE'
    `);
    if (checkPeriodEnum.rows.length === 0) {
      console.log("Adding 'PENDIENTE' to estado_periodo enum...");
      await client.query("ALTER TYPE estado_periodo ADD VALUE 'PENDIENTE'");
    }

    // 2. Perform table definitions and modifications within a transaction
    await client.query("BEGIN");
    
    await client.query(migrationSql);
    await client.query(evidenciaMigrationSql);
    await client.query(enrollmentConfigMigrationSql);
    await client.query(extraordinaryMigrationSql);

    // Dynamic database modifications moved from controllers to server startup
    await client.query(`
      ALTER TABLE anio_lectivo
      ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'ABIERTO'
    `);

    await client.query(`
      ALTER TABLE docente
      ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
    `);

    await client.query(`
      UPDATE docente d
      SET estado = CASE
        WHEN u.activo = FALSE THEN 'INACTIVO'
        ELSE 'ACTIVO'
      END
      FROM usuario u
      WHERE d.id_usuario = u.id_usuario
        AND (d.estado IS NULL OR d.estado NOT IN ('ACTIVO', 'INACTIVO', 'DESVINCULADO'))
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion_colegio (
        id_colegio integer PRIMARY KEY REFERENCES colegio(id_colegio) ON DELETE CASCADE,
        nota_minima numeric(5,2) NOT NULL DEFAULT 0,
        nota_maxima numeric(5,2) NOT NULL DEFAULT 5,
        nota_aprobacion numeric(5,2) NOT NULL DEFAULT 3,
        escala_modo varchar(20) NOT NULL DEFAULT 'AUTOMATICO'
      )
    `);

    await client.query(`
      ALTER TABLE configuracion_colegio
      ADD COLUMN IF NOT EXISTS escala_modo varchar(20) NOT NULL DEFAULT 'AUTOMATICO'
    `);

    await client.query(`
      ALTER TABLE periodo_academico
      ADD COLUMN IF NOT EXISTS trimestre integer,
      ADD COLUMN IF NOT EXISTS dia_inicio integer,
      ADD COLUMN IF NOT EXISTS dia_fin integer,
      ADD COLUMN IF NOT EXISTS mes_inicio integer,
      ADD COLUMN IF NOT EXISTS mes_fin integer
    `);

    // Ejecutar migración del catálogo global de DBA
    const dbaMigrationPath = path.join(__dirname, "../migrations/007_dba_catalogo_global.sql");
    if (fs.existsSync(dbaMigrationPath)) {
      const dbaMigrationSql = fs.readFileSync(dbaMigrationPath, "utf8");
      await client.query(dbaMigrationSql);
    }

    // Ejecutar migración de planeación y ejecución institucional de DBA
    const instMigrationPath = path.join(__dirname, "../migrations/008_dba_planeacion_institucional.sql");
    if (fs.existsSync(instMigrationPath)) {
      const instMigrationSql = fs.readFileSync(instMigrationPath, "utf8");
      await client.query(instMigrationSql);
    }

    // Ejecutar migración de reingreso y versionamiento de documentos (019)
    const reingresoMigrationPath = path.join(__dirname, "../migrations/019_reingreso_and_document_versioning.sql");
    if (fs.existsSync(reingresoMigrationPath)) {
      const reingresoMigrationSql = fs.readFileSync(reingresoMigrationPath, "utf8");
      await client.query(reingresoMigrationSql);
    }

    // Ejecutar migración de normalización de tipo y estado de matrícula (020 - Idempotente)
    const normalizeMatriculaPath = path.join(__dirname, "../migrations/020_normalize_matricula_estado_and_tipo.sql");
    if (fs.existsSync(normalizeMatriculaPath)) {
      const normalizeMatriculaSql = fs.readFileSync(normalizeMatriculaPath, "utf8");
      await client.query(normalizeMatriculaSql);
    }

    // Ejecutar migración 021 (MATRICULA_EXTRAORDINARIA en tipo_incidencia_soporte)
    const extraMatriculaIncidenciaPath = path.join(__dirname, "../migrations/021_add_matricula_extraordinaria_to_tipo_incidencia.sql");
    if (fs.existsSync(extraMatriculaIncidenciaPath)) {
      const extraMatriculaIncidenciaSql = fs.readFileSync(extraMatriculaIncidenciaPath, "utf8");
      await client.query(extraMatriculaIncidenciaSql);
    }

    // Ejecutar migración 022 (id_tipodocumento, documento, telefono en usuario)
    const addUsuarioDocTelPath = path.join(__dirname, "../migrations/022_add_usuario_documento_telefono.sql");
    if (fs.existsSync(addUsuarioDocTelPath)) {
      const addUsuarioDocTelSql = fs.readFileSync(addUsuarioDocTelPath, "utf8");
      await client.query(addUsuarioDocTelSql);
    }

    // Ejecutar migración 023 (email_change_tokens)
    const emailChangeTokensPath = path.join(__dirname, "../migrations/023_email_change_tokens.sql");
    if (fs.existsSync(emailChangeTokensPath)) {
      const emailChangeTokensSql = fs.readFileSync(emailChangeTokensPath, "utf8");
      await client.query(emailChangeTokensSql);
    }

    // Ejecutar migración 029 (remoción de documento e id_tipodocumento de docente, estudiante y padre_familia)
    const removeDocFromRolesPath = path.join(__dirname, "../migrations/029_remove_documento_from_role_tables.sql");
    if (fs.existsSync(removeDocFromRolesPath)) {
      const removeDocFromRolesSql = fs.readFileSync(removeDocFromRolesPath, "utf8");
      await client.query(removeDocFromRolesSql);
    }

    // Ejecutar migración 030 (CHECK constraint en usuario.documento)
    const checkDocNumericPath = path.join(__dirname, "../migrations/030_add_usuario_documento_numeric_check.sql");
    if (fs.existsSync(checkDocNumericPath)) {
      const checkDocNumericSql = fs.readFileSync(checkDocNumericPath, "utf8");
      await client.query(checkDocNumericSql);
    }

    // Ejecutar migración 031 (actualización de CHECK constraint para Pasaportes)
    const checkDocPasaportePath = path.join(__dirname, "../migrations/031_update_documento_check_for_pasaporte.sql");
    if (fs.existsSync(checkDocPasaportePath)) {
      const checkDocPasaporteSql = fs.readFileSync(checkDocPasaportePath, "utf8");
      await client.query(checkDocPasaporteSql);
    }

    // Ejecutar migración 032 (permitir email NULL en usuario)
    const makeEmailNullablePath = path.join(__dirname, "../migrations/032_make_usuario_email_nullable.sql");
    if (fs.existsSync(makeEmailNullablePath)) {
      const makeEmailNullableSql = fs.readFileSync(makeEmailNullablePath, "utf8");
      await client.query(makeEmailNullableSql);
    }

    // Ejecutar migración 033 (limpieza de asignaciones duplicadas en detalle_grados y actividades sin notas)
    const cleanupDuplicatesPath = path.join(__dirname, "../migrations/033_cleanup_duplicate_assignments_and_activities.sql");
    if (fs.existsSync(cleanupDuplicatesPath)) {
      const cleanupDuplicatesSql = fs.readFileSync(cleanupDuplicatesPath, "utf8");
      await client.query(cleanupDuplicatesSql);
    }

    // Ejecutar migración 034 (justificación de evidencias pendientes en cierre_materia)
    const addJustificacionCierrePath = path.join(__dirname, "../migrations/034_add_justificacion_cierre_materia.sql");
    if (fs.existsSync(addJustificacionCierrePath)) {
      const addJustificacionCierreSql = fs.readFileSync(addJustificacionCierrePath, "utf8");
      await client.query(addJustificacionCierreSql);
    }

    // Ejecutar migración 035 (id_docente_creador en actividad_materia para trazabilidad histórica)
    const addDocenteCreadorPath = path.join(__dirname, "../migrations/035_add_id_docente_creador_to_actividad_materia.sql");
    if (fs.existsSync(addDocenteCreadorPath)) {
      const addDocenteCreadorSql = fs.readFileSync(addDocenteCreadorPath, "utf8");
      await client.query(addDocenteCreadorSql);
    }

    // Backfill sync_uuid for existing competencies
    const unmigratedRes = await client.query(`
      SELECT id_colegio, id_anio, id_materia, id_periodo, descripcion, ARRAY_AGG(id_competencia) AS ids
      FROM public.competencias
      WHERE sync_uuid IS NULL
      GROUP BY id_colegio, id_anio, id_materia, id_periodo, descripcion
    `);
    for (const group of unmigratedRes.rows) {
      const uuid = randomUUID();
      await client.query(
        `UPDATE public.competencias SET sync_uuid = $1 WHERE id_competencia = ANY($2::int[])`,
        [uuid, group.ids]
      );
    }

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
  id_anio: number;
  id_grupo: number;
  id_materia: number;
  id_periodo: number;
  descripcion: string;
  id_colegio: number;
  sync_uuid?: string | null;
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
  descripcion?: string,
  competencyId?: number,
  idDimension?: number | null
): Promise<CompetencyRow> => {
  const peerGroups = await getGradePeerGroups(client, context.idColegio, context.idGrupo);
  if (peerGroups.length === 0) {
    throw new Error("No se encontraron cursos para sincronizar la competencia del grado");
  }

  const chosenDescription =
    descripcion && normalizeCompetencyDescription(descripcion)
      ? normalizeCompetencyDescription(descripcion)
      : null;

  let syncUuid: string;

  if (competencyId) {
    // Modo Edición: Obtener el sync_uuid existente
    const compRes = await client.query<{ sync_uuid: string | null }>(
      `SELECT sync_uuid FROM public.competencias WHERE id_competencia = $1`,
      [competencyId]
    );
    if (compRes.rows.length === 0) {
      throw new Error("Competencia no encontrada para editar");
    }

    if (compRes.rows[0].sync_uuid) {
      syncUuid = compRes.rows[0].sync_uuid;
    } else {
      syncUuid = randomUUID();
      // Asignar el nuevo UUID a la competencia
      await client.query(
        `UPDATE public.competencias SET sync_uuid = $1 WHERE id_competencia = $2`,
        [syncUuid, competencyId]
      );
    }
  } else {
    // Modo Creación: Generar un nuevo sync_uuid
    syncUuid = randomUUID();
  }

  const sharedDescription =
    chosenDescription ??
    (competencyId
      ? (await client.query<{ descripcion: string }>(
          `SELECT descripcion FROM public.competencias WHERE id_competencia = $1`,
          [competencyId]
        )).rows[0]?.descripcion
      : null) ??
    DEFAULT_COMPETENCY_DESCRIPTION;

  const syncedRows: CompetencyRow[] = [];
  for (const peerGroupId of peerGroups) {
    let syncedRes;
    if (competencyId) {
      // Verificar si ya existe registro hermano con este sync_uuid para este grupo
      const checkPeer = await client.query<CompetencyRow>(
        `SELECT * FROM public.competencias WHERE sync_uuid = $1 AND id_grupo = $2`,
        [syncUuid, peerGroupId]
      );
      if (checkPeer.rows.length > 0) {
        syncedRes = await client.query<CompetencyRow>(
          `UPDATE public.competencias 
           SET descripcion = $1, id_dimension = $2 
           WHERE sync_uuid = $3 AND id_grupo = $4
           RETURNING *`,
          [sharedDescription, idDimension !== undefined ? idDimension : null, syncUuid, peerGroupId]
        );
      } else {
        syncedRes = await client.query<CompetencyRow>(
          `INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [context.idAnio, peerGroupId, context.idMateria, periodId, sharedDescription, context.idColegio, syncUuid, idDimension !== undefined ? idDimension : null]
        );
        await ensureDefaultEvidencias(client, syncedRes.rows[0].id_competencia, context.idColegio);
      }
    } else {
      // Creación: Insertar en todos los grupos paralelos
      syncedRes = await client.query<CompetencyRow>(
        `INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [context.idAnio, peerGroupId, context.idMateria, periodId, sharedDescription, context.idColegio, syncUuid, idDimension !== undefined ? idDimension : null]
      );
      await ensureDefaultEvidencias(client, syncedRes.rows[0].id_competencia, context.idColegio);
    }

    const compRow = syncedRes.rows[0];
    syncedRows.push(compRow);
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
  // Obtener todas las competencias distintas por sync_uuid en este año/colegio
  const competenciesRes = await client.query<{
    sync_uuid: string;
    id_grupo: number;
    id_materia: number;
    id_periodo: number;
    descripcion: string;
  }>(
    `SELECT DISTINCT ON (c.sync_uuid) c.sync_uuid, c.id_grupo, c.id_materia, c.id_periodo, c.descripcion
     FROM public.competencias c
     WHERE c.id_colegio = $1 AND c.id_anio = $2 AND c.sync_uuid IS NOT NULL`,
    [schoolId, yearId]
  );

  for (const row of competenciesRes.rows) {
    const peerGroups = await getGradePeerGroups(client, schoolId, row.id_grupo);
    for (const peerGroupId of peerGroups) {
      const existCheck = await client.query(
        `SELECT id_competencia FROM public.competencias WHERE sync_uuid = $1 AND id_grupo = $2`,
        [row.sync_uuid, peerGroupId]
      );
      if (existCheck.rows.length === 0) {
        const insertRes = await client.query(
          `INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id_competencia`,
          [yearId, peerGroupId, row.id_materia, row.id_periodo, row.descripcion, schoolId, row.sync_uuid]
        );
        await ensureDefaultEvidencias(client, insertRes.rows[0].id_competencia, schoolId);
      } else {
        await client.query(
          `UPDATE public.competencias SET descripcion = $1 WHERE sync_uuid = $2 AND id_grupo = $3`,
          [row.descripcion, row.sync_uuid, peerGroupId]
        );
      }
    }
  }
};

export const ensureCompetencyForContext = async (
  client: PoolClient,
  context: TeachingContext,
  periodId: number
): Promise<CompetencyRow | null> => {
  // Buscar si ya existe alguna competencia registrada para este contexto de grupo, materia, periodo, año y colegio
  const existRes = await client.query<CompetencyRow>(
    `SELECT * FROM public.competencias 
     WHERE id_anio = $1 AND id_grupo = $2 AND id_materia = $3 AND id_periodo = $4 AND id_colegio = $5
     ORDER BY CASE WHEN descripcion = 'Competencia pendiente por definir.' THEN 1 ELSE 0 END ASC, id_competencia ASC
     LIMIT 1`,
    [context.idAnio, context.idGrupo, context.idMateria, periodId, context.idColegio]
  );

  if (existRes.rows.length > 0) {
    return existRes.rows[0];
  }

  // Do not auto-create a default competency. Return null so the competencies list starts completely empty.
  return null;
};
