# Historias de Usuario — Asistencia Escolar

Este documento contiene las historias de usuario implementadas para el módulo de Asistencia Escolar de AcademiaNeiva.

---

# HU-ASI-001: Tomar Asistencia Diaria del Curso

## Historia
**Como** docente del curso  
**Quiero** cargar la lista de estudiantes de la fecha actual y marcar su estado de asistencia  
**Para** registrar el control diario de fallas y asistencia en mi clase.

## Criterios de Aceptación
- La lista de estudiantes se precarga por defecto con el estado `PRESENTE` para agilizar el registro.
- El docente puede cambiar el estado de cada estudiante a `PRESENTE`, `AUSENTE`, `TARDE` o `JUSTIFICADA`.
- El sistema no permite guardar la planilla si el registro hace que algún estudiante supere el límite máximo de 7 bloques de clase al día.
- Al guardar correctamente, los datos se persisten en la tabla `registro_asistencia`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-ASI-001, RN-ASI-002, RN-ASI-003
- **Endpoints relacionados:** 
  - `GET /api/teacher/attendance/:detailGradeId/:date`
  - `POST /api/teacher/attendance`
- **Componentes frontend relacionados:** 
  - [TeacherAttendance.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherAttendance.vue)
- **Controllers/Services relacionados:** 
  - [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts) (`getAttendanceByDate`, `saveAttendance`)

---

# HU-ASI-002: Modificar Registro de Asistencia de Fecha Anterior

## Historia
**Como** docente del curso  
**Quiero** reabrir la planilla de una fecha pasada para cambiar el estado de un alumno (ej. actualizar a Justificada al recibir excusa médica)  
**Para** mantener actualizado el historial de inasistencias de mi grupo.

## Criterios de Aceptación
- El docente selecciona la fecha pasada en el calendario de asistencia.
- Si la fecha corresponde a un periodo `CERRADO`, el backend bloquea la edición y el trigger SQL aborta la transacción.
- Si el periodo está abierto, permite cambiar el estado (ej. de `AUSENTE` a `JUSTIFICADA`).
- Al guardar la modificación de la misma materia y fecha, el sistema actualiza el registro existente sin contabilizar un nuevo bloque de clase diario.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-ASI-003, RN-ASI-004
- **Endpoints relacionados:** 
  - `POST /api/teacher/attendance`
- **Componentes frontend relacionados:** 
  - [TeacherAttendance.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherAttendance.vue)
- **Controllers/Services relacionados:** 
  - [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts) (`saveAttendance`)

---

# HU-ASI-003: Consultar Inasistencias en Portales de Estudiantes y Padres

## Historia
**Como** estudiante o padre de familia  
**Quiero** ingresar a la sección de asistencia de mi portal  
**Para** verificar el total de fallas acumuladas por asignatura en el periodo y revisar qué días se registraron inasistencias.

## Criterios de Aceptación
- Muestra el conteo total de inasistencias no justificadas (`AUSENTE`), llegadas tarde (`TARDE`) e inasistencias justificadas (`JUSTIFICADA`).
- Despliega el desglose por asignatura.
- Permite filtrar los registros por periodos académicos.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Estudiante, Padre de Familia
- **Reglas de negocio relacionadas:** RN-ASI-005
- **Endpoints relacionados:** 
  - `GET /api/student/attendance/:id_estudiante/:id_periodo`
- **Componentes frontend relacionados:** 
  - [StudentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentAttendanceView.vue)
  - [ParentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentAttendanceView.vue)
- **Controllers/Services relacionados:** 
  - [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) (`getStudentAttendance`)
