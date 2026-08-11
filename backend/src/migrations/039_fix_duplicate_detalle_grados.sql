-- Migración 039: Solución permanente a duplicados en detalle_grados
-- 1. Llenar id_anio en detalle_grados para registros antiguos donde id_anio es NULL
UPDATE public.detalle_grados dg
SET id_anio = al.id_anio
FROM public.anio_lectivo al
WHERE dg.id_colegio = al.id_colegio
  AND dg.id_anio IS NULL
  AND al.estado = 'ABIERTO';

-- 2. Consolidar registros duplicados en detalle_grados por (id_colegio, id_grupo, id_materia, id_anio)
WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia, id_anio,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia, COALESCE(id_anio, -1)
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM public.detalle_grados
)
UPDATE public.actividad_materia am
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE am.id_detallegrado = r.id_detallegrado
  AND am.id_detallegrado != r.main_id_detallegrado;

WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia, id_anio,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia, COALESCE(id_anio, -1)
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM public.detalle_grados
)
UPDATE public.resultado_academico ra
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE ra.id_detallegrado = r.id_detallegrado
  AND ra.id_detallegrado != r.main_id_detallegrado;

WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia, id_anio,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia, COALESCE(id_anio, -1)
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM public.detalle_grados
)
UPDATE public.observacion_estudiante oe
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE oe.id_detallegrado = r.id_detallegrado
  AND oe.id_detallegrado != r.main_id_detallegrado;

WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia, id_anio,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia, COALESCE(id_anio, -1)
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM public.detalle_grados
)
UPDATE public.registro_asistencia ra
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE ra.id_detallegrado = r.id_detallegrado
  AND ra.id_detallegrado != r.main_id_detallegrado;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cierre_materia') THEN
    WITH ranked_dg AS (
      SELECT id_detallegrado, id_colegio, id_grupo, id_materia, id_anio,
             FIRST_VALUE(id_detallegrado) OVER (
               PARTITION BY id_colegio, id_grupo, id_materia, COALESCE(id_anio, -1)
               ORDER BY id_detallegrado DESC
             ) AS main_id_detallegrado
      FROM public.detalle_grados
    )
    UPDATE public.cierre_materia cm
    SET id_detallegrado = r.main_id_detallegrado
    FROM ranked_dg r
    WHERE cm.id_detallegrado = r.id_detallegrado
      AND cm.id_detallegrado != r.main_id_detallegrado;
  END IF;
END;
$$;

-- Eliminar detalle_grados huérfanos que eran duplicados
DELETE FROM public.detalle_grados dg
WHERE id_detallegrado NOT IN (
  SELECT MAX(id_detallegrado)
  FROM public.detalle_grados
  GROUP BY id_colegio, id_grupo, id_materia, COALESCE(id_anio, -1)
)
AND NOT EXISTS (SELECT 1 FROM public.actividad_materia am WHERE am.id_detallegrado = dg.id_detallegrado)
AND NOT EXISTS (SELECT 1 FROM public.resultado_academico ra WHERE ra.id_detallegrado = dg.id_detallegrado)
AND NOT EXISTS (SELECT 1 FROM public.observacion_estudiante oe WHERE oe.id_detallegrado = dg.id_detallegrado)
AND NOT EXISTS (SELECT 1 FROM public.registro_asistencia ra WHERE ra.id_detallegrado = dg.id_detallegrado);

-- 3. Crear índice único para prevenir duplicados en la base de datos a futuro
CREATE UNIQUE INDEX IF NOT EXISTS uq_detalle_grados_colegio_grupo_materia_anio
ON public.detalle_grados (id_colegio, id_grupo, id_materia, COALESCE(id_anio, -1));
