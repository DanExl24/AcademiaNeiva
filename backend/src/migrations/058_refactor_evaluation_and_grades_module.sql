-- Migración 058: Refactorización y blindaje de integridad para el Módulo 5
-- Evaluación, Calificaciones y Actividades

BEGIN;

-- 1. Eliminar tabla obsoleta desempeno (el desempeño se mapea desde escala_valoracion)
DROP TABLE IF EXISTS public.desempeno CASCADE;

-- 2. Blindar resultado_academico contra duplicados de promedios de periodo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_resultado_estudiante_detalle_periodo'
  ) THEN
    ALTER TABLE public.resultado_academico 
    ADD CONSTRAINT uq_resultado_estudiante_detalle_periodo UNIQUE (id_estudiante, id_detallegrado, id_periodo);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_resultado_promedio'
  ) THEN
    ALTER TABLE public.resultado_academico 
    ADD CONSTRAINT chk_resultado_promedio CHECK (promedio >= 0);
  END IF;
END $$;

-- 3. Fortalecer actividad_materia: id_detallegrado y id_periodo obligatorios
DO $$
BEGIN
  ALTER TABLE public.actividad_materia ALTER COLUMN id_detallegrado SET NOT NULL;
  ALTER TABLE public.actividad_materia ALTER COLUMN id_periodo SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_actividad_porcentaje'
  ) THEN
    ALTER TABLE public.actividad_materia ADD CONSTRAINT chk_actividad_porcentaje CHECK (porcentaje > 0 AND porcentaje <= 100);
  END IF;
END $$;

-- Índice compuesto para acelerar consultas de libro de calificaciones
CREATE INDEX IF NOT EXISTS idx_actividad_materia_dg_periodo 
ON public.actividad_materia (id_detallegrado, id_periodo);

-- 4. Blindar criterio_evaluacion y notas_actividad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_criterio_porcentaje'
  ) THEN
    ALTER TABLE public.criterio_evaluacion ADD CONSTRAINT chk_criterio_porcentaje CHECK (porcentaje > 0 AND porcentaje <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_nota_actividad_rango'
  ) THEN
    ALTER TABLE public.notas_actividad ADD CONSTRAINT chk_nota_actividad_rango CHECK (nota IS NULL OR nota >= 0);
  END IF;
END $$;

COMMIT;
