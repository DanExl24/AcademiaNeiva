-- Migración 030: Restricción estricta en usuario.documento (solo números)

DO $$
BEGIN
    -- 1. Sanitizar cualquier documento que contenga caracteres no numéricos
    UPDATE usuario
    SET documento = REGEXP_REPLACE(documento, '[^0-9]', '', 'g')
    WHERE documento IS NOT NULL AND documento ~ '[^0-9]';

    -- Si después de sanitizar queda vacío, poner en NULL
    UPDATE usuario
    SET documento = NULL
    WHERE documento = '';

    -- 2. Agregar CHECK constraint chk_usuario_documento_numeric si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuario_documento_numeric'
    ) THEN
        ALTER TABLE usuario
        ADD CONSTRAINT chk_usuario_documento_numeric
        CHECK (documento IS NULL OR documento ~ '^[0-9]+$');
    END IF;
END $$;
