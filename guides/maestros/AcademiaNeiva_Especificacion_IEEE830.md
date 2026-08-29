# Especificación de Requisitos de Software (SRS) — IEEE Std 830-1998

**Proyecto:** AcademiaNeiva — Sistema de Gestión Académica Institucional Multitenant  
**Revisión:** 2.5.0  
**Fecha:** 16 de Agosto de 2026  
**Estado:** Documento Oficial de Especificación de Requisitos conforme a IEEE Std 830-1998  

---

# Ficha del Documento

| Campo | Detalle de Registro |
|---|---|
| **Fecha de Validación** | 16 de Agosto de 2026 |
| **Revisión** | 2.5.0 |
| **Autor(es)** | Arquitecto de Software Senior & Technical Lead |
| **Verificado por** | Departamento de Aseguramiento de Calidad (QA) |
| **Validado por Cliente** | Representante Institucional |
| **Validado por Suministradora** | Equipo de Ingeniería y Arquitectura de AcademiaNeiva |

---

# 1. Introducción

> **Objetivo de esta sección:**  
> Proporcionar una vista general completa del documento SRS IEEE Std 830-1998, delimitando el propósito, el alcance del sistema, las definiciones del dominio, las fuentes de información utilizadas y la organización del documento.
>
> **Fuentes de información utilizadas:**  
> - [guides/AcademiaNeiva_Documento_Funcional.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Funcional.md)  
> - [guides/AcademiaNeiva_Documento_Tecnico.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Tecnico.md)  
> - [guides/AcademiaNeiva_Documentacion_Tecnica_Integral.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documentacion_Tecnica_Integral.md)  
> - [guides/modules/mapa_documentacion.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/mapa_documentacion.md)  

## 1.1 Propósito
El propósito de este documento es especificar los requisitos funcionales y no funcionales del sistema **AcademiaNeiva** de manera rigurosa conforme al estándar IEEE Std 830-1998. Está dirigido a desarrolladores de software, ingenieros de pruebas, coordinadores académicos, rectores y auditores externos que requieran validar el cumplimiento contractual y técnico del software.

## 1.2 Alcance
**AcademiaNeiva** es un software de gestión académica en la nube bajo modelo Multi-Tenant (Multi-Colegio). El sistema abarca los siguientes 21 procesos institucionales:
1. Autenticación unificada, roles dinámicos y revocación de tokens mediante lista negra.
2. Gestión multi-inquilino de colegios con personalización de identidad visual.
3. Gobierno de directivos, asignación de sedes y trazabilidad de credenciales por ticket.
4. Parametrización de estructura escolar (niveles, grados, salones con cupos y asignaturas).
5. Gestión de docentes, captura de datos telefónicos y asignación académica (`detalle_grados`).
6. Matrícula e inscripción pública con verificación previa de correo por OTP, autorización de matrículas extraordinarias (con bypass de calendario, trazabilidad de tickets de soporte y drawer enriquecido), reingresos con matriz documental y validación documental.
7. Ciclo de vida del estudiante (`ACTIVO`, `RETIRADO`, `EXPULSADO`) y suspensiones automáticas.
8. Configuración del calendario escolar, escalas de notas y congelamiento de periodos cerrados.
9. Planeación curricular por competencias con sincronización en caliente (`sync_uuid`) para cursos paralelos.
10. Catálogo nacional de Derechos Básicos de Aprendizaje (DBA) y matriz de coherencia pedagógica.
11. Registro de calificaciones continuas con actividades y criterios ponderados.
12. Observador del estudiante con categorías formativas y obligatoriedad académica para boletines.
13. Control diario de asistencia con restricción física estricta de 7 bloques de clase al día.
14. Cierre desacoplado por asignatura, consolidación institucional y emisión de boletines PDF.
15. Supervisión extraordinaria del Admin General con re-autenticación del Rector, filtro de año lectivo y bitácora JSONB.
16. Mesa de ayuda y soporte técnico con código Base36 ofuscado, regla de turnos ping-pong y escalamiento.
17. Consola directiva de acudientes con métricas de riesgo, drawer familiar y modo monitoreo.
18. Gestión y trazabilidad de traslados intercolegiados de estudiantes y usuarios.
19. Seguimiento acumulativo de desempeño y toma de decisiones de promoción según Decreto 1290 de 2009.
20. Acompañamiento pedagógico directo a usuarios por parte de directivos en modo solo lectura estricto.
21. Servicio centralizado de entrega de correos transaccionales y verificación de códigos OTP de un solo uso.

## 1.3 Personal Involucrado

| Nombre | Rol | Categoría Profesional | Responsabilidades |
|---|---|---|---|
| Equipo de Arquitectura | Arquitecto de Software | Senior | Diseño de infraestructura Multi-Tenant, seguridad JWT, Kysely y triggers PostgreSQL. |
| Equipo de Desarrollo | Ingenieros Fullstack | Mid/Senior | Construcción de APIs Express con Zod, vistas Vue 3 SPA y servicios asíncronos. |
| Equipo de Análisis | Analistas Funcionales | Senior | Levantamiento de reglas de negocio pedagógicas colombianas y catálogo DBA. |
| Equipo de Calidad (QA) | Ingenieros de Pruebas | Mid | Verificación de inmutabilidad en periodos cerrados y pruebas de estrés. |

## 1.4 Definiciones, Acrónimos y Abreviaturas
- **DBA**: Derechos Básicos de Aprendizaje. Aprendizajes clave del Ministerio de Educación Nacional de Colombia.
- **MEN**: Ministerio de Educación Nacional de Colombia.
- **JTI**: JWT ID. Identificador único de un token de autenticación para su invalidación en lista negra.
- **Kysely**: Constructor de consultas SQL fuertemente tipado para TypeScript con validación estática de esquemas.
- **Zod**: Librería de validación y sanitización declarativa de esquemas y tipos en tiempo de ejecución.
- **OTP**: One-Time Password. Código numérico de 6 dígitos con expiración temporal emitido por correo electrónico.
- **Multi-Tenant**: Arquitectura de software donde múltiples colegios comparten la misma instancia aislados por `id_colegio`.
- **Peer Groups (Cursos Paralelos)**: Grupos que pertenecen al mismo tipo de grado dentro del mismo colegio en el mismo año lectivo (ej. 1-A y 1-B).
- **Modo Seguimiento Espejo**: Mecanismo que permite al directivo inspeccionar la interfaz de un usuario sin alterar tokens ni sesiones.
- **SRS**: Software Requirements Specification (Especificación de Requisitos de Software).
- **UUID**: Universally Unique Identifier. Identificador único de 128 bits usado para sincronización de competencias y seguimiento público.

## 1.5 Referencias

| Referencia | Título del Documento | Ruta | Autor |
|---|---|---|---|
| REF-001 | Manual Funcional Maestro | [AcademiaNeiva_Documento_Funcional.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Funcional.md) | Analista Funcional |
| REF-002 | Manual Técnico Maestro | [AcademiaNeiva_Documento_Tecnico.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Tecnico.md) | Arquitecto Senior |
| REF-003 | Documentación Técnica Integral | [AcademiaNeiva_Documentacion_Tecnica_Integral.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documentacion_Tecnica_Integral.md) | Technical Lead |
| REF-004 | Mapa General de Módulos | [guides/modules/mapa_documentacion.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/mapa_documentacion.md) | Equipo de Análisis |
| REF-005 | Esquema de Base de Datos | [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) | Administrador BD |

## 1.6 Resumen / Vista General
Este documento está estructurado en tres secciones principales: la Sección 1 describe la introducción y contexto; la Sección 2 presenta la descripción general del producto, características de usuarios y restricciones; y la Sección 3 detalla exhaustivamente cada requisito funcional catalogado por módulo (21 módulos), los requisitos no funcionales de rendimiento y seguridad, y las reglas globales del negocio.

---

# 2. Descripción General

> **Objetivo de esta sección:**  
> Ofrecer una visión de alto nivel de las funciones principales del software, su arquitectura, contexto del producto, perfiles de usuario, restricciones operativas y suposiciones técnicas.
>
> **Fuentes de información utilizadas:**  
> - [guides/AcademiaNeiva_Documento_Funcional.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Funcional.md#2-academianeiva-propuesta-de-valor-y-negocio)  
> - [guides/AcademiaNeiva_Documento_Tecnico.md](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Tecnico.md#2-arquitectura-de-software)  

## 2.1 Perspectiva del Producto
**AcademiaNeiva** es un sistema autónomo e independiente operado bajo una arquitectura desacoplada Client-Server. La interfaz de usuario opera como una Single Page Application (SPA) en el navegador cliente (Vue 3 + Pinia + TypeScript), interactuando de forma exclusiva con una API RESTful mediante HTTPS y JSON. La lógica backend valida esquemas con **Zod**, construye consultas tipadas con **Kysely** y persiste datos en **PostgreSQL** respaldado por funciones PL/pgSQL que imponen reglas de inmutabilidad directamente en la capa de datos.

## 2.2 Funcionalidades del Producto (21 Módulos)
1. **Autenticación (AUT)**: Emisión de JWT, revocación de tokens en `token_blacklist` y directorio de usuarios.
2. **Gestión de Colegios (COL)**: Catálogo de instituciones y personalización de marca (escudo/colores).
3. **Usuarios y Directivos (DIR)**: Administración de personal directivo y trazabilidad de credenciales.
4. **Estructura Escolar (EST)**: Gestión de niveles, grados, grupos (control de cupos) y materias.
5. **Docentes (DOC)**: Carga académica, validación de teléfono y asignaciones docentes en `detalle_grados`.
6. **Matrículas (MAT)**: Formulario público, verificación previa OTP de email, tokens UUID, autorización y gestión de matrículas extraordinarias con motivo/observaciones, reingresos y validación documental con visor protegido.
7. **Estudiantes y Estados (STU)**: Control de estados (`ACTIVO`, `RETIRADO`, `EXPULSADO`) y suspensiones automáticas.
8. **Configuración Académica (CONF)**: Periodos académicos, escalas de notas y bloqueos por cierre.
9. **Competencias (COMP)**: Planeación curricular y propagación a cursos paralelos vía `sync_uuid`.
10. **Catálogo DBA (DBA)**: Alineación con el MEN, exclusividad 1-to-1 y reportes de coherencia.
11. **Calificaciones (CAL)**: Planilla docente interactiva, actividades y criterios de evaluación ponderados.
12. **Observaciones (OBS)**: Registro comportamental y observaciones académicas obligatorias para boletines.
13. **Asistencia (ASI)**: Toma diaria de fallas con límite estricto de 7 bloques de clase al día.
14. **Cierre y Boletines (BOL)**: Cierre por materia, consolidación institucional e impresión de boletines PDF.
15. **Supervisión y Auditoría (SUP)**: Acceso del Admin General con re-autenticación del Rector, filtro de año lectivo y bitácora JSONB.
16. **Soporte y Tickets (SOP)**: Mesa de ayuda pública con código Base36, selectores consistentes y regla ping-pong.
17. **Gestión de Padres de Familia (PAD)**: Consola directiva con métricas, alertas familiares y modo monitoreo.
18. **Gestión de Traslados (TRS)**: Solicitudes públicas y directivas de traslado entre colegios con trazabilidad de estados.
19. **Seguimiento y Promoción (PRO)**: Seguimiento acumulativo y registro de decisiones de promoción anual.
20. **Seguimiento Directivo (SEG)**: Acompañamiento pedagógico en modo solo lectura estricto a docentes, estudiantes y padres.
21. **Flujo de Correos y OTP (COR)**: Entrega transaccional SMTP, verificación de emails con OTP y restablecimiento de claves.

## 2.3 Características de los Usuarios

| Rol de Usuario | Nivel Técnico | Descripción de Permisos |
|---|---|---|
| **Administrador General** | Alto | Acceso global del sistema, gestión de colegios, catálogo DBA, supervisión externa y resolución de tickets. |
| **Directivo (Rector / Coordinador)** | Medio | Administración completa de su colegio, asignaciones, cierres de periodos, acompañamiento pedagógico y matrículas. |
| **Docente** | Medio/Básico | Registro de competencias, notas, observaciones y tomador de asistencias en asignaturas asociadas. |
| **Estudiante** | Básico | Consulta de notas definitivas, desglose de actividades, fallas y descarga de boletines en su portal personal. |
| **Padre de Familia** | Básico | Consulta consolidada del desempeño y comportamiento de múltiples hijos vinculados. |

## 2.4 Restricciones
- **Restricción de Multi-Tenancy**: Toda consulta SQL/Kysely debe filtrar estrictamente por `id_colegio`.
- **Restricción de Inmutabilidad SQL**: Sentencias `UPDATE` o `DELETE` sobre registros en periodos cerrados son abortadas por el trigger `fn_bloquear_periodo_cerrado`.
- **Restricción de Asistencia**: Ningún estudiante puede tener más de 7 bloques de clase registrados en la misma fecha.
- **Restricción de Tamaño de Archivos**: Los archivos adjuntos de matrícula e inscripciones no pueden superar el tamaño máximo de 5MB por archivo.
- **Restricción de Validación Zod**: Toda petición mutativa debe cumplir los esquemas de validación Zod en `backend/src/dtos/`.

## 2.5 Suposiciones y Dependencias
- Se asume que el servidor cuenta con Node.js v18+ y PostgreSQL 14+ instalados.
- Las comunicaciones entre cliente y servidor requieren conectividad HTTPS.
- El envío de notificaciones y verificación OTP depende de la disponibilidad del servidor SMTP configurado.

---

# 3. Requisitos Específicos

> **Objetivo de esta sección:**  
> Especificar en detalle cada uno de los requisitos funcionales, de interfaz, no funcionales y reglas globales del sistema AcademiaNeiva para los 21 módulos.

## 3.1 Requisitos Comunes de las Interfaces

### 3.1.1 Interfaces de Usuario
- La interfaz debe ser una Single Page Application (SPA) receptiva construida en Vue 3 con Vanilla CSS.
- El encabezado debe adaptar el escudo y la paleta de colores corporativos del colegio del usuario autenticado.
- En modo supervisión activa, la interfaz debe desplegar un banner superior de color rojo persistente con el nombre del colegio y temporizador regresivo.
- En modo seguimiento pedagógico directivo, la interfaz debe desplegar un banner ámbar superior y habilitar el modo solo lectura.

### 3.1.2 Interfaces de Hardware
- No se exigen requerimientos de hardware especiales; el cliente opera desde cualquier navegador web moderno (Chrome, Firefox, Edge, Safari) en computadores o dispositivos móviles.

### 3.1.3 Interfaces de Software
- **Base de Datos**: PostgreSQL 14+ gestionado mediante Kysely Query Builder (`db.types.ts`).
- **Generador de Reportes**: Motor PDFKit / HTML2PDF para la generación de boletines en backend.

### 3.1.4 Interfaces de Comunicación
- Peticiones HTTPS bajo formato REST API enviando y recibiendo objetos en formato JSON (`Content-Type: application/json`).

---

## 3.2 Requisitos Funcionales Catalogados por Módulo

### 3.2.1 Módulo 01: Autenticación y Sesiones
- **RF-AUT-001 (HU-AUT-001)**: El sistema debe autenticar usuarios mediante correo y contraseña, emitiendo un token JWT firmado con el atributo `jti` único.
- **RF-AUT-002 (HU-AUT-002)**: El sistema debe consultar la tabla `token_blacklist` en cada petición protegida para denegar tokens revocados.
- **RF-AUT-003 (HU-AUT-003)**: El sistema debe invalidar todas las sesiones activas de un usuario actualizando la columna `logged_out_at`.

### 3.2.2 Módulo 02: Gestión de Colegios
- **RF-COL-001 (HU-COL-001)**: El Administrador General debe poder registrar nuevos colegios configurando su nombre, NIT y dominio.
- **RF-COL-002 (HU-COL-002)**: El Directivo debe poder personalizar el escudo y los colores corporativos de su institución.

### 3.2.3 Módulo 03: Usuarios y Directivos
- **RF-DIR-001 (HU-DIR-001)**: El Administrador General debe poder vincular y desvincular Directivos (Rectores / Coordinadores) a colegios.
- **RF-DIR-002 (HU-DIR-002)**: La modificación de credenciales de otros usuarios se gestiona de forma centralizada en el módulo de usuarios administrativos.

### 3.2.4 Módulo 04: Estructura Escolar
- **RF-EST-001 (HU-EST-001)**: El Directivo debe definir la estructura organizativa creando Niveles, Grados y Grupos.
- **RF-EST-002 (HU-EST-002)**: El sistema debe controlar el límite de cupos máximos de un grupo impidiendo inscripciones sobre-cupo.

### 3.2.5 Módulo 05: Docentes
- **RF-DOC-001 (HU-DOC-001)**: El Directivo debe dar de alta a docentes capturando y validando el número de teléfono con esquema Zod (`7-20 dígitos`) y asignar su carga académica en `detalle_grados`.
- **RF-DOC-002 (HU-DOC-002)**: El sistema debe enviar un correo de bienvenida automático al docente con sus credenciales iniciales.

### 3.2.6 Módulo 06: Matrículas e Inscripciones
- **RF-MAT-001 (HU-MAT-001)**: El sistema debe requerir la verificación previa del correo del acudiente mediante código OTP de 6 dígitos antes de procesar el formulario público de inscripción ordinaria.
- **RF-MAT-002 (HU-MAT-002)**: La inscripción captura y valida obligatoriamente los teléfonos de contacto del estudiante y acudiente.
- **RF-MAT-003 (HU-MAT-003)**: El aspirante debe consultar su trámite y subsanar archivos sin iniciar sesión mediante un token UUID de seguimiento.
- **RF-MAT-004 (HU-MAT-006)**: Al oficializar la matrícula, el sistema creará en una sola transacción atómica Kysely con bloqueo `FOR UPDATE` la ficha de `estudiante` activa, el registro de acudiente, la cuenta de `usuario` y el vínculo de parentesco.
- **RF-MAT-005 (HU-MAT-007)**: El Directivo puede autorizar matrículas extraordinarias (vía Mesa de Soporte o Bandeja de Matrículas), autocompletando acudientes existentes, registrando motivo y observaciones institucionales, asociando un ticket en `tickets_soporte` (`EN_PROCESO` con notas JSON), emitiendo un `token_seguimiento` UUID para radicación extemporánea y despachando el correo al acudiente hacia `/matricula?token=:token`.
- **RF-MAT-006 (HU-MAT-007)**: El formulario público de matrícula (`EnrollmentView.vue`) debe procesar tokens de matrícula extraordinaria bloqueando el colegio autorizado, precargando el correo como verificado (omitiendo OTP de 6 dígitos), aplicando bypass a las fechas de cierre del calendario y actualizando in-place el registro existente en `matricula` y sus documentos binarios en `documento_matriculas` sin duplicar filas. El Drawer directivo expone la tarjeta con motivo/observaciones y un badge dinámico de estado documental (`⏳ Pendiente por cargue` con copiado de enlace vs `✅ Documentos cargados`).
- **RF-MAT-007 (HU-MAT-008)**: El sistema debe gestionar el reingreso de estudiantes en estado `RETIRADO` mediante matriz documental inteligente (`VIGENTE` vs `RENOVAR`), reservando cupos en tiempo real.

### 3.2.7 Módulo 07: Estudiantes y Estados
- **RF-STU-001 (HU-ESTU-001)**: El Directivo debe consultar la ficha consolidada de rendimiento y asistencias del estudiante.
- **RF-STU-002 (HU-ESTU-003)**: Al registrar una sanción activa en `sancion`, el trigger `fn_sync_estudiante_sancion` debe actualizar el estado a `SANCIONADO` o `EXPULSADO`.

### 3.2.8 Módulo 08: Configuración Académica
- **RF-CONF-001 (HU-CONF-001)**: El Directivo debe definir los periodos académicos y sus fechas de vigencia.
- **RF-CONF-002 (HU-CONF-002)**: El sistema debe bloquear cualquier edición de notas en periodos cuyo estado sea `CERRADO`.

### 3.2.9 Módulo 09: Competencias y Sincronización
- **RF-COMP-001 (HU-COMP-001)**: El docente o directivo debe crear competencias por materia y periodo.
- **RF-COMP-002 (HU-COMP-002)**: El sistema debe propagar en caliente la edición de una competencia a los cursos paralelos compartiendo el mismo `sync_uuid`.

### 3.2.10 Módulo 10: Catálogo DBA
- **RF-DBA-001 (HU-DBA-001)**: El Administrador General debe importar el catálogo nacional DBA.
- **RF-DBA-002 (HU-DBA-003)**: Las evidencias DBA asociadas a una competencia deben cumplir con la exclusividad 1-to-1 en el grado y año lectivo.
- **RF-DBA-003 (HU-DBA-004)**: El sistema debe calcular el Reporte de Coherencia Curricular clasificando evidencias en `Cumple`, `Pendiente` y `Extra`.

### 3.2.11 Módulo 11: Calificaciones y Actividades
- **RF-CAL-001 (HU-CAL-001)**: El docente debe crear actividades evaluativas acumulando el 100% de la ponderación de la asignatura.
- **RF-CAL-002 (HU-CAL-003)**: El docente debe ingresar notas en la planilla interactiva validando el rango de la escala (`nota_minima` y `nota_maxima`).

### 3.2.12 Módulo 12: Observaciones del Estudiante
- **RF-OBS-001 (HU-OBS-001)**: El docente debe registrar anotaciones categorizadas por su tipo (`ACADEMICA`, `CONVIVENCIA`, `DISCIPLINARIA`, `OTRO`).
- **RF-OBS-002 (HU-OBS-002)**: La observación `ACADEMICA` es requisito obligatorio para autorizar el cierre de materia del docente.

### 3.2.13 Módulo 13: Asistencia Escolar
- **RF-ASI-001 (HU-ASI-001)**: El docente debe tomar asistencia diaria clasificando la falla en `PRESENTE`, `AUSENTE`, `TARDE` o `JUSTIFICADA`.
- **RF-ASI-002 (HU-ASI-001)**: El backend debe rechazar la planilla si algún alumno supera el límite de 7 bloques de clase registrados al día.

### 3.2.14 Módulo 14: Cierre de Periodo y Boletines
- **RF-BOL-001 (HU-BOL-001)**: El docente debe ejecutar el cierre de periodo por materia consolidando las notas en `resultado_academico`.
- **RF-BOL-002 (HU-BOL-002)**: El Directivo sólo puede aprobar el cierre institucional del periodo si el 100% de las materias están cerradas en `cierre_materia`.
- **RF-BOL-003 (HU-BOL-003)**: El sistema debe generar los boletines oficiales PDF individuales y por grupo omitiendo matrículas canceladas.

### 3.2.15 Módulo 15: Supervisión y Auditoría
- **RF-SUP-001 (HU-SUP-001)**: El Administrador General debe solicitar sesiones de supervisión a un colegio con motivo y duración en minutos.
- **RF-SUP-002 (HU-SUP-002)**: El Rector debe aprobar la supervisión mediante re-autenticación obligatoria con su contraseña de usuario.
- **RF-SUP-003 (HU-SUP-003)**: La consola de supervisión en el panel directivo debe filtrar las solicitudes y registros históricos por el **Año Lectivo** seleccionado.
- **RF-SUP-004 (HU-SUP-005)**: Las acciones ejecutadas en modo editor se guardan de forma inmutable capturando `valor_antiguo` y `valor_nuevo` en formato JSONB.

### 3.2.16 Módulo 16: Soporte y Tickets
- **RF-SOP-001 (HU-SOP-001)**: El visitante o usuario debe abrir tickets de soporte recibiendo un código de seguimiento Base36 (`TKT-XXXX`).
- **RF-SOP-002 (HU-SOP-002)**: El selector de estados en la consola del personal debe renderizar las opciones consistentes (`ABIERTO`, `EN_PROCESO`, `ESCALADO`, `RESUELTO`) y filtrar por cada estado en la barra superior.
- **RF-SOP-003 (HU-SOP-004)**: Los tickets aplicarán la regla del turno de respuesta (ping-pong), deshabilitando la respuesta continua del mismo remitente.
- **RF-SOP-004 (HU-SOP-005)**: El Directivo puede escalar tickets complejos al Administrador General registrando el timestamp en `fecha_escalado`. Para el Directivo el control se muestra como badge estático `Escalado`, mientras que el Admin General puede resolverlo.

### 3.2.17 Módulo 17: Gestión de Padres de Familia
- **RF-PAD-001 (HU-PAD-001)**: El Directivo puede buscar, filtrar por grado/alertas y visualizar acudientes con estado estandarizado a `Activo`/`Inactivo`.
- **RF-PAD-002 (HU-PAD-003)**: Al inactivar la cuenta de un padre de familia, el sistema revoca inmediatamente su sesión mediante la actualización atómica de `usuario.logged_out_at`.
- **RF-PAD-003 (HU-PAD-004)**: El Directivo puede auditar el portal del acudiente en Modo Monitoreo restringiendo el acceso al módulo de Soporte Técnico.

### 3.2.18 Módulo 18: Gestión de Traslados
- **RF-TRS-001 (HU-TRS-001)**: El usuario puede solicitar el traslado de matrícula entre colegios especificando el motivo y colegio destino.
- **RF-TRS-002 (HU-TRS-002)**: El Directivo y Admin General pueden aprobar o rechazar solicitudes de traslado registrando la trazabilidad de la acción.

### 3.2.19 Módulo 19: Seguimiento Académico, Promoción y Reprobación Anual
- **RF-PRO-001 (HU-19.1)**: El Directivo puede consultar el seguimiento académico por período único o acumulado (Períodos 1..N) con el desglose de asignaturas reprobadas y docentes responsables.
- **RF-PRO-002 (HU-19.2)**: El sistema clasifica automáticamente a los estudiantes en `APROBADO`, `NO_PROMOVIDO` o `PENDIENTE_RECUPERACION` según los promedios ponderados anuales conforme al Decreto 1290 de 2009.
- **RF-PRO-003 (HU-19.4)**: El Directivo puede registrar la decisión de promoción institucional en la tabla `decision_promocion_directivo`.

### 3.2.20 Módulo 20: Seguimiento Académico a Usuarios por Directivo
- **RF-SEG-001 (HU-SEG-001)**: El Directivo puede iniciar sesión de acompañamiento pedagógico para emular la vista de un docente, estudiante o padre de familia de su colegio.
- **RF-SEG-002 (HU-SEG-002)**: El sistema conmuta el rol activo (`activeRole`) en el store de Pinia conservando las credenciales originales del directivo y resolviendo el ID del supervisado mediante resolución ternaria (`monitoringUser.id`).
- **RF-SEG-003 (HU-SEG-003)**: La interfaz opera en **modo solo lectura estricto**, ocultando o deshabilitando formularios de registro de notas, asistencia y observador.
- **RF-SEG-004 (HU-SEG-004)**: El sistema bloquea automáticamente la navegación a la ruta `/dashboard/gestion-traslados` durante una sesión de acompañamiento.

### 3.2.21 Módulo 21: Flujo de Correos Electrónicos, Notificaciones y Verificaciones OTP
- **RF-COR-001 (HU-COR-001)**: El sistema debe generar y validar códigos OTP numéricos de 6 dígitos con expiración de 15 minutos para trámites sensibles (matrículas y actualización de correo en perfil).
- **RF-COR-002 (HU-COR-002)**: El sistema debe despachar credenciales temporales por correo electrónico al crear directivos y docentes.
- **RF-COR-003 (HU-COR-003)**: El sistema debe notificar a acudientes inconsistencias documentales de matrícula e inicio de reingresos.

---

## 3.3 Requisitos No Funcionales

### 3.3.1 Requisitos de Rendimiento
- **RNF-001**: Las consultas de planillas de calificaciones deben responder en menos de 500 ms para grupos de hasta 45 alumnos.
- **RNF-002**: El motor de generación de boletines PDF debe procesar un curso completo en menos de 3 segundos.

### 3.3.2 Seguridad
- **RNF-003**: Todas las contraseñas deben almacenarse cifradas con BCrypt (salt rounds >= 10).
- **RNF-004**: Toda la API debe rechazar peticiones sin token JWT válido en el header `Authorization`.
- **RNF-005**: Las tablas de auditoría están protegidas contra sentencias `DELETE` mediante triggers PL/pgSQL.

### 3.3.3 Integridad y Tipado Estático
- **RNF-006 (Kysely Query Builder)**: Toda consulta a la base de datos debe construirse mediante Kysely garantizando validación estática de tipos en compilación TypeScript (`db.types.ts`).
- **RNF-007 (Zod DTO Validation)**: Toda petición mutativa (`POST`, `PUT`, `PATCH`) debe validarse contra esquemas Zod antes de ingresar a la capa de servicios o base de datos.

### 3.3.4 Fiabilidad
- **RNF-008**: Las operaciones masivas de notas o cierre se ejecutan dentro de transacciones atómicas SQL (ROLLBACK ante fallos).

### 3.3.5 Disponibilidad
- **RNF-009**: La API debe mantenerse operativa durante picos de concurrencia de cierres de periodo lectivo.

### 3.3.6 Mantenibilidad
- **RNF-010**: El código debe estructurarse en capas desacopladas con controladores Kysely, DTOs Zod, middlewares y vistas Vue 3 modulares.

---

## 3.4 Otros Requisitos (Reglas Globales del Sistema)

- **RG-001 (Multi-Tenancy)**: Todas las tablas del esquema institucional deben estar vinculadas a la clave foránea `id_colegio`.
- **RG-002 (Inmutabilidad por Trigger)**: El trigger SQL `fn_bloquear_periodo_cerrado` aborta cualquier escritura en periodos en estado `CERRADO`.
- **RG-003 (Retención Legal a 5 Años)**: Las auditorías de supervisión establecen su retención legal en `now() + '5 years'::interval`.
- **RG-004 (Verificación Previa OTP)**: Ninguna matrícula o cambio de email en perfil puede consolidarse sin la validación previa del código OTP de 6 dígitos.

---

# 4. Apéndices

## Apéndice A: Matriz de Trazabilidad de Módulos (21 Módulos)

| Código | Módulo Funcional | Tablas SQL Principales | Controlador Backend |
|---|---|---|---|
| **AUT** | Autenticación | `usuario`, `token_blacklist` | `authController.ts` |
| **COL** | Colegios | `colegio` | `colegioController.ts` |
| **DIR** | Directivos | `usuario`, `directivo` | `usuarioController.ts` |
| **EST** | Estructura Escolar | `nivel`, `tipo_grado`, `grupo`, `materia` | `academicAdminController.ts` |
| **DOC** | Docentes | `docente`, `detalle_grados` | `academicAdminController.ts` |
| **MAT** | Matrículas | `matricula`, `documento_matriculas`, `tickets_soporte`, `configuracion_inscripcion` | `enrollmentAdminController.ts`, `matriculaController.ts`, `reingresoController.ts` |
| **STU** | Estudiantes | `estudiante`, `sancion` | `studentController.ts` |
| **CONF** | Configuración Académica | `periodo_academico`, `escala_valoracion` | `academicAdminController.ts` |
| **COMP** | Competencias | `competencia`, `competencia_sincronizada` | `academicAdminController.ts` |
| **DBA** | Catálogo DBA | `dba_catalogo`, `evidencia_dba` | `dbaController.ts` |
| **CAL** | Calificaciones | `actividad_materia`, `notas_actividad` | `gradingController.ts` |
| **OBS** | Observaciones | `observacion_estudiante` | `observationController.ts` |
| **ASI** | Asistencia | `registro_asistencia` | `attendanceController.ts` |
| **BOL** | Cierre y Boletines | `resultado_academico`, `cierre_materia` | `boletinController.ts` |
| **SUP** | Supervisión y Auditoría | `auditoria_supervision`, `auditoria_acciones_realizadas` | `adminGeneralController.ts` |
| **SOP** | Soporte y Tickets | `tickets_soporte` | `supportController.ts` |
| **PAD** | Gestión de Padres de Familia | `padre_familia`, `detalle_padrefamilia` | `parentManagementController.ts` |
| **TRS** | Gestión de Traslados | `solicitud_traslado`, `traslado_aprobacion` | `trasladoController.ts` |
| **PRO** | Seguimiento y Promoción | `decision_promocion_directivo` | `academicTrackingController.ts` |
| **SEG** | Seguimiento Directivo | `usuario`, `docente`, `estudiante`, `padre_familia` | (Frontend Store Auth & Controllers) |
| **COR** | Flujo Correos y OTP | `codigo_verificacion_email` | `matriculaController.ts`, `notificationService.ts` |
