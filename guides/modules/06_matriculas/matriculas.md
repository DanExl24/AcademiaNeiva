# 📋 Módulo de Matrículas e Inscripciones

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Inscripciones, Matrículas de Estudiantes, Reingresos y Renovaciones  
**Última actualización:** 2026-08-17  

---

## 1. Descripción Funcional

El módulo de **Matrículas e Inscripciones** coordina el ciclo de vida completo de incorporación académica de los estudiantes a las instituciones del ecosistema AcademiaNeiva. Administra desde la postulación pública inicial con verificación de identidad por correo electrónico hasta la formalización directiva en base de datos mediante transacciones atómicas.

Abarca cuatro modalidades operativas:
1. **Inscripción Regular / Ordinaria:** Trámite público para aspirantes dentro del calendario institucional con verificación previa obligatoria mediante código OTP de 6 dígitos.
2. **Matrícula Extraordinaria:** Trámite extemporáneo originado exclusivamente desde la Mesa de Ayuda (`tickets_soporte` con incidencia `MATRICULA_EXTRAORDINARIA`) mediante enlace con token único UUID que permite eludir las fechas regulares de cierre.
3. **Reingreso de Estudiantes Retirados:** Reactivación de expedientes de alumnos previamente en estado `RETIRADO` mediante matriz documental inteligente (conservando archivos vigentes y solicitando únicamente los vencidos), configuración de aula con validación de cupos y transición irreversible del ticket de soporte a `EN_PROCESO`.
4. **Renovación Anual para Familias Existentes:** Detección automática de hermanos o hijos asociados al buzón del acudiente (`renovacion.candidates`), con selector obligatorio en la consola directiva entre renovar a un hijo existente o registrar a un nuevo hijo sin duplicar la cuenta del padre.

Asimismo, implementa almacenamiento binario seguro (`BYTEA`) en PostgreSQL para los documentos adjuntos con control de versiones (`version = version + 1`), enlaces de visualización protegidos por tokens JWT efímeros (`verifyDocumentToken`), bloqueo físico de concurrencia Pessimistic `FOR UPDATE` en la asignación de cupos, y vinculación multi-rol (`usuario_colegio`) para padres que simultáneamente laboran como personal institucional (docentes/directivos).

---

## 2. Actores y Permisos

| Rol | Alcance en el Módulo |
|---|---|
| **Público / Visitante / Acudiente** | Solicitar código OTP de verificación de correo, radicar solicitud de matrícula regular o extraordinaria con archivos adjuntos, consultar estado mediante token UUID público (`token_seguimiento`), y subsanar documentos rechazados cargando versiones corregidas. |
| **Directivo (Rector / Coordinador)** | Filtrar y listar matrículas por año lectivo y estado (`PENDIENTE`, `CORREGIDA`, `CORRECCION`, `APROBADA`, etc.), inspeccionar documentos en línea mediante visor protegido, validar o rechazar archivos individuales, notificar inconsistencias por email, asignar grados y salones con control de cupos en tiempo real, tramitar reingresos, cancelar solicitudes determinando el estado final del alumno (`RETIRADO` o `EXPULSADO`), y formalizar la matrícula creando de forma atómica al estudiante, usuario, padre y parentesco. |
| **Administrador General** | Acceso global y auditoría a expedientes de matrícula en modo supervisión extraordinaria sobre cualquier institución, con registro inmutable en `auditoria_acciones_realizadas`. |

---

## 3. Acciones Disponibles y Endpoints de la API

| Acción | Método | Endpoint | Autenticación Requerida | Parámetros / Body Requeridos |
|---|---|---|---|---|
| Listar colegios registrados | `GET` | `/api/matriculas` | Pública | Ninguno |
| Obtener configuración de inscripción de un colegio | `GET` | `/api/matriculas/school/:schoolId/enrollment-config` | Pública | `schoolId` (Parámetro URL) |
| Enviar código OTP de verificación de correo | `POST` | `/api/matriculas/send-email-code` | Pública | `{ email: string }` |
| Validar código OTP de correo de matrícula | `POST` | `/api/matriculas/verify-email-code` | Pública | `{ email: string, code: string }` |
| Radicar solicitud de matrícula (Multipart FormData) | `POST` | `/api/matriculas/submit` | Pública | Form fields + Files (`upload.fields`) |
| Listar matrículas pendientes del colegio | `GET` | `/api/matriculas/pending/:idColegio` | JWT Directivo | `idColegio` (URL), `yearId` (Query) |
| Listar matrículas filtradas por estado y año | `GET` | `/api/matriculas/filtered/:idColegio` | JWT Directivo | `idColegio` (URL), `estado` (Query), `yearId` (Query) |
| Consultar expediente completo de matrícula | `GET` | `/api/matriculas/:id` | JWT Directivo (si ID entero) / Pública (si UUID) | `id` (Entero de matrícula o Token UUID) |
| Descargar / Visualizar archivo binario de documento | `GET` | `/api/matriculas/documentos/:idDocumento/archivo` | Token Efímero (`verifyDocumentToken`) | `idDocumento` (URL), `token` (Query) |
| Validar o rechazar documento individual | `PATCH` | `/api/matriculas/document/:idDocumento` | JWT Directivo | `{ estado: 'VALIDADO' \| 'RECHAZADO' }` |
| Notificar inconsistencias en documentos | `POST` | `/api/matriculas/notify-inconsistencies/:id` | JWT Directivo | `id` (ID Matrícula en URL) |
| Subsanar documentos rechazados por token | `POST` | `/api/matriculas/update-documents/:token` | Pública (con Token UUID) | `token` (URL) + Files corregidos |
| Asignar salón / sección al aspirante | `POST` | `/api/matriculas/assign-grade/:id` | JWT Directivo | `{ idGrado: number }` |
| Finalizar y oficializar matrícula | `POST` | `/api/matriculas/finalize/:id` | JWT Directivo | `{ student, parent, id_grado, id_estudiante? }` |
| Cancelar solicitud de matrícula | `POST` | `/api/matriculas/cancel/:id` | JWT Directivo | `{ motivo: string, detalles?: string, estado_estudiante: 'RETIRADO' \| 'EXPULSADO' }` |
| Alternar indicador de traslado en matrícula | `PATCH` | `/api/matriculas/transfer-status/:id` | JWT Directivo | `{ es_traslado: boolean }` |
| Crear matrícula extraordinaria por ticket | `POST` | `/api/academic-admin/matriculas/extraordinaria` | JWT Directivo | `{ id_ticket, id_colegio, email, tipo_estudiante }` |
| Obtener expediente de alumno retirado para reingreso | `GET` | `/api/reingreso/student-history/:id_estudiante` | JWT Directivo | `id_estudiante` (URL) |
| Obtener salones y cupos en tiempo real para reingreso | `GET` | `/api/reingreso/groups` | JWT Directivo | `idColegio`, `idAnio`, `idNivel`, `idTipoGrado` |
| Enviar enlace de reingreso al acudiente | `POST` | `/api/reingreso/send-parent-link` | JWT Directivo | `{ id_estudiante, id_colegio, id_anio, id_grupo, id_ticket, docs }` |

---

## 4. Reglas de Negocio

- **RN-MAT-001 (Validación de Fechas Ordinarias y Año Lectivo Abierto):** Toda solicitud de matrícula regular exige que el colegio cuente con un año lectivo en estado `ABIERTO` en la tabla `anio_lectivo`, que exista configuración en `configuracion_inscripcion` con `habilitada = true`, y que la fecha del servidor cumpla `fecha_inicio <= now() <= fecha_cierre`.
- **RN-MAT-002 (Matrícula Extraordinaria por Mesa de Soporte):** Una solicitud de tipo `EXTRAORDINARIA` se genera exclusivamente desde un Ticket de Soporte con incidencia `MATRICULA_EXTRAORDINARIA`. Se pre-crea la fila en `matricula` en estado `PENDIENTE` vinculada al `id_ticket` y se emite un `token_seguimiento`. El acudiente puede radicar su formulario usando este token incluso si las inscripciones ordinarias están cerradas. Al formalizar la matrícula, el ticket se resuelve automáticamente (`estado = 'RESUELTO'`).
- **RN-MAT-003 (Acceso por Token UUID y Tokens Efímeros JWT):** Los aspirantes acceden al seguimiento y corrección mediante su `token_seguimiento` de tipo UUID sin requerir credenciales de usuario. Los archivos binarios adjuntos se visualizan a través del endpoint `/documentos/:idDocumento/archivo` validado mediante un token JWT firmado de corta duración generado por `generateDocumentAccessToken`.
- **RN-MAT-004 (Bloqueo por Documento Rechazado y Transición a `CORRECCION`):** Si un directivo marca uno o más documentos como `RECHAZADO` y ejecuta `notifyInconsistencies`, la matrícula pasa a estado `CORRECCION`, se desactiva la opción de asignación de aula y se despacha un correo al acudiente detallando los archivos a subsanar.
- **RN-MAT-005 (Oficialización Atómica en 6 Pasos):** La finalización de matrícula (`finalizeEnrollment`) ejecuta una transacción Kysely indivisible:
  1. Bloqueo transaccional Pessimistic `FOR UPDATE` sobre el grupo asignado verificando cupos.
  2. Creación o reactivación del estudiante en `estudiante` (estado `ACTIVO`) y cuenta en `usuario` (rol `estudiante`).
  3. Creación o vinculación del acudiente en `padre_familia`, asignación del rol en `usuario_rol` y relación en `usuario_colegio` (`ACTIVO`), preservando cuentas si es docente o directivo (`upsertInstitutionalEmail`).
  4. Inserción o actualización de la relación parentesco en `detalle_padrefamilia`.
  5. Cancelación automática de matrículas previas del alumno en el mismo año lectivo (`motivo_cancelacion = 'Reemplazada por reingreso / nueva matrícula finalizada'`).
  6. Transición de la matrícula a `ACTIVA` (o `TRASLADADA`), resolución automática del ticket asociado (`id_ticket`) y despacho del correo con credenciales de acceso institucional.
- **RN-MAT-006 (Persistencia Binaria `BYTEA` y Límites de Carga):** Los archivos adjuntos se procesan en memoria con Multer y se persisten directamente como buffers binarios en la columna `contenido` (`BYTEA`) de la tabla `documento_matriculas` con límite máximo de 5MB por archivo y extensiones permitidas (PDF, PNG, JPG, JPEG, SVG).
- **RN-MAT-007 (Persistencia de Salón y Transición a `CORREGIDA` tras Subsanación):** La asignación de salón (`assignGrade`) se persiste de inmediato en `matricula.id_grupo`. Cuando el acudiente sube documentos corregidos (`updateDocumentsByToken`), el sistema crea nuevos registros en `documento_matriculas` con `version = version + 1`, preserva el salón previamente asignado y transiciona la matrícula al estado **`CORREGIDA`** (no `PENDIENTE`), facilitando el filtrado directivo.
- **RN-MAT-008 (Aislamiento Multi-Tenant):** Las consultas y modificaciones directivas están estrictamente aisladas por el `id_colegio` del usuario autenticado. La excepción la constituye el `admin_general` en sesión de supervisión activa, cuyas acciones se auditan en `auditoria_acciones_realizadas`.
- **RN-MAT-009 (Elegibilidad Exclusiva de Reingreso):** Solo estudiantes con estado histórico `RETIRADO` son elegibles para reingresar. Alumnos en estado `EXPULSADO` o `GRADUADO` están totalmente vetados por el backend.
- **RN-MAT-010 (Irreversibilidad de Tickets de Reingreso):** Al promover un ticket de incidencia de reingreso al estado `EN_PROCESO`, la acción solicita confirmación, envía un correo informativo al acudiente y bloquea el retorno del ticket a `ABIERTO`.
- **RN-MAT-011 (Matriz Documental Inteligente y Auto-Clonación en Traslados):** En reingresos, los documentos vigentes se conservan (`VIGENTE`) y solo se exige actualizar los vencidos (`RENOVAR`). Si una matrícula proviene de un traslado o no posee archivos propios, `getDetails` clona automáticamente los documentos previos del estudiante.
- **RN-MAT-012 (Control de Cupos con Bloqueo Físico Pessimistic `FOR UPDATE`):** El cálculo de cupos disponibles (`cupos_totales - (activas + trasladadas)`) se verifica tanto en los selectores de la interfaz como a nivel de base de datos con bloqueo de fila SQL (`FOR UPDATE`) en el instante de formalizar, abortando la transacción si el aula se llenó concurrentemente.
- **RN-MAT-013 (Auditoría del Motivo de Retiro):** Al retirar a un estudiante, el motivo se registra obligatoriamente en `estudiante.motivo_estado` y `matricula.detalles_cancelacion`, mostrándose siempre en su expediente de reingreso.
- **RN-MAT-014 (Definición del Estado Final al Cancelar Matrícula):** Al cancelar una matrícula (`cancelEnrollment`), el directivo debe definir si el alumno queda en estado `RETIRADO` (elegible para reingreso futuro) o `EXPULSADO` (inhabilitación disciplinaria permanente).
- **RN-MAT-015 (Detección de Doble Rol de Acudiente y Preservación de Cuentas):** Al ingresar el documento del acudiente, `checkDocument` detecta si el usuario ya existe en el sistema (ej. como docente o directivo). Si existe, no sobrescribe sus nombres ni altera sus vinculaciones laborales, creando únicamente el rol `padre` en `usuario_rol` y la relación en `usuario_colegio`.
- **RN-MAT-016 (Verificación Previa OTP del Correo):** El formulario público de admisión exige validar obligatoriamente la titularidad del correo electrónico mediante código OTP de 6 dígitos (15 min de caducidad) antes de admitir el envío de la matrícula.
- **RN-MAT-017 (Validación Cruzada de Identidad Estudiante-Acudiente):** El backend y frontend validan que `normalizeDocument(student.documento) !== normalizeDocument(parent.documento)`, impidiendo que un estudiante sea registrado con el mismo documento del acudiente.
- **RN-MAT-018 (Bifurcación Obligatoria en Familias con Varios Hijos):** Si el correo del acudiente tiene hijos previos registrados en la institución (`renovacion.candidates`), el directivo debe seleccionar en `FinalRegistration.vue` si renueva a un hijo existente (`selectedCandidate`) o si registra a un nuevo hijo/hermano (`isNewStudent`), evitando sobreescrituras accidentales.

---

## 5. Implementación del Módulo

### Backend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Rutas de Matrícula** | [matricula.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/matricula.routes.ts) | Definición de endpoints públicos, directivos, Multer upload y middleware de tokens efímeros. |
| **Controlador de Matrícula** | [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) | Handlers HTTP: `submitEnrollment`, `getPendingMatriculas`, `getMatriculaDetails`, `validateDocument`, `assignGrade`, `notifyInconsistencies`, `finalizeEnrollment`, `cancelEnrollment`, `downloadDocumentFile`, `sendEnrollmentEmailCode`, `verifyEnrollmentEmailCode`. |
| **Servicio de Matrícula** | [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) | Lógica transaccional Kysely: persistencia binaria `BYTEA`, bloqueo `FOR UPDATE`, auto-clonación documental, gestión de candidatos de renovación y formalización atómica. |
| **Controlador de Reingreso** | [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts) | Expedientes de retirados, matriz documental y envío de enlace de reingreso al acudiente. |
| **Servicio de Notificaciones** | [notificationService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/notificationService.ts) | Plantillas de email: confirmación de radicación, inconsistencias, credenciales de acceso y cancelaciones. |
| **Seguridad Documental** | [documentSecurity.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/documentSecurity.ts) | Emisión y validación de tokens efímeros firmados para visualización segura de archivos. |

### Frontend

| Componente | Archivo Fuente | Funcionalidad Principal |
|---|---|---|
| **Formulario Público de Admisión** | [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue) | Interfaz pública por pasos con temporizador OTP de 15 min, selector dinámico de niveles/grados y soporte de tokens de matrícula extraordinaria. |
| **Bandeja de Matrículas Directiva** | [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue) | Listado filtrado por estado (`PENDIENTE`, `CORREGIDA`, `ACTIVA`, `TRASLADADA`), año lectivo y badges informativos. |
| **Detalles y Validación Documental** | [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue) | Visor integrado de archivos con PDF.js, historial de versiones de documentos, selector de salones con cálculo de cupos en tiempo real y modal de cancelación. |
| **Formalización Final** | [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue) | Paso 1 (Estudiante: selector de candidato vs nuevo alumno, advertencia académica del año previo) y Paso 2 (Acudiente: detección en tiempo real de usuario existente / personal docente). |
| **Subsanación Pública** | [EnrollmentCorrection.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentCorrection.vue) | Formulario público accesible por token UUID para reemplazar únicamente los archivos rechazados. |
| **Seguimiento Público** | [MatriculaTrackingView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/MatriculaTrackingView.vue) | Consulta pública del estado del trámite mediante token UUID. |
| **Gestión de Reingresos** | [ReingresoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ReingresoManagement.vue) | Consola de reingreso con matriz documental y configuración de destino. |

---

## 6. Modelo de Datos

### Tabla: `matricula`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_matricula` | SERIAL PK | Identificador único secuencial de la solicitud. |
| `id_estudiante` | INT FK (NULLable) | Enlace al estudiante oficializado (NULL mientras está en revisión). |
| `id_nivel` | INT FK | Nivel escolar del aspirante (Preescolar, Primaria, Secundaria, Media). |
| `id_grupo` | INT FK (NULLable) | Grupo/Salón físico asignado. |
| `id_colegio` | INT FK | Institución educativa de destino. |
| `id_anio` | INT FK | Año lectivo en el que aplica la matrícula. |
| `estado` | `estado_matricula` | `PENDIENTE`, `CORRECCION`, `CORREGIDA`, `PENDIENTE_RENOVACION`, `APROBADA`, `ACTIVA`, `RECHAZADA`, `CANCELADA`, `TRASLADADA`, `CULMINADA`. |
| `tipo` | `tipo_matricula` | `REGULAR`, `RENOVACION`, `REINGRESO`, `EXTRAORDINARIA`, `TRASLADO`. |
| `correo_padre` | VARCHAR(100) | Correo electrónico de contacto del acudiente. |
| `token_seguimiento` | UUID | Token criptográfico de acceso público para seguimiento y subsanación. |
| `tiene_discapacidad` | BOOLEAN | Indica si el aspirante presenta necesidades educativas especiales. |
| `es_extranjero` | BOOLEAN | Indica si el aspirante requiere documentación de extranjería (visa). |
| `motivo_cancelacion` | VARCHAR(100) | Motivo formal de cancelación o reemplazo. |
| `detalles_cancelacion` | TEXT | Explicación descriptiva del retiro o rechazo. |
| `es_traslado` | BOOLEAN | Indicador de procedencia de traslado interinstitucional. |
| `id_ticket` | INT FK (NULLable) | Ticket de soporte asociado (en reingresos o extraordinarias). |
| `fecha_creacion` | TIMESTAMPTZ | Fecha y hora de radicación. |
| `fecha_aprobacion` | TIMESTAMPTZ | Fecha y hora de formalización definitiva. |

### Tabla: `documento_matriculas`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_documento` | SERIAL PK | Identificador único del archivo adjunto. |
| `id_matricula` | INT FK | Matrícula a la que pertenece el documento. |
| `id_colegio` | INT FK | Colegio propietario del expediente. |
| `tipo_documento` | VARCHAR(100) | Tipo de archivo (`registroCivil`, `vacunas`, `salud`, `foto`, etc.). |
| `url` | TEXT | Nombre del archivo físico o URL descriptiva. |
| `estado` | `estado_documento` | `PENDIENTE`, `VALIDADO`, `RECHAZADO`. |
| `version` | INT | Número de versión incremental del documento (1, 2, 3...). |
| `estado_renovacion` | VARCHAR(50) | Estado en trámites de reingreso (`VIGENTE`, `RENOVAR`). |
| `contenido` | BYTEA | **Buffer binario del archivo almacenado directamente en PostgreSQL.** |
| `mime_type` | VARCHAR(100) | Tipo MIME oficial (`application/pdf`, `image/png`, `image/jpeg`, etc.). |
| `nombre_original` | VARCHAR(255) | Nombre del archivo original suministrado por el usuario. |
| `tamano_bytes` | BIGINT | Tamaño físico del archivo en bytes. |
| `fecha` | TIMESTAMPTZ | Fecha de carga del documento. |
| `fecha_expedicion` | DATE | Fecha opcional de expedición del documento. |

---

## 7. Conexiones con Otros Módulos

- **→ Autenticación y Usuarios:** Genera automáticamente el usuario estudiante con código único e integra acudientes mediante `usuario_rol` y `usuario_colegio`.
- **→ Estructura Escolar:** Consulta grupos y aforos, y ejecuta bloqueo Pessimistic `FOR UPDATE` sobre `grupos` para garantizar la reserva de cupos.
- **→ Estudiantes y Estados:** Al oficializar crea o reactiva la ficha del estudiante en estado `ACTIVO`. Al cancelar, actualiza el estado a `RETIRADO` o `EXPULSADO` con su `motivo_estado`.
- **→ Mesa de Ayuda y Tickets:** Enlaza solicitudes de tipo `EXTRAORDINARIA` y `REINGRESO`, actualizando tickets a `EN_PROCESO` de forma irreversible y resolviéndolos a `RESUELTO` al culminar la matrícula.
- **→ Seguimiento y Promoción Académica:** `FinalRegistration.vue` consulta `checkAcademicWarning` para advertir al directivo si el aspirante reprobó el año anterior.
- **→ Supervisión y Auditoría:** Si la matrícula es finalizada por un Administrador General en supervisión, registra la entrada inmutable en `auditoria_acciones_realizadas`.
- **→ Flujo de Correos y OTP:** Despacha códigos de verificación de 6 dígitos mediante `EmailVerificationService` y plantillas HTML con `NotificationService`.

---

## 8. Validaciones Implementadas

### Backend
- **Verificación OTP de Correo:** Comprueba que el correo fue validado en `codigo_verificacion_email` en las últimas 2 horas.
- **Validación de Cupos en Transacción (`FOR UPDATE`):** Aborta la oficialización si `ocupados >= totalCupos`.
- **Validación Cruzada de Documentos:** Impide que el estudiante y el acudiente tengan el mismo documento de identidad.
- **Unicidad Global de Documento:** `validateDocumentUniqueness` verifica que el documento no pertenezca a otro estudiante activo.
- **Validación de Nombres y Documentos con Regex:** Exige mínimo 2 letras en nombres y mínimo 4 caracteres alfanuméricos en documentos.

### Frontend
- **Temporizador Reactivo OTP:** Bloquea el formulario de matrícula con cuenta regresiva de 15 minutos.
- **Detección Dinámica de Acudiente Existente:** Autocompleta y desactiva campos si el acudiente ya está registrado.
- **Advertencia Académica Informativa:** Muestra asignaturas y año reprobado sin bloquear la matrícula.
- **Selector de Candidato de Renovación:** Obliga a elegir entre renovar a un hijo existente o crear un nuevo alumno.

---

## 9. Decisiones de Diseño

| Decisión | Justificación Técnica |
|---|---|
| **Almacenamiento Binario `BYTEA` en PostgreSQL** | Proporciona portabilidad total en respaldos y migraciones de base de datos (`pg_dump`), eliminando dependencias con el sistema de archivos local del servidor y evitando pérdidas de archivos en despliegues con contenedores efímeros. |
| **Tokens JWT Efímeros para Visualización de Archivos** | Previene accesos no autorizados a documentos confidenciales de menores de edad (registros civiles, certificados médicos). Cada enlace de visualización generado por `getDetails` vence en pocos minutos y exige firma criptográfica. |
| **Bloqueo Pessimistic `FOR UPDATE` en Cupos** | Protege al colegio frente a sobrecupos provocados por directivos formalizando alumnos simultáneamente en el mismo salón durante jornadas masivas de matrícula. |
| **Estado `CORREGIDA` con Versionado Incremental** | Permite a los directivos filtrar rápidamente las matrículas que acaban de ser subsanadas por los padres (`estado = CORREGIDA`) e inspeccionar el historial de versiones anteriores para verificar qué archivo fue modificado. |
| **Bifurcación de Candidatos de Renovación en la UI** | Resuelve el problema común en colegios donde un padre con varios hijos matricula a un hermano menor: previene que el sistema sobrescriba accidentalmente la ficha del hermano mayor. |
