# 🔄 Módulo de Competencias y Sincronización

**Sistema:** Academia Neiva  
**Módulo:** Sincronización Multicompetencia y Cursos Paralelos  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo permite a los directivos y docentes configurar el plan curricular del colegio mediante la creación y edición de competencias independientes para cada asignatura y periodo académico. Habilita el registro de múltiples competencias por periodo para brindar flexibilidad pedagógica. Para garantizar la cohesión curricular en grados que cuentan con múltiples cursos paralelos (ej. Primero A, Primero B y Primero C), el sistema implementa un motor de sincronización automática en caliente que propaga las modificaciones curriculares a través de los cursos del mismo nivel.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Directivo** | Planeación curricular completa: crear competencias, asociar evidencias DBA, editar y eliminar competencias y evidencias a nivel de grado y grupo. |
| **Docente** | Edición limitada: modificar descripciones de competencias asignadas bajo su control y registrar actividades evaluativas asociadas. |
| **Estudiante / Padre** | Consulta pasiva de las competencias asociadas a las notas del periodo. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Crear o actualizar competencia (Directivo) | `POST` | `/api/academic-admin/settings/competencies` | Directivo |
| Verificar uso de competencia (tiene actividades) | `GET` | `/api/academic-admin/settings/competencies/:id/usage-check` | Directivo |
| Eliminar competencia | `DELETE` | `/api/academic-admin/settings/competencies/:id` | Directivo |
| Crear evidencia de aprendizaje personalizada | `POST` | `/api/academic-admin/settings/competencies/:competenciaId/evidencias` | Directivo |
| Actualizar descripción de evidencia | `PUT` | `/api/academic-admin/settings/evidencias/:evidenciaId` | Directivo |
| Eliminar evidencia de aprendizaje | `DELETE` | `/api/academic-admin/settings/evidencias/:evidenciaId` | Directivo |
| Actualizar descripción de competencia (Docente) | `PUT` | `/api/teacher/competencies/:id` | Docente |

---

## 4. Reglas de Negocio

- **RN-COMP-001 (Competencias Múltiples):** A diferencia de esquemas rígidos, el sistema permite registrar múltiples competencias independientes dentro de una misma asignatura y periodo académico para dar mayor adaptabilidad curricular.
- **RN-COMP-002 (Sincronización en Caliente vía `sync_uuid`):** Cuando se crea una competencia para la Asignatura X, Periodo Y y Grado Z:
  1. El backend genera un identificador aleatorio único (`sync_uuid`) utilizando `crypto.randomUUID()`.
  2. Identifica todos los grupos paralelos (ej. Primero A, B, C) que pertenecen al mismo grado escolar.
  3. Inserta un registro individual de competencia para cada grupo paralelos, todos compartiendo el mismo `sync_uuid`.
- **RN-COMP-003 (Propagación Masiva de Ediciones):** Al editar la descripción de una competencia o vincular/desvincular evidencias, el backend realiza la operación en cascada a todos los registros que compartan el mismo `sync_uuid` en una sola transacción:
  ```sql
  UPDATE public.competencias 
  SET descripcion = $1 
  WHERE sync_uuid = $2 AND id_grupo = $3
  ```
- **RN-COMP-004 (Evidencias por Defecto):** Al crear una competencia, el sistema le asocia automáticamente 3 evidencias de aprendizaje por defecto con orden secuencial para facilitar la labor del docente.
- **RN-COMP-005 (Protección por Uso Curricular):** Una competencia no se puede modificar en su estructura de evidencias o catalogación DBA si los docentes ya han registrado actividades de aula asociadas. El endpoint `/usage-check` bloquea la edición si el conteo de actividades asociadas es mayor a cero.

---

## 5. Implementation

### Backend

| Tipo | Archivo |
|---|---|
| **Controller Directivo** | [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `upsertCompetencyByAdmin`, `checkCompetenciaUsage`, `deleteCompetencyByAdmin`, `createEvidencia`, `updateEvidencia`, `deleteEvidencia`. |
| **Controller Docente** | [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) — `updateCompetency`. |
| **Routes** | [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts), [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts) |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vista Configuración** | [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue) — Interfaz de administración curricular de competencias y evidencias. |
| **Componente Docente** | [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue) — Vista donde el docente consulta y actualiza las descripciones del plan de estudio. |

---

## 6. Modelo de Datos

### Tabla: `competencias`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_competencia` | SERIAL PK | Identificador único de la competencia. |
| `id_anio` | INT FK | Año lectivo. |
| `id_grupo` | INT FK | Grupo escolar específico (ej. Primero A). |
| `id_materia` | INT FK | Materia a la que pertenece. |
| `id_periodo` | INT FK | Periodo académico asociado. |
| `descripcion` | TEXT | Enunciado descriptivo de la competencia. |
| `id_colegio` | INT FK | Colegio propietario. |
| `sync_uuid` | UUID | Identificador de sincronización para cursos paralelos. |
| `id_dimension` | INT FK | Referencia opcional para dimensiones preescolares. |

### Tabla: `evidencia_aprendizaje`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_evidencia` | SERIAL PK | Identificador único de la evidencia de aprendizaje. |
| `id_competencia` | INT FK | Competencia asociada. |
| `descripcion` | TEXT | Descripción de la evidencia. |
| `orden` | INT | Orden de despliegue en reportes y listas. |
| `id_colegio` | INT FK | Colegio propietario. |
| `id_evidencia_dba` | INT FK | Referencia opcional a la evidencia oficial del catálogo DBA. |

---

## 7. Conexiones con Otros Módulos

- **→ Configuración Académica**: Valida que no se editen competencias en periodos cerrados.
- **→ Catálogo DBA**: Vincula las evidencias oficiales del MEN colombiano a las evidencias del plan de estudios.
- **→ Calificaciones**: Los docentes enlazan sus actividades evaluativas a las evidencias de aprendizaje registradas.

---

## 8. Validaciones Implementadas

### Backend
- Generación robusta de UUIDs de sincronización en caliente en base a transacciones atómicas.
- Comprobación física de actividades asociadas (`usage-check`) antes de permitir cambios en el plan de estudios.
- Aislamiento por `id_colegio` para evitar alteración de planeaciones de otros planteles.

### Frontend
- Desactivación interactiva de checkboxes de evidencias oficiales si la competencia tiene actividades registradas.
- Sincronización visual de cambios en la interfaz del docente tras actualizar la descripción.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Eliminar Unique Context** | Se removió la restricción rígida que limitaba a una única competencia por materia/periodo. Esto habilitó a los colegios a estructurar planes de estudio con múltiples metas de aprendizaje simultáneas. |
| **Propagación por UUID en una sola Transacción** | Evita desajustes curriculares en los paralelos; si la propagación a "Primero B" falla, se hace rollback a "Primero A", manteniendo la consistencia de la planeación escolar. |
