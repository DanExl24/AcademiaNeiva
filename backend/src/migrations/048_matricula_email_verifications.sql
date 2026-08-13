-- Migración 048: Crear tabla matricula_email_verifications para verificación de correos electrónicos vía OTP de 6 dígitos antes de enviar matrícula

CREATE TABLE IF NOT EXISTS public.matricula_email_verifications (
    id_verificacion SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matricula_email_code ON public.matricula_email_verifications (email, codigo);
