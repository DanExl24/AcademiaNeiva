-- Actualizar tickets antiguos que tengan estado = 'ESCALADO'
-- para que tengan fecha_escalado poblado con su fecha de creación,
-- y migrar su estado a 'EN_PROCESO' para que se visualicen correctamente en la nueva lógica de enums.
UPDATE public.tickets_soporte 
SET fecha_escalado = fecha_creacion, 
    estado = 'EN_PROCESO'::public.estado_ticket_soporte
WHERE estado = 'ESCALADO' AND fecha_escalado IS NULL;
