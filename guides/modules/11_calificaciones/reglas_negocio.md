# Reglas de Negocio — Calificaciones, Actividades y Evaluación Curricular

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de **Calificaciones y Actividades** de AcademiaNeiva.

---

## 1. Estructura Evaluativa y Ponderaciones

### RN-CAL-001: Estructura Evaluativa Ponderada al 100%
- **Descripción:** 
  1. La sumatoria de las ponderaciones de todas las actividades registradas para una materia y periodo escolar no puede exceder el 100.00%.
  2. Si una actividad se desglosa en criterios de evaluación (`criterio_evaluacion`), la sumatoria de las ponderaciones de sus criterios tampoco puede superar el 100.00%.
  3. Al crear o modificar una actividad o criterio, el backend calcula la suma existente y rechaza la operación con error `400 Bad Request` si la suma supera el límite.
- **Motivo:** Garantiza la coherencia matemática en el cálculo del promedio definitivo del periodo.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createActivity`, `updateActivity`, `createCriterion`)
- **Endpoints relacionados:**
  - `POST /api/teacher/activities`
  - `PUT /api/teacher/activities/:id`
  - `POST /api/teacher/activities/criteria`
- **Historias de usuario relacionadas:** HU-CAL-001, HU-CAL-002

---

### RN-CAL-002: Sincronización Automática Criterio ➔ Actividad
- **Descripción:** Cuando una actividad contiene criterios de evaluación:
  1. Las notas de los estudiantes se guardan individualmente en la tabla `nota_criterio`.
  2. En la misma transacción de `saveGrades`, el backend calcula automáticamente el promedio ponderado de todos los criterios calificados:
     $$\text{Nota Actividad} = \frac{\sum (\text{Nota Criterio} \times \text{Porcentaje Criterio})}{\sum \text{Porcentaje Criterio}}$$
  3. La nota resultante se redondea a un decimal y se inserta o actualiza en la tabla `notas_actividad`, asignándole el `id_escalavaloracion` correspondiente.
- **Motivo:** Evita inconsistencias entre los criterios evaluados y la nota final de la actividad, facilitando la consulta de promedios.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`saveGrades`)
- **Endpoints relacionados:**
  - `POST /api/teacher/grades`
- **Historias de usuario relacionadas:** HU-CAL-002, HU-CAL-004

---

## 2. Justificación Pedagógica y Coherencia DBA

### RN-CAL-003: Control y Justificación de Evidencias Extra/No Planificadas
- **Descripción:** Si el docente asocia a una actividad una evidencia del catálogo oficial de DBA que no formaba parte de la planeación curricular aprobada para el periodo actual en ese grado:
  1. Debe suministrar obligatoriamente un `motivo_extra` (ej. `REFUERZO`, `NIVELACION`, `AVANCE_PROGRAMATICO`, `OTRO`).
  2. Si selecciona el motivo `OTRO`, debe ingresar obligatoriamente una descripción en `justificacion_extra`.
  3. De lo contrario, el backend rechaza la creación de la actividad con error `400 Bad Request`.
- **Motivo:** Permite la flexibilidad pedagógica docente en el aula garantizando la trazabilidad y justificación curricular ante la coordinación académica.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createActivity`, `updateActivity`)
  - [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue)
- **Endpoints relacionados:**
  - `POST /api/teacher/activities`
  - `PUT /api/teacher/activities/:id`
- **Historias de usuario relacionadas:** HU-CAL-003

---

## 3. Matrículas Activas, Rangos y Escala MEN

### RN-CAL-004: Restricción de Calificación por Estado de Matrícula
- **Descripción:** Al persistir calificaciones (`saveGrades`), el backend verifica que todos los estudiantes recibidos tengan matrícula registrada en estado `ACTIVA` o `APROBADA` en la institución educativa. Si se detectan estudiantes en estado `TRASLADADA`, `RETIRADO`, `EXPULSADO` o inactivo, la operación se cancela en su totalidad con error `409 Conflict` detallando los nombres de los alumnos no elegibles.
- **Motivo:** Previene el ingreso accidental de notas sobre estudiantes desvinculados o transferidos a otros colegios.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`saveGrades`)
- **Endpoints relacionados:**
  - `POST /api/teacher/grades`
- **Historias de usuario relacionadas:** HU-CAL-004

---

### RN-CAL-005: Rango Institucional de Calificación y Escala MEN
- **Descripción:**
  1. Toda nota numérica ingresada en `notas_actividad` o `nota_criterio` debe ubicarse estrictamente entre la `nota_minima` y la `nota_maxima` configuradas en `configuracion_colegio` (ej. 1.0 a 5.0).
  2. El backend ubica automáticamente el `id_escalavaloracion` correspondiente según los rangos `valor_minimo` y `valor_maximo` de la tabla `escala_valoracion` institucional (Bajo, Básico, Alto, Superior).
- **Motivo:** Cumple con el Decreto 1290 del MEN colombiano y mantiene la estandarización cualitativa/cuantitativa.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`saveGrades`)
- **Endpoints relacionados:**
  - `POST /api/teacher/grades`
- **Historias de usuario relacionadas:** HU-CAL-004

---

## 4. Doble Candado por Cierre y Triggers SQL

### RN-CAL-006: Doble Bloqueo de Modificación por Cierre
- **Descripción:** Se bloquea cualquier creación, edición o eliminación de actividades, criterios y notas si:
  1. El periodo académico se encuentra formalmente cerrado institucionalmente (`periodo_academico.estado === 'CERRADO'`) (`409 Conflict`).
  2. El docente titular ya ejecutó el cierre de la materia en ese periodo mediante `cierre_materia` (`ensureSubjectOpen`) (`409 Conflict`).
- **Motivo:** Protege la inmutabilidad de los registros académicos una vez finalizadas las evaluaciones.
- **Archivos donde se implementa:**
  - [periodHelpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts) (`ensurePeriodOpen`, `ensureSubjectOpen`)
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts)
- **Endpoints relacionados:**
  - `POST /api/teacher/activities`
  - `PUT /api/teacher/activities/:id`
  - `DELETE /api/teacher/activities/:id`
  - `POST /api/teacher/activities/criteria`
  - `POST /api/teacher/grades`
- **Historias de usuario relacionadas:** HU-CAL-005

---

### RN-CAL-007: Triggers de Base de Datos de Protección Absoluta
- **Descripción:** La función trigger de PostgreSQL `prevent_academic_writes_on_closed_subject` intercepta directamente operaciones `INSERT`, `UPDATE` y `DELETE` en las tablas `actividad_materia`, `criterio_evaluacion`, `notas_actividad` y `nota_criterio`. Si existe un registro en `cierre_materia` para la asignación y periodo, aborta la transacción a nivel de motor SQL.
- **Motivo:** Salvaguarda la integridad de datos ante accesos concurrentes o scripts fuera de la API HTTP.
- **Archivos donde se implementa:**
  - Migración 037 (`prevent_academic_writes_on_closed_subject.sql`)
- **Historias de usuario relacionadas:** HU-CAL-005

---

### RN-CAL-008: Trazabilidad y Autoría de Actividades
- **Descripción:** Toda actividad evaluativa almacena en `id_docente_creador` la referencia al docente titular que la registró en la base de datos, garantizando la trazabilidad histórica ante relevos o suplencias docentes.
- **Motivo:** Mantiene el registro de autoría pedagógica en el historial del curso.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createActivity`)
- **Endpoints relacionados:**
  - `POST /api/teacher/activities`
- **Historias de usuario relacionadas:** HU-CAL-001
