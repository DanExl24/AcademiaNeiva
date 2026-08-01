-- Migration 020: Normalización de Estado y Tipo de Matrícula

-- 1. Crear el TYPE tipo_matricula si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_matricula') THEN 
        CREATE TYPE public.tipo_matricula AS ENUM (
            'REGULAR',
            'RENOVACION',
            'REINGRESO',
            'EXTRAORDINARIA',
            'TRASLADO'
        );
    END IF;
END $$;

-- 2. Migrar registros de matricula con estado 'PENDIENTE_RENOVACION'
-- Se convierte el estado a 'PENDIENTE' y el tipo a 'REINGRESO'
UPDATE public.matricula 
SET estado = 'PENDIENTE'::public.estado_matricula, 
    tipo = 'REINGRESO'
WHERE estado::text = 'PENDIENTE_RENOVACION';

-- 3. Alterar la columna tipo de matricula para usar tipo_matricula ENUM (idempotente)
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'matricula' 
          AND column_name = 'tipo' 
          AND udt_name != 'tipo_matricula'
    ) THEN
        UPDATE public.matricula 
        SET tipo = 'REGULAR' 
        WHERE tipo IS NULL OR UPPER(tipo::text) NOT IN ('REGULAR', 'RENOVACION', 'REINGRESO', 'EXTRAORDINARIA', 'TRASLADO');

        UPDATE public.matricula 
        SET tipo = UPPER(tipo::text);

        ALTER TABLE public.matricula 
        ALTER COLUMN tipo DROP DEFAULT;

        ALTER TABLE public.matricula 
        ALTER COLUMN tipo TYPE public.tipo_matricula 
        USING UPPER(tipo::text)::public.tipo_matricula;

        ALTER TABLE public.matricula 
        ALTER COLUMN tipo SET DEFAULT 'REGULAR'::public.tipo_matricula;

        ALTER TABLE public.matricula 
        ALTER COLUMN tipo SET NOT NULL;
    END IF;
END $$;
