-- 061_optimize_attendance_and_behavior_module.sql
-- Optimización, integridad y blindaje del Módulo 8: Asistencia y Convivencia Escolar
-- 1. Unicidad e índices de alto rendimiento en registro_asistencia (98,280 filas)
--    - Garantizar que no existan duplicados de asistencia para el mismo estudiante, clase y fecha
--    - Índice por (id_detallegrado, fecha) para agilizar la carga diaria de lista del docente
-- 2. Unicidad e índices en observacion_estudiante (13,821 filas)
--    - Constraint UNIQUE (id_estudiante, id_detallegrado, id_periodo, tipo)
--    - Índices compuestos para acelerar generación de boletines (id_estudiante, id_periodo) y calificador (id_detallegrado, id_periodo)
-- 3. Conservar intacta registro_asistencia_detalle para soporte futuro de bloques

BEGIN;

-- 1. Unicidad e índices en registro_asistencia
CREATE UNIQUE INDEX IF NOT EXISTS idx_registro_asistencia_dia_unique 
ON public.registro_asistencia (id_estudiante, id_detallegrado, ((fecha AT TIME ZONE 'UTC')::date));

CREATE INDEX IF NOT EXISTS idx_registro_asistencia_detallegrado_fecha 
ON public.registro_asistencia (id_detallegrado, ((fecha AT TIME ZONE 'UTC')::date));

-- 2. Unicidad e índices en observacion_estudiante
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_observacion_estudiante_periodo_tipo') THEN
    ALTER TABLE public.observacion_estudiante 
    ADD CONSTRAINT uq_observacion_estudiante_periodo_tipo 
    UNIQUE (id_estudiante, id_detallegrado, id_periodo, tipo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observacion_estudiante_periodo 
ON public.observacion_estudiante (id_estudiante, id_periodo);

CREATE INDEX IF NOT EXISTS idx_observacion_detallegrado_periodo 
ON public.observacion_estudiante (id_detallegrado, id_periodo);

COMMIT;
