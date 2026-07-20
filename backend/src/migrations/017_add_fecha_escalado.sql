-- Agregar columna fecha_escalado a la tabla tickets_soporte
ALTER TABLE public.tickets_soporte 
    ADD COLUMN IF NOT EXISTS fecha_escalado timestamp with time zone NULL;
