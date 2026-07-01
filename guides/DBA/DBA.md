# Sistema de Calificación y Trazabilidad Académica

## 1. Propósito del sistema

Este sistema modela la evaluación académica en instituciones educativas, permitiendo:

- Registrar el aprendizaje basado en DBA (Derechos Básicos de Aprendizaje).
- Organizar la planeación pedagógica por competencias y periodos.
- Permitir evaluación flexible por parte del docente.
- Detectar coherencia entre lo planeado y lo ejecutado.
- Mantener trazabilidad completa de evaluaciones.

---

## 2. Conceptos base

### 2.1 DBA (Derechos Básicos de Aprendizaje)

Los DBA representan los aprendizajes estructurantes definidos por el Ministerio de Educación Nacional.

Características:

- Son la fuente oficial del currículo.
- Definen lo que el estudiante debe aprender en un área y grado.
- Están compuestos por un enunciado general y varias evidencias de aprendizaje.

Ejemplo conceptual:

- **DBA:** Comprensión de los sentidos
- **Evidencias:**
  - Describe sonidos y olores
  - Compara temperaturas
  - Usa instrumentos de observación

### 2.2 Evidencias de aprendizaje

Son descriptores observables que permiten verificar el cumplimiento de un DBA.

- Provienen exclusivamente del DBA.
- Representan habilidades o comportamientos evaluables.
- Son la unidad mínima de evaluación conceptual.

### 2.3 Competencia

La competencia es una agrupación pedagógica definida por la institución educativa.

Función:

- Organizar evidencias del DBA según intención pedagógica.
- Definir la planeación académica por periodo.
- Dar contexto al proceso de enseñanza.

Importante:

- No es fuente de evidencias.
- No crea evidencias nuevas.
- Solo referencia evidencias existentes del DBA.

### 2.4 Periodo académico

Representa la división temporal del año escolar.

Función:

- Determinar cuándo se trabaja una competencia.
- Organizar la planificación curricular en el tiempo.

### 2.5 Actividad evaluativa

Es el instrumento utilizado por el docente para evaluar el aprendizaje (ej: talleres, exámenes, proyectos, laboratorios).

- Puede evaluar una o varias evidencias del DBA.
- Contiene criterios de evaluación y ponderaciones.

### 2.6 Criterios de evaluación

Son los parámetros específicos utilizados para calificar una actividad.

Ejemplos:

- Precisión
- Claridad
- Aplicación del concepto

---

## 3. Modelo conceptual del sistema

### 3.1 Fuente de verdad

- DBA
  - Evidencias de aprendizaje

### 3.2 Planeación institucional

- Competencia
  - Relación competencia_evidencia (con evidencias DBA)
  - Relación competencia_periodo (asignación temporal)

Función:

- Definir qué evidencias se trabajarán en cada periodo.
- Representar la intención pedagógica del colegio.

### 3.3 Ejecución docente

- Actividad
  - Relación actividad_evidencia (con evidencias DBA)
  - Criterios de evaluación

Función:

- Registrar lo que realmente se evalúa en el aula.
- Permitir flexibilidad docente.

---

## 4. Modelo de coherencia curricular

El sistema permite comparar:

- **Planeado vs Ejecutado**

| Tipo      | Fuente                |
| --------- | --------------------- |
| Planeado  | competencia_evidencia |
| Ejecutado | actividad_evidencia   |

### Estados de evaluación de evidencias

Cada evidencia evaluada en una actividad se clasifica en:

- **PLANEADA:** La evidencia está incluida dentro de la competencia del periodo.
- **EXTRA:** La evidencia fue evaluada, pero no estaba incluida en la planeación del periodo.

---

## 5. Auditoría pedagógica

El sistema permite responder preguntas como:

- ¿Qué evidencias fueron planeadas para un periodo?
- ¿Qué evidencias fueron realmente evaluadas?
- ¿Qué docentes evaluaron evidencias fuera de la planeación?
- ¿Qué tan coherente fue la ejecución con la planificación?

---

## 6. Reglas estructurales del sistema

### Regla 1: Fuente única de evidencias

- Todas las evaluaciones deben referenciar `evidencias_dba`.

### Regla 2: Independencia entre planeación y ejecución

- La competencia no controla la evaluación.
- La actividad no depende de la competencia.

### Regla 3: Relación flexible

Una evidencia puede:

- Estar en la planeación.
- Ser evaluada sin estar en la planeación.
- Aparecer en múltiples actividades.

---

## 7. Diseño relacional (resumen)

### Tablas base

- dba
- evidencias_dba

### Planeación

- competencia
- competencia_evidencia
- competencia_periodo

### Ejecución

- actividad
- actividad_evidencia
- criterios
- notas

### Auditoría lógica

- Comparación entre `competencia_evidencia` y `actividad_evidencia`

---

## 8. Idea central del sistema

El sistema no busca imponer rigidez absoluta, sino mantener la trazabilidad entre lo planeado y lo realmente ejecutado en el aula.

---

## 9. Concepto clave final

- **DBA:** Qué se debe aprender.
- **Competencia:** Cómo se planea enseñar.
- **Actividad:** Cómo se evalúa realmente.
- **Auditoría:** Qué tan alineado estuvo el proceso.

RN-DBA-001: Propiedad de la evidencia

Una evidencia de aprendizaje debe estar asociada a un único DBA dentro del sistema.

Justificación:
La estructura oficial de los DBA organiza las evidencias bajo un DBA específico, por lo que la relación debe conservarse para mantener la trazabilidad curricular.

RN-DBA-002: Independencia de identidad

Dos evidencias pertenecientes a DBA diferentes deben registrarse como entidades independientes, incluso si poseen el mismo texto descriptivo.

Ejemplo:

DBA 1

- Describe características de los objetos.

DBA 5

- Describe características de los objetos.

El sistema almacenará dos registros distintos.

RN-DBA-003: No deduplicación automática

El sistema no debe fusionar evidencias automáticamente basándose únicamente en la similitud o igualdad de su descripción textual.

Justificación:
La misma redacción puede representar contextos curriculares distintos.

RN-DBA-004: Conservación de la fuente curricular

Toda evidencia debe conservar referencia explícita al DBA del cual fue obtenida.

Objetivo:
Permitir auditorías y reportes de cobertura curricular.

RN-DBA-005: Evaluación asociada a evidencia específica

Las actividades evaluativas deben asociarse a la evidencia específica seleccionada por el docente y no únicamente al texto de la evidencia.

Consecuencia:

Esto es válido:

Actividad
→ Evidencia ID 15
→ DBA 3

Y diferente de:

Actividad
→ Evidencia ID 28
→ DBA 7

aunque ambas tengan el mismo texto.

RN-DBA-006: Cobertura curricular por DBA

La cobertura de un DBA debe calcularse utilizando exclusivamente las evidencias asociadas a dicho DBA.

Ejemplo:

Si una evidencia idéntica existe en dos DBA:

DBA A
└ Evidencia X

DBA B
└ Evidencia X

Evaluar la evidencia de DBA A no implica cobertura para DBA B.

RN-DBA-007: Advertencia de similitud

El sistema podrá advertir al Administrador General cuando se detecten evidencias con descripciones idénticas o altamente similares entre DBA distintos.

Acción:
Solo informativa.

No debe:

Fusionar registros.
Eliminar registros.
Modificar relaciones existentes.
RN-DBA-008: Fuente única de evaluación

Toda evidencia utilizada en competencias o actividades debe existir previamente en el catálogo oficial de evidencias DBA.

DBA
└ Evidencia

Competencia
└ Evidencia

Actividad
└ Evidencia

No se permite crear evidencias "libres" desde competencias o actividades.

RN-DBA-009: Trazabilidad histórica

Las modificaciones de texto sobre una evidencia no deben alterar la relación histórica entre actividades evaluadas y la evidencia original.

RN-DBA-010: Integridad curricular

Una evidencia eliminada o desactivada no debe afectar:

Actividades históricas.
Competencias históricas.
Reportes históricos.

La información debe conservarse para fines de auditoría.

---

# RN-DBA-022 - Planeación única de evidencias

Una evidencia de aprendizaje solo podrá ser planificada una vez dentro del mismo año lectivo para un grado, área y curso.

Excepción:
El sistema permitirá que una evidencia ya planificada sea utilizada nuevamente en actividades evaluativas cuando el docente lo considere necesario.

# RN-DBA-023 - Reutilización de evidencias

La reutilización de una evidencia previamente planificada no modifica la planeación curricular ni genera una nueva asignación al periodo académico.

Incluso puedes aprovechar esto en la interfaz

Cuando el directivo esté armando las competencias del periodo siguiente, el sistema podría mostrar:

⚠ Esta evidencia ya fue planificada en el Periodo x (anterior).

¿Desea agregarla nuevamente?

Motivo:
[ ] Refuerzo
[ ] Recuperación
[ ] Proyecto integrador
[ ] Otro

# RN-DBA-024 - Planeación única de evidencias

Una evidencia de aprendizaje solo podrá estar asociada a una única competencia dentro del mismo año lectivo para un grado y área determinados.

# RN-DBA-025 - Cobertura curricular

La totalidad de las competencias del año deberá cubrir las evidencias de los DBA definidos para el grado y área, evitando duplicidades en la planeación.
