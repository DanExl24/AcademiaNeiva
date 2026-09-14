-- 060_refactor_enrollment_and_transfers_module.sql
-- Saneamiento y robustecimiento del Módulo 7: Matrículas, Inscripciones y Traslados
-- 1. Normalizar registro_graduados: id_anio NOT NULL, renombrar FK con "ñ", agregar FK a usuario(id_usuario) e índice en id_anio
-- 2. Normalizar configuracion_inscripcion: renombrar FK con "ñ"
-- 3. Blindar integridad en solicitud_traslado y traslado_aprobacion: FKs formales a usuario(id_usuario)
-- 4. Índices de alto rendimiento en documento_matriculas para búsquedas por estado y versión

BEGIN;

-- 1. Normalizar y robustecer registro_graduados
ALTER TABLE public.registro_graduados ALTER COLUMN id_anio SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registro_graduados_id_año_fkey') THEN
    ALTER TABLE public.registro_graduados RENAME CONSTRAINT "registro_graduados_id_año_fkey" TO fk_registro_graduados_anio;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_registro_graduados_usuario') THEN
    ALTER TABLE public.registro_graduados 
    ADD CONSTRAINT fk_registro_graduados_usuario 
    FOREIGN KEY (id_usuario_registro) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registro_graduados_anio ON public.registro_graduados(id_anio);

-- 2. Limpieza de nombres de constraints en configuracion_inscripcion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_inscripcion_id_año_fkey') THEN
    ALTER TABLE public.configuracion_inscripcion RENAME CONSTRAINT "configuracion_inscripcion_id_año_fkey" TO fk_configuracion_inscripcion_anio;
  END IF;
END $$;

-- 3. Claves foráneas en solicitud_traslado y traslado_aprobacion
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_traslado_usuario') THEN
    ALTER TABLE public.solicitud_traslado 
    ADD CONSTRAINT fk_solicitud_traslado_usuario 
    FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_traslado_creador') THEN
    ALTER TABLE public.solicitud_traslado 
    ADD CONSTRAINT fk_solicitud_traslado_creador 
    FOREIGN KEY (creado_por) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_traslado_aprobacion_usuario') THEN
    ALTER TABLE public.traslado_aprobacion 
    ADD CONSTRAINT fk_traslado_aprobacion_usuario 
    FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Índices compuestos de alto rendimiento en documento_matriculas
CREATE INDEX IF NOT EXISTS idx_documento_matriculas_lookup 
ON public.documento_matriculas(id_matricula, tipo_documento, version DESC);

CREATE INDEX IF NOT EXISTS idx_documento_matriculas_estado 
ON public.documento_matriculas(id_matricula, estado);

COMMIT;
