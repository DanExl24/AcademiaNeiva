-- Migración 035: Agregar id_docente_creador en actividad_materia para trazabilidad de autoría histórica
ALTER TABLE public.actividad_materia 
ADD COLUMN IF NOT EXISTS id_docente_creador INT REFERENCES public.docente(id_docente);

-- Llenar retroactivamente id_docente_creador desde el detalle_grados asociado si es NULL
UPDATE public.actividad_materia am
SET id_docente_creador = dg.id_docente
FROM public.detalle_grados dg
WHERE am.id_detallegrado = dg.id_detallegrado
  AND am.id_docente_creador IS NULL;
