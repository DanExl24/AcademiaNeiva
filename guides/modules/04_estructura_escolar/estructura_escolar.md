# 🏗️ Módulo de Estructura Escolar (Grados, Cursos, Jornadas y Materias)

**Sistema:** Academia Neiva  
**Módulo:** Estructura Escolar, Grados, Secciones, Jornadas y Catálogo Curricular  
**Última actualización:** 2026-08-17  

---

## 1. Descripción Funcional

El módulo de **Estructura Escolar** organiza y administra la arquitectura académica y física de cada institución educativa en AcademiaNeiva. Establece la jerarquía estructural de cuatro niveles que articula a la comunidad escolar:

```
┌─────────────────────────────────────────────────────────────┐
│                 JERARQUÍA DE ESTRUCTURA ESCOLAR             │
├─────────────────────────────────────────────────────────────┤
│ 1. Nivel Escolar (nivel_escolar):                           │
│    PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA                  │
│                                                             │
│ 2. Tipo de Grado (tipo_grado):                              │
│    TRANSICION, PRIMERO, SEGUNDO, ..., ONCE                  │
│                                                             │
│ 3. Jornada Institucional (jornada):                         │
│    MAÑANA, TARDE, UNICA, NOCTURNA                           │
│                                                             │
│ 4. Sección / Nomenclatura (secciones):                      │
│    A, B, C, 10-1, 10-2, UNICA                               │
│                                                             │
│ 5. Grupo o Curso Físico (grupos):                           │
│    Primero A (Mañana), 10-1 (Tarde) [Cupos Totales: 35]     │
│                                                             │
│ 6. Asignación Académica (detalle_grados):                   │
│    Docente ──[ Materia ]──> Curso Físico (Turno Específico) │
└─────────────────────────────────────────────────────────────┘
```

Este módulo proporciona:
- **Normalización Inteligente de Grados:** Detección algorítmica de duplicados semánticos y variaciones ortográficas (ej. *"1°"*, *"PRIMERO"*, *"Primero de Primaria"*).
- **Gestión Avanzada de Cursos:** Creación parametrizada por jornada y sección, actualización de aforos con validación de no reducción por debajo de los inscritos activos, y renombramiento inteligente (individual o en bloque) con desvinculación automática de secciones compartidas.
- **Catálogo Curricular y Papelera con Snapshot JSON:** Creación y actualización de materias institucionales, junto con un sistema de borrado protegido (`force=true`) que emite un respaldo completo en JSON de todas las asignaciones docentes y competencias en `papelera_materias`, permitiendo restauraciones profundas en caliente.
- **Gestión de Jornadas Institucionales ([Ver Submódulo 04.1](submodules/gestion_jornadas.md)):** Control estricto de turnos de operación escolar (`MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA`), segregación de aforos por turno, validación de eliminación protegida sin cursos huérfanos y guarda de política institucional (`IS_JORNADA_REASSIGNMENT_ENABLED`) para preservar las elecciones contractuales de los padres en matrícula.

---

## 2. Actores y Permisos

| Rol | Alcance en el Módulo |
|---|---|
| **Directivo (Rector / Coordinador)** | Administración completa de la estructura de su institución: creación y eliminación de tipos de grado, configuración de cursos y cupos máximos, renombramiento individual y masivo, consulta de integrantes por curso (`getGroupMembers`), habilitación de jornadas, y mantenimiento del catálogo de materias y su papelera. |
| **Administrador General** | Acceso y modificación global a la estructura escolar de cualquier institución en modo supervisión. |
| **Público / Visitante** | Consulta pública de grados y secciones disponibles (`/api/grados/available/:idColegio`) para alimentar el formulario de admisión escolar. |

---

## 3. Acciones Disponibles y Endpoints de la API

| Acción | Método | Endpoint | Autenticación Requerida | Parámetros / Body Requeridos |
|---|---|---|---|---|
| Obtener estructura escolar y grados | `GET` | `/api/academic-admin/grades/:schoolId` | JWT Directivo | `schoolId` (URL), `yearId` (Query opcional) |
| Consultar integrantes de un curso (alumnos y docentes) | `GET` | `/api/academic-admin/groups/:groupId/members` | JWT Directivo | `groupId` (URL), `schoolId` (Query), `yearId` (Query) |
| Crear tipo de grado | `POST` | `/api/academic-admin/grade-types` | JWT Directivo | `{ schoolId, id_nivel, nombre }` |
| Eliminar tipo de grado (con auditoría de impacto) | `DELETE` | `/api/academic-admin/grade-types/:id` | JWT Directivo | `id` (URL), `schoolId` (Query) |
| Crear grupo / curso físico | `POST` | `/api/academic-admin/groups` | JWT Directivo | `{ schoolId, id_nivel, id_jornada, id_tipo_grado, cupos_totales, seccion_nombre \| id_seccion }` |
| Actualizar capacidad de cupos de un grupo | `PATCH` | `/api/academic-admin/groups/:id/cupos` | JWT Directivo | `id` (URL), `{ schoolId, cupos_totales }` |
| Renombrar curso individual (con desvinculación) | `PATCH` | `/api/academic-admin/groups/:id/rename` | JWT Directivo | `id` (URL), `{ schoolId, nuevo_nombre }` |
| Renombrar en bloque cursos de un grado | `PATCH` | `/api/academic-admin/grade-types/:id/bulk-rename` | JWT Directivo | `id` (URL), `{ schoolId, prefijo, separador, tipo_ordinal: 'LETRA' \| 'NUMERO' }` |
| Reasignar grupo de jornada | `PATCH` | `/api/academic-admin/groups/:id/jornada` | JWT Directivo | `id` (URL), `{ schoolId, id_jornada }` |
| Eliminar grupo / curso físico | `DELETE` | `/api/academic-admin/groups/:id` | JWT Directivo | `id` (URL), `schoolId` (Query) |
| Habilitar jornada institucional | `POST` | `/api/academic-admin/jornadas` | JWT Directivo | `{ schoolId, nombre: 'MAÑANA' \| 'TARDE' \| 'UNICA' \| 'NOCTURNA' }` |
| Eliminar jornada libre | `DELETE` | `/api/academic-admin/jornadas/:id` | JWT Directivo | `id` (URL), `schoolId` (Query) |
| Listar materias del colegio | `GET` | `/api/academic-admin/subjects/:schoolId` | JWT Directivo | `schoolId` (URL) |
| Consultar detalles curriculares de materia | `GET` | `/api/academic-admin/subjects/:id/curriculum-details` | JWT Directivo | `id` (URL), `schoolId` (Query) |
| Consultar papelera de materias | `GET` | `/api/academic-admin/subjects/trash/:schoolId` | JWT Directivo | `schoolId` (URL) |
| Crear o restaurar materia | `POST` | `/api/academic-admin/subjects` | JWT Directivo | `{ schoolId, nombre, trashId? }` |
| Actualizar nombre de materia | `PUT` | `/api/academic-admin/subjects/:id` | JWT Directivo | `id` (URL), `{ schoolId, nombre }` |
| Eliminar materia (soft/cascade con snapshot) | `DELETE` | `/api/academic-admin/subjects/:id` | JWT Directivo | `id` (URL), `schoolId` (Query), `force` (Query boolean) |
| Consultar grados disponibles (público) | `GET` | `/api/grados/available/:idColegio` | Pública | `idColegio` (URL) |

---

## 4. Reglas de Negocio

- **RN-EST-001 (Jerarquía Escolar de Cuatro Niveles):** Todo curso físico (`grupos`) debe estar estrictamente subordinado a un `nivel_escolar` institucional, un `tipo_grado` válido, una `jornada` habilitada y una `seccion` formalizada.
- **RN-EST-002 (Normalización Inteligente de Grados):** El sistema aplica `normalizeGradeName` e `isDuplicateOrSimilarGrade`. Impide crear grados equivalentes o con variaciones ortográficas (ej. si existe *"PRIMERO"*, se bloquea *"1°"*, *"Primero"* o *"PRIMERO DE PRIMARIA"* con error `409 Conflict`).
- **RN-EST-003 (Protección de Reducción de Cupos):** La capacidad máxima de un aula (`cupos_totales`) no puede modificarse por debajo del número de estudiantes matriculados activos (`matriculadosActuales`).
- **RN-EST-004 (Eliminación Protegida de Tipos de Grado):** Un tipo de grado no puede eliminarse si cuenta con cursos creados, matrículas activas o asignaciones docentes registradas, retornando un reporte de impacto (`409 Conflict`).
- **RN-EST-005 (Eliminación Protegida de Grupos/Cursos):** Un curso físico no puede eliminarse si tiene matrículas vinculadas, asignaciones docentes (`detalle_grados`) o competencias pedagógicas asociadas.
- **RN-EST-006 (Renombramiento Individual con Desvinculación de Sección):** Al renombrar un curso individual, si la sección actual es compartida por otros grupos (`shared > 1`), el sistema crea una nueva sección independiente en `secciones` para no alterar los demás cursos paralelos.
- **RN-EST-007 (Renombramiento en Bloque con Series Ordinales):** Permite estandarizar la nomenclatura de todos los cursos de un grado mediante un prefijo, un separador y un tipo ordinal (`LETRA` o `NUMERO`), validando que ningún nombre resultante exceda 10 caracteres.
- **RN-EST-008 (Papelera de Materias con Respaldo Snapshot JSON):** La eliminación de una materia con asignaciones y competencias exige confirmación forzada (`force=true`). Al ejecutarse, genera un snapshot JSON en `papelera_materias.data_respaldo`. Al crear una materia enviando `trashId`, el sistema restaura de forma profunda todas las asignaciones y competencias respaldadas.
- **RN-EST-009 (Restricciones y Administración de Jornadas Institucionales — [Detalle](../04_estructura_escolar/submodules/gestion_jornadas.md)):** 
  - **Catálogo Oficial:** Solo se admiten las jornadas `MAÑANA`, `TARDE`, `UNICA` y `NOCTURNA`.
  - **Unicidad:** No se permite habilitar jornadas duplicadas en la misma institución (`409 Conflict`).
  - **Eliminación Protegida:** Una jornada no puede eliminarse si cuenta con al menos un curso físico asociado en `grupos` (`409 Conflict`).
  - **Guarda de Reasignación:** La reasignación de cursos entre jornadas se rige por la guarda de política institucional (`IS_JORNADA_REASSIGNMENT_ENABLED`), validando que no colisione con un curso homólogo en el turno destino.

---

## 5. Implementación del Módulo

### Backend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Controlador de Grados y Cursos** | [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) | `createGradeType`, `deleteGradeType`, `createGroup`, `updateGroupCupos`, `getGradeManagementData`, `getGroupMembers`, `renameSingleCourse`, `bulkRenameCourses`, `createJornada`, `deleteJornada`, `reassignGroupJornada`. |
| **Controlador Curricular de Materias** | [curriculumController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/curriculumController.ts) | `createSubject`, `updateSubject`, `deleteSubject` (con snapshot en papelera), `getSubjects`, `getCurriculumDetails`, `getSubjectsTrash`. |
| **Rutas de Administración Académica** | [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts) | Definición y middleware de seguridad directiva de los endpoints de estructura. |
| **Utilidades de Normalización** | [gradeNormalization.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/gradeNormalization.ts) | Algoritmos de sanitización y detección de similitud semántica de grados. |

### Frontend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Gestión de Grados y Cursos** | [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue) | Interfaz directiva para crear grados, agregar salones, editar cupos, renombrar en bloque, administrar jornadas e inspeccionar integrantes. |
| **Modales de Gestión de Jornadas** | [JornadaManagementModals.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/components/academico/JornadaManagementModals.vue) | Diálogos de interfaz para habilitar nuevas jornadas institucionales, retirar jornadas libres de cursos y reasignar salones bajo guarda. |
| **Gestión de Materias y Papelera** | [SubjectManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/SubjectManagement.vue) | Catálogo de materias, panel de papelera con restauración profunda, y modal de impacto académico en eliminaciones. |
| **Asignación Académica** | [AcademicLoad.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicLoad.vue) | Matriz de vinculación Docente-Grupo-Materia (`detalle_grados`) clasificada por curso físico y jornada. |
| **Helper de Nombres de Cursos** | [courseHelper.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/utils/courseHelper.ts) | Formateo consistente de nombres completos de curso (`Grado - Sección (Jornada)`) en toda la aplicación. |

---

## 6. Modelo de Datos

### Tabla: `nivel_escolar`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_nivel` | SERIAL PK | Identificador único del nivel educativo. |
| `nombre` | VARCHAR(50) | Nombre del nivel (`PREESCOLAR`, `PRIMARIA`, `SECUNDARIA`, `MEDIA`). |
| `id_colegio` | INT FK | Colegio propietario del nivel. |

### Tabla: `tipo_grado`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_tipo_grado` | SERIAL PK | Identificador único del tipo de grado. |
| `nombre` | VARCHAR(50) | Nombre normalizado en mayúsculas (`TRANSICION`, `PRIMERO`, `SEGUNDO`, etc.). |
| `id_nivel` | INT FK | Nivel escolar al que pertenece. |

### Tabla: `jornada`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_jornada` | SERIAL PK | Identificador único de la jornada institucional. |
| `id_colegio` | INT FK | Colegio donde opera la jornada (`ON DELETE CASCADE`). |
| `nombre` | `tipo_jornada` | `MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA` (`CHECK` y `UNIQUE (id_colegio, nombre)`). |

### Tabla: `secciones`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_seccion` | SERIAL PK | Identificador de la sección. |
| `nombre` | VARCHAR(10) | Nomenclatura de la sección (`A`, `B`, `10-1`, `UNICA`). |

### Tabla: `grupos` (Cursos Físicos)

| Columna | Tipo | Descripción |
|---|---|---|
| `id_grupo` | SERIAL PK | Identificador único del curso físico. |
| `id_tipo_grado` | INT FK | Grado al que pertenece. |
| `id_nivel` | INT FK | Nivel escolar redundante para optimización de queries. |
| `id_jornada` | INT FK | Jornada escolar asignada (`FOREIGN KEY -> jornada(id_jornada)`). |
| `id_seccion` | INT FK | Sección / Nomenclatura del curso. |
| `id_colegio` | INT FK | Colegio propietario. |
| `cupos_totales` | INT | Capacidad física máxima de estudiantes. |

### Tabla: `materias`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_materia` | SERIAL PK | Identificador de la materia. |
| `nombre` | VARCHAR(100) | Nombre oficial de la asignatura. |
| `id_colegio` | INT FK | Colegio propietario. |

### Tabla: `papelera_materias`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_papelera` | SERIAL PK | Identificador del registro en papelera. |
| `id_colegio` | INT FK | Colegio propietario. |
| `nombre_materia` | VARCHAR(100) | Nombre de la materia eliminada. |
| `data_respaldo` | JSONB | **Snapshot completo de asignaciones docentes y competencias.** |
| `fecha_eliminacion` | TIMESTAMPTZ | Fecha de eliminación. |

### Tabla: `detalle_grados` (Asignación Académica)

| Columna | Tipo | Descripción |
|---|---|---|
| `id_detallegrado` | SERIAL PK | Identificador de la asignación. |
| `id_grupo` | INT FK | Curso físico (perteneciente a una jornada específica). |
| `id_materia` | INT FK | Materia impartida. |
| `id_docente` | INT FK | Docente responsable. |
| `id_colegio` | INT FK | Colegio propietario. |
| `id_anio` | INT FK | Año lectivo en el que aplica la carga. |

---

## 7. Conexiones con Otros Módulos

- **→ Matrículas e Inscripciones (Módulo 06):** Los cursos en `grupos` definen la oferta de cupos físicos y el aforo controlado por jornada. Los acudientes seleccionan el turno deseado y el sistema valida en tiempo real la disponibilidad.
- **→ Docentes y Asignación Académica (Módulo 08):** `detalle_grados` es el puente que otorga permisos al docente para calificar y gestionar asistencia en un curso físico. Permite que diferentes docentes atiendan el mismo grado en turnos distintos (ej. Mañana vs Tarde).
- **→ Competencias Pedagógicas (Módulo 07):** Las competencias se configuran para la tupla curso-materia-periodo y se sincronizan entre cursos paralelos (`sync_uuid`).
- **→ Calificaciones y Asistencia (Módulos 09 y 10):** Toda actividad evaluativa, nota y registro de inasistencia se referencia obligatoriamente al `id_detallegrado` y se filtra por la jornada seleccionada en el panel del docente.
- **→ Cierre de Periodo y Boletines (Módulos 11 y 12):** El cierre curricular, el cálculo de puestos y la generación de boletines oficiales imprimen y agrupan por `id_grupo` y su respectiva `jornada_nombre`.
- **→ Traslados Estudiantiles (Módulo 14):** Al solicitar un traslado, se registra la `jornada_sugerida`, permitiendo ubicar al alumno en cursos con cupo en la jornada solicitada.

---

## 8. Validaciones Implementadas

### Backend
- **Similitud Semántica de Grados:** `isDuplicateOrSimilarGrade` evita nombres ambiguos o duplicados dentro de la institución.
- **Validación de Capacidad:** `updateGroupCupos` rechaza cualquier reducción de cupos menor a las matrículas existentes.
- **Auditoría de Impacto Relacional:** Bloqueo `409` con recuento de dependencias antes de eliminar grados, cursos o materias.
- **Aislamiento Multi-Tenant:** Validación estricta de `id_colegio` en todas las consultas y mutaciones.

### Frontend
- **Formularios Reactivos:** Validación en tiempo real de longitudes máximas (10 chars en secciones y prefijos de renombramiento).
- **Modales Informativos de Impacto:** Despliegue de métricas de impacto (cursos, matrículas, competencias) en eliminaciones protegidas.
- **Vista Detallada de Integrantes:** Modal integrado que lista estudiantes y docentes asignados a cada curso.

---

## 9. Decisiones de Diseño

| Decisión | Justificación Técnica |
|---|---|
| **Independización Dinámica de Secciones (`secciones`)** | Al renombrar un curso individual que compartía sección con otros, el sistema crea una nueva sección en lugar de mutar la compartida, garantizando que el renombramiento de "10-A" no altere accidentalmente a "11-A". |
| **Respaldo Snapshot JSON en `papelera_materias`** | Permite eliminar materias con relaciones activas sin romper la integridad referencial de base de datos, almacenando un snapshot transaccional que habilita la restauración exacta de la carga docente y curricular en cualquier momento. |
| **Jerarquía Redundante Optimizada (`grupos.id_nivel`)** | Guardar `id_nivel` directamente en `grupos` junto con `id_tipo_grado` evita joins innecesarios en consultas masivas de matrículas y calificaciones. |
