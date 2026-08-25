# 🏅 Módulo 19: Seguimiento Académico, Promoción y Reprobación Anual

**Sistema:** Academia Neiva  
**Módulo:** Consolidación Anual, Matriz de Promoción, Graduación Automática y Decisiones Directivas  
**Última actualización:** 2026-08-17  

---

## 1. Descripción Funcional

El módulo de **Seguimiento Académico, Promoción y Reprobación Anual** administra la evaluación longitudinal y la toma de decisiones de cierre lectivo en AcademiaNeiva. Permite a los directivos consultar el rendimiento de los estudiantes periodo a periodo (individual o acumulativo P1..PN), consolidar los promedios definitivos del año lectivo, clasificar el estado de promoción según las normas institucionales y del MEN, y registrar la decisión directiva con trazabilidad histórica.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               CONSOLIDACIÓN ANUAL, MATRIZ DE PROMOCIÓN Y GRADUACIÓN                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Seguimiento Longitudinal:                                                           │
│    Periodo Individual vs. Acumulado (P1..PN) ──> Promedios y Asignaturas Reprobadas    │
│                                                                                        │
│ 2. Consolidación Anual y Matriz de Promoción:                                          │
│    Promedio Anual = Sum(Notas) / Total Periodos del Año                                │
│    ├── 0 Reprobadas ──────────────> APROBADO                                           │
│    ├── 1 a 2 Reprobadas ──────────> PENDIENTE_RECUPERACION                             │
│    └── >= 3 Reprobadas (o umbral) ─> NO_PROMOVIDO                                      │
│                                                                                        │
│ 3. Toma de Decisiones y Graduación Automática:                                         │
│    Directivo registra Decisión (PROMOVER, MANTENER_GRADO, MATRICULA_CONDICIONADA)      │
│    Si es Estudiante de Último Grado (getMaxGradeIdForSchool) + PROMOVER                │
│    ──> Estado del Alumno = 'GRADUADO' + Inserción en registro_graduados 🎓             │
│                                                                                        │
│ 4. Apoyo a la Matrícula del Siguiente Año:                                             │
│    Endpoint /check-warning emite advertencias informativas en inscripción sin bloquear │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

El módulo abarca:
- **Seguimiento por Periodo / Acumulado:** Conmutación interactiva entre vista individual de un periodo o acumulativa hasta el periodo $N$.
- **Detección Dinámica de Graduandos (`getMaxGradeIdForSchool`):** Identificación algorítmica del grado superior del colegio (sin fijarse a un nombre de grado específico), resaltado visual con insignia 🎓 **"Último Año"** y filtro rápido **"Solo Graduandos"**.
- **Graduación Automática:** Al autorizar la promoción de un alumno en su último año, el backend actualiza su ficha a `GRADUADO` y lo registra oficialmente en `registro_graduados`.
- **Condición de Cierre Mínimo de Periodos (RN-19.5):** Bloqueo de registro de decisiones de promoción si el año lectivo no se encuentra en su periodo final.
- **Advertencias Académicas en Matrícula:** Detección de materias reprobadas en años anteriores durante la formalización de matrícula en `FinalRegistration.vue` vía `/check-warning`.

---

## 2. Actores y Permisos

| Rol | Alcance en el Módulo |
|---|---|
| **Directivo (Rector / Coordinador)** | Acceso a la consola de seguimiento y consolidados anuales (`AcademicTrackingView.vue`), registro y modificación de decisiones de promoción (`recordDirectiveDecision`), consulta de historiales longitudinales y supervisión de graduandos. |
| **Administrador General** | Supervisión global de las decisiones de promoción y graduaciones de cualquier institución educativa. |
| **Docente Titular** | Consulta de consolidados académicos para las comisiones de evaluación. |

---

## 3. Acciones Disponibles y Endpoints de la API

| Acción | Método | Endpoint | Autenticación Requerida | Parámetros / Body Requeridos |
|---|---|---|---|---|
| Seguimiento por periodo o acumulado | `GET` | `/api/academic-admin/academic-tracking/period-tracking` | JWT Directivo | `schoolId`, `yearId`, `periodId?`, `cumulativeUpToPeriodOrder?`, `gradeId?`, `groupId?` |
| Consolidado anual de promoción | `GET` | `/api/academic-admin/academic-tracking/annual-consolidation` | JWT Directivo | `schoolId`, `yearId`, `gradeId?`, `groupId?` |
| Consultar historial multi-anual de estudiante | `GET` | `/api/academic-admin/academic-tracking/student-history/:studentId` | JWT Directivo | `studentId` (URL), `schoolId` (Query) |
| Verificar advertencia académica en matrícula | `GET` | `/api/academic-admin/academic-tracking/check-warning` | JWT Directivo | `documento` (Query) |
| Registrar decisión de promoción directiva | `POST` | `/api/academic-admin/academic-tracking/record-decision` | JWT Directivo | `{ schoolId, studentId, previousYearId, calculatedResult, decisionTaken, previousGradeId?, assignedGradeId?, observation? }` |

---

## 4. Reglas de Negocio

- **RN-PRO-001 (Consolidación Ponderada Anual):** La calificación anual de cada asignatura se calcula dividiendo la sumatoria de las notas obtenidas en los periodos cursados entre el número total de periodos registrados en el año lectivo (`Math.max(periodIds.length, 1)`).
- **RN-PRO-002 (Matriz de Clasificación de Promoción):**
  - **`APROBADO`:** 0 asignaturas reprobadas.
  - **`PENDIENTE_RECUPERACION`:** 1 a 2 asignaturas reprobadas (por debajo de `nota_aprobacion`, defecto 3.0).
  - **`NO_PROMOVIDO`:** 3 o más asignaturas reprobadas (o el umbral configurado en `configuracion_colegio.materias_reprobatorias_promocion`).
- **RN-PRO-003 (Detección Dinámica de Graduandos y Graduación Automática):** La función `getMaxGradeIdForSchool` resuelve el grado superior de la institución. Si la decisión directiva es `PROMOVER_SIGUIENTE_GRADO` sobre un alumno del último grado, el sistema actualiza automáticamente su ficha a `estudiante.estado = 'GRADUADO'`, crea/actualiza su registro en `registro_graduados` y deja `id_grado_asignado = null`.
- **RN-PRO-004 (Condición de Periodo Final para Decisiones — RN-19.5):** No se permite registrar decisiones de promoción anual en `decision_promocion_directivo` si el año escolar no se encuentra en su periodo final o no ha completado el cierre mínimo de periodos (`closedPeriodsCount >= totalPeriodsCount - 1`).
- **RN-PRO-005 (Advertencia Informativa no Bloqueante en Matrícula):** Durante el proceso de matrícula, `/check-warning` evalúa si el estudiante reprobó el año anterior. Si existen reprobaciones, despliega una alerta informativa con el listado de materias reprobadas sin bloquear el trámite de matrícula.
- **RN-PRO-006 (Inmutabilidad de Decisiones en Años Cerrados):** Se prohíbe registrar o modificar decisiones de promoción sobre años lectivos que ya se encuentren formalmente en estado `CERRADO`.

---

## 5. Implementación del Módulo

### Backend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Controlador de Seguimiento y Promoción** | [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts) | `getPeriodAcademicTracking`, `getAnnualConsolidation`, `getStudentAcademicHistory`, `checkStudentAcademicWarning`, `recordDirectiveDecision`, `getMaxGradeIdForSchool`. |
| **Rutas de Administración Académica** | [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts) | Definición y middleware de seguridad para directivos. |

### Frontend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Consola de Seguimiento y Promoción** | [AcademicTrackingView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicTrackingView.vue) | Vista directiva con 3 pestañas: Seguimiento Periodo/Acumulado (filtro graduandos 🎓), Consolidado Anual de Promoción (modal de decisión) e Historial Multi-Anual. |
| **Componente de Advertencia en Matrícula** | [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue) | Alerta interactiva que muestra el historial de reprobación en matrícula. |

---

## 6. Modelo de Datos

### Tabla: `decision_promocion_directivo`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_decision` | SERIAL PK | Identificador único de la decisión. |
| `id_estudiante` | INT FK | Estudiante evaluado. |
| `id_colegio` | INT FK | Colegio propietario. |
| `id_anio_anterior` | INT FK | Año lectivo evaluado. |
| `resultado_calculado` | `resultado_consolidado_anual` | `APROBADO`, `NO_PROMOVIDO`, `PENDIENTE_RECUPERACION`, `PENDIENTE_DECISION`. |
| `decision_tomada` | `decision_promocion_tipo` | `PROMOVER_SIGUIENTE_GRADO`, `MANTENER_GRADO`, `MATRICULA_CONDICIONADA`, `OTRA_DECISION`. |
| `id_grado_anterior` | INT FK (NULLable) | Grado cursado. |
| `id_grado_asignado` | INT FK (NULLable) | Grado de destino (NULL si se gradúa). |
| `id_usuario_decision` | INT FK | Directivo que registró la decisión. |
| `fecha_decision` | TIMESTAMPTZ | Fecha y hora del registro. |
| `observacion` | TEXT (NULLable) | Justificación directiva. |
| *Restricción* | UNIQUE | `UNIQUE (id_estudiante, id_colegio, id_anio_anterior)` |

### Tabla: `registro_graduados`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_graduado` | SERIAL PK | Identificador del registro oficial de graduación. |
| `id_estudiante` | INT FK | Estudiante graduado. |
| `id_anio` | INT FK | Año lectivo en que culminó estudios. |
| `fecha_graduacion` | TIMESTAMPTZ | Fecha oficial de graduación. |
| `observaciones` | TEXT (NULLable) | Anotaciones del acta de grado. |
| `id_usuario_registro` | INT FK | Directivo responsable. |

---

## 7. Conexiones con Otros Módulos

- **→ Cierre de Periodo y Calificaciones:** Consume los resultados de `resultado_academico` y `notas_actividad` de todos los periodos.
- **→ Matrículas e Inscripciones:** Alimenta la advertencia de `/check-warning` durante la formalización en `FinalRegistration.vue`.
- **→ Estudiantes y Estados:** Actualiza el estado del alumno a `GRADUADO` cuando se promueve en el último grado.
- **→ Estructura Escolar:** `getMaxGradeIdForSchool` interactúa con `nivel_escolar` y `tipo_grado` para determinar dinámicamente los graduandos.

---

## 8. Decisiones de Diseño

| Decisión | Justificación Técnica |
|---|---|
| **Detección Dinámica de Último Grado sin Hardcoding** | Permite que colegios que solo ofrecen hasta Primaria (Grado 5°) o Básica Secundaria (Grado 9°) gradúen correctamente a sus estudiantes sin depender de un Grado 11 fijo. |
| **Advertencia no Bloqueante en Matrícula** | Respeta la autonomía directiva institucional para permitir matrículas condicionadas o acuerdos pedagógicos especiales sin trabas rígidas en el software. |
| **Restricción Única por Año y Estudiante** | Garantiza que solo exista una decisión oficial de promoción vigente por estudiante y año lectivo evaluado. |
