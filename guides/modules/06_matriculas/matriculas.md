# 📋 Módulo de Matrículas e Inscripciones

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Inscripciones y Matrículas de Estudiantes  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo gestiona el proceso de registro, validación y matrícula de nuevos estudiantes en los colegios de la plataforma. Proporciona una interfaz pública para que los aspirantes o padres de familia envíen solicitudes de matrícula adjuntando los documentos de soporte requeridos (registro civil, certificado de salud, etc.). Asimismo, ofrece una consola administrativa para que los directivos evalúen la documentación, notifiquen inconsistencias a subsanar, asignen grupos de forma manual o automática, y finalicen o cancelen el proceso de matrícula oficializando al estudiante en el sistema.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Público / Visitante** | Consulta de colegios, consulta de configuración de inscripciones, envío de solicitudes de matrícula, seguimiento de solicitudes mediante token UUID y corrección de documentos rechazados. |
| **Directivo** | Gestión completa del flujo de matrículas del colegio: listar solicitudes por estado, verificar documentos adjuntos, asignar grados y grupos, reportar inconsistencias, aprobar matrículas extraordinarias y de reingreso, y finalizar o cancelar matrículas. |

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
| Registrar reingreso de estudiante | `POST` | `/api/academic-admin/matriculas/reingreso` | Directivo |
| Aprobar reingreso | `POST` | `/api/academic-admin/matriculas/reingreso/:id/aprobar` | Directivo |
| Rechazar reingreso | `POST` | `/api/academic-admin/matriculas/reingreso/:id/rechazar` | Directivo |

---

## 4. Reglas de Negocio

- **RN-MAT-001 (Control de Fechas de Inscripción):** Las solicitudes de matrícula regular solo pueden enviarse si la fecha actual se encuentra dentro del rango configurado por el colegio (`fecha_inicio` y `fecha_cierre`) y las inscripciones están habilitadas en `configuracion_inscripcion`.
- **RN-MAT-002 (Bypass de Cupos en Extraordinaria):** Las matrículas extraordinarias permiten el registro de estudiantes incluso si las fechas de inscripción regular han expirado, bajo aprobación explícita de los directivos.
- **RN-MAT-003 (Token de Seguimiento Seguro):** Cada solicitud genera un token UUID único (`token_seguimiento`). El aspirante puede consultar el estado de su trámite e incluso subir correcciones de documentos a través de este token sin necesidad de autenticarse en el sistema.
- **RN-MAT-004 (Validación de Documentos por Item):** Los documentos adjuntos (registro civil, etc.) se validan individualmente. Si al menos uno es marcado como `RECHAZADO`, la matrícula pasa a estado `CORRECCION` y se bloquea la oficialización hasta que el solicitante resuelva la inconsistencia.
- **RN-MAT-005 (Oficialización y Creación de Estudiante):** Al presionar "Finalizar", el estado de la matrícula pasa a `ACTIVA` (o `APROBADA`), y el sistema inserta automáticamente el registro del estudiante en la tabla `estudiante`, generándole un código único y una cuenta de usuario para ingresar al portal.
- **RN-MAT-006 (Rate Limiting de Envío):** Límite de 20 solicitudes de envío de matrícula por IP cada 15 minutos para proteger el almacenamiento del servidor contra abusos de archivos cargados.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller** | [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) — `submitEnrollment`, `getPendingMatriculas`, `getMatriculaDetails`, `validateDocument`, `assignGrade`, `notifyInconsistencies`, `finalizeEnrollment`, `cancelEnrollment`, `toggleTransfer` |
| **Controller Admin (Extraordinario/Reingreso)** | [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — `createExtraordinaryEnrollment`, `approveExtraordinaryEnrollment`, `rejectExtraordinaryEnrollment`, `createReingresoEnrollment`, `approveReingresoEnrollment`, `rejectReingresoEnrollment` |
| **Service** | [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) — Operaciones de base de datos de matrículas y documentos |
| **Routes** | [matricula.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/matricula.routes.ts), [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts) |

### Frontend

| Tipo | Archivo |
|---|---|
| **Vista Pública de Envío** | [EnrollmentView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentView.vue) |
| **Vista Pública de Corrección** | [EnrollmentCorrection.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/EnrollmentCorrection.vue) |
| **Vista Pública de Seguimiento** | [MatriculaTrackingView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/MatriculaTrackingView.vue) |
| **Vista Gestión Directivo** | [EnrollmentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentManagement.vue), [EnrollmentDetails.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/EnrollmentDetails.vue), [FinalRegistration.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/FinalRegistration.vue) |

---

## 6. Modelo de Datos

### Tabla: `matricula`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_matricula` | SERIAL PK | Identificador interno único. |
| `id_estudiante` | INT FK | Referencia al estudiante oficializado (inicialmente NULL). |
| `id_nivel` | INT FK | Nivel escolar de inscripción. |
| `id_colegio` | INT FK | Colegio de destino. |
| `id_anio` | INT FK | Año lectivo de la matrícula. |
| `estado` | `estado_matricula` | `PENDIENTE`, `ACTIVA`, `CANCELADA`, `TRASLADADA`, `RECHAZADA`, `CORRECCION`, `APROBADA`, `CULMINADA`. |
| `correo_padre` | VARCHAR(100) | Correo de contacto para notificaciones y subsanaciones. |
| `token_seguimiento` | UUID | Token para el acceso público de consulta y edición. |
| `id_grupo` | INT FK | Grupo asignado al estudiante. |
| `motivo_cancelacion` | VARCHAR(100) | Motivo de retiro o cancelación de matrícula. |
| `es_traslado` | BOOLEAN | Indica si la matrícula proviene de un traslado de otra escuela. |
| `tipo` | VARCHAR(50) | Tipo de proceso (`REGULAR`, `EXTRAORDINARIA`, `REINGRESO`). |

### Tabla: `documento_matriculas`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_documento` | SERIAL PK | Identificador del archivo adjunto. |
| `id_matricula` | INT FK | Matrícula a la que pertenece el documento. |
| `tipo_documento` | VARCHAR(100) | Tipo de archivo (`REGISTRO_CIVIL`, `FOTO`, `RECUENTOS_VACUNAS`, etc.). |
| `url` | TEXT | Enlace al archivo subido en el servidor. |
| `estado` | `estado_documento` | Estado del documento (`PENDIENTE`, `VALIDADO`, `RECHAZADO`). |
| `fecha` | TIMESTAMPTZ | Fecha de carga del archivo. |

---

## 7. Conexiones con Otros Módulos

- **→ Estructura Escolar**: Consulta los grupos con cupos disponibles para la asignación de grado del aspirante.
- **→ Estudiantes y Estados**: La aprobación final inserta automáticamente un registro activo en `estudiante` y genera su respectivo `usuario`.
- **→ Notificaciones**: El sistema envía alertas de subsanación por correo al padre de familia si un documento es rechazado.

---

## 8. Validaciones Implementadas

### Backend
- Validación de que el tamaño de los archivos adjuntos no exceda el límite definido por Multer (típicamente 5MB).
- Aseguramiento de que no se puedan oficializar matrículas que posean documentos en estado `RECHAZADO`.
- Control estricto de cupos disponibles en el grupo asignado antes de confirmar la matrícula.

### Frontend
- Validación visual de la existencia de archivos obligatorios antes del envío del formulario.
- Desactivación de botones de acción administrativa basados en el estado actual de la matrícula.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Uso de Token UUID para Correcciones** | Permite a padres de familia subsanar errores en documentos sin necesidad de crearles una cuenta de usuario completa con roles y contraseñas. |
| **Separación de Matrícula y Estudiante** | Mantiene la base de datos de estudiantes "limpia" únicamente con los alumnos matriculados y oficializados, evitando registros basura de aspirantes que no completaron el proceso. |
| **Subida de Archivos Estática Local** | Almacena los archivos en un directorio local (`uploads/`) y los sirve estáticamente, reduciendo la dependencia de servicios en la nube para entornos institucionales internos. |
