# Historias de Usuario — Catálogo DBA

Este documento contiene las historias de usuario implementadas para el módulo de Catálogo DBA de AcademiaNeiva.

---

# HU-DBA-001: Importación Masiva del Catálogo DBA desde PDF

## Historia
**Como** Administrador General  
**Quiero** subir un documento PDF oficial del Ministerio de Educación Nacional  
**Para** poblar masivamente el catálogo oficial de DBA y sus evidencias de aprendizaje en la plataforma.

## Criterios de Aceptación
- El Administrador General selecciona la versión curricular, el área y el archivo PDF.
- El backend procesa el PDF extrayendo de forma automatizada los DBA y sus evidencias oficiales.
- Si el procesamiento es exitoso, los DBA se guardan asociados a la versión seleccionada con estado `ACTIVO`.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `POST /api/admin/dba/importar`
- **Componentes frontend relacionados:** 
  - [DbaGlobalView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/DbaGlobalView.vue)
- **Controllers/Services relacionados:** 
  - [dbaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/dbaController.ts) (`importarDBAPDF`)

---

# HU-DBA-002: Asignar Versión Curricular a Institución

## Historia
**Como** Administrador General  
**Quiero** vincular una versión curricular de DBA a un colegio, grado y asignatura específicos  
**Para** definir qué Derechos Básicos de Aprendizaje del catálogo nacional debe planificar y evaluar dicho plantel.

## Criterios de Aceptación
- El Administrador General selecciona el colegio, asignatura, grado y versión curricular (ej. V2 2016).
- Se crea el registro de vinculación en `colegio_version_curricular`.
- Los directivos del colegio asignado solo podrán visualizar en su planeación los DBA pertenecientes a la versión vinculada para ese grado y área.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `POST /api/admin/dba/asignar-version`
- **Componentes frontend relacionados:** 
  - [DbaGlobalView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/DbaGlobalView.vue)
- **Controllers/Services relacionados:** 
  - [dbaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/dbaController.ts) (`asignarVersionColegio`)

---

# HU-DBA-003: Vincular Evidencias DBA a Competencias

## Historia
**Como** directivo del colegio  
**Quiero** asociar una o más evidencias oficiales del catálogo DBA a una competencia de mi asignatura  
**Para** consolidar la planeación académica de mi colegio alineada con las directrices nacionales.

## Criterios de Aceptación
- El directivo abre el modal de planeación en la vista de competencias.
- Visualiza las evidencias DBA disponibles. Las evidencias ya asignadas a otras competencias en el mismo grado/materia/año escolar figuran con un candado 🔒 de bloqueo de asignación.
- Al guardar la selección, la relación se propaga automáticamente a los cursos paralelos vía `sync_uuid`.
- Se valida de forma estricta que ninguna evidencia seleccionada colisione con competencias de otros periodos del mismo año.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-DBA-001, RN-DBA-002, RN-DBA-004
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencias/:competenciaId/vincular-evidencias-dba`
  - `GET /api/academic-admin/settings/dba-planeacion/disponibles/:schoolId`
- **Componentes frontend relacionados:** 
  - [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`vincularEvidenciasDbaACompetencia`, `getDbaPlaneacionDisponibles`)

---

# HU-DBA-004: Consultar Coherencia y Cobertura Curricular

## Historia
**Como** directivo del colegio  
**Quiero** visualizar los tableros analíticos de cobertura y coherencia curricular del periodo  
**Para** supervisar qué porcentaje del catálogo DBA ha sido evaluado en las aulas y analizar las justificaciones de desvíos docentes.

## Criterios de Aceptación
- El reporte de Coherencia califica cada evidencia planeada como `Cumple` (si tiene actividades asociadas en aula), `Pendiente` (si no tiene actividades) o `Extra` (evaluada fuera de periodo).
- Muestra el listado de actividades de "evidencias extras" con los motivos y justificaciones escritas por los docentes.
- El reporte de Cobertura despliega porcentajes acumulados de DBA evaluados frente a la totalidad del catálogo oficial asignado.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-DBA-005
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/settings/dba-reportes/coherencia/:schoolId`
  - `GET /api/academic-admin/settings/dba-reportes/cobertura/:schoolId`
- **Componentes frontend relacionados:** 
  - [DbaReportsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/DbaReportsView.vue)
- **Controllers/Services relacionados:** 
  - [dbaReportsController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/dbaReportsController.ts) (`obtenerReporteCoherenciaCurricular`, `obtenerReporteCoberturaDba`)

---

# HU-DBA-005: Vincular Evidencia en Actividad con Justificación Extra (Bypass de Planeación)

## Historia
**Como** docente del colegio  
**Quiero** enlazar una actividad evaluativa a una evidencia DBA de otro periodo (Evidencia Extra)  
**Para** flexibilizar la evaluación de mi curso ingresando obligatoriamente el motivo pedagógico y la justificación escrita exigida por el directivo.

## Criterios de Aceptación
- Al crear una actividad, el docente selecciona la evidencia DBA. Si la evidencia es de otro periodo, el sistema le solicita ingresar el motivo.
- Si el motivo seleccionado es "OTRO", la interfaz despliega una caja de texto obligatoria para detallar la `justificacion_extra`.
- Al guardar la actividad, la fecha de creación se almacena de forma inalterable para poblar el reporte cronológico de coherencia.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-DBA-003
- **Endpoints relacionados:** 
  - `POST /api/teacher/activities`
- **Componentes frontend relacionados:** 
  - [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue)
- **Controllers/Services relacionados:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createActivity`)
