# 🎓 Módulo de Estudiantes y Estados

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Ciclo de Vida y Estados de Estudiantes  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo se encarga del seguimiento y la gestión del ciclo de vida académico de los estudiantes dentro de la institución. Controla la asignación y modificación de sus estados personales (`ACTIVO`, `SANCIONADO`, `EXPULSADO`, `RETIRADO`, `GRADUADO`), así como la correlación lógica con el estado de sus matrículas. Además, define de forma estricta los permisos de acceso al portal estudiantil y el impacto de los cambios de estado en las métricas de rendimiento y la generación masiva de boletines académicos.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Directivo** | Modificación del estado del estudiante, control de sanciones disciplinarias, graduación de alumnos, traslados y cambio de grado. |
| **Docente** | Consulta de fichas de estudiantes, asignación a su respectivo observador. |
| **Estudiante** | Acceso de consulta a notas, fallas, boletines y observaciones acumuladas en su perfil personal. |
| **Padre** | Monitoreo y consulta del estado e historial académico de todos sus hijos a cargo. |

---

## 3. Acciones Disponibles

### Acciones Administrativas (Directivo)

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Listar todos los estudiantes del colegio | `GET` | `/api/student/colegio/:idColegio` | Directivo |
| Obtener ficha de resumen de un estudiante | `GET` | `/api/student/:id/summary` | Directivo |
| Actualizar información del estudiante | `PUT` | `/api/student/:id` | Directivo |
| Cambiar estado del estudiante y su matrícula | `PATCH` | `/api/student/:id/status` | Directivo |
| Cambiar grado o grupo del estudiante | `PATCH` | `/api/student/:id/change-grade` | Directivo |
| Registrar graduación del estudiante | `POST` | `/api/student/:id/graduate` | Directivo |
| Eliminar estudiante (con restricciones) | `DELETE` | `/api/student/:id` | Directivo |
| Listar tipos de sanciones disciplinarias | `GET` | `/api/student/sanctions/types` | Directivo |

### Acciones del Portal Estudiantil (Estudiantes y Padres)

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Consultar ID de estudiante por ID de usuario | `GET` | `/api/student/user-id/:id_usuario` | Estudiante / Padre |
| Obtener información general del perfil | `GET` | `/api/student/info/:id_estudiante` | Estudiante / Padre |
| Listar periodos cerrados para boletines | `GET` | `/api/student/periods/:id_estudiante/:id_anio` | Estudiante / Padre |
| Listar todos los periodos del año lectivo | `GET` | `/api/student/all-periods/:id_estudiante/:id_anio` | Estudiante / Padre |
| Consultar asignaturas y promedios | `GET` | `/api/student/grades/:id_estudiante/:id_periodo` | Estudiante / Padre |
| Detalle de actividades y notas por materia | `GET` | `/api/student/grade-details/:id_estudiante/:id_periodo/:id_materia` | Estudiante / Padre |
| Consultar fallas de asistencia | `GET` | `/api/student/attendance/:id_estudiante/:id_periodo` | Estudiante / Padre |
| Consultar anotaciones del observador | `GET` | `/api/student/observations/:id_estudiante/:id_periodo` | Estudiante / Padre |
| Obtener listado de hijos vinculados | `GET` | `/api/student/parent-children/:id_usuario` | Padre |
| Consultar años académicos cursados | `GET` | `/api/student/academic-years/:id_estudiante` | Estudiante / Padre |

---

## 4. Reglas de Negocio

- **RN-EST-001 (Correlación de Estado de Matrícula):** El estado personal del estudiante en la tabla `estudiante` está directamente vinculado con el estado de su matrícula académica anual en la tabla `matricula` según la siguiente matriz de control:
  - Estudiante `ACTIVO` → Matrícula `ACTIVA` (Acceso permitido)
  - Estudiante `SANCIONADO` → Matrícula `ACTIVA` (Acceso permitido con advertencias disciplinarias)
  - Estudiante `RETIRADO` → Matrícula `CANCELADA` con motivo `RETIRO_VOLUNTARIO` (Acceso bloqueado)
  - Estudiante `EXPULSADO` → Matrícula `CANCELADA` con motivo `EXPULSION` (Acceso bloqueado)
- **RN-EST-002 (Control de Acceso por Autenticación):** El proceso de inicio de sesión (`student-login`) comprueba que el usuario asociado al estudiante esté marcado como `activo = true`. Al cambiar el estado de un alumno a `RETIRADO` o `EXPULSADO`, el backend de forma inmediata inactiva su usuario de acceso.
- **RN-EST-003 (Sanciones Temporales y Sincronización Automática):** A través del trigger de base de datos `fn_sync_estudiante_sancion`, cuando se inserta o modifica una sanción disciplinaria en la tabla `sancion` que esté vigente, el estado del estudiante cambia automáticamente a `SANCIONADO` o `EXPULSADO` (según el tipo). Al vencer la fecha final de la sanción, si no existen otras sanciones vigentes, el trigger revierte el estado del estudiante a `ACTIVO` de forma automatizada.
- **RN-EST-004 (Impacto Curricular y Boletines):** Solo los estudiantes con matrícula `ACTIVA` (estados `ACTIVO` y `SANCIONADO`) participan de la generación regular de boletines del periodo. Los alumnos retirados o expulsados conservan su histórico de calificaciones acumuladas para auditorías externas, pero su matrícula figura como `CANCELADA`.
- **RN-EST-005 (Filtro Estadístico Directivo):** Las métricas analíticas de promedios de grupo, reprobados y tasa de deserción que se despliegan en el Dashboard del directivo omiten por completo a los estudiantes con matrícula `CANCELADA` para evitar sesgos en el cálculo estadístico del periodo activo.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller Administrativo** | [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) — Operaciones CRUD de directivos, graduación y sanciones. |
| **Controller del Portal** | [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) — Endpoints de consulta para estudiantes y padres de familia. |
| **Routes** | [student.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/student.routes.ts) |
| **Triggers SQL** | [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Función `fn_sync_estudiante_sancion` vinculada a la tabla `sancion`. |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vistas Administrativas** | [StudentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/StudentManagement.vue) — Consola directiva de control de alumnos. |
| **Vistas Portal Estudiante** | [StudentDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentDashboard.vue), [StudentGradesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentGradesView.vue), [SubjectDetailsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/SubjectDetailsView.vue), [StudentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentAttendanceView.vue), [StudentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentObservationsView.vue), [StudentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentBoletinView.vue). |
| **Vistas Portal Padre** | [ParentDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentDashboard.vue), [ParentGradesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentGradesView.vue), [ParentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentAttendanceView.vue), [ParentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentObservationsView.vue), [ParentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentBoletinView.vue). |

---

## 6. Modelo de Datos

### Tabla: `estudiante`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_estudiante` | SERIAL PK | Identificador único del alumno. |
| `nombre` | VARCHAR(100) | Nombres del estudiante. |
| `apellido` | VARCHAR(100) | Apellidos del estudiante. |
| `documento` | VARCHAR(12) | Documento de identidad (cruzado con matrículas). |
| `codigo` | VARCHAR(20) | Código único alfanumérico para ingreso estudiantil. |
| `id_tipodocumento` | INT FK | Referencia al catálogo de tipos de documento. |
| `id_colegio` | INT FK | Colegio en el que cursa. |
| `id_usuario` | INT FK | Usuario asignado para el login. |
| `estado` | `estado_estudiante` | `ACTIVO`, `SANCIONADO`, `EXPULSADO`, `RETIRADO`, `GRADUADO`. |
| `motivo_estado` | TEXT | Justificación del cambio de estado. |

### Tabla: `sancion`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_sancion` | SERIAL PK | Identificador de la sanción. |
| `id_estudiante` | INT FK | Alumno sancionado. |
| `id_tipo_sancion` | INT FK | Tipo de sanción (ej. Suspensión temporal, Expulsión). |
| `fecha_inicio` | DATE | Fecha de inicio de la sanción. |
| `fecha_fin` | DATE | Fecha de finalización. |
| `estado` | `estado_sancion` | `ACTIVA`, `REVOCADA`, `VENCIDA`. |

---

## 7. Conexiones con Otros Módulos

- **→ Autenticación**: El inicio de sesión para el rol `estudiante` depende de su estado. El cambio a expulsado/retirado bloquea el acceso en `usuario`.
- **→ Matrículas**: La matrícula inicial genera el registro del estudiante y de su respectivo usuario responsable.
- **→ Observaciones**: Las anotaciones del observador alimentan la ficha de resumen del estudiante consultada por los directivos.
- **→ Calificaciones**: Los promedios del periodo calculados por docentes se asocian al estudiante para poblar el boletín final.

---

## 8. Validaciones Implementadas

### Backend
- Bloqueo inmediato del usuario si el estado del estudiante pasa a `EXPULSADO` o `RETIRADO`.
- Trigger `fn_sync_estudiante_sancion` que evalúa fechas en caliente para conmutar el estado del estudiante.
- El cambio de grado del estudiante valida que el grupo de destino pertenezca al mismo colegio y tenga cupos disponibles.

### Frontend
- Despliegue de banners de advertencia de color ámbar en el dashboard si el estudiante posee sanciones activas.
- Formularios del portal estudiantil protegidos para evitar ediciones de datos (solo consulta de notas y observaciones).

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Trigger automático de sanciones** | Elimina la necesidad de correr cronjobs diarios para cambiar el estado de los alumnos; el estado se recalcula al consultar o modificar la sanción. |
| **Consulta única para Padres** | El portal del padre de familia reutiliza de manera idéntica los endpoints y componentes del portal del estudiante, pasando el `id_estudiante` seleccionado, optimizando la reutilización de código en el frontend. |
| **Inhabilitar credenciales en vez de borrar** | Preserva la cuenta física en base de datos para auditorías e históricos, impidiendo únicamente la entrega del token JWT. |
