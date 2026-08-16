-- Migration 050: Agregar columna materias_reprobatorias_promocion a configuracion_colegio (Decreto 1290)
ALTER TABLE public.configuracion_colegio 
ADD COLUMN IF NOT EXISTS materias_reprobatorias_promocion INTEGER NOT NULL DEFAULT 3;
