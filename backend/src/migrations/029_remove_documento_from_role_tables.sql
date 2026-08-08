-- Migración 029: Migrar datos existentes a la tabla usuario y remover documento e id_tipodocumento de docente, estudiante y padre_familia

DO $$
BEGIN
    -- 1. Migrar datos de docente a usuario si usuario.documento es NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'docente' AND column_name = 'documento'
    ) THEN
        UPDATE usuario u
        SET documento = d.documento,
            id_tipodocumento = d.id_tipodocumento
        FROM docente d
        WHERE d.id_usuario = u.id_usuario
          AND u.documento IS NULL
          AND d.documento IS NOT NULL;
    END IF;

    -- 2. Migrar datos de padre_familia a usuario si usuario.documento es NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'padre_familia' AND column_name = 'documento'
    ) THEN
        UPDATE usuario u
        SET documento = pf.documento,
            id_tipodocumento = pf.id_tipodocumento
        FROM padre_familia pf
        WHERE pf.id_usuario = u.id_usuario
          AND u.documento IS NULL
          AND pf.documento IS NOT NULL;
    END IF;

    -- 3. Migrar datos de estudiante a usuario si usuario.documento es NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'estudiante' AND column_name = 'documento'
    ) THEN
        UPDATE usuario u
        SET documento = e.documento,
            id_tipodocumento = e.id_tipodocumento
        FROM estudiante e
        WHERE e.id_usuario = u.id_usuario
          AND u.documento IS NULL
          AND e.documento IS NOT NULL;
    END IF;

    -- 4. Remover columnas de la tabla docente
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'docente' AND column_name = 'documento'
    ) THEN
        ALTER TABLE docente DROP COLUMN documento;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'docente' AND column_name = 'id_tipodocumento'
    ) THEN
        ALTER TABLE docente DROP COLUMN id_tipodocumento;
    END IF;

    -- 5. Remover columnas de la tabla padre_familia
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'padre_familia' AND column_name = 'documento'
    ) THEN
        ALTER TABLE padre_familia DROP COLUMN documento;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'padre_familia' AND column_name = 'id_tipodocumento'
    ) THEN
        ALTER TABLE padre_familia DROP COLUMN id_tipodocumento;
    END IF;

    -- 6. Remover columnas de la tabla estudiante
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'estudiante' AND column_name = 'documento'
    ) THEN
        ALTER TABLE estudiante DROP COLUMN documento;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'estudiante' AND column_name = 'id_tipodocumento'
    ) THEN
        ALTER TABLE estudiante DROP COLUMN id_tipodocumento;
    END IF;
END $$;
