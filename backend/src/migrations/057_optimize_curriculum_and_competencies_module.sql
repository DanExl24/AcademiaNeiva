-- Migración 057: Optimización y blindaje de integridad para el Módulo 4
-- Currículo, Competencias y DBA

BEGIN;

-- 1. Índice compuesto de alto rendimiento para consultas docentes, boletines y planillas
CREATE INDEX IF NOT EXISTS idx_competencias_context 
ON public.competencias (id_colegio, id_anio, id_periodo, id_grupo, id_materia);

-- 2. Índice para competencias de preescolar asociadas a dimensiones pedagógicas
CREATE INDEX IF NOT EXISTS idx_competencias_dimension 
ON public.competencias (id_dimension) 
WHERE id_dimension IS NOT NULL;

-- 3. Blindaje de orden único y secuencial en evidencia_aprendizaje por competencia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_evidencia_competencia_orden'
  ) THEN
    ALTER TABLE public.evidencia_aprendizaje 
    ADD CONSTRAINT uq_evidencia_competencia_orden UNIQUE (id_competencia, orden);
  END IF;
END $$;

-- 4. Índice para búsquedas por colegio en evidencia_aprendizaje
CREATE INDEX IF NOT EXISTS idx_evidencia_aprendizaje_colegio 
ON public.evidencia_aprendizaje (id_colegio);

-- 5. Restricciones CHECK para validar que el orden de evidencias sea siempre positivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_evidencia_orden'
  ) THEN
    ALTER TABLE public.evidencia_aprendizaje 
    ADD CONSTRAINT chk_evidencia_orden CHECK (orden >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_evidencias_dba_orden'
  ) THEN
    ALTER TABLE public.evidencias_dba 
    ADD CONSTRAINT chk_evidencias_dba_orden CHECK (orden >= 1);
  END IF;
END $$;

COMMIT;
