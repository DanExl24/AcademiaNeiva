-- ============================================================================
-- MIGRACIÓN 006: Agregar motivo_revocacion a auditoria_supervision
-- Fecha: 2026-06-23
-- ============================================================================

BEGIN;

ALTER TABLE auditoria_supervision ADD COLUMN IF NOT EXISTS motivo_revocacion text;

COMMIT;
