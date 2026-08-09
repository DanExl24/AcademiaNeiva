-- Migración 037: Trigger para prevenir escrituras en tablas académicas cuando la materia está cerrada
CREATE OR REPLACE FUNCTION public.trg_check_subject_not_closed()
RETURNS TRIGGER AS $$
DECLARE
    v_id_detallegrado INTEGER;
    v_id_periodo INTEGER;
    v_is_closed BOOLEAN;
BEGIN
    IF TG_TABLE_NAME = 'actividad_materia' THEN
        IF TG_OP = 'DELETE' THEN
            v_id_detallegrado := OLD.id_detallegrado;
            v_id_periodo := OLD.id_periodo;
        ELSE
            v_id_detallegrado := NEW.id_detallegrado;
            v_id_periodo := NEW.id_periodo;
        END IF;
    ELSIF TG_TABLE_NAME = 'notas_actividad' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT id_detallegrado, id_periodo INTO v_id_detallegrado, v_id_periodo
            FROM public.actividad_materia WHERE id_actividadmateria = OLD.id_actividadmateria;
        ELSE
            SELECT id_detallegrado, id_periodo INTO v_id_detallegrado, v_id_periodo
            FROM public.actividad_materia WHERE id_actividadmateria = NEW.id_actividadmateria;
        END IF;
    ELSIF TG_TABLE_NAME = 'criterio_evaluacion' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT id_detallegrado, id_periodo INTO v_id_detallegrado, v_id_periodo
            FROM public.actividad_materia WHERE id_actividadmateria = OLD.id_actividadmateria;
        ELSE
            SELECT id_detallegrado, id_periodo INTO v_id_detallegrado, v_id_periodo
            FROM public.actividad_materia WHERE id_actividadmateria = NEW.id_actividadmateria;
        END IF;
    ELSIF TG_TABLE_NAME = 'nota_criterio' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT am.id_detallegrado, am.id_periodo INTO v_id_detallegrado, v_id_periodo
            FROM public.criterio_evaluacion ce
            JOIN public.actividad_materia am ON ce.id_actividadmateria = am.id_actividadmateria
            WHERE ce.id_criterio = OLD.id_criterio;
        ELSE
            SELECT am.id_detallegrado, am.id_periodo INTO v_id_detallegrado, v_id_periodo
            FROM public.criterio_evaluacion ce
            JOIN public.actividad_materia am ON ce.id_actividadmateria = am.id_actividadmateria
            WHERE ce.id_criterio = NEW.id_criterio;
        END IF;
    ELSIF TG_TABLE_NAME = 'registro_asistencia' THEN
        IF TG_OP = 'DELETE' THEN
            v_id_detallegrado := OLD.id_detallegrado;
            v_id_periodo := OLD.id_periodo;
        ELSE
            v_id_detallegrado := NEW.id_detallegrado;
            v_id_periodo := NEW.id_periodo;
        END IF;
    ELSIF TG_TABLE_NAME = 'observacion_estudiante' THEN
        IF TG_OP = 'DELETE' THEN
            v_id_detallegrado := OLD.id_detallegrado;
            v_id_periodo := OLD.id_periodo;
        ELSE
            v_id_detallegrado := NEW.id_detallegrado;
            v_id_periodo := NEW.id_periodo;
        END IF;
    END IF;

    IF v_id_detallegrado IS NOT NULL AND v_id_periodo IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.cierre_materia
            WHERE id_detallegrado = v_id_detallegrado
              AND id_periodo = v_id_periodo
              AND estado = 'CERRADO'
        ) INTO v_is_closed;

        IF v_is_closed THEN
            RAISE EXCEPTION 'La materia se encuentra CERRADA para este periodo y no admite modificaciones.'
                USING ERRCODE = '55000';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_closed_actividad_materia ON public.actividad_materia;
CREATE TRIGGER trg_prevent_closed_actividad_materia
BEFORE INSERT OR UPDATE OR DELETE ON public.actividad_materia
FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();

DROP TRIGGER IF EXISTS trg_prevent_closed_notas_actividad ON public.notas_actividad;
CREATE TRIGGER trg_prevent_closed_notas_actividad
BEFORE INSERT OR UPDATE OR DELETE ON public.notas_actividad
FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();

DROP TRIGGER IF EXISTS trg_prevent_closed_criterio_evaluacion ON public.criterio_evaluacion;
CREATE TRIGGER trg_prevent_closed_criterio_evaluacion
BEFORE INSERT OR UPDATE OR DELETE ON public.criterio_evaluacion
FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();

DROP TRIGGER IF EXISTS trg_prevent_closed_nota_criterio ON public.nota_criterio;
CREATE TRIGGER trg_prevent_closed_nota_criterio
BEFORE INSERT OR UPDATE OR DELETE ON public.nota_criterio
FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();

DROP TRIGGER IF EXISTS trg_prevent_closed_registro_asistencia ON public.registro_asistencia;
CREATE TRIGGER trg_prevent_closed_registro_asistencia
BEFORE INSERT OR UPDATE OR DELETE ON public.registro_asistencia
FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();

DROP TRIGGER IF EXISTS trg_prevent_closed_observacion_estudiante ON public.observacion_estudiante;
CREATE TRIGGER trg_prevent_closed_observacion_estudiante
BEFORE INSERT OR UPDATE OR DELETE ON public.observacion_estudiante
FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();
