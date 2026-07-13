-- 1. Insert EXPULSION into tipo_sancion
INSERT INTO public.tipo_sancion (nombre, descripcion) VALUES
('EXPULSION', 'El estudiante es retirado permanentemente de la institución.')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Update trigger to support EXPULSADO status
CREATE OR REPLACE FUNCTION public.fn_sync_estudiante_sancion()
RETURNS trigger AS $$
DECLARE
    v_tipo character varying(100);
BEGIN
    SELECT nombre INTO v_tipo FROM public.tipo_sancion WHERE id_tipo_sancion = NEW.id_tipo_sancion;

    -- Si la sanción está activa y vigente
    IF NEW.estado = 'ACTIVA' AND CURRENT_DATE BETWEEN NEW.fecha_inicio AND NEW.fecha_fin THEN
        IF v_tipo = 'EXPULSION' THEN
            UPDATE public.estudiante
            SET estado = 'EXPULSADO'
            WHERE id_estudiante = NEW.id_estudiante;
        ELSE
            UPDATE public.estudiante
            SET estado = 'SANCIONADO'
            WHERE id_estudiante = NEW.id_estudiante;
        END IF;
    ELSE
        -- Si no está activa, verificar si le queda alguna otra sanción activa hoy
        IF NOT EXISTS (
            SELECT 1 FROM public.sancion
            WHERE id_estudiante = NEW.id_estudiante
              AND estado = 'ACTIVA'
              AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin
        ) THEN
            -- Si no quedan otras sanciones activas, volver a ACTIVO
            UPDATE public.estudiante
            SET estado = 'ACTIVO'
            WHERE id_estudiante = NEW.id_estudiante AND estado IN ('SANCIONADO', 'EXPULSADO');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
