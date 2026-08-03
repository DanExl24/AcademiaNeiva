# 👨‍👩‍👧‍👦 Módulo de Gestión de Padres de Familia

**Sistema:** Academia Neiva
**Módulo:** Gestión de Padres de Familia (Acudientes)
**Última actualización:** 2026-08-03

---

## 1. Descripción Funcional

Este módulo permite a los directivos del colegio gestionar y realizar el seguimiento integral de los padres de familia y acudientes registrados en la institución. Facilita la consulta centralizada de acudientes con tarjetas métricas de control (total de padres, acudientes con alertas académicas/disciplinarias en sus hijos, y acudientes que simultáneamente ejercen como docentes), la aplicación de filtros avanzados (por nivel, grado, jornada, alertas del alumno, docentes-padres y estado de cuenta estandarizado a `Activo`/`Inactivo`), la visualización en detalle de la ficha del acudiente junto a sus estudiantes a cargo (promedios, asistencias, observaciones), la actualización de datos de contacto, la activación/inactivación atómica de la cuenta de usuario con revocación de sesión, y la capacidad de realizar seguimiento de su portal mediante el **Modo Monitoreo / Espejo**.

---

## 2. Actores y Permisos

| Rol                       | Alcance                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Directivo**             | Consulta, búsqueda avanzada, edición de datos de contacto, activación/inactivación de cuenta de acudientes e inicio de monitoreo en modo espejo. |
| **Padre de Familia**      | Consulta de las notas, asistencias, observador y boletines de sus hijos asociados en el portal de padres.                                        |
| **Docente**               | Consulta indirecta a través de la ficha del estudiante o su propio perfil en caso de poseer doble rol (`Padre + Docente`).                       |
| **Administrador General** | Acceso en modo supervisión sobre el colegio.                                                                                                     |

---

## 3. Acciones Disponibles

| Acción                                           | Método  | Endpoint                                       | Rol Requerido |
| ------------------------------------------------ | ------- | ---------------------------------------------- | ------------- |
| Obtener listado de padres con métricas y alertas | `GET`   | `/api/parents/school/:schoolId`                | Directivo     |
| Obtener ficha detallada del padre e hijos        | `GET`   | `/api/parents/:id/details`                     | Directivo     |
| Actualizar datos de contacto del padre           | `PUT`   | `/api/parents/:id`                             | Directivo     |
| Activar o Inactivar cuenta del padre de familia  | `PATCH` | `/api/parents/:id/status`                      | Directivo     |
| Iniciar seguimiento en Modo Monitoreo            | `POST`  | (Frontend Store Auth -`startParentMonitoring`) | Directivo     |

---

## 4. Reglas de Negocio

- **RN-PAD-001 (Estandarización de Estado de Cuenta):** El estado de la cuenta del padre se consolida a dos valores únicos en interfaz (`Activo` o `Inactivo`), evaluando conjuntamente `usuario.activo`, `padre_familia.estado` y la inhabilitación por timestamp en `usuario.logged_out_at`.
- **RN-PAD-002 (Inactivación Atómica de Sesión):** Al inactivar la cuenta de un padre (`activo = false`), el backend actualiza de forma atómica la tabla `padre_familia`, invalida la cuenta en `usuario` e inserta el timestamp actual en `usuario.logged_out_at`, revocando de inmediato cualquier token JWT activo.
- **RN-PAD-003 (Detección y Notificación de Doble Rol):** El backend identifica mediante coincidencia de documento o correo si el acudiente también se encuentra registrado como docente de la institución (`es_docente = true`), desplegando el distintivo visual `👨‍🏫 También es Docente` y exponiendo su correo institucional secundario (`email_docente`).
- **RN-PAD-004 (Restricción de Seguridad en Modo Monitoreo):** Durante una sesión de monitoreo en modo espejo realizada por un directivo, el sistema bloquea y oculta completamente el módulo de Soporte Técnico (`/support`) para prevenir la creación o manipulación no autorizada de tickets a nombre del acudiente.
- **RN-PAD-005 (Filtro Especial de Alertas del Estudiante):** El listado de acudientes calcula mediante subconsultas optimizadas (CTEs) si los hijos del padre presentan alguna alerta activa en el periodo lectivo en curso (asistencia < 80%, promedio académico < 3.0 o faltas disciplinarias registradas), permitiendo al directivo priorizar la atención de familias vulnerables.
- **RN-PAD-006 (Sincronización con el Año Lectivo Activo):** El módulo responde dinámicamente al selector global de Año Lectivo (`useAcademicYearStore`). Al cambiar el año seleccionado en la barra superior, la consola recalcula en tiempo real la lista de acudientes, así como los grados, matrículas y métricas académicas de los hijos asociados a ese año lectivo específico.

---

## 5. Implementación

### Backend

| Tipo                           | Archivo                                                                                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controlador**                | [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) — `getSchoolParents`, `getParentDetails`, `updateParentInfo`, `updateParentAccountStatus` |
| **Rutas**                      | [parent.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/parent.routes.ts)                                                                                                                          |
| **Servicios de Autenticación** | [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) — Validación de `logged_out_at` y tokens JWT                                                                       |

### Frontend

| Tipo                                    | Archivo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Consola Directiva**                   | [ParentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ParentManagement.vue) — Vista principal con métricas, tarjetas, filtros, drawer de detalles y modal de edición.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Estado de Autenticación y Monitoreo** | [auth.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/stores/auth.ts) — `startParentMonitoring`, `stopMonitoring`, soporte de `monitoringType = 'padre'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Layout del Sistema**                  | [DashboardLayout.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/layouts/DashboardLayout.vue) — Barra superior de monitoreo, navegación restringida y cierre de sesión de monitoreo.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Vistas del Portal del Padre**         | [ParentDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentDashboard.vue), [ParentGradesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentGradesView.vue), [ParentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentAttendanceView.vue), [ParentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentObservationsView.vue), [ParentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentBoletinView.vue). |

---

## 6. Modelo de Datos

### Tabla: `padre_familia`

| Columna            | Tipo         | Descripción                                    |
| ------------------ | ------------ | ---------------------------------------------- |
| `id_padrefamilia`  | SERIAL PK    | Identificador único del padre de familia.      |
| `nombre`           | VARCHAR(100) | Nombres del acudiente.                         |
| `apellido`         | VARCHAR(100) | Apellidos del acudiente.                       |
| `documento`        | VARCHAR(20)  | Documento de identidad del acudiente.          |
| `id_tipodocumento` | INT FK       | Referencia al tipo de documento.               |
| `telefono`         | VARCHAR(20)  | Número telefónico de contacto.                 |
| `direccion`        | VARCHAR(255) | Dirección de residencia.                       |
| `id_usuario`       | INT FK       | Referencia a la cuenta de usuario del sistema. |
| `estado`           | VARCHAR(20)  | Estado administrativo (`ACTIVO`, `INACTIVO`).  |

### Tabla: `detalle_padrefamilia` (Relación Acudiente-Estudiante)

| Columna                  | Tipo      | Descripción                              |
| ------------------------ | --------- | ---------------------------------------- |
| `id_detallepadrefamilia` | SERIAL PK | Identificador de la relación parentesco. |
| `id_padrefamilia`        | INT FK    | Referencia al padre de familia.          |
| `id_estudiante`          | INT FK    | Referencia al estudiante representado.   |
| `id_colegio`             | INT FK    | Colegio en el que aplica la relación.    |

---

## 7. Conexiones con Otros Módulos

- **→ Autenticación**: Controla la sesión y activación de usuarios en `usuario`, revocando tokens cuando la cuenta pasa a inactiva mediante `logged_out_at`.
- **→ Estudiantes y Estados**: Relaciona a los estudiantes matriculados a través de `detalle_padrefamilia` para presentar alertas de asistencia, notas y observaciones acumuladas.
- **→ Docentes**: Realiza la verificación cruzada de documento/email para detectar personal institucional con hijos matriculados (Doble Rol).
- **→ Soporte y Tickets**: Aplica la regla de bloqueo de seguridad durante el seguimiento en modo espejo para impedir la suplantación en el canal de tickets.

---

## 8. Validaciones Implementadas

### Backend

- Filtrado estricto por `id_colegio` garantizando aislamiento multi-tenant absoluto.
- Búsqueda insensible a mayúsculas/minúsculas y acentos (`ILIKE` / `UNACCENT`) en consultas de texto.
- Transacciones SQL atómicas para actualizar simultáneamente `usuario`, `padre_familia` y `logged_out_at`.

### Frontend

- Desactivación inteligente del botón de envío durante peticiones en curso para evitar solicitudes duplicadas.
- Modal de confirmación explícito antes de alternar el estado de activación de la cuenta del acudiente.
- Notificaciones tostadas e informativas de éxito y error.

---

## 9. Decisiones de Diseño

| Decisión                                               | Justificación                                                                                                                                 |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estandarización de 2 Estados (`Activo`/`Inactivo`)** | Simplifica el control directivo eliminando ambigüedades sobre estados intermedios.                                                            |
| **Drawer Lateral de Detalles**                         | Permite inspeccionar los datos del acudiente e hijos asociados sin perder el contexto ni la posición de la tabla principal.                   |
| **Reutilización de vistas en Modo Monitoreo**          | El directivo experimenta exactamente la misma interfaz que ve el acudiente al iniciar el seguimiento, garantizando precisión en la auditoría. |
