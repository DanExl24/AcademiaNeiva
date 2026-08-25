# Historias de Usuario — Seguimiento Académico, Promoción y Reprobación Anual

Este documento detalla las Historias de Usuario del módulo de **Seguimiento Académico y Promoción Anual** de AcademiaNeiva.

---

## 1. Consolidación Anual y Matriz de Promoción

### HU-PRO-001: Consolidación Anual y Clasificación de Promoción
- **Como:** Directivo Escolar (Coordinador Académico / Rector).
- **Quiero:** Visualizar la consolidación anual de calificaciones de todos los estudiantes de mi institución.
- **Para:** Identificar a los estudiantes promovidos, no promovidos y pendientes de recuperación según los criterios del MEN y del PEI institucional.
- **Criterios de Aceptación:**
  1. La vista consolida los promedios de todas las materias a lo largo de los periodos del año lectivo.
  2. Clasifica automáticamente a cada estudiante en: `APROBADO` (0 materias reprobadas), `PENDIENTE_RECUPERACION` (1 a 2 materias) o `NO_PROMOVIDO` ($\ge 3$ materias).
  3. Desglosa las asignaturas reprobadas indicando la nota definitiva obtenida y el docente responsable.

---

## 2. Graduación y Registro de Decisiones Directivas

### HU-PRO-002: Promoción y Graduación Automática de Graduandos
- **Como:** Directivo Escolar.
- **Quiero:** Promover a un estudiante del último grado escolar de mi colegio.
- **Para:** Formalizar su graduación y registrarlo en el libro oficial de graduados.
- **Criterios de Aceptación:**
  1. El sistema detecta dinámicamente si el estudiante pertenece al grado superior de la institución (`is_final_grade: true`).
  2. En el modal de decisión, el botón adopta la etiqueta dinámica *"Promover y Graduar Estudiante 🎓"*.
  3. Al confirmar la decisión `PROMOVER_SIGUIENTE_GRADO`, el sistema actualiza su estado a `GRADUADO` e inserta la entrada en la tabla `registro_graduados`.

---

### HU-PRO-003: Registro de Decisión Directiva con Condición de Periodo Final
- **Como:** Directivo Escolar.
- **Quiero:** Registrar la decisión oficial sobre la situación de un estudiante (Promover, Mantener Grado, Matrícula Condicionada).
- **Para:** Dejar constancia formal en el acta de comisiones de evaluación y promoción.
- **Criterios de Aceptación:**
  1. El formulario exige seleccionar la decisión tomada, el grado asignado y permite ingresar observaciones.
  2. Si el año lectivo no ha llegado a su periodo final (`closedPeriodsCount < totalPeriodsCount - 1`), el sistema bloquea el guardado con error `400 Bad Request`.
  3. La decisión queda almacenada en `decision_promocion_directivo` con la referencia al directivo autorizante.

---

## 3. Apoyo al Proceso de Matrícula

### HU-PRO-004: Verificación Informativa de Advertencia en Matrícula
- **Como:** Directivo Escolar.
- **Quiero:** Que el sistema me alerte si un aspirante a matrícula reprobó asignaturas en el año anterior.
- **Para:** Tomar decisiones pedagógicas informadas (ej. asignar matrícula condicionada) sin que el sistema bloquee el trámite administrativo.
- **Criterios de Aceptación:**
  1. Al digitar el documento del estudiante en `FinalRegistration.vue`, el sistema consulta `/check-warning`.
  2. Si el estudiante tiene materias reprobadas o decisión de `MANTENER_GRADO`, despliega una tarjeta de advertencia informativa con el detalle de las asignaturas.
  3. El directivo puede continuar y formalizar la matrícula normalmente según su criterio institucional.
