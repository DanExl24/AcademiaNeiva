# 📋 Casos de Uso — Flujo de Correos, Recuperación y Verificación OTP

**Módulo:** 21. Flujo de Correos Electrónicos, Recuperación y Verificación OTP  
**Sistema:** Academia Neiva  

---

## CU-MAIL-01: Verificación de Correo en Matrícula Pública

| Atributo | Detalle |
|---|---|
| **Identificador** | `CU-MAIL-01` |
| **Actor Principal** | Padre de familia / Acudiente (Público) |
| **Precondiciones** | El usuario ha diligenciado los campos del Paso 1 (colegio, nivel, grado, jornada, correo) y ha subido los documentos en el Paso 2. |
| **Postcondiciones** | El correo queda verificado en `public.codigo_verificacion_email` con `tipo = 'MATRICULA_NUEVA'` y se procesa la solicitud de matrícula. |

### Flujo Principal
1. El acudiente finaliza el Paso 2 y pulsa "Continuar" para acceder al Paso 3 de confirmación.
2. El sistema muestra el resumen de su solicitud y el botón **"Enviar y Validar Correo"**.
3. El acudiente pulsa el botón.
4. El frontend envía `POST /api/matriculas/send-email-code` con el correo del acudiente.
5. El backend ejecuta `EmailVerificationService.sendCode`, genera un OTP de 6 dígitos con expiración a 15 minutos, lo guarda en `codigo_verificacion_email` y envía el correo con `NotificationService`.
6. El frontend vacía la tarjeta del formulario y muestra **únicamente la interfaz de verificación de 6 dígitos**.
7. El acudiente consulta su buzón, digita el código de 6 dígitos y pulsa **"Confirmar y Radicar Matrícula"**.
8. El frontend envía `POST /api/matriculas/verify-email-code`.
9. El backend ejecuta `EmailVerificationService.verifyCode` y marca el registro como `verified = true`.
10. El frontend ejecuta de inmediato `POST /api/matriculas/submit` con la información del formulario y los archivos adjuntos.
11. El backend valida mediante `EmailVerificationService.isVerified` que el correo fue validado en las últimas 2 horas y radica la matrícula.
12. El sistema muestra la notificación de éxito y redirige al inicio.

### Flujos Alternativos
- **4a / 8a. Correo inválido o código erróneo:**
  - El sistema muestra una alerta de notificación indicando el error.
  - El usuario puede corregir el código ingresado.
- **8b. Código expirado (> 15 minutos):**
  - El sistema informa que el código ha caducado y habilita el botón "Reenviar código" para generar un nuevo OTP.
- **6a. Error al escribir el correo:**
  - El acudiente presiona "← Modificar correo o datos", lo cual retorna al resumen para ajustar la información.

---

## CU-MAIL-02: Cambio de Correo Electrónico en Perfil

| Atributo | Detalle |
|---|---|
| **Identificador** | `CU-MAIL-02` |
| **Actor Principal** | Usuario Autenticado |
| **Precondiciones** | Sesión activa con token JWT válido. |
| **Postcondiciones** | La columna `usuario.email` se actualiza con el nuevo correo verificado. |

### Flujo Principal
1. El usuario accede a la vista de Perfil (`ProfileView.vue`).
2. En la sección de datos personales, ingresa un nuevo correo y pulsa "Guardar".
3. El sistema invoca `POST /api/auth/profile/request-email-change`.
4. El backend verifica que el correo no esté ocupado por otro usuario.
5. `EmailVerificationService.sendCode` inserta el código para `tipo = 'CAMBIO_CORREO'` y envía el correo.
6. El usuario ingresa el código en el modal de verificación y pulsa "Confirmar".
7. El backend valida el OTP mediante `EmailVerificationService.verifyCode`, actualiza `usuario.email` y marca `verified = true`.
8. El sistema muestra mensaje de éxito y actualiza la sesión.

---

## CU-MAIL-03: Restablecimiento de Contraseña

| Atributo | Detalle |
|---|---|
| **Identificador** | `CU-MAIL-03` |
| **Actor Principal** | Usuario Registrado |
| **Precondiciones** | El correo debe existir en la tabla `usuario`. |
| **Postcondiciones** | Se actualiza la contraseña con hash Bcrypt. |

### Flujo Principal
1. El usuario accede a `/forgot-password` e ingresa su correo institucional/personal.
2. El sistema genera un token seguro de 32 bytes con expiración a 1 hora en `password_reset_tokens`.
3. `NotificationService.sendPasswordResetEmail` envía el enlace con el token al buzón del usuario.
4. El usuario hace clic en el enlace y accede a `/reset-password?token=...`.
5. El usuario digita su nueva contraseña y pulsa "Restablecer Contraseña".
6. El backend valida el token, encripta la contraseña, la actualiza en `usuario` y elimina el token consumido.
