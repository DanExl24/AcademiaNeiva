## RA01 - Panel de Administrador General
Como: Admin General
Quiero : Un panel de Usuario Administrativo
Para: Administrar todos los colegios vinculados al sistema y los usuarios registrados en el sistema

Criterios de Aceptacion:
El administrador debe poder realizar las siguientes acciones:
- Registrar un nuevo colegio
- Editar la informacion de un colegio
- Eliminar un colegio
- Ver la informacion de un colegio
- Ver las cuentas de todos los usuarios registrados en el sistema
- Eliminar cuentas de los usuarios registrados en el sistema
- Banear usuarios registrados en el sistema

# Colegios
- Registrar Nuevo colegio
- Eliminar Colegio
- Borrar Colegio
- Suspender Colegio
- Actualizar informacion del Colegio
- Aceptar la incorporacion de un Colegio dentro del sistema
- Rechazar la incorporacion de un Colegio dentro del sistema
- Ver lista de Colegios dentro del sistema
El sistema debe impedir que un colegio suspendido pueda iniciar sesión.
El sistema debe permitir cambiar el estado de un colegio
El sistema debe notificar a los directivos cuando el estado del colegio cambie.
## Directivos
- Registrar directivos
- Actualizar informacion de Directivos
- Desvincular directivos
- Banear directivos
- Eliminar directivos
- Ver lista de directivos
## Docentes
- Ver lista de Docentes
## Padres de Familia
- Ver lista de Padres de Familia
## Estudiantes
- Ver lista de Estudiantes

## Usuario generales
- Crear un Usuario
- Banear un Usuario
- Desbanear un Usuario
- Eliminar un Usuario
- Ver la informacion de un Usuario
- Ver lista de Usuarios
- Cambiar estado de un usuario segun el rol del usuario
- Forzar cierre de sesion de un usuario
- Restablecer contraseña de un usuario

# Modo Supervision
El sistema debe generar un modo supervision
El modo Supervision debe ser aceptado por uno de los directivos de el colegio para que se pueda activar
El admin general puede entrar al modo supervision como solo lectura o como editor
El estado del modo editor debe ser aprobado por uno de los directivos
El estado del modo solo lectura debe ser aprobado por uno de los directivos
## Funcionalidades

- Solicitud de Supervision
El sistema debe generar una solicitud de supervisión.
El sistema debe registrar el motivo de la solicitud.
El sistema debe registrar la fecha de la solicitud.
- Aprobacion de la solicitud
El sistema debe solicitar una nueva autenticación antes de iniciar el modo supervisión.
El sistema debe preguntar la razon del por que ha iniciado el modo supervision en el colegio
El sistema debe solicitar confirmación antes de heredar permisos de rector.
El sistema debe registrar qué directivo autorizó el acceso.
El sistema debe registrar la fecha y hora de aprobación.
- Tiempo limite del modo supervision
El sistema debe permitir configurar una duración máxima para el modo supervisión.
El sistema debe finalizar automáticamente la sesión cuando expire el tiempo autorizado.
- Entrada modo supervision
El sistema debe permitir al admin general entrar al colegio seleccionado como rol rector
El admin general heredara los permisos de Rector por tiempo limitado
El sistema debe generar una auditoria del tiempo que el admin general permanecio en el colegio
El sistema debe notificar a todos los directivos del colegio que el admin general ha entrado en modo supervision
- Salida modo supervision
El admin general podra salir del modo supervision cuando desee
El sistema debe notificar a todos los directivos del colegio que el admin general ha salido del modo supervision
El sistema debe generar auditorias de todas las acciones del admin general dentro del colegio cuando hereda los permisos del rector
El sistema debe registrar cuando un administrador exporte información del colegio.


### Reglas de Negocio RA01

# Colegios
Un colegio debe tener asignado uno de los siguientes estados:
- Pendiente
- Activo
- Suspendido
- Rechazado
- Eliminado
Todo colegio registrado deberá ser aprobado o rechazado por el Admin General antes de utilizar el sistema.
Todo cambio de estado de un colegio deberá ser notificado a sus directivos.
Un colegio no puede iniciar sesion si se encuentra en estado Pendiente o Suspendido.
Un colegio no puede ser editado si se encuentra en estado Eliminado.
Un colegio solo podrá acceder al sistema cuando su estado sea Activo.
Cuando se elimina un colegio, se debe eliminar todos los datos asociados al colegio.
Cuando se elimina un colegio, los usuarios se desvincularan automaticamente del colegio
Un directivo solo puede ser eliminado si no tiene estudiantes asignados.

# Usuarios
El Admin General podrá visualizar cualquier usuario registrado en el sistema independientemente de su rol.
Un usuario baneado no podrá iniciar sesión ni acceder al sistema.
El Admin General podrá restablecer la contraseña de cualquier usuario registrado.
El Admin General podrá finalizar sesiones activas de cualquier usuario.
El admin general puede cambiar el estado de cualquier usuario registrado.
Activo
Suspendido
Baneado
Eliminado

# Modo Supervision
Toda supervisión deberá iniciarse mediante una solicitud formal.
No se puede entrar a modo supervision sin un motivo de supervision
Se debe aprobar obligatoriamente el modo supervision del admin general, por uno de los directivos del colegio
Ningún modo de supervisión podrá activarse sin la aprobación de un directivo perteneciente al colegio.
Antes de iniciar el modo supervision, se debe solicitar una nueva autenticación al admin general
Cuando el admin general inicia el modo supervision, hereda los permisos de rector
Cuando el admin general sale del modo supervision, pierde los permisos de rector
El modo supervisión podrá ejecutarse únicamente en:
- Modo Solo Lectura
- Modo Editor
La aprobación del directivo será obligatoria tanto para el modo Solo Lectura como para el modo Editor.
Toda supervisión deberá tener una duración máxima configurada.
La supervisión finalizará automáticamente cuando expire el tiempo autorizado.
El directivo que autorizó la supervisión podrá revocar el acceso en cualquier momento.
La entrada y salida de una supervisión deberán notificarse a todos los directivos del colegio.
Toda supervisión deberá generar una auditoría completa.
# Auditorias
Las auditorias debe registrar
- Cuando entro el admin general
- Cuando salio el admin general
- A que modulo del sistema entro
- Que acciones dentro del modulo realizo
- Que datos dentro del modulo cambio
- Cual era el valor anterior y despues de aquel cambio
- Motivo de entrada al modo supervision
- Fecha exacta de la auditoria
- Hora exacta de la auditoria
- Motivo de cada modificación realizada durante la supervisión.
Toda modificación deberá almacenar:
- Valor anterior
- Valor nuevo
Toda modificación realizada durante la supervisión deberá incluir una justificación.
La auditoría deberá registrar:
- Directivo que aprobó
- Fecha de aprobación
- Hora de aprobación
El directivo que autorizó la supervisión podrá revocar el acceso en cualquier momento.
La entrada y salida de una supervisión deberán notificarse a todos los directivos del colegio.
La auditoría deberá almacenar el motivo que originó la supervisión.
Toda exportación de datos realizada por el Admin General deberá quedar registrada en la auditoría.
Toda acción realizada durante la supervisión deberá poder asociarse al:
- Admin General que la ejecutó.
- Colegio afectado.
- Usuario afectado
- Fecha y hora exactas.
Los registros de auditoría no podrán ser modificados ni eliminados desde la aplicación.
Los registros de auditoría deberán ser conservados por un período mínimo de 5 años.
Las auditorías deberán ser exportables por el Admin General para fines de revisión externa.
Las auditorías deberán ser accesibles para consultas internas cuando sea necesario.


## DR01 - Identidad Institucional del Colegio
Como: Directivo
Quiero: Una opcion para cargar el escudo de los colegios
Para: Preservar la identidad Institucional del colegio y adaptar sus colores a la plataforma

## Criterios de Aceptacion
El sistema debe permitir cargar imágenes en formato JPG, JPEG, PNG y SVG.
El sistema debe validar el tamaño máximo permitido para el archivo.
El directivo podrá gestionar la identidad institucional de cada colegio, permitiendo la personalización de su escudo y colores corporativos.
El sistema almacenará el archivo de imagen del escudo y los códigos de color principales.
El sistema debe permitir cambiar los colores principales de la siguiente manera:
- Colores primarios del colegio
- Colores secundarios del colegio
El sistema debe permitir cambiar los colores del colegio en cualquier momento
El sistema debe reflejar una vista para cambiar el diseño frontend de la plataforma segun los colores primarios y secundarios del colegio
El sistema debera mostrar una vista previa de los colores implementados en la plataforma
El sistema debe mostrar una vista previa de:
- Barra lateral
- Barra superior
- Botones
- Enlaces
- Tarjetas
El sistema debe permitir guardar los cambios realizados
El sistema debe permitir deshacer los cambios realizados
El sistema debe permitir restablecer los colores por defecto del colegio
Los cambios guardados deben reflejarse para todos los usuarios pertenecientes al colegio.
El sistema debe registrar las modificaciones realizadas sobre:
- Escudo institucional
- Color primario
- Color secundario

## Reglas de Negocio
Los cambios de identidad visual solo afectarán los paneles internos del colegio.
La identidad visual de un colegio no podrá afectar la interfaz de otros colegios.
La landing page institucional de la plataforma mantendrá su diseño corporativo y no podrá ser personalizada por los colegios.
Cada colegio podrá tener únicamente:
- Un escudo activo
- Un color primario activo
- Un color secundario activo
Los colores seleccionados deberán cumplir criterios mínimos de contraste y legibilidad.
Restablecer colores por defecto devolverá la configuración visual inicial definida para el colegio.





## DR02 - Periodos en Estado Pendiente
Como: Directivo
Quiero: Crear un estado "Pendiente" para los periodos académicos
Para: Evitar el uso de periodos académicos no aprobados o en proceso de configuración

## Criterios de Aceptacion
El sistema debe permitir crear un periodo académico con estado "Pendiente".
El directivo debe aprobar un periodo académico para cambiar su estado a "Activo".
El sistema no debe permitir registrar notas o evaluaciones en periodos académicos en estado "Pendiente".
Todo cambio de estado de un periodo académico debe registrarse en la auditoría.

## Reglas de Negocio
Debe existir una opcion de configurar un periodo academico como estado pendiente
Un periodo en estado pendiente no puede tener un rango de fechas anterior al periodo actual
Se debe permitir registrar un periodo academico en estado pendiente si sus rangos de fechas son posteriores al periodo actual
El estado pendiente solo afectara al periodo academico
No se permitirá registrar:
- Notas
- Evaluaciones
- Asistencias
- Observaciones
- Actividades calificables
Un periodo académico pendiente solo podrá activarse si el periodo anterior se encuentra Cerrado.
Los rangos de fechas de los periodos académicos no pueden superponerse.
Se debe permitir
- Crear el periodo
- Configurar fechas
- Configurar porcentaje del periodo
- Configurar observaciones administrativas
para periodos academicos en estado pendiente
El sistema podrá activar automáticamente un periodo pendiente cuando:
- La fecha de inicio sea alcanzada.
- El periodo anterior se encuentre cerrado.
Toda modificación de fechas de un periodo pendiente debe registrarse en auditoría.
Un periodo pendiente no puede pasar directamente a Cerrado.



## DR03 - Gestión de Fechas de Inscripción
Como: Directivo

Quiero: Gestionar las fechas de inicio y cierre de inscripciones de matrícula

Para: Controlar cuándo los padres de familia pueden registrar solicitudes de matrícula para un año académico determinado.

## Criterios de Aceptación
El sistema debe proporcionar una vista para configurar las fechas de inscripción de matrícula.
El directivo debe poder configurar:
Fecha de inicio de inscripciones.
Fecha de cierre de inscripciones.
Año académico al que pertenecen las inscripciones.
Estado de las inscripciones (Habilitadas o Deshabilitadas).
El sistema debe mostrar las fechas de inscripción al momento de iniciar una solicitud de matrícula.
El sistema debe permitir modificar las fechas de inscripción mientras no existan solicitudes aprobadas para el año académico configurado.
El sistema debe registrar en auditoría toda modificación realizada sobre las fechas de inscripción.
El sistema debe permitir habilitar o deshabilitar manualmente las inscripciones sin modificar las fechas configuradas.


## Reglas de Negocio

La fecha de cierre de inscripciones debe ser posterior a la fecha de inicio.
No podrán existir dos periodos de inscripción activos simultáneamente para el mismo año académico.
Solo se permitirá registrar nuevas solicitudes de matrícula cuando:
La fecha actual se encuentre dentro del rango de inscripción configurado.
Las inscripciones se encuentren habilitadas.
No se permitirá registrar nuevas solicitudes de matrícula después de la fecha de cierre de inscripciones.
Las solicitudes de matrícula registradas dentro del periodo de inscripción podrán ser revisadas, aprobadas o rechazadas después de la fecha de cierre.
Las fechas de inscripción configuradas deberán mostrarse a los usuarios antes de iniciar una solicitud de matrícula.
Toda modificación de fechas o del estado de las inscripciones deberá registrarse en auditoría.
La deshabilitación manual de las inscripciones impedirá la creación de nuevas solicitudes de matrícula independientemente de las fechas configuradas.
Cada configuración de inscripción deberá estar asociada a un único año académico.
Las fechas de inscripción no afectarán las solicitudes ya registradas antes del cierre del periodo






## DR04 - Renovación de Matrícula

### Como:

Padre de Familia

### Quiero:

Renovar la matrícula de un estudiante ya registrado en el colegio

### Para:

Continuar su proceso académico sin volver a diligenciar toda la información institucional.

## Criterios de Aceptación

* El sistema debe identificar si el estudiante estuvo matriculado durante el año académico anterior.
* El sistema debe permitir reutilizar la información registrada previamente.
* El sistema debe permitir actualizar los datos que hayan cambiado.
* El sistema debe mostrar al directivo que la solicitud corresponde a una renovación.
* El sistema debe validar el estado académico del estudiante antes de permitir la renovación.
* El sistema debe registrar la renovación en auditoría.

## Reglas de Negocio

### RN-01

Solo podrán renovar matrícula estudiantes matriculados durante el año académico inmediatamente anterior.

### RN-02

Los estudiantes en estado Activo podrán realizar renovación.

### RN-03

Los estudiantes en estado Suspendido no podrán renovar matrícula hasta que la suspensión sea levantada.

### RN-04

Los estudiantes en estado Expulsado no podrán renovar matrícula.

### RN-05

Los estudiantes en estado Traslado no podrán renovar matrícula en la institución de origen.

### RN-06

Toda renovación deberá generar una nueva matrícula para el año académico correspondiente.






## DR05 - Reingreso de Estudiante

### Como:

Directivo

### Quiero:

Gestionar el reingreso de estudiantes que hayan abandonado la institución

### Para:

Permitir su reincorporación al proceso académico.

## Criterios de Aceptación

* El sistema debe identificar estudiantes retirados o desertores.
* El sistema debe permitir solicitar el reingreso.
* El sistema debe conservar el historial académico del estudiante.
* El sistema debe registrar el motivo del reingreso.
* El sistema debe registrar la aprobación del reingreso.

## Reglas de Negocio

### RN-01

Solo los estudiantes en estado Retirado o Desertor podrán solicitar reingreso.

### RN-02

Los estudiantes en estado Expulsado no podrán realizar reingreso.

### RN-03

Los estudiantes en estado Graduado no podrán realizar reingreso.

### RN-04

El historial académico del estudiante deberá mantenerse intacto.

### RN-05

La aprobación del reingreso deberá ser realizada por un directivo.





## DR06 - Gestión de Graduados

### Como:

Directivo

### Quiero:

Gestionar el cambio de estado a Graduado

### Para:

Cerrar formalmente el ciclo académico de estudiantes que culminen sus estudios.

## Criterios de Aceptación

* El sistema debe permitir marcar estudiantes como graduados.
* El sistema debe conservar permanentemente el historial académico.
* El sistema debe impedir nuevas matrículas de estudiantes graduados.
* El sistema debe registrar la fecha de graduación.

## Reglas de Negocio

### RN-01

Solo estudiantes de grado Undécimo podrán adquirir el estado Graduado.

### RN-02

El estudiante deberá haber aprobado los requisitos académicos definidos por la institución.

### RN-03

Un estudiante graduado no podrá matricularse nuevamente.

### RN-04

El historial académico del estudiante deberá conservarse de forma permanente.

### RN-05

El cambio de estado a Graduado deberá registrarse en auditoría.







## DR05 - Matrícula Extraordinaria

### Como:

Directivo

### Quiero:

Registrar una matrícula extraordinaria fuera del periodo oficial de inscripciones

### Para:

Permitir el ingreso de estudiantes en situaciones excepcionales debidamente justificadas.

## Criterios de Aceptación

* El sistema debe proporcionar una opción para crear una matrícula extraordinaria.
* La opción deberá mostrarse mediante un modal o formulario independiente al proceso regular de matrícula.
* El sistema debe permitir seleccionar al estudiante o crear una nueva solicitud de matrícula extraordinaria.
* El sistema debe solicitar obligatoriamente el motivo de la matrícula extraordinaria.
* El sistema debe registrar la fecha de creación de la matrícula extraordinaria.
* El sistema debe registrar el directivo responsable de la aprobación.
* El sistema debe permitir adjuntar observaciones adicionales.
* El sistema debe permitir continuar con el proceso normal de matrícula una vez aprobada la excepción.
* El sistema debe registrar en auditoría todas las acciones relacionadas con la matrícula extraordinaria.

## Reglas de Negocio

### RN-01

Las matrículas extraordinarias solo podrán ser creadas por usuarios con rol Directivo o superior.

### RN-02

Toda matrícula extraordinaria deberá contener un motivo obligatorio.

### RN-03

Las matrículas extraordinarias podrán registrarse fuera de las fechas oficiales de inscripción.

### RN-04

Las matrículas extraordinarias no modificarán ni extenderán las fechas oficiales de inscripción.

### RN-05

Toda matrícula extraordinaria deberá quedar identificada con el tipo "EXTRAORDINARIA".

### RN-06

El sistema deberá registrar:

* Fecha de creación.
* Usuario responsable.
* Motivo de la excepción.
* Estado de la solicitud.

### RN-07

Las matrículas extraordinarias deberán seguir las mismas validaciones académicas que una matrícula regular.

### RN-08

Los estudiantes en estado Expulsado no podrán ser matriculados mediante matrícula extraordinaria.

### RN-09

Los estudiantes en estado Graduado no podrán ser matriculados mediante matrícula extraordinaria.

### RN-10

Las matrículas extraordinarias deberán quedar registradas en la auditoría institucional.

### RN-11

La aprobación de una matrícula extraordinaria no exime al estudiante de cumplir los requisitos documentales exigidos por la institución.

### RN-12

Las matrículas extraordinarias podrán encontrarse en uno de los siguientes estados:

* Pendiente
* Aprobada
* Rechazada
* Cancelada
