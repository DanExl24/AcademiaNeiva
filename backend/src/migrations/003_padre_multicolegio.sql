-- ============================================================================
-- MIGRACIÓN 003: Padre de Familia Multicolegio
-- Fecha: 2026-06-23
-- ============================================================================

BEGIN;

-- Hacer id_colegio opcional en padre_familia
ALTER TABLE padre_familia ALTER COLUMN id_colegio DROP NOT NULL;

-- Agregar índice para consultas rápidas en detalle_padrefamilia
CREATE INDEX IF NOT EXISTS idx_detalle_padrefamilia_padrefamilia ON detalle_padrefamilia(id_padrefamilia);

COMMIT;
