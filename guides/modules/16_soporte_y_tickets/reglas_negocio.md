# Reglas de Negocio — Soporte y Tickets

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Soporte y Gestión de Tickets de AcademiaNeiva.

---

## Flujo y Estados de Tickets

### RN-SOP-001: Estado Inicial del Ticket
- **Descripción:** Todo ticket nuevo de soporte se creará obligatoriamente con el estado `'ABIERTO'` y con la columna `fecha_escalado = NULL`.
- **Motivo:** Asegura un punto de partida consistente para el control de incidencias, donde el valor de `fecha_escalado` sirve como indicador booleano implícito.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`createTicket`)
- **Endpoints relacionados:** 
  - `POST /api/support/tickets`
- **Historias de usuario relacionadas:** HU-SOP-001

---

### RN-SOP-002: Restricción del Estado ABIERTO
- **Descripción:** Un ticket únicamente puede estar en estado `'ABIERTO'` si no cuenta con observaciones registradas en su columna JSONB y no ha sido escalado (`fecha_escalado IS NULL`).
- **Motivo:** Evita inconsistencias visuales en el flujo de gestión; un ticket atendido no debe figurar como recién abierto.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`updateTicketStatus`)
- **Endpoints relacionados:** 
  - `PUT /api/support/tickets/:id/status`
- **Historias de usuario relacionadas:** HU-SOP-005

---

### RN-SOP-003: Transición Automática a EN_PROCESO
- **Descripción:** Al agregar la primera observación (por parte del colegio, administrador o remitente) o al escalar un ticket en estado `'ABIERTO'`, el sistema actualizará automáticamente el estado a `'EN_PROCESO'`.
- **Motivo:** Garantiza que las incidencias en curso cambien de estado sin necesidad de que el personal directivo realice el cambio de forma manual.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`addTicketObservation`, `escalateTicket`)
- **Endpoints relacionados:** 
  - `POST /api/support/tickets/:id/observaciones`
  - `POST /api/support/tickets/:id/escalar`
- **Historias de usuario relacionadas:** HU-SOP-003, HU-SOP-005, HU-SOP-006

---

## Escalamiento

### RN-SOP-004: Inmutabilidad de la Marca de Escalamiento
- **Descripción:** Una vez que un ticket ha sido escalado (`fecha_escalado` tiene un timestamp asignado), este valor nunca podrá ser restablecido a `NULL` o modificado.
- **Motivo:** Conserva el hecho histórico de que la incidencia requirió la intervención de la superadministración de la plataforma para auditorías y métricas.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`escalateTicket`)
- **Endpoints relacionados:** 
  - `POST /api/support/tickets/:id/escalar`
- **Historias de usuario relacionadas:** HU-SOP-006

---

### RN-SOP-005: Bloqueo de Control Directivo en Escalados
- **Descripción:** Cuando un ticket posee `fecha_escalado IS NOT NULL`, el `DIRECTIVO` escolar del colegio pierde los permisos de edición del estado en la base de datos y el selector visual se deshabilita.
- **Motivo:** Evita que el colegio interfiera o altere la resolución de un caso que ya ha sido derivado al Administrador General.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (Validación en `updateTicketStatus` y `addTicketObservation`)
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) (Inhabilitación de inputs)
- **Endpoints relacionados:** 
  - `PUT /api/support/tickets/:id/status`
  - `POST /api/support/tickets/:id/observaciones`
- **Historias de usuario relacionadas:** HU-SOP-004, HU-SOP-006

---

### RN-SOP-006: Exclusividad del Administrador General en Escalados
- **Descripción:** Solo los usuarios con rol `admin_general` están autorizados para responder y cambiar a `'RESUELTO'` los tickets cuya `fecha_escalado` no sea nula.
- **Motivo:** Mantiene delimitada la frontera de responsabilidades entre el soporte local del colegio y el soporte global de plataforma.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (Validación en `updateTicketStatus`)
- **Endpoints relacionados:** 
  - `PUT /api/support/tickets/:id/status`
- **Historias de usuario relacionadas:** HU-SOP-004, HU-SOP-006

---

## Resolución e Integridad

### RN-SOP-007: Inmutabilidad de Tickets Resueltos
- **Descripción:** Un ticket en estado `'RESUELTO'` pasa a ser de solo lectura de manera permanente. No se permite agregar nuevas notas ni cambiar su estado a menos que existan excepciones controladas.
- **Motivo:** Garantiza que los casos finalizados no sean manipulados o reabiertos de forma indebida, sirviendo de registro histórico estático.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (Validación en `updateTicketStatus` y `addTicketObservation`)
- **Endpoints relacionados:** 
  - `PUT /api/support/tickets/:id/status`
  - `POST /api/support/tickets/:id/observaciones`
- **Historias de usuario relacionadas:** HU-SOP-005

---

### RN-SOP-008: Regla de Turnos de Mensajería (Ping-Pong)
- **Descripción:** El remitente público o autenticado solo podrá enviar un nuevo mensaje en el hilo si la última observación registrada proviene de un `DIRECTIVO` o del `ADMIN_GENERAL`.
- **Motivo:** Evita el spam de mensajes repetitivos del usuario antes de que soporte haya analizado o dado respuesta a su solicitud anterior.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`addVisitorObservation`)
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) (Inhabilitación del botón de envío)
- **Endpoints relacionados:** 
  - `POST /api/support/tickets/track/:code/observaciones`
- **Historias de usuario relacionadas:** HU-SOP-003

---

### RN-SOP-009: Auditoría Automática de Sistema
- **Descripción:** Cada acción administrativa (cambio de estado o escalamiento) genera un registro de mensaje automático con `tipo = 'SISTEMA'` e inyecta la fecha y el nombre del funcionario responsable en la lista de observaciones.
- **Motivo:** Garantiza la trazabilidad inalterable de quién y cuándo operó sobre el ticket para auditorías de soporte.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`updateTicketStatus`, `escalateTicket`)
- **Endpoints relacionados:** 
  - `PUT /api/support/tickets/:id/status`
  - `POST /api/support/tickets/:id/escalar`
- **Historias de usuario relacionadas:** HU-SOP-005, HU-SOP-006

---

## Formato y Aislamiento

### RN-SOP-010: Formato de Código Base36 Ofuscado
- **Descripción:** Los códigos de ticket expuestos al público se generan mediante codificación Base36 sobre un entero de 22 dígitos derivado de: Año (4d) + ID Colegio (3d) + Documento/Teléfono (10d) + ID Ticket (5d), prefijado por `TKT-`.
- **Motivo:** Previene ataques de enumeración y scraping de incidencias por usuarios malintencionados al no exponer los IDs correlativos de base de datos.
- **Módulos afectados:** Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (Lógica de encode de código)
- **Endpoints relacionados:** 
  - `POST /api/support/tickets`
  - `GET /api/support/tickets/track/:code`
- **Historias de usuario relacionadas:** HU-SOP-001, HU-SOP-002

---

### RN-SOP-011: Aislamiento Multi-Tenant de Tickets
- **Descripción:** Un directivo de colegio solo está autorizado a listar y responder los tickets cuyo `id_colegio` coincida con el colegio registrado en su usuario de sesión.
- **Motivo:** Garantiza la total privacidad y separación de datos entre los colegios que consumen la plataforma como inquilinos.
- **Módulos afectados:** Soporte y Tickets, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (Filtro en `getTickets` y validación en `updateTicketStatus`)
- **Endpoints relacionados:** 
  - `GET /api/support/tickets`
  - `PUT /api/support/tickets/:id/status`
- **Historias de usuario relacionadas:** HU-SOP-004
