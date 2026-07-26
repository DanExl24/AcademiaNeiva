# Reglas de Negocio — Configuración Académica

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Configuración Académica de AcademiaNeiva.

---

## Ciclo de Vida de los Periodos

### RN-CONF-001: Ciclo de Vida y Transición de Estados del Periodo
- **Descripción:** El estado del periodo académico en la columna `estado` (de tipo enum `estado_periodo`) debe cumplir estrictamente el flujo `PENDIENTE` → `ABIERTO` → `CERRADO`. No se permite que un periodo regrese a `PENDIENTE` una vez abierto ni reabrirse de forma directa sin la validación de rectoría.
- **Motivo:** Garantiza la coherencia en el flujo temporal del año lectivo, protegiendo las notas históricas de manipulaciones accidentales de fechas.
- **Módulos afectados:** Configuración Académica, Calificaciones, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`closeAcademicPeriod`, `reopenAcademicPeriod`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/periods/:id/close`
  - `POST /api/academic-admin/settings/periods/:id/reopen`
- **Historias de usuario relacionadas:** HU-CON-001, HU-CON-004

---

### RN-CONF-002: Bloqueo de Escritura en Periodos Cerrados (Integridad de Datos)
- **Descripción:** Cuando el estado de un periodo académico es `CERRADO`, el backend y la base de datos abortarán e impedirán de forma redundante cualquier consulta que intente crear, actualizar o eliminar registros en las tablas de:
  - Competencias y evidencias.
  - Actividades y criterios de evaluación.
  - Calificaciones de alumnos (`notas_actividad`, `nota_criterio`).
  - Anotaciones de observador (`observacion_estudiante`).
  - Fallas y registros de inasistencias (`registro_asistencia`).
- **Motivo:** Blindar los promedios y reportes definitivos consolidados que ya han sido emitidos a padres de familia y cargados ante entes reguladores.
- **Módulos afectados:** Configuración Académica, Calificaciones, Asistencia, Observaciones.
- **Archivos donde se implementa:** 
  - [periodHelpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts) (`ensureCurrentPeriodOrRespond`)
  - [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) (Trigger SQL `fn_bloquear_periodo_cerrado`)
- **Endpoints relacionados:** Todos los endpoints de notas, asistencia y observador.
- **Historias de usuario relacionadas:** HU-CON-002, HU-CON-004, HU-CON-005

---

### RN-CONF-003: Activación Automática por Scheduler
- **Descripción:** El planificador de tareas programado (`schedulerService.ts`) verifica cada hora los periodos con estado `PENDIENTE`. Activará de forma automática (`estado = 'ABIERTO'`) aquellos periodos cuya fecha planificada ya llegó, siempre y cuando el trimestre anterior de la institución se encuentre en estado `CERRADO`.
- **Motivo:** Evita el cruce accidental de periodos activos y promueve la transición del año de forma fluida.
- **Módulos afectados:** Configuración Académica.
- **Archivos donde se implementa:** 
  - [schedulerService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/schedulerService.ts) (`activatePendingPeriods`)
- **Endpoints relacionados:** N/A (Ejecución interna en background)
- **Historias de usuario relacionadas:** HU-CON-001

---

## Escalas de Valoración y Límites

### RN-CONF-004: Restricciones en Configuración de Escalas
- **Descripción:** Los rangos de nota de las cuatro escalas descriptivas obligatorias (`BAJO`, `BASICO`, `ALTO`, `SUPERIOR`) configurados en `escala_valoracion` deben cumplir:
  - No deben tener solapamientos (ej. el máximo de Básico debe ser inferior al mínimo de Alto).
  - El límite inferior del nivel `BAJO` debe ser igual a la `nota_minima` del colegio y el límite superior de `SUPERIOR` debe ser igual a la `nota_maxima`.
- **Motivo:** Asegura la consistencia en el cálculo automático de los boletines de calificaciones, previniendo que una nota promedio caiga en dos rangos descriptivos diferentes o quede sin clasificar.
- **Módulos afectados:** Configuración Académica, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateManualScaleConfiguration`)
- **Endpoints relacionados:** 
  - `PUT /api/academic-admin/settings/scales/manual`
- **Historias de usuario relacionadas:** HU-CON-006

---

### RN-CONF-005: Límite del 100% en Suma de Ponderaciones de Periodo
- **Descripción:** El sistema no permitirá que la sumatoria de las ponderaciones porcentuales de los periodos académicos asociados a un año lectivo en el mismo colegio sea superior al 100%.
- **Motivo:** Garantiza que el promedio acumulado del año del estudiante se calcule sobre una escala base del 100%, manteniendo la coherencia matemática de los boletines.
- **Módulos afectados:** Configuración Académica.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateAcademicPeriodPercentage`)
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/settings/periods/:id/percentage`
- **Historias de usuario relacionadas:** HU-CON-002

---

## Estructura de Años Lectivos y Concurrencia de Fechas

### RN-CONF-006: Exclusividad del Año Lectivo Activo
- **Descripción:** Solo puede existir **un (1) año lectivo en estado `ABIERTO`** por colegio a la vez. Al crear un nuevo año en estado `ABIERTO` o al modificar el estado de un año existente a `ABIERTO`, cualquier otro año activo en la misma institución pasa automáticamente a estado `CERRADO`.
- **Motivo:** Garantiza que todo el colegio (matriculados, asistencias, evaluaciones y dashboards) concentre su ciclo operativo en un único marco lectivo de referencia.
- **Módulos afectados:** Configuración Académica, Matrículas, Calificaciones, Dashboard.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicYear`, `updateAcademicYearStatus`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/years`
  - `PATCH /api/academic-admin/settings/years/:id/status`
- **Historias de usuario relacionadas:** HU-CON-007

---

### RN-CONF-007: Coherencia y Rango de Fechas del Año Lectivo
- **Descripción:** Todo año lectivo registrado en la tabla `anio_lectivo` debe contar con `fecha_inicio` y `fecha_fin` válidas, cumpliendo estrictamente que `fecha_fin > fecha_inicio`.
- **Motivo:** Define la ventana institucional oficial para las vigencias de inscripciones, matrículas y periodos académicos.
- **Módulos afectados:** Configuración Académica, Inscripciones y Matrículas.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicYear`)
  - [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/years`
- **Historias de usuario relacionadas:** HU-CON-007

---

### RN-CONF-008: Prohibición de Solapamiento entre Años Lectivos
- **Descripción:** Las fechas de vigencia (`fecha_inicio` a `fecha_fin`) de un año lectivo NO pueden cruzarse ni solaparse con el rango de fechas de ningún otro año lectivo configurado en el mismo colegio. Si se detecta un choque (`fecha_inicio <= new_fin AND fecha_fin >= new_inicio`), la solicitud es rechazada en backend (error HTTP `400`) y bloqueada en el modal frontend con la alerta `⚠️ Solapamiento de Fechas Detectado`.
- **Motivo:** Evita conflictos de vigencia y colisión de fechas entre periodos de distintos años lectivos.
- **Módulos afectados:** Configuración Académica.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicYear`)
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`dateOverlapWarning`, `watch`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/years`
- **Historias de usuario relacionadas:** HU-CON-008

---

### RN-CONF-009: Concurrencia Estricta entre Años Lectivos y Periodos Académicos
- **Descripción:** Ningún periodo académico asociado a un año lectivo puede poseer fechas de inicio o fin que queden fuera del rango `fecha_inicio` al `fecha_fin` de dicho año:
  - El **Primer Periodo** del año inicia **exactamente en la `fecha_inicio`** del año lectivo.
  - El **Cuarto Periodo** del año finaliza **exactamente en la `fecha_fin`** del año lectivo.
  - Los 4 trimestres se distribuyen de forma equitativa e ininterrumpida entre el inicio y el fin del año lectivo.
- **Motivo:** Mantiene la subordinación y coherencia matemática estricta de las fechas de evaluación con el calendario escolar institucional.
- **Módulos afectados:** Configuración Académica, Evaluación.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createAcademicYear`, `updateAcademicYearCalendarType`, `createAcademicPeriod`)
  - [reset_and_seed.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/seeds/reset_and_seed.ts) (`computeQuarterPeriodsForDates`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/years`
  - `PATCH /api/academic-admin/settings/years/:id/calendar-type`
  - `POST /api/academic-admin/settings/periods`
- **Historias de usuario relacionadas:** HU-CON-007, HU-CON-010

---

### RN-CONF-010: Formato y Modificación de Tipo de Calendario en Modo Editor
- **Descripción:**
  - El nombre/etiqueta del año lectivo se basa en una entrada numérica (ej. `2026`). Si el año es de **Calendario B**, el sistema genera automáticamente el rango numérico (ej. `2025-2026`).
  - La alteración del tipo de calendario (A o B) en un año registrado solo se permite si el directivo ha activado el **Modo Editor** (`editorModeActive = true`) y si el año lectivo no posee registros académicos o matrículas activas de alumnos.
- **Motivo:** Evita modificaciones accidentales de la estructura temporal de la institución en años en curso.
- **Módulos afectados:** Configuración Académica.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateAcademicYearCalendarType`)
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`changeYearCalendarType`, `computedCalendarioLabel`)
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/settings/years/:id/calendar-type`
- **Historias de usuario relacionadas:** HU-CON-007, HU-CON-009
