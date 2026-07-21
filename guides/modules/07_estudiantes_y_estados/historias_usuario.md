# Historias de Usuario — Estudiantes y Estados

Este documento contiene las historias de usuario implementadas para el módulo de Gestión de Estudiantes y Estados de AcademiaNeiva.

---

# HU-ESTU-001: Consultar Ficha Resumen de Estudiante

## Historia
**Como** directivo del colegio  
**Quiero** buscar un estudiante y acceder a su ficha de resumen  
**Para** analizar su rendimiento académico consolidado, inasistencias y comportamiento registrado por sus docentes.

## Criterios de Aceptación
- El directivo puede buscar estudiantes por nombre, apellido, código o documento.
- Al seleccionar un alumno, se despliega una vista con sus datos personales, estado de matrícula actual, promedio general acumulado, total de fallas de asistencia y anotaciones en el observador.
- La consulta está aislada por el colegio del directivo (multi-tenant).

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-ESTU-005
- **Endpoints relacionados:** 
  - `GET /api/student/colegio/:idColegio`
  - `GET /api/student/:id/summary`
- **Componentes frontend relacionados:** 
  - [StudentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/StudentManagement.vue)
- **Controllers/Services relacionados:** 
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (`getAllStudents`, `getStudentSummary`)

---

# HU-ESTU-002: Cambiar de Grado o Grupo al Estudiante (Traslado Interno)

## Historia
**Como** directivo del colegio  
**Quiero** trasladar a un estudiante de un grupo a otro dentro de la institución (ej. de 1ro A a 1ro B)  
**Para** corregir asignaciones o equilibrar la cantidad de alumnos por salón.

## Criterios de Aceptación
- El directivo selecciona el nuevo grupo de destino en la ficha del estudiante.
- El sistema debe verificar que el grupo de destino pertenezca al mismo año lectivo y tenga cupos disponibles. Si no tiene cupos, bloquea la acción.
- Al procesarse correctamente, se modifica el `id_grupo` del estudiante en la tabla `matricula` y se registra la novedad.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `PATCH /api/student/:id/change-grade`
- **Componentes frontend relacionados:** 
  - [StudentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/StudentManagement.vue) (Modal de traslado de grupo)
- **Controllers/Services relacionados:** 
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (`changeStudentGrade`)

---

# HU-ESTU-003: Registrar Sanción Disciplinaria

## Historia
**Como** directivo del colegio  
**Quiero** registrar una sanción disciplinaria a un estudiante especificando fechas de inicio y fin  
**Para** que su estado personal se actualice de forma automática y se restrinjan sus actividades según el manual de convivencia.

## Criterios de Aceptación
- El directivo debe seleccionar el estudiante, tipo de sanción (ej. Suspensión, Expulsión), y las fechas de vigencia.
- El sistema crea la sanción con estado `ACTIVA`.
- A través del trigger SQL, el estado personal del estudiante en la tabla `estudiante` cambia automáticamente a `SANCIONADO` (o `EXPULSADO` según el caso).
- Al vencerse la fecha final de la sanción, el trigger debe devolver de forma automática al alumno al estado `ACTIVO` si no posee más sanciones vigentes.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-ESTU-003
- **Endpoints relacionados:** 
  - `GET /api/student/sanctions/types`
  - `PATCH /api/student/:id/status` (o a través del trigger al insertar en la tabla de sanciones)
- **Componentes frontend relacionados:** 
  - [StudentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/StudentManagement.vue)
- **Controllers/Services relacionados:** 
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (`updateStudentStatus`)
  - Trigger `fn_sync_estudiante_sancion` en base de datos.

---

# HU-ESTU-004: Consultar Rendimiento y Observador (Portal de Estudiantes y Padres)

## Historia
**Como** estudiante o padre de familia  
**Quiero** ingresar a mi portal personal con mis credenciales  
**Para** consultar de manera consolidada mis calificaciones del periodo, fallas de asistencia acumuladas e historial de anotaciones de mis docentes.

## Criterios de Aceptación
- El acceso solo se permite si el estado del usuario asociado es activo. Estudiantes con estado `EXPULSADO` o `RETIRADO` tienen denegado el acceso de forma inmediata.
- En el caso de los padres, el portal le permite elegir entre sus múltiples hijos registrados y vinculados en `detalle_padrefamilia` para visualizar la información de cada uno de manera independiente.
- Las vistas son de solo lectura y están agrupadas por periodos escolares y materias.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Estudiante, Padre de Familia
- **Reglas de negocio relacionadas:** RN-ESTU-001, RN-ESTU-002, RN-ESTU-004
- **Endpoints relacionados:** 
  - `GET /api/student/info/:id_estudiante`
  - `GET /api/student/grades/:id_estudiante/:id_periodo`
  - `GET /api/student/attendance/:id_estudiante/:id_periodo`
  - `GET /api/student/observations/:id_estudiante/:id_periodo`
  - `GET /api/student/parent-children/:id_usuario`
- **Componentes frontend relacionados:** 
  - [StudentDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentDashboard.vue)
  - [ParentDashboard.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentDashboard.vue)
- **Controllers/Services relacionados:** 
  - [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts)
