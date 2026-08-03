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
