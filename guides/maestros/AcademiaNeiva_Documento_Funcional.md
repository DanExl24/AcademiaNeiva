# 📘 AcademiaNeiva — Documento Funcional del Sistema

---

## Portada

**Sistema de Gestión Académica Institucional Multitenant — AcademiaNeiva**  
**Manual de Negocio, Dominio Educativo y Procesos Operativos (Volumen 1: Funcional)**  
**Versión:** 2.5.0  
**Fecha:** 16 de Agosto de 2026  
**Autor:** Arquitecto de Software Senior & Lead Functional Analyst  
**Estado:** Aprobado — Documento Maestro Funcional  

---

## Historial de Versiones

| Versión | Fecha | Autor | Cambios y Descripciones |
|---|---|---|---|
| 1.0.0 | 2026-01-15 | Equipo de Análisis | Documentación inicial de procesos de matrícula y estructura escolar. |
| 1.5.0 | 2026-04-10 | Equipo de Análisis | Incorporación de la guía del dominio del Catálogo DBA del MEN y reglamentación preescolar. |
| 2.0.0 | 2026-07-21 | Arquitecto Senior | Consolidación y enriquecimiento de la Base de Conocimiento Funcional en 16 módulos con trazabilidad a Historias de Usuario e Indicadores de Negocio. |
| 2.1.0 | 2026-08-04 | Equipo de Análisis | Inclusión de Reglas de Negocio de Asistencia (Hora Tarde y ZT Bogotá), Regla de Turnos en Soporte (Ping-Pong) y Exclusión Operativa de Periodos Pendientes con excepción en Competencias DBA. |
| 2.5.0 | 2026-08-16 | Senior Functional Analyst | Actualización integral a 21 módulos funcionales (incorporando Módulo 20: Seguimiento Académico por Directivo y Módulo 21: Flujo de Correos Electrónicos y Verificaciones OTP). Incorporación de validación previa de correos con OTP, captura de datos de contacto telefónico, trazabilidad de traslados, filtrado de año lectivo en supervisión y reglas de integridad en perfiles. |

---

## Tabla de Contenido

- [1. Introducción](#1-introducción)
- [2. AcademiaNeiva: Propuesta de Valor y Negocio](#2-academianeiva-propuesta-de-valor-y-negocio)
- [3. Conocimiento del Dominio Educativo](#3-conocimiento-del-dominio-educativo)
- [4. Módulos del Sistema (21 Módulos Funcionales)](#4-módulos-del-sistema-21-módulos-funcionales)
- [5. Reglas de Negocio Globales](#5-reglas-de-negocio-globales)
- [6. Flujos Completos de Operación Escolar](#6-flujos-completos-de-operación-escolar)
- [7. Glosario Funcional y Referencias](#7-glosario-funcional-y-referencias)

---

## 1. Introducción

### Objetivo
Este documento constituye el **Manual Funcional y de Negocio Maestro** de **AcademiaNeiva**. Su objetivo es brindar a analistas funcionales, coordinadores académicos, rectores, auditores y nuevos miembros del equipo una comprensión exhaustiva de **qué es el sistema, qué problemas resuelve, por qué fue diseñado con estas reglas y cómo operan los procesos del dominio educativo colombiano** sin necesidad de consultar al autor original de la plataforma.

### Alcance
Abarca el ciclo de vida operativo completo de las instituciones educativas inscritas:
1. Admisión pública, validación previa de identidad y correo con OTP, y formalización de matrícula.
2. Gestión de la planta docente, cargas horarias y estructuración jerárquica de grados y grupos.
3. Planeación curricular alineada con los Derechos Básicos de Aprendizaje (DBA) y sincronización entre cursos paralelos.
4. Registro continuo de notas, criterios ponderados, observador del alumno y control diario de asistencia con límites de seguridad.
5. Consolidación de periodos, seguimiento acumulativo y decisiones de promoción conforme al Decreto 1290 de 2009.
6. Emisión e impresión oficial de boletines de calificaciones en PDF.
7. Gestión integral de traslados intercolegiados de estudiantes y usuarios.
8. Acompañamiento pedagógico directo mediante el modo de seguimiento de usuarios para directivos.
9. Mesa de ayuda y soporte técnico con código Base36 ofuscado y escalamiento institucional.
10. Auditoría inmutable de supervisiones extraordinarias del Administrador General con filtro de año lectivo.

### Público Objetivo
- **Directivos y Administradores Educativos**: Para conocer las capacidades, controles y reglas de gobierno escolar que ofrece la plataforma.
- **Analistas Funcionales y Product Owners**: Para verificar la alineación entre las reglas del negocio educativo y los casos de uso implementados.
- **Nuevos Desarrolladores y Testers (QA)**: Para comprender el modelo del dominio escolar colombiano antes de inspeccionar el código técnico.

---

## 2. AcademiaNeiva: Propuesta de Valor y Negocio

### ¿Qué problema resuelve?
Tradicionalmente, las instituciones educativas operan con herramientas fragmentadas (hojas de cálculo aisladas, planillas en papel o softwares locales desconectados). Esto genera múltiples ineficiencias:
1. **Pérdida de trazabilidad**: Falta de auditoría sobre quién modificó una calificación o cuándo se justificó una falta.
2. **Duplicidad de esfuerzos en cursos paralelos**: Profesores del mismo grado (ej. 1-A y 1-B) teniendo que transcribir manualmente los mismos planes de estudio.
3. **Complejidad en la rendición de cuentas al MEN**: Dificultad para demostrar que los contenidos impartidos en el aula cumplen con los Derechos Básicos de Aprendizaje (DBA).
4. **Falta de comunicación con Acudientes**: Padres desinformados sobre fallas o notas hasta el final del periodo.
5. **Vulnerabilidades en la inscripción**: Inserción de correos falsos o desactualizados durante la inscripción pública.

### ¿Por qué fue construido?
**AcademiaNeiva** fue concebido como un ecosistema en la nube bajo modelo **Multi-Tenant (Multi-Colegio)** que unifica la administración académica, la evaluación pedagógica y la comunicación institucional en una sola plataforma segura, garantizando la inmutabilidad de los registros históricos una vez cerrado el periodo escolar.

### ¿Quiénes utilizan el sistema?

```
                               ┌──────────────────────────┐
                               │   ADMINISTRADOR GENERAL  │ (Gobierno Global & Auditoría)
                               └────────────┬─────────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │       DIRECTIVO       │ (Rectoría & Coordinaciones)
                                └───────────┬───────────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         ▼                                  ▼                                  ▼
┌─────────────────┐                ┌─────────────────┐                ┌─────────────────┐
│     DOCENTE     │                │   ESTUDIANTE    │                │ PADRE DE FAMILIA│
└─────────────────┘                └─────────────────┘                └─────────────────┘
```

1. **Administrador General**: Gestiona colegios, otorga licencias, mantiene el catálogo nacional de DBA, atiende soporte técnico escalado y realiza supervisiones extraordinarias previa autorización.
2. **Directivo (Rector / Coordinador)**: Administra la estructura escolar del colegio, vincula docentes, oficializa matrículas, inspecciona paneles de usuarios en modo seguimiento pedagógico, cierra periodos y autoriza la expedición de boletines.
3. **Docente**: Diseña la planeación curricular (competencias y evidencias), registra actividades evaluativas, toma asistencia diaria y escribe observaciones formativas sobre sus alumnos.
4. **Estudiante**: Ingresa a su portal para revisar sus tareas, calificaciones por actividad, fallas acumuladas y boletines oficiales de periodos pasados.
5. **Padre de Familia / Acudiente**: Monitorea el progreso académico, convivencial, asistencia y estado de matrícula de todos sus hijos matriculados desde un único usuario.

---

## 3. Conocimiento del Dominio Educativo

Para interpretar correctamente el funcionamiento del sistema, es indispensable dominar los siguientes 18 conceptos del ámbito escolar colombiano:

1. **Colegio (Inquilino / Tenant)**: Establecimiento educativo autónomo que posee su propia planta de estudiantes, docentes, calendarios y branding visual independiente.
2. **Año Lectivo**: Periodo de un año calendario (ej. 2026) bajo el cual se rige la matrícula escolar y la promoción de los estudiantes. Posee estados de vigencia (`ABIERTO`, `CERRADO`).
3. **Periodo Académico (Trimestre / Semestre)**: Subdivisión temporal del año lectivo (típicamente 3 o 4 periodos). Posee un porcentaje de peso sobre la nota final del año y estados de control (`PENDIENTE`, `ABIERTO`, `CERRADO`).
4. **Nivel Escolar**: Clasificación del sistema educativo colombiano: Preescolar, Primaria, Secundaria y Media.
5. **Tipo de Grado**: Nivel cuantitativo de enseñanza (ej. Transición, Primero, Segundo... Once).
6. **Grupo Escolar (Salón / Curso)**: La unidad física donde se matricularán los alumnos (ej. Primero A, Primero B). Posee un límite estricto de cupos máximos.
7. **Cursos Paralelos (Peer Groups)**: Grupos que pertenecen al mismo tipo de grado dentro del mismo colegio en el mismo año lectivo (ej. 1-A y 1-B son cursos paralelos).
8. **Competencia Curricular**: Meta de aprendizaje o capacidad que el estudiante debe desarrollar en una materia durante un periodo académico.
9. **Evidencia de Aprendizaje**: Entregable, producto o manifestación concreta que demuestra el logro de una competencia.
10. **DBA (Derechos Básicos de Aprendizaje)**: Conjunto de aprendizajes estructurados publicados por el Ministerio de Educación Nacional (MEN) de Colombia para cada grado y área del conocimiento.
11. **Dimensiones de Preescolar**: En el grado Transición no existen asignaturas académicas tradicionales; el desarrollo se evalúa a través de 7 Dimensiones (Comunicativa, Cognitiva, Corporal, Socioafectiva, Estética, Ética y Valores).
12. **Actividad Evaluativa**: Tarea, examen, taller o exposición creada por el docente para calificar una evidencia en el aula.
13. **Criterio de Evaluación**: Sub-desglose porcentual dentro de una actividad evaluativa (ej. Presentación 40% y Contenido 60%).
14. **Escala de Valoración**: Rango cualitativo oficial asignado a la nota numérica del estudiante (Bajo, Básico, Alto, Superior).
15. **Boletín de Calificaciones**: Informe oficial impreso en PDF que consolida las notas, fallas de asistencia, desempeño en la escala y observaciones de un estudiante en un periodo cerrado.
16. **Supervisión Externa**: Proceso mediante el cual el Administrador General asume temporalmente la identidad de la Rectoría de un colegio (bajo previa aprobación con contraseña del Rector) para realizar auditorías o ajustes de emergencia.
17. **Seguimiento Pedagógico Directivo (Monitoreo Espejo)**: Capacidad del Rector/Coordinador de asumir la vista de un docente, estudiante o padre de su colegio en **modo solo lectura estricto**, sin alterar tokens ni sesiones activas.
18. **Verificación OTP (One-Time Password)**: Código temporal de 6 dígitos numéricos enviado por correo electrónico para garantizar la posesión real de la cuenta antes de procesar trámites sensibles (inscripción de matrícula o cambio de email).

---

## 4. Módulos del Sistema (21 Módulos Funcionales)

### 🔐 01. Autenticación y Sesiones
- **Descripción:** Punto de entrada de seguridad para los 5 roles.
- **Responsabilidad:** Autenticar usuarios con correo/código, gestionar el directorio institucional y manejar revocaciones de sesión mediante lista negra (`token_blacklist`).
- **Actor Principal:** Todos los roles.
- **Documentación Completa:** [Módulo 01 — Autenticación](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/01_autenticacion/autenticacion.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/01_autenticacion/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/01_autenticacion/reglas_negocio.md)

---

### 🏫 02. Gestión de Colegios
- **Descripción:** Administración del catálogo institucional.
- **Responsabilidad:** Registro global de colegios por el Admin General y personalización del branding visual (escudo y colores) por directivos.
- **Actor Principal:** Administrador General / Directivo.
- **Documentación Completa:** [Módulo 02 — Colegios](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/02_gestion_colegios/gestion_colegios.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/02_gestion_colegios/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/02_gestion_colegios/reglas_negocio.md)

---

### 👥 03. Usuarios y Directivos
- **Descripción:** Gobierno de personal administrativo.
- **Responsabilidad:** Registro y vinculación de Rectores y Coordinadores a colegios. Trazabilidad de cambios de credenciales exigiendo un ticket resuelto.
- **Actor Principal:** Administrador General.
- **Documentación Completa:** [Módulo 03 — Usuarios](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/03_usuarios_y_directivos/usuarios_y_directivos.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/03_usuarios_y_directivos/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/03_usuarios_y_directivos/reglas_negocio.md)

---

### 🏗️ 04. Estructura Escolar
- **Descripción:** Definición organizacional del plantel.
- **Responsabilidad:** Gestión de niveles, tipos de grado, grupos (control de cupos) y materias del catálogo institucional.
- **Actor Principal:** Directivo.
- **Documentación Completa:** [Módulo 04 — Estructura Escolar](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/04_estructura_escolar/estructura_escolar.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/04_estructura_escolar/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/04_estructura_escolar/reglas_negocio.md)

---

### 👩‍🏫 05. Docentes
- **Descripción:** Administración de la planta de profesores y asignación académica.
- **Responsabilidad:** Registro de docentes con validación de teléfono, envío de credenciales por email y vinculación de cursos en `detalle_grados`.
- **Actor Principal:** Directivo / Docente.
- **Documentación Completa:** [Módulo 05 — Docentes](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/05_docentes/docentes.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/05_docentes/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/05_docentes/reglas_negocio.md)

---

### 📋 06. Matrículas e Inscripciones
- **Descripción:** Admisiones públicas y oficialización de estudiantes.
- **Responsabilidad:** Formulario de inscripción pública, verificación OTP previa del email del acudiente, captura de teléfono, token UUID de seguimiento, validación individual de documentos adjuntos y matrículas extraordinarias.
- **Actor Principal:** Público / Directivo.
- **Documentación Completa:** [Módulo 06 — Matrículas](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/06_matriculas/matriculas.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/06_matriculas/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/06_matriculas/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/06_matriculas/casos_uso.md)

---

### 🎓 07. Estudiantes y Estados
- **Descripción:** Ciclo de vida escolar del alumno y control disciplinario.
- **Responsabilidad:** Administración de estados (`ACTIVO`, `RETIRADO`, `EXPULSADO`), suspensiones automáticas y portales de consulta para alumnos y acudientes.
- **Actor Principal:** Directivo / Estudiante / Padre.
- **Documentación Completa:** [Módulo 07 — Estudiantes](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/07_estudiantes_y_estados/estudiantes_y_estados.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/07_estudiantes_y_estados/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/07_estudiantes_y_estados/reglas_negocio.md)

---

### ⚙️ 08. Configuración Académica
- **Descripción:** Parametrización del calendario escolar.
- **Responsabilidad:** Gestión de años lectivos, periodos académicos, escalas de notas (manual/automática) y congelamiento de escrituras en periodos cerrados.
- **Actor Principal:** Directivo.
- **Documentación Completa:** [Módulo 08 — Configuración Académica](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/08_configuracion_academica/configuracion_academica.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/08_configuracion_academica/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/08_configuracion_academica/reglas_negocio.md)

---

### 🔄 09. Competencias y Sincronización
- **Descripción:** Planeación curricular y cursos paralelos.
- **Responsabilidad:** Registro de múltiples competencias por periodo y propagación en caliente a los cursos paralelos del mismo grado escolar mediante `sync_uuid`.
- **Actor Principal:** Directivo / Docente.
- **Documentación Completa:** [Módulo 09 — Competencias](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/09_competencias_y_sincronizacion/competencias_y_sincronizacion.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/09_competencias_y_sincronizacion/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/09_competencias_y_sincronizacion/reglas_negocio.md)

---

### 📚 10. Catálogo DBA y Coherencia Curricular
- **Descripción:** Alineación pedagógica con los estándares del MEN colombiano.
- **Responsabilidad:** Administración del catálogo oficial de Derechos Básicos de Aprendizaje, exclusividad 1-to-1 de evidencias, reglas de preescolar y reportes de Coherencia y Cobertura.
- **Actor Principal:** Admin General / Directivo / Docente.
- **Documentación Completa:** [Módulo 10 — Catálogo DBA](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/10_catalogo_dba/catalogo_dba.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/10_catalogo_dba/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/10_catalogo_dba/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/10_catalogo_dba/casos_uso.md)

---

### 📊 11. Calificaciones y Actividades
- **Descripción:** Evaluación continua del rendimiento estudiantil.
- **Responsabilidad:** Planilla interactiva del docente, creación de actividades y criterios ponderados, y cálculo de notas parciales.
- **Actor Principal:** Docente / Estudiante / Padre.
- **Documentación Completa:** [Módulo 11 — Calificaciones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/11_calificaciones/calificaciones.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/11_calificaciones/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/11_calificaciones/reglas_negocio.md)

---

### 📝 12. Observaciones del Estudiante
- **Descripción:** Seguimiento formativo y comportamental del observador del alumno.
- **Responsabilidad:** Registro de anotaciones (Académica, Convivencia, Disciplinaria, Otro) y concatenación obligatoria de la observación académica en boletines.
- **Actor Principal:** Docente / Directivo / Padre.
- **Documentación Completa:** [Módulo 12 — Observaciones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/12_observaciones/observaciones.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/12_observaciones/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/12_observaciones/reglas_negocio.md)

---

### 📅 13. Asistencia Escolar
- **Descripción:** Control diario de fallas y ausentismo escolar.
- **Responsabilidad:** Registro diario de asistencia con límite físico estricto de máximo 7 bloques de clase al día por estudiante.
- **Actor Principal:** Docente / Padre.
- **Documentación Completa:** [Módulo 13 — Asistencia](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/13_asistencia/asistencia.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/13_asistencia/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/13_asistencia/reglas_negocio.md)

---

### 📄 14. Cierre de Periodo y Boletines
- **Descripción:** Consolidación final del trimestre y emisión de informes oficiales.
- **Responsabilidad:** Cierre por materia del docente, cierre institucional del periodo, consolidación de promedios e impresión masiva de boletines PDF.
- **Actor Principal:** Docente / Directivo / Estudiante.
- **Documentación Completa:** [Módulo 14 — Cierre y Boletines](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/14_cierre_y_boletines/cierre_y_boletines.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/14_cierre_y_boletines/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/14_cierre_y_boletines/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/14_cierre_y_boletines/casos_uso.md)

---

### 🕵️ 15. Supervisión y Auditoría
- **Descripción:** Acceso extraordinario del Administrador General a la consola de un colegio.
- **Responsabilidad:** Solicitud con motivo, aprobación obligatoria del Rector con re-autenticación por contraseña, filtrado por año lectivo en el panel directivo, temporizadores de sesión y bitácora de auditoría inmutable.
- **Actor Principal:** Admin General / Directivo.
- **Documentación Completa:** [Módulo 15 — Supervisión](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/15_supervision_y_auditoria/supervision_y_auditoria.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/15_supervision_y_auditoria/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/15_supervision_y_auditoria/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/15_supervision_y_auditoria/casos_uso.md)

---

### 🎟️ 16. Soporte y Gestión de Tickets
- **Descripción:** Mesa de ayuda e incidencias institucionales.
- **Responsabilidad:** Apertura pública de tickets con código Base36 ofuscado, regla de turnos de respuesta (ping-pong), selector interactivo de estados (`ABIERTO`, `EN_PROCESO`, `ESCALADO`, `RESUELTO`) y escalamiento exclusivo al Administrador General.
- **Actor Principal:** Todos los roles.
- **Documentación Completa:** [Módulo 16 — Soporte y Tickets](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/16_soporte_y_tickets/soporte_y_tickets.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/16_soporte_y_tickets/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/16_soporte_y_tickets/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/16_soporte_y_tickets/casos_uso.md)

---

### 👨‍👩‍👧‍👦 17. Gestión de Padres de Familia
- **Descripción:** Consola administrativa para la gestión, auditoría y monitoreo en tiempo real de los acudientes y familias del colegio.
- **Responsabilidad:** Tarjetas métricas de control, filtros de alertas estudiantiles, visualización en drawer del acudiente e hijos asociados, identificación de doble rol (`Padre + Docente`), activación/inactivación de cuenta con revocación de sesión (`logged_out_at`) y seguimiento pedagógico en Modo Monitoreo.
- **Actor Principal:** Directivo.
- **Documentación Completa:** [Módulo 17 — Gestión de Padres de Familia](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/17_gestion_padres/gestion_padres.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/17_gestion_padres/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/17_gestion_padres/reglas_negocio.md)

---

### 🔀 18. Gestión de Traslados
- **Descripción:** Módulo administrativo y público para gestionar traslados de matrícula de estudiantes entre sedes o colegios distintos y cambio de colegio de usuarios.
- **Responsabilidad:** Creación de solicitudes de traslado, flujo de aprobación institucional (colegio origen y colegio destino), cancelación, ejecución del traslado e historial de trazabilidad de cambios.
- **Actor Principal:** Directivo, Admin General, Padre de Familia.
- **Documentación Completa:** [Módulo 18 — Gestión de Traslados](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/18_gestion_traslados/gestion_traslados.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/18_gestion_traslados/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/18_gestion_traslados/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/18_gestion_traslados/casos_uso.md)

---

### 🏅 19. Seguimiento Académico, Promoción y Reprobación Anual
- **Descripción:** Módulo para la gestión integral del estado académico de los estudiantes en cada período (individual y acumulativo hasta el período N), consolidación del resultado anual y soporte de decisiones institucionales de promoción conforme al Decreto 1290 de 2009.
- **Responsabilidad:** Seguimiento por período acumulado (P1..PN), promedio ponderado por asignatura cotejado con la escala institucional, consolidación anual (Promovido, No Promovido, Pendiente), advertencias informativas en el proceso de matrícula e historial de decisiones tomadas por directivos.
- **Actor Principal:** Directivo.
- **Documentación Completa:** [Módulo 19 — Seguimiento y Promoción Académica](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/19_seguimiento_y_promocion_academica/seguimiento_y_promocion_academica.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/19_seguimiento_y_promocion_academica/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/19_seguimiento_y_promocion_academica/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/19_seguimiento_y_promocion_academica/casos_uso.md)

---

### 👁️ 20. Seguimiento Académico a Usuarios por Directivo
- **Descripción:** Acompañamiento pedagógico y monitoreo de usuarios por parte de la Rectoría y Coordinación del colegio.
- **Responsabilidad:** Conmutación temporal de la interfaz activa (`activeRole`), resolución ternaria de ID (`monitoringUser.id`), modo de solo lectura estricto (inhabilitación de formularios de escritura, notas o asistencias) y bloqueo de seguridad en la ruta de traslados (`/dashboard/gestion-traslados`).
- **Actor Principal:** Directivo.
- **Documentación Completa:** [Módulo 20 — Seguimiento Directivo](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/20_seguimiento_academico_directivo/seguimiento_academico_directivo.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/20_seguimiento_academico_directivo/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/20_seguimiento_academico_directivo/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/20_seguimiento_academico_directivo/casos_uso.md)

---

### 📧 21. Flujo de Correos Electrónicos, Notificaciones y Verificaciones OTP
- **Descripción:** Módulo central de entrega de correos transaccionales, notificaciones automáticas y validación de seguridad mediante códigos OTP de un solo uso.
- **Responsabilidad:** Verificación previa de email antes de procesar una matrícula nueva, verificación OTP de 6 dígitos con expiración de 15 minutos para cambios de correo en perfil, envío de credenciales a docentes y restablecimiento de contraseñas.
- **Actor Principal:** Todos los roles / Público.
- **Documentación Completa:** [Módulo 21 — Flujo de Correos y OTP](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/21_flujo_correos_y_verificaciones/flujo_correos_y_verificaciones.md) | [Historias de Usuario](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/21_flujo_correos_y_verificaciones/historias_usuario.md) | [Reglas de Negocio](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/21_flujo_correos_y_verificaciones/reglas_negocio.md) | [Casos de Uso](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/21_flujo_correos_y_verificaciones/casos_uso.md)

---

## 5. Reglas de Negocio Globales

1. **Aislamiento Multi-Tenant Absoluto**: Toda consulta o modificación sobre la base de datos debe estar aislada por el campo `id_colegio`. Un colegio jamás puede acceder a la información de otro plantel.
2. **Inmutabilidad por Periodo CERRADO**: Una vez que un periodo académico ha sido institucionalmente cerrado por el Rector, se congela de forma inmutable la edición de calificaciones, observaciones de observador e inasistencias.
3. **Regla de Límite Diario de Asistencia**: Se restringe a un máximo de 7 bloques de clase registrados por estudiante al día para evitar inconsistencias de aforo escolar.
4. **Validación Previa OTP en Trámites Sensibles**: Ninguna matrícula pública o actualización de correo electrónico puede completarse sin la verificación exitosa de un código OTP de 6 dígitos numéricos emitido al buzón del usuario.
5. **Token de Seguimiento UUID Público**: Las inscripciones y subsanaciones públicas operan mediante un token UUID de alta seguridad sin exigir credenciales de inicio de sesión.
6. **Modo Solo Lectura en Seguimiento Directivo**: Un directivo en modo seguimiento jamás puede realizar mutaciones de datos sobre el usuario supervisado ni acceder al módulo de gestión de traslados.
7. **Regla de Turnos en Soporte (Ping-Pong)**: En los tickets de soporte, un mismo usuario no puede enviar notas de observación consecutivas sin esperar la respuesta del destinatario.
8. **Inmutabilidad de Auditorías Legales**: Los registros de acciones de supervisión y tickets resueltos no pueden ser eliminados mediante sentencias `DELETE`.

---

## 6. Flujos Completos de Operación Escolar

### Flujo 1: Ciclo Operativo Escolar Completo

```mermaid
sequenceDiagram
    autonumber
    actor Aspirante as Aspirante / Padre
    actor Directivo
    actor Docente
    actor Estudiante
    participant Sistema
    
    Aspirante->>Sistema: 1. Valida correo electrónico con código OTP
    Aspirante->>Sistema: 2. Diligencia Inscripción Pública (adjunta documentos y teléfono)
    Directivo->>Sistema: 3. Revisa documentos, asigna grupo y oficializa matrícula
    Sistema->>Sistema: 4. Crea automáticamente registro de Estudiante, Padre y Usuario
    
    Directivo->>Sistema: 5. Realiza Asignación Académica (detalle_grados)
    Docente->>Sistema: 6. Registra Competencias y vincula Evidencias DBA
    Sistema->>Sistema: 7. Propaga en caliente la planeación a Cursos Paralelos (sync_uuid)
    
    Docente->>Sistema: 8. Crea actividades evaluativas y califica planilla
    Docente->>Sistema: 9. Toma asistencia diaria y registra observaciones
    
    Docente->>Sistema: 10. Consolida y ejecuta Cierre de Materia
    Directivo->>Sistema: 11. Ejecuta Cierre Institucional del Periodo
    Estudiante->>Sistema: 12. Descarga Boletín Oficial PDF desde su portal
```

---

### Flujo 2: Gestión e Escalamiento de Incidencias Técnicas (Tickets)

```mermaid
sequenceDiagram
    autonumber
    actor Remitente
    actor Directivo
    actor Admin as Administrador General
    participant Sistema
    
    Remitente->>Sistema: 1. Abre ticket de soporte (Genera código TKT-XXXX Base36)
    Sistema->>Sistema: 2. Registra ticket en estado 'ABIERTO' asignado al colegio
    
    Directivo->>Sistema: 3. Revisa ticket en bandeja y agrega nota
    Sistema->>Sistema: 4. Transiciona estado a 'EN_PROCESO'
    
    Directivo->>Sistema: 5. Escala ticket por problema técnico complejo
    Sistema->>Sistema: 6. Registra timestamp en 'fecha_escalado' y bloquea al Directivo
    
    Admin->>Sistema: 7. Revisa ticket escalado en su bandeja global
    Admin->>Sistema: 8. Resuelve la falla y cambia estado a 'RESUELTO'
    Sistema->>Sistema: 9. Marca ticket como Inmutable (Solo Lectura)
```

---

### Flujo 3: Acompañamiento Pedagógico (Seguimiento Directivo)

```mermaid
sequenceDiagram
    autonumber
    actor Directivo
    participant Consola as Consola Directiva (Vue)
    participant AuthStore as Pinia Auth Store
    participant Router as Vue Router
    participant Backend as Express API
    
    Directivo->>Consola: 1. Clic en "Supervisar Panel" de Docente/Estudiante/Padre
    Consola->>AuthStore: 2. Activa modo seguimiento (conserva token del directivo)
    AuthStore->>Router: 3. Conmuta activeRole al rol del supervisado y redirige a /dashboard
    Router->>Directivo: 4. Renderiza vista con Banner Ámbar y Topbar del supervisado
    Directivo->>Backend: 5. Consulta asistencias, notas o materias (Solo Lectura)
    Note over Directivo, Router: 6. Si intenta ir a /gestion-traslados, Router bloquea la acción
    Directivo->>Consola: 7. Clic en "Salir del Seguimiento"
    Consola->>AuthStore: 8. Restablece activeRole = 'directivo' y retorna al panel
```

---

## 7. Glosario Funcional y Referencias

- **DBA**: Derechos Básicos de Aprendizaje del Ministerio de Educación Nacional de Colombia.
- **Peer Group**: Conjunto de secciones paralelas (1-A, 1-B) pertenecientes al mismo tipo de grado.
- **Soft Delete**: Marca de borrado lógico (`eliminada = true`) que preserva la integridad de notas históricas.
- **JTI**: Identificador único de token JWT usado para invalidación individual en lista negra.
- **Base36**: Algoritmo de codificación alfanumérico usado para ofuscar IDs de tickets públicos.
- **OTP**: One-Time Password de 6 dígitos numéricos utilizado para verificar la identidad del buzón de correo.
- **Modo Seguimiento Espejo**: Mecanismo que permite al directivo emular la interfaz de un usuario sin alterar credenciales.

---

### Matriz de Enlaces a Módulos Funcionales
- 🗺️ **[Mapa General de Módulos (guides/modules/mapa_documentacion.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/mapa_documentacion.md)**
- 📄 **[Documentación Técnica Integral (guides/AcademiaNeiva_Documentacion_Tecnica_Integral.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documentacion_Tecnica_Integral.md)**
- 🌐 **[Reglas Generales y Transversales (guides/reglas_negocio_generales.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/reglas_negocio_generales.md)**
