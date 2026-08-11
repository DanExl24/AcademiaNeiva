-- Migración 043: Eliminación (DROP) de tablas, vistas y columnas obsoletas y sin uso confirmadas

-- 1. Eliminar tablas de configuración sin uso
DROP TABLE IF EXISTS public.configuracion_sistema CASCADE;
DROP TABLE IF EXISTS public.configuracion_base CASCADE;

-- 2. Eliminar tabla pivot sin uso entre DBA y dimensiones
DROP TABLE IF EXISTS public.dba_dimensiones_preescolar CASCADE;

-- 3. Eliminar campos y tabla de contrato docente sin uso en el sistema
ALTER TABLE public.docente DROP COLUMN IF EXISTS id_contratodocente CASCADE;
DROP TABLE IF EXISTS public.contrato_docente CASCADE;

-- 4. Eliminar columnas legacy y derivadas en colegio y estudiante
ALTER TABLE public.colegio DROP COLUMN IF EXISTS colores CASCADE;
ALTER TABLE public.estudiante DROP COLUMN IF EXISTS id_nivel CASCADE;

-- 5. Eliminar las 7 vistas SQL no utilizadas por el backend
DROP VIEW IF EXISTS public.vw_asistencia_estudiante CASCADE;
DROP VIEW IF EXISTS public.vw_desempeno_estudiante CASCADE;
DROP VIEW IF EXISTS public.vw_notas_enriquecidas CASCADE;
DROP VIEW IF EXISTS public.vw_observaciones_estudiante CASCADE;
DROP VIEW IF EXISTS public.vw_promedio_estudiante_periodo CASCADE;
DROP VIEW IF EXISTS public.vw_promedio_materia CASCADE;
DROP VIEW IF EXISTS public.vw_promedio_normalizado CASCADE;
