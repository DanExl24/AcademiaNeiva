# 👥 Módulo de Gestión de Usuarios, Directivos y Configuración de Plataforma

**Sistema:** Academia Neiva  
**Módulo:** Administración global de usuarios y directivos  
**Última actualización:** 2026-08-02

---

## 1. Descripción Funcional

Este módulo permite al Administrador General gestionar todas las cuentas de usuario del sistema a nivel global, administrar los directivos de cada colegio (registro, vinculación, desvinculación), y configurar parámetros globales de la plataforma. Es el módulo de gobierno centralizado del sistema.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Admin General** | CRUD completo de usuarios globales, directivos y configuración de plataforma |

---

## 3. Acciones Disponibles

### Gestión de Usuarios

| Acción | Método | Endpoint |
|---|---|---|
| Listar usuarios globales | `GET` | `/api/admin/usuarios` |
| Detalle de usuario | `GET` | `/api/admin/usuarios/:id` |
| **Crear usuario** | `POST` | `/api/admin/usuarios` |
| Cambiar estado de usuario | `PATCH` | `/api/admin/usuarios/:id/estado` |
| Restablecer password | `POST` | `/api/admin/usuarios/:id/restablecer-password` |
| Forzar cierre de sesión | `POST` | `/api/admin/usuarios/:id/cerrar-sesion` |
| Validar ticket para usuario | `POST` | `/api/admin/usuarios/:id/validar-ticket` |
| Modificar credenciales con ticket | `PUT` | `/api/admin/usuarios/:id/credenciales-con-ticket` |
| Eliminar usuario | `DELETE` | `/api/admin/usuarios/:id` |

### Gestión de Directivos

| Acción | Método | Endpoint |
|---|---|---|
| Listar directivos de un colegio | `GET` | `/api/admin/colegios/:colegioId/directivos` |
| Registrar directivo | `POST` | `/api/admin/directivos` |
| Actualizar directivo | `PUT` | `/api/admin/directivos/:id` |
| Desvincular directivo | `PATCH` | `/api/admin/directivos/:id/desvincular` |
| Eliminar directivo | `DELETE` | `/api/admin/directivos/:id` |

### Configuración de Plataforma

| Acción | Método | Endpoint |
|---|---|---|
| Obtener configuración global | `GET` | `/api/admin/configuracion` |
| Actualizar configuración global | `PUT` | `/api/admin/configuracion` |

---

## 4. Reglas de Negocio

- **RN-USR-001 (Estados de usuario):** Un usuario puede estar en estado `ACTIVO`, `SUSPENDIDO`, `BANEADO` o `ELIMINADO`. Solo los usuarios `ACTIVO` pueden autenticarse.
- **RN-USR-002 (Cierre forzado de sesión):** Al forzar cierre de sesión, el sistema actualiza `logged_out_at` en la tabla `usuario`, invalidando todos los tokens JWT emitidos antes de esa marca temporal.
- **RN-USR-003 (Modificación con ticket):** Para modificar credenciales sensibles de un usuario (email, documento), el Admin General debe asociar un ticket de soporte resuelto como trazabilidad de la solicitud.
- **RN-USR-004 (Directivos vinculados a colegio):** Un directivo siempre está asociado a un `id_colegio`. La desvinculación no elimina al usuario sino que lo marca como inactivo en la tabla `directivo`.
- **RN-USR-005 (Cargos de directivos):** Los directivos tienen cargos típicos como `RECTOR` o `COORDINADOR` que determinan sus permisos dentro del colegio.
- **RN-USR-006 (Creación directa sin Matrícula):** El Admin General puede crear usuarios de rol `directivo`, `docente`, `padre` y `admin_general` directamente. El rol `estudiante` está excluido — solo puede crearse vía Matrícula Institucional.
- **RN-USR-007 (Cambio de email con código de verificación):** El correo electrónico solo puede modificarse completando un flujo de verificación por código enviado al nuevo correo. Ver tabla `email_change_tokens`.
- **RN-USR-008 (Email nullable para estudiantes):** El campo `email` en `usuario` es `NULL`able. Estudiantes sin correo almacenan `NULL`. El índice `UNIQUE` sigue activo (en PostgreSQL `NULL ≠ NULL`).

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller** | [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — Usuarios: `listarUsuarios`, `detalleUsuario`, `cambiarEstadoUsuario`, `restablecerPassword`, `forzarCierreSesion`, `eliminarUsuario`, `validarTicketParaUsuario`, `modificarCredencialesConTicket`. Directivos: `listarDirectivos`, `registrarDirectivo`, `actualizarDirectivo`, `desvincularDirectivo`, `eliminarDirectivo`. Config: `obtenerConfiguracion`, `actualizarConfiguracion` |
| **Routes** | [adminGeneral.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/adminGeneral.routes.ts) |
| **Middleware** | [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) — `requireAdminGeneral` |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vista Usuarios** | [UsuariosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/UsuariosList.vue) |
| **Vista Configuración** | [ConfiguracionPanel.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ConfiguracionPanel.vue) |
| **Vista Dashboard Admin** | [AdminGeneralDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/AdminGeneralDashboard.vue) |

---

## 6. Modelo de Datos

### Tabla: `usuario`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_usuario` | SERIAL PK | Identificador único |
| `email` | VARCHAR / NULL | Correo electrónico. **NULL permitido para estudiantes.** Obligatorio para otros roles. |
| `password` | VARCHAR | Hash bcrypt |
| `nombre` | VARCHAR | Nombre del usuario |
| `apellido` | VARCHAR | Apellido del usuario |
| `documento` | VARCHAR | Número de documento de identidad |
| `tipo_documento` | `tipo_documento_identidad` | `TI`, `CC`, `CE`, `RC`, `PAS` |
| `rol` | VARCHAR | Rol principal |
| `estado` | `estado_usuario_sistema` | `ACTIVO`, `SUSPENDIDO`, `BANEADO`, `ELIMINADO` |
| `id_colegio` | INT FK | Colegio asociado |
| `logged_out_at` | TIMESTAMPTZ | Marca de invalidación global de tokens |

### Tabla: `directivo`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | Identificador único |
| `id_usuario` | INT FK | FK al usuario del directivo |
| `id_colegio` | INT FK | Colegio al que está vinculado |
| `cargo` | VARCHAR | `RECTOR`, `COORDINADOR` |
| `estado` | VARCHAR | `ACTIVO`, `INACTIVO` |

### Types relevantes

```sql
CREATE TYPE public.estado_usuario_sistema AS ENUM ('ACTIVO', 'SUSPENDIDO', 'BANEADO', 'ELIMINADO');
CREATE TYPE public.tipo_documento_identidad AS ENUM ('TI', 'CC', 'CE', 'RC', 'PAS');
```

---

## 7. Conexiones con Otros Módulos

- **→ Autenticación**: Los estados de usuario afectan directamente la capacidad de login.
- **→ Supervisión**: Los directivos son quienes aprueban/revocan supervisiones del Admin General.
- **→ Colegios**: Los directivos se vinculan a un colegio específico.
- **→ Tickets**: La modificación de credenciales requiere un ticket de soporte como evidencia.

---

## 8. Validaciones Implementadas

### Backend
- Verificación de existencia del usuario antes de cualquier operación.
- Validación de que el Admin General no pueda eliminarse a sí mismo.
- Verificación de ticket resuelto antes de modificar credenciales.
- Al forzar cierre de sesión: actualiza `logged_out_at` para invalidar tokens globalmente.

### Frontend
- Confirmación visual antes de acciones destructivas (eliminar, suspender, banear).
- Filtros de búsqueda por rol, estado y colegio en la lista de usuarios.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Tabla `directivo` separada de `usuario`** | Permite vincular/desvincular directivos sin eliminar la cuenta de usuario subyacente |
| **Credenciales con ticket** | Garantiza trazabilidad legal: toda modificación de datos sensibles tiene un ticket de soporte como evidencia auditora |
| **`logged_out_at` en tabla usuario** | Alternativa eficiente a borrar todos los tokens: un solo UPDATE invalida cualquier token emitido antes de esa fecha |
| **Estudiantes NO creados por Admin General** | Los estudiantes requieren asignación a grado, grupo, año académico y vinculación con padre — todo esto lo gestiona la Matrícula Institucional. Crear estudiantes directamente omitiría estas validaciones críticas |
| **`email` nullable en `usuario`** | Estudiantes menores de edad o sin acceso a correo pueden existir en el sistema sin email ficticio. PostgreSQL permite múltiples `NULL` en columnas `UNIQUE`, manteniendo la integridad de datos |
| **Verificación por código para cambio de email** | Previene el secuestro de cuenta mediante cambio de correo por un atacante con sesión abierta. Asegura que el nuevo correo es accesible por el dueño real |
