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

### RN-CONF-004: Configuración y Detección Automática de Escalas Valorativas (Modo AUTOMATICO vs MANUAL)
- **Descripción:** La institución educativa puede operar sus escalas valorativas nacionales (`BAJO`, `BASICO`, `ALTO`, `SUPERIOR`) bajo dos modalidades reguladas en `configuracion_colegio.escala_modo`:
  1. **Modo `AUTOMATICO` (Detección y Partición Algorítmica):**
     El sistema detecta y calcula los límites numéricos de cada escala automáticamente a partir de 3 parámetros institucionales (`nota_minima`, `nota_maxima` y `nota_aprobacion`):
     - **Zona Reprobatoria (`BAJO`):**
       - Límite mínimo: `nota_minima`
       - Límite máximo: $\text{roundToOne}(\text{nota\_aprobacion} - 0.1)$
     - **Zona Aprobatoria (Partición Equitativa en 3 Tercios):**
       - Tramo aprobado: $\text{Span} = \text{nota\_maxima} - \text{nota\_aprobacion}$
       - **`BASICO`:** Desde `nota_aprobacion` hasta $\text{roundToOne}(\text{nota\_aprobacion} + \frac{\text{Span}}{3})$
       - **`ALTO`:** Desde $\text{roundToOne}(\text{basic\_max} + 0.1)$ hasta $\text{roundToOne}(\text{nota\_aprobacion} + \frac{2 \times \text{Span}}{3})$
       - **`SUPERIOR`:** Desde $\text{roundToOne}(\text{alto\_max} + 0.1)$ hasta `nota_maxima`
     - **Continuidad y Normalización:** Todos los valores se redondean a 1 decimal (`roundToOne`) para asegurar continuidad numérica sin vacíos entre niveles.
  2. **Modo `MANUAL` (Personalización Institucional con Validación de Cortes):**
     Permite a la institución ajustar los límites superiores de `BASICO` y `ALTO` mediante `PUT /api/academic-admin/settings/scales/manual`, siempre que:
     - No existan solapamientos entre niveles.
     - Se respete que el límite inferior de `BAJO` sea `nota_minima` y el superior de `SUPERIOR` sea `nota_maxima`.
     - El corte de aprobación inicie estrictamente en `nota_aprobacion`.
  3. **Rescalado Proporcional Dinámico de Calificaciones:**
     Al actualizar el rango de notas de la institución (ej. de 0.0–5.0 a 0.0–10.0), el sistema rescala automáticamente todas las notas registradas en `notas_actividad` aplicando la fórmula proporcional para preservar el desempeño histórico de los estudiantes:
     $$\text{Nota\_Nueva} = \text{Nueva\_Min} + \left(\frac{\text{Nota\_Actual} - \text{Antigua\_Min}}{\text{Antigua\_Max} - \text{Antigua\_Min}}\right) \times (\text{Nueva\_Max} - \text{Nueva\_Min})$$
- **Motivo:** Garantiza consistencia matemática en el cálculo y visualización de los boletines de calificaciones, evitando que una nota quede sin clasificar o pertenezca a dos descriptores simultáneamente.
- **Módulos afectados:** Configuración Académica, Calificaciones, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [helpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/helpers.ts) (`buildAutomaticScales`, `buildManualScales`, `syncSchoolScalesAndGrades`)
  - [schoolConfigController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/schoolConfigController.ts) (`updateSchoolDefaultSettings`, `updateManualScaleConfiguration`)
  - [AcademicScalesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicScalesView.vue)
- **Endpoints relacionados:** 
  - `PUT /api/academic-admin/settings/defaults`
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

---

### RN-CONF-011: Exclusión Estricta de Periodos `PENDIENTE` en Vistas Operativas
- **Descripción:** Los periodos académicos cuyo estado sea `PENDIENTE` son totalmente invisibles e inhabilitados en los filtros de selección de todas las vistas operativas de la plataforma:
  - Planilla de Calificaciones (Docente)
  - Registro de Asistencia (Docente)
  - Observador del Estudiante (Docente)
  - Cierre de Periodos (Docente)
  - Portales de Estudiantes (Notas, Asistencia, Observaciones, Boletín, Dashboard)
  - Portales de Acudientes / Padres (Notas, Asistencia, Observaciones, Boletín)
  - Dashboard Principal / Compartido
- **Motivo:** Previene que docentes o usuarios finales interactúen o intenten registrar notas, asistencias o evaluaciones en periodos futuros que aún no abren oficialmente.
- **Módulos afectados:** Configuración Académica, Calificaciones, Asistencia, Observaciones, Portales Estudiante y Padre.
- **Archivos donde se implementa:** 
  - [periodHelpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts) (`getAllPeriodsForSchool`)
  - [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) (`getStudentAllPeriods`)
  - Vistas Vue frontend ([TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue), [TeacherObservations.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherObservations.vue), etc.)
- **Endpoints relacionados:** 
  - `GET /api/teacher/periods/:schoolId`
  - `GET /api/student/all-periods/:id_estudiante/:id_anio`
- **Historias de usuario relacionadas:** HU-CON-001, HU-CON-002

---

---

### RN-CONF-013: Eliminación Protegida de Periodos Académicos
- **Descripción:** La eliminación de un periodo académico (`DELETE /api/academic-admin/settings/periods/:id`) está estrictamente condicionada por cuatro barreras de seguridad e integridad del sistema:
  1. **Estado del Periodo:** Solo se pueden eliminar periodos en estado `PENDIENTE`. Los periodos en estado `ABIERTO` o `CERRADO` no admiten eliminación bajo ninguna circunstancia.
  2. **Ciclo del Año Lectivo:** No se puede eliminar ningún periodo si el año lectivo se encuentra `CERRADO`.
  3. **Barrera Cronológica (Vigencia de Fechas):** No es posible eliminar un periodo si la fecha actual del sistema ya alcanzó o superó la fecha de inicio (`mes_inicio`, `dia_inicio`) o fin del periodo (`now >= periodStartDate`).
  4. **Integridad Relacional (Dependencias Académicas):** El sistema verifica que no existan calificaciones (`resultado_academico`), actividades (`actividad_materia`), observaciones (`observacion_estudiante`), competencias pedagógicas (`competencias`) o cierres (`cierre_materia`) asociados. Si existe alguna dependencia, se bloquea la operación con `400 Bad Request`.
- **Motivo:** Previene la pérdida irreversible de registros escolares y evita inconsistencias en cálculos ponderados anuales y promedios consolidados.
- **Módulos afectados:** Configuración Académica, Calificaciones, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) (`deleteAcademicPeriod`)
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`canDeletePeriod`)
- **Endpoints relacionados:** 
  - `DELETE /api/academic-admin/settings/periods/:id`
- **Historias de usuario relacionadas:** HU-CON-001, HU-CON-002

---

### RN-CONF-014: Control de Edición y Actualización de Periodos según su Estado
- **Descripción:** La modificación de los datos de un periodo académico (ponderación porcentual `%` y vigencia de fechas `mes_inicio`, `dia_inicio`, `mes_fin`, `dia_fin`) mediante `PATCH /api/academic-admin/settings/periods/:id/percentage` está sujeta a controles estrictos basados en su estado operativo:
  1. **Periodo en estado `PENDIENTE`:** Admite edición libre de ponderaciones y fechas, garantizando que no se solape con otros periodos (`RN-CONF-008`), que la suma anual no supere el 100% (`RN-CONF-005`) y que sus fechas no antecedan al periodo actualmente `ABIERTO`.
  2. **Periodo en estado `ABIERTO`:** Admite ajuste de porcentajes y ampliación o modificación de fechas límite para responder a contingencias del calendario escolar, sin solaparse con otros periodos y respetando el tope del 100%. No admite retroceder a `PENDIENTE`.
  3. **Periodo en estado `CERRADO`:** **Bloqueo total de edición.** No se permite modificar porcentajes ni rangos de fechas de periodos cerrados para evitar la alteración retroactiva de promedios consolidados y boletines ya emitidos. Si se requiere realizar ajustes, el directivo debe reabrir formalmente el periodo primero (`POST /api/academic-admin/settings/periods/:id/reopen`). En la UI, el botón de edición se deshabilita automáticamente.
  4. **Año Lectivo `CERRADO`:** Si el año lectivo se encuentra cerrado, ningún periodo del ciclo admite modificación alguna.
- **Motivo:** Garantiza la inmutabilidad de la información institucional histórica y protege la consistencia de los boletines de calificaciones y consolidados anuales emitidos.
- **Módulos afectados:** Configuración Académica, Calificaciones, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) (`updateAcademicPeriodPercentage`)
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`canEditPeriod`)
- **Endpoints relacionados:** 
  - `PATCH /api/academic-admin/settings/periods/:id/percentage`
- **Historias de usuario relacionadas:** HU-CON-001, HU-CON-002, HU-CON-004

---

### RN-CONF-015: Eliminación Protegida de Años Lectivos e Integridad Académica
- **Descripción:** La eliminación de un año lectivo (`DELETE /api/academic-admin/settings/years/:id`) exige cumplir estrictamente las siguientes condiciones de seguridad relacional:
  1. **Estado del Año:** Solo se permite eliminar años lectivos que NO se encuentren en estado `CERRADO`. Un año cerrado contiene historial consolidado y actas de grado archivadas.
  2. **Límite Mínimo Institucional:** La institución educativa debe conservar al menos un (1) año lectivo registrado. No se puede eliminar el único año existente.
  3. **Ausencia Absoluta de Relaciones Académicas:**
     - **Matrículas:** No debe tener alumnos matriculados (`matricula`).
     - **Carga Académica y Asignaciones:** No debe tener cursos o docentes asignados en `detalle_grados`.
     - **Malla Curricular:** No debe tener competencias pedagógicas registradas en `competencias`.
     - **Periodos Operativos o Notas:** Ningún periodo del año puede estar en estado `ABIERTO` o `CERRADO`, ni poseer calificaciones (`resultado_academico`), actividades (`actividad_materia`) u observaciones (`observacion_estudiante`).
     - **Graduados o Promociones:** No debe poseer registros en `registro_graduados` ni en `decision_promocion_directivo`.
  4. **Garantía de Año Activo:** Si el año eliminado era el activo y la institución posee otros años disponibles, el sistema promueve y reactiva automáticamente el año más reciente a estado `ABIERTO`.
- **Motivo:** Evita la destrucción accidental de la base de datos escolar y asegura que ningún curso, matrícula o registro académico quede huérfano.
- **Módulos afectados:** Configuración Académica, Matrículas, Estructura Escolar, Calificaciones.
- **Archivos donde se implementa:** 
  - [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) (`deleteAcademicYear`)
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) (`deleteYear`)
- **Endpoints relacionados:** 
  - `DELETE /api/academic-admin/settings/years/:id`
- **Historias de usuario relacionadas:** HU-CON-001, HU-CON-007

---

### RN-CONF-016: Inmutabilidad del Tipo de Calendario en Años Lectivos Creados
- **Descripción:** El esquema de calendario escolar (`tipo_calendario`: Calendario A o Calendario B) queda estrictamente definido al momento de crear el año lectivo (`POST /api/academic-admin/settings/years`) y es **inmutable** a partir de ese instante.
  - En la interfaz de usuario, el tipo de calendario se visualiza como una etiqueta informativa estática (solo lectura).
  - El endpoint `PATCH /api/academic-admin/settings/years/:id/calendar-type` rechaza cualquier intento de modificación con error `400 Bad Request`.
  - Si una institución necesita operar bajo otro calendario (por ejemplo, migrar a Calendario B), debe registrar un nuevo año lectivo configurando dicho calendario durante su creación.
- **Motivo:** Cambiar el tipo de calendario en un año existente desfasaría las vigencias de fechas de periodos, las matrices de evaluación y los cortes de periodos preestablecidos.
- **Módulos afectados:** Configuración Académica, Periodos Académicos.
- **Archivos donde se implementa:** 
  - [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) (`updateAcademicYearCalendarType`)
  - [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/settings/years`
  - `PATCH /api/academic-admin/settings/years/:id/calendar-type`
- **Historias de usuario relacionadas:** HU-CON-001, HU-CON-007

