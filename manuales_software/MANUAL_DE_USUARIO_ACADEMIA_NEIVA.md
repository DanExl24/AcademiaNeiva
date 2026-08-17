# 📘 MANUAL DE USUARIO OFICIAL — ACADEMIA NEIVA

**Sistema de Gestión Académica Institucional Multitenant — AcademiaNeiva**  
**Guía Integral de Procedimientos Operativos y Arquitectura Funcional**  
**Versión del Sistema:** 2.5.0  
**Fecha de Edición:** 17 de Agosto de 2026  
**Población Objetivo:** Administradores Generales, Directivos Institucionales (Rectores y Coordinadores), Docentes, Padres de Familia / Acudientes Legales y Estudiantes  

---

## 📑 Tabla de Contenido General

- [1. Introducción](#1-introducción)
  - [1.1 Objetivo del manual](#11-objetivo-del-manual)
  - [1.2 Alcance del ecosistema (21 módulos)](#12-alcance-del-ecosistema-21-módulos)
  - [1.3 Arquitectura Multi-Colegio y Soberanía Institucional](#13-arquitectura-multi-colegio-y-soberanía-institucional)
- [2. Requisitos y Entorno de Acceso](#2-requisitos-y-entorno-de-acceso)
  - [2.1 Requisitos de hardware y conectividad](#21-requisitos-de-hardware-y-conectividad)
  - [2.2 Navegadores compatibles y tecnologías web](#22-navegadores-compatibles-y-tecnologías-web)
  - [2.3 Portal de acceso y Landing Page institucional](#23-portal-de-acceso-y-landing-page-institucional)
- [3. Acceso, Autenticación y Seguridad](#3-acceso-autenticación-y-seguridad)
  - [3.1 Inicio de sesión estándar (Personal, Docentes y Padres)](#31-inicio-de-sesión-estándar-personal-docentes-y-padres)
  - [3.2 Inicio de sesión estudiantil (Código institucional único)](#32-inicio-de-sesión-estudiantil-código-institucional-único)
  - [3.3 Recuperación de contraseña mediante enlace seguro](#33-recuperación-de-contraseña-mediante-enlace-seguro)
  - [3.4 Verificación en dos pasos y códigos OTP de 6 dígitos](#34-verificación-en-dos-pasos-y-códigos-otp-de-6-dígitos)
  - [3.5 Cierre de sesión y revocación global por `logged_out_at`](#35-cierre-de-sesión-y-revocación-global-por-logged_out_at)
- [4. Navegación e Interfaz del Sistema](#4-navegación-e-interfaz-del-sistema)
  - [4.1 Panel de control (Dashboard reactivo por rol)](#41-panel-de-control-dashboard-reactivo-por-rol)
  - [4.2 Menú lateral de navegación y colapso responsive](#42-menú-lateral-de-navegación-y-colapso-responsive)
  - [4.3 Sistema de notificaciones en tiempo real](#43-sistema-de-notificaciones-en-tiempo-real)
  - [4.4 Perfil de usuario y actualización segura con OTP](#44-perfil-de-usuario-y-actualización-segura-con-otp)
- [5. Gestión de Colegios e Identidad Visual](#5-gestión-de-colegios-e-identidad-visual)
  - [5.1 Conmutador institucional para usuarios Multi-Colegio](#51-conmutador-institucional-para-usuarios-multi-colegio)
  - [5.2 Ficha institucional (DANE, Calendario A/B y datos oficiales)](#52-ficha-institucional-dane-calendario-ab-y-datos-oficiales)
  - [5.3 Personalización de marca y remoción de fondo por IA](#53-personalización-de-marca-y-remoción-de-fondo-por-ia)
  - [5.4 Administración y licenciamiento por el Administrador General](#54-administración-y-licenciamiento-por-el-administrador-general)
- [6. Gestión de Usuarios, Directivos y Personal](#6-gestión-de-usuarios-directivos-y-personal)
  - [6.1 Catálogo de usuarios globales y reglas de creación](#61-catálogo-de-usuarios-globales-y-reglas-de-creación)
  - [6.2 Vinculación, desvinculación y cargos de directivos](#62-vinculación-desvinculación-y-cargos-de-directivos)
  - [6.3 Modificación de datos sensibles con Ticket de Soporte Auditor](#63-modificación-de-datos-sensibles-con-ticket-de-soporte-auditor)
  - [6.4 Detección automática y gestión de Doble Rol (Padre + Docente)](#64-detección-automática-y-gestión-de-doble-rol-padre--docente)
  - [6.5 Activación, suspensión, baneo y desconexión atómica de cuentas](#65-activación-suspensión-baneo-y-desconexión-atómica-de-cuentas)
- [7. Módulo de Matrícula e Inscripción Escolar](#7-módulo-de-matrícula-e-inscripción-escolar)
  - [7.1 [PENDIENTE DE REVISIÓN] Formulario de admisión pública](#71-pendiente-de-revisión-formulario-de-admisión-pública)
  - [7.2 [PENDIENTE DE REVISIÓN] Consola de evaluación y oficialización directiva](#72-pendiente-de-revisión-consola-de-evaluación-y-oficialización-directiva)
  - [7.3 [PENDIENTE DE REVISIÓN] Renovación y matriz documental de reingresos](#73-pendiente-de-revisión-renovación-y-matriz-documental-de-reingresos)
  - [7.4 [PENDIENTE DE REVISIÓN] Consulta pública mediante Token UUID](#74-pendiente-de-revisión-consulta-pública-mediante-token-uuid)
- [8. Estructura Escolar, Grados y Jornadas Institucionales](#8-estructura-escolar-grados-y-jornadas-institucionales)
  - [8.1 Jerarquía escolar: Niveles, Tipos de Grado y Salones](#81-jerarquía-escolar-niveles-tipos-de-grado-y-salones)
  - [8.2 Gestión de Jornadas Escolares, aforos y reasignación de cursos](#82-gestión-de-jornadas-escolares-aforos-y-reasignación-de-cursos)
  - [8.3 Catálogo de materias institucionales y papelera protegida](#83-catálogo-de-materias-institucionales-y-papelera-protegida)
  - [8.4 Asignación Académica (`detalle_grados`): Docente-Grupo-Materia](#84-asignación-académica-detalle_grados-docente-grupo-materia)
- [9. Gestión Curricular, Catálogo DBA y Coherencia](#9-gestión-curricular-catálogo-dba-y-coherencia)
  - [9.1 Catálogo Nacional de Derechos Básicos de Aprendizaje (DBA)](#91-catálogo-nacional-de-derechos-básicos-de-aprendizaje-dba)
  - [9.2 Importación masiva desde PDF y asignación de versiones curriculares](#92-importación-masiva-desde-pdf-y-asignación-de-versiones-curriculares)
  - [9.3 Planeación de Multicompetencias y sincronización en caliente (`sync_uuid`)](#93-planeación-de-multicompetencias-y-sincronización-en-caliente-sync_uuid)
  - [9.4 Vinculación de evidencias oficiales con candado de colisión (🔒)](#94-vinculación-de-evidencias-oficiales-con-candado-de-colisión-)
  - [9.5 Registro de Evidencias Extras y justificación docente](#95-registro-de-evidencias-extras-y-justificación-docente)
  - [9.6 Analítica: Reporte de Coherencia Curricular vs. Cobertura del Catálogo](#96-analítica-reporte-de-coherencia-curricular-vs-cobertura-del-catálogo)
- [10. Evaluación del Aprendizaje y Calificaciones](#10-evaluación-del-aprendizaje-y-calificaciones)
  - [10.1 Estructura evaluativa ponderada (Actividades y Criterios al 100%)](#101-estructura-evaluativa-ponderada-actividades-y-criterios-al-100)
  - [10.2 Planilla de calificaciones interactiva y cálculo en caliente](#102-planilla-de-calificaciones-interactiva-y-cálculo-en-caliente)
  - [10.3 Restricción de calificación por estado de matrícula](#103-restricción-de-calificación-por-estado-de-matrícula)
  - [10.4 Portal de consulta para estudiantes y acudientes](#104-portal-de-consulta-para-estudiantes-y-acudientes)
- [11. Convivencia Escolar y Control de Asistencia](#11-convivencia-escolar-y-control-de-asistencia)
  - [11.1 Registro diario de asistencia y estados tipificados](#111-registro-diario-de-asistencia-y-estados-tipificados)
  - [11.2 Regla de límite físico diario: Máximo 7 bloques de clase](#112-regla-de-límite-físico-diario-máximo-7-bloques-de-clase)
  - [11.3 Observador del Alumno: Tipología de anotaciones formativas](#113-observador-del-alumno-tipología-de-anotaciones-formativas)
  - [11.4 Obligatoriedad de la observación académica para el cierre](#114-obligatoriedad-de-la-observación-académica-para-el-cierre)
- [12. Cierre de Periodos, Consolidación y Boletines Oficiales](#12-cierre-de-periodos-consolidación-y-boletines-oficiales)
  - [12.1 Consolidación y Cierre de Materia por el Docente](#121-consolidación-y-cierre-de-materia-por-el-docente)
  - [12.2 Cierre Institucional del Periodo por el Rector](#122-cierre-institucional-del-periodo-por-el-rector)
  - [12.3 Motor de generación de Boletines PDF oficiales](#123-motor-de-generación-de-boletines-pdf-oficiales)
  - [12.4 Reapertura excepcional de cierre por materia](#124-reapertura-excepcional-de-cierre-por-materia)
- [13. Seguimiento Académico, Promoción y Graduación Anual](#13-seguimiento-académico-promoción-y-graduación-anual)
  - [13.1 Consola de Aprobados: Rendimiento por Periodo vs. Acumulado (P1..PN)](#131-consola-de-aprobados-rendimiento-por-periodo-vs-acumulado-p1pn)
  - [13.2 Registro de decisiones directivas de promoción anual](#132-registro-de-decisiones-directivas-de-promoción-anual)
  - [13.3 Detección de Graduandos (Último Año) y generación del libro de graduados](#133-detección-de-graduandos-último-año-y-generación-del-libro-de-graduados)
  - [13.4 Advertencias académicas informativas en matrícula](#134-advertencias-académicas-informativas-en-matrícula)
- [14. Gestión de Traslados de Estudiantes y Personal](#14-gestión-de-traslados-de-estudiantes-y-personal)
  - [14.1 Modelo de Identidad Global: `TRASLADO_MATRICULA` vs. `TRASLADO_USUARIO`](#141-modelo-de-identidad-global-traslado_matricula-vs-traslado_usuario)
  - [14.2 Workflow de Consenso Tripartito Obligatorio](#142-workflow-de-consenso-tripartito-obligatorio)
  - [14.3 Validación en tiempo real de cupos por grado y asignación de grupo](#143-validación-en-tiempo-real-de-cupos-por-grado-y-asignación-de-grupo)
  - [14.4 Bloqueo operativo en origen y preservación de roles laborales](#144-bloqueo-operativo-en-origen-y-preservación-de-roles-laborales)
  - [14.5 Traslado interno de grupo/sección con notificación por email](#145-traslado-interno-de-gruposección-con-notificación-por-email)
- [15. Supervisión Extraordinaria y Acompañamiento Pedagógico](#15-supervisión-extraordinaria-y-acompañamiento-pedagógico)
  - [15.1 Supervisión Extraordinaria del Administrador General](#151-supervisión-extraordinaria-del-administrador-general)
  - [15.2 Acompañamiento Pedagógico Directivo (Modo Espejo)](#152-acompañamiento-pedagógico-directivo-modo-espejo)
  - [15.3 Inmutabilidad de auditoría mediante triggers SQL](#153-inmutabilidad-de-auditoría-mediante-triggers-sql)
- [16. Mesa de Ayuda, Soporte Técnico y Gestión de Tickets](#16-mesa-de-ayuda-soporte-técnico-y-gestión-de-tickets)
  - [16.1 Radicación de incidencias y Códigos Base36 Ofuscados](#161-radicación-de-incidencias-y-códigos-base36-ofuscados)
  - [16.2 Regla de Turnos de Conversación (Ping-Pong)](#162-regla-de-turnos-de-conversación-ping-pong)
  - [16.3 Escalamiento al Administrador General y badges estáticos](#163-escalamiento-al-administrador-general-y-badges-estáticos)
  - [16.4 Inmutabilidad de tickets resueltos y casos de reingreso](#164-inmutabilidad-de-tickets-resueltos-y-casos-de-reingreso)
- [17. Guía Operativa por Roles de Usuario](#17-guía-operativa-por-roles-de-usuario)
  - [17.1 Administrador General](#171-administrador-general)
  - [17.2 Directivo (Rector / Coordinador)](#172-directivo-rector--coordinador)
  - [17.3 Docente](#173-docente)
  - [17.4 Padre de Familia / Acudiente Legal](#174-padre-de-familia--acudiente-legal)
  - [17.5 Estudiante](#175-estudiante)
- [18. Diagnóstico de Errores Frecuentes y Soluciones](#18-diagnóstico-de-errores-frecuentes-y-soluciones)
- [19. Buenas Prácticas y Seguridad de la Información](#19-buenas-prácticas-y-seguridad-de-la-información)

---

# 1. Introducción

## 1.1 Objetivo del manual
El presente **Manual de Usuario** constituye la guía técnica y operativa oficial para los usuarios del ecosistema **AcademiaNeiva**. Su propósito es instruir de forma rigurosa y procedimental a cada integrante de la comunidad académica (Administradores Generales, Rectores, Coordinadores, Docentes, Padres de Familia y Estudiantes) sobre la utilización adecuada, segura y eficiente de los módulos que conforman la plataforma.

## 1.2 Alcance del ecosistema (21 módulos)
El sistema **AcademiaNeiva** integra 21 módulos funcionales interconectados:
1. **Autenticación y Sesiones Seguras** (JWT, JTI, control de roles).
2. **Gestión Institucional de Colegios** (Identidad visual, DANE, calendarios A/B).
3. **Gobierno Global de Usuarios y Directivos** (Control de licencias, directivos y tickets de auditoría).
4. **Estructura Escolar y Gestión de Jornadas** (Niveles, grados, salones, aforos y materias).
5. **Personal Docente y Asignación Académica** (`detalle_grados` y bienvenida SMTP).
6. **Matrículas e Inscripciones Públicas** (Admisión, verificación OTP y asignación de cupos).
7. **Gestión de Estudiantes y Estados** (Ciclo de vida, suspensiones automáticas por triggers).
8. **Configuración Académica y Ciclo de Vida** (Años lectivos, periodos y escalas).
9. **Competencias y Sincronización Curricular** (Multicompetencias y `sync_uuid` en paralelos).
10. **Catálogo Nacional DBA y Coherencia** (Importación PDF, desvíos y analítica de Coherencia vs Cobertura).
11. **Calificaciones y Criterios Evaluativos** (Ponderación al 100% y promedios en caliente).
12. **Observador del Alumno** (Anotaciones formativas y obligatoriedad académica).
13. **Control Diario de Asistencia** (Estados tipificados y límite físico de 7 bloques diarios).
14. **Cierre de Periodos y Boletines Oficiales** (Cierre de materia, cierre institucional y PDFs).
15. **Supervisión Extraordinaria y Auditoría** (Re-autenticación del rector, modos y logs JSONB).
16. **Mesa de Ayuda y Tickets** (Códigos Base36, regla Ping-Pong, escalamiento e inmutabilidad).
17. **Gestión de Padres de Familia** (Monitoreo, control de acudientes y Doble Rol Padre-Docente).
18. **Gestión de Traslados de Estudiantes y Usuarios** (Consenso tripartito y validación de cupos).
19. **Seguimiento Académico, Promoción y Graduación** (Consolidado P1..PN y libro de graduados).
20. **Seguimiento Pedagógico Directivo a Usuarios** (Modo espejo, banner ámbar y aislamiento multi-sede).
21. **Flujo de Correos Electrónicos y Verificación OTP** (Plantillas HTML y códigos de 6 dígitos).

## 1.3 Arquitectura Multi-Colegio y Soberanía Institucional
**AcademiaNeiva** opera bajo un modelo de arquitectura multitenant seguro. Cada colegio dispone de completa autonomía pedagógica, calendarios escolares independientes y personalización visual corporativa (escudo y colores institucionales), asegurando que los registros académicos y la información confidencial permanezcan estrictamente aislados entre instituciones.

---

# 2. Requisitos y Entorno de Acceso

## 2.1 Requisitos de hardware y conectividad
- **Computadores de Escritorio y Portátiles:** Procesador de 1.5 GHz o superior, memoria RAM mínima de 2 GB (recomendado 4 GB). Pantalla con resolución mínima de 1280x720 píxeles.
- **Dispositivos Móviles y Tablets:** Dispositivos Android (versión 8.0+) o iOS (versión 13.0+) con visualización adaptable y conexión a Internet mediante Wi-Fi o datos móviles 4G/5G con latencia estable.

## 2.2 Navegadores compatibles y tecnologías web
La plataforma utiliza estándares web modernos (HTML5, ECMAScript moderno, WebAssembly para IA en el cliente y CSS variables dinámicas). Se requiere el uso de navegadores modernos:
- **Google Chrome** (v100 o superior) — *Recomendado*.
- **Mozilla Firefox** (v100 o superior).
- **Microsoft Edge** (v100 o superior).
- **Apple Safari** (v14 o superior).

> [!WARNING]
> Navegadores desactualizados como Internet Explorer no son compatibles con el motor de cifrado JWT ni con los modelos ONNX WASM de procesamiento de imágenes.

## 2.3 Portal de acceso y Landing Page institucional
Para ingresar:
1. Abra el navegador web e ingrese la URL provista por su institución (ej. `https://academianeiva.edu.co`).
2. La **Landing Page** institucional le ofrecerá enlaces directos para el inicio de sesión, el formulario de admisión escolar, el seguimiento público de matrículas y la radicación de solicitudes de soporte técnico.

---

# 3. Acceso, Autenticación y Seguridad

## 3.1 Inicio de sesión estándar (Personal, Docentes y Padres)
Los usuarios con roles de `admin_general`, `directivo`, `docente` y `padre` acceden a través del formulario principal autenticándose con su correo electrónico y contraseña:

```
┌─────────────────────────────────────────────────────────────┐
│                      ACADEMIA NEIVA                         │
│                    Inicio de Sesión                         │
├─────────────────────────────────────────────────────────────┤
│  Correo Electrónico:                                        │
│  [ usuario@colegio.edu.co                                 ] │
│                                                             │
│  Contraseña:                                                │
│  [ ••••••••••••••••                                       ] │
│                                                             │
│  [ Recordarme ]              [ ¿Olvidó su contraseña? ]     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                [ INICIAR SESIÓN ]                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 3.2 Inicio de sesión estudiantil (Código institucional único)
Los estudiantes menores de edad o que no cuenten con correo electrónico registrado acceden mediante su **Código Estudiantil Único** (ej. `EST-104932`) expedido en la formalización de su matrícula escolar.
1. En la pantalla de login, seleccione la pestaña **"Acceso Estudiantes"**.
2. Digite su código institucional y su contraseña personal.

## 3.3 Recuperación de contraseña mediante enlace seguro
1. Haga clic en **"¿Olvidó su contraseña?"**.
2. Digite su correo electrónico registrado y presione **"Enviar Enlace"**.
3. El servicio `NotificationService` enviará un correo con un token criptográfico de un solo uso con caducidad estricta de **1 hora**.
4. Haga clic en el botón del correo, digite su nueva contraseña y confírmela.

## 3.4 Verificación en dos pasos y códigos OTP de 6 dígitos
El sistema implementa códigos numéricos OTP (*One-Time Password*) emitidos por `EmailVerificationService` con **caducidad de 15 minutos**:
- **Trámites de Inscripción Pública:** Validación previa obligatoria del buzón del acudiente antes de permitir enviar la solicitud.
- **Actualización de Correo de Perfil:** Se exige ingresar el código recibido en la nueva dirección para autenticar la titularidad antes de registrar el cambio en la base de datos.

## 3.5 Cierre de sesión y revocación global por `logged_out_at`
- **Cierre Voluntario:** Al presionar **"Cerrar Sesión"** en el avatar de usuario, se destruye el token en el cliente.
- **Revocación Global de Seguridad:** Si un directivo desactiva una cuenta o el Administrador General fuerza el cierre de sesión de un usuario, el sistema estampa la fecha actual en `usuario.logged_out_at`. Cualquier token JWT emitido antes de ese instante es automáticamente rechazado con error `401 Unauthorized` por el middleware en las siguientes peticiones.

---

# 4. Navegación e Interfaz del Sistema

## 4.1 Panel de control (Dashboard reactivo por rol)
El panel principal adapta sus componentes de forma reactiva según el rol activo:
- **Directivos:** Tarjetas KPI de matrículas activas, cupos disponibles, docentes en servicio, ausentismo global y estado de periodos.
- **Docentes:** Relación de materias asignadas en el año lectivo activo, accesos directos a la planilla de notas y asistencia del día.
- **Padres y Estudiantes:** Resumen de calificaciones del periodo en curso, fallas acumuladas y comunicados institucionales.

## 4.2 Menú lateral de navegación y colapso responsive
Ubicado en el costado izquierdo, organiza las opciones por módulos autorizados. Dispone de un botón de colapso (**☰**) para optimizar el espacio en pantallas pequeñas.

## 4.3 Sistema de notificaciones en tiempo real
El icono de campana (**🔔**) en el topbar centraliza avisos institucionales, inconsistencias en documentos de matrículas, alertas de ausentismo y respuestas a tickets de soporte técnico.

## 4.4 Perfil de usuario y actualización segura con OTP
En **"Mi Perfil"**, los usuarios pueden actualizar su número telefónico de contacto personal. Para modificar el correo electrónico:
1. Digite la nueva dirección de correo y presione **"Solicitar Cambio"**.
2. El sistema enviará un código OTP de 6 dígitos al nuevo correo.
3. Ingrese el código en el modal de confirmación para hacer efectivo el cambio de manera segura.

---

# 5. Gestión de Colegios e Identidad Visual

## 5.1 Conmutador institucional para usuarios Multi-Colegio
Si un directivo, docente o acudiente se encuentra vinculado a más de una institución:
1. En la barra superior visualizará el selector desplegable de colegio activo.
2. Al seleccionar otra institución, el sistema actualiza de inmediato el contexto (`schoolId`), los colores corporativos y los datos académicos sin necesidad de volver a iniciar sesión.

## 5.2 Ficha institucional (DANE, Calendario A/B y datos oficiales)
Los directivos configuran la sede principal, teléfono, correo de contacto oficial, código DANE institucional y el tipo de calendario escolar:
- **Calendario A:** Vigencia estándar de Enero a Noviembre.
- **Calendario B:** Vigencia de Agosto a Junio.

## 5.3 Personalización de marca y remoción de fondo por IA
En el panel **"Mi Colegio"** (`MySchool.vue`), los directivos pueden cargar el escudo del colegio y definir sus colores primario y secundario.
- **Remoción de Fondo con IA en el Cliente:** El sistema integra el modelo de inteligencia artificial `@imgly/background-removal` ejecutado en el navegador mediante WebAssembly (ONNX WASM).
- **Optimización de Rendimiento:** La imagen se pre-redimensiona en Canvas a 512x512 píxeles antes de la inferencia neuronal, eliminando el fondo en aproximadamente 1 segundo sin sobrecargar el servidor.
- **Persistencia Directa:** La imagen procesada se guarda en formato Base64 Data URL (`data:image/png;base64,...`) garantizando portabilidad absoluta en la base de datos.

```
┌─────────────────────────────────────────────────────────────┐
│               IDENTIDAD INSTITUCIONAL Y ESCUDO              │
├─────────────────────────────────────────────────────────────┤
│  Vista Previa:                 Paleta de Colores:           │
│   ┌──────────────┐             Color Primario:   [ #1E3A8A ]│
│   │   [ESCUDO]   │             Color Secundario: [ #F59E0B ]│
│   │ (Sin Fondo)  │                                          │
│   └──────────────┘             [✓] Procesado con IA (ONNX)  │
│  [ Cargar Nuevo Escudo ] -> Remueve fondo automáticamente   │
└─────────────────────────────────────────────────────────────┘
```

## 5.4 Administración y licenciamiento por el Administrador General
El Administrador General gestiona el ciclo de vida de los colegios a nivel nacional (`PENDIENTE` ➔ `ACTIVO` ➔ `SUSPENDIDO` / `ELIMINADO`). Un colegio con matrículas o años lectivos activos no puede eliminarse físicamente, protegiendo la integridad referencial.

---

# 6. Gestión de Usuarios, Directivos y Personal

## 6.1 Catálogo de usuarios globales y reglas de creación
- **Creación Directa por Admin General:** El Administrador General puede crear usuarios directos con rol de `admin_general`, `directivo`, `docente` y `padre`.
- **Exclusión Estricta del Rol Estudiante:** El rol `estudiante` **no puede crearse manualmente** desde la consola global (`RN-USR-006`); la creación de estudiantes está reservada de forma exclusiva a la oficialización formal en el **Módulo de Matrículas**.
- **Email Nullable:** Los estudiantes menores de edad pueden crearse con `email = NULL`, utilizando su código institucional para autenticarse.

## 6.2 Vinculación, desvinculación y cargos de directivos
Los directivos se vinculan formalmente a una institución en la tabla `directivo`, asignándoles su cargo oficial (`RECTOR` o `COORDINADOR`). La desvinculación desactiva la relación institucional sin eliminar el historial del usuario.

## 6.3 Modificación de datos sensibles con Ticket de Soporte Auditor
Para salvaguardar la trazabilidad legal ante secretarías de educación:
- Si el Administrador General requiere modificar datos críticos de una cuenta (documento de identidad o correo principal), el sistema exige **asociar obligatoriamente el código de un Ticket de Soporte Resuelto** (`RN-USR-003`) como evidencia documental del trámite.

## 6.4 Detección automática y gestión de Doble Rol (Padre + Docente)
Cuando un docente tiene a sus hijos matriculados en la misma institución:
1. El backend detecta la coincidencia por documento o correo (`es_docente = true`).
2. En la consola directiva se exhibe el distintivo visual `👨‍🏫 También es Docente` y se expone su correo institucional secundario.
3. El usuario puede alternar entre sus portales de docente y acudiente manteniendo independientes sus registros de trabajo y de familia.

## 6.5 Activación, suspensión, baneo y desconexión atómica de cuentas
Los directivos pueden alternar el estado de las cuentas entre `Activo` e `Inactivo`:
- Al inactivar una cuenta, se ejecuta una transacción atómica que actualiza la ficha del rol, marca `usuario.activo = false` y sella `usuario.logged_out_at`, provocando la expulsión inmediata de cualquier sesión activa del usuario.

---

# 7. Módulo de Matrícula e Inscripción Escolar

El módulo de **Matrículas e Inscripciones** coordina el ingreso, evaluación, asignación de aula y formalización oficial de estudiantes en las instituciones de AcademiaNeiva, garantizando la persistencia binaria de soportes documentales y la creación atómica de cuentas institucionales.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FLUJO INTEGRAL DE MATRÍCULA ESCOLAR                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Inscripción Pública (Acudiente):                                                    │
│    Verificación OTP (15 min) ──> Formulario Web ──> Carga Documentos (BYTEA)           │
│                                                                                        │
│ 2. Evaluación Directiva (EnrollmentDetails.vue):                                       │
│    Visor JWT Efímero ──> Validar / Rechazar Docs ──> Asignar Aula (Cupos en vivo)      │
│    (Si hay rechazos ──> Estado CORRECCION ──> Subsanación por Token ──> Estado CORREGIDA)│
│                                                                                        │
│ 3. Formalización Final (FinalRegistration.vue):                                        │
│    Paso 1: Estudiante (Candidato Renovación vs. Nuevo Alumno + Alerta Académica)       │
│    Paso 2: Acudiente (Detección Usuario Existente / Personal Docente Multi-Rol)        │
│    ──> Transacción Kysely: Bloqueo FOR UPDATE ──> Alta Estudiante + Matrícula ACTIVA  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 7.1 Formulario de admisión pública y verificación previa OTP
1. **Verificación de Correo:** El acudiente accede a la página pública de admisiones, digita su dirección de correo electrónico y presiona **"Enviar Código OTP"**. El sistema remite un código numérico de 6 dígitos con caducidad estricta de **15 minutos**.
2. **Desbloqueo del Formulario:** Tras validar el código OTP, el sistema habilita el selector de colegios, niveles escolares (Preescolar, Primaria, Secundaria, Media) y grados disponibles.
3. **Control de Rango de Fechas Ordinarias:** El sistema valida que el colegio cuente con un año lectivo activo en estado `ABIERTO` y que la fecha actual se encuentre dentro del rango `[fecha_inicio, fecha_cierre]` establecido en `configuracion_inscripcion` (`RN-MAT-001`).
4. **Carga de Documentos:** El acudiente adjunta los archivos PDF o imágenes (máximo 5MB por archivo) requeridos según el nivel escolar del alumno (Registro Civil, Carnet de Vacunas, Certificado EPS, Foto, etc.).
5. **Persistencia Binaria Segura (`BYTEA`):** Los archivos se guardan directamente como buffers binarios en la tabla `documento_matriculas` en PostgreSQL (`RN-MAT-006`).
6. **Emisión de Token UUID:** Al radicar con éxito, la matrícula se crea en estado `PENDIENTE` y el sistema emite un **Token de Seguimiento UUID**, enviándolo también al correo verificado.

## 7.2 Modalidad de matrícula extraordinaria por Mesa de Soporte
- **Origen Exclusivo:** Se habilita cuando un acudiente radica un Ticket de Soporte con la incidencia `MATRICULA_EXTRAORDINARIA` (`RN-MAT-002`).
- **Autorización Directiva:** El directivo autoriza el trámite en `SupportView.vue`, pre-creando la matrícula en estado `PENDIENTE` vinculada al `id_ticket`.
- **Bypass de Fechas:** El acudiente diligencia el formulario mediante el token extraordinario incluso si las inscripciones ordinarias se encuentran cerradas o deshabilitadas.
- **Resolución Automática:** Al culminar la formalización o cancelación de la matrícula, el sistema actualiza automáticamente el ticket de soporte a estado **`RESUELTO`**.

## 7.3 Consola de evaluación y revisión documental directiva
En la vista **Gestión de Matrículas** (`EnrollmentManagement.vue` y `EnrollmentDetails.vue`), el directivo escolar:
1. **Filtros por Estado y Año Lectivo:** Lista solicitudes filtradas por `PENDIENTE`, `CORREGIDA`, `ACTIVA`, `TRASLADADA` o `CANCELADA`.
2. **Visor Protegido con Tokens JWT Efímeros:** Inspecciona cada archivo adjunto a través del endpoint `/documentos/:idDocumento/archivo`, protegido mediante tokens JWT firmados de corta duración (`RN-MAT-003`).
3. **Validación Individual de Archivos:** Marca cada soporte como `VALIDADO` o `RECHAZADO` con sus observaciones.
4. **Notificación de Inconsistencias y Subsanación:** Si existen rechazos, presiona **"Notificar Inconsistencias"**. La matrícula pasa al estado **`CORRECCION`** y el acudiente recibe un correo para subsanar los archivos rechazados mediante su token público en `EnrollmentCorrection.vue`.
5. **Transición a `CORREGIDA` y Control de Versiones:** Al subir las correcciones, el backend inserta los nuevos archivos con `version = max_version + 1` y promueve la matrícula al estado **`CORREGIDA`** (`RN-MAT-007`), alertando visualmente al directivo para su reevaluación.
6. **Asignación de Aula Físca:** El directivo selecciona el salón y jornada de destino visualizando los cupos disponibles en tiempo real (`cupos_totales - (activas + trasladadas)`). La asignación se persiste de inmediato en `matricula.id_grupo` mediante `POST /api/matriculas/assign-grade/:id`.

## 7.4 Formalización final, detección de múltiples hijos y doble rol
Al presionar **"Continuar a Formalización"** (`FinalRegistration.vue`), el sistema guía al directivo a través de dos pasos asistidos:

### Paso 1: Datos del Estudiante y Selección de Candidato
- **Detección Automática de Hijos de la Familia (`renovacion.candidates`):** Si el correo del acudiente ya tiene hijos registrados en años anteriores, el directivo visualiza la lista de candidatos elegibles (`RN-MAT-018`):
  - **Opción A (Renovar Hijo Existente):** Selecciona al estudiante candidato, reutilizando su expediente (`id_estudiante`) y reactivando su cuenta.
  - **Opción B (Registrar Nuevo Hermano):** Marca *"Registrar Nuevo Hermano"* para crear una nueva ficha de alumno independiente sin sobreescribir la del hermano.
- **Advertencia Académica Informativa:** El sistema consulta el historial del año anterior (`checkAcademicWarning`) para advertir al directivo si el alumno reprobó el grado previo.

### Paso 2: Datos del Acudiente y Detección de Rol Docente / Personal
- **Detección de Usuario Existente:** Al digitar el documento del acudiente, `checkDocument` consulta si ya existe en la base de datos (`RN-MAT-015`).
- **Personal Institucional (Docente/Directivo):** Si el acudiente trabaja en el colegio, el sistema muestra la advertencia informativa, bloquea los campos de nombres para no alterar su identidad laboral, le vincula el rol `padre` en `usuario_rol` y activa la relación en `usuario_colegio` sin crear cuentas duplicadas.
- **Validación Cruzada:** El sistema comprueba que el número de documento del estudiante y del acudiente sean diferentes (`RN-MAT-017`).

### Ejecución Transaccional Atómica (6 Fases)
Al presionar **"Finalizar Registro"**, el backend ejecuta `finalizeEnrollment` bajo una transacción Kysely indivisible (`RN-MAT-005`):
1. **Bloqueo Pessimistic `FOR UPDATE`:** Reserva la fila del aula en `grupos` y verifica que los cupos no se hayan agotado concurrentemente (`RN-MAT-012`).
2. **Alta de Alumno:** Crea o reactiva al estudiante en `estudiante` (estado `ACTIVO`) y su cuenta en `usuario` con contraseña inicial institucional.
3. **Alta / Vinculación del Acudiente:** Asocia al padre de familia en `padre_familia`, `usuario_rol` y `usuario_colegio`.
4. **Vínculo de Parentesco:** Inserta la relación en `detalle_padrefamilia`.
5. **Cancelación Preventiva:** Cancela matrículas duplicadas previas del mismo alumno en el año escolar activo.
6. **Activación y Despacho:** Promueve la matrícula a **`ACTIVA`** (o `TRASLADADA`), resuelve tickets de soporte asociados y envía por correo electrónico las credenciales oficiales de acceso.

## 7.5 Reingreso de estudiantes retirados y matriz documental
1. **Consola de Reingresos (`ReingresoManagement.vue`):** Permite buscar expedientes de alumnos en estado `RETIRADO` (`RN-MAT-009`).
2. **Matriz Documental Inteligente:** El directivo revisa los documentos cargados en años anteriores; los archivos válidos se marcan como `VIGENTE` y solo se solicita al acudiente renovar los vencidos (`RENOVAR`) (`RN-MAT-011`).
3. **Apertura de Reingreso:** Al presionar "Enviar Enlace", el sistema crea la matrícula en estado `PENDIENTE_RENOVACION` (`tipo = 'REINGRESO'`), actualiza el ticket de reingreso a `EN_PROCESO` de forma irreversible (`RN-MAT-010`) y despacha el token de renovación al acudiente.
4. **Formalización de Reingreso:** Tras la subsanación de los documentos marcados como renovar, el directivo formaliza en `FinalRegistration.vue`, pasando la matrícula a `ACTIVA` y reactivando la ficha del alumno a `ACTIVO`.

## 7.6 Cancelación formal de matrícula y definición del estado disciplinario
Cuando un directivo requiere cancelar una matrícula (`cancelEnrollment`):
1. Especifica obligatoriamente la causa formal y los detalles descriptivos (`RN-MAT-013`).
2. **Selección del Estado Final del Alumno (`RN-MAT-014`):**
   - **`RETIRADO`:** Desvinculación por traslado, viaje o retiro voluntario. Mantiene al alumno elegible para futuros trámites de reingreso.
   - **`EXPULSADO`:** Expulsión disciplinaria definitiva. Inhabilita automáticamente cualquier postulación de reingreso en el sistema.
3. El sistema actualiza `matricula.estado = 'CANCELADA'`, resuelve el ticket si existía y despacha un correo explicativo al acudiente.

---

# 8. Estructura Escolar, Grados, Jornadas y Catálogo Curricular

La arquitectura de **Estructura Escolar** organiza la jerarquía académica institucional, regula los aforos de las aulas físicas, administra los turnos de operación y gestiona el catálogo de asignaturas con respaldo snapshot.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     JERARQUÍA Y GESTIÓN DE ESTRUCTURA ESCOLAR                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Jerarquía Organizacional:                                                           │
│    Nivel Escolar ──> Tipo de Grado (Normalizado) ──> Sección ──> Curso Físico (Cupos)  │
│                                                                                        │
│ 2. Nomenclatura y Renombramiento Inteligente:                                          │
│    Renombramiento Individual (Desvinculación si shared > 1)                            │
│    Renombramiento en Bloque (Series Ordinales "10-A, 10-B" / "10-1, 10-2" máx 10 chars)│
│                                                                                        │
│ 3. Catálogo Curricular y Papelera Snapshot:                                            │
│    Eliminación Forzada (force=true) ──> Snapshot JSON en papelera_materias             │
│    Restauración con trashId ──> Recreación de Asignaciones y Competencias en caliente │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 8.1 Jerarquía escolar y normalización inteligente de grados
- **Estructura de Cuatro Niveles:** La organización académica se compone de `Nivel Escolar` (Preescolar, Primaria, Secundaria, Media), `Tipo de Grado` (Transición, Primero, Segundo, etc.), `Sección` (A, B, 10-1) y `Curso Físico` (`grupos`) (`RN-EST-001`).
- **Normalización Inteligente de Grados:** Al registrar un grado, el sistema aplica detección de similitud semántica (`isDuplicateOrSimilarGrade`). Impide crear grados equivalentes o con variaciones ortográficas (ej. si ya existe *"PRIMERO"*, se bloquea *"1°"*, *"Primero"* o *"PRIMERO DE PRIMARIA"*) (`RN-EST-002`).
- **Eliminación Protegida de Grados:** No se permite eliminar un tipo de grado si tiene cursos creados, matrículas vinculadas o docentes asignados, entregando un reporte de impacto (`RN-EST-004`).

## 8.2 Parametrización de cursos físicos, cupos y consulta de integrantes
En **"Gestión de Grados"** (`GradeManagement.vue`), los directivos configuran los salones del colegio:
1. **Creación de Cursos:** Vincula nivel, grado, jornada habilitada, sección y cupos totales.
2. **Protección de Reducción de Cupos:** El sistema prohíbe reducir la capacidad de un curso por debajo de los estudiantes con matrícula activa inscritos (`RN-EST-003`).
3. **Consulta de Integrantes del Curso:** La consola directiva expone la opción de inspeccionar los integrantes (`getGroupMembers`), listando en un modal interactivo todos los estudiantes matriculados (código, documento, estado de matrícula) y los docentes asignados con sus materias para el año lectivo.

## 8.3 Nomenclatura y renombramiento inteligente de cursos
- **Renombramiento Individual:** Si un curso comparte su sección con otros salones (ej. "10-A" y "11-A"), al renombrarlo el sistema crea una nueva sección independiente en la base de datos para no alterar a los demás cursos paralelos (`RN-EST-006`).
- **Renombramiento en Bloque por Grado:** Permite estandarizar masivamente todos los cursos de un grado mediante un prefijo, un separador y un tipo de serie (`LETRA` para A, B, C... o `NUMERO` para 1, 2, 3...), verificando que ningún nombre resultante exceda 10 caracteres (`RN-EST-007`).

## 8.4 Gestión de Jornadas Escolares y aforos por turno
Cada colegio administra sus jornadas operativas (`MAÑANA`, `TARDE`, `UNICA`, `NOCTURNA`):
- **Control de Aforos por Turno:** La consola directiva consolida los cupos y la matrícula total por jornada para evitar la superpoblación de las instalaciones físicas.
- **Eliminación Restringida:** Una jornada no puede eliminarse si tiene cursos asociados (`RN-JOR-003`).
- **Guarda de Reasignación:** La reasignación de cursos entre jornadas está protegida por política institucional (`IS_JORNADA_REASSIGNMENT_ENABLED = false`) para salvaguardar la jornada elegida por los padres en matrícula (`RN-JOR-004`).

## 8.5 Catálogo curricular y Papelera de Materias con Snapshot JSON
En **"Gestión de Materias"** (`SubjectManagement.vue`):
1. **Registro Curricular:** Creación y actualización de materias institucionales (Matemáticas, Lenguaje, etc.).
2. **Eliminación Forzada con Respaldo Snapshot:** Si una materia tiene asignaciones docentes o competencias pedagógicas, su eliminación con `force=true` genera automáticamente un snapshot transaccional JSON de todas sus dependencias en `papelera_materias.data_respaldo` antes de su eliminación (`RN-EST-008`).
3. **Restauración Profunda en Caliente:** En la pestaña **"Papelera de Materias"**, el directivo puede restaurar cualquier asignatura previamente eliminada. Al restaurarla, el sistema recrea la materia y re-inserta masivamente todas las asignaciones docentes en `detalle_grados` y las competencias pedagógicas asociadas a partir del snapshot JSON.

## 8.6 Asignación Académica (`detalle_grados`): Docente-Grupo-Materia
En **"Asignación Académica"** (`AcademicLoad.vue`), el directivo vincula qué docente es el titular responsable de impartir cada materia en cada grupo específico para el año lectivo en curso. Esta asignación es la llave que habilita al docente para calificar y tomar asistencia en dicho salón.

---

# 9. Gestión Curricular, Catálogo DBA y Coherencia

```
┌─────────────────────────────────────────────────────────────┐
│          CATÁLOGO NACIONAL DBA Y PLANEACIÓN ESCOLAR         │
├─────────────────────────────────────────────────────────────┤
│ 1. Catálogo Nacional MEN (Admin General):                   │
│    Importación PDF -> DBA -> Evidencias Oficiales (V2 2016) │
│                                                             │
│ 2. Planeación Institucional (Directivo):                    │
│    Competencia (sync_uuid) ───[🔒 Candado 1-to-1]──> Evidencias│
│                                                             │
│ 3. Evaluación en Aula (Docente):                            │
│    Actividades Evaluativas ──> Evidencia Planeada [✓ CUMPLE]│
│                            ──> Evidencia No Planeada [⚠️ EXTRA]│
└─────────────────────────────────────────────────────────────┘
```

## 9.1 Catálogo Nacional de Derechos Básicos de Aprendizaje (DBA)
El sistema incorpora el estándar oficial de los **Derechos Básicos de Aprendizaje (DBA)** del Ministerio de Educación Nacional de Colombia. Los DBA estructuran los saberes fundamentales que los estudiantes deben alcanzar por área y grado.

## 9.2 Importación masiva desde PDF y asignación de versiones curriculares
- **Importación Masiva:** El Administrador General puede cargar documentos PDF oficiales del MEN; el parser extrae automáticamente los enunciados y evidencias de aprendizaje numeradas.
- **Asignación Curricular:** La superadministración asigna la versión curricular correspondiente (ej. *V2 2016*) a cada institución educativa.

## 9.3 Planeación de Multicompetencias y sincronización en caliente (`sync_uuid`)
Los directivos estructuran las competencias por materia y periodo:
- **Multicompetencias:** Se permite definir múltiples competencias pedagógicas dentro de un mismo periodo escolar.
- **Sincronización de Cursos Paralelos:** Al guardar una competencia para un grado con múltiples secciones (ej. 1A, 1B y 1C), el sistema genera un identificador común (`sync_uuid`). Cualquier edición en la descripción o evidencias se propaga en cascada en una sola transacción a todos los grupos paralelos.
- **Verificación de Uso (`usage-check`):** Si los docentes ya han registrado actividades o notas sobre una competencia, su estructura queda protegida contra alteraciones destructivas.

## 9.4 Vinculación de evidencias oficiales con candado de colisión (🔒)
- **Regla de Exclusividad 1-to-1 (`RN-DBA-001`):** Una evidencia oficial del catálogo DBA solo puede estar vinculada a **máximo una competencia** en el mismo grado, materia y año lectivo.
- **Bloqueo Visual:** En el modal de planeación, las evidencias ya planificadas en otros periodos se despliegan bloqueadas con un icono de candado (🔒) y advertencia visual para evitar duplicidades curriculares.

## 9.5 Registro de Evidencias Extras y justificación docente
Si un docente decide evaluar en el aula una evidencia del catálogo que no fue planificada para el periodo actual (Evidencia Extra o Desvío):
1. El sistema despliega un aviso de desvío curricular.
2. El docente debe seleccionar un motivo institucional predefinido.
3. Si el motivo seleccionado es **"OTRO"**, es **estrictamente obligatorio redactar una justificación pedagógica detallada** (`justificacion_extra`) antes de guardar la actividad.

## 9.6 Analítica: Reporte de Coherencia Curricular vs. Cobertura del Catálogo
En el panel directivo (`DbaReportsView.vue`), los directivos disponen de dos tableros analíticos complementarios:

| Dimensión | 🎯 Reporte de Coherencia Curricular | 📊 Reporte de Cobertura del Catálogo |
|---|---|---|
| **Pregunta Pedagógica** | *¿De lo que los profesores evaluaron en clase, qué porcentaje siguió fielmente la planeación aprobada?* | *¿Del catálogo completo del MEN asignado al colegio, cuánto temario ya se cubrió al menos una vez?* |
| **Denominador de Cálculo** | Total de evaluaciones docentes aplicadas en el aula (`actividad_evidencia_dba`). | Total de evidencias oficiales vigentes en el catálogo nacional del MEN. |
| **Enfoque de Control** | Disciplina curricular y control de desvíos docentes no justificados. | Alcance, avance temático global y cumplimiento de estándares del Estado. |
| **Fórmula de Cálculo** | $$\text{Coherencia} = \frac{\text{Evidencias Planeadas}}{\text{Total Evaluadas}} \times 100$$ | $$\text{Cobertura} = \frac{\text{Evidencias Cubiertas}}{\text{Total Catálogo}} \times 100$$ |

---

# 10. Evaluación del Aprendizaje y Calificaciones

## 10.1 Estructura evaluativa ponderada (Actividades y Criterios al 100%)
La evaluación de los estudiantes se rige bajo una estructura porcentual estricta:
```
Asignatura (Materia en el Periodo)
   └── Actividades Académicas (Sumatoria de porcentajes = 100.00%)
          └── Criterios Evaluativos Opcionales (Sumatoria de porcentajes = 100.00%)
```
- Si la actividad tiene criterios (ej. Taller: 50% Presentación, 50% Sustentación), las notas se registran por criterio y el sistema promedia la actividad.
- Si no tiene criterios, la nota se asienta directamente sobre la actividad.

## 10.2 Planilla de calificaciones interactiva y cálculo en caliente
1. El docente ingresa a **"Planilla de Calificaciones"**, seleccionando curso, materia y periodo activo.
2. Digita las calificaciones de los estudiantes dentro de la escala oficial (ej. 1.0 a 5.0).
3. La interfaz calcula en tiempo real los promedios ponderados y resalta en rojo las notas reprobatorias.

```
┌────────────────────────────────────────────────────────────────────────┐
│ PLANILLA DE CALIFICACIONES — 10-A — MATEMÁTICAS — PERIODO 1 (ABIERTO)  │
├───────────────────────┬────────────┬────────────┬──────────┬───────────┤
│ Estudiante            │ Taller 30% │ Examen 40% │ Proy 30% │ Definitiva│
├───────────────────────┼────────────┼────────────┼──────────┼───────────┤
│ 1. Gomez Perez, Juan  │    4.5     │    3.8     │   4.0    │  4.07 Alto│
│ 2. Rojas Diaz, Maria  │    2.5     │    3.0     │   3.0    │  2.85 Bajo│
└───────────────────────┴────────────┴────────────┴──────────┴───────────┘
```

## 10.3 Restricción de calificación por estado de matrícula
La planilla de notas valida que los alumnos cuenten con matrícula en estado `ACTIVA` o `APROBADA`. Cualquier intento de calificar a estudiantes en estado `TRASLADADA`, `CANCELADA` o retirados es rechazado por el backend con error `409 Conflict`.

## 10.4 Portal de consulta para estudiantes y acudientes
Estudiantes y acudientes pueden ingresar a sus respectivos portales para consultar el desglose detallado de las actividades evaluadas, los porcentajes de cada tarea y la nota acumulada de la materia.

---

# 11. Convivencia Escolar y Control de Asistencia

## 11.1 Registro diario de asistencia y estados tipificados
El docente toma asistencia en cada bloque académico marcando a los estudiantes bajo 4 estados:
- **`PRESENTE`:** Asistencia normal a la clase (cargado por defecto para agilizar el proceso).
- **`AUSENTE`:** Inasistencia injustificada. Suma al ausentismo general del estudiante.
- **`TARDE`:** Llegada con retraso al aula de clase.
- **`JUSTIFICADA`:** Inasistencia justificada por excusa médica o calamidad familiar (no penaliza en el boletín).

## 11.2 Regla de límite físico diario: Máximo 7 bloques de clase
Para garantizar la veracidad de la jornada escolar y evitar errores de duplicación accidental:
- **Límite Estricto:** Ningún estudiante puede tener más de **7 bloques de asistencia registrados en un mismo día** (`RN-ASI-002`).
- Si un docente intenta guardar una planilla que exceda este límite físico, el sistema aborta la operación y señala el nombre del alumno para su verificación.

## 11.3 Observador del Alumno: Tipología de anotaciones formativas
Las anotaciones de seguimiento pedagógico y convivencia se clasifican en:
1. **`ACADEMICA`:** Recomendaciones formativas sobre el aprendizaje (obligatoria para el boletín).
2. **`CONVIVENCIA`:** Relaciones interpersonales, respeto y trabajo en equipo.
3. **`DISCIPLINARIA`:** Llamados de atención formales del manual de convivencia.
4. **`OTRO`:** Reconocimientos deportivos, culturales o destrezas destacadas.

## 11.4 Obligatoriedad de la observación académica para el cierre
Para poder ejecutar el cierre de periodo de una materia, el docente debe haber registrado de forma obligatoria al menos una observación de tipo **`ACADEMICA`** para cada estudiante activo del curso (`RN-OBS-002`).

---

# 12. Cierre de Periodos, Consolidación y Boletines Oficiales

## 12.1 Consolidación y Cierre de Materia por el Docente
1. Al culminar el periodo, el docente ingresa a **"Cierre de Materia"**.
2. Verifica los promedios calculados y las observaciones académicas.
3. Presiona **"Cerrar Materia"**. El sistema consolida los resultados en la tabla `resultado_academico` y estampa el estado `CERRADO` en `cierre_materia`.

## 12.2 Cierre Institucional del Periodo por el Rector
1. El directivo ingresa a **"Cierres de Periodo"** (`PeriodClosure.vue`).
2. La consola muestra una barra de progreso con el porcentaje de materias cerradas por los profesores.
3. Una vez alcanzado el **100% de materias cerradas**, se habilita el botón **"Ejecutar Cierre Institucional"**, congelando el periodo de forma oficial e inmutable.

## 12.3 Motor de generación de Boletines PDF oficiales
Una vez cerrado el periodo institucionalmente, se desbloquea el generador de boletines en PDF (`BoletinGenerator.vue`):
- **Descarga en Bloque:** Genera un archivo consolidado con los boletines de todo un salón.
- **Descarga Individual:** Permite a directivos, acudientes y estudiantes descargar el boletín oficial con las notas definitivas, la escala valorativa, el total de inasistencias y las observaciones del docente.

## 12.4 Reapertura excepcional de cierre por materia
Si un docente cometió un error justificado de digitación, el Rector puede ejecutar la opción **"Reabrir Materia"** (`reopenSubjectClosure`). Esto rehabilita temporalmente la planilla de esa materia específica para ese docente, sin necesidad de reabrir el periodo institucional completo de la escuela.

---

# 13. Seguimiento Académico, Promoción y Graduación Anual

## 13.1 Consola de Aprobados: Rendimiento por Periodo vs. Acumulado (P1..PN)
En la consola de seguimiento directivo (`/dashboard/gestion-aprobados`), los directivos disponen de tres herramientas de análisis:
1. **Seguimiento por Periodo Individual:** Desglose de aprobados y reprobados en un trimestre concreto.
2. **Seguimiento Acumulado (Períodos 1..N):** Calcula el promedio ponderado consolidado desde el Periodo 1 hasta el Periodo N actual, identificando asignaturas en riesgo de reprobación anual.
3. **Historial del Estudiante:** Línea de tiempo académica multianual del alumno en la institución.

## 13.2 Registro de decisiones directivas de promoción anual
Al finalizar el último periodo del año lectivo, el directivo registra la resolución institucional en `decision_promocion_directivo`:
- `PROMOVER_SIGUIENTE_GRADO`
- `MANTENER_GRADO` (Reprobación)
- `MATRICULA_CONDICIONADA`
- `OTRA_DECISION`

## 13.3 Detección de Graduandos (Último Año) y generación del libro de graduados
- **Detección Dinámica:** El sistema identifica automáticamente cuál es el grado de mayor nivel configurado en el colegio (ej. Grado Once) sin nombres fijos en código.
- **Distintivo Visual:** Los estudiantes del último año se resaltan con la etiqueta 🎓 **"Último Año"** y se dispone del filtro rápido **"Solo Graduandos"**.
- **Graduación Automática:** Al registrar la decisión `PROMOVER_SIGUIENTE_GRADO` sobre un graduando, el sistema cambia su estado personal a `GRADUADO`, inscribe su registro oficial en la tabla `registro_graduados` y finaliza su ciclo escolar.

## 13.4 Advertencias académicas informativas en matrícula
Durante el proceso de matrícula regular en `FinalRegistration.vue`, si el estudiante reprobó el año lectivo anterior, el sistema despliega una **⚠️ Advertencia Académica Informativa** detallando las asignaturas reprobadas para apoyar la decisión directiva, sin bloquear administrativamente el trámite.

---

# 14. Gestión de Traslados de Estudiantes y Personal

```
┌─────────────────────────────────────────────────────────────┐
│             WORKFLOW DE TRASLADO INTERINSTITUCIONAL         │
├─────────────────────────────────────────────────────────────┤
│ Solicitud de Traslado:                                      │
│   [ Sede Origen ] ───( Cupos en Destino )───> [ Sede Destino]│
│                                                             │
│ Consenso Tripartito Requerido:                              │
│   1. [✓] Directivo Colegio Origen   (Autoriza salida)       │
│   2. [✓] Directivo Colegio Destino  (Asigna aula y jornada) │
│   3. [✓] Acudiente Legal / Usuario  (Aceptación formal)     │
│                                                             │
│ Ejecución Atómica (Kysely FOR UPDATE):                      │
│   - Matrícula Origen  ──> TRASLADADA (Bloqueo 409 Conflict) │
│   - Matrícula Destino ──> ACTIVA (Asignación grupo)         │
│   - Notificación Email Formal al Acudiente                  │
└─────────────────────────────────────────────────────────────┘
```

## 14.1 Modelo de Identidad Global: `TRASLADO_MATRICULA` vs. `TRASLADO_USUARIO`
En AcademiaNeiva el usuario posee una cuenta global única (`usuario`). Los traslados se tipifican en:
- **`TRASLADO_MATRICULA`:** Traslado de un estudiante regular entre dos instituciones del sistema.
- **`TRASLADO_USUARIO`:** Traslado laboral o administrativo de personal docente/directivo.

## 14.2 Workflow de Consenso Tripartito Obligatorio
Para formalizar un traslado interinstitucional se exige el voto favorable de **tres actores indispensables** (`RN-TRA-002`):
1. **`DIRECTIVO_ORIGEN`:** Certifica la desvinculación y paz y salvo del alumno.
2. **`DIRECTIVO_DESTINO`:** Comprueba la disponibilidad de cupos y acepta la admisión.
3. **`USUARIO`:** El Padre de Familia / Acudiente legal registrado emite la aprobación final.
*(El Administrador General posee facultad de aprobación o intervención administrativa extraordinaria).*

## 14.3 Validación en tiempo real de cupos por grado y asignación de grupo
- **Comprobación de Cupos:** Antes de autorizar, el sistema valida que existan cupos en el grado escolar en el colegio destino. Si no hay cupos, la aprobación se bloquea exigiendo rechazo motivado.
- **Asignación en Aprobación:** El directivo receptor selecciona en el mismo modal de aprobación la jornada y el salón físico (`id_grupo_destino`) respetando la preferencia del acudiente.

## 14.4 Bloqueo operativo en origen y preservación de roles laborales
- **Aislamiento en Origen:** Al ejecutarse el traslado, la matrícula de origen pasa a `TRASLADADA` y queda congelada como histórico. Cualquier intento de asentar notas o asistencias en origen es abortado con error `409 Conflict`.
- **Preservación de Roles Familiares vs. Laborales:** Si el acudiente trasladado labora como docente en el colegio de origen, sus funciones laborales permanecen `ACTIVAS` en `usuario_colegio`, garantizando total independencia institucional.

## 14.5 Traslado interno de grupo/sección con notificación por email
Si un estudiante es cambiado de salón dentro del mismo colegio (ej. de 10-A a 10-B):
1. El directivo realiza el cambio desde la ficha del alumno requiriendo un **motivo obligatorio**.
2. El sistema actualiza el grupo y despacha un correo HTML formal al acudiente informando la reasignación.

---

# 15. Supervisión Extraordinaria y Acompañamiento Pedagógico

## 15.1 Supervisión Extraordinaria del Administrador General
Regula el acceso de la superadministración a los datos privados de un colegio:
1. El Administrador General radica una solicitud registrando el motivo técnico/pedagógico.
2. El Rector del colegio recibe la notificación e ingresa **obligatoriamente su contraseña personal (re-autenticación)** para autorizar la sesión.
3. **Modos de Sesión:**
   - **`SOLO_LECTURA`:** Permite inspeccionar datos y reportes; peticiones de escritura retornan `403 Forbidden`.
   - **`EDITOR`:** Permite corregir registros curriculares, exigiendo redactar un motivo de cambio en cada guardado.
4. **Tiempo Límite:** La sesión expira automáticamente al cumplirse los minutos autorizados, cerrando el acceso y notificando al Rector.

## 15.2 Acompañamiento Pedagógico Directivo (Modo Espejo)
Permite a rectores y coordinadores ingresar a los portales de sus docentes, alumnos y acudientes para brindar asesoría pedagógica:
- **Banner Ámbar:** El encabezado despliega un banner de color ámbar indicando el nombre del usuario supervisado.
- **Modo Solo Lectura Estricto:** Se deshabilitan los botones de registro de notas, asistencias y tickets.
- **Bloqueo de Rutas Sensibles:** El router bloquea el acceso a `/dashboard/gestion-traslados` durante el seguimiento.
- **Aislamiento en Docentes Multi-Colegio:** Si el docente trabaja en otros planteles, el directivo **únicamente visualiza las asignaturas de su propio colegio**, respetando la soberanía institucional.

## 15.3 Inmutabilidad de auditoría mediante triggers SQL
Todas las acciones realizadas durante la supervisión del Administrador General se registran en `auditoria_acciones_realizadas` almacenando el estado anterior y nuevo en formato `JSONB`. Triggers SQL protegen las tablas contra operaciones `DELETE` o `UPDATE`, garantizando registros inalterables para auditorías gubernamentales.

---

# 16. Mesa de Ayuda, Soporte Técnico y Gestión de Tickets

## 16.1 Radicación de incidencias y Códigos Base36 Ofuscados
- **Radicación:** Tanto visitantes anónimos como usuarios autenticados pueden radicar tickets categorizados (`TÉCNICO`, `CALIFICACIONES`, `ASISTENCIA`, etc.).
- **Código Base36 Ofuscado:** El sistema genera códigos únicos no secuenciales (ej. `TKT-1B3X9H7Z`) combinando Año + ID Colegio + Documento + ID Ticket, previniendo ataques de enumeración y scraping.

```
┌─────────────────────────────────────────────────────────────┐
│                 RADICAR TICKET DE SOPORTE                   │
├─────────────────────────────────────────────────────────────┤
│ Tipo de Incidencia: [ Problema Calificaciones             ▼]│
│ Asunto:             [ Inconsistencia en promedio Materia   ]│
│ Descripción:                                                │
│ [ Al cerrar la materia de Física 10-A, la nota del         ]│
│ [ estudiante no computa la actividad evaluativa 2.         ]│
│                                                             │
│ Código Asignado:    [ TKT-1B3X9H7Z                        ] │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                  [ ENVIAR TICKET ]                      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 16.2 Regla de Turnos de Conversación (Ping-Pong)
Para asegurar un diálogo ordenado en el seguimiento del ticket:
- El remitente (usuario o visitante) **únicamente puede enviar una respuesta si el último mensaje del hilo fue emitido por la institución o soporte**.
- Si el último mensaje es del remitente, el área de texto y el botón de responder se deshabilitan en la interfaz (`RN-TKT-003`).

## 16.3 Escalamiento al Administrador General y badges estáticos
- Los directivos pueden resolver casos de su sede o **escalar tickets complejos** a la superadministración.
- Al escalar un ticket, para el colegio se renderiza como una **insignia estática de solo lectura** (`Escalado`), impidiendo alteraciones locales mientras el Administrador General atiende el caso.

## 16.4 Inmutabilidad de tickets resueltos e incidencias de reingreso
- **Tickets Resueltos:** Al marcar un ticket como `RESUELTO`, queda sellado permanentemente en modo solo lectura.
- **Tickets de Reingreso:** Al pasar una incidencia de tipo `REINGRESO` al estado `EN_PROCESO`, la acción es irreversible y despacha un correo electrónico informativo al acudiente.

---

# 17. Guía Operativa por Roles de Usuario

## 17.1 Administrador General
1. Creación y licenciamiento de instituciones educativas.
2. Gestión y actualización del Catálogo Nacional de DBA (importación PDF).
3. Atención y resolución de tickets de soporte escalados a nivel nacional.
4. Radicación de solicitudes de Supervisión Extraordinaria para auditorías en colegios.

## 17.2 Directivo (Rector / Coordinador)
1. Parametrización institucional: Años lectivos, periodos, escalas y jornadas escolares.
2. Administración de grados, salones, aforos y asignación de materias (`detalle_grados`).
3. Planeación curricular de competencias y vinculación de evidencias DBA con candado (🔒).
4. Gestión de matrículas, reingresos y consenso tripartito de traslados.
5. Supervisión pedagógica a usuarios en Modo Espejo (Banner Ámbar).
6. Cierre institucional de periodos y emisión de boletines PDF.
7. Registro de promociones anuales y graduación automática en la Consola de Aprobados.

## 17.3 Docente
1. Consulta de cursos y asignaturas asignadas en el año lectivo.
2. Planeación de actividades evaluativas (100%) y criterios de evaluación (100%).
3. Justificación obligatoria de Evidencias Extras/Desvíos del catálogo DBA.
4. Registro de notas en la planilla interactiva y cálculo de promedios en caliente.
5. Toma diaria de asistencia respetando el límite físico de 7 bloques.
6. Diligenciamiento del observador del alumno (observación académica obligatoria).
7. Ejecución del Cierre de Materia al finalizar cada periodo escolar.

## 17.4 Padre de Familia / Acudiente Legal
1. Inscripción pública y seguimiento de matrícula con Token UUID.
2. Consulta en tiempo real de calificaciones, tareas y notas acumuladas de sus hijos.
3. Monitoreo del registro diario de asistencias e inasistencias.
4. Lectura de anotaciones del observador del alumno.
5. Descarga de boletines oficiales de periodos cerrados.
6. Aprobación formal en solicitudes de traslado interinstitucional de sus acudidos.

## 17.5 Estudiante
1. Inicio de sesión mediante código institucional único (`EST-XXXXXX`).
2. Consulta de calificaciones por actividad y promedios por asignatura.
3. Consulta de historial de asistencia y llamados de atención en el observador.
4. Descarga de boletines oficiales una vez consolidado el periodo escolar.

---

# 18. Diagnóstico de Errores Frecuentes y Soluciones

| Mensaje de Error en Pantalla | Causa Técnica | Procedimiento de Solución |
|---|---|---|
| *"Código OTP expirado o inválido"* | Transcurrieron más de 15 minutos desde la emisión del código. | Presione *"Reenviar Código OTP"* y digite el nuevo código recibido en su buzón. |
| *"Límite diario de asistencia superado"* | Se intentó registrar más de 7 bloques de clase para un alumno el mismo día. | Verifique la fecha y la jornada; el sistema impide físicamente superar 7 bloques diarios (`RN-ASI-002`). |
| *"El periodo académico se encuentra cerrado"* | Se intentó calificar o registrar asistencia en un trimestre consolidado. | Los datos son inmutables. Si requiere un ajuste, solicite al Rector la reapertura temporal de su materia. |
| *"No se puede cerrar el periodo institucional"* | Existen asignaturas con cierre de materia en estado `ABIERTO`. | Ingrese a la consola de cierre y compruebe qué docentes faltan por consolidar sus materias. |
| *"Acceso denegado (403 Forbidden)"* | Intentó modificar datos mientras se encontraba en Modo Supervisión o Acompañamiento. | El modo de seguimiento directivo es de **Solo Lectura**. Salga del modo para realizar tareas administrativas. |
| *"Capacidad de cupos agotada para este grado"* | La institución destino del traslado no posee cupos disponibles en el grado solicitado. | El directivo receptor debe denegar motivadamente el traslado o ampliar los cupos del aula si la infraestructura lo permite. |

---

# 19. Buenas Prácticas y Seguridad de la Información

1. **Custodia de Credenciales:** Nunca comparta su clave de acceso. Recuerde que el sistema audita con nombre y marca temporal cada modificación efectuada.
2. **Registro Oportuno:** Diligencie la asistencia y las notas de actividades en las fechas programadas para mantener sincronizados los tableros analíticos de los acudientes.
3. **Verificación Previa a Cierres:** Revise minuciosamente las planillas antes de ejecutar el Cierre de Materia; una vez que el Rector cierra el periodo institucional, las notas se congelan de forma legal.
4. **Cierre Seguro de Sesión:** Especialmente en equipos de cómputo compartidos o salas de docentes, cierre siempre su sesión desde el menú de usuario.

---

*Manual de Usuario Oficial del Ecosistema AcademiaNeiva — Versión 2.5.0 — Publicado el 17 de Agosto de 2026.*
