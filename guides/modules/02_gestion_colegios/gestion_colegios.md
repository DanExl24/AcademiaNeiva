# 🏫 Módulo de Gestión de Colegios

**Sistema:** Academia Neiva  
**Módulo:** Administración de instituciones educativas  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo administra el ciclo de vida completo de las instituciones educativas registradas en la plataforma. Abarca dos perspectivas: la administración global del catálogo de colegios por parte del Administrador General, y la gestión de identidad institucional (escudo, colores, datos) por parte de los directivos de cada colegio.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Admin General** | CRUD completo de colegios a nivel global (crear, editar, suspender, eliminar) |
| **Directivo** | Gestión de identidad visual de su propio colegio (escudo, colores, datos) |
| **Autenticados** | Lectura de datos básicos de colegio (para branding del dashboard) |

---

## 3. Acciones Disponibles

### Admin General — Gestión Global

| Acción | Método | Endpoint |
|---|---|---|
| Listar todos los colegios | `GET` | `/api/admin/colegios` |
| Detalle de un colegio | `GET` | `/api/admin/colegios/:id` |
| Registrar colegio nuevo | `POST` | `/api/admin/colegios` |
| Actualizar datos de colegio | `PUT` | `/api/admin/colegios/:id` |
| Subir escudo institucional | `POST` | `/api/admin/colegios/upload-escudo` |
| Cambiar estado del colegio | `PATCH` | `/api/admin/colegios/:id/estado` |
| Eliminar colegio | `DELETE` | `/api/admin/colegios/:id` |

### Directivo — Mi Colegio

| Acción | Método | Endpoint |
|---|---|---|
| Ver datos de "Mi Colegio" | `GET` | `/api/academic-admin/my-school/:schoolId` |
| Actualizar identidad institucional | `PUT` | `/api/academic-admin/my-school/:schoolId/identidad` |
| Resetear identidad a valores por defecto | `POST` | `/api/academic-admin/my-school/:schoolId/identidad/reset` |
| Subir escudo desde panel directivo | `POST` | `/api/academic-admin/my-school/:schoolId/identidad/upload-escudo` |

---

## 4. Reglas de Negocio

- **RN-COL-001 (Estados del colegio):** Un colegio transiciona entre estados `PENDIENTE` → `ACTIVO` → `SUSPENDIDO` / `ELIMINADO` / `RECHAZADO`. Solo colegios `ACTIVO` operan plenamente en el sistema.
- **RN-COL-002 (Código DANE único):** Cada colegio debe tener un código DANE único en el sistema para garantizar la identificación oficial ante el MEN.
- **RN-COL-003 (Calendario tipo A o B):** Los colegios se clasifican como calendario `A` (Enero a Noviembre) o `B` (Agosto a Junio), lo que afecta la generación de años lectivos y periodos.
- **RN-COL-004 (Identidad visual):** Los directivos pueden personalizar `color_primario`, `color_secundario` y `escudo_url` para que el dashboard refleje los colores institucionales.
- **RN-COL-005 (Eliminación protegida):** Un colegio no puede eliminarse si tiene matrículas activas, años lectivos vigentes o usuarios asociados.
- **RN-COL-006 (Remoción de fondo por IA y formato Data URL Base64):** La remoción de fondo del escudo se ejecuta en el navegador del usuario utilizando redes neuronales (ONNX WASM) optimizadas. Las imágenes procesadas y subidas se persisten como Data URLs Base64 (`data:image/png;base64,...`) en la columna `escudo_url`, evitando dependencias con el sistema de archivos estático del servidor.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller (Admin)** | [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) — `listarColegios`, `detalleColegio`, `registrarColegio`, `actualizarColegio`, `uploadEscudo`, `cambiarEstadoColegio`, `eliminarColegio` |
| **Controller (Directivo)** | [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `getMySchoolData`, `updateMySchoolIdentity`, `resetMySchoolIdentity`, `uploadMySchoolEscudo` (Conversión a Base64) |
| **Routes** | [adminGeneral.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/adminGeneral.routes.ts), [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts) |
| **App Server Config** | [app.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/app.ts) — `express.json({ limit: '10mb' })` y `express.urlencoded({ limit: '10mb' })` para payloads de imágenes Base64 |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vista Admin General** | [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue) |
| **Vista Directivo** | [MySchool.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/MySchool.vue) — Integración de `@imgly/background-removal`, `prepareImageForAi` (pre-resizing Canvas a max 512px), `ort.env.wasm.numThreads = 1` y resolución limpia en `getShieldUrl` |
| **Layout Dashboard** | [DashboardLayout.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/layouts/DashboardLayout.vue) — Renderizado dinámico de escudos en Base64 en el menú principal |
| **Store** | [theme.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/stores/theme.ts) — Aplica colores institucionales al dashboard |

---

## 6. Modelo de Datos

### Tabla: `colegio`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_colegio` | SERIAL PK | Identificador único |
| `nombre` | TEXT | Nombre de la institución |
| `tipo_colegio` | VARCHAR(20) | Tipo (Público, Privado, etc.) |
| `sede` | VARCHAR(255) | Dirección de la sede principal |
| `contacto` | NUMERIC | Teléfono de contacto |
| `correo` | VARCHAR(100) | Correo institucional |
| `dane` | VARCHAR(100) | Código DANE oficial |
| `tipo_calendario` | CHAR(1) | `'A'` o `'B'` |
| `estado` | `estado_colegio` | `PENDIENTE`, `ACTIVO`, `SUSPENDIDO`, `RECHAZADO`, `ELIMINADO` |
| `fecha_registro` | TIMESTAMPTZ | Fecha de creación del registro |
| `motivo_rechazo` | TEXT | Motivo si el estado es RECHAZADO |
| `escudo_url` | TEXT | Data URL Base64 o URL del escudo institucional |
| `color_primario` | VARCHAR(50) | Color primario para branding |
| `color_secundario` | VARCHAR(50) | Color secundario para branding |

### Types relevantes

```sql
CREATE TYPE public.estado_colegio AS ENUM (
    'PENDIENTE', 'ACTIVO', 'SUSPENDIDO', 'RECHAZADO', 'ELIMINADO'
);
```

---

## 7. Conexiones con Otros Módulos

- **→ Estructura Escolar**: Un colegio contiene grados, grupos y materias.
- **→ Matrículas**: Las matrículas se asocian a un `id_colegio`.
- **→ Usuarios y Directivos**: Los directivos se vinculan a un colegio específico.
- **→ Configuración Académica**: Años lectivos y periodos son por colegio.
- **→ Catálogo DBA**: Las versiones curriculares se asignan por colegio.
- **→ Autenticación**: El `schoolId` del token JWT determina el colegio del usuario.
- **→ Supervisión**: Las supervisiones del Admin General se asocian a un colegio.

---

## 8. Validaciones Implementadas

### Backend
- Verificación de DANE único al crear/actualizar colegio.
- Validación de estado válido en transiciones.
- Transformación de buffers subidos por Multer a cadenas Base64 Data URL (`data:image/png;base64,...`).
- Aislamiento multi-tenant: Directivo solo puede acceder a datos de su `id_colegio`.

### Frontend
- Formularios con validación de campos obligatorios.
- Preview de escudo antes de subir.
- Pre-procesamiento en Canvas a máximo 512x512px antes de ejecutar IA para evitar congelar el Hilo Principal del navegador (Event Loop).
- Detección nativa de esquemas `data:`, `http://` y `https://` para evitar anteponer prefijos del backend a imágenes en Base64.
- Confirmación para cambios de estado críticos (suspender/eliminar).

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Colores en tabla colegio** | Permite personalización institucional sin tabla adicional; los colores se cargan al iniciar sesión y se aplican vía CSS variables |
| **Estado como enum** | Garantiza que solo estados válidos se persistan; las transiciones se validan en el controller |
| **IA en el Cliente (ONNX WASM)** | Se utiliza `@imgly/background-removal` directamente en el navegador del usuario, liberando al servidor VPS de tareas pesadas de cómputo e IA |
| **Pre-resizing a 512px en Canvas** | Reduce en un 97% los píxeles procesados por el modelo ONNX, eliminando bloqueos en el navegador y acelerando la remoción de fondo a ~1 segundo |
| **Persistencia Data URL Base64** | Almacenar imágenes en formato Base64 directamente en PostgreSQL permite portabilidad total en la base de datos sin depender del sistema de archivos local (`/uploads`) |
