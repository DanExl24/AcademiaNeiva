--
-- PostgreSQL database dump
--

\restrict zDX5x9zZracLWS7JnKfnftXBRIEg1ceSFPgl0FKAcvCNjDhKc7qOMC3hre0k8f0

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: accion_aprobacion_traslado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.accion_aprobacion_traslado AS ENUM (
    'APROBAR',
    'RECHAZAR',
    'CANCELAR'
);


ALTER TYPE public.accion_aprobacion_traslado OWNER TO postgres;

--
-- Name: decision_promocion_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.decision_promocion_tipo AS ENUM (
    'PROMOVER_SIGUIENTE_GRADO',
    'MANTENER_GRADO',
    'MATRICULA_CONDICIONADA',
    'OTRA_DECISION'
);


ALTER TYPE public.decision_promocion_tipo OWNER TO postgres;

--
-- Name: estado_asistencia; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_asistencia AS ENUM (
    'PRESENTE',
    'AUSENTE',
    'TARDE',
    'JUSTIFICADA'
);


ALTER TYPE public.estado_asistencia OWNER TO postgres;

--
-- Name: estado_cierre_materia; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_cierre_materia AS ENUM (
    'ABIERTO',
    'CERRADO'
);


ALTER TYPE public.estado_cierre_materia OWNER TO postgres;

--
-- Name: estado_colegio; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_colegio AS ENUM (
    'PENDIENTE',
    'ACTIVO',
    'SUSPENDIDO',
    'RECHAZADO',
    'ELIMINADO'
);


ALTER TYPE public.estado_colegio OWNER TO postgres;

--
-- Name: estado_dba; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_dba AS ENUM (
    'ACTIVO',
    'INACTIVO'
);


ALTER TYPE public.estado_dba OWNER TO postgres;

--
-- Name: estado_documento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_documento AS ENUM (
    'PENDIENTE',
    'VALIDADO',
    'RECHAZADO'
);


ALTER TYPE public.estado_documento OWNER TO postgres;

--
-- Name: estado_estudiante; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_estudiante AS ENUM (
    'ACTIVO',
    'SANCIONADO',
    'EXPULSADO',
    'RETIRADO',
    'GRADUADO'
);


ALTER TYPE public.estado_estudiante OWNER TO postgres;

--
-- Name: estado_matricula; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_matricula AS ENUM (
    'PENDIENTE',
    'ACTIVA',
    'CANCELADA',
    'TRASLADADA',
    'RECHAZADA',
    'CORRECCION',
    'APROBADA',
    'CULMINADA',
    'PENDIENTE_RENOVACION',
    'CORREGIDA'
);


ALTER TYPE public.estado_matricula OWNER TO postgres;

--
-- Name: estado_periodo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_periodo AS ENUM (
    'ABIERTO',
    'CERRADO',
    'PENDIENTE'
);


ALTER TYPE public.estado_periodo OWNER TO postgres;

--
-- Name: estado_renovacion_documento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_renovacion_documento AS ENUM (
    'VIGENTE',
    'RECOMENDADO_ACTUALIZAR',
    'OBLIGATORIO_ACTUALIZAR',
    'DESACTUALIZADO_POR_FECHA'
);


ALTER TYPE public.estado_renovacion_documento OWNER TO postgres;

--
-- Name: estado_resultado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_resultado AS ENUM (
    'APROBADO',
    'REPROBADO',
    'EN_PROCESO'
);


ALTER TYPE public.estado_resultado OWNER TO postgres;

--
-- Name: estado_sancion; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_sancion AS ENUM (
    'ACTIVA',
    'REVOCADA',
    'VENCIDA'
);


ALTER TYPE public.estado_sancion OWNER TO postgres;

--
-- Name: estado_solicitud_traslado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_solicitud_traslado AS ENUM (
    'SOLICITADA',
    'EN_APROBACION',
    'APROBADA',
    'RECHAZADA',
    'CANCELADA',
    'EJECUTADA'
);


ALTER TYPE public.estado_solicitud_traslado OWNER TO postgres;

--
-- Name: estado_supervision; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_supervision AS ENUM (
    'SOLICITADA',
    'APROBADA',
    'ACTIVA',
    'FINALIZADA',
    'REVOCADA',
    'EXPIRADA'
);


ALTER TYPE public.estado_supervision OWNER TO postgres;

--
-- Name: estado_ticket_soporte; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_ticket_soporte AS ENUM (
    'ABIERTO',
    'EN_PROCESO',
    'RESUELTO',
    'ESCALADO'
);


ALTER TYPE public.estado_ticket_soporte OWNER TO postgres;

--
-- Name: estado_usuario_sistema; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_usuario_sistema AS ENUM (
    'ACTIVO',
    'SUSPENDIDO',
    'BANEADO',
    'ELIMINADO'
);


ALTER TYPE public.estado_usuario_sistema OWNER TO postgres;

--
-- Name: resultado_consolidado_anual; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.resultado_consolidado_anual AS ENUM (
    'APROBADO',
    'NO_PROMOVIDO',
    'PENDIENTE_RECUPERACION',
    'PENDIENTE_DECISION'
);


ALTER TYPE public.resultado_consolidado_anual OWNER TO postgres;

--
-- Name: tipo_accion_auditoria; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_accion_auditoria AS ENUM (
    'LECTURA',
    'CREACION',
    'MODIFICACION',
    'ELIMINACION',
    'EXPORTACION'
);


ALTER TYPE public.tipo_accion_auditoria OWNER TO postgres;

--
-- Name: tipo_documento_identidad; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_documento_identidad AS ENUM (
    'TI',
    'CC',
    'CE',
    'RC',
    'PAS'
);


ALTER TYPE public.tipo_documento_identidad OWNER TO postgres;

--
-- Name: tipo_incidencia_soporte; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_incidencia_soporte AS ENUM (
    'TECNICO',
    'CALIFICACIONES',
    'ASISTENCIA',
    'AUTENTICACION',
    'SOPORTE',
    'REINGRESO',
    'MATRICULA_EXTRAORDINARIA'
);


ALTER TYPE public.tipo_incidencia_soporte OWNER TO postgres;

--
-- Name: tipo_jornada; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_jornada AS ENUM (
    'MAÑANA',
    'TARDE',
    'NOCTURNA',
    'UNICA'
);


ALTER TYPE public.tipo_jornada OWNER TO postgres;

--
-- Name: tipo_matricula; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_matricula AS ENUM (
    'REGULAR',
    'RENOVACION',
    'REINGRESO',
    'EXTRAORDINARIA',
    'TRASLADO'
);


ALTER TYPE public.tipo_matricula OWNER TO postgres;

--
-- Name: tipo_observacion; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_observacion AS ENUM (
    'ACADEMICA',
    'CONVIVENCIA',
    'OTRO',
    'DISCIPLINARIA'
);


ALTER TYPE public.tipo_observacion OWNER TO postgres;

--
-- Name: tipo_supervision; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_supervision AS ENUM (
    'SOLO_LECTURA',
    'EDITOR'
);


ALTER TYPE public.tipo_supervision OWNER TO postgres;

--
-- Name: tipo_traslado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_traslado AS ENUM (
    'TRASLADO_USUARIO',
    'TRASLADO_MATRICULA'
);


ALTER TYPE public.tipo_traslado OWNER TO postgres;

--
-- Name: fn_bloquear_periodo_cerrado(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_bloquear_periodo_cerrado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
        JOIN anio_lectivo al ON pa.id_anio = al.id_anio
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
$$;


ALTER FUNCTION public.fn_bloquear_periodo_cerrado() OWNER TO postgres;

--
-- Name: fn_sync_estudiante_sancion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_sync_estudiante_sancion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tipo character varying(100);
BEGIN
    SELECT nombre INTO v_tipo FROM public.tipo_sancion WHERE id_tipo_sancion = NEW.id_tipo_sancion;

    -- Si la sanción está activa y vigente
    IF NEW.estado = 'ACTIVA' AND CURRENT_DATE BETWEEN NEW.fecha_inicio AND NEW.fecha_fin THEN
        IF v_tipo = 'EXPULSION' THEN
            UPDATE public.estudiante
            SET estado = 'EXPULSADO'
            WHERE id_estudiante = NEW.id_estudiante;
        ELSE
            UPDATE public.estudiante
            SET estado = 'SANCIONADO'
            WHERE id_estudiante = NEW.id_estudiante;
        END IF;
    ELSE
        -- Si no está activa, verificar si le queda alguna otra sanción activa hoy
        IF NOT EXISTS (
            SELECT 1 FROM public.sancion
            WHERE id_estudiante = NEW.id_estudiante
              AND estado = 'ACTIVA'
              AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin
        ) THEN
            -- Si no quedan otras sanciones activas, volver a ACTIVO
            UPDATE public.estudiante
            SET estado = 'ACTIVO'
            WHERE id_estudiante = NEW.id_estudiante AND estado IN ('SANCIONADO', 'EXPULSADO');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_sync_estudiante_sancion() OWNER TO postgres;

--
-- Name: proteger_acciones_auditoria(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.proteger_acciones_auditoria() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estado estado_supervision;
BEGIN
    -- Obtener el estado de la auditoría padre
    SELECT estado_supervision INTO v_estado
    FROM auditoria_supervision
    WHERE id_auditoria = COALESCE(OLD.id_auditoria, NEW.id_auditoria);

    IF v_estado IN ('FINALIZADA', 'REVOCADA', 'EXPIRADA') THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'No se pueden eliminar acciones de una auditoría finalizada';
        END IF;
        IF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION 'No se pueden modificar acciones de una auditoría finalizada';
        END IF;
    END IF;

    -- Bloquear DELETE siempre (las acciones de auditoría nunca se eliminan)
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los registros de acciones de auditoría no pueden ser eliminados';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.proteger_acciones_auditoria() OWNER TO postgres;

--
-- Name: proteger_auditoria_finalizada(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.proteger_auditoria_finalizada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Bloquear DELETE siempre (soft-delete únicamente)
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los registros de auditoría no pueden ser eliminados. Use soft-delete.';
    END IF;

    -- Bloquear UPDATE si la auditoría ya fue finalizada/revocada/expirada
    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado_supervision IN ('FINALIZADA', 'REVOCADA', 'EXPIRADA') THEN
            -- Permitir solo actualizar el campo "eliminado" para soft-delete
            IF NEW.eliminado IS DISTINCT FROM OLD.eliminado AND
               NEW.id_auditoria = OLD.id_auditoria AND
               NEW.estado_supervision = OLD.estado_supervision THEN
                RETURN NEW;
            END IF;
            RAISE EXCEPTION 'No se puede modificar una auditoría en estado %', OLD.estado_supervision;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.proteger_auditoria_finalizada() OWNER TO postgres;

--
-- Name: trg_check_subject_not_closed(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_check_subject_not_closed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_detallegrado INTEGER;
    v_id_periodo INTEGER;
    v_is_closed BOOLEAN;
BEGIN
    IF current_setting('my.app.bypass_triggers', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;
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
            v_id_periodo := NULL;
        ELSE
            v_id_detallegrado := NEW.id_detallegrado;
            v_id_periodo := NULL;
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
$$;


ALTER FUNCTION public.trg_check_subject_not_closed() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actividad_evidencia_dba; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actividad_evidencia_dba (
    id_actividadmateria integer NOT NULL,
    id_evidencia_dba integer NOT NULL
);


ALTER TABLE public.actividad_evidencia_dba OWNER TO postgres;

--
-- Name: actividad_materia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actividad_materia (
    id_actividadmateria integer NOT NULL,
    id_detallegrado integer,
    id_periodo integer,
    nombre character varying(255) NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    id_colegio integer NOT NULL,
    id_competencia integer,
    id_evidencia integer,
    fecha_creacion timestamp with time zone DEFAULT now(),
    motivo_extra character varying(100) DEFAULT NULL::character varying,
    justificacion_extra text,
    id_docente_creador integer
);


ALTER TABLE public.actividad_materia OWNER TO postgres;

--
-- Name: actividad_materia_id_actividadmateria_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.actividad_materia_id_actividadmateria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.actividad_materia_id_actividadmateria_seq OWNER TO postgres;

--
-- Name: actividad_materia_id_actividadmateria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.actividad_materia_id_actividadmateria_seq OWNED BY public.actividad_materia.id_actividadmateria;


--
-- Name: anio_lectivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anio_lectivo (
    id_anio integer CONSTRAINT "año_lectivo_id_año_not_null" NOT NULL,
    calendario character varying(10),
    id_colegio integer CONSTRAINT "año_lectivo_id_colegio_not_null" NOT NULL,
    tipo_calendario character(1) DEFAULT 'A'::bpchar,
    estado public.estado_periodo DEFAULT 'ABIERTO'::public.estado_periodo,
    fecha_inicio date,
    fecha_fin date,
    CONSTRAINT chk_calendario CHECK (((calendario)::text ~ '^[0-9]{4}(-[0-9]{4})?$'::text))
);


ALTER TABLE public.anio_lectivo OWNER TO postgres;

--
-- Name: anio_lectivo_id_anio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.anio_lectivo_id_anio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.anio_lectivo_id_anio_seq OWNER TO postgres;

--
-- Name: anio_lectivo_id_anio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anio_lectivo_id_anio_seq OWNED BY public.anio_lectivo.id_anio;


--
-- Name: auditoria_acciones_realizadas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_acciones_realizadas (
    id_accion integer NOT NULL,
    id_auditoria integer NOT NULL,
    fecha_accion timestamp with time zone DEFAULT now() NOT NULL,
    modulo character varying(255) NOT NULL,
    tipo_accion public.tipo_accion_auditoria NOT NULL,
    accion character varying(255) NOT NULL,
    recurso_afectado text NOT NULL,
    id_usuario_afectado integer,
    valor_antiguo jsonb,
    valor_nuevo jsonb,
    motivo_cambio text,
    CONSTRAINT chk_modificacion_completa CHECK (((tipo_accion <> 'MODIFICACION'::public.tipo_accion_auditoria) OR ((valor_antiguo IS NOT NULL) AND (valor_nuevo IS NOT NULL) AND (motivo_cambio IS NOT NULL))))
);


ALTER TABLE public.auditoria_acciones_realizadas OWNER TO postgres;

--
-- Name: auditoria_acciones_realizadas_id_accion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_acciones_realizadas ALTER COLUMN id_accion ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auditoria_acciones_realizadas_id_accion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auditoria_supervision; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_supervision (
    id_auditoria integer NOT NULL,
    id_admin_general integer NOT NULL,
    id_colegio integer NOT NULL,
    id_directivo_aprobador integer,
    motivo_solicitud text NOT NULL,
    fecha_solicitud timestamp with time zone DEFAULT now() NOT NULL,
    tipo_supervision public.tipo_supervision NOT NULL,
    estado_supervision public.estado_supervision DEFAULT 'SOLICITADA'::public.estado_supervision NOT NULL,
    fecha_aprobacion timestamp with time zone,
    motivo_entrada text,
    fecha_entrada timestamp with time zone,
    fecha_salida timestamp with time zone,
    duracion_maxima_minutos integer DEFAULT 60 NOT NULL,
    revocado_por integer,
    fecha_revocacion timestamp with time zone,
    ip_admin character varying(45),
    eliminado boolean DEFAULT false NOT NULL,
    fecha_retencion_hasta timestamp with time zone DEFAULT (now() + '5 years'::interval) NOT NULL,
    motivo_revocacion text
);


ALTER TABLE public.auditoria_supervision OWNER TO postgres;

--
-- Name: auditoria_supervision_id_auditoria_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_supervision ALTER COLUMN id_auditoria ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auditoria_supervision_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cierre_materia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cierre_materia (
    id_cierremateria integer NOT NULL,
    id_detallegrado integer NOT NULL,
    id_periodo integer NOT NULL,
    estado public.estado_cierre_materia NOT NULL,
    fecha_cierre timestamp with time zone NOT NULL,
    justificacion_evidencias_pendientes text,
    id_docente_cierre integer
);


ALTER TABLE public.cierre_materia OWNER TO postgres;

--
-- Name: cierre_materia_id_cierremateria_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cierre_materia_id_cierremateria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cierre_materia_id_cierremateria_seq OWNER TO postgres;

--
-- Name: cierre_materia_id_cierremateria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cierre_materia_id_cierremateria_seq OWNED BY public.cierre_materia.id_cierremateria;


--
-- Name: colegio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.colegio (
    id_colegio integer NOT NULL,
    nombre text NOT NULL,
    tipo_colegio character varying(20) NOT NULL,
    sede character varying(255) NOT NULL,
    contacto numeric NOT NULL,
    correo character varying(100) NOT NULL,
    dane character varying(100) NOT NULL,
    tipo_calendario character(1) DEFAULT 'A'::bpchar,
    estado public.estado_colegio DEFAULT 'ACTIVO'::public.estado_colegio NOT NULL,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    motivo_rechazo text,
    fecha_cambio_estado timestamp with time zone,
    escudo_url text,
    colores character varying(255),
    color_primario character varying(50) DEFAULT NULL::character varying,
    color_secundario character varying(50) DEFAULT NULL::character varying
);


ALTER TABLE public.colegio OWNER TO postgres;

--
-- Name: colegio_id_colegio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.colegio_id_colegio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.colegio_id_colegio_seq OWNER TO postgres;

--
-- Name: colegio_id_colegio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.colegio_id_colegio_seq OWNED BY public.colegio.id_colegio;


--
-- Name: colegio_version_curricular; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.colegio_version_curricular (
    id integer NOT NULL,
    id_colegio integer NOT NULL,
    area character varying(100) NOT NULL,
    grado character varying(50) NOT NULL,
    version_curricular character varying(20) NOT NULL,
    fecha_asignacion timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.colegio_version_curricular OWNER TO postgres;

--
-- Name: colegio_version_curricular_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.colegio_version_curricular_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.colegio_version_curricular_id_seq OWNER TO postgres;

--
-- Name: colegio_version_curricular_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.colegio_version_curricular_id_seq OWNED BY public.colegio_version_curricular.id;


--
-- Name: competencias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competencias (
    id_competencia integer NOT NULL,
    id_anio integer CONSTRAINT "competencias_id_año_not_null" NOT NULL,
    id_grupo integer NOT NULL,
    id_materia integer NOT NULL,
    id_periodo integer NOT NULL,
    descripcion text DEFAULT 'Competencia pendiente por definir.'::text NOT NULL,
    id_colegio integer NOT NULL,
    nombre character varying(200),
    sync_uuid uuid,
    id_dimension integer
);


ALTER TABLE public.competencias OWNER TO postgres;

--
-- Name: competencias_id_competencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competencias_id_competencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competencias_id_competencia_seq OWNER TO postgres;

--
-- Name: competencias_id_competencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competencias_id_competencia_seq OWNED BY public.competencias.id_competencia;


--
-- Name: configuracion_base; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_base (
    id_config_base integer NOT NULL,
    clave character varying(100) NOT NULL,
    descripcion text,
    valor_default character varying(255) NOT NULL,
    tipo character varying(20) NOT NULL
);


ALTER TABLE public.configuracion_base OWNER TO postgres;

--
-- Name: configuracion_base_id_config_base_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracion_base_id_config_base_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_base_id_config_base_seq OWNER TO postgres;

--
-- Name: configuracion_base_id_config_base_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracion_base_id_config_base_seq OWNED BY public.configuracion_base.id_config_base;


--
-- Name: configuracion_colegio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_colegio (
    id_colegio integer NOT NULL,
    nota_minima numeric(5,2) DEFAULT 0 NOT NULL,
    nota_maxima numeric(5,2) DEFAULT 5 NOT NULL,
    nota_aprobacion numeric(5,2) DEFAULT 3 NOT NULL,
    escala_modo character varying(20) DEFAULT 'AUTOMATICO'::character varying NOT NULL
);


ALTER TABLE public.configuracion_colegio OWNER TO postgres;

--
-- Name: configuracion_inscripcion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_inscripcion (
    id_configuracion integer NOT NULL,
    id_colegio integer NOT NULL,
    id_anio integer CONSTRAINT "configuracion_inscripcion_id_año_not_null" NOT NULL,
    fecha_inicio timestamp with time zone NOT NULL,
    fecha_cierre timestamp with time zone NOT NULL,
    habilitada boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_fechas CHECK ((fecha_cierre > fecha_inicio))
);


ALTER TABLE public.configuracion_inscripcion OWNER TO postgres;

--
-- Name: configuracion_inscripcion_id_configuracion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracion_inscripcion_id_configuracion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_inscripcion_id_configuracion_seq OWNER TO postgres;

--
-- Name: configuracion_inscripcion_id_configuracion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracion_inscripcion_id_configuracion_seq OWNED BY public.configuracion_inscripcion.id_configuracion;


--
-- Name: configuracion_plataforma; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_plataforma (
    clave character varying(100) NOT NULL,
    valor character varying(255) NOT NULL,
    descripcion text,
    actualizado_por integer,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.configuracion_plataforma OWNER TO postgres;

--
-- Name: configuracion_sistema; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_sistema (
    id_configuracion integer NOT NULL,
    id_colegio integer NOT NULL,
    clave character varying(100) NOT NULL,
    valor character varying(255) NOT NULL,
    id_config_base integer
);


ALTER TABLE public.configuracion_sistema OWNER TO postgres;

--
-- Name: configuracion_sistema_id_configuracion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracion_sistema_id_configuracion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_sistema_id_configuracion_seq OWNER TO postgres;

--
-- Name: configuracion_sistema_id_configuracion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracion_sistema_id_configuracion_seq OWNED BY public.configuracion_sistema.id_configuracion;


--
-- Name: contrato_docente; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contrato_docente (
    id_contratodocente integer NOT NULL,
    estado character varying(50) NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.contrato_docente OWNER TO postgres;

--
-- Name: contrato_docente_id_contratodocente_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contrato_docente_id_contratodocente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contrato_docente_id_contratodocente_seq OWNER TO postgres;

--
-- Name: contrato_docente_id_contratodocente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contrato_docente_id_contratodocente_seq OWNED BY public.contrato_docente.id_contratodocente;


--
-- Name: criterio_evaluacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.criterio_evaluacion (
    id_criterio integer NOT NULL,
    id_actividadmateria integer NOT NULL,
    id_evidencia integer,
    descripcion text NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.criterio_evaluacion OWNER TO postgres;

--
-- Name: criterio_evaluacion_id_criterio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.criterio_evaluacion_id_criterio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.criterio_evaluacion_id_criterio_seq OWNER TO postgres;

--
-- Name: criterio_evaluacion_id_criterio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.criterio_evaluacion_id_criterio_seq OWNED BY public.criterio_evaluacion.id_criterio;


--
-- Name: dba; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dba (
    id_dba integer NOT NULL,
    area character varying(100) NOT NULL,
    grado character varying(50) NOT NULL,
    numero_dba integer NOT NULL,
    enunciado text NOT NULL,
    version_curricular character varying(20) NOT NULL,
    estado public.estado_dba DEFAULT 'ACTIVO'::public.estado_dba NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dba OWNER TO postgres;

--
-- Name: dba_dimensiones_preescolar; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dba_dimensiones_preescolar (
    id_dba integer NOT NULL,
    id_dimension integer NOT NULL
);


ALTER TABLE public.dba_dimensiones_preescolar OWNER TO postgres;

--
-- Name: dba_id_dba_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dba_id_dba_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dba_id_dba_seq OWNER TO postgres;

--
-- Name: dba_id_dba_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dba_id_dba_seq OWNED BY public.dba.id_dba;


--
-- Name: decision_promocion_directivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.decision_promocion_directivo (
    id_decision integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_colegio integer NOT NULL,
    id_anio_anterior integer NOT NULL,
    resultado_calculado public.resultado_consolidado_anual NOT NULL,
    decision_tomada public.decision_promocion_tipo NOT NULL,
    id_grado_anterior integer,
    id_grado_asignado integer,
    id_usuario_decision integer NOT NULL,
    fecha_decision timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    observacion text
);


ALTER TABLE public.decision_promocion_directivo OWNER TO postgres;

--
-- Name: decision_promocion_directivo_id_decision_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.decision_promocion_directivo_id_decision_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.decision_promocion_directivo_id_decision_seq OWNER TO postgres;

--
-- Name: decision_promocion_directivo_id_decision_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.decision_promocion_directivo_id_decision_seq OWNED BY public.decision_promocion_directivo.id_decision;


--
-- Name: desempeno; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.desempeno (
    id_desempeno integer NOT NULL,
    descripcion text NOT NULL,
    id_actividadmateria integer NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.desempeno OWNER TO postgres;

--
-- Name: desempeno_id_desempeno_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.desempeno_id_desempeno_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.desempeno_id_desempeno_seq OWNER TO postgres;

--
-- Name: desempeno_id_desempeno_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.desempeno_id_desempeno_seq OWNED BY public.desempeno.id_desempeno;


--
-- Name: detalle_grados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.detalle_grados (
    id_detallegrado integer NOT NULL,
    id_materia integer NOT NULL,
    id_docente integer NOT NULL,
    id_colegio integer NOT NULL,
    id_grupo integer,
    id_anio integer NOT NULL
);


ALTER TABLE public.detalle_grados OWNER TO postgres;

--
-- Name: detalle_grados_id_detallegrado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.detalle_grados_id_detallegrado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detalle_grados_id_detallegrado_seq OWNER TO postgres;

--
-- Name: detalle_grados_id_detallegrado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.detalle_grados_id_detallegrado_seq OWNED BY public.detalle_grados.id_detallegrado;


--
-- Name: detalle_padrefamilia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.detalle_padrefamilia (
    id_detallepadrefamilia integer NOT NULL,
    id_padrefamilia integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.detalle_padrefamilia OWNER TO postgres;

--
-- Name: detalle_padrefamilia_id_detallepadrefamilia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.detalle_padrefamilia_id_detallepadrefamilia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detalle_padrefamilia_id_detallepadrefamilia_seq OWNER TO postgres;

--
-- Name: detalle_padrefamilia_id_detallepadrefamilia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.detalle_padrefamilia_id_detallepadrefamilia_seq OWNED BY public.detalle_padrefamilia.id_detallepadrefamilia;


--
-- Name: dimensiones_preescolar; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dimensiones_preescolar (
    id_dimension integer NOT NULL,
    nombre character varying(100) NOT NULL
);


ALTER TABLE public.dimensiones_preescolar OWNER TO postgres;

--
-- Name: dimensiones_preescolar_id_dimension_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dimensiones_preescolar_id_dimension_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dimensiones_preescolar_id_dimension_seq OWNER TO postgres;

--
-- Name: dimensiones_preescolar_id_dimension_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dimensiones_preescolar_id_dimension_seq OWNED BY public.dimensiones_preescolar.id_dimension;


--
-- Name: directivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directivo (
    id integer NOT NULL,
    id_colegio integer NOT NULL,
    id_usuario integer,
    cargo character varying(100),
    estado public.estado_usuario_sistema DEFAULT 'ACTIVO'::public.estado_usuario_sistema NOT NULL,
    fecha_vinculacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_desvinculacion timestamp with time zone
);


ALTER TABLE public.directivo OWNER TO postgres;

--
-- Name: directivo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directivo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directivo_id_seq OWNER TO postgres;

--
-- Name: directivo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directivo_id_seq OWNED BY public.directivo.id;


--
-- Name: docente; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.docente (
    id_docente integer NOT NULL,
    nombre character varying(255) NOT NULL,
    apellido character varying(255) NOT NULL,
    id_contratodocente integer,
    id_colegio integer NOT NULL,
    id_usuario integer,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL
);


ALTER TABLE public.docente OWNER TO postgres;

--
-- Name: docente_id_docente_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.docente_id_docente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.docente_id_docente_seq OWNER TO postgres;

--
-- Name: docente_id_docente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.docente_id_docente_seq OWNED BY public.docente.id_docente;


--
-- Name: documento_matriculas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documento_matriculas (
    id_documento integer NOT NULL,
    id_matricula integer NOT NULL,
    tipo_documento character varying(100) NOT NULL,
    url text NOT NULL,
    estado public.estado_documento DEFAULT 'PENDIENTE'::public.estado_documento NOT NULL,
    fecha timestamp with time zone NOT NULL,
    id_colegio integer NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    fecha_expedicion date,
    estado_renovacion public.estado_renovacion_documento DEFAULT 'VIGENTE'::public.estado_renovacion_documento,
    contenido bytea,
    mime_type character varying(100),
    nombre_original character varying(255),
    tamano_bytes integer
);


ALTER TABLE public.documento_matriculas OWNER TO postgres;

--
-- Name: documento_matriculas_id_documento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documento_matriculas_id_documento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documento_matriculas_id_documento_seq OWNER TO postgres;

--
-- Name: documento_matriculas_id_documento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documento_matriculas_id_documento_seq OWNED BY public.documento_matriculas.id_documento;


--
-- Name: email_change_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_change_tokens (
    id integer NOT NULL,
    id_usuario integer,
    nuevo_email character varying(255) NOT NULL,
    codigo character varying(6) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_change_tokens OWNER TO postgres;

--
-- Name: email_change_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_change_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_change_tokens_id_seq OWNER TO postgres;

--
-- Name: email_change_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_change_tokens_id_seq OWNED BY public.email_change_tokens.id;


--
-- Name: escala_valoracion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.escala_valoracion (
    id_escalavaloracion integer NOT NULL,
    nivel character varying(20) NOT NULL,
    valor_minimo numeric(5,2) NOT NULL,
    valor_maximo numeric(5,2) NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.escala_valoracion OWNER TO postgres;

--
-- Name: escala_valoracion_id_escalavaloracion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.escala_valoracion_id_escalavaloracion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.escala_valoracion_id_escalavaloracion_seq OWNER TO postgres;

--
-- Name: escala_valoracion_id_escalavaloracion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.escala_valoracion_id_escalavaloracion_seq OWNED BY public.escala_valoracion.id_escalavaloracion;


--
-- Name: estudiante; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estudiante (
    id_estudiante integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    codigo character varying(20) NOT NULL,
    id_nivel integer,
    id_colegio integer NOT NULL,
    id_usuario integer,
    estado public.estado_estudiante DEFAULT 'ACTIVO'::public.estado_estudiante,
    motivo_estado text
);


ALTER TABLE public.estudiante OWNER TO postgres;

--
-- Name: estudiante_id_estudiante_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.estudiante_id_estudiante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.estudiante_id_estudiante_seq OWNER TO postgres;

--
-- Name: estudiante_id_estudiante_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.estudiante_id_estudiante_seq OWNED BY public.estudiante.id_estudiante;


--
-- Name: evidencia_aprendizaje; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidencia_aprendizaje (
    id_evidencia integer NOT NULL,
    id_competencia integer NOT NULL,
    descripcion text NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    id_colegio integer NOT NULL,
    id_evidencia_dba integer
);


ALTER TABLE public.evidencia_aprendizaje OWNER TO postgres;

--
-- Name: evidencia_aprendizaje_id_evidencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.evidencia_aprendizaje_id_evidencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evidencia_aprendizaje_id_evidencia_seq OWNER TO postgres;

--
-- Name: evidencia_aprendizaje_id_evidencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.evidencia_aprendizaje_id_evidencia_seq OWNED BY public.evidencia_aprendizaje.id_evidencia;


--
-- Name: evidencias_dba; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidencias_dba (
    id_evidencia_dba integer NOT NULL,
    id_dba integer NOT NULL,
    descripcion text NOT NULL,
    orden integer DEFAULT 1 NOT NULL,
    estado public.estado_dba DEFAULT 'ACTIVO'::public.estado_dba NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.evidencias_dba OWNER TO postgres;

--
-- Name: evidencias_dba_id_evidencia_dba_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.evidencias_dba_id_evidencia_dba_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evidencias_dba_id_evidencia_dba_seq OWNER TO postgres;

--
-- Name: evidencias_dba_id_evidencia_dba_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.evidencias_dba_id_evidencia_dba_seq OWNED BY public.evidencias_dba.id_evidencia_dba;


--
-- Name: grados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grados (
    id_grado integer NOT NULL,
    nivel character varying(50) NOT NULL,
    tipo_grado character varying(50) NOT NULL,
    id_jornada integer NOT NULL,
    id_colegio integer NOT NULL,
    cupos_totales integer DEFAULT 30 NOT NULL,
    seccion character varying(10) DEFAULT 'A'::character varying
);


ALTER TABLE public.grados OWNER TO postgres;

--
-- Name: grados_id_grado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grados_id_grado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grados_id_grado_seq OWNER TO postgres;

--
-- Name: grados_id_grado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grados_id_grado_seq OWNED BY public.grados.id_grado;


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grupos (
    id_grupo integer NOT NULL,
    id_nivel integer NOT NULL,
    id_jornada integer NOT NULL,
    id_colegio integer NOT NULL,
    id_seccion integer NOT NULL,
    cupos_totales integer DEFAULT 0 NOT NULL,
    id_tipo_grado integer NOT NULL,
    id_docente integer,
    CONSTRAINT chk_cupos CHECK ((cupos_totales >= 0))
);


ALTER TABLE public.grupos OWNER TO postgres;

--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grupos_id_grupo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grupos_id_grupo_seq OWNER TO postgres;

--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grupos_id_grupo_seq OWNED BY public.grupos.id_grupo;


--
-- Name: jornada; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jornada (
    id_jornada integer NOT NULL,
    nombre public.tipo_jornada NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.jornada OWNER TO postgres;

--
-- Name: jornada_id_jornada_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.jornada_id_jornada_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.jornada_id_jornada_seq OWNER TO postgres;

--
-- Name: jornada_id_jornada_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.jornada_id_jornada_seq OWNED BY public.jornada.id_jornada;


--
-- Name: materias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.materias (
    id_materia integer NOT NULL,
    nombre character varying(100) NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.materias OWNER TO postgres;

--
-- Name: materias_id_materia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.materias_id_materia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.materias_id_materia_seq OWNER TO postgres;

--
-- Name: materias_id_materia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.materias_id_materia_seq OWNED BY public.materias.id_materia;


--
-- Name: matricula; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matricula (
    id_matricula integer NOT NULL,
    id_estudiante integer,
    id_nivel integer,
    id_colegio integer NOT NULL,
    id_anio integer CONSTRAINT "matricula_id_año_not_null" NOT NULL,
    estado public.estado_matricula NOT NULL,
    correo_padre character varying(100),
    tiene_discapacidad boolean DEFAULT false,
    es_extranjero boolean DEFAULT false,
    token_seguimiento uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    id_grupo integer,
    motivo_cancelacion character varying(100),
    detalles_cancelacion text,
    es_traslado boolean DEFAULT false,
    fecha_aprobacion timestamp without time zone,
    tipo public.tipo_matricula DEFAULT 'REGULAR'::public.tipo_matricula NOT NULL,
    motivo text,
    observaciones text,
    id_usuario_responsable integer,
    fecha_creacion timestamp without time zone DEFAULT now(),
    id_ticket integer
);


ALTER TABLE public.matricula OWNER TO postgres;

--
-- Name: matricula_id_matricula_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.matricula_id_matricula_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.matricula_id_matricula_seq OWNER TO postgres;

--
-- Name: matricula_id_matricula_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.matricula_id_matricula_seq OWNED BY public.matricula.id_matricula;


--
-- Name: nivel_escolar; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nivel_escolar (
    id_nivel integer NOT NULL,
    nombre character varying(100) NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.nivel_escolar OWNER TO postgres;

--
-- Name: nivel_escolar_id_nivel_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nivel_escolar_id_nivel_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nivel_escolar_id_nivel_seq OWNER TO postgres;

--
-- Name: nivel_escolar_id_nivel_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nivel_escolar_id_nivel_seq OWNED BY public.nivel_escolar.id_nivel;


--
-- Name: nota_criterio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nota_criterio (
    id_nota_criterio integer NOT NULL,
    id_criterio integer NOT NULL,
    id_estudiante integer NOT NULL,
    nota numeric(5,2) NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.nota_criterio OWNER TO postgres;

--
-- Name: nota_criterio_id_nota_criterio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nota_criterio_id_nota_criterio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nota_criterio_id_nota_criterio_seq OWNER TO postgres;

--
-- Name: nota_criterio_id_nota_criterio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nota_criterio_id_nota_criterio_seq OWNED BY public.nota_criterio.id_nota_criterio;


--
-- Name: notas_actividad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notas_actividad (
    id_notaactividad integer NOT NULL,
    id_actividadmateria integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_escalavaloracion integer NOT NULL,
    nota numeric(5,2) NOT NULL,
    id_colegio integer NOT NULL
);


ALTER TABLE public.notas_actividad OWNER TO postgres;

--
-- Name: notas_actividad_id_notaactividad_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notas_actividad_id_notaactividad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notas_actividad_id_notaactividad_seq OWNER TO postgres;

--
-- Name: notas_actividad_id_notaactividad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notas_actividad_id_notaactividad_seq OWNED BY public.notas_actividad.id_notaactividad;


--
-- Name: notificacion_colegio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificacion_colegio (
    id_notificacion integer NOT NULL,
    id_colegio integer NOT NULL,
    id_directivo integer NOT NULL,
    tipo character varying(50) NOT NULL,
    mensaje text NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20),
    leida boolean DEFAULT false NOT NULL,
    fecha_notificacion timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notificacion_colegio OWNER TO postgres;

--
-- Name: notificacion_colegio_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.notificacion_colegio ALTER COLUMN id_notificacion ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.notificacion_colegio_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notificacion_supervision; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificacion_supervision (
    id_notificacion integer NOT NULL,
    id_auditoria integer NOT NULL,
    id_directivo integer NOT NULL,
    tipo_notificacion character varying(50) NOT NULL,
    mensaje text NOT NULL,
    leida boolean DEFAULT false NOT NULL,
    fecha_notificacion timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notificacion_supervision OWNER TO postgres;

--
-- Name: notificacion_supervision_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.notificacion_supervision ALTER COLUMN id_notificacion ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.notificacion_supervision_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: observacion_estudiante; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.observacion_estudiante (
    id_observacion integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_detallegrado integer NOT NULL,
    id_periodo integer NOT NULL,
    fortalezas text,
    debilidades text,
    recomendaciones text,
    fecha timestamp with time zone NOT NULL,
    id_colegio integer NOT NULL,
    tipo public.tipo_observacion DEFAULT 'ACADEMICA'::public.tipo_observacion
);


ALTER TABLE public.observacion_estudiante OWNER TO postgres;

--
-- Name: observacion_estudiante_id_observacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.observacion_estudiante_id_observacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.observacion_estudiante_id_observacion_seq OWNER TO postgres;

--
-- Name: observacion_estudiante_id_observacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.observacion_estudiante_id_observacion_seq OWNED BY public.observacion_estudiante.id_observacion;


--
-- Name: padre_familia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.padre_familia (
    id_padrefamilia integer NOT NULL,
    nombre character varying(50) NOT NULL,
    apellido character varying(50) NOT NULL,
    id_colegio integer,
    id_usuario integer
);


ALTER TABLE public.padre_familia OWNER TO postgres;

--
-- Name: padre_familia_id_padrefamilia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.padre_familia_id_padrefamilia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.padre_familia_id_padrefamilia_seq OWNER TO postgres;

--
-- Name: padre_familia_id_padrefamilia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.padre_familia_id_padrefamilia_seq OWNED BY public.padre_familia.id_padrefamilia;


--
-- Name: papelera_materias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.papelera_materias (
    id_papelera integer NOT NULL,
    id_colegio integer,
    nombre_materia character varying(255),
    data_respaldo jsonb,
    fecha_borrado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '30 days'::interval)
);


ALTER TABLE public.papelera_materias OWNER TO postgres;

--
-- Name: papelera_materias_id_papelera_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.papelera_materias_id_papelera_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.papelera_materias_id_papelera_seq OWNER TO postgres;

--
-- Name: papelera_materias_id_papelera_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.papelera_materias_id_papelera_seq OWNED BY public.papelera_materias.id_papelera;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    id_usuario integer NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: periodo_academico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.periodo_academico (
    id_periodo integer NOT NULL,
    nombre character varying(100) NOT NULL,
    estado public.estado_periodo NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    id_anio integer,
    id_colegio integer NOT NULL,
    trimestre integer,
    dia_inicio integer,
    dia_fin integer,
    mes_inicio integer,
    mes_fin integer
);


ALTER TABLE public.periodo_academico OWNER TO postgres;

--
-- Name: periodo_academico_id_periodo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.periodo_academico_id_periodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.periodo_academico_id_periodo_seq OWNER TO postgres;

--
-- Name: periodo_academico_id_periodo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.periodo_academico_id_periodo_seq OWNED BY public.periodo_academico.id_periodo;


--
-- Name: registro_asistencia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registro_asistencia (
    id_registroasistencia integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_detallegrado integer NOT NULL,
    fecha timestamp with time zone NOT NULL,
    estado public.estado_asistencia DEFAULT 'PRESENTE'::public.estado_asistencia NOT NULL,
    id_colegio integer NOT NULL,
    justificacion text,
    hora_llegada time without time zone
);


ALTER TABLE public.registro_asistencia OWNER TO postgres;

--
-- Name: registro_asistencia_id_registroasistencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.registro_asistencia_id_registroasistencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.registro_asistencia_id_registroasistencia_seq OWNER TO postgres;

--
-- Name: registro_asistencia_id_registroasistencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.registro_asistencia_id_registroasistencia_seq OWNED BY public.registro_asistencia.id_registroasistencia;


--
-- Name: registro_graduados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registro_graduados (
    id_graduado integer NOT NULL,
    id_estudiante integer NOT NULL,
    fecha_graduacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    observaciones text,
    id_usuario_registro integer,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id_anio integer
);


ALTER TABLE public.registro_graduados OWNER TO postgres;

--
-- Name: registro_graduados_id_graduado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.registro_graduados_id_graduado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.registro_graduados_id_graduado_seq OWNER TO postgres;

--
-- Name: registro_graduados_id_graduado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.registro_graduados_id_graduado_seq OWNED BY public.registro_graduados.id_graduado;


--
-- Name: resultado_academico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resultado_academico (
    id_resultado integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_detallegrado integer NOT NULL,
    id_periodo integer NOT NULL,
    promedio numeric(5,2) NOT NULL,
    estado public.estado_resultado NOT NULL,
    fecha_cierre timestamp with time zone NOT NULL,
    id_docente integer NOT NULL,
    observacion text
);


ALTER TABLE public.resultado_academico OWNER TO postgres;

--
-- Name: resultado_academico_id_resultado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.resultado_academico_id_resultado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resultado_academico_id_resultado_seq OWNER TO postgres;

--
-- Name: resultado_academico_id_resultado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resultado_academico_id_resultado_seq OWNED BY public.resultado_academico.id_resultado;


--
-- Name: rol; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rol (
    id_rol integer NOT NULL,
    nombre character varying(50) NOT NULL
);


ALTER TABLE public.rol OWNER TO postgres;

--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rol_id_rol_seq OWNER TO postgres;

--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rol_id_rol_seq OWNED BY public.rol.id_rol;


--
-- Name: sancion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sancion (
    id_sancion integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_tipo_sancion integer NOT NULL,
    motivo text NOT NULL,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date NOT NULL,
    estado public.estado_sancion DEFAULT 'ACTIVA'::public.estado_sancion,
    observaciones text,
    id_directivo integer NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fechas_sancion CHECK ((fecha_fin >= fecha_inicio))
);


ALTER TABLE public.sancion OWNER TO postgres;

--
-- Name: sancion_id_sancion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sancion_id_sancion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sancion_id_sancion_seq OWNER TO postgres;

--
-- Name: sancion_id_sancion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sancion_id_sancion_seq OWNED BY public.sancion.id_sancion;


--
-- Name: secciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.secciones (
    id_seccion integer NOT NULL,
    nombre character varying(10) NOT NULL
);


ALTER TABLE public.secciones OWNER TO postgres;

--
-- Name: secciones_id_seccion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.secciones_id_seccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.secciones_id_seccion_seq OWNER TO postgres;

--
-- Name: secciones_id_seccion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.secciones_id_seccion_seq OWNED BY public.secciones.id_seccion;


--
-- Name: solicitud_traslado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitud_traslado (
    id_solicitud integer NOT NULL,
    tipo public.tipo_traslado DEFAULT 'TRASLADO_USUARIO'::public.tipo_traslado NOT NULL,
    id_usuario integer NOT NULL,
    id_colegio_origen integer NOT NULL,
    id_colegio_destino integer NOT NULL,
    id_matricula integer,
    estado public.estado_solicitud_traslado DEFAULT 'SOLICITADA'::public.estado_solicitud_traslado NOT NULL,
    motivo text NOT NULL,
    creado_por integer NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_finalizacion timestamp with time zone,
    CONSTRAINT chk_origen_destino_diff CHECK ((id_colegio_origen <> id_colegio_destino))
);


ALTER TABLE public.solicitud_traslado OWNER TO postgres;

--
-- Name: solicitud_traslado_id_solicitud_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solicitud_traslado_id_solicitud_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solicitud_traslado_id_solicitud_seq OWNER TO postgres;

--
-- Name: solicitud_traslado_id_solicitud_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solicitud_traslado_id_solicitud_seq OWNED BY public.solicitud_traslado.id_solicitud;


--
-- Name: tickets_soporte; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets_soporte (
    id_ticket integer NOT NULL,
    id_usuario integer,
    nombre_remitente character varying(155) NOT NULL,
    correo_remitente character varying(155) NOT NULL,
    telefono character varying(50),
    tipo_incidencia public.tipo_incidencia_soporte NOT NULL,
    asunto character varying(255) NOT NULL,
    descripcion text NOT NULL,
    estado public.estado_ticket_soporte DEFAULT 'ABIERTO'::public.estado_ticket_soporte,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id_colegio integer,
    observaciones jsonb DEFAULT '[]'::jsonb,
    codigo_ticket character varying(50),
    fecha_escalado timestamp with time zone,
    id_estudiante integer
);


ALTER TABLE public.tickets_soporte OWNER TO postgres;

--
-- Name: tickets_soporte_id_ticket_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_soporte_id_ticket_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_soporte_id_ticket_seq OWNER TO postgres;

--
-- Name: tickets_soporte_id_ticket_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_soporte_id_ticket_seq OWNED BY public.tickets_soporte.id_ticket;


--
-- Name: tipo_documento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipo_documento (
    id_tipodocumento integer NOT NULL,
    tipo character varying(255) NOT NULL
);


ALTER TABLE public.tipo_documento OWNER TO postgres;

--
-- Name: tipo_documento_id_tipodocumento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tipo_documento_id_tipodocumento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tipo_documento_id_tipodocumento_seq OWNER TO postgres;

--
-- Name: tipo_documento_id_tipodocumento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tipo_documento_id_tipodocumento_seq OWNED BY public.tipo_documento.id_tipodocumento;


--
-- Name: tipo_grado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipo_grado (
    id_tipo_grado integer CONSTRAINT tipo_grado_tabla_id_tipo_grado_not_null NOT NULL,
    nombre character varying(50) CONSTRAINT tipo_grado_tabla_nombre_not_null NOT NULL,
    id_nivel integer CONSTRAINT tipo_grado_tabla_id_nivel_not_null NOT NULL
);


ALTER TABLE public.tipo_grado OWNER TO postgres;

--
-- Name: tipo_grado_tabla_id_tipo_grado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tipo_grado_tabla_id_tipo_grado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tipo_grado_tabla_id_tipo_grado_seq OWNER TO postgres;

--
-- Name: tipo_grado_tabla_id_tipo_grado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tipo_grado_tabla_id_tipo_grado_seq OWNED BY public.tipo_grado.id_tipo_grado;


--
-- Name: tipo_sancion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipo_sancion (
    id_tipo_sancion integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text
);


ALTER TABLE public.tipo_sancion OWNER TO postgres;

--
-- Name: tipo_sancion_id_tipo_sancion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tipo_sancion_id_tipo_sancion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tipo_sancion_id_tipo_sancion_seq OWNER TO postgres;

--
-- Name: tipo_sancion_id_tipo_sancion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tipo_sancion_id_tipo_sancion_seq OWNED BY public.tipo_sancion.id_tipo_sancion;


--
-- Name: token_blacklist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_blacklist (
    id integer NOT NULL,
    jti character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.token_blacklist OWNER TO postgres;

--
-- Name: token_blacklist_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.token_blacklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.token_blacklist_id_seq OWNER TO postgres;

--
-- Name: token_blacklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.token_blacklist_id_seq OWNED BY public.token_blacklist.id;


--
-- Name: traslado_aprobacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traslado_aprobacion (
    id_aprobacion integer NOT NULL,
    id_solicitud integer NOT NULL,
    id_usuario integer NOT NULL,
    rol character varying(50) NOT NULL,
    accion public.accion_aprobacion_traslado NOT NULL,
    comentario text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.traslado_aprobacion OWNER TO postgres;

--
-- Name: traslado_aprobacion_id_aprobacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.traslado_aprobacion_id_aprobacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.traslado_aprobacion_id_aprobacion_seq OWNER TO postgres;

--
-- Name: traslado_aprobacion_id_aprobacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.traslado_aprobacion_id_aprobacion_seq OWNED BY public.traslado_aprobacion.id_aprobacion;


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    email character varying(255),
    password character varying(255) NOT NULL,
    nombre character varying(255) NOT NULL,
    apellido character varying(255),
    id_colegio integer,
    activo boolean DEFAULT true,
    fecha_creacion timestamp with time zone DEFAULT now(),
    estado public.estado_usuario_sistema DEFAULT 'ACTIVO'::public.estado_usuario_sistema NOT NULL,
    motivo_baneo text,
    fecha_baneo timestamp with time zone,
    baneado_por integer,
    logged_out_at timestamp with time zone,
    id_tipodocumento integer,
    documento character varying(50),
    telefono character varying(50),
    CONSTRAINT chk_usuario_documento_format CHECK (((documento IS NULL) OR ((documento)::text ~ '^[a-zA-Z0-9]+$'::text)))
);


ALTER TABLE public.usuario OWNER TO postgres;

--
-- Name: usuario_colegio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_colegio (
    id_usuario_colegio integer NOT NULL,
    id_usuario integer NOT NULL,
    id_colegio integer NOT NULL,
    id_rol integer NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    fecha_inicio timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_fin timestamp with time zone,
    CONSTRAINT usuario_colegio_estado_check CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying, 'SUSPENDIDO'::character varying])::text[])))
);


ALTER TABLE public.usuario_colegio OWNER TO postgres;

--
-- Name: usuario_colegio_id_usuario_colegio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuario_colegio_id_usuario_colegio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuario_colegio_id_usuario_colegio_seq OWNER TO postgres;

--
-- Name: usuario_colegio_id_usuario_colegio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuario_colegio_id_usuario_colegio_seq OWNED BY public.usuario_colegio.id_usuario_colegio;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuario_id_usuario_seq OWNER TO postgres;

--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuario_id_usuario_seq OWNED BY public.usuario.id_usuario;


--
-- Name: usuario_rol; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_rol (
    id_usuario integer NOT NULL,
    id_rol integer NOT NULL
);


ALTER TABLE public.usuario_rol OWNER TO postgres;

--
-- Name: vw_asistencia_estudiante; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_asistencia_estudiante AS
 SELECT id_estudiante,
    id_detallegrado,
    count(*) FILTER (WHERE ((estado)::text = 'PRESENTE'::text)) AS presentes,
    count(*) FILTER (WHERE ((estado)::text = 'AUSENTE'::text)) AS ausentes,
    count(*) FILTER (WHERE ((estado)::text = 'TARDE'::text)) AS tardes,
    count(*) FILTER (WHERE ((estado)::text = 'JUSTIFICADA'::text)) AS justificadas
   FROM public.registro_asistencia
  GROUP BY id_estudiante, id_detallegrado;


ALTER VIEW public.vw_asistencia_estudiante OWNER TO postgres;

--
-- Name: vw_notas_enriquecidas; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_notas_enriquecidas AS
 SELECT n.id_estudiante,
    e.nombre,
    e.apellido,
    n.nota,
    n.id_escalavaloracion,
    a.id_periodo,
    a.id_detallegrado,
    a.nombre AS actividad,
    dg.id_materia,
    dg.id_docente,
    n.id_colegio
   FROM (((public.notas_actividad n
     JOIN public.estudiante e ON ((e.id_estudiante = n.id_estudiante)))
     JOIN public.actividad_materia a ON ((a.id_actividadmateria = n.id_actividadmateria)))
     JOIN public.detalle_grados dg ON ((dg.id_detallegrado = a.id_detallegrado)));


ALTER VIEW public.vw_notas_enriquecidas OWNER TO postgres;

--
-- Name: vw_promedio_estudiante_periodo; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_promedio_estudiante_periodo AS
 SELECT id_estudiante,
    id_periodo,
    id_colegio,
    avg(nota) AS promedio_raw
   FROM public.vw_notas_enriquecidas
  GROUP BY id_estudiante, id_periodo, id_colegio;


ALTER VIEW public.vw_promedio_estudiante_periodo OWNER TO postgres;

--
-- Name: vw_promedio_normalizado; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_promedio_normalizado AS
 SELECT p.id_estudiante,
    p.id_periodo,
    p.id_colegio,
    ((p.promedio_raw / NULLIF(cfg.nota_maxima, (0)::numeric)) * (5)::numeric) AS promedio_normalizado
   FROM (public.vw_promedio_estudiante_periodo p
     JOIN public.configuracion_colegio cfg ON ((cfg.id_colegio = p.id_colegio)));


ALTER VIEW public.vw_promedio_normalizado OWNER TO postgres;

--
-- Name: vw_desempeno_estudiante; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_desempeno_estudiante AS
 SELECT p.id_estudiante,
    p.id_periodo,
    p.id_colegio,
    p.promedio_normalizado,
    d.nivel AS "desempeño"
   FROM (public.vw_promedio_normalizado p
     JOIN public.escala_valoracion d ON (((p.promedio_normalizado >= d.valor_minimo) AND (p.promedio_normalizado <= d.valor_maximo) AND (d.id_colegio = p.id_colegio))));


ALTER VIEW public.vw_desempeno_estudiante OWNER TO postgres;

--
-- Name: vw_observaciones_estudiante; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_observaciones_estudiante AS
 SELECT id_estudiante,
    id_periodo,
    string_agg(fortalezas, ', '::text) AS fortalezas,
    string_agg(debilidades, ', '::text) AS debilidades
   FROM public.observacion_estudiante
  GROUP BY id_estudiante, id_periodo;


ALTER VIEW public.vw_observaciones_estudiante OWNER TO postgres;

--
-- Name: vw_promedio_materia; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_promedio_materia AS
 SELECT dg.id_materia,
    n.id_estudiante,
    a.id_periodo,
    n.id_colegio,
    avg(n.nota) AS promedio_materia
   FROM ((public.notas_actividad n
     JOIN public.actividad_materia a ON ((a.id_actividadmateria = n.id_actividadmateria)))
     JOIN public.detalle_grados dg ON ((dg.id_detallegrado = a.id_detallegrado)))
  GROUP BY dg.id_materia, n.id_estudiante, a.id_periodo, n.id_colegio;


ALTER VIEW public.vw_promedio_materia OWNER TO postgres;

--
-- Name: actividad_materia id_actividadmateria; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia ALTER COLUMN id_actividadmateria SET DEFAULT nextval('public.actividad_materia_id_actividadmateria_seq'::regclass);


--
-- Name: anio_lectivo id_anio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anio_lectivo ALTER COLUMN id_anio SET DEFAULT nextval('public.anio_lectivo_id_anio_seq'::regclass);


--
-- Name: cierre_materia id_cierremateria; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia ALTER COLUMN id_cierremateria SET DEFAULT nextval('public.cierre_materia_id_cierremateria_seq'::regclass);


--
-- Name: colegio id_colegio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colegio ALTER COLUMN id_colegio SET DEFAULT nextval('public.colegio_id_colegio_seq'::regclass);


--
-- Name: colegio_version_curricular id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colegio_version_curricular ALTER COLUMN id SET DEFAULT nextval('public.colegio_version_curricular_id_seq'::regclass);


--
-- Name: competencias id_competencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias ALTER COLUMN id_competencia SET DEFAULT nextval('public.competencias_id_competencia_seq'::regclass);


--
-- Name: configuracion_base id_config_base; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_base ALTER COLUMN id_config_base SET DEFAULT nextval('public.configuracion_base_id_config_base_seq'::regclass);


--
-- Name: configuracion_inscripcion id_configuracion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_inscripcion ALTER COLUMN id_configuracion SET DEFAULT nextval('public.configuracion_inscripcion_id_configuracion_seq'::regclass);


--
-- Name: configuracion_sistema id_configuracion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_sistema ALTER COLUMN id_configuracion SET DEFAULT nextval('public.configuracion_sistema_id_configuracion_seq'::regclass);


--
-- Name: contrato_docente id_contratodocente; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contrato_docente ALTER COLUMN id_contratodocente SET DEFAULT nextval('public.contrato_docente_id_contratodocente_seq'::regclass);


--
-- Name: criterio_evaluacion id_criterio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.criterio_evaluacion ALTER COLUMN id_criterio SET DEFAULT nextval('public.criterio_evaluacion_id_criterio_seq'::regclass);


--
-- Name: dba id_dba; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dba ALTER COLUMN id_dba SET DEFAULT nextval('public.dba_id_dba_seq'::regclass);


--
-- Name: decision_promocion_directivo id_decision; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_promocion_directivo ALTER COLUMN id_decision SET DEFAULT nextval('public.decision_promocion_directivo_id_decision_seq'::regclass);


--
-- Name: desempeno id_desempeno; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.desempeno ALTER COLUMN id_desempeno SET DEFAULT nextval('public.desempeno_id_desempeno_seq'::regclass);


--
-- Name: detalle_grados id_detallegrado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_grados ALTER COLUMN id_detallegrado SET DEFAULT nextval('public.detalle_grados_id_detallegrado_seq'::regclass);


--
-- Name: detalle_padrefamilia id_detallepadrefamilia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_padrefamilia ALTER COLUMN id_detallepadrefamilia SET DEFAULT nextval('public.detalle_padrefamilia_id_detallepadrefamilia_seq'::regclass);


--
-- Name: dimensiones_preescolar id_dimension; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dimensiones_preescolar ALTER COLUMN id_dimension SET DEFAULT nextval('public.dimensiones_preescolar_id_dimension_seq'::regclass);


--
-- Name: directivo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directivo ALTER COLUMN id SET DEFAULT nextval('public.directivo_id_seq'::regclass);


--
-- Name: docente id_docente; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente ALTER COLUMN id_docente SET DEFAULT nextval('public.docente_id_docente_seq'::regclass);


--
-- Name: documento_matriculas id_documento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documento_matriculas ALTER COLUMN id_documento SET DEFAULT nextval('public.documento_matriculas_id_documento_seq'::regclass);


--
-- Name: email_change_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_change_tokens ALTER COLUMN id SET DEFAULT nextval('public.email_change_tokens_id_seq'::regclass);


--
-- Name: escala_valoracion id_escalavaloracion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_valoracion ALTER COLUMN id_escalavaloracion SET DEFAULT nextval('public.escala_valoracion_id_escalavaloracion_seq'::regclass);


--
-- Name: estudiante id_estudiante; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estudiante ALTER COLUMN id_estudiante SET DEFAULT nextval('public.estudiante_id_estudiante_seq'::regclass);


--
-- Name: evidencia_aprendizaje id_evidencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_aprendizaje ALTER COLUMN id_evidencia SET DEFAULT nextval('public.evidencia_aprendizaje_id_evidencia_seq'::regclass);


--
-- Name: evidencias_dba id_evidencia_dba; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencias_dba ALTER COLUMN id_evidencia_dba SET DEFAULT nextval('public.evidencias_dba_id_evidencia_dba_seq'::regclass);


--
-- Name: grados id_grado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados ALTER COLUMN id_grado SET DEFAULT nextval('public.grados_id_grado_seq'::regclass);


--
-- Name: grupos id_grupo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos ALTER COLUMN id_grupo SET DEFAULT nextval('public.grupos_id_grupo_seq'::regclass);


--
-- Name: jornada id_jornada; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jornada ALTER COLUMN id_jornada SET DEFAULT nextval('public.jornada_id_jornada_seq'::regclass);


--
-- Name: materias id_materia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.materias ALTER COLUMN id_materia SET DEFAULT nextval('public.materias_id_materia_seq'::regclass);


--
-- Name: matricula id_matricula; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula ALTER COLUMN id_matricula SET DEFAULT nextval('public.matricula_id_matricula_seq'::regclass);


--
-- Name: nivel_escolar id_nivel; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nivel_escolar ALTER COLUMN id_nivel SET DEFAULT nextval('public.nivel_escolar_id_nivel_seq'::regclass);


--
-- Name: nota_criterio id_nota_criterio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nota_criterio ALTER COLUMN id_nota_criterio SET DEFAULT nextval('public.nota_criterio_id_nota_criterio_seq'::regclass);


--
-- Name: notas_actividad id_notaactividad; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_actividad ALTER COLUMN id_notaactividad SET DEFAULT nextval('public.notas_actividad_id_notaactividad_seq'::regclass);


--
-- Name: observacion_estudiante id_observacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.observacion_estudiante ALTER COLUMN id_observacion SET DEFAULT nextval('public.observacion_estudiante_id_observacion_seq'::regclass);


--
-- Name: padre_familia id_padrefamilia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.padre_familia ALTER COLUMN id_padrefamilia SET DEFAULT nextval('public.padre_familia_id_padrefamilia_seq'::regclass);


--
-- Name: papelera_materias id_papelera; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.papelera_materias ALTER COLUMN id_papelera SET DEFAULT nextval('public.papelera_materias_id_papelera_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: periodo_academico id_periodo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodo_academico ALTER COLUMN id_periodo SET DEFAULT nextval('public.periodo_academico_id_periodo_seq'::regclass);


--
-- Name: registro_asistencia id_registroasistencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_asistencia ALTER COLUMN id_registroasistencia SET DEFAULT nextval('public.registro_asistencia_id_registroasistencia_seq'::regclass);


--
-- Name: registro_graduados id_graduado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_graduados ALTER COLUMN id_graduado SET DEFAULT nextval('public.registro_graduados_id_graduado_seq'::regclass);


--
-- Name: resultado_academico id_resultado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultado_academico ALTER COLUMN id_resultado SET DEFAULT nextval('public.resultado_academico_id_resultado_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol ALTER COLUMN id_rol SET DEFAULT nextval('public.rol_id_rol_seq'::regclass);


--
-- Name: sancion id_sancion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sancion ALTER COLUMN id_sancion SET DEFAULT nextval('public.sancion_id_sancion_seq'::regclass);


--
-- Name: secciones id_seccion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.secciones ALTER COLUMN id_seccion SET DEFAULT nextval('public.secciones_id_seccion_seq'::regclass);


--
-- Name: solicitud_traslado id_solicitud; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_traslado ALTER COLUMN id_solicitud SET DEFAULT nextval('public.solicitud_traslado_id_solicitud_seq'::regclass);


--
-- Name: tickets_soporte id_ticket; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte ALTER COLUMN id_ticket SET DEFAULT nextval('public.tickets_soporte_id_ticket_seq'::regclass);


--
-- Name: tipo_documento id_tipodocumento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_documento ALTER COLUMN id_tipodocumento SET DEFAULT nextval('public.tipo_documento_id_tipodocumento_seq'::regclass);


--
-- Name: tipo_grado id_tipo_grado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_grado ALTER COLUMN id_tipo_grado SET DEFAULT nextval('public.tipo_grado_tabla_id_tipo_grado_seq'::regclass);


--
-- Name: tipo_sancion id_tipo_sancion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_sancion ALTER COLUMN id_tipo_sancion SET DEFAULT nextval('public.tipo_sancion_id_tipo_sancion_seq'::regclass);


--
-- Name: token_blacklist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist ALTER COLUMN id SET DEFAULT nextval('public.token_blacklist_id_seq'::regclass);


--
-- Name: traslado_aprobacion id_aprobacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traslado_aprobacion ALTER COLUMN id_aprobacion SET DEFAULT nextval('public.traslado_aprobacion_id_aprobacion_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);


--
-- Name: usuario_colegio id_usuario_colegio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_colegio ALTER COLUMN id_usuario_colegio SET DEFAULT nextval('public.usuario_colegio_id_usuario_colegio_seq'::regclass);


--
-- Name: actividad_evidencia_dba actividad_evidencia_dba_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_evidencia_dba
    ADD CONSTRAINT actividad_evidencia_dba_pkey PRIMARY KEY (id_actividadmateria, id_evidencia_dba);


--
-- Name: actividad_materia actividad_materia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_pkey PRIMARY KEY (id_actividadmateria);


--
-- Name: auditoria_acciones_realizadas auditoria_acciones_realizadas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_acciones_realizadas
    ADD CONSTRAINT auditoria_acciones_realizadas_pkey PRIMARY KEY (id_accion);


--
-- Name: auditoria_supervision auditoria_supervision_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_supervision
    ADD CONSTRAINT auditoria_supervision_pkey PRIMARY KEY (id_auditoria);


--
-- Name: anio_lectivo año_lectivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anio_lectivo
    ADD CONSTRAINT "año_lectivo_pkey" PRIMARY KEY (id_anio);


--
-- Name: cierre_materia cierre_materia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia
    ADD CONSTRAINT cierre_materia_pkey PRIMARY KEY (id_cierremateria);


--
-- Name: colegio colegio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colegio
    ADD CONSTRAINT colegio_pkey PRIMARY KEY (id_colegio);


--
-- Name: colegio_version_curricular colegio_version_curricular_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colegio_version_curricular
    ADD CONSTRAINT colegio_version_curricular_pkey PRIMARY KEY (id);


--
-- Name: competencias competencias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_pkey PRIMARY KEY (id_competencia);


--
-- Name: configuracion_base configuracion_base_clave_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_base
    ADD CONSTRAINT configuracion_base_clave_key UNIQUE (clave);


--
-- Name: configuracion_base configuracion_base_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_base
    ADD CONSTRAINT configuracion_base_pkey PRIMARY KEY (id_config_base);


--
-- Name: configuracion_colegio configuracion_colegio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_colegio
    ADD CONSTRAINT configuracion_colegio_pkey PRIMARY KEY (id_colegio);


--
-- Name: configuracion_inscripcion configuracion_inscripcion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_inscripcion
    ADD CONSTRAINT configuracion_inscripcion_pkey PRIMARY KEY (id_configuracion);


--
-- Name: configuracion_plataforma configuracion_plataforma_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_plataforma
    ADD CONSTRAINT configuracion_plataforma_pkey PRIMARY KEY (clave);


--
-- Name: configuracion_sistema configuracion_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT configuracion_sistema_pkey PRIMARY KEY (id_configuracion);


--
-- Name: contrato_docente contrato_docente_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contrato_docente
    ADD CONSTRAINT contrato_docente_pkey PRIMARY KEY (id_contratodocente);


--
-- Name: criterio_evaluacion criterio_evaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.criterio_evaluacion
    ADD CONSTRAINT criterio_evaluacion_pkey PRIMARY KEY (id_criterio);


--
-- Name: dba_dimensiones_preescolar dba_dimensiones_preescolar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dba_dimensiones_preescolar
    ADD CONSTRAINT dba_dimensiones_preescolar_pkey PRIMARY KEY (id_dba, id_dimension);


--
-- Name: dba dba_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dba
    ADD CONSTRAINT dba_pkey PRIMARY KEY (id_dba);


--
-- Name: decision_promocion_directivo decision_promocion_directivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_promocion_directivo
    ADD CONSTRAINT decision_promocion_directivo_pkey PRIMARY KEY (id_decision);


--
-- Name: desempeno desempeno_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.desempeno
    ADD CONSTRAINT desempeno_pkey PRIMARY KEY (id_desempeno);


--
-- Name: detalle_grados detalle_grados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_grados
    ADD CONSTRAINT detalle_grados_pkey PRIMARY KEY (id_detallegrado);


--
-- Name: detalle_padrefamilia detalle_padrefamilia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_padrefamilia
    ADD CONSTRAINT detalle_padrefamilia_pkey PRIMARY KEY (id_detallepadrefamilia);


--
-- Name: dimensiones_preescolar dimensiones_preescolar_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dimensiones_preescolar
    ADD CONSTRAINT dimensiones_preescolar_nombre_key UNIQUE (nombre);


--
-- Name: dimensiones_preescolar dimensiones_preescolar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dimensiones_preescolar
    ADD CONSTRAINT dimensiones_preescolar_pkey PRIMARY KEY (id_dimension);


--
-- Name: directivo directivo_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directivo
    ADD CONSTRAINT directivo_id_usuario_key UNIQUE (id_usuario);


--
-- Name: directivo directivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directivo
    ADD CONSTRAINT directivo_pkey PRIMARY KEY (id);


--
-- Name: docente docente_id_usuario_id_colegio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT docente_id_usuario_id_colegio_key UNIQUE (id_usuario, id_colegio);


--
-- Name: docente docente_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT docente_pkey PRIMARY KEY (id_docente);


--
-- Name: documento_matriculas documento_matriculas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documento_matriculas
    ADD CONSTRAINT documento_matriculas_pkey PRIMARY KEY (id_documento);


--
-- Name: email_change_tokens email_change_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_change_tokens
    ADD CONSTRAINT email_change_tokens_pkey PRIMARY KEY (id);


--
-- Name: escala_valoracion escala_valoracion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_valoracion
    ADD CONSTRAINT escala_valoracion_pkey PRIMARY KEY (id_escalavaloracion);


--
-- Name: estudiante estudiante_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_id_usuario_key UNIQUE (id_usuario);


--
-- Name: estudiante estudiante_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_pkey PRIMARY KEY (id_estudiante);


--
-- Name: evidencia_aprendizaje evidencia_aprendizaje_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_aprendizaje
    ADD CONSTRAINT evidencia_aprendizaje_pkey PRIMARY KEY (id_evidencia);


--
-- Name: evidencias_dba evidencias_dba_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencias_dba
    ADD CONSTRAINT evidencias_dba_pkey PRIMARY KEY (id_evidencia_dba);


--
-- Name: grados grados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados
    ADD CONSTRAINT grados_pkey PRIMARY KEY (id_grado);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id_grupo);


--
-- Name: jornada jornada_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jornada
    ADD CONSTRAINT jornada_pkey PRIMARY KEY (id_jornada);


--
-- Name: materias materias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_pkey PRIMARY KEY (id_materia);


--
-- Name: matricula matricula_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT matricula_pkey PRIMARY KEY (id_matricula);


--
-- Name: matricula matricula_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT matricula_token_key UNIQUE (token_seguimiento);


--
-- Name: nivel_escolar nivel_escolar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nivel_escolar
    ADD CONSTRAINT nivel_escolar_pkey PRIMARY KEY (id_nivel);


--
-- Name: nota_criterio nota_criterio_id_criterio_id_estudiante_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nota_criterio
    ADD CONSTRAINT nota_criterio_id_criterio_id_estudiante_key UNIQUE (id_criterio, id_estudiante);


--
-- Name: nota_criterio nota_criterio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nota_criterio
    ADD CONSTRAINT nota_criterio_pkey PRIMARY KEY (id_nota_criterio);


--
-- Name: notas_actividad notas_actividad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_actividad
    ADD CONSTRAINT notas_actividad_pkey PRIMARY KEY (id_notaactividad);


--
-- Name: notificacion_colegio notificacion_colegio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion_colegio
    ADD CONSTRAINT notificacion_colegio_pkey PRIMARY KEY (id_notificacion);


--
-- Name: notificacion_supervision notificacion_supervision_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion_supervision
    ADD CONSTRAINT notificacion_supervision_pkey PRIMARY KEY (id_notificacion);


--
-- Name: observacion_estudiante observacion_estudiante_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.observacion_estudiante
    ADD CONSTRAINT observacion_estudiante_pkey PRIMARY KEY (id_observacion);


--
-- Name: padre_familia padre_familia_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.padre_familia
    ADD CONSTRAINT padre_familia_id_usuario_key UNIQUE (id_usuario);


--
-- Name: padre_familia padre_familia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.padre_familia
    ADD CONSTRAINT padre_familia_pkey PRIMARY KEY (id_padrefamilia);


--
-- Name: papelera_materias papelera_materias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.papelera_materias
    ADD CONSTRAINT papelera_materias_pkey PRIMARY KEY (id_papelera);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: periodo_academico periodo_academico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodo_academico
    ADD CONSTRAINT periodo_academico_pkey PRIMARY KEY (id_periodo);


--
-- Name: registro_asistencia registro_asistencia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_asistencia
    ADD CONSTRAINT registro_asistencia_pkey PRIMARY KEY (id_registroasistencia);


--
-- Name: registro_graduados registro_graduados_id_estudiante_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_graduados
    ADD CONSTRAINT registro_graduados_id_estudiante_key UNIQUE (id_estudiante);


--
-- Name: registro_graduados registro_graduados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_graduados
    ADD CONSTRAINT registro_graduados_pkey PRIMARY KEY (id_graduado);


--
-- Name: resultado_academico resultado_academico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultado_academico
    ADD CONSTRAINT resultado_academico_pkey PRIMARY KEY (id_resultado);


--
-- Name: rol rol_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_nombre_key UNIQUE (nombre);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: sancion sancion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sancion
    ADD CONSTRAINT sancion_pkey PRIMARY KEY (id_sancion);


--
-- Name: secciones secciones_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.secciones
    ADD CONSTRAINT secciones_nombre_key UNIQUE (nombre);


--
-- Name: secciones secciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.secciones
    ADD CONSTRAINT secciones_pkey PRIMARY KEY (id_seccion);


--
-- Name: solicitud_traslado solicitud_traslado_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_traslado
    ADD CONSTRAINT solicitud_traslado_pkey PRIMARY KEY (id_solicitud);


--
-- Name: tickets_soporte tickets_soporte_codigo_ticket_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_codigo_ticket_key UNIQUE (codigo_ticket);


--
-- Name: tickets_soporte tickets_soporte_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_pkey PRIMARY KEY (id_ticket);


--
-- Name: tipo_documento tipo_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_documento
    ADD CONSTRAINT tipo_documento_pkey PRIMARY KEY (id_tipodocumento);


--
-- Name: tipo_grado tipo_grado_tabla_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_grado
    ADD CONSTRAINT tipo_grado_tabla_pkey PRIMARY KEY (id_tipo_grado);


--
-- Name: tipo_sancion tipo_sancion_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_sancion
    ADD CONSTRAINT tipo_sancion_nombre_key UNIQUE (nombre);


--
-- Name: tipo_sancion tipo_sancion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_sancion
    ADD CONSTRAINT tipo_sancion_pkey PRIMARY KEY (id_tipo_sancion);


--
-- Name: token_blacklist token_blacklist_jti_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_jti_key UNIQUE (jti);


--
-- Name: token_blacklist token_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_pkey PRIMARY KEY (id);


--
-- Name: traslado_aprobacion traslado_aprobacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traslado_aprobacion
    ADD CONSTRAINT traslado_aprobacion_pkey PRIMARY KEY (id_aprobacion);


--
-- Name: notas_actividad unique_actividad_estudiante; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_actividad
    ADD CONSTRAINT unique_actividad_estudiante UNIQUE (id_actividadmateria, id_estudiante);


--
-- Name: configuracion_sistema unique_configuracion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT unique_configuracion UNIQUE (id_colegio, clave);


--
-- Name: configuracion_inscripcion uq_colegio_anio; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_inscripcion
    ADD CONSTRAINT uq_colegio_anio UNIQUE (id_colegio, id_anio);


--
-- Name: colegio_version_curricular uq_colegio_area_grado; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colegio_version_curricular
    ADD CONSTRAINT uq_colegio_area_grado UNIQUE (id_colegio, area, grado);


--
-- Name: dba uq_dba_area_grado_num_version; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dba
    ADD CONSTRAINT uq_dba_area_grado_num_version UNIQUE (area, grado, numero_dba, version_curricular);


--
-- Name: tipo_grado uq_tipo_grado; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_grado
    ADD CONSTRAINT uq_tipo_grado UNIQUE (nombre, id_nivel);


--
-- Name: usuario_colegio uq_usuario_colegio_rol; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_colegio
    ADD CONSTRAINT uq_usuario_colegio_rol UNIQUE (id_usuario, id_colegio, id_rol);


--
-- Name: usuario_colegio usuario_colegio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_colegio
    ADD CONSTRAINT usuario_colegio_pkey PRIMARY KEY (id_usuario_colegio);


--
-- Name: usuario usuario_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_email_key UNIQUE (email);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: usuario_rol usuario_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT usuario_rol_pkey PRIMARY KEY (id_usuario, id_rol);


--
-- Name: idx_actividad_evidencia_dba_act; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_actividad_evidencia_dba_act ON public.actividad_evidencia_dba USING btree (id_actividadmateria);


--
-- Name: idx_actividad_evidencia_dba_ev; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_actividad_evidencia_dba_ev ON public.actividad_evidencia_dba USING btree (id_evidencia_dba);


--
-- Name: idx_asistencia_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_estudiante ON public.registro_asistencia USING btree (id_estudiante);


--
-- Name: idx_audit_acc_auditoria; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_acc_auditoria ON public.auditoria_acciones_realizadas USING btree (id_auditoria);


--
-- Name: idx_audit_acc_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_acc_fecha ON public.auditoria_acciones_realizadas USING btree (fecha_accion);


--
-- Name: idx_audit_acc_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_acc_tipo ON public.auditoria_acciones_realizadas USING btree (tipo_accion);


--
-- Name: idx_audit_acc_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_acc_usuario ON public.auditoria_acciones_realizadas USING btree (id_usuario_afectado) WHERE (id_usuario_afectado IS NOT NULL);


--
-- Name: idx_audit_sup_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_sup_admin ON public.auditoria_supervision USING btree (id_admin_general);


--
-- Name: idx_audit_sup_colegio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_sup_colegio ON public.auditoria_supervision USING btree (id_colegio);


--
-- Name: idx_audit_sup_eliminado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_sup_eliminado ON public.auditoria_supervision USING btree (eliminado) WHERE (eliminado = false);


--
-- Name: idx_audit_sup_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_sup_estado ON public.auditoria_supervision USING btree (estado_supervision);


--
-- Name: idx_audit_sup_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_sup_fecha ON public.auditoria_supervision USING btree (fecha_solicitud);


--
-- Name: idx_colegio_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_colegio_estado ON public.colegio USING btree (estado);


--
-- Name: idx_colegio_version_colegio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_colegio_version_colegio ON public.colegio_version_curricular USING btree (id_colegio);


--
-- Name: idx_competencias_sync_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_competencias_sync_uuid ON public.competencias USING btree (sync_uuid);


--
-- Name: idx_config_inscripcion_colegio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_config_inscripcion_colegio ON public.configuracion_inscripcion USING btree (id_colegio);


--
-- Name: idx_dba_area_grado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dba_area_grado ON public.dba USING btree (area, grado);


--
-- Name: idx_dba_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dba_estado ON public.dba USING btree (estado) WHERE (estado = 'ACTIVO'::public.estado_dba);


--
-- Name: idx_dba_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dba_version ON public.dba USING btree (version_curricular);


--
-- Name: idx_decision_promocion_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_decision_promocion_anio ON public.decision_promocion_directivo USING btree (id_anio_anterior);


--
-- Name: idx_decision_promocion_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_decision_promocion_estudiante ON public.decision_promocion_directivo USING btree (id_estudiante, id_colegio);


--
-- Name: idx_detalle_padrefamilia_padrefamilia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_detalle_padrefamilia_padrefamilia ON public.detalle_padrefamilia USING btree (id_padrefamilia);


--
-- Name: idx_email_change_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_change_codigo ON public.email_change_tokens USING btree (codigo);


--
-- Name: idx_email_change_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_change_usuario ON public.email_change_tokens USING btree (id_usuario);


--
-- Name: idx_evidencia_aprendizaje_dba; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidencia_aprendizaje_dba ON public.evidencia_aprendizaje USING btree (id_evidencia_dba) WHERE (id_evidencia_dba IS NOT NULL);


--
-- Name: idx_evidencia_competencia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidencia_competencia ON public.evidencia_aprendizaje USING btree (id_competencia);


--
-- Name: idx_evidencias_dba_dba; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidencias_dba_dba ON public.evidencias_dba USING btree (id_dba);


--
-- Name: idx_grupos_tipo_grado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grupos_tipo_grado ON public.grupos USING btree (id_tipo_grado);


--
-- Name: idx_matricula_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matricula_estudiante ON public.matricula USING btree (id_estudiante);


--
-- Name: idx_matricula_estudiante_anio_colegio_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_matricula_estudiante_anio_colegio_activo ON public.matricula USING btree (id_estudiante, id_anio, id_colegio) WHERE (estado <> ALL (ARRAY['CANCELADA'::public.estado_matricula, 'RECHAZADA'::public.estado_matricula]));


--
-- Name: idx_notas_actividad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notas_actividad ON public.notas_actividad USING btree (id_actividadmateria);


--
-- Name: idx_notas_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notas_estudiante ON public.notas_actividad USING btree (id_estudiante);


--
-- Name: idx_notif_col_colegio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_col_colegio ON public.notificacion_colegio USING btree (id_colegio);


--
-- Name: idx_notif_col_directivo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_col_directivo ON public.notificacion_colegio USING btree (id_directivo);


--
-- Name: idx_notif_col_leida; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_col_leida ON public.notificacion_colegio USING btree (leida) WHERE (leida = false);


--
-- Name: idx_notif_sup_auditoria; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_sup_auditoria ON public.notificacion_supervision USING btree (id_auditoria);


--
-- Name: idx_notif_sup_directivo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_sup_directivo ON public.notificacion_supervision USING btree (id_directivo);


--
-- Name: idx_notif_sup_leida; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_sup_leida ON public.notificacion_supervision USING btree (leida) WHERE (leida = false);


--
-- Name: idx_observacion_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_observacion_estudiante ON public.observacion_estudiante USING btree (id_estudiante);


--
-- Name: idx_password_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_solicitud_traslado_destino; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitud_traslado_destino ON public.solicitud_traslado USING btree (id_colegio_destino);


--
-- Name: idx_solicitud_traslado_origen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitud_traslado_origen ON public.solicitud_traslado USING btree (id_colegio_origen);


--
-- Name: idx_solicitud_traslado_usr; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitud_traslado_usr ON public.solicitud_traslado USING btree (id_usuario);


--
-- Name: idx_tickets_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_codigo ON public.tickets_soporte USING btree (codigo_ticket);


--
-- Name: idx_tickets_colegio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_colegio ON public.tickets_soporte USING btree (id_colegio);


--
-- Name: idx_tickets_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_estado ON public.tickets_soporte USING btree (estado);


--
-- Name: idx_tickets_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_usuario ON public.tickets_soporte USING btree (id_usuario);


--
-- Name: idx_token_blacklist_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_token_blacklist_expires_at ON public.token_blacklist USING btree (expires_at);


--
-- Name: idx_traslado_aprobacion_sol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_traslado_aprobacion_sol ON public.traslado_aprobacion USING btree (id_solicitud);


--
-- Name: idx_usuario_colegio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_colegio ON public.usuario USING btree (id_colegio);


--
-- Name: idx_usuario_colegio_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_colegio_activo ON public.usuario_colegio USING btree (id_usuario, id_colegio) WHERE ((estado)::text = 'ACTIVO'::text);


--
-- Name: idx_usuario_colegio_col; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_colegio_col ON public.usuario_colegio USING btree (id_colegio);


--
-- Name: idx_usuario_colegio_usr; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_colegio_usr ON public.usuario_colegio USING btree (id_usuario);


--
-- Name: idx_usuario_documento; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_documento ON public.usuario USING btree (documento);


--
-- Name: idx_usuario_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_email ON public.usuario USING btree (email);


--
-- Name: idx_usuario_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_estado ON public.usuario USING btree (estado);


--
-- Name: registro_asistencia trg_bloquear_asistencia_periodo; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bloquear_asistencia_periodo BEFORE INSERT OR DELETE OR UPDATE ON public.registro_asistencia FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_periodo_cerrado();


--
-- Name: notas_actividad trg_bloquear_notas_periodo; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bloquear_notas_periodo BEFORE INSERT OR DELETE OR UPDATE ON public.notas_actividad FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_periodo_cerrado();


--
-- Name: observacion_estudiante trg_bloquear_observacion_periodo; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bloquear_observacion_periodo BEFORE INSERT OR DELETE OR UPDATE ON public.observacion_estudiante FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_periodo_cerrado();


--
-- Name: actividad_materia trg_prevent_closed_actividad_materia; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_closed_actividad_materia BEFORE INSERT OR DELETE OR UPDATE ON public.actividad_materia FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();


--
-- Name: criterio_evaluacion trg_prevent_closed_criterio_evaluacion; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_closed_criterio_evaluacion BEFORE INSERT OR DELETE OR UPDATE ON public.criterio_evaluacion FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();


--
-- Name: nota_criterio trg_prevent_closed_nota_criterio; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_closed_nota_criterio BEFORE INSERT OR DELETE OR UPDATE ON public.nota_criterio FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();


--
-- Name: notas_actividad trg_prevent_closed_notas_actividad; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_closed_notas_actividad BEFORE INSERT OR DELETE OR UPDATE ON public.notas_actividad FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();


--
-- Name: observacion_estudiante trg_prevent_closed_observacion_estudiante; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_closed_observacion_estudiante BEFORE INSERT OR DELETE OR UPDATE ON public.observacion_estudiante FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();


--
-- Name: registro_asistencia trg_prevent_closed_registro_asistencia; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_closed_registro_asistencia BEFORE INSERT OR DELETE OR UPDATE ON public.registro_asistencia FOR EACH ROW EXECUTE FUNCTION public.trg_check_subject_not_closed();


--
-- Name: auditoria_acciones_realizadas trg_proteger_acciones; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_proteger_acciones BEFORE DELETE OR UPDATE ON public.auditoria_acciones_realizadas FOR EACH ROW EXECUTE FUNCTION public.proteger_acciones_auditoria();


--
-- Name: auditoria_supervision trg_proteger_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_proteger_auditoria BEFORE DELETE OR UPDATE ON public.auditoria_supervision FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_finalizada();


--
-- Name: sancion trg_sync_estudiante_sancion; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_estudiante_sancion AFTER INSERT OR UPDATE ON public.sancion FOR EACH ROW EXECUTE FUNCTION public.fn_sync_estudiante_sancion();


--
-- Name: actividad_evidencia_dba actividad_evidencia_dba_id_actividadmateria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_evidencia_dba
    ADD CONSTRAINT actividad_evidencia_dba_id_actividadmateria_fkey FOREIGN KEY (id_actividadmateria) REFERENCES public.actividad_materia(id_actividadmateria) ON DELETE CASCADE;


--
-- Name: actividad_evidencia_dba actividad_evidencia_dba_id_evidencia_dba_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_evidencia_dba
    ADD CONSTRAINT actividad_evidencia_dba_id_evidencia_dba_fkey FOREIGN KEY (id_evidencia_dba) REFERENCES public.evidencias_dba(id_evidencia_dba) ON DELETE CASCADE;


--
-- Name: actividad_materia actividad_materia_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: actividad_materia actividad_materia_id_competencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_competencia_fkey FOREIGN KEY (id_competencia) REFERENCES public.competencias(id_competencia) ON DELETE CASCADE;


--
-- Name: actividad_materia actividad_materia_id_detallegrado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_detallegrado_fkey FOREIGN KEY (id_detallegrado) REFERENCES public.detalle_grados(id_detallegrado) ON DELETE CASCADE;


--
-- Name: actividad_materia actividad_materia_id_docente_creador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_docente_creador_fkey FOREIGN KEY (id_docente_creador) REFERENCES public.docente(id_docente);


--
-- Name: actividad_materia actividad_materia_id_evidencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_evidencia_fkey FOREIGN KEY (id_evidencia) REFERENCES public.evidencia_aprendizaje(id_evidencia) ON DELETE SET NULL;


--
-- Name: actividad_materia actividad_materia_id_periodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodo_academico(id_periodo);


--
-- Name: auditoria_acciones_realizadas auditoria_acciones_realizadas_id_auditoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_acciones_realizadas
    ADD CONSTRAINT auditoria_acciones_realizadas_id_auditoria_fkey FOREIGN KEY (id_auditoria) REFERENCES public.auditoria_supervision(id_auditoria);


--
-- Name: auditoria_supervision auditoria_supervision_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_supervision
    ADD CONSTRAINT auditoria_supervision_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: auditoria_supervision auditoria_supervision_id_directivo_aprobador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_supervision
    ADD CONSTRAINT auditoria_supervision_id_directivo_aprobador_fkey FOREIGN KEY (id_directivo_aprobador) REFERENCES public.directivo(id);


--
-- Name: auditoria_supervision auditoria_supervision_revocado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_supervision
    ADD CONSTRAINT auditoria_supervision_revocado_por_fkey FOREIGN KEY (revocado_por) REFERENCES public.directivo(id);


--
-- Name: anio_lectivo año_lectivo_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anio_lectivo
    ADD CONSTRAINT "año_lectivo_id_colegio_fkey" FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: cierre_materia cierre_materia_id_detallegrado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia
    ADD CONSTRAINT cierre_materia_id_detallegrado_fkey FOREIGN KEY (id_detallegrado) REFERENCES public.detalle_grados(id_detallegrado);


--
-- Name: cierre_materia cierre_materia_id_docente_cierre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia
    ADD CONSTRAINT cierre_materia_id_docente_cierre_fkey FOREIGN KEY (id_docente_cierre) REFERENCES public.docente(id_docente) ON DELETE SET NULL;


--
-- Name: cierre_materia cierre_materia_id_periodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia
    ADD CONSTRAINT cierre_materia_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodo_academico(id_periodo);


--
-- Name: colegio_version_curricular colegio_version_curricular_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colegio_version_curricular
    ADD CONSTRAINT colegio_version_curricular_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: competencias competencias_id_año_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT "competencias_id_año_fkey" FOREIGN KEY (id_anio) REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE;


--
-- Name: competencias competencias_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: competencias competencias_id_dimension_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_id_dimension_fkey FOREIGN KEY (id_dimension) REFERENCES public.dimensiones_preescolar(id_dimension) ON DELETE SET NULL;


--
-- Name: competencias competencias_id_grupo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES public.grupos(id_grupo) ON DELETE CASCADE;


--
-- Name: competencias competencias_id_materia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materias(id_materia) ON DELETE CASCADE;


--
-- Name: competencias competencias_id_periodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodo_academico(id_periodo) ON DELETE CASCADE;


--
-- Name: configuracion_colegio configuracion_colegio_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_colegio
    ADD CONSTRAINT configuracion_colegio_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: configuracion_inscripcion configuracion_inscripcion_id_año_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_inscripcion
    ADD CONSTRAINT "configuracion_inscripcion_id_año_fkey" FOREIGN KEY (id_anio) REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE;


--
-- Name: configuracion_inscripcion configuracion_inscripcion_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_inscripcion
    ADD CONSTRAINT configuracion_inscripcion_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: contrato_docente contrato_docente_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contrato_docente
    ADD CONSTRAINT contrato_docente_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: criterio_evaluacion criterio_evaluacion_id_actividadmateria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.criterio_evaluacion
    ADD CONSTRAINT criterio_evaluacion_id_actividadmateria_fkey FOREIGN KEY (id_actividadmateria) REFERENCES public.actividad_materia(id_actividadmateria) ON DELETE CASCADE;


--
-- Name: criterio_evaluacion criterio_evaluacion_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.criterio_evaluacion
    ADD CONSTRAINT criterio_evaluacion_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: criterio_evaluacion criterio_evaluacion_id_evidencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.criterio_evaluacion
    ADD CONSTRAINT criterio_evaluacion_id_evidencia_fkey FOREIGN KEY (id_evidencia) REFERENCES public.evidencia_aprendizaje(id_evidencia) ON DELETE SET NULL;


--
-- Name: dba_dimensiones_preescolar dba_dimensiones_preescolar_id_dba_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dba_dimensiones_preescolar
    ADD CONSTRAINT dba_dimensiones_preescolar_id_dba_fkey FOREIGN KEY (id_dba) REFERENCES public.dba(id_dba) ON DELETE CASCADE;


--
-- Name: dba_dimensiones_preescolar dba_dimensiones_preescolar_id_dimension_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dba_dimensiones_preescolar
    ADD CONSTRAINT dba_dimensiones_preescolar_id_dimension_fkey FOREIGN KEY (id_dimension) REFERENCES public.dimensiones_preescolar(id_dimension) ON DELETE CASCADE;


--
-- Name: decision_promocion_directivo decision_promocion_directivo_id_anio_anterior_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_promocion_directivo
    ADD CONSTRAINT decision_promocion_directivo_id_anio_anterior_fkey FOREIGN KEY (id_anio_anterior) REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE;


--
-- Name: decision_promocion_directivo decision_promocion_directivo_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_promocion_directivo
    ADD CONSTRAINT decision_promocion_directivo_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: decision_promocion_directivo decision_promocion_directivo_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_promocion_directivo
    ADD CONSTRAINT decision_promocion_directivo_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE;


--
-- Name: decision_promocion_directivo decision_promocion_directivo_id_grado_anterior_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_promocion_directivo
    ADD CONSTRAINT decision_promocion_directivo_id_grado_anterior_fkey FOREIGN KEY (id_grado_anterior) REFERENCES public.grados(id_grado) ON DELETE SET NULL;


--
-- Name: decision_promocion_directivo decision_promocion_directivo_id_grado_asignado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_promocion_directivo
    ADD CONSTRAINT decision_promocion_directivo_id_grado_asignado_fkey FOREIGN KEY (id_grado_asignado) REFERENCES public.grados(id_grado) ON DELETE SET NULL;


--
-- Name: desempeno desempeno_id_actividadmateria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.desempeno
    ADD CONSTRAINT desempeno_id_actividadmateria_fkey FOREIGN KEY (id_actividadmateria) REFERENCES public.actividad_materia(id_actividadmateria);


--
-- Name: desempeno desempeno_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.desempeno
    ADD CONSTRAINT desempeno_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: detalle_grados detalle_grados_id_anio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_grados
    ADD CONSTRAINT detalle_grados_id_anio_fkey FOREIGN KEY (id_anio) REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE;


--
-- Name: detalle_grados detalle_grados_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_grados
    ADD CONSTRAINT detalle_grados_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: detalle_grados detalle_grados_id_docente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_grados
    ADD CONSTRAINT detalle_grados_id_docente_fkey FOREIGN KEY (id_docente) REFERENCES public.docente(id_docente);


--
-- Name: detalle_grados detalle_grados_id_materia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_grados
    ADD CONSTRAINT detalle_grados_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materias(id_materia);


--
-- Name: detalle_padrefamilia detalle_padrefamilia_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_padrefamilia
    ADD CONSTRAINT detalle_padrefamilia_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: detalle_padrefamilia detalle_padrefamilia_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_padrefamilia
    ADD CONSTRAINT detalle_padrefamilia_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: detalle_padrefamilia detalle_padrefamilia_id_padrefamilia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_padrefamilia
    ADD CONSTRAINT detalle_padrefamilia_id_padrefamilia_fkey FOREIGN KEY (id_padrefamilia) REFERENCES public.padre_familia(id_padrefamilia);


--
-- Name: directivo directivo_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directivo
    ADD CONSTRAINT directivo_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: docente docente_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT docente_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: docente docente_id_contratodocente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT docente_id_contratodocente_fkey FOREIGN KEY (id_contratodocente) REFERENCES public.contrato_docente(id_contratodocente);


--
-- Name: documento_matriculas documento_matriculas_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documento_matriculas
    ADD CONSTRAINT documento_matriculas_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: documento_matriculas documento_matriculas_id_matricula_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documento_matriculas
    ADD CONSTRAINT documento_matriculas_id_matricula_fkey FOREIGN KEY (id_matricula) REFERENCES public.matricula(id_matricula);


--
-- Name: estudiante estudiante_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: evidencia_aprendizaje evidencia_aprendizaje_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_aprendizaje
    ADD CONSTRAINT evidencia_aprendizaje_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: evidencia_aprendizaje evidencia_aprendizaje_id_competencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_aprendizaje
    ADD CONSTRAINT evidencia_aprendizaje_id_competencia_fkey FOREIGN KEY (id_competencia) REFERENCES public.competencias(id_competencia) ON DELETE CASCADE;


--
-- Name: evidencia_aprendizaje evidencia_aprendizaje_id_evidencia_dba_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_aprendizaje
    ADD CONSTRAINT evidencia_aprendizaje_id_evidencia_dba_fkey FOREIGN KEY (id_evidencia_dba) REFERENCES public.evidencias_dba(id_evidencia_dba) ON DELETE SET NULL;


--
-- Name: evidencias_dba evidencias_dba_id_dba_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencias_dba
    ADD CONSTRAINT evidencias_dba_id_dba_fkey FOREIGN KEY (id_dba) REFERENCES public.dba(id_dba) ON DELETE CASCADE;


--
-- Name: configuracion_sistema fk_config_base; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT fk_config_base FOREIGN KEY (id_config_base) REFERENCES public.configuracion_base(id_config_base);


--
-- Name: configuracion_sistema fk_configuracion_colegio; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT fk_configuracion_colegio FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: detalle_grados fk_detalle_grupo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detalle_grados
    ADD CONSTRAINT fk_detalle_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupos(id_grupo);


--
-- Name: grupos fk_grupo_colegio; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT fk_grupo_colegio FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: grupos fk_grupo_jornada; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT fk_grupo_jornada FOREIGN KEY (id_jornada) REFERENCES public.jornada(id_jornada);


--
-- Name: grupos fk_grupo_nivel; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT fk_grupo_nivel FOREIGN KEY (id_nivel) REFERENCES public.nivel_escolar(id_nivel);


--
-- Name: grupos fk_grupo_seccion; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT fk_grupo_seccion FOREIGN KEY (id_seccion) REFERENCES public.secciones(id_seccion);


--
-- Name: grupos fk_grupos_tipo_grado; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT fk_grupos_tipo_grado FOREIGN KEY (id_tipo_grado) REFERENCES public.tipo_grado(id_tipo_grado);


--
-- Name: matricula fk_matricula_anio; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT fk_matricula_anio FOREIGN KEY (id_anio) REFERENCES public.anio_lectivo(id_anio) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matricula fk_matricula_estudiante; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT fk_matricula_estudiante FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matricula fk_matricula_grupo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT fk_matricula_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupos(id_grupo);


--
-- Name: tipo_grado fk_tipo_grado_nivel; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_grado
    ADD CONSTRAINT fk_tipo_grado_nivel FOREIGN KEY (id_nivel) REFERENCES public.nivel_escolar(id_nivel);


--
-- Name: grupos grupos_id_docente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_id_docente_fkey FOREIGN KEY (id_docente) REFERENCES public.docente(id_docente);


--
-- Name: jornada jornada_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jornada
    ADD CONSTRAINT jornada_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: materias materias_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: matricula matricula_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT matricula_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: matricula matricula_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT matricula_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE;


--
-- Name: matricula matricula_id_nivel_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT matricula_id_nivel_fkey FOREIGN KEY (id_nivel) REFERENCES public.nivel_escolar(id_nivel);


--
-- Name: matricula matricula_id_ticket_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT matricula_id_ticket_fkey FOREIGN KEY (id_ticket) REFERENCES public.tickets_soporte(id_ticket) ON DELETE SET NULL;


--
-- Name: nivel_escolar nivel_escolar_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nivel_escolar
    ADD CONSTRAINT nivel_escolar_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: nota_criterio nota_criterio_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nota_criterio
    ADD CONSTRAINT nota_criterio_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: nota_criterio nota_criterio_id_criterio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nota_criterio
    ADD CONSTRAINT nota_criterio_id_criterio_fkey FOREIGN KEY (id_criterio) REFERENCES public.criterio_evaluacion(id_criterio) ON DELETE CASCADE;


--
-- Name: nota_criterio nota_criterio_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nota_criterio
    ADD CONSTRAINT nota_criterio_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE;


--
-- Name: notas_actividad notas_actividad_id_actividadmateria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_actividad
    ADD CONSTRAINT notas_actividad_id_actividadmateria_fkey FOREIGN KEY (id_actividadmateria) REFERENCES public.actividad_materia(id_actividadmateria) ON DELETE CASCADE;


--
-- Name: notas_actividad notas_actividad_id_escalavaloracion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_actividad
    ADD CONSTRAINT notas_actividad_id_escalavaloracion_fkey FOREIGN KEY (id_escalavaloracion) REFERENCES public.escala_valoracion(id_escalavaloracion);


--
-- Name: notas_actividad notas_actividad_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_actividad
    ADD CONSTRAINT notas_actividad_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE;


--
-- Name: notificacion_colegio notificacion_colegio_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion_colegio
    ADD CONSTRAINT notificacion_colegio_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: notificacion_colegio notificacion_colegio_id_directivo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion_colegio
    ADD CONSTRAINT notificacion_colegio_id_directivo_fkey FOREIGN KEY (id_directivo) REFERENCES public.directivo(id);


--
-- Name: notificacion_supervision notificacion_supervision_id_auditoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion_supervision
    ADD CONSTRAINT notificacion_supervision_id_auditoria_fkey FOREIGN KEY (id_auditoria) REFERENCES public.auditoria_supervision(id_auditoria);


--
-- Name: notificacion_supervision notificacion_supervision_id_directivo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion_supervision
    ADD CONSTRAINT notificacion_supervision_id_directivo_fkey FOREIGN KEY (id_directivo) REFERENCES public.directivo(id);


--
-- Name: observacion_estudiante observacion_estudiante_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.observacion_estudiante
    ADD CONSTRAINT observacion_estudiante_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: observacion_estudiante observacion_estudiante_id_detallegrado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.observacion_estudiante
    ADD CONSTRAINT observacion_estudiante_id_detallegrado_fkey FOREIGN KEY (id_detallegrado) REFERENCES public.detalle_grados(id_detallegrado);


--
-- Name: observacion_estudiante observacion_estudiante_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.observacion_estudiante
    ADD CONSTRAINT observacion_estudiante_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: observacion_estudiante observacion_estudiante_id_periodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.observacion_estudiante
    ADD CONSTRAINT observacion_estudiante_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodo_academico(id_periodo);


--
-- Name: padre_familia padre_familia_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.padre_familia
    ADD CONSTRAINT padre_familia_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: periodo_academico periodo_academico_id_año_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodo_academico
    ADD CONSTRAINT "periodo_academico_id_año_fkey" FOREIGN KEY (id_anio) REFERENCES public.anio_lectivo(id_anio);


--
-- Name: periodo_academico periodo_academico_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodo_academico
    ADD CONSTRAINT periodo_academico_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: registro_asistencia registro_asistencia_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_asistencia
    ADD CONSTRAINT registro_asistencia_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: registro_asistencia registro_asistencia_id_detallegrado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_asistencia
    ADD CONSTRAINT registro_asistencia_id_detallegrado_fkey FOREIGN KEY (id_detallegrado) REFERENCES public.detalle_grados(id_detallegrado);


--
-- Name: registro_asistencia registro_asistencia_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_asistencia
    ADD CONSTRAINT registro_asistencia_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: registro_graduados registro_graduados_id_año_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_graduados
    ADD CONSTRAINT "registro_graduados_id_año_fkey" FOREIGN KEY (id_anio) REFERENCES public.anio_lectivo(id_anio);


--
-- Name: registro_graduados registro_graduados_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_graduados
    ADD CONSTRAINT registro_graduados_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE;


--
-- Name: resultado_academico resultado_academico_id_detallegrado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultado_academico
    ADD CONSTRAINT resultado_academico_id_detallegrado_fkey FOREIGN KEY (id_detallegrado) REFERENCES public.detalle_grados(id_detallegrado);


--
-- Name: resultado_academico resultado_academico_id_docente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultado_academico
    ADD CONSTRAINT resultado_academico_id_docente_fkey FOREIGN KEY (id_docente) REFERENCES public.docente(id_docente);


--
-- Name: resultado_academico resultado_academico_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultado_academico
    ADD CONSTRAINT resultado_academico_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: resultado_academico resultado_academico_id_periodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultado_academico
    ADD CONSTRAINT resultado_academico_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodo_academico(id_periodo);


--
-- Name: sancion sancion_id_directivo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sancion
    ADD CONSTRAINT sancion_id_directivo_fkey FOREIGN KEY (id_directivo) REFERENCES public.directivo(id) ON DELETE CASCADE;


--
-- Name: sancion sancion_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sancion
    ADD CONSTRAINT sancion_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE;


--
-- Name: sancion sancion_id_tipo_sancion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sancion
    ADD CONSTRAINT sancion_id_tipo_sancion_fkey FOREIGN KEY (id_tipo_sancion) REFERENCES public.tipo_sancion(id_tipo_sancion);


--
-- Name: solicitud_traslado solicitud_traslado_id_colegio_destino_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_traslado
    ADD CONSTRAINT solicitud_traslado_id_colegio_destino_fkey FOREIGN KEY (id_colegio_destino) REFERENCES public.colegio(id_colegio);


--
-- Name: solicitud_traslado solicitud_traslado_id_colegio_origen_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_traslado
    ADD CONSTRAINT solicitud_traslado_id_colegio_origen_fkey FOREIGN KEY (id_colegio_origen) REFERENCES public.colegio(id_colegio);


--
-- Name: solicitud_traslado solicitud_traslado_id_matricula_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_traslado
    ADD CONSTRAINT solicitud_traslado_id_matricula_fkey FOREIGN KEY (id_matricula) REFERENCES public.matricula(id_matricula) ON DELETE SET NULL;


--
-- Name: tickets_soporte tickets_soporte_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: tickets_soporte tickets_soporte_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante) ON DELETE SET NULL;


--
-- Name: traslado_aprobacion traslado_aprobacion_id_solicitud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traslado_aprobacion
    ADD CONSTRAINT traslado_aprobacion_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitud_traslado(id_solicitud) ON DELETE CASCADE;


--
-- Name: usuario usuario_baneado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_baneado_por_fkey FOREIGN KEY (baneado_por) REFERENCES public.usuario(id_usuario);


--
-- Name: usuario_colegio usuario_colegio_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_colegio
    ADD CONSTRAINT usuario_colegio_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: usuario usuario_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: usuario usuario_id_tipodocumento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_tipodocumento_fkey FOREIGN KEY (id_tipodocumento) REFERENCES public.tipo_documento(id_tipodocumento);


--
-- Name: usuario_rol usuario_rol_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT usuario_rol_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol) ON DELETE CASCADE;


--
-- Name: usuario_rol usuario_rol_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT usuario_rol_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict zDX5x9zZracLWS7JnKfnftXBRIEg1ceSFPgl0FKAcvCNjDhKc7qOMC3hre0k8f0

