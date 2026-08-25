# Historias de Usuario — Estructura Escolar (Grados, Cursos, Jornadas y Materias)

Este documento detalla las Historias de Usuario del módulo de **Estructura Escolar** de AcademiaNeiva, vinculando actores, narrativas y criterios de aceptación técnicos.

---

## 1. Configuración de Grados y Cursos

### HU-EST-001: Creación y Parametrización de Cursos Físicos con Aforo
- **Como:** Directivo Escolar (Coordinador Académico o Rector).
- **Quiero:** Crear un nuevo curso físico asignando su nivel, tipo de grado, jornada, sección y límite de cupos.
- **Para:** Habilitar salones disponibles para la inscripción y matrícula de estudiantes en el año escolar.
- **Criterios de Aceptación:**
  1. El formulario exige seleccionar nivel escolar, jornada habilitada, tipo de grado y digitar la sección (máx 10 chars) y los cupos totales.
  2. Si la sección ingresada no existe, el sistema la inserta automáticamente en la tabla `secciones`.
  3. No se permite duplicar cursos con la misma combinación de jornada, grado y sección dentro de la misma institución (`409 Conflict`).
  4. Al crearse, el curso queda disponible de inmediato para asignaciones académicas y matrículas.

---

### HU-EST-002: Creación de Tipos de Grado con Detección de Similitud Semántica
- **Como:** Directivo Escolar.
- **Quiero:** Registrar un nuevo tipo de grado en un nivel escolar de mi institución.
- **Para:** Expandir la oferta académica del plantel sin generar duplicidades o grados con nombres confusos.
- **Criterios de Aceptación:**
  1. El sistema normaliza el nombre a mayúsculas y aplica el algoritmo `isDuplicateOrSimilarGrade`.
  2. Si el directivo intenta registrar un grado similar o equivalente a uno existente (ej. *"1RO"* o *"1°"* cuando ya existe *"PRIMERO"*), el backend rechaza la solicitud con error `409 Conflict`.
  3. La eliminación de un tipo de grado verifica que no tenga cursos, matrículas o asignaciones docentes asociadas, bloqueando la operación con un reporte de impacto si existen dependencias.

---

### HU-EST-003: Modificación Segura de Capacidad de Cupos por Salón
- **Como:** Directivo Escolar.
- **Quiero:** Actualizar el límite máximo de cupos de un curso físico.
- **Para:** Ajustar el aforo del salón según la capacidad física del aula o las directrices institucionales.
- **Criterios de Aceptación:**
  1. El backend verifica la cantidad de estudiantes actualmente inscritos en el curso.
  2. Si el nuevo valor de cupos es inferior al número de alumnos matriculados activos, la solicitud se rechaza con error `400 Bad Request`.
  3. Al confirmarse un valor válido, la capacidad se actualiza en `grupos.cupos_totales` y se refleja en tiempo real en los selectores de matrículas.

---

## 2. Nomenclatura y Renombramiento Inteligente

### HU-EST-004: Renombramiento Individual y en Bloque de Cursos
- **Como:** Directivo Escolar.
- **Quiero:** Renombrar un curso individual o estandarizar masivamente todos los cursos de un grado escolar.
- **Para:** Mantener una nomenclatura uniforme y clara en los boletines y listados oficiales.
- **Criterios de Aceptación:**
  1. **Renombramiento Individual:** Si el curso comparte su sección con otros salones (`shared > 1`), el sistema crea una nueva sección en `secciones` y actualiza el curso sin alterar a los demás cursos paralelos.
  2. **Renombramiento en Bloque:** Permite ingresar prefijo, separador y tipo de serie (`LETRA` o `NUMERO`), generando secuencias como "10-A, 10-B" o "10-1, 10-2".
  3. El sistema valida que ningún nombre generado supere el límite de 10 caracteres.

---

## 3. Catálogo Curricular y Papelera de Materias

### HU-EST-005: Eliminación Forzada y Restauración Profunda de Materias
- **Como:** Directivo Escolar.
- **Quiero:** Eliminar una materia en desuso con respaldo de su historial o restaurarla desde la papelera institucional.
- **Para:** Mantener limpio el catálogo de asignaturas sin perder de forma irreversible las asignaciones docentes y competencias configuradas.
- **Criterios de Aceptación:**
  1. Si una materia tiene asignaciones en `detalle_grados` o competencias pedagógicas, el sistema exige confirmación forzada (`force=true`).
  2. Al eliminar forzadamente, genera un snapshot transaccional JSON en `papelera_materias.data_respaldo` con todas las asignaciones y competencias antes de eliminarlas de la base de datos.
  3. En la papelera de materias (`SubjectManagement.vue`), el directivo puede visualizar las materias eliminadas y presionar "Restaurar", lo cual recrea la materia y re-inserta automáticamente todas las asignaciones y competencias respaldadas.

---

### HU-EST-006: Habilitación y Gestión de Jornadas Institucionales
- **Como:** Directivo Escolar.
- **Quiero:** Habilitar o retirar jornadas de operación en mi colegio.
- **Para:** Organizar los turnos en que operan los diferentes cursos escolares.
- **Criterios de Aceptación:**
  1. Solo se admiten los nombres oficiales: `MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA`.
  2. No se permite habilitar jornadas duplicadas en la misma institución.
  3. Una jornada con cursos vinculados en `grupos` no puede eliminarse (`409 Conflict`).
