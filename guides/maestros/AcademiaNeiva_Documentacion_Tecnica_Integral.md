# AcademiaNeiva — Documentación Técnica Integral

---

## Portada

**Sistema de Gestión Académica Institucional Multitenant — AcademiaNeiva**
**Documento Maestro de Arquitectura, Especificaciones Funcionales y de Ingeniería de Software**
**Versión:** 2.5.0
**Fecha:** 16 de Agosto de 2026
**Autor:** Equipo de Desarrollo, Arquitectura e Ingeniería de Software & Lead Functional Analyst
**Estado:** Aprobado — Documento Maestro

---

## Historial de Versiones

| Versión | Fecha      | Autor                                 | Cambios y Descripciones                                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-01-15 | Equipo de Arquitectura                | Inicialización de la arquitectura base, modelo relacional multitenant y autenticación JWT con control de roles.                                                                                                                                                                                                                                         |
| 1.5.0   | 2026-04-10 | Equipo de Desarrollo                  | Incorporación del módulo de Supervisión con Aprobación de Directivos, temporizadores de sesión y Catálogo Nacional DBA.                                                                                                                                                                                                                                 |
| 2.0.0   | 2026-07-21 | Equipo de Desarrollo                  | Reestructuración modular integral en 16 módulos con trazabilidad a Historias de Usuario, Reglas de Negocio e Inmutabilidad de Auditorías SQL.                                                                                                                                                                                                           |
| 2.1.0   | 2026-08-04 | Equipo de Desarrollo                  | Inclusión de Reglas de Negocio de Asistencia (Hora Tarde y ZT Bogotá), Regla de Turnos en Soporte (Ping-Pong) y Exclusión Operativa de Periodos Pendientes con excepción en Competencias DBA.                                                                                                                                                           |
| 2.5.0   | 2026-08-16 | Senior Functional Analyst & Tech Lead | Expansión a 21 módulos funcionales (incorporando Módulo 20: Seguimiento Académico por Directivo y Módulo 21: Flujo de Correos y OTP). Estandarización de Kysely Query Builder para tipado estático SQL, validación de DTOs con Zod, filtrado de supervisión por año lectivo, captura de teléfono y aislamiento de seguridad en credenciales de usuario. |

---

## Tabla de Contenido

- [1. Introducción](#1-introducción)
- [2. Descripción General](#2-descripción-general)
- [3. Arquitectura del Sistema](#3-arquitectura-del-sistema)
- [4. Resumen de Módulos del Sistema (21 Módulos)](#4-resumen-de-módulos-del-sistema-21-módulos)
- [5. Modelo de Datos Relacional](#5-modelo-de-datos-relacional)
- [6. Esquema de Seguridad y Control de Acceso](#6-esquema-de-seguridad-y-control-de-acceso)
- [7. Reglas Globales del Sistema](#7-reglas-globales-del-sistema)
- [8. Flujos Principales de Operación](#8-flujos-principales-de-operación)
- [9. Convenciones y Estándares de Código](#9-convenciones-y-estándares-de-código)
- [10. Stack Tecnológico](#10-stack-tecnológico)
- [11. Guía de Instalación y Configuración Local](#11-guía-de-instalación-y-configuración-local)
- [12. Especificaciones para Despliegue](#12-especificaciones-para-despliegue)
- [13. Matriz de Referencias y Enlaces Modulares](#13-matriz-de-referencias-y-enlaces-modulares)

---

## 1. Introducción

### Objetivo

El presente documento constituye el **Documento Maestro de Arquitectura, Especificaciones Funcionales e Integrales de Software** de **AcademiaNeiva**. Su propósito es ofrecer una visión holística, consolidada y de alto nivel sobre la arquitectura de software, patrones de diseño, modelo relacional, mecanismos de seguridad, validación de esquemas e interacción entre los **21 módulos funcionales** que componen la plataforma.

### Alcance

Este manual cubre la totalidad de las capas del sistema:

- **Capa de Presentación**: Single Page Application (SPA) construida con Vue 3 (Composition API) y TypeScript.
- **Capa de Validación y Control**: Middlewares de autenticación JWT, interceptores de auditoría inmutable, validadores de esquema Zod y controladores REST en Node.js/Express.
- **Capa de Acceso a Datos**: Query Builder tipado Kysely con esquemas generados en `db.types.ts` y pool PostgreSQL con triggers en PL/pgSQL.
- **Capa de Servicios**: Servicios desacoplados de notificaciones, verificación OTP, exportación PDF y sincronización curricular.

### Público Objetivo

- **Arquitectos de Software y Líderes Técnicos**: Para entender los límites entre módulos y los patrones de integración.
- **Analistas Funcionales y de Negocio**: Para validar la cobertura de reglas de negocio, requerimientos del MEN y flujos escolares.
- **Desarrolladores Fullstack**: Para implementar y mantener funcionalidades conservando las convenciones de código y tipado.
- **Auditores y Administradores de TI**: Para validar la seguridad, el aislamiento multitenant y la trazabilidad inmutable de eventos.

---

## 2. Descripción General

**AcademiaNeiva** es una plataforma integral de gestión académica en la nube orientada a instituciones de educación preescolar, básica y media. El sistema resuelve de manera centralizada el ciclo de vida escolar: desde la inscripción pública de aspirantes con verificación OTP y captura de contacto, pasando por la gestión de docentes, toma de asistencias con límites diarios, planeación alineada con los Derechos Básicos de Aprendizaje (DBA), evaluación por competencias, seguimiento y promoción conforme al Decreto 1290 de 2009, hasta la consolidación de boletines oficiales PDF, traslados intercolegiados y soporte técnico con mesa de ayuda.

### Objetivos Principales

- **Aislamiento Multitenant**: Permitir que múltiples colegios compartan la misma infraestructura conservando una separación estricta de sus bases de datos y configuraciones mediante discriminadores `id_colegio`.
- **Integridad de Datos e Inmutabilidad**: Garantizar que los periodos cerrados y las auditorías de supervisión sean legalmente inmutables mediante controles redundantes en aplicación y triggers SQL.
- **Validación Estricta de Esquemas**: Implementar Zod en todas las fronteras de entrada para certificar que ningún dato mal formado o inseguro ingrese a la capa de persistencia.
- **Experiencia de Usuario Adaptativa**: Brindar tableros especializados para los 5 roles clave del ecosistema educativo, incluyendo el modo de seguimiento pedagógico directivo sin alteración de credenciales.

### Roles del Sistema

```
                       ┌─────────────────────────┐
                       │   ADMINISTRADOR GENERAL  │ (Superadministración & Auditoría)
                       └────────────┬────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │       DIRECTIVO       │ (Rectoría & Coordinación)
                        └───────────┬───────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│     DOCENTE     │        │   ESTUDIANTE    │        │ PADRE DE FAMILIA│
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

1. **Administrador General**: Control global de la plataforma, creación de colegios, mantenimiento del catálogo nacional DBA, supervisión extraordinaria y resolución de incidencias escaladas.
2. **Directivo (Rector / Coordinador)**: Administración académica del colegio, asignaciones docentes, cierres institucionales, aprobación de matrículas, traslados, seguimiento pedagógico a paneles de usuario y aprobación de supervisiones.
3. **Docente**: Registro de actividades evaluativas, competencias sincronizadas, observaciones y control diario de asistencia.
4. **Estudiante**: Portal personal de consulta de calificaciones, boletines oficiales, inasistencias y tareas.
5. **Padre de Familia / Acudiente**: Seguimiento interactivo del rendimiento, convivencia, asistencia y estado de matrícula de todos sus hijos vinculados.

---

## 3. Arquitectura del Sistema

El sistema sigue un patrón de **Arquitectura Desacoplada de Tres Capas** con separación estricta entre la capa de presentación (Frontend SPA), la capa de lógica de negocio (Backend REST API) y la capa de acceso a datos relacional (Kysely + PostgreSQL).

### Diagrama de Arquitectura de Capas

```mermaid
graph TD
    subgraph Frontend ["Capa de Presentación (Frontend SPA)"]
        UI["Vue 3 + TypeScript + Pinia"]
        Router["Vue Router (Route Guards & Role Check)"]
        YearStore["AcademicYearStore (Filtro Global de Ciclo Lectivo)"]
        CSS["Vanilla CSS + Dynamic Branding Variables"]
    end

    subgraph Middleware ["Capa de Control & Autenticación"]
        AuthMiddleware["verifyToken Middleware (JWT Validation con jti)"]
        AuditMiddleware["Supervision & Audit Interceptor (JSONB Deltas)"]
        RateLimit["Express Rate Limiter (IP Protection)"]
    end

    subgraph Backend ["Capa de Lógica de Negocio (Backend Express)"]
        Controllers["Express Controllers (21 Módulos)"]
        ZodSchemas["Zod Validation Layer (DTOs & Payload Sanitization)"]
        KyselyQB["Kysely Query Builder (Type-Safe SQL Builder)"]
        Services["Domain Services (Scheduler, Notifications, OTP, PDF)"]
    end

    subgraph Persistence ["Capa de Persistencia (PostgreSQL)"]
        DB[(PostgreSQL Database)]
        Triggers["SQL Triggers (Immutability & Sync)"]
        JSONB["JSONB Audit & Ticket Store"]
    end

    UI --> Router
    Router --> YearStore
    Router -->|HTTP REST Requests| RateLimit
    RateLimit --> AuthMiddleware
    AuthMiddleware --> AuditMiddleware
    AuditMiddleware --> ZodSchemas
    ZodSchemas --> Controllers
    Controllers --> KyselyQB
    Controllers --> Services
    KyselyQB --> DB
    Services --> DB
    DB --> Triggers
    Triggers --> JSONB
```

---

## 4. Resumen de Módulos del Sistema (21 Módulos)

| #      | Módulo                      | Descripción Sintetizada                                                   | Responsabilidad Principal                                                                                                        | Documento Técnico                                                                                                                                          |
| ------ | --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **01** | **Autenticación**           | Gestión de acceso y seguridad de tokens JWT.                              | Emisión de tokens con`jti`, blacklist y borrado global por `logged_out_at`.                                                      | [Ver Módulo 01](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/01_autenticacion/autenticacion.md)                                         |
| **02** | **Gestión de Colegios**     | Catálogo global e identidad de colegios.                                  | Altas por Admin General y branding dinámico (escudo/colores) por directivos.                                                     | [Ver Módulo 02](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/02_gestion_colegios/gestion_colegios.md)                                   |
| **03** | **Usuarios y Directivos**   | Administración global de cuentas de personal.                             | Vinculación/desvinculación de directivos y edición con ticket resuelto.                                                          | [Ver Módulo 03](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/03_usuarios_y_directivos/usuarios_y_directivos.md)                         |
| **04** | **Estructura Escolar**      | Configuración organizacional del colegio.                                 | Gestión jerárquica de Niveles, Grados, Grupos (cupos) y Materias.                                                                | [Ver Módulo 04](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/04_estructura_escolar/estructura_escolar.md)                               |
| **05** | **Docentes**                | Personal docente y carga académica.                                       | Registro de docentes con validación Zod, captura de teléfono y asignaciones en`detalle_grados`.                                  | [Ver Módulo 05](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/05_docentes/docentes.md)                                                   |
| **06** | **Matrículas**              | Portal público y oficialización de inscripciones.                         | Inscripción pública, verificación OTP de email, captura de teléfono, token UUID y reingresos.                                    | [Ver Módulo 06](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/06_matriculas/matriculas.md)                                               |
| **07** | **Estudiantes**             | Ciclo de vida y sanciones disciplinarias.                                 | Control de estados (`ACTIVO`, `RETIRADO`, `EXPULSADO`), suspensiones y portales.                                                 | [Ver Módulo 07](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/07_estudiantes_y_estados/estudiantes_y_estados.md)                         |
| **08** | **Config. Académica**       | Parametrización temporal del año lectivo.                                 | Años lectivos, periodos, escalas de notas y bloqueos en periodos cerrados.                                                       | [Ver Módulo 08](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/08_configuracion_academica/configuracion_academica.md)                     |
| **09** | **Competencias**            | Planeación curricular y cursos paralelos.                                 | Registro de múltiples competencias y sincronización en caliente vía`sync_uuid`.                                                  | [Ver Módulo 09](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/09_competencias_y_sincronizacion/competencias_y_sincronizacion.md)         |
| **10** | **Catálogo DBA**            | Alineación con estándares del MEN.                                        | Integración del catálogo nacional DBA, exclusividad 1-to-1 y reporte de coherencia.                                              | [Ver Módulo 10](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/10_catalogo_dba/catalogo_dba.md)                                           |
| **11** | **Calificaciones**          | Evaluación continua de asignaturas.                                       | Planilla docente, desgloses por actividades/criterios y cálculo de promedios.                                                    | [Ver Módulo 11](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/11_calificaciones/calificaciones.md)                                       |
| **12** | **Observaciones**           | Registro formativo y disciplinario del alumno.                            | Anotaciones en observador y concatenación de la observación académica en boletines.                                              | [Ver Módulo 12](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/12_observaciones/observaciones.md)                                         |
| **13** | **Asistencia**              | Control de fallas y ausentismo.                                           | Planilla diaria con límite físico estricto de máximo 7 bloques de clase al día.                                                  | [Ver Módulo 13](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/13_asistencia/asistencia.md)                                               |
| **14** | **Cierre y Boletines**      | Consolidación final y reportes oficiales.                                 | Cierre institucional, consolidado en`resultado_academico` e impresión de PDF masivo.                                             | [Ver Módulo 14](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/14_cierre_y_boletines/cierre_y_boletines.md)                               |
| **15** | **Supervisión y Auditoría** | Acceso extraordinario del Admin General.                                  | Supervisión con re-autenticación del Rector, filtro por año lectivo y bitácoras inmutables SQL.                                  | [Ver Módulo 15](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/15_supervision_y_auditoria/supervision_y_auditoria.md)                     |
| **16** | **Soporte / Tickets**       | Mesa de ayuda e incidencias técnicas.                                     | Tickets con código Base36 ofuscado, regla de turnos (ping-pong) y selector de estados.                                           | [Ver Módulo 16](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/16_soporte_y_tickets/soporte_y_tickets.md)                                 |
| **17** | **Gestión de Padres**       | Administración de acudientes y supervisión multihijo.                     | Vinculación padre-estudiante, monitoreo de notas, observaciones y asistencia.                                                    | [Ver Módulo 17](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/17_gestion_padres/gestion_padres.md)                                       |
| **18** | **Gestión de Traslados**    | Traslados de matrículas e intercolegiados.                                | Solicitudes de traslado entre colegios, flujo de aprobación y transferencia de registro.                                         | [Ver Módulo 18](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/18_gestion_traslados/gestion_traslados.md)                                 |
| **19** | **Seguimiento y Promoción** | Rendimiento acumulativo, resultado anual y decisiones directivas.         | Seguimiento por período acumulado P1..PN, consolidado anual, advertencias en matrícula y registro de decisiones.                 | [Ver Módulo 19](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/19_seguimiento_y_promocion_academica/seguimiento_y_promocion_academica.md) |
| **20** | **Seguimiento Directivo**   | Inspección pedagógica y acompañamiento a usuarios por Rector/Coordinador. | Conmutación temporal de interfaz (`activeRole`), resolución ternaria de ID en modo solo lectura estricto y bloqueo de traslados. | [Ver Módulo 20](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/20_seguimiento_academico_directivo/seguimiento_academico_directivo.md)     |
| **21** | **Correos y OTP**           | Gestión centralizada de emails transaccionales y códigos OTP.             | Validación de correo en matrícula nueva, cambio de email en perfil con OTP de 6 dígitos (15 min) y reseteo de contraseñas.       | [Ver Módulo 21](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/21_flujo_correos_y_verificaciones/flujo_correos_y_verificaciones.md)       |

---

## 5. Modelo de Datos Relacional

La base de datos relacional PostgreSQL de **AcademiaNeiva** se compone de más de 48 tablas organizadas para aislar la información por `id_colegio` y mantener trazabilidad mediante tipos de datos fuertemente tipados.

### Diagrama Entidad-Relación de Tablas Principales

```mermaid
erDiagram
    COLEGIO ||--o{ USUARIO : posee
    COLEGIO ||--o{ GRUPOS : organiza
    COLEGIO ||--o{ MATERIAS : dicta
    COLEGIO ||--o{ ANIO_LECTIVO : parametriza
    USUARIO ||--o| DOCENTE : perfila
    USUARIO ||--o| ESTUDIANTE : perfila
    USUARIO ||--o| PADRE_FAMILIA : perfila
    GRUPOS ||--o{ MATRICULA : inscribe
    ESTUDIANTE ||--o{ MATRICULA : posee
    DOCENTE ||--o{ DETALLE_GRADOS : asigna
    MATERIAS ||--o{ DETALLE_GRADOS : pertenece
    GRUPOS ||--o{ DETALLE_GRADOS : pertenece
    DETALLE_GRADOS ||--o{ ACTIVIDAD_MATERIA : evalua
    ACTIVIDAD_MATERIA ||--o{ NOTAS_ACTIVIDAD : califica
    ESTUDIANTE ||--o{ NOTAS_ACTIVIDAD : obtiene
    PERIODO_ACADEMICO ||--o{ RESULTADO_ACADEMICO : consolida
    AUDITORIA_SUPERVISION ||--o{ AUDITORIA_ACCIONES_REALIZADAS : audita
```

---

## 6. Esquema de Seguridad y Control de Acceso

### Autenticación JWT y Blacklist

Cada usuario autenticado recibe un token JWT firmado con el algoritmo HS256. El payload incluye un identificador único denominado `jti`. Cuando una sesión es revocada o forzada a cerrar por el Administrador General, el `jti` se guarda en la tabla `token_blacklist`, rechazando cualquier intento posterior de navegación.

### Validación de Esquemas con Zod

Todas las solicitudes entrantes que mutan el estado del sistema (`POST`, `PUT`, `PATCH`) se validan contra esquemas estrictos de **Zod**. Los datos que no cumplan con el formato exigido (por ejemplo: patrones de teléfono de 7 a 20 dígitos, emails válidos, cadenas sin sanitizar) son rechazados tempranamente con código HTTP 400 antes de llegar a la capa de persistencia.

### Acceso a Base de Datos con Kysely Query Builder

Para evitar inyecciones SQL y garantizar la coherencia de columnas y tipos entre TypeScript y PostgreSQL, las consultas de negocio se implementan utilizando el query builder tipado **Kysely**. Toda relación entre tablas se valida en tiempo de compilación mediante `db.types.ts`.

### Control de Inmutabilidad por Triggers SQL

Para garantizar que los datos consolidados y las bitácoras de auditoría no sufran manipulaciones retroactivas, se implementan triggers a nivel de PostgreSQL:

1. `fn_bloquear_periodo_cerrado`: Aborta operaciones de escritura en calificaciones, observaciones o asistencias si el periodo académico correspondiente figura como `CERRADO`.
2. `proteger_acciones_auditoria`: Lanza excepciones SQL de base de datos impidiendo que sentencias `DELETE` o `UPDATE` eliminen o modifiquen los registros de supervisión.

### Aislamiento de Credenciales en el Perfil

El módulo de perfil personal (**Mi Cuenta**) está restringido para que los usuarios gestionen exclusivamente sus propias credenciales de acceso. La modificación o reseteo de contraseñas de terceros se encuentra delegada de manera segura al módulo administrativo institucional correspondiente con control de roles.

---

## 7. Reglas Globales del Sistema

1. **Aislamiento Multi-Tenant**: Toda consulta a nivel de colegio debe incluir el filtro implícito `WHERE id_colegio = req.user.schoolId`.
2. **Inmutabilidad de Periodos Cerrados**: Un periodo en estado `CERRADO` no puede recibir nuevas notas o asistencias a menos que exista una reapertura explícita del colegio.
3. **Regla de Límite Diario de Asistencia**: Ningún estudiante puede tener más de 7 bloques de clase de asistencia registrados en el mismo día.
4. **Token de Seguimiento Público UUID**: Las inscripciones públicas y correcciones de documentos usan tokens UUID seguros sin requerir login previo.
5. **Verificación Previa OTP**: Ninguna matrícula pública o cambio de correo en perfil puede consolidarse sin haber validado previamente el código OTP de 6 dígitos enviado al correo electrónico destinatario.
6. **Regla de Turnos en Soporte (Ping-Pong)**: En los tickets de soporte, un mismo usuario no puede enviar notas de observación consecutivas sin esperar la respuesta del destinatario.
7. **Filtrado por Año Lectivo en Auditoría**: Las sesiones de supervisión y bitácoras institucionales están estrictamente acotadas al año lectivo seleccionado en el panel de control directivo.

---

## 8. Flujos Principales de Operación

### Flujo Completo del Ciclo Lectivo

```mermaid
sequenceDiagram
    autonumber
    actor Padre as Padre / Aspirante
    actor Directivo
    actor Docente
    participant Sistema

    Padre->>Sistema: 1. Valida OTP de Correo Electrónico
    Padre->>Sistema: 2. Diligencia Inscripción Pública y Teléfono
    Directivo->>Sistema: 3. Valida Documentos y Oficializa Matrícula
    Sistema->>Sistema: 4. Crea Estudiante, Padre y Usuario Activo

    Directivo->>Sistema: 5. Realiza Asignación Académica (detalle_grados)
    Docente->>Sistema: 6. Planifica Competencias y dicta clases
    Docente->>Sistema: 7. Registra Asistencia Diaria y Calificaciones

    Docente->>Sistema: 8. Cierra Periodo por Materia
    Directivo->>Sistema: 9. Ejecuta Cierre Institucional de Colegio
    Sistema-->>Padre: 10. Emisión y Descarga de Boletín Oficial PDF
```

---

## 9. Convenciones y Estándares de Código

- **Identificadores de Archivos Funcionales**:
  - Historias de Usuario: `HU-[MODULO]-[001]` (ej. `HU-AUT-001`, `HU-MAT-002`, `HU-SEG-001`, `HU-COR-001`).
  - Reglas de Negocio: `RN-[MODULO]-[001]` (ej. `RN-CONF-002`, `RN-SOP-005`, `RN-SEG-006`, `RN-COR-001`).
- **Nomenclatura de Base de Datos**: Nombres de tablas y columnas en español en minúsculas con snake_case (ej. `detalle_grados`, `codigo_verificacion_email`, `id_colegio`).
- **Tipado Estático de Base de Datos**: Kysely sobre `db.types.ts` generado a partir del esquema PostgreSQL.
- **Validación DTO**: Esquemas Zod organizados en `backend/src/dtos/` con mensajes de error explícitos.
- **Tipos de Datos Sensibles**: Identificadores de seguimiento e inscripciones públicas en formato `UUIDv4`.

---

## 10. Stack Tecnológico

| Capa                 | Tecnología         | Versión / Detalle                                                              |
| -------------------- | ------------------ | ------------------------------------------------------------------------------ |
| **Frontend UI**      | Vue 3 + TypeScript | Single Page Application (Composition API, Script Setup)                        |
| **State Management** | Pinia              | Almacenamiento reactivo de sesión, roles, año lectivo y monitoreo              |
| **Routing**          | Vue Router         | Guardias de navegación, control de roles (`meta.roles`) y filtros de monitoreo |
| **Backend Runtime**  | Node.js + Express  | API RESTful desacoplada con TypeScript                                         |
| **Query Builder**    | Kysely             | Constructor de consultas SQL con tipado estático (`db.types.ts`)               |
| **Validación DTO**   | Zod                | Validación y sanitización estricta de esquemas de entrada                      |
| **Base de Datos**    | PostgreSQL         | Persistencia relacional con Triggers en PL/pgSQL y JSONB                       |
| **Mailing & OTP**    | Nodemailer         | Envío de correos transaccionales y códigos de verificación                     |
| **Archivos / Media** | Multer             | Almacenamiento local de escudos, documentos y evidencias                       |
| **Generación PDF**   | HTML2PDF / PDFKit  | Renderizado de Boletines Oficiales de Calificaciones                           |

---

## 11. Guía de Instalación y Configuración Local

### Requisitos Previos

- Node.js (v18 o superior)
- PostgreSQL (v14 o superior)
- Git

### Pasos para Ejecutar el Proyecto

1. **Clonar el repositorio**:

   ```bash
   git clone https://github.com/DanExl24/AcademiaNeiva.git
   cd segundoProyecto
   ```

2. **Configurar e iniciar el Backend**:

   ```bash
   cd backend
   npm install
   # Configurar variables en .env
   npm run dev
   ```

3. **Configurar e iniciar el Frontend**:

   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

---

## 12. Especificaciones para Despliegue

### Variables de Entorno Clave (`.env`)

```env
PORT=3000
DATABASE_URL=postgres://usuario:password@localhost:5432/academianeiva
JWT_SECRET=clave_secreta_de_firma_jwt_produccion
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@academianeiva.edu.co
SMTP_PASS=contraseña_aplicacion
```

---

## 13. Matriz de Referencias y Enlaces Modulares

Para consultar el detalle exhaustivo de historias de usuario, reglas de negocio, casos de uso y código fuente de cada componente, remítase a los módulos individuales:

- 🔐 **[Módulo 01: Autenticación y Sesiones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/01_autenticacion/autenticacion.md)**
- 🏫 **[Módulo 02: Gestión de Colegios](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/02_gestion_colegios/gestion_colegios.md)**
- 👥 **[Módulo 03: Usuarios y Directivos](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/03_usuarios_y_directivos/usuarios_y_directivos.md)**
- 🏗️ **[Módulo 04: Estructura Escolar](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/04_estructura_escolar/estructura_escolar.md)**
- 👩‍🏫 **[Módulo 05: Docentes y Asignación Académica](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/05_docentes/docentes.md)**
- 📋 **[Módulo 06: Matrículas e Inscripciones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/06_matriculas/matriculas.md)**
- 🎓 **[Módulo 07: Estudiantes y Estados](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/07_estudiantes_y_estados/estudiantes_y_estados.md)**
- ⚙️ **[Módulo 08: Configuración Académica](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/08_configuracion_academica/configuracion_academica.md)**
- 🔄 **[Módulo 09: Competencias y Sincronización](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/09_competencias_y_sincronizacion/competencias_y_sincronizacion.md)**
- 📚 **[Módulo 10: Catálogo DBA y Coherencia](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/10_catalogo_dba/catalogo_dba.md)**
- 📊 **[Módulo 11: Calificaciones y Actividades](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/11_calificaciones/calificaciones.md)**
- 📝 **[Módulo 12: Observaciones del Estudiante](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/12_observaciones/observaciones.md)**
- 📅 **[Módulo 13: Asistencia Escolar](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/13_asistencia/asistencia.md)**
- 📄 **[Módulo 14: Cierre y Boletines](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/14_cierre_y_boletines/cierre_y_boletines.md)**
- 🕵️ **[Módulo 15: Supervisión y Auditoría](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/15_supervision_y_auditoria/supervision_y_auditoria.md)**
- 🎟️ **[Módulo 16: Soporte y Tickets](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/16_soporte_y_tickets/soporte_y_tickets.md)**
- 👨‍👩‍👧‍👦 **[Módulo 17: Gestión de Padres de Familia](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/17_gestion_padres/gestion_padres.md)**
- 🔀 **[Módulo 18: Gestión de Traslados](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/18_gestion_traslados/gestion_traslados.md)**
- 🏅 **[Módulo 19: Seguimiento y Promoción Académica](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/19_seguimiento_y_promocion_academica/seguimiento_y_promocion_academica.md)**
- 👁️ **[Módulo 20: Seguimiento Académico a Usuarios por Directivo](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/20_seguimiento_academico_directivo/seguimiento_academico_directivo.md)**
- 📧 **[Módulo 21: Flujo de Correos Electrónicos y Verificaciones OTP](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/21_flujo_correos_y_verificaciones/flujo_correos_y_verificaciones.md)**
- 🌐 **[Reglas Generales y Transversales del Sistema](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/reglas_negocio_generales.md)**
