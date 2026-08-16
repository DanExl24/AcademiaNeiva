# 📖 Historias de Usuario — Módulo 19: Seguimiento Académico, Promoción y Reprobación

## HU-19.1: Seguimiento Académico por Período Acumulativo

**Como** Directivo Institucional,  
**Quiero** consultar los resultados académicos de los estudiantes período a período de forma individual o acumulativa hasta el período actual,  
**Para** identificar oportunamente a los estudiantes que presenten dificultades académicas y materias reprobadas antes del cierre de año.

### Criterios de Aceptación:
- El directivo puede seleccionar el año lectivo, grado, grupo y la modalidad de consulta (Período único vs Acumulado P1..PN).
- El sistema muestra el total de estudiantes evaluados, cantidad de aprobados y reprobados.
- En la tabla de estudiantes, se resaltan los estudiantes reprobados y se permite expandir el desglose de asignaturas con sus calificaciones y docente responsable.

---

## HU-19.2: Consolidación del Resultado Académico Anual

**Como** Directivo Institucional,  
**Quiero** visualizar un consolidado general del rendimiento académico anual de todos los estudiantes,  
**Para** clasificar automáticamente a los estudiantes en Promovidos, No Promovidos o Pendientes según las reglas de la institución.

### Criterios de Aceptación:
- El sistema calcula los promedios anuales ponderados por asignatura.
- Clasifica automáticamente como `NO_PROMOVIDO` a estudiantes con 3 o más asignaturas reprobadas.
- Presenta métricas cuantitativas y permite filtrar por grado y grupo.

---

## HU-19.3: Advertencia Académica Informativa en Matrícula

**Como** Directivo o Encargado de Matrículas,  
**Quiero** ver una advertencia clara cuando intente registrar o matricular a un estudiante que repruebe el año anterior,  
**Para** tomar una decisión de promoción fundamentada con toda la información necesaria.

### Criterios de Aceptación:
- Durante la matrícula (ej. en `FinalRegistration.vue`), el sistema consulta si la persona existe y si reprueba el año lectivo anterior.
- Si reprobó, muestra el banner de **⚠️ Advertencia académica** con año, curso, resultado y materias reprobadas.
- La advertencia **no bloquea** el formulario de matrícula, respetando la autoridad del directivo.

---

## HU-19.4: Registro e Historial de Decisiones del Directivo

**Como** Directivo Institucional,  
**Quiero** registrar la decisión tomada respecto a la promoción de un estudiante (ej. Promover excepcionalmente, Mantener en el grado, Matrícula condicionada),  
**Para** mantener trazabilidad histórica sobre las decisiones administrativas y académicas en la institución.

### Criterios de Aceptación:
- El directivo puede seleccionar la decisión (`PROMOVER_SIGUIENTE_GRADO`, `MANTENER_GRADO`, `MATRICULA_CONDICIONADA`, `OTRA_DECISION`) y agregar una observación explicativa.
- La decisión se guarda en la tabla `decision_promocion_directivo` y queda asociada al historial académico continuo del estudiante.

---

## HU-19.5: Resaltado Visual y Filtro para Estudiantes del Último Año (Graduandos)

**Como** Directivo Institucional,  
**Quiero** identificar rápidamente a los estudiantes que cursan el último grado de la institución mediante un resaltado distintivo y un botón de filtro exclusivo,  
**Para** realizar un seguimiento prioritario y especializado a la cohorte de graduandos.

### Criterios de Aceptación:
- El sistema detecta dinámicamente el último grado de la institución sin dejarlo estático a Grado 11 (ONCE).
- En las tablas de seguimiento y consolidado anual, las filas de los graduandos muestran el distintivo **🎓 Último Año** y un borde destacado.
- Se dispone del botón de filtro toggle **"Solo Graduandos"** para aislar a los estudiantes en su año final.

---

## HU-19.6: Graduación Automática al Promover Estudiantes del Último Grado

**Como** Directivo Institucional,  
**Quiero** que al aprobar la promoción de un estudiante perteneciente al último año escolar, el sistema procese automáticamente su graduación,  
**Para** cambiar su estado a `GRADUADO` e inscribirlo en el libro de graduados sin requerir pasos manuales adicionales.

### Criterios de Aceptación:
- En el modal de decisión de promoción, la opción cambia dinámicamente a **"Promover y Graduar Estudiante 🎓"** para alumnos del último año.
- Al confirmar la decisión, el sistema actualiza `estudiante.estado = 'GRADUADO'`, registra la entrada en `registro_graduados` y guarda la trazabilidad en `decision_promocion_directivo` con `id_grado_asignado = null`.
- Si se modifica la decisión a no promovido, el estado del alumno se revierte automáticamente a `ACTIVO`.
