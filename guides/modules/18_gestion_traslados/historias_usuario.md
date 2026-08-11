# 📖 Historias de Usuario — Módulo de Gestión de Traslados

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Traslados (Interinstitucionales e Internos)  
**Última actualización:** 2026-08-10

---

## HU-TRA-001: Creación de Solicitud de Traslado Interinstitucional

**Como** Directivo Escolar, Administrador General o Acudiente/Usuario,  
**Quiero** registrar una solicitud de traslado de institución para un estudiante o usuario,  
**Para** iniciar el flujo de aprobación y transferir su vínculo académico a un nuevo colegio.

### Criterios de Aceptación

1. **Dado** que el usuario origen tiene una vinculación activa (`ACTIVO`) en `usuario_colegio` con el colegio de origen,  
2. **Cuando** se envía la solicitud mediante `POST /api/traslados` especificando `id_usuario`, `id_colegio_origen`, `id_colegio_destino`, `tipo` y `motivo`,  
3. **Entonces** el sistema valida que las instituciones sean diferentes y que no exista otra solicitud en trámite entre los mismos colegios.  
4. **Y** registra la solicitud en estado `EN_APROBACION`, creando automáticamente el primer registro de aprobación (`APROBAR`) para el creador.

---

## HU-TRA-002: Consenso Tripartito de Aprobación de Traslado

**Como** Directivo de Origen, Directivo de Destino o Padre de Familia / Acudiente Legal,  
**Quiero** revisar el detalle y registrar mi voto de aprobación o rechazo en una solicitud de traslado,  
**Para** dar el consentimiento de transferencia institucional.

### Criterios de Aceptación

1. **Dado** una solicitud de traslado en estado `EN_APROBACION`,  
2. **Cuando** un usuario autorizado envía `POST /api/traslados/:id/aprobacion` con la acción `APROBAR`, `RECHAZAR` o `CANCELAR`,  
3. **Entonces** el sistema valida que el usuario no haya votado previamente y que posea el rol de representación correspondiente (`DIRECTIVO_ORIGEN`, `DIRECTIVO_DESTINO`, o `USUARIO` otorgado al Padre/Acudiente legal del estudiante en `TRASLADO_MATRICULA`).  
4. **Si** un estudiante menor de edad intenta aprobar directamente su propio traslado de matrícula, el sistema rechaza la solicitud exigiendo el aval del Padre/Acudiente legal registrado.  
5. **Si** la acción es `RECHAZAR` o `CANCELAR`, la solicitud finaliza inmediatamente con dicho estado.  
6. **Si** la acción es `APROBAR`, el sistema evalúa si se han completado los 3 votos requeridos (`DIRECTIVO_ORIGEN`, `DIRECTIVO_DESTINO`, `USUARIO`).

---

## HU-TRA-003: Ejecución Transaccional Atómica de Traslado

**Como** Sistema AcademiaNeiva,  
**Quiero** ejecutar de manera transaccional el cambio de institución una vez completadas las 3 aprobaciones o autorizado por el Admin General,  
**Para** garantizar que la información académica y el estado del usuario permanezcan consistentes sin duplicidad ni pérdidas.

### Criterios de Aceptación

1. **Dado** que una solicitud reúne los 3 votos de aprobación o una aprobación de `ADMIN_GENERAL`,  
2. **Cuando** se ejecuta la función `ejecutarTrasladoTransaccional` dentro de un bloque `BEGIN ... COMMIT` con `SELECT FOR UPDATE`,  
3. **Entonces** el sistema desactiva la vinculación en el colegio de origen (`estado = 'INACTIVO'`, `fecha_fin = NOW()`),  
4. **Y** crea/activa la vinculación en el colegio de destino (`estado = 'ACTIVO'`, `fecha_inicio = NOW()`),  
5. **Y** actualiza `usuario.id_colegio` e `estudiante.id_colegio` a la nueva institución,  
6. **Y** si es un `TRASLADO_MATRICULA`, marca la matrícula original como `TRASLADADA` y finaliza la solicitud como `EJECUTADA`.

---

## HU-TRA-004: Traslado Interno de Grupo con Notificación por Email

**Como** Directivo Escolar,  
**Quiero** trasladar a un estudiante de un salón/grupo a otro dentro del mismo colegio indicando una justificación,  
**Para** reubicar al alumno en el curso correcto y notificar formalmente a su acudiente.

### Criterios de Aceptación

1. **Dado** que el directivo se encuentra en la pantalla de gestión de estudiantes (`StudentManagement.vue`),  
2. **Cuando** selecciona "Trasladar de Grupo", escoge el grupo de destino e ingresa obligatoriamente el motivo del traslado,  
3. **Entonces** el sistema actualiza `matricula.id_grupo`,  
4. **Y** envía automáticamente un correo electrónico formateado al acudiente mediante `NotificationService.sendStudentTransferEmail` informando el curso origen, curso destino y motivo.

---

## HU-TRA-005: Consulta de Historial de Vinculaciones

**Como** Usuario registrado (Docente, Estudiante o Directivo),  
**Quiero** consultar las instituciones educativas a las que he pertenecido en el tiempo,  
**Para** tener trazabilidad de mi historial dentro del ecosistema educativo.

### Criterios de Aceptación

1. **Dado** que el usuario ha iniciado sesión en la plataforma,  
2. **Cuando** accede a `GET /api/traslados/mis-vinculaciones`,  
3. **Entonces** el sistema retorna la lista de registros de `usuario_colegio` junto con el nombre del colegio, logo/escudo y el rol desempeñado en cada período.
