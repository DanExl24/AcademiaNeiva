# Historias de Usuario — Competencias Pedagógicas y Sincronización en Caliente

Este documento detalla las Historias de Usuario del módulo de **Competencias y Sincronización** de AcademiaNeiva.

---

## 1. Planeación Curricular Directiva

### HU-COMP-001: Creación de Multicompetencias con Evidencias por Defecto
- **Como:** Directivo Escolar (Coordinador Académico).
- **Quiero:** Registrar una nueva competencia pedagógica para una asignatura y periodo escolar.
- **Para:** Definir los objetivos de aprendizaje del plan de estudios con indicadores de logro inmediatos.
- **Criterios de Aceptación:**
  1. El formulario permite ingresar la descripción y asociar opcionalmente una dimensión preescolar (`id_dimension`).
  2. Si el periodo académico se encuentra cerrado institucionalmente, el sistema bloquea el registro con error `409 Conflict`.
  3. Si no se asocian evidencias DBA, el sistema inyecta automáticamente 3 evidencias formativas estándar (`ensureDefaultEvidencias`).
  4. La competencia queda disponible para que los docentes creen actividades evaluativas de aula.

---

### HU-COMP-002: Sincronización Transaccional en Cursos Paralelos
- **Como:** Directivo Escolar.
- **Quiero:** Que al crear o editar una competencia en un grupo (ej. 10-A), los cambios se propaguen automáticamente a los cursos paralelos (10-B y 10-C).
- **Para:** Mantener la consistencia del plan de estudios en todo el grado sin realizar parametrizaciones repetitivas.
- **Criterios de Aceptación:**
  1. El backend genera un identificador único `sync_uuid` y replica la competencia en todos los grupos paralelos (`getGradePeerGroups`).
  2. Si ocurre un fallo en la inserción de algún curso paralelo, la transacción se aborta completamente (`ROLLBACK`).
  3. Al editar la descripción, la modificación se propaga a todos los registros con el mismo `sync_uuid`.

---

### HU-COMP-003: Vinculación Exclusiva de Evidencias Oficiales DBA
- **Como:** Directivo Escolar.
- **Quiero:** Vincular evidencias oficiales del catálogo de Derechos Básicos de Aprendizaje (DBA) del MEN a una competencia.
- **Para:** Alinear la planeación del colegio con los estándares nacionales de educación.
- **Criterios de Aceptación:**
  1. El sistema valida que ninguna evidencia seleccionada esté vinculada a otra competencia del mismo año y grado en otro periodo (`alreadyAssignedRes`).
  2. Al confirmarse la vinculación, se eliminan las 3 evidencias por defecto autogeneradas y se asocian las oficiales de DBA.
  3. Las evidencias oficiales se sincronizan en todos los cursos paralelos del grado escolar.

---

### HU-COMP-004: Auditoría y Protección de Uso Evaluativo (`usage-check`)
- **Como:** Directivo Escolar.
- **Quiero:** Comprobar si una competencia ya tiene actividades evaluativas o calificaciones antes de modificarla o eliminarla.
- **Para:** No afectar las notas históricas ni el trabajo evaluativo ya adelantado por los docentes.
- **Criterios de Aceptación:**
  1. El endpoint `/usage-check` expone si la competencia tiene actividades registradas (`isUsed: true`) y desglosa docentes y cursos involucrados.
  2. El intento de eliminar una competencia con actividades evaluativas asociadas responde con error `409 Conflict`.
  3. Si no tiene actividades, la eliminación remueve en cascada las evidencias y réplicas hermanas (`sync_uuid`).

---

## 2. Gestión de Aula por el Docente

### HU-COMP-005: Edición Contextual de Competencias por el Docente
- **Como:** Docente Titular de Asignatura.
- **Quiero:** Ajustar la redacción de la competencia de mi materia desde la planilla de calificaciones.
- **Para:** Contextualizar la meta de aprendizaje según la dinámica pedagógica del aula.
- **Criterios de Aceptación:**
  1. El docente puede modificar la descripción desde su vista de calificaciones (`TeacherGrades.vue`).
  2. La modificación se sincroniza en caliente en todos los cursos paralelos vía `sync_uuid`.
  3. Si el periodo está cerrado o el docente ya cerró la materia en el periodo (`ensureSubjectOpen`), la edición se bloquea con error `409 Conflict`.
