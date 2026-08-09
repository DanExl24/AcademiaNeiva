# Reglas de Negocio — Cierre y Boletines

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Cierre y Boletines de AcademiaNeiva.

---

## Consolidación de Calificaciones

### RN-CIE-001: Consolidación Persistente en `resultado_academico`
- **Descripción:** Al ejecutar `closePeriodForTeacher`, el backend calculará la nota promedio ponderada del estudiante en base a sus actividades evaluativas, consultará la escala descriptiva del colegio (`escala_valoracion`), contabilizará las inasistencias y almacenará de forma persistente la fila en `resultado_academico`.
- **Motivo:** Evita recalcular promedios complejos y consultas pesadas en tiempo de generación de boletines PDF masivos.
- **Módulos afectados:** Cierre y Boletines, Calificaciones, Asistencia.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`closePeriodForTeacher`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/close-period`
- **Historias de usuario relacionadas:** HU-BOL-001

---

### RN-CIE-002: Prerrequisito de 100% de Asignaturas Cerradas
- **Descripción:** El Administrador General o Directivo no podrá ejecutar la aprobación ni el cierre institucional de un periodo escolar si no el 100% de las asignaturas asignadas en `detalle_grados` para ese periodo cuentan con estado `CERRADO` en la tabla `cierre_materia`.
- **Motivo:** Garantiza que ningún estudiante reciba un boletín incompleto con asignaturas o notas faltantes.
- **Módulos afectados:** Cierre y Boletines, Configuración Académica.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`approveAcademicPeriod`, `getPeriodClosureDetails`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods/:id/approve`
  - `GET /api/academic-admin/settings/closure-details/:schoolId/:periodId`
- **Historias de usuario relacionadas:** HU-BOL-002

---

## Control de Impresión y Descargas

### RN-CIE-003: Bloqueo de Descarga de Boletines en Periodo ABIERTO
- **Descripción:** Las funciones de generación de boletines PDF (`getStudentBoletin`, `getGradeBoletines`) verificarán primero el estado del periodo en `periodo_academico`. Si el estado es `ABIERTO` o `PENDIENTE`, responderán con error impidiendo la emisión del informe.
- **Motivo:** Evita la entrega de boletines parciales o preliminares no oficializados por el consejo académico del colegio.
- **Módulos afectados:** Cierre y Boletines, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (`validatePeriodClosed`, `getStudentBoletin`, `getGradeBoletines`)
- **Endpoints relacionados:** 
  - `GET /api/boletines/validate/:id_colegio/:id_periodo`
  - `GET /api/boletines/student/:id_estudiante/:id_periodo`
  - `GET /api/boletines/grade/:id_grupo/:id_periodo`
- **Historias de usuario relacionadas:** HU-BOL-003, HU-BOL-004

---

### RN-CIE-004: Exclusión de Matrículas Canceladas en Generación Masiva
- **Descripción:** La consulta de generación masiva de boletines por grupo excluye de forma automática a todos los estudiantes cuyo estado de matrícula en `matricula` sea `CANCELADA` en el año escolar en curso.
- **Motivo:** Evita imprimir boletines oficiales a estudiantes expulsados o retirados que ya no pertenecen a la comunidad escolar.
- **Módulos afectados:** Cierre y Boletines, Estudiantes y Estados.
- **Archivos donde se implementa:** 
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (`getGradeBoletines` - cláusula sql WHERE m.estado IN ('ACTIVA', 'TRASLADADA'))
- **Endpoints relacionados:** 
  - `GET /api/boletines/grade/:id_grupo/:id_periodo`
- **Historias de usuario relacionadas:** HU-BOL-004

---

### RN-CIE-005: Reapertura Individual de Asignatura (Bypass Directivo)
- **Descripción:** Si se aprueba la reapertura de una asignatura (`reopenSubjectClosure`), el backend elimina la fila en `cierre_materia`. La materia pasa a estar `ABIERTA` únicamente para ese docente sin necesidad de reabrir el periodo del colegio.
- **Motivo:** Permite corregir notas de forma controlada sin exponer las asignaturas consolidadas de otros docentes a cambios.
- **Módulos afectados:** Cierre y Boletines, Configuración Académica.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`reopenSubjectClosure`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods/:periodId/reopen-subject/:detailGradeId`
- **Historias de usuario relacionadas:** HU-BOL-002

---

### RN-CIE-006: Sincronización Automática de Calificaciones por Criterios en Cierre
- **Descripción:** Al guardar calificaciones por criterios (`nota_criterio`), el sistema calcula automáticamente el promedio ponderado por estudiante/actividad y lo refleja en `notas_actividad`. Durante las verificaciones de cierre (`getClosureStatus` y `closeTeacherSubject`), la consulta determina de forma transparente si una actividad utiliza notas directas o por criterios para validar que el 100% de los estudiantes activos hayan sido calificados.
- **Motivo:** Asegura un único punto de verdad para el cálculo de promedios al momento del cierre de materia.
- **Módulos afectados:** Calificaciones, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`saveGrades`, `getClosureStatus`, `closeTeacherSubject`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/grades`
  - `GET /api/teacher/closure-status/:detailGradeId/:periodId`
  - `POST /api/teacher/close-period`
- **Historias de usuario relacionadas:** HU-BOL-001

---

### RN-CIE-007: Trazabilidad del Docente Responsable del Cierre (`id_docente_cierre`)
- **Descripción:** Al ejecutar el cierre de materia, el backend persiste el ID del docente en la columna `id_docente_cierre` de `cierre_materia`. La API `getClosureStatus` retorna el nombre del docente que ejecutó el cierre (`docente_cierre_nombre`), permitiendo que si la asignación cambia en `detalle_grados`, el nuevo docente continúe observando el distintivo indicando quién realizó el cierre en ese periodo.
- **Motivo:** Preserva la responsabilidad y auditoría histórica sobre el cierre académico.
- **Módulos afectados:** Cierre y Boletines.
- **Archivos donde se implementa:** 
  - `036_add_id_docente_cierre_to_cierre_materia.sql`
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts)
  - [TeacherClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherClosure.vue)
- **Endpoints relacionados:** 
  - `POST /api/teacher/close-period`
  - `GET /api/teacher/closure-status/:detailGradeId/:periodId`
- **Historias de usuario relacionadas:** HU-BOL-001

