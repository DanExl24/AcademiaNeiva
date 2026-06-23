-- ============================================================================
-- MIGRACIÓN 002: Corrección de Enums, Constraints, Vistas y Blacklist
-- Fecha: 2026-06-23
-- ============================================================================

BEGIN;

-- 0. Dropear vistas dependientes antes de alterar columnas
DROP VIEW IF EXISTS public.vw_desempeno_estudiante CASCADE;
DROP VIEW IF EXISTS public.vw_promedio_normalizado CASCADE;
DROP VIEW IF EXISTS public.vw_asistencia_estudiante CASCADE;

-- 1. Corregir typo documeno -> documento en padre_familia
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='padre_familia' AND column_name='documeno') THEN
    ALTER TABLE padre_familia RENAME COLUMN documeno TO documento;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'padre_familia_documeno_key') THEN
    ALTER TABLE padre_familia RENAME CONSTRAINT padre_familia_documeno_key TO padre_familia_documento_key;
  END IF;
END $$;

-- 2. Eliminar FK duplicada matricula_id_año_fkey (se mantiene fk_matricula_anio)
ALTER TABLE matricula DROP CONSTRAINT IF EXISTS "matricula_id_año_fkey";

-- 3. Cambiar registro_asistencia.estado a estado_asistencia ENUM
-- Asegurar valores válidos antes de castear
UPDATE registro_asistencia SET estado = 'PRESENTE' WHERE estado NOT IN ('PRESENTE', 'AUSENTE', 'TARDE', 'JUSTIFICADA');
ALTER TABLE registro_asistencia ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE registro_asistencia 
  ALTER COLUMN estado TYPE estado_asistencia 
  USING estado::estado_asistencia;
ALTER TABLE registro_asistencia ALTER COLUMN estado SET DEFAULT 'PRESENTE'::estado_asistencia;

-- 4. Cambiar documento_matriculas.estado a estado_documento ENUM
UPDATE documento_matriculas SET estado = 'PENDIENTE' WHERE estado NOT IN ('PENDIENTE', 'VALIDADO', 'RECHAZADO');
ALTER TABLE documento_matriculas ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE documento_matriculas 
  ALTER COLUMN estado TYPE estado_documento 
  USING estado::estado_documento;
ALTER TABLE documento_matriculas ALTER COLUMN estado SET DEFAULT 'PENDIENTE'::estado_documento;

-- 5. Cambiar directivo.estado a estado_usuario_sistema ENUM
UPDATE directivo SET estado = 'ACTIVO' WHERE estado NOT IN ('ACTIVO', 'SUSPENDIDO', 'BANEADO', 'ELIMINADO');
ALTER TABLE directivo ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE directivo 
  ALTER COLUMN estado TYPE estado_usuario_sistema 
  USING estado::estado_usuario_sistema;
ALTER TABLE directivo ALTER COLUMN estado SET DEFAULT 'ACTIVO'::estado_usuario_sistema;

-- 6. Cambiar año_lectivo.estado a estado_periodo ENUM
UPDATE "año_lectivo" SET estado = 'ABIERTO' WHERE estado NOT IN ('ABIERTO', 'CERRADO', 'PENDIENTE');
ALTER TABLE "año_lectivo" ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE "año_lectivo" 
  ALTER COLUMN estado TYPE estado_periodo 
  USING estado::estado_periodo;
ALTER TABLE "año_lectivo" ALTER COLUMN estado SET DEFAULT 'ABIERTO'::estado_periodo;

-- 7. Cambiar observacion_estudiante.tipo a tipo_observacion ENUM
DO $$ BEGIN
    CREATE TYPE tipo_observacion AS ENUM (
        'ACADEMICA',
        'CONVIVENCIA',
        'OTRO'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mapear GENERAL u otros no soportados a 'OTRO'
UPDATE observacion_estudiante SET tipo = 'OTRO' WHERE tipo NOT IN ('ACADEMICA', 'CONVIVENCIA', 'OTRO');
ALTER TABLE observacion_estudiante ALTER COLUMN tipo DROP DEFAULT;
ALTER TABLE observacion_estudiante 
  ALTER COLUMN tipo TYPE tipo_observacion 
  USING tipo::tipo_observacion;
ALTER TABLE observacion_estudiante ALTER COLUMN tipo SET DEFAULT 'ACADEMICA'::tipo_observacion;

-- 8. UNIQUE CONSTRAINT en matricula(id_estudiante, id_año, id_colegio) para estados no terminales
DROP INDEX IF EXISTS idx_matricula_estudiante_anio_colegio_activo;
CREATE UNIQUE INDEX idx_matricula_estudiante_anio_colegio_activo 
ON matricula(id_estudiante, "id_año", id_colegio) 
WHERE estado NOT IN ('CANCELADA', 'RECHAZADA');

-- 9. Agregar id_año a registro_graduados
ALTER TABLE registro_graduados ADD COLUMN IF NOT EXISTS "id_año" integer REFERENCES "año_lectivo"("id_año");

-- 10. Agregar fecha_expiracion a papelera_materias
ALTER TABLE papelera_materias ADD COLUMN IF NOT EXISTS fecha_expiracion timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');

-- 11. Recrear vw_asistencia_estudiante
CREATE OR REPLACE VIEW public.vw_asistencia_estudiante AS
 SELECT id_estudiante,
    id_detallegrado,
    count(*) FILTER (WHERE ((estado)::text = 'PRESENTE'::text)) AS presentes,
    count(*) FILTER (WHERE ((estado)::text = 'AUSENTE'::text)) AS ausentes,
    count(*) FILTER (WHERE ((estado)::text = 'TARDE'::text)) AS tardes,
    count(*) FILTER (WHERE ((estado)::text = 'JUSTIFICADA'::text)) AS justificadas
   FROM public.registro_asistencia
  GROUP BY id_estudiante, id_detallegrado;

ALTER VIEW public.vw_asistencia_estudiante OWNER TO postgres;

-- 12. Recrear vw_promedio_normalizado usando nota_maxima
CREATE OR REPLACE VIEW public.vw_promedio_normalizado AS
 SELECT p.id_estudiante,
    p.id_periodo,
    p.id_colegio,
    ((p.promedio_raw / NULLIF(cfg.nota_maxima, (0)::numeric)) * (5)::numeric) AS promedio_normalizado
   FROM public.vw_promedio_estudiante_periodo p
     JOIN public.configuracion_colegio cfg ON (cfg.id_colegio = p.id_colegio);

ALTER VIEW public.vw_promedio_normalizado OWNER TO postgres;

-- 13. Recrear vw_desempeno_estudiante (dependía de vw_promedio_normalizado)
CREATE OR REPLACE VIEW public.vw_desempeno_estudiante AS
 SELECT p.id_estudiante,
    p.id_periodo,
    p.id_colegio,
    p.promedio_normalizado,
    d.nivel AS "desempeño"
   FROM (public.vw_promedio_normalizado p
     JOIN public.escala_valoracion d ON (((p.promedio_normalizado >= d.valor_minimo) AND (p.promedio_normalizado <= d.valor_maximo) AND (d.id_colegio = p.id_colegio))));

ALTER VIEW public.vw_desempeno_estudiante OWNER TO postgres;

-- 14. Crear tabla token_blacklist
CREATE TABLE IF NOT EXISTS token_blacklist (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Crear índice para limpieza automática
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- 16. Agregar columna logged_out_at a usuario para invalidación de sesiones
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS logged_out_at TIMESTAMPTZ;

COMMIT;
