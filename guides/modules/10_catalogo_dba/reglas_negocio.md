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

### RN-DBA-005: Indicadores del Reporte de Coherencia Curricular
- **Descripción:** El Reporte de Coherencia evalúa la fidelidad de las evaluaciones de aula contra lo planeado en el currículo:
  - `Planeada`: Actividad evaluativa cuya evidencia DBA vinculada pertenece a la planeación curricular del periodo.
  - `Extra`: Actividad evaluativa cuya evidencia DBA vinculada no pertenecía a la planeación del periodo (desvío justificado).
  - Fórmula: `Coherencia (%) = (Evaluaciones Planeadas / Total Evaluaciones) * 100`.
- **Motivo:** Facilita la labor de auditoría del directivo escolar al proveerle un resumen automático de desvíos y disciplina curricular.
- **Módulos afectados:** Catálogo DBA, Calificaciones.
- **Archivos donde se implementa:** 
  - [dbaReportsController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/dbaReportsController.ts) (`obtenerReporteCoherenciaCurricular`)
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/settings/dba-reportes/coherencia/:schoolId`
- **Historias de usuario relacionadas:** HU-DBA-004

---

### RN-DBA-006: Métrica de Cobertura del Catálogo Oficial
- **Descripción:** El Reporte de Cobertura evalúa el avance temático institucional con respecto al total de estándares oficiales nacionales asignados:
  - `Total Catálogo`: Suma total de evidencias oficiales del MEN para las áreas y grados asignados en el colegio.
  - `Cubiertas`: Cantidad de evidencias del catálogo que tienen al menos una evaluación registrada en el año escolar.
  - `Pendientes`: Evidencias del catálogo que aún no han sido evaluadas en ninguna clase.
  - Fórmula: `Cobertura (%) = (Evidencias Cubiertas / Total Evidencias Catálogo) * 100`.
- **Motivo:** Permite a la rectoría y directivos medir el porcentaje de avance del programa pedagógico nacional a lo largo del año lectivo.
- **Módulos afectados:** Catálogo DBA, Calificaciones.
- **Archivos donde se implementa:** 
  - [dbaReportsController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/dbaReportsController.ts) (`obtenerReporteCoberturaDba`)
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/settings/dba-reportes/cobertura/:schoolId`
- **Historias de usuario relacionadas:** HU-DBA-004

