-- Migración 050: Eliminar columna obsoleta id_colegio de la tabla usuario (reemplazada por usuario_colegio)

DO $$
BEGIN
    -- 1. Si existen registros en usuario con id_colegio que no estén en usuario_colegio, migrarlos primero
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'usuario' 
          AND column_name = 'id_colegio'
    ) THEN
        -- Asegurar que cualquier vinculación remanente quede respaldada en usuario_colegio
        INSERT INTO public.usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
        SELECT u.id_usuario, u.id_colegio, ur.id_rol, 'ACTIVO', CURRENT_TIMESTAMP
        FROM public.usuario u
        JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
        WHERE u.id_colegio IS NOT NULL
        ON CONFLICT (id_usuario, id_colegio, id_rol) DO NOTHING;

        -- 2. Eliminar la columna id_colegio de la tabla usuario
        ALTER TABLE public.usuario DROP COLUMN IF EXISTS id_colegio CASCADE;
    END IF;
END $$;
