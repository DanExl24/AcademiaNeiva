-- Migration 019: Reingreso Estudiantil, Versionamiento de Documentos e Integración con Soporte

-- 1. Crear el TYPE estado_renovacion_documento si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_renovacion_documento') THEN 
        CREATE TYPE public.estado_renovacion_documento AS ENUM (
            'VIGENTE',
            'RECOMENDADO_ACTUALIZAR',
            'OBLIGATORIO_ACTUALIZAR',
            'DESACTUALIZADO_POR_FECHA'
        );
    END IF;
END $$;

-- 2. Añadir 'REINGRESO' al enum tipo_incidencia_soporte si no existe
ALTER TYPE public.tipo_incidencia_soporte ADD VALUE IF NOT EXISTS 'REINGRESO';

-- 3. Añadir 'PENDIENTE_RENOVACION' al enum estado_matricula si no existe
ALTER TYPE public.estado_matricula ADD VALUE IF NOT EXISTS 'PENDIENTE_RENOVACION';

-- 4. Añadir columnas a documento_matriculas para versionamiento y control de expiración
ALTER TABLE public.documento_matriculas 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS fecha_expedicion DATE NULL,
ADD COLUMN IF NOT EXISTS estado_renovacion public.estado_renovacion_documento DEFAULT 'VIGENTE'::public.estado_renovacion_documento;

-- 5. Añadir columna opcional id_ticket en matricula para trazabilidad con soporte
ALTER TABLE public.matricula 
ADD COLUMN IF NOT EXISTS id_ticket INTEGER NULL REFERENCES public.tickets_soporte(id_ticket) ON DELETE SET NULL;

-- 6. Añadir columna opcional id_estudiante en tickets_soporte para vincular al alumno seleccionado por el acudiente
ALTER TABLE public.tickets_soporte 
ADD COLUMN IF NOT EXISTS id_estudiante INTEGER NULL REFERENCES public.estudiante(id_estudiante) ON DELETE SET NULL;
