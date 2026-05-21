--
-- PostgreSQL database dump
--

\restrict 7KOkj9ETEF7ogvo5PcnQrjr3W7e22bF7gWkDgIcu8r2X1toXgR0fBupdMyqwa08

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

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
    'RETIRADO'
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
    'RECHAZADA'
);


ALTER TYPE public.estado_matricula OWNER TO postgres;

--
-- Name: estado_periodo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_periodo AS ENUM (
    'ABIERTO',
    'CERRADO'
);


ALTER TYPE public.estado_periodo OWNER TO postgres;

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
-- Name: tipo_jornada; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_jornada AS ENUM (
    'MAÑANA',
    'TARDE',
    'NOCTURNA',
    'UNICA'
);


ALTER TYPE public.tipo_jornada OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actividad_materia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actividad_materia (
    id_actividadmateria integer NOT NULL,
    id_detallegrado integer NOT NULL,
    id_periodo integer NOT NULL,
    nombre character varying(255) NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    id_colegio integer NOT NULL
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
-- Name: año_lectivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."año_lectivo" (
    "id_año" integer NOT NULL,
    calendario character(1),
    id_colegio integer NOT NULL
);


ALTER TABLE public."año_lectivo" OWNER TO postgres;

--
-- Name: año_lectivo_id_año_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."año_lectivo_id_año_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."año_lectivo_id_año_seq" OWNER TO postgres;

--
-- Name: año_lectivo_id_año_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."año_lectivo_id_año_seq" OWNED BY public."año_lectivo"."id_año";


--
-- Name: cierre_materia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cierre_materia (
    id_cierremateria integer NOT NULL,
    id_detallegrado integer NOT NULL,
    id_periodo integer NOT NULL,
    estado public.estado_cierre_materia NOT NULL,
    fecha_cierre timestamp with time zone NOT NULL
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
    dane character varying(100) NOT NULL
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
    id_grupo integer
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
-- Name: directivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directivo (
    id integer NOT NULL,
    id_colegio integer NOT NULL,
    id_usuario integer
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
    documento character varying(255) NOT NULL,
    id_tipodocumento integer NOT NULL,
    id_contratodocente integer,
    id_colegio integer NOT NULL,
    id_usuario integer
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
    estado character varying(20) NOT NULL,
    fecha timestamp with time zone NOT NULL,
    id_colegio integer NOT NULL
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
    documento character varying(12),
    codigo character varying(20) NOT NULL,
    id_tipodocumento integer,
    id_nivel integer,
    id_colegio integer NOT NULL,
    id_usuario integer
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
    "id_año" integer NOT NULL,
    estado public.estado_matricula NOT NULL,
    correo_padre character varying(100),
    tiene_discapacidad boolean DEFAULT false,
    es_extranjero boolean DEFAULT false,
    token_seguimiento uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    id_grupo integer
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
    id_colegio integer NOT NULL
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
    documeno character varying(10) NOT NULL,
    id_tipodocumento integer NOT NULL,
    id_colegio integer NOT NULL,
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
-- Name: periodo_academico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.periodo_academico (
    id_periodo integer NOT NULL,
    nombre character varying(100) NOT NULL,
    estado public.estado_periodo NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    "id_año" integer,
    id_colegio integer NOT NULL
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
    estado character varying(255) NOT NULL,
    id_colegio integer NOT NULL
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
-- Name: usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    nombre character varying(255) NOT NULL,
    apellido character varying(255),
    id_colegio integer,
    activo boolean DEFAULT true,
    fecha_creacion timestamp with time zone DEFAULT now()
);


ALTER TABLE public.usuario OWNER TO postgres;

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
    count(*) FILTER (WHERE ((estado)::text = 'AUSENTE'::text)) AS ausentes
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
    ((p.promedio_raw / NULLIF(max(ev.valor_maximo), (0)::numeric)) * (5)::numeric) AS promedio_normalizado
   FROM (public.vw_promedio_estudiante_periodo p
     JOIN public.escala_valoracion ev ON ((ev.id_colegio = p.id_colegio)))
  GROUP BY p.id_estudiante, p.id_periodo, p.id_colegio, p.promedio_raw;


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
-- Name: año_lectivo id_año; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."año_lectivo" ALTER COLUMN "id_año" SET DEFAULT nextval('public."año_lectivo_id_año_seq"'::regclass);


--
-- Name: cierre_materia id_cierremateria; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia ALTER COLUMN id_cierremateria SET DEFAULT nextval('public.cierre_materia_id_cierremateria_seq'::regclass);


--
-- Name: colegio id_colegio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colegio ALTER COLUMN id_colegio SET DEFAULT nextval('public.colegio_id_colegio_seq'::regclass);


--
-- Name: configuracion_base id_config_base; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_base ALTER COLUMN id_config_base SET DEFAULT nextval('public.configuracion_base_id_config_base_seq'::regclass);


--
-- Name: configuracion_sistema id_configuracion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_sistema ALTER COLUMN id_configuracion SET DEFAULT nextval('public.configuracion_sistema_id_configuracion_seq'::regclass);


--
-- Name: contrato_docente id_contratodocente; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contrato_docente ALTER COLUMN id_contratodocente SET DEFAULT nextval('public.contrato_docente_id_contratodocente_seq'::regclass);


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
-- Name: escala_valoracion id_escalavaloracion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_valoracion ALTER COLUMN id_escalavaloracion SET DEFAULT nextval('public.escala_valoracion_id_escalavaloracion_seq'::regclass);


--
-- Name: estudiante id_estudiante; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estudiante ALTER COLUMN id_estudiante SET DEFAULT nextval('public.estudiante_id_estudiante_seq'::regclass);


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
-- Name: periodo_academico id_periodo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodo_academico ALTER COLUMN id_periodo SET DEFAULT nextval('public.periodo_academico_id_periodo_seq'::regclass);


--
-- Name: registro_asistencia id_registroasistencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registro_asistencia ALTER COLUMN id_registroasistencia SET DEFAULT nextval('public.registro_asistencia_id_registroasistencia_seq'::regclass);


--
-- Name: resultado_academico id_resultado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultado_academico ALTER COLUMN id_resultado SET DEFAULT nextval('public.resultado_academico_id_resultado_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol ALTER COLUMN id_rol SET DEFAULT nextval('public.rol_id_rol_seq'::regclass);


--
-- Name: secciones id_seccion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.secciones ALTER COLUMN id_seccion SET DEFAULT nextval('public.secciones_id_seccion_seq'::regclass);


--
-- Name: tipo_documento id_tipodocumento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_documento ALTER COLUMN id_tipodocumento SET DEFAULT nextval('public.tipo_documento_id_tipodocumento_seq'::regclass);


--
-- Name: tipo_grado id_tipo_grado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_grado ALTER COLUMN id_tipo_grado SET DEFAULT nextval('public.tipo_grado_tabla_id_tipo_grado_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);


--
-- Name: actividad_materia actividad_materia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_pkey PRIMARY KEY (id_actividadmateria);


--
-- Name: año_lectivo año_lectivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."año_lectivo"
    ADD CONSTRAINT "año_lectivo_pkey" PRIMARY KEY ("id_año");


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
-- Name: docente docente_documento_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT docente_documento_key UNIQUE (documento);


--
-- Name: docente docente_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT docente_id_usuario_key UNIQUE (id_usuario);


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
-- Name: notas_actividad notas_actividad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_actividad
    ADD CONSTRAINT notas_actividad_pkey PRIMARY KEY (id_notaactividad);


--
-- Name: observacion_estudiante observacion_estudiante_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.observacion_estudiante
    ADD CONSTRAINT observacion_estudiante_pkey PRIMARY KEY (id_observacion);


--
-- Name: padre_familia padre_familia_documeno_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.padre_familia
    ADD CONSTRAINT padre_familia_documeno_key UNIQUE (documeno);


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
-- Name: configuracion_sistema unique_configuracion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT unique_configuracion UNIQUE (id_colegio, clave);


--
-- Name: tipo_grado uq_tipo_grado; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_grado
    ADD CONSTRAINT uq_tipo_grado UNIQUE (nombre, id_nivel);


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
-- Name: idx_asistencia_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_estudiante ON public.registro_asistencia USING btree (id_estudiante);


--
-- Name: idx_grupos_tipo_grado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grupos_tipo_grado ON public.grupos USING btree (id_tipo_grado);


--
-- Name: idx_matricula_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matricula_estudiante ON public.matricula USING btree (id_estudiante);


--
-- Name: idx_notas_actividad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notas_actividad ON public.notas_actividad USING btree (id_actividadmateria);


--
-- Name: idx_notas_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notas_estudiante ON public.notas_actividad USING btree (id_estudiante);


--
-- Name: idx_observacion_estudiante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_observacion_estudiante ON public.observacion_estudiante USING btree (id_estudiante);


--
-- Name: idx_usuario_colegio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_colegio ON public.usuario USING btree (id_colegio);


--
-- Name: idx_usuario_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_email ON public.usuario USING btree (email);


--
-- Name: actividad_materia actividad_materia_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


--
-- Name: actividad_materia actividad_materia_id_detallegrado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_detallegrado_fkey FOREIGN KEY (id_detallegrado) REFERENCES public.detalle_grados(id_detallegrado) ON DELETE CASCADE;


--
-- Name: actividad_materia actividad_materia_id_periodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actividad_materia
    ADD CONSTRAINT actividad_materia_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodo_academico(id_periodo);


--
-- Name: año_lectivo año_lectivo_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."año_lectivo"
    ADD CONSTRAINT "año_lectivo_id_colegio_fkey" FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


--
-- Name: cierre_materia cierre_materia_id_detallegrado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia
    ADD CONSTRAINT cierre_materia_id_detallegrado_fkey FOREIGN KEY (id_detallegrado) REFERENCES public.detalle_grados(id_detallegrado);


--
-- Name: cierre_materia cierre_materia_id_periodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierre_materia
    ADD CONSTRAINT cierre_materia_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodo_academico(id_periodo);


--
-- Name: contrato_docente contrato_docente_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contrato_docente
    ADD CONSTRAINT contrato_docente_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


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
-- Name: docente docente_id_tipodocumento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT docente_id_tipodocumento_fkey FOREIGN KEY (id_tipodocumento) REFERENCES public.tipo_documento(id_tipodocumento);


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
-- Name: estudiante estudiante_id_tipodocumento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_id_tipodocumento_fkey FOREIGN KEY (id_tipodocumento) REFERENCES public.tipo_documento(id_tipodocumento);


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
    ADD CONSTRAINT fk_matricula_anio FOREIGN KEY ("id_año") REFERENCES public."año_lectivo"("id_año") ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: matricula matricula_id_año_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT "matricula_id_año_fkey" FOREIGN KEY ("id_año") REFERENCES public."año_lectivo"("id_año");


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
-- Name: nivel_escolar nivel_escolar_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nivel_escolar
    ADD CONSTRAINT nivel_escolar_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio) ON DELETE CASCADE;


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
-- Name: padre_familia padre_familia_id_tipodocumento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.padre_familia
    ADD CONSTRAINT padre_familia_id_tipodocumento_fkey FOREIGN KEY (id_tipodocumento) REFERENCES public.tipo_documento(id_tipodocumento);


--
-- Name: periodo_academico periodo_academico_id_año_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodo_academico
    ADD CONSTRAINT "periodo_academico_id_año_fkey" FOREIGN KEY ("id_año") REFERENCES public."año_lectivo"("id_año");


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
-- Name: usuario usuario_id_colegio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES public.colegio(id_colegio);


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

\unrestrict 7KOkj9ETEF7ogvo5PcnQrjr3W7e22bF7gWkDgIcu8r2X1toXgR0fBupdMyqwa08

