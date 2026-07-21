# Reglas de Negocio — Matrículas e Inscripciones

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Matrículas e Inscripciones de AcademiaNeiva.

---

## Control de Plazos y Fechas

### RN-MAT-001: Validación de Rango de Fechas Ordinarias
- **Descripción:** El envío de una solicitud de matrícula regular por la interfaz pública se bloqueará si la fecha actual está fuera del rango de fechas (`fecha_inicio` y `fecha_cierre`) configurado en `configuracion_inscripcion` para el año lectivo activo de la institución.
- **Motivo:** Regula el periodo oficial de admisiones del colegio e impide registros fuera de los plazos establecidos.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`submitEnrollment` - verificación de fecha actual en rango)
- **Endpoints relacionados:** 
  - `POST /api/matriculas/submit`
- **Historias de usuario relacionadas:** HU-MAT-001

---

### RN-MAT-002: Aprobación de Matrícula Extraordinaria (Bypass de Plazos)
- **Descripción:** Las solicitudes de tipo `EXTRAORDINARIA` omiten por completo la validación de rango de fechas de inscripción y permiten el registro extemporáneo, pero requieren la aprobación y firma digital de directivos.
- **Motivo:** Permite dar de alta a estudiantes que ingresan a mitad de año o por traslados excepcionales sin vulnerar la regla general.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`createExtraordinaryEnrollment`, `approveExtraordinaryEnrollment`)
- **Endpoints relacionados:** 
  - `POST /api/academic-admin/matriculas/extraordinaria`
  - `POST /api/academic-admin/matriculas/extraordinaria/:id/aprobar`
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
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`validateDocument`)
  - [matriculaService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/matriculaService.ts) (Validación en métodos de aprobación)
- **Endpoints relacionados:** 
  - `PATCH /api/matriculas/document/:idDocumento`
- **Historias de usuario relacionadas:** HU-MAT-003, HU-MAT-004

---

## Oficialización de Matrícula

### RN-MAT-005: Creación en Cascada de Alumno y Cuenta de Portal
- **Descripción:** Al finalizar la matrícula aprobada (`finalizeEnrollment`), el sistema realizará las siguientes acciones en una sola transacción:
  1. Cambia el estado de la matrícula a `ACTIVA`.
  2. Inserta los datos del estudiante en la tabla `estudiante` con estado `ACTIVO`.
  3. Inserta un nuevo registro de credencial en `usuario` con el rol `estudiante` y lo marca como activo.
- **Motivo:** Garantiza la consistencia en el alta de alumnos en el plantel escolar y habilita de forma instantánea el portal estudiantil para el alumno matriculado.
- **Módulos afectados:** Matrículas e Inscripciones, Estudiantes y Estados, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (`finalizeEnrollment`)
- **Endpoints relacionados:** 
  - `POST /api/matriculas/finalize/:id`
- **Historias de usuario relacionadas:** HU-MAT-006

---

### RN-MAT-006: Límite de Tamaño de Carga de Archivos
- **Descripción:** El sistema restringe la subida de archivos adjuntos de matrícula a un tamaño máximo de 5MB por archivo y a extensiones específicas de imagen o PDF.
- **Motivo:** Protege el espacio de almacenamiento del servidor Express frente a archivos excesivamente pesados que puedan degradar el rendimiento o denegar el servicio.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:** 
  - [multer.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/config/multer.ts) (Configuración de limits en Multer)
  - [matricula.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/matricula.routes.ts) (Middleware `upload.fields`)
- **Endpoints relacionados:** 
  - `POST /api/matriculas/submit`
  - `POST /api/matriculas/update-documents/:token`
- **Historias de usuario relacionadas:** HU-MAT-001, HU-MAT-003

---

### RN-MAT-007: Aislamiento por Inquilino (Multi-Tenant)
- **Descripción:** Los directivos escolares solo pueden visualizar, evaluar, asignar cupos y oficializar solicitudes de matrícula que pertenezcan a su mismo `id_colegio`.
- **Motivo:** Salvaguarda la privacidad y confidencialidad de la información de admisiones de cada plantel escolar en un entorno compartido.
- **Módulos afectados:** Matrículas e Inscripciones.
- **Archivos donde se implementa:** 
  - [matriculaController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/matriculaController.ts) (Validación de `colegioId` contra token de sesión)
- **Endpoints relacionados:** Todos los endpoints administrativos del módulo.
- **Historias de usuario relacionadas:** HU-MAT-004, HU-MAT-005, HU-MAT-006
