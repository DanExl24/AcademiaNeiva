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


## RA02 - Identidad Institucional del Colegio
Como: Admin General
Quiero: Una opcion para cargar el escudo de los colegios
Para: Preservar la identidad Institucional del colegio y adaptar sus colores a la plataforma

## Criterios de Aceptacion
El administrador general podrá gestionar la identidad institucional de cada colegio, permitiendo la personalización de su escudo y colores corporativos.
El sistema almacenará el archivo de imagen del escudo y los códigos de color principales.
El sistema debe permitir cambiar los colores principales de la siguiente manera:
- Colores primarios del colegio
- Colores secundarios del colegio
El sistema debe permitir cambiar los colores del colegio en cualquier momento
El sistema debe reflejar una vista para cambiar el diseño frontend de la plataforma segun los colores primarios y secundarios del colegio
El sistema debera mostrar una vista previa de los colores implementados en la plataforma
El sistema debe permitir guardar los cambios realizados
El sistema debe permitir deshacer los cambios realizados
El sistema debe permitir restablecer los colores por defecto del colegio

## Reglas de Historia de Usuario
El cambio de Colores solo debe verse reflejado en los paneles de usuarios y en sus navegaciones
La landing page del dashboard mantendra su design igual sin ningun cambio.