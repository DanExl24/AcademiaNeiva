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

---

# HU-CON-007: Registrar Año Lectivo mediante Modal con Formato y Fechas Automáticas

## Historia
**Como** directivo del colegio  
**Quiero** registrar un nuevo año lectivo ingresando únicamente su número (ej. `2026`) y tipo de calendario (A o B) a través de un modal interactivo  
**Para** que el sistema calcule automáticamente la etiqueta de rango (ej. `2025-2026` para Calendario B), asigne las fechas de vigencia predeterminadas y genere sus 4 periodos sin fricción manual.

## Criterios de Aceptación
- El formulario se despliega dentro de un modal dedicado al presionar `+ Agregar año`.
- El campo de año acepta exclusivamente valores numéricos (`year_number`).
- Muestra una insignia en vivo con la etiqueta resultante (`2026` para Calendario A o `2025-2026` para Calendario B).
- Sugiere automáticamente fechas predeterminadas de vigencia coherentes con el año y tipo de calendario.
- Al guardar, el backend auto-distribuye los 4 periodos trimestrales exactamente entre `fecha_inicio` y `fecha_fin`.
- Al crearse o activarse en estado `ABIERTO`, cualquier otro año activo del colegio pasa automáticamente a estado `CERRADO` (Garantizando solo 1 año activo).

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-006, RN-CONF-007, RN-CONF-009, RN-CONF-010
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/years`
- **Componentes frontend relacionados:** 
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`yearModal`, `computedCalendarioLabel`)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicYear`)

---

# HU-CON-008: Control de Solapamiento y Recálculo Automático de Fechas Libres

## Historia
**Como** directivo del colegio  
**Quiero** que el sistema impida el solapamiento de fechas entre años lectivos y recalcule automáticamente la vigencia libre  
**Para** asegurar que no existan cruces temporales entre las programaciones académicas de la institución.

## Criterios de Aceptación
- Al cambiar el número de año o tipo de calendario en el modal, el sistema evalúa si las fechas proyectadas chocan con algún año registrado.
- Si existe choque de fechas, recalcula automáticamente la `fecha_inicio` disponible al día posterior a la `fecha_fin` del último año que se cruzaba (`latestEnd + 1 día`).
- Si las fechas ingresadas manualmente producen solapamiento, se despliega una alerta destacada `⚠️ Solapamiento de Fechas Detectado` y se inhabilita el botón de guardar.
- El backend evalúa la consulta de intersección y responde con HTTP `400` en caso de intento de guardado solapado.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-008
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/years`
- **Componentes frontend relacionados:** 
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`dateOverlapWarning`, `watch`)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicYear`)

---

# HU-CON-009: Restricción de Cambio de Calendario al Modo Editor

## Historia
**Como** directivo del colegio  
**Quiero** que la modificación del tipo de calendario de un año registrado requiera la activación explícita del Modo Editor  
**Para** prevenir reconfiguraciones accidentales o desajustes de periodos en la institución.

## Criterios de Aceptación
- Los selectores de `Calendario A / Calendario B` en las tarjetas de la lista de años permanecen inhabilitados (`disabled`).
- Al presionar el botón `🛡️ MODO EDITOR`, los selectores se activan permitiendo su edición.
- Solo permite cambiar el calendario de un año si este no posee calificaciones registradas o alumnos matriculados.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-010
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/settings/years/:id/calendar-type`
- **Componentes frontend relacionados:** 
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`changeYearCalendarType`, `editorModeActive`)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateAcademicYearCalendarType`)

---

# HU-CON-010: Concurrencia de Fechas de Periodos y Visualización Prominente de Vigencias

## Historia
**Como** directivo del colegio  
**Quiero** visualizar en todo momento el rango de vigencia oficial de cada año lectivo y verificar la pertenencia estricta de sus periodos  
**Para** garantizar que el Primer Periodo inicie exactamente con el año y el Cuarto Periodo termine exactamente con el fin del año escolar.

## Criterios de Aceptación
- Cada tarjeta de la lista muestra permanentemente la etiqueta `📅 Vigencia: YYYY-MM-DD al YYYY-MM-DD`.
- La fecha de inicio del Primer Periodo coincide con la `fecha_inicio` del año.
- La fecha de fin del Cuarto Periodo coincide con la `fecha_fin` del año.
- El backend rechaza la creación o edición de un periodo individual si sus fechas exceden los límites del año lectivo padre.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-CONF-009
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods`
  - `PATCH /api/academic-admin/settings/periods/:id/percentage`
- **Componentes frontend relacionados:** 
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`formatYearDates`)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicPeriod`, `createAcademicYear`)
