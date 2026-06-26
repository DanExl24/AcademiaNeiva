-- ============================================================================
-- MIGRACIÓN 008: Planeación y Ejecución de DBA en Colegios
-- Fecha: 2026-06-24
-- Descripción: Vincula competencias y evidencias de aprendizaje institucionales
--              con el catálogo global de DBA y permite relaciones N-a-N en actividades.
-- ============================================================================

BEGIN;

-- PASO 1: Añadir columna "nombre" a la tabla "competencias"
ALTER TABLE public.competencias 
ADD COLUMN IF NOT EXISTS nombre VARCHAR(200);

-- PASO 2: Añadir columna "id_evidencia_dba" a la tabla "evidencia_aprendizaje"
ALTER TABLE public.evidencia_aprendizaje 
ADD COLUMN IF NOT EXISTS id_evidencia_dba INTEGER REFERENCES public.evidencias_dba(id_evidencia_dba) ON DELETE SET NULL;

-- PASO 3: Crear tabla intermedia "actividad_evidencia_dba" (Relación Muchos a Muchos para evidencias oficiales)
CREATE TABLE IF NOT EXISTS public.actividad_evidencia_dba (
    id_actividadmateria INTEGER NOT NULL REFERENCES public.actividad_materia(id_actividadmateria) ON DELETE CASCADE,
    id_evidencia_dba INTEGER NOT NULL REFERENCES public.evidencias_dba(id_evidencia_dba) ON DELETE CASCADE,
    PRIMARY KEY (id_actividadmateria, id_evidencia_dba)
);

-- PASO 4: Crear índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_evidencia_aprendizaje_dba ON public.evidencia_aprendizaje(id_evidencia_dba) WHERE id_evidencia_dba IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actividad_evidencia_dba_act ON public.actividad_evidencia_dba(id_actividadmateria);
CREATE INDEX IF NOT EXISTS idx_actividad_evidencia_dba_ev ON public.actividad_evidencia_dba(id_evidencia_dba);

COMMIT;
