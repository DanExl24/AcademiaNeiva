# 📜 Reglas de Negocio — Módulo 20: Seguimiento Académico a Usuarios por Directivo

**Sistema:** Academia Neiva  
**Módulo:** Seguimiento Académico a Usuarios por Directivo  
**Última actualización:** 2026-08-12  

---

## Reglas de Negocio Universales del Módulo

### RN-SEG-001: Exclusividad del Rol Directivo
Solo los usuarios autenticados con el rol primario `directivo` (Rector, Vicerrector o Coordinador) tienen la potestad de iniciar sesiones de seguimiento a otros usuarios del colegio. Ningún otro rol (`docente`, `estudiante`, `padre`) puede iniciar o delegar sesiones de monitoreo.

---

### RN-SEG-002: Inmutabilidad del Objeto de Autenticación (`auth.user`)
Al iniciar una sesión de seguimiento, la propiedad `auth.user` del estado de autenticación permanece estrictamente inalterada. Las credenciales, el ID del directivo y los tokens de sesión JWT no se modifican ni se intercambian. El seguimiento opera exclusivamente como una capa de suplantación de interfaz en cliente.

---

### RN-SEG-003: Preservación de Rol Previo y Conmutación de `activeRole`
1. Al invocar `startMonitoring`, `startStudentMonitoring` o `startParentMonitoring`, el sistema guarda el rol actual en `previousRole` y `localStorage.getItem('previousRole')`.
2. Asigna dinámicamente `activeRole` al rol correspondiente del objetivo (`'docente'`, `'estudiante'` o `'padre'`).
3. Al invocar `stopMonitoring()`, `activeRole` se restaura automáticamente a `previousRole` (`'directivo'`).

---

### RN-SEG-004: Lógica Obligatoria de Resolución Ternaria de IDs
Todas las vistas supervisables deben resolver el identificador de usuario (`userId` o `id_usuario`) mediante la expresión estandarizada:
```typescript
const userId = (auth.isMonitoring && auth.monitoringUser) 
  ? (auth.monitoringUser.id || (auth.monitoringUser as any).id_usuario) 
  : (auth.user?.id_usuario || auth.user?.id)
```
Queda estrictamente prohibido utilizar únicamente `auth.user.id` en consultas de vistas finales cuando `auth.isMonitoring` sea verdadero.

---

### RN-SEG-005: Deshabilitación de Acciones de Escritura (Modo Solo Lectura)
Durante el seguimiento activo (`auth.isMonitoring === true`):
1. **Calificaciones**: Se deshabilitan las acciones de crear actividades, ponderar logros y modificar notas en `TeacherGrades.vue`.
2. **Asistencia**: Se inhabilita la toma de asistencia diaria o la edición de fallas en `TeacherAttendance.vue`.
3. **Observador**: Se oculta la opción de registrar o eliminar anotaciones de convivencia en `TeacherObservations.vue`.
4. **Perfil**: Se bloquea la modificación de correo, teléfono, clave y solicitud de códigos en `ProfileView.vue`.
5. **Soporte**: Se deshabilita el formulario de creación de tickets en `SupportView.vue`.

---

### RN-SEG-006: Bloqueo Incondicional a Gestión de Traslados
Un directivo que se encuentre supervisando a un usuario **no puede acceder bajo ninguna circunstancia a la vista de Gestión de Traslados** (`/dashboard/gestion-traslados`).
- La opción queda excluida del menú lateral en `DashboardLayout.vue`.
- El guard de navegación global en `router/index.ts` intercepta cualquier intento de navegación directa y redirige a `/dashboard`.
- El componente `TrasladoManagement.vue` incluye una verificación al montarse que fuerza la redirección si `auth.isMonitoring` es verdadero.

---

### RN-SEG-007: Banner e Identidad Visual de Monitoreo
El layout principal (`DashboardLayout.vue`) desplegará de forma prominente:
1. Un banner ámbar superior fijo con el texto: `Modo Monitoreo — Supervisando a [Nombre] [Apellido] · Solo Lectura` y el botón `Salir del Seguimiento`.
2. El título del header principal mostrará: `Seguimiento: [Nombre] [Apellido]`.
3. La ficha de perfil y el círculo de avatar del topbar mostrarán las iniciales y el nombre del usuario monitoreado.

---

### RN-SEG-008: Persistencia del Estado en LocalStorage
Las variables reactivas `monitoringUser`, `monitoringType`, `previousRole` y `activeRole` deben sincronizarse en `localStorage`. Si el navegador es recargado (`F5` o actualización de pestaña), la sesión de seguimiento debe restaurarse de forma transparente sin perder el estado de monitoreo.

---

### RN-SEG-009: Verificación de Cuenta Activa Obligatoria
Antes de iniciar cualquier seguimiento, la interfaz debe validar que el registro de destino tenga un ID de usuario válido (`id_usuario !== null`) y una cuenta activa (`usuario_activo === true`). En caso contrario, la acción debe abortarse mostrando un mensaje de advertencia.

---

### RN-SEG-011: Aislamiento Estricto Multi-Colegio para Docentes Compartidos
Cuando un docente labora simultáneamente en múltiples instituciones (Colegio A y Colegio B):
1. La cuenta `usuario` posee un único `id_usuario`, pero existen registros independientes en la tabla `docente` para cada institución (`id_docente` A vs `id_docente` B).
2. Durante el seguimiento iniciado por el Directivo del Colegio A, toda consulta al backend (`getTeacherCourses`, `getTeacherDashboard`, etc.) incluye obligatoriamente el encabezado `x-school-id = schoolId_A`.
3. El backend filtra los datos agregando `.where("docente.id_colegio", "=", schoolId_A)` y `.where("detalle_grados.id_colegio", "=", schoolId_A)`.
4. El Directivo del Colegio A **únicamente puede visibilizar los cursos, estudiantes, materias y cargas académicas correspondientes a su institución**, quedando la información del Colegio B totalmente aislada e inaccesible.
