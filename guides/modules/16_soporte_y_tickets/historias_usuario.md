# Historias de Usuario — Soporte y Tickets

Este documento contiene las historias de usuario implementadas para el módulo de Soporte y Gestión de Tickets de AcademiaNeiva.

---

# HU-SOP-001: Crear Ticket de Soporte Técnico

## Historia
**Como** remitente (visitante o usuario autenticado)  
**Quiero** diligenciar el formulario de soporte con mi tipo de incidencia, asunto y descripción  
**Para** registrar una solicitud de soporte técnico en la plataforma.

## Criterios de Aceptación
- Si el usuario no está autenticado (visitante público), debe escribir su nombre, correo y número telefónico y seleccionar el colegio.
- Si el usuario está autenticado, el sistema inyecta automáticamente sus datos personales (nombre, correo) y el colegio al que pertenece de forma implícita.
- El sistema genera un código Base36 de alta precisión prefijado por `TKT-` (ej. `TKT-1B3X9H7Z`).
- El estado inicial de todo ticket es `'ABIERTO'` con `fecha_escalado = NULL`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Público, Estudiante, Docente, Padre, Directivo
- **Reglas de negocio relacionadas:** RN-SOP-001, RN-SOP-006, RN-SOP-010
- **Endpoints relacionados:** 
  - `POST /api/support/tickets`
- **Componentes frontend relacionados:** 
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) (Formulario de creación pública en `/soporte`)
- **Controllers/Services relacionados:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`createTicket`)

---

# HU-SOP-002: Consultar Seguimiento de Ticket por Código Público

## Historia
**Como** remitente (visitante o usuario autenticado)  
**Quiero** buscar mi ticket mediante el código Base36 ofuscado  
**Para** consultar el estado de la incidencia y leer las respuestas y observaciones institucionales.

## Criterios de Aceptación
- El usuario ingresa el código del ticket en la casilla de seguimiento.
- Si el código no existe o está mal estructurado, el sistema reporta que el ticket no fue encontrado.
- Si el código es correcto, el sistema muestra el estado, tipo de incidencia, asunto, descripción y el listado de observaciones y respuestas asociadas de forma cronológica.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Público, Estudiante, Docente, Padre
- **Reglas de negocio relacionadas:** RN-SOP-010
- **Endpoints relacionados:** 
  - `GET /api/support/tickets/track/:code`
- **Componentes frontend relacionados:** 
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) (Pestaña de consulta)
- **Controllers/Services relacionados:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`getTicketByCode`)

---

# HU-SOP-003: Responder en el Hilo del Ticket (Regla de Turnos)

## Historia
**Como** remitente (visitante o usuario autenticado)  
**Quiero** enviar un nuevo mensaje en respuesta a las observaciones del colegio  
**Para** aportar aclaraciones o confirmar la solución de mi problema.

## Criterios de Aceptación
- La caja de texto y botón de enviar están inhabilitados si el último mensaje registrado en el ticket proviene del propio remitente (evita spam).
- El usuario solo puede responder si el último mensaje fue registrado por un `DIRECTIVO` o `ADMIN_GENERAL`.
- Al enviar la respuesta exitosa, el estado del ticket transiciona automáticamente a `'EN_PROCESO'`.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Público, Estudiante, Docente, Padre
- **Reglas de negocio relacionadas:** RN-SOP-003, RN-SOP-008
- **Endpoints relacionados:** 
  - `POST /api/support/tickets/track/:code/observaciones`
- **Componentes frontend relacionados:** 
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue)
- **Controllers/Services relacionados:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`addVisitorObservation`)

---

# HU-SOP-004: Listar y Filtrar Tickets en la Bandeja Directiva y Administrativa

## Historia
**Como** directivo escolar o Administrador General  
**Quiero** acceder a la bandeja de soporte con filtros por estado y origen  
**Para** gestionar los casos correspondientes a mi jurisdicción de forma organizada.

## Criterios de Aceptación
- Si el usuario es un `DIRECTIVO`, solo puede listar los tickets pertenecientes a su `id_colegio` que no estén escalados.
- Si el usuario es `ADMIN_GENERAL`, solo puede visualizar los tickets que hayan sido escalados (`fecha_escalado IS NOT NULL`).
- Permite filtrar las listas por estado (`ABIERTO`, `EN_PROCESO`, `RESUELTO`).
- Los tickets resueltos figuran en la lista en formato de solo lectura.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo, Administrador General
- **Reglas de negocio relacionadas:** RN-SOP-005, RN-SOP-006, RN-SOP-011
- **Endpoints relacionados:** 
  - `GET /api/support/tickets`
- **Componentes frontend relacionados:** 
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) (Vista administrativa)
- **Controllers/Services relacionados:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`getTickets`)

---

# HU-SOP-005: Registrar Observación Institucional y Modificar Estado

## Historia
**Como** directivo escolar o Administrador General  
**Quiero** agregar una observación al ticket y cambiar su estado  
**Para** dar respuesta al usuario o consolidar la resolución del caso.

## Criterios de Aceptación
- Al registrar la primera observación en un ticket `'ABIERTO'`, el estado transiciona automáticamente a `'EN_PROCESO'`.
- Si el directivo intenta cambiar el estado a `'RESUELTO'`, la interfaz despliega un cuadro de diálogo de confirmación advirtiendo que el registro pasará a ser de solo lectura.
- No se permite revertir un ticket a `'ABIERTO'` si ya tiene observaciones registradas.
- Toda acción genera de forma atómica una nota de auditoría de `'SISTEMA'`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo, Administrador General
- **Reglas de negocio relacionadas:** RN-SOP-002, RN-SOP-003, RN-SOP-007, RN-SOP-009
- **Endpoints relacionados:** 
  - `POST /api/support/tickets/:id/observaciones`
  - `PUT /api/support/tickets/:id/status`
- **Componentes frontend relacionados:** 
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue)
- **Controllers/Services relacionados:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`addTicketObservation`, `updateTicketStatus`)

---

# HU-SOP-006: Escalar Ticket de Soporte al Administrador General

## Historia
**Como** directivo escolar  
**Quiero** escalar un ticket institucional al Administrador General  
**Para** delegar la solución de un caso de alta complejidad técnica que supera mi alcance local.

## Criterios de Aceptación
- El directivo hace clic en "Escalar" en la vista del ticket.
- El backend actualiza `fecha_escalado = NOW()`, promueve el estado a `'EN_PROCESO'` y registra una observación de auditoría de `'SISTEMA'`.
- El directivo pierde inmediatamente el control de edición del selector de estado (se muestra bloqueado en la interfaz).
- El ticket pasa a ser visible únicamente en la bandeja del Administrador General.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-SOP-004, RN-SOP-005, RN-SOP-006, RN-SOP-009
- **Endpoints relacionados:** 
  - `POST /api/support/tickets/:id/escalar`
- **Componentes frontend relacionados:** 
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue)
- **Controllers/Services relacionados:** 
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`escalateTicket`)
