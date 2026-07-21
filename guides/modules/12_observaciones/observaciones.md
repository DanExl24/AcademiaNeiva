# 📝 Módulo de Observaciones del Estudiante

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Observaciones y Seguimiento del Estudiante  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo facilita a los docentes el registro de observaciones pedagógicas y disciplinarias sobre el desempeño general y la convivencia de los estudiantes. Estas anotaciones alimentan el historial del observador del estudiante y brindan una retroalimentación detallada tanto a los directivos como a los padres de familia. Adicionalmente, las observaciones de tipo académico son consolidadas automáticamente al final del periodo lectivo como parte integral del Boletín de Calificaciones.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Docente** | CRUD completo de observaciones para los estudiantes de sus cursos asignados. |
| **Directivo** | Consulta del historial de observaciones en la ficha resumen del estudiante. |
| **Estudiante** | Consulta pasiva de las observaciones académicas y disciplinarias del periodo actual e históricos en su dashboard personal. |
| **Padre** | Seguimiento y lectura de las observaciones y anotaciones del observador registradas a sus hijos a cargo. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Obtener observaciones del curso del docente | `GET` | `/api/teacher/observations/:detailGradeId/:periodId` | Docente |
| Registrar nueva observación sobre un estudiante | `POST` | `/api/teacher/observations` | Docente |
| Actualizar el texto o tipo de una observación | `PUT` | `/api/teacher/observations/:id` | Docente |
| Eliminar anotación del observador | `DELETE` | `/api/teacher/observations/:id` | Docente |
| Consultar observaciones desde el portal estudiantil | `GET` | `/api/student/observations/:id_estudiante/:id_periodo` | Estudiante / Padre |

---

## 4. Reglas de Negocio

- **RN-OBS-001 (Tipología de Observaciones):** Toda anotación registrada en el observador del estudiante debe clasificarse en alguno de los siguientes tipos regulados por la columna `tipo`:
  1. `ACADEMICA`: Fortalezas, debilidades y recomendaciones del rendimiento del estudiante en la asignatura. Es obligatoria para cada estudiante evaluado en el periodo.
  2. `CONVIVENCIA`: Comportamiento social, respeto y cumplimiento de normas dentro del aula.
  3. `DISCIPLINARIA`: Llamados de atención formales o sanciones del manual de convivencia.
  4. `OTRO`: Destrezas, puntualidad o participación en eventos deportivos/culturales.
- **RN-OBS-002 (Obligatoriedad de Observación Académica):** Para poder realizar la consolidación y cierre de una materia del periodo, el docente debe registrar de forma obligatoria al menos una observación de tipo `ACADEMICA` para cada estudiante con matrícula activa.
- **RN-OBS-003 (Integración con Boletín de Calificaciones):** La observación de tipo `ACADEMICA` registrada por el docente para el periodo se extrae de forma automática y se concatena bajo la nota definitiva de la respectiva asignatura en el Boletín de Calificaciones PDF.
- **RN-OBS-004 (Distribución en Seeder de Pruebas):** El inicializador de datos del sistema (`seed_grades.ts`) simula la dinámica escolar asignando observaciones de forma aleatoria para las pruebas de las consolas analíticas:
  - Observaciones `ACADEMICA`: 100% de estudiantes evaluados.
  - Observaciones `CONVIVENCIA`: ~20% de estudiantes de manera aleatoria.
  - Observaciones `DISCIPLINARIA`: ~10% de estudiantes.
  - Observaciones `OTRO`: ~10% de estudiantes.
- **RN-OBS-005 (Protección contra Modificaciones en Periodo Cerrado):** Al igual que las calificaciones, la creación, edición o eliminación de cualquier registro de observación se bloquea a nivel de trigger de base de datos (`fn_bloquear_periodo_cerrado`) si el periodo escolar correspondiente se encuentra en estado `CERRADO`.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller** | [observationController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/observationController.ts) — CRUD de observaciones para docentes y obtención de historiales. |
| **Routes** | [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts), [student.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/student.routes.ts) |
| **Triggers de Base de Datos** | [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Trigger `fn_bloquear_periodo_cerrado` aplicado a la tabla `observacion_estudiante`. |

### Frontend

| Tipo | Archivo |
|---|---|
| **Gestor Docente** | [TeacherObservations.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherObservations.vue) — Interfaz para el registro de anotaciones del observador agrupadas por asignatura. |
| **Portal Estudiante** | [StudentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentObservationsView.vue) |
| **Portal Padre** | [ParentObservationsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentObservationsView.vue) |

---

## 6. Modelo de Datos

### Tabla: `observacion_estudiante`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_observacion` | SERIAL PK | Identificador único de la observación. |
| `id_estudiante` | INT FK | Estudiante asociado a la anotación. |
| `id_detallegrado` | INT FK | Materia y grupo en el que se emite la observación. |
| `id_periodo` | INT FK | Periodo académico correspondiente. |
| `fortalezas` | TEXT | Fortalezas académicas/comportamentales del alumno (opcional). |
| `debilidades` | TEXT | Puntos a mejorar (opcional). |
| `recomendaciones` | TEXT | Sugerencias pedagógicas/de convivencia (opcional). |
| `fecha` | TIMESTAMPTZ | Fecha de registro de la anotación. |
| `id_colegio` | INT FK | Colegio propietario. |
| `tipo` | `tipo_observacion` | Tipo de anotación (`ACADEMICA`, `CONVIVENCIA`, `OTRO`, `DISCIPLINARIA`). |

### Types relevantes

```sql
CREATE TYPE public.tipo_observacion AS ENUM (
    'ACADEMICA', 'CONVIVENCIA', 'OTRO', 'DISCIPLINARIA'
);
```

---

## 7. Conexiones con Otros Módulos

- **→ Calificaciones y Cierre de Periodo**: Impide consolidar y cerrar el periodo por materia si quedan alumnos sin observación académica registrada.
- **→ Boletines**: Agrega las observaciones académicas bajo el rendimiento de cada materia en el PDF generado.
- **→ Estudiantes y Estados**: Los directivos consultan el historial acumulado de las observaciones para analizar procesos de sanción.

---

## 8. Validaciones Implementadas

### Backend
- Bloqueo en cascada contra la creación/modificación de observaciones si el periodo escolar asociado se encuentra en estado `CERRADO`.
- Aislamiento multi-tenant: Valida que el estudiante y la asignación pertenezcan al mismo colegio del docente que realiza la consulta.

### Frontend
- Formularios interactivos con advertencias visuales y selectores reactivos por tipo de observación.
- Bloqueo de escritura en la interfaz si el periodo de notas está cerrado.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Estructura Desglosada (Fortalezas, Debilidades, Recomendaciones)** | En lugar de un solo campo de texto libre, esta división obliga al docente a estructurar una retroalimentación balanceada y formativa. |
| **Asociación por Asignación Académica** | Ligar las observaciones a `detalle_grados` permite saber exactamente qué docente y en qué materia se generó la observación, facilitando la auditoría de convivencia. |
