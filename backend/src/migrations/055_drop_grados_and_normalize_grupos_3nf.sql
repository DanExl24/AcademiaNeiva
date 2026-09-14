-- Migración 055: Retiro definitivo de grados y normalización 3NF en grupos

-- 1. Asegurar que legacy_grados_archive contenga el respaldo de grados antes de su eliminación
CREATE TABLE IF NOT EXISTS public.legacy_grados_archive AS 
SELECT * FROM public.grados;

-- 2. Asegurar que las promociones directivas tengan poblados los tipos de grado
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'decision_promocion_directivo' AND column_name = 'id_grado_anterior') THEN
    UPDATE public.decision_promocion_directivo dpd
    SET id_tipo_grado_anterior = tg.id_tipo_grado
    FROM public.legacy_grados_archive lga
    JOIN public.tipo_grado tg 
      ON LOWER(TRIM(lga.tipo_grado)) = LOWER(TRIM(tg.nombre))
    WHERE dpd.id_grado_anterior = lga.id_grado
      AND dpd.id_tipo_grado_anterior IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'decision_promocion_directivo' AND column_name = 'id_grado_asignado') THEN
    UPDATE public.decision_promocion_directivo dpd
    SET id_tipo_grado_asignado = tg.id_tipo_grado
    FROM public.legacy_grados_archive lga
    JOIN public.tipo_grado tg 
      ON LOWER(TRIM(lga.tipo_grado)) = LOWER(TRIM(tg.nombre))
    WHERE dpd.id_grado_asignado = lga.id_grado
      AND dpd.id_tipo_grado_asignado IS NULL;
  END IF;
END $$;

-- 3. Eliminar columnas arcaicas de id_grado en decision_promocion_directivo
ALTER TABLE public.decision_promocion_directivo
  DROP COLUMN IF EXISTS id_grado_anterior CASCADE,
  DROP COLUMN IF EXISTS id_grado_asignado CASCADE;

-- 4. Eliminar la tabla arcaica grados
DROP TABLE IF EXISTS public.grados CASCADE;

-- 5. Normalizar 3NF: Eliminar la columna transitiva id_nivel de grupos (se accede vía id_tipo_grado -> tipo_grado.id_nivel)
ALTER TABLE public.grupos
  DROP COLUMN IF EXISTS id_nivel CASCADE;
