DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solicitud_traslado' AND column_name = 'id_grupo_destino'
  ) THEN
    ALTER TABLE public.solicitud_traslado ADD COLUMN id_grupo_destino INTEGER REFERENCES public.grupos(id_grupo) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traslado_aprobacion' AND column_name = 'id_grupo_destino'
  ) THEN
    ALTER TABLE public.traslado_aprobacion ADD COLUMN id_grupo_destino INTEGER REFERENCES public.grupos(id_grupo) ON DELETE SET NULL;
  END IF;

  UPDATE public.traslado_aprobacion 
  SET id_grupo_destino = NULL 
  WHERE accion != 'APROBAR' OR rol NOT IN ('DIRECTIVO_DESTINO', 'ADMIN_GENERAL');
END $$;
