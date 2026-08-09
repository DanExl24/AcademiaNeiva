-- Migración 034: Agregar justificacion_evidencias_pendientes en cierre_materia
ALTER TABLE public.cierre_materia 
ADD COLUMN IF NOT EXISTS justificacion_evidencias_pendientes TEXT;
