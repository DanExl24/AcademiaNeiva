# Historias de Usuario — Calificaciones y Actividades

Este documento contiene las historias de usuario implementadas para el módulo de Calificaciones y Actividades de AcademiaNeiva.

---

# HU-CAL-001: Crear Actividad Evaluativa de Asignatura

## Historia
**Como** docente del curso  
**Quiero** registrar una nueva actividad evaluativa asignándole un nombre, porcentaje e id de competencia  
**Para** definir la estructura de evaluación del periodo en mi asignatura.

## Criterios de Aceptación
- El docente solo puede crear actividades en materias y grupos que tenga asignados en `detalle_grados`.
- La actividad debe estar anclada a una competencia válida y activa.
- La sumatoria de las ponderaciones porcentuales de todas las actividades de la materia no debe superar el 100%.
- El sistema deniega la creación si el periodo académico correspondiente o el cierre de materia está en estado `CERRADO`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-CAL-001, RN-CAL-003
- **Endpoints relacionados:** 
  - `POST /api/teacher/activities`
- **Componentes frontend relacionados:** 
  - [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue)
- **Controllers/Services relacionados:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createActivity`)

---

# HU-CAL-002: Crear Criterio de Evaluación en Actividad

## Historia
**Como** docente del curso  
**Quiero** desglosar una actividad evaluativa en múltiples criterios porcentuales  
**Para** evaluar aspectos específicos (ej. Presentación, Contenido, Exposición) en una misma tarea.

## Criterios de Aceptación
- El docente selecciona la actividad padre y registra el nombre y porcentaje del criterio.
- La sumatoria de las ponderaciones de todos los criterios pertenecientes a una misma actividad debe dar exactamente el 100%.
- Si la actividad pasa a tener criterios, las notas de los alumnos deberán registrarse en la tabla `nota_criterio`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-CAL-001, RN-CAL-002
- **Endpoints relacionados:** 
  - `POST /api/teacher/activities/criteria`
- **Componentes frontend relacionados:** 
  - [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue)
- **Controllers/Services relacionados:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createCriterion`)

---

# HU-CAL-003: Registrar y Actualizar Calificaciones Masivas

## Historia
**Como** docente del curso  
**Quiero** ingresar las notas de los estudiantes directamente en la planilla interactiva y guardar los cambios  
**Para** actualizar el rendimiento académico de los alumnos en tiempo real.

## Criterios de Aceptación
- La nota ingresada para cada estudiante debe ser un valor numérico ubicado dentro del rango válido de la escala del colegio (ej. entre 1.00 y 5.00).
- Si la actividad tiene criterios, la nota ingresada se almacena en `nota_criterio`. Si no tiene criterios, se guarda en `notas_actividad`.
- Si el periodo está en estado `CERRADO`, la interfaz deshabilita la edición y el backend rechaza la petición.
- El sistema recalcula automáticamente los promedios en pantalla tras el guardado exitoso.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-CAL-002, RN-CAL-003
- **Endpoints relacionados:** 
  - `POST /api/teacher/grades`
  - `GET /api/teacher/grades/:gradeId/:subjectId/:periodId`
- **Componentes frontend relacionados:** 
  - [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue)
- **Controllers/Services relacionados:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`saveGrades`, `getGrades`)

---

# HU-CAL-004: Eliminar Actividad Evaluativa o Criterio

## Historia
**Como** docente del curso  
**Quiero** eliminar una actividad o un criterio que ya no se va a evaluar  
**Para** ajustar la estructura de ponderación del periodo en mi materia.

## Criterios de Aceptación
- El docente presiona eliminar sobre la actividad o criterio.
- Si el periodo está cerrado, se deniega la eliminación.
- Al procesarse correctamente, se eliminan en cascada las notas registradas asociadas a dicha actividad o criterio en la base de datos.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-CAL-003
- **Endpoints relacionados:** 
  - `DELETE /api/teacher/activities/:id`
  - `DELETE /api/teacher/activities/criteria/:id`
- **Componentes frontend relacionados:** 
  - [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue)
- **Controllers/Services relacionados:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`deleteActivity`, `deleteCriterion`)

---

# HU-CAL-005: Consultar Desglose de Notas por Asignatura (Portal Estudiantil y Padre)

## Historia
**Como** estudiante o padre de familia  
**Quiero** ingresar al detalle de una materia  
**Para** visualizar la lista completa de actividades evaluadas, sus porcentajes y las notas obtenidas.

## Criterios de Aceptación
- Muestra el listado de actividades y criterios evaluados con sus respectivas notas y ponderaciones.
- Indica el promedio parcial ponderado acumulado en la asignatura.
- Si la nota obtenida es inferior a la nota de aprobación del colegio, se resalta visualmente en color rojo.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Estudiante, Padre de Familia
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `GET /api/student/grades/:id_estudiante/:id_periodo`
  - `GET /api/student/grade-details/:id_estudiante/:id_periodo/:id_materia`
- **Componentes frontend relacionados:** 
  - [StudentGradesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentGradesView.vue)
  - [SubjectDetailsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/SubjectDetailsView.vue)
- **Controllers/Services relacionados:** 
  - [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) (`getStudentGrades`, `getGradeDetails`)
