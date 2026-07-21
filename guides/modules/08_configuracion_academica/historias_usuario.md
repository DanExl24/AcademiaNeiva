# Historias de Usuario — Configuración Académica

Este documento contiene las historias de usuario implementadas para el módulo de Configuración Académica de AcademiaNeiva.

---

# HU-CON-001: Registrar Periodo Académico (Trimestres)

## Historia
**Como** directivo del colegio  
**Quiero** crear un periodo académico asignándole un nombre, fechas tentativas y trimestre correspondiente  
**Para** programar el ciclo evaluativo del año escolar en mi institución.

## Criterios de Aceptación
- El periodo debe estar asociado al año lectivo en curso de la institución.
- Se debe especificar la fecha de inicio (día/mes) y de fin (día/mes).
- El estado inicial de todo periodo nuevo es `PENDIENTE`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-001
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods`
- **Componentes frontend relacionados:** 
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicPeriod`)

---

# HU-CON-002: Configurar Pesos Porcentuales de Periodos

## Historia
**Como** directivo del colegio  
**Quiero** asignar y modificar el peso porcentual de cada periodo académico (ej. Periodo 1 = 25%)  
**Para** definir cómo se ponderará la nota final acumulada del año escolar.

## Criterios de Aceptación
- El directivo ingresa el valor de porcentaje para un periodo.
- El sistema debe verificar que la sumatoria de porcentajes de todos los periodos del mismo año no supere el 100%.
- No permite modificar el porcentaje de periodos en estado `CERRADO`.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-002
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/settings/periods/:id/percentage`
- **Componentes frontend relacionados:** 
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateAcademicPeriodPercentage`)

---

# HU-CON-003: Supervisar Avance de Cierre de Materias

## Historia
**Como** directivo del colegio  
**Quiero** ver una consola de control con el listado de materias y el estado de cierre de los docentes  
**Para** verificar si los docentes ya terminaron de evaluar e identificar retrasos en el cierre de periodo.

## Criterios de Aceptación
- La vista muestra un listado de todas las materias asignadas del periodo y su estado (`ABIERTO` o `CERRADO`).
- Despliega una barra de progreso que indica el porcentaje total de materias cerradas.
- Permite filtrar por grado o buscar un docente en particular.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-002
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/settings/closure-details/:schoolId/:periodId`
- **Componentes frontend relacionados:** 
  - [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`getPeriodClosureDetails`)

---

# HU-CON-004: Ejecutar Cierre y Aprobación Institucional del Periodo

## Historia
**Como** directivo del colegio  
**Quiero** confirmar el cierre e institucionalizar el periodo académico  
**Para** congelar los promedios definitivos y autorizar la generación y descarga de boletines PDF.

## Criterios de Aceptación
- El directivo hace clic en "Aprobar Periodo".
- El sistema debe validar que el 100% de las asignaturas activas en `detalle_grados` para el periodo evaluado ya cuenten con su respectivo registro `CERRADO` en `cierre_materia`.
- Si existen materias abiertas, el cierre se bloquea y se muestra el listado de materias pendientes para su resolución.
- Al aprobar, el periodo pasa a estado `CERRADO` y se habilitan los boletines.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-001, RN-CONF-002
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods/:id/close`
  - `POST /api/academic-admin/settings/periods/:id/approve`
- **Componentes frontend relacionados:** 
  - [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`closeAcademicPeriod`, `approveAcademicPeriod`)

---

# HU-CON-005: Reabrir Materia Específica (Bypass de Cierre)

## Historia
**Como** directivo del colegio  
**Quiero** reabrir la planilla de notas de una asignatura específica a un docente sin alterar el resto del colegio  
**Para** permitirle corregir un error en una nota del periodo sin tener que reabrir el trimestre de la institución.

## Criterios de Aceptación
- El directivo localiza la asignatura del docente en el panel de control y presiona "Reabrir Materia".
- El backend borra el registro de `cierre_materia` para dicha materia, pasando su estado a `ABIERTO`.
- El docente correspondiente vuelve a tener habilitados los botones de guardar en su planilla de calificaciones para ese curso.
- Las demás materias permanecen bloqueadas garantizando la consistencia de los datos del colegio.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-002
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods/:periodId/reopen-subject/:detailGradeId`
- **Componentes frontend relacionados:** 
  - [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`reopenSubjectClosure`)

---

# HU-CON-006: Configurar Escalas de Valoración

## Historia
**Como** directivo del colegio  
**Quiero** establecer los rangos de nota para los desempeños Bajo, Básico, Alto y Superior  
**Para** estructurar los juicios valorativos que se imprimirán en los boletines de calificaciones.

## Criterios de Aceptación
- Si se activa el modo `AUTOMATICO`, el sistema divide de manera equitativa los rangos entre la nota mínima y nota máxima.
- Si se activa el modo `MANUAL`, el directivo puede ingresar valores mínimos y máximos para cada una de las cuatro escalas.
- Las escalas no deben solaparse (por ejemplo, el valor mínimo de la escala Alto no debe cruzar el valor máximo de la escala Básico).

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-004
- **Endpoints relacionados:** 
  - `PUT /api/academic-admin/settings/defaults`
  - `PUT /api/academic-admin/settings/scales/manual`
- **Componentes frontend relacionados:** 
  - [AcademicScalesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicScalesView.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateManualScaleConfiguration`, `updateSchoolDefaultSettings`)
