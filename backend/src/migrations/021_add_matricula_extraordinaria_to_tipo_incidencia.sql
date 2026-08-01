-- Migration 021: Añadir MATRICULA_EXTRAORDINARIA a tipo_incidencia_soporte ENUM

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'tipo_incidencia_soporte' 
          AND pg_enum.enumlabel = 'MATRICULA_EXTRAORDINARIA'
    ) THEN
        ALTER TYPE public.tipo_incidencia_soporte ADD VALUE 'MATRICULA_EXTRAORDINARIA';
    END IF;
END $$;
