-- Migración 032: Permitir que el campo email en la tabla usuario sea NULL
-- (Los estudiantes y usuarios pueden no registrar correo electrónico en su creación inicial)

DO $$
BEGIN
    ALTER TABLE usuario ALTER COLUMN email DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
