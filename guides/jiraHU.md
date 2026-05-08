# Documentación de Historias de Usuario - Matrícula Académica

## MR01: Formulario de Matricula Academica

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Padre de Familia
**Quiero:** Un formulario de Registro de Matricula Academica
**Para:** Matricular a mi hijo al centro escolar

### Criterios de Aceptación

- El sistema debera crear una vista para generar el formulario de matricula academica en linea
- El formulario de matricula academica debera ser libre y no pedir validacion de
- El formulario de matricula debera tener la opcion para elegir un colegio en especifico
- El formulario debera respetar las horas de disponibilidad, permitiendo el registro del formulario solo en los dias establecidos
- El formulario debera preguntar el correo electronico del padre de familia
- El formulario debera preguntar el nivel escolar del estudiante: Primera Infancia, Primaria, secundaria y bachillerato
- El formulario debera adaptar los campos segun la opcion de nivel escolar
- Al elegir un nivel escolar en especifico, el sistema debera generar opciones automaticas para elegir el cupo a un grado segun sea su disponibilidad
- El sistema debera mostrar un mensaje de informacion para explicar que si el grado no aparece, es porque los cupos estan agotados
- El sistema debera generar los siguientes campos de formulario:
- Copia del registro civil de nacimiento del estudiante. \*NO APLICA A SECUNDARIA
- Documento de identidad del estudiante, T.I. para mayores de 7 años y C.C. para mayores de 18 años. \*NO APLICA A PRIMERA INFANCIA
- Copia del documento identidad del padre y/o madre de familia, o acudiente
- Copia del carné de vacunas al día y/o reporte del PAI (Programa Ampliado de Inmunización) \*NO APLICA A SECUNDARIA
- Copia del certificado de afiliación al Sistema General de Seguridad Social en Salud vigente
- foto del estudiante size maximo 2Mb, dimensiones 3x4 desde los hombros para arriba, foto clara con buena iluminacion y preferiblemente fondo blanco
- Copia de Visa para estudiantes extranjeros menores de 7 años. Copia de Visa y cédula de extranjería para estudiantes extranjeros mayores de 7 años o Permiso de Protección Temporal (PPT) para estudiantes migrantes de Venezuela
- Recibo de servicio público para certificar la residencia
- Copia del diagnóstico, certificación o concepto médico sobre la discapacidad o del trastorno específico del aprendizaje o del comportamiento emitido únicamente por el Sector Salud según sea el caso.
- Carga de Certificados \*NO APLICA A PRIMERA INFANCIA
- Certificados de escolaridad de los grados anteriores al solicitado (se exigirá únicamente el certificado de grado 5º que avala el nivel de primaria y únicamente el de grado 9º que avala todos los grados anteriores) Para el resto de los grados, se deberá pedir el del año inmediatamente anterior. En ninguno de los casos se podrá constituir una barrera para la formalización de la matrícula

---

## MR02: Validacion de Documentos

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Directivo
**Quiero:** Validar los documentos adjuntos en el formulario de matricula
**Para:** Finalizar el proceso de matricula Academica exitosamente

### Criterios de Aceptación

- El sistema debera cargar todos formularios de matricula adjuntados por los padres de familia
- El sistema debera mostrar todos los documentos adjuntos y opciones seleccionadas del padre de familia
- El sistema debera mostrar un apartado para poder validar documento por documento adjunto y poder evaluarlo
- El sistema debera mostrar si la validacion fue exitosa o hay errores en la carga de documentos
- El sistema debera mandar un correo electronico al padre de familia informando sobre las inconsistencias en el formulario de matricula academica
- El sistema debera registrar automaticamente al estudiante y al padre de familia en la base de datos en el momento que la validacion de todos los documentos sea exitosa y el directivo desee aprobar la matricula

---

## MR03: Correccion de Documentos

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Padre de Familia
**Quiero:** Una vista para corregir los documentos de la matricula del estudiante
**Para:** Actualizar la carga de documentos de la matricula academica en caso de errores

### Criterios de Aceptación

- Al aceptar la correcion de Documentos desde el correo electronico, el padre de familia sera llevado a una vista especial para corregir los documentos no validos
- El sistema debera mostrar los documentos validados
- El sistema debera mostrar los documentos correctos
- El sistema debera mostrar los documentos incorrectos
- El sistema debera mostrar un mensaje de informacion si un documento esta incorrecto, para saber la causa
- El sistema debe permitir la actualizacion de todos los documentos, ya sean correctos o incorrectos
- El sistema debera marcar como exitosos/corregidos todos los documentos dependiendo de su evaluacion
- El sistema debera marcar como incorrecto a los documentos que fueron pasados por validacion y no se aceptaron
- El sistema no debe dejar cargar documentos incorrectos
- El sistema solo debe dejar enviar la correcion de formulario si solo hay documentos exitosos y corregidos
- El sistema debera notificar al directivo sobre la nueva carga de documentos a ese formulario, mostrando los documentos exitosos y corregidos

---

## MR04: Registrar Estudiante y Padre de Familia

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Directivo
**Quiero:** Registrar padres de familia y estudiantes automáticamente al aprobar una matricula
**Para:** Llevar un seguimiento al estudiante y enlazar su acudiente

### Criterios de Aceptación

- Al terminar la validacion de todos los documentos, el sistema debera generar un formulario de Registro de Padre de Familia y Estudiante

**FORMULARIO DE REGISTRO**

- -- Dos opciones, una para registrar el estudiante y la otra para registrar padre de familia
- -- Habilitar primeramente la opcion de registrar estudiante
- -- Modelar los campos para pedir datos personales del estudiante
- -- El sistema debera dividir la pantalla en dos partes, una donde estara el formulario de registro y otra donde se mostrara por defecto el documento donde estan los datos personales del estudiante o el padre de familia, dependiendo en que vista del formulario esta. Sin embargo, si el documento no es suficiente para completar toda la informacion, el sistema debe permitir la opcion de cambiar de documento para visualizarlo
- -- Al terminar el registro de estudiante, en vez del boton "guardar", se mostrara un boton "siguiente" , para registrar los datos personales del padre de familia
- -- El sistema debe permitir ir atras o adelante en el formulario con multiple vista para corregir datos
- -- Una vez registrado el formulario del estrudiante y padre de familia, debe mostrar un boton para guardar registros
- -- El sistema debe crear automaticamente el estudiante y el padre de familia una vez guardado el registro
- -- Una vez el registro del estudiante y el padre de familia sean exitosos, el sistema debera generar un mensaje para aprobar la matricula y subirla al sistema
- -- El sistema debe pasar el estado de la matricula a activo
- -- Una vez matriculado el estudiante, el sistema debera mandar un mensaje al correo electronico del padre de familia sobre el proceso de matricula exitoso

---

## MR05: Panel del Directivo

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Directivo
**Quiero:** Un Panel administrativo
**Para:** Acceder a los difrerentes modulos del sistema y administrar la gestion academica

### Criterios de Aceptación

**Acceso y navegación**

- El sistema debe mostrar un panel principal con acceso a los módulos del sistema:
- Gestión de matrícula
- Gestión de estudiantes
- Gestión de docentes
- Gestión académica (periodos, grados, materias)
- Reportes
- El sistema debe permitir navegar entre módulos sin recargar completamente la pagina web

**Dashboard**

- El panel debe mostrar un resumen general:
- Número de matrículas pendientes
- Número de estudiantes activos
- Cupos disponibles por grado
- Periodo académico actual
- El dashboard debe tener opciones para poder filtrar datos rapidos

**\*Gestión rápida**

- El sistema debe permitir acceder directamente a:
- Formularios pendientes de validación
- Matrículas rechazadas
- Documentos con inconsistencias
- El sistema deberá generar este modulo con las 3 vistas dentro, separadas por responsabilidades

**Notificaciones**

- El sistema debe mostrar notificaciones sobre:
- Nuevas solicitudes de matrícula
- Correcciones enviadas por padres
- Alertas del sistema

**Seguridad**

- El sistema debe restringir el acceso a los módulos según el rol del usuario autenticado

**Estado del sistema académico**

- El sistema debe mostrar el estado del periodo académico:
- Abierto
- Cerrado
- El sistema debe permitir acceder a la gestión de cierre de periodo

**Acciones rápidas**

- El sistema debe permitir acciones rápidas como:
- Crear estudiante
- Crear docente
- Crear grado
- Configurar periodo académico

---

## RC01: Registro de Docentes

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Directivo
**Quiero:** Registrar Docentes
**Para:** Mantener gestion sobre los docentes dentro de la institucion educativa

### Criterios de Aceptación

- El sistema debe permitir registrar un docente con sus datos personales obligatorios
- El sistema debe permitir editar la información de un docente existente
- El sistema debe permitir desactivar un docente sin eliminarlo de la base de datos
- El sistema debe permitir visualizar el listado de docentes registrados
- El sistema debe permitir asignar uno o más grados a un docente
- El sistema debe permitir asignar una o más materias a un docente
- El sistema debe impedir asignar materias que no correspondan al grado asignado
- El sistema debe mostrar las asignaciones de grados y materias de cada docente
- El sistema debe permitir consultar el listado de estudiantes asociados a un docente según sus asignaciones
- El sistema debe permitir visualizar las calificaciones registradas por un docente a un estudiante
- El sistema debe permitir visualizar las observaciones registradas por un docente a un estudiante
- El sistema debe permitir consultar los reportes académicos generados por los docente

---

## RC02: Panel de Docente

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Docente
**Quiero:** Un panel de gestion académica
**Para:** registrar y consultar información académica de mis estudiantes

### Criterios de Aceptación

- Informacion general
- El sistema debe mostrar al docente únicamente los cursos, grados y materias que tiene asignados
- El sistema debe permitir seleccionar un curso y materia para gestionar la información académica
- Calificaciones
- El sistema debe permitir registrar calificaciones por estudiante en un periodo académico activo
- El sistema debe permitir editar calificaciones mientras el periodo esté abierto
- El sistema no debe permitir modificar calificaciones cuando el periodo esté cerrado
- Asistencia
- El sistema debe permitir registrar la asistencia diaria de los estudiantes
- El sistema no debe permitir registrar más de una asistencia por estudiante en la misma fecha y materia
- observaciones
- El sistema debe permitir registrar observaciones (fortalezas y debilidades) por estudiante
- El sistema debe permitir consultar observaciones registradas previamente
- visualizacion
- El sistema debe mostrar el listado de estudiantes según el curso y materia seleccionados
- El sistema debe permitir consultar el historial académico básico del estudiante
- restricciones
- El sistema solo debe permitir al docente gestionar información de estudiantes asociados a sus materias y grados

---

## RC03: Gestion Academica de Docente

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Docente
**Quiero:** Un seguimiento academico de mis grados asociados
**Para:** Tener un mejor manejo sobre los estudiantes en diferentes grados y las materias que enseño

### Criterios de Aceptación

**Contexto de trabajo**

- El sistema debe mostrar únicamente los grados y materias asignados al docente
- El sistema debe permitir seleccionar un grado, materia y periodo académico

**Estudiantes**

- El sistema debe mostrar el listado de estudiantes del grado y periodo seleccionado
- El sistema debe permitir visualizar información básica del estudiante

**Gestión académica**

- El sistema debe permitir registrar y consultar calificaciones por estudiante y periodo académico
- El sistema debe permitir registrar y consultar observaciones académicas por estudiante
- El sistema debe permitir registrar y consultar asistencia por estudiante

**Restricciones por estado**

- El sistema solo debe permitir registrar o modificar información académica si:
- el periodo académico está en estado "abierto"
- el docente no ha marcado el periodo como "completado"
- El sistema no debe permitir registrar ni modificar información académica cuando:
- el docente ha marcado el periodo como "completado"
- el periodo académico está en estado "cerrado"

**Integración con cierre de periodo**

- El sistema debe reflejar el estado del docente en el periodo académico:
- pendiente
- completado
- El sistema debe impedir el acceso a edición de datos cuando el estado del docente sea "completado"

**Restricciones generales**

- El sistema solo debe permitir gestionar información de estudiantes asociados a los grados y materias asignados al docente

**Consulta histórica**

- El sistema debe permitir consultar el historial académico del estudiante en periodos anteriores

---

## RC04: Cierre de Periodo Docente

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Docente
**Quiero:** marcar como completado el registro académico de mis cursos y materias en un periodo
**Para:** indicar que la información está lista para validación y cierre institucional

### Criterios de Aceptación

- El sistema debe permitir al docente marcar como "completado" un periodo académico para sus materias asignadas
- El sistema debe validar que:
- todos los estudiantes tengan calificaciones registradas
- (opcional) la asistencia esté completa
- El sistema no debe permitir marcar como completado si existen datos incompletos
- El sistema debe cambiar el estado del docente a "completado" para ese periodo
- El sistema debe bloquear la edición de calificaciones y observaciones del docente una vez marcado como completado
- El sistema debe notificar al directivo que el docente ha completado su registro académico

---

## RC05: Cierre de Periodo Global

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Directivo
**Quiero:** cerrar el periodo académico
**Para:** finalizar el proceso académico y habilitar la generación de boletines

### Criterios de Aceptación

- El sistema debe mostrar el estado de cumplimiento de los docentes:
- completado
- pendiente
- El sistema debe permitir cerrar el periodo académico cuando todos los docentes estén en estado "completado"
- El sistema debe permitir forzar el cierre del periodo aunque existan docentes pendientes
- El sistema debe mostrar advertencia indicando los docentes que no han completado su registro
- El sistema debe cambiar el estado del periodo a "cerrado"
- El sistema no debe permitir registrar ni modificar calificaciones ni observaciones después del cierre
- El sistema debe habilitar la generación de boletines únicamente para periodos cerrados

---

## PF01: Panel de Padre de Familia y Estudiante

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Quiero:** acceder a un panel de consulta académica
**Para:** visualizar la información académica disponible según mi rol

### Criterios de Aceptación

- El sistema debe permitir a los usuarios (padre de familia o estudiante) acceder a un panel de consulta académica donde puedan visualizar la información disponible según su rol.
- El padre de familia podrá acceder a la información de uno o más estudiantes asociados
- El estudiante solo podrá acceder a su propia información
- El panel debe permitir navegar a:
- notas
- asistencias
- observaciones
- historial académico

---

## PF02: Consulta de Notas del estudiante

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Quiero:** consultar las calificaciones del estudiante por periodo académico
**Para:** conocer su rendimiento académico

### Criterios de Aceptación

- El sistema debe permitir consultar las calificaciones del estudiante por periodo académico.
- Debe permitir filtrar por:
- año académico
- periodo académico
- Debe mostrar:
- materias
- calificaciones
- promedio
- nivel de desempeño
- Solo se deben mostrar periodos en estado "cerrado"
- La información debe ser de solo lectura

---

## PF03: Consulta de Asistencias de Estudiante

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Quiero:** consultar las asistencias del estudiante
**Para:** hacer seguimiento a su asistencia

### Criterios de Aceptación

- El sistema debe permitir consultar las asistencias del estudiante.
- Debe permitir filtrar por:
- periodo académico
- materia
- Debe mostrar:
- fechas
- estado de asistencia (presente, ausente, etc.)
- La información debe ser de solo lectura

---

## PF04: Consulta de Observaciones de Estudiante

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Quiero:** consultar las observaciones académicas del estudiante
**Para:** entender su desempeño y comportamiento

---

## PF05: Consulta de Historial Academico

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Quiero:** consultar el historial académico del estudiante
**Para:** analizar su evolución en el tiempo

### Criterios de Aceptación

- El sistema debe permitir consultar el historial académico del estudiante en periodos anteriores.
- Debe mostrar:
- calificaciones históricas
- observaciones
- (opcional) asistencias
- Solo debe mostrar periodos en estado "cerrado"
- La información debe ser de solo lectura

---

## GB01: Generacion de Boletines

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Como:** Directivo
**Quiero:** generar boletines académicos
**Para:** consolidar el rendimiento académico del periodo

### Criterios de Aceptación

- El sistema debe permitir generar boletines:
- de forma individual (por estudiante)
- de forma masiva (por grado y periodo académico)
- El sistema debe generar el boletín únicamente si:
- el periodo académico está en estado "cerrado"
- todas las materias del estudiante tienen calificaciones registradas
- El sistema debe incluir en el boletín:
- datos del estudiante
- grado y periodo académico
- materias
- calificaciones
- promedio del periodo
- nivel de desempeño
- observaciones (fortalezas y debilidades)
- número de inasistencias
- El sistema debe calcular automáticamente:
- promedio del estudiante
- nivel de desempeño según escala definida
- El sistema debe generar el boletín en formato digital (vista previa)
- El sistema no debe permitir modificar la información desde el boletín
- El sistema debe almacenar los boletines generados para su posterior consulta y distribución

---

## GB02: Exportación de Boletines

**Estado:** Por hacer | **Prioridad:** Medium

### Historia de Usuario

**Quiero:** distribuir los boletines académicos generados
**Para:** ponerlos a disposición de estudiantes y padres de familia

### Criterios de Aceptación

**Acción principal**

- El sistema debe permitir ejecutar la distribución de boletines por:
- grado
- periodo académico

**Validaciones**

- El sistema solo debe permitir distribuir boletines si:
- el periodo académico está en estado "cerrado"
- los boletines ya han sido generados

**Entrega**

- El sistema debe publicar los boletines en el portal del estudiante y padre de familia

**Control**

- El sistema debe mostrar el estado del proceso:
- en proceso
- completado
- error
- El sistema debe notificar al directivo al finalizar

**Restricciones**

- El sistema no debe permitir distribuir boletines de periodos no cerrados

---

## Reportes academicos y graficas

🧑‍💼 HU05.1 – Visualización de rendimiento académico por grado mediante graficas

Como directivo o docente
Quiero visualizar el rendimiento académico general de un grado
Para identificar el nivel de desempeño global de los estudiantes

🧠 Criterios de aceptación:
El sistema debe mostrar el promedio general del grado por periodo académico.
Debe permitir filtrar por grado y periodo.
Debe mostrar cantidad de estudiantes aprobados y reprobados.
Los datos deben actualizarse automáticamente según las calificaciones registradas.
📚 HU05.2 – Análisis de rendimiento por materia

Como docente o directivo
Quiero consultar el rendimiento académico por materia
Para evaluar el desempeño de los estudiantes en una asignatura específica

🧠 Criterios de aceptación:
El sistema debe mostrar el promedio de la materia por grado y periodo.
Debe incluir número de estudiantes por nivel de desempeño (bajo, básico, alto, superior).
Debe permitir comparar materias dentro del mismo grado.
📆 HU05.3 – Reporte de rendimiento por periodo académico

Como directivo
Quiero visualizar el rendimiento académico por periodo
Para analizar la evolución del desempeño estudiantil en el tiempo

🧠 Criterios de aceptación:
El sistema debe permitir seleccionar un periodo académico.
Debe mostrar promedio general del grado en ese periodo.
Debe incluir comparación entre periodos anteriores.
Debe reflejar variación del rendimiento (mejora o descenso).
🏆 HU05.4 – Ranking académico de estudiantes (opcional pero potente)

Como directivo o docente
Quiero ver un ranking de estudiantes por desempeño académico
Para identificar los mejores y peores desempeños del grado

🧠 Criterios de aceptación:
El sistema debe ordenar estudiantes por promedio general.
Debe mostrar posición dentro del grado.
Debe permitir filtrar por materia y periodo.
Debe respetar privacidad según rol del usuario.
📊 HU05.5 – Visualización gráfica de rendimiento

Como directivo o docente
Quiero ver gráficos estadísticos del rendimiento académico
Para interpretar fácilmente los resultados académicos

🧠 Criterios de aceptación:
El sistema debe mostrar gráficos de barras o líneas.
Debe incluir comparación entre materias, grados o periodos.
Debe representar porcentajes de desempeño.
Debe actualizarse dinámicamente según filtros.
📈 HU05.6 – Promedio consolidado por estudiante

Como docente o directivo
Quiero ver el promedio general de cada estudiante
Para evaluar su desempeño global en el periodo académico

🧠 Criterios de aceptación:
El sistema debe calcular el promedio ponderado por materias.
Debe incluir estado académico (aprobado, en riesgo, reprobado).
Debe basarse en las notas registradas y porcentajes de cada actividad.
🔐 HU05.7 – Restricción de acceso a reportes

Como sistema
Quiero controlar el acceso a los reportes académicos
Para garantizar la privacidad de la información

🧠 Criterios de aceptación:
Solo directivos pueden ver reportes globales.
Docentes solo pueden ver sus grados asignados.
Padres solo pueden ver información de sus hijos.
Estudiantes solo pueden ver su propio rendimiento.

## Recuperacion de password y soporte

🔐 HU – Recuperación de contraseña y soporte
🧩 HU01 – Solicitar recuperación de contraseña

Como usuario del sistema (docente, estudiante, padre o directivo)
quiero solicitar la recuperación de mi contraseña
para poder restablecer el acceso cuando la haya olvidado

📌 Criterios de aceptación:
El usuario ingresa su correo registrado en el sistema
El sistema valida que el correo exista y pertenezca a un colegio activo
Se envía un enlace seguro de recuperación al correo
El enlace tiene expiración (ej: 15–30 minutos)
El enlace solo puede usarse una vez
🧩 HU02 – Restablecer contraseña

Como usuario autenticado mediante enlace de recuperación
quiero establecer una nueva contraseña
para recuperar el acceso a mi cuenta

📌 Criterios de aceptación:
El sistema valida que el token sea válido y no expirado
La nueva contraseña debe cumplir reglas de seguridad (longitud mínima, caracteres, etc.)
La contraseña se almacena cifrada (bcrypt o argon2)
El token se invalida después de usarse
🧩 HU03 – Notificación de recuperación de contraseña

Como usuario del sistema
quiero recibir notificación cuando se solicite un cambio de contraseña
para detectar posibles accesos no autorizados

📌 Criterios de aceptación:
Se envía correo cuando se solicita recuperación
Se envía correo cuando la contraseña es cambiada exitosamente
El correo incluye información del dispositivo o IP (opcional pero recomendado)
🧩 HU04 – Contactar soporte del sistema

Como usuario del sistema
quiero poder contactar al soporte técnico
para resolver problemas de acceso, errores o dudas del sistema

📌 Criterios de aceptación:
Formulario de contacto disponible sin autenticación (desde landing)
Formulario incluye:
Nombre
Correo
Colegio (opcional o automático)
Tipo de problema
Descripción
El mensaje se registra en el sistema o se envía a correo de soporte
Se genera número de ticket
🧩 HU05 – Gestión de tickets de soporte (Directivo/Admin)

Como directivo o administrador del sistema
quiero visualizar los tickets de soporte
para dar seguimiento a problemas reportados

📌 Criterios de aceptación:
Listado de tickets con estado: abierto, en proceso, resuelto
Filtro por colegio, usuario y fecha
Posibilidad de responder al usuario
Cambio de estado del ticket
