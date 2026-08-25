# 🌅 Sub-Módulo 04.1 — Gestión de Jornadas Institucionales

**Módulo Principal:** [04 — Estructura Escolar](../estructura_escolar.md)  
**Sistema:** Academia Neiva  
**Última actualización:** 2026-08-17  

---

## 1. Descripción Funcional

El sub-módulo de **Gestión de Jornadas** regula los turnos operativos de cada colegio (`MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA`). Cada curso físico (`grupos`) pertenece a una jornada específica, permitiendo organizar los horarios de clase, aforos de planta física y asignaciones docentes.

---

## 2. Reglas de Negocio del Sub-Módulo

### RN-JOR-001: Catálogo Oficial de Turnos Escolares
- **Descripción:** Solo se permite habilitar las cuatro jornadas oficiales del sistema: `MAÑANA`, `TARDE`, `UNICA` y `NOCTURNA`.
- **Implementación:** [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`createJornada`).

---

### RN-JOR-002: Unicidad de Jornada por Institución
- **Descripción:** Una institución no puede tener dos jornadas registradas con el mismo nombre. El intento de duplicación responde con error `409 Conflict`.
- **Implementación:** [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`createJornada`).

---

### RN-JOR-003: Eliminación Restringida de Jornadas
- **Descripción:** Una jornada no puede eliminarse (`deleteJornada`) si cuenta con al menos un curso físico asociado en la tabla `grupos`. El directivo debe reasignar o eliminar los cursos antes de retirar la jornada (`409 Conflict`).
- **Implementación:** [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`deleteJornada`).

---

### RN-JOR-004: Guarda Institucional de Reasignación de Cursos entre Jornadas
- **Descripción:** La reasignación de cursos entre jornadas (`reassignGroupJornada`) se encuentra controlada por la guarda de política institucional (`IS_JORNADA_REASSIGNMENT_ENABLED = false`). Esta guarda protege las jornadas seleccionadas por los padres de familia durante el proceso oficial de matrícula. Cuando se activa mediante autorización rectoral, valida que no exista un curso con el mismo grado y sección en la jornada de destino (`409 Conflict`).
- **Implementación:** [gradeGroupController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/gradeGroupController.ts) (`reassignGroupJornada`).

---

## 3. Endpoints del Sub-Módulo

| Método | Endpoint | Acción |
|---|---|---|
| `POST` | `/api/academic-admin/jornadas` | Habilitar nueva jornada institucional (`createJornada`) |
| `DELETE` | `/api/academic-admin/jornadas/:id` | Eliminar jornada libre de cursos (`deleteJornada`) |
| `PATCH` | `/api/academic-admin/groups/:id/jornada` | Reasignar curso a otra jornada (`reassignGroupJornada`) |
