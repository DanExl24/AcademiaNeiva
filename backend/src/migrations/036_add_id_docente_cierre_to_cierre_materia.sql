-- Migración 036: Guardar qué docente realizó el cierre de la materia
ALTER TABLE public.cierre_materia
ADD COLUMN IF NOT EXISTS id_docente_cierre INTEGER REFERENCES public.docente(id_docente) ON DELETE SET NULL;
