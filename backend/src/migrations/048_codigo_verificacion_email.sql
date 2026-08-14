-- Migración 048: Crear tabla centralizada codigo_verificacion_email para todos los flujos de verificación OTP

-- Eliminar tablas temporales obsoletas si existen
DROP TABLE IF EXISTS public.matricula_email_verifications CASCADE;
DROP TABLE IF EXISTS public.email_change_tokens CASCADE;

CREATE TABLE IF NOT EXISTS public.codigo_verificacion_email (
    id_verificacion SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'MATRICULA_NUEVA', 'CAMBIO_CORREO', 'RECUPERACION_PASSWORD'
    id_usuario INTEGER NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_codigo_verificacion_email ON public.codigo_verificacion_email (email, codigo, tipo);
