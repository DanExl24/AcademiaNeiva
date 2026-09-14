-- Migración 054: Integrar configuración académica en anio_lectivo y eliminar tablas obsoletas de configuración

-- 1. Crear tipo ENUM para el modo de escala de evaluación
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escala_modo_evaluacion') THEN
    CREATE TYPE public.escala_modo_evaluacion AS ENUM ('AUTOMATICO', 'MANUAL');
  END IF;
END $$;

-- 2. Agregar columnas de configuración de evaluación a anio_lectivo
ALTER TABLE public.anio_lectivo
  ADD COLUMN IF NOT EXISTS nota_minima numeric(5,2) DEFAULT 0.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS nota_maxima numeric(5,2) DEFAULT 5.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS nota_aprobacion numeric(5,2) DEFAULT 3.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS escala_modo public.escala_modo_evaluacion DEFAULT 'AUTOMATICO'::public.escala_modo_evaluacion NOT NULL,
  ADD COLUMN IF NOT EXISTS materias_reprobatorias_promocion integer DEFAULT 3 NOT NULL;

-- 3. Agregar constraints de validación de rangos numéricos y consistencia
ALTER TABLE public.anio_lectivo
  DROP CONSTRAINT IF EXISTS chk_nota_min_max,
  ADD CONSTRAINT chk_nota_min_max CHECK (nota_minima >= 0 AND nota_maxima > nota_minima);

ALTER TABLE public.anio_lectivo
  DROP CONSTRAINT IF EXISTS chk_nota_aprobacion,
  ADD CONSTRAINT chk_nota_aprobacion CHECK (nota_aprobacion >= nota_minima AND nota_aprobacion <= nota_maxima);

ALTER TABLE public.anio_lectivo
  DROP CONSTRAINT IF EXISTS chk_materias_reprobatorias,
  ADD CONSTRAINT chk_materias_reprobatorias CHECK (materias_reprobatorias_promocion >= 1 AND materias_reprobatorias_promocion <= 20);

-- 4. Migrar datos existentes desde configuracion_colegio a anio_lectivo si la tabla existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'configuracion_colegio') THEN
    UPDATE public.anio_lectivo al
    SET 
      nota_minima = COALESCE(cc.nota_minima, 0.00),
      nota_maxima = COALESCE(cc.nota_maxima, 5.00),
      nota_aprobacion = COALESCE(cc.nota_aprobacion, 3.00),
      escala_modo = CASE 
        WHEN cc.escala_modo = 'MANUAL' THEN 'MANUAL'::public.escala_modo_evaluacion
        ELSE 'AUTOMATICO'::public.escala_modo_evaluacion
      END,
      materias_reprobatorias_promocion = COALESCE(cc.materias_reprobatorias_promocion, 3)
    FROM public.configuracion_colegio cc
    WHERE al.id_colegio = cc.id_colegio;
  END IF;
END $$;

-- 5. Eliminar tablas obsoletas y huérfanas de configuración
DROP TABLE IF EXISTS public.configuracion_sistema CASCADE;
DROP TABLE IF EXISTS public.configuracion_base CASCADE;
DROP TABLE IF EXISTS public.configuracion_colegio CASCADE;
