-- Migración 048: Crear tipo ENUM y tabla centralizada codigo_verificacion_email

-- Eliminar tablas temporales obsoletas si existen
DROP TABLE IF EXISTS public.matricula_email_verifications CASCADE;
DROP TABLE IF EXISTS public.email_change_tokens CASCADE;

-- 1. Crear tipo ENUM en PostgreSQL para tipos de verificación de correo
DO $$ BEGIN
    CREATE TYPE public.tipo_verificacion_email AS ENUM (
        'MATRICULA_NUEVA', 
        'CAMBIO_CORREO', 
        'RECUPERACION_PASSWORD'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Crear tabla única con columna ENUM
CREATE TABLE IF NOT EXISTS public.codigo_verificacion_email (
    id_verificacion SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    tipo public.tipo_verificacion_email NOT NULL,
    id_usuario INTEGER NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_codigo_verificacion_email ON public.codigo_verificacion_email (email, codigo, tipo);
