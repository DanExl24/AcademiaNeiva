-- Migración 040: Permitir que un docente pueda pertenecer a múltiples colegios (UNIQUE(id_usuario, id_colegio))
ALTER TABLE public.docente DROP CONSTRAINT IF EXISTS docente_id_usuario_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'docente_id_usuario_id_colegio_key'
  ) THEN
    ALTER TABLE public.docente ADD CONSTRAINT docente_id_usuario_id_colegio_key UNIQUE (id_usuario, id_colegio);
  END IF;
END $$;
