# Reglas de Negocio — Seguimiento Académico, Promoción y Reprobación Anual

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de **Seguimiento Académico y Promoción Anual** de AcademiaNeiva.

---

## 1. Consolidación Anual y Matriz de Promoción

### RN-PRO-001: Consolidación Ponderada Anual por Asignatura
- **Descripción:** 
  1. La calificación final anual de una materia se calcula promediando las notas obtenidas en los periodos del año lectivo:
     $$\text{Promedio Anual} = \frac{\sum \text{Nota Periodo}}{\max(\text{Total Periodos del Año}, 1)}$$
  2. Si una asignatura no registra notas en algún periodo, dicho periodo computa con nota 0 en el divisor institucional.
- **Motivo:** Asegura un cálculo equitativo y estandarizado del rendimiento anual del estudiante.
- **Archivos donde se implementa:**
  - [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts) (`getAnnualConsolidation`, `checkStudentAcademicWarning`)
- **Endpoints relacionados:**
  - `GET /api/academic-admin/academic-tracking/annual-consolidation`
- **Historias de usuario relacionadas:** HU-PRO-001

---

### RN-PRO-002: Matriz Institucional de Clasificación de Promoción
- **Descripción:** El sistema clasifica el resultado anual calculado del estudiante según los umbrales configurados:
  - **`APROBADO`:** 0 materias reprobadas (todas $\ge \text{nota\_aprobacion}$, defecto 3.0).
  - **`PENDIENTE_RECUPERACION`:** Entre 1 y el umbral de reprobación menos 1 (por defecto 1 a 2 materias reprobadas).
  - **`NO_PROMOVIDO`:** Cantidad de materias reprobadas $\ge \text{materias\_reprobatorias\_promocion}$ (por defecto 3 materias).
- **Motivo:** Cumple con los criterios de evaluación y promoción del Decreto 1290 del MEN colombiano.
- **Archivos donde se implementa:**
  - [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts) (`getAnnualConsolidation`, `getMinFailingSubjectsCount`)
- **Endpoints relacionados:**
  - `GET /api/academic-admin/academic-tracking/annual-consolidation`
- **Historias de usuario relacionadas:** HU-PRO-001

---

## 2. Graduación Dinámica y Toma de Decisiones

### RN-PRO-003: Detección Dinámica de Graduandos y Graduación Automática
- **Descripción:**
  1. `getMaxGradeIdForSchool` consulta dinámicamente el `id_tipo_grado` con mayor nivel y orden en el colegio (ej. Grado 11, o Grado 5° en instituciones solo de primaria).
  2. Al registrar una decisión directiva (`recordDirectiveDecision`), si el alumno pertenece a este último grado y la decisión es `PROMOVER_SIGUIENTE_GRADO`:
     - Actualiza automáticamente `estudiante.estado = 'GRADUADO'`.
     - Inserta o actualiza la ficha oficial en `registro_graduados` con fecha, directivo y observaciones.
     - Asigna `id_grado_asignado = null` en la tabla `decision_promocion_directivo`.
  3. Si la decisión es modificada posteriormente a un valor diferente de promover, el estado del alumno revierte a `ACTIVO`.
- **Motivo:** Automatiza la expedición de graduaciones para alumnos que culminan su ciclo formativo en cualquier tipo de plantel.
- **Archivos donde se implementa:**
  - [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts) (`getMaxGradeIdForSchool`, `recordDirectiveDecision`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/academic-tracking/record-decision`
- **Historias de usuario relacionadas:** HU-PRO-002

---

### RN-PRO-004: Condición de Cierre Mínimo de Periodos (RN-19.5)
- **Descripción:** No se permite registrar ni modificar decisiones de promoción anual en `decision_promocion_directivo` si el año lectivo no ha llegado a su periodo final (`closedPeriodsCount < totalPeriodsCount - 1`). El backend rechaza la solicitud con error `400 Bad Request`.
- **Motivo:** Impide tomar decisiones de promoción prematuras antes de que los estudiantes concluyan el ciclo lectivo.
- **Archivos donde se implementa:**
  - [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts) (`recordDirectiveDecision`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/academic-tracking/record-decision`
- **Historias de usuario relacionadas:** HU-PRO-003

---

### RN-PRO-005: Advertencias Académicas Informativas en Matrícula
- **Descripción:** Al consultar un estudiante por su documento en la formalización de matrícula (`FinalRegistration.vue`), el endpoint `/check-warning`:
  1. Evalúa las calificaciones del año lectivo inmediatamente anterior.
  2. Si el estudiante reprueba materias o cuenta con decisión de `MANTENER_GRADO`, retorna `warning: true` con el detalle de las asignaturas reprobadas.
  3. La interfaz despliega la advertencia al directivo de manera informativa, permitiendo continuar con la matrícula sin bloqueos arbitrarios.
- **Motivo:** Informa al directivo sobre la condición pedagógica del estudiante garantizando su autonomía en la admisión.
- **Archivos donde se implementa:**
  - [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts) (`checkStudentAcademicWarning`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Endpoints relacionados:**
  - `GET /api/academic-admin/academic-tracking/check-warning`
- **Historias de usuario relacionadas:** HU-PRO-004

---

### RN-PRO-006: Inmutabilidad de Decisiones en Ciclos Cerrados
- **Descripción:** Se prohíbe el registro o modificación de decisiones de promoción si el año lectivo evaluado ya se encuentra formalmente en estado `CERRADO` (`anio_lectivo.estado === 'CERRADO'`) (`400 Bad Request`).
- **Motivo:** Preserva la inmutabilidad histórica de los expedientes escolares concluidos.
- **Archivos donde se implementa:**
  - [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts) (`recordDirectiveDecision`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/academic-tracking/record-decision`
- **Historias de usuario relacionadas:** HU-PRO-003
