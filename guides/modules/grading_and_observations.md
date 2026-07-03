# 📊 Calificaciones y Observaciones Docentes

Este módulo detalla el modelo de evaluación académica, la lógica de distribución de notas, los tipos de observaciones del docente y la consolidación de promedios para los boletines de **AcademiaNeiva**.

---

## 📐 Estructura Evaluativa y Criterios

La evaluación en AcademiaNeiva se basa en una jerarquía de actividades y criterios:

```
Asignatura (Materia)
   └── Actividades Académicas (actividad_materia) (porcentaje acumulado = 100%)
          └── Criterios de Evaluación (criterio_evaluacion) (porcentaje acumulado = 100%)
```

- Cada **actividad** de la materia tiene un porcentaje asignado que determina su peso final en la asignatura del periodo.
- Una actividad puede dividirse en **criterios evaluativos** (ej. "Examen Escrito" - 50%, "Taller en Grupo" - 50%).
- Las notas de los estudiantes se registran en `nota_criterio` (si la actividad tiene criterios) o directamente en `notas_actividad`.

---

## 📈 Distribución Realista de Calificaciones (Seeder)

El script de inicialización (`seed_grades.ts`) utiliza un generador estadístico realista para simular las calificaciones reales de los estudiantes del colegio:

- **Bajo Rendimiento / Reprobado** (1.0 a 2.9): **15%** de probabilidad.
- **Desempeño Básico** (3.0 a 3.9): **35%** de probabilidad.
- **Desempeño Alto** (4.0 a 4.5): **30%** de probabilidad.
- **Desempeño Superior** (4.6 a 5.0): **20%** de probabilidad.

Esto permite probar el dashboard directivo, las alertas de bajo rendimiento y las estadísticas de reprobados con datos realistas en lugar de números planos de prueba.

---

## 📝 Observaciones del Docente

Los docentes registran retroalimentaciones sobre el desempeño de los estudiantes mediante la tabla `observacion_estudiante` utilizando la columna `tipo` (tipo de observación):

1. **`ACADEMICA`**:
   - Fortalezas, debilidades y recomendaciones del rendimiento del estudiante en la materia.
   - Se incluye de manera obligatoria para cada estudiante evaluado en el boletín.
2. **`CONVIVENCIA`**:
   - Comportamiento social, respeto y cumplimiento de normas dentro del aula.
   - Generada aleatoriamente para un ~20% de estudiantes en el seeder.
3. **`DISCIPLINARIA`**:
   - Llamados de atención formales o sanciones del manual de convivencia.
   - Generada aleatoriamente para un ~10% de estudiantes en el seeder.
4. **`OTRO` (General)**:
   - Destrezas, puntualidad o participaciones en eventos deportivos/culturales del colegio.
   - Generada aleatoriamente para un ~10% de estudiantes en el seeder.

---

## 📄 Consolidación de Resultados Académicos

Cuando se realiza el cierre del periodo lectivo o se consolida una asignatura en la tabla `cierre_materia`:
- El sistema calcula el promedio ponderado de las notas del estudiante basándose en los porcentajes de las actividades de materia del periodo.
- Guarda el promedio consolidado en la tabla `resultado_academico`.
- Asocia el promedio a la escala de valoración correspondiente (ej. `BAJO`, `BASICO`, `ALTO`, `SUPERIOR`) mediante la tabla `escala_valoracion`.
- Este promedio consolidado y el resultado son los consumidos finalmente por el módulo del Boletín de Calificaciones en formato PDF.

---

## 📅 Asistencia y Regra de Límite Diario (Máximo 7 Bloques)

Para garantizar la consistencia estadística y evitar inasistencias físicamente imposibles para una jornada escolar normal, AcademiaNeiva implementa la siguiente regla de negocio estricta:

> [!IMPORTANT]
> Ningún estudiante puede tener registrado más de **7 bloques académicos/asistencias en un mismo día**.

### Consideraciones de Implementación:
- **Validación del Servidor**: Cada vez que un docente guarda el listado de asistencia de su materia para una fecha específica, el servidor realiza un recuento de bloques registrados para cada estudiante en esa fecha. Si un estudiante excede el límite de 7, la operación se rechaza informando el nombre del estudiante para su corrección inmediata.
- **Actualizaciones**: La regla permite corregir y actualizar asistencias ya existentes para la misma materia y fecha, ya que el sistema reconoce que se trata del mismo bloque académico y no lo contabiliza como un bloque nuevo.
- **Consistencia Estadística**: Mantiene los reportes de ausentismo libres de duplicados accidentales o errores de digitación del personal escolar.
