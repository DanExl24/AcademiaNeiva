-- Migración 015: Añadir observaciones estructuradas y código de ticket Base36 a tickets_soporte
ALTER TABLE tickets_soporte ADD COLUMN observaciones TEXT DEFAULT '[]';
ALTER TABLE tickets_soporte ADD COLUMN codigo_ticket VARCHAR(50) UNIQUE;
