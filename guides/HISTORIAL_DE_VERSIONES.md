# 📜 Historial de Versiones y Registro de Cambios (Changelog) — AcademiaNeiva

<div align="center">

![Versión Actual](https://img.shields.io/badge/Versi%C3%B3n_Actual-v2.5.0-6366f1?style=for-the-badge&logo=git&logoColor=white)
![Esquema SemVer](https://img.shields.io/badge/SemVer-2.0.0-emerald?style=for-the-badge&logo=semver&logoColor=white)
![Estado de Producción](https://img.shields.io/badge/Estado-Estable_%2F_Producci%C3%B3n-blue?style=for-the-badge&logo=checkmarx&logoColor=white)

**Trazabilidad Histórica Completa de la Evolución Arquitectónica, Funcional y Tecnológica de AcademiaNeiva.**

</div>

---

## 🧭 1. Filosofía de Versionamiento del Proyecto

**AcademiaNeiva** adopta el estándar **Semantic Versioning 2.0.0 (SemVer)**: `MAJOR.MINOR.PATCH`

- **MAJOR (vX.0.0):** Cambios arquitectónicos estructurales, rediseño del modelo de datos relacional (ej. transición a multi-colegio desacoplado `usuario_colegio`), transformaciones de motor de persistencia (Kysely) o cambios mayores en los contratos de API REST.
- **MINOR (v1.X.0):** Incorporación de nuevos módulos de negocio (ej. catálogo DBA, tickets de soporte, portal de documentación `/docs`, informe parcial de traslado), nuevos roles o ampliaciones de flujos funcionales sin romper compatibilidad previa.
- **PATCH (v1.0.X):** Corrección de errores puntuales, optimizaciones de rendimiento de queries, ajustes de UI/UX, parches de seguridad y refinamientos normativos.

---

## 📊 2. Cronología General de Lanzamientos

| Versión | Período / Fecha | Hito Principal | Commits Clave |
|---|---|---|---|
| **v2.5.0** | *01 de Septiembre, 2026* | **Consolidación Kysely 100% Type-Safe & Informe Parcial de Traslado** | `c44e8dac`, `171b67fa`, `5ee46ede` |
| **v2.4.0** | *29 a 31 de Agosto, 2026* | **Portal de Documentación Web (`/docs`), Grafo Topológico SVG & Maestro** | `cc1be603`, `9aa3cc6b`, `f3e32561` |
| **v2.3.0** | *26 a 29 de Agosto, 2026* | **Matrícula Extraordinaria Integral, Drawer de Soporte & Token Vault** | `d5d148f0`, `9fae7f5b`, `be63a280` |
| **v2.2.0** | *16 a 25 de Agosto, 2026* | **Gestión Avanzada de Traslados, Reingresos & Portal de Padres 2.0** | `c7f9e17a`, `1d94418c`, `87132387` |
| **v2.1.0** | *04 a 15 de Agosto, 2026* | **Seguridad Anti-IDOR, URLs Firmadas, IA en Escudos & CI/CD Pipeline** | `175b6422`, `6af384f9`, `4b4e58cc` |
| **v2.0.0** | *26 de Julio a 03 de Agosto, 2026* | **Arquitectura Multi-Colegio Real, Adopción Kysely & Suite Typescript Estricta**| `9a4b686e`, `b60bbf91`, `09b8c57f` |
| **v1.4.0** | *01 a 25 de Julio, 2026* | **Mesa de Soporte con Tickets, Extracción DBA con Python & IEEE 830** | `bc986019`, `a4379f59`, `c12cb576` |
| **v1.3.0** | *11 a 30 de Junio, 2026* | **Catálogo Curricular DBA (MEN), Estados del Estudiante & Calendarios A/B** | `11568469`, `81654d4a`, `48942e86` |
| **v1.2.0** | *01 a 10 de Junio, 2026* | **Cierre Global de Periodos, Generador de Boletines PDF & Portales Familia** | `0226932b`, `bbc11181`, `b63cccd2` |
| **v1.1.0** | *22 a 31 de Mayo, 2026* | **Panel Directivo, Asignación Docente & Lógica de Calificaciones Inicial** | `4bd17941`, `92011755`, `fb7fafd2` |
| **v1.0.0** | *07 a 21 de Mayo, 2026* | **Génesis del Sistema, Infraestructura PostgreSQL, Auth JWT & Matrículas MVP** | `6547bcf9`, `f85ae38e`, `d3013e03` |

---

## 🚀 3. Detalle Evolutivo Versión por Versión

---

### 🌟 v2.5.0 — Consolidación Kysely 100% Type-Safe & Cumplimiento Decreto 1075
> **Fecha de Lanzamiento:** 01 de Septiembre, 2026  
> **Commits Representativos:** `c44e8dac`, `171b67fa`, `60349589`, `09b8c57f`, `04251776`, `5ee46ede`

#### 🎯 Propósito y Resumen
Esta versión representa la **madurez técnica absoluta** del sistema, eliminando cualquier rastro de consultas SQL crudas en favor de **Kysely QueryBuilder** con tipado estricto en tiempo de compilación y añadiendo el flujo legal de traslados a mitad de año.

#### ✨ Nuevas Características
- **Informe Parcial de Traslado a Mitad de Año (Decreto 1075 Art. 2.3.3.3.3.17):** Capacidad directiva de emitir un informe valorativo oficial acumulado hasta el periodo en curso para estudiantes que se trasladan antes del cierre del año lectivo.
- **Selector Inteligente de Grupos y Estudiantes en Boletines:** Carga reactiva de estudiantes con matrículas tanto en estado `ACTIVA` como `APROBADA`.
- **Integración de Documentación Central en Portal Web:** El `README.md` general y el historial de versiones pasan a ser documentos rectores visualizables en tiempo real en `/docs`.

#### 🛠️ Refactorizaciones Técnicas
- **Migración Integral a Kysely:** Refactorización de `studentController.ts`, `boletinController.ts`, `curriculumController.ts` y `adminGeneralController.ts` garantizando transacciones ACID con `db.transaction().execute(...)` y cero errores de TypeScript (`npx tsc --noEmit` en código de salida 0).
- **Limpieza de Esquema Relacional:** Eliminación definitiva de la columna obsoleta `usuario.id_colegio`, consolidando el modelo multi-instituto mediante la tabla asociativa `usuario_colegio`.

---

### 🏛️ v2.4.0 — Portal de Documentación Web (`/docs`), Grafo Topológico & Documento Rector
> **Fecha de Lanzamiento:** 29 a 31 de Agosto, 2026  
> **Commits Representativos:** `cc1be603`, `f7092951`, `c5bf66c3`, `38ed253b`, `9aa3cc6b`, `50bf600f`, `2356bf99`, `f3e32561`, `d4ac42ad`, `3e8fa718`

#### 🎯 Propósito y Resumen
Creación de un portal de documentación técnica y funcional de ingeniería integrado directamente en el frontend (`/docs`), operando como una capa viva de inteligencia interactiva sobre los archivos Markdown de la carpeta `guides/`.

#### ✨ Nuevas Características
- **Grafo de Dependencias SVG Bézier (`DocsRelationshipGraph.vue`):** Topología interactiva de 6 capas con renderizado vectorial de curvas Bézier y marcadores dinámicos que iluminan módulos requeridos (ámbar) y módulos receptores (esmeralda).
- **Ficha Ejecutiva de 30 Segundos ("Entender este Módulo"):** Resumen ejecutivo con tarjeta de actores, dependencias clickeables, tablas de base de datos y reglas de negocio asociadas.
- **Modal de Búsqueda Facetada con Atajo `Ctrl + K`:** Motor de búsqueda full-text sobre los 21 módulos con filtros por Reglas, Historias de Usuario, BD y Documentos Rectores.
- **Motor de Diagramas Mermaid Integrado:** Soporte nativo para diagramas de secuencia, flujos y arquitectura en modo oscuro.
- **Documento Rector Maestro:** Creación de `MAESTRO_DE_INFORMACION.md` (16 secciones canónicas del dominio escolar) y `ARQUITECTURA_PORTAL_DOCUMENTACION.md`.

---

### 🛡️ v2.3.0 — Matrícula Extraordinaria Integral, Drawer de Revisión & Bóveda de Tokens
> **Fecha de Lanzamiento:** 26 a 29 de Agosto, 2026  
> **Commits Representativos:** `d5d148f0`, `50e20a70`, `037f5bf4`, `be63a280`, `b5d061c3`, `b2483fbb`, `9fae7f5b`, `d733df4d`, `ba909f6d`, `3ac89f05`

#### 🎯 Propósito y Resumen
Diseño e implementación del flujo integral para admisiones fuera del calendario ordinario mediante tickets de soporte autorizados por el directivo, permitiendo al padre de familia diligenciar la matrícula con prellenado automático y trazabilidad.

#### ✨ Nuevas Características
- **Bypass de Fechas con Ticket de Soporte:** Habilitación temporal de formulario para matrícula extraordinaria con bloqueo de colegio y correo pre-aprobados.
- **Drawer de Revisión Directiva:** Panel lateral con vista detallada de documentos cargados, motivo del trámite, responsable y botones de aprobación/rechazo.
- **Bóveda de Seguridad para Tokens en `sessionStorage`:** Enmascaramiento de URLs y sanitización de parámetros sensibles para evitar fugas en el historial del navegador.
- **Separación Estricta de Reingresos:** Reglas de validación que diferencian a un estudiante `INACTIVO` de uno `RETIRADO` (orientado a `ReingresoManagement`).

---

### 🔄 v2.2.0 — Gestión Avanzada de Traslados, Reingresos & Portal de Padres 2.0
> **Fecha de Lanzamiento:** 16 a 25 de Agosto, 2026  
> **Commits Representativos:** `87132387`, `6ca1416d`, `c169724b`, `c7f9e17a`, `0f94f693`, `3ea4e36b`, `1d94418c`, `bbc60ec6`, `acc84fa5`, `e4ae86d1`, `3779a06e`

#### 🎯 Propósito y Resumen
Potenciación de los flujos de interacción entre padres de familia y la institución educativa, resolución de traslados inter-colegiales y perfeccionamiento de la accesibilidad.

#### ✨ Nuevas Características
- **Portal de Padres 2.0:** Dashboard analítico con gráficos de rendimiento acumulado, seguimiento de asistencia por materia y alertas de observador.
- **Módulo de Gestión de Reingresos:** Interfaz dedicada para tramitar solicitudes de estudiantes que retornan al sistema tras periodos de inactividad o retiro voluntario.
- **Control de Cupos y Secciones:** Validación en tiempo real para evitar sobrecupo en traslados y nuevas admisiones.

---

### 🌐 v2.1.0 — Seguridad Anti-IDOR, URLs Firmadas, IA en Escudos & CI/CD Pipeline
> **Fecha de Lanzamiento:** 04 a 15 de Agosto, 2026  
> **Commits Representativos:** `175b6422`, `6af384f9`, `ac349aa9`, `2cc3d761`, `0bfd6187`, `c14beb6a`, `4b4e58cc`, `c9ef9098`, `3719aa14`, `f58fcb11`

#### 🎯 Propósito y Resumen
Blindaje de la infraestructura en producción, automatización del despliegue continuo y herramientas avanzadas de procesamiento gráfico en el cliente.

#### ✨ Nuevas Características
- **Protección Anti-IDOR en Documentos:** Implementación de URLs firmadas con tokens criptográficos de vida corta (`generateDocumentAccessToken`), impidiendo la visualización no autorizada de boletines y certificados.
- **Procesamiento de Imágenes con IA en el Navegador:** Integración de `@imgly/background-removal` y Canvas HTML5 para eliminar fondos en escudos institucionales sin enviar datos a servidores externos.
- **Pipeline de Despliegue Continuo (CI/CD):** Workflows de GitHub Actions para compilación, verificación y despliegue automático en servidores VPS.

---

### 🏢 v2.0.0 — Arquitectura Multi-Colegio Real, Adopción Kysely & Zod Runtime
> **Fecha de Lanzamiento:** 26 de Julio a 03 de Agosto, 2026  
> **Commits Representativos:** `9a4b686e`, `8796151d`, `9c8d14e1`, `67816bbb`, `e73843de`, `275f21a5`, `9b18356b`, `b60bbf91`, `3cc33d40`, `741a9b1e`, `b60e1faa`, `1b471c47`, `2473bda5`, `4ff5d49e`

#### 🎯 Propósito y Resumen
Reestructuración mayor de la arquitectura de datos para soportar un entorno multi-colegio real, donde usuarios (como directivos o docentes con múltiples cargos) pueden interactuar con diferentes instituciones sin duplicación de identidad.

#### ✨ Nuevas Características
- **Modelo Multi-Colegio N:M:** Creación de la entidad `usuario_colegio` y refactorización de roles por contexto institucional.
- **Adopción de Kysely:** Migración de controladores críticos al querybuilder con generación automática de tipos desde la base de datos (`db.types.ts`).
- **Validación con Zod:** Creación de esquemas de validación de entrada para garantizar que ningún dato malformado llegue a la capa de base de datos.
- **Gestión de Padres para Directivos:** Módulo administrativo para vincular, desvincular y verificar acudientes.

---

### 🎫 v1.4.0 — Mesa de Soporte con Tickets, Extracción DBA con Python & IEEE 830
> **Fecha de Lanzamiento:** 01 a 25 de Julio, 2026  
> **Commits Representativos:** `8edc1500`, `743d34e1`, `240114fc`, `55d1cd59`, `7de23e48`, `a4379f59`, `4c156e39`, `bc986019`, `b6c474ac`, `e433a4f8`, `57b0c305`, `1115ab7c`, `c12cb576`

#### 🎯 Propósito y Resumen
Incorporación de la mesa de ayuda institucional y formalización documental de los requisitos del sistema bajo estándares internacionales de ingeniería de software.

#### ✨ Nuevas Características
- **Módulo de Soporte y Tickets (`tickets_soporte`):** Canal interno para resolver incidencias de acceso, corrección de notas o solicitudes extraordinarias.
- **Extracción de DBAs Nacionales con Python:** Scripts de procesamiento de PDFs del MEN para estructurar e insertar automáticamente los Derechos Básicos de Aprendizaje en la base de datos.
- **Especificación IEEE Std 830-1998:** Redacción formal de la especificación de requisitos de software (SRS) del sistema.

---

### 📚 v1.3.0 — Catálogo Curricular DBA (MEN), Estados del Estudiante & Calendarios A/B
> **Fecha de Lanzamiento:** 11 a 30 de Junio, 2026  
> **Commits Representativos:** `6d790ce1`, `8e6e29d9`, `48942e86`, `d48631b3`, `794fab21`, `dfce1a09`, `9ac3676a`, `514e638c`, `a8b0ebe9`, `630771e1`, `4bdfaf79`, `4a3808a9`, `81654d4a`, `e122b80a`, `5c6bbc1d`, `3235baa4`, `11568469`, `9ae06f40`, `c360d912`, `2448b59d`

#### 🎯 Propósito y Resumen
Alineación pedagógica del sistema con las directrices del Ministerio de Educación Nacional de Colombia y formalización del ciclo de vida del estudiante.

#### ✨ Nuevas Características
- **Módulo de Catálogo DBA:** Asignación de evidencias de aprendizaje a las materias y cálculo de cobertura curricular por grado.
- **Máquina de Estados del Estudiante:** Gestión estricta de estados (`ACTIVO`, `SANCIONADO`, `EXPULSADO`, `RETIRADO`, `GRADUADO`) con reglas automáticas de activación/desactivación de cuenta de usuario.
- **Calendarios Académicos A y B:** Soporte para periodos lectivos diferenciados con fechas de inicio, fin y estados (`ABIERTO`, `CERRADO`, `PENDIENTE`).

---

### 📑 v1.2.0 — Cierre Global de Periodos, Generador de Boletines PDF & Portales Familia
> **Fecha de Lanzamiento:** 01 a 10 de Junio, 2026  
> **Commits Representativos:** `effe1ea3`, `0226932b`, `bbc11181`, `ebc9394c`, `f381049b`, `fb4b91cc`, `32a3f534`, `b63cccd2`, `26d18822`, `777f3ed8`, `cc377ae2`, `692cff7d`, `af359f17`, `03ed5f6d`, `9263e80e`, `4ac57763`, `bfa68b8f`, `6efee83b`, `e699a5fe`, `2bfaac86`, `836621ba`, `db3c6eac`, `b581cf1b`, `2b6a4236`, `8d30e8bf`

#### 🎯 Propósito y Resumen
Implementación del motor de evaluación institucional (SIEE), congelamiento de registros académicos y generación de informes oficiales de evaluación.

#### ✨ Nuevas Características
- **Cierre Global de Periodos:** Proceso transaccional que consolida notas, calcula puestos y promedios grupales y bloquea la edición docente.
- **Generador de Boletines Oficiales PDF:** Motor de maquetación con calificaciones por área/asignatura, faltas de asistencia, escala valorativa nacional y firmas del rector y director de grupo.
- **Observador Digital de Convivencia:** Registro categorizado de observaciones formativas y disciplinarias.
- **Diseño Neo-Glassmorphism:** Implementación de paletas oscuras elegantes con alto contraste.

---

### 👨‍🏫 v1.1.0 — Panel Directivo, Asignación Docente & Lógica de Calificaciones Inicial
> **Fecha de Lanzamiento:** 22 a 31 de Mayo, 2026  
> **Commits Representativos:** `4bd17941`, `cc3413c8`, `72df2474`, `92011755`, `ff4a6671`, `fb7fafd2`, `7b6441ab`

#### 🎯 Propósito y Resumen
Habilitación de las operaciones académicas fundamentales para rectores y coordinadores, permitiendo organizar la planta docente y habilitar la captura de notas.

#### ✨ Nuevas Características
- **Asignación Académica:** Vinculación de docentes a materias y grupos específicos (`detalle_grados`).
- **Planilla de Calificaciones Docente:** Interfaz para crear actividades evaluativas con porcentajes ponderados (sumatoria al 100%) y registro de notas en escala `1.0 a 5.0`.
- **Estructura Escolar:** Gestión de sedes, grados, secciones y jornadas escolares.

---

### 🏗️ v1.0.0 — Génesis del Sistema, Infraestructura PostgreSQL, Auth JWT & Matrículas MVP
> **Fecha de Lanzamiento:** 07 a 21 de Mayo, 2026  
> **Commits Representativos:** `6547bcf9`, `f85ae38e`, `d3013e03`, `0da156c2`, `4d5ab517`, `e288c3b3`, `58c91323`, `4aa5e065`

#### 🎯 Propósito y Resumen
Nacimiento del proyecto AcademiaNeiva. Construcción del núcleo de base de datos relacional, configuración del servidor API REST en Node.js Express y creación del cliente web inicial en Vue 3.

#### ✨ Nuevas Características
- **Modelo Relacional Base:** Esquema SQL con tablas maestras de colegios, usuarios, roles, estudiantes, docentes y matrículas.
- **Autenticación con JWT:** Sistema de inicio de sesión con token firmado y verificación de contraseñas con Bcrypt.
- **Módulo de Matrículas MVP:** Creación de solicitudes de inscripción básica y asignación a grupos.
- **Monorepositorio Estructurado:** Separación clara en subproyectos `/frontend`, `/backend` y `/guides`.

---

## 🔮 4. Hoja de Ruta Futura (Roadmap v2.6.0+)

- [ ] **Módulo de Notificaciones Push PWA:** Alertas instantáneas en dispositivos móviles para padres de familia sobre inasistencias y citaciones.
- [ ] **Integración con Sistemas de Firma Digital Acreditada:** Estampado cronológico y certificados digitales para boletines oficiales.
- [ ] **Módulo de Inteligencia Predictiva de Deserción Escolar:** Algoritmos de Machine Learning en base a patrones de inasistencia y bajas calificaciones para activar protocolos tempranos de acompañamiento.
- [ ] **Generador de Certificados y Constancias de Estudio Automatizado:** Emisión de paz y salvos y certificados de notas con verificación pública mediante código QR.

---

<div align="center">

**AcademiaNeiva** — Registro Histórico de Versiones  
*Comprometidos con la trazabilidad, la calidad técnica y la transformación de la educación en Neiva.*

</div>
