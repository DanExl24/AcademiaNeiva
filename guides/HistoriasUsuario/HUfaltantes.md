# Historias de Usuario Faltantes (HUfaltantes.md)

Este documento recopila las historias de usuario y criterios de aceptación de aquellas funcionalidades implementadas en el código (tanto en el frontend de Vue.js como en el backend de Express/PostgreSQL) que se encuentran operativas en el sistema pero **no han sido documentadas** en los archivos `jiraHU.md`, `JiraHUcomplementos.md` ni `adminGeneral.md`.

---

## MÓDULO DEL DIRECTIVO (GESTIÓN ACADÉMICA Y CONFIGURACIÓN)

### GA07: Edición de Capacidad (Cupos) de un Curso

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Modificar la cantidad total de cupos de un curso/grupo ya creado  
**Para:** Ajustar la disponibilidad de matrícula y cupos a la realidad operativa del plantel  

#### Criterios de Aceptación
- El directivo debe poder hacer clic en una opción de edición de cupos (`EditCuposModal`) para cada curso en la vista de Estructura Académica (`GradeManagement.vue`).
- El sistema debe validar que los cupos totales no sean un número negativo.
- El sistema debe impedir reducir la capacidad del curso por debajo de la cantidad de estudiantes que ya se encuentran formalmente matriculados en él.
- Al guardar los cambios, la vista debe actualizar la barra de progreso de ocupación y reflejar los nuevos cupos disponibles.

---

### GA08: Modo Editor de Tiempos Académicos (Zona de Riesgo)

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Acceder a un modo crítico de edición de años académicos bajo advertencia explícita de seguridad  
**Para:** Realizar cambios estructurales en el calendario de la institución (como reabrir/cerrar años lectivos o borrarlos permanentemente) en caso de contingencias  

#### Criterios de Aceptación
- La vista de periodos académicos (`AcademicPeriodsView.vue`) debe contar con un botón para ingresar al "Modo Editor".
- Al presionar el botón, el sistema debe desplegar un modal de advertencia crítica ("Zona de Riesgo") detallando las consecuencias de realizar borrados y cierres de años. El usuario debe aceptar los términos para ingresar.
- Una vez dentro del Modo Editor, se habilitará la opción para alternar el estado del año lectivo (ABIERTO / CERRADO).
- Se habilitará la opción de eliminar permanentemente el año lectivo. Para confirmar esta acción irreversible, el directivo deberá digitar textualmente la palabra "ELIMINAR" en un cuadro de diálogo del sistema (`prompt`).
- Si el año lectivo cuenta con periodos o registros activos vinculados, el backend debe impedir la eliminación protegiendo la consistencia de la base de datos.

---

### GA09: Auto-generación de Periodos al Registrar un Año Lectivo

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Que el sistema configure y autogenere de forma predeterminada los periodos correspondientes al crear un nuevo año  
**Para:** Agilizar la configuración inicial del calendario institucional sin tener que crear periodo por periodo  

#### Criterios de Aceptación
- Al registrar un nuevo año lectivo y seleccionar su calendario escolar (Calendario A o B), el sistema debe autogenerar en la base de datos 4 periodos estándar.
- Los periodos deben crearse con los nombres ("Primer Periodo", "Segundo Periodo", etc.), pesos (25% cada uno) y rangos de fechas (meses/días) aproximados según la normativa oficial de Colombia para el calendario seleccionado.
- Una vez creado, se debe mostrar un modal de éxito (`showYearSuccessAlert`) listando los periodos autogenerados y sus fechas de vigencia.

---

### GA10: Asignación y Ajuste del Rango de Fechas de Periodos

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Configurar el mes y día exacto de inicio y finalización de cada periodo académico  
**Para:** Restringir el ingreso de asistencias y calificaciones de los docentes a los rangos temporales correspondientes  

#### Criterios de Aceptación
- En el modal de creación y edición de periodos (`AcademicPeriodsView.vue`), el directivo debe poder seleccionar de forma independiente el mes y día de inicio, y el mes y día de fin.
- El sistema debe validar que los campos de fecha estén completos y que los días correspondan a rangos reales de calendario.
- El sistema debe guardar el periodo con la vigencia establecida y mostrar el rango temporal en el listado principal de periodos.

---

### GA11: Advertencia Crítica y Rescalado de Calificaciones

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Recibir una advertencia explícita antes de cambiar el rango de notas institucional  
**Para:** Prevenir modificaciones accidentales o no planificadas de calificaciones que requieran procesos de rescalado proporcional en la base de datos  

#### Criterios de Aceptación
- En el panel de configuración de escalas (`AcademicScalesView.vue`), si el directivo modifica la nota mínima o nota máxima y existen calificaciones en el sistema, el sistema debe desplegar un modal de advertencia.
- El modal debe detallar que se ejecutará una migración proporcional sobre todas las calificaciones registradas a la fecha (por ejemplo, convirtiendo una nota de 3.8/5 a una de 7.6/10) e indicar que esta es una acción crítica.
- El usuario debe confirmar de forma activa ("Confirmar y Rescalar") para proceder. El guardado y rescalado en la base de datos debe ejecutarse dentro de una transacción ACID en el servidor.

---

### GA12: Gestión de Materias Fantasma e Impacto de Eliminación

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Gestionar la eliminación segura de materias y visualizar las repercusiones antes de forzar su borrado  
**Para:** Controlar el impacto de la remoción en el historial académico y restaurar materias eliminadas por error  

#### Criterios de Aceptación
- Al intentar eliminar una materia en `SubjectManagement.vue`, si esta tiene dependencias, el sistema debe bloquear el borrado estándar y mostrar un botón para "Forzar Eliminación" junto a una caja de diagnóstico de impacto.
- El diagnóstico de impacto debe detallar la cantidad exacta de asignaciones docentes, competencias, actividades y notas que serán eliminadas.
- Al forzar la eliminación, el sistema debe generar y descargar automáticamente un archivo de reporte en formato Markdown (`.md`) con el resumen de la información eliminada permanentemente.
- La materia eliminada debe enviarse a una papelera de "Materias Fantasma". El directivo puede entrar a un visor detallado para ver el respaldo estático de asignaciones y restaurar la materia utilizando el mismo nombre para recuperar su estatus anterior.

---

## MÓDULO DEL DIRECTIVO (GESTIÓN DE MATRÍCULAS Y ESTUDIANTES)

### MR09: Drawer de Ficha Resumen de Estudiante

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Ver una ficha resumen interactiva con el estado general de un estudiante al seleccionarlo  
**Para:** Diagnosticar de manera oportuna su rendimiento escolar, alertas de inasistencia o disciplina y datos de acudiente sin cambiar de pantalla  

#### Criterios de Aceptación
- Al hacer clic sobre el nombre de un estudiante en la lista de gestión (`StudentManagement.vue`), el sistema debe abrir un panel lateral deslizable (Slide-Over Drawer).
- El drawer debe mostrar: nombre completo, código, curso/grupo, promedio general acumulado (GPA), número de materias reprobadas, inasistencias acumuladas y observaciones de convivencia.
- Si el estudiante tiene materias reprobadas, el drawer debe desplegar un listado con el nombre de la asignatura y la calificación actual.
- Debe incluir los datos de contacto del acudiente (nombre y correo) y registrar la fecha de última actividad del estudiante en el sistema.

---

### MR10: Monitoreo Directivo en Tiempo Real (Impersonación de Estudiantes)

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Entrar al portal de un estudiante en modo de solo lectura (impersonación)  
**Para:** Visualizar exactamente lo mismo que el alumno o su padre de familia ven en su panel y brindar soporte técnico o tutoría  

#### Criterios de Aceptación
- En el drawer de Ficha Resumen de Estudiante, debe existir un botón para "Ver Seguimiento Completo".
- Al presionarlo, el sistema debe actualizar el contexto de autenticación global (`auth.startStudentMonitoring`), inyectando el id del estudiante y redirigiendo al dashboard.
- La aplicación debe mostrar el portal del estudiante en modo de lectura, inhabilitando registros o cambios, y colocar un banner informativo en la parte superior para indicar que el modo monitoreo está activo, junto a la opción para salir y regresar al panel de directivo.

---

### MR11: Exportación de Estudiantes en Formato SIMAT (CSV)

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Exportar el roster oficial de estudiantes matriculados en un archivo CSV formateado para la plataforma nacional SIMAT  
**Para:** Reportar de forma masiva y digital la matrícula ante la Secretaría de Educación  

#### Criterios de Aceptación
- En la cabecera de la vista de Gestión de Estudiantes, debe visualizarse un botón para "Exportar SIMAT (CSV)".
- El archivo CSV generado debe estructurar correctamente los campos obligatorios del estudiante (código, nombres, apellidos, documento, tipo de documento, nivel escolar, grado, sección, jornada, email, datos de acudiente y estado).
- La descarga debe inyectar el Byte Order Mark (BOM) de UTF-8 (`\uFEFF`) al inicio del archivo para garantizar la correcta visualización de caracteres especiales (ñ, tildes) al ser abierto en herramientas como Microsoft Excel.

---

### GB03: Exportación en PDF del Boletín de Calificaciones (Directivo)

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Directivo  
**Quiero:** Exportar los boletines consolidados de los estudiantes de un curso en formato PDF  
**Para:** Imprimir o guardar localmente los reportes oficiales del periodo académico  

#### Criterios de Aceptación
- En el Generador de Boletines (`BoletinGenerator.vue`), al cargar la vista previa de boletines, el sistema debe habilitar el botón "Descargar en PDF".
- Al presionar el botón, el sistema debe renderizar y convertir los componentes de vista previa (`BoletinPreview`) a formato PDF de tamaño carta (Letter), orientación vertical (Portrait) y márgenes de 0.5 pulgadas.
- El sistema debe procesar las descargas de forma secuencial con un pequeño retardo (500 ms) para evitar cuellos de botella del navegador al realizar descargas masivas de todo un grupo.

---

## MÓDULO DEL DOCENTE

### TD02: Visualización Dual de Carga Académica (Grado y Materia)

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Docente  
**Quiero:** Alternar la organización de mi carga académica entre una vista agrupada por grados y otra agrupada por materias  
**Para:** Facilitar mi flujo de trabajo diario y revisar de forma más intuitiva mis grupos  

#### Criterios de Aceptación
- En el panel principal de cursos (`TeacherCourses.vue`), el docente debe poder alternar entre los modos "Por Grado" y "Por Materia".
- En el modo "Por Grado", se deben listar las tarjetas de grupos (con información de nivel y jornada coloreada) y sus respectivas materias asignadas.
- En el modo "Por Materia", se deben listar las materias asignadas y, dentro de cada una, tarjetas de los cursos asociados que dicta el docente.
- La barra de filtros debe permitir buscar por grado o materia y filtrar de forma síncrona según grado y jornada del colegio.

---

### TD03: Consulta Rápida de Alumnos Matriculados

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Docente  
**Quiero:** Visualizar el listado oficial de estudiantes pertenecientes a un curso asignado mediante una vista rápida emergente  
**Para:** Consultar códigos, nombres o documentos de identidad de mis estudiantes sin necesidad de ingresar a la planilla de notas o asistencia  

#### Criterios de Aceptación
- Cada tarjeta de curso en la vista del docente debe incluir un botón de "Ver Alumnos".
- Al presionarlo, el sistema debe abrir un modal (`showStudentsModal`) y consultar la lista de estudiantes matriculados en ese grupo (`GET /api/teacher/students/:gradeId`).
- El modal debe ordenar a los alumnos alfabéticamente (por apellido y nombre) e incluir un indicador numérico secuencial, el nombre completo, el código estudiantil y el número de documento.

---

## MÓDULO DEL PORTAL DE PADRES DE FAMILIA / ESTUDIANTES

### PE04: Acceso Detallado a Calificaciones por Actividad de Hijo

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Padre de Familia  
**Quiero:** Ver el desglose detallado de las actividades evaluativas y criterios de calificación aplicados en las materias de mi hijo  
**Para:** Realizar un seguimiento pedagógico preciso de su rendimiento académico y entender cómo se calculó su nota definitiva  

#### Criterios de Aceptación
- En la tabla de calificaciones del estudiante (`ParentGradesView.vue`), al hacer clic sobre cualquier fila de materia, el padre de familia debe ser redirigido a la vista de detalles del estudiante (`SubjectDetailsView.vue`).
- La vista de detalles debe mostrar de forma interactiva y en modo de solo lectura: el promedio ponderado de la materia, la escala institucional obtenida (BAJO, BÁSICO, ALTO, SUPERIOR), y el listado de actividades creadas por el docente con su respectivo nombre, porcentaje de peso en la nota y la calificación obtenida por el alumno.

---

## CONFIGURACIÓN GLOBAL Y ADMINISTRACIÓN GENERAL

### AG01: Login Exclusivo del Administrador General

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Administrador General  
**Quiero:** Contar con una vista de inicio de sesión separada y exclusiva (`/login/admin`)  
**Para:** Acceder directamente al centro de administración global de la plataforma, protegiendo las credenciales globales  

#### Criterios de Aceptación
- El sistema debe ofrecer la ruta `/login/admin` (`AdminLoginView.vue`) para el acceso del Administrador General.
- Al procesar el inicio de sesión, el backend debe verificar que el usuario posea estrictamente el rol `admin_general` y rechazar cualquier otra credencial de directivo, docente o acudiente.
- Una vez autenticado, el sistema debe almacenar el token JWT y redirigir al Administrador General a su panel global.

---

### AG02: Bandeja Centralizada de Notificaciones de la Plataforma

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Administrador General  
**Quiero:** Revisar un feed histórico de todas las notificaciones enviadas a los directivos del sistema  
**Para:** Supervisar eventos importantes relacionados con solicitudes de supervisión e hitos académicos del ciclo de los colegios  

#### Criterios de Aceptación
- Se debe proveer una vista de "Notificaciones del Sistema" (`NotificacionesList.vue`) para el rol de Admin General.
- Cada elemento del feed debe mostrar: nombre del colegio afectado, nombre del directivo destinatario, origen del evento (SUPERVISION o COLEGIO), fecha/hora exacta y el cuerpo del mensaje.
- Debe incluir una barra de búsqueda para filtrar mensajes o colegios y un selector de origen para filtrar por notificaciones de supervisión o ciclo del colegio.

---

### AG03: Consola de Configuración y Diagnósticos del Servidor

**Estado:** Implementado | **Prioridad:** Media

#### Historia de Usuario
**Como:** Administrador General  
**Quiero:** Visualizar los parámetros de la directiva de supervisión y el diagnóstico técnico de la plataforma  
**Para:** Verificar el correcto funcionamiento del servidor y conocer los límites establecidos de las sesiones de supervisión activa  

#### Criterios de Aceptación
- Se debe proveer un panel de configuración (`ConfiguracionPanel.vue`) para el Administrador General.
- Debe desplegar las políticas de supervisión del sistema: duración por defecto (60 minutos) y duración máxima autorizada (180 minutos).
- Debe listar diagnósticos de servidor leídos en tiempo de desarrollo: tipo de entorno de ejecución, motor de base de datos relacional (PostgreSQL 15), versión de Node.js y puerto de escucha de la API backend.

---

## REQUISITOS TÉCNICOS Y DE CALIDAD (COMPARTIDOS)

### TECH01: Garantía de Renderizado de Boletín para Exportación (Hidden Viewport Rendering)

**Estado:** Implementado | **Prioridad:** Alta

#### Historia de Usuario
**Como:** Desarrollador  
**Quiero:** Que el boletín de calificaciones se dibuje en un contenedor invisible con dimensiones y z-index fijos antes de generar el PDF  
**Para:** Asegurar que las librerías de captura (como html2canvas/html2pdf.js) obtengan el tamaño adecuado del layout y procesen las gráficas o tablas en el canvas sin interferir visualmente con la navegación del usuario  

#### Criterios de Aceptación
- El componente `BoletinExportModule.vue` debe instanciar el componente de boletín en un contenedor con clase `.hidden-preview-container`.
- El contenedor debe tener estilos CSS estrictos: `position: fixed`, `top: 0`, `left: 0`, `width: 816px` (ancho equivalente a hoja carta a 96 DPI), `height: 100vh`, `opacity: 0.005`, `z-index: -99999` y `pointer-events: none`.
- El script debe validar el tamaño del layout en el DOM (`getBoundingClientRect().width` > 0) y forzar anchos fijos de ser necesario, antes de procesar el renderizado final del PDF para evitar descargas vacías o recortes.
