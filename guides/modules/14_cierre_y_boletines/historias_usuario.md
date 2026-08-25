# Historias de Usuario — Cierre de Periodo y Generación de Boletines

Este documento detalla las Historias de Usuario del módulo de **Cierre de Periodo y Boletines** de AcademiaNeiva.

---

## 1. Cierre de Asignatura y Validación de Evidencias

### HU-CIE-001: Cierre de Materia por el Docente con Justificación de Evidencias
- **Como:** Docente Titular de Asignatura.
- **Quiero:** Formalizar el cierre de calificaciones de mi materia para el periodo escolar.
- **Para:** Consolidar los promedios definitivos y entregar los resultados a la coordinación académica.
- **Criterios de Aceptación:**
  1. El sistema valida que no existan estudiantes activos con actividades evaluativas o criterios pendientes de calificar.
  2. Si existen evidencias de DBA planificadas que no fueron evaluadas, el sistema despliega una alerta exigiendo ingresar la justificación pedagógica (`justificacion_evidencias_pendientes`).
  3. Al confirmar el cierre, la materia queda en estado `CERRADO` en `cierre_materia` con el ID del docente y la marca de tiempo.
  4. Los campos de calificación de la materia quedan deshabilitados en la planilla del docente.

---

## 2. Cierre Institucional y Gestión Directiva

### HU-CIE-002: Aprobación y Cierre Institucional del Periodo
- **Como:** Directivo Escolar (Coordinador Académico / Rector).
- **Quiero:** Auditar el avance de cierres de todas las materias y realizar el cierre institucional del periodo.
- **Para:** Finalizar oficialmente el periodo lectivo y habilitar la expedición de boletines.
- **Criterios de Aceptación:**
  1. La consola directiva (`PeriodClosure.vue`) expone una barra de progreso que totaliza las asignaturas abiertas y cerradas.
  2. El botón de aprobación institucional se habilita únicamente cuando el 100% de las asignaturas activas en `detalle_grados` están cerradas.
  3. Al confirmarse, el sistema actualiza `periodo_academico.estado = 'CERRADO'`.

---

### HU-CIE-003: Reapertura Quirúrgica de Asignatura Cerrada
- **Como:** Directivo Escolar.
- **Quiero:** Reabrir una asignatura específica cerrada por un docente ante una solicitud de corrección de notas.
- **Para:** Permitir que el docente corrija calificaciones sin necesidad de reabrir el periodo a nivel institucional.
- **Criterios de Aceptación:**
  1. El directivo selecciona la asignatura en la consola de cierres y presiona "Reabrir Materia".
  2. El sistema elimina el registro de `cierre_materia` correspondiente.
  3. La planilla del docente queda nuevamente habilitada para editar y guardar calificaciones.

---

## 3. Emisión y Consulta de Boletines

### HU-CIE-004: Generación de Boletín Oficial con Ranking y Firmas Digitales
- **Como:** Directivo, Estudiante o Acudiente.
- **Quiero:** Generar y descargar el boletín de calificaciones en formato PDF del periodo.
- **Para:** Obtener el informe oficial de rendimiento escolar y puesto de mérito académico.
- **Criterios de Aceptación:**
  1. El sistema valida que el periodo esté en estado `CERRADO`.
  2. El boletín estructura las notas históricas de los trimestres cursados, inasistencias injustificadas, desempeños y observaciones formativas.
  3. Calcula el promedio general y el puesto del alumno en su grupo (`puesto` y `total_grupo`) considerando únicamente alumnos con matrícula activa.
  4. Incorpora el escudo institucional, datos DANE, calendario escolar y las firmas del Titular de grupo y Rector.
