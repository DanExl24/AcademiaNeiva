# 📊 Módulo de Calificaciones y Actividades Académicas

**Sistema:** Academia Neiva  
**Módulo:** Registro de Calificaciones, Criterios y Actividades de Evaluación  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo gestiona la evaluación del rendimiento académico de los estudiantes. Permite a los docentes diseñar actividades evaluativas dentro de sus asignaturas y desglosarlas opcionalmente en múltiples criterios porcentuales (ej. Talleres, Exámenes). Asimismo, habilita el registro masivo y la consulta en tiempo real de calificaciones para los docentes, coordinadores, estudiantes y padres de familia. Al final de cada periodo, consolida las calificaciones ponderadas de los alumnos vinculándolas a la escala de valoración institucional.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Docente** | CRUD de actividades y criterios evaluativos de sus asignaturas. Registro y modificación masiva de calificaciones. |
| **Directivo** | Consulta y auditoría de calificaciones a nivel institucional. Reapertura de materias. |
| **Estudiante** | Consulta del desglose detallado de sus notas por actividad y asignatura. |
| **Padre** | Monitoreo y consulta en tiempo real de las calificaciones de sus hijos. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Listar actividades creadas para un curso | `GET` | `/api/teacher/activities/:gradeId/:subjectId/:periodId` | Docente |
| Crear actividad evaluativa de asignatura | `POST` | `/api/teacher/activities` | Docente |
| Actualizar ponderación o nombre de actividad | `PUT` | `/api/teacher/activities/:id` | Docente |
| Eliminar actividad evaluativa | `DELETE` | `/api/teacher/activities/:id` | Docente |
| Crear criterio de evaluación dentro de actividad | `POST` | `/api/teacher/activities/criteria` | Docente |
| Eliminar criterio de evaluación | `DELETE` | `/api/teacher/activities/criteria/:id` | Docente |
| Obtener planilla de calificaciones del curso | `GET` | `/api/teacher/grades/:gradeId/:subjectId/:periodId` | Docente |
| Registrar o actualizar calificaciones de estudiantes | `POST` | `/api/teacher/grades` | Docente |
| Consultar promedios consolidados del estudiante | `GET` | `/api/student/grades/:id_estudiante/:id_periodo` | Estudiante / Padre |
| Consultar detalle de notas por asignatura | `GET` | `/api/student/grade-details/:id_estudiante/:id_periodo/:id_materia` | Estudiante / Padre |

---

## 4. Reglas de Negocio

- **RN-CAL-001 (Estructura Evaluativa Ponderada):** La evaluación académica se rige bajo una estructura jerárquica de dos niveles:
  ```
  Asignatura (Materia)
     └── Actividades Académicas (actividad_materia) (porcentaje acumulado = 100%)
            └── Criterios de Evaluación (criterio_evaluacion) (porcentaje acumulado = 100%)
  ```
  - La sumatoria de las ponderaciones de todas las actividades debe dar exactamente el 100% para consolidar la nota definitiva.
  - Si una actividad contiene criterios, la sumatoria de sus ponderaciones también debe ser exactamente el 100%.
- **RN-CAL-002 (Resolución de Registro de Nota):** Las calificaciones de los estudiantes se guardan de la siguiente manera:
  - Si la actividad tiene criterios evaluativos definidos, las notas se registran individualmente en la tabla `nota_criterio`. La nota de la actividad se calcula automáticamente como el promedio ponderado de estas.
  - Si la actividad **no** tiene criterios de evaluación asociados, las notas se registran directamente en la tabla `notas_actividad`.
- **RN-CAL-003 (Protección de Periodo Cerrado):** No se permite la creación o edición de actividades, criterios ni calificaciones si el periodo académico correspondiente o el cierre de materia específico se encuentra en estado `CERRADO`.
- **RN-CAL-004 (Distribución Estadística del Seeder):** Para simular un entorno escolar realista, el inicializador de datos del sistema (`seed_grades.ts`) utiliza un algoritmo estadístico de distribución de notas:
  - Nota reprobatoria (1.0 a 2.9): 15% de probabilidad.
  - Nota básica (3.0 a 3.9): 35% de probabilidad.
  - Nota alta (4.0 a 4.5): 30% de probabilidad.
  - Nota superior (4.6 a 5.0): 20% de probabilidad.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller de Notas** | [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) — CRUD de actividades, criterios de evaluación, obtención de planillas de calificaciones y almacenamiento de notas. |
| **Controller del Estudiante** | [studentPortalController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentPortalController.ts) — Consultas de notas definitivas y detalles por asignatura. |
| **Routes** | [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts), [student.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/student.routes.ts) |

### Frontend

| Tipo | Archivo |
|---|---|
| **Planilla Docente** | [TeacherGrades.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherGrades.vue) — Interfaz interactiva para gestionar actividades, criterios y notas del curso. |
| **Detalle Estudiante** | [SubjectDetailsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/SubjectDetailsView.vue) — Desglose porcentual y visualización de notas de estudiantes. |

---

## 6. Modelo de Datos

### Tabla: `actividad_materia`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_actividadmateria` | SERIAL PK | Identificador único de la actividad evaluativa. |
| `id_detallegrado` | INT FK | Asignación docente-curso-materia. |
| `id_periodo` | INT FK | Periodo académico en el que se realiza la actividad. |
| `nombre` | VARCHAR(255) | Título de la actividad (ej. Evaluación Trimestral). |
| `porcentaje` | NUMERIC(5,2) | Peso de la actividad en la nota del periodo (ej. 30.00). |
| `id_colegio` | INT FK | Colegio propietario. |
| `id_competencia` | INT FK | Competencia curricular a la que se ancla la actividad. |

### Tabla: `criterio_evaluacion`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_criterio` | SERIAL PK | Identificador único del criterio. |
| `id_actividadmateria` | INT FK | Actividad padre a la que pertenece el criterio. |
| `descripcion` | TEXT | Descripción del criterio (ej. Presentación escrita). |
| `porcentaje` | NUMERIC(5,2) | Peso dentro de la actividad (ej. 50.00). |
| `id_colegio` | INT FK | Colegio propietario. |

### Tabla: `notas_actividad`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_notaactividad` | SERIAL PK | Identificador único de la calificación. |
| `id_actividadmateria` | INT FK | Actividad evaluada. |
| `id_estudiante` | INT FK | Estudiante calificado. |
| `id_escalavaloracion` | INT FK | Escala descriptiva asociada. |
| `nota` | NUMERIC(5,2) | Calificación numérica (ej. 4.20). |
| `id_colegio` | INT FK | Colegio propietario. |

### Tabla: `nota_criterio`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_nota_criterio` | SERIAL PK | Identificador único de la calificación de criterio. |
| `id_criterio` | INT FK | Criterio de evaluación calificado. |
| `id_estudiante` | INT FK | Estudiante calificado. |
| `nota` | NUMERIC(5,2) | Calificación numérica (ej. 3.50). |
| `id_colegio` | INT FK | Colegio propietario. |

---

## 7. Conexiones con Otros Módulos

- **→ Configuración Académica**: Consulta los límites numéricos (nota máxima y nota aprobatoria) configurados en el colegio, además de verificar si el periodo está abierto.
- **→ Competencias**: Asocia cada actividad evaluativa a una de las competencias curriculares planeadas.
- **→ Cierre de Periodo**: Consume las calificaciones de las actividades para ponderar el promedio final del estudiante.

---

## 8. Validaciones Implementadas

### Backend
- Validación de que la nota numérica registrada se encuentre dentro del rango válido (`nota_minima` a `nota_maxima`) del colegio.
- Verificación de que la sumatoria de actividades o criterios no supere el 100%.
- Control redundante contra la escritura de notas en periodos cerrados.

### Frontend
- Control interactivo de entrada: resalta celdas con notas reprobatorias en color rojo e impide el guardado de notas inválidas (ej. texto o fuera de rango).
- Autoguardado e indicador de carga al procesar cambios en la planilla de calificaciones.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Estructura Dinámica de Criterios** | Brinda total libertad al docente: si la asignatura requiere desglose exhaustivo (ej. Ciencias) usa criterios, si solo requiere una nota directa (ej. Educación Física) evalúa la actividad de forma directa. |
| **Cálculo de Promedios Ponderados en Frontend y Backend** | El backend calcula la nota definitiva para los reportes oficiales del boletín, mientras que la UI de Vue calcula los promedios en caliente en la vista de notas para dar retroalimentación instantánea al docente. |
