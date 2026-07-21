# 📖 Portal de Documentación - AcademiaNeiva

Bienvenido a la documentación técnica y funcional de **AcademiaNeiva**. Esta guía centraliza todas las especificaciones, reglas de negocio e implementaciones del sistema académico de Neiva.

---

## 🗺️ Índice de Contenidos

### 1. 📐 **[Arquitectura y Modelo Relacional](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/architecture.md)**
- Descripción del stack técnico.
- Estructura del esquema de base de datos relacional ([AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql)).
- Roles de usuario, jerarquías académicas y relaciones fundamentales.

### 2. 🔗 **Módulos y Reglas de Negocio Estructuradas (`guides/modules/`)**

- 🔐 **[01. Autenticación y Sesiones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/01_autenticacion/autenticacion.md)**
  - Flujo de login para todos los roles, blacklist de tokens (`jti`), cierres forzados de sesión y directorio institucional.
- 🏫 **[02. Gestión de Colegios](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/02_gestion_colegios/gestion_colegios.md)**
  - Administración global de instituciones por el Admin General y configuración de la identidad y colores del colegio por los directivos.
- 👥 **[03. Usuarios y Directivos](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/03_usuarios_y_directivos/usuarios_y_directivos.md)**
  - CRUD global de usuarios, directivos vinculados a colegios, restablecimiento y modificación de credenciales asociadas a tickets de soporte.
- 🏗️ **[04. Estructura Escolar](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/04_estructura_escolar/estructura_escolar.md)**
  - Definición de niveles, tipos de grado, asignación de grupos/secciones y materias en el catálogo institucional.
- 👩‍🏫 **[05. Docentes y Asignación Académica](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/05_docentes/docentes.md)**
  - Vinculación docente a grupos y materias en `detalle_grados` y envío de correos automatizados de bienvenida.
- 📋 **[06. Matrículas e Inscripciones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/06_matriculas/matriculas.md)**
  - Solicitudes de inscripción pública, seguimiento con token UUID, validación de documentos y matrículas extraordinarias.
- 🎓 **[07. Estudiantes y Estados](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/07_estudiantes_y_estados/estudiantes_y_estados.md)**
  - Ciclo de vida del estudiante (`ACTIVO`, `RETIRADO`, `EXPULSADO`), suspensiones y triggers de sincronización de estado.
- ⚙️ **[08. Configuración Académica](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/08_configuracion_academica/configuracion_academica.md)**
  - Creación de periodos académicos, escalas de valoración (automática/manual) y bloqueos en periodos `CERRADOS`.
- 🔄 **[09. Competencias y Sincronización](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/09_competencias_y_sincronizacion/competencias_y_sincronizacion.md)**
  - Gestión de competencias múltiples y propagación en caliente a cursos paralelos a través de `sync_uuid`.
- 📚 **[10. Catálogo DBA y Coherencia](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/10_catalogo_dba/catalogo_dba.md)**
  - Derechos Básicos de Aprendizaje (DBA), exclusividad 1-to-1 de evidencias, reglas del grado Transición y reporte de coherencia curricular.
- 📊 **[11. Calificaciones y Actividades](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/11_calificaciones/calificaciones.md)**
  - Planilla docente, desglose de notas por actividades y criterios ponderados, y distribución estadística en seeders.
- 📝 **[12. Observaciones del Estudiante](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/12_observaciones/observaciones.md)**
  - Registro de observaciones formativas (académicas, de convivencia, disciplinarias) y su rol de obligatoriedad en boletines.
- 📅 **[13. Asistencia Escolar](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/13_asistencia/asistencia.md)**
  - Toma de fallas diarias y justificación, con validación de límite estricto de máximo 7 bloques por día.
- 📄 **[14. Cierre y Boletines](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/14_cierre_y_boletines/cierre_y_boletines.md)**
  - Consolidación final de periodos por materia e institucional, y generación de boletines en formato PDF individual y grupal.
- 🕵️ **[15. Supervisión y Auditoría](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/15_supervision_y_auditoria/supervision_y_auditoria.md)**
  - Solicitudes de supervisión externa de Admin General con aprobación y re-autenticación de directivos, límites de tiempo y logs inmutables.
- 🎟️ **[16. Soporte y Tickets](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/16_soporte_y_tickets/soporte_y_tickets.md)**
  - Sistema de tickets de soporte técnico, códigos Base36 ofuscados y flujo de conversación por turnos (ping-pong).

---

## 🎨 Diagramas de Flujo y Casos de Uso
Los diagramas visuales y esquemas del sistema se encuentran resguardados en la carpeta:
- **[guides/diagrams/](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/diagrams)** (Por favor no modificar estos recursos gráficos directamente).
