-- ============================================================================
-- MIGRACIÓN 005: Trigger para bloquear modificaciones en periodos cerrados
-- Fecha: 2026-06-23
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_bloquear_periodo_cerrado()
RETURNS TRIGGER AS $$
DECLARE
    v_id_periodo INTEGER;
    v_estado VARCHAR(20);
    v_fecha TIMESTAMP WITH TIME ZONE;
    v_id_colegio INTEGER;
    v_val INTEGER;
BEGIN
    -- Permitir bypass para scripts de seed
    IF current_setting('my.app.bypass_triggers', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Determinar el periodo según la tabla
    IF TG_TABLE_NAME = 'notas_actividad' THEN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            SELECT id_periodo INTO v_id_periodo 
            FROM actividad_materia 
            WHERE id_actividadmateria = NEW.id_actividadmateria;
        ELSIF TG_OP = 'DELETE' THEN
            SELECT id_periodo INTO v_id_periodo 
            FROM actividad_materia 
            WHERE id_actividadmateria = OLD.id_actividadmateria;
        END IF;

    ELSIF TG_TABLE_NAME = 'observacion_estudiante' THEN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            v_id_periodo := NEW.id_periodo;
        ELSIF TG_OP = 'DELETE' THEN
            v_id_periodo := OLD.id_periodo;
        END IF;

    ELSIF TG_TABLE_NAME = 'registro_asistencia' THEN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            v_fecha := NEW.fecha;
            v_id_colegio := NEW.id_colegio;
        ELSIF TG_OP = 'DELETE' THEN
            v_fecha := OLD.fecha;
            v_id_colegio := OLD.id_colegio;
        END IF;

        v_val := EXTRACT(MONTH FROM v_fecha) * 100 + EXTRACT(DAY FROM v_fecha);

        -- Encontrar el periodo que abarca esta fecha para el colegio
        SELECT pa.id_periodo INTO v_id_periodo
        FROM periodo_academico pa
        JOIN "año_lectivo" al ON pa.id_año = al.id_año
        WHERE pa.id_colegio = v_id_colegio
          AND (
            al.calendario = EXTRACT(YEAR FROM v_fecha)::text OR
            al.calendario LIKE '%' || EXTRACT(YEAR FROM v_fecha)::text || '%'
          )
          AND (
            -- Rango sin cruce de año
            (pa.mes_inicio * 100 + pa.dia_inicio <= pa.mes_fin * 100 + pa.dia_fin AND
             v_val BETWEEN (pa.mes_inicio * 100 + pa.dia_inicio) AND (pa.mes_fin * 100 + pa.dia_fin))
            OR
            -- Rango con cruce de año (ej. Calendario B Agosto a Junio)
            (pa.mes_inicio * 100 + pa.dia_inicio > pa.mes_fin * 100 + pa.dia_fin AND
             (v_val >= pa.mes_inicio * 100 + pa.dia_inicio OR v_val <= pa.mes_fin * 100 + pa.dia_fin))
          )
        LIMIT 1;
    END IF;

    -- Validar estado del periodo
    IF v_id_periodo IS NOT NULL THEN
        SELECT estado INTO v_estado FROM periodo_academico WHERE id_periodo = v_id_periodo;
        IF v_estado = 'CERRADO' THEN
            RAISE EXCEPTION 'Operación denegada: El periodo académico correspondiente está cerrado y no se permiten modificaciones.';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers
DROP TRIGGER IF EXISTS trg_bloquear_notas_periodo ON notas_actividad;
CREATE TRIGGER trg_bloquear_notas_periodo
BEFORE INSERT OR UPDATE OR DELETE ON notas_actividad
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_periodo_cerrado();

DROP TRIGGER IF EXISTS trg_bloquear_asistencia_periodo ON registro_asistencia;
CREATE TRIGGER trg_bloquear_asistencia_periodo
BEFORE INSERT OR UPDATE OR DELETE ON registro_asistencia
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_periodo_cerrado();

DROP TRIGGER IF EXISTS trg_bloquear_observacion_periodo ON observacion_estudiante;
CREATE TRIGGER trg_bloquear_observacion_periodo
BEFORE INSERT OR UPDATE OR DELETE ON observacion_estudiante
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_periodo_cerrado();

COMMIT;
