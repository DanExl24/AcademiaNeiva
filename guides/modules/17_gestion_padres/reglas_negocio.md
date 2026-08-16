# Reglas de Negocio — Gestión de Padres de Familia

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Gestión de Padres de Familia (Acudientes) de AcademiaNeiva.

---

## Control de Cuentas y Accesos

### RN-PAD-001: Estandarización de Estado de Cuenta (Activo / Inactivo)
- **Descripción:** El estado de la cuenta del acudiente se presenta exclusivamente en dos opciones (`Activo` o `Inactivo`), evaluando de forma integrada `usuario.activo`, `padre_familia.estado` y la presencia del timestamp en `usuario.logged_out_at`.
- **Motivo:** Homogeniza la experiencia de administración eliminando inconsistencias entre estados intermedios.
- **Módulos afectados:** Gestión de Padres de Familia, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) (`getSchoolParents`)
  - [ParentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ParentManagement.vue)
- **Endpoints relacionados:** `GET /api/parents/school/:schoolId`
- **Historias de usuario relacionadas:** HU-PAD-001, HU-PAD-003

---

### RN-PAD-002: Inactivación Atómica de Sesión y Acceso (`logged_out_at`)
- **Descripción:** Al cambiar el estado de un acudiente a `INACTIVO`, el backend ejecuta una transacción SQL que marca `padre_familia.estado = 'INACTIVO'`, `usuario.activo = false` e inserta la fecha y hora actual en `usuario.logged_out_at`.
- **Motivo:** Garantiza que las sesiones activas en navegadores o dispositivos móviles queden invalidadas al instante sin esperar a la expiración natural del token JWT.
- **Módulos afectados:** Gestión de Padres de Familia, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) (`updateParentAccountStatus`)
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (Verificación de token contra `logged_out_at`)
- **Endpoints relacionados:** `PATCH /api/parents/:id/status`
- **Historias de usuario relacionadas:** HU-PAD-003

---

## Identificación y Seguridad

### RN-PAD-003: Detección y Notificación de Doble Rol (Padre y Docente)
- **Descripción:** El backend realiza una comprobación cruzada contra la tabla `docente` mediante número de documento o correo electrónico. Si se detecta coincidencia en la misma institución, la respuesta incluye `es_docente = true` y el correo institucional correspondiente.
- **Motivo:** Brinda visibilidad a los directivos sobre los colaboradores de la institución que tienen hijos matriculados en la misma sede.
- **Módulos afectados:** Gestión de Padres de Familia, Docentes.
- **Archivos donde se implementa:** 
  - [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) (`getSchoolParents`, `getParentDetails`)
- **Endpoints relacionados:** `GET /api/parents/school/:schoolId`, `GET /api/parents/:id/details`
- **Historias de usuario relacionadas:** HU-PAD-001, HU-PAD-002

---

### RN-PAD-004: Restricción de Seguridad en Modo Monitoreo
- **Descripción:** Mientras el directivo se encuentra en una sesión de monitoreo en modo espejo bajo la identidad de un acudiente (`monitoringType = 'padre'`), la aplicación deshabilita y oculta la ruta de Soporte Técnico (`/support`).
- **Motivo:** Evita la creación, suplantación o manipulación de tickets institucionales durante una auditoría o asistencia remota.
- **Módulos afectados:** Gestión de Padres de Familia, Soporte y Tickets, Autenticación.
- **Archivos donde se implementa:** 
  - [DashboardLayout.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/layouts/DashboardLayout.vue)
  - [auth.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/stores/auth.ts)
- **Endpoints relacionados:** N/A (Control en frontend)
- **Historias de usuario relacionadas:** HU-PAD-004

---

### RN-PAD-005: Aislamiento Multi-Tenant y Vinculación Estudiante-Acudiente
- **Descripción:** Todas las consultas de la consola de padres están estrictamente filtradas por `id_colegio` a través de la tabla de asociación `detalle_padrefamilia`. Un directivo solo puede visualizar acudientes con estudiantes adscritos a su propia institución.
- **Motivo:** Mantiene el cumplimiento estricto del aislamiento de datos multi-tenant de la plataforma.
- **Módulos afectados:** Gestión de Padres de Familia, Estudiantes y Estados, Estructura Escolar.
- **Archivos donde se implementa:** 
  - [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts)
- **Endpoints relacionados:** `GET /api/parents/school/:schoolId`
- **Historias de usuario relacionadas:** HU-PAD-001, HU-PAD-002

---

### RN-PAD-006: Sincronización Multi-Colegio por Traslados y Preservación de Roles
- **Descripción:** Al trasladar un estudiante a una nueva institución educativa, el acudiente se vincula automáticamente al nuevo colegio (`usuario_colegio` con rol `padre` ACTIVO). El sistema evalúa si el acudiente conserva otros hijos activos en la institución de origen:
  1. Si conserva otros hijos con matrícula activa en origen, su rol de `padre` en la institución de origen **permanece ACTIVO**.
  2. Si no le quedan más hijos activos en origen, su rol de `padre` en origen pasa a **`INACTIVO`**.
  3. Si el acudiente cuenta con roles laborales en la institución de origen (`docente` o `directivo`), **dichos roles permanecen 100% ACTIVOS e intactos**, preservando su acceso funcional y laboral.
- **Motivo:** Evita desvinculaciones indebidas de padres con múltiples hijos o con funciones laborales dentro de la institución educativa.
- **Módulos afectados:** Gestión de Padres de Familia, Gestión de Traslados, Autenticación.
- **Archivos donde se implementa:** 
  - [trasladoService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/trasladoService.ts) (`ejecutarTrasladoTransaccional`)
- **Endpoints relacionados:** `POST /api/traslados/:id/aprobacion`
- **Historias de usuario relacionadas:** HU-PAD-001, HU-PAD-003

---

### RN-PAD-007: Vista Unificada Multi-Colegio del Portal de Acudientes y Reactivación de Rol
- **Descripción:** Cuando un padre de familia tiene hijos matriculados en diferentes instituciones (por ejemplo, hijo 1 en Colegio B e hijo 2 en Colegio A):
  1. Al registrar o formalizar una nueva matrícula en cualquier institución, el sistema reactiva de forma atómica (`upsert`) la vinculación del padre en `usuario_colegio` con `estado = 'ACTIVO'` y `fecha_fin = null`.
  2. El portal de padres consulta y muestra de forma global a todos los hijos vinculados en `detalle_padrefamilia` en una lista unificada, mostrando una insignia con el nombre de su institución educativa respectiva.
  3. Al seleccionar a un hijo en el Dashboard, Calificaciones, Asistencia, Observador, Boletines o Matrícula, las consultas académicas cargan los datos y el esquema de evaluación de la institución a la que pertenece dicho estudiante.
- **Motivo:** Permite a las familias con hijos en diferentes planteles consultar todo su seguimiento académico en una sola cuenta sin necesidad de cambiar manualmente de sesión.
- **Módulos afectados:** Portal del Estudiante y Padres, Gestión de Matrículas, Autenticación.
- **Archivos donde se implementa:** 
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts)
  - [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) (`getParentChildren`, `getParentDashboardData`)
  - [ParentDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentDashboard.vue)
  - [ParentGradesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentGradesView.vue)
  - [ParentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentAttendanceView.vue)
  - [ParentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentObservationsView.vue)
  - [ParentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentBoletinView.vue)
  - [ParentEnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentEnrollmentView.vue)
- **Endpoints relacionados:** `GET /api/student/parent-children/:id_usuario`, `GET /api/student/parent-dashboard/:id_usuario`
- **Historias de usuario relacionadas:** HU-PAD-001, HU-PAD-002


