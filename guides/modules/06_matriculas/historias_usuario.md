# Historias de Usuario — Matrículas e Inscripciones

Este documento describe las Historias de Usuario del módulo de **Matrículas e Inscripciones** de AcademiaNeiva, detallando actores, narrativas y criterios de aceptación técnicos.

---

## 1. Inscripción Pública y Verificación

### HU-MAT-001: Radicación de Solicitud de Matrícula Regular con Verificación OTP
- **Como:** Padre de Familia o Acudiente Legal.
- **Quiero:** Diligenciar el formulario público de inscripción adjuntando los documentos de mi acudido y validando previamente mi correo electrónico.
- **Para:** Postular a mi hijo al cupo escolar correspondiente de forma segura y recibir notificaciones oficiales.
- **Criterios de Aceptación:**
  1. El formulario exige ingresar el correo del acudiente y validar un código OTP de 6 dígitos con cuenta regresiva de 15 minutos antes de permitir avanzar.
  2. Si el colegio tiene inscripciones cerradas o no tiene un año lectivo en estado `ABIERTO`, el sistema bloquea el envío e informa las fechas de inicio/cierre.
  3. Los archivos adjuntos no pueden superar 5MB por archivo y deben cumplir con las extensiones autorizadas (PDF, PNG, JPG, JPEG, SVG).
  4. Al enviar con éxito, el sistema persiste los archivos binarios en `documento_matriculas` (`BYTEA`), genera la matrícula en estado `PENDIENTE` y emite un `token_seguimiento` de tipo UUID.
  5. El sistema envía automáticamente un correo de confirmación de radicación con el token al buzón verificado.

---

### HU-MAT-002: Consulta Pública de Estado mediante Token de Seguimiento
- **Como:** Padre de Familia o Aspirante.
- **Quiero:** Ingresar mi Token de Seguimiento UUID en la página web pública de la institución.
- **Para:** Conocer si mi solicitud se encuentra en revisión, aprobada o si presenta documentos rechazados sin necesidad de tener una cuenta de usuario.
- **Criterios de Aceptación:**
  1. La consulta pública por UUID no exige credenciales ni sesión activa.
  2. Muestra el estado actual (`PENDIENTE`, `CORRECCION`, `CORREGIDA`, `APROBADA`, `ACTIVA`, `RECHAZADA`, `CANCELADA`).
  3. Si la matrícula se encuentra en estado `CORRECCION`, resalta visualmente los documentos rechazados y expone el motivo especificado por el directivo.

---

### HU-MAT-003: Subsanación y Carga de Documentos Corregidos por Token
- **Como:** Padre de Familia o Acudiente con solicitud en estado de corrección.
- **Quiero:** Cargar las nuevas versiones de los archivos que fueron rechazados por inconsistencias.
- **Para:** Que el directivo escolar reevalúe mi postulación y continúe el trámite de matrícula.
- **Criterios de Aceptación:**
  1. El formulario de corrección solo permite cargar los archivos marcados como `RECHAZADO`.
  2. Al enviar la corrección (`POST /api/matriculas/update-documents/:token`), el backend inserta los nuevos archivos con `version = max_version + 1` en `documento_matriculas`.
  3. La matrícula cambia automáticamente al estado **`CORREGIDA`** (no `PENDIENTE`), preservando intacto el salón previamente pre-seleccionado.
  4. Los documentos anteriores se conservan en el historial de versiones para fines de auditoría.

---

## 2. Gestión Directiva y Validación Documental

### HU-MAT-004: Evaluación Documental en Línea con Visor Protegido
- **Como:** Directivo Escolar (Rector o Coordinador de Admisiones).
- **Quiero:** Inspeccionar los documentos cargados por el aspirante en un visor integrado y validar o rechazar individualmente cada archivo.
- **Para:** Garantizar el cumplimiento de los requisitos legales antes de autorizar el ingreso del estudiante.
- **Criterios de Aceptación:**
  1. La visualización de documentos se realiza mediante tokens JWT efímeros firmados (`verifyDocumentToken`), impidiendo el acceso anónimo no autorizado.
  2. El directivo puede marcar cada archivo como `VALIDADO` o `RECHAZADO` indicando el motivo de rechazo.
  3. El sistema expone el historial de versiones anteriores (`versiones_anteriores`) de cada archivo si ha sido corregido previamente.
  4. Al presionar "Notificar Inconsistencias", la matrícula pasa a `CORRECCION` y se envía un correo al acudiente con las observaciones.

---

### HU-MAT-005: Asignación de Aula y Control de Aforo en Tiempo Real
- **Como:** Directivo Escolar.
- **Quiero:** Seleccionar la sección y salón físico (`id_grupo`) para el aspirante dentro de su grado escolar.
- **Para:** Distribuir equitativamente la carga estudiantil respetando los límites de cupo por aula.
- **Criterios de Aceptación:**
  1. El selector de salones muestra las secciones paralelas con sus cupos disponibles calculados en tiempo real (`cupos_totales - (activas + trasladadas)`).
  2. La selección se persiste de inmediato en `matricula.id_grupo` mediante `POST /api/matriculas/assign-grade/:id`.
  3. Si la solicitud entra en corrección documental, la asignación de salón se conserva para evitar parametrizaciones repetitivas.
  4. Los salones sin cupo disponible se muestran inhabilitados en la interfaz.

---

## 3. Formalización y Casos Complejos

### HU-MAT-006: Formalización Atómica y Creación de Identidades en Cascada
- **Como:** Directivo Escolar.
- **Quiero:** Formalizar la matrícula completando los datos de identidad del alumno y su acudiente.
- **Para:** Dar de alta oficialmente al estudiante, crear sus credenciales de acceso institucional y activar su matrícula.
- **Criterios de Aceptación:**
  1. El backend ejecuta una transacción atómica protegida con bloqueo `SELECT ... FOR UPDATE` sobre la tabla `grupos` para impedir sobrecupos concurrentes.
  2. Se valida que el documento del estudiante sea diferente al del acudiente (`RN-MAT-017`).
  3. Si el estudiante es nuevo, genera su código único (`MAT-${Date.now()}`), crea su cuenta de usuario con contraseña cifrada y la ficha en `estudiante`.
  4. Si el acudiente es nuevo, crea su cuenta de usuario con rol `padre` y ficha en `padre_familia`. Si ya es personal del colegio (docente/directivo), no sobrescribe sus datos y activa la relación en `usuario_colegio`.
  5. Inserta o actualiza la relación parentesco en `detalle_padrefamilia`.
  6. Cancela automáticamente matrículas previas activas/pendientes del estudiante en el mismo año lectivo.
  7. Cambia el estado de la matrícula a `ACTIVA` (o `TRASLADADA` si `es_traslado = true`) y despacha el correo con credenciales de acceso al acudiente.

---

### HU-MAT-007: Trámite Integral de Matrícula Extraordinaria y Experiencia del Padre en Formulario Extemporáneo
- **Como:** Directivo Escolar o Personal de Secretaría.
- **Quiero:** Autorizar matrículas extraordinarias (vía Mesa de Ayuda o desde la Bandeja de Matrículas), autocompletar acudientes existentes, registrar el motivo y observaciones, consultar su trazabilidad en el Drawer de revisión, compartir el enlace de radicación con el padre y permitirle diligenciar el formulario completo con bypass de fechas y actualización in-place.
- **Para:** Permitir el ingreso extemporáneo controlado de aspirantes con pleno conocimiento del estado documental, sin duplicar registros en base de datos y con resolución automática de tickets.
- **Criterios de Aceptación:**
  1. La autorización puede ejecutarse desde un ticket de soporte con incidencia `MATRICULA_EXTRAORDINARIA` o desde el modal directo `ExtraordinaryEnrollmentModal.vue` en `EnrollmentManagement.vue`.
  2. Si se selecciona un estudiante existente, el sistema autocompleta los datos del acudiente y su correo electrónico de contacto.
  3. El directivo registra obligatoriamente el **motivo de la excepción** y las **observaciones internas**. El backend crea la fila en `matricula` en estado `PENDIENTE` (`tipo = 'EXTRAORDINARIA'`), emite el `token_seguimiento` UUID y asocia/crea el ticket en `tickets_soporte` (`EN_PROCESO`).
  4. El acudiente recibe el correo de aprobación con el enlace directo `${FRONTEND_URL}/matricula?token=${token}` que abre [`EnrollmentView.vue`](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue).
  5. En `EnrollmentView.vue`, el formulario bloquea el colegio asignado, precarga el correo marcándolo como verificado (sin requerir OTP de 6 dígitos), aplica bypass al calendario cerrado y despliega un banner destacado y amable con icono `Sparkles`.
  6. Al confirmar la radicación, el backend actualiza *in-place* la fila existente en `matricula` y persiste los archivos binarios en `documento_matriculas` (sin crear registros duplicados).
  7. En la bandeja directiva (`EnrollmentReviewDrawer.vue`), la matrícula extraordinaria expone una tarjeta destacada con el motivo, observaciones, responsable y ticket asociado.
  8. Si el acudiente aún no ha cargado los documentos, el drawer muestra el badge reactivo `⏳ Pendiente por cargue de documentos`, un mensaje explicativo y un botón interactivo para **copiar el enlace directo `/matricula?token=:token`**.
  9. Al radicar el acudiente los archivos, el drawer transiciona a `✅ Documentos cargados`, permitiendo validar soportes y asignar aula física.
  10. Al formalizar en `FinalRegistration.vue`, la matrícula pasa a `ACTIVA` y el ticket de soporte cambia automáticamente a estado `RESUELTO`.

---

### HU-MAT-008: Gestión de Reingresos con Matriz Documental Inteligente
- **Como:** Directivo Escolar.
- **Quiero:** Tramitar el reingreso de un estudiante en estado `RETIRADO` evaluando su historial y conservando sus documentos vigentes.
- **Para:** Reincorporar al alumno a la institución sin exigirle duplicar documentación que no ha vencido.
- **Criterios de Aceptación:**
  1. Solo estudiantes en estado `RETIRADO` son elegibles (expulsados y graduados quedan bloqueados).
  2. El sistema presenta la matriz documental marcando archivos vigentes (`VIGENTE`) y permitiendo seleccionar los que requieren renovación (`RENOVAR`).
  3. Al enviar el enlace, crea la matrícula en estado `PENDIENTE_RENOVACION` (`tipo = 'REINGRESO'`), actualiza el ticket de reingreso a `EN_PROCESO` (irreversible) y envía el token por email.
  4. Al formalizar en `FinalRegistration.vue`, reactiva al estudiante a estado `ACTIVO` y limpia el `motivo_estado`.

---

### HU-MAT-009: Cancelación Motivada de Matrícula y Estado Disciplinario Final
- **Como:** Directivo Escolar.
- **Quiero:** Cancelar una solicitud de matrícula o retirar formalmente a un alumno asignando la causa del retiro.
- **Para:** Mantener la veracidad estadística del colegio y definir si el estudiante queda en estado `RETIRADO` o `EXPULSADO`.
- **Criterios de Aceptación:**
  1. Exige registrar un motivo y detalle descriptivo de la cancelación.
  2. El directivo debe seleccionar si el alumno pasa a `RETIRADO` (elegible a reingreso futuro) o `EXPULSADO` (inhabilitación permanente).
  3. Actualiza `matricula.estado = 'CANCELADA'`, resuelve el ticket si existía y envía un correo de notificación formal al acudiente.

---

### HU-MAT-010: Selección de Candidato de Renovación en Familias con Múltiples Hijos
- **Como:** Directivo Escolar en la consola de formalización.
- **Quiero:** Distinguir si una solicitud radicada por un acudiente con hijos previos corresponde a la renovación de un hijo existente o a la inscripción de un nuevo hermano.
- **Para:** Vincular correctamente el expediente académico y no sobreescribir la identidad de otros miembros de la familia.
- **Criterios de Aceptación:**
  1. `FinalRegistration.vue` detecta y lista todos los hijos elegibles del acudiente (`renovacion.candidates`).
  2. Si existen candidatos, el directivo debe seleccionar explícitamente a un hijo de la lista (`selectedCandidate`) o marcar la opción "Registrar Nuevo Hermano" (`isNewStudent`).
  3. Si es renovación, actualiza el `id_estudiante` seleccionado; si es nuevo hermano, crea una nueva ficha de estudiante asociándola al mismo `id_padrefamilia`.
  4. Los hijos en estado `EXPULSADO`, `GRADUADO` o ya matriculados en ese año lectivo se muestran inhabilitados con su motivo de exclusión.
