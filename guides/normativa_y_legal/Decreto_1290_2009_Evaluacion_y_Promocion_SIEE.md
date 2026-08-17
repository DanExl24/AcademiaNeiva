# 📜 Decreto 1290 de 2009 — Evaluación del Aprendizaje y Promoción Escolar (S.I.E.E.)

## 1. Fundamentación Legal y Estructura del Decreto 1290 de 2009

El **Decreto 1290 de 2009** (compilado en el Decreto 1075 de 2015, Decreto Único Reglamentario del Sector Educación) reglamenta la evaluación del aprendizaje y promoción de los estudiantes de la educación básica y media en Colombia. 

A diferencia de modelos normativos anteriores basados en porcentajes rígidos de reprobación (como el Decreto 230 de 2002), el Decreto 1290 otorga **autonomía a los establecimientos educativos** para definir su propio **Sistema Institucional de Evaluación de los Estudiantes (S.I.E.E.)**.

### Artículos Clave de la Norma:

1. **Artículo 1 (Evaluación de los estudiantes)**: Define que la evaluación del aprendizaje de los estudiantes es continua, integral, cualitativa y cuantitativa, centrada en el desarrollo de competencias.
2. **Artículo 3 (Propósitos de la evaluación)**:
   - Identificar las características personales, intereses, ritmos de desarrollo y estilos de aprendizaje del estudiante.
   - Proporcionar información básica para consolidar o reorientar los procesos educativos.
   - Suministrar información que permita implementar estrategias de apoyo para resolver dificultades académicas.
   - Determinar la **promoción** o **no promoción** de estudiantes en cada grado.
3. **Artículo 4 (Sistema Institucional de Evaluación de los Estudiantes - S.I.E.E.)**:
   - Cada establecimiento educativo debe definir, adoptar y divulgar su S.I.E.E., el cual debe incluir:
     - **Criterios de evaluación y promoción** (incluyendo el número de asignaturas no aprobadas que causan la no promoción del estudiante).
     - La escala de valoración institucional y su respectiva equivalencia con la escala nacional.
     - Las estrategias de valoración integral y planes de apoyo para asignaturas pendientes.
4. **Artículo 5 (Escala de Valoración Nacional)**:
   - Establece la escala conceptual de referencia nacional:
     - **Desempeño Superior**
     - **Desempeño Alto**
     - **Desempeño Básico** (Superación de los desempeños necesarios en relación con las áreas obligatorias y fundamentales).
     - **Desempeño Bajo** (No superación de los desempeños requeridos).
5. **Artículo 6 (Promoción Escolar)**:
   - Cada establecimiento educativo determinará los criterios de promoción escolar de acuerdo con el S.I.E.E.

---

## 2. Aplicación y Cumplimiento del Decreto 1290 en AcademiaNeiva

### 2.1. ¿Por qué la plataforma cumple con el Decreto 1290?

**AcademiaNeiva** ha sido diseñado bajo los principios de flexibilidad y autonomía escolar dictados por el MEN:
- **No impone umbrales rígidos universales**: No obliga a todas las instituciones a aplicar una única regla de reprobación. 
- **Respeto a la escala valorativa del plantel**: Admite cualquier rango numérico (ej. 0.0 a 5.0, 1.0 a 10.0) y permite mapear libremente los cortes conceptuales (Bajo, Básico, Alto, Superior).
- **Configuración dinámica de materias reprobatorias**: Ofrece a cada colegio la potestad de configurar el valor exacto de materias reprobatorias (`materias_reprobatorias_promocion`, por defecto **3**) que determinan cuándo un alumno se clasifica como `NO_PROMOVIDO`.

---

### 2.2. ¿Por qué es vital su ejecución e integración en la plataforma?

1. **Validez Jurídica ante Secretarías de Educación**: Evita demandas administrativas o fallos de tutela por vulneración del debido proceso en la promoción o no promoción de estudiantes.
2. **Trazabilidad de Decisiones Institucionales**: Almacena las actas y decisiones del directivo/comisión de evaluación en `decision_promocion_directivo` con firma del usuario y fecha/hora exacta.
3. **Flexibilidad frente a la Autonomía Escolar**: Permite que colegios técnicos, bilingües o privados adapten la regla a 2 materias o 4 materias según los estatutos aprobados en su Consejo Directivo.

---

### 2.3. Funcionamiento Interno en el Módulo 19 (Seguimiento y Promoción)

El backend de **AcademiaNeiva** evalúa el desempeño de cada estudiante cotejando sus calificaciones con el S.I.E.E. registrado del colegio:

- **0 materias reprobadas** $\rightarrow$ `APROBADO` (Promovido).
- **1 a $N_{\text{reprobatorias}} - 1$ materias reprobadas** $\rightarrow$ `PENDIENTE` (En proceso de recuperación).
- **$\ge N_{\text{reprobatorias}}$ materias reprobadas** $\rightarrow$ `NO_PROMOVIDO` (Reprobado).

Donde $N_{\text{reprobatorias}}$ es el parámetro configurado por la institución (por defecto **3**).

- **Gestión de Graduandos (Último Año)**: Al promover a un estudiante en su grado máximo curricular, el sistema realiza la transición automática a estado `GRADUADO` e inscribe el registro en `registro_graduados`.

---

## 3. Guía para Directivos: Ajuste de las Reglas S.I.E.E. por Colegio

Cada directivo puede personalizar las reglas de promoción de su colegio siguiendo estos pasos:

1. **Ingresar a la Plataforma**:
   - Iniciar sesión con perfil de `Directivo`.
2. **Navegar a Ajustes Académicos**:
   - En el menú lateral, seleccionar **Configuración** $\rightarrow$ **Escalas y Parámetros Académicos** (`/dashboard/configuracion`).
3. **Modificar el Umbral del S.I.E.E.**:
   - Ubicar el formulario **Parámetros Institucionales del Colegio**.
   - Ajustar el campo **`Materias para no promoción (S.I.E.E.)`**:
     - *Ejemplo 1*: Si el S.I.E.E. del plantel estipula no promoción con 3 materias, ingresar `3`.
     - *Ejemplo 2*: Si el plantel es más exigente y no promueve con 2 materias reprobadas, ingresar `2`.
4. **Guardar Cambios**:
   - Hacer clic en el botón **"Guardar Configuración"**.
5. **Verificación en Tiempo Real**:
   - Al dirigirse al módulo de **Gestión de Aprobados** (`/dashboard/gestion-aprobados`), los badges de la cabecera (`Mínimo: X`) y las tarjetas de clasificación se actualizarán instantáneamente acorde al S.I.E.E. del colegio.
