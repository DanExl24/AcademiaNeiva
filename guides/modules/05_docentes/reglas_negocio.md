# Reglas de Negocio — Docentes

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Gestión de Docentes y Asignación Académica de AcademiaNeiva.

---

## Registro y Credenciales

### RN-DOC-001: Control de Duplicados en Registro Docente
- **Descripción:** El número de documento de identidad del docente debe ser único a nivel de institución y no estar registrado en ninguna otra cuenta del sistema.
- **Motivo:** Evita inconsistencias en las llaves de base de datos y previene la suplantación de identidad del personal escolar.
- **Módulos afectados:** Gestión de Docentes, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createTeacher`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/teachers`
- **Historias de usuario relacionadas:** HU-DOC-001

---

### RN-DOC-002: Vinculación e Inserción de Usuario Docente
- **Descripción:** Al guardar un registro en la tabla `docente`, el backend insertará simultáneamente un registro en `usuario` con el rol `docente` en estado `ACTIVO` compartiendo el correo y documento.
- **Motivo:** Automatiza la creación de credenciales de acceso para que el docente pueda usar la plataforma inmediatamente sin requerir procesos de soporte adicionales.
- **Módulos afectados:** Gestión de Docentes, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createTeacher`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/teachers`
- **Historias de usuario relacionadas:** HU-DOC-001

---

### RN-DOC-003: Envío Asíncrono de Email de Bienvenida
- **Descripción:** La contraseña temporal generada se debe enviar de forma automática al correo del docente. Este envío SMTP se ejecuta de manera asíncrona no bloqueante.
- **Motivo:** Evita que fallas temporales en la red del servidor de correos (SMTP) bloqueen el registro del docente en la base de datos del colegio.
- **Módulos afectados:** Gestión de Docentes.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createTeacher` - catch del servicio de email)
  - [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) (`sendTeacherWelcomeEmail`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/teachers`
- **Historias de usuario relacionadas:** HU-DOC-001

---

## Asignación Académica

### RN-DOC-004: Restricción de Alcance de Operación (Aislamiento de Cursos)
- **Descripción:** Un docente solo está autorizado para consultar planillas, crear actividades y registrar notas o asistencias sobre los grupos y materias que posea asignados en `detalle_grados` para el año lectivo en curso.
- **Motivo:** Garantiza la confidencialidad de la información y evita que un docente altere de forma accidental las calificaciones de cursos ajenos a su asignación académica.
- **Módulos afectados:** Gestión de Docentes, Calificaciones, Asistencia, Observaciones.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (Validaciones en `getActivities`, `getGrades`, `saveGrades`)
  - [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts) (`saveAttendance`)
- **Endpoints relacionados:** 
  - `GET /api/teacher/grades/:gradeId/:subjectId/:periodId`
  - `POST /api/teacher/grades`
  - `POST /api/teacher/attendance`
- **Historias de usuario relacionadas:** HU-DOC-005

---

### RN-DOC-005: Restricción de Eliminación de Asignación Curricular Activa
- **Descripción:** El sistema denegará la eliminación de una asignación en `detalle_grados` si existen registros históricos de notas o fallas de asistencia asociados a dicha asignación en el periodo académico actual.
- **Motivo:** Protege la integridad de los datos escolares e impide dejar calificaciones sin asignación docente válida en la base de datos.
- **Módulos afectados:** Gestión de Docentes, Calificaciones, Asistencia.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`deleteTeacherAssignment`)
- **Endpoints relacionados:** 
  - `DELETE /api/academic-admin/teacher-assignments/:id`
- **Historias de usuario relacionadas:** HU-DOC-004
