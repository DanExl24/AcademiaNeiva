-- Migración 042: Ajuste de claves foráneas para integridad y protección de datos académicos históricamente críticos

-- 1. Modificar FK en notas_actividad: Reemplazar ON DELETE CASCADE por ON DELETE RESTRICT
ALTER TABLE public.notas_actividad
    DROP CONSTRAINT IF EXISTS notas_actividad_id_estudiante_fkey;

ALTER TABLE public.notas_actividad
    ADD CONSTRAINT notas_actividad_id_estudiante_fkey
    FOREIGN KEY (id_estudiante)
    REFERENCES public.estudiante(id_estudiante)
    ON DELETE RESTRICT;

-- 2. Asegurar que resultado_academico restrinja la eliminación accidental de estudiantes con actas o promedios históricos
ALTER TABLE public.resultado_academico
    DROP CONSTRAINT IF EXISTS resultado_academico_id_estudiante_fkey;

ALTER TABLE public.resultado_academico
    ADD CONSTRAINT resultado_academico_id_estudiante_fkey
    FOREIGN KEY (id_estudiante)
    REFERENCES public.estudiante(id_estudiante)
    ON DELETE RESTRICT;

-- 3. Asegurar que observacion_estudiante restrinja la eliminación accidental de estudiantes con observaciones registradas
ALTER TABLE public.observacion_estudiante
    DROP CONSTRAINT IF EXISTS observacion_estudiante_id_estudiante_fkey;

ALTER TABLE public.observacion_estudiante
    ADD CONSTRAINT observacion_estudiante_id_estudiante_fkey
    FOREIGN KEY (id_estudiante)
    REFERENCES public.estudiante(id_estudiante)
    ON DELETE RESTRICT;
