-- Migración 044: Eliminación definitiva de la columna legacy id_colegio de la tabla usuario
-- La vinculación institucional y de roles ahora se gestiona exclusivamente a través de usuario_colegio

ALTER TABLE public.usuario DROP COLUMN IF EXISTS id_colegio CASCADE;
