# 📅 Módulo de Asistencia Escolar

**Sistema:** Academia Neiva  
**Módulo:** Registro y Control de Asistencia y Fallas  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo gestiona el registro diario y el ausentismo escolar de los estudiantes. Permite a los docentes tomar asistencia en cada bloque de clase de sus asignaturas, indicando si el alumno está presente, ausente, llegó tarde o tiene una falla justificada. Además, proporciona a los estudiantes y padres de familia el acceso interactivo al historial detallado de inasistencias y reporta estadísticas consolidadas en el boletín del periodo.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Docente** | Registro, edición y consulta diaria del control de asistencia del curso asignado. Visualización de historiales de fallas. |
| **Estudiante** | Consulta del acumulado de fallas de asistencia por periodo y asignatura. |
| **Padre** | Monitoreo en tiempo real y consulta detallada del registro diario de asistencia e inasistencias justificadas de sus hijos. |
| **Directivo** | Consulta analítica del ausentismo institucional para alertas tempranas de deserción. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Obtener listado de estudiantes para toma de asistencia | `GET` | `/api/teacher/attendance/:detailGradeId/:date` | Docente |
| Guardar planilla de asistencia de la fecha | `POST` | `/api/teacher/attendance` | Docente |
| Consultar historial de asistencia del curso | `GET` | `/api/teacher/attendance-history/:detailGradeId` | Docente |
| Consultar inasistencias desde el portal estudiantil | `GET` | `/api/student/attendance/:id_estudiante/:id_periodo` | Estudiante / Padre |

---

## 4. Reglas de Negocio

- **RN-ASI-001 (Tipos de Estado de Asistencia):** Las fallas y registros diarios se tipifican a través del enum `estado_asistencia` en cuatro estados:
  - `PRESENTE`: El estudiante asistió normalmente a la sesión.
  - `AUSENTE`: Falla sin justificar. Suma al ausentismo general del alumno.
  - `TARDE`: Llegada tarde a clase. A discreción de la institución puede sumar fracciones de falla.
  - `JUSTIFICADA`: Falla justificada por excusa médica o calamidad. No penaliza al estudiante en reportes de pérdida por fallas.
- **RN-ASI-002 (Regla de Límite Diario — Máximo 7 Bloques):** Para asegurar la consistencia y veracidad de los datos frente a imposibilidades físicas de la jornada escolar:
  - **Ningún estudiante puede tener registrado más de 7 bloques de asistencia en un mismo día.**
  - Si un docente intenta guardar una planilla que cause que un estudiante supere el límite diario de 7 bloques, la operación del backend se aborta con error detallando el nombre del alumno para su corrección inmediata.
- **RN-ASI-003 (Actualizaciones de Bloque Académico):** La regla de límite diario permite corregir y actualizar asistencias ya existentes para la misma materia, fecha y grupo, ya que el sistema reconoce que se trata del mismo bloque académico y modifica el registro existente en lugar de contabilizarlo como una nueva asistencia.
- **RN-ASI-004 (Bloqueo por Periodo Cerrado):** La inserción, actualización o eliminación de registros de asistencia se bloquea a nivel de trigger de base de datos (`fn_bloquear_periodo_cerrado`) si la fecha elegida corresponde a un periodo académico que se encuentra en estado `CERRADO`.
- **RN-ASI-005 (Consolidado para Boletín):** Al cierre del periodo escolar, las fallas no justificadas (`AUSENTE`) se suman por asignatura y el total consolidado se escribe de forma permanente en el reporte del Boletín de Calificaciones.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller** | [attendanceController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/attendanceController.ts) — Carga y guardado de planillas de asistencia diaria, cálculo de acumulados de fallas por curso. |
| **Routes** | [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts), [student.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/student.routes.ts) |
| **Triggers de Base de Datos** | [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Trigger `fn_bloquear_periodo_cerrado` aplicado a la tabla `registro_asistencia`. |

### Frontend

| Tipo | Archivo |
|---|---|
| **Planilla Asistencia** | [TeacherAttendance.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherAttendance.vue) — Interfaz del docente para marcar asistencia con un solo clic. |
| **Portal Estudiante** | [StudentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentAttendanceView.vue) |
| **Portal Padre** | [ParentAttendanceView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentAttendanceView.vue) |

---

## 6. Modelo de Datos

### Tabla: `registro_asistencia`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_asistencia` | SERIAL PK | Identificador único del registro. |
| `id_estudiante` | INT FK | Estudiante calificado. |
| `id_detallegrado` | INT FK | Asignación de curso y materia. |
| `fecha` | TIMESTAMPTZ | Fecha de la toma de asistencia (de control para periodos). |
| `estado` | `estado_asistencia` | `PRESENTE`, `AUSENTE`, `TARDE`, `JUSTIFICADA`. |
| `id_colegio` | INT FK | Colegio propietario. |

### Types relevantes

```sql
CREATE TYPE public.estado_asistencia AS ENUM (
    'PRESENTE', 'AUSENTE', 'TARDE', 'JUSTIFICADA'
);
```

---

## 7. Conexiones con Otros Módulos

- **→ Estructura Escolar**: Consulta los estudiantes matriculados en el grupo para poblar la planilla de la clase.
- **→ Configuración Académica**: El trigger de asistencia verifica que la fecha evaluada corresponda a un periodo con estado `ABIERTO` en la institución.
- **→ Boletines**: Extrae la sumatoria de inasistencias por materia para el reporte PDF.

---

## 8. Validaciones Implementadas

### Backend
- Validación estricta que aborta la transacción si algún estudiante supera los 7 bloques de clase al día.
- Validación de fecha: impide guardar asistencias con fechas futuras o mayores al día actual.
- Control redundante en SQL contra modificaciones en periodos cerrados.

### Frontend
- Panel interactivo: botones reactivos que cambian de color según el estado seleccionado (verde: Presente, rojo: Ausente, amarillo: Tarde, azul: Justificada).
- Control de fecha por calendario que inhabilita fechas futuras en la interfaz.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Límite Físico de 7 Bloques** | Evita errores de digitación por parte de los docentes que duplican planillas el mismo día por accidente, garantizando la consistencia estadística de ausentismo del colegio. |
| **Carga de Planilla con Estado Default** | Al abrir la asistencia de una fecha, el sistema precarga a todos los estudiantes en estado `PRESENTE` por defecto, de modo que el docente solo tenga que hacer clic sobre los estudiantes ausentes o que llegaron tarde, acelerando la toma de asistencia en el aula. |
