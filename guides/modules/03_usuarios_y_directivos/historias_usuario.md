# Historias de Usuario — Usuarios y Directivos

Este documento contiene las historias de usuario implementadas para el módulo de Gestión de Usuarios y Directivos de AcademiaNeiva.

---

# HU-DIR-001: Listar Directivos del Colegio

## Historia
**Como** Administrador General  
**Quiero** ver la lista de directivos asociados a un colegio específico  
**Para** auditar las cuentas con privilegios administrativos del plantel.

## Criterios de Aceptación
- Muestra nombres, apellidos, cargo (`RECTOR`, `COORDINADOR`), correo, estado de vinculación (`ACTIVO`/`INACTIVO`) y fecha de ingreso de cada directivo.
- Permite filtrar la lista de directivos por cargo o estado.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `GET /api/admin/colegios/:colegioId/directivos`
- **Componentes frontend relacionados:** 
  - [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue) (Sección de gestión de directivos)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`listarDirectivos`)

---

# HU-DIR-002: Registrar y Vincular Directivo

## Historia
**Como** Administrador General  
**Quiero** registrar a un nuevo directivo con su información (nombre, apellido, documento, email, cargo) y asociarlo a un colegio  
**Para** dotar al plantel de personal administrativo con permisos de rectoría o coordinación.

## Criterios de Aceptación
- El correo electrónico y el documento del directivo no deben estar registrados previamente en el sistema.
- Se debe elegir obligatoriamente el cargo (`RECTOR` o `COORDINADOR`).
- El backend crea automáticamente el registro del usuario con estado `ACTIVO` y le asocia el rol de `directivo` (o `rector` según corresponda).
- Se genera una contraseña temporal y se registra la fecha de vinculación actual.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-DIR-001, RN-DIR-004
- **Endpoints relacionados:** 
  - `POST /api/admin/directivos`
- **Componentes frontend relacionados:** 
  - [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue) (Modal de vinculación de directivos)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`registrarDirectivo`)

---

# HU-DIR-003: Desvincular Directivo (Inactivar)

## Historia
**Como** Administrador General  
**Quiero** desvincular a un directivo de un colegio  
**Para** revocar sus accesos administrativos por finalización de contrato o traslado.

## Criterios de Aceptación
- El estado del directivo pasa a `INACTIVO` y se registra la `fecha_desvinculacion`.
- La cuenta de usuario asociada se inactiva, denegando el login en futuras sesiones.
- Se conserva el registro del directivo en la base de datos para fines históricos y de auditoría de periodos y firmas de boletines anteriores.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-DIR-002
- **Endpoints relacionados:** 
  - `PATCH /api/admin/directivos/:id/desvincular`
- **Componentes frontend relacionados:** 
  - [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`desvincularDirectivo`)

---

# HU-DIR-004: Forzar Cierre de Sesión de Usuario

## Historia
**Como** Administrador General  
**Quiero** forzar el cierre de sesión de un usuario de forma remota  
**Para** resolver sospechas de compromiso de cuenta o aplicar bloqueos inmediatos de acceso.

## Criterios de Aceptación
- El Administrador General hace clic en "Cerrar sesión" en la lista de usuarios.
- El backend actualiza `logged_out_at` con la fecha y hora actual en la base de datos.
- El token del usuario queda invalidado instantáneamente en el middleware del backend ante cualquier consulta posterior.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-DIR-003
- **Endpoints relacionados:** 
  - `POST /api/admin/usuarios/:id/cerrar-sesion`
- **Componentes frontend relacionados:** 
  - [UsuariosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/UsuariosList.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`forzarCierreSesion`)

---

# HU-DIR-005: Modificar Credenciales Sensibles mediante Ticket de Soporte

## Historia
**Como** Administrador General  
**Quiero** modificar el correo o documento de un usuario a solicitud del colegio  
**Para** garantizar la trazabilidad de los cambios sensibles exigiendo el ingreso de un código de ticket de soporte resuelto.

## Criterios de Aceptación
- El Administrador General debe ingresar el código de ticket Base36 (`TKT-XXXX`).
- El backend valida que el ticket de soporte exista, corresponda al colegio del usuario y esté en estado `RESUELTO`.
- Si el ticket no es válido o está abierto, se rechaza la modificación de datos del usuario.
- Al procesar el cambio exitoso, el sistema guarda en el log de auditoría el código del ticket que justificó la acción.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-DIR-005
- **Endpoints relacionados:** 
  - `POST /api/admin/usuarios/:id/validar-ticket`
  - `PUT /api/admin/usuarios/:id/credenciales-con-ticket`
- **Componentes frontend relacionados:** 
  - [UsuariosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/UsuariosList.vue) (Formulario de edición de credenciales)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`validarTicketParaUsuario`, `modificarCredencialesConTicket`)
