-- ============================================================================
-- MIGRACIÓN 009: Independencia de Ejecución Académica
-- Fecha: 2026-06-25
-- Descripción: Permite que las actividades evaluativas existan sin depender 
--              obligatoriamente de una competencia.
-- ============================================================================

BEGIN;

-- Hacer id_competencia nullable en actividad_materia
ALTER TABLE public.actividad_materia 
ALTER COLUMN id_competencia DROP NOT NULL;

COMMIT;
