# 📋 Módulo de Matrículas e Inscripciones

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Inscripciones, Matrículas de Estudiantes y Reingresos  
**Última actualización:** 2026-07-28

---

## 1. Descripción Funcional

Este módulo gestiona el proceso completo de registro, validación y matrícula de estudiantes en la plataforma, abarcando inscripciones ordinarias, extraordinarias y **trámites de reingreso de estudiantes retirados**. Proporciona una interfaz pública para que los aspirantes o padres de familia envíen solicitudes de matrícula adjuntando los documentos de soporte requeridos (registro civil, certificado de salud, etc.). Asimismo, ofrece una consola administrativa para que los directivos evalúen la documentación, notifiquen inconsistencias a subsanar, asignen grupos comprobando cupos en tiempo real, gestionen solicitudes de reingreso y finalicen o cancelen el proceso de matrícula oficializando al estudiante en el sistema.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Público / Visitante** | Consulta de colegios, consulta de configuración de inscripciones, envío de solicitudes de matrícula, seguimiento de solicitudes mediante token UUID, apertura de tickets de incidencia de reingreso y corrección de documentos rechazados. |
| **Directivo** | Gestión completa del flujo de matrículas del colegio: listar solicitudes por estado, verificar documentos adjuntos, asignar grados y grupos con cupos en tiempo real, reportar inconsistencias, tramitar reingresos de estudiantes retirados, configurar destino y matriz documental, autorizar matrículas extraordinarias y de reingreso, y finalizar o cancelar matrículas. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Listar colegios registrados (público) | `GET` | `/api/matriculas` | Público |
| Obtener configuración de inscripción de un colegio | `GET` | `/api/matriculas/school/:schoolId/enrollment-config` | Público |
| Registrar solicitud de matrícula (con documentos) | `POST` | `/api/matriculas/submit` | Público |
| Listar matrículas pendientes del colegio | `GET` | `/api/matriculas/pending/:idColegio` | Directivo |
| Listar matrículas filtradas por estado | `GET` | `/api/matriculas/filtered/:idColegio` | Directivo |
| Obtener detalle de matrícula (por ID o token UUID) | `GET` | `/api/matriculas/:id` | Directivo / Público |
| Validar/Rechazar un documento individual | `PATCH` | `/api/matriculas/document/:idDocumento` | Directivo |
| Asignar grado/grupo al aspirante | `POST` | `/api/matriculas/assign-grade/:id` | Directivo |
| Notificar inconsistencias en documentos | `POST` | `/api/matriculas/notify-inconsistencies/:id` | Directivo |
| Actualizar documentos en estado de corrección | `POST` | `/api/matriculas/update-documents/:token` | Público (con Token) |
| Finalizar y oficializar matrícula | `POST` | `/api/matriculas/finalize/:id` | Directivo |
| Cancelar solicitud de matrícula | `POST` | `/api/matriculas/cancel/:id` | Directivo |
| Cambiar estado de traslado | `PATCH` | `/api/matriculas/transfer-status/:id` | Directivo |
| Registrar matrícula extraordinaria | `POST` | `/api/academic-admin/matriculas/extraordinaria` | Directivo |
| Aprobar matrícula extraordinaria | `POST` | `/api/academic-admin/matriculas/extraordinaria/:id/aprobar` | Directivo |
| Rechazar matrícula extraordinaria | `POST` | `/api/academic-admin/matriculas/extraordinaria/:id/rechazar` | Directivo |
| Obtener expediente del alumno retirado para reingreso | `GET` | `/api/reingreso/student-history/:id_estudiante` | Directivo |
| Obtener salones y cupos en tiempo real para reingreso | `GET` | `/api/reingreso/groups` | Directivo |
| Enviar enlace de reingreso y configurar destino al acudiente | `POST` | `/api/reingreso/send-parent-link` | Directivo |
| Notificar antecedente no encontrado a acudiente | `POST` | `/api/reingreso/notify-non-existent/:id_ticket` | Directivo |

---

## 4. Reglas de Negocio

- **RN-MAT-001 (Control de Fechas de Inscripción):** Las solicitudes de matrícula regular solo pueden enviarse si la fecha actual se encuentra dentro del rango configurado por el colegio (`fecha_inicio` y `fecha_cierre`) y las inscripciones están habilitadas en `configuracion_inscripcion`.
- **RN-MAT-002 (Bypass de Cupos en Extraordinaria):** Las matrículas extraordinarias permiten el registro de estudiantes incluso si las fechas de inscripción regular han expirado, bajo aprobación explícita de los directivos mediante ticket de soporte.
- **RN-MAT-003 (Token de Seguimiento Seguro):** Cada solicitud genera un token UUID único (`token_seguimiento`). El aspirante o acudiente puede consultar el estado de su trámite e incluso subir correcciones de documentos a través de este token sin necesidad de autenticarse en el sistema.
- **RN-MAT-004 (Validación de Documentos por Item):** Los documentos adjuntos (registro civil, etc.) se validan individualmente. Si al menos uno es marcado como `RECHAZADO`, la matrícula pasa a estado `CORRECCION` y se bloquea la oficialización hasta que el solicitante resuelva la inconsistencia.
- **RN-MAT-005 (Oficialización y Creación de Estudiante):** Al presionar "Finalizar", el estado de la matrícula pasa a `ACTIVA` (o `APROBADA`), y el sistema inserta automáticamente el registro del estudiante en la tabla `estudiante`, generándole un código único y una cuenta de usuario para ingresar al portal.
- **RN-MAT-006 (Rate Limiting y Límite de Archivos):** Límite de 20 solicitudes de envío de matrícula por IP cada 15 minutos y tamaño máximo de 5MB por archivo adjunto para proteger el almacenamiento del servidor contra abusos.
- **RN-MAT-007 (Persistencia Continua de Asignación de Salón):** La selección de salón/sección realizada por el directivo se persiste de inmediato en la base de datos (`POST /api/matriculas/assign-grade/:id`). Si una solicitud es enviada a corrección por inconsistencias en los documentos, el salón y las parametrizaciones previamente establecidas por el directivo se conservan intactas, evitando tener que volver a elegir el curso cuando el acudiente reenvíe los archivos subsanados.
- **RN-MAT-008 (Aislamiento por Inquilino Multi-Tenant):** Los directivos escolares solo pueden visualizar, evaluar, asignar cupos y oficializar solicitudes de matrícula que pertenezcan a su mismo `id_colegio`.
- **RN-MAT-009 (Elegibilidad Exclusiva de Reingreso):** Únicamente los estudiantes en estado `RETIRADO` (o estudiantes activos cuyo trámite lo pasa a `RETIRADO`) son elegibles para tramitar reingreso. Alumnos en estado `EXPULSADO` o `GRADUADO` están estrictamente bloqueados por el sistema.
- **RN-MAT-010 (Irreversibilidad de Incidencias de Reingreso a Estado EN_PROCESO):** Cuando un directivo marca un ticket de soporte de tipo incidencia `REINGRESO` como `EN_PROCESO`, el sistema requiere confirmación (advirtiendo que la acción no se puede revertir), envía un correo electrónico al acudiente informando que el trámite se está ejecutando, y bloquea que el ticket pueda regresar a estado `ABIERTO`.
- **RN-MAT-011 (Matriz Documental de Renovación):** En el proceso de reingreso, el sistema presenta la matriz documental del alumno retirado. Los documentos previamente cargados que se encuentren vigentes se marcan como `VIGENTE` (`VALIDADO`), solicitando al acudiente actualizar únicamente los documentos vencidos o requeridos (`PENDIENTE`).
- **RN-MAT-012 (Configuración de Destino y Validación de Cupos en Tiempo Real):** Al procesar un reingreso, el directivo debe configurar el Año Lectivo, Nivel, Grado y Grupo/Salón de destino. El selector de salones calcula en tiempo real `cupos_totales - matrículas activas/trasladadas` e impide seleccionar cursos sin cupo disponible.
- **RN-MAT-013 (Auditoría del Motivo de Retiro):** Todo estudiante pasado a estado `RETIRADO` registra de forma obligatoria su motivo de retiro en la tabla `estudiante` (`motivo_estado`) y en `matricula` (`detalles_cancelacion`). Dicho motivo se muestra en el expediente del alumno en Reingresos y en las fichas de gestión de estudiantes.
- **RN-MAT-014 (Definición del Estado Final del Estudiante al Cancelar Matrícula):** Al cancelar formalmente una matrícula, el directivo selecciona si el estudiante queda en estado `RETIRADO` (elegible para reingreso futuro) o `EXPULSADO` (inhabilitación permanente).
- **RN-MAT-015 (Detección Automática y Autocompletado de Acudiente Existente):** Durante la formalización de matrícula, al ingresar el documento del acudiente el sistema consulta la base de datos, autocompleta nombres y apellidos, bloquea los campos para evitar inconsistencias de identidad, y los restablece dinámicamente si se digita otro documento.
- **RN-MAT-016 (Verificación Previa OTP del Correo del Acudiente):** Antes de enviar el formulario de inscripción pública (`EnrollmentView.vue`), el acudiente debe verificar obligatoriamente la posesión de su correo electrónico mediante un código OTP de 6 dígitos emitido por `POST /api/matriculas/send-email-code` y validado por `POST /api/matriculas/verify-email-code`. Sin este paso validado, el envío de la matrícula queda bloqueado.
- **RN-MAT-017 (Captura y Validación Obligatoria de Teléfono de Contacto):** La inscripción captura obligatoriamente los números de teléfono del acudiente y del estudiante (`telefono_acudiente`, `telefono_estudiante`), validados con esquema Zod (7 a 20 dígitos numéricos/telefónicos estándar) para garantizar canales de contacto efectivos.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller Matrículas** | [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) — `submitEnrollment`, `getPendingMatriculas`, `getMatriculaDetails`, `validateDocument`, `assignGrade`, `notifyInconsistencies`, `finalizeEnrollment`, `cancelEnrollment`, `toggleTransfer` |
| **Controller Reingresos** | [reingresoController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/reingresoController.ts) — `getStudentHistoryForReingreso`, `getReingresoGroups`, `sendParentReingresoLink`, `notifyNonExistentStudent` |
| **Controller Admin (Extraordinario)** | [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `createExtraordinaryEnrollment`, `approveExtraordinaryEnrollment`, `rejectExtraordinaryEnrollment` |
| **Service** | [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) — Operaciones de base de datos de matrículas y documentos |
| **Routes** | [matricula.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/matricula.routes.ts), [reingreso.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/reingreso.routes.ts), [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts) |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vista Pública de Envío** | [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue) |
| **Vista Pública de Corrección** | [EnrollmentCorrection.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentCorrection.vue) |
| **Vista Pública de Seguimiento** | [MatriculaTrackingView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/MatriculaTrackingView.vue) |
| **Vista Gestión Directivo (Matrículas)** | [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue), [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue), [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue) |
| **Vista Gestión Directivo (Reingresos)** | [ReingresoManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ReingresoManagement.vue) |

---

## 6. Modelo de Datos

### Tabla: `matricula`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_matricula` | SERIAL PK | Identificador interno único. |
| `id_estudiante` | INT FK | Referencia al estudiante oficializado. |
| `id_nivel` | INT FK | Nivel escolar de inscripción. |
| `id_colegio` | INT FK | Colegio de destino. |
| `id_anio` | INT FK | Año lectivo de la matrícula. |
| `estado` | `estado_matricula` | ENUM: `PENDIENTE`, `CORRECCION`, `APROBADA`, `ACTIVA`, `RECHAZADA`, `CANCELADA`, `TRASLADADA`, `CULMINADA`. |
| `correo_padre` | VARCHAR(100) | Correo de contacto para notificaciones y subsanaciones. |
| `token_seguimiento` | UUID | Token para el acceso público de consulta y edición. |
| `id_grupo` | INT FK | Grupo asignado al estudiante. |
| `motivo_cancelacion` | VARCHAR(100) | Motivo de retiro o cancelación de matrícula. |
| `detalles_cancelacion` | TEXT | Explicación o detalle del retiro del alumno. |
| `es_traslado` | BOOLEAN | Indica si la matrícula proviene de un traslado de otra escuela. |
| `tipo` | `tipo_matricula` | ENUM: `REGULAR`, `RENOVACION`, `REINGRESO`, `EXTRAORDINARIA`, `TRASLADO`. |

### Tabla: `documento_matriculas`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_documento` | SERIAL PK | Identificador del archivo adjunto. |
| `id_matricula` | INT FK | Matrícula a la que pertenece el documento. |
| `tipo_documento` | VARCHAR(100) | Tipo de archivo (`REGISTRO_CIVIL`, `FOTO`, `RECUENTOS_VACUNAS`, etc.). |
| `url` | TEXT | Enlace al archivo subido en el servidor. |
| `estado` | `estado_documento` | Estado del documento (`PENDIENTE`, `VALIDADO`, `RECHAZADO`). |
| `estado_renovacion` | VARCHAR(50) | Estado de renovación en reingreso (`VIGENTE`, `RENOVAR`). |
| `fecha` | TIMESTAMPTZ | Fecha de carga del archivo. |

---

## 7. Conexiones con Otros Módulos

- **→ Estructura Escolar**: Consulta los grupos con cupos disponibles (`cupos_totales - matrículas activas`) para la asignación de curso.
- **→ Estudiantes y Estados**: La oficialización activa al estudiante y registra los motivos de retiro (`motivo_estado`).
- **→ Soporte y Tickets**: Los tickets de tipo `REINGRESO` se enlazan con la consola de Reingreso, transicionando a `EN_PROCESO` de forma irreversible y notificando al padre.
- **→ Notificaciones**: Envía emails automáticos de confirmación, subsanación y notificación de reingreso al acudiente.

---

## 8. Validaciones Implementadas

### Backend
- **Elegibilidad de Reingreso**: Bloqueo estricto para estudiantes con estado `EXPULSADO` o `GRADUADO`.
- **Transición Irreversible de Tickets**: Al pasar ticket de reingreso a `EN_PROCESO`, impide regresar a `ABIERTO`.
- **Cálculo de Cupos en Tiempo Real**: Verificación de cupos disponibles en el grupo asignado.
- **Validación de Texto y Formatos**: Limpieza y regex para nombres, documentos y correos electrónicos.

### Frontend
- **Configuración de Destino Dinámica**: Carga reactiva de niveles, grados y salones filtrados por colegio y año lectivo.
- **Mantenimiento del Estado PENDIENTE_RENOVACION al Corregir Docs**: Preserva el estado de la matrícula de renovación durante la subsanación por el acudiente.
- **Desactivación de Controles en Aulas Sin Cupos**: Deshabilita la opción de selección para salones con cupos agotados.

