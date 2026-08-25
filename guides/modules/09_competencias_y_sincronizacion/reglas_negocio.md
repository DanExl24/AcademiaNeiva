# Reglas de Negocio — Competencias Pedagógicas y Sincronización en Caliente

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de **Competencias y Sincronización** de AcademiaNeiva.

---

## 1. Estructura y Sincronización de Competencias

### RN-COMP-001: Multicompetencias por Asignatura y Periodo
- **Descripción:** El sistema permite registrar múltiples competencias independientes para la misma combinación de grupo, materia y periodo académico, habiéndose removido restricciones unívocas obsoletas (`competencias_unique_context`).
- **Motivo:** Otorga flexibilidad pedagógica para estructurar planes de estudio con múltiples objetivos de aprendizaje dentro de un mismo periodo.
- **Archivos donde se implementa:**
  - [competencyMigration.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/competencyMigration.ts)
  - [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) (`upsertCompetencyByAdmin`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** HU-COMP-001

---

### RN-COMP-002: Sincronización Atómica en Caliente vía `sync_uuid`
- **Descripción:** Al crear una competencia para un curso (`id_grupo`):
  1. `syncCompetencyAcrossGrade` consulta todos los cursos paralelos del mismo nivel y tipo de grado (`getGradePeerGroups`).
  2. Genera un identificador único criptográfico `sync_uuid` (`crypto.randomUUID()`).
  3. Inserta una fila de competencia para cada curso paralelo dentro de una sola transacción SQL atómica, compartiendo el mismo `sync_uuid`.
- **Motivo:** Asegura la uniformidad curricular entre cursos paralelos (ej. Primero A, B y C) y evita desajustes pedagógicos.
- **Archivos donde se implementa:**
  - [competencyMigration.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/competencyMigration.ts) (`syncCompetencyAcrossGrade`)
  - [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) (`upsertCompetencyByAdmin`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** HU-COMP-002

---

### RN-COMP-003: Propagación Masiva de Ediciones Curriculares
- **Descripción:** Al editar la descripción o dimensión de una competencia (sea por directivo en `upsertCompetencyByAdmin` o por docente en `updateCompetency`), el backend propaga la modificación a todos los registros que compartan el mismo `sync_uuid` en una sola transacción atómica.
- **Motivo:** Mantiene sincronizadas las actualizaciones curriculares en todos los paralelos sin exigir ediciones repetitivas.
- **Archivos donde se implementa:**
  - [competencyMigration.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/competencyMigration.ts) (`syncCompetencyAcrossGrade`)
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`updateCompetency`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/settings/competencies`
  - `PUT /api/teacher/competencies/:id`
- **Historias de usuario relacionadas:** HU-COMP-002, HU-COMP-005

---

## 2. Gestión de Evidencias de Aprendizaje

### RN-COMP-004: Inyección Automática de Evidencias Formativas por Defecto
- **Descripción:** Si una competencia se crea sin asociar evidencias oficiales de DBA, la función `ensureDefaultEvidencias` le inserta automáticamente 3 evidencias formativas estándar:
  1. *"Reconoce y aplica los conceptos fundamentales de la unidad temática."*
  2. *"Demuestra capacidad analítica y pensamiento crítico en la resolución de problemas."*
  3. *"Participa activamente y colabora con sus compañeros en el entorno de aprendizaje."*
- **Motivo:** Asegura que toda competencia disponga de indicadores de evaluación formativa inmediatos para las actividades de aula del docente.
- **Archivos donde se implementa:**
  - [competencyMigration.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/competencyMigration.ts) (`ensureDefaultEvidencias`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** HU-COMP-001

---

### RN-COMP-005: Vinculación Exclusiva de Evidencias DBA y Reemplazo Limpio
- **Descripción:** Al asociar evidencias oficiales del catálogo DBA a una competencia (`id_evidencias_dba`):
  1. El sistema valida que ninguna de las evidencias seleccionadas esté asignada a otra competencia del mismo año, materia y grado en un periodo diferente (`alreadyAssignedRes`), retornando error si hay colisión.
  2. Al confirmarse la vinculación, elimina las 3 evidencias por defecto autogeneradas y replica las evidencias oficiales de DBA en todos los cursos paralelos (`sync_uuid`).
- **Motivo:** Garantiza la coherencia curricular con los estándares del MEN y evita la doble evaluación de un mismo DBA en periodos distintos.
- **Archivos donde se implementa:**
  - [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) (`upsertCompetencyByAdmin`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** HU-COMP-003

---

## 3. Protección de Uso y Bloqueos por Cierre

### RN-COMP-006: Protección contra Eliminaciones Destructivas (`usage-check`)
- **Descripción:** Una competencia no puede eliminarse (`deleteCompetencyByAdmin`) si cuenta con al menos una actividad evaluativa registrada en `actividad_materia` o calificaciones en `nota_criterio`. El endpoint `/usage-check` entrega el desglose de docentes y actividades vinculadas, y el intento de borrado responde con `409 Conflict`.
- **Motivo:** Previene la pérdida de notas y la corrupción de los registros evaluativos de los estudiantes.
- **Archivos donde se implementa:**
  - [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) (`checkCompetenciaUsage`, `deleteCompetencyByAdmin`)
  - [AcademicCompetenciesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicCompetenciesView.vue)
- **Endpoints relacionados:**
  - `GET /api/academic-admin/settings/competencies/:id/usage-check`
  - `DELETE /api/academic-admin/settings/competencies/:id`
- **Historias de usuario relacionadas:** HU-COMP-004

---

### RN-COMP-007: Doble Bloqueo por Cierre Institucional y de Materia
- **Descripción:**
  1. **Bloqueo Institucional:** Se prohíbe crear, editar o eliminar competencias si `periodo_academico.estado === 'CERRADO'` (`409 Conflict`).
  2. **Bloqueo Docente:** Un docente no puede modificar la competencia (`updateCompetency`) si ya efectuó el cierre de su materia en ese periodo mediante `cierre_materia` (`ensureSubjectOpen`).
- **Motivo:** Garantiza la inmutabilidad de las calificaciones y planes de estudio en periodos y materias formalmente clausuradas.
- **Archivos donde se implementa:**
  - [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) (`upsertCompetencyByAdmin`, `deleteCompetencyByAdmin`, `createEvidencia`)
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`updateCompetency`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/settings/competencies`
  - `PUT /api/teacher/competencies/:id`
- **Historias de usuario relacionadas:** HU-COMP-005
