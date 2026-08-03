# Historias de Usuario — Gestión de Padres de Familia

Este documento contiene las historias de usuario implementadas para el módulo de Gestión de Padres de Familia (Acudientes) de AcademiaNeiva.

---

# HU-PAD-001: Consultar y Filtrar Lista de Padres de Familia

## Historia
**Como** directivo del colegio  
**Quiero** consultar el listado completo de padres de familia acudientes registrados en la institución  
**Para** realizar búsquedas rápidas, evaluar alertas de estudiantes y filtrar por grado, sección o estado de cuenta.

## Criterios de Aceptación
- Muestra tarjetas de resumen métrico con: Total Padres, Padres con Alertas Activas y Padres Docentes.
- Permite buscar por texto (nombre, apellido, documento o correo).
- Permite filtrar por Nivel Escolar, Grado, Sección, Jornada y Estado de Cuenta (`Activo` / `Inactivo`).
- Ofrece un filtro rápido `👨‍🏫 Padres Docentes` para listar únicamente a los acudientes que también pertenecen a la planta docente.
- Soporta paginación interactiva y reinicio de filtros a su estado inicial.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-PAD-001, RN-PAD-003, RN-PAD-005
- **Endpoints relacionados:** `GET /api/parents/school/:schoolId`
- **Componentes frontend relacionados:** [ParentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ParentManagement.vue)
- **Controllers/Services relacionados:** [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) (`getSchoolParents`)

---

# HU-PAD-002: Visualizar Ficha Detallada del Padre e Hijos Asociados

## Historia
**Como** directivo del colegio  
**Quiero** abrir el panel lateral de detalles de un padre de familia  
**Para** inspeccionar sus datos de contacto y la información académica y disciplinaria de todos sus estudiantes a cargo.

## Criterios de Aceptación
- Al seleccionar un acudiente, se despliega un cajón lateral (`Drawer`) sin perder la vista de la tabla.
- Presenta el nombre completo, documento, correo, teléfono y dirección del padre.
- Lista a todos los hijos vinculados en el colegio con su foto, grado, asistencia promedio, promedio académico acumulado y anotaciones del observador.
- Si el padre también es docente, muestra la insignia distintiva y su correo institucional docente.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-PAD-003, RN-PAD-005
- **Endpoints relacionados:** `GET /api/parents/:id/details`
- **Componentes frontend relacionados:** [ParentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ParentManagement.vue)
- **Controllers/Services relacionados:** [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) (`getParentDetails`)

---

# HU-PAD-003: Activar o Inactivar Cuenta de Padre de Familia

## Historia
**Como** directivo del colegio  
**Quiero** cambiar el estado de la cuenta de un acudiente entre `Activo` e `Inactivo`  
**Para** habilitar o revocar su acceso al portal institucional según la situación del estudiante.

## Criterios de Aceptación
- El directivo puede cambiar el estado desde la lista de acciones de la tabla o desde el modal de confirmación.
- Al inactivar a un padre, el backend actualiza de forma atómica su registro en `padre_familia`, deshabilita el usuario en `usuario` e inserta el timestamp actual en `logged_out_at`.
- La revocación de sesión es inmediata, impidiendo el ingreso o uso de tokens generados previamente.
- Muestra notificaciones tostadas de confirmación tras procesar el cambio.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-PAD-001, RN-PAD-002
- **Endpoints relacionados:** `PATCH /api/parents/:id/status`
- **Componentes frontend relacionados:** [ParentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ParentManagement.vue)
- **Controllers/Services relacionados:** [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) (`updateParentAccountStatus`)

---

# HU-PAD-004: Monitorear Portal del Padre (Modo Monitoreo / Espejo)

## Historia
**Como** directivo del colegio  
**Quiero** iniciar el seguimiento en modo espejo del portal de un acudiente  
**Para** auditar la información disponible y brindar asistencia remota a las familias.

## Criterios de Aceptación
- Al presionar el botón de monitoreo, se activa la sesión de monitoreo con tipo `'padre'`.
- La interfaz despliega la barra superior morada de aviso de monitoreo activo con el nombre del acudiente.
- El directivo puede navegar por las vistas del portal del padre (notas, asistencias, observador, boletines).
- El módulo de Soporte Técnico se deshabilita para prevenir la suplantación en tickets de soporte.
- El directivo puede finalizar el monitoreo en cualquier momento restableciendo su rol administrativo original.

## Detalles Técnicos
- **Prioridad:** Alta
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** RN-PAD-004
- **Endpoints relacionados:** Operación en cliente `authStore.startParentMonitoring`
- **Componentes frontend relacionados:** 
  - [ParentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ParentManagement.vue)
  - [auth.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/stores/auth.ts)
  - [DashboardLayout.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/layouts/DashboardLayout.vue)

---

# HU-PAD-005: Editar Datos de Contacto del Padre

## Historia
**Como** directivo del colegio  
**Quiero** modificar los datos de contacto de un acudiente (teléfono, dirección y correo)  
**Para** mantener actualizada la información de localización en la institución.

## Criterios de Aceptación
- Muestra un modal de edición con los campos de teléfono, dirección y correo electrónico pre-cargados.
- Valida la estructura del correo electrónico antes de enviar la solicitud.
- Actualiza los datos en la base de datos y refresca la vista inmediatamente.

## Detalles Técnicos
- **Prioridad:** Media
- **Roles involucrados:** Directivo
- **Reglas de negocio relacionadas:** N/A
- **Endpoints relacionados:** `PUT /api/parents/:id`
- **Componentes frontend relacionados:** [ParentManagement.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/ParentManagement.vue)
- **Controllers/Services relacionados:** [parentManagementController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/parentManagementController.ts) (`updateParentInfo`)
