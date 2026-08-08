-- Migración 031: Actualización de la restricción física de usuario.documento para soportar Pasaportes alfanuméricos

DO $$
BEGIN
    -- 1. Insertar tipo de documento 'Pasaporte' en la tabla tipo_documento si no existe
    IF NOT EXISTS (
        SELECT 1 FROM tipo_documento WHERE LOWER(tipo) = 'pasaporte' OR id_tipodocumento = 6
    ) THEN
        INSERT INTO tipo_documento (id_tipodocumento, tipo)
        VALUES (6, 'Pasaporte')
        ON CONFLICT (id_tipodocumento) DO UPDATE SET tipo = 'Pasaporte';
    END IF;

    -- 2. Eliminar la constraint numérica antigua si existe
    ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_documento_numeric;
    ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_documento_format;

    -- 3. Crear la nueva constraint chk_usuario_documento_format que admite caracteres alfanuméricos (para Pasaportes)
    ALTER TABLE usuario
    ADD CONSTRAINT chk_usuario_documento_format
    CHECK (documento IS NULL OR documento ~ '^[a-zA-Z0-9]+$');
END $$;
