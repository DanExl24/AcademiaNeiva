-- Add motivo_estado column to student table to document reasons for sanctions/expulsions
ALTER TABLE public.estudiante ADD COLUMN IF NOT EXISTS motivo_estado text;
