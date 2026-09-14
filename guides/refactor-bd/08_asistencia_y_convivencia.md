# Módulo 8: Asistencia y Convivencia Escolar

Este documento describe la arquitectura, justificación de diseño relacional, resolución de redundancias y optimización de índices para el módulo de control de asistencia diaria, ausentismo por asignatura y libro observador del estudiante (convivencia).

---

## 1. Alcance y Tablas del Módulo

1. `registro_asistencia`: Encabezado de la sesión de clase o control diario de jornada.
2. `registro_asistencia_detalle`: Detalle atómico individual de cada estudiante presente en la sesión.
3. `asistencia_materia`: Registro consolidado de control de faltas acumuladas y umbrales de reprobación por inasistencia (Decreto 1290 / SIE institucional).
4. `observacion_estudiante`: Observador del alumno (faltas leves, graves, llamados de atención, compromisos pedagógicos y citación a acudientes).

---

## 2. Análisis Arquitectónico: Patrón Encabezado-Detalle vs. Tabla Plana

### 2.1. Justificación de `registro_asistencia` y `registro_asistencia_detalle`
Durante la auditoría del módulo surgió la interrogante sobre por qué existen dos tablas separadas para la asistencia.

#### Problema del modelo plano (Denormalizado):
Si toda la asistencia se registrara en una única tabla que contuviera `(id_estudiante, id_docente, id_grupo, id_materia, fecha, hora_inicio, hora_fin, tema_clase, estado_asistencia)`:
- Por un grupo de 40 estudiantes en un bloque de clase de Matemáticas de las 7:00 AM, se almacenarían **40 filas redundantes** repitiendo `id_docente`, `id_grupo`, `id_materia`, `fecha`, `hora_inicio`, `hora_fin` y las observaciones de la clase.
- Si el docente actualiza la hora de inicio o el tema de la sesión, se produciría una anomalía de actualización en 40 registros individuales.

#### Solución en Tercera Forma Normal (3NF):
- **`registro_asistencia` (Encabezado)**:
  - Modela la **sesión pedagógica**: qué docente dictó, a qué grupo, qué materia, en qué fecha y qué horario.
  - Contiene exactamente 1 fila por bloque de clase.
- **`registro_asistencia_detalle` (Detalle)**:
  - Modela el **estado del estudiante**: `PRESENTE`, `AUSENTE`, `TARDANZA` o `EXCUSA_MEDICA`.
  - Contiene una fila por alumno asignado al grupo en esa sesión específica, con clave foránea referenciando al encabezado `id_registro_asistencia` y al `id_estudiante`.

---

## 3. Puntos Críticos y Refactorizaciones Implementadas

### 3.1. Prevención de Sesiones Duplicadas
- **Problema**: Un docente o sistema sincronizador podía registrar la toma de lista múltiples veces para el mismo grupo, fecha, materia y bloque horario.
- **Solución**: Creación de restricción e índice de unicidad sobre la sesión:
  ```sql
  CREATE UNIQUE INDEX idx_registro_asistencia_sesion_unica 
    ON registro_asistencia (id_grupo, fecha, hora_inicio, id_materia);
  ```

### 3.2. Clave Única en Detalle de Asistencia
- **Problema**: Riesgo de registrar dos estados contradictorios (ej. Presente y Ausente) para el mismo estudiante en la misma sesión.
- **Solución**: Unicidad estricta en el detalle:
  ```sql
  CREATE UNIQUE INDEX idx_registro_asistencia_detalle_unico 
    ON registro_asistencia_detalle (id_registro_asistencia, id_estudiante);
  ```

### 3.3. Historial Rápido del Observador del Alumno (`observacion_estudiante`)
- **Problema**: Al abrir la ficha de convivencia del estudiante, el sistema consultaba todo el historial de anotaciones cronológicas mediante escaneos de tabla completa.
- **Solución**: Creación del índice `idx_observacion_estudiante_fecha` sobre `(id_estudiante, fecha DESC)` para renderizar el observador en tiempo real.

---

## 4. Resumen de Índices y Reglas del Módulo

| Objeto / Regla | Tipo | Propósito |
| :--- | :--- | :--- |
| `idx_registro_asistencia_sesion_unica` | `UNIQUE INDEX (id_grupo, fecha, hora_inicio, id_materia)` | Evita duplicar la toma de lista para el mismo bloque horario. |
| `idx_registro_asistencia_detalle_unico` | `UNIQUE INDEX (id_registro_asistencia, id_estudiante)` | Garantiza que un estudiante tenga un solo estado por sesión. |
| `idx_observacion_estudiante_fecha` | `INDEX (id_estudiante, fecha DESC)` | Optimiza la consulta cronológica del observador convivencial. |
