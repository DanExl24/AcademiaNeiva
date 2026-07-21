# Reglas de Negocio — Catálogo DBA

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Catálogo DBA de AcademiaNeiva.

---

## Planificación e Integración

### RN-DBA-001: Exclusividad Curricular de Evidencias (Relación 1-to-1)
- **Descripción:** Una evidencia oficial del catálogo nacional DBA solo puede ser vinculada a **máximo una única competencia** por asignatura, grado (incluyendo sus cursos paralelos) y año lectivo de la institución.
- **Motivo:** Evita duplicar esfuerzos pedagógicos de evaluación y garantiza la correspondencia directa en las planillas de los docentes.
- **Módulos afectados:** Catálogo DBA, Competencias y Sincronización.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`vincularEvidenciasDbaACompetencia` - query de validación de colisiones)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencias/:competenciaId/vincular-evidencias-dba`
- **Historias de usuario relacionadas:** HU-DBA-003

---

### RN-DBA-002: Prevención Atómica de Colisión de Planeación
- **Descripción:** Antes de guardar cualquier vinculación de evidencias DBA, el backend consulta si alguna de las evidencias enviadas ya está asociada a otra competencia en el grado, materia y año lectivo. De hallarse duplicidad, la transacción completa se aborta con error `400 Bad Request` indicando la colisión.
- **Motivo:** Asegura la integridad y consistencia del plan de estudios impidiendo solapamientos curriculares.
- **Módulos afectados:** Catálogo DBA, Competencias y Sincronización.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`vincularEvidenciasDbaACompetencia` - cláusulas de control SQL)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencias/:competenciaId/vincular-evidencias-dba`
- **Historias de usuario relacionadas:** HU-DBA-003

---

### RN-DBA-003: Justificación Obligatoria de Evidencias Extras
- **Descripción:** Si el docente registra una actividad enlazada a una evidencia DBA no planificada para el periodo actual o no planificada en el año (Evidencia Extra), el sistema exige registrar el `motivo_extra`. Si el motivo es `'OTRO'`, es mandatorio redactar el campo `justificacion_extra`.
- **Motivo:** Asegura el control institucional sobre los desvíos del plan de estudios y provee de justificaciones claras a la rectoría en caso de auditorías.
- **Módulos afectados:** Catálogo DBA, Calificaciones.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`createActivity` - validación de campos extra)
- **Endpoints relacionados:** 
  - `POST /api/teacher/activities`
- **Historias de usuario relacionadas:** HU-DBA-005

---

## Restricciones por Grado (Transición)

### RN-DBA-004: Delimitación del Grado Transición
- **Descripción:** Para cumplir con la normatividad de educación infantil en Colombia:
  - Los DBA de grado Transición pertenecen de forma exclusiva al área curricular de Transición y no se pueden asociar a asignaturas regulares de primaria (Matemáticas, Lengua, etc.).
  - Los DBA de primaria o secundaria no se pueden vincular bajo ningún concepto al grado Transición.
  - Los DBA de Transición se pueden asociar opcionalmente a las Dimensiones Pedagógicas oficiales (Comunicativa, Cognitiva, Corporal, etc.).
- **Motivo:** Protege el enfoque del desarrollo infantil de preescolar, evitando imponer estructuras de calificaciones tradicionales a edades tempranas.
- **Módulos afectados:** Catálogo DBA, Competencias y Sincronización.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`vincularEvidenciasDbaACompetencia`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencias/:competenciaId/vincular-evidencias-dba`
- **Historias de usuario relacionadas:** HU-DBA-003

---

## Analíticas de Coherencia

### RN-DBA-005: Indicadores del Reporte de Coherencia
- **Descripción:** El Reporte de Coherencia clasifica el estado de cada evidencia en base a las actividades creadas:
  - `Cumple`: Evidencia planeada en el periodo que posee al menos una actividad registrada por el docente en el trimestre.
  - `Pendiente`: Evidencia planeada que no posee ninguna actividad registrada en el trimestre.
  - `Extra`: Evidencia evaluada en el periodo en el cual no estaba planeada originalmente.
- **Motivo:** Facilita la labor de auditoría del directivo escolar al proveerle de un resumen automático de desvíos y cumplimiento curricular.
- **Módulos afectados:** Catálogo DBA, Calificaciones.
- **Archivos donde se implementa:** 
  - [dbaReportsController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/dbaReportsController.ts) (`obtenerReporteCoherenciaCurricular`)
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/settings/dba-reportes/coherencia/:schoolId`
- **Historias de usuario relacionadas:** HU-DBA-004
