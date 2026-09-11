-- Migración 053: Eliminar definitivamente la tabla obsoleta persona y sus columnas foráneas id_persona

DO $$
BEGIN
    -- 1. Eliminar columna id_persona de la tabla usuario
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'usuario' AND column_name = 'id_persona'
    ) THEN
        ALTER TABLE public.usuario DROP COLUMN id_persona CASCADE;
    END IF;

    -- 2. Eliminar columna id_persona de la tabla estudiante
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'estudiante' AND column_name = 'id_persona'
    ) THEN
        ALTER TABLE public.estudiante DROP COLUMN id_persona CASCADE;
    END IF;

    -- 3. Eliminar columna id_persona de la tabla docente
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'docente' AND column_name = 'id_persona'
    ) THEN
        ALTER TABLE public.docente DROP COLUMN id_persona CASCADE;
    END IF;

    -- 4. Eliminar columna id_persona de la tabla directivo
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'directivo' AND column_name = 'id_persona'
    ) THEN
        ALTER TABLE public.directivo DROP COLUMN id_persona CASCADE;
    END IF;

    -- 5. Eliminar columna id_persona de la tabla padre_familia
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'padre_familia' AND column_name = 'id_persona'
    ) THEN
        ALTER TABLE public.padre_familia DROP COLUMN id_persona CASCADE;
    END IF;

    -- 6. Eliminar definitivamente la tabla persona
    DROP TABLE IF EXISTS public.persona CASCADE;
END $$;
