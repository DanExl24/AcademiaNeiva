# 👩‍🏫 Módulo de Gestión de Docentes y Asignación Académica

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Docentes y Asignaciones  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo permite a los directivos del colegio gestionar todo el personal docente de la institución. Esto abarca el registro de nuevos docentes, la actualización de sus datos personales y contractuales, la desactivación de sus cuentas si abandonan la institución, y la asignación académica detallada de materias y grupos. Asimismo, automatiza el flujo de bienvenida por correo electrónico para que los docentes reciban sus credenciales iniciales de forma segura.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Directivo** | CRUD completo de docentes del colegio. Gestión de la asignación académica (`detalle_grados`). |
| **Docente** | Consulta de su propia asignación académica (cursos y materias asignadas). |
| **Público** | Sin acceso. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Obtener listado de docentes del colegio | `GET` | `/api/academic-admin/teachers/:schoolId` | Directivo |
| Registrar nuevo docente | `POST` | `/api/academic-admin/teachers` | Directivo |
| Cambiar estado de actividad del docente | `PATCH` | `/api/academic-admin/teachers/:id/status` | Directivo |
| Crear asignación docente-grupo-materia | `POST` | `/api/academic-admin/teacher-assignments` | Directivo |
| Eliminar asignación académica | `DELETE` | `/api/academic-admin/teacher-assignments/:id` | Directivo |
| Listar cursos del docente autenticado | `GET` | `/api/teacher/courses/:userId` | Docente |

---

## 4. Reglas de Negocio

- **RN-DOC-001 (Unicidad de Documento):** Cada docente debe estar registrado con un documento de identidad único en la plataforma.
- **RN-DOC-002 (Creación Automática de Usuario):** Al registrar un docente, el backend crea de forma automática su cuenta en la tabla `usuario` con el rol `docente` y estado `ACTIVO`.
- **RN-DOC-003 (Generación de Contraseña Temporal):** Durante el registro, el sistema genera una contraseña temporal de alta seguridad y envía un correo de bienvenida automático al docente con sus credenciales de acceso iniciales.
- **RN-DOC-004 (Aislamiento de Asignación):** Un docente solo puede registrar actividades, asistencias y calificaciones en las materias y grupos que tenga explícitamente asignados en la tabla `detalle_grados` para el año lectivo en curso.
- **RN-DOC-005 (Restricción de Eliminación de Asignaciones):** No se puede eliminar una asignación académica de `detalle_grados` si existen registros históricos de calificaciones o inasistencias asociados en el periodo actual. Esto evita la pérdida de datos curriculares.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller de Gestión** | [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `createTeacher`, `updateTeacherStatus`, `assignTeacherCourseSubject`, `deleteTeacherAssignment`, `getTeacherManagementData` |
| **Controller de Docente** | [academicController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicController.ts) — `getTeacherCourses` |
| **Routes** | [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts), [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts) |
| **Servicio de Notificación** | [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) — `sendTeacherWelcomeEmail` (SMTP) |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vista Directivo** | [TeacherManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/TeacherManagement.vue) |
| **Vista Docente** | [TeacherCourses.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherCourses.vue), [TeacherDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherDashboard.vue) |

---

## 6. Modelo de Datos

### Tabla: `docente`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_docente` | SERIAL PK | Identificador único del docente. |
| `nombre` | VARCHAR(255) | Nombre del docente. |
| `apellido` | VARCHAR(255) | Apellido del docente. |
| `documento` | VARCHAR(255) | Documento de identidad (clave de control). |
| `id_tipodocumento` | INT FK | Referencia al catálogo de tipos de documento. |
| `id_contratodocente` | INT FK | Enlace al estado del contrato. |
| `id_colegio` | INT FK | Colegio de adscripción. |
| `id_usuario` | INT FK | Enlace a la cuenta de usuario del sistema. |
| `estado` | VARCHAR(20) | Estado actual del docente (`ACTIVO`, `INACTIVO`). |

### Tabla: `detalle_grados` (Asignación Académica)

| Columna | Tipo | Descripción |
|---|---|---|
| `id_detallegrado` | SERIAL PK | Identificador único de la asignación. |
| `id_materia` | INT FK | Materia asignada. |
| `id_docente` | INT FK | Docente responsable. |
| `id_colegio` | INT FK | Colegio del curso. |
| `id_grupo` | INT FK | Grupo asignado. |

---

## 7. Conexiones con Otros Módulos

- **→ Autenticación**: Crea automáticamente usuarios con rol `docente` vinculados a sus credenciales.
- **→ Calificaciones**: Los docentes registran notas para sus estudiantes solo en sus asignaciones de `detalle_grados`.
- **→ Estructura Escolar**: Requiere grupos y materias preconfigurados para establecer la asignación académica.
- **→ Notificaciones**: Desencadena el correo electrónico SMTP de bienvenida para la entrega segura de contraseñas iniciales.

---

## 8. Validaciones Implementadas

### Backend
- Comprobación de que el email o documento del docente no esté ya registrado en el colegio.
- Validación de que el directivo pertenezca al mismo colegio (`id_colegio` coincidente) antes de guardar una asignación académica.
- Verificación del estado activo del docente al consultar cursos disponibles.

### Frontend
- Validación visual de formato de correo electrónico y campos vacíos en el formulario de registro.
- Advertencias informativas ante la desvinculación o suspensión de un docente.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Creación asíncrona de email** | Evita que el cliente Express se quede esperando a que el servidor SMTP responda. Si el correo falla, el docente se crea igualmente en el sistema. |
| **Separación de tablas `usuario` y `docente`** | Permite registrar información administrativa del docente sin ensuciar la tabla global de usuarios del sistema. |
| **Detalle de grados centralizado** | Facilita las consultas del portal del docente reduciendo la necesidad de múltiples uniones complejas en la base de datos. |
| **Soporte Docente Multi-Institución (`UNIQUE(id_usuario, id_colegio)`)** | **`usuario_colegio`** es la fuente de verdad de **autorización y acceso** (login, selector de colegio, permisos), mientras que **`docente`** es la fuente de verdad **operativa y académica** (relacionada a `detalle_grados`, evaluaciones, asistencias). Esto previene mezclar cargas lectivas entre colegios y mantiene intacta la auditoría histórica. |
