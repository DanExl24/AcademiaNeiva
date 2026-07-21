# 🏗️ Módulo de Estructura Escolar (Grados, Grupos y Materias)

**Sistema:** Academia Neiva  
**Módulo:** Estructura escolar institucional  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo gestiona la estructura organizacional académica de cada colegio: los tipos de grado (PRIMERO, SEGUNDO...), los grupos o cursos (Primero A, Primero B), las materias del catálogo institucional, y la relación de asignación académica que vincula docentes con grupos y materias (`detalle_grados`). Es la columna vertebral sobre la que se construyen matrículas, calificaciones y competencias.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Directivo** | CRUD completo de grados, grupos y materias de su colegio |
| **Público** | Consulta de grados disponibles (para formulario de matrícula) |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol |
|---|---|---|---|
| Datos de gestión de grados | `GET` | `/api/academic-admin/grades/:schoolId` | Directivo |
| Crear tipo de grado | `POST` | `/api/academic-admin/grade-types` | Directivo |
| Eliminar tipo de grado | `DELETE` | `/api/academic-admin/grade-types/:id` | Directivo |
| Crear grupo | `POST` | `/api/academic-admin/groups` | Directivo |
| Actualizar cupos de grupo | `PATCH` | `/api/academic-admin/groups/:id/cupos` | Directivo |
| Renombrar grupo individual | `PATCH` | `/api/academic-admin/groups/:id/rename` | Directivo |
| Renombrar en bloque por tipo de grado | `PATCH` | `/api/academic-admin/grade-types/:id/bulk-rename` | Directivo |
| Eliminar grupo | `DELETE` | `/api/academic-admin/groups/:id` | Directivo |
| Listar materias del colegio | `GET` | `/api/academic-admin/subjects/:schoolId` | Directivo |
| Detalles curriculares de materia | `GET` | `/api/academic-admin/subjects/:id/curriculum-details` | Directivo |
| Papelera de materias eliminadas | `GET` | `/api/academic-admin/subjects/trash/:schoolId` | Directivo |
| Crear materia | `POST` | `/api/academic-admin/subjects` | Directivo |
| Eliminar materia (soft delete) | `DELETE` | `/api/academic-admin/subjects/:id` | Directivo |
| Grados disponibles (público) | `GET` | `/api/grados/available/:idColegio` | Público |

---

## 4. Reglas de Negocio

- **RN-EST-001 (Jerarquía escolar):** La estructura sigue una jerarquía `nivel_escolar` → `tipo_grado` → `grupos`. Ejemplo: PRIMARIA → PRIMERO → Primero A, Primero B.
- **RN-EST-002 (Cursos paralelos — Peer Groups):** Cuando existen varios grupos del mismo tipo de grado (ej. Primero A, B, C), el sistema los identifica como "cursos paralelos" o "peer groups" para la sincronización de competencias.
- **RN-EST-003 (Cupos por grupo):** Cada grupo tiene un número máximo de cupos que limita la asignación de matrículas.
- **RN-EST-004 (Eliminación protegida de grados):** Un tipo de grado no puede eliminarse si tiene grupos con matrículas activas o asignaciones docentes.
- **RN-EST-005 (Eliminación protegida de materias):** Una materia con asignaciones docentes activas o competencias registradas no puede eliminarse. Se envía a "papelera" (soft delete).
- **RN-EST-006 (Renombramiento en bloque):** Los cursos paralelos pueden renombrarse en bloque manteniendo la consistencia de nomenclatura (ej. cambiar "1ro" a "Primero" en todos los grupos del tipo).

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller** | [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `getGradeManagementData`, `createGradeType`, `deleteGradeType`, `createGroup`, `updateGroupCupos`, `renameSingleCourse`, `bulkRenameCourses`, `deleteGroup`, `getSubjects`, `getSubjectCurriculumDetails`, `getSubjectTrash`, `createSubject`, `deleteSubject` |
| **Service** | [gradoService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/gradoService.ts) — `getAvailable` |
| **Routes** | [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts), [grado.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/grado.routes.ts) |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vista Grados** | [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue) |
| **Vista Materias** | [SubjectManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SubjectManagement.vue) |
| **Utilidad** | [courseHelper.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/utils/courseHelper.ts) — `getCourseDisplayName` |

---

## 6. Modelo de Datos

### Tabla: `nivel_escolar`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_nivel` | SERIAL PK | Identificador |
| `nombre` | VARCHAR | `PREESCOLAR`, `PRIMARIA`, `SECUNDARIA`, `MEDIA` |

### Tabla: `tipo_grado`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_tipo_grado` | SERIAL PK | Identificador |
| `nombre` | VARCHAR | `TRANSICION`, `PRIMERO`, `SEGUNDO`, ..., `ONCE` |
| `id_nivel` | INT FK | Nivel escolar al que pertenece |
| `id_colegio` | INT FK | Colegio propietario |

### Tabla: `grupos`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_grupo` | SERIAL PK | Identificador |
| `nombre` | VARCHAR | Nombre visible (ej. "Primero A") |
| `cupos` | INT | Máximo de estudiantes |
| `id_tipo_grado` | INT FK | Tipo de grado al que pertenece |
| `id_colegio` | INT FK | Colegio propietario |
| `id_anio` | INT FK | Año lectivo |

### Tabla: `materias`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_materia` | SERIAL PK | Identificador |
| `nombre` | VARCHAR | Nombre de la materia |
| `id_colegio` | INT FK | Colegio propietario |
| `eliminada` | BOOLEAN | Soft delete flag |

### Tabla: `detalle_grados` (Asignación Académica)

| Columna | Tipo | Descripción |
|---|---|---|
| `id_detallegrado` | SERIAL PK | Identificador |
| `id_grupo` | INT FK | Grupo asignado |
| `id_materia` | INT FK | Materia asignada |
| `id_docente` | INT FK | Docente responsable |
| `id_anio` | INT FK | Año lectivo |

---

## 7. Conexiones con Otros Módulos

- **→ Matrículas**: Los grupos determinan dónde se matricula un estudiante.
- **→ Docentes**: `detalle_grados` vincula docentes con grupos y materias.
- **→ Calificaciones**: Las actividades académicas se crean sobre `id_detallegrado`.
- **→ Competencias**: Las competencias se asocian a combinación de grupo + materia + periodo.
- **→ Asistencia**: Los registros de asistencia se asocian a `id_detallegrado`.
- **→ Cierre de periodo**: El cierre de materia opera sobre `id_detallegrado`.

---

## 8. Validaciones Implementadas

### Backend
- Verificación de unicidad de nombre de grado/materia dentro del colegio.
- Validación de cupos disponibles antes de aceptar matrículas.
- Protección contra eliminación de grados/materias con datos asociados.
- Verificación de `id_colegio` del usuario autenticado (multi-tenant).

### Frontend
- Formularios con validación de campos obligatorios y cupos numéricos.
- Confirmación para eliminaciones con detalle de dependencias.
- Interfaz de renombramiento en bloque con preview.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Tabla `detalle_grados` como relación n-to-n** | Permite asignar múltiples materias a un grupo con diferentes docentes, y un docente a múltiples grupos |
| **Soft delete para materias** | Preserva la integridad referencial de datos históricos (calificaciones, competencias) |
| **`courseHelper.ts` en frontend** | Centraliza la lógica de formateo de nombres de cursos para mostrar "Primero A" en vez de datos crudos de BD |
