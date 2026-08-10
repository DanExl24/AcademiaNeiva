# 🔀 Módulo de Gestión de Traslados de Estudiantes y Usuarios

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Traslados Interinstitucionales, Matrículas Trasladadas y Multi-Vinculación  
**Última actualización:** 2026-08-10

---

## 1. Descripción Funcional

Este módulo gestiona de forma integral el proceso de traslado de estudiantes y usuarios entre instituciones educativas del sistema AcademiaNeiva (`TRASLADO_MATRICULA` y `TRASLADO_USUARIO`), así como los traslados internos de grupo/salón. 

Debido al modelo de **Identidad Global Multi-Institucional**, la cuenta de usuario (`usuario`) permanece única e inalterada, mientras que sus relaciones institucionales se administran dinámicamente en `usuario_colegio`. Para traslados interinstitucionales, el módulo implementa un workflow de **consenso tripartito** que requiere la aprobación explícita de tres actores: la Institución de Origen, la Institución de Destino y el propio Usuario/Acudiente. Una vez alcanzado el consenso (o mediante la aprobación directa del Administrador General), una transacción atómica en PostgreSQL desactiva la vinculación en el colegio origen, activa la vinculación en el colegio destino, actualiza el estado de la matrícula a `TRASLADADA` y notifica vía correo electrónico.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Usuario / Acudiente / Estudiante** | Consultar sus vinculaciones institucionales históricas y activas, emitir su voto de aprobación/rechazo en solicitudes de traslado que le afecten. |
| **Directivo (Origen / Destino)** | Crear solicitudes de traslado de alumnos o personal de su institución, consultar la bandeja de traslados entrantes/salientes de su sede, y registrar aprobación o rechazo institucional. |
| **Administrador General** | Acceso global a todas las solicitudes de traslado del ecosistema. Posee facultad de **aprobación directa**, la cual ejecuta la transacción inmediatamente omitiendo los votos pendientes. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Consultar vinculaciones institucionales del usuario | `GET` | `/api/traslados/mis-vinculaciones` | Autenticado |
| Listar solicitudes de traslado filtradas por colegio y estado | `GET` | `/api/traslados` | Directivo / Admin General |
| Obtener detalle completo de una solicitud con cronología | `GET` | `/api/traslados/:id` | Directivo / Admin General / Usuario |
| Crear nueva solicitud de traslado interinstitucional | `POST` | `/api/traslados` | Directivo / Admin General / Usuario |
| Registrar decisión (Aprobar, Rechazar, Cancelar) | `POST` | `/api/traslados/:id/aprobacion` | Directivo / Admin General / Usuario |
| Cambiar estado de traslado en matrícula | `PATCH` | `/api/matriculas/transfer-status/:id` | Directivo |
| Traslado interno de grupo con notificación por email | `POST` | `/api/student/change-group` | Directivo |

---

## 4. Reglas de Negocio

- **RN-TRA-001 (Modelo de Identidad Global):** El usuario posee un único registro en la tabla `usuario`. Sus accesos a colegios se regulan mediante la tabla pivot `usuario_colegio` con estados `ACTIVO` e `INACTIVO`.
- **RN-TRA-002 (Consenso Tripartito Obligatorio):** Todo traslado interinstitucional regular requiere 3 aprobaciones (`APROBAR`) para ejecutarse:
  1. `DIRECTIVO_ORIGEN` (Colegio que entrega)
  2. `DIRECTIVO_DESTINO` (Colegio que recibe)
  3. `USUARIO` (Estudiante / Acudiente afectado)
- **RN-TRA-003 (Bypass por Administrador General):** Si un `ADMIN_GENERAL` registra una aprobación (`APROBAR`), la solicitud se marca como completada e inmediatamente se ejecuta la transacción de traslado sin requerir los votos restantes.
- **RN-TRA-004 (Auto-Aprobación del Creador):** La persona que crea la solicitud auto-aprueba en el mismo acto la casilla correspondiente a su rol.
- **RN-TRA-005 (Restricción de Institución Distinta):** `id_colegio_origen` e `id_colegio_destino` deben ser numéricamente diferentes.
- **RN-TRA-006 (Control de Duplicados en Trámite):** No se permite crear una nueva solicitud si ya existe una activa en estado `SOLICITADA` o `EN_APROBACION` para el mismo usuario entre los mismos colegios.
- **RN-TRA-007 (Atomicidad y Bloqueo Pessimistic `FOR UPDATE`):** La ejecución del traslado se procesa en un bloque `BEGIN ... COMMIT` PostgreSQL con `SELECT FOR UPDATE` en `solicitud_traslado` para prevenir condiciones de carrera.
- **RN-TRA-008 (Actualización de Matrícula y Estudiante):** En `TRASLADO_MATRICULA`, la matrícula original pasa a `TRASLADADA` y el campo `id_colegio` en la tabla `estudiante` se actualiza al colegio destino.
- **RN-TRA-009 (Motivo Obligatorio en Traslado Interno):** Todo cambio de grupo/sección interno requiere un motivo obligatorio (mínimo 5 caracteres) y desencadena el envío de un correo con plantilla HTML mediante `NotificationService.sendStudentTransferEmail`.
- **RN-TRA-010 (Irreversibilidad de Resoluciones Finales):** Una vez que una solicitud pasa a estado `RECHAZADA`, `CANCELADA` o `EJECUTADA`, se prohíbe cualquier nuevo intento de registrar aprobaciones o cambiar la decisión.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller Traslados** | [trasladoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/trasladoController.ts) — `createTraslado`, `approveTraslado`, `getTraslados`, `getTrasladoById`, `getMyVinculaciones` |
| **Service Traslados** | [trasladoService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/trasladoService.ts) — Transacciones PostgreSQL de traslado, consenso tripartito, actualización de `usuario_colegio` y `matricula` |
| **DTOs & Validaciones** | [traslado.dto.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/dtos/traslado.dto.ts) — Zod Schemas (`CreateTrasladoSchema`, `ApproveTrasladoSchema`, `FilterTrasladoSchema`) |
| **Rutas API** | [traslado.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/traslado.routes.ts) |
| **Notificaciones Email** | [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) — `sendStudentTransferEmail` |
| **Controlador Estudiantes** | [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) — `changeStudentGroup` |

### Frontend

| Tipo | Archivo |
|---|---|
| **Gestión Estudiantes (Traslado de Grupo)** | [StudentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/StudentManagement.vue) — Modal con selector de grupo y campo de motivo obligatorio |
| **Gestión Matrículas (Filtro Traslados)** | [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue) — Badges e insignias de estado `TRASLADADA` |
| **Detalle de Matrícula** | [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue) — Visualización de historial de traslado |
| **Seguimiento de Matrícula** | [MatriculaTrackingView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/MatriculaTrackingView.vue) — Paso a paso de seguimiento público |

---

## 6. Modelo de Datos

### Tabla: `solicitud_traslado`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_solicitud` | SERIAL PK | Identificador único de la solicitud. |
| `tipo` | TipoTraslado | `TRASLADO_USUARIO` o `TRASLADO_MATRICULA`. |
| `id_usuario` | INT FK | Usuario a trasladar. |
| `id_colegio_origen` | INT FK | Colegio de origen. |
| `id_colegio_destino` | INT FK | Colegio de destino. |
| `id_matricula` | INT FK (NULLable) | Matrícula asociada en caso de `TRASLADO_MATRICULA`. |
| `estado` | EstadoSolicitudTraslado | `SOLICITADA`, `EN_APROBACION`, `APROBADA`, `RECHAZADA`, `CANCELADA`, `EJECUTADA`. |
| `motivo` | TEXT | Justificación del traslado. |
| `creado_por` | INT FK | Usuario que originó el registro. |
| `fecha_creacion` | TIMESTAMP | Fecha y hora de creación. |
| `fecha_finalizacion` | TIMESTAMP (NULLable) | Fecha y hora de cierre o ejecución. |

### Tabla: `traslado_aprobacion`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_aprobacion` | SERIAL PK | Identificador único del voto. |
| `id_solicitud` | INT FK | Solicitud asociada. |
| `id_usuario` | INT FK | Usuario que emite la decisión. |
| `rol` | VARCHAR | `DIRECTIVO_ORIGEN`, `DIRECTIVO_DESTINO`, `USUARIO`, `ADMIN_GENERAL`, `CREADOR`. |
| `accion` | AccionAprobacionTraslado | `APROBAR`, `RECHAZAR`, `CANCELAR`. |
| `comentario` | TEXT (NULLable) | Observación del aprobador. |
| `fecha` | TIMESTAMP | Fecha del registro. |

### Tabla: `usuario_colegio`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_usuario_colegio` | SERIAL PK | Identificador del vínculo. |
| `id_usuario` | INT FK | Usuario relacionado. |
| `id_colegio` | INT FK | Institución educativa. |
| `id_rol` | INT FK | Rol desempeñado en el colegio. |
| `estado` | VARCHAR | `ACTIVO` o `INACTIVO`. |
| `fecha_inicio` | TIMESTAMP | Inicio de vinculación. |
| `fecha_fin` | TIMESTAMP (NULLable) | Fin de vinculación tras un traslado. |
