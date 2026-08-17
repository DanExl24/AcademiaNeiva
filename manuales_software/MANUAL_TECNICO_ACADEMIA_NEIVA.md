# 🛠️ MANUAL TÉCNICO — ACADEMIA NEIVA

**Sistema de Gestión Académica Institucional Multitenant — AcademiaNeiva**  
**Manual de Arquitectura, Ingeniería, Despliegue y Mantenimiento Técnico**  
**Versión:** 2.5.0  
**Fecha:** 16 de Agosto de 2026  
**Audiencia:** Desarrolladores de Software, Arquitectos de Sistemas, Ingenieros DevOps y Administradores de Base de Datos  

---

## Tabla de Contenido

- [1. Introducción](#1-introducción)
  - [1.1 Objetivo del documento](#11-objetivo-del-documento)
  - [1.2 Alcance](#12-alcance)
  - [1.3 Descripción general del sistema](#13-descripción-general-del-sistema)
- [2. Arquitectura del sistema](#2-arquitectura-del-sistema)
  - [2.1 Arquitectura general](#21-arquitectura-general)
  - [2.2 Arquitectura del frontend](#22-arquitectura-del-frontend)
  - [2.3 Arquitectura del backend](#23-arquitectura-del-backend)
  - [2.4 Base de datos](#24-base-de-datos)
  - [2.5 Comunicación entre componentes](#25-comunicación-entre-componentes)
  - [2.6 Integraciones externas](#26-integraciones-externas)
- [3. Tecnologías utilizadas](#3-tecnologías-utilizadas)
  - [3.1 Frontend](#31-frontend)
  - [3.2 Backend](#32-backend)
  - [3.3 Base de datos](#33-base-de-datos)
  - [3.4 Herramientas y librerías](#34-herramientas-y-librerías)
  - [3.5 Servicios externos](#35-servicios-externos)
- [4. Estructura del proyecto](#4-estructura-del-proyecto)
  - [4.1 Estructura del frontend](#41-estructura-del-frontend)
  - [4.2 Estructura del backend](#42-estructura-del-backend)
  - [4.3 Organización de módulos](#43-organización-de-módulos)
  - [4.4 Convenciones de código](#44-convenciones-de-código)
- [5. Base de datos](#5-base-de-datos)
  - [5.1 Modelo de datos](#51-modelo-de-datos)
  - [5.2 Tablas principales](#52-tablas-principales)
  - [5.3 Relaciones](#53-relaciones)
  - [5.4 Restricciones e integridad](#54-restricciones-e-integridad)
  - [5.5 Roles y permisos](#55-roles-y-permisos)
  - [5.6 Consideraciones del modelo multi-colegio](#56-consideraciones-del-modelo-multi-colegio)
- [6. Funcionamiento del sistema](#6-funcionamiento-del-sistema)
  - [6.1 Autenticación y autorización](#61-autenticación-y-autorización)
  - [6.2 Gestión de colegios](#62-gestión-de-colegios)
  - [6.3 Gestión de usuarios](#63-gestión-de-usuarios)
  - [6.4 Gestión académica](#64-gestión-académica)
  - [6.5 Matrícula](#65-matrícula)
  - [6.6 Seguimiento académico](#66-seguimiento-académico)
  - [6.7 Traslados](#67-traslados)
  - [6.8 Otros módulos del sistema](#68-otros-módulos-del-sistema)
- [7. API](#7-api)
  - [7.1 Estructura de la API](#71-estructura-de-la-api)
  - [7.2 Endpoints](#72-endpoints)
  - [7.3 Autenticación](#73-autenticación)
  - [7.4 Parámetros y respuestas](#74-parámetros-y-respuestas)
  - [7.5 Códigos de error](#75-códigos-de-error)
- [8. Configuración](#8-configuración)
  - [8.1 Variables de entorno](#81-variables-de-entorno)
  - [8.2 Configuración del frontend](#82-configuración-del-frontend)
  - [8.3 Configuración del backend](#83-configuración-del-backend)
  - [8.4 Configuración de la base de datos](#84-configuración-de-la-base-de-datos)
- [9. Instalación y ejecución](#9-instalación-y-ejecución)
  - [9.1 Requisitos del sistema](#91-requisitos-del-sistema)
  - [9.2 Instalación de dependencias](#92-instalación-de-dependencias)
  - [9.3 Configuración inicial](#93-configuración-inicial)
  - [9.4 Ejecución en desarrollo](#94-ejecución-en-desarrollo)
  - [9.5 Construcción para producción](#95-construcción-para-producción)
  - [9.6 Despliegue](#96-despliegue)
- [10. Seguridad](#10-seguridad)
  - [10.1 Autenticación](#101-autenticación)
  - [10.2 Autorización](#102-autorización)
  - [10.3 Protección de datos](#103-protección-de-datos)
  - [10.4 Validación de entradas](#104-validación-de-entradas)
  - [10.5 Gestión de credenciales](#105-gestión-de-credenciales)
  - [10.6 Consideraciones de seguridad multi-colegio](#106-consideraciones-de-seguridad-multi-colegio)
- [11. Mantenimiento](#11-mantenimiento)
  - [11.1 Actualización del sistema](#111-actualización-del-sistema)
  - [11.2 Migraciones de base de datos](#112-migraciones-de-base-de-datos)
  - [11.3 Gestión de errores](#113-gestión-de-errores)
  - [11.4 Copias de seguridad](#114-copias-de-seguridad)
  - [11.5 Recuperación ante fallos](#115-recuperación-ante-fallos)
- [12. Pruebas](#12-pruebas)
  - [12.1 Estrategia de pruebas](#121-estrategia-de-pruebas)
  - [12.2 Pruebas unitarias](#122-pruebas-unitarias)
  - [12.3 Pruebas de integración](#123-pruebas-de-integración)
  - [12.4 Pruebas E2E](#124-pruebas-e2e)
  - [12.5 Pruebas de seguridad](#125-pruebas-de-seguridad)
- [13. Control de versiones](#13-control-de-versiones)
  - [13.1 Repositorios](#131-repositorios)
  - [13.2 Ramas](#132-ramas)
  - [13.3 Commits](#133-commits)
  - [13.4 Pull Requests](#134-pull-requests)
  - [13.5 Proceso de despliegue](#135-proceso-de-despliegue)
- [14. Solución de problemas](#14-solución-de-problemas)
  - [14.1 Problemas frecuentes](#141-problemas-frecuentes)
  - [14.2 Errores del backend](#142-errores-del-backend)
  - [14.3 Errores de base de datos](#143-errores-de-base-de-datos)
  - [14.4 Errores del frontend](#144-errores-del-frontend)
  - [14.5 Procedimiento de diagnóstico](#145-procedimiento-de-diagnóstico)
- [15. Anexos](#15-anexos)
  - [15.1 Diagrama de arquitectura](#151-diagrama-de-arquitectura)
  - [15.2 Diagrama entidad-relación](#152-diagrama-entidad-relación)
  - [15.3 Diccionario de datos](#153-diccionario-de-datos)
  - [15.4 Referencia de endpoints](#154-referencia-de-endpoints)

---

# 1. Introducción

## 1.1 Objetivo del documento
El presente **Manual Técnico** tiene como propósito servir de guía exhaustiva, estándar de ingeniería y referencia de soporte para el equipo técnico responsable de construir, desplegar, extender, auditar y mantener el software **AcademiaNeiva**. A diferencia del manual de usuario (orientado a la operación funcional), este documento explica **cómo está construido el sistema internamente, cómo interactúan sus capas, cuáles son los mecanismos de persistencia y seguridad, y cómo resolver incidencias a nivel de código e infraestructura**.

## 1.2 Alcance
Este manual cubre la totalidad de la plataforma:
- **Frontend SPA**: Arquitectura Vue 3, Pinia stores, interceptores Axios, guardias de navegación y modo acompañamiento directivo.
- **Backend REST API**: Node.js, Express, middlewares de seguridad, validación de DTOs con Zod y servicios en segundo plano.
- **Capa de Persistencia**: Base de datos PostgreSQL 14+, tipos generados en Kysely (`db.types.ts`), funciones almacenadas y triggers PL/pgSQL.
- **Seguridad e Infraestructura**: JWT con revocación por `jti`, verificación OTP transaccional, segmentación de redes Docker y despliegue en VPS Linux.

## 1.3 Descripción general del sistema
**AcademiaNeiva** es una plataforma institucional en la nube bajo modelo **Multi-Tenant** (múltiples colegios aislados lógicamente por `id_colegio`). Está diseñada para centralizar los procesos de admisión, matrículas, planeación curricular alineada con los Derechos Básicos de Aprendizaje (DBA) del Ministerio de Educación Nacional de Colombia (MEN), evaluación continua de calificaciones, observador del alumno, control de asistencia, emisión oficial de boletines PDF, acompañamiento pedagógico directivo y mesa de ayuda con tickets ofuscados en Base36.

---

# 2. Arquitectura del sistema

## 2.1 Arquitectura general
El sistema opera bajo una **Arquitectura en Capas Desacoplada** (Client-Server RESTful) con separación física y lógica entre el frontend SPA y el backend API:

```mermaid
graph TD
    Client["Cliente Web (Navegador)"] -->|"HTTPS / JSON"| Nginx["Nginx Reverse Proxy"]
    Nginx -->|"Proxy Pass (5173 / 80)"| Frontend["Frontend Vue 3 SPA"]
    Nginx -->|"Proxy Pass (/api -> 3000)"| Backend["Backend Node.js/Express API"]
    Backend -->|"Kysely Query Builder / pg"| DB[(PostgreSQL 14+ Database)]
    Backend -->|"SMTP (TLS 587)"| MailServer["Servidor de Correo (Nodemailer)"]
    Backend -->|"WebSockets (ws://)"| SocketIO["Socket.io Server (Eventos en Vivo)"]
```

## 2.2 Arquitectura del frontend
El frontend está desarrollado como una Single Page Application (SPA) modular:
- **Componentes Reactivos**: Basados en Vue 3 Composition API (`<script setup lang="ts">`).
- **Gestión de Estado Centralizada**: Utiliza Pinia (`auth.ts`, `academicYear.ts`, `notifications.ts`, `theme.ts`).
- **Enrutamiento y Seguridad**: `vue-router` con guardias globales `beforeEach` para verificar autenticación, roles permitidos (`meta.roles`) y restricción de rutas en **Modo Acompañamiento Directivo**.
- **Capa de Comunicación HTTP**: Instancia centralizada de Axios con interceptores de solicitud (inyección de `Authorization: Bearer <token>` y header `x-school-id`) e interceptores de respuesta para control de errores y bloqueo de mutaciones en modo solo lectura.

## 2.3 Arquitectura del backend
El backend es una API REST estructurada en capas desacopladas:
1. **Middlewares Globales**: Helmet (cabeceras de seguridad), CORS whitelist, Rate Limiters y `express.json()`.
2. **Middlewares de Autenticación y Autorización**: `verifyToken`, `requireAdminGeneral`, `requireDirectivo`, `requireDocente`, `requirePadre`, `requireEstudiante`.
3. **Capa de Validación DTO**: Esquemas Zod ejecutados antes de los controladores para garantizar tipado estricto y sanitización.
4. **Capa de Controladores (Controllers)**: Funciones asíncronas agrupadas en 21 módulos que encapsulan la lógica de negocio.
5. **Capa de Acceso a Datos (Kysely)**: Constructor de consultas SQL fuertemente tipado enlazado a `backend/src/types/db.types.ts`.
6. **Servicios Especializados**: `notificationService.ts` (SMTP / OTP), `schedulerService.ts` (tareas programadas), `socketManager.ts` (WebSockets).

## 2.4 Base de datos
- **Motor**: PostgreSQL 14+ (relacional con soporte JSONB nativo).
- **Esquema Único Multi-Tenant**: Tablas compartidas filtradas obligatoriamente por `id_colegio`.
- **Inmutabilidad en Persistencia**: Triggers PL/pgSQL (`fn_bloquear_periodo_cerrado`, `proteger_acciones_auditoria`) que impiden escrituras en periodos cerrados o manipulación de bitácoras de auditoría.

## 2.5 Comunicación entre componentes
- **Frontend ↔ Backend**: Peticiones asíncronas HTTPS/REST enviando payloads JSON y tokens JWT en cabeceras.
- **Backend ↔ Base de Datos**: Pool de conexiones TCP gestionado por `pg` y administrado por el query builder Kysely.
- **Tiempo Real**: Canales WebSocket bidireccionales mediante `socket.io` autenticados por handshake JWT.

## 2.6 Integraciones externas
- **Servicio de Correo (SMTP)**: Nodemailer para entrega de credenciales iniciales, notificaciones de matrícula y códigos OTP de 6 dígitos.
- **Motor de Renderizado PDF**: PDFKit / HTML2PDF para compilación de boletines oficiales de notas.

---

# 3. Tecnologías utilizadas

## 3.1 Frontend
- **Vue.js 3.4+**: Framework reactivo principal con Composition API.
- **TypeScript 5.x**: Tipado estático estricto.
- **Vite 5.x**: Empaquetador y entorno de desarrollo ultra-rápido.
- **Pinia 2.x**: Store de estado global reactivo.
- **Vue Router 4.x**: Enrutamiento declarativo y Route Guards.
- **Axios**: Cliente HTTP basado en promesas.
- **TailwindCSS & Vanilla CSS**: Sistema de diseño responsivo y estilos modulares de alta fidelidad estética.

## 3.2 Backend
- **Node.js 20+ LTS**: Entorno de ejecución JavaScript del lado del servidor.
- **Express.js 5.x**: Framework HTTP ligero y modular.
- **TypeScript 5.x**: Tipado estático en el 100% de los controladores y servicios.
- **Kysely 0.29+**: Query builder SQL fuertemente tipado con autocompletado en tiempo de compilación.
- **Zod 3.23+**: Librería de validación y sanitización de esquemas en tiempo de ejecución.
- **Bcrypt 6.x**: Algoritmo de derivación de claves con 10 rondas de sal para contraseñas.
- **JSONWebToken (jsonwebtoken)**: Firma y verificación de tokens Bearer JWT con JTI.

## 3.3 Base de datos
- **PostgreSQL 14+ / 16**: Motor relacional empresarial.
- **PL/pgSQL**: Lenguaje procedimental para triggers de integridad e inmutabilidad.
- **JSONB**: Almacenamiento eficiente de deltas de auditoría y árboles de observaciones.

## 3.4 Herramientas y librerías
- **Helmet**: Cabeceras de seguridad HTTP (CSP, HSTS, X-Content-Type-Options).
- **Express Rate Limit**: Prevención de fuerza bruta y ataques de denegación de servicio (DDoS).
- **Multer**: Procesamiento seguro de formularios multipart/form-data para carga de documentos.
- **Socket.io 4.x**: Comunicación en tiempo real para eventos de supervisión y tickets.

## 3.5 Servicios externos
- **Servidor SMTP (Gmail / SendGrid / Custom SMTP)**: Despacho de correos transaccionales.

---

# 4. Estructura del proyecto

## 4.1 Estructura del frontend
```
frontend/
├── public/                # Favicon, assets estáticos globales
├── src/
│   ├── assets/            # Imágenes, iconos, fuentes
│   ├── components/        # Componentes UI reutilizables (Modales, Topbar, Sidebar, Badges)
│   ├── layouts/           # Layouts de aplicación (DashboardLayout.vue, AuthLayout.vue)
│   ├── router/            # Configuración de rutas y Route Guards (index.ts)
│   ├── stores/            # Stores de Pinia (auth.ts, academicYear.ts, notifications.ts)
│   ├── styles/            # CSS global y tokens de diseño
│   ├── views/             # Vistas de la aplicación agrupadas por rol:
│   │   ├── admin/         # Vistas de Directivos (Matrículas, Docentes, Estructura, etc.)
│   │   ├── adminGeneral/  # Vistas de Administrador General (Colegios, DBA, Supervisión)
│   │   ├── teacher/       # Vistas de Docentes (Planillas, Competencias, Asistencia)
│   │   ├── student/       # Vistas de Estudiantes (Notas, Asistencias, Boletines)
│   │   ├── parent/        # Vistas de Padres de Familia (Portal Familiar)
│   │   ├── public/        # Vistas Públicas (Landing, Inscripción, Seguimiento, Soporte)
│   │   └── shared/        # Vistas Compartidas (Login, Profile, SupportView)
│   ├── App.vue            # Componente raíz
│   └── main.ts            # Punto de entrada y montaje de plugins
├── nginx.conf             # Configuración de Nginx para contenedor de producción
├── package.json           # Dependencias y scripts del frontend
├── tsconfig.json          # Configuración de TypeScript
└── vite.config.ts         # Configuración de Vite
```

## 4.2 Estructura del backend
```
backend/
├── src/
│   ├── config/            # Conexión a base de datos (db.ts, kysely.ts, multer.ts)
│   ├── controllers/       # 21 Módulos de Controladores Express (.ts)
│   │   ├── academicAdmin/ # Controladores directivos (docentes, periodos, materias)
│   │   ├── authController.ts
│   │   ├── matriculaController.ts
│   │   ├── gradingController.ts
│   │   └── ...
│   ├── dtos/              # Esquemas de validación Zod por entidad (.dto.ts)
│   ├── middleware/        # authMiddleware.ts, documentSecurity.ts, validateDto.ts
│   ├── routes/            # Definición de endpoints REST agrupados por recurso (.routes.ts)
│   ├── seeds/             # Scripts de inicialización y datos de prueba (reset_and_seed.ts)
│   ├── services/          # notificationService.ts, schedulerService.ts, socketManager.ts
│   ├── types/             # db.types.ts (Esquema tipado Kysely) y tipos de TypeScript
│   ├── utils/             # Funciones utilitarias (documentValidation.ts, periodHelpers.ts)
│   ├── app.ts             # Instanciación y configuración de Express y middlewares
│   └── server.ts          # Inicialización del servidor HTTP y Socket.io
├── Dockerfile             # Build multi-etapa para producción
├── package.json           # Dependencias y scripts del backend
└── tsconfig.json          # Configuración del compilador TypeScript
```

## 4.3 Organización de módulos
El sistema se organiza en **21 módulos funcionales** bien delimitados:
1. `01_autenticacion`: Login, JWT, tokens blacklist y gestión de sesiones.
2. `02_gestion_colegios`: Catálogo de colegios, licencias y branding visual.
3. `03_usuarios_y_directivos`: Alta y gobierno de personal directivo.
4. `04_estructura_escolar`: Niveles, tipos de grado, salones (cupos) y materias.
5. `05_docentes`: Registro docente, captura de teléfono y asignación académica.
6. `06_matriculas`: Inscripción pública, validación OTP previa y formalización.
7. `07_estudiantes_y_estados`: Estados de alumno y sanciones disciplinarias.
8. `08_configuracion_academica`: Calendarios, periodos lectivos y escalas de notas.
9. `09_competencias_y_sincronizacion`: Planeación curricular y `sync_uuid` en paralelos.
10. `10_catalogo_dba`: Alineación MEN, evidencias 1-to-1 y reportes de coherencia.
11. `11_calificaciones`: Planilla de notas, actividades y criterios ponderados.
12. `12_observaciones`: Observador del alumno y observaciones académicas.
13. `13_asistencia`: Registro de fallas con límite físico de 7 bloques diarios.
14. `14_cierre_y_boletines`: Cierre desacoplado por materia y emisión masiva de PDFs.
15. `15_supervision_y_auditoria`: Acceso externo con re-autenticación y deltas JSONB.
16. `16_soporte_y_tickets`: Mesa de incidencias con Base36 y regla de turnos.
17. `17_gestion_padres`: Consola directiva de acudientes, alertas y modo monitoreo.
18. `18_gestion_traslados`: Flujo de traslados intercolegiados de alumnos y usuarios.
19. `19_seguimiento_y_promocion_academica`: Promociones anuales según Decreto 1290.
20. `20_seguimiento_academico_directivo`: Acompañamiento pedagógico en solo lectura.
21. `21_flujo_correos_y_verificaciones`: Despacho SMTP y validación OTP de un solo uso.

## 4.4 Convenciones de código
- **TypeScript Estricto**: `strict: true` en compiladores. No utilizar `any` implícito.
- **Kysely Obligatorio**: Toda consulta SQL debe construirse con `db.selectFrom(...)`, `db.insertInto(...)` o `db.updateTable(...)` evitando SQL crudo.
- **Zod en Endpoints Mutativos**: Validar payloads con `validateDto(Schema)` o `.safeParse()`.
- **Nomenclatura**:
  - Controladores: `camelCase` terminados en `Controller.ts`.
  - Rutas: `kebab-case` o `camelCase.routes.ts`.
  - Vistas: `PascalCase.vue`.
  - Tablas y Columnas en Base de Datos: `snake_case`.

---

# 5. Base de datos

## 5.1 Modelo de datos
El modelo relacional implementa un esquema único compartido normalizado hasta 3NF, con tablas de auditoría JSONB y soporte multi-inquilino.

## 5.2 Tablas principales

| Tabla | Propósito | Llave Primaria | Claves Foráneas Críticas |
|---|---|---|---|
| `colegio` | Registro de inquilinos institucionales | `id_colegio` | — |
| `usuario` | Identidad global única de las personas | `id_usuario` | `id_colegio` (Nullable) |
| `usuario_colegio` | Membresía y rol activo por institución | `id_usuariocolegio` | `id_usuario`, `id_colegio`, `id_rol` |
| `docente` | Perfil operativo del docente en un colegio | `id_docente` | `id_usuario`, `id_colegio` |
| `estudiante` | Expediente escolar del estudiante | `id_estudiante` | `id_usuario`, `id_colegio` |
| `padre_familia` | Perfil del acudiente | `id_padrefamilia` | `id_usuario` |
| `detalle_padrefamilia` | Relación parentesco acudiente-alumno | `id_detallepadrefamilia`| `id_padrefamilia`, `id_estudiante`, `id_colegio` |
| `año_lectivo` | Ciclo escolar institucional | `id_anio` | `id_colegio` |
| `periodo_academico`| Periodo evaluativo (Trimestre/Semestre) | `id_periodo` | `id_anio`, `id_colegio` |
| `grupos` | Salones con límite de cupos | `id_grupo` | `id_grado`, `id_colegio` |
| `detalle_grados` | Asignación académica de carga horaria | `id_detallegrado` | `id_materia`, `id_docente`, `id_grupo`, `id_colegio` |
| `matricula` | Solicitudes y matrículas oficiales | `id_matricula` | `id_estudiante`, `id_grupo`, `id_anio`, `id_colegio` |
| `competencias` | Metas curriculares por materia/periodo | `id_competencia` | `id_materia`, `id_periodo`, `id_grupo` |
| `actividad_materia`| Actividades evaluativas del periodo | `id_actividadmateria` | `id_materia`, `id_periodo`, `id_grupo` |
| `notas_actividad` | Calificaciones por actividad | `id_notactividad` | `id_actividadmateria`, `id_estudiante` |
| `resultado_academico`| Notas consolidadas por periodo | `id_resultadoacademico`| `id_estudiante`, `id_materia`, `id_periodo` |
| `registro_asistencia`| Faltas y asistencias diarias | `id_asistencia` | `id_estudiante`, `id_grupo`, `id_materia` |
| `cierre_materia` | Cierre por asignatura | `id_cierremateria` | `id_materia`, `id_grupo`, `id_periodo`, `id_docente` |
| `tickets_soporte` | Mesa de incidencias con código Base36 | `id_ticket` | `id_usuario`, `id_colegio` |
| `codigo_verificacion_email`| Almacén transaccional OTP | `id_codigo` | — |

## 5.3 Relaciones
- **1 a N (Colegio a Entidades)**: `colegio` vincula a `año_lectivo`, `grupos`, `materias`, `docente`, `estudiante`, `matricula`.
- **N a N (Docente - Materia - Grupo)**: Modelada explícitamente a través de `detalle_grados`.
- **N a N (Acudiente - Estudiantes)**: Modelada mediante `detalle_padrefamilia`.

## 5.4 Restricciones e integridad
- **Unicidad de Identidad**: `UNIQUE (documento)` en `usuario`.
- **Unicidad Operativa**: `UNIQUE (id_usuario, id_colegio)` en `docente` y `estudiante`.
- **Unicidad de Evidencias DBA**: Restricción 1-to-1 por grado y año escolar.
- **Triggers PL/pgSQL**:
  - `fn_bloquear_periodo_cerrado`: Bloquea inserciones, ediciones o eliminaciones en `notas_actividad`, `observacion_estudiante` y `registro_asistencia` cuando el periodo está `CERRADO`.
  - `fn_sync_estudiante_sancion`: Conmuta automáticamente el estado del alumno a `SANCIONADO` o `EXPULSADO` durante la vigencia de una sanción.
  - `proteger_acciones_auditoria`: Lanza excepción ante sentencias `DELETE` o `UPDATE` sobre la bitácora de auditoría.

## 5.5 Roles y permisos
Definidos en la tabla `rol`: `admin_general` (ID 1), `directivo` (ID 2), `docente` (ID 3), `estudiante` (ID 4), `padre` (ID 5).

## 5.6 Consideraciones del modelo multi-colegio
La separación entre `usuario` (persona física global) y `usuario_colegio` (membresía activa por plantel) permite que un docente labore en dos colegios distintos con cuentas y cargas horarias completamente aisladas, preservando la inmutabilidad de firmas y notas históricas si se desvincula de uno de ellos.

---

# 6. Funcionamiento del sistema

## 6.1 Autenticación y autorización
1. El usuario envía credenciales a `POST /api/auth/login`.
2. El backend consulta el usuario, valida la contraseña con `bcrypt.compare()` y verifica que `usuario.estado = 'ACTIVO'`.
3. Se genera un token JWT firmado (8 horas de vigencia) que contiene `id`, `email`, `role`, `roles[]`, `schoolId`, `schoolIds[]` y un `jti` único.
4. En cada petición, `authMiddleware.ts` valida la firma, verifica que el `jti` no esté en `token_blacklist` y comprueba que `iat >= logged_out_at`.

## 6.2 Gestión de colegios
El Administrador General crea instituciones (`POST /api/admin/colegios`), asignando NIT, dominio y calendario. Los directivos pueden personalizar el escudo y los colores institucionales desde la configuración de su plantel.

## 6.3 Gestión de usuarios
Permite la creación de rectores y coordinadores vinculados a sedes. Los cambios o reseteos de credenciales de terceros se gestionan de forma auditada desde la consola administrativa de usuarios.

## 6.4 Gestión académica
Parametrización jerárquica de niveles, grados, salones (control de cupos) y catálogo de materias. La asignación docente en `detalle_grados` autoriza al profesor a dictar clase y evaluar la asignatura.

## 6.5 Matrícula
1. **Verificación Previa OTP**: El acudiente valida su buzón mediante un código numérico de 6 dígitos emitido a su correo.
2. **Envío de Solicitud**: Se adjuntan documentos (máx 5MB) y se generan el `token_seguimiento` UUID.
3. **Revisión y Cupos**: El directivo evalúa documentos (aprobación/rechazo individual) y asigna salón verificando cupos en tiempo real.
4. **Oficialización**: Al aprobarse, una transacción SQL crea atómicamente el `estudiante`, el `padre_familia` y las credenciales de `usuario`.

## 6.6 Seguimiento académico
- **Evaluación Continua**: Docentes configuran actividades y criterios ponderados al 100% ingresando notas en la planilla interactiva.
- **Asistencia**: Toma diaria con control físico de máximo 7 bloques de clase al día.
- **Observador**: Registro de anotaciones formativas con requerimiento de observación académica obligatoria para el cierre de materia.
- **Cierre y Boletines**: Cierre por materia individual, cierre institucional del periodo por el Rector y generación de boletines oficiales PDF.

## 6.7 Traslados
Módulo para solicitar, autorizar y ejecutar traslados de matrícula entre sedes o colegios distintos, registrando la bitácora de trazabilidad de estados.

## 6.8 Otros módulos del sistema
- **Seguimiento Directivo (Modo Espejo)**: Acompañamiento pedagógico en tiempo real donde el directivo emula la interfaz de un usuario en modo solo lectura estricto, con bloqueo automático de la gestión de traslados.
- **Soporte y Tickets**: Mesa de ayuda con código Base36 (`TKT-XXXX`), selectores de estado consistentes y regla ping-pong de turnos.
- **Catálogo DBA**: Matriz de alineación curricular con los estándares del MEN colombiano.

---

# 7. API

## 7.1 Estructura de la API
La API responde bajo el prefijo `/api` organizando sus rutas por dominios de negocio en formato JSON.

## 7.2 Endpoints Principales

| Dominio | Ruta Base | Métodos Disponibles | Control de Acceso |
|---|---|---|---|
| Autenticación | `/api/auth` | `POST /login`, `POST /student-login`, `POST /logout`, `GET /verify` | Público / Bearer JWT |
| Colegios | `/api/admin/colegios` | `GET`, `POST`, `PUT`, `PATCH /status` | Admin General |
| Usuarios Admin | `/api/admin/usuarios`| `GET`, `POST`, `PUT`, `PATCH /status` | Admin General |
| Docentes | `/api/academic-admin/teachers` | `GET`, `POST`, `PATCH /status` | Directivo |
| Matrículas | `/api/matriculas` | `POST /submit`, `GET /pending`, `POST /finalize/:id`, `PATCH /document/:id` | Público / Directivo |
| Calificaciones | `/api/grading` | `GET /sheet`, `POST /activity`, `POST /grades` | Docente |
| Asistencia | `/api/attendance` | `GET /sheet`, `POST /bulk-save` | Docente |
| Cierre y Boletines| `/api/boletines` | `POST /close-subject`, `POST /institutional-close`, `GET /pdf` | Directivo / Docente |
| Supervisión | `/api/admin/supervision` | `POST /request`, `POST /approve`, `POST /exit`, `GET /logs` | Admin General / Rector |
| Soporte | `/api/support` | `POST /tickets`, `GET /tickets/track/:code`, `PUT /tickets/:id/status` | Público / Todos |
| Verificación OTP | `/api/matriculas/send-email-code` | `POST` (envío), `POST /verify-email-code` (validación) | Público |

## 7.3 Autenticación
Todas las rutas protegidas requieren la cabecera:
```http
Authorization: Bearer <JWT_TOKEN>
x-school-id: <ID_COLEGIO> (Opcional para contexto institucional)
```

## 7.4 Parámetros y respuestas
- **Respuestas Exitosas**: Retornan formato JSON estándar con código `200 OK` o `201 Created`.
- **Respuestas de Validación**: Retornan `400 Bad Request` con el desglose de errores emitido por Zod.

## 7.5 Códigos de error

| Código | Significado | Causa Típica |
|---|---|---|
| `400` | Bad Request | Carga útil inválida según esquema Zod o parámetros faltantes |
| `401` | Unauthorized | Token JWT ausente, vencido o invalidado en `token_blacklist` |
| `403` | Forbidden | Rol insuficiente o intento de mutación en modo acompañamiento |
| `404` | Not Found | Recurso o colegio no encontrado |
| `409` | Conflict | Intento de escritura en un periodo académico en estado `CERRADO` |
| `429` | Too Many Requests | Exceso en el límite de peticiones por IP (Rate Limiter) |
| `500` | Internal Server Error | Excepción no controlada en el servidor |

---

# 8. Configuración

## 8.1 Variables de entorno (`backend/.env`)
```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://usuario:password_seguro@localhost:5432/academianeiva
JWT_SECRET=clave_secreta_super_segura_para_firmar_jwt_2026
FRONTEND_URL=https://academianeiva.edu.co
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@academianeiva.edu.co
SMTP_PASS=app_password_segura_de_aplicacion
GLOBAL_RATE_LIMIT_MAX=2000
```

## 8.2 Configuración del frontend (`frontend/vite.config.ts`)
Configura el proxy de desarrollo hacia `http://localhost:3000` y define alias de rutas (`@/` hacia `/src`).

## 8.3 Configuración del backend (`backend/src/app.ts`)
Configura middlewares de Helmet, CORS con lista blanca de orígenes y límites de carga útil JSON (10MB).

## 8.4 Configuración de la base de datos (`backend/src/config/kysely.ts`)
Pool de conexiones PostgreSQL mediante el driver `pg` conectado con la instancia fuertemente tipada de Kysely.

---

# 9. Instalación y ejecución

## 9.1 Requisitos del sistema
- **Servidor / Host**: Linux Ubuntu 22.04 LTS o superior (o Windows 10/11 con WSL2 para desarrollo local).
- **Node.js**: v20.x LTS o superior.
- **PostgreSQL**: v14.x o v16.x.
- **Docker & Docker Compose**: (Opcional para entornos containerizados).
- **Memoria RAM**: Mínimo 2 GB (Recomendado 4 GB).

## 9.2 Instalación de dependencias
```bash
git clone https://github.com/DanExl24/AcademiaNeiva.git
cd segundoProyecto

# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

## 9.3 Configuración inicial
1. Configurar variables de entorno copiando `.env.example` a `.env` en `backend/`.
2. Crear la base de datos PostgreSQL:
   ```bash
   createdb -U postgres academianeiva
   ```
3. Ejecutar el script maestro de base de datos para cargar tablas y triggers:
   ```bash
   psql -U postgres -d academianeiva -f guides/arquitectura_y_datos/AcademiaNeivaBD.sql
   ```

## 9.4 Ejecución en desarrollo
```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Frontend SPA
cd frontend
npm run dev
```
- Frontend accesible en: `http://localhost:5173`
- Backend API accesible en: `http://localhost:3000`

## 9.5 Construcción para producción
```bash
# Compilar backend (TypeScript a JavaScript)
cd backend
npm run build

# Compilar frontend (Vite bundle a /dist)
cd ../frontend
npm run build
```

## 9.6 Despliegue con Docker Compose
```bash
docker-compose up -d --build
```
- Contenedores desplegados: `academia-frontend` (Nginx), `academia-backend` (Node.js), `academia-postgres` (PostgreSQL 16).

---

# 10. Seguridad

## 10.1 Autenticación
- Tokens JWT con identificador único `jti` almacenados en `localStorage`.
- Verificación en cada petición de la lista negra (`token_blacklist`) e invalidación atómica por timestamp (`logged_out_at`).

## 10.2 Autorización
- Middlewares RBAC estrictos por rol.
- Aislamiento total de consultas por `id_colegio`.
- Modo Acompañamiento Pedagógico Directivo en solo lectura estricto.

## 10.3 Protección de datos
- Hashing de contraseñas con `bcrypt` (10 rondas de sal).
- URLs firmadas temporales (tokens de 30 minutos) anti-IDOR para proteger documentos adjuntos de menores.

## 10.4 Validación de entradas
- Esquemas declarativos con **Zod** para la sanitización de payloads y prevención de ataques de inyección.
- Validación de formatos oficiales de documentos de identidad colombianos (CC, TI, RC, CE, PEP).
- Validación de números telefónicos de 7 a 20 dígitos numéricos.

## 10.5 Gestión de credenciales
- Aislamiento del módulo de "Mi Cuenta" (`ProfileView.vue`), eliminando la opción de modificar contraseñas ajenas y reservando dicha acción a la consola administrativa de usuarios auditada.

## 10.6 Consideraciones de seguridad multi-colegio
- Inyección forzosa del `schoolId` en los controladores a través del middleware de autenticación, impidiendo que un directivo consulte o modifique datos de otro colegio.

---

# 11. Mantenimiento

## 11.1 Actualización del sistema
1. Obtener la última versión del repositorio: `git pull origin main`.
2. Actualizar dependencias si hubo cambios en `package.json`: `npm install`.
3. Recompilar los módulos: `npm run build`.
4. Reiniciar los procesos mediante PM2 o Docker: `docker-compose restart`.

## 11.2 Migraciones de base de datos
- Las actualizaciones del esquema relacional deben escribirse en scripts SQL incrementales y ejecutarse en orden transaccional.
- Al alterar tablas existentes, se debe actualizar la definición estática en `backend/src/types/db.types.ts` para sincronizar Kysely.

## 11.3 Gestión de errores
- Errores de API capturados centralizadamente por el middleware global de Express, retornando códigos HTTP semánticos y ocultando trazas de pila (`stack trace`) en producción.

## 11.4 Copias de seguridad (Backups)
Ejecutar volcados periódicos mediante `pg_dump`:
```bash
pg_dump -U postgres -d academianeiva -F c -b -v -f /backups/academianeiva_$(date +%Y%m%d_%H%M%S).dump
```

## 11.5 Recuperación ante fallos
Para restaurar una copia de seguridad:
```bash
pg_restore -U postgres -d academianeiva -v -c /backups/academianeiva_backup.dump
```

---

# 12. Pruebas

## 12.1 Estrategia de pruebas
Estrategia piramidal orientada a asegurar la integridad en periodos cerrados, la consistencia de notas ponderadas y el aislamiento multi-colegio.

## 12.2 Pruebas unitarias
- Validación de esquemas Zod (formatos de correo, regex de teléfonos 7-20 dígitos, enums de estado).
- Funciones matemáticas de cálculo de promedios ponderados y equivalencia con la escala cualitativa institucional.

## 12.3 Pruebas de integración
- Flujo completo de admisión: emisión de OTP -> verificación de código -> envío de matrícula -> asignación de salón -> oficialización.
- Cierre de periodos y verificación de bloqueo de escrituras por triggers SQL.

## 12.4 Pruebas E2E (End-to-End)
- Navegación del directivo en Modo Acompañamiento Pedagógico verificando la inhabilitación de formularios de edición y bloqueo de la ruta de traslados.

## 12.5 Pruebas de seguridad
- Pruebas de inyección SQL automatizadas contra Kysely.
- Verificación de denegación de acceso a documentos protegidos sin token temporal anti-IDOR.
- Intentos de fuerza bruta para comprobar activación de `express-rate-limit`.

---

# 13. Control de versiones

## 13.1 Repositorio
- Repositorio centralizado en GitHub: `https://github.com/DanExl24/AcademiaNeiva.git`.

## 13.2 Ramas
- `main`: Rama principal de producción con código verificado y estable.
- `feature/*`: Ramas de desarrollo para nuevas características.
- `fix/*`: Ramas de corrección de incidencias y parches.

## 13.3 Commits
Convención de **Conventional Commits**:
- `feat:` Nueva característica funcional.
- `fix:` Corrección de bug o vulnerabilidad.
- `docs:` Modificaciones en documentación técnica o guías.
- `refactor:` Optimización o reestructuración de código sin alterar funcionalidad.

## 13.4 Pull Requests
Revisión obligatoria de código con comprobación de tipado TypeScript (`tsc --noEmit`) antes de realizar merge a `main`.

## 13.5 Proceso de despliegue
Regla automatizada del proyecto: Tras verificar y validar cualquier ajuste en el sistema, realizar secuencialmente `git add .`, `git commit -m "..."` y `git push` para mantener el repositorio sincronizado.

---

# 14. Solución de problemas

## 14.1 Problemas frecuentes

### Problema: "No se puede calificar o modificar notas en una materia"
- **Causa**: El periodo académico o la materia se encuentran en estado `CERRADO`.
- **Solución**: Si se requiere una corrección justificada, el Rector debe utilizar la opción de reapertura de asignatura (`reopenSubjectClosure`) en la consola directiva.

### Problema: "Token de acceso revocado o sesión expirada al navegar"
- **Causa**: La cuenta del usuario fue inactivada, el directivo forzó un cierre de sesión (`logged_out_at`), o el token expiró (8 horas).
- **Solución**: El usuario debe volver a autenticarse en el formulario de login.

## 14.2 Errores del backend
- **Error `400 Bad Request` en peticiones mutativas**: Inspeccionar el array `errors` retornado por Zod en la respuesta JSON para identificar campos faltantes o tipos incorrectos.
- **Error al conectar a PostgreSQL**: Verificar que la variable `DATABASE_URL` esté configurada correctamente y que el servicio de base de datos esté aceptando conexiones.

## 14.3 Errores de base de datos
- **Error `RAISE EXCEPTION` en sentencias de prueba**: Si se ejecutan scripts de seed locales, inyectar el parámetro de bypass:
  ```sql
  SET my.app.bypass_triggers = 'true';
  ```

## 14.4 Errores del frontend
- **Error al cargar chunk dinámico de módulo**: El Router implementa recarga automática ante fallos de carga de chunks desactualizados tras un despliegue.
- **Formularios deshabilitados en ámbar**: Verificar si el usuario directivo se encuentra en **Modo Acompañamiento Pedagógico**.

## 14.5 Procedimiento de diagnóstico
1. Inspeccionar los logs del servidor backend en tiempo real: `docker logs -f academia-backend`.
2. Verificar el estado de salud de la base de datos: `pg_isready -U postgres -d academianeiva`.
3. Consultar la consola de red en las herramientas de desarrollo del navegador (DevTools) para inspeccionar códigos de estado HTTP y respuestas JSON.

---

# 15. Anexos

## 15.1 Diagrama de arquitectura
Consulte el diagrama de capas técnicas en [Sección 2.1](#21-arquitectura-general) y en [guides/arquitectura_y_datos/architecture.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/arquitectura_y_datos/architecture.md).

## 15.2 Diagrama entidad-relación
Consulte la especificación DBML en [guides/arquitectura_y_datos/AcademiaNeivaBD.dbml](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/arquitectura_y_datos/AcademiaNeivaBD.dbml).

## 15.3 Diccionario de datos
Consulte el script de creación maestro con comentarios de columnas en [guides/arquitectura_y_datos/AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/arquitectura_y_datos/AcademiaNeivaBD.sql) y las definiciones TypeScript en [backend/src/types/db.types.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/types/db.types.ts).

## 15.4 Referencia de endpoints
Consulte la documentación de endpoints de los 21 módulos en [guides/modules/mapa_documentacion.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/mapa_documentacion.md).

---

*Manual Técnico compilado y verificado el 16 de agosto de 2026 bajo los estándares de ingeniería de software de AcademiaNeiva.*
