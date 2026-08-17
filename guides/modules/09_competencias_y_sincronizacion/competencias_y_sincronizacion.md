# 🔄 Módulo de Competencias Pedagógicas y Sincronización en Caliente

**Sistema:** Academia Neiva  
**Módulo:** Sincronización Multicompetencia, Evidencias Formativas y Cursos Paralelos  
**Última actualización:** 2026-08-17  

---

## 1. Descripción Funcional

El módulo de **Competencias Pedagógicas y Sincronización en Caliente** coordina la planeación curricular de asignaturas por periodo académico en AcademiaNeiva. Permite registrar múltiples metas de aprendizaje por materia y periodo, y garantiza la cohesión curricular en instituciones con cursos paralelos (ej. *Primero A, Primero B y Primero C*) mediante un motor de propagación transaccional basado en identificadores criptográficos `sync_uuid`.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   MOTOR DE SINCRONIZACIÓN CURRICULAR EN CALIENTE                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Creación en Curso Base (ej. 10-A):                                                  │
│    Directivo define Competencia ──> Backend genera sync_uuid único (UUID v4)           │
│                                                                                        │
│ 2. Propagación Atómica a Cursos Paralelos (Peer Groups):                               │
│    10-A (sync_uuid) ──[ Transacción Kysely ]──> 10-B (sync_uuid) ──> 10-C (sync_uuid) │
│                                                                                        │
│ 3. Matriz de Evidencias de Aprendizaje:                                                │
│    - Sin DBA ──> Inyección automática de 3 Evidencias por Defecto                      │
│    - Con DBA ──> Validación de no duplicidad inter-periodo ──> Reemplazo limpio DBA    │
│                                                                                        │
│ 4. Blindaje contra Alteraciones Destructivas (usage-check):                           │
│    Docentes registran actividades/notas ──> Competencia BLOQUEADA contra eliminación   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

El módulo abarca:
1. **Multicompetencias por Periodo:** Flexibilidad para definir tantas competencias como requiera el plan de estudios por asignatura y periodo.
2. **Sincronización Transaccional en Cursos Paralelos:** Cualquier creación o actualización en un curso se replica automáticamente a todos los grupos del mismo tipo de grado bajo una sola transacción SQL.
3. **Gestión Dual de Evidencias:** Inyección de 3 evidencias formativas por defecto (`ensureDefaultEvidencias`) o vinculación de evidencias oficiales de DBA del MEN con reemplazo automático de las evidencias por defecto.
4. **Protección de Uso Evaluativo (`usage-check`):** Verificación estricta de actividades evaluativas (`actividad_materia`) y notas (`nota_criterio`) antes de autorizar ediciones estructurales o eliminaciones directivas.
5. **Doble Bloqueo por Cierre:** Inmutabilidad si el periodo escolar está cerrado a nivel institucional o si el docente ya efectuó el cierre de la materia (`cierre_materia`).
6. **Armonización Automática Anual:** Sincronización en segundo plano (`harmonizeCompetenciesForSchoolYear`) para reparar cursos nuevos o inconsistencias históricas.

---

## 2. Actores y Permisos

| Rol | Alcance en el Módulo |
|---|---|
| **Directivo (Rector / Coordinador)** | Planeación curricular completa: creación de competencias para cualquier curso/materia/periodo, vinculación de evidencias DBA, gestión de evidencias personalizadas, verificación de uso evaluativo (`usage-check`), y eliminación protegida de competencias. |
| **Docente** | Edición contextual: actualización de la descripción pedagógica de competencias asignadas a su carga académica en periodos abiertos (`updateCompetency`), siempre que la materia no haya sido cerrada en el periodo. |
| **Estudiante y Padre de Familia** | Consulta de las competencias y evidencias vinculadas a las actividades evaluativas y boletines del periodo. |

---

## 3. Acciones Disponibles y Endpoints de la API

| Acción | Método | Endpoint | Autenticación Requerida | Parámetros / Body Requeridos |
|---|---|---|---|---|
| Crear o actualizar competencia (Directivo) | `POST` | `/api/academic-admin/settings/competencies` | JWT Directivo | `{ schoolId, id_grupo, id_materia, id_periodo, descripcion, id_evidencias_dba?, id_dimension? }` |
| Auditar uso evaluativo de competencia | `GET` | `/api/academic-admin/settings/competencies/:id/usage-check` | JWT Directivo | `id` (URL), `schoolId` (Query) |
| Eliminar competencia y sus réplicas | `DELETE` | `/api/academic-admin/settings/competencies/:id` | JWT Directivo | `id` (URL), `schoolId` (Query) |
| Crear evidencia de aprendizaje | `POST` | `/api/academic-admin/settings/competencies/:competenciaId/evidencias` | JWT Directivo | `competenciaId` (URL), `{ schoolId, descripcion }` |
| Actualizar descripción de evidencia | `PUT` | `/api/academic-admin/settings/evidencias/:evidenciaId` | JWT Directivo | `evidenciaId` (URL), `{ schoolId, descripcion }` |
| Eliminar evidencia de aprendizaje | `DELETE` | `/api/academic-admin/settings/evidencias/:evidenciaId` | JWT Directivo | `evidenciaId` (URL), `schoolId` (Query) |
| Actualizar descripción de competencia (Docente) | `PUT` | `/api/teacher/competencies/:id` | JWT Docente | `id` (URL), `{ descripcion }` |
| Consultar evidencias DBA de una competencia | `GET` | `/api/teacher/competencies/:competenciaId/evidencias-dba` | JWT Docente | `competenciaId` (URL) |
| Consultar evidencias DBA por curso y materia | `GET` | `/api/teacher/courses/:gradeId/:subjectId/evidencias-dba` | JWT Docente | `gradeId`, `subjectId` (URL) |

---

## 4. Reglas de Negocio

- **RN-COMP-001 (Multicompetencias por Asignatura y Periodo):** El sistema permite registrar múltiples competencias independientes para la misma combinación de grupo, materia y periodo académico, habiéndose removido restricciones unívocas obsoletas.
- **RN-COMP-002 (Sincronización en Caliente vía `sync_uuid`):** Al crear una competencia, `syncCompetencyAcrossGrade` detecta todos los cursos paralelos del mismo tipo de grado (`getGradePeerGroups`), genera un `sync_uuid` (UUID v4) y replica la competencia en todos los grupos paralelos dentro de una sola transacción atómica.
- **RN-COMP-003 (Propagación Masiva de Ediciones):** Cualquier actualización en la descripción o dimensión de una competencia se propaga de inmediato a todos los registros hermanos que compartan el mismo `sync_uuid`.
- **RN-COMP-004 (Inyección Automática de Evidencias Formativas):** Si una competencia se crea sin asociar evidencias de DBA, `ensureDefaultEvidencias` le inserta automáticamente 3 evidencias formativas estándar (conceptual, analítica y colaborativa).
- **RN-COMP-005 (Vinculación Exclusiva de Evidencias DBA y Reemplazo Limpio):** Al vincular evidencias oficiales de DBA, el sistema valida que ninguna de ellas esté asignada a otra competencia del mismo año, materia y grado en un periodo diferente (`alreadyAssignedRes`). Al asociar las evidencias DBA, elimina las 3 evidencias por defecto y replica las oficiales en todos los paralelos.
- **RN-COMP-006 (Protección contra Eliminaciones Destructivas — `usage-check`):** Una competencia no puede eliminarse si cuenta con actividades evaluativas en `actividad_materia` o calificaciones en `nota_criterio`. El endpoint `/usage-check` expone el desglose de docentes y actividades, y `deleteCompetencyByAdmin` bloquea con `409 Conflict`.
- **RN-COMP-007 (Doble Bloqueo por Cierre Institucional y de Materia):** Se prohíbe crear, editar o eliminar competencias si `periodo_academico.estado === 'CERRADO'`. Para docentes, se valida adicionalmente que la materia no haya sido cerrada en el periodo (`ensureSubjectOpen`).

---

## 5. Implementación del Módulo

### Backend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Controlador Curricular Directivo** | [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) | `upsertCompetencyByAdmin`, `checkCompetenciaUsage`, `deleteCompetencyByAdmin`, `createEvidencia`, `updateEvidencia`, `deleteEvidencia`. |
| **Controlador de Calificaciones Docente** | [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) | `updateCompetency`, `getCompetenciaEvidenciasDba`, `getCourseEvidenciasDba`. |
| **Motor de Sincronización y Migración** | [competencyMigration.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/competencyMigration.ts) | `syncCompetencyAcrossGrade`, `ensureDefaultEvidencias`, `harmonizeCompetenciesForSchoolYear`, `getGradePeerGroups`. |
| **Rutas de Administración y Docente** | [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts), [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts) | Definición de endpoints con middlewares de rol directivo y docente. |

### Frontend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Gestión Curricular de Competencias** | [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue) | Interfaz directiva para configurar competencias, seleccionar evidencias DBA, auditar uso y gestionar evidencias personalizadas. |
| **Planilla Docente de Calificaciones** | [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue) | Vista de aula donde el docente consulta las competencias y edita descripciones si la materia está abierta. |

---

## 6. Modelo de Datos

### Tabla: `competencias`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_competencia` | SERIAL PK | Identificador único de la competencia. |
| `id_anio` | INT FK | Año lectivo en que aplica. |
| `id_grupo` | INT FK | Curso físico al que pertenece. |
| `id_materia` | INT FK | Materia asociada. |
| `id_periodo` | INT FK | Periodo académico correspondiente. |
| `descripcion` | TEXT | Enunciado pedagógico de la competencia. |
| `id_colegio` | INT FK | Colegio propietario. |
| `sync_uuid` | UUID | **Identificador criptográfico de sincronización entre cursos paralelos.** |
| `id_dimension` | INT FK (NULLable) | Dimensión formativa en educación preescolar. |

### Tabla: `evidencia_aprendizaje`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_evidencia` | SERIAL PK | Identificador único de la evidencia. |
| `id_competencia` | INT FK | Competencia a la que pertenece (ON DELETE CASCADE). |
| `descripcion` | TEXT | Enunciado descriptivo del indicador de logro. |
| `orden` | INT | Posición secuencial de despliegue. |
| `id_colegio` | INT FK | Colegio propietario. |
| `id_evidencia_dba` | INT FK (NULLable) | Enlace a la evidencia oficial del catálogo DBA del MEN. |

---

## 7. Conexiones con Otros Módulos

- **→ Catálogo DBA y Coherencia:** Vincula evidencias oficiales con candado de no colisión inter-periodo.
- **→ Calificaciones y Actividades:** Las actividades en `actividad_materia` se asocian a una `id_competencia` y opcionalmente a un `id_evidencia`.
- **→ Cierre de Periodo:** Valida el estado del periodo institucional y el cierre individual de materia antes de admitir mutaciones.
- **→ Estructura Escolar:** `getGradePeerGroups` resuelve los cursos paralelos a partir de `grupos.id_nivel` y `grupos.id_tipo_grado`.

---

## 8. Decisiones de Diseño

| Decisión | Justificación Técnica |
|---|---|
| **Sincronización Atómica mediante `sync_uuid`** | Garantiza que todos los salones de un mismo grado (ej. 10-A, 10-B, 10-C) compartan la misma planeación curricular; si la inserción en un paralelo falla, la transacción se aborta completamente (`ROLLBACK`). |
| **Inyección de Evidencias Formativas por Defecto** | Impide que una competencia quede desprovista de criterios evaluativos, permitiendo a los docentes crear actividades evaluativas inmediatas sin exigir parametrización previa de DBA. |
| **Auditoría Previa de Uso Evaluativo (`usage-check`)** | Protege el historial de calificaciones; evita que un directivo elimine o desconfigure una competencia cuando los docentes ya han evaluado a los estudiantes sobre ella. |
