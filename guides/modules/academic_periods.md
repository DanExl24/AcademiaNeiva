# 🔒 Ciclo de Vida y Protección de Periodos Académicos

Este módulo describe los estados de los periodos escolares en **AcademiaNeiva** y las restricciones estrictas de seguridad e integridad de datos aplicadas a los periodos cerrados.

---

## 📅 Estados del Periodo Académico

La tabla `periodo_academico` define el ciclo evaluativo mediante la columna `estado` (de tipo enum `estado_periodo`):

| Estado | Descripción | Permisos de Escritura |
| --- | --- | --- |
| `PENDIENTE` | Periodo que aún no ha iniciado. | Permitido (planificación, creación de competencias, etc.). |
| `ABIERTO` | Periodo lectivo activo actual. | Permitido (los docentes califican y gestionan actividades en tiempo real). |
| `CERRADO` | Periodo finalizado y consolidado. | **Bloqueado estrictamente** (lectura de notas y reportes únicamente). |

---

## 🛡️ Reglas de Bloqueo Estricto para Periodos Cerrados

Para garantizar que los promedios y reportes oficiales consolidados no se alteren retroactivamente, el sistema cuenta con validaciones redundantes (frontend y backend) que bloquean cualquier modificación en periodos con estado `CERRADO`.

### Operaciones Bloqueadas
Si un periodo académico se encuentra `CERRADO`, el sistema deniega estrictamente:
- **Gestión de Competencias**: Crear, editar descripción o eliminar competencias académicas.
- **Evidencias de Aprendizaje**: Crear, editar descripción, ordenar o eliminar evidencias personalizadas de aprendizaje.
- **Catálogo DBA**: Vincular, desvincular o actualizar evidencias oficiales del catálogo de DBA en una competencia.
- **Actividades Académicas**: Crear, editar porcentaje/nombre o eliminar actividades evaluativas de materia.
- **Criterios de Evaluación**: Registrar, modificar porcentajes o eliminar criterios dentro de una actividad.
- **Calificaciones**: Registrar, modificar o borrar notas académicas de los estudiantes en actividades o criterios.

### Comportamiento en Periodos Abiertos y Pendientes
A solicitud de la institución (para facilitar constantes modificaciones y ajustes curriculares dinámicos), el sistema permite **cualquier tipo de modificación, planeación y edición de calificaciones/competencias en periodos que se encuentren en estado ABIERTO o PENDIENTE**.

---

## 🛠️ Implementación en el Servidor (Backend)

Las validaciones del backend residen centralizadas en las funciones auxiliares de [periodHelpers.ts](file:///C:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts):

### `ensureCurrentPeriodForSchool`
Verifica si el periodo en cuestión se encuentra cerrado para la escuela. Retorna falso si está cerrado.

### `ensureCurrentPeriodOrRespond`
Auxiliar que detiene la ejecución del controlador de Express y responde al cliente con un código `409 (Conflict)` si el periodo académico está cerrado.

```typescript
export const ensureCurrentPeriodOrRespond = async (
  res: Response,
  schoolId: number,
  periodId: number
): Promise<boolean> => {
  const isClosed = await ensureCurrentPeriodForSchool(schoolId, periodId);
  if (!isClosed) {
    res.status(409).json({
      error: "El periodo académico correspondiente se encuentra cerrado y no permite modificaciones.",
    });
    return false;
  }
  return true;
};
```

Esta validación se ejecuta en:
- `vincularEvidenciasDbaACompetencia`, `upsertCompetencyByAdmin`, `createEvidencia`, `updateEvidencia`, `deleteEvidencia` en [academicAdminController.ts](file:///C:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts).
- `updateCompetency`, `createActivity`, `updateActivity`, `deleteActivity`, `updateGrades` en [gradingController.ts](file:///C:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/gradingController.ts).
