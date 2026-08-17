# Reglas de Negocio — Cierre de Periodo y Generación de Boletines

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de **Cierre de Periodo y Boletines** de AcademiaNeiva.

---

## 1. Cierre de Asignatura por el Docente

### RN-CIE-001: Validación de Completitud de Notas en el Aula
- **Descripción:** Antes de autorizar el cierre de una asignatura en un periodo (`closeTeacherSubject`):
  1. El sistema consulta a todos los estudiantes con matrícula `ACTIVA` inscritos en el curso.
  2. Verifica que no existan actividades evaluativas directas sin calificar en `notas_actividad` ni actividades con criterios que tengan criterios pendientes en `nota_criterio`.
  3. Si se detecta algún estudiante con notas faltantes, el backend rechaza la solicitud con error `400 Bad Request`: *"Existen estudiantes con actividades sin calificar"*.
- **Motivo:** Evita promedios incompletos o calificaciones vacías en el boletín final.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`closeTeacherSubject`, `getClosureStatus`)
- **Endpoints relacionados:**
  - `POST /api/teacher/close-period`
  - `GET /api/teacher/closure-status/:detailGradeId/:periodId`
- **Historias de usuario relacionadas:** HU-CIE-001

---

### RN-CIE-002: Justificación Obligatoria de Evidencias DBA Pendientes
- **Descripción:** 
  1. El backend cruza las evidencias de DBA planificadas para el grado, materia y periodo actual contra las evidencias evaluadas en las actividades de la materia (`actividad_evidencia_dba`).
  2. Si existen evidencias planeadas no evaluadas (`unevaluatedEvidences.length > 0`) y el docente no suministró una justificación textual (`justificacion_evidencias_pendientes`), el sistema rechaza la operación con código HTTP `422 Unprocessable Entity` y el payload `{ requires_justification: true, unevaluated_evidences: [...] }`.
  3. El docente debe digitar la explicación pedagógica antes de poder completar el cierre formal.
- **Motivo:** Fomenta la responsabilidad pedagógica y la trazabilidad del cumplimiento curricular ante la coordinación académica.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`closeTeacherSubject`)
  - [TeacherClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherClosure.vue)
- **Endpoints relacionados:**
  - `POST /api/teacher/close-period`
- **Historias de usuario relacionadas:** HU-CIE-001

---

### RN-CIE-003: Persistencia y Trazabilidad del Cierre de Materia
- **Descripción:** Al completarse el cierre de la asignatura, el sistema registra o actualiza en la tabla `cierre_materia`:
  - `estado = 'CERRADO'`
  - `fecha_cierre = NOW()`
  - `justificacion_evidencias_pendientes = texto`
  - `id_docente_cierre = teacherId`
- **Motivo:** Garantiza la inmutabilidad de la materia frente a modificaciones docentes y almacena la auditoría del autor del cierre.
- **Archivos donde se implementa:**
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`closeTeacherSubject`)
- **Endpoints relacionados:**
  - `POST /api/teacher/close-period`
- **Historias de usuario relacionadas:** HU-CIE-001

---

## 2. Cierre Institucional Directivo

### RN-CIE-004: Cierre Institucional del Periodo al 100% de Asignaturas
- **Descripción:** El directivo escolar solo puede aprobar y cerrar formalmente un periodo académico (`approveAcademicPeriod`) si el 100% de las asignaciones académicas activas en `detalle_grados` para el colegio y año lectivo se encuentran en estado `CERRADO` en la tabla `cierre_materia`. Al ejecutarse, actualiza `periodo_academico.estado = 'CERRADO'`.
- **Motivo:** Previene la emisión de boletines con asignaturas pendientes de evaluación.
- **Archivos donde se implementa:**
  - [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) (`approveAcademicPeriod`, `getPeriodClosureDetails`)
  - [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/academic-periods/:periodId/approve`
  - `GET /api/academic-admin/settings/closure-details/:schoolId/:periodId`
- **Historias de usuario relacionadas:** HU-CIE-002

---

### RN-CIE-005: Reapertura Quirúrgica de Materia
- **Descripción:** Por solicitud justificada de un docente, el directivo puede ejecutar `reopenSubjectClosure` para una asignación específica (`id_detallegrado`). Esto elimina el registro de `cierre_materia` correspondiente, reactivando la edición en la planilla docente sin requerir reabrir todo el periodo del plantel educativo.
- **Motivo:** Proporciona flexibilidad operativa para subsanar errores sin desproteger las demás materias del colegio.
- **Archivos donde se implementa:**
  - [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) (`reopenSubjectClosure`)
  - [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/settings/reopen-subject-closure`
- **Historias de usuario relacionadas:** HU-CIE-003

---

## 3. Emisión de Boletines y Algoritmo de Ranking

### RN-CIE-006: Habilitación Estricta de Boletines en Periodo Cerrado
- **Descripción:** La consulta y generación de boletines PDF (`validatePeriodClosed`, `getStudentBoletin`, `getGradeBoletines`) exige que `periodo_academico.estado === 'CERRADO'`. Si el periodo se encuentra en estado `ABIERTO`, los endpoints bloquean la descarga con mensaje explicativo: *"El periodo académico debe estar cerrado para generar boletines"*.
- **Motivo:** Impide que estudiantes o padres descarguen informes con notas preliminares no avaladas institucionalmente.
- **Archivos donde se implementa:**
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (`validatePeriodClosed`, `getStudentBoletin`, `getGradeBoletines`)
- **Endpoints relacionados:**
  - `GET /api/boletines/validate/:id_colegio/:id_periodo`
  - `GET /api/boletines/student/:id_estudiante/:id_periodo`
  - `GET /api/boletines/grade/:id_grupo/:id_periodo`
- **Historias de usuario relacionadas:** HU-CIE-004

---

### RN-CIE-007: Cálculo Dinámico de Ranking y Exclusión de Inactivos
- **Descripción:**
  1. El boletín calcula el promedio general del periodo y determina el puesto relativo del alumno en su curso físico utilizando la función SQL:
     $$\text{puesto} = \text{RANK}() \text{ OVER }(\text{ORDER BY } \text{student\_avg DESC})$$
  2. La población del grupo (`total_grupo`) y el cálculo de puestos incluyen exclusivamente a estudiantes con matrícula en estado `ACTIVA` en el año escolar evaluado.
  3. Los estudiantes en estado `TRASLADADA`, `CANCELADA` o inactivo son ignorados en la generación masiva por curso (`getGradeBoletines`).
- **Motivo:** Garantiza la precisión matemática del ranking de mérito académico sin distorsiones por deserciones escolares.
- **Archivos donde se implementa:**
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (`getStudentBoletin`, `getGradeBoletines`)
- **Endpoints relacionados:**
  - `GET /api/boletines/student/:id_estudiante/:id_periodo`
  - `GET /api/boletines/grade/:id_grupo/:id_periodo`
- **Historias de usuario relacionadas:** HU-CIE-004
