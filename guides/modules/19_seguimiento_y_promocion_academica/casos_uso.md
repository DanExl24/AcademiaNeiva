# 🎯 Casos de Uso — Módulo 19: Seguimiento Académico, Promoción y Reprobación

## CU-19.1: Consultar Rendimiento por Período Acumulativo
**Actor Principal**: Directivo Institucional  
**Precondiciones**: Usuario autenticado con rol `directivo`.

### Flujo Principal:
1. El directivo ingresa a la vista `/dashboard/gestion-aprobados` y selecciona la pestaña "Seguimiento por Período / Acumulado".
2. Selecciona el año lectivo y activa el modo "Acumulado", especificando el período límite (ej. Hasta Período 3).
3. El sistema calcula las notas acumuladas ponderadas de P1, P2 y P3 para cada materia de cada estudiante.
4. El sistema despliega las tarjetas de resumen (Total, Aprobados, Reprobados) y la lista de estudiantes.
5. El directivo presiona "Detalle" en un estudiante reprobado para ver las asignaturas con nota < 3.0 y los docentes a cargo.

---

## CU-19.2: Registrar Decisión Institucional de Promoción
**Actor Principal**: Directivo Institucional  
**Precondiciones**: Estudiante clasificado como `NO_PROMOVIDO` o `PENDIENTE_RECUPERACION`.

### Flujo Principal:
1. En la pestaña "Consolidado Anual de Promoción", el directivo ubica al estudiante.
2. Presiona el botón "Registrar Decisión".
3. Se despliega el modal emergente con los datos del estudiante y el resultado calculado por el sistema.
4. El directivo selecciona la acción (`PROMOVER_SIGUIENTE_GRADO`, `MANTENER_GRADO`, `MATRICULA_CONDICIONADA`, etc.) y escribe la justificación.
5. Presiona "Guardar Decisión".
6. El sistema almacena la decisión en la tabla `decision_promocion_directivo` y actualiza la vista.

---

## CU-19.3: Advertencia y Matrícula con Historial Previo
**Actor Principal**: Directivo o Encargado de Matrícula  

### Flujo Principal:
1. Durante la finalización de matrícula en `/dashboard/gestion-matriculas/:id/registro`, el sistema busca al estudiante por su documento.
2. El sistema detecta que el estudiante reprueba el año lectivo anterior (3 materias reprobadas).
3. Muestra el bloque prominente **⚠️ Advertencia académica** con año, grado anterior y asignaturas reprobadas.
4. El directivo revisa la advertencia y procede a matricular al estudiante en el grado correspondiente según la decisión institucional acordada.
