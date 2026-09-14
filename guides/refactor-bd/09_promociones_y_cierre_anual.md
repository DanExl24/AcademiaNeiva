# Módulo 9: Promociones y Cierre Anual

Este documento detalla el diagnóstico, refactorizaciones y directrices de integridad para el cierre del año lectivo, la consolidación del historial de promoción estudiantil y las resoluciones directivas de comisiones de evaluación.

---

## 1. Alcance y Tablas del Módulo

1. `cierre_anio_lectivo`: Registro oficial que marca el congelamiento académico de notas, boletines finales y estados de matrícula de una vigencia escolar.
2. `promociones_anuales`: Consolidado histórico del veredicto de fin de año para cada estudiante (`PROMOVIDO`, `NO_PROMOVIDO`, `REQUIERE_NIVELACION`), registrando promedio acumulado, asignaturas reprobadas y grado al que avanza.
3. `decision_promocion_directivo`: Actas y resoluciones del Consejo Directivo o Comisión de Evaluación y Promoción que modifican o ratifican de manera extraordinaria el estado de un alumno (promoción anticipada, convalidaciones, o reconsideración de fallos).

---

## 2. Puntos Críticos y Correcciones de Integridad

### 2.1. Duplicidad en Resoluciones Directivas (`decision_promocion_directivo`)
- **Problema**: No existía una restricción que impidiera emitir múltiples resoluciones directivas contradictorias para un mismo estudiante en un mismo año lectivo previo.
- **Solución**: Creación de la restricción e índice `UNIQUE (id_estudiante, id_colegio, id_anio_anterior)`. Cada estudiante tiene a lo sumo un dictamen directivo final por año evaluado.

### 2.2. Falta de Clave Foránea en Directivo Responsable
- **Problema**: El campo `id_directivo` en `decision_promocion_directivo` era un entero sin clave foránea hacia la tabla `usuario`.
- **Impacto**: Imposibilidad de garantizar que quien firmara la resolución fuera un usuario con existencia real en el sistema de autenticación institucional.
- **Solución**: Se enlazó formalmente `fk_decision_promocion_directivo_usuario` hacia `usuario(id_usuario)`.

### 2.3. Unicidad del Cierre Institucional (`cierre_anio_lectivo`)
- **Problema**: Riesgo de inconsistencias si una sede o colegio disparaba concurrentemente procesos de cierre para el mismo año escolar.
- **Solución**: Garantizar la unicidad por `(id_colegio, id_anio)` impidiendo cierres paralelos o duplicados.

### 2.4. Aceleración de Consultas de Historial de Promoción (`promociones_anuales`)
- **Problema**: Al matricular o generar certificados de notas de años anteriores, la búsqueda de promociones requería filtrados no indexados.
- **Solución**: Creación del índice `idx_promociones_estudiante_anio` sobre `(id_estudiante, id_anio)`.

---

## 3. Esquema DDL y Restricciones Aplicadas

```sql
-- Unicidad de resolución extraordinaria por estudiante y año
ALTER TABLE decision_promocion_directivo
  ADD CONSTRAINT uq_decision_promocion_estudiante_anio 
    UNIQUE (id_estudiante, id_colegio, id_anio_anterior);

-- Clave foránea al directivo responsable
ALTER TABLE decision_promocion_directivo
  ADD CONSTRAINT fk_decision_promocion_directivo_usuario 
    FOREIGN KEY (id_directivo) REFERENCES usuario(id_usuario) ON DELETE RESTRICT;

-- Índice para certificación histórica de promociones
CREATE INDEX idx_promociones_estudiante_anio 
  ON promociones_anuales (id_estudiante, id_anio);
```

---

## 4. Resumen de Índices y Reglas del Módulo

| Objeto / Regla | Tipo | Propósito |
| :--- | :--- | :--- |
| `uq_decision_promocion_estudiante_anio` | `UNIQUE CONSTRAINT` | Evita resoluciones directivas contradictorias para el mismo alumno y año. |
| `fk_decision_promocion_directivo_usuario` | `FOREIGN KEY` | Obliga a que la resolución sea suscrita por un directivo registrado en el sistema. |
| `idx_promociones_estudiante_anio` | `INDEX (id_estudiante, id_anio)` | Optimiza la generación de certificados y consulta de antecedentes de promoción. |
