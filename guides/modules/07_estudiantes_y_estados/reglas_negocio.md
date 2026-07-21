# Reglas de Negocio — Estudiantes y Estados

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Gestión de Estudiantes y Estados de AcademiaNeiva.

---

## Ciclo de Vida y Seguridad

### RN-ESTU-001: Correlación de Estados Estudiante - Matrícula
- **Descripción:** El estado personal del estudiante en la tabla `estudiante` y el estado de su matrícula en la tabla `matricula` deben mantenerse estrictamente sincronizados según las siguientes condiciones:
  - Estudiante `ACTIVO` → Matrícula `ACTIVA` (Acceso habilitado)
  - Estudiante `SANCIONADO` → Matrícula `ACTIVA` (Acceso habilitado con advertencias en la UI)
  - Estudiante `RETIRADO` → Matrícula `CANCELADA` con motivo `'RETIRO_VOLUNTARIO'` (Acceso bloqueado)
  - Estudiante `EXPULSADO` → Matrícula `CANCELADA` con motivo `'EXPULSION'` (Acceso bloqueado)
- **Motivo:** Asegura la coherencia de datos; un alumno retirado del plantel no debe figurar en las listas de clase activas ni consumir plazas en el aula.
- **Módulos afectados:** Estudiantes y Estados, Matrículas e Inscripciones, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (`updateStudentStatus`)
- **Endpoints relacionados:** 
  - `PATCH /api/student/:id/status`
- **Historias de usuario relacionadas:** HU-ESTU-003

---

### RN-ESTU-002: Inactivación Inmediata de Acceso a Portales
- **Descripción:** Cuando el estado de un estudiante se modifica a `RETIRADO` o `EXPULSADO`, el backend inhabilitará de forma automática su cuenta asociada en la tabla `usuario` cambiando la columna `estado` a `'SUSPENDIDO'` o inactivándola.
- **Motivo:** Protege la privacidad de la información académica del colegio e impide que un exalumno acceda al portal de estudiantes de forma retroactiva.
- **Módulos afectados:** Estudiantes y Estados, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (`updateStudentStatus` - bloque de inactivación de usuario)
- **Endpoints relacionados:** 
  - `PATCH /api/student/:id/status`
- **Historias de usuario relacionadas:** HU-ESTU-004

---

### RN-ESTU-003: Sincronización Disciplinaria Automática (Trigger)
- **Descripción:** Al insertar o modificar una sanción en la tabla `sancion` cuya fecha de inicio y fin coincida con la fecha actual del servidor, el trigger `fn_sync_estudiante_sancion` conmutará de manera automática el estado del estudiante a `SANCIONADO` o `EXPULSADO`. Al vencer la fecha de la sanción, el trigger restablece el estado del estudiante a `ACTIVO` si no quedan sanciones vigentes.
- **Motivo:** Evita retrasos en la aplicación de medidas de convivencia y automatiza el levantamiento de suspensiones sin requerir intervención manual diaria.
- **Módulos afectados:** Estudiantes y Estados.
- **Archivos donde se implementa:** 
  - [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) (Función trigger `fn_sync_estudiante_sancion`)
- **Endpoints relacionados:** 
  - `PATCH /api/student/:id/status` (a través de sanciones)
- **Historias de usuario relacionadas:** HU-ESTU-003

---

## Boletines y Analíticas

### RN-ESTU-004: Restricción de Generación de Boletines
- **Descripción:** El motor de generación de boletines del periodo (individual o masivo) solo emitirá el reporte PDF para aquellos estudiantes que cuenten con matrícula `ACTIVA` (estados `ACTIVO` o `SANCIONADO`).
- **Motivo:** Cumple con la normatividad académica al no certificar periodos a estudiantes que han abandonado o han sido expulsados del plantel antes de finalizar el trimestre.
- **Módulos afectados:** Estudiantes y Estados, Cierre y Boletines.
- **Archivos donde se implementa:** 
  - [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) (Filtro de exclusión de matrículas canceladas)
- **Endpoints relacionados:** 
  - `GET /api/boletines/student/:id_estudiante/:id_periodo`
  - `GET /api/boletines/grade/:id_grupo/:id_periodo`
- **Historias de usuario relacionadas:** HU-ESTU-004

---

### RN-ESTU-005: Exclusión Estadística de Matrículas Canceladas
- **Descripción:** Los cálculos analíticos de rendimiento escolar, promedios generales de asignaturas y porcentaje de reprobados del Dashboard Directivo omitirán a los estudiantes que posean matrícula `CANCELADA` en el año escolar en curso.
- **Motivo:** Previene desvíos en los promedios y estadísticas del periodo activo causados por el historial de estudiantes desertores o expulsados.
- **Módulos afectados:** Estudiantes y Estados, Dashboard Analítico.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`getDirectivoDashboard` - cláusulas sql con filtro de matrícula activa)
- **Endpoints relacionados:** 
  - `GET /api/academic-admin/dashboard/:schoolId`
- **Historias de usuario relacionadas:** HU-ESTU-001
