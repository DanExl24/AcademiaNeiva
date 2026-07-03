# 📚 Catálogo DBA y Coherencia Curricular

Este módulo describe la planeación curricular de la institución utilizando los **Derechos Básicos de Aprendizaje (DBA)** del Ministerio de Educación Nacional de Colombia, las reglas de asignación y el **Reporte de Coherencia Curricular**.

---

## 📋 Catálogo Oficial de DBA

Cada institución cuenta con una versión curricular del catálogo DBA asociada a sus grados y materias a través de la tabla `colegio_version_curricular`. 

Un DBA contiene:
- Un **enunciado principal** (ej. "Comprende que los seres vivos tienen características y necesidades...").
- Una o más **Evidencias Oficiales** de aprendizaje (ej. "Diferencia objetos inertes de seres vivos...").

Los docentes y directivos vinculan estas evidencias a las competencias del plan de estudios de cada grado.

---

## 🔒 Regla de Exclusividad 1-to-1 de las Evidencias

Para evitar la redundancia curricular y garantizar una cobertura completa de los lineamientos del MEN, el sistema aplica una **regla de exclusividad estricta**:

> [!IMPORTANT]
> Una evidencia del catálogo oficial DBA puede estar asignada a **máximo una única competencia** para la misma asignatura, grado (incluyendo cursos paralelos) y año lectivo.

### Lógica de Filtrado y Visualización (Frontend / Backend)
- Al consultar las evidencias DBA disponibles para una competencia en `/settings/dba-planeacion/disponibles`:
  - **Modo Creación**: Se excluyen o bloquean todas las evidencias que ya se encuentren vinculadas a cualquier otra competencia del mismo año, materia y grado (incluyendo paralelos).
  - **Modo Edición**: Se muestran seleccionadas las evidencias que pertenecen a la competencia actual y se bloquean (solo lectura con ícono de candado 🔒 y advertencia amber) las evidencias que pertenecen a *otras* competencias.
  - La interfaz muestra una etiqueta con el **Periodo Académico** y la **Descripción de la Competencia** a la que está enlazada la evidencia bloqueada para dar total contexto al directivo.
- El sistema cuenta con un **buscador reactivo en tiempo real** en el modal de vinculación que permite filtrar dinámicamente las evidencias y enunciados DBA por texto.

### Validación en el Servidor
En `vincularEvidenciasDbaACompetencia` y `upsertCompetencyByAdmin` en [academicAdminController.ts](file:///C:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts), antes de realizar cualquier cambio, se realiza una consulta de colisión:

```sql
SELECT ea.id_evidencia_dba, c.id_periodo, p.nombre AS periodo_nombre
FROM evidencia_aprendizaje ea
JOIN competencias c ON c.id_competencia = ea.id_competencia
JOIN periodo_academico p ON p.id_periodo = c.id_periodo
WHERE c.id_colegio = $1
  AND c.id_año = $2
  AND c.id_materia = $3
  AND c.id_grupo = ANY($4::int[])
  AND (c.sync_uuid != $5 OR c.sync_uuid IS NULL)
  AND ea.id_evidencia_dba = ANY($6::int[])
```

Si existe alguna colisión, el backend rechaza la transacción con un código `400 (Bad Request)` detallando exactamente qué evidencias y en qué periodo están duplicadas.

---

## 📊 Reporte de Coherencia Curricular

El reporte de coherencia curricular (administrado por `dbaReportsController.ts`) permite a los rectores y coordinadores auditar qué tanto se alinean las actividades de los docentes con el currículo DBA planificado.

### Métrica de Coherencia
El reporte cruza las actividades de materia registradas por los docentes con las competencias vinculadas a DBA:
- **Cumple**: Si el docente ha registrado al menos una actividad evaluativa asociada a la evidencia de aprendizaje asignada al curso.
- **Pendiente**: Si la evidencia está en el plan de estudios del periodo pero el docente aún no ha registrado ninguna actividad evaluativa de control para ella.

### Corrección de la columna `fecha_creacion`
Anteriormente, el reporte arrojaba un error crítico `column am.fecha_creacion does not exist` al intentar ordenar cronológicamente las actividades docentes. 

**Solución aplicada**:
1. Agregamos de manera nativa la columna `fecha_creacion` con tipo `TIMESTAMPTZ` y valor por defecto `now()` a la tabla `actividad_materia`.
2. Esto asegura que la base de datos almacene automáticamente la fecha y zona horaria de creación de la actividad, haciendo que la consulta del reporte de coherencia funcione de manera óptima y fluida.
