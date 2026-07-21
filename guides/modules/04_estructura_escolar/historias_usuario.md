# Historias de Usuario — Estructura Escolar

Este documento contiene las historias de usuario implementadas para el módulo de Estructura Escolar de AcademiaNeiva.

---

# HU-EST-001: Crear Tipo de Grado

## Historia
**Como** directivo del colegio  
**Quiero** registrar un nuevo tipo de grado (ej. PRIMERO, SEGUNDO) asignándole su nivel escolar  
**Para** ampliar la oferta escolar de grados de mi institución.

## Criterios de Aceptación
- El directivo debe seleccionar el nivel escolar (PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA) y el nombre del grado.
- El nombre del grado no debe existir previamente en el mismo colegio para evitar duplicidades.
- Al registrar el tipo de grado, este queda habilitado para la posterior creación de grupos y cursos específicos.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-EST-001
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/grade-types`
- **Componentes frontend relacionados:** 
  - [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createGradeType`)

---

# HU-EST-002: Crear Grupo Escolar (Curso)

## Historia
**Como** directivo del colegio  
**Quiero** crear un nuevo grupo (ej. Primero A, Primero B) asociándolo a un tipo de grado y un año lectivo  
**Para** definir la lista física de salones y cupos donde se matricularán los alumnos.

## Criterios de Aceptación
- El directivo debe especificar el nombre, tipo de grado y los cupos máximos del grupo.
- El grupo se asocia de forma mandatoria al año lectivo en curso y al colegio del directivo.
- Los cupos asignados deben ser un número entero mayor que cero.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-EST-001, RN-EST-003
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/groups`
- **Componentes frontend relacionados:** 
  - [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createGroup`)

---

# HU-EST-003: Modificar Cupos de un Grupo

## Historia
**Como** directivo del colegio  
**Quiero** ampliar o reducir la cantidad de cupos totales de un grupo  
**Para** controlar el ingreso y límite de estudiantes en un aula en base a la capacidad del salón.

## Criterios de Aceptación
- El directivo ingresa el nuevo número de cupos.
- El sistema no debe permitir reducir los cupos por debajo del número de estudiantes matriculados activos en dicho grupo.
- Al guardar, el cambio se actualiza inmediatamente en el grupo.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-EST-003
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/groups/:id/cupos`
- **Componentes frontend relacionados:** 
  - [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateGroupCupos`)

---

# HU-EST-004: Renombrar Grupos en Bloque

## Historia
**Como** directivo del colegio  
**Quiero** modificar la nomenclatura de todos los grupos pertenecientes a un tipo de grado en un solo paso  
**Para** unificar la nomenclatura del colegio de forma ágil ante reformas organizacionales.

## Criterios de Aceptación
- El directivo selecciona el tipo de grado y digita el nuevo prefijo de nombre.
- El sistema despliega un listado previo de cómo quedarán estructurados los nuevos nombres de grupos (ej. "1-A", "1-B") antes de confirmar la acción.
- Al confirmar, se realiza un renombrado masivo en la base de datos de todos los grupos bajo el mismo tipo de grado.

## Detalles Técnicos
- **Prioridad:** Baja
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-EST-006
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/grade-types/:id/bulk-rename`
- **Componentes frontend relacionados:** 
  - [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`bulkRenameCourses`)

---

# HU-EST-005: Registrar Materia en Catálogo Escolar

## Historia
**Como** directivo del colegio  
**Quiero** ingresar una materia (nombre) en la base de datos  
**Para** incorporarla al catálogo de asignaturas disponibles de mi colegio.

## Criterios de Aceptación
- El directivo debe ingresar un nombre descriptivo de la materia.
- La materia no debe estar registrada con el mismo nombre y en estado activo en el colegio.
- Se crea en la tabla `materias` asociada al colegio.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/subjects`
- **Componentes frontend relacionados:** 
  - [SubjectManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SubjectManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createSubject`)

---

# HU-EST-006: Eliminar Materia (Soft Delete)

## Historia
**Como** directivo del colegio  
**Quiero** dar de baja una materia de la oferta escolar  
**Para** retirarla del catálogo sin perder el historial y las notas registradas en los años anteriores.

## Criterios de Aceptación
- Al presionar eliminar, la materia no se borra físicamente de la base de datos (se aplica una marca de borrado lógico `eliminada = true`).
- La materia se oculta de las vistas de asignación de cursos del año escolar activo.
- La materia puede ser consultada o restaurada desde la vista de la papelera institucional de materias.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-EST-005
- **Endpoints relacionados:** 
  - `DELETE /api/academic-admin/subjects/:id`
- **Componentes frontend relacionados:** 
  - [SubjectManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SubjectManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`deleteSubject`)
