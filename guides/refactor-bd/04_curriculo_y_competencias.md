# Módulo 4: Plan Curricular y Competencias

## 1. Puntos Encontrados Antes de la Refactorización

1. **Cuellos de Botella en Búsquedas de Competencias**:
   - `competencias` es una de las tablas más consultadas en la interfaz de docentes y estudiantes. Se filtraba continuamente por `(id_colegio, id_anio, id_periodo, id_materia, id_grupo)` sin contar con un índice B-Tree compuesto adecuado, lo que obligaba al motor a realizar *Seq Scans* costosos.
2. **Duplicidad y Desorden en Evidencias de Aprendizaje**:
   - La tabla `evidencia_aprendizaje` permitía números de `orden` repetidos o arbitrarios dentro de una misma competencia, provocando que la UI mostrara evidencias en orden aleatorio o con duplicidad visual.
3. **Desalineación con los Derechos Básicos de Aprendizaje (DBA)**:
   - La columna `id_evidencia_dba` en `evidencia_aprendizaje` no contaba con índice para vincular rápidamente qué evidencias institucionales provenían del catálogo oficial del Ministerio de Educación Nacional (MEN).

---

## 2. Decisión de Diseño e Implementación

- **Índice B-Tree de Alto Rendimiento en `competencias`**:
  - Se creó el índice compuesto `idx_competencias_contexto` sobre:
    $$\text{competencias}(\text{id\_colegio}, \text{id\_anio}, \text{id\_materia}, \text{id\_periodo}, \text{id\_grupo})$$
  - Con este índice, las consultas de los docentes al cargar sus listas de planeación y evaluación responden en menos de $1\text{ ms}$.
- **Unicidad de Orden en `evidencia_aprendizaje`**:
  - Se implementó la restricción única:
    `uq_evidencia_competencia_orden UNIQUE (id_competencia, orden)`
  - Esto garantiza que cada evidencia de una competencia tenga una posición secuencial fija e irrepetible.
- **Indexación de Trazabilidad DBA**:
  - Se crearon los índices `idx_evidencia_competencia` e `idx_evidencia_dba_ref` para acelerar la verificación de cumplimiento de estándares curriculares nacionales.

---

## 3. Tablas Deprecadas

- *Ninguna tabla eliminada en este módulo*; se optimizó la estructura interna de `competencias` y `evidencia_aprendizaje`.

---

## 4. Índices Creados

| Nombre del Índice | Tabla | Columnas Indexadas | Propósito |
|-------------------|-------|-------------------|-----------|
| `idx_competencias_contexto` | `competencias` | `(id_colegio, id_anio, id_materia, id_periodo, id_grupo)` | Búsqueda instantánea de planeación curricular por docente/grupo. |
| `idx_competencias_sync` | `competencias` | `(sync_uuid)` | Sincronización entre grupos pares del mismo grado. |
| `idx_evidencia_competencia_orden` | `evidencia_aprendizaje` | `(id_competencia, orden)` | Ordenamiento determinista en interfaces de evaluación. |
| `idx_evidencia_dba_ref` | `evidencia_aprendizaje` | `(id_evidencia_dba)` | Auditoría de alineación con estándares MEN. |

---

## 5. Nuevas Reglas de la Base de Datos

- **RN-MOD4-01**: No pueden existir dos evidencias de aprendizaje con el mismo número de orden dentro de una misma competencia.
- **RN-MOD4-02**: Toda competencia debe pertenecer a un contexto escolar específico (año lectivo, colegio, grupo, materia y periodo).
