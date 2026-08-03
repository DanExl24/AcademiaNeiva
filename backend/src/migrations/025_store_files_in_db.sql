-- Migration 025: Almacenamiento de archivos en base de datos (BYTEA) para documento_matriculas

ALTER TABLE public.documento_matriculas 
ADD COLUMN IF NOT EXISTS contenido BYTEA NULL,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS nombre_original VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS tamano_bytes INTEGER NULL;
