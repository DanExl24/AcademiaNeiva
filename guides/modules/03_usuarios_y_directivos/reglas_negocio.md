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

---

### RN-DIR-006: Creación Directa de Usuarios por Admin General (sin Matrícula)
- **Descripción:** El Administrador General puede crear cuentas de usuario de los roles `directivo`, `docente`, `padre` y `admin_general` directamente desde el panel de usuarios, sin pasar por ningún proceso de matrícula. Al crearlos, el sistema registra automáticamente el perfil correspondiente en la tabla de rol (`directivo`, `docente`, `padre_familia`) y asigna la contraseña ingresada en el formulario.
- **Motivo:** El Admin General necesita poder incorporar al personal institucional (docentes, directivos) y a los padres de familia de forma ágil, sin depender del flujo de matrícula que aplica únicamente para estudiantes.
- **Restricción crítica:** El rol `estudiante` está explícitamente excluido de esta creación directa. Los estudiantes solo pueden ingresar al sistema a través del proceso oficial de **Matrícula Institucional** gestionado por el Directivo del colegio, que garantiza la correcta asignación a grado, grupo, año académico y vinculación con el padre de familia.
- **Módulos afectados:** Usuarios y Directivos, Matrículas.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`crearUsuarioByAdminGeneral`)
  - [adminUser.dto.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/dtos/adminUser.dto.ts)
  - [adminGeneral.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/adminGeneral.routes.ts)
  - [UsuariosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/UsuariosList.vue) (Modal "Crear Nuevo Usuario")
- **Endpoints relacionados:** 
  - `POST /api/admin/usuarios`
- **Historias de usuario relacionadas:** HU-DIR-006

---

### RN-DIR-007: Cambio de Correo Electrónico con Verificación por Código
- **Descripción:** El cambio de dirección de correo electrónico de un usuario solo puede realizarse mediante un flujo de doble confirmación: el sistema envía un código de verificación al correo nuevo, y el usuario debe ingresar ese código para que el cambio sea efectivo. No es posible cambiar el correo sin completar este proceso.
- **Motivo:** Evita que un atacante con acceso temporal a la sesión cambie el correo de la víctima, lo que bloquearía la recuperación de cuenta. Garantiza que el nuevo correo es válido y accesible por el propietario de la cuenta.
- **Módulos afectados:** Autenticación y Sesiones, Usuarios y Directivos.
- **Archivos donde se implementa:** 
  - [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) (Generación y envío del código)
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (Verificación y aplicación del cambio)
  - Tabla BD: `email_change_tokens` (migración `023_email_change_tokens.sql`)
- **Endpoints relacionados:** 
  - `POST /api/auth/solicitar-cambio-email`
  - `POST /api/auth/confirmar-cambio-email`
- **Historias de usuario relacionadas:** HU-AUT-006

---

### RN-DIR-008: Email Nullable para Estudiantes
- **Descripción:** La columna `email` en la tabla `usuario` permite valores `NULL`. Esto aplica exclusivamente a estudiantes que no cuentan con correo electrónico propio. Para todos los demás roles (`directivo`, `docente`, `padre`, `admin_general`), el correo es obligatorio y único. El índice `UNIQUE` sobre `email` sigue activo; en PostgreSQL, múltiples valores `NULL` no violan la restricción de unicidad (`NULL ≠ NULL`).
- **Motivo:** Los estudiantes (especialmente menores de edad o de zonas con baja conectividad) frecuentemente no tienen correo propio. Forzar uno ficticio generaba datos basura en la BD y dificultaba la auditoría.
- **Módulos afectados:** Usuarios y Directivos, Matrículas.
- **Archivos donde se implementa:** 
  - Migración: `024_make_usuario_email_nullable.sql`
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts)
- **Historias de usuario relacionadas:** HU-DIR-006


