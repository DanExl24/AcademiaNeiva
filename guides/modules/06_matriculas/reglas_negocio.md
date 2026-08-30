# Reglas de Negocio — Matrículas e Inscripciones

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de **Matrículas e Inscripciones** de AcademiaNeiva, vinculando cada regla con su implementación en el código fuente, bases de datos y controladores.

---

## 1. Control de Plazos, Fechas e Identidad Previa

### RN-MAT-001: Validación de Rango de Fechas Ordinarias y Año Lectivo Abierto
- **Descripción:** El envío de una solicitud de matrícula regular por la interfaz pública se bloqueará si:
  1. No existe un año lectivo con `estado = 'ABIERTO'` en la tabla `anio_lectivo` para el colegio seleccionado.
  2. No existe un registro en `configuracion_inscripcion` para ese colegio y año lectivo activo.
  3. `configuracion_inscripcion.habilitada` es `false`.
  4. La fecha actual del servidor se encuentra fuera del rango `[fecha_inicio, fecha_cierre]`.
- **Motivo:** Regula el periodo oficial de admisiones del colegio e impide registros fuera de los plazos establecidos o en instituciones sin año lectivo vigente.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`createEnrollment`)
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts)
  - [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue) (`fetchEnrollmentConfig`)
- **Endpoints relacionados:**
  - `GET /api/matriculas/school/:schoolId/enrollment-config`
  - `POST /api/matriculas/submit`
- **Historias de usuario relacionadas:** HU-MAT-001

---

### RN-MAT-002: Habilitación de Matrícula Extraordinaria, Bypass de Calendario, Actualización In-Place y Expediente en Drawer
- **Descripción:** Una solicitud de tipo `EXTRAORDINARIA` se origina mediante autorización directiva expresa, bien sea respondiendo a un **Ticket de Soporte** (`tipo_incidencia = 'MATRICULA_EXTRAORDINARIA'`) o directamente desde la consola de **Gestión de Matrículas** (`EnrollmentManagement.vue` a través del modal `ExtraordinaryEnrollmentModal.vue`).
  1. **Validaciones Previas y Elegibilidad de Estudiante Existente:**
     - Exige que el colegio cuente con un año lectivo en estado `ABIERTO` en `anio_lectivo`. Si el período de inscripciones ordinarias en `configuracion_inscripcion` se encuentra abierto y vigente, el sistema orienta a tramitar la inscripción por el canal regular.
     - **Elegibilidad de Estudiante Existente:** Si se selecciona un estudiante registrado en la institución (`id_estudiante`), este debe encontrarse en estado **`RETIRADO`** o **`INACTIVO`**. Si el estudiante ya se encuentra **`ACTIVO`** (ya cuenta con matrícula vigente), **`SANCIONADO`** (presenta falta disciplinaria activa), **`EXPULSADO`** (inhabilitado permanentemente) o **`GRADUADO`** (ciclo culminado), el sistema bloquea su selección tanto en la interfaz modal como a nivel transaccional en el backend (`STUDENT_ALREADY_ACTIVE`, `STUDENT_SANCTIONED`, `STUDENT_INELIGIBLE`).
  2. **Persistencia y Trazabilidad:** El controlador [`enrollmentAdminController.ts`](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/enrollmentAdminController.ts) (`createExtraordinaryEnrollment`) ejecuta una transacción Kysely donde crea o actualiza el ticket en `tickets_soporte` (estado `'EN_PROCESO'` serializando las notas en la columna `observaciones` como un arreglo JSON) y pre-crea la fila en `matricula` en estado `PENDIENTE` (`tipo = 'EXTRAORDINARIA'`), almacenando el `motivo`, `observaciones`, `id_usuario_responsable`, `id_ticket` y generando un `token_seguimiento` de tipo UUID.
  3. **Notificación y Experiencia del Acudiente:** Se despacha un correo (`NotificationService.sendExtraordinaryApprovalEmail`) con el enlace directo al formulario completo de matrícula: `${FRONTEND_URL}/matricula?token=${token}`. Al abrir [`EnrollmentView.vue`](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue):
     - El colegio se preselecciona y bloquea.
     - El correo del acudiente se precarga y marca como verificado (omitiendo solicitud de código OTP de 6 dígitos).
     - El token aplica bypass al calendario cerrado y despliega un banner de excepción autorizada con icono `Sparkles`.
  4. **Actualización In-Place (Sin Duplicados):** Al enviar el formulario de matrícula (`POST /api/matriculas/submit`), el backend detecta el token de matrícula extraordinaria y **no inserta un nuevo registro en la tabla `matricula`**, sino que actualiza *in-place* la fila previamente pre-creada (`id_nivel`, `id_grupo`, `tiene_discapacidad`, `es_extranjero`, `correo_padre`), guardando los archivos binarios en `documento_matriculas`.
  5. **Expediente en Drawer Directivo:** Al consultar el expediente (`MatriculaService.getDetails`), el sistema retorna el motivo, observaciones, responsable y ticket asociado. En [`EnrollmentReviewDrawer.vue`](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/components/matriculas/EnrollmentReviewDrawer.vue), se despliega una tarjeta dedicada y un indicador reactivo de estado de cargue (`⏳ Pendiente por cargue de documentos` con botón de copia de enlace `/matricula?token=:token` vs `✅ Documentos cargados` con visor de archivos).
  6. **Auto-Resolución:** Al culminar la formalización (`finalizeEnrollment`) o cancelar la matrícula (`cancelEnrollment`), el sistema transiciona automáticamente el ticket de soporte asociado a estado `'RESUELTO'`.
- **Motivo:** Garantiza un control estricto de excepciones institucionales bajo trazabilidad inmutable de soporte, evita la creación de registros duplicados en la base de datos, previene la expedición de cupos extemporáneos a alumnos ya activos o sancionados, otorga una experiencia fluida al padre de familia y provee visibilidad completa al directivo sobre el avance documental.
- **Archivos donde se implementa:**
  - [enrollmentAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdmin/enrollmentAdminController.ts) (`createExtraordinaryEnrollment`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`createEnrollment`, `getDetails`, `finalizeEnrollment`, `cancelEnrollment`)
  - [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue)
  - [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue)
  - [EnrollmentReviewDrawer.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/components/matriculas/EnrollmentReviewDrawer.vue)
  - [ExtraordinaryEnrollmentModal.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/components/matriculas/ExtraordinaryEnrollmentModal.vue)
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/matriculas/extraordinaria`
  - `GET /api/matriculas/token/:token`
  - `POST /api/matriculas/submit`
  - `GET /api/matriculas/:id`
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-007

---

### RN-MAT-003: Acceso por Token UUID y Tokens JWT Efímeros para Archivos
- **Descripción:** Los aspirantes pueden consultar el estado de su matrícula y actualizar documentos de reemplazo a través de su `token_seguimiento` de tipo UUID sin necesidad de iniciar sesión. Adicionalmente, para visualizar o descargar los archivos adjuntos confidenciales, el sistema genera tokens JWT efímeros firmados mediante `generateDocumentAccessToken(idDocumento)` con expiración breve, los cuales son validados por el middleware `verifyDocumentToken`.
- **Motivo:** Evita crear cuentas prematuras con contraseñas para aspirantes y protege los documentos de menores de edad contra accesos no autorizados mediante URLs estáticas predecibles.
- **Archivos donde se implementa:**
  - [documentSecurity.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/documentSecurity.ts) (`generateDocumentAccessToken`, `verifyDocumentToken`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`getByToken`, `getDetails`)
  - [matricula.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/matricula.routes.ts)
- **Endpoints relacionados:**
  - `GET /api/matriculas/:id` (cuando se pasa token UUID)
  - `GET /api/matriculas/documentos/:idDocumento/archivo`
  - `POST /api/matriculas/update-documents/:token`
- **Historias de usuario relacionadas:** HU-MAT-002, HU-MAT-003

---

## 2. Flujo de Validación Documental y Almacenamiento

### RN-MAT-004: Bloqueo de Aprobación por Documento Rechazado y Estado `CORRECCION`
- **Descripción:** Si al menos uno de los archivos de soporte cargados por el aspirante en `documento_matriculas` es marcado en estado `RECHAZADO` por el directivo y este ejecuta `notifyInconsistencies`, la matrícula transiciona automáticamente al estado `CORRECCION`, se bloquea la oficialización y se remite un correo al acudiente con las observaciones.
- **Motivo:** Garantiza que ningún estudiante sea matriculado con documentación inválida o incompleta.
- **Archivos donde se implementa:**
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`validateDocument`, `notifyInconsistencies`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`updateDocumentStatus`, `notifyInconsistencies`)
  - [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue)
- **Endpoints relacionados:**
  - `PATCH /api/matriculas/document/:idDocumento`
  - `POST /api/matriculas/notify-inconsistencies/:id`
- **Historias de usuario relacionadas:** HU-MAT-003, HU-MAT-004

---

### RN-MAT-005: Oficialización Atómica en 6 Pasos y Creación en Cascada
- **Descripción:** Al formalizar la matrícula (`finalizeEnrollment`), el sistema ejecuta una transacción Kysely atómica con 6 fases indivisibles:
  1. **Bloqueo `FOR UPDATE` en `grupos`**: Valida que existan cupos disponibles (`ocupados < cupos_totales`).
  2. **Estudiante**: Crea o reactiva el alumno en `estudiante` (estado `ACTIVO`) y su cuenta en `usuario` (rol `estudiante` con código institucional como contraseña inicial).
  3. **Acudiente**: Si el acudiente no existe, lo crea en `usuario` y `padre_familia`. Si ya existe (incluso como personal institucional/docente), vincula el rol `padre` en `usuario_rol`, activa la relación en `usuario_colegio` y sincroniza correos con `upsertInstitutionalEmail`.
  4. **Parentesco**: Inserta o actualiza la relación en `detalle_padrefamilia`.
  5. **Cancelación Preventiva**: Cancela cualquier matrícula previa activa/pendiente del alumno en el mismo año lectivo (`motivo_cancelacion = 'Reemplazada por reingreso / nueva matrícula finalizada'`).
  6. **Matrícula y Notificación**: Actualiza la matrícula a `ACTIVA` (o `TRASLADADA` si `es_traslado = true`), resuelve el ticket asociado (`id_ticket`), registra la auditoría si aplica, y envía el correo con credenciales de acceso institucional.
- **Motivo:** Asegura consistencia absoluta en el alta institucional del estudiante y previene condiciones de carrera o estados a medias.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`finalizeEnrollment`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-006

---

### RN-MAT-006: Almacenamiento Binario `BYTEA` en Base de Datos y Límites de Carga
- **Descripción:** Los archivos adjuntos de matrícula se procesan en memoria con Multer y se persisten directamente como buffers binarios en la columna `contenido` (`BYTEA`) de la tabla `documento_matriculas` en PostgreSQL. Se aplica un límite estricto de **5MB por archivo**, extensiones permitidas (PDF, PNG, JPG, JPEG, SVG) y rate limiting de 20 solicitudes cada 15 minutos por IP.
- **Motivo:** Elimina dependencias de almacenamiento estático en disco local (`/uploads`), facilitando copias de seguridad portables (`pg_dump`) y despliegues sin estado.
- **Archivos donde se implementa:**
  - [multer.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/multer.ts)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`createEnrollment`, `updateDocuments`)
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`downloadDocumentFile`)
- **Endpoints relacionados:**
  - `POST /api/matriculas/submit`
  - `POST /api/matriculas/update-documents/:token`
  - `GET /api/matriculas/documentos/:idDocumento/archivo`
- **Historias de usuario relacionadas:** HU-MAT-001, HU-MAT-003

---

### RN-MAT-007: Persistencia Continua de Salón y Transición a `CORREGIDA` con Versionado
- **Descripción:** La asignación de salón (`id_grupo`) realizada por el directivo se persiste de inmediato en `matricula.id_grupo`. Si la solicitud es enviada a corrección, el `id_grupo` se mantiene intacto. Al momento en que el acudiente sube los documentos corregidos (`updateDocumentsByToken`), el sistema crea nuevos registros en `documento_matriculas` con `version = max_version + 1` y **transiciona la matrícula al estado `CORREGIDA`** (no `PENDIENTE`), preservando el salón y alertando visualmente al directivo.
- **Motivo:** Evita re-parametrizar salones en cada revisión, mantiene la reserva del aula y ofrece un estado claro para solicitudes que han sido subsanadas.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`assignGrade`, `updateDocuments`)
  - [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue)
  - [EnrollmentCorrection.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentCorrection.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/assign-grade/:id`
  - `POST /api/matriculas/update-documents/:token`
- **Historias de usuario relacionadas:** HU-MAT-003, HU-MAT-005

---

### RN-MAT-008: Aislamiento por Inquilino (Multi-Tenant) y Auditoría en Supervisión
- **Descripción:** Los directivos escolares solo pueden visualizar, evaluar, asignar cupos y oficializar matrículas que pertenezcan a su mismo `id_colegio`. Si la acción es ejecutada por un `admin_general` en modo supervisión extraordinaria, el backend inyecta el `id_colegio` supervisado y registra de forma inmutable la acción en `auditoria_acciones_realizadas`.
- **Motivo:** Protege la soberanía y confidencialidad entre colegios y garantiza la trazabilidad auditora.
- **Archivos donde se implementa:**
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`getPendingMatriculas`, `getMatriculaDetails`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`finalizeEnrollment`)
- **Endpoints relacionados:** Todos los endpoints administrativos del módulo.
- **Historias de usuario relacionadas:** HU-MAT-004, HU-MAT-006

---

## 3. Flujo de Reingresos de Estudiantes Retirados

### RN-MAT-009: Elegibilidad Exclusiva de Reingreso
- **Descripción:** Solo los estudiantes en estado `RETIRADO` (o activos que sean formalmente retirados para iniciar trámite) son elegibles para reingresar. Los alumnos con estado `EXPULSADO` o `GRADUADO` están estrictamente inhabilitados y bloqueados por el backend.
- **Motivo:** Cumple con las sanciones disciplinarias permanentes y evita la duplicidad de ciclos lectivos para bachilleres graduados.
- **Archivos donde se implementa:**
  - [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts) (`sendParentReingresoLink`, `getStudentHistoryForReingreso`)
- **Endpoints relacionados:**
  - `POST /api/reingreso/send-parent-link`
  - `GET /api/reingreso/student-history/:id_estudiante`
- **Historias de usuario relacionadas:** HU-MAT-008

---

### RN-MAT-010: Irreversibilidad y Notificación de Tickets de Reingreso a `EN_PROCESO`
- **Descripción:** Al cambiar el estado de un ticket de soporte de reingreso a `EN_PROCESO`, el sistema solicita confirmación advirtiendo que la acción no se puede revertir, envía un correo electrónico al acudiente informando que el reingreso se está gestionando, y bloquea el retorno del ticket a `ABIERTO`.
- **Motivo:** Asegura la trazabilidad en la atención de solicitudes de reingreso solicitadas por los acudientes y la notificación inmediata.
- **Archivos donde se implementa:**
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`updateTicketStatus`)
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue)
- **Endpoints relacionados:**
  - `PUT /api/support/tickets/:id/status`
- **Historias de usuario relacionadas:** HU-MAT-008, HU-SOP-005

---

### RN-MAT-011: Matriz Documental Inteligente y Auto-Clonación en Traslados
- **Descripción:** En reingresos, el sistema genera la matriz documental del alumno retirado: los documentos vigentes se conservan (`VIGENTE`) y solo se solicita al acudiente actualizar los vencidos (`RENOVAR`). Si una matrícula proviene de un traslado o carece de archivos propios, el endpoint `getDetails` clona automáticamente los documentos previos del estudiante para no exigirle volver a cargar todo el expediente.
- **Motivo:** Reduce la fricción administrativa al no solicitar documentos no vencidos y agiliza la gestión de traslados intercolegiados.
- **Archivos donde se implementa:**
  - [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`getDetails`)
  - [ReingresoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ReingresoManagement.vue)
- **Endpoints relacionados:**
  - `GET /api/matriculas/:id`
  - `POST /api/reingreso/send-parent-link`
- **Historias de usuario relacionadas:** HU-MAT-008

---

### RN-MAT-012: Control de Cupos con Bloqueo Pessimistic `FOR UPDATE`
- **Descripción:** El cálculo de cupos disponibles (`cupos_totales - (activas + trasladadas)`) se verifica tanto en los selectores de la interfaz como a nivel de base de datos con bloqueo de fila SQL (`FOR UPDATE`) en `finalizeEnrollment`, abortando la transacción si el aula se llenó concurrentemente.
- **Motivo:** Evita el sobrecupo físico de las aulas y previene condiciones de carrera en matrículas simultáneas.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`finalizeEnrollment`, `getDetails`)
  - [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts) (`getReingresoGroups`)
- **Endpoints relacionados:**
  - `GET /api/reingreso/groups`
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-005, HU-MAT-008

---

### RN-MAT-013: Auditoría Obligatoria del Motivo de Retiro
- **Descripción:** Al retirar a un estudiante, el motivo se registra obligatoriamente en `estudiante.motivo_estado` y `matricula.detalles_cancelacion`, mostrándose siempre en su expediente de reingreso y en la gestión de estudiantes.
- **Motivo:** Mantiene un registro auditable de la causa de desvinculación escolar para comités de convivencia y secretarías de educación.
- **Archivos donde se implementa:**
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (`updateStudentStatus`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`getDetails`, `getFiltered`)
  - [ReingresoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ReingresoManagement.vue)
- **Endpoints relacionados:**
  - `PATCH /api/student/:id/status`
- **Historias de usuario relacionadas:** HU-MAT-008

---

### RN-MAT-014: Definición del Estado Final al Cancelar Matrícula
- **Descripción:** Al cancelar una matrícula (`cancelEnrollment`), el directivo debe definir si el alumno queda en estado `RETIRADO` (elegible para reingreso futuro) o `EXPULSADO` (inhabilitación disciplinaria permanente).
- **Motivo:** Evita estados genéricos e imprecisos y asegura el cumplimiento del bloqueo de reingresos para alumnos expulsados.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`cancelEnrollment`)
  - [matricula.dto.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/dtos/matricula.dto.ts) (`CancelEnrollmentSchema`)
  - [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/cancel/:id`
- **Historias de usuario relacionadas:** HU-MAT-005, HU-MAT-008

---

## 4. Validaciones de Identidad, Roles y Múltiples Hijos

### RN-MAT-015: Detección de Doble Rol de Acudiente y Preservación de Cuentas
- **Descripción:** Al ingresar el documento del acudiente en el paso 2 de formalización, `checkDocument` detecta si el usuario ya existe en el sistema. Si es personal institucional (docente o directivo):
  1. Autocompleta los nombres y apellidos y bloquea los campos.
  2. Preserva intactos sus datos personales y laborales.
  3. Inserta el rol `padre` en `usuario_rol` y la relación en `usuario_colegio` (`ACTIVO`).
  4. Sincroniza correos mediante `upsertInstitutionalEmail`.
- **Motivo:** Previene la duplicidad de cuentas en el personal del colegio que matricula a sus hijos y mantiene independientes las identidades familiares y laborales.
- **Archivos donde se implementa:**
  - [userController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/userController.ts) (`checkDocument`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`finalizeEnrollment`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Endpoints relacionados:**
  - `GET /api/auth/check-document/:document`
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-006

---

### RN-MAT-016: Verificación Previa OTP del Correo del Acudiente
- **Descripción:** El formulario público de admisión exige validar obligatoriamente la titularidad del correo electrónico mediante código OTP de 6 dígitos con caducidad de 15 minutos antes de admitir el envío de la matrícula. El backend verifica que `EmailVerificationService.isVerified` retorne verdadero para ese email en las últimas 2 horas.
- **Motivo:** Evita el registro de solicitudes con correos inexistentes, tipográficos o inaccesibles, garantizando que el acudiente reciba las notificaciones institucionales.
- **Archivos donde se implementa:**
  - [emailVerificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/emailVerificationService.ts)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`sendEnrollmentEmailCode`, `verifyEnrollmentEmailCode`, `createEnrollment`)
  - [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/send-email-code`
  - `POST /api/matriculas/verify-email-code`
  - `POST /api/matriculas/submit`
- **Historias de usuario relacionadas:** HU-MAT-001

---

### RN-MAT-017: Validación Cruzada de Identidad Estudiante-Acudiente
- **Descripción:** El backend y frontend validan que `normalizeDocument(student.documento) !== normalizeDocument(parent.documento)`. Si coinciden, se aborta la formalización con mensaje de error explicativo.
- **Motivo:** Impide que un estudiante sea registrado con el mismo documento del acudiente por error de digitación o suplantación.
- **Archivos donde se implementa:**
  - [documentValidation.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/documentValidation.ts)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`finalizeEnrollment`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-006

---

### RN-MAT-018: Bifurcación Obligatoria en Familias con Varios Hijos (Renovación vs. Nuevo Hermano)
- **Descripción:** Si el correo del acudiente tiene hijos previos registrados en la institución (`renovacion.candidates`), el directivo debe seleccionar en `FinalRegistration.vue` si renueva a un hijo existente (`selectedCandidate`) o si registra a un nuevo hijo/hermano (`isNewStudent`). El sistema valida que los candidatos elegibles no estén expulsados, graduados o ya matriculados en ese año lectivo.
- **Motivo:** Resuelve el caso de familias con múltiples hijos, evitando que la formalización de un nuevo hermano sobrescriba la identidad del estudiante existente.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`getDetails`, `finalizeEnrollment`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Endpoints relacionados:**
  - `GET /api/matriculas/:id`
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-006, HU-MAT-010
