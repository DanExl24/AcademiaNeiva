# Historias de Usuario Complementarias — Funcionalidades Implementadas

> Este documento recoge las funcionalidades que ya están operativas en el sistema pero que **no aparecen** en el archivo `jiraHU.md`. Cada historia incluye sus criterios de aceptación basados en el comportamiento real del código.

---

## AUTH01: Autenticación y Login Multi-Rol

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Usuario del sistema (directivo, docente, padre de familia o estudiante)
**Quiero:** Iniciar sesión con mis credenciales institucionales
**Para:** Acceder al panel correspondiente a mi rol

### Criterios de Aceptación

- El sistema debe ofrecer una vista de login general para directivos y docentes
- El sistema debe ofrecer una vista de login separada para estudiantes y padres de familia (`StudentLoginView`)
- El sistema debe validar las credenciales contra la base de datos y el contexto de institución (`id_colegio`)
- Al autenticarse, el sistema debe redirigir al usuario al panel correspondiente según su rol
- El sistema debe almacenar el token JWT en la sesión del usuario
- El sistema debe proteger todas las rutas del panel según el rol autenticado
- Un usuario de un colegio no puede acceder a datos de otro colegio

---

## AUTH02: Login Especial para Estudiantes

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Estudiante
**Quiero:** Una vista de login especializada con acceso simplificado
**Para:** Acceder al portal de consulta académica de forma intuitiva

### Criterios de Aceptación

- El sistema debe mostrar una pantalla de acceso diferenciada para estudiantes
- El sistema debe permitir el identificar automáticamente el rol (estudiante) según las credenciales ingresadas
- Al autenticar un estudiante, el sistema debe resolver su `id_estudiante` a partir del `id_usuario`

---

## DA01: Dashboard Analítico del Directivo

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Un dashboard analítico con indicadores clave de la institución
**Para:** Tener una visión general del estado académico en tiempo real

### Criterios de Aceptación

- El sistema debe mostrar un panel principal con métricas institucionales actualizadas
- El sistema debe mostrar el estado del periodo académico actual (ABIERTO / CERRADO)
- El sistema debe mostrar el número de matrículas registradas
- El sistema debe mostrar indicadores de avance de cierres por docente
- El sistema debe mostrar el número de estudiantes activos
- El sistema debe mostrar accesos rápidos a los módulos principales (gestión académica, docentes, grados, matrículas)
- El endpoint de dashboard debe resolverse por `id_colegio` del directivo autenticado

---

## GA01: Gestión de Estructura Académica (Grados y Cursos)

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Gestionar la estructura académica de mi institución (grados y cursos/secciones)
**Para:** Organizar los grupos de estudiantes por nivel, jornada y sección

### Criterios de Aceptación

- El sistema debe permitir crear tipos de grado (Ej.: "Grado Sexto") asociados a un nivel académico
- El sistema debe permitir eliminar tipos de grado si no tienen dependencias activas
- El sistema debe permitir crear cursos (grupos) con: nivel, grado base, jornada, sección y cupos totales
- El sistema debe permitir eliminar cursos sin dependencias activas
- El sistema debe mostrar para cada curso: número de estudiantes matriculados, materias asignadas, logros/competencias y porcentaje de ocupación
- El sistema debe validar que los cupos no sean negativos al crear un curso
- El sistema debe filtrar cursos al seleccionar un grado base en la vista

---

## GA02: Gestión de Materias

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Gestionar las materias disponibles en la institución
**Para:** Poder asignarlas a los cursos y docentes

### Criterios de Aceptación

- El sistema debe permitir crear nuevas materias con nombre y asociación al colegio
- El sistema debe permitir eliminar materias que no tengan dependencias activas
- El sistema debe mostrar el listado de materias registradas en el colegio
- El sistema debe impedir crear materias duplicadas dentro de la misma institución

---

## GA03: Gestión de Docentes y Asignaciones

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Gestionar los docentes y sus asignaciones de cursos y materias
**Para:** Controlar qué docente es responsable de qué materias en qué cursos

### Criterios de Aceptación

- El sistema debe permitir registrar un docente con sus datos personales y credenciales de acceso
- El sistema debe permitir activar o desactivar un docente sin eliminarlo de la base de datos (`PATCH /teachers/:id/status`)
- El sistema debe mostrar el listado de docentes con sus asignaciones activas
- El sistema debe permitir asignar un docente a un curso y materia específicos (`detalle_grado`)
- El sistema debe permitir eliminar una asignación de docente
- El sistema no debe permitir asignar el mismo docente a la misma combinación curso-materia dos veces
- Al crear un docente, el sistema debe generar automáticamente sus credenciales de acceso (usuario y contraseña)

---

## GA04: Configuración de Años y Periodos Académicos

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Configurar años y periodos académicos para la institución
**Para:** Definir el calendario escolar sobre el que se registran calificaciones y asistencias

### Criterios de Aceptación

- El sistema debe permitir crear años académicos
- El sistema debe permitir crear periodos académicos asociados a un año con nombre, fecha de inicio, fecha de fin y porcentaje de peso
- El sistema debe permitir actualizar el porcentaje de un periodo académico
- El sistema debe mostrar el estado de cada periodo (ABIERTO / CERRADO)
- El sistema debe impedir registrar calificaciones en periodos cerrados
- La suma de porcentajes de los periodos de un año no debe superar el 100%

---

## GA05: Configuración de Escalas Valorativas

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Configurar las escalas de valoración y el rango institucional de notas
**Para:** Determinar los niveles de desempeño (BAJO, BÁSICO, ALTO, SUPERIOR) de los estudiantes

### Criterios de Aceptación

- El sistema debe permitir definir la nota mínima, nota máxima y nota aprobatoria de la institución
- El sistema debe ofrecer dos modos de configuración de escalas:
  - **Automático:** el sistema calcula los rangos de cada nivel a partir del rango global
  - **Manual:** el directivo define los cortes máximos de BÁSICO y ALTO, y el sistema calcula BAJO y SUPERIOR sin dejar huecos ni solapamientos
- Al cambiar el rango de notas (mínimo / máximo), el sistema debe mostrar un aviso indicando que las notas existentes se rescalarán proporcionalmente
- El sistema debe ejecutar el rescalado proporcional de todas las calificaciones registradas (Ej.: 3.8/5 → ~7.6/10)
- El sistema debe impedir guardar escalas cuyos rangos se solapen o dejen vacíos

---

## GA06: Gestión de Competencias y Evidencias de Aprendizaje

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Directivo
**Quiero:** Definir las competencias académicas por materia, grado y periodo
**Para:** Establecer la base pedagógica que guía la evaluación de los docentes

### Criterios de Aceptación

- El sistema debe permitir crear una competencia asociada a un grado, materia y periodo académico
- La competencia debe aplicarse automáticamente a todos los cursos del mismo grado (misma sección y jornada no deben tener competencias distintas para la misma materia y periodo)
- El sistema debe permitir editar la descripción de una competencia existente
- El sistema debe mostrar el estado de cada competencia: PENDIENTE o DEFINIDA
- El sistema debe mostrar estadísticas: total de competencias, materias con competencia, contextos configurados, pendientes y definidas
- El sistema debe permitir filtrar competencias por periodo, grado, materia y estado
- El sistema debe permitir agregar **evidencias de aprendizaje** a cada competencia definida (CRUD completo)
- El sistema debe impedir agregar evidencias a competencias en estado PENDIENTE

---

## CP01: Reapertura de Periodo Global

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Reabrir un periodo académico previamente cerrado
**Para:** Permitir correcciones urgentes de notas o registros antes de la publicación definitiva

### Criterios de Aceptación

- El sistema debe mostrar el estado actual del periodo seleccionado (ABIERTO / CERRADO)
- El sistema debe mostrar el botón "Reabrir Periodo" únicamente cuando el periodo esté en estado CERRADO
- Al confirmar la reapertura, el sistema debe cambiar el estado del periodo a ABIERTO
- El sistema debe solicitar confirmación explícita antes de ejecutar la reapertura, advirtiendo sobre el impacto global
- Al reabrir el periodo, todos los docentes deben poder volver a registrar o modificar información académica

---

## CP02: Reapertura de Cierre de Materia por Docente

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Directivo
**Quiero:** Deshacer el cierre de una materia específica realizado por un docente
**Para:** Permitir que el docente corrija datos puntuales sin necesidad de reabrir el periodo completo

### Criterios de Aceptación

- Dentro de la vista de Control de Cierre de Periodo, el sistema debe mostrar el estado de cierre de cada asignación docente (materia + curso)
- El sistema debe mostrar un botón de reapertura individual en cada asignación con estado CERRADO
- Al deshacer el cierre de una materia, el sistema debe actualizar el estado de esa asignación a PENDIENTE
- La reapertura individual de una materia no debe afectar el estado del periodo global ni de otras asignaciones
- El sistema debe solicitar confirmación antes de ejecutar la reapertura individual

---

## TD01: Dashboard del Docente

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Docente
**Quiero:** Un panel de inicio con resumen de mi carga académica
**Para:** Tener una vista rápida de mis cursos, estado de cierres y actividad reciente

### Criterios de Aceptación

- El sistema debe mostrar al docente los cursos y materias que tiene asignados
- El sistema debe mostrar el estado de sus cierres por asignación (pendiente / cerrado)
- El sistema debe mostrar alertas si existen actividades sin calificación o con porcentajes incompletos
- El sistema debe permitir navegar a los módulos de calificaciones, asistencia y observaciones desde el dashboard

---

## TC01: Gestión de Actividades y Criterios de Calificación

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Docente
**Quiero:** Crear y gestionar las actividades evaluativas de mis materias por periodo
**Para:** Estructurar la evaluación académica con porcentajes y criterios de calificación

### Criterios de Aceptación

- El sistema debe permitir al docente crear actividades evaluativas para una combinación grado + materia + periodo
- Cada actividad debe tener nombre, descripción y porcentaje de peso en la nota final
- El sistema debe validar que la suma de porcentajes de todas las actividades no supere el 100%
- El sistema debe permitir editar y eliminar actividades mientras el periodo esté abierto y el docente no haya cerrado sus notas
- El sistema debe permitir agregar criterios de calificación a cada actividad (subcomponentes de evaluación)
- El sistema debe impedir crear o modificar actividades cuando el periodo está cerrado

---

## TC02: Registro de Calificaciones por Actividad

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Docente
**Quiero:** Registrar las calificaciones de mis estudiantes por actividad evaluativa
**Para:** Calcular automáticamente el promedio ponderado de cada materia

### Criterios de Aceptación

- El sistema debe mostrar el listado de estudiantes del curso y periodo seleccionados
- El sistema debe permitir ingresar una calificación por estudiante por actividad
- La calificación debe estar dentro del rango definido por la escala institucional
- El sistema debe calcular automáticamente el promedio ponderado del estudiante en la materia
- El sistema debe mostrar el nivel de desempeño del estudiante según la escala valorativa configurada
- El sistema no debe permitir modificar calificaciones cuando el docente ha marcado el periodo como completado o cuando el periodo está cerrado
- El sistema debe permitir guardar calificaciones de múltiples estudiantes en una sola operación (guardado masivo)

---

## TC03: Descarga de Formato Físico de Asistencia

**Estado:** Implementado | **Prioridad:** Baja

### Historia de Usuario

**Como:** Docente
**Quiero:** Exportar el listado de asistencia en un formato físico (Excel/PDF)
**Para:** Tener respaldo impreso de la asistencia diaria

### Criterios de Aceptación

- El sistema debe ofrecer una opción para exportar el registro de asistencia del curso y periodo seleccionado
- El archivo exportado debe incluir los nombres de los estudiantes y las fechas del periodo
- El formato debe ser compatible con impresión en hoja tamaño carta

---

## TC04: Justificación de Inasistencias

**Estado:** Implementado (BD) | **Prioridad:** Baja

### Historia de Usuario

**Como:** Docente
**Quiero:** Registrar una justificación para las inasistencias de un estudiante
**Para:** Distinguir las ausencias justificadas de las no justificadas en los reportes

### Criterios de Aceptación

- El sistema debe permitir agregar un campo de justificación al registro de asistencia
- Las inasistencias justificadas deben distinguirse visualmente de las no justificadas
- El boletín debe reflejar el tipo de inasistencia correctamente

---

## PD01: Dashboard Analítico del Padre de Familia

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Padre de familia
**Quiero:** Un panel analítico que muestre el rendimiento académico de mis hijos
**Para:** Tener una visión consolidada y reactiva del desempeño académico familiar

### Criterios de Aceptación

- El sistema debe mostrar un panel con resumen de rendimiento para cada hijo vinculado a la cuenta
- El sistema debe permitir alternar entre una vista individual por hijo y una vista "Todos" con métricas familiares consolidadas
- El sistema debe mostrar promedio general, asistencia y estado de riesgo académico por estudiante
- El sistema debe permitir filtrar los datos por periodo académico activo o cerrado
- El sistema debe actualizar dinámicamente todas las métricas al cambiar de hijo o periodo
- La vista familiar ("Todos") debe agregar los promedios y asistencias de todos los hijos en una sola pantalla

---

## PE01: Consulta de Detalle de Notas por Materia (Estudiante)

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Estudiante
**Quiero:** Ver el desglose detallado de mis notas en una materia específica
**Para:** Entender cómo se calculó mi promedio y qué actividades contribuyeron a mi calificación

### Criterios de Aceptación

- Desde la vista de notas, el estudiante debe poder acceder a una subvista de detalle por materia
- El sistema debe mostrar cada actividad evaluativa con su nombre, porcentaje y la calificación obtenida
- El sistema debe mostrar los criterios de evaluación de cada actividad
- El sistema debe mostrar el promedio ponderado calculado de la materia
- El sistema debe mostrar el nivel de desempeño (BAJO, BÁSICO, ALTO, SUPERIOR)
- La información debe ser de solo lectura

---

## PE02: Exportación de Boletín desde el Portal del Estudiante

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Estudiante
**Quiero:** Descargar mi boletín académico en formato PDF desde mi portal
**Para:** Tener acceso en cualquier momento a mi reporte de notas oficial

### Criterios de Aceptación

- El sistema debe mostrar una vista para que el estudiante seleccione el año y periodo académico
- El sistema debe listar únicamente los periodos en estado CERRADO
- El sistema debe generar el boletín en formato PDF con todos los datos académicos del periodo seleccionado
- El boletín debe incluir: datos del estudiante, materias, calificaciones, promedio, nivel de desempeño, observaciones e inasistencias
- El sistema debe bloquear el acceso a boletines de periodos abiertos

---

## PE03: Exportación de Boletín desde el Portal del Padre de Familia

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Padre de familia
**Quiero:** Descargar el boletín académico de mi hijo en formato PDF
**Para:** Tener acceso al reporte oficial de notas de mi hijo

### Criterios de Aceptación

- El sistema debe mostrar una vista donde el padre pueda seleccionar el hijo, el año y el periodo académico
- El sistema debe listar únicamente periodos en estado CERRADO
- El sistema debe generar el boletín en PDF con los mismos campos que el boletín del estudiante
- El sistema debe validar que el padre solo pueda descargar boletines de sus hijos vinculados
- El sistema no debe mostrar boletines de periodos abiertos

---

## MR06: Cancelación y Traslado de Matrícula

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Directivo
**Quiero:** Cancelar o marcar como traslado una matrícula activa
**Para:** Gestionar los cambios de estado de los estudiantes durante el año lectivo

### Criterios de Aceptación

- El sistema debe permitir cancelar una matrícula activa cambiando su estado a "CANCELADA"
- El sistema debe permitir marcar una matrícula como "TRASLADADA" mediante la acción de traslado (`toggleTransfer`)
- Una matrícula cancelada o trasladada no puede volver a estado activo
- El sistema debe actualizar automáticamente los cupos disponibles del grado al cancelar o trasladar una matrícula
- El sistema debe registrar el motivo de cancelación o traslado
- Solo los directivos autenticados pueden realizar estas acciones

---

## MR07: Filtrado de Matrículas por Estado

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Directivo
**Quiero:** Filtrar las matrículas del colegio por su estado
**Para:** Tener vistas organizadas de matrículas pendientes, aprobadas, rechazadas o canceladas

### Criterios de Aceptación

- El sistema debe permitir consultar las matrículas de la institución filtradas por estado (pending, approved, cancelled, transferred)
- El sistema debe mostrar la lista de matrículas filtradas con la información básica del solicitante
- El sistema debe permitir acceder al detalle de cada matrícula desde el listado
- El filtro debe operar por `id_colegio` del directivo autenticado, sin exponer datos de otras instituciones

---

## MR08: Asignación de Grado al Aprobar Matrícula

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Directivo
**Quiero:** Asignar un grado y curso al estudiante durante el proceso de aprobación de matrícula
**Para:** Vincular al estudiante a su grupo correspondiente una vez matriculado

### Criterios de Aceptación

- Antes de finalizar la matrícula, el sistema debe permitir al directivo asignar el grupo (curso) al estudiante
- El sistema debe mostrar solo los grupos con cupos disponibles para el nivel seleccionado
- Al aprobar la matrícula, el sistema debe registrar automáticamente al estudiante en el grupo asignado
- El sistema debe descontar automáticamente un cupo del grupo al confirmar la asignación

---

## LAND01: Landing Page Multi-Tenant

**Estado:** Implementado | **Prioridad:** Alta

### Historia de Usuario

**Como:** Padre de familia o ciudadano
**Quiero:** Una página de inicio pública que informe sobre el sistema y permita acceder al formulario de matrícula
**Para:** Iniciar el proceso de inscripción de mi hijo de forma clara y contextualizada

### Criterios de Aceptación

- El sistema debe tener una landing page pública accesible sin autenticación
- La landing page debe identificar la institución educativa contextualmente (por subdominio o parámetro)
- La landing page debe mostrar información general de la institución y el proceso de matrícula
- La landing page debe tener un enlace o botón para acceder al formulario de matrícula en línea
- El sistema debe confirmar visualmente en qué institución se está realizando el proceso de matrícula
- El sistema no debe procesar una matrícula sin una institución válida y activa identificada

---

## SF01: Configuración de Colegio Predeterminada

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Directivo
**Quiero:** Actualizar la configuración general del colegio en el sistema
**Para:** Mantener actualizados los parámetros institucionales que afectan el comportamiento académico

### Criterios de Aceptación

- El sistema debe permitir al directivo actualizar la configuración predeterminada del colegio (nota mínima, máxima, aprobatoria y modo de escala)
- Los cambios en la configuración deben aplicarse a todos los cálculos futuros de la institución
- Los cambios en el rango de notas deben disparar un rescalado proporcional de las notas históricas con confirmación previa
- La configuración debe estar aislada por `id_colegio`

---

## EX01: Detección de Padre de Familia como Empleado Existente en la Matrícula

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Directivo
**Quiero:** Ser notificado cuando el padre de familia de una solicitud de matrícula ya es empleado o usuario de la institución (docente o directivo)
**Para:** Evitar duplicar cuentas de usuario y vincular al estudiante a la cuenta ya existente

### Criterios de Aceptación

- Durante la revisión de una solicitud de matrícula, el sistema debe verificar si el documento de identidad o correo del padre coincide con un usuario existente de la institución
- El sistema debe mostrar un aviso visible al directivo indicando que el padre es un empleado existente
- El sistema debe mostrar el rol actual del usuario encontrado (docente, directivo, etc.)
- El sistema debe vincular al estudiante a la cuenta de usuario ya existente en lugar de crear una cuenta duplicada
- El directivo debe poder confirmar o rechazar esta vinculación durante el proceso de aprobación

---

## HU-SHARED01: Vista Compartida de Historial de Asistencia

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Directivo o Docente
**Quiero:** Consultar el historial completo de asistencias de un curso y materia
**Para:** Revisar el registro histórico de presencia y ausencias de los estudiantes

### Criterios de Aceptación

- El sistema debe mostrar el historial de asistencias filtrado por `detailGradeId` (combinación curso-materia-docente)
- El sistema debe mostrar por cada fecha: qué estudiantes estuvieron presentes, ausentes o justificados
- El historial debe ser de solo lectura para periodos cerrados
- El docente solo puede ver el historial de sus asignaciones; el directivo puede consultar cualquier asignación

---

## HU-SHARED02: Consulta de Observaciones del Estudiante (Padre y Estudiante)

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Estudiante o Padre de Familia
**Quiero:** Consultar las observaciones académicas registradas por los docentes
**Para:** Conocer las fortalezas y debilidades identificadas por el docente durante el periodo

### Criterios de Aceptación

- El sistema debe mostrar todas las observaciones del estudiante en el periodo seleccionado
- Cada observación debe mostrar: materia, tipo (fortaleza / debilidad), descripción y docente
- El sistema debe permitir filtrar observaciones por materia y periodo
- La información debe ser de solo lectura
- El padre solo puede ver observaciones de sus hijos vinculados
- El estudiante solo puede ver sus propias observaciones

---

## TC05: Límite de Asistencia Diaria (Regla de Negocio)

**Estado:** Implementado | **Prioridad:** Media

### Historia de Usuario

**Como:** Sistema / Docente
**Quiero:** Que el sistema valide que un estudiante no exceda el límite físico de clases diarias
**Para:** Prevenir errores de digitación y garantizar la integridad de los datos de asistencia

### Criterios de Aceptación

- El sistema debe impedir registrar más de 7 bloques académicos o asistencias para un estudiante en un mismo día.
- Al intentar guardar una asistencia que supere este límite, el sistema debe devolver un error indicando el nombre del estudiante excedido.
- La validación debe aplicarse de forma automática en el servidor durante el guardado de asistencia.
- El sistema debe permitir actualizar registros existentes para el mismo estudiante, materia y fecha sin que esto cuente como un nuevo bloque para el límite de 7.
- La regla debe ser consistente con la carga académica recomendada (Primaria 5-6, Secundaria 6-7).
