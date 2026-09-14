# Módulo 5: Evaluación y Calificaciones

## 1. Puntos Encontrados Antes de la Refactorización

1. **Tabla Obsoleta `desempeno`**:
   - Existía una tabla `desempeno` con 0 filas en producción, que guardaba campos vagos como `nombre`, `descripcion`, `id_materia`.
   - El sistema ya utilizaba de forma robusta y moderna el trinomio `competencias` $\longrightarrow$ `evidencia_aprendizaje` $\longrightarrow$ `criterio_evaluacion` y la tabla `escala_valoracion` para los desempeños cualitativos. La tabla `desempeno` era un artefacto residual muerto.
2. **Riesgo de Duplicidad en `resultado_academico`**:
   - La tabla `resultado_academico` (donde se consolidan las notas definitivas por periodo) no poseía una restricción `UNIQUE` sobre la tupla `(id_estudiante, id_detallegrado, id_periodo)`.
   - Si un docente recalculaba las notas o cerraba la materia dos veces concurrentemente, se corrían riesgos de duplicar notas definitivas y distorsionar promedios.
3. **Falta de Restricciones en Pesos Porcentuales**:
   - En `actividad_materia`, el porcentaje de la actividad no tenía una validación a nivel de base de datos (`CHECK (porcentaje > 0 AND porcentaje <= 100)`), lo que permitía porcentajes negativos o superiores al 100% si fallaba la validación en frontend.

---

## 2. Decisión de Diseño e Implementación

- **Deprecación y Eliminación de `desempeno`**:
  - Se eliminó la tabla mediante `DROP TABLE IF EXISTS public.desempeno CASCADE;`.
  - Se limpiaron los modelos y controladores para asegurar que ningún endpoint dependa de dicha entidad.
- **Blindaje de Unicidad en `resultado_academico`**:
  - Se creó la restricción formal:
    `uq_resultado_academico_estudiante_materia_periodo UNIQUE (id_estudiante, id_detallegrado, id_periodo)`
  - Esto garantiza que jamás pueda existir más de una nota definitiva por estudiante en una asignatura y periodo determinado.
- **Validación de Integridad en Calificaciones y Actividades**:
  - Se añadió `CHECK (porcentaje > 0 AND porcentaje <= 100)` en `actividad_materia`.
  - Se añadieron índices compuestos optimizados para la generación masiva de boletines escolares.

---

## 3. Tablas Deprecadas y Motivo

| Tabla Eliminada | Filas Previas | Motivo de Eliminación |
|-----------------|:-------------:|-----------------------|
| `desempeno` | 0 | Obsoleta; reemplazada por el modelo pedagógico moderno de `competencias`, `criterios` y `escala_valoracion`. |

---

## 4. Índices Creados

| Nombre del Índice | Tabla | Columnas Indexadas | Propósito |
|-------------------|-------|-------------------|-----------|
| `idx_resultado_academico_lookup` | `resultado_academico` | `(id_colegio, id_estudiante, id_detallegrado, id_periodo)` | Búsqueda directa de definitivas al generar el boletín. |
| `idx_resultado_academico_group_period` | `resultado_academico` | `(id_colegio, id_detallegrado, id_periodo)` | Cálculo de estadísticas grupales y promedios por salón. |
| `idx_actividad_materia_detalle_periodo` | `actividad_materia` | `(id_detallegrado, id_periodo)` | Listado de actividades académicas por asignatura y periodo. |
| `idx_notas_actividad_lookup` | `notas_actividad` | `(id_actividadmateria, id_estudiante)` | Verificación inmediata de notas calificadas por actividad. |

---

## 5. Nuevas Reglas de la Base de Datos

- **RN-MOD5-01**: Un estudiante solo puede tener exactamente un registro definitivo en `resultado_academico` para una materia y periodo específico.
- **RN-MOD5-02**: Toda actividad evaluativa debe tener un porcentaje estrictamente mayor a 0 y menor o igual a 100.
