# 📖 Historias de Usuario — Flujo de Correos, Recuperación y Verificación OTP

**Módulo:** 21. Flujo de Correos Electrónicos, Recuperación y Verificación OTP  
**Sistema:** Academia Neiva  

---

## HU-MAIL-01: Verificación de Correo en Inscripción de Matrícula Pública

**Como:** Padre de familia o acudiente que realiza una solicitud de matrícula nueva.  
**Quiero:** Recibir un código de 6 dígitos en mi correo electrónico antes de radicar la matrícula.  
**Para:** Validar que mi correo fue escrito correctamente y asegurar que recibiré todas las notificaciones y credenciales de mi acudido.

### Criterios de Aceptación:
- **Dado que** el acudiente completó los Pasos 1 y 2 del formulario de matrícula pública y da clic en "Enviar y Validar Correo",
- **Cuando** el sistema procesa la solicitud de código,
- **Entonces** se envía un código numérico de 6 dígitos a su correo electrónico y el formulario muestra exclusivamente la pantalla de verificación con un temporizador de 15 minutos.
- **Dado que** el usuario digita el código correcto de 6 dígitos y presiona "Confirmar y Radicar Matrícula",
- **Cuando** el servidor valida el código exitosamente,
- **Entonces** se procesan los documentos, se persiste la solicitud de matrícula y se le muestra un mensaje de éxito redirigiéndolo al inicio.
- **Dado que** el código expiró o fue digitado incorrectamente,
- **Cuando** el usuario intenta confirmar,
- **Entonces** el sistema muestra un mensaje de error y le permite reenviar un nuevo código sin perder los datos previamente diligenciados.

---

## HU-MAIL-02: Cambio de Correo Electrónico en Perfil de Usuario

**Como:** Usuario autenticado en el sistema (Directivo, Docente, Padre, Estudiante o Admin).  
**Quiero:** Solicitar el cambio de mi correo electrónico y confirmarlo mediante un código OTP enviado al nuevo buzón.  
**Para:** Mantener actualizados mis datos de contacto sin comprometer la seguridad de mi cuenta institucional.

### Criterios de Aceptación:
- **Dado que** el usuario autenticado ingresa a su Perfil e introduce un nuevo correo electrónico no registrado previamente,
- **Cuando** presiona "Solicitar Cambio",
- **Entonces** el sistema envía un código de 6 dígitos al nuevo correo con validez de 15 minutos y abre el diálogo para ingresar el código.
- **Dado que** el usuario digita el código recibido en el nuevo correo,
- **Cuando** confirma la operación,
- **Entonces** el sistema actualiza la columna `email` en la tabla `usuario` y confirma la actualización exitosa.

---

## HU-MAIL-03: Recuperación Segura de Contraseña

**Como:** Usuario registrado que olvidó su contraseña de acceso.  
**Quiero:** Solicitar un enlace seguro de restablecimiento a mi correo electrónico.  
**Para:** Generar una nueva clave de acceso de manera autónoma y segura.

### Criterios de Aceptación:
- **Dado que** un usuario introduce su correo registrado en la pantalla "Olvidé mi contraseña",
- **Cuando** presiona "Enviar instrucciones",
- **Entonces** el sistema genera un token criptográfico temporal con 1 hora de expiración y envía un enlace seguro a su bandeja.
- **Dado que** el usuario accede al enlace dentro del plazo de 1 hora,
- **Cuando** ingresa y confirma su nueva contraseña,
- **Entonces** la contraseña es encriptada con Bcrypt, se actualiza en la base de datos y el token queda invalidado de inmediato.

---

## HU-MAIL-04: Notificación Automática de Credenciales y Estados

**Como:** Directivo de institución educativa o Administrador General.  
**Quiero:** Que el sistema notifique por correo a los usuarios cuando se crean cuentas o se actualiza el estado de una matrícula.  
**Para:** Garantizar una comunicación ágil y transparente con toda la comunidad educativa.

### Criterios de Aceptación:
- **Dado que** se aprueba una matrícula o se registra un nuevo directivo/docente,
- **Cuando** el sistema genera sus credenciales institucionales,
- **Entonces** se despacha un correo HTML institucional con el usuario, rol, enlace de ingreso y recomendaciones de seguridad.
