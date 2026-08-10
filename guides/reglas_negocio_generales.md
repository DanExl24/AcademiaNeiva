# Reglas de Negocio Generales — AcademiaNeiva

Este documento centraliza las **reglas de negocio transversales** del sistema AcademiaNeiva: invariantes, restricciones, políticas y comportamientos que deben cumplirse a nivel global, independientemente del módulo desde el que sean ejecutados.

Las reglas aquí documentadas fueron construidas a partir de evidencia existente en:

- Esquema de base de datos PostgreSQL ([AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql))
- Código fuente backend (Controllers, Services, Middleware, DTOs)
- Código fuente frontend (Stores, Guards, Views)
- Documentación técnica de los 17 módulos del sistema
- Triggers y funciones almacenadas de PostgreSQL
- Constraints y restricciones UNIQUE

Las reglas específicas de cada módulo se encuentran en sus respectivos directorios bajo `guides/modules/XX_nombre_modulo/reglas_negocio.md` y **no** se duplican íntegramente aquí. Este documento recoge únicamente las reglas que afectan a **múltiples módulos** o representan **condiciones estructurales globales**.

---

# 1. Arquitectura Institucional (Multi-Tenant)

---

## RN-GEN-001

### Nombre
Arquitectura Multi-Institucional (Multi-Tenant)

### Descripción
AcademiaNeiva opera como una plataforma multi-tenant donde múltiples instituciones educativas (colegios) coexisten en una única base de datos PostgreSQL compartida. Cada colegio se identifica mediante un `id_colegio` que actúa como discriminador de inquilino en la mayoría de las entidades del sistema.

### Motivo
El modelo multi-tenant permite escalar la plataforma a N colegios sin replicar infraestructura, manteniendo el aislamiento lógico de los datos de cada institución.

### Alcance
Todas las entidades del sistema que posean la columna `id_colegio`.

### Evidencia
- Tabla `colegio` como entidad raíz: [AcademiaNeivaBD.sql L878-L895](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L878-L895)
- Columna `id_colegio` presente en: `usuario`, `estudiante`, `docente`, `directivo`, `padre_familia`, `matricula`, `anio_lectivo`, `periodo_academico`, `grupos`, `grados`, `jornada`, `materias`, `competencias`, `actividad_materia`, `notas_actividad`, `nota_criterio`, `criterio_evaluacion`, `registro_asistencia`, `observacion_estudiante`, `cierre_materia`, `detalle_grados`, `escala_valoracion`, `configuracion_colegio`, `configuracion_sistema`, `configuracion_inscripcion`, `contrato_docente`, `documento_matriculas`, `tickets_soporte`, `auditoria_supervision`, `notificacion_colegio`, `nivel_escolar`, `detalle_padrefamilia`, `desempeno`, `papelera_materias`, `evidencia_aprendizaje`

### Implementación
La clave foránea `id_colegio REFERENCES colegio(id_colegio)` está definida en cada tabla relevante a nivel de PostgreSQL. Las consultas del backend filtran explícitamente por `id_colegio` obtenido del token JWT del usuario autenticado (`req.user.schoolId`).

### Excepciones
Las siguientes entidades son **globales** (no pertenecen a un colegio específico):
- `rol` — Catálogo global de roles
- `secciones` — Catálogo global de secciones (A, B, C...)
- `tipo_documento` — Catálogo global de tipos de documento
- `tipo_sancion` — Catálogo global de tipos de sanción
- `dba` / `evidencias_dba` — Catálogo nacional de DBA del MEN
- `dimensiones_preescolar` — Catálogo global de dimensiones
- `configuracion_base` — Configuraciones base de la plataforma
- `configuracion_plataforma` — Configuraciones de plataforma global
- `token_blacklist` — Lista negra de tokens global
- `password_reset_tokens` / `email_change_tokens` — Tokens de seguridad global

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
Todas las entidades con columna `id_colegio`.

### Endpoints relacionados
Todos los endpoints protegidos.

### Archivos relacionados
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) — Extrae `schoolId` del JWT (L79)
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Schema completo

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

## RN-GEN-002

### Nombre
Aislamiento de Datos entre Instituciones

### Descripción
Los registros pertenecientes a una institución no deben ser accesibles, consultables ni modificables desde el contexto de otra institución. Cada operación de lectura o escritura en el backend valida que el `id_colegio` del recurso solicitado coincida con el `id_colegio` del usuario autenticado (obtenido del token JWT).

### Motivo
Garantiza la confidencialidad, privacidad y soberanía de los datos académicos de cada plantel escolar en un entorno compartido.

### Alcance
Todas las operaciones CRUD sobre entidades institucionales.

### Evidencia
- [authMiddleware.ts L79](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts#L79) — `schoolId: decoded.schoolId || null`
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — Filtros por `id_colegio` en todas las consultas
- [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) — Validación de `colegioId`
- Regla documentada en Módulo Matrículas: RN-MAT-007

### Implementación
1. **Token JWT**: El `schoolId` del usuario se incluye en el payload del token al momento del login.
2. **Middleware**: `verifyToken` extrae y asigna `req.user.schoolId`.
3. **Controllers**: Todas las consultas SQL incluyen `WHERE id_colegio = $schoolId`.
4. **Foreign Keys**: Las FK sobre `id_colegio` garantizan integridad referencial a nivel de BD.

### Excepciones
- El **Administrador General** (`admin_general`) no tiene `schoolId` fijo. Durante una supervisión activa, hereda temporalmente el `id_colegio` del colegio supervisado.
- Las entidades del catálogo global (DBA, roles, secciones, tipos de documento) son compartidas.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
Todas las entidades institucionales.

### Endpoints relacionados
Todos los endpoints protegidos.

### Archivos relacionados
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts)
- Todos los controllers del backend

### Historias de usuario relacionadas
Regla transversal sin HU específica. Referenciada en RN-MAT-007.

---

## RN-GEN-003

### Nombre
Estado del Colegio como Puerta de Acceso Global

### Descripción
El estado de un colegio (`estado_colegio`) determina si sus usuarios pueden operar en la plataforma. Solo los colegios en estado `ACTIVO` permiten el acceso de sus usuarios. Los estados `PENDIENTE`, `SUSPENDIDO`, `RECHAZADO` y `ELIMINADO` bloquean el login de todos los usuarios asociados al colegio.

### Motivo
Permite al Administrador General controlar el acceso institucional completo mediante un único campo, sin necesidad de desactivar usuarios individualmente.

### Alcance
Entidades: `colegio`, `usuario`. Proceso: Login de todos los roles institucionales.

### Evidencia
- ENUM `estado_colegio`: `PENDIENTE`, `ACTIVO`, `SUSPENDIDO`, `RECHAZADO`, `ELIMINADO` — [AcademiaNeivaBD.sql L82-L88](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L82-L88)
- [authController.ts L55-L74](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts#L55-L74) — Verificación del estado del colegio durante login

### Implementación
En la función `login` del controlador de autenticación, después de verificar las credenciales del usuario y antes de emitir el JWT, se consulta el estado del colegio asociado:
- `PENDIENTE` → HTTP 403: "El colegio asociado aún no ha sido aprobado."
- `SUSPENDIDO` → HTTP 403: "El colegio asociado se encuentra suspendido."
- `RECHAZADO` / `ELIMINADO` → HTTP 403: "El colegio asociado no tiene acceso al sistema."

### Excepciones
- Los usuarios `admin_general` no tienen `id_colegio`, por lo que esta validación no les aplica.

### Módulos afectados
Autenticación y Sesiones, Gestión de Colegios.

### Entidades afectadas
`colegio`, `usuario`.

### Endpoints relacionados
- `POST /api/auth/login`
- `POST /api/auth/student-login`

### Archivos relacionados
- [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts)
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — `cambiarEstadoColegio`

### Historias de usuario relacionadas
HU-COL-004. Referenciada en RN-COL-001.

---

# 2. Usuarios e Identidad

---

## RN-GEN-004

### Nombre
Identidad Centralizada en la Tabla `usuario`

### Descripción
Todo actor del sistema (directivo, docente, estudiante, padre de familia, administrador general) posee obligatoriamente un registro en la tabla central `usuario`. Las tablas de rol (`docente`, `estudiante`, `padre_familia`, `directivo`) almacenan exclusivamente metadatos específicos del rol académico y mantienen una referencia FK al `id_usuario` correspondiente.

### Motivo
Centraliza la autenticación, autorización, auditoría y gestión de credenciales en una única entidad, evitando duplicar lógica de contraseñas, estados y tokens en múltiples tablas.

### Alcance
Todas las entidades de actores del sistema.

### Evidencia
- Tabla `usuario` con columnas `email`, `password`, `nombre`, `apellido`, `id_colegio`, `estado`, `documento`: [AcademiaNeivaBD.sql L2729-L2747](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2729-L2747)
- FK en `docente.id_usuario` → `usuario.id_usuario` con UNIQUE: [L3461-L3462](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3461-L3462)
- FK en `estudiante.id_usuario` → `usuario.id_usuario` con UNIQUE: [L3501-L3502](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3501-L3502)
- FK en `padre_familia.id_usuario` → `usuario.id_usuario` con UNIQUE: [L3637-L3638](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3637-L3638)
- FK en `directivo.id_usuario` → `usuario.id_usuario` con UNIQUE: [L3445-L3446](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3445-L3446)

### Implementación
Cada tabla de rol tiene una restricción `UNIQUE` sobre `id_usuario`, garantizando que un usuario solo puede tener un registro de ese rol:
```sql
ALTER TABLE ONLY public.docente ADD CONSTRAINT docente_id_usuario_key UNIQUE (id_usuario);
ALTER TABLE ONLY public.estudiante ADD CONSTRAINT estudiante_id_usuario_key UNIQUE (id_usuario);
ALTER TABLE ONLY public.padre_familia ADD CONSTRAINT padre_familia_id_usuario_key UNIQUE (id_usuario);
ALTER TABLE ONLY public.directivo ADD CONSTRAINT directivo_id_usuario_key UNIQUE (id_usuario);
```

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
`usuario`, `docente`, `estudiante`, `padre_familia`, `directivo`.

### Endpoints relacionados
Todos los endpoints de creación de usuarios.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [modulo_global/README.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/modulo_global/README.md)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

## RN-GEN-005

### Nombre
Unicidad Global del Correo Electrónico

### Descripción
La dirección de correo electrónico de un usuario es única a nivel de toda la plataforma. No pueden existir dos registros en la tabla `usuario` con el mismo valor en la columna `email`.

### Motivo
El email es el identificador de login para todos los roles no-estudiantiles (directivos, docentes, padres, administradores generales). La unicidad previene conflictos de autenticación y suplantación de identidad.

### Alcance
Tabla `usuario`, proceso de login y registro de todos los roles.

### Evidencia
- Constraint UNIQUE: `ALTER TABLE ONLY public.usuario ADD CONSTRAINT usuario_email_key UNIQUE (email)` — [AcademiaNeivaBD.sql L3869-L3870](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3869-L3870)
- Índice: `CREATE INDEX idx_usuario_email ON public.usuario USING btree (email)` — [L4208](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4208)

### Implementación
La unicidad se garantiza a nivel de base de datos mediante la restricción `UNIQUE` en la columna `email`. Adicionalmente, los controllers de creación de usuarios (`registrarDirectivo`, `createTeacher`, `crearUsuarioByAdminGeneral`) validan la existencia previa del email antes de insertar.

### Excepciones
La columna `email` permite valores `NULL` (documentado en RN-DIR-008). Esto aplica exclusivamente a estudiantes que no poseen correo propio. En PostgreSQL, múltiples valores `NULL` no violan la restricción `UNIQUE`.

### Módulos afectados
Autenticación y Sesiones, Usuarios y Directivos, Docentes, Matrículas, Gestión de Padres.

### Entidades afectadas
`usuario`.

### Endpoints relacionados
- `POST /api/auth/login`
- `POST /api/admin/directivos`
- `POST /api/academic-admin/teachers`
- `POST /api/admin/usuarios`

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts)
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts)
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts)

### Historias de usuario relacionadas
HU-AUT-001, HU-DIR-002, HU-DOC-001.

---

## RN-GEN-006

### Nombre
Unicidad Global del Número de Documento de Identidad

### Descripción
Un número de documento de identidad es único en toda la plataforma, independientemente del colegio o rol. Si un usuario ya existe con ese documento, el sistema rechaza la creación con HTTP 409 (Conflict).

### Motivo
Evita la duplicidad de identidades en la base de datos y protege contra la suplantación de identidad del personal escolar y alumnado entre instituciones.

### Alcance
Tabla `usuario`, todas las operaciones de creación y actualización de usuarios.

### Evidencia
- Índice sobre `documento`: `CREATE INDEX idx_usuario_documento ON public.usuario USING btree (documento)` — [AcademiaNeivaBD.sql L4201](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4201)
- Constraint CHECK: `CHECK (documento IS NULL OR documento ~ '^[a-zA-Z0-9]+$')` — [L2746](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2746)
- [reglas_documentos.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/modulo_global/reglas_documentos.md) — Documentación de unicidad absoluta

### Implementación
1. **Backend**: Las funciones `validateDocumentUniqueness` y `normalizeDocument` verifican la unicidad a nivel global consultando `SELECT ... FROM usuario WHERE documento = $1`.
2. **Frontend**: Validación en tiempo real con máscaras dinámicas según el tipo de documento.
3. **DTO (Zod)**: Validación de formatos y expresiones regulares.
4. **Base de datos**: Constraint `CHECK` en la columna `documento`.

> **Nota importante**: No existe una restricción `UNIQUE` sobre la columna `documento` a nivel de base de datos. La unicidad se implementa **exclusivamente en la capa de aplicación** (backend). El índice `idx_usuario_documento` es un índice de rendimiento, no de unicidad.

### Excepciones
La columna `documento` permite valores `NULL` para usuarios que aún no tienen documento registrado.

### Módulos afectados
Autenticación, Usuarios y Directivos, Docentes, Matrículas, Gestión de Padres.

### Entidades afectadas
`usuario`.

### Endpoints relacionados
- `POST /api/admin/directivos`
- `POST /api/academic-admin/teachers`
- `POST /api/admin/usuarios`
- `POST /api/matriculas/submit`

### Archivos relacionados
- [reglas_documentos.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/modulo_global/reglas_documentos.md)
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `createTeacher`
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — `registrarDirectivo`, `crearUsuarioByAdminGeneral`

### Historias de usuario relacionadas
HU-DOC-001, HU-DIR-002, HU-DIR-006.

---

## RN-GEN-007

### Nombre
Un Usuario Pertenece a una Única Institución

### Descripción
En la implementación actual, un usuario se asocia a un único colegio mediante la columna `usuario.id_colegio`. Esta relación determina el contexto institucional del usuario en toda su operación dentro de la plataforma.

### Motivo
Simplifica el modelo de aislamiento multi-tenant al asignar un contexto institucional fijo a cada usuario, que se propaga al JWT y a todas las consultas.

### Alcance
Tabla `usuario`, modelo de autenticación y autorización.

### Evidencia
- Columna `id_colegio` en tabla `usuario`: [AcademiaNeivaBD.sql L2735](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2735)
- FK: `usuario_id_colegio_fkey FOREIGN KEY (id_colegio) REFERENCES colegio(id_colegio)` — [L5130-L5131](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L5130-L5131)
- JWT payload: `schoolId: decoded.schoolId || null` — [authMiddleware.ts L79](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts#L79)

### Implementación
El `id_colegio` del usuario se incluye en el JWT al momento del login. El middleware `verifyToken` lo extrae como `req.user.schoolId` y todas las queries lo usan como filtro.

### Excepciones
- **Administrador General** (`admin_general`): Puede tener `id_colegio = NULL` ya que opera a nivel de plataforma. Durante supervisión, hereda temporalmente el `id_colegio` del colegio supervisado.
- **Padres de Familia** (`padre`): Aunque tienen `usuario.id_colegio`, también pueden tener hijos en múltiples colegios a través de la tabla `detalle_padrefamilia`. El JWT incluye un array `schoolIds` para padres (ver [authController.ts L84-L98](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts#L84-L98)).

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
`usuario`.

### Endpoints relacionados
- `POST /api/auth/login`
- Todos los endpoints protegidos.

### Archivos relacionados
- [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts)
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts)

### Historias de usuario relacionadas
HU-DIR-004. Referenciada en RN-DIR-004.

---

# 3. Roles y Autorización

---

## RN-GEN-008

### Nombre
Modelo de Roles mediante Tabla Pivote

### Descripción
Los roles del sistema se asignan a los usuarios mediante la tabla pivote `usuario_rol` que relaciona `id_usuario` con `id_rol`. Un usuario puede tener uno o más roles simultáneamente. La tabla `rol` contiene el catálogo global de roles con restricción `UNIQUE` sobre el nombre.

### Motivo
Permite flexibilidad en la asignación de roles sin duplicar registros de usuario, soportando escenarios donde un actor puede cumplir múltiples funciones (ej: un docente que también es padre de familia).

### Alcance
Sistema completo de autenticación y autorización.

### Evidencia
- Tabla `rol` con `UNIQUE (nombre)`: [AcademiaNeivaBD.sql L2431-L2434](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2431-L2434), [L3717-L3718](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3717-L3718)
- Tabla pivote `usuario_rol` con PK compuesta `(id_usuario, id_rol)`: [AcademiaNeivaBD.sql L2778-L2781](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2778-L2781), [L3885-L3886](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3885-L3886)
- FK con CASCADE: `usuario_rol_id_usuario_fkey` y `usuario_rol_id_rol_fkey` — [L5146-L5155](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L5146-L5155)
- Login extrae roles: `array_agg(r.nombre) as roles` — [authController.ts L24](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts#L24)

### Implementación
- PK compuesta `(id_usuario, id_rol)` impide duplicados de asignación.
- FK con `ON DELETE CASCADE` garantiza la limpieza automática al eliminar un usuario o rol.
- El JWT incluye el array de roles: `roles: decoded.roles || [decoded.role]` — [authMiddleware.ts L78](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts#L78)

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Autenticación y Sesiones, Usuarios y Directivos.

### Entidades afectadas
`usuario`, `rol`, `usuario_rol`.

### Endpoints relacionados
Todos los endpoints protegidos.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts)
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

## RN-GEN-009

### Nombre
Jerarquía de Permisos por Rol

### Descripción
El acceso a los endpoints del sistema está regulado por middlewares de autorización que verifican los roles del usuario. La jerarquía implementada es:

| Middleware | Roles permitidos |
|:--|:--|
| `requireAdminGeneral` | `admin_general` |
| `requireDirectivo` | `directivo`, `rector`, `admin_general` |
| `requireDocente` | `docente`, `admin_general` |
| `requirePadre` | `padre`, `admin_general` |
| `requireEstudiante` | `estudiante`, `admin_general` |

El rol `admin_general` tiene acceso a **todos** los niveles de autorización, actuando como superusuario.

### Motivo
Garantiza que cada actor del sistema solo pueda ejecutar operaciones compatibles con su rol institucional, implementando el principio de mínimo privilegio.

### Alcance
Todos los endpoints protegidos del sistema.

### Evidencia
- Middlewares: [authMiddleware.ts L267-L355](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts#L267-L355)
- Aplicación en rutas: todos los archivos en `backend/src/routes/`

### Implementación
Cada middleware verifica `req.user.roles.includes('nombre_rol')`. Si el rol no coincide, se retorna HTTP 403 con un mensaje descriptivo.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
`usuario`, `usuario_rol`, `rol`.

### Endpoints relacionados
Todos los endpoints protegidos.

### Archivos relacionados
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts)
- Todos los archivos en `backend/src/routes/`

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

## RN-GEN-010

### Nombre
Verificación de Estado Activo del Usuario en Cada Petición

### Descripción
El middleware `verifyToken` consulta la base de datos en **cada petición autenticada** para verificar que el estado del usuario sea `ACTIVO`. Los usuarios con estado `SUSPENDIDO`, `BANEADO` o `ELIMINADO` son rechazados inmediatamente con HTTP 401.

### Motivo
Evita que usuarios inhabilitados continúen operando con tokens JWT que aún no han expirado de forma natural.

### Alcance
Todos los endpoints protegidos.

### Evidencia
- ENUM `estado_usuario_sistema`: `ACTIVO`, `SUSPENDIDO`, `BANEADO`, `ELIMINADO` — [AcademiaNeivaBD.sql L240-L245](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L240-L245)
- [authMiddleware.ts L60-L63](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts#L60-L63) — `if (dbUser.estado !== 'ACTIVO')`

### Implementación
```typescript
if (dbUser.estado !== 'ACTIVO') {
  res.status(401).json({ error: 'Tu cuenta se encuentra inactiva o suspendida.' });
  return;
}
```
Se ejecuta en cada petición, no se cachea.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
`usuario`.

### Endpoints relacionados
Todos los endpoints protegidos.

### Archivos relacionados
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts)

### Historias de usuario relacionadas
HU-AUT-001, HU-AUT-002. Referenciada en RN-AUT-002.

---

## RN-GEN-011

### Nombre
El Rol `estudiante` Solo se Crea a Través de Matrícula

### Descripción
Los usuarios con rol `estudiante` solo pueden ingresar al sistema a través del proceso oficial de Matrícula Institucional. La creación directa de usuarios con rol `estudiante` está explícitamente excluida de la función `crearUsuarioByAdminGeneral`.

### Motivo
Los estudiantes requieren asignación a grado, grupo, año académico y vinculación con padre de familia, lo cual solo se garantiza mediante el flujo completo de matrícula.

### Alcance
Creación de usuarios de rol `estudiante`.

### Evidencia
- Regla documentada en RN-DIR-006 del módulo Usuarios y Directivos
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — `crearUsuarioByAdminGeneral` excluye `estudiante`
- [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) — `finalizeEnrollment` crea estudiante + usuario

### Implementación
La creación directa solo admite roles: `directivo`, `docente`, `padre`, `admin_general`. La creación de estudiantes se realiza exclusivamente mediante `finalizeEnrollment` en el servicio de matrículas.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Usuarios y Directivos, Matrículas.

### Entidades afectadas
`usuario`, `usuario_rol`, `estudiante`, `matricula`.

### Endpoints relacionados
- `POST /api/admin/usuarios` — Excluye `estudiante`
- `POST /api/matriculas/finalize/:id` — Crea estudiante

### Archivos relacionados
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts)
- [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts)

### Historias de usuario relacionadas
HU-DIR-006, HU-MAT-006.

---

# 4. Año Lectivo y Periodos Académicos

---

## RN-GEN-012

### Nombre
Año Lectivo como Eje Temporal del Sistema

### Descripción
El año lectivo (`anio_lectivo`) es la entidad temporal raíz que articula todas las operaciones académicas del colegio. Cada matrícula, periodo académico, competencia, asignación docente y registro académico debe estar vinculado a un año lectivo del colegio correspondiente.

### Motivo
Define el contexto temporal para todas las operaciones académicas y permite el aislamiento histórico entre ciclos escolares.

### Alcance
Todas las entidades académicas del sistema.

### Evidencia
- Tabla `anio_lectivo` con FK a `colegio`: [AcademiaNeivaBD.sql L720-L729](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L720-L729)
- Columna `id_anio` en: `matricula`, `periodo_academico`, `competencias`, `detalle_grados`, `configuracion_inscripcion`, `registro_graduados`
- FK: `año_lectivo_id_colegio_fkey`, `fk_matricula_anio`, `periodo_academico_id_año_fkey`, etc.

### Implementación
FK con `ON DELETE RESTRICT` en matrícula impide la eliminación de un año lectivo con matrículas activas. FK con `ON DELETE CASCADE` en `anio_lectivo.id_colegio` propaga la eliminación del colegio.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Configuración Académica, Matrículas, Calificaciones, Docentes, Cierre y Boletines, Dashboard.

### Entidades afectadas
`anio_lectivo`, `matricula`, `periodo_academico`, `competencias`, `detalle_grados`, `configuracion_inscripcion`, `registro_graduados`.

### Endpoints relacionados
- `POST /api/academic-admin/settings/years`
- `PATCH /api/academic-admin/settings/years/:id/status`
- Todos los endpoints que filtran por año lectivo.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts)

### Historias de usuario relacionadas
HU-CON-007. Referenciada en RN-CONF-006, RN-CONF-007, RN-CONF-008.

---

## RN-GEN-013

### Nombre
Exclusividad de Año Lectivo Activo por Colegio

### Descripción
Solo puede existir un año lectivo en estado `ABIERTO` por colegio en cualquier momento. Al abrir un nuevo año, cualquier otro año activo del mismo colegio transiciona automáticamente a `CERRADO`.

### Motivo
Garantiza que todas las operaciones del colegio (matrículas, evaluaciones, asistencias) se concentren en un único marco lectivo de referencia.

### Alcance
Tabla `anio_lectivo`, operaciones de creación y cambio de estado.

### Evidencia
- ENUM `estado_periodo` (reutilizado para `anio_lectivo.estado`): `ABIERTO`, `CERRADO`, `PENDIENTE` — [AcademiaNeivaBD.sql L157-L161](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L157-L161)
- Regla documentada en RN-CONF-006

### Implementación
Implementada en la capa de aplicación mediante `createAcademicYear` y `updateAcademicYearStatus` en el `academicAdminController.ts`, que cierra años previos antes de abrir el nuevo.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Configuración Académica, Matrículas, Calificaciones, Dashboard.

### Entidades afectadas
`anio_lectivo`.

### Endpoints relacionados
- `POST /api/academic-admin/settings/years`
- `PATCH /api/academic-admin/settings/years/:id/status`

### Archivos relacionados
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts)

### Historias de usuario relacionadas
HU-CON-007.

---

# 5. Matrícula

---

## RN-GEN-014

### Nombre
Unicidad de Matrícula Activa por Estudiante, Año y Colegio

### Descripción
Un estudiante no puede tener más de una matrícula activa (es decir, no cancelada ni rechazada) para el mismo año lectivo en el mismo colegio. Esta regla se aplica mediante un índice UNIQUE parcial en la base de datos.

### Motivo
Previene la duplicación de registros de matrícula que generaría inconsistencias en listas de clase, boletines y conteo de cupos.

### Alcance
Tabla `matricula`, proceso de inscripción y aprobación.

### Evidencia
Índice UNIQUE parcial:
```sql
CREATE UNIQUE INDEX idx_matricula_estudiante_anio_colegio_activo
ON public.matricula USING btree (id_estudiante, id_anio, id_colegio)
WHERE (estado <> ALL (ARRAY['CANCELADA'::estado_matricula, 'RECHAZADA'::estado_matricula]));
```
[AcademiaNeivaBD.sql L4082](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4082)

### Implementación
La unicidad se garantiza en **dos capas**:
1. **Base de datos**: Índice UNIQUE parcial que excluye matrículas con estado `CANCELADA` o `RECHAZADA`. Cualquier intento de insertar un duplicado genera error PostgreSQL.
2. **Servicio**: El `matriculaService.ts` realiza consultas previas para verificar la existencia de matrículas activas antes de crear nuevas.

### Excepciones
Las matrículas con estado `CANCELADA` o `RECHAZADA` no participan en la restricción de unicidad, permitiendo que un estudiante con matrícula cancelada pueda reinscribirse en el mismo año.

### Módulos afectados
Matrículas e Inscripciones, Estudiantes y Estados.

### Entidades afectadas
`matricula`, `estudiante`, `anio_lectivo`.

### Endpoints relacionados
- `POST /api/matriculas/submit`
- `POST /api/matriculas/finalize/:id`
- `POST /api/reingreso/send-parent-link`

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts)

### Historias de usuario relacionadas
HU-MAT-001, HU-MAT-006, HU-MAT-008.

---

# 6. Integridad Académica

---

## RN-GEN-015

### Nombre
Cadena de Integridad Académica: Colegio → Año → Grupo → Materia → Docente → Periodo → Actividad → Nota

### Descripción
La estructura académica del sistema mantiene una cadena de dependencias que debe respetarse en todo momento:

```
colegio
  └── anio_lectivo
       ├── periodo_academico
       └── grupos
            └── detalle_grados (materia × docente × grupo × año)
                 ├── actividad_materia (× periodo)
                 │    ├── notas_actividad (× estudiante)
                 │    ├── criterio_evaluacion
                 │    │    └── nota_criterio (× estudiante)
                 │    └── desempeno
                 ├── cierre_materia (× periodo)
                 ├── resultado_academico (× estudiante × periodo)
                 ├── observacion_estudiante (× estudiante × periodo)
                 └── registro_asistencia (× estudiante)
```

### Motivo
Mantiene la trazabilidad completa desde la nota de un estudiante hasta la institución educativa, pasando por el docente evaluador, la materia, el grupo y el periodo.

### Alcance
Todas las entidades académicas.

### Evidencia
- FK en `detalle_grados`: `id_materia`, `id_docente`, `id_colegio`, `id_grupo`, `id_anio` — [L1311-L1318](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L1311-L1318)
- FK en `actividad_materia`: `id_detallegrado`, `id_periodo`, `id_colegio` — [L676-L689](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L676-L689)
- FK en `notas_actividad`: `id_actividadmateria`, `id_estudiante`, `id_colegio` — [L2011-L2018](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2011-L2018)
- FK en `resultado_academico`: `id_estudiante`, `id_detallegrado`, `id_periodo`, `id_docente` — [L2390-L2400](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2390-L2400)

### Implementación
Garantizada a nivel de base de datos mediante foreign keys entre todas las tablas de la cadena. La entidad central `detalle_grados` vincula docente, materia, grupo y año lectivo.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Estructura Escolar, Docentes, Calificaciones, Asistencia, Observaciones, Cierre y Boletines.

### Entidades afectadas
`detalle_grados`, `actividad_materia`, `notas_actividad`, `criterio_evaluacion`, `nota_criterio`, `resultado_academico`, `observacion_estudiante`, `registro_asistencia`, `cierre_materia`, `desempeno`.

### Endpoints relacionados
Todos los endpoints de calificaciones, asistencia, observaciones y cierre.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts)
- [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts)
- [observationController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/observationController.ts)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

## RN-GEN-016

### Nombre
Unicidad de Nota por Actividad y Estudiante

### Descripción
Un estudiante solo puede tener una única nota registrada por cada actividad evaluativa. Esta restricción aplica tanto a `notas_actividad` (nivel actividad) como a `nota_criterio` (nivel criterio).

### Motivo
Previene la duplicación de calificaciones que generaría promedios incorrectos en boletines.

### Alcance
Tablas `notas_actividad` y `nota_criterio`.

### Evidencia
- UNIQUE en `notas_actividad`: `unique_actividad_estudiante UNIQUE (id_actividadmateria, id_estudiante)` — [AcademiaNeivaBD.sql L3821-L3822](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3821-L3822)
- UNIQUE en `nota_criterio`: `nota_criterio_id_criterio_id_estudiante_key UNIQUE (id_criterio, id_estudiante)` — [L3589-L3590](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3589-L3590)

### Implementación
Garantizada a nivel de base de datos mediante restricciones `UNIQUE`.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Calificaciones.

### Entidades afectadas
`notas_actividad`, `nota_criterio`.

### Endpoints relacionados
- `POST /api/teacher/grades`

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

# 7. Estados y Transiciones

---

## RN-GEN-017

### Nombre
Catálogo de Estados del Sistema (ENUMs de PostgreSQL)

### Descripción
El sistema define los siguientes enums como tipos de PostgreSQL para controlar los estados válidos de las entidades:

| ENUM | Valores | Entidad |
|:--|:--|:--|
| `estado_colegio` | PENDIENTE, ACTIVO, SUSPENDIDO, RECHAZADO, ELIMINADO | `colegio.estado` |
| `estado_usuario_sistema` | ACTIVO, SUSPENDIDO, BANEADO, ELIMINADO | `usuario.estado`, `directivo.estado` |
| `estado_matricula` | PENDIENTE, ACTIVA, CANCELADA, TRASLADADA, RECHAZADA, CORRECCION, APROBADA, CULMINADA, PENDIENTE_RENOVACION, CORREGIDA | `matricula.estado` |
| `estado_estudiante` | ACTIVO, SANCIONADO, EXPULSADO, RETIRADO, GRADUADO | `estudiante.estado` |
| `estado_periodo` | ABIERTO, CERRADO, PENDIENTE | `periodo_academico.estado`, `anio_lectivo.estado` |
| `estado_cierre_materia` | ABIERTO, CERRADO | `cierre_materia.estado` |
| `estado_resultado` | APROBADO, REPROBADO, EN_PROCESO | `resultado_academico.estado` |
| `estado_asistencia` | PRESENTE, AUSENTE, TARDE, JUSTIFICADA | `registro_asistencia.estado` |
| `estado_documento` | PENDIENTE, VALIDADO, RECHAZADO | `documento_matriculas.estado` |
| `estado_sancion` | ACTIVA, REVOCADA, VENCIDA | `sancion.estado` |
| `estado_supervision` | SOLICITADA, APROBADA, ACTIVA, FINALIZADA, REVOCADA, EXPIRADA | `auditoria_supervision.estado_supervision` |
| `estado_ticket_soporte` | ABIERTO, EN_PROCESO, RESUELTO, ESCALADO | `tickets_soporte.estado` |
| `estado_dba` | ACTIVO, INACTIVO | `dba.estado`, `evidencias_dba.estado` |
| `estado_renovacion_documento` | VIGENTE, RECOMENDADO_ACTUALIZAR, OBLIGATORIO_ACTUALIZAR, DESACTUALIZADO_POR_FECHA | `documento_matriculas.estado_renovacion` |

### Motivo
Los ENUMs de PostgreSQL garantizan a nivel de motor de base de datos que solo se almacenen valores válidos, eliminando la posibilidad de estados inconsistentes.

### Alcance
Todas las entidades con columna de estado.

### Evidencia
[AcademiaNeivaBD.sql L52-L348](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L52-L348)

### Implementación
Definidos como `CREATE TYPE public.estado_xxx AS ENUM (...)`. Cualquier intento de insertar un valor no definido genera un error de PostgreSQL.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
Todas las entidades con estado.

### Endpoints relacionados
Todos los endpoints que modifican estados.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

## RN-GEN-018

### Nombre
Sincronización Automática del Estado del Estudiante por Sanción (Trigger SQL)

### Descripción
Cuando se inserta o actualiza una sanción en la tabla `sancion`, el trigger `fn_sync_estudiante_sancion` actualiza automáticamente el estado del estudiante en la tabla `estudiante`:
- Si la sanción es de tipo `EXPULSION` y está `ACTIVA` y vigente → estado = `EXPULSADO`
- Si la sanción es de otro tipo y está `ACTIVA` y vigente → estado = `SANCIONADO`
- Si no quedan sanciones activas vigentes → estado vuelve a `ACTIVO`

### Motivo
Mantiene la coherencia automática entre el sistema disciplinario y el estado del estudiante sin depender de lógica de aplicación.

### Alcance
Tablas `sancion` y `estudiante`.

### Evidencia
- Función `fn_sync_estudiante_sancion()`: [AcademiaNeivaBD.sql L449-L484](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L449-L484)
- Trigger: `CREATE TRIGGER trg_sync_estudiante_sancion AFTER INSERT OR UPDATE ON public.sancion` — [L4299](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4299)

### Implementación
Trigger a nivel de base de datos que se ejecuta `AFTER INSERT OR UPDATE` en la tabla `sancion`.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Estudiantes y Estados, Matrículas.

### Entidades afectadas
`sancion`, `estudiante`, `tipo_sancion`.

### Endpoints relacionados
Endpoints de gestión de sanciones.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Referenciada en reglas del módulo Estudiantes y Estados.

---

# 8. Bloqueo por Periodo Cerrado y Cierre de Materia

---

## RN-GEN-019

### Nombre
Bloqueo de Escritura en Periodos Cerrados (Trigger SQL `fn_bloquear_periodo_cerrado`)

### Descripción
Cuando un periodo académico está en estado `CERRADO`, cualquier operación INSERT, UPDATE o DELETE sobre las tablas `notas_actividad`, `observacion_estudiante` y `registro_asistencia` es abortada automáticamente por un trigger de PostgreSQL.

### Motivo
Protege las calificaciones, observaciones y registros de asistencia consolidados de modificaciones accidentales o malintencionadas después del cierre oficial del periodo.

### Alcance
Tablas: `notas_actividad`, `observacion_estudiante`, `registro_asistencia`.

### Evidencia
- Función `fn_bloquear_periodo_cerrado()`: [AcademiaNeivaBD.sql L356-L440](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L356-L440)
- Triggers:
  - `trg_bloquear_notas_periodo` on `notas_actividad` — [L4229](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4229)
  - `trg_bloquear_observacion_periodo` on `observacion_estudiante` — [L4236](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4236)
  - `trg_bloquear_asistencia_periodo` on `registro_asistencia` — [L4222](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4222)

### Implementación
1. **Nivel BD (Trigger)**: `fn_bloquear_periodo_cerrado()` determina el periodo correspondiente a cada registro y verifica su estado.
2. **Nivel Backend**: `periodHelpers.ts` (`ensureCurrentPeriodOrRespond`) valida el estado del periodo antes de intentar la operación.
3. **Bypass**: El trigger permite bypass para scripts de seed mediante `current_setting('my.app.bypass_triggers', true) = 'true'`.

### Excepciones
Los scripts de seed pueden bypassear el trigger configurando `my.app.bypass_triggers = 'true'` en la sesión.

### Módulos afectados
Calificaciones, Asistencia, Observaciones, Configuración Académica.

### Entidades afectadas
`notas_actividad`, `observacion_estudiante`, `registro_asistencia`, `periodo_academico`.

### Endpoints relacionados
- `POST /api/teacher/grades`
- `POST /api/teacher/attendance`
- `POST /api/teacher/observations`

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [periodHelpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts)

### Historias de usuario relacionadas
HU-CON-002, HU-CON-004. Referenciada en RN-CONF-002.

---

## RN-GEN-020

### Nombre
Bloqueo de Escritura en Materia Cerrada (Trigger SQL `trg_check_subject_not_closed`)

### Descripción
Cuando una materia en un periodo específico tiene un registro en `cierre_materia` con estado `CERRADO`, cualquier operación INSERT, UPDATE o DELETE sobre las tablas `actividad_materia`, `notas_actividad`, `criterio_evaluacion`, `nota_criterio`, `registro_asistencia` y `observacion_estudiante` es abortada por un trigger de PostgreSQL con error `55000`.

### Motivo
Impide la modificación de datos académicos después de que un docente haya cerrado formalmente la materia para un periodo, protegiendo los resultados consolidados.

### Alcance
Tablas de datos académicos vinculados a `detalle_grados`.

### Evidencia
- Función `trg_check_subject_not_closed()`: [AcademiaNeivaBD.sql L562-L651](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L562-L651)
- Triggers:
  - `trg_prevent_closed_actividad_materia` — [L4243](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4243)
  - `trg_prevent_closed_notas_actividad` — [L4264](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4264)
  - `trg_prevent_closed_criterio_evaluacion` — [L4250](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4250)
  - `trg_prevent_closed_nota_criterio` — [L4257](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4257)
  - `trg_prevent_closed_observacion_estudiante` — [L4271](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4271)
  - `trg_prevent_closed_registro_asistencia` — [L4278](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4278)

### Implementación
Trigger `BEFORE INSERT OR DELETE OR UPDATE` en 6 tablas que verifica la existencia de un registro en `cierre_materia` con estado `CERRADO` para la misma combinación `id_detallegrado` + `id_periodo`. Soporta bypass para scripts de seed.

### Excepciones
Los scripts de seed pueden bypassear el trigger configurando `my.app.bypass_triggers = 'true'`.

### Módulos afectados
Calificaciones, Asistencia, Observaciones, Cierre y Boletines.

### Entidades afectadas
`actividad_materia`, `notas_actividad`, `criterio_evaluacion`, `nota_criterio`, `observacion_estudiante`, `registro_asistencia`, `cierre_materia`.

### Endpoints relacionados
Todos los endpoints de calificaciones, asistencia y observaciones.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Referenciada en reglas del módulo Cierre y Boletines.

---

# 9. Unicidad y Duplicidad

---

## RN-GEN-021

### Nombre
Registro Consolidado de Restricciones de Unicidad

### Descripción
Las siguientes restricciones de unicidad están implementadas a nivel de base de datos PostgreSQL y representan invariantes estructurales del sistema:

| Tabla | Constraint | Columnas | Tipo |
|:--|:--|:--|:--|
| `usuario` | `usuario_email_key` | `email` | UNIQUE |
| `usuario` | `usuario_pkey` | `id_usuario` | PK |
| `usuario_rol` | `usuario_rol_pkey` | `(id_usuario, id_rol)` | PK compuesta |
| `docente` | `docente_id_usuario_key` | `id_usuario` | UNIQUE |
| `estudiante` | `estudiante_id_usuario_key` | `id_usuario` | UNIQUE |
| `padre_familia` | `padre_familia_id_usuario_key` | `id_usuario` | UNIQUE |
| `directivo` | `directivo_id_usuario_key` | `id_usuario` | UNIQUE |
| `matricula` | `matricula_token_key` | `token_seguimiento` | UNIQUE |
| `matricula` | `idx_matricula_estudiante_anio_colegio_activo` | `(id_estudiante, id_anio, id_colegio)` WHERE estado ≠ CANCELADA/RECHAZADA | UNIQUE parcial |
| `notas_actividad` | `unique_actividad_estudiante` | `(id_actividadmateria, id_estudiante)` | UNIQUE |
| `nota_criterio` | `nota_criterio_id_criterio_id_estudiante_key` | `(id_criterio, id_estudiante)` | UNIQUE |
| `configuracion_sistema` | `unique_configuracion` | `(id_colegio, clave)` | UNIQUE |
| `configuracion_inscripcion` | `uq_colegio_anio` | `(id_colegio, id_anio)` | UNIQUE |
| `configuracion_base` | `configuracion_base_clave_key` | `clave` | UNIQUE |
| `rol` | `rol_nombre_key` | `nombre` | UNIQUE |
| `secciones` | `secciones_nombre_key` | `nombre` | UNIQUE |
| `tipo_sancion` | `tipo_sancion_nombre_key` | `nombre` | UNIQUE |
| `tipo_grado` | `uq_tipo_grado` | `(nombre, id_nivel)` | UNIQUE |
| `token_blacklist` | `token_blacklist_jti_key` | `jti` | UNIQUE |
| `password_reset_tokens` | `password_reset_tokens_token_key` | `token` | UNIQUE |
| `tickets_soporte` | `tickets_soporte_codigo_ticket_key` | `codigo_ticket` | UNIQUE |
| `dimensiones_preescolar` | `dimensiones_preescolar_nombre_key` | `nombre` | UNIQUE |
| `dba` | `uq_dba_area_grado_num_version` | `(area, grado, numero_dba, version_curricular)` | UNIQUE |
| `colegio_version_curricular` | `uq_colegio_area_grado` | `(id_colegio, area, grado)` | UNIQUE |
| `registro_graduados` | `registro_graduados_id_estudiante_key` | `id_estudiante` | UNIQUE |

### Motivo
Cada restricción previene la duplicación de datos que generaría inconsistencias funcionales en el sistema.

### Alcance
Todas las tablas listadas.

### Evidencia
[AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Sección de constraints (L3250-L3887)

### Implementación
Implementadas a nivel de PostgreSQL. Cualquier violación genera un error de tipo `23505` (unique_violation).

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
Todas las tablas listadas.

### Endpoints relacionados
Todos los endpoints de escritura.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

# 10. Integridad Referencial

---

## RN-GEN-022

### Nombre
Política de Eliminación en Cascada para Entidades Institucionales

### Descripción
Las siguientes relaciones utilizan `ON DELETE CASCADE`, propagando la eliminación del colegio a todas sus entidades dependientes:

| Tabla hijo | FK | Tabla padre |
|:--|:--|:--|
| `anio_lectivo` | `año_lectivo_id_colegio_fkey` | `colegio` |
| `nivel_escolar` | `nivel_escolar_id_colegio_fkey` | `colegio` |
| `jornada` | `jornada_id_colegio_fkey` | `colegio` |
| `materias` | `materias_id_colegio_fkey` | `colegio` |
| `docente` | `docente_id_colegio_fkey` | `colegio` |
| `estudiante` | `estudiante_id_colegio_fkey` | `colegio` |
| `padre_familia` | `padre_familia_id_colegio_fkey` | `colegio` |
| `configuracion_colegio` | `configuracion_colegio_id_colegio_fkey` | `colegio` |
| `configuracion_sistema` | `fk_configuracion_colegio` | `colegio` |
| `contrato_docente` | `contrato_docente_id_colegio_fkey` | `colegio` |
| `tickets_soporte` | `tickets_soporte_id_colegio_fkey` | `colegio` |
| `colegio_version_curricular` | `colegio_version_curricular_id_colegio_fkey` | `colegio` |
| `configuracion_inscripcion` | `configuracion_inscripcion_id_colegio_fkey` | `colegio` |
| `usuario_rol` | `usuario_rol_id_usuario_fkey` | `usuario` (CASCADE) |
| `usuario_rol` | `usuario_rol_id_rol_fkey` | `rol` (CASCADE) |

### Motivo
Permite la limpieza completa de datos de una institución eliminada sin dejar registros huérfanos.

### Alcance
Todas las entidades que referencian a `colegio`.

### Evidencia
[AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Sección de FK constraints (L4302-L5155)

### Implementación
Definidas a nivel de PostgreSQL en las sentencias `ALTER TABLE ... ADD CONSTRAINT ... ON DELETE CASCADE`.

### Excepciones
No se identificaron excepciones en la implementación actual. Sin embargo, la regla RN-COL-005 del módulo Gestión de Colegios impide la eliminación física de un colegio con registros activos a nivel de aplicación.

### Módulos afectados
Gestión de Colegios, Todos los módulos institucionales.

### Entidades afectadas
Todas las tablas con FK a `colegio`.

### Endpoints relacionados
- `DELETE /api/admin/colegios/:id`

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — `eliminarColegio`

### Historias de usuario relacionadas
Referenciada en RN-COL-005.

---

## RN-GEN-023

### Nombre
Política de Restricción de Eliminación para Entidades Críticas

### Descripción
Las siguientes relaciones utilizan `ON DELETE RESTRICT`, impidiendo la eliminación del registro padre si existen registros hijos:

| Tabla hijo | FK | Tabla padre | Política |
|:--|:--|:--|:--|
| `matricula` | `fk_matricula_anio` | `anio_lectivo` | RESTRICT |
| `matricula` | `fk_matricula_estudiante` | `estudiante` | RESTRICT |

### Motivo
Protege la integridad de los datos críticos del historial académico. Un año lectivo con matrículas activas no puede eliminarse, y un estudiante con matrículas no puede eliminarse.

### Alcance
Tablas `matricula`, `anio_lectivo`, `estudiante`.

### Evidencia
- `fk_matricula_anio FOREIGN KEY (id_anio) REFERENCES anio_lectivo(id_anio) ON UPDATE CASCADE ON DELETE RESTRICT` — [AcademiaNeivaBD.sql L4778-L4779](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4778-L4779)
- `fk_matricula_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante) ON UPDATE CASCADE ON DELETE RESTRICT` — [L4786-L4787](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4786-L4787)

### Implementación
Definidas a nivel de PostgreSQL. Cualquier intento de DELETE genera error `23503` (foreign_key_violation).

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Matrículas, Configuración Académica, Estudiantes.

### Entidades afectadas
`matricula`, `anio_lectivo`, `estudiante`.

### Endpoints relacionados
Endpoints de eliminación de años lectivos y estudiantes.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

# 11. Seguridad y Protección Global

---

## RN-GEN-024

### Nombre
Limitación de Tasa de Peticiones (Rate Limiting)

### Descripción
La API aplica tres niveles de rate limiting:

| Ruta | Máximo | Ventana | Mensaje |
|:--|:--|:--|:--|
| Global (todas las rutas) | 1000 peticiones | 15 minutos | "Demasiadas peticiones..." |
| `/api/auth/login` | 10 intentos | 15 minutos | "Demasiados intentos de inicio de sesión..." |
| `/api/auth/student-login` | 10 intentos | 15 minutos | "Demasiados intentos de inicio de sesión..." |
| `/api/matriculas/submit` | 20 solicitudes | 15 minutos | "Límite de solicitudes de matrícula alcanzado..." |

### Motivo
Protege contra ataques de fuerza bruta, denegación de servicio y abuso de la API de inscripción pública.

### Alcance
Todos los endpoints de la API.

### Evidencia
[app.ts L25-L41](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/app.ts#L25-L41)

### Implementación
Mediante `express-rate-limit` aplicado como middleware global y por ruta.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Autenticación, Matrículas, Todos los módulos.

### Entidades afectadas
N/A.

### Endpoints relacionados
Todos los endpoints.

### Archivos relacionados
- [app.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/app.ts)

### Historias de usuario relacionadas
HU-AUT-001. Referenciada en RN-AUT-007.

---

## RN-GEN-025

### Nombre
Inmutabilidad de Registros de Auditoría

### Descripción
Los registros de las tablas `auditoria_supervision` y `auditoria_acciones_realizadas` están protegidos por triggers SQL que impiden cualquier operación DELETE y bloquean UPDATE en registros de auditorías finalizadas, revocadas o expiradas.

### Motivo
Garantiza la inalterabilidad legal de las bitácoras de auditoría para cumplir con los requerimientos de entes de control.

### Alcance
Tablas `auditoria_supervision` y `auditoria_acciones_realizadas`.

### Evidencia
- Trigger `proteger_acciones_auditoria()`: [AcademiaNeivaBD.sql L493-L520](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L493-L520)
- Trigger `proteger_auditoria_finalizada()`: [AcademiaNeivaBD.sql L529-L553](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L529-L553)
- `trg_proteger_acciones` — [L4285](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4285)
- `trg_proteger_auditoria` — [L4292](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4292)

### Implementación
- `proteger_acciones_auditoria`: Bloquea DELETE siempre. Bloquea UPDATE si la auditoría padre está FINALIZADA/REVOCADA/EXPIRADA.
- `proteger_auditoria_finalizada`: Bloquea DELETE siempre (solo soft-delete). Bloquea UPDATE en estados finales excepto para cambiar el campo `eliminado` (soft-delete).

### Excepciones
El campo `eliminado` puede actualizarse para soft-delete incluso en auditorías finalizadas.

### Módulos afectados
Supervisión y Auditoría.

### Entidades afectadas
`auditoria_supervision`, `auditoria_acciones_realizadas`.

### Endpoints relacionados
N/A (capa de persistencia SQL).

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
HU-SUP-005, HU-SUP-008. Referenciada en RN-SUP-004.

---

## RN-GEN-026

### Nombre
Invalidación de Tokens JWT (Blacklist y Cierre Global)

### Descripción
El sistema implementa dos mecanismos complementarios de invalidación de tokens:
1. **Token Blacklist**: El `jti` de un token se almacena en `token_blacklist` al cerrar sesión o al ejecutar un cierre forzado.
2. **Cierre Global**: El campo `usuario.logged_out_at` marca el timestamp del último cierre forzado. Tokens emitidos antes de esa fecha son rechazados.

### Motivo
Garantiza que tokens robados, descartados o de sesiones cerradas forzosamente no puedan reutilizarse.

### Alcance
Todos los endpoints protegidos.

### Evidencia
- Tabla `token_blacklist`: [AcademiaNeivaBD.sql L2693-L2698](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2693-L2698)
- Campo `usuario.logged_out_at`: [L2742](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2742)
- Verificación en middleware: [authMiddleware.ts L36-L72](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts#L36-L72)

### Implementación
El middleware `verifyToken` ejecuta ambas verificaciones en cada petición:
1. Consulta `SELECT 1 FROM token_blacklist WHERE jti = $1`.
2. Compara `decoded.iat * 1000 < loggedOutTime`.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Autenticación y Sesiones, Usuarios y Directivos.

### Entidades afectadas
`token_blacklist`, `usuario`.

### Endpoints relacionados
Todos los endpoints protegidos.

### Archivos relacionados
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts)
- [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts)

### Historias de usuario relacionadas
HU-AUT-001, HU-AUT-006. Referenciada en RN-AUT-001, RN-AUT-003, RN-AUT-004.

---

# 12. Consistencia entre Módulos

---

## RN-GEN-027

### Nombre
Creación Transaccional de Entidades Compuestas

### Descripción
Las operaciones que crean múltiples registros interdependientes se ejecutan dentro de una transacción de base de datos para garantizar atomicidad. Los casos principales son:

1. **Registro de Docente**: Crea `usuario` + `usuario_rol` + `docente` en una transacción.
2. **Finalización de Matrícula**: Crea `estudiante` + `usuario` + `usuario_rol` y actualiza `matricula` en una transacción.
3. **Registro de Directivo**: Crea `usuario` + `usuario_rol` + `directivo` en una transacción.
4. **Cierre de Materia**: Inserta `resultado_academico` para todos los estudiantes y actualiza `cierre_materia` en una transacción.
5. **Asignación/Reasignación de Docente**: Actualiza `detalle_grados` y reasigna registros de 5 tablas hijas en una transacción.

### Motivo
Previene estados inconsistentes donde una entidad se crea parcialmente (ej. un docente sin usuario, o un estudiante sin matrícula activa).

### Alcance
Todas las operaciones compuestas del sistema.

### Evidencia
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `createTeacher`, `assignTeacherCourseSubject`
- [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) — `finalizeEnrollment`
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — `registrarDirectivo`

### Implementación
Patrón `BEGIN` → operaciones → `COMMIT` / `ROLLBACK` usando `pool.connect()` con `client.query('BEGIN')` y `client.query('COMMIT')`.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Docentes, Matrículas, Usuarios y Directivos, Cierre y Boletines.

### Entidades afectadas
Todas las entidades involucradas en operaciones compuestas.

### Endpoints relacionados
- `POST /api/academic-admin/teachers`
- `POST /api/matriculas/finalize/:id`
- `POST /api/admin/directivos`
- `POST /api/academic-admin/teacher-assignments`
- Endpoints de cierre de periodo.

### Archivos relacionados
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts)
- [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts)
- [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts)

### Historias de usuario relacionadas
HU-DOC-001, HU-MAT-006, HU-DIR-002.

---

## RN-GEN-028

### Nombre
Validación en Múltiples Capas (Defense in Depth)

### Descripción
El sistema implementa validación en cuatro capas complementarias:

1. **Frontend (Vue.js)**: Validación reactiva en formularios con feedback visual inmediato.
2. **DTO (Zod)**: Validación estructural y de tipos en el middleware `validateDto` antes de alcanzar los controllers.
3. **Controller/Service (Backend)**: Validaciones de negocio (unicidad, estado, permisos, cupos disponibles).
4. **Base de datos (PostgreSQL)**: Constraints (CHECK, UNIQUE, FK, NOT NULL), triggers y ENUMs como última línea de defensa.

### Motivo
Garantiza que incluso si una capa de validación falla o es eludida, las capas inferiores protejan la integridad de los datos.

### Alcance
Todas las operaciones de escritura del sistema.

### Evidencia
- [modulo_global/README.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/modulo_global/README.md) — Principio documentado "Validación en Múltiples Capas"
- [validateDto.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/validateDto.ts) — Middleware de validación Zod
- DTOs en `backend/src/dtos/`: `matricula.dto.ts`, `adminUser.dto.ts`, `profile.dto.ts`, `reingreso.dto.ts`, `student.dto.ts`
- Constraints en [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Implementación
El middleware `validateDto` aplica schemas Zod y retorna HTTP 400 con errores detallados si la validación falla. Los controllers realizan validaciones de negocio adicionales. La BD provee la garantía final.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
Todas las entidades.

### Endpoints relacionados
Todos los endpoints de escritura.

### Archivos relacionados
- [validateDto.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/validateDto.ts)
- DTOs en `backend/src/dtos/`
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

## RN-GEN-029

### Nombre
Restricción de Modificaciones bajo Modo Monitoreo

### Descripción
Cuando una petición incluye el header `x-monitoring-mode: true`, el middleware `verifyToken` bloquea todas las operaciones de escritura (`POST`, `PUT`, `PATCH`, `DELETE`) excepto las rutas de salida del monitoreo. Esto aplica de forma global a todos los módulos.

### Motivo
Proporciona un modo de solo lectura seguro para inspección del sistema sin riesgo de modificaciones accidentales.

### Alcance
Todos los endpoints protegidos.

### Evidencia
[authMiddleware.ts L86-L93](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts#L86-L93)

### Implementación
```typescript
if (isMonitoringHeader) {
  const isExitRoute = req.originalUrl.includes('/stop-monitoring') || req.originalUrl.endsWith('/salir');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isExitRoute) {
    res.status(403).json({ error: 'Acceso denegado. El Modo Monitoreo es estrictamente de SOLO LECTURA.' });
    return;
  }
}
```

### Excepciones
Las rutas de salida del monitoreo (`/stop-monitoring`, `/salir`) están excluidas del bloqueo.

### Módulos afectados
Todos los módulos del sistema.

### Entidades afectadas
N/A (control de acceso transversal).

### Endpoints relacionados
Todos los endpoints protegidos.

### Archivos relacionados
- [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

# 13. Tipos y Catálogos Globales

---

## RN-GEN-030

### Nombre
Catálogos de Tipos del Sistema (ENUMs Tipológicos)

### Descripción
El sistema define los siguientes ENUMs tipológicos (no de estado) como tipos de PostgreSQL:

| ENUM | Valores | Uso |
|:--|:--|:--|
| `tipo_jornada` | MAÑANA, TARDE, NOCTURNA, UNICA | `jornada.nombre` |
| `tipo_matricula` | REGULAR, RENOVACION, REINGRESO, EXTRAORDINARIA, TRASLADO | `matricula.tipo` |
| `tipo_observacion` | ACADEMICA, CONVIVENCIA, DISCIPLINARIA, OTRO | `observacion_estudiante.tipo` |
| `tipo_documento_identidad` | TI, CC, CE, RC, PAS | ENUM de referencia |
| `tipo_accion_auditoria` | LECTURA, CREACION, MODIFICACION, ELIMINACION, EXPORTACION | `auditoria_acciones_realizadas.tipo_accion` |
| `tipo_supervision` | SOLO_LECTURA, EDITOR | `auditoria_supervision.tipo_supervision` |
| `tipo_incidencia_soporte` | TECNICO, CALIFICACIONES, ASISTENCIA, AUTENTICACION, SOPORTE, REINGRESO, MATRICULA_EXTRAORDINARIA | `tickets_soporte.tipo_incidencia` |

### Motivo
Estandariza los catálogos del sistema a nivel de base de datos, impidiendo la inserción de valores no definidos.

### Alcance
Todas las tablas que utilizan estos tipos.

### Evidencia
[AcademiaNeivaBD.sql L52-L348](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L52-L348)

### Implementación
Definidos como `CREATE TYPE public.tipo_xxx AS ENUM (...)`.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos del sistema que utilicen estos tipos.

### Entidades afectadas
Tablas que referencian los tipos listados.

### Endpoints relacionados
Endpoints que crean o modifican registros con estos tipos.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

# 14. Configuración Institucional

---

## RN-GEN-031

### Nombre
Configuración de Evaluación por Colegio

### Descripción
Cada colegio posee su propia configuración de escala de calificaciones definida en `configuracion_colegio`:
- `nota_minima` (default: 0)
- `nota_maxima` (default: 5)
- `nota_aprobacion` (default: 3)
- `escala_modo` (default: AUTOMATICO)

Esta configuración afecta transversalmente a todos los módulos de calificaciones, boletines y dashboard.

### Motivo
Permite que cada institución defina su propia escala de evaluación según su PEI (Proyecto Educativo Institucional).

### Alcance
Calificaciones, Boletines, Dashboard, Configuración Académica.

### Evidencia
- Tabla `configuracion_colegio`: [AcademiaNeivaBD.sql L1043-L1049](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L1043-L1049)
- PK es `id_colegio` (1:1 con colegio): [L3341-L3342](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3341-L3342)
- FK: `configuracion_colegio_id_colegio_fkey ON DELETE CASCADE` — [L4490-L4491](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4490-L4491)
- Vista `vw_promedio_normalizado` usa `cfg.nota_maxima` — [L2846-L2852](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L2846-L2852)

### Implementación
La tabla `configuracion_colegio` tiene como PK el `id_colegio`, garantizando una relación 1:1. Las vistas de PostgreSQL (`vw_promedio_normalizado`) y los controllers usan estos valores para normalizar promedios.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Configuración Académica, Calificaciones, Cierre y Boletines, Dashboard.

### Entidades afectadas
`configuracion_colegio`, `escala_valoracion`, `notas_actividad`.

### Endpoints relacionados
- `PUT /api/academic-admin/settings/scales/manual`
- `GET /api/academic-admin/settings/:schoolId`

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts)

### Historias de usuario relacionadas
HU-CON-006.

---

## RN-GEN-032

### Nombre
Configuración de Sistema por Colegio con Herencia de Valores Base

### Descripción
Cada colegio puede personalizar los parámetros del sistema a través de la tabla `configuracion_sistema`, que almacena pares clave-valor por colegio. La tabla `configuracion_base` define las claves disponibles y sus valores por defecto. La unicidad se garantiza por la combinación `(id_colegio, clave)`.

### Motivo
Permite la parametrización flexible de cada institución sin modificar código, manteniendo valores por defecto coherentes.

### Alcance
Configuración a nivel institucional.

### Evidencia
- Tabla `configuracion_sistema`: [AcademiaNeivaBD.sql L1112-L1118](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L1112-L1118)
- UNIQUE `(id_colegio, clave)`: [L3829-L3830](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L3829-L3830)
- FK a `configuracion_base`: [L4714-L4715](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql#L4714-L4715)

### Implementación
UNIQUE constraint sobre `(id_colegio, clave)` + FK a `configuracion_base` para herencia de valores.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Configuración Académica, Todos los módulos que lean configuraciones.

### Entidades afectadas
`configuracion_sistema`, `configuracion_base`.

### Endpoints relacionados
Endpoints de configuración del colegio.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

# 15. Constraints de Validación en Base de Datos

---

## RN-GEN-033

### Nombre
Registro Consolidado de Constraints CHECK

### Descripción
Las siguientes restricciones CHECK están definidas a nivel de PostgreSQL:

| Tabla | Constraint | Validación |
|:--|:--|:--|
| `usuario` | `chk_usuario_documento_format` | `documento IS NULL OR documento ~ '^[a-zA-Z0-9]+$'` |
| `anio_lectivo` | `chk_calendario` | `calendario ~ '^[0-9]{4}(-[0-9]{4})?$'` |
| `configuracion_inscripcion` | `chk_fechas` | `fecha_cierre > fecha_inicio` |
| `grupos` | `chk_cupos` | `cupos_totales >= 0` |
| `sancion` | `chk_fechas_sancion` | `fecha_fin >= fecha_inicio` |
| `auditoria_acciones_realizadas` | `chk_modificacion_completa` | Cuando `tipo_accion = 'MODIFICACION'`, exige `valor_antiguo`, `valor_nuevo` y `motivo_cambio` NOT NULL |

### Motivo
Cada constraint protege la coherencia de los datos a nivel de base de datos, actuando como última línea de defensa independientemente de la lógica de aplicación.

### Alcance
Las tablas listadas.

### Evidencia
[AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Constraints CHECK distribuidos en las definiciones de tabla.

### Implementación
Definidos como `CONSTRAINT chk_nombre CHECK (condición)` en las sentencias `CREATE TABLE`.

### Excepciones
No se identificaron excepciones en la implementación actual.

### Módulos afectados
Todos los módulos que operan sobre las tablas listadas.

### Entidades afectadas
`usuario`, `anio_lectivo`, `configuracion_inscripcion`, `grupos`, `sancion`, `auditoria_acciones_realizadas`.

### Endpoints relacionados
Endpoints que crean o modifican registros en las tablas listadas.

### Archivos relacionados
- [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)

### Historias de usuario relacionadas
Regla transversal sin HU específica.

---

# Índice de Reglas

| ID | Nombre | Categoría |
|:--|:--|:--|
| RN-GEN-001 | Arquitectura Multi-Institucional (Multi-Tenant) | Arquitectura Institucional |
| RN-GEN-002 | Aislamiento de Datos entre Instituciones | Arquitectura Institucional |
| RN-GEN-003 | Estado del Colegio como Puerta de Acceso Global | Arquitectura Institucional |
| RN-GEN-004 | Identidad Centralizada en la Tabla `usuario` | Usuarios e Identidad |
| RN-GEN-005 | Unicidad Global del Correo Electrónico | Usuarios e Identidad |
| RN-GEN-006 | Unicidad Global del Número de Documento de Identidad | Usuarios e Identidad |
| RN-GEN-007 | Un Usuario Pertenece a una Única Institución | Usuarios e Identidad |
| RN-GEN-008 | Modelo de Roles mediante Tabla Pivote | Roles y Autorización |
| RN-GEN-009 | Jerarquía de Permisos por Rol | Roles y Autorización |
| RN-GEN-010 | Verificación de Estado Activo del Usuario en Cada Petición | Roles y Autorización |
| RN-GEN-011 | El Rol `estudiante` Solo se Crea a Través de Matrícula | Roles y Autorización |
| RN-GEN-012 | Año Lectivo como Eje Temporal del Sistema | Año Lectivo |
| RN-GEN-013 | Exclusividad de Año Lectivo Activo por Colegio | Año Lectivo |
| RN-GEN-014 | Unicidad de Matrícula Activa por Estudiante, Año y Colegio | Matrícula |
| RN-GEN-015 | Cadena de Integridad Académica | Integridad Académica |
| RN-GEN-016 | Unicidad de Nota por Actividad y Estudiante | Integridad Académica |
| RN-GEN-017 | Catálogo de Estados del Sistema (ENUMs) | Estados y Transiciones |
| RN-GEN-018 | Sincronización Automática del Estado del Estudiante por Sanción | Estados y Transiciones |
| RN-GEN-019 | Bloqueo de Escritura en Periodos Cerrados | Bloqueo por Periodo/Cierre |
| RN-GEN-020 | Bloqueo de Escritura en Materia Cerrada | Bloqueo por Periodo/Cierre |
| RN-GEN-021 | Registro Consolidado de Restricciones de Unicidad | Unicidad y Duplicidad |
| RN-GEN-022 | Política de Eliminación en Cascada | Integridad Referencial |
| RN-GEN-023 | Política de Restricción de Eliminación | Integridad Referencial |
| RN-GEN-024 | Limitación de Tasa de Peticiones (Rate Limiting) | Seguridad |
| RN-GEN-025 | Inmutabilidad de Registros de Auditoría | Seguridad |
| RN-GEN-026 | Invalidación de Tokens JWT | Seguridad |
| RN-GEN-027 | Creación Transaccional de Entidades Compuestas | Consistencia entre Módulos |
| RN-GEN-028 | Validación en Múltiples Capas (Defense in Depth) | Consistencia entre Módulos |
| RN-GEN-029 | Restricción de Modificaciones bajo Modo Monitoreo | Consistencia entre Módulos |
| RN-GEN-030 | Catálogos de Tipos del Sistema (ENUMs Tipológicos) | Tipos y Catálogos |
| RN-GEN-031 | Configuración de Evaluación por Colegio | Configuración Institucional |
| RN-GEN-032 | Configuración de Sistema por Colegio con Herencia | Configuración Institucional |
| RN-GEN-033 | Registro Consolidado de Constraints CHECK | Constraints de Validación |
