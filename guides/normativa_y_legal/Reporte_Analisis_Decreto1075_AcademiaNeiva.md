# Reporte de Auditoría y Análisis de Modelamiento Técnico-Legal: Decreto 1075 de 2015, Ley 115 de 1994 y Resolución 7797 de 2015 en AcademiaNeiva

> **Fecha de Auditoría:** 12 de Agosto de 2026  
> **Sistema Auditor:** AcademiaNeiva (Backend Node.js/TypeScript/Kysely & Base de Datos PostgreSQL)  
> **Normativa de Referencia:**  
> 1. Ley General de Educación (Ley 115 de 1994 - Art. 11)  
> 2. Decreto Único Reglamentario del Sector Educación (Decreto 1075 de 2015 - Arts. 2.3.3.3.3.16, 2.3.3.3.3.17, 2.3.3.2.2.1.4 y Sección SIEE)  
> 3. Gestión de la Cobertura Educativa SIMAT (Resolución 7797 de 2015 - MEN)  
> **Estado Global del Cumplimiento:** **88% CONSOLIDADO / 12% EN DISCORDANCIA O PARCIAL**

---

## 1. Resumen Ejecutivo de la Auditoría

El presente reporte evalúa la correspondencia entre la arquitectura de datos, lógica de negocio y endpoints del sistema **AcademiaNeiva** frente a las exigencias normativas del Ministerio de Educación Nacional de Colombia (MEN).

El análisis exhaustivo del código fuente ([matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts), [boletinController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/boletinController.ts), [academicTrackingController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/academicTrackingController.ts), [041_decision_promocion_directivo.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/migrations/041_decision_promocion_directivo.sql)) confirma que el sistema posee una sólida arquitectura relacional multi-tenant. Sin embargo, se han identificado discordancias normativas puntuales que deben ser subsanadas para garantizar un cumplimiento legal del 100%.

---

## 2. Cuadro Comparativo de Puntos Normativos vs. Modelamiento en AcademiaNeiva

| Necesidad del Sistema | Referencia Normativa | Estado en AcademiaNeiva | Grado de Coincidencia | Puntos Consolidados | Puntos en Discordancia / Oportunidades de Mejora |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **1. Estructura de niveles y grados** | Ley 115 de 1994, Art. 11 | **CONSOLIDADO** | 100% | Tablas `nivel_escolar` (Preescolar, Primaria, Secundaria, Media), `tipo_grado` y `grupos`. | Ninguna. La división en 4 categorías operativas respeta fielmente la estructura tripartita y de dos ciclos. |
| **2. Registro académico del estudiante** | Decreto 1075/2015, art. 2.3.3.3.3.16 | **CONSOLIDADO** | 90% | Tablas `estudiante`, `padre_familia`, `matricula` (historial por `id_anio`), `cierre_materia` y `observacion_estudiante`. | Falta un módulo/endpoint de **"Hoja de Vida Académica Unificada / Registro Escolar Histórico"** que consolide en un solo PDF descargable todos los años cursados. |
| **3. Resultados por grado** | Decreto 1075/2015, art. 2.3.3.3.3.16 | **CONSOLIDADO** | 100% | `escala_valoracion` (Superior, Alto, Básico, Bajo), `cierre_materia`, `registro_asistencia` y `decision_promocion_directivo`. | Ninguna. Registra el informe cuantitativo/cualitativo, fallas acumuladas y resultado del grado. |
| **4. Constancia de desempeño** | Decreto 1075/2015, art. 2.3.3.3.3.17 | **EN DISCORDANCIA / PARCIAL** | 60% | Generación de boletines de período cerrado (`boletinController.ts`). | **1.** No existe un módulo de expedición de **Constancia Oficial de Desempeño** formal. <br>**2.** `boletinController` bloquea reportes parciales si el período no está cerrado, impidiendo expedir el **informe parcial de evaluación en caso de traslado a mitad de año** (exigencia del Art. 2.3.3.3.3.17). |
| **5. Promoción y continuidad** | Decreto 1075/2015 (Sección SIEE) | **CONSOLIDADO** | 85% | Tabla `decision_promocion_directivo`, cálculo de reprobación y reserva de cupo/reingreso (`reingresoController.ts`). | Faltan campos de parametrización institucional del SIEE en `configuracion_colegio` (% máximo de fallas o número límite de asignaturas perdidas para automatizar la alerta). |
| **6. Gestión/reporte de matrícula** | Resolución 7797 de 2015 (SIMAT) | **CONSOLIDADO** | 85% | Estados de matrícula (`NUEVO`, `MATRICULADO`, `CANCELADO`, `REINGRESO`), flags `es_extranjero`, `es_traslado`, `tiene_discapacidad`. | **1.** Faltan variables de caracterización SIMAT (`victima_conflicto`, `etnia`) en la tabla `estudiante`. <br>**2.** No existe exportador en formato oficial SIMAT (XML/CSV) para la Secretaría de Educación. |
| **7. Documentación específica de ingreso a educación inicial** | Decreto 1075/2015, art. 2.3.3.2.2.1.4 | **CONSOLIDADO** | 100% | `matriculaService.ts` exige Registro Civil, Vacunas y Salud para Preescolar, y **excluye expresamente certificados de escolaridad y pruebas de admisión**. Evaluación por `dimensiones_preescolar`. | Ninguna. Cumplimiento estricto de las restricciones del Decreto 1075 de 2015 para educación inicial. |

---

## 3. Análisis Exhaustivo Punto por Punto

### 3.1. Estructura de Niveles y Grados (Ley 115 de 1994, Art. 11)
* **Norma Legal:** Exige organizar la educación formal en Preescolar (mínimo 1 grado obligatorio), Educación Básica (9 grados divididos en 2 ciclos: Primaria de 5 grados y Secundaria de 4 grados) y Educación Media (2 grados).
* **Modelamiento en AcademiaNeiva:**
  * Base de datos: Tabla `nivel_escolar` que aloja los valores `'PREESCOLAR'`, `'PRIMARIA'`, `'SECUNDARIA'`, `'MEDIA'`.
  * Tabla `tipo_grado`: Relaciona cada grado (Transición, 1.º a 11.º) con su respectivo `id_nivel`.
* **Dictamen:** **CONSOLIDADO (100%)**. La representación de Primaria y Secundaria como categorías operativas independientes respeta el espíritu del legislador y facilita las operaciones del software.

---

### 3.2. Registro Académico del Estudiante (Decreto 1075 de 2015, Art. 2.3.3.3.3.16)
* **Norma Legal:** *"En todas las instituciones educativas se mantendrá un registro actualizado de los estudiantes en el que conste los datos de identificación personal, el informe final de evaluación de cada grado cursado y las novedades académicas que surjan."*
* **Modelamiento en AcademiaNeiva:**
  * **Datos de identificación:** Tablas `estudiante`, `usuario`, `padre_familia` y `detalle_padrefamilia`.
  * **Informes finales y novedades:** Tablas `cierre_materia`, `decision_promocion_directivo`, `observacion_estudiante`, `traslado_aprobacion` e historial de `matricula`.
* **Dictamen:** **CONSOLIDADO (90%)**.
* **Punto en Discordancia / Brecha:**
  * *Oportunidad de Mejora:* La información está registrada por vigencias anuales, pero no existe una vista o exportación unificada denominada **"Registro Escolar Folio / Hoja de Vida Histórica"** que consolide en una sola vista auditable todos los grados cursados por un estudiante desde su ingreso hasta la fecha actual.

---

### 3.3. Resultados por Grado (Decreto 1075 de 2015, Art. 2.3.3.3.3.16)
* **Norma Legal:** El registro escolar debe guardar al término de cada año el informe final con calificaciones por asignatura, desempeño cualitativo, inasistencias y la decisión final de promoción.
* **Modelamiento en AcademiaNeiva:**
  * Tabla `escala_valoracion`: Mapea notas numéricas a la escala nacional (SUPERIOR, ALTO, BÁSICO, BAJO).
  * Tabla `cierre_materia`: Guarda las notas finales cerradas por docente/asignatura.
  * Migración `041_decision_promocion_directivo.sql`: Guarda el `resultado_calculado` (`APROBADO`, `NO_PROMOVIDO`) y la `decision_tomada` por el directivo.
* **Dictamen:** **CONSOLIDADO (100%)**. El flujo de cierre de materias y registro de decisiones de promoción satisface plenamente la exigencia del artículo.

---

### 3.4. Constancia de Desempeño (Decreto 1075 de 2015, Art. 2.3.3.3.3.17)
* **Norma Legal:** *"El establecimiento educativo, a solicitud del padre de familia, emitirá constancias de desempeño de cada grado cursado... Si un estudiante se traslada de un establecimiento a otro antes de finalizar el año lectivo, el establecimiento de origen expedirá un informe parcial de evaluación..."*
* **Modelamiento en AcademiaNeiva:**
  * En `boletinController.ts`, se implementa el endpoint `getStudentBoletin`. Sin embargo, la línea 67 bloquea la generación si el periodo académico no tiene estado `'CERRADO'`:
    ```typescript
    if (!periodoDetails || periodoDetails.estado !== 'CERRADO') {
      return res.status(400).json({ error: 'No hay suficientes registros académicos para generar el boletín. Deberá esperar hasta el cierre de periodo.' });
    }
    ```
* **Dictamen:** **EN DISCORDANCIA / PARCIAL (60%)**.
* **Puntos en Discordancia Crítica:**
  1. **Falta de Módulo de Certificaciones:** No se cuenta con una plantilla/endpoint específico para emitir la **"Constancia Oficial de Desempeño Escolar"** (documento legal membretado con firmas para trámites externos/traslados).
  2. **Imposibilidad de Expedir Informe Parcial de Traslado:** Si un estudiante se retira a mitad de período por traslado, el sistema rechaza la emisión del boletín porque el período general del colegio sigue abierto. Esto viola expresamente el Art. 2.3.3.3.3.17, que exige otorgar un *informe parcial de evaluación a la fecha del retiro*.

---

### 3.5. Promoción y Continuidad (Decreto 1075 de 2015, Sección 3 SIEE)
* **Norma Legal:** Reglamenta la evaluación institucional, los criterios para promover o reprobar estudiantes (por inasistencia o número de asignaturas reprobadas) y la garantía de reserva de cupo para la continuidad del proceso educativo.
* **Modelamiento en AcademiaNeiva:**
  * Servidores y controladores: `academicTrackingController.ts` y `reingresoController.ts`.
  * Registra las decisiones institucionales en `decision_promocion_directivo` con opciones como `PROMOVER_SIGUIENTE_GRADO`, `MANTENER_GRADO` (repetición) o `MATRICULA_CONDICIONADA`.
* **Dictamen:** **CONSOLIDADO (85%)**.
* **Punto en Discordancia / Brecha:**
  * Falta incluir en `configuracion_colegio` la parametrización de las reglas del SIEE (ej. `max_materias_reprobables_promocion`, `porcentaje_maximo_inasistencia`). Actualmente los umbrales están fijos en código o requieren la intervención manual del directivo.

---

### 3.6. Gestión/Reporte de Matrícula (Resolución 7797 de 2015 - Cobertura SIMAT)
* **Norma Legal:** Establece los requerimientos de información del proceso de matrícula nacional (SIMAT), incluyendo caracterización poblacional completa y trazabilidad de los estados de la matrícula (`NUEVO`, `MATRICULADO`, `CANCELADO`, `REINGRESO`).
* **Modelamiento en AcademiaNeiva:**
  * Tabla `matricula`: Maneja el ciclo de vida del trámite con los estados requeridos por la norma.
  * Tabla `documento_matriculas`: Almacena soportes digitales.
  * Atributos actuales: `es_extranjero`, `es_traslado`, `tiene_discapacidad`.
* **Dictamen:** **CONSOLIDADO (85%)**.
* **Puntos en Discordancia / Brecha:**
  1. **Falta de Caracterización Poblacional SIMAT:** Faltan los campos `victima_conflicto` (desplazamiento/conflicto armado) y `etnia` en la entidad `estudiante`.
  2. **Exportador SIMAT:** Ausencia de una función que exporte la sábana de matrículas en el formato oficial (CSV/XML) formateado para el SIMAT de la Entidad Territorial Certificada.

---

### 3.7. Documentación Específica de Ingreso a Educación Inicial (Decreto 1075 de 2015, Art. 2.3.3.2.2.1.4)
* **Norma Legal:** Para el ingreso a los grados de Preescolar (Transición):
  1. Exige únicamente Registro Civil de Nacimiento, Carné de Vacunación al día y Certificado de Salud/EPS.
  2. **Prohíbe taxativamente la exigencia de certificados de escolaridad previos y la aplicación de exámenes o pruebas de admisión.**
  3. Exige evaluación basada en las Dimensiones del Desarrollo.
* **Modelamiento en AcademiaNeiva:**
  * En [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts#L27-L35):
    ```typescript
    const isPre = level === 'PREESCOLAR';
    if (!isHigher) required.push(...REQUIRED_FOR_LOWER_LEVELS); // registroCivil, vacunas
    if (!isPre)    required.push(...REQUIRED_NOT_INFANT);       // certificadosEscolaridad (EXCLUIDO PARA PREESCOLAR)
    ```
  * Tabla `dimensiones_preescolar`: Contiene las 7 dimensiones del desarrollo contempladas por el MEN.
* **Dictamen:** **CONSOLIDADO (100%)**. El código cumple de manera impecable con el mandato del Art. 2.3.3.2.2.1.4.

---

## 4. Plan de Acción Recomendado para Subsanar Discordancias

Para elevar la conformidad normativa de **AcademiaNeiva** al 100%, se recomienda implementar las siguientes mejoras en los próximos sprints:

1. **Subsanar el Bloqueo de Informes Parciales (Art. 2.3.3.3.3.17):**
   * Modificar `boletinController.ts` para permitir la generación de un **"Boletín Parcial de Traslado"** para estudiantes cuya matrícula esté en estado `CANCELADO` o `EN TRASLADO`, aun cuando el periodo general no haya sido cerrado formalmente.
2. **Módulo de Emisión de Constancias y Certificados (Art. 2.3.3.3.3.17):**
   * Crear un endpoint y vista para generar **Constancias Oficiales de Desempeño Escolar** y **Certificados de Escolaridad** membretados y firmados.
3. **Vista de Registro Escolar Histórico / Folio (Art. 2.3.3.3.3.16):**
   * Implementar una consulta que consolide la trayectoria histórica completa de un estudiante (todos sus años cursados, notas definitivas y observaciones) en una sola vista auditable.
4. **Campos SIMAT y Exportador (Resolución 7797 de 2015):**
   * Agregar las columnas `victima_conflicto` y `etnia` en la tabla `estudiante` y habilitar la exportación masiva de datos en formato SIMAT.

---

## 5. Conclusión

El modelamiento de **AcademiaNeiva** demuestra un alto grado de rigor técnico y alineación con la legislación educativa colombiana, destacándose especialmente en la estructura de niveles/grados (Ley 115/1994), el registro de decisiones de promoción (Decreto 1075/2015) y la protección del ingreso a educación inicial (Art. 2.3.3.2.2.1.4).

Las discordancias halladas no comprometen la integridad de la base de datos, sino que representan funcionalidades operativas de reporte (certificaciones oficiales e informes parciales de traslado) que pueden ser integradas de forma transparente mediante ajustes en la capa de controladores y servicios del backend.
