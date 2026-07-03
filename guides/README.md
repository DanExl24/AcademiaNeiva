# 📖 Portal de Documentación - AcademiaNeiva

Bienvenido a la documentación técnica y funcional de **AcademiaNeiva**. Esta guía centraliza todas las especificaciones, reglas de negocio e implementaciones del sistema académico de Neiva.

---

## 🗺️ Índice de Contenidos

### 1. 📐 **[Arquitectura y Modelo Relacional](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/architecture.md)**
- Descripción del stack técnico.
- Estructura del esquema de base de datos relacional ([AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)).
- Roles de usuario, jerarquías académicas y relaciones fundamentales.

### 2. 🔗 **Módulos y Reglas de Negocio Complejas (`guides/modules/`)**

- 📚 **[Catálogo Oficial DBA y Coherencia](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/dba_catalogue.md)**
  - Lógica del catálogo de Derechos Básicos de Aprendizaje (DBA).
  - Reglas de vinculación de evidencias a competencias académicas.
  - Reporte de Coherencia Curricular de las actividades docentes.
  
- 🔒 **[Ciclo de Vida y Protección de Periodos](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/academic_periods.md)**
  - Estados de periodo: `PENDIENTE`, `ABIERTO`, `CERRADO`.
  - Mecanismos de protección estricta para periodos cerrados.
  
- 🔄 **[Modelo de Sincronización de Competencias](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/competency_sync.md)**
  - Agrupación por `sync_uuid` para cursos paralelos (peer groups).
  - Lógica de sincronización en caliente y eliminación de la restricción UNIQUE.
  
- 📊 **[Calificaciones y Observaciones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/grading_and_observations.md)**
  - Observaciones académicas, de convivencia, disciplinarias y generales.
  - Generación de promedios de boletín y lógica de distribución de notas.
  
- 🕵️ **[Auditorías y Modo Supervisión](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/supervisions_and_auditing.md)**
  - Modo supervisión del Administrador General con aprobación de directivos.
  - Herencia de rol Rector (Lectura / Editor).
  - Registros de auditoría, control de tiempos e inmutabilidad de logs.
  
- 🎓 **[Estados de Estudiantes y Matrículas](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/student_states.md)**
  - Estados de estudiantes (`ACTIVO`, `SANCIONADO`, `EXPULSADO`, `RETIRADO`).
  - Estados de matrícula (`ACTIVA`, `CANCELADA`) y sus implicaciones.

---

## 🎨 Diagramas de Flujo y Casos de Uso
Los diagramas visuales y esquemas del sistema se encuentran resguardados en la carpeta:
- **[guides/diagrams/](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/diagrams)** (Por favor no modificar estos recursos gráficos directamente).
