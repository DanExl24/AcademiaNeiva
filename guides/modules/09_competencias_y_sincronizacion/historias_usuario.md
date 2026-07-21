# Historias de Usuario — Competencias y Sincronización

Este documento contiene las historias de usuario implementadas para el módulo de Competencias y Sincronización de AcademiaNeiva.

---

# HU-COM-001: Registrar Competencia con Sincronización Automática en Paralelo

## Historia
**Como** directivo del colegio  
**Quiero** registrar una competencia en una materia para un periodo académico y un grupo específico  
**Para** que la planeación curricular se propague de forma automática a todos los cursos paralelos del mismo grado escolar.

## Criterios de Aceptación
- Al guardar la competencia en el grupo seleccionado, el sistema localiza todos los cursos del mismo tipo de grado (ej. Primero B y C si se guardó en Primero A) en el año lectivo.
- Crea un registro de competencia idéntico para cada grupo paralelo.
- A todos los registros del lote creados se les asigna el mismo identificador único `sync_uuid` para mantenerlos sincronizados en caliente.
- La creación asocia automáticamente 3 evidencias de aprendizaje por defecto para facilitar el trabajo inicial del docente.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-COM-001, RN-COM-002, RN-COM-004
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies`
- **Componentes frontend relacionados:** 
  - [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`upsertCompetencyByAdmin`)

---

# HU-COM-002: Editar Descripción de Competencia (Propagación Masiva)

## Historia
**Como** directivo o docente asignado  
**Quiero** actualizar el texto descriptivo de una competencia  
**Para** ajustar los objetivos pedagógicos y que el cambio se refleje simultáneamente en todos los cursos paralelos de mi nivel.

## Criterios de Aceptación
- El directivo o docente edita el texto en la planilla o panel de configuración.
- Al guardar, el backend actualiza de forma masiva en base de datos la columna `descripcion` de todos los registros de competencia que compartan el mismo `sync_uuid`.
- La operación debe realizarse dentro de una transacción atómica; si falla en algún paralelo, se revierte por completo.
- Se deniega la edición si el periodo se encuentra en estado `CERRADO`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo, Docente
- **Reglas de negocio relacionadas:** RN-COM-002, RN-COM-003
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies`
  - `PUT /api/teacher/competencies/:id`
- **Componentes frontend relacionados:** 
  - [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue)
  - [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`upsertCompetencyByAdmin`)
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`updateCompetency`)

---

# HU-COM-003: Crear Evidencia de Aprendizaje en Competencia

## Historia
**Como** directivo del colegio  
**Quiero** registrar una evidencia de aprendizaje personalizada dentro de una competencia  
**Para** definir los entregables y tareas específicas mediante los cuales los docentes evaluarán los objetivos del periodo.

## Criterios de Aceptación
- El directivo ingresa el texto de la evidencia.
- La evidencia se registra con un número de orden correlativo para su organización en las planillas.
- El sistema deniega el registro si el periodo correspondiente está cerrado.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies/:competenciaId/evidencias`
- **Componentes frontend relacionados:** 
  - [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createEvidencia`)

---

# HU-COM-004: Eliminar Competencia Curricular

## Historia
**Como** directivo del colegio  
**Quiero** eliminar una competencia del plan de estudios  
**Para** corregir errores de planificación o retirar metas de aprendizaje descartadas.

## Criterios de Aceptación
- El directivo presiona "Eliminar Competencia" en el panel.
- El sistema realiza un control de uso (`usage-check`). Si algún docente ya tiene actividades evaluativas de clase vinculadas a esta competencia o a sus evidencias de aprendizaje, el borrado se bloquea y se muestra un error en pantalla.
- Si no está en uso, se eliminan físicamente en bloque todos los registros del colegio que compartan el mismo `sync_uuid` junto con sus evidencias de aprendizaje hijas.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-COM-005
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/settings/competencies/:id/usage-check`
  - `DELETE /api/academic-admin/settings/competencies/:id`
- **Componentes frontend relacionados:** 
  - [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`checkCompetenciaUsage`, `deleteCompetencyByAdmin`)
