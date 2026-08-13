-- Migración 047: Agregar restricción UNIQUE a decision_promocion_directivo para evitar duplicados por estudiante, colegio y año anterior

-- 1. Eliminar duplicados si existieren, conservando el registro más reciente por id_decision
DELETE FROM public.decision_promocion_directivo d1
USING public.decision_promocion_directivo d2
WHERE d1.id_estudiante = d2.id_estudiante
  AND d1.id_colegio = d2.id_colegio
  AND d1.id_anio_anterior = d2.id_anio_anterior
  AND d1.id_decision < d2.id_decision;

-- 2. Crear restricción UNIQUE si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_decision_promocion_estudiante_colegio_anio'
    ) THEN
        ALTER TABLE public.decision_promocion_directivo
        ADD CONSTRAINT uq_decision_promocion_estudiante_colegio_anio UNIQUE (id_estudiante, id_colegio, id_anio_anterior);
    END IF;
END $$;
