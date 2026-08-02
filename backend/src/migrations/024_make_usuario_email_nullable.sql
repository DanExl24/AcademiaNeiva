-- Permite que el campo email en la tabla usuario sea NULL (especialmente para estudiantes)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'usuario' 
          AND column_name = 'email' 
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE usuario ALTER COLUMN email DROP NOT NULL;
    END IF;
END $$;
