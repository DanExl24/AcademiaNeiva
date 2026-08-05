-- Migration 026: Añadir columna fecha_creacion a tabla matricula si no existe
ALTER TABLE public.matricula 
ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
