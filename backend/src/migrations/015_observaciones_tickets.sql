-- Migración 015: Añadir observaciones estructuradas y código de ticket Base36 a tickets_soporte
ALTER TABLE tickets_soporte ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '[]';
ALTER TABLE tickets_soporte ADD COLUMN IF NOT EXISTS codigo_ticket VARCHAR(50) UNIQUE;
