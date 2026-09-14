-- 062_refactor_promotion_and_year_closure_module.sql
-- Consolidación, integridad y blindaje del Módulo 9: Promoción, Cierre de Año y Boletines
-- 1. Restricción UNIQUE en decision_promocion_directivo por estudiante, colegio y año escolar
-- 2. Clave foránea formal id_usuario_decision hacia usuario(id_usuario) ON DELETE CASCADE
-- 3. Índice compuesto para consultas de cierre anual por colegio y año

BEGIN;

-- 1. Restricción UNIQUE en decision_promocion_directivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_decision_promocion_estudiante_colegio_anio'
  ) THEN
    ALTER TABLE public.decision_promocion_directivo
    ADD CONSTRAINT uq_decision_promocion_estudiante_colegio_anio 
    UNIQUE (id_estudiante, id_colegio, id_anio_anterior);
  END IF;
END $$;

-- 2. Clave foránea formal hacia usuario(id_usuario)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_promocion_usuario'
  ) THEN
    ALTER TABLE public.decision_promocion_directivo
    ADD CONSTRAINT fk_decision_promocion_usuario 
    FOREIGN KEY (id_usuario_decision) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Índice compuesto para consultas institucionales por año de cierre
CREATE INDEX IF NOT EXISTS idx_decision_promocion_colegio_anio 
ON public.decision_promocion_directivo (id_colegio, id_anio_anterior);

COMMIT;
