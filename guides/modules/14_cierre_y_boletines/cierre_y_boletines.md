# 📄 Módulo de Cierre de Periodo y Generación de Boletines

**Sistema:** Academia Neiva  
**Módulo:** Cierre de Asignaturas, Consolidación de Resultados, Ranking y Boletines PDF  
**Última actualización:** 2026-08-17  

---

## 1. Descripción Funcional

El módulo de **Cierre de Periodo y Generación de Boletines** coordina la fase de clausura evaluativa y emisión oficial de informes de rendimiento académico en AcademiaNeiva. Implementa un flujo escalonado en dos fases que garantiza la integridad y completitud de las calificaciones antes de habilitar los boletines oficiales para estudiantes, acudientes y directivos.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   FLUJO ESCALONADO DE CIERRE Y EMISIÓN DE BOLETINES                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Fase Docente (Cierre de Asignatura):                                                │
│    Docente verifica notas -> Valida evidencias DBA planeadas -> justificacion_pendientes│
│    -> Inserta en cierre_materia (estado = 'CERRADO', id_docente_cierre, fecha)         │
│                                                                                        │
│ 2. Fase Directiva (Cierre Institucional):                                              │
│    Directivo audita que el 100% de asignaturas estén CERRADAS en detalle_grados        │
│    -> Ejecuta approveAcademicPeriod -> periodo_academico.estado = 'CERRADO'             │
│                                                                                        │
│ 3. Motor de Boletines PDF (Individual y en Bloque):                                    │
│    - Valida periodo CERRADO (validatePeriodClosed)                                     │
│    - Calcula Puesto Grupal (RANK() OVER (ORDER BY student_avg DESC)) y Promedio General │
│    - Agrupa Notas Históricas por Trimestre, Inasistencias, Desempeños y Observaciones  │
│    - Estampa Escudo Institucional, Colores Oficiales y Firmas (Titular y Rector)       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

El módulo abarca:
- **Cierre Docente por Asignatura (`closeTeacherSubject`):** Validación exhaustiva de estudiantes sin calificar y detección de evidencias de DBA no evaluadas en el periodo, exigiendo una justificación pedagógica (`justificacion_evidencias_pendientes`) con código `422 Unprocessable Entity`.
- **Cierre Institucional Directivo (`approveAcademicPeriod`):** Bloqueo total del periodo una vez todas las asignaturas activas de la institución han sido consolidadas.
- **Reapertura Quirúrgica de Materia (`reopenSubjectClosure`):** Procedimiento directivo para reabrir una asignatura específica cerrada por error, sin afectar al resto del colegio ni al periodo general.
- **Motor de Boletines con Precisión Estética:** Generación de informes PDF estructurados con notas históricas por trimestre, fallas de asistencia, observaciones (fortalezas, debilidades, recomendaciones), ranking de puesto en el grupo y firmas digitales.
- **Exclusión Estricta de Alumnos Inactivos:** Filtrado de estudiantes en estado `TRASLADADA` o inactivo para descargas individuales y en bloque por grupo (`getGradeBoletines`).

---

## 2. Actores y Permisos

| Rol | Alcance en el Módulo |
|---|---|
| **Docente Titular** | Consultar el estado de cierre de su asignatura (`getClosureStatus`) y ejecutar el cierre formal registrando justificaciones de evidencias pendientes si aplica (`closeTeacherSubject`). |
| **Directivo (Rector / Coordinador)** | Auditoría de avance de cierres (`getPeriodClosureDetails`), ejecución del cierre institucional (`approveAcademicPeriod`), reapertura quirúrgica de materias (`reopenSubjectClosure`), y generación masiva de boletines por curso (`getGradeBoletines`). |
| **Estudiante y Padre de Familia** | Consulta y descarga de su boletín de calificaciones oficial (`getStudentBoletin`) una vez el periodo esté formalmente cerrado y aprobado. |

---

## 3. Acciones Disponibles y Endpoints de la API

| Acción | Método | Endpoint | Autenticación Requerida | Parámetros / Body Requeridos |
|---|---|---|---|---|
| Consultar estado de cierre de asignatura | `GET` | `/api/teacher/closure-status/:detailGradeId/:periodId` | JWT Docente | `detailGradeId`, `periodId` (URL) |
| Ejecutar cierre de asignatura (docente) | `POST` | `/api/teacher/close-period` | JWT Docente | `{ detailGradeId, periodId, justificacion_evidencias_pendientes? }` |
| Obtener detalles de cierre institucional | `GET` | `/api/academic-admin/settings/closure-details/:schoolId/:periodId` | JWT Directivo | `schoolId`, `periodId` (URL) |
| Cerrar/Aprobar periodo institucional | `POST` | `/api/academic-admin/academic-periods/:periodId/approve` | JWT Directivo | `periodId` (URL), `{ schoolId }` |
| Reabrir materia cerrada (directivo) | `POST` | `/api/academic-admin/settings/reopen-subject-closure` | JWT Directivo | `{ schoolId, detailGradeId, periodId }` |
| Validar habilitación de boletines | `GET` | `/api/boletines/validate/:id_colegio/:id_periodo` | JWT Autenticado | `id_colegio`, `id_periodo` (URL) |
| Generar boletín individual de estudiante | `GET` | `/api/boletines/student/:id_estudiante/:id_periodo` | JWT Autenticado | `id_estudiante`, `id_periodo` (URL) |
| Generar boletines en bloque para un curso | `GET` | `/api/boletines/grade/:id_grupo/:id_periodo` | JWT Directivo | `id_grupo`, `id_periodo` (URL) |

---

## 4. Reglas de Negocio

- **RN-CIE-001 (Validación de Completitud de Notas):** Un docente no puede cerrar su asignatura si existen estudiantes con matrícula activa que tengan actividades evaluativas o criterios sin calificar (`400 Bad Request`).
- **RN-CIE-002 (Justificación de Evidencias DBA Pendientes):** Si existen evidencias de DBA planificadas para el periodo actual que no fueron evaluadas en ninguna actividad, el backend responde con error `422 Unprocessable Entity`, exigiendo que el docente suministre una `justificacion_evidencias_pendientes` antes de admitir el cierre.
- **RN-CIE-003 (Registro y Trazabilidad del Cierre de Materia):** Al formalizarse el cierre, el sistema registra el estado `CERRADO` en la tabla `cierre_materia`, estampando `fecha_cierre`, `id_docente_cierre` y la justificación de evidencias pendientes.
- **RN-CIE-004 (Cierre Institucional del Periodo al 100%):** El directivo solo puede ejecutar `approveAcademicPeriod` si el 100% de las asignaciones académicas activas (`detalle_grados`) cuentan con su registro `CERRADO` en `cierre_materia`.
- **RN-CIE-005 (Habilitación Estricta de Boletines en Periodo Cerrado):** Los endpoints de generación de boletines (`validatePeriodClosed`, `getStudentBoletin`, `getGradeBoletines`) exigen que `periodo_academico.estado === 'CERRADO'`. Si el periodo está abierto, devuelven `canGenerate: false` o error `400 Bad Request`.
- **RN-CIE-006 (Cálculo Dinámico de Ranking y Promedios):** El boletín calcula el promedio general del estudiante sobre el periodo en curso y determina su posición relativa en el grupo (`puesto` y `total_grupo`) mediante la función de ventana `RANK() OVER (ORDER BY student_avg DESC)` considerando exclusivamente alumnos con matrícula activa.
- **RN-CIE-007 (Reapertura Quirúrgica de Materia):** El directivo puede revertir el cierre de una asignatura específica (`reopenSubjectClosure`) eliminando el registro en `cierre_materia` para permitir correcciones docentes sin alterar el resto de las materias ni reabrir el colegio.

---

## 5. Implementación del Módulo

### Backend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Controlador de Cierre Docente** | [gradingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts) | `getClosureStatus`, `closeTeacherSubject` (validación de notas y justificación de evidencias pendientes). |
| **Controlador de Periodos y Cierre Directivo** | [academicYearController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicYearController.ts) | `approveAcademicPeriod`, `reopenSubjectClosure`, `getPeriodClosureDetails`. |
| **Controlador de Boletines PDF** | [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts) | `validatePeriodClosed`, `getStudentBoletin` (cálculo de notas históricas, faltas, ranking y firmas), `getGradeBoletines`. |
| **Rutas** | [teacher.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/teacher.routes.ts), [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts), [boletin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/boletin.routes.ts) | Endpoints y middlewares de autenticación y autorización. |

### Frontend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Cierre de Materia Docente** | [TeacherClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/teacher/TeacherClosure.vue) | Vista docente para consultar el estado, ingresar justificación de evidencias pendientes y formalizar el cierre. |
| **Cierre Institucional Directivo** | [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue) | Matriz de seguimiento de materias abiertas/cerradas con barra de progreso y botón de aprobación institucional. |
| **Generador de Boletines** | [BoletinGenerator.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/BoletinGenerator.vue) | Interfaz directiva para previsualizar y descargar boletines en bloque o individuales. |
| **Portal Estudiante / Acudiente** | [StudentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/student/StudentBoletinView.vue), [ParentBoletinView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/parent/ParentBoletinView.vue) | Visualización y descarga del boletín oficial. |

---

## 6. Modelo de Datos

### Tabla: `cierre_materia`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_cierremateria` | SERIAL PK | Identificador único del cierre de materia. |
| `id_detallegrado` | INT FK | Asignación docente-curso-materia. |
| `id_periodo` | INT FK | Periodo académico cerrado. |
| `estado` | `estado_cierre_materia` | `ABIERTO`, `CERRADO`. |
| `fecha_cierre` | TIMESTAMPTZ | Fecha y hora en que se efectuó el cierre. |
| `justificacion_evidencias_pendientes` | TEXT (NULLable) | Justificación pedagógica de evidencias DBA no evaluadas. |
| `id_docente_cierre` | INT FK | Docente que ejecutó el cierre. |
| *Restricción* | UNIQUE | `UNIQUE (id_detallegrado, id_periodo)` |

### Tabla: `resultado_academico`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_resultado` | SERIAL PK | Identificador del promedio consolidado. |
| `id_estudiante` | INT FK | Estudiante evaluado. |
| `id_detallegrado` | INT FK | Materia y curso evaluado. |
| `id_periodo` | INT FK | Periodo correspondiente. |
| `nota_final` / `promedio` | NUMERIC(5,2) | Calificación definitiva del periodo. |
| `id_escalavaloracion` | INT FK | Escala MEN institucional (`BAJO`, `BASICO`, `ALTO`, `SUPERIOR`). |
| `estado` | `estado_resultado` | `APROBADO`, `REPROBADO`, `EN_PROCESO`. |
| `falla_asistencia` | INT | Fallas acumuladas en el periodo. |

---

## 7. Conexiones con Otros Módulos

- **→ Calificaciones y Actividades:** Pondera las notas registradas en `notas_actividad` y `nota_criterio`.
- **→ Asistencia Escolar:** Totaliza las ausencias de `registro_asistencia` para incluirlas en el informe de boletines.
- **→ Observaciones:** Recupera y desglosa las anotaciones pedagógicas por materia (fortalezas, debilidades, recomendaciones).
- **→ Catálogo DBA:** Comprueba que todas las evidencias DBA planificadas hayan sido evaluadas o debidamente justificadas.
- **→ Estructura Escolar:** Resuelve directivos y docentes para estampar firmas de Rector y Titular de grupo.

---

## 8. Decisiones de Diseño

| Decisión | Justificación Técnica |
|---|---|
| **Cierre Escalonado con Puerta de Justificación (422)** | No bloquea de forma intransigente al docente que por motivos de tiempo no evaluó una evidencia DBA, sino que le exige documentar pedagógicamente la razón (`justificacion_evidencias_pendientes`) para conocimiento de la coordinación académica. |
| **Cálculo de Ranking con Window Functions (`RANK()`)** | Realiza el cálculo del puesto en el salón en una sola consulta optimizada a nivel de base de datos (`RANK() OVER (ORDER BY student_avg DESC)`), eliminando la necesidad de algoritmos de ordenamiento pesados en Node.js. |
| **Reapertura Quirúrgica por Asignatura** | Otorga al directivo la flexibilidad de atender reclamos o correcciones docentes sin romper la inmutabilidad de los cursos que ya concluyeron exitosamente su periodo. |
