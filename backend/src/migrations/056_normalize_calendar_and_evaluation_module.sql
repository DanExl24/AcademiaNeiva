-- Migración 056: Normalización y blindaje de integridad para el Módulo 3
-- Calendario, Periodos y Escalas de Valoración

BEGIN;

-- 1. anio_lectivo: Evitar duplicidad de año y tipo de calendario por colegio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_anio_colegio_calendario'
  ) THEN
    ALTER TABLE public.anio_lectivo 
    ADD CONSTRAINT uq_anio_colegio_calendario UNIQUE (id_colegio, calendario, tipo_calendario);
  END IF;
END $$;

-- 2. periodo_academico: Asegurar id_anio NOT NULL, fechas nativas y restricciones de integridad
DO $$
BEGIN
  -- Forzar id_anio NOT NULL
  ALTER TABLE public.periodo_academico ALTER COLUMN id_anio SET NOT NULL;

  -- Incorporar columnas nativas de fecha
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'periodo_academico' AND column_name = 'fecha_inicio'
  ) THEN
    ALTER TABLE public.periodo_academico ADD COLUMN fecha_inicio DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'periodo_academico' AND column_name = 'fecha_fin'
  ) THEN
    ALTER TABLE public.periodo_academico ADD COLUMN fecha_fin DATE;
  END IF;
END $$;

-- Poblar fecha_inicio y fecha_fin desde mes_inicio/dia_inicio y calendario
UPDATE public.periodo_academico pa
SET 
  fecha_inicio = make_date(
    al.calendario::int, 
    pa.mes_inicio, 
    pa.dia_inicio
  ),
  fecha_fin = make_date(
    al.calendario::int + (CASE WHEN pa.mes_fin < pa.mes_inicio THEN 1 ELSE 0 END),
    pa.mes_fin, 
    pa.dia_fin
  )
FROM public.anio_lectivo al
WHERE pa.id_anio = al.id_anio
  AND (pa.fecha_inicio IS NULL OR pa.fecha_fin IS NULL)
  AND pa.mes_inicio IS NOT NULL AND pa.dia_inicio IS NOT NULL
  AND pa.mes_fin IS NOT NULL AND pa.dia_fin IS NOT NULL;

-- Asegurar NOT NULL y constraints en periodo_academico
DO $$
BEGIN
  ALTER TABLE public.periodo_academico ALTER COLUMN fecha_inicio SET NOT NULL;
  ALTER TABLE public.periodo_academico ALTER COLUMN fecha_fin SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_periodo_porcentaje'
  ) THEN
    ALTER TABLE public.periodo_academico ADD CONSTRAINT chk_periodo_porcentaje CHECK (porcentaje > 0 AND porcentaje <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_periodo_fechas'
  ) THEN
    ALTER TABLE public.periodo_academico ADD CONSTRAINT chk_periodo_fechas CHECK (fecha_fin >= fecha_inicio);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_periodo_anio_trimestre'
  ) THEN
    ALTER TABLE public.periodo_academico ADD CONSTRAINT uq_periodo_anio_trimestre UNIQUE (id_anio, trimestre);
  END IF;
END $$;

-- 3. escala_valoracion: Trazabilidad histórica por año escolar (id_anio)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'escala_valoracion' AND column_name = 'id_anio'
  ) THEN
    ALTER TABLE public.escala_valoracion 
    ADD COLUMN id_anio INTEGER REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE;
  END IF;
END $$;

-- Asignar id_anio a las escalas existentes (apuntando al primer año registrado por colegio)
UPDATE public.escala_valoracion ev
SET id_anio = sub.id_anio
FROM (
  SELECT id_colegio, MIN(id_anio) as id_anio
  FROM public.anio_lectivo
  GROUP BY id_colegio
) sub
WHERE ev.id_colegio = sub.id_colegio AND ev.id_anio IS NULL;

-- Replicar escalas para años subsiguientes (ej. 2026) que aún no tengan escalas
INSERT INTO public.escala_valoracion (nivel, valor_minimo, valor_maximo, id_colegio, id_anio)
SELECT ev.nivel, ev.valor_minimo, ev.valor_maximo, al.id_colegio, al.id_anio
FROM public.anio_lectivo al
JOIN public.escala_valoracion ev ON al.id_colegio = ev.id_colegio AND ev.id_anio = (
  SELECT MIN(sub.id_anio) FROM public.anio_lectivo sub WHERE sub.id_colegio = al.id_colegio
)
WHERE al.id_anio NOT IN (SELECT DISTINCT id_anio FROM public.escala_valoracion WHERE id_anio IS NOT NULL);

-- Asegurar NOT NULL y UNIQUE compuesto en escala_valoracion
DO $$
BEGIN
  ALTER TABLE public.escala_valoracion ALTER COLUMN id_anio SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_escala_colegio_anio_nivel'
  ) THEN
    ALTER TABLE public.escala_valoracion ADD CONSTRAINT uq_escala_colegio_anio_nivel UNIQUE (id_colegio, id_anio, nivel);
  END IF;
END $$;

COMMIT;
