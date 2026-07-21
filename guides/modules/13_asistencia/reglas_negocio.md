# Reglas de Negocio — Asistencia Escolar

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Asistencia Escolar de AcademiaNeiva.

---

## Control de Bloques y Limites

### RN-ASI-001: Límite Estricto de 7 Bloques de Clase al Día
- **Descripción:** El backend verificará antes de guardar cualquier planilla de asistencia que ningún estudiante supere un total máximo de 7 bloques de clase registrados en la misma fecha calendario.
- **Motivo:** Garantiza la coherencia de los datos evitando errores de digitación por docentes que dupliquen la toma de asistencia el mismo día.
- **Módulos afectados:** Asistencia Escolar.
- **Archivos donde se implementa:** 
  - [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts) (`saveAttendance` - consulta de validación de límite de bloques por estudiante)
- **Endpoints relacionados:** 
  - `POST /api/teacher/attendance`
- **Historias de usuario relacionadas:** HU-ASI-001

---

### RN-ASI-002: Clasificación de Estados de Asistencia (Enum)
- **Descripción:** Toda entrada en la tabla `registro_asistencia` debe usar uno de los cuatro valores del enum `estado_asistencia`:
  - `PRESENTE`: Asistencia normal a clase.
  - `AUSENTE`: Falla no justificada. Contabiliza para el total de inasistencias en boletines.
  - `TARDE`: Llegada fuera de horario al aula.
  - `JUSTIFICADA`: Inasistencia respaldada por excusa. No penaliza en boletines.
- **Motivo:** Estandariza los tipos de inasistencias requeridos para los consolidados institucionales.
- **Módulos afectados:** Asistencia Escolar, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts) (`saveAttendance`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/attendance`
- **Historias de usuario relacionadas:** HU-ASI-001, HU-ASI-003

---

### RN-ASI-003: Reconocimiento de Mismo Bloque en Ediciones
- **Descripción:** Al volver a guardar la asistencia de la misma asignatura (`id_detallegrado`) y misma fecha, el sistema actualizará el estado del registro existente en lugar de crear un nuevo bloque de asistencia.
- **Motivo:** Permite la corrección de planillas sin incrementar falsamente el contador diario de bloques del estudiante.
- **Módulos afectados:** Asistencia Escolar.
- **Archivos donde se implementa:** 
  - [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts) (`saveAttendance` - query UPSERT / ON CONFLICT)
- **Endpoints relacionados:** 
  - `POST /api/teacher/attendance`
- **Historias de usuario relacionadas:** HU-ASI-002

---

## Integración e Inmutabilidad

### RN-ASI-004: Inmutabilidad por Periodo Cerrado (Trigger SQL)
- **Descripción:** El trigger de base de datos `fn_bloquear_periodo_cerrado` calculará el mes y día del registro de asistencia. Si la fecha corresponde a un periodo en estado `CERRADO`, PostgreSQL abortará la sentencia SQL.
- **Motivo:** Invalida cualquier intento de cambiar la asistencia de periodos cuyas calificaciones y consolidados de inasistencia ya fueron entregados.
- **Módulos afectados:** Asistencia Escolar, Configuración Académica.
- **Archivos donde se implementa:** 
  - [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) (Trigger `fn_bloquear_periodo_cerrado`)
- **Endpoints relacionados:** 
  - `POST /api/teacher/attendance`
- **Historias de usuario relacionadas:** HU-ASI-002

---

### RN-ASI-005: Acumulación de Inasistencias en Resultado Académico
- **Descripción:** Al consolidar y cerrar la materia del periodo, la sumatoria de registros con estado `AUSENTE` se guarda en la columna `falla_asistencia` de la tabla `resultado_academico` para su impresión en el boletín.
- **Motivo:** Otimiza la generación de boletines PDF al evitar el conteo en caliente de millones de filas de inasistencia durante las impresiones masivas.
- **Módulos afectados:** Asistencia Escolar, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) (`closePeriodForTeacher` - conteo de fallas)
- **Endpoints relacionados:** 
  - `POST /api/teacher/close-period`
- **Historias de usuario relacionadas:** HU-ASI-003
