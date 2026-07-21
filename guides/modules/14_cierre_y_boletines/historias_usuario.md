# Historias de Usuario — Cierre y Boletines

Este documento contiene las historias de usuario implementadas para el módulo de Cierre y Boletines de AcademiaNeiva.

---

# HU-BOL-001: Ejecutar Cierre de Periodo por Materia (Docente)

## Historia
**Como** docente del curso  
**Quiero** hacer clic en "Cerrar Periodo" en mi asignatura asignada  
**Para** calcular los promedios definitivos de los estudiantes y bloquear mi planilla frente a cambios futuros.

## Criterios de Aceptación
- El backend calcula el promedio ponderado de las actividades evaluativas registradas para cada estudiante.
- Asocia cada nota promedio final a la escala valorativa institucional (`BAJO`, `BASICO`, `ALTO`, `SUPERIOR`).
- Contabiliza las inasistencias no justificadas (`AUSENTE`) y concatena la observación de tipo `ACADEMICA` obligatoria.
- Guarda el resultado en `resultado_academico` e inserta un registro con estado `CERRADO` en `cierre_materia`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Docente
- **Reglas de negocio relacionadas:** RN-CIE-001, RN-CIE-002
- **Endpoints relacionados:** 
  - `POST /api/teacher/close-period`
  - `GET /api/teacher/closure-status/:detailGradeId/:periodId`
- **Componentes frontend relacionados:** 
  - [TeacherClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherClosure.vue)
- **Controllers/Services relacionados:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`closePeriodForTeacher`, `getClosureStatus`)

---

# HU-BOL-002: Ejecutar Cierre Institucional del Periodo (Directivo)

## Historia
**Como** directivo del colegio  
**Quiero** realizar el cierre e institucionalizar el periodo escolar  
**Para** congelar las calificaciones de todo el colegio y autorizar la impresión de boletines.

## Criterios de Aceptación
- El directivo abre la vista de cierres institucionales.
- El sistema verifica que el 100% de las asignaturas en `detalle_grados` para el periodo evaluado tengan su estado en `CERRADO`.
- Si el 100% de las materias están cerradas, permite presionar "Aprobar Periodo", cambiando el estado del periodo en `periodo_academico` a `CERRADO`.
- Si existen materias pendientes, bloquea la acción y lista los docentes/cursos que faltan por consolidar.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CIE-002
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods/:id/close`
  - `POST /api/academic-admin/settings/periods/:id/approve`
- **Componentes frontend relacionados:** 
  - [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`closeAcademicPeriod`, `approveAcademicPeriod`)

---

# HU-BOL-003: Generar Boletín Individual en PDF

## Historia
**Como** estudiante, padre de familia o directivo  
**Quiero** descargar el boletín de calificaciones de un periodo cerrado en formato PDF  
**Para** obtener el informe oficial impreso del rendimiento escolar.

## Criterios de Aceptación
- El botón de descarga solo se habilita si el periodo académico se encuentra en estado `CERRADO` institucionalmente.
- El PDF incluye el escudo del colegio, los colores de branding, el promedio general, la lista de asignaturas con sus notas numéricas y descriptivas, el conteo de inasistencias y las observaciones académicas de los docentes.
- Alumnos con matrícula `CANCELADA` no pueden generar boletines.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Estudiante, Padre de Familia, Directivo
- **Reglas de negocio relacionadas:** RN-CIE-003, RN-CIE-004
- **Endpoints relacionados:** 
  - `GET /api/boletines/student/:id_estudiante/:id_periodo`
- **Componentes frontend relacionados:** 
  - [StudentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentBoletinView.vue)
  - [ParentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentBoletinView.vue)
- **Controllers/Services relacionados:** 
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (`getStudentBoletin`)

---

# HU-BOL-004: Generar Boletines en Bloque por Grupo

## Historia
**Como** directivo del colegio  
**Quiero** procesar la impresión masiva de boletines de todo un grupo de clase  
**Para** descargar un solo documento PDF comprimido o unificado con los boletines de todos los alumnos activos del salón.

## Criterios de Aceptación
- El directivo selecciona el grupo y el periodo.
- El backend valida que el periodo esté cerrado y compila los boletines de los alumnos en estado de matrícula `ACTIVA`.
- Omite de la generación a los estudiantes retirados o expulsados.
- Retorna la descarga del archivo de boletines del grupo.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CIE-003, RN-CIE-004
- **Endpoints relacionados:** 
  - `GET /api/boletines/grade/:id_grupo/:id_periodo`
  - `GET /api/boletines/validate/:id_colegio/:id_periodo`
- **Componentes frontend relacionados:** 
  - [BoletinGenerator.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/BoletinGenerator.vue)
- **Controllers/Services relacionados:** 
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (`getGradeBoletines`, `validatePeriodClosed`)
