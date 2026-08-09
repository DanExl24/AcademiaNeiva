-- Migración 033: Limpieza de asignaciones duplicadas en detalle_grados y actividades duplicadas sin notas

-- 1. Reasignar cualquier actividad_materia de detalle_grados duplicados al id_detallegrado más reciente
WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia 
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM detalle_grados
)
UPDATE actividad_materia am
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE am.id_detallegrado = r.id_detallegrado
  AND am.id_detallegrado != r.main_id_detallegrado;

-- Reasignar resultado_academico de detalle_grados duplicados
WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia 
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM detalle_grados
)
UPDATE resultado_academico ra
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE ra.id_detallegrado = r.id_detallegrado
  AND ra.id_detallegrado != r.main_id_detallegrado;

-- Reasignar observacion_estudiante de detalle_grados duplicados
WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia 
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM detalle_grados
)
UPDATE observacion_estudiante oe
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE oe.id_detallegrado = r.id_detallegrado
  AND oe.id_detallegrado != r.main_id_detallegrado;

-- Reasignar registro_asistencia de detalle_grados duplicados
WITH ranked_dg AS (
  SELECT id_detallegrado, id_colegio, id_grupo, id_materia,
         FIRST_VALUE(id_detallegrado) OVER (
           PARTITION BY id_colegio, id_grupo, id_materia 
           ORDER BY id_detallegrado DESC
         ) AS main_id_detallegrado
  FROM detalle_grados
)
UPDATE registro_asistencia ra
SET id_detallegrado = r.main_id_detallegrado
FROM ranked_dg r
WHERE ra.id_detallegrado = r.id_detallegrado
  AND ra.id_detallegrado != r.main_id_detallegrado;

-- Reasignar cierre_materia de detalle_grados duplicados (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cierre_materia') THEN
    WITH ranked_dg AS (
      SELECT id_detallegrado, id_colegio, id_grupo, id_materia,
             FIRST_VALUE(id_detallegrado) OVER (
               PARTITION BY id_colegio, id_grupo, id_materia 
               ORDER BY id_detallegrado DESC
             ) AS main_id_detallegrado
      FROM detalle_grados
    )
    UPDATE cierre_materia cm
    SET id_detallegrado = r.main_id_detallegrado
    FROM ranked_dg r
    WHERE cm.id_detallegrado = r.id_detallegrado
      AND cm.id_detallegrado != r.main_id_detallegrado;
  END IF;
END;
$$;

-- Eliminar detalle_grados antiguos duplicados que ya no son el principal
-- Solo si no tienen ninguna referencia pendiente en ninguna tabla hija
DELETE FROM detalle_grados dg
WHERE id_detallegrado NOT IN (
  SELECT MAX(id_detallegrado)
  FROM detalle_grados
  GROUP BY id_colegio, id_grupo, id_materia
)
AND NOT EXISTS (SELECT 1 FROM actividad_materia am WHERE am.id_detallegrado = dg.id_detallegrado)
AND NOT EXISTS (SELECT 1 FROM resultado_academico ra WHERE ra.id_detallegrado = dg.id_detallegrado)
AND NOT EXISTS (SELECT 1 FROM observacion_estudiante oe WHERE oe.id_detallegrado = dg.id_detallegrado)
AND NOT EXISTS (SELECT 1 FROM registro_asistencia ra WHERE ra.id_detallegrado = dg.id_detallegrado);

-- 2. Limpiar actividades duplicadas sin notas creadas durante pruebas
WITH ranked_act AS (
  SELECT id_actividadmateria,
         ROW_NUMBER() OVER (
           PARTITION BY id_detallegrado, id_periodo, nombre, porcentaje
           ORDER BY id_actividadmateria ASC
         ) as rn
  FROM actividad_materia am
  WHERE NOT EXISTS (SELECT 1 FROM notas_actividad na WHERE na.id_actividadmateria = am.id_actividadmateria)
)
DELETE FROM actividad_materia
WHERE id_actividadmateria IN (
  SELECT id_actividadmateria FROM ranked_act WHERE rn > 1
);
