# Reglas de Negocio — Estructura Escolar

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Estructura Escolar de AcademiaNeiva.

---

## Estructura y Jerarquía

### RN-EST-001: Jerarquía Organizacional Académica
- **Descripción:** El sistema debe forzar una jerarquía de tres niveles para la oferta escolar: cada colegio contiene un `nivel_escolar` (ej. Primaria), el cual agrupa a varios `tipo_grado` (ej. Primero), los cuales se desglosan en `grupos` o salones físicos (ej. Primero A).
- **Motivo:** Asegura la consistencia estructural requerida para estructurar matrículas oficiales, boletines académicos y reportes analíticos del MEN.
- **Módulos afectados:** Estructura Escolar, Matrículas, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createGradeType`, `createGroup`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/grade-types`
  - `POST /api/academic-admin/groups`
- **Historias de usuario relacionadas:** HU-EST-001, HU-EST-002

---

### RN-EST-002: Identificación de Cursos Paralelos (Peer Groups)
- **Descripción:** Todos los grupos que comparten el mismo `id_tipo_grado` (ej. Primero A, Primero B y Primero C) en el mismo año lectivo se catalogan internamente como cursos paralelos o "peer groups".
- **Motivo:** Permite agruparlos lógicamente para la vinculación en cascada de competencias y evidencias DBA del mismo nivel escolar.
- **Módulos afectados:** Estructura Escolar, Competencias y Sincronización, Catálogo DBA.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (Lógica de obtención de grupos paralelos en creación de competencias)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/competencies`
- **Historias de usuario relacionadas:** N/A

---

## Cupos y Limitaciones

### RN-EST-003: Restricción de Cupos Máximos en Aula
- **Descripción:** La cantidad de estudiantes asignados y matriculados activos en un grupo no puede exceder el límite establecido por el directivo en la columna `cupos` (o `cupos_totales`).
- **Motivo:** Garantiza que los colegios respeten los límites físicos de aforo por aula y la planificación de cobertura institucional.
- **Módulos afectados:** Estructura Escolar, Matrículas e Inscripciones.
- **Archivos donde se implementa:** 
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (Validación de cupos al asignar grado)
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateGroupCupos`)
- **Endpoints relacionados:** 
  - `POST /api/matriculas/assign-grade/:id`
  - `PATCH /api/academic-admin/groups/:id/cupos`
- **Historias de usuario relacionadas:** HU-EST-003

---

### RN-EST-004: Protección contra Eliminación de Grados Activos
- **Descripción:** El sistema denegará la eliminación física de un tipo de grado o grupo de clase si este cuenta con asignaciones académicas (`detalle_grados`) o matrículas registradas en el año lectivo actual.
- **Motivo:** Evita la pérdida accidental de información curricular e impide dejar registros de matrículas huérfanos en la base de datos.
- **Módulos afectados:** Estructura Escolar, Matrículas, Docentes.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`deleteGradeType`, `deleteGroup`)
- **Endpoints relacionados:** 
  - `DELETE /api/academic-admin/grade-types/:id`
  - `DELETE /api/academic-admin/groups/:id`
- **Historias de usuario relacionadas:** N/A

---

## Conservación e Historial

### RN-EST-005: Borrado Lógico de Materias (Soft Delete)
- **Descripción:** La eliminación de una materia del catálogo escolar se realiza de manera lógica cambiando la columna `eliminada` (o campo correspondiente en BD) a `true`, manteniendo intacto su registro en base de datos.
- **Motivo:** Protege el histórico de calificaciones y promedios consolidados de años anteriores; si la materia se eliminara físicamente, las notas históricas de los exalumnos quedarían huérfanas o se perderían por restricciones de integridad referencial.
- **Módulos afectados:** Estructura Escolar, Calificaciones, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`deleteSubject`)
- **Endpoints relacionados:** 
  - `DELETE /api/academic-admin/subjects/:id`
- **Historias de usuario relacionadas:** HU-EST-006

---

### RN-EST-006: Consistencia de Nomenclatura en Renombrado Masivo
- **Descripción:** Al realizar un cambio de nombre en bloque sobre un tipo de grado, el sistema renombra automáticamente todos los grupos dependientes concatenando el nuevo prefijo con el sufijo identificador del salón (ej. cambiar "1ro" a "Primero" cambia "1ro A" a "Primero A" y "1ro B" a "Primero B").
- **Motivo:** Mantiene la consistencia de nomenclatura del colegio de forma automática y evita que los grupos queden identificados con nombres discordantes.
- **Módulos afectados:** Estructura Escolar.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`bulkRenameCourses`)
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/grade-types/:id/bulk-rename`
- **Historias de usuario relacionadas:** HU-EST-004

---

### RN-EST-007: Validación Estricta de Nombres de Grados (Anti-Duplicados Fonéticos)
- **Descripción:** Al crear un nuevo tipo de grado, el sistema normaliza el nombre ingresado antes de compararlo contra los grados existentes del colegio. La normalización incluye: eliminar acentos, remover prefijos comunes (`GRADO`, `NIVEL`), convertir ordinales numéricos (`6°`, `6`) a su forma escrita (`SEXTO`), y colapsar letras consecutivas duplicadas (`SEXXTO` → `SEXTO`). Si el nombre normalizado coincide con algún grado ya registrado en el mismo colegio, la operación se rechaza con HTTP 409.
- **Motivo:** Evita que existan múltiples tipos de grado que representen el mismo nivel pero con nombres ortográficamente distintos (ej. `SEXTO`, `6°`, `GRADO SEXTO`, `SEXXTO`), lo cual generaría inconsistencias en matrículas, asignaciones académicas y reportes. El control es tanto en backend (fuente de verdad) como en el cliente (validación en tiempo real).
- **Módulos afectados:** Estructura Escolar, Matrículas, Configuración Académica.
- **Archivos donde se implementa:** 
  - [gradeNormalization.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/gradeNormalization.ts) (`normalizeGradeName`, `isDuplicateOrSimilarGrade`)
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createGradeType`)
  - [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue) (validación en tiempo real en el cliente)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/grade-types`
- **Historias de usuario relacionadas:** HU-EST-007
