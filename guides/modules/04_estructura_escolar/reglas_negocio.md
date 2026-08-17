# Reglas de Negocio — Estructura Escolar (Grados, Cursos, Jornadas y Materias)

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de **Estructura Escolar** de AcademiaNeiva.

---

## 1. Jerarquía Escolar y Normalización de Grados

### RN-EST-001: Jerarquía Organizacional de Cuatro Niveles
- **Descripción:** La estructura académica institucional sigue una jerarquía estricta de cuatro niveles:
  `nivel_escolar` ➔ `tipo_grado` ➔ `secciones` ➔ `grupos` (Cursos Físicos).
  Un curso físico no puede crearse sin estar vinculado a un nivel escolar del colegio, un tipo de grado válido, una jornada activa y una sección formalizada.
- **Motivo:** Garantiza la coherencia en la asignación de matrículas, cálculo de aforos y reportes curriculares del Ministerio de Educación.
- **Archivos donde se implementa:**
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`createGroup`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/groups`
- **Historias de usuario relacionadas:** HU-EST-001

---

### RN-EST-002: Normalización y Detección de Grados Equivalentes o Similares
- **Descripción:** Al registrar un nuevo tipo de grado (`createGradeType`), el sistema aplica `normalizeGradeName` e `isDuplicateOrSimilarGrade`. Compara el nombre ingresado contra todos los grados existentes en el colegio e impide la creación de duplicados semánticos o variaciones ortográficas (ej. si ya existe *"PRIMERO"*, se bloquea la creación de *"1°"*, *"Primero"*, *"PRIMERO DE PRIMARIA"* o *"1RO"* con error `409 Conflict`).
- **Motivo:** Evita la fragmentación curricular y la duplicidad confusa de grados en la oferta académica del colegio.
- **Archivos donde se implementa:**
  - [gradeNormalization.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/gradeNormalization.ts)
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`createGradeType`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/grade-types`
- **Historias de usuario relacionadas:** HU-EST-002

---

## 2. Aforos, Cupos y Eliminaciones Protegidas

### RN-EST-003: Protección de Capacidad y Bloqueo de Reducción de Cupos
- **Descripción:** Al actualizar la capacidad de cupos de un curso (`updateGroupCupos`), el sistema consulta en tiempo real el número de estudiantes con matrícula en estado diferente de cancelada/rechazada (`matriculadosActuales`). Si el nuevo valor de `cupos_totales` es estrictamente menor a `matriculadosActuales`, el backend rechaza la operación con error `400 Bad Request`.
- **Motivo:** Evita dejar en sobrecupo o en inconsistencia administrativa a alumnos ya matriculados en el curso.
- **Archivos donde se implementa:**
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`updateGroupCupos`)
  - [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue)
- **Endpoints relacionados:**
  - `PATCH /api/academic-admin/groups/:id/cupos`
- **Historias de usuario relacionadas:** HU-EST-003

---

### RN-EST-004: Eliminación Protegida de Tipos de Grado con Reporte de Impacto
- **Descripción:** Un tipo de grado no puede eliminarse si cuenta con al menos un curso físico asociado, matrículas vinculadas o asignaciones académicas docentes. Si existen dependencias, el backend responde con error `409 Conflict` y entrega un objeto `impact` con el recuento exacto de `cursos_count`, `matriculas_count` y `asignaciones_count`.
- **Motivo:** Preserva la integridad referencial y previene la pérdida accidental de expedientes escolares.
- **Archivos donde se implementa:**
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`deleteGradeType`)
- **Endpoints relacionados:**
  - `DELETE /api/academic-admin/grade-types/:id`
- **Historias de usuario relacionadas:** HU-EST-002

---

### RN-EST-005: Eliminación Protegida de Cursos Físicos
- **Descripción:** Un grupo/curso físico no puede eliminarse si tiene matrículas asociadas, asignaciones en `detalle_grados` o competencias pedagógicas registradas. El backend evalúa estas relaciones y retorna `409 Conflict` con las métricas de impacto si existen datos activos.
- **Motivo:** Salvaguarda la continuidad académica de los cursos y evita registros huérfanos.
- **Archivos donde se implementa:**
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`deleteGroup`)
- **Endpoints relacionados:**
  - `DELETE /api/academic-admin/groups/:id`
- **Historias de usuario relacionadas:** HU-EST-001

---

## 3. Renombramiento Inteligente y Nomenclatura

### RN-EST-006: Renombramiento Individual con Desvinculación de Sección Compartida
- **Descripción:** Al renombrar un curso individual (`renameSingleCourse`):
  1. Si ya existe una sección en el catálogo general con el nuevo nombre, asocia el grupo a dicha sección.
  2. Si la sección no existe y es utilizada exclusivamente por este curso (`shared <= 1`), renombra la sección en la tabla `secciones`.
  3. Si la sección actual es compartida por otros cursos (`shared > 1`), crea una nueva fila en `secciones` y actualiza `grupos.id_seccion`, evitando modificar los otros cursos.
  4. El nuevo nombre no puede superar los 10 caracteres.
- **Motivo:** Permite modificar la nomenclatura de un curso particular (ej. cambiar "10-A" a "10-Ciencias") sin alterar otros grupos que compartían la letra "A" (como "11-A" o "9-A").
- **Archivos donde se implementa:**
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`renameSingleCourse`)
- **Endpoints relacionados:**
  - `PATCH /api/academic-admin/groups/:id/rename`
- **Historias de usuario relacionadas:** HU-EST-004

---

### RN-EST-007: Renombramiento en Bloque con Generación de Series Ordinales
- **Descripción:** Permite renombrar en bloque todos los cursos pertenecientes a un tipo de grado mediante un `prefijo` (máx 10 chars), un `separador` (`-`, `.`, espacio o vacío) y un `tipo_ordinal` (`LETRA` para A, B, C... o `NUMERO` para 1, 2, 3...). El sistema valida previamente que ningún nombre resultante supere 10 caracteres y desvincula las secciones compartidas de forma transaccional.
- **Motivo:** Agiliza la estandarización institucional de la nomenclatura de cursos al inicio del año lectivo.
- **Archivos donde se implementa:**
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`bulkRenameCourses`)
- **Endpoints relacionados:**
  - `PATCH /api/academic-admin/grade-types/:id/bulk-rename`
- **Historias de usuario relacionadas:** HU-EST-004

---

## 4. Catálogo Curricular y Papelera con Snapshot JSON

### RN-EST-008: Papelera de Materias con Respaldo Snapshot JSON y Restauración Profunda
- **Descripción:** 
  1. Si una materia tiene asignaciones docentes o competencias activas, no puede eliminarse por defecto (`409 Conflict`).
  2. Si el directivo confirma la eliminación forzada (`force=true`), el sistema ejecuta una transacción que genera un snapshot completo en formato JSON de todas sus asignaciones docentes y competencias en la tabla `papelera_materias.data_respaldo`, eliminando luego las dependencias en cascada limpia.
  3. Al registrar una nueva materia enviando `trashId`, el sistema restaura de forma profunda la materia recreando automáticamente todas las asignaciones en `detalle_grados` y las competencias en `competencias` a partir del respaldo JSON.
- **Motivo:** Permite depurar el catálogo curricular sin perder el historial pedagógico, ofreciendo capacidad de recuperación inmediata ante eliminaciones accidentales.
- **Archivos donde se implementa:**
  - [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) (`deleteSubject`, `createSubject`, `getSubjectsTrash`)
  - [SubjectManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SubjectManagement.vue)
- **Endpoints relacionados:**
  - `DELETE /api/academic-admin/subjects/:id`
  - `POST /api/academic-admin/subjects`
  - `GET /api/academic-admin/subjects/trash/:schoolId`
- **Historias de usuario relacionadas:** HU-EST-005

---

### RN-EST-009: Restricciones y Gestión de Jornadas Institucionales
- **Descripción:** 
  1. Cada colegio solo puede habilitar jornadas del catálogo oficial (`MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA`).
  2. Una jornada no puede eliminarse (`deleteJornada`) si cuenta con cursos asociados en la tabla `grupos` (`409 Conflict`).
  3. La reasignación de cursos entre jornadas (`reassignGroupJornada`) está sujeta a la guarda institucional de matrículas (`IS_JORNADA_REASSIGNMENT_ENABLED = false`) para proteger la jornada elegida por los acudientes en su admisión.
- **Motivo:** Garantiza la integridad de los horarios de operación escolar y protege la elección de turno efectuada en el proceso de matrícula.
- **Archivos donde se implementa:**
  - [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`createJornada`, `deleteJornada`, `reassignGroupJornada`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/jornadas`
  - `DELETE /api/academic-admin/jornadas/:id`
  - `PATCH /api/academic-admin/groups/:id/jornada`
- **Historias de usuario relacionadas:** HU-EST-006
