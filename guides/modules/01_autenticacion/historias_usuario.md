# Historias de Usuario — Autenticación y Sesiones

Este documento contiene las historias de usuario implementadas para el módulo de Autenticación, Sesiones y Perfil de AcademiaNeiva.

---

# HU-AUT-001: Iniciar Sesión (Directivos, Docentes, Padres y Administradores)

## Historia
**Como** usuario del sistema (Directivo, Docente, Padre de Familia o Administrador General)  
**Quiero** ingresar mi correo electrónico y contraseña  
**Para** acceder de forma segura al dashboard correspondiente a mi rol.

## Descripción
Permite a los usuarios administrativos y acudientes autenticarse en la plataforma mediante sus credenciales estándar. Al tener éxito, el sistema genera un token JWT que almacena sus roles y el colegio al que pertenecen.

## Criterios de Aceptación
- El correo electrónico debe estar registrado y activo en el sistema.
- Si el usuario está suspendido, baneado o eliminado, se deniega el inicio de sesión indicando que su cuenta se encuentra inactiva.
- Ante credenciales incorrectas, el sistema responde con un mensaje genérico para evitar la enumeración de cuentas.
- Aplica un límite de seguridad de máximo 10 intentos fallidos de inicio de sesión por dirección IP cada 15 minutos.
- Al autenticarse con éxito, se retorna un token JWT que es almacenado en la store local del frontend.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo, Docente, Padre, Administrador General
- **Reglas de negocio relacionadas:** RN-AUT-001, RN-AUT-002, RN-AUT-007, RN-AUT-008
- **Endpoints relacionados:** 
  - `POST /api/auth/login`
- **Componentes frontend relacionados:** 
  - [LoginView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/auth/LoginView.vue)
- **Controllers/Services relacionados:** 
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (`login`)

---

# HU-AUT-002: Iniciar Sesión de Estudiante (Portal Estudiantil)

## Historia
**Como** estudiante del colegio  
**Quiero** ingresar con mi código de estudiante y contraseña  
**Para** consultar mi rendimiento académico, fallas de asistencia y boletines.

## Descripción
Permite a los estudiantes del colegio acceder a su portal personal utilizando el código alfanumérico institucional en lugar de una dirección de correo electrónico tradicional.

## Criterios de Aceptación
- El estudiante debe ingresar su código único y su contraseña asignada.
- Si el estudiante tiene un estado personal de `EXPULSADO` o `RETIRADO`, el inicio de sesión es rechazado inmediatamente con un error de cuenta inactiva.
- El usuario en la tabla `usuario` asociado al estudiante debe estar marcado como `activo = true`.
- Ante credenciales incorrectas, el sistema responde con error de autenticación.
- Aplica el límite de seguridad de máximo 10 intentos de inicio de sesión cada 15 minutos.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Estudiante
- **Reglas de negocio relacionadas:** RN-AUT-002, RN-AUT-006, RN-AUT-007
- **Endpoints relacionados:** 
  - `POST /api/auth/student-login`
- **Componentes frontend relacionados:** 
  - [LoginView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/auth/LoginView.vue) (Sección de pestaña estudiante)
- **Controllers/Services relacionados:** 
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (`studentLogin`)

---

# HU-AUT-003: Solicitar Recuperación de Contraseña

## Historia
**Como** usuario que olvidó sus credenciales  
**Quiero** ingresar mi correo electrónico en el formulario de recuperación  
**Para** recibir un mensaje con instrucciones y un enlace seguro para restablecer mi contraseña.

## Criterios de Aceptación
- Si el correo electrónico no está registrado en el sistema, la respuesta del servidor es exitosa por motivos de privacidad, pero no se emite ningún email.
- Si el correo es válido, el sistema genera un token de un solo uso con expiración corta (2 horas).
- Se envía un mensaje al correo del usuario con el enlace formateado hacia la URL del frontend con el token generado.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Público
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `POST /api/auth/forgot-password`
- **Componentes frontend relacionados:** 
  - [ForgotPasswordView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/auth/ForgotPasswordView.vue)
- **Controllers/Services relacionados:** 
  - [passwordResetController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/passwordResetController.ts) (`forgotPassword`)
  - [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts)

---

# HU-AUT-004: Restablecer Contraseña con Token

## Historia
**Como** usuario que solicitó recuperar su cuenta  
**Quiero** ingresar una nueva contraseña a través del enlace recibido  
**Para** actualizar mis credenciales y volver a ingresar al sistema.

## Criterios de Aceptación
- La petición exige el token generado en la URL del enlace y la nueva contraseña.
- Si el token ha expirado, es inválido o ya fue usado, se rechaza la solicitud de forma explícita.
- La nueva contraseña debe cumplir con los requisitos mínimos de seguridad.
- Al procesarse correctamente, la contraseña anterior es sobrescrita mediante hash bcrypt, invalidando los tokens anteriores.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Público
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `POST /api/auth/reset-password`
- **Componentes frontend relacionados:** 
  - [ResetPasswordView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/auth/ResetPasswordView.vue)
- **Controllers/Services relacionados:** 
  - [passwordResetController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/passwordResetController.ts) (`resetPassword`)

---

# HU-AUT-005: Visualizar Información de Perfil

## Historia
**Como** usuario autenticado  
**Quiero** ingresar a la configuración de mi cuenta  
**Para** visualizar mis datos personales básicos e institucionales registrados.

## Criterios de Aceptación
- La solicitud requiere un token JWT válido de sesión.
- Retorna nombre, apellido, email, tipo de documento, número de documento, rol y la identidad visual del colegio correspondiente.

## Detalles Técnicos
- **Prioridad:** Baja
- **Roles involucrados:** Directivo, Docente, Padre, Estudiante, Administrador General
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `GET /api/auth/profile`
- **Componentes frontend relacionados:** 
  - [ProfileView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/ProfileView.vue)
- **Controllers/Services relacionados:** 
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (`getUserProfile`)

---

# HU-AUT-006: Actualizar Datos de la Cuenta (Email y Contraseña)

## Historia
**Como** usuario autenticado  
**Quiero** modificar mi correo de contacto o ingresar una nueva contraseña en mi perfil  
**Para** mantener actualizada mi información personal y proteger mi cuenta.

## Criterios de Aceptación
- Para cambiar la contraseña, se exige ingresar la contraseña actual para verificar la identidad.
- El nuevo correo no debe estar en uso por otra cuenta en la base de datos.
- Tras cambiar la contraseña con éxito, el sistema actualiza la marca `logged_out_at` en base de datos para invalidar las sesiones iniciadas en otros dispositivos de forma inmediata.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo, Docente, Padre, Estudiante, Administrador General
- **Reglas de negocio relacionadas:** RN-AUT-003
- **Endpoints relacionados:** 
  - `PUT /api/auth/profile/email`
  - `PUT /api/auth/profile/password`
- **Componentes frontend relacionados:** 
  - [ProfileView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/ProfileView.vue)
- **Controllers/Services relacionados:** 
  - [authController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/authController.ts) (`updateProfileEmail`, `updateProfilePassword`)

---

# HU-AUT-007: Consultar Directorio Institucional

## Historia
**Como** miembro activo de la institución  
**Quiero** acceder a la pestaña de directorio  
**Para** buscar y consultar los correos electrónicos de los docentes y directivos de mi colegio.

## Criterios de Aceptación
- La vista solo está disponible para usuarios con sesión iniciada.
- Muestra los nombres, apellidos, rol e email de los funcionarios de la misma institución.
- Los estudiantes y padres pueden ver el listado de docentes del colegio.

## Detalles Técnicos
- **Prioridad:** Baja
- **Roles involucrados:** Directivo, Docente, Padre, Estudiante
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `GET /api/auth/directory` (o ruta integrada en vistas compartidas)
- **Componentes frontend relacionados:** 
  - [DirectoryView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/DirectoryView.vue)
