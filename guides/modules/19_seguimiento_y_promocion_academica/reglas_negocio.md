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

## RN-19.4: Trazabilidad de Decisiones Institucionales
- Toda excepción o decisión de promoción sobre un estudiante no promovido debe registrarse en la tabla `decision_promocion_directivo` especificando:
  - Estudiante
  - Colegio y Año lectivo anterior
  - Resultado académico calculado
  - Decisión adoptada (`PROMOVER_SIGUIENTE_GRADO`, `MANTENER_GRADO`, `MATRICULA_CONDICIONADA`, `OTRA_DECISION`)
  - Usuario directivo que autorizó
  - Fecha y hora exacta
  - Observaciones o justificación institucional
