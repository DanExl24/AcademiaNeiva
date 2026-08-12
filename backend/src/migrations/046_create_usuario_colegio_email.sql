-- Migration 046: Create usuario_colegio_email table
-- Centralizes institutional email per (user x school) regardless of roles.
-- Migrates existing data from docente.email_institucional and drops that column.

-- Step 1: Create the new table
CREATE TABLE IF NOT EXISTS public.usuario_colegio_email (
    id                    SERIAL PRIMARY KEY,
    id_usuario            INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    id_colegio            INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE,
    email_institucional   VARCHAR(255) NOT NULL,
    fecha_asignacion      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_usuario_colegio_email UNIQUE (id_usuario, id_colegio)
);

-- Step 2: Performance indexes
CREATE INDEX IF NOT EXISTS idx_uce_usuario ON public.usuario_colegio_email(id_usuario);
CREATE INDEX IF NOT EXISTS idx_uce_colegio ON public.usuario_colegio_email(id_colegio);

-- Step 3 & 4: Migrate existing data from docente.email_institucional if the column exists, then drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'docente' AND column_name = 'email_institucional'
    ) THEN
        INSERT INTO public.usuario_colegio_email (id_usuario, id_colegio, email_institucional)
        SELECT d.id_usuario, d.id_colegio, LOWER(TRIM(d.email_institucional))
        FROM public.docente d
        WHERE d.email_institucional IS NOT NULL
          AND TRIM(d.email_institucional) <> ''
          AND d.id_usuario IS NOT NULL
        ON CONFLICT (id_usuario, id_colegio) DO UPDATE
          SET email_institucional = EXCLUDED.email_institucional;

        ALTER TABLE public.docente DROP COLUMN email_institucional;
    END IF;
END $$;
