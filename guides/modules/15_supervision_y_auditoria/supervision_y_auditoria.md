# 🕵️ Módulo de Supervisión y Auditoría del Administrador General

**Sistema:** Academia Neiva  
**Módulo:** Modo Supervisión, Control de Acceso y Logs de Auditoría Inmutables  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo regula el acceso extraordinario y el control de auditoría cuando la superadministración de la plataforma (Administrador General) requiere inspeccionar o corregir datos dentro de un colegio en particular. El Administrador General debe solicitar formalmente una sesión de supervisión, la cual requiere la aprobación explícita y re-autenticación de un directivo del colegio. Durante la sesión, toda consulta, modificación o exportación de datos realizada bajo la identidad heredada del Rector es auditada de forma inalterable y automática.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Admin General** | Solicitar supervisiones, ingresar a la sesión activa (heredando rol de Rector), realizar consultas o modificaciones (según tipo de sesión), consultar su historial de supervisiones y exportar reportes de auditoría. |
| **Directivo (Rector / Coordinador)** | Recibir solicitudes, aprobar sesiones mediante ingreso obligatorio de su contraseña personal (re-autenticación), revocar sesiones activas y consultar el registro de acciones realizadas en su colegio. |

---

## 3. Acciones Disponibles

### Acciones del Administrador General

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Solicitar sesión de supervisión a un colegio | `POST` | `/api/admin/supervision/solicitar` | Admin General |
| Verificar si tiene una supervisión activa | `GET` | `/api/admin/supervision/verificar-activa` | Admin General |
| Entrar oficialmente a la sesión aprobada | `POST` | `/api/admin/supervision/:id/entrar` | Admin General |
| Salir voluntariamente de la supervisión activa | `POST` | `/api/admin/supervision/:id/salir` | Admin General |
| Ver listado de acciones auditadas en la sesión | `GET` | `/api/admin/supervision/:id/acciones` | Admin General |
| Historial completo de supervisiones solicitadas | `GET` | `/api/admin/supervision/historial` | Admin General |
| Exportar historial de acciones a PDF/CSV | `POST` | `/api/admin/supervision/:id/exportar` | Admin General |
| Consultar registros de auditoría globales | `GET` | `/api/admin/auditorias` | Admin General |
| Consultar notificaciones de supervisión globales | `GET` | `/api/admin/notificaciones` | Admin General |

### Acciones del Directivo del Colegio

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Aprobar solicitud de supervisión (con re-auth) | `POST` | `/api/admin/supervision/:id/aprobar` | Directivo |
| Revocar y expulsar de sesión de supervisión activa | `POST` | `/api/admin/supervision/:id/revocar` | Directivo |
| Listar supervisiones solicitadas a su colegio | `GET` | `/api/admin/colegio/:colegioId/supervisiones` | Directivo |
| Consultar acciones realizadas por el admin en su colegio | `GET` | `/api/admin/supervision/:id/acciones-directivo` | Directivo |

---

## 4. Reglas de Negocio

- **RN-SUP-001 (Flujo de Aprobación Obligatoria):** El Administrador General no puede acceder a los datos privados de un colegio de manera directa. Debe enviar una solicitud registrando el motivo pedagógico o técnico. Un directivo de la institución debe revisar la solicitud e ingresar su contraseña personal para confirmar la identidad antes de autorizar la sesión.
- **RN-SUP-002 (Control de Roles y Restricciones en Sesión):**
  - **`SOLO_LECTURA`**: El middleware de Express (`verifyToken`) bloquea toda petición modificadora (`POST`, `PUT`, `PATCH`, `DELETE`), respondiendo con error `403 Forbidden` al Administrador General si intenta alterar datos. Solo se le permite navegar y generar reportes.
  - **`EDITOR`**: Habilita la edición de datos curriculares o corrección de información. Toda petición de escritura exige ingresar obligatoriamente un **motivo del cambio** en el cuerpo de la solicitud (`motivo_cambio`).
- **RN-SUP-003 (Expiración Automática de Sesión):** Cada aprobación especifica una duración máxima de la sesión en minutos. El servicio planificador (`schedulerService.ts`) y el middleware verifican la hora de entrada. Al expirar el tiempo:
  - Se cierra la sesión de forma inmediata.
  - Se revocan los privilegios y el `schoolId` asociado en el token JWT.
  - Se envía un correo electrónico al directivo aprobador detallando el tiempo total transcurrido y la sumatoria de acciones realizadas.
- **RN-SUP-004 (Inmutabilidad de Logs de Auditoría):** Las acciones realizadas por el Administrador General durante la supervisión se guardan de forma instantánea en `auditoria_acciones_realizadas`. Los triggers SQL `proteger_acciones_auditoria` y `proteger_auditoria_finalizada` abortan cualquier consulta `DELETE` o `UPDATE` sobre estas tablas, blindando el registro para inspecciones del Ministerio de Educación.
- **RN-SUP-005 (Campos Obligatorios de Auditoría en Modificación):** Al realizar cambios en modo `EDITOR`, el sistema exige y almacena:
  - `valor_antiguo` (el JSON exacto del registro antes del cambio).
  - `valor_nuevo` (el JSON con los nuevos datos).
  - `motivo_cambio` (texto descriptivo del Administrador General).

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller de Supervisión** | [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — Flujo de solicitud, aprobación, re-autenticación de directivos, entrada y salida de sesión, y consulta de historiales. |
| **Routes** | [adminGeneral.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/adminGeneral.routes.ts) |
| **Middleware de Auditoría** | [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) — Intercepta las consultas GET y exportaciones para registrarlas asíncronamente. En peticiones de modificación, captura los datos antes y después para agregarlos en la tabla de auditoría. |
| **Servicio de Expiración** | [schedulerService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/schedulerService.ts) — Monitoreo automático en segundo plano de sesiones expiradas para forzar el cierre y notificar. |
| **Servicio de Notificación** | [adminGeneralNotificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/adminGeneralNotificationService.ts) — Plantillas de correo para avisar la entrada, salida y expiración de sesiones. |
| **Triggers SQL** | [tablasAuditoria.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/Auditorias/tablasAuditoria.sql), [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Triggers `proteger_acciones_auditoria` y `proteger_auditoria_finalizada`. |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vistas del Admin General** | [SupervisionSolicitudes.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/SupervisionSolicitudes.vue), [SupervisionActivas.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/SupervisionActivas.vue), [SupervisionHistorial.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/SupervisionHistorial.vue), [AuditoriasList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/AuditoriasList.vue), [NotificacionesList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/NotificacionesList.vue). |
| **Vistas del Directivo** | [SupervisionManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SupervisionManagement.vue) — Consola del rector para aprobar solicitudes ingresando su contraseña personal. |

---

## 6. Modelo de Datos

### Tabla: `auditoria_supervision`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_auditoria` | SERIAL PK | Identificador único de la sesión de supervisión. |
| `id_admin_general` | INT FK | Administrador General solicitante. |
| `id_colegio` | INT FK | Colegio supervisado. |
| `id_directivo_aprobador` | INT FK | Directivo que autorizó el acceso. |
| `motivo_solicitud` | TEXT | Razón de la supervisión declarada en la solicitud. |
| `tipo_supervision` | `tipo_supervision` | Nivel de permisos (`SOLO_LECTURA`, `EDITOR`). |
| `estado_supervision` | `estado_supervision` | `SOLICITADA`, `APROBADA`, `ACTIVA`, `FINALIZADA`, `REVOCADA`, `EXPIRADA`. |
| `fecha_solicitud` | TIMESTAMPTZ | Fecha de creación de la solicitud. |
| `fecha_entrada` | TIMESTAMPTZ | Hora exacta de entrada del administrador general. |
| `fecha_salida` | TIMESTAMPTZ | Hora de salida o expiración de la sesión. |
| `duracion_maxima_minutos` | INT | Tiempo límite de la sesión configurado por el directivo. |

### Tabla: `auditoria_acciones_realizadas`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_accion` | SERIAL PK | Identificador único de la acción auditada. |
| `id_auditoria` | INT FK | Sesión de supervisión asociada. |
| `fecha_accion` | TIMESTAMPTZ | Fecha y hora en la que ocurrió el evento. |
| `modulo` | VARCHAR(255) | Módulo afectado (`BOLETINES`, `ESTUDIANTES`, `MATRICULAS`, etc.). |
| `tipo_accion` | `tipo_accion_auditoria` | `LECTURA`, `CREACION`, `MODIFICACION`, `ELIMINACION`, `EXPORTACION`. |
| `accion` | VARCHAR(255) | Descripción textual de la acción (ej. Generación de boletín). |
| `recurso_afectado` | TEXT | Ruta URL o registro físico consultado/modificado. |
| `valor_antiguo` | JSONB | Estado del registro antes de la edición (solo en MODIFICACION). |
| `valor_nuevo` | JSONB | Estado del registro posterior a la edición (solo en MODIFICACION). |
| `motivo_cambio` | TEXT | Justificación del cambio provista por el administrador general. |

---

## 7. Conexiones con Otros Módulos

- **→ Autenticación**: El middleware intercepta el ciclo de vida del token JWT para inyectar temporalmente el `schoolId` aprobado y auditar en segundo plano.
- **→ Notificaciones**: Envía correos electrónicos de control a los directivos y alertas de WebSocket del sistema al ingresar y salir del panel del colegio.
- **→ Todos los Módulos del Sistema**: Durante la sesión, las acciones realizadas sobre cualquier otra entidad (notas, matrículas, competencias) son capturadas e inyectadas en la bitácora de auditoría.

---

## 8. Validaciones Implementadas

### Backend
- Validación estricta que inhabilita endpoints de escritura (POST, PUT, DELETE) si el modo aprobado de la sesión es `SOLO_LECTURA`.
- Control de expiración redundante: el planificador finaliza la sesión en segundo plano y el middleware bloquea peticiones si la sesión superó el límite, impidiendo accesos por demoras de la UI.
- Trigger SQL que intercepta operaciones destructivas en las tablas de auditoría y lanza excepciones de base de datos.

### Frontend
- Modal de aprobación con validación interactiva contra la contraseña del directivo para autorizar la sesión.
- Banner de color rojo en el encabezado del Administrador General indicando el tiempo restante y un botón para salir voluntariamente de la sesión de supervisión.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Auditoría Pasiva en Middleware** | Al realizarse en el middleware `verifyToken` de Express, se evita ensuciar el código de los controladores individuales con lógica de inserción de logs, garantizando que el 100% de los endpoints queden auditados de forma transparente. |
| **Uso de Campos JSONB en Base de Datos** | Permite almacenar estructuras de datos variables (cualquier tabla del sistema) en un formato eficiente de consulta indexada en PostgreSQL sin crear tablas de auditoría separadas para cada entidad. |
| **Inmutabilidad por Triggers SQL** | Previene que el administrador general, incluso en modo `EDITOR` o mediante vulnerabilidades de inyección, pueda borrar los registros de auditoría que demuestren sus acciones en el sistema. |
