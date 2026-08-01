-- Migración 022: Agregar id_tipodocumento, documento y telefono a la tabla usuario
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuario' AND column_name = 'id_tipodocumento'
    ) THEN
        ALTER TABLE usuario ADD COLUMN id_tipodocumento INTEGER REFERENCES tipo_documento(id_tipodocumento);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuario' AND column_name = 'documento'
    ) THEN
        ALTER TABLE usuario ADD COLUMN documento VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuario' AND column_name = 'telefono'
    ) THEN
        ALTER TABLE usuario ADD COLUMN telefono VARCHAR(50);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuario_documento ON usuario(documento);
