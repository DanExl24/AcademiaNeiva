# Reglas de Negocio — Usuarios y Directivos

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Gestión de Usuarios y Directivos de AcademiaNeiva.

---

## Gestión de Acceso Administrativo

### RN-DIR-001: Creación Automática de Cuenta de Usuario
- **Descripción:** Al registrar un nuevo directivo en el panel del Admin General, el backend crea de forma automática e integrada un registro en la tabla `usuario` asociando el email, documento y asignándole el rol `directivo`.
- **Motivo:** Evita inconsistencias de datos y ahorra el doble registro manual de credenciales de ingreso por parte del personal de soporte técnico.
- **Módulos afectados:** Usuarios y Directivos, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`registrarDirectivo`)
- **Endpoints relacionados:** 
  - `POST /api/admin/directivos`
- **Historias de usuario relacionadas:** HU-DIR-002

---

### RN-DIR-002: Bloqueo de Acceso por Desvinculación
- **Descripción:** Al desvincular a un directivo, el sistema cambia su estado personal en la tabla `directivo` a `INACTIVO` y, a su vez, marca la cuenta de usuario vinculada en la tabla `usuario` como `estado = 'SUSPENDIDO'`.
- **Motivo:** Garantiza que los funcionarios desvinculados de la institución no puedan seguir accediendo a la consola de control ni alterando las notas o configuraciones del colegio.
- **Módulos afectados:** Usuarios y Directivos, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`desvincularDirectivo`)
- **Endpoints relacionados:** 
  - `PATCH /api/admin/directivos/:id/desvincular`
- **Historias de usuario relacionadas:** HU-DIR-003

---

### RN-DIR-003: Invalación Global por Cierre Remoto
- **Descripción:** Cuando el Admin General fuerza de manera remota el cierre de sesión de un usuario, el backend actualiza el campo `logged_out_at = NOW()` en la tabla `usuario` e inserta el `jti` en la lista negra.
- **Motivo:** Invalida de inmediato todos los tokens de sesión activos que dicho usuario posea en el navegador, resolviendo accesos no autorizados o sospechosos de forma inmediata.
- **Módulos afectados:** Usuarios y Directivos, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`forzarCierreSesion`)
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken` - valida la fecha de emisión del token contra `logged_out_at`)
- **Endpoints relacionados:** 
  - `POST /api/admin/usuarios/:id/cerrar-sesion`
- **Historias de usuario relacionadas:** HU-DIR-004

---

## Aislamiento e Integridad

### RN-DIR-004: Rol e Identificación de Colegio Directivo
- **Descripción:** Al registrar un directivo, se debe asociar de manera mandatoria a un `id_colegio` en la tabla `usuario`. El token JWT heredará este identificador para aislar su alcance en las consultas.
- **Motivo:** Permite que las consultas administrativas del directivo a nivel de estudiantes, docentes y notas estén automáticamente filtradas por el colegio al que pertenece, manteniendo el aislamiento multi-tenant del sistema.
- **Módulos afectados:** Usuarios y Directivos, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`registrarDirectivo`)
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken`)
- **Endpoints relacionados:** 
  - `POST /api/admin/directivos`
- **Historias de usuario relacionadas:** HU-DIR-002

---

### RN-DIR-005: Trazabilidad de Credenciales por Ticket Resuelto
- **Descripción:** El Administrador General solo puede modificar datos sensibles como el correo electrónico o documento de un usuario si proporciona un código Base36 de un ticket de soporte válido y en estado `RESUELTO`.
- **Motivo:** Protege la integridad y consistencia del sistema al asegurar que ningún cambio de datos de identificación críticos ocurra de manera unilateral o sin justificación de soporte documentada.
- **Módulos afectados:** Usuarios y Directivos, Soporte y Tickets.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`validarTicketParaUsuario`, `modificarCredencialesConTicket`)
- **Endpoints relacionados:** 
  - `POST /api/admin/usuarios/:id/validar-ticket`
  - `PUT /api/admin/usuarios/:id/credenciales-con-ticket`
- **Historias de usuario relacionadas:** HU-DIR-005
