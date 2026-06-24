-- ============================================================================
-- MIGRACIÓN 007: Catálogo Global de Derechos Básicos de Aprendizaje (DBA)
-- Fecha: 2026-06-24
-- Descripción: Agrega las tablas para el catálogo oficial de DBA, sus evidencias
--              y el mapeo de versión curricular por colegio.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: CREAR ENUM DE ESTADO
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE estado_dba AS ENUM (
        'ACTIVO',
        'INACTIVO'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- PASO 2: CREAR TABLA "dba" (Catálogo Oficial de DBA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dba (
    id_dba SERIAL PRIMARY KEY,
    area VARCHAR(100) NOT NULL,
    grado VARCHAR(50) NOT NULL,
    numero_dba INTEGER NOT NULL,
    enunciado TEXT NOT NULL,
    version_curricular VARCHAR(20) NOT NULL,
    estado estado_dba NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dba_area_grado_num_version UNIQUE (area, grado, numero_dba, version_curricular)
);

-- ============================================================================
-- PASO 3: CREAR TABLA "evidencias_dba" (Evidencias de Aprendizaje oficiales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS evidencias_dba (
    id_evidencia_dba SERIAL PRIMARY KEY,
    id_dba INTEGER NOT NULL REFERENCES dba(id_dba) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 1,
    estado estado_dba NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PASO 4: CREAR TABLA "colegio_version_curricular" (Mapeo de versión por colegio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS colegio_version_curricular (
    id SERIAL PRIMARY KEY,
    id_colegio INTEGER NOT NULL REFERENCES colegio(id_colegio) ON DELETE CASCADE,
    area VARCHAR(100) NOT NULL,
    grado VARCHAR(50) NOT NULL,
    version_curricular VARCHAR(20) NOT NULL,
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_colegio_area_grado UNIQUE (id_colegio, area, grado)
);

-- ============================================================================
-- PASO 5: CREAR ÍNDICES DE RENDIMIENTO
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_dba_area_grado ON dba (area, grado);
CREATE INDEX IF NOT EXISTS idx_dba_version ON dba (version_curricular);
CREATE INDEX IF NOT EXISTS idx_dba_estado ON dba (estado) WHERE estado = 'ACTIVO';
CREATE INDEX IF NOT EXISTS idx_evidencias_dba_dba ON evidencias_dba (id_dba);
CREATE INDEX IF NOT EXISTS idx_colegio_version_colegio ON colegio_version_curricular (id_colegio);

COMMIT;
