# 📜 Reglas de Negocio — Módulo 19: Seguimiento Académico, Promoción y Reprobación

## RN-19.1: Carácter Informativo y No Bloqueante
- El cálculo del resultado académico anual generado por el sistema tiene carácter **informativo y de apoyo a la toma de decisiones**.
- El sistema **nunca impedirá automáticamente** que un directivo promueva o matricule a un estudiante no promovido. La decisión final corresponde a la institución y al personal directivo autorizado.

## RN-19.2: Cálculo de Asignaturas Reprobadas Acumuladas
- Una asignatura se considera **REPROBADA** si el promedio ponderado de los períodos analizados (P1..PN) es inferior a la calificación mínima aprobatoria (definida en `escala_valoracion` del colegio, por defecto `< 3.0` o nivel 'Bajo').
- En el seguimiento por período acumulativo (P1 hasta PN), la calificación de la materia corresponde al promedio simple/ponderado de las notas registradas en los períodos P1 hasta PN.

## RN-19.3: Clasificación Anual Automática
- **Promovido (`APROBADO`)**: Estudiante que aprueba el 100% de sus asignaturas.
- **Pendiente de Recuperación (`PENDIENTE_RECUPERACION`)**: Estudiante con 1 o 2 asignaturas reprobadas.
- **No Promovido (`NO_PROMOVIDO`)**: Estudiante con 3 o más asignaturas reprobadas.

## RN-19.4: Trazabilidad y Unicidad de Decisiones Institucionales
- Toda excepción o decisión de promoción sobre un estudiante debe registrarse en la tabla `decision_promocion_directivo` especificando:
  - Estudiante (`id_estudiante`)
  - Colegio (`id_colegio`) y Año lectivo evaluado (`id_anio_anterior`)
  - Resultado académico calculado (`APROBADO`, `NO_PROMOVIDO`, `PENDIENTE_RECUPERACION`)
  - Decisión adoptada (`PROMOVER_SIGUIENTE_GRADO`, `MANTENER_GRADO`, `MATRICULA_CONDICIONADA`, `OTRA_DECISION`)
  - Usuario directivo que autorizó (`id_usuario_decision`)
  - Fecha y hora exacta (`fecha_decision`)
  - Observaciones o justificación institucional
- **Restricción UNIQUE en Base de Datos**: Existe una restricción `UNIQUE (id_estudiante, id_colegio, id_anio_anterior)` que impide duplicar la decisión institucional de un estudiante para el mismo ciclo escolar.
- **Edición vía UPSERT**: El backend procesa las solicitudes mediante Kysely querybuilder verificando la existencia previa del registro: si existe, actualiza la decisión y las observaciones; si no existe, inserta un nuevo registro.

## RN-19.5: Cierre Mínimo de Períodos para Registro de Promoción Anual
- La decisión de promoción anual únicamente se puede evaluar y registrar cuando el año lectivo correspondiente se encuentra en su **4° período (período final)** o cuando se hayan completado/cerrado al menos `N-1` de sus períodos lectivos totales (donde `N` es el número total de períodos del año).
- El sistema rechaza con HTTP 400 cualquier intento de registrar promoción anual si apenas han transcurrido 1 o 2 períodos del año lectivo evaluado.

## RN-19.6: Gestión del Estado de Decisión en Interfaz Directiva
- **Estudiantes Promovidos**: Para estudiantes en estado `APROBADO` (100% asignaturas aprobadas) sin decisión manual previa, la interfaz muestra la etiqueta de estado `"Promovido automáticamente"` sin exigir la creación de un registro de excepción.
- **Edición de Decisiones**: Cuando un estudiante ya posee una decisión registrada en la base de datos, la interfaz despliega la decisión formateada amigablemente y habilita el botón en estado **"Editar Decisión"** (con ícono y estilo de edición), permitiendo al directivo ajustar la decisión u observaciones sin crear registros duplicados.

## RN-19.7: Exclusión de Estudiantes Trasladados e Inactivos
- Las consultas de seguimiento por período (`/api/academic-admin/academic-tracking/period-tracking`) y consolidación anual (`/api/academic-admin/academic-tracking/annual-consolidation`) filtran y procesan únicamente matrículas en estado `ACTIVA`, `APROBADA` o `CULMINADA` en la institución.
- Los estudiantes cuya matrícula pasó a estado `TRASLADADA` (trasladados a otro plantel) o que no tienen matrícula vigente en el año escolar se excluyen de los cálculos estadísticos, listados de rendimiento y decisiones de promoción del colegio de origen.

