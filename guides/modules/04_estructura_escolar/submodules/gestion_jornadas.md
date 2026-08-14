# 🌅 Sub-Módulo: Gestión y Análisis de Jornadas Escolares

**Sistema:** Academia Neiva  
**Módulo Padre:** 04 — Estructura Escolar  
**Sub-módulo:** 04.1 — Gestión de Jornadas Institucionales  
**Última actualización:** 2026-08-14

---

## 1. Descripción Funcional

El sub-módulo de **Gestión y Análisis de Jornadas Escolares** opera de forma integrada dentro de la vista de *Estructura Académica* (`GradeManagement.vue`). Permite al equipo directivo supervisar, habilitar y administrar las jornadas académicas operativas del plantel educativo (`MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA`), evaluar la ocupación de aforos en tiempo real, visualizar la cobertura de grados por turno y reasignar cursos entre jornadas sin alterar el historial ni los registros de matrícula.

---

## 2. Actores y Permisos

| Rol | Permisos y Alcance |
|---|---|
| **Directivo / Rector** | Habilitar nuevas jornadas, retirar jornadas sin cursos, reasignar salones de jornada y auditar el aforo y ocupación. |
| **Admin General** | Supervisión multi-sede de jornadas configuradas y balance de cobertura institucional. |

---

## 3. Acciones y Endpoints API

| Acción | Método | Endpoint | Rol Requerido | Descripción |
|---|---|---|---|---|
| **Consultar Estructura y Jornadas** | `GET` | `/api/academic-admin/grades/:schoolId` | Directivo / Admin General | Obtiene jornadas, niveles, grados, grupos y aforos del año lectivo seleccionado. |
| **Habilitar Nueva Jornada** | `POST` | `/api/academic-admin/jornadas` | Directivo | Registra una jornada institucional válida (`MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA`). |
| **Eliminar Jornada** | `DELETE` | `/api/academic-admin/jornadas/:id` | Directivo | Retira una jornada del colegio (solo si no tiene cursos o grupos vinculados). |
| **Reasignar Curso de Jornada** | `PATCH` | `/api/academic-admin/groups/:id/jornada` | Directivo | Mueve un curso y sus matrículas a otra jornada existente de la institución. |

---

## 4. Reglas de Negocio Específicas

- **RN-JOR-001 (Jornadas Institucionales Válidas):** Los nombres permitidos para las jornadas académicas en el sistema corresponden al estándar normativo del Ministerio de Educación: `MAÑANA`, `TARDE`, `UNICA` y `NOCTURNA`.
- **RN-JOR-002 (Unicidad por Colegio):** No se permiten jornadas duplicadas con el mismo nombre dentro de una misma institución educativa (`UNIQUE(id_colegio, nombre)`).
- **RN-JOR-003 (Protección contra Supresión con Dependencias):** Una jornada no puede eliminarse si tiene uno o más cursos/grupos asociados. El directivo debe reasignar o eliminar los cursos antes de poder retirar la jornada.
- **RN-JOR-004 (Validación de Conflicto en Reasignación):** Al reasignar un curso a otra jornada, el sistema verifica que no exista previamente un curso con el mismo grado y sección en la jornada de destino (evitando duplicidades de salón como dos "Primero A" en la Tarde).
- **RN-JOR-005 (Preservación de Matrículas e Integrantes):** La reasignación de jornada modifica el atributo `id_jornada` en la entidad `grupos`, manteniendo intactas las matrículas de los estudiantes, asignaciones de docentes y notas registradas.
- **RN-JOR-006 (Restricción por Cierre de Año):** Si el año lectivo se encuentra en estado `CERRADO`, la sub-vista de jornadas se activa en modo de solo lectura (consulta histórica de aforos sin permisos de creación, eliminación ni reasignación).

---

## 5. Métricas y KPIs de la Sub-Vista

1. **Jornadas Habilitadas:** Total de turnos activos en el colegio.
2. **Total Cursos / Salones:** Distribución y cantidad de grupos por jornada.
3. **Matrículas Activas vs. Cupos Totales:** Indicador de aforo y barra de progreso porcentual (`% de ocupación`) con alertas visuales:
   - 🟢 **Ocupación Normal:** Menor al 80%.
   - 🟡 **Alta Demanda:** Entre 80% y 99%.
   - 🔴 **Aforo Completo (100%):** Sin cupos disponibles para nuevas inscripciones o traslados.
4. **Grados Operando:** Badges dinámicos que muestran la cobertura de niveles y grados en cada jornada.

---

## 6. Arquitectura e Implementación

### Backend
- **Controlador:** [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`createJornada`, `deleteJornada`, `reassignGroupJornada` con Kysely QueryBuilder).
- **Rutas:** [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts).

### Frontend
- **Vista Principal:** [GradeManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/GradeManagement.vue) — Pestaña interactiva `Gestión de Jornadas` con selector de sub-navegación, tarjetas de estadísticas por turno, explorador de cursos y modales de gestión.
