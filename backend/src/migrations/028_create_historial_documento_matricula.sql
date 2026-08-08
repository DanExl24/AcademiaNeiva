-- Migration 028: Limpieza de tabla redundante. El versionamiento se maneja directamente en public.documento_matriculas
DROP TABLE IF EXISTS public.historial_documento_matricula CASCADE;
