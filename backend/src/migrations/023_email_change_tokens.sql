-- Migración 023: Tabla para tokens y códigos de verificación de cambio de correo electrónico
CREATE TABLE IF NOT EXISTS email_change_tokens (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    nuevo_email VARCHAR(255) NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_change_usuario ON email_change_tokens(id_usuario);
CREATE INDEX IF NOT EXISTS idx_email_change_codigo ON email_change_tokens(codigo);
