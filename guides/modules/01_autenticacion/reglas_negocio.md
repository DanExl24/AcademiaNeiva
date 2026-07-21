# Reglas de Negocio — Autenticación y Sesiones

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Autenticación y Sesiones de AcademiaNeiva.

---

## Seguridad y Tokens

### RN-AUT-001: Identificador Único de Token (JTI)
- **Descripción:** Todo token JWT emitido por la API de autenticación debe contener un identificador único aleatorio denominado `jti`.
- **Motivo:** Permite realizar un control de cierre de sesión seguro mediante la invalidación individual de tokens específicos en la tabla `token_blacklist` sin afectar a otros tokens emitidos al mismo usuario.
- **Módulos afectados:** Autenticación y Sesiones, Supervisión y Auditoría.
- **Archivos donde se implementa:** 
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (Generación de token)
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (Middleware `verifyToken`)
- **Endpoints relacionados:** 
  - `POST /api/auth/login`
  - `POST /api/auth/student-login`
- **Historias de usuario relacionadas:** HU-AUT-001, HU-AUT-002

---

### RN-AUT-002: Verificación de Estado Activo de Cuenta
- **Descripción:** El sistema debe verificar en cada petición autenticada que el estado del usuario en la base de datos sea igual a `ACTIVO`.
- **Motivo:** Evita que usuarios suspendidos, bloqueados o eliminados continúen realizando operaciones con tokens JWT que aún no han expirado de forma natural.
- **Módulos afectados:** Autenticación y Sesiones (Todos los módulos del sistema).
- **Archivos donde se implementa:** 
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken` y `verifyTokenOptional`)
- **Endpoints relacionados:** Todos los endpoints protegidos.
- **Historias de usuario relacionadas:** HU-AUT-001, HU-AUT-002

---

### RN-AUT-003: Invalación Global por Cierre de Sesión Forzado
- **Descripción:** El campo `logged_out_at` en la tabla `usuario` marca el timestamp del último cierre de sesión forzado. Cualquier token con fecha de emisión (`iat`) menor a `logged_out_at` se considera vencido.
- **Motivo:** Permite invalidar todas las sesiones activas abiertas de un usuario (por ejemplo, en múltiples navegadores o dispositivos) de forma instantánea al actualizar sus credenciales.
- **Módulos afectados:** Autenticación y Sesiones, Usuarios y Directivos.
- **Archivos donde se implementa:** 
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (`updateProfilePassword`)
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken` y `verifyTokenOptional`)
- **Endpoints relacionados:** 
  - `PUT /api/auth/profile/password`
- **Historias de usuario relacionadas:** HU-AUT-006

---

### RN-AUT-004: Registro en Lista Negra de Tokens (Blacklist)
- **Descripción:** Al cerrar la sesión de forma voluntaria o al ejecutarse una desactivación forzada por parte de la administración, el identificador `jti` del token se almacena en la tabla `token_blacklist`.
- **Motivo:** Garantiza que un token robado o descartado no pueda ser reutilizado antes de su fecha de expiración configurada en el servidor.
- **Módulos afectados:** Autenticación y Sesiones, Usuarios y Directivos.
- **Archivos donde se implementa:** 
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken`)
- **Endpoints relacionados:** Todos los endpoints protegidos.
- **Historias de usuario relacionadas:** HU-AUT-001, HU-AUT-006

---

## Flujo de Login y Acceso

### RN-AUT-005: Caché de Verificación en Frontend
- **Descripción:** El frontend del sistema verifica la validez del token guardado contra el servidor una sola vez por pestaña del navegador, guardando la marca `_sessionVerified = 'true'` en `sessionStorage`.
- **Motivo:** Minimiza el impacto en la red del servidor Express al evitar llamadas API repetitivas del guard de Vue Router ante cada cambio de vista local en una SPA.
- **Módulos afectados:** Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [index.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/router/index.ts) (`beforeEach`)
- **Endpoints relacionados:** 
  - `GET /api/auth/verify`
- **Historias de usuario relacionadas:** HU-AUT-001, HU-AUT-002

---

### RN-AUT-006: Bloqueo de Acceso de Estudiantes Inactivos
- **Descripción:** Los estudiantes con estado `EXPULSADO` o `RETIRADO` deben tener su cuenta de usuario inhabilitada en la base de datos.
- **Motivo:** Salvaguarda la privacidad de la información escolar e impide el acceso al portal una vez se ha cancelado formalmente la matrícula.
- **Módulos afectados:** Autenticación y Sesiones, Estudiantes y Estados.
- **Archivos donde se implementa:** 
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (Al cambiar estado)
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (`studentLogin`)
- **Endpoints relacionados:** 
  - `POST /api/auth/student-login`
- **Historias de usuario relacionadas:** HU-AUT-002

---

## Restricciones y Límites

### RN-AUT-007: Limitación de Intentos de Acceso (Rate Limiting)
- **Descripción:** La API aplica un limitador que restringe a un máximo de 10 intentos de inicio de sesión por dirección IP cada 15 minutos.
- **Motivo:** Protege el sistema contra ataques automáticos de diccionario o de fuerza bruta contra las contraseñas de los usuarios.
- **Módulos afectados:** Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [app.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/app.ts) (`loginLimiter`)
- **Endpoints relacionados:** 
  - `POST /api/auth/login`
  - `POST /api/auth/student-login`
- **Historias de usuario relacionadas:** HU-AUT-001, HU-AUT-002

---

### RN-AUT-008: Herencia Dinámica de Roles en Modo Supervisión
- **Descripción:** Durante una sesión de supervisión activa, el token JWT del Administrador General hereda dinámicamente el rol de `directivo`/`rector` y se le asigna el `schoolId` del colegio supervisado.
- **Motivo:** Permite al Administrador General navegar e inspeccionar las consolas de los colegios con los permisos correspondientes de rectoría sin alterar su cuenta de usuario original.
- **Módulos afectados:** Autenticación y Sesiones, Supervisión y Auditoría.
- **Archivos donde se implementa:** 
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken` en bloque de admin_general)
- **Endpoints relacionados:** Todos los endpoints con el middleware `verifyToken`.
- **Historias de usuario relacionadas:** HU-AUT-001
