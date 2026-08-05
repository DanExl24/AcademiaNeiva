# Historias de Usuario — Gestión de Colegios

Este documento contiene las historias de usuario implementadas para el módulo de Gestión de Colegios de AcademiaNeiva.

---

# HU-COL-001: Listar Colegios en el Sistema

## Historia
**Como** Administrador General  
**Quiero** ver una lista de todos los colegios registrados en la plataforma  
**Para** supervisar el estado de las instituciones y acceder a sus detalles.

## Criterios de Aceptación
- La lista debe mostrar el nombre, sede, código DANE, correo y estado actual (`PENDIENTE`, `ACTIVO`, `SUSPENDIDO`, `RECHAZADO`, `ELIMINADO`) de cada colegio.
- Permite filtrar los colegios por su estado de actividad.
- Permite realizar búsquedas por nombre o código DANE.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** 
  - `GET /api/admin/colegios`
- **Componentes frontend relacionados:** 
  - [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`listarColegios`)

---

# HU-COL-002: Registrar Nuevo Colegio

## Historia
**Como** Administrador General  
**Quiero** ingresar los datos de un colegio (nombre, sede, correo, teléfono, DANE, tipo de calendario)  
**Para** dar de alta una nueva institución educativa en la plataforma.

## Criterios de Aceptación
- Se deben rellenar obligatoriamente campos como nombre, código DANE, sede, correo de contacto y teléfono.
- El código DANE ingresado debe ser único en la plataforma.
- El correo electrónico del colegio debe tener formato válido.
- El colegio se crea inicialmente con estado `ACTIVO` o `PENDIENTE` según la configuración.
- El calendario debe seleccionarse entre Tipo A y Tipo B.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-COL-002, RN-COL-003
- **Endpoints relacionados:** 
  - `POST /api/admin/colegios`
- **Componentes frontend relacionados:** 
  - [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue) (Modal de registro)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`registrarColegio`)

---

# HU-COL-003: Modificar Información del Colegio

## Historia
**Como** Administrador General  
**Quiero** editar los datos básicos de un colegio  
**Para** corregir inconsistencias o actualizar la información de contacto de la institución.

## Criterios de Aceptación
- Permite modificar nombre, sede, contacto y correo del colegio.
- No permite duplicar un código DANE perteneciente a otro colegio.
- Al guardar los cambios, la información se actualiza instantáneamente en la base de datos.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-COL-002
- **Endpoints relacionados:** 
  - `PUT /api/admin/colegios/:id`
- **Componentes frontend relacionados:** 
  - [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue) (Formulario de edición)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`actualizarColegio`)

---

# HU-COL-004: Cambiar Estado del Colegio (Suspender / Activar)

## Historia
**Como** Administrador General  
**Quiero** cambiar el estado de un colegio a suspendido o activo  
**Para** regular el acceso de la institución a la plataforma según su situación administrativa.

## Criterios de Aceptación
- El Administrador General puede seleccionar un nuevo estado en el control correspondiente.
- Si el colegio es `SUSPENDIDO`, todos los usuarios vinculados a dicho colegio ven bloqueado su acceso al sistema (`verifyToken` retorna error de cuenta inactiva).
- Si el colegio es `ACTIVO`, se habilita nuevamente el ingreso de directivos y docentes.
- Se debe registrar el motivo y fecha del cambio de estado.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Administrador General
- **Reglas de negocio relacionadas:** RN-COL-001
- **Endpoints relacionados:** 
  - `PATCH /api/admin/colegios/:id/estado`
- **Componentes frontend relacionados:** 
  - [ColegiosList.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/adminGeneral/ColegiosList.vue)
- **Controllers/Services relacionados:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`cambiarEstadoColegio`)

---

# HU-COL-005: Personalizar Identidad Visual (Branding Directivo)

## Historia
**Como** directivo del colegio  
**Quiero** subir el escudo institucional y elegir los colores primario y secundario de la marca  
**Para** que la interfaz del portal de mi colegio refleje el branding de la institución.

## Criterios de Aceptación
- El directivo puede cargar un archivo de imagen para el escudo (limitado a formatos PNG/JPG/WEBP y un tamaño máximo de 2MB).
- El directivo puede seleccionar o ingresar códigos de color en formato hexadecimal para el color primario y secundario.
- Los colores guardados se aplican dinámicamente en el tema de estilos CSS del frontend mediante variables CSS en el arranque del dashboard.
- Permite restablecer los colores a los valores por defecto del sistema.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-COL-004
- **Endpoints relacionados:** 
  - `PUT /api/academic-admin/my-school/:schoolId/identidad`
  - `POST /api/academic-admin/my-school/:schoolId/identidad/upload-escudo`
  - `POST /api/academic-admin/my-school/:schoolId/identidad/reset`
- **Componentes frontend relacionados:** 
  - [MySchool.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/MySchool.vue)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateMySchoolIdentity`, `uploadMySchoolEscudo`, `resetMySchoolIdentity`)

---

# HU-COL-006: Eliminación de Fondo de Escudo mediante IA en Navegador

## Historia
**Como** directivo del colegio  
**Quiero** procesar la imagen del escudo cargada para remover su fondo automáticamente mediante inteligencia artificial  
**Para** obtener un logotipo transparente impecable que se adapte estéticamente a los temas oscuro, claro y boletines en PDF.

## Criterios de Aceptación
- La vista de "Mi Colegio" ofrece una opción interactiva "Quitar fondo con IA" al cargar o tener una imagen de escudo seleccionada.
- El proceso de IA se ejecuta 100% en el navegador utilizando WebAssembly (ONNX Runtime Web) sin enviar la imagen a APIs externas de pago o saturar el servidor.
- Para prevenir bloqueos en la interfaz del usuario (Event Loop), la imagen se re-dimensiona previamente en un Canvas HTML5 a un tamaño máximo de 512x512px.
- La ejecución utiliza el modelo ligero `small` y configura de forma segura el entorno mono-hilo (`numThreads = 1`).
- El resultado se previsualiza inmediatamente como un PNG con canal alfa transparente y se guarda como Data URL Base64 (`data:image/png;base64,...`) al actualizar la identidad del colegio.

## Detalles Técnicos
- **Prioridad:** Media / Innovación Visual
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-COL-004, RN-COL-006
- **Endpoints relacionados:** 
  - `PUT /api/academic-admin/my-school/:schoolId/identidad`
  - `POST /api/academic-admin/my-school/:schoolId/identidad/upload-escudo`
- **Componentes frontend relacionados:** 
  - [MySchool.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/MySchool.vue)
- **Librerías clave:** 
  - `@imgly/background-removal`
  - `ort-wasm` (ONNX Runtime WebAssembly)
- **Controllers/Services relacionados:** 
  - [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) (`updateMySchoolIdentity`, `uploadMySchoolEscudo`)

