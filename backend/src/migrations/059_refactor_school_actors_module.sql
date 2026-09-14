-- 059_refactor_school_actors_module.sql
-- Saneamiento y normalización del Módulo 6: Estudiantes, Actores Escolares y Familias
-- 1. Eliminar columna obsoleta id_contratodocente de docente
-- 2. Eliminar tabla obsoleta contrato_docente (0 filas, sin uso en backend)
-- 3. Eliminar dependencia transitiva 3NF id_nivel de estudiante (se resuelve vía matrícula/tipo_grado)
-- 4. Blindar unicidad de código de estudiante por colegio: UNIQUE (id_colegio, codigo)
-- 5. Blindar unicidad de vinculación padre-estudiante: UNIQUE (id_padrefamilia, id_estudiante)

BEGIN;

-- 1. Eliminar columna id_contratodocente en docente
ALTER TABLE public.docente DROP COLUMN IF EXISTS id_contratodocente CASCADE;

-- 2. Eliminar tabla obsoleta contrato_docente
DROP TABLE IF EXISTS public.contrato_docente CASCADE;

-- 3. Eliminar columna redundante id_nivel en estudiante
ALTER TABLE public.estudiante DROP COLUMN IF EXISTS id_nivel CASCADE;

-- 4 & 5. Constraints de unicidad
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_estudiante_colegio_codigo'
    ) THEN
        ALTER TABLE public.estudiante 
        ADD CONSTRAINT uq_estudiante_colegio_codigo UNIQUE (id_colegio, codigo);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_detalle_padrefamilia_padre_estudiante'
    ) THEN
        ALTER TABLE public.detalle_padrefamilia 
        ADD CONSTRAINT uq_detalle_padrefamilia_padre_estudiante UNIQUE (id_padrefamilia, id_estudiante);
    END IF;
END $$;

COMMIT;
