# 📘 MANUAL DE USUARIO — ACADEMIA NEIVA

**Sistema de Gestión Académica Institucional Multitenant — AcademiaNeiva**  
**Guía Operativa y Manual de Procedimientos para Usuarios del Sistema**  
**Versión:** 2.5.0  
**Fecha:** 16 de Agosto de 2026  
**Audiencia:** Administradores Generales, Directivos (Rectores y Coordinadores), Docentes, Padres de Familia / Acudientes y Estudiantes  

---

## Tabla de Contenido

- [1. Introducción](#1-introducción)
  - [1.1 Objetivo del manual](#11-objetivo-del-manual)
  - [1.2 Alcance](#12-alcance)
  - [1.3 Descripción general del sistema](#13-descripción-general-del-sistema)
- [2. Requisitos de acceso](#2-requisitos-de-acceso)
  - [2.1 Requisitos del dispositivo](#21-requisitos-del-dispositivo)
  - [2.2 Navegadores compatibles](#22-navegadores-compatibles)
  - [2.3 Acceso al sistema](#23-acceso-al-sistema)
- [3. Acceso y autenticación](#3-acceso-y-autenticación)
  - [3.1 Inicio de sesión](#31-inicio-de-sesión)
  - [3.2 Recuperación de contraseña](#32-recuperación-de-contraseña)
  - [3.3 Cierre de sesión](#33-cierre-de-sesión)
- [4. Navegación del sistema](#4-navegación-del-sistema)
  - [4.1 Panel principal](#41-panel-principal)
  - [4.2 Menú de navegación](#42-menú-de-navegación)
  - [4.3 Notificaciones](#43-notificaciones)
  - [4.4 Perfil de usuario](#44-perfil-de-usuario)
- [5. Gestión de colegios](#5-gestión-de-colegios)
  - [5.1 Selección del colegio](#51-selección-del-colegio)
  - [5.2 Información del colegio](#52-información-del-colegio)
  - [5.3 Administración según permisos](#53-administración-según-permisos)
- [6. Gestión de usuarios](#6-gestión-de-usuarios)
  - [6.1 Registro de usuarios](#61-registro-de-usuarios)
  - [6.2 Consulta de usuarios](#62-consulta-de-usuarios)
  - [6.3 Edición de usuarios](#63-edición-de-usuarios)
  - [6.4 Roles y permisos](#64-roles-y-permisos)
  - [6.5 Activación y desactivación](#65-activación-y-desactivación)
- [7. Matrícula](#7-matrícula)
  - [7.1 Registro de estudiantes](#71-registro-de-estudiantes)
  - [7.2 Proceso de matrícula](#72-proceso-de-matrícula)
  - [7.3 Renovación de matrícula](#73-renovación-de-matrícula)
  - [7.4 Reingreso](#74-reingreso)
  - [7.5 Traslado](#75-traslado)
  - [7.6 Consulta del estado de matrícula](#76-consulta-del-estado-de-matrícula)
- [8. Gestión académica](#8-gestión-académica)
  - [8.1 Gestión de grados y grupos](#81-gestión-de-grados-y-grupos)
  - [8.2 Gestión de asignaturas](#82-gestión-de-asignaturas)
  - [8.3 Registro de calificaciones](#83-registro-de-calificaciones)
  - [8.4 Consulta de calificaciones](#84-consulta-de-calificaciones)
  - [8.5 Seguimiento académico](#85-seguimiento-académico)
  - [8.6 Promoción y reprobación](#86-promoción-y-reprobación)
- [9. Funcionalidades según rol](#9-funcionalidades-según-rol)
  - [9.1 Administrador](#91-administrador)
  - [9.2 Directivo](#92-directivo)
  - [9.3 Docente](#93-docente)
  - [9.4 Padre o acudiente](#94-padre-o-acudiente)
  - [9.5 Estudiante](#95-estudiante)
- [10. Consultas y reportes](#10-consultas-y-reportes)
  - [10.1 Consulta de información académica](#101-consulta-de-información-académica)
  - [10.2 Consulta de estudiantes](#102-consulta-de-estudiantes)
  - [10.3 Generación de reportes](#103-generación-de-reportes)
  - [10.4 Exportación de información](#104-exportación-de-información)
- [11. Notificaciones](#11-notificaciones)
  - [11.1 Tipos de notificaciones](#111-tipos-de-notificaciones)
  - [11.2 Consulta de notificaciones](#112-consulta-de-notificaciones)
  - [11.3 Acciones sobre notificaciones](#113-acciones-sobre-notificaciones)
- [12. Errores y soluciones](#12-errores-y-soluciones)
  - [12.1 Problemas de inicio de sesión](#121-problemas-de-inicio-de-sesión)
  - [12.2 Problemas de acceso a módulos](#122-problemas-de-acceso-a-módulos)
  - [12.3 Problemas con registros](#123-problemas-con-registros)
  - [12.4 Mensajes de error frecuentes](#124-mensajes-de-error-frecuentes)
- [13. Buenas prácticas](#13-buenas-prácticas)
  - [13.1 Protección de credenciales](#131-protección-de-credenciales)
  - [13.2 Uso adecuado del sistema](#132-uso-adecuado-del-sistema)
  - [13.3 Manejo de información académica](#133-manejo-de-información-académica)
  - [13.4 Cierre de sesión](#134-cierre-de-sesión)
- [14. Soporte](#14-soporte)
  - [14.1 Reporte de problemas](#141-reporte-de-problemas)
  - [14.2 Información necesaria para reportar un problema](#142-información-necesaria-para-reportar-un-problema)
  - [14.3 Canales de soporte](#143-canales-de-soporte)

---

# 1. Introducción

## 1.1 Objetivo del manual
El presente **Manual de Usuario** tiene como finalidad guiar paso a paso a cada integrante de la comunidad educativa (Administradores, Rectores, Coordinadores, Docentes, Acudientes y Estudiantes) en la correcta utilización de las herramientas que ofrece la plataforma **AcademiaNeiva**. Proporciona instrucciones claras sobre cómo navegar por el sistema, realizar trámites de matrícula, registrar evaluaciones pedagógicas, emitir reportes y gestionar incidencias cotidianas.

## 1.2 Alcance
Este manual describe el funcionamiento operativo de los 21 módulos del sistema:
- Gestión y configuración institucional de colegios.
- Matrículas e inscripciones públicas con verificación de correo OTP.
- Control de usuarios, docentes, acudientes y estudiantes.
- Planeación curricular alineada con el Ministerio de Educación Nacional (MEN).
- Calificaciones continuas, asistencia diaria y observador del alumno.
- Cierres de periodo y generación oficial de boletines de notas en PDF.
- Acompañamiento pedagógico directo a usuarios por parte de directivos.
- Solicitud de traslados intercolegiados y mesa de ayuda de soporte técnico.

## 1.3 Descripción general del sistema
**AcademiaNeiva** es un ecosistema integral de gestión escolar en la nube diseñado bajo un modelo Multi-Colegio seguro. Permite que cada institución mantenga su propia identidad visual (escudo y colores), su calendario escolar independiente y su autonomía académica, garantizando que la información estudiantil permanezca protegida, confidencial e inalterable una vez finalizado cada periodo académico.

---

# 2. Requisitos de acceso

## 2.1 Requisitos del dispositivo
- **Computadores de Escritorio o Portátiles**: Procesador de 1.5 GHz o superior, memoria RAM mínima de 2 GB. Resolución de pantalla recomendada: 1280x720 píxeles o superior.
- **Dispositivos Móviles y Tablets**: Teléfonos inteligentes Android (versión 8.0+) o iOS (versión 13.0+) con conexión estable a Internet (Wi-Fi o datos móviles 4G/5G).

## 2.2 Navegadores compatibles
Para una experiencia óptima y segura, se recomienda utilizar las versiones más recientes de:
- **Google Chrome** (v100 o superior) — *Recomendado*.
- **Mozilla Firefox** (v100 o superior).
- **Microsoft Edge** (v100 o superior).
- **Apple Safari** (v14 o superior).

> [!NOTE]
> No se recomienda el uso de navegadores desactualizados como Internet Explorer, ya que no soportan los estándares modernos de cifrado y diseño reactivo del sistema.

## 2.3 Acceso al sistema
1. Abra su navegador web de preferencia.
2. Ingrese la dirección URL oficial provista por su institución educativa (ejemplo: `https://academianeiva.edu.co`).
3. El sistema desplegará la página de bienvenida (**Landing Page**) desde donde podrá acceder al inicio de sesión, consultar inscripciones o radicar solicitudes de soporte técnico.

---

# 3. Acceso y autenticación

## 3.1 Inicio de sesión

```
┌─────────────────────────────────────────────────────────────┐
│                      ACADEMIA NEIVA                         │
│                    Inicio de Sesión                         │
├─────────────────────────────────────────────────────────────┤
│  Correo Electrónico / Código:                               │
│  [ usuario@colegio.edu.co / EST-104932                    ] │
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

### Pasos para ingresar:
1. En la pantalla principal, presione el botón **"Iniciar Sesión"**.
2. **Para Personal Administrativo, Docentes y Padres**: Digite su correo electrónico institucional o personal registrado.
3. **Para Estudiantes**: Digite su código único de estudiante (ej. `EST-104932`) o correo electrónico asignado.
4. Digite su contraseña de acceso.
5. Presione **"Iniciar Sesión"**. El sistema validará sus credenciales y lo redirigirá a su panel de control correspondiente.

## 3.2 Recuperación de contraseña
Si ha olvidado su clave de acceso:
1. En la pantalla de login, haga clic en el enlace **"¿Olvidó su contraseña?"**.
2. Escriba su correo electrónico registrado y presione **"Enviar Enlace de Recuperación"**.
3. Revise su bandeja de entrada (y la carpeta de *Spam* o *Correo no deseado*).
4. Abra el correo recibido y haga clic en el botón **"Restablecer Contraseña"** (el enlace tiene una validez máxima de 1 hora).
5. Ingrese y confirme su nueva contraseña (mínimo 6 caracteres).
6. Presione **"Guardar Nueva Contraseña"** e inicie sesión normalmente.

## 3.3 Cierre de sesión
Para proteger la privacidad de sus datos, especialmente en computadores compartidos:
1. Ubique su nombre o avatar en la esquina superior derecha de la barra superior.
2. Despliegue el menú de usuario y haga clic en **"Cerrar Sesión"**.
3. El sistema invalidará de inmediato su sesión activa y lo retornará a la pantalla de ingreso.

---

# 4. Navegación del sistema

## 4.1 Panel principal (Dashboard)
Al iniciar sesión, el sistema le presentará su panel de control personalizado según su rol:
- **Directivos**: Métricas generales del colegio (total de matriculados, cupos disponibles, docentes activos, alertas de asistencia y solicitudes pendientes).
- **Docentes**: Listado de asignaturas asignadas, accesos directos para calificar y registrar asistencia del día.
- **Estudiantes y Padres**: Resumen de asignaturas, calificaciones parciales acumuladas, porcentaje de asistencia y comunicados institucionales.

## 4.2 Menú de navegación (Sidebar)
Ubicado en el lateral izquierdo de la pantalla:
- Permite acceder a los diferentes módulos autorizados para su perfil.
- Puede colapsarse o expandirse mediante el icono de menú (**☰**) para maximizar el área de trabajo en pantallas reducidas.

## 4.3 Notificaciones
- En la barra superior encontrará el icono de campana (**🔔**).
- Al hacer clic, se desplegará un menú con alertas importantes: inconsistencias de documentos en matrículas, apertura o cierre de periodos, llamados de atención del observador o respuestas a tickets de soporte.

## 4.4 Perfil de usuario ("Mi Cuenta")
Para consultar o actualizar su información de contacto:
1. Haga clic en su nombre en la esquina superior derecha y seleccione **"Mi Perfil"**.
2. Podrá actualizar su número telefónico de contacto personal.
3. Para actualizar su correo electrónico: El sistema le enviará un **código de seguridad OTP de 6 dígitos** al nuevo correo para comprobar su autenticidad antes de guardar el cambio.

---

# 5. Gestión de colegios

## 5.1 Selección del colegio (Usuarios Multi-Colegio)
Si usted es un docente, directivo o acudiente vinculado a más de una institución educativa:
1. En la barra superior del sistema visualizará un menú desplegable con el nombre del colegio activo.
2. Haga clic sobre el selector y elija la institución a la que desea ingresar.
3. El sistema conmutará de inmediato el contexto, la paleta de colores corporativos y los datos académicos correspondientes al colegio seleccionado sin necesidad de volver a iniciar sesión.

## 5.2 Información del colegio
Los directivos pueden consultar y actualizar la información de su sede:
- Nombre oficial del plantel, código DANE y NIT.
- Calendario escolar (A o B).
- Personalización de la identidad visual: carga del escudo institucional y definición de colores primarios y secundarios.

## 5.3 Administración según permisos
- **Administrador General**: Crea, activa, suspende o cancela licencias de colegios a nivel nacional.
- **Directivo**: Configura las políticas internas, jornadas y directrices de su plantel asignado.

---

# 6. Gestión de usuarios

## 6.1 Registro de usuarios
- **Directivos y Coordinadores**: Son registrados y vinculados por el Administrador General.
- **Docentes**: Son dados de alta por los directivos escolares en el módulo de personal docente, requiriendo nombre, apellido, documento, correo y **número de teléfono de contacto**. Al registrarse, el sistema envía un correo de bienvenida automático con sus credenciales provisionales.
- **Estudiantes y Padres**: Son creados automáticamente por el sistema en el momento en que se aprueba y oficializa una matrícula escolar.

## 6.2 Consulta de usuarios
La consola de administración permite realizar búsquedas dinámicas mediante filtros por:
- Nombre o apellido.
- Número de documento de identidad.
- Rol en la institución (`Directivo`, `Docente`, `Estudiante`, `Padre`).
- Estado de cuenta (`Activo`, `Inactivo`).

## 6.3 Edición de usuarios
Los directivos pueden corregir datos de contacto (teléfonos, direcciones) y rectificar nombres en casos justificados.

## 6.4 Roles y permisos
Cada rol tiene acceso restringido a sus áreas de competencia:
- El docente solo puede calificar los cursos que tiene formalmente asignados.
- El estudiante solo puede consultar su propio expediente.
- El padre de familia solo puede ver la información de sus hijos legalmente vinculados.

## 6.5 Activación y desactivación de cuentas
Si un docente o padre de familia se retira del plantel:
1. El directivo ingresa a la ficha del usuario y selecciona la opción **"Inactivar Cuenta"**.
2. Al confirmar, el sistema inhabilita el acceso de forma inmediata y desconecta cualquier sesión activa del usuario mediante el cierre forzado de sesión.

---

# 7. Matrícula

## 7.1 Registro de estudiantes (Inscripción Pública)
Los acudientes o aspirantes pueden solicitar cupo escolar desde la página pública del colegio:

```
┌─────────────────────────────────────────────────────────────┐
│               FORMULARIO DE ADMISIÓN ESCOLAR                │
├─────────────────────────────────────────────────────────────┤
│ 1. Verificación de Correo:                                  │
│    Correo del Acudiente: [ acudiente@gmail.com            ] │
│    [ Enviar Código OTP ] -> Código: [ 4 8 2 9 1 0 ] [✓ OK] │
│                                                             │
│ 2. Datos del Estudiante:                                    │
│    Nombres: [ Santiago         ] Apellidos: [ Rojas Perez ] │
│    Tipo Doc: [ Tarjeta Identidad ] Número: [ 1075283941   ] │
│    Teléfono de Contacto: [ 3105551234                     ] │
│                                                             │
│ 3. Documentos Digitales Adjuntos (Máx 5MB c/u):             │
│    - Registro Civil / T.I.  [ Seleccionar Archivo... ] [✓]  │
│    - Certificado de Salud   [ Seleccionar Archivo... ] [✓]  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │             [ ENVIAR SOLICITUD DE MATRÍCULA ]           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Pasos:
1. Ingrese el correo del acudiente y solicite el **Código OTP de Verificación**.
2. Digite el código de 6 dígitos recibido en su buzón de correo.
3. Diligencie los datos personales del alumno y los teléfonos de contacto.
4. Adjunte los documentos requeridos en formato PDF o imagen (máximo 5 MB por archivo).
5. Envíe la solicitud. El sistema le generará un **Token de Seguimiento** (código UUID) para consultar el estado de su trámite.

## 7.2 Proceso de matrícula (Gestión Directiva)
1. El directivo ingresa al módulo **"Matrículas"** y revisa las solicitudes en estado `PENDIENTE`.
2. Inspecciona cada documento adjunto: puede marcarlo como **Aprobado** o **Rechazado** (indicando el motivo de corrección).
3. Si todos los documentos son correctos, selecciona el **Grado y Salón** de destino (el sistema valida cupos en tiempo real).
4. Presiona **"Finalizar Matrícula"** para oficializar al estudiante y expedir sus credenciales.

## 7.3 Renovación de matrícula
Para estudiantes antiguos que continúan en el siguiente año lectivo, el directivo actualiza su grado de promoción y confirma la renovación del cupo.

## 7.4 Reingreso de estudiantes retirados
1. Si un estudiante que estuvo en estado `RETIRADO` solicita volver a la institución, el directivo accede al módulo **"Reingresos"**.
2. Consulta el historial del alumno y verifica el motivo de retiro registrado previamente.
3. El sistema carga la matriz documental: los documentos vigentes se conservan y solo se solicitan los archivos desactualizados.
4. Se asigna salón con cupo disponible y se reactiva la matrícula escolar.

## 7.5 Traslado escolar
- **Traslado de Sede/Colegio**: Se gestiona desde el módulo de **"Traslados"**, permitiendo que un acudiente solicite el cambio de institución.
- El colegio de origen y el colegio de destino revisan y autorizan la solicitud para transferir el expediente del alumno de forma transparente.

## 7.6 Consulta del estado de matrícula
El acudiente puede ingresar en cualquier momento a la pestaña **"Consultar Matrícula"** en la página web pública, pegar su Token de Seguimiento y verificar si su solicitud está en revisión, aprobada o si debe subsanar algún documento rechazado.

---

# 8. Gestión académica

## 8.1 Gestión de grados y grupos
Permite estructurar los niveles formativos (Preescolar, Primaria, Secundaria, Media), definir los grados (Primero a Once) y crear los salones físicos (ej. 101, 102 / 10-A, 10-B) estableciendo el límite estricto de cupos por aula.

## 8.2 Gestión de asignaturas y Carga Docente
- Los directivos registran el catálogo de materias institucionales (Matemáticas, Lenguaje, Ciencias, etc.).
- En el módulo **"Asignación Académica" (`detalle_grados`)**, se vincula qué profesor es el responsable de dictar cada asignatura en cada grupo escolar.

## 8.3 Registro de calificaciones
1. El docente ingresa al módulo **"Planilla de Notas"** y selecciona el curso y periodo activo.
2. Crea las **Actividades Evaluativas** (talleres, evaluaciones, proyectos) asignándoles su peso porcentual (debe sumar exactamente el 100%).
3. Digita las notas de los estudiantes dentro del rango oficial de la escala (ej. 1.0 a 5.0).
4. El sistema calcula automáticamente los promedios ponderados en tiempo real.

```
┌────────────────────────────────────────────────────────────────────────┐
│ PLANILLA DE NOTAS — GRADO 10-A — MATEMÁTICAS — PERIODO 1 (ABIERTO)     │
├───────────────────────┬────────────┬────────────┬──────────┬───────────┤
│ Estudiante            │ Taller 30% │ Examen 40% │ Proy 30% │ Definitiva│
├───────────────────────┼────────────┼────────────┼──────────┼───────────┤
│ 1. Gomez Perez, Juan  │    4.5     │    3.8     │   4.0    │  4.07 Alto│
│ 2. Rojas Diaz, Maria  │    2.5     │    3.0     │   3.0    │  2.85 Bajo│
└───────────────────────┴────────────┴────────────┴──────────┴───────────┘
```

## 8.4 Consulta de calificaciones
- Los estudiantes y padres pueden ingresar a sus respectivos portales para observar el desglose detallado de notas por actividad y la nota acumulada de la materia.

## 8.5 Seguimiento académico y Asistencia
- **Toma de Asistencia**: El docente marca diariamente si el estudiante estuvo `PRESENTE`, `AUSENTE`, llegó `TARDE` o presentó falla `JUSTIFICADA` (el sistema restringe un máximo físico de 7 bloques de clase al día).
- **Observador del Alumno**: Registro de anotaciones formativas categorizadas en `ACADEMICA`, `CONVIVENCIA` o `DISCIPLINARIA`.

## 8.6 Promoción y reprobación anual
Al finalizar el último periodo del año lectivo:
1. El sistema consolida las notas definitivas anuales de todas las materias.
2. Clasifica automáticamente a los alumnos según los criterios del Sistema Institucional de Evaluación de los Estudiantes (SIEE - Decreto 1290): `Promovido`, `No Promovido` o `Pendiente de Recuperación`.
3. El directivo asienta y firma la resolución de promoción institucional.

---

# 9. Funcionalidades según rol

## 9.1 Administrador General
- Creación y licenciamiento de colegios en la plataforma.
- Mantenimiento del catálogo nacional de Derechos Básicos de Aprendizaje (DBA).
- Atención de incidencias y tickets escalados.
- **Supervisión Extraordinaria**: Solicitud de acceso temporal a un colegio con motivo y duración definida, requiriendo la aprobación con contraseña del Rector.

## 9.2 Directivo (Rector / Coordinador)
- Configuración del calendario escolar, periodos lectivos y escalas de notas.
- Oficialización de matrículas y asignación de cursos.
- **Acompañamiento Pedagógico (Seguimiento Directivo)**: Capacidad de presionar "Supervisar Panel" para inspeccionar la interfaz de cualquier profesor, alumno o acudiente en **Modo Solo Lectura** (con banner ámbar visible) para brindar asesoría pedagógica.
- Cierre institucional de periodos y generación de boletines PDF.

## 9.3 Docente
- Planeación de competencias curriculares sincronizadas con cursos paralelos.
- Registro continuo de notas, asistencia diaria y observador del alumno.
- Cierre de notas por asignatura (`Cierre de Materia`).

## 9.4 Padre o acudiente
- Vista unificada del rendimiento académico y disciplinario de todos sus hijos.
- Consulta de inasistencias en tiempo real y descarga de boletines oficiales.

## 9.5 Estudiante
- Consulta de tareas, actividades evaluativas programadas, calificaciones y faltas.
- Descarga de boletines oficiales de periodos cerrados.

---

# 10. Consultas y reportes

## 10.1 Consulta de información académica
Paneles interactivos con gráficos de rendimiento por asignatura, distribución de notas en la escala cualitativa (Bajo, Básico, Alto, Superior) y porcentaje de asistencia.

## 10.2 Consulta de estudiantes
Ficha consolidada del alumno con datos personales, historial de observador, sanciones activas y registro de matrículas históricas.

## 10.3 Generación de reportes (Boletines Oficiales)
1. Una vez que el Rector ejecuta el **Cierre Institucional del Periodo**, se habilita la opción de boletines.
2. El directivo o acudiente puede generar e imprimir el **Boletín de Calificaciones en PDF**, el cual consolida las notas, las fallas de asistencia, el puesto en el salón y la observación académica obligatoria del docente.

## 10.4 Exportación de información
Capacidad de exportar planillas de calificaciones y listados de asistencia para archivo físico o auditorías de la Secretaría de Educación.

---

# 11. Notificaciones

## 11.1 Tipos de notificaciones
- **Informativas**: Novedades institucionales y avisos de inicio de periodo.
- **Alertas Académicas**: Notificación de calificaciones bajas o inasistencias injustificadas.
- **Seguridad**: Avisos de cambio de correo electrónico con código OTP o inicio de sesión en modo acompañamiento.

## 11.2 Consulta de notificaciones
Haga clic en la campana de notificaciones (**🔔**) ubicada en la barra superior de la pantalla. Las notificaciones no leídas se resaltan con un distintivo numérico de color rojo.

## 11.3 Acciones sobre notificaciones
Puede hacer clic sobre una notificación para navegar directamente al módulo relacionado (ej. ir a corregir un documento de matrícula) o marcar todas las notificaciones como leídas.

---

# 12. Errores y soluciones

## 12.1 Problemas de inicio de sesión
- **"Credenciales incorrectas"**: Verifique que el correo o código de estudiante no contenga espacios accidentales al inicio o final. Recuerde que la contraseña distingue entre mayúsculas y minúsculas.
- **"Cuenta Inactiva o Suspendida"**: Comuníquese con la rectoría de su colegio para verificar el estado de su vinculación institucional.

## 12.2 Problemas de acceso a módulos
- **"Acceso Denegado (403 Forbidden)"**: Su rol de usuario no tiene permisos para acceder a esa sección o intentó realizar una modificación mientras se encontraba en **Modo Acompañamiento Pedagógico (Solo Lectura)**.

## 12.3 Problemas con registros
- **"El periodo académico se encuentra cerrado"**: El sistema no permite alterar notas, observaciones ni asistencias de periodos pasados. Si requiere una corrección, solicite al Rector la reapertura temporal de su materia.

## 12.4 Mensajes de error frecuentes

| Mensaje en Pantalla | Causa | Solución |
|---|---|---|
| *"Código OTP expirado o inválido"* | Pasaron más de 15 minutos desde la solicitud del código. | Solicite un nuevo código OTP en el formulario. |
| *"Límite diario de asistencia superado"* | Se intentó registrar más de 7 bloques de clase para un alumno el mismo día. | Verifique la fecha y la jornada de clase seleccionada. |
| *"No se puede cerrar el periodo institucional"* | Existen materias pendientes por cerrar por parte de los docentes. | Ingrese al panel de control y verifique qué docentes faltan por cerrar materia. |

---

# 13. Buenas prácticas

## 13.1 Protección de credenciales
- No comparta su contraseña con terceros ni la anote en lugares visibles.
- Si sospecha que alguien conoce su clave, cámbiela de inmediato desde la opción *"Mi Perfil"* o *"Recuperar Contraseña"*.

## 13.2 Uso adecuado del sistema
- Diligencie la asistencia al inicio de cada bloque de clase para mantener informados a los acudientes en tiempo real.
- Registre las notas de las actividades oportunamente para que los estudiantes conozcan su evolución académica.

## 13.3 Manejo de información académica
- Verifique cuidadosamente las calificaciones antes de realizar el **Cierre de Materia**.
- Recuerde que una vez cerrado el periodo escolar institucional por el Rector, los registros se congelan de forma legal e inmutable.

## 13.4 Cierre de sesión
- Cierre siempre su sesión antes de retirarse del equipo de cómputo, especialmente en salas de profesores o computadores públicos.

---

# 14. Soporte

## 14.1 Reporte de problemas (Módulo de Tickets)
Si experimenta un error técnico o tiene una duda sobre un proceso:
1. Diríjase a la opción **"Soporte y Mesa de Ayuda"** en el menú lateral o en la página web pública.
2. Haga clic en **"Crear Nuevo Ticket"**.
3. Seleccione el tipo de incidencia (`Técnico`, `Calificaciones`, `Matrícula`, `Otro`), asigne un asunto claro y describa detalladamente lo sucedido.
4. El sistema le asignará un código único de seguimiento (ej. `TKT-4K9L2Z`).

```
┌─────────────────────────────────────────────────────────────┐
│                 RADICAR TICKET DE SOPORTE                   │
├─────────────────────────────────────────────────────────────┤
│ Tipo de Incidencia: [ Problema Técnico                    ▼]│
│ Asunto:             [ Inconsistencia en promedio Materia   ]│
│ Descripción:                                                │
│ [ Al cerrar la materia de Física 10-A, la nota del         ]│
│ [ estudiante Juan Gomez no computa el taller 3.            ]│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                  [ ENVIAR TICKET ]                      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 14.2 Información necesaria para reportar un problema
Al reportar un incidente, proporcione:
- Su nombre completo, documento y rol.
- Nombre del colegio y grado/grupo afectado.
- Captura de pantalla del mensaje de error (si aplica).
- Explicación de los pasos que realizó antes de que ocurriera la falla.

## 14.3 Canales de soporte
- **Mesa de Ayuda Web**: Sección *"Soporte"* dentro de la plataforma AcademiaNeiva.
- **Correo Electrónico de Soporte Técnico**: `soporte@academianeiva.edu.co`
- **Atención Institucional**: Coordinación Académica de su establecimiento educativo.

---

*Manual de Usuario oficial de AcademiaNeiva — Versión 2.5.0 — Publicado el 16 de Agosto de 2026.*
