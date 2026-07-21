# Historias de Usuario — Matrículas e Inscripciones

Este documento contiene las historias de usuario implementadas para el módulo de Matrículas e Inscripciones de AcademiaNeiva.

---

# HU-MAT-001: Enviar Solicitud de Inscripción Pública Regular

## Historia
**Como** aspirante o padre de familia  
**Quiero** completar el formulario de inscripción pública y adjuntar los documentos de soporte  
**Para** solicitar una plaza de estudio regular para el año lectivo activo.

## Criterios de Aceptación
- El formulario debe presentarse solo si la fecha actual está dentro del rango permitido (`fecha_inicio` a `fecha_cierre`) de la configuración de inscripción del colegio.
- Permite subir archivos independientes para cada documento obligatorio (Registro Civil, Foto, Vacunas, Salud, etc.) respetando el límite de tamaño de 5MB por archivo.
- Al procesar con éxito, el sistema guarda la solicitud en estado `PENDIENTE` y genera un token UUID de seguimiento.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Público
- **Reglas de negocio relacionadas:** RN-MAT-001, RN-MAT-003
- **Endpoints relacionados:** 
  - `POST /api/matriculas/submit`
- **Componentes frontend relacionados:** 
  - [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue)
- **Controllers/Services relacionados:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`submitEnrollment`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts)

---

# HU-MAT-002: Consultar Seguimiento de Solicitud de Matrícula

## Historia
**Como** aspirante o padre de familia  
**Quiero** ingresar el token de mi matrícula en la barra de búsqueda  
**Para** monitorear el estado actual de mi trámite escolar y leer observaciones del directivo.

## Criterios de Aceptación
- El usuario ingresa el token UUID de seguimiento.
- El sistema muestra el estado actual de la matrícula (`PENDIENTE`, `CORRECCION`, `APROBADA`, `ACTIVA`, `CANCELADA`) y la lista de documentos cargados con sus estados individuales.
- El visitante anónimo no requiere credenciales para ver este panel específico ligado a su token.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Público
- **Reglas de negocio relacionadas:** RN-MAT-003
- **Endpoints relacionados:** 
  - `GET /api/matriculas/:id` (con UUID de seguimiento)
- **Componentes frontend relacionados:** 
  - [MatriculaTrackingView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/MatriculaTrackingView.vue)
- **Controllers/Services relacionados:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`getMatriculaDetails` / `getByToken`)

---

# HU-MAT-003: Subsanar Documentos Rechazados (Corrección)

## Historia
**Como** aspirante o padre de familia  
**Quiero** volver a cargar los archivos de los documentos que fueron marcados como rechazados por el colegio  
**Para** corregir las inconsistencias y que mi trámite de matrícula pueda continuar.

## Criterios de Aceptación
- La opción de volver a cargar archivos solo se habilita si el estado de la matrícula es `CORRECCION` y los documentos específicos están en estado `RECHAZADO`.
- El usuario sube los archivos de reemplazo.
- Al guardar, el estado de la matrícula regresa de forma automática a `PENDIENTE` para una nueva revisión del directivo y los documentos pasan a revisión.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Público
- **Reglas de negocio relacionadas:** RN-MAT-004
- **Endpoints relacionados:** 
  - `POST /api/matriculas/update-documents/:token`
- **Componentes frontend relacionados:** 
  - [EnrollmentCorrection.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentCorrection.vue)
- **Controllers/Services relacionados:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`updateDocumentsByToken`)

---

# HU-MAT-004: Validar Documentación de Aspirante

## Historia
**Como** directivo del colegio  
**Quiero** inspeccionar los archivos adjuntos de una solicitud y marcarlos como validados o rechazados  
**Para** verificar que cumplan con los requisitos legales exigidos por la institución.

## Criterios de Aceptación
- El directivo visualiza el archivo de cada documento en línea.
- Puede hacer clic en "Validar" (estado pasa a `VALIDADO`) o "Rechazar" (estado pasa a `RECHAZADO`).
- Al rechazar, debe ingresar de forma obligatoria el motivo del rechazo del documento.
- Si rechaza al menos un documento, el sistema cambia automáticamente el estado de la matrícula a `CORRECCION`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-MAT-004
- **Endpoints relacionados:** 
  - `PATCH /api/matriculas/document/:idDocumento`
- **Componentes frontend relacionados:** 
  - [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue)
- **Controllers/Services relacionados:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`validateDocument`)

---

# HU-MAT-005: Asignar Grado y Grupo Escolar

## Historia
**Como** directivo del colegio  
**Quiero** asignar el grado escolar y el grupo de clase al aspirante que tiene documentos correctos  
**Para** pre-ubicarlo en el salón correspondiente antes de oficializar su matrícula.

## Criterios de Aceptación
- El directivo selecciona el tipo de grado y grupo de la lista de cursos disponibles.
- El sistema verifica que el grupo tenga cupos disponibles. Si no hay cupos, bloquea la asignación.
- Al procesarse correctamente, la matrícula pasa a estado `APROBADA` y se asocia el `id_grupo` en la tabla `matricula`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-MAT-005
- **Endpoints relacionados:** 
  - `POST /api/matriculas/assign-grade/:id`
- **Componentes frontend relacionados:** 
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Controllers/Services relacionados:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`assignGrade`)

---

# HU-MAT-006: Finalizar y Oficializar Matrícula

## Historia
**Como** directivo del colegio  
**Quiero** presionar finalizar en una matrícula aprobada  
**Para** asentar oficialmente al estudiante en el plantel escolar y generarle sus credenciales de acceso.

## Criterios de Aceptación
- Solo se habilita si el estado es `APROBADA` y tiene asignado un grupo de clase.
- El sistema inserta un nuevo registro en la tabla `estudiante` con estado `ACTIVO` y genera su código único estudiantil.
- Crea automáticamente una cuenta vinculada en `usuario` con rol `estudiante` e inyecta la credencial inicial.
- El estado de la matrícula transiciona a `ACTIVA`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-MAT-005
- **Endpoints relacionados:** 
  - `POST /api/matriculas/finalize/:id`
- **Componentes frontend relacionados:** 
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Controllers/Services relacionados:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`finalizeEnrollment`)

---

# HU-MAT-007: Procesar Matrícula Extraordinaria

## Historia
**Como** directivo del colegio  
**Quiero** matricular a un estudiante fuera de las fechas de inscripción ordinaria  
**Para** atender casos especiales de alumnos que ingresan de manera extemporánea.

## Criterios de Aceptación
- El directivo inicia la solicitud seleccionando el tipo de matrícula `EXTRAORDINARIA`.
- Completa el formulario de datos personales y sube los documentos.
- La solicitud requiere la aprobación explícita y re-autenticación de rectoría para consolidarse.
- Se omite el bloqueo de fechas regulares para este flujo.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-MAT-002
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/matriculas/extraordinaria`
  - `POST /api/academic-admin/matriculas/extraordinaria/:id/aprobar`
- **Componentes frontend relacionados:** 
  - [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createExtraordinaryEnrollment`, `approveExtraordinaryEnrollment`)
