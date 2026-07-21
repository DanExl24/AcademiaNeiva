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
