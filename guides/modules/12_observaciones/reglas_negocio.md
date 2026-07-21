# Reglas de Negocio — Observaciones del Estudiante

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Observaciones del Estudiante de AcademiaNeiva.

---

## Clasificación y Obligatoriedad

### RN-OBS-001: Categorización de Observaciones (Enum)
- **Descripción:** Toda anotación registrada en `observacion_estudiante` debe estar clasificada dentro de uno de los cuatro tipos definidos por el enum `tipo_observacion`:
  - `ACADEMICA`: Desempeño y recomendaciones académicas en la materia.
  - `CONVIVENCIA`: Comportamiento social y respeto de normas de aula.
  - `DISCIPLINARIA`: Llamados de atención y seguimiento del manual de convivencia.
  - `OTRO`: Destrezas, puntualidad y reconocimientos.
- **Motivo:** Permite filtrar y presentar de manera ordenada las recomendaciones pedagógicas en las vistas de acudientes y boletines oficiales.
- **Módulos afectados:** Observaciones del Estudiante, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [observationController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/observationController.ts) (`createObservation`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/observations`
- **Historias de usuario relacionadas:** HU-OBS-001

---

### RN-OBS-002: Obligatoriedad de Observación Académica para Cierre
- **Descripción:** Un docente no puede consolidar ni ejecutar el cierre del periodo por materia si existe al menos un estudiante con matrícula activa que no posea una observación de tipo `ACADEMICA` registrada en el periodo.
- **Motivo:** Garantiza que ningún boletín oficial sea emitido con campos vacíos de evaluación cualitativa en el área de recomendaciones.
- **Módulos afectados:** Observaciones del Estudiante, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`closePeriodForTeacher` - verificación de observaciones requeridas)
- **Endpoints relacionados:** 
  - `POST /api/teacher/close-period`
- **Historias de usuario relacionadas:** HU-OBS-001

---

## Integración e Inmutabilidad

### RN-OBS-003: Impresión Automática en Boletines PDF
- **Descripción:** Las observaciones de tipo `ACADEMICA` asociadas a una asignatura se extraen de forma automática al generar el boletín y se imprimen bajo la calificación numérica de la materia correspondiente.
- **Motivo:** Brinda a los padres de familia una visión integral (cuantitativa y cualitativa) del proceso educativo del estudiante en un solo documento.
- **Módulos afectados:** Observaciones del Estudiante, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (Lógica de extracción de observaciones en la generación de boletín)
- **Endpoints relacionados:** 
  - `GET /api/boletines/student/:id_estudiante/:id_periodo`
- **Historias de usuario relacionadas:** HU-OBS-003

---

### RN-OBS-004: Inmutabilidad por Periodo Cerrado (Trigger SQL)
- **Descripción:** El trigger de base de datos `fn_bloquear_periodo_cerrado` abortará cualquier sentencia `INSERT`, `UPDATE` o `DELETE` sobre la tabla `observacion_estudiante` si el periodo al que pertenece la anotación se encuentra en estado `CERRADO`.
- **Motivo:** Protege la integridad del observador del alumno e impide alteraciones retroactivas en el historial disciplinario.
- **Módulos afectados:** Observaciones del Estudiante, Configuración Académica.
- **Archivos donde se implementa:** 
  - [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) (Trigger `fn_bloquear_periodo_cerrado`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/observations`
  - `PUT /api/teacher/observations/:id`
  - `DELETE /api/teacher/observations/:id`
- **Historias de usuario relacionadas:** HU-OBS-002
