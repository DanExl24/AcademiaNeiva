-- 1. Create estado_sancion Enum Type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_sancion') THEN
        CREATE TYPE public.estado_sancion AS ENUM ('ACTIVA', 'REVOCADA', 'VENCIDA');
    END IF;
END $$;

-- 2. Create tipo_sancion table
CREATE TABLE IF NOT EXISTS public.tipo_sancion (
    id_tipo_sancion serial PRIMARY KEY,
    nombre character varying(100) NOT NULL UNIQUE,
    descripcion text
);

-- Seed default sanction types if none exist
INSERT INTO public.tipo_sancion (nombre, descripcion) VALUES
('SUSPENSION_TEMPORAL', 'El estudiante es suspendido de clases por un número específico de días.'),
('MATRICULA_CONDICIONAL', 'El estudiante continúa con matrícula bajo compromiso de comportamiento.'),
('APERCIBIMIENTO', 'Advertencia formal por escrito que precede a una sanción mayor.')
ON CONFLICT (nombre) DO NOTHING;

-- 3. Create sancion table
CREATE TABLE IF NOT EXISTS public.sancion (
    id_sancion serial PRIMARY KEY,
    id_estudiante integer NOT NULL REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE,
    id_tipo_sancion integer NOT NULL REFERENCES public.tipo_sancion(id_tipo_sancion),
    motivo text NOT NULL,
    fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin date NOT NULL,
    estado public.estado_sancion DEFAULT 'ACTIVA'::public.estado_sancion,
    observaciones text,
    id_directivo integer NOT NULL REFERENCES public.directivo(id) ON DELETE CASCADE,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fechas_sancion CHECK (fecha_fin >= fecha_inicio)
);

-- 4. Create trigger to synchronize student status
CREATE OR REPLACE FUNCTION public.fn_sync_estudiante_sancion()
RETURNS trigger AS $$
BEGIN
    -- Si la sanción está activa y vigente, poner al estudiante en SANCIONADO
    IF NEW.estado = 'ACTIVA' AND CURRENT_DATE BETWEEN NEW.fecha_inicio AND NEW.fecha_fin THEN
        UPDATE public.estudiante
        SET estado = 'SANCIONADO'
        WHERE id_estudiante = NEW.id_estudiante;
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
            WHERE id_estudiante = NEW.id_estudiante AND estado = 'SANCIONADO';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_estudiante_sancion ON public.sancion;
CREATE TRIGGER trg_sync_estudiante_sancion
AFTER INSERT OR UPDATE ON public.sancion
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_estudiante_sancion();
