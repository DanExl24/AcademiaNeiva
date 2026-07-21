# Historias de Usuario — Observaciones del Estudiante

Este documento contiene las historias de usuario implementadas para el módulo de Observaciones del Estudiante de AcademiaNeiva.

---

# HU-OBS-001: Registrar Anotación en Observador del Estudiante

## Historia
**Como** docente del curso  
**Quiero** ingresar una observación desglosando fortalezas, debilidades y recomendaciones y especificando su tipo  
**Para** dejar constancia pedagógica o disciplinaria sobre el desempeño del estudiante.

## Criterios de Aceptación
- El docente selecciona el estudiante, el periodo y el tipo de observación (`ACADEMICA`, `CONVIVENCIA`, `DISCIPLINARIA`, `OTRO`).
- Permite registrar campos de texto libre para Fortalezas, Debilidades y Recomendaciones.
- La observación de tipo `ACADEMICA` es obligatoria para cada estudiante evaluado en el periodo antes de cerrar la materia.
- El sistema guarda la fecha exacta del registro.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-OBS-001, RN-OBS-002
- **Endpoints relacionados:** 
  - `POST /api/teacher/observations`
- **Componentes frontend relacionados:** 
  - [TeacherObservations.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherObservations.vue)
- **Controllers/Services relacionados:** 
  - [observationController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/observationController.ts) (`createObservation`)

---

# HU-OBS-002: Modificar Observación del Estudiante

## Historia
**Como** docente del curso  
**Quiero** editar el texto o tipo de una observación previamente registrada  
**Para** corregir errores de redacción o actualizar la recomendación entregada.

## Criterios de Aceptación
- El docente hace clic en editar sobre su observación.
- No se permite editar la observación si el periodo escolar correspondiente se encuentra en estado `CERRADO`.
- Al guardar los cambios, la información se actualiza de forma inmediata en la base de datos.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-OBS-004
- **Endpoints relacionados:** 
  - `PUT /api/teacher/observations/:id`
- **Componentes frontend relacionados:** 
  - [TeacherObservations.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherObservations.vue)
- **Controllers/Services relacionados:** 
  - [observationController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/observationController.ts) (`updateObservation`)

---

# HU-OBS-003: Consultar Observaciones en Portales (Estudiantes, Padres y Directivos)

## Historia
**Como** estudiante, padre de familia o directivo  
**Quiero** visualizar las observaciones del observador filtradas por periodo  
**Para** conocer el seguimiento académico y de convivencia registrado por los docentes.

## Criterios de Aceptación
- Muestra el listado de anotaciones clasificadas con badges por su tipo (`ACADEMICA`, `CONVIVENCIA`, etc.).
- Despliega el nombre de la asignatura y del docente que emitió la recomendación.
- Los padres de familia pueden consultar las anotaciones de sus hijos a cargo de forma transparente.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Estudiante, Padre de Familia, Directivo
- **Reglas de negocio relacionadas:** RN-OBS-003
- **Endpoints relacionados:** 
  - `GET /api/student/observations/:id_estudiante/:id_periodo`
  - `GET /api/teacher/observations/:detailGradeId/:periodId`
- **Componentes frontend relacionados:** 
  - [StudentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentObservationsView.vue)
  - [ParentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentObservationsView.vue)
- **Controllers/Services relacionados:** 
  - [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) (`getStudentObservations`)
  - [observationController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/observationController.ts) (`getObservations`)
