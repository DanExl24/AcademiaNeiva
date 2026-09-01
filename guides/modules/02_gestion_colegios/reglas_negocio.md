# Reglas de Negocio — Gestión de Colegios

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Gestión de Colegios de AcademiaNeiva.

---

## Control de Actividad

### RN-COL-001: Impacto de Suspensión de Colegio en Usuarios
- **Descripción:** Cuando el estado de un colegio es modificado a `SUSPENDIDO` o `RECHAZADO` por el Administrador General, todos los usuarios con vinculación activa a dicho colegio a través de `usuario_colegio` ven inhabilitada su capacidad de operar en el contexto de esa institución.
- **Motivo:** Garantiza que las instituciones inhabilitadas administrativamente no puedan consumir recursos de servidor ni alterar datos hasta que su estado sea normalizado.
- **Módulos afectados:** Gestión de Colegios, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`cambiarEstadoColegio`)
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken` - valida que el colegio del usuario no esté inactivo)
- **Endpoints relacionados:** 
  - `PATCH /api/admin/colegios/:id/estado`
- **Historias de usuario relacionadas:** HU-COL-004

---

## Validaciones Curriculares e Identidad

### RN-COL-002: Unicidad del Código DANE
- **Descripción:** El código DANE ingresado durante la creación o edición del colegio debe ser único a nivel global en la base de datos de la plataforma.
- **Motivo:** El DANE es el identificador oficial de los establecimientos educativos colombianos ante el Ministerio de Educación Nacional, por lo que duplicados impedirían la correcta auditoría y georreferenciación.
- **Módulos afectados:** Gestión de Colegios.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`registrarColegio`, `actualizarColegio`)
- **Endpoints relacionados:** 
  - `POST /api/admin/colegios`
  - `PUT /api/admin/colegios/:id`
- **Historias de usuario relacionadas:** HU-COL-002, HU-COL-003

---

### RN-COL-003: Tipo de Calendario Escolar (Tipo A / Tipo B)
- **Descripción:** Cada colegio se debe registrar obligatoriamente bajo el Calendario Tipo A o Tipo B.
- **Motivo:** El tipo de calendario afecta la inicialización de los periodos y años lectivos (ej. Calendario A abarca un año natural como 2026, mientras que Calendario B cruza años como 2025-2026).
- **Módulos afectados:** Gestión de Colegios, Configuración Académica.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`registrarColegio`)
  - [schedulerService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/schedulerService.ts) (Lógica de asignación de fechas de periodos según calendario)
- **Endpoints relacionados:** 
  - `POST /api/admin/colegios`
- **Historias de usuario relacionadas:** HU-COL-002

---

### RN-COL-004: Personalización Dinámica de Branding
- **Descripción:** Los colores primario y secundario e imagen de escudo guardados en la tabla `colegio` se inyectan en la respuesta de inicio de sesión y el cargador de la UI. El frontend los aplica como variables CSS en el elemento raíz (`:root`).
- **Motivo:** Evita la recompilación o despliegue personalizado de la app para cada colegio, logrando branding multi-tenant dinámico con una única instancia del frontend.
- **Módulos afectados:** Gestión de Colegios, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateMySchoolIdentity`, `uploadMySchoolEscudo`)
  - [theme.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/stores/theme.ts) (Store de Pinia que aplica las variables CSS al DOM)
- **Endpoints relacionados:** 
  - `PUT /api/academic-admin/my-school/:schoolId/identidad`
  - `GET /api/auth/school-identity/:schoolId`
- **Historias de usuario relacionadas:** HU-COL-005

---

## Restricciones Administrativas

### RN-COL-005: Restricción de Eliminación Física de Colegio
- **Descripción:** Un colegio no puede ser eliminado del sistema si cuenta con registros históricos activos en tablas de años lectivos, periodos, matrículas de estudiantes o usuarios de personal.
- **Motivo:** Protege la integridad de los datos históricos y la trazabilidad requerida para auditorías del MEN. El Administrador General debe optar por la suspensión en lugar de la eliminación en caso de inactividad comercial.
- **Módulos afectados:** Gestión de Colegios.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`eliminarColegio`)
- **Endpoints relacionados:** 
  - `DELETE /api/admin/colegios/:id`
- **Historias de usuario relacionadas:** N/A

---

### RN-COL-006: Pre-procesamiento de Imágenes con IA y Persistencia Base64 Data URL
- **Descripción:** Las imágenes procesadas para eliminación de fondo con IA se pre-escalan dinámicamente en el cliente a una resolución máxima de 512x512 píxeles mediante un elemento Canvas HTML5 previo a la inferencia con ONNX WebAssembly. Una vez removido el fondo, la imagen resultante se convierte en un Data URL Base64 (`data:image/png;base64,...`) y se almacena directamente en la columna `colegio.escudo_url` (tipo `TEXT`).
- **Motivo:** Evita el desbordamiento de memoria RAM y el bloqueo del hilo de eventos del navegador al procesar imágenes de alta resolución (ej. 3000x3000px), reduce la carga computacional en un 97%, elimina la sobrecarga de CPU en el servidor backend VPS y garantiza la portabilidad de los escudos en base de datos sin depender del sistema de archivos local (`/uploads`).
- **Módulos afectados:** Gestión de Colegios.
- **Archivos donde se implementa:** 
  - [MySchool.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/MySchool.vue) (`prepareImageForAi`, `removeBackground`, `getShieldUrl`)
  - [DashboardLayout.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/layouts/DashboardLayout.vue) (`fetchSchoolIdentity`)
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`uploadMySchoolEscudo`, `updateMySchoolIdentity`)
  - [app.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/app.ts) (`express.json({ limit: '10mb' })`)
- **Endpoints relacionados:** 
  - `PUT /api/academic-admin/my-school/:schoolId/identidad`
  - `POST /api/academic-admin/my-school/:schoolId/identidad/upload-escudo`
- **Historias de usuario relacionadas:** HU-COL-005, HU-COL-006

