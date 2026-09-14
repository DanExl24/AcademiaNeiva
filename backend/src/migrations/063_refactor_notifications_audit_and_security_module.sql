-- 063_refactor_notifications_audit_and_security_module.sql
-- Saneamiento, integridad y optimización del Módulo 10: Notificaciones, Auditoría y Seguridad Transversal
-- 1. Eliminar tabla muerta notificaciones (0 filas, sin uso en backend; las notificaciones activas viven en notificacion_supervision y notificacion_colegio)
-- 2. Asegurar clave foránea en password_reset_tokens(id_usuario) hacia usuario(id_usuario) ON DELETE CASCADE
-- 3. Blindar unicidad en catálogo tipo_documento(tipo)
-- 4. Asegurar clave foránea en auditoria_supervision(id_admin_general) hacia usuario(id_usuario) ON DELETE CASCADE
-- 5. Asegurar clave foránea en tickets_soporte(id_usuario) hacia usuario(id_usuario) ON DELETE SET NULL

BEGIN;

-- 1. Eliminar tabla obsoleta no utilizada
DROP TABLE IF EXISTS public.notificaciones CASCADE;

-- 2. Clave foránea en password_reset_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_password_reset_tokens_usuario'
  ) THEN
    ALTER TABLE public.password_reset_tokens 
    ADD CONSTRAINT fk_password_reset_tokens_usuario 
    FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Restricción UNIQUE en tipo_documento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_tipo_documento_tipo'
  ) THEN
    ALTER TABLE public.tipo_documento 
    ADD CONSTRAINT uq_tipo_documento_tipo UNIQUE (tipo);
  END IF;
END $$;

-- 4. Clave foránea en auditoria_supervision
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auditoria_supervision_admin'
  ) THEN
    ALTER TABLE public.auditoria_supervision 
    ADD CONSTRAINT fk_auditoria_supervision_admin 
    FOREIGN KEY (id_admin_general) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Clave foránea en tickets_soporte
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_soporte_usuario'
  ) THEN
    ALTER TABLE public.tickets_soporte 
    ADD CONSTRAINT fk_tickets_soporte_usuario 
    FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
