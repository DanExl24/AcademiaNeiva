-- Migración para robustecer tickets de soporte
-- 1. Crear tipos ENUM para tipo_incidencia y estado
DO $$ BEGIN
    CREATE TYPE public.tipo_incidencia_soporte AS ENUM ('TECNICO', 'CALIFICACIONES', 'ASISTENCIA', 'AUTENTICACION', 'SOPORTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.estado_ticket_soporte AS ENUM ('ABIERTO', 'EN_PROCESO', 'RESUELTO', 'ESCALADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Asegurar que los datos existentes correspondan a los ENUMs
UPDATE public.tickets_soporte 
SET tipo_incidencia = 'SOPORTE' 
WHERE tipo_incidencia NOT IN ('TECNICO', 'CALIFICACIONES', 'ASISTENCIA', 'AUTENTICACION', 'SOPORTE');

UPDATE public.tickets_soporte 
SET estado = 'ABIERTO' 
WHERE estado NOT IN ('ABIERTO', 'EN_PROCESO', 'RESUELTO', 'ESCALADO');

-- 3. Modificar tipo_incidencia y estado a los nuevos enums
ALTER TABLE public.tickets_soporte 
    ALTER COLUMN tipo_incidencia TYPE public.tipo_incidencia_soporte 
    USING tipo_incidencia::public.tipo_incidencia_soporte;

ALTER TABLE public.tickets_soporte 
    ALTER COLUMN estado DROP DEFAULT;

ALTER TABLE public.tickets_soporte 
    ALTER COLUMN estado TYPE public.estado_ticket_soporte 
    USING estado::public.estado_ticket_soporte;

ALTER TABLE public.tickets_soporte 
    ALTER COLUMN estado SET DEFAULT 'ABIERTO'::public.estado_ticket_soporte;

-- 4. Convertir columna observaciones a JSONB de forma segura
ALTER TABLE public.tickets_soporte 
    ALTER COLUMN observaciones DROP DEFAULT;

ALTER TABLE public.tickets_soporte 
    ALTER COLUMN observaciones TYPE jsonb 
    USING (
        CASE 
            WHEN observaciones IS NULL OR trim(observaciones) = '' THEN '[]'::jsonb
            ELSE observaciones::jsonb
        END
    );

ALTER TABLE public.tickets_soporte 
    ALTER COLUMN observaciones SET DEFAULT '[]'::jsonb;

-- 5. Crear índices de optimización para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_tickets_codigo ON public.tickets_soporte(codigo_ticket);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON public.tickets_soporte(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_usuario ON public.tickets_soporte(id_usuario);
CREATE INDEX IF NOT EXISTS idx_tickets_colegio ON public.tickets_soporte(id_colegio);
