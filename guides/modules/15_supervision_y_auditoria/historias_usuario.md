# Historias de Usuario — Supervisión y Auditoría

Este documento contiene las historias de usuario implementadas para el módulo de Supervisión y Auditoría de AcademiaNeiva.

---

# HU-SUP-001: Solicitar Sesión de Supervisión

## Historia
**Como** Administrador General  
**Quiero** enviar una solicitud de supervisión a un colegio ingresando el motivo de soporte y la duración planificada  
**Para** solicitar el acceso extraordinario bajo la identidad del Rector del plantel.

## Criterios de Aceptación
- El Administrador General debe seleccionar el colegio de destino de la lista.
- Debe elegir el tipo de supervisión (`SOLO_LECTURA` o `EDITOR`).
- Debe registrar detalladamente el motivo de soporte técnico o pedagógico que justifica la solicitud.
- Establece la duración máxima de la sesión (en minutos).
- Al guardar, la solicitud se registra con estado `SOLICITADA` y se activa una alerta en la bandeja del rector del colegio.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-SUP-001
- **Endpoints relacionados:** 
  - `POST /api/admin/supervision/solicitar`
- **Componentes frontend relacionados:** 
  - [SupervisionSolicitudes.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/SupervisionSolicitudes.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`solicitarSupervision`)

---

# HU-SUP-002: Aprobar Solicitud de Supervisión (Re-Autenticación)

## Historia
**Como** directivo del colegio (Rector)  
**Quiero** ingresar mi contraseña de usuario en el modal de aprobación  
**Para** autorizar y abrir la sesión de supervisión extraordinaria de forma segura y auditada.

## Criterios de Aceptación
- El directivo revisa la lista de solicitudes de supervisión entrantes en su colegio.
- Al hacer clic en "Aprobar", se le despliega un modal exigiendo el ingreso obligatorio de su contraseña personal de inicio de sesión.
- El backend verifica la contraseña contra el hash de su usuario. Si es correcta, el estado de la supervisión transiciona a `APROBADA`.
- Si la contraseña es incorrecta, se bloquea la aprobación y se notifica el fallo de credenciales.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo (Rector / Coordinador)
- **Reglas de negocio relacionadas:** RN-SUP-001
- **Endpoints relacionados:** 
  - `POST /api/admin/supervision/:id/aprobar`
- **Componentes frontend relacionados:** 
  - [SupervisionManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SupervisionManagement.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`aprobarSupervision`)

---

# HU-SUP-003: Entrar e Iniciar Sesión de Supervisión Activa

## Historia
**Como** Administrador General  
**Quiero** presionar el botón de ingresar en una supervisión aprobada  
**Para** heredar los privilegios del Rector y operar en la consola del colegio con la sesión activa.

## Criterios de Aceptación
- Al presionar ingresar, el estado de la supervisión pasa a `ACTIVA` y se registra la `fecha_entrada`.
- El sistema emite un token JWT actualizado para el Administrador General que hereda de forma temporal el rol de `directivo` y el `schoolId` del colegio.
- Se despliega un banner de color rojo en el encabezado del frontend indicando el modo de supervisión activo, el nombre del colegio y un temporizador con los minutos restantes de la sesión.
- Se envían correos de notificación automática informando a los directivos del colegio de la entrada del administrador.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-SUP-002, RN-SUP-003
- **Endpoints relacionados:** 
  - `POST /api/admin/supervision/:id/entrar`
- **Componentes frontend relacionados:** 
  - [SupervisionActivas.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/SupervisionActivas.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`entrarSupervision`)
  - [adminGeneralNotificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/adminGeneralNotificationService.ts)

---

# HU-SUP-004: Revocar de forma Manual la Supervisión

## Historia
**Como** directivo del colegio (Rector)  
**Quiero** presionar el botón de revocar en la lista de supervisiones activas de mi colegio  
**Para** expulsar al Administrador General de forma inmediata de la consola y retirar sus privilegios de acceso.

## Criterios de Aceptación
- El directivo puede presionar "Revocar Acceso" en cualquier momento sobre una sesión activa.
- El directivo debe ingresar de forma obligatoria el motivo de la revocación.
- Al guardar, el backend cambia el estado de la supervisión a `REVOCADA` y actualiza la fecha de salida.
- En la siguiente consulta del Administrador General, el middleware `verifyToken` detecta la revocación y le deniega el acceso con error `401 Unauthorized`, obligándolo a cerrar sesión local en su navegador.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo (Rector / Coordinador)
- **Reglas de negocio relacionadas:** RN-SUP-003
- **Endpoints relacionados:** 
  - `POST /api/admin/supervision/:id/revocar`
- **Componentes frontend relacionados:** 
  - [SupervisionManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SupervisionManagement.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`revocarSupervision`)

---

# HU-SUP-005: Consultar Historial de Acciones Auditadas (Bitácora)

## Historia
**Como** directivo del colegio o Administrador General  
**Quiero** visualizar el listado detallada de acciones ejecutadas por el administrador durante la sesión  
**Para** auditar y dar transparencia a las consultas y cambios de datos realizados en la institución.

## Criterios de Aceptación
- La vista de auditoría muestra la fecha, el módulo afectado, el tipo de acción (`LECTURA`, `MODIFICACION`, etc.) y la descripción del recurso afectado.
- En el caso de acciones de tipo `MODIFICACION`, permite hacer clic y desplegar un visor comparativo que muestra en formato estructurado (JSON) el valor anterior del registro, el nuevo valor y el motivo de cambio justificado por el administrador.
- Los registros se extraen de la base de datos de forma directa y no permiten edición o borrado.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo, Administrador General
- **Reglas de negocio relacionadas:** RN-SUP-004, RN-SUP-005
- **Endpoints relacionados:** 
  - `GET /api/admin/supervision/:id/acciones`
  - `GET /api/admin/supervision/:id/acciones-directivo`
- **Componentes frontend relacionados:** 
  - [SupervisionHistorial.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/SupervisionHistorial.vue)
  - [SupervisionManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SupervisionManagement.vue) (Vista de acciones para directivos)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`verAccionesSupervision`, `verAccionesSupervisionDirectivo`)
