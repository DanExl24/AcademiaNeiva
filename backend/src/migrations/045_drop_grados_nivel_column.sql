-- Migración 045: Eliminación de la columna legacy nivel en la tabla grados
-- El nivel escolar se gestiona centralizadamente mediante la tabla relacional nivel_escolar

ALTER TABLE public.grados DROP COLUMN IF EXISTS nivel CASCADE;
