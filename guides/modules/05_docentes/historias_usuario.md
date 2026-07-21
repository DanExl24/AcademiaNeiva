# Historias de Usuario — Docentes

Este documento contiene las historias de usuario implementadas para el módulo de Gestión de Docentes y Asignación Académica de AcademiaNeiva.

---

# HU-DOC-001: Registrar Docente

## Historia
**Como** directivo del colegio  
**Quiero** ingresar los datos de un docente (nombre, apellido, documento, tipo de documento, email)  
**Para** registrarlo en la planta de personal docente y habilitarle sus accesos.

## Criterios de Aceptación
- El correo electrónico y el documento del docente no deben existir previamente en el sistema.
- Al registrar el docente, el sistema inserta de forma automática un usuario con rol `docente` en la tabla `usuario` en estado `ACTIVO`.
- Se genera una contraseña temporal segura y se envía de forma asíncrona un correo electrónico de bienvenida con las instrucciones de acceso.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-DOC-001, RN-DOC-002, RN-DOC-003
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/teachers`
- **Componentes frontend relacionados:** 
  - [TeacherManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/TeacherManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createTeacher`)
  - [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) (`sendTeacherWelcomeEmail`)

---

# HU-DOC-002: Cambiar Estado del Docente (Activar / Inactivar)

## Historia
**Como** directivo del colegio  
**Quiero** cambiar el estado de actividad de un docente  
**Para** suspender su acceso o reactivarlo según su situación laboral vigente.

## Criterios de Aceptación
- El directivo puede cambiar el estado a `ACTIVO` o `INACTIVO`.
- Si el docente pasa a estado `INACTIVO`, el usuario de sesión asociado se marca como inactivo (`usuario.activo = false` o estado correspondiente), impidiéndole el login o realizar cambios.
- Sus registros académicos previos (notas, fallas) no sufren alteración.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/teachers/:id/status`
- **Componentes frontend relacionados:** 
  - [TeacherManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/TeacherManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateTeacherStatus`)

---

# HU-DOC-003: Asignar Docente a Curso y Materia (Asignación Académica)

## Historia
**Como** directivo del colegio  
**Quiero** asignar a un docente una materia y un grupo de clase específico para el año lectivo  
**Para** autorizarle a planificar y calificar a los estudiantes de dicho curso.

## Criterios de Aceptación
- El directivo debe seleccionar el docente, la materia y el grupo.
- La combinación de materia y grupo no debe tener ya un docente asignado en el año lectivo en curso.
- El docente debe estar en estado `ACTIVO` para recibir asignaciones.
- Se crea la relación en la tabla `detalle_grados` para el colegio y año lectivo.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-DOC-004
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/teacher-assignments`
- **Componentes frontend relacionados:** 
  - [TeacherManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/TeacherManagement.vue) (Pestaña de Asignación Académica)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`assignTeacherCourseSubject`)

---

# HU-DOC-004: Eliminar Asignación Académica

## Historia
**Como** directivo del colegio  
**Quiero** remover la asignación académica de un docente sobre un curso  
**Para** reasignar la materia a otro docente o deshacer errores de programación escolar.

## Criterios de Aceptación
- El directivo puede presionar eliminar en la lista de asignaciones.
- El sistema no permitirá la eliminación de la asignación si ya existen actividades de evaluación con notas registradas o fallas de asistencia creadas por el docente para ese curso en el periodo actual.
- Al procesarse correctamente, la relación se elimina de la tabla `detalle_grados`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-DOC-005
- **Endpoints relacionados:** 
  - `DELETE /api/academic-admin/teacher-assignments/:id`
- **Componentes frontend relacionados:** 
  - [TeacherManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/TeacherManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`deleteTeacherAssignment`)

---

# HU-DOC-005: Consultar Asignación Académica (Mis Cursos)

## Historia
**Como** docente del colegio  
**Quiero** ingresar al portal y ver los cursos y materias que tengo asignados  
**Para** acceder rápidamente a sus planillas de notas, control de asistencia y observador.

## Criterios de Aceptación
- El docente debe estar autenticado en el sistema.
- Se muestran exclusivamente los grupos y asignaturas vinculados a su ID en la tabla `detalle_grados` para el año escolar activo.
- Al hacer clic en un curso, se le redirige a la consola de control del aula.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-DOC-004
- **Endpoints relacionados:** 
  - `GET /api/teacher/courses/:userId`
- **Componentes frontend relacionados:** 
  - [TeacherCourses.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherCourses.vue)
  - [TeacherDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherDashboard.vue)
- **Controllers/Services relacionados:** 
  - [academicController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicController.ts) (`getTeacherCourses`)
