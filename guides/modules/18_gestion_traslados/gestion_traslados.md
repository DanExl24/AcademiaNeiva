# 🔀 Módulo de Gestión de Traslados de Estudiantes y Usuarios

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Traslados Interinstitucionales, Matrículas Trasladadas y Multi-Vinculación  
**Última actualización:** 2026-08-14

---

## 1. Descripción Funcional

Este módulo gestiona de forma integral el proceso de traslado de estudiantes y usuarios entre instituciones educativas del sistema AcademiaNeiva (`TRASLADO_MATRICULA` y `TRASLADO_USUARIO`), así como los traslados internos de grupo/salón. 

Debido al modelo de **Identidad Global Multi-Institucional**, la cuenta de usuario (`usuario`) permanece única e inalterada, mientras que sus relaciones institucionales se administran dinámicamente en `usuario_colegio`. Para traslados interinstitucionales, el módulo implementa un workflow de **consenso tripartito** que requiere la aprobación explícita de tres actores: la Institución de Origen, la Institución de Destino y el **Padre de Familia / Acudiente legal** (en traslados escolares de matrícula) o el propio usuario adulto (en traslados de personal/docentes). 

### Novedades en el Flujo de Matrículas por Traslado:
1. **Validación de Cupos por Grado en Destino:** Antes de formalizar el traslado, el sistema evalúa la disponibilidad de cupos en el grado escolar del estudiante en la institución de destino. Si el colegio receptor no posee cupos disponibles para dicho grado, el sistema restringe la aprobación del traslado, habilitando la opción de rechazo motivado.
2. **Asignación Directa de Grupo y Jornada:** Al momento de aprobar el traslado, el directivo del colegio destino puede seleccionar la sección/grupo específico (`id_grupo_destino`) respetando la jornada preferida por el acudiente (`jornada_sugerida`).
3. **Notificación Email Formal al Acudiente:** Al culminar la transacción atómica, se notifica automáticamente al padre de familia vía `NotificationService.sendInterInstitutionalTransferApprovedEmail` detallando la sede receptora, el grado y el salón asignado.
4. **Trazabilidad y Gestión de Matrícula en Destino:** En la bandeja de matrículas, la matrícula trasladada se exhibe con su nivel escolar, identificadores de traslado y badges de asignación de aula.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Padre de Familia / Acudiente Legal** | Consultar solicitudes de traslado relativas a sus estudiantes a cargo, indicar jornada sugerida al crear la solicitud y emitir su voto de aprobación/rechazo legal (`USUARIO`). |
| **Usuario / Personal Adulto** | Consultar sus vinculaciones institucionales históricas y activas, autorizar traslados laborales que le afecten. |
| **Directivo (Origen)** | Crear solicitudes de traslado saliente, consultar la bandeja de traslados y certificar la desvinculación académica del estudiante/funcionario (`DIRECTIVO_ORIGEN`). |
| **Directivo (Destino)** | Consultar solicitudes entrantes, verificar la disponibilidad de cupos por grado en su sede, seleccionar el grupo/jornada de destino (`id_grupo_destino`) y autorizar la admisión del estudiante (`DIRECTIVO_DESTINO`). |
| **Administrador General** | Acceso global y auditoría a todas las solicitudes del ecosistema. Posee facultad de **aprobación directa** o intervención administrativa excepcional (`intervenirTraslado`). |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Consultar vinculaciones institucionales del usuario | `GET` | `/api/traslados/mis-vinculaciones` | Autenticado |
| Listar solicitudes de traslado filtradas por colegio y estado | `GET` | `/api/traslados` | Directivo / Admin General / Padre |
| Obtener detalle completo de una solicitud con cronología | `GET` | `/api/traslados/:id` | Directivo / Admin General / Padre / Usuario |
| Consultar disponibilidad de cupos por grado en colegio receptor | `GET` | `/api/traslados/:id/disponibilidad-cupos` | Directivo Destino / Admin General |
| Crear nueva solicitud de traslado interinstitucional (con jornada sugerida) | `POST` | `/api/traslados` | Directivo / Admin General / Padre |
| Registrar decisión (Aprobar con grupo opcional, Rechazar, Cancelar) | `POST` | `/api/traslados/:id/aprobacion` | Directivo / Admin General / Padre / Usuario |
| Intervención administrativa de traslado | `POST` | `/api/traslados/:id/intervencion` | Administrador General |
| Consultar datos académicos para exportación | `GET` | `/api/traslados/datos-academicos/:id` | Directivo / Admin General |
| Traslado interno de grupo con notificación por email | `POST` | `/api/student/change-group` | Directivo |

---

## 4. Reglas de Negocio

- **RN-TRA-001 (Modelo de Identidad Global):** El usuario posee un único registro en la tabla `usuario`. Sus accesos a colegios se regulan mediante la tabla pivot `usuario_colegio` con estados `ACTIVO` e `INACTIVO`.
- **RN-TRA-002 (Consenso Tripartito Obligatorio):** Todo traslado interinstitucional regular requiere 3 aprobaciones (`APROBAR`) para ejecutarse:
  1. `DIRECTIVO_ORIGEN` (Colegio que entrega)
  2. `DIRECTIVO_DESTINO` (Colegio que recibe)
  3. `USUARIO` (Padre de Familia / Acudiente legal registrado para `TRASLADO_MATRICULA`, o el usuario afectado para `TRASLADO_USUARIO`).
- **RN-TRA-003 (Bypass por Administrador General):** Si un `ADMIN_GENERAL` registra una aprobación (`APROBAR`), la solicitud se marca como completada e inmediatamente se ejecuta la transacción de traslado sin requerir los votos restantes.
- **RN-TRA-004 (Auto-Aprobación del Creador):** La persona que crea la solicitud auto-aprueba en el mismo acto la casilla correspondiente a su rol (por ejemplo, `DIRECTIVO_ORIGEN` o el Padre/Acudiente creador).
- **RN-TRA-005 (Restricción de Institución Distinta):** `id_colegio_origen` e `id_colegio_destino` deben ser numéricamente diferentes.
- **RN-TRA-006 (Control de Duplicados en Trámite):** No se permite crear una nueva solicitud si ya existe una activa en estado `SOLICITADA` o `EN_APROBACION` para el mismo usuario entre los mismos colegios.
- **RN-TRA-007 (Atomicidad y Bloqueo Pessimistic `FOR UPDATE`):** La ejecución del traslado se procesa mediante Kysely QueryBuilder en una transacción PostgreSQL con `.forUpdate()` en `solicitud_traslado` para prevenir condiciones de carrera.
- **RN-TRA-008 (Actualización de Matrícula y Estudiante):** En `TRASLADO_MATRICULA`, la matrícula original pasa a `TRASLADADA` y el campo `id_colegio` en la tabla `estudiante` se actualiza al colegio destino.
- **RN-TRA-009 (Motivo Obligatorio en Traslado Interno):** Todo cambio de grupo/sección interno requiere un motivo obligatorio (mínimo 5 caracteres) y desencadena el envío de un correo con plantilla HTML mediante `NotificationService.sendStudentTransferEmail`.
- **RN-TRA-010 (Irreversibilidad de Resoluciones Finales):** Una vez que una solicitud pasa a estado `RECHAZADA`, `CANCELADA` o `EJECUTADA`, se prohíbe cualquier nuevo intento de registrar aprobaciones o cambiar la decisión.
- **RN-TRA-011 (Unicidad e Imposibilidad de Votos Duplicados):** Cada rol o usuario solo puede registrar una única decisión de voto por solicitud. Intentar aprobar repetidamente lanzará una excepción `400 Bad Request`.
- **RN-TRA-012 (Validación Obligatoria de Cupos por Grado en Destino):** Al tramitar `TRASLADO_MATRICULA`, el sistema valida que existan cupos disponibles en las secciones activas del grado correspondiente en el colegio receptor. Si el grado no posee cupos, el directivo receptor no podrá aprobar la solicitud y deberá rechazarla con su respectiva justificación.
- **RN-TRA-013 (Asignación Directa de Grupo y Jornada en Aprobación):** El directivo de destino puede seleccionar el grupo específico (`id_grupo_destino`) en el modal de aprobación. La matrícula creada/actualizada en destino vinculará de forma atómica el `id_grupo` e `id_nivel` correspondientes.
- **RN-TRA-014 (Notificación Email Formal con Asignación de Aula):** Al ejecutarse el traslado interinstitucional, se envía un correo al acudiente informando la admisión en la institución receptora, el grado escolar y el salón/jornada asignado.
- **RN-TRA-015 (Aislamiento y Bloqueo Operativo en Colegio Origen):** Tras ejecutarse el traslado interinstitucional, la matrícula original pasa a `TRASLADADA` y queda exclusivamente como histórico. El estudiante se desvincula de las listas operativas activas del colegio de origen (notas, asistencia, observador, boletines y promoción anual) y cualquier intento de registro de calificaciones o asistencias en origen es rechazado con error `409 Conflict`. En el colegio destino, el estudiante se activa de inmediato con matrícula en estado `ACTIVA` (`tipo = 'TRASLADO'`, `es_traslado = true`).

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller Traslados** | [trasladoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/trasladoController.ts) — `createTraslado`, `approveTraslado`, `getTraslados`, `getTrasladoById`, `getDisponibilidadCupos`, `getMyVinculaciones` |
| **Service Traslados** | [trasladoService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/trasladoService.ts) — Transacciones PostgreSQL con Kysely, verificación de cupos por grado (`getDisponibilidadCuposTraslado`), asignación de grupo y consenso tripartito |
| **DTOs & Validaciones** | [traslado.dto.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/dtos/traslado.dto.ts) — Zod Schemas (`CreateTrasladoSchema` con `jornada_sugerida`, `ApproveTrasladoSchema` con `id_grupo_destino`) |
| **Rutas API** | [traslado.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/traslado.routes.ts) — Endpoint `GET /:id/disponibilidad-cupos` |
| **Notificaciones Email** | [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) — `sendInterInstitutionalTransferApprovedEmail` y `sendStudentTransferEmail` |
| **Controlador Estudiantes** | [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) — `changeStudentGroup` |

### Frontend

| Tipo | Archivo |
|---|---|
| **Gestión de Traslados** | [TrasladoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/TrasladoManagement.vue) — Vista principal de traslados con indicador en vivo de cupos por grado, selector de sección/jornada en aprobación y selector de jornada sugerida al crear |
| **Gestión de Matrículas** | [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue) — Badges de traslado interactivos con popover flotante y advertencia `⚠️ PENDIENTE ASIGNAR SALÓN` |
| **Gestión Estudiantes** | [StudentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/StudentManagement.vue) — Modal con selector de grupo y motivo de traslado interno |
| **Datos Académicos del Traslado** | [DatosAcademicosTrasladoModal.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/components/traslados/DatosAcademicosTrasladoModal.vue) — Visualización y exportación de calificaciones previas del estudiante |

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
| `motivo` | TEXT | Justificación del traslado e indicación de jornada de preferencia. |
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

