# Historias de Usuario — Calificaciones, Actividades y Evaluación Curricular

Este documento detalla las Historias de Usuario del módulo de **Calificaciones y Actividades** de AcademiaNeiva.

---

## 1. Diseño de Actividades y Criterios Evaluativos

### HU-CAL-001: Creación de Actividades Evaluativas Ponderadas
- **Como:** Docente Titular de Asignatura.
- **Quiero:** Registrar una nueva actividad de evaluación asignándole un nombre, ponderación porcentual y una evidencia de aprendizaje.
- **Para:** Estructurar el plan de evaluación del periodo académico en mi curso.
- **Criterios de Aceptación:**
  1. El formulario exige ingresar el título de la actividad, el porcentaje de peso y vincular al menos una evidencia de aprendizaje (formativa o de DBA).
  2. Si la sumatoria del porcentaje acumulado de actividades supera el 100%, el backend rechaza la creación con error `400 Bad Request`.
  3. El sistema guarda la autoría del docente creador en `id_docente_creador`.
  4. La actividad aparece disponible de inmediato en la planilla de calificaciones del curso.

---

### HU-CAL-002: Desglose de Actividades en Criterios Porcentuales
- **Como:** Docente Titular.
- **Quiero:** Desglosar una actividad compleja en múltiples criterios de evaluación con pesos porcentuales independientes.
- **Para:** Evaluar con rúbricas detalladas (ej. presentación, sustentación, contenido).
- **Criterios de Aceptación:**
  1. El docente puede agregar múltiples criterios a una actividad existente.
  2. La sumatoria de los porcentajes de los criterios no puede superar el 100% de la actividad.
  3. En la planilla de calificaciones, la celda de la actividad se desglosa en sub-columnas para calificar cada criterio.

---

### HU-CAL-003: Evaluación de Evidencias Extra/No Planificadas con Justificación
- **Como:** Docente Titular.
- **Quiero:** Evaluar una evidencia de DBA que no formaba parte de la planeación curricular regular del periodo actual.
- **Para:** Realizar actividades de refuerzo, nivelación o adelanto temático según el avance del grupo.
- **Criterios de Aceptación:**
  1. El sistema detecta que la evidencia DBA no pertenece a la planeación del periodo en curso.
  2. El formulario solicita seleccionar obligatoriamente un motivo (`REFUERZO`, `NIVELACION`, `AVANCE_PROGRAMATICO`, `OTRO`).
  3. Si se selecciona `OTRO`, se exige ingresar una justificación pedagógica detallada.

---

## 2. Registro y Consolidación de Notas

### HU-CAL-004: Registro Masivo de Calificaciones y Sincronización Automática
- **Como:** Docente Titular.
- **Quiero:** Digitar y guardar masivamente las calificaciones de todos los estudiantes de mi curso en la planilla interactiva.
- **Para:** Registrar el rendimiento de los alumnos de manera ágil y sin pérdidas de información.
- **Criterios de Aceptación:**
  1. El sistema valida que todas las notas se encuentren dentro del rango institucional (`nota_minima` a `nota_maxima`).
  2. El backend verifica que todos los alumnos tengan matrícula `ACTIVA` o `APROBADA`; si hay alumnos inactivos o trasladados, bloquea el guardado con `409 Conflict`.
  3. Para actividades con criterios, el sistema calcula de forma transaccional el promedio ponderado y actualiza automáticamente `notas_actividad` con su escala MEN institucional.

---

### HU-CAL-005: Bloqueo de Calificaciones por Cierre de Periodo o Materia
- **Como:** Directivo / Sistema de Auditoría.
- **Quiero:** Que las planillas de calificaciones queden completamente bloqueadas una vez cerrado el periodo institucional o la materia.
- **Para:** Garantizar la inmutabilidad y transparencia de las notas finales reportadas en los boletines.
- **Criterios de Aceptación:**
  1. Si `periodo_academico.estado === 'CERRADO'`, el backend rechaza cualquier creación o guardado de notas con `409 Conflict`.
  2. Si el docente ya formalizó el cierre de la materia (`cierre_materia`), se bloquea el guardado en backend y los inputs quedan deshabilitados en el frontend.
  3. Triggers de PostgreSQL abortan cualquier intento de escritura directa a nivel de base de datos.
