# Reglas de Negocio — Competencias y Sincronización

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Competencias y Sincronización de AcademiaNeiva.

---

## Estructura Curricular

### RN-COM-001: Flexibilidad de Competencias Múltiples
- **Descripción:** El sistema debe permitir el registro de múltiples competencias independientes dentro de la misma asignatura, grupo y periodo académico.
- **Motivo:** Brinda a las instituciones total libertad y adaptabilidad pedagógica para subdividir los objetivos de aprendizaje del trimestre sin restricciones técnicas de base de datos.
- **Módulos afectados:** Competencias y Sincronización, Calificaciones.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`upsertCompetencyByAdmin` - se removió la validación de restricción única anterior)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** HU-COM-001

---

### RN-COM-002: Sincronización en Caliente vía `sync_uuid`
- **Descripción:** Cuando se registra una competencia en el grupo A, el sistema identifica de forma automática a sus grupos paralelos del mismo tipo de grado. Inserta de forma atómica una competencia para cada paralelo y les asocia el mismo identificador `sync_uuid`.
- **Motivo:** Asegura que los planes de estudio de las secciones paralelas de un mismo grado escolar permanezcan unificados y consistentes de forma transparente.
- **Módulos afectados:** Competencias y Sincronización.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`upsertCompetencyByAdmin` - bloque de inserción transaccional de paralelos)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** HU-COM-001, HU-COM-002

---

### RN-COM-003: Propagación de Modificaciones en Lote (Transacciones Atómicas)
- **Descripción:** Cualquier edición en el texto de la competencia o vinculación de evidencias realizada sobre un registro debe propagarse en caliente en la base de datos a todos los registros que compartan su `sync_uuid` bajo una única transacción de base de datos.
- **Motivo:** Evita inconsistencias curriculares entre cursos paralelos si alguna actualización parcial falla en la red de la base de datos.
- **Módulos afectados:** Competencias y Sincronización.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`upsertCompetencyByAdmin`)
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`updateCompetency`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies`
  - `PUT /api/teacher/competencies/:id`
- **Historias de usuario relacionadas:** HU-COM-002

---

### RN-COM-004: Inicialización Automática de Evidencias de Aprendizaje
- **Descripción:** Al crear una competencia curricular nueva, el sistema debe registrar automáticamente en la tabla `evidencia_aprendizaje` un lote de 3 evidencias hijas por defecto.
- **Motivo:** Facilita la labor inicial del directivo o docente al poblar el plan de estudio con cimientos organizativos listos para su posterior personalización.
- **Módulos afectados:** Competencias y Sincronización.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`upsertCompetencyByAdmin` - bucle de evidencias por defecto)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** HU-COM-001

---

## Restricciones Evaluativas

### RN-COM-005: Restricción de Modificación por Uso Evaluativo (Usage-Check)
- **Descripción:** No se permite eliminar ni desvincular una competencia o sus evidencias de aprendizaje asociadas si los docentes ya han registrado actividades de evaluación con notas reales en el curso.
- **Motivo:** Protege la consistencia de los históricos académicos; eliminar una competencia en uso dejaría notas de actividades apuntando a referencias inexistentes en la base de datos.
- **Módulos afectados:** Competencias y Sincronización, Calificaciones.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`checkCompetenciaUsage`, `deleteCompetencyByAdmin`)
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/settings/competencies/:id/usage-check`
  - `DELETE /api/academic-admin/settings/competencies/:id`
- **Historias de usuario relacionadas:** HU-COM-004
