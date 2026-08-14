# 📜 Reglas de Negocio — Flujo de Correos, Recuperación y Verificación OTP

**Módulo:** 21. Flujo de Correos Electrónicos, Recuperación y Verificación OTP  
**Sistema:** Academia Neiva  

---

## Índice de Reglas de Negocio

- **RN-MAIL-001:** Validación previa y obligatoria de correo en matrícula nueva.
- **RN-MAIL-002:** Formato y entropía del código OTP de un solo uso.
- **RN-MAIL-003:** Tiempo de caducidad estricto (15 minutos).
- **RN-MAIL-004:** Un solo uso y prevención de reutilización (Replay Attacks).
- **RN-MAIL-005:** Centralización y aislamiento por tipo de verificación.
- **RN-MAIL-006:** Verificación obligatoria para cambio de correo en perfil de usuario.
- **RN-MAIL-007:** Prevención de duplicidad de correo en usuarios activos.
- **RN-MAIL-008:** Expiración e invalidación de tokens de restablecimiento de contraseña.
- **RN-MAIL-009:** Normalización canónica de correos electrónicos.
- **RN-MAIL-010:** Eliminación en cascada por borrado de usuario.

---

### RN-MAIL-001: Validación previa y obligatoria de correo en matrícula nueva
- **Descripción:** Antes de radicar la solicitud de matrícula y guardar los documentos cargados, el sistema exige que el acudiente valide su correo electrónico mediante el código OTP de 6 dígitos.
- **Justificación:** Previene la creación de registros fantasma o con correos erróneos donde luego resulte imposible notificar las credenciales y el estado de la matrícula.
- **Criterio de Validación:** La función `MatriculaService.createEnrollment` consulta si existe un registro verificado (`verified = true`) para ese correo y tipo `'MATRICULA_NUEVA'` dentro de las últimas 2 horas. Si no existe, rechaza la petición con código `400 Bad Request`.

---

### RN-MAIL-002: Formato y entropía del código OTP
- **Descripción:** Todo código de verificación OTP emitido debe constar de exactamente 6 dígitos numéricos comprendidos entre `100000` y `999999`.
- **Justificación:** Ofrece 900.000 combinaciones posibles, equilibrando una alta seguridad criptográfica con facilidad de digitación para el usuario en dispositivos móviles o navegadores.

---

### RN-MAIL-003: Tiempo de caducidad estricto (15 minutos)
- **Descripción:** Los códigos OTP generados tienen una vigencia máxima de 15 minutos desde el momento exacto de su inserción (`expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'`).
- **Comportamiento:** Si un usuario intenta validar un código después de transcurridos los 15 minutos, el sistema denegará la validación e instruirá a solicitar un nuevo código.

---

### RN-MAIL-004: Un solo uso y prevención de reutilización
- **Descripción:** Una vez que un código OTP es validado satisfactoriamente, su campo `verified` cambia inmediatamente a `true`.
- **Efecto:** Ningún código puede ser utilizado dos veces para validar un formulario posterior ni por peticiones duplicadas.

---

### RN-MAIL-005: Centralización y aislamiento por tipo de verificación
- **Descripción:** Toda verificación se registra en la tabla `public.codigo_verificacion_email` categorizada por su tipo ENUM:
  - `'MATRICULA_NUEVA'`
  - `'CAMBIO_CORREO'`
  - `'RECUPERACION_PASSWORD'`
- **Efecto:** Un código emitido para una matrícula nueva no puede ser reutilizado para cambiar el correo de un perfil de usuario o restablecer una contraseña.

---

### RN-MAIL-006: Verificación obligatoria para cambio de correo en perfil
- **Descripción:** Cuando un usuario autenticado (Directivo, Docente, Padre, Estudiante o Admin) solicita actualizar su correo en su perfil:
  1. El sistema no altera inmediatamente la columna `usuario.email`.
  2. Genera un código OTP vinculado a `id_usuario` y lo envía al **nuevo correo**.
  3. Solo cuando el usuario digita el código en el sistema, se actualiza el correo en la tabla `usuario`.

---

### RN-MAIL-007: Prevención de duplicidad de correo en usuarios activos
- **Descripción:** Antes de despachar un código para `CAMBIO_CORREO` o registrar un usuario, el sistema verifica que el nuevo correo no se encuentre ya en uso por otro usuario registrado.

---

### RN-MAIL-008: Expiración e invalidación de tokens de restablecimiento de contraseña
- **Descripción:** Los tokens de restablecimiento de contraseña (`password_reset_tokens`) tienen una validez de 1 hora. Al consumirse el token o generarse uno nuevo, los tokens previos del usuario quedan revocados automáticamente.

---

### RN-MAIL-009: Normalización canónica de correos electrónicos
- **Descripción:** Todos los correos electrónicos recibidos en el sistema deben ser normalizados eliminando espacios en blanco circundantes (`trim()`) y convirtiéndolos a minúsculas (`toLowerCase()`) antes de persistir o comparar en base de datos.

---

### RN-MAIL-010: Eliminación en cascada por borrado de usuario
- **Descripción:** Si un usuario es eliminado de la base de datos, cualquier código pendiente en `codigo_verificacion_email` asociado a su `id_usuario` se purga automáticamente mediante la cláusula `ON DELETE CASCADE`.
