-- Migración 038: Traslados de Usuarios/Matrículas y Vinculación Multiinstitucional (usuario_colegio)

-- 1. Crear las tablas de traslados y usuario_colegio si no existen
CREATE TABLE IF NOT EXISTS public.usuario_colegio (
    id_usuario_colegio SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    id_colegio INT NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE,
    id_rol INT NOT NULL REFERENCES public.rol(id_rol) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO', 'SUSPENDIDO')),
    fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT uq_usuario_colegio_rol UNIQUE (id_usuario, id_colegio, id_rol)
);

CREATE INDEX IF NOT EXISTS idx_usuario_colegio_usr ON public.usuario_colegio(id_usuario);
CREATE INDEX IF NOT EXISTS idx_usuario_colegio_col ON public.usuario_colegio(id_colegio);
CREATE INDEX IF NOT EXISTS idx_usuario_colegio_activo ON public.usuario_colegio(id_usuario, id_colegio) WHERE estado = 'ACTIVO';

-- 2. Crear tipos ENUM para solicitudes de traslado si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_traslado') THEN
        CREATE TYPE public.tipo_traslado AS ENUM ('TRASLADO_USUARIO', 'TRASLADO_MATRICULA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_solicitud_traslado') THEN
        CREATE TYPE public.estado_solicitud_traslado AS ENUM ('SOLICITADA', 'EN_APROBACION', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'EJECUTADA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accion_aprobacion_traslado') THEN
        CREATE TYPE public.accion_aprobacion_traslado AS ENUM ('APROBAR', 'RECHAZAR', 'CANCELAR');
    END IF;
END $$;

-- 3. Crear tabla solicitud_traslado
CREATE TABLE IF NOT EXISTS public.solicitud_traslado (
    id_solicitud SERIAL PRIMARY KEY,
    tipo public.tipo_traslado NOT NULL DEFAULT 'TRASLADO_USUARIO',
    id_usuario INT NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    id_colegio_origen INT NOT NULL REFERENCES public.colegio(id_colegio),
    id_colegio_destino INT NOT NULL REFERENCES public.colegio(id_colegio),
    id_matricula INT NULL REFERENCES public.matricula(id_matricula) ON DELETE SET NULL,
    estado public.estado_solicitud_traslado NOT NULL DEFAULT 'SOLICITADA',
    motivo TEXT NOT NULL,
    creado_por INT NOT NULL REFERENCES public.usuario(id_usuario),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_finalizacion TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT chk_origen_destino_diff CHECK (id_colegio_origen <> id_colegio_destino)
);

CREATE INDEX IF NOT EXISTS idx_solicitud_traslado_usr ON public.solicitud_traslado(id_usuario);
CREATE INDEX IF NOT EXISTS idx_solicitud_traslado_origen ON public.solicitud_traslado(id_colegio_origen);
CREATE INDEX IF NOT EXISTS idx_solicitud_traslado_destino ON public.solicitud_traslado(id_colegio_destino);

-- 4. Crear tabla traslado_aprobacion
CREATE TABLE IF NOT EXISTS public.traslado_aprobacion (
    id_aprobacion SERIAL PRIMARY KEY,
    id_solicitud INT NOT NULL REFERENCES public.solicitud_traslado(id_solicitud) ON DELETE CASCADE,
    id_usuario INT NOT NULL REFERENCES public.usuario(id_usuario),
    rol VARCHAR(50) NOT NULL,
    accion public.accion_aprobacion_traslado NOT NULL,
    comentario TEXT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_traslado_aprobacion_sol ON public.traslado_aprobacion(id_solicitud);

-- 5. Poblar usuario_colegio a partir de las relaciones activas existentes en usuario y usuario_rol (si la columna id_colegio aún existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'usuario' 
          AND column_name = 'id_colegio'
    ) THEN
        EXECUTE '
            INSERT INTO public.usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
            SELECT u.id_usuario, u.id_colegio, ur.id_rol, ''ACTIVO'', CURRENT_TIMESTAMP
            FROM public.usuario u
            JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
            WHERE u.id_colegio IS NOT NULL
            ON CONFLICT (id_usuario, id_colegio, id_rol) DO NOTHING;
        ';

        -- 6. Hacer usuario.id_colegio NULLABLE para permitir la desvinculación o usuarios globales
        EXECUTE 'ALTER TABLE public.usuario ALTER COLUMN id_colegio DROP NOT NULL;';
    END IF;
END $$;

