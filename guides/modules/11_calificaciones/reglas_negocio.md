# Reglas de Negocio — Calificaciones y Actividades

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Calificaciones y Actividades de AcademiaNeiva.

---

## Estructura Evaluativa

### RN-CAL-001: Ponderación Porcentual Obligatoria (100%)
- **Descripción:** La estructura evaluativa de una materia en un periodo académico debe cumplir las siguientes reglas de acumulación de porcentajes:
  - La sumatoria de los porcentajes de todas las actividades asociadas a la materia en el periodo debe ser igual al 100%.
  - Si una actividad incluye criterios de evaluación, la sumatoria de los porcentajes de sus criterios debe dar exactamente el 100%.
- **Motivo:** Garantiza que los cálculos de promedios definitivos ponderados sean matemáticamente exactos y consistentes.
- **Módulos afectados:** Calificaciones, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createActivity`, `createCriterion`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/activities`
  - `POST /api/teacher/activities/criteria`
- **Historias de usuario relacionadas:** HU-CAL-001, HU-CAL-002

---

### RN-CAL-002: Destino de Almacenamiento de Calificaciones (Actividad vs Criterio)
- **Descripción:** El backend resolverá la tabla de destino de la calificación según la composición de la actividad:
  - Si la actividad posee criterios en `criterio_evaluacion`, las notas se insertan o actualizan en la tabla `nota_criterio`.
  - Si la actividad **no** posee criterios de evaluación, la nota se guarda en la tabla `notas_actividad`.
- **Motivo:** Permite soportar evaluaciones directas o evaluaciones con desglose multifactorial sin duplicar espacio en base de datos.
- **Módulos afectados:** Calificaciones.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`saveGrades`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/grades`
- **Historias de usuario relacionadas:** HU-CAL-003

---

## Bloqueos e Integridad

### RN-CAL-003: Bloqueo de Calificaciones en Periodo o Materia CERRADA
- **Descripción:** La API de calificaciones rechazará con código de error `409 Conflict` o `403 Forbidden` cualquier intento de crear, editar o eliminar actividades, criterios o calificaciones si el periodo académico o el cierre de la asignatura en `cierre_materia` se encuentra en estado `CERRADO`.
- **Motivo:** Evita alteraciones no autorizadas en notas ya consolidadas e impresas en boletines oficiales.
- **Módulos afectados:** Calificaciones, Configuración Académica, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [periodHelpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts) (`ensureCurrentPeriodOrRespond`, `ensureSubjectOpen`)
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (Validaciones previas en todos los métodos de guardado)
  - [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) (Trigger `fn_bloquear_periodo_cerrado`)
- **Endpoints relacionados:** Todos los endpoints del módulo de calificaciones.
- **Historias de usuario relacionadas:** HU-CAL-001, HU-CAL-003, HU-CAL-004

---

### RN-CAL-004: Distribución Estadística de Calificaciones de Prueba
- **Descripción:** El script de inicialización de datos de prueba (`seed_grades.ts`) utiliza un algoritmo de distribución porcentual para simular un rendimiento estudiantil heterogéneo:
  - Reprobado (1.0 a 2.9): 15% de los alumnos.
  - Básico (3.0 a 3.9): 35% de los alumnos.
  - Alto (4.0 a 4.5): 30% de los alumnos.
  - Superior (4.6 a 5.0): 20% de los alumnos.
- **Motivo:** Garantiza que los gráficos analíticos de las consolas de directivos y docentes muestren distribuciones realistas durante las pruebas.
- **Módulos afectados:** Calificaciones, Dashboard Analítico.
- **Archivos donde se implementa:** 
  - `seed_grades.ts`
- **Endpoints relacionados:** N/A (Script de inicialización)
- **Historias de usuario relacionadas:** N/A

---

### RN-CAL-005: Rango Válido de Nota por Colegio
- **Descripción:** Toda calificación numérica registrada en el sistema debe validarse estrictamente contra los valores `nota_minima` y `nota_maxima` configurados en la tabla `configuracion_colegio` para el plantel escolar.
- **Motivo:** Impide registrar notas negativas o superiores a la nota máxima oficial de la institución (ej. notas superiores a 5.0).
- **Módulos afectados:** Calificaciones, Configuración Académica.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`saveGrades`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/grades`
- **Historias de usuario relacionadas:** HU-CAL-003
