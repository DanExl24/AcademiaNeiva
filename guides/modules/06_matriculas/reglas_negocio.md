# Reglas de Negocio — Matrículas e Inscripciones

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Matrículas e Inscripciones de AcademiaNeiva.

---

## Control de Plazos y Fechas

### RN-MAT-001: Validación de Rango de Fechas Ordinarias

- **Descripción:** El envío de una solicitud de matrícula regular por la interfaz pública se bloqueará si la fecha actual está fuera del rango de fechas (`fecha_inicio` y `fecha_cierre`) configurado en `configuracion_inscripcion` para el año lectivo activo de la institución o si las inscripciones se encuentran deshabilitadas.
- **Motivo:** Regula el periodo oficial de admisiones del colegio e impide registros fuera de los plazos establecidos.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:**
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`submitEnrollment` - verificación de fecha actual en rango)
- **Endpoints relacionados:**
  - `POST /api/matriculas/submit`
- **Historias de usuario relacionadas:** HU-MAT-001

---

### RN-MAT-002: Habilitación de Matrícula Extraordinaria por Ticket de Soporte

- **Descripción:** Una solicitud de tipo `EXTRAORDINARIA` se origina **exclusivamente desde un Ticket de Soporte** que posea el tipo de incidencia `MATRICULA_EXTRAORDINARIA`. El directivo autoriza la solicitud seleccionando la modalidad del estudiante (**Estudiante Existente** o **Estudiante Totalmente Nuevo**) y el sistema precarga el correo del solicitante desde el ticket sin exigir la selección manual de grado ni año en la primera etapa. Al autorizarla, se genera un `token_seguimiento` y se le envía el enlace al acudiente. **El acudiente puede diligenciar y enviar el formulario de inscripción a través de este token único incluso si las fechas de inscripción ordinaria están cerradas o deshabilitadas institucionalmente.**
- **Motivo:** Garantiza un control estricto de excepciones institucionales bajo trazabilidad de soporte y permite ingresos extemporáneos sin reabrir públicamente las fechas generales del colegio.
- **Módulos afectados:** Matrículas, Inscripciones y Mesa de Soporte.
- **Archivos donde se implementa:**
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createExtraordinaryEnrollment`)
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts)
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) (`openExtraordinaryModal`, `submitExtraordinaryEnrollment`)
  - [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue) (`isExtraordinaryToken`)
- **Endpoints relacionados:**
  - `POST /api/academic-admin/matriculas/extraordinaria`
  - `GET /api/matriculas/public/by-token/:token`
- **Historias de usuario relacionadas:** HU-MAT-007

---

## Flujo de Validación de Documentos

### RN-MAT-003: Acceso por Token de Seguimiento Seguro

- **Descripción:** Los aspirantes pueden consultar el estado de su matrícula y actualizar documentos de reemplazo a través de su `token_seguimiento` de tipo UUID sin necesidad de iniciar sesión.
- **Motivo:** Evita tener que crear cuentas de usuario con privilegios o contraseñas en el sistema a solicitantes que aún no pertenecen oficialmente al plantel.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`getByToken`, `updateDocumentsByToken`)
  - [matricula.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/matricula.routes.ts) (Rutas excluidas de la protección obligatoria de sesión para integer ID)
- **Endpoints relacionados:**
  - `GET /api/matriculas/:id` (cuando se pasa token UUID)
  - `POST /api/matriculas/update-documents/:token`
- **Historias de usuario relacionadas:** HU-MAT-002, HU-MAT-003

---

### RN-MAT-004: Bloqueo de Aprobación por Documento Rechazado

- **Descripción:** Si al menos uno de los archivos de soporte cargados por el aspirante en `documento_matriculas` es marcado en estado `RECHAZADO` por el directivo, la matrícula transiciona automáticamente al estado `CORRECCION` y se bloquea la opción de asignación de grupo y oficialización.
- **Motivo:** Garantiza que ningún estudiante sea matriculado con documentación inválida o incompleta.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:**
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`validateDocument`, `notifyInconsistencies`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts)
- **Endpoints relacionados:**
  - `PATCH /api/matriculas/document/:idDocumento`
  - `POST /api/matriculas/notify-inconsistencies/:id`
- **Historias de usuario relacionadas:** HU-MAT-003, HU-MAT-004

---

## Oficialización y Asignación de Aula

### RN-MAT-005: Oficialización y Creación en Cascada de Alumno y Cuenta de Portal

- **Descripción:** Al finalizar la matrícula aprobada (`finalizeEnrollment` / `finalizeRegistration`), el sistema ejecuta de forma atómica:
  1. Actualiza el estado de la matrícula a `ACTIVA` (o `APROBADA`), asignando el `id_grupo` definitivo y el año escolar.
  2. Inserta o reactiva el expediente del estudiante en la tabla `estudiante` con estado `ACTIVO`.
  3. Inserta o vincula la cuenta en `usuario` con el rol `estudiante` y credenciales iniciales de acceso.
  4. Envía por correo electrónico la confirmación con sus credenciales institucionales.
- **Motivo:** Garantiza la consistencia en el alta de alumnos en el plantel escolar y habilita de forma instantánea el portal estudiantil para el alumno matriculado.
- **Módulos afectados:** Matrículas e Inscripciones, Estudiantes y Estados, Autenticación y Sesiones.
- **Archivos donde se implementa:**
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`finalizeEnrollment`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-006

---

### RN-MAT-006: Rate Limiting y Límite de Tamaño de Carga de Archivos

- **Descripción:** El sistema restringe la subida de archivos adjuntos de matrícula a un tamaño máximo de 5MB por archivo, extensiones específicas (PDF/imágenes), y aplica un límite de 20 solicitudes cada 15 minutos por dirección IP.
- **Motivo:** Protege el almacenamiento y ancho de banda del servidor Express contra cargas maliciosas o degradación por sobrecarga.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:**
  - [multer.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/multer.ts) (Límites de tamaño)
  - [matricula.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/matricula.routes.ts)
- **Endpoints relacionados:**
  - `POST /api/matriculas/submit`
  - `POST /api/matriculas/update-documents/:token`
- **Historias de usuario relacionadas:** HU-MAT-001, HU-MAT-003

---

### RN-MAT-007: Persistencia Continua de Asignación de Salón

- **Descripción:** La selección de salón/sección (`id_grupo`) realizada por el directivo se persiste de inmediato en la base de datos a través de `POST /api/matriculas/assign-grade/:id`. Si una matrícula previamente configurada con grupo es enviada al estado `CORRECCION` por inconsistencias en los documentos, el `id_grupo` permanece inalterado en la tabla `matricula`. Al subsanarse los archivos y reingresar a la solicitud, el sistema carga y pre-selecciona automáticamente el salón asignado previamente, evitando tener que volver a elegir el curso.
- **Motivo:** Brinda continuidad administrativa al directivo, preserva la reserva del grupo escolar durante el proceso de revisión y evita pérdidas de parametrización.
- **Módulos afectados:** Matrículas e Inscripciones, Estructura Escolar.
- **Archivos donde se implementa:**
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`assignGrade`, `getMatriculaDetails`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`assignGrade`)
  - [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue) (`assignRoom`, `fetchDetails`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/assign-grade/:id`
  - `GET /api/matriculas/:id`
- **Historias de usuario relacionadas:** HU-MAT-005, HU-MAT-006

---

### RN-MAT-008: Aislamiento por Inquilino (Multi-Tenant)

- **Descripción:** Los directivos escolares solo pueden visualizar, evaluar, asignar cupos y oficializar solicitudes de matrícula que pertenezcan a su mismo `id_colegio`.
- **Motivo:** Salvaguarda la privacidad y confidencialidad de la información de admisiones de cada plantel escolar en un entorno compartido.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:**
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (Validación de `colegioId` contra token de sesión)
- **Endpoints relacionados:** Todos los endpoints administrativos del módulo.
- **Historias de usuario relacionadas:** HU-MAT-004, HU-MAT-005, HU-MAT-006

---

## Flujo de Reingresos de Estudiantes Retirados

### RN-MAT-009: Elegibilidad Exclusiva de Reingreso

- **Descripción:** Solo los estudiantes con estado `RETIRADO` (o alumnos en estado activo que pasan a `RETIRADO` para iniciar trámite) son elegibles para reingresar a la institución. Los alumnos con estado `EXPULSADO` o `GRADUADO` están totalmente inhabilitados y bloqueados por el sistema.
- **Motivo:** Garantiza que sanciones de expulsión permanente y estados de graduados se respeten sin excepciones.
- **Módulos afectados:** Matrículas e Inscripciones, Estudiantes y Estados.
- **Archivos donde se implementa:**
  - [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts) (`sendParentReingresoLink`, `getStudentHistoryForReingreso`)
- **Endpoints relacionados:**
  - `POST /api/reingreso/send-parent-link`
- **Historias de usuario relacionadas:** HU-MAT-008

---

### RN-MAT-010: Irreversibilidad y Notificación de Tickets de Incidencia de Reingreso

- **Descripción:** Cuando un directivo promueve un ticket de soporte de incidencia de reingreso al estado `EN_PROCESO`, el sistema solicita confirmación advirtiendo que la acción es irreversible, envía un correo electrónico automático al acudiente informando la ejecución del trámite, e impide estrictamente retornar el ticket a estado `ABIERTO`.
- **Motivo:** Asegura la trazabilidad en la atención de solicitudes de reingreso solicitadas por los acudientes y la notificación inmediata.
- **Módulos afectados:** Matrículas e Inscripciones, Soporte y Tickets.
- **Archivos donde se implementa:**
  - [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) (`updateTicketStatus`)
  - [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) (Alerta de confirmación al cambiar a EN_PROCESO)
- **Endpoints relacionados:**
  - `PUT /api/support/tickets/:id/status`
- **Historias de usuario relacionadas:** HU-MAT-009, HU-SOP-005

---

### RN-MAT-011: Matriz Documental de Renovación

- **Descripción:** Al iniciar un reingreso, el sistema genera la matriz documental del alumno retirado. Conserva los documentos previamente cargados en años pasados que sigan en estado `VIGENTE` (`VALIDADO`) y marca como `PENDIENTE` únicamente aquellos que requieran renovación o actualización por parte del acudiente.
- **Motivo:** Agiliza el proceso administrativo al no exigir de nuevo documentos institucionales que no expiran.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:**
  - [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts) (`sendParentReingresoLink`)
  - [ReingresoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ReingresoManagement.vue)
- **Endpoints relacionados:**
  - `POST /api/reingreso/send-parent-link`
- **Historias de usuario relacionadas:** HU-MAT-008

---

### RN-MAT-012: Configuración de Destino y Control de Cupos en Tiempo Real

- **Descripción:** El formulario "Configuración de Destino" exige la selección de Año Lectivo Activo, Nivel Escolar, Grado y Grupo/Salón de destino. El selector de salones calcula en tiempo real `cupos_totales - (matriculas activas/trasladadas)` e inhabilita cursos sin cupo disponible.
- **Motivo:** Evita el sobrecupo y asegura que el alumno reingresado sea asignado a un aula con espacio físico comprobado.
- **Módulos afectados:** Matrículas e Inscripciones, Estructura Escolar.
- **Archivos donde se implementa:**
  - [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts) (`getReingresoGroups`)
  - [ReingresoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ReingresoManagement.vue)
- **Endpoints relacionados:**
  - `GET /api/reingreso/groups`
- **Historias de usuario relacionadas:** HU-MAT-008

---

### RN-MAT-013: Auditoría del Motivo de Retiro

- **Descripción:** Al marcar a un estudiante en estado `RETIRADO`, es obligatorio especificar la causa del retiro. Esta información se persiste en la columna `motivo_estado` de la tabla `estudiante` y `detalles_cancelacion` de la tabla `matricula`, estando siempre visible en el expediente del alumno en Reingresos y en la Gestión de Estudiantes.
- **Motivo:** Mantiene un registro auditable del porqué de la desvinculación escolar para comités académicos e inspección.
- **Módulos afectados:** Matrículas e Inscripciones, Estudiantes y Estados.
- **Archivos donde se implementa:**
  - [studentController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/studentController.ts) (`updateStudentStatus`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`getFiltered`, `getDetails`)
  - [StudentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/StudentManagement.vue)
  - [ReingresoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ReingresoManagement.vue)
- **Endpoints relacionados:**
  - `PATCH /api/student/:id/status`
- **Historias de usuario relacionadas:** HU-MAT-008

---

### RN-MAT-014: Definición del Estado Final del Estudiante al Cancelar Matrícula

- **Descripción:** Al cancelar formalmente una matrícula (`estado = 'CANCELADA'`), el directivo debe seleccionar explícitamente el estado final que asumirá el estudiante en la institución:
  1. `RETIRADO`: Desvinculación escolar por retiro voluntario, impago o traslado. Mantiene al alumno elegible para futuros trámites de Reingreso (RN-MAT-009).
  2. `EXPULSADO`: Expulsión definitiva por sanción disciplinaria gravísima. Inhabilita automáticamente cualquier trámite futuro de Reingreso.
  *(Nota: Las suspensiones temporales no deben cancelar matrículas y se manejan exclusivamente mediante el módulo disciplinario de Sanciones).*
- **Motivo:** Evita el uso de estados genéricos e imprecisos, preserva la integridad del historial académico y asegura el cumplimiento automatizado del bloqueo de reingresos para alumnos expulsados.
- **Módulos afectados:** Matrículas e Inscripciones, Estudiantes y Estados.
- **Archivos donde se implementa:**
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (`cancelEnrollment`)
  - [matricula.dto.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/dtos/matricula.dto.ts) (`CancelEnrollmentSchema`)
  - [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue)
- **Endpoints relacionados:**
  - `POST /api/matriculas/cancel/:id`
- **Historias de usuario relacionadas:** HU-MAT-005, HU-MAT-008

---

### RN-MAT-015: Detección Automática, Autocompletado y Bloqueo Reactivo de Acudiente Existente

- **Descripción:** Durante la formalización de matrícula en el paso 2 (Padre / Acudiente), al ingresar o cargar un número de documento de acudiente, el sistema consulta `GET /api/auth/check-document/:document`. Si el usuario ya existe en la base de datos:
  1. Autocompleta automáticamente los campos `Nombres del Padre`, `Apellidos del Padre` y `Tipo de Documento`.
  2. Desactiva y bloquea dichos campos para evitar inconsistencias con la identidad registrada del usuario.
  3. Muestra una insignia y mensaje informativo del rol del usuario existente.
  4. Si el directivo digita un documento diferente, el sistema desvincula al usuario previo, vacía los campos de nombres y apellidos, y los desbloquea para permitir el ingreso de un nuevo acudiente.
- **Motivo:** Previene la duplicidad de cuentas de acudientes, preserva la coherencia de datos personales en el ecosistema multi-sede y agiliza el flujo de formalización para familias con varios hijos o personal docente matriculando acudidos.
- **Módulos afectados:** Matrículas e Inscripciones, Autenticación y Usuarios.
- **Archivos donde se implementa:**
  - [userController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/userController.ts) (`checkDocument`)
  - [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue) (`verifyDocument`, `onParentDocumentInput`, `isParentInputsDisabled`)
- **Endpoints relacionados:**
  - `GET /api/auth/check-document/:document`
- **Historias de usuario relacionadas:** HU-MAT-006
