-- Migración 051: Asegurar columnas de rango de fechas (fecha_inicio y fecha_fin) en anio_lectivo
ALTER TABLE public.anio_lectivo ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE public.anio_lectivo ADD COLUMN IF NOT EXISTS fecha_fin DATE;
