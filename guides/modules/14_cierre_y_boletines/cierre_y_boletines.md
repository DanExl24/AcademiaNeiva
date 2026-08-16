# 📄 Módulo de Cierre de Periodo y Generación de Boletines

**Sistema:** Academia Neiva  
**Módulo:** Cierre de Asignaturas, Consolidación de Resultados y Boletines PDF  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo coordina la fase final de cada periodo lectivo. Permite a los docentes consolidar y cerrar las calificaciones de sus materias asignadas calculando el promedio final de cada estudiante. Una vez que todas las materias de un periodo están cerradas, el directivo realiza el cierre institucional del periodo, lo que congela las calificaciones y habilita el motor de generación masiva o individual del Boletín de Calificaciones en formato PDF de alta precisión estética.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Docente** | Consolidar promedios y realizar el cierre del periodo por materia para sus cursos asignados. |
| **Directivo** | Consulta del estado de cierre de todas las materias. Ejecución del cierre institucional del periodo académico. Generación masiva de boletines PDF por grupo y descarga de reportes. |
| **Estudiante / Padre** | Consulta y descarga de su boletín de calificaciones una vez el periodo haya sido cerrado y aprobado por la institución. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Consultar estado de cierre de una asignatura | `GET` | `/api/teacher/closure-status/:detailGradeId/:periodId` | Docente |
| Ejecutar cierre de periodo por materia (docente) | `POST` | `/api/teacher/close-period` | Docente |
| Obtener detalles de cierre institucional del periodo | `GET` | `/api/academic-admin/settings/closure-details/:schoolId/:periodId` | Directivo |
| Validar si el periodo está cerrado para boletines | `GET` | `/api/boletines/validate/:id_colegio/:id_periodo` | Directivo |
| Generar boletín individual de estudiante | `GET` | `/api/boletines/student/:id_estudiante/:id_periodo` | Directivo / Estudiante / Padre |
| Generar boletines en bloque para todo un grado | `GET` | `/api/boletines/grade/:id_grupo/:id_periodo` | Directivo |

---

## 4. Reglas de Negocio

- **RN-CIE-001 (Flujo de Cierre de Asignatura):** El docente consolida una materia para un periodo a través de `closePeriodForTeacher`:
  1. El backend calcula el promedio ponderado de las actividades evaluativas de cada estudiante en base a sus porcentajes.
  2. Guarda o actualiza la nota consolidada en la tabla `resultado_academico`.
  3. Asocia la nota final a la escala descriptiva correspondiente (`BAJO`, `BASICO`, `ALTO`, `SUPERIOR`) en base a la configuración de escalas del colegio.
  4. Inserta un registro en `cierre_materia` con el estado `CERRADO`.
- **RN-CIE-002 (Cierre Institucional Directivo):** El directivo solo puede realizar el cierre institucional y la aprobación del periodo académico (`approveAcademicPeriod`) si el 100% de las asignaturas activas en `detalle_grados` para el periodo evaluado ya cuentan con su respectivo registro `CERRADO` en la tabla `cierre_materia`.
- **RN-CIE-003 (Habilitación de Boletines):** El motor de generación de boletines PDF (individual o en bloque) requiere de manera obligatoria que el periodo académico se encuentre en estado `CERRADO` institucionalmente. Si el periodo sigue `ABIERTO`, los botones de descarga de boletines se deshabilitan en el portal de directivos, estudiantes y padres.
- **RN-CIE-004 (Exclusión de Alumnos Trasladados e Inactivos):** El generador de boletines directivo (`BoletinGenerator.vue`) y el endpoint de generación en bloque (`GET /api/boletines/grade/:id_grupo/:id_periodo`) excluyen explícitamente a los estudiantes con matrícula en estado `TRASLADADA`, `CANCELADA` o inactiva en el año escolar correspondiente, garantizando que el selector y las descargas en bloque solo procesen alumnos con matrícula activa (`ACTIVA`/`APROBADA`) en la institución.
- **RN-CIE-005 (Reapertura de Cierre de Materia):** Por solicitud escrita del docente debido a correcciones de fuerza mayor, el directivo tiene la potestad de revertir el cierre de una materia específica ejecutando `reopenSubjectClosure`. Esto borra el registro de `cierre_materia` para la asignatura y habilita de nuevo al docente a modificar notas en su planilla, sin necesidad de reabrir el periodo completo de la institución.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller de Cierre** | [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) — `getClosureStatus`, `closePeriodForTeacher` (Consolidación de promedios y guardado en `resultado_academico`). |
| **Controller de Cierre Directivo** | [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) — `closeAcademicPeriod`, `approveAcademicPeriod`, `reopenAcademicPeriod`, `reopenSubjectClosure`, `getPeriodClosureDetails`. |
| **Controller de Boletines** | [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) — `validatePeriodClosed`, `getStudentBoletin`, `getGradeBoletines`. |
| **Routes** | [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts), [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts), [boletin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/boletin.routes.ts) |

### Frontend

| Tipo | Archivo |
|---|---|
| **Cierre Docente** | [TeacherClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherClosure.vue) — Botón de consolidación de asignatura con resumen de promedios. |
| **Cierre Directivo** | [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue) — Lista de control de materias cerradas/abiertas con barra de progreso. |
| **Generador Boletines** | [BoletinGenerator.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/BoletinGenerator.vue) — Interfaz de descarga de PDFs individuales o en bloque. |
| **Portal Estudiante / Padre** | [StudentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentBoletinView.vue), [ParentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentBoletinView.vue). |

---

## 6. Modelo de Datos

### Tabla: `cierre_materia`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_cierremateria` | SERIAL PK | Identificador único de cierre de materia. |
| `id_detallegrado` | INT FK | Asignación docente-curso-materia. |
| `id_periodo` | INT FK | Periodo cerrado. |
| `estado` | `estado_cierre_materia` | `ABIERTO`, `CERRADO`. |
| `fecha_cierre` | TIMESTAMPTZ | Fecha y hora en la que el docente consolidó. |

### Tabla: `resultado_academico`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_resultado` | SERIAL PK | Identificador del promedio del periodo. |
| `id_estudiante` | INT FK | Estudiante evaluado. |
| `id_detallegrado` | INT FK | Materia y grupo consolidado. |
| `id_periodo` | INT FK | Periodo de la calificación. |
| `nota_final` | NUMERIC(5,2) | Calificación promedio definitiva del trimestre. |
| `id_escalavaloracion` | INT FK | Referencia al rango descriptivo del colegio (Bajo, Alto, etc.). |
| `estado` | `estado_resultado` | Estado del resultado (`APROBADO`, `REPROBADO`, `EN_PROCESO`). |
| `falla_asistencia` | INT | Sumatoria acumulada de fallas del alumno en el periodo. |

### Types relevantes

```sql
CREATE TYPE public.estado_cierre_materia AS ENUM ('ABIERTO', 'CERRADO');
CREATE TYPE public.estado_resultado AS ENUM ('APROBADO', 'REPROBADO', 'EN_PROCESO');
```

---

## 7. Conexiones con Otros Módulos

- **→ Calificaciones**: Pondera las notas de las actividades evaluativas y criterios registrados.
- **→ Asistencia**: Suma las fallas no justificadas del estudiante de la tabla `registro_asistencia`.
- **→ Observaciones**: Extrae las anotaciones de tipo `ACADEMICA` para concatenarlas en la materia.
- **→ Configuración Académica**: Verifica las escalas de valoración del colegio para definir si el alumno aprobó o reprobó.

---

## 8. Validaciones Implementadas

### Backend
- Cálculo matemático exacto de promedios ponderados respetando los decimales en PostgreSQL.
- Verificación exhaustiva de que no existan materias con cierre en `ABIERTO` antes de permitir al directivo cerrar el periodo institucional.
- Validación de rol directivo/rector para la reapertura de cierres.

### Frontend
- Despliegue de una barra de progreso que indica visualmente el porcentaje de materias consolidadas por los docentes.
- Inhabilitación de los controles de descarga masiva si el validador de cierre de periodo retorna falso.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Consolidación en Tabla `resultado_academico`** | Evita calcular promedios pesados en caliente en cada consulta de boletines; el promedio se escribe una sola vez en el cierre y se lee instantáneamente para generar el PDF. |
| **Bypass de Reapertura de Materia** | Ahorra el tener que abrir todo el colegio por el error de un solo docente, manteniendo protegida la inmutabilidad de los demás cursos. |
