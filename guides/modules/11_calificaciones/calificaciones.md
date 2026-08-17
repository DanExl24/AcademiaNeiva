# 📊 Módulo de Calificaciones, Actividades y Evaluación Curricular

**Sistema:** Academia Neiva  
**Módulo:** Registro de Calificaciones, Criterios Porcentuales y Evaluación Formativa  
**Última actualización:** 2026-08-17  

---

## 1. Descripción Funcional

El módulo de **Calificaciones y Actividades** regula la evaluación del rendimiento escolar en AcademiaNeiva. Permite a los docentes diseñar actividades evaluativas dentro de sus asignaturas, ponderar su peso porcentual acumulativo (hasta el 100%), desglosarlas opcionalmente en criterios independientes y registrar calificaciones de forma masiva en planillas interactivas.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      JERARQUÍA Y REGISTRO DE EVALUACIÓN ESCOLAR                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Asignación Académica (detalle_grados: Docente - Materia - Grupo)                       │
│    └── Periodo Académico (periodo_academico)                                           │
│           └── Actividades Evaluativas (actividad_materia) [Sumatoria <= 100%]           │
│                  ├── Directa ──> notas_actividad (id_escalavaloracion)                 │
│                  └── Con Criterios (criterio_evaluacion) [Sumatoria <= 100%]           │
│                         └── nota_criterio ──> [Promedio Ponderado] ──> notas_actividad │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

El módulo proporciona:
- **Estructura Evaluativa Dual:** Actividades directas (calificación única) o actividades desglosadas por criterios porcentuales (ej. *Exposición 40%, Trabajo Escrito 60%*).
- **Sincronización Automática Criterio ➔ Actividad:** Al guardar notas de criterios en `saveGrades`, el backend calcula automáticamente el promedio ponderado y actualiza `notas_actividad` asociando la escala de valoración institucional correspondiente.
- **Control de Evidencias DBA No Planificadas / Extra:** Si un docente evalúa evidencias oficiales de DBA no incluidas en la planeación del periodo actual, el sistema exige un `motivo_extra` y una `justificacion_extra` pedagógica.
- **Validación Estricta de Matrícula Activa:** Bloqueo `409 Conflict` contra el registro de calificaciones sobre estudiantes en estado `TRASLADADA`, `RETIRADO` o inactivo.
- **Doble Candado de Cierre y Triggers SQL:** Bloqueo de edición si el periodo institucional está cerrado o si el docente ya efectuó el cierre de la materia (`cierre_materia`), respaldado por triggers a nivel de motor PostgreSQL (`prevent_academic_writes_on_closed_subject`).
- **Mapeo Automático a Escala Nacional MEN:** Vinculación dinámica de la nota cuantitativa con los niveles de desempeño (`BAJO`, `BASICO`, `ALTO`, `SUPERIOR`).

---

## 2. Actores y Permisos

| Rol | Alcance en el Módulo |
|---|---|
| **Docente Titular** | Administración de actividades y criterios evaluativos de sus asignaturas asignadas (`detalle_grados`). Registro, edición y guardado masivo de calificaciones en planillas de aula. |
| **Directivo (Rector / Coordinador)** | Auditoría global de notas, reapertura de materias cerradas y supervisión del cumplimiento de aforos y notas mínimas. |
| **Estudiante y Padre de Familia** | Consulta en tiempo real del desglose de actividades, notas porcentuales y escala de desempeño obtenida por periodo. |

---

## 3. Acciones Disponibles y Endpoints de la API

| Acción | Método | Endpoint | Autenticación Requerida | Parámetros / Body Requeridos |
|---|---|---|---|---|
| Listar estudiantes del curso | `GET` | `/api/teacher/students/:gradeId` | JWT Docente | `gradeId` (URL) |
| Listar actividades y criterios del curso | `GET` | `/api/teacher/activities/:gradeId/:subjectId/:periodId` | JWT Docente | `gradeId`, `subjectId`, `periodId` (URL), `userId` (Query opcional) |
| Crear actividad evaluativa | `POST` | `/api/teacher/activities` | JWT Docente | `{ id_competencia?, id_detallegrado?, id_periodo?, nombre, porcentaje, id_colegio, id_evidencia?, evidencias_dba?, motivo_extra?, justificacion_extra? }` |
| Actualizar actividad evaluativa | `PUT` | `/api/teacher/activities/:id` | JWT Docente | `id` (URL), `{ nombre, porcentaje, id_evidencia?, evidencias_dba?, motivo_extra?, justificacion_extra? }` |
| Eliminar actividad evaluativa | `DELETE` | `/api/teacher/activities/:id` | JWT Docente | `id` (URL) |
| Crear criterio de evaluación | `POST` | `/api/teacher/activities/criteria` | JWT Docente | `{ id_actividadmateria, descripcion, porcentaje, id_colegio, id_evidencia? }` |
| Eliminar criterio de evaluación | `DELETE` | `/api/teacher/activities/criteria/:id` | JWT Docente | `id` (URL) |
| Obtener planilla de calificaciones | `GET` | `/api/teacher/grades/:gradeId/:subjectId/:periodId` | JWT Docente | `gradeId`, `subjectId`, `periodId` (URL) |
| Guardar calificaciones masivamente | `POST` | `/api/teacher/grades` | JWT Docente | `{ schoolId, activityGrades: [{ id_actividadmateria, id_estudiante, nota }], criteriaGrades: [{ id_criterio, id_estudiante, nota }] }` |
| Consultar notas del estudiante por periodo | `GET` | `/api/student/grades/:id_estudiante/:id_periodo` | JWT Estudiante / Padre | `id_estudiante`, `id_periodo` (URL) |
| Consultar detalle de actividades por materia | `GET` | `/api/student/grade-details/:id_estudiante/:id_periodo/:id_materia` | JWT Estudiante / Padre | `id_estudiante`, `id_periodo`, `id_materia` (URL) |

---

## 4. Reglas de Negocio

- **RN-CAL-001 (Estructura Evaluativa Ponderada al 100%):** La sumatoria de los porcentajes de todas las actividades creadas para una materia y periodo no puede superar el 100.00%. Si una actividad contiene criterios, la sumatoria de sus porcentajes tampoco puede exceder el 100.00%.
- **RN-CAL-002 (Sincronización Automática Criterio ➔ Actividad):** Cuando una actividad contiene criterios de evaluación, las notas se ingresan en `nota_criterio`. El backend calcula de forma transaccional el promedio ponderado `(sum(nota * porcentaje) / total_peso)` y lo almacena automáticamente en `notas_actividad`.
- **RN-CAL-003 (Justificación de Evidencias Extra/No Planificadas):** Si el docente asocia a una actividad una evidencia de DBA que no estaba planificada en el periodo actual para ese grado escolar, debe seleccionar obligatoriamente un `motivo_extra` (ej. *REFUERZO, NIVELACION, AVANCE_PROGRAMATICO, OTRO*) y detallar `justificacion_extra` si el motivo es *OTRO*.
- **RN-CAL-004 (Validación Estricta de Matrícula Activa):** El guardado masivo de calificaciones (`saveGrades`) comprueba que todos los estudiantes pertenezcan a la institución con matrícula en estado `ACTIVA` o `APROBADA`. Si hay alumnos inactivos o trasladados, la transacción se cancela con error `409 Conflict`.
- **RN-CAL-005 (Rango Institucional de Calificación y Escala MEN):** Toda nota numérica debe situarse estrictamente entre `nota_minima` y `nota_maxima` configuradas en `configuracion_colegio`. El sistema asocia automáticamente el `id_escalavaloracion` según el rango numérico (Bajo, Básico, Alto, Superior).
- **RN-CAL-006 (Doble Bloqueo de Modificación por Cierre):** Se prohíbe crear, editar o eliminar actividades, criterios y notas si el `periodo_academico.estado === 'CERRADO'` o si el docente ya ejecutó el cierre de materia (`cierre_materia`).
- **RN-CAL-007 (Triggers SQL de Protección Absoluta):** Triggers en base de datos (`prevent_academic_writes_on_closed_subject`) bloquean cualquier mutación directa sobre `actividad_materia`, `criterio_evaluacion`, `notas_actividad` y `nota_criterio` cuando existe un registro de cierre formal.
- **RN-CAL-008 (Trazabilidad Docente):** Toda actividad registra en `id_docente_creador` la referencia al docente que la diseñó originalmente.

---

## 5. Implementación del Módulo

### Backend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Controlador de Calificaciones** | [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) | `getActivities`, `createActivity`, `updateActivity`, `deleteActivity`, `createCriterion`, `deleteCriterion`, `getGrades`, `saveGrades`, `resolveTeachingContext`. |
| **Controlador Portal Estudiante** | [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) | `getStudentGrades`, `getSubjectGradeDetails`. |
| **Helpers de Validación de Periodo** | [periodHelpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts) | `ensurePeriodOpen`, `ensureSubjectOpen`, `ensureCurrentPeriodForSchool`. |
| **Rutas de Calificaciones** | [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts), [student.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/student.routes.ts) | Definición y middlewares de seguridad. |

### Frontend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Planilla Docente de Calificaciones** | [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue) | Planilla de calificaciones con cálculo en tiempo real, creación de actividades/criterios y selector de evidencias DBA. |
| **Detalle de Asignatura Estudiante** | [SubjectDetailsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/SubjectDetailsView.vue) | Desglose porcentual de notas, criterios y escala alcanzada. |

---

## 6. Modelo de Datos

### Tabla: `actividad_materia`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_actividadmateria` | SERIAL PK | Identificador único de la actividad. |
| `id_detallegrado` | INT FK | Asignación docente-materia-grupo. |
| `id_periodo` | INT FK | Periodo académico correspondiente. |
| `nombre` | VARCHAR(255) | Título de la actividad. |
| `porcentaje` | NUMERIC(5,2) | Peso porcentual en el periodo (ej. 25.00). |
| `id_colegio` | INT FK | Colegio propietario. |
| `id_competencia` | INT FK | Competencia pedagógica anclada. |
| `id_evidencia` | INT FK (NULLable) | Evidencia de aprendizaje asociada. |
| `motivo_extra` | VARCHAR(50) (NULLable) | Causa pedagógica si la evidencia no estaba planificada. |
| `justificacion_extra` | TEXT (NULLable) | Justificación si el motivo es 'OTRO'. |
| `id_docente_creador` | INT FK | Docente autor de la actividad. |

### Tabla: `criterio_evaluacion`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_criterio` | SERIAL PK | Identificador del criterio. |
| `id_actividadmateria` | INT FK | Actividad padre (ON DELETE CASCADE). |
| `descripcion` | TEXT | Enunciado del criterio. |
| `porcentaje` | NUMERIC(5,2) | Peso porcentual dentro de la actividad (ej. 50.00). |
| `id_colegio` | INT FK | Colegio propietario. |

### Tabla: `notas_actividad`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_notaactividad` | SERIAL PK | Identificador de la calificación de actividad. |
| `id_actividadmateria` | INT FK | Actividad evaluada. |
| `id_estudiante` | INT FK | Estudiante evaluado. |
| `nota` | NUMERIC(5,2) | Calificación numérica (ej. 4.3). |
| `id_escalavaloracion` | INT FK | Escala MEN institucional asociada. |
| `id_colegio` | INT FK | Colegio propietario. |
| *Restricción* | UNIQUE | `UNIQUE (id_actividadmateria, id_estudiante)` |

### Tabla: `nota_criterio`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_nota_criterio` | SERIAL PK | Identificador de la calificación de criterio. |
| `id_criterio` | INT FK | Criterio evaluado. |
| `id_estudiante` | INT FK | Estudiante evaluado. |
| `nota` | NUMERIC(5,2) | Calificación numérica (ej. 4.0). |
| `id_colegio` | INT FK | Colegio propietario. |
| *Restricción* | UNIQUE | `UNIQUE (id_criterio, id_estudiante)` |

---

## 7. Conexiones con Otros Módulos

- **→ Configuración Académica:** Consume la escala de valoración institucional (`escala_valoracion`) y los límites `nota_minima` y `nota_maxima`.
- **→ Competencias y DBA:** Cada actividad se ancla a una `id_competencia` y a evidencias oficiales o formativas.
- **→ Matrículas:** Valida el estado de matrícula activa antes de persistir calificaciones.
- **→ Cierre de Periodo y Boletines:** Las calificaciones de `notas_actividad` constituyen la fuente de cálculo para el promedio final de asignatura en `cierre_materia` y boletines escolares.

---

## 8. Decisiones de Diseño

| Decisión | Justificación Técnica |
|---|---|
| **Estructura Híbrida Directa / Criterios** | Brinda total flexibilidad pedagógica: permite calificar actividades simples directamente o desglosarlas en múltiples rúbricas porcentuales. |
| **Sincronización Transaccional Criterio ➔ Actividad** | Consolida automáticamente el promedio ponderado de los criterios en la tabla padre `notas_actividad`, optimizando consultas de boletines sin necesidad de recálculos complejos. |
| **Bloqueo Redundante por Triggers SQL** | Previene que cualquier mutación por fuera de la capa HTTP (ej. scripts o llamadas no controladas) altere notas en materias formalmente cerradas. |
