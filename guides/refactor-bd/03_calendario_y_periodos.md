# Módulo 3: Calendario y Periodos Académicos

## 1. Puntos Encontrados Antes de la Refactorización

1. **Fechas No Nativas en `periodo_academico`**:
   - `periodo_academico` almacenaba fechas fraccionadas como enteros (`dia_inicio`, `mes_inicio`, `dia_fin`, `mes_fin`), lo que obligaba a complejas reconstrucciones de fechas en JavaScript y prevenía el uso de operadores de rango (`BETWEEN`, `>`, `<`) en SQL.
2. **Nullable en `periodo_academico.id_anio`**:
   - La columna `id_anio` en `periodo_academico` permitía valores `NULL`, lo que permitía periodos huérfanos sin año lectivo asociado.
3. **Escalas de Valoración sin Vínculo con el Año Lectivo**:
   - La tabla `escala_valoracion` solo referenciaba `id_colegio`.
   - Si una institución decidía modificar su escala (ej. cambiar el rango de "BASICO" de 3.0-3.9 a 3.2-3.8), la modificación afectaba retroactivamente a los años anteriores, distorsionando el historial de boletines.
4. **Falta de Validación en Porcentajes y Rangos de Periodos**:
   - No existía restricción `CHECK` que obligara a que el porcentaje fuera positivo ($\le 100$) o que `fecha_fin >= fecha_inicio`.

---

## 2. Decisión de Diseño e Implementación

- **Fechas Nativas y Restricciones en `periodo_academico`**:
  - Se agregaron las columnas `fecha_inicio DATE` y `fecha_fin DATE`, pobladas formalmente mediante `make_date(al.calendario::int, pa.mes_inicio, pa.dia_inicio)`.
  - Se forzó `id_anio NOT NULL` y `fecha_inicio / fecha_fin NOT NULL`.
  - Se añadieron constraints:
    - `chk_periodo_porcentaje CHECK (porcentaje > 0 AND porcentaje <= 100)`
    - `chk_periodo_fechas CHECK (fecha_fin >= fecha_inicio)`
    - `uq_periodo_anio_trimestre UNIQUE (id_anio, trimestre)` (evita periodos repetidos con el mismo orden trimestral en un año).
- **Escalas de Valoración Acopladas al Año Lectivo**:
  - Se añadió la columna `id_anio INTEGER NOT NULL REFERENCES anio_lectivo(id_anio) ON DELETE CASCADE` a `escala_valoracion`.
  - Se estableció la restricción `uq_escala_colegio_anio_nivel UNIQUE (id_colegio, id_anio, nivel)`.
  - Ahora cada año lectivo posee su propio conjunto inmutable de escalas (SUPERIOR, ALTO, BASICO, BAJO).
- **Unicidad en Años Lectivos**:
  - Se añadió la restricción `uq_anio_colegio_calendario UNIQUE (id_colegio, calendario, tipo_calendario)` para prevenir años lectivos duplicados dentro de la misma institución.

---

## 3. Tablas Deprecadas

- *Ninguna tabla eliminada en este módulo*; se fortalecieron las tablas nucleares `anio_lectivo`, `periodo_academico` y `escala_valoracion`.

---

## 4. Índices Creados

- `idx_periodo_anio_estado` en `periodo_academico(id_anio, estado)`:
  - Optimiza el filtrado del periodo `ABIERTO` o `CERRADO` durante el ingreso de notas y cierre de materias.
- `idx_escala_anio_colegio` en `escala_valoracion(id_colegio, id_anio)`:
  - Agiliza la resolución de escalas de desempeño para la calificación y boletines.

---

## 5. Nuevas Reglas de la Base de Datos

- **RN-MOD3-01**: Un año lectivo no puede tener dos periodos con el mismo número de trimestre.
- **RN-MOD3-02**: Las escalas de desempeño son históricas y están fijadas por año lectivo (`escala_valoracion.id_anio`).
- **RN-MOD3-03**: La fecha de finalización de un periodo académico debe ser estrictamente posterior o igual a la fecha de inicio.
