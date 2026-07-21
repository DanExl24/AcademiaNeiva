# 🔐 Módulo de Autenticación, Sesiones y Perfil

**Sistema:** Academia Neiva  
**Módulo:** Autenticación y gestión de identidad  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo gestiona la autenticación de los 5 roles del sistema, la verificación de sesiones JWT, la recuperación de contraseñas, la gestión del perfil del usuario y el directorio institucional. Es el punto de entrada de seguridad para todo el sistema y funciona como capa transversal que protege los demás módulos.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Todos los roles** | Login, logout, recuperación de contraseña, gestión de perfil |
| **Directivo, Docente, Padre, Admin General** | Login con email/password |
| **Estudiante** | Login con código estudiantil y contraseña |
| **Público** | Verificación de documento, acceso a rutas públicas |
| **Autenticados** | Consulta de directorio institucional |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Login estándar | `POST` | `/api/auth/login` | Directivo, Docente, Padre, Admin |
| Login estudiantil | `POST` | `/api/auth/student-login` | Estudiante |
| Solicitar recuperación de contraseña | `POST` | `/api/auth/forgot-password` | Público |
| Restablecer contraseña con token | `POST` | `/api/auth/reset-password` | Público (token válido) |
| Verificar sesión activa | `GET` | `/api/auth/verify` | Sin middleware (lee header) |
| Verificar existencia de documento | `GET` | `/api/auth/check-document/:document` | Público |
| Obtener identidad visual del colegio | `GET` | `/api/auth/school-identity/:schoolId` | Autenticado |
| Obtener perfil del usuario | `GET` | `/api/auth/profile` | Autenticado |
| Actualizar email del perfil | `PUT` | `/api/auth/profile/email` | Autenticado |
| Actualizar contraseña del perfil | `PUT` | `/api/auth/profile/password` | Autenticado |

---

## 4. Reglas de Negocio

- **RN-AUTH-001 (Token JWT con JTI):** Cada token emitido incluye un identificador único (`jti`) que permite la invalidación individual mediante la tabla `token_blacklist`.
- **RN-AUTH-002 (Verificación de estado):** En cada petición autenticada, el middleware consulta el estado del usuario en la tabla `usuario`. Si el estado no es `ACTIVO`, el acceso se deniega con `401`.
- **RN-AUTH-003 (Cierre forzado de sesión):** El campo `logged_out_at` en la tabla `usuario` permite invalidar globalmente todos los tokens emitidos antes de esa fecha. Si `tokenIssuedTime < loggedOutTime`, el token se rechaza.
- **RN-AUTH-004 (Blacklist de tokens):** Cuando se cierra sesión de forma forzada por el Admin General, el `jti` del token se inserta en `token_blacklist`, invalidando ese token específico incluso antes de su expiración natural.
- **RN-AUTH-005 (Caché de verificación por sesión):** El frontend verifica el token contra el backend **una sola vez por sesión de navegador** (`sessionStorage._sessionVerified`). Una nueva pestaña genera una nueva verificación.
- **RN-AUTH-006 (Bloqueo de estudiantes inactivos):** Los estudiantes con estado `EXPULSADO` o `RETIRADO` tienen su campo `usuario.activo = false`, lo que genera una denegación inmediata de acceso (`401 Unauthorized`).
- **RN-AUTH-007 (Rate limiting de login):** Máximo 10 intentos de login por IP cada 15 minutos para prevenir ataques de fuerza bruta.
- **RN-AUTH-008 (Roles múltiples):** El token JWT contiene un array `roles` que permite a un usuario tener múltiples roles (por ejemplo, `admin_general` puede heredar el rol de `directivo` durante una supervisión activa).
- **RN-AUTH-009 (Guard de rutas frontend):** Cada ruta protegida define en su `meta.roles` los roles permitidos. Si el rol activo del usuario no está en la lista, se redirige al dashboard.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller de Auth** | [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) — `login`, `studentLogin`, `getSchoolIdentity`, `verifySession`, `updateProfileEmail`, `updateProfilePassword`, `getUserProfile` |
| **Controller de Password** | [passwordResetController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/passwordResetController.ts) — `forgotPassword`, `resetPassword` |
| **Controller de Usuario** | [userController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/userController.ts) — `checkDocument` |
| **Middleware** | [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) — `verifyToken`, `verifyTokenOptional`, `requireAdminGeneral`, `requireDirectivo`, `requireDocente`, `requirePadre`, `requireEstudiante` |
| **Routes** | [auth.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/auth.routes.ts) |
| **Servicio de Email** | [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) — Envío de email de recuperación de contraseña |

### Frontend

| Tipo | Archivo |
|---|---|
| **Login** | [LoginView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/auth/LoginView.vue) |
| **Recuperación** | [ForgotPasswordView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/auth/ForgotPasswordView.vue) |
| **Reset** | [ResetPasswordView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/auth/ResetPasswordView.vue) |
| **Perfil** | [ProfileView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/ProfileView.vue) |
| **Directorio** | [DirectoryView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/DirectoryView.vue) |
| **Store** | [auth.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/stores/auth.ts) |
| **Router Guard** | [index.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/router/index.ts) — `beforeEach` |

---

## 6. Modelo de Datos

### Tabla: `usuario`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_usuario` | SERIAL PK | Identificador único del usuario |
| `email` | VARCHAR | Correo electrónico (login para roles no-estudiante) |
| `password` | VARCHAR | Hash bcrypt de la contraseña |
| `nombre` | VARCHAR | Nombre del usuario |
| `apellido` | VARCHAR | Apellido del usuario |
| `rol` | VARCHAR | Rol principal del usuario |
| `estado` | `estado_usuario_sistema` | `ACTIVO`, `SUSPENDIDO`, `BANEADO`, `ELIMINADO` |
| `logged_out_at` | TIMESTAMPTZ | Marca global de invalidación de tokens |
| `id_colegio` | INT FK | Colegio al que pertenece (NULL para admin_general) |

### Tabla: `token_blacklist`

| Columna | Tipo | Descripción |
|---|---|---|
| `jti` | VARCHAR PK | Identificador único del token JWT invalidado |
| `created_at` | TIMESTAMPTZ | Fecha de inserción en blacklist |

### Types relevantes

```sql
CREATE TYPE public.estado_usuario_sistema AS ENUM (
    'ACTIVO', 'SUSPENDIDO', 'BANEADO', 'ELIMINADO'
);
```

---

## 7. Conexiones con Otros Módulos

- **→ Todos los módulos**: El middleware `verifyToken` protege todas las rutas autenticadas del sistema.
- **→ Supervisión**: Dentro de `verifyToken`, si el usuario es `admin_general` con supervisión activa, se le asigna dinámicamente el `schoolId` del colegio supervisado y se auditan todas sus acciones.
- **→ Estudiantes**: El login estudiantil consulta la tabla `estudiante` y valida el estado (`ACTIVO`/`SANCIONADO` vs `EXPULSADO`/`RETIRADO`).
- **→ Notificaciones**: El módulo de email envía los correos de recuperación de contraseña.

---

## 8. Validaciones Implementadas

### Backend
- **Contraseña segura**: Validación de longitud mínima en `updateProfilePassword`.
- **Email único**: Verificación de unicidad del email antes de actualizar perfil.
- **Token expirado**: JWT con expiración configurable; `jwt.verify` lanza excepción si expirado.
- **Blacklist check**: Consulta a `token_blacklist` en cada request autenticado.
- **Estado activo**: Consulta a `usuario.estado` en cada request autenticado.

### Frontend
- **Guard de rutas**: `router.beforeEach` verifica `isAuthenticated`, token válido, y `meta.roles`.
- **Verificación lazy**: Solo una verificación contra backend por sesión de navegador.
- **Redirección inteligente**: Si usuario autenticado va a `/login`, redirige a `/dashboard`.

---

## 9. Decisiones de Diseño

| Decisión | Alternativa Descartada | Justificación |
|---|---|---|
| **JWT con `jti` + blacklist** | JWT sin blacklist | Permite invalidar tokens individuales para cierre forzado por admin sin afectar otros tokens del usuario |
| **`logged_out_at` en tabla usuario** | Blacklist masiva | Permite invalidación global eficiente: un solo UPDATE invalida todos los tokens anteriores |
| **Verificación por sesión** | Verificación en cada navegación | Reduce la carga del backend; una nueva pestaña = nueva verificación es suficiente para seguridad |
| **Login separado para estudiantes** | Login unificado | Los estudiantes usan código estudiantil (no email), requiere flujo diferente con consulta a tabla `estudiante` |
