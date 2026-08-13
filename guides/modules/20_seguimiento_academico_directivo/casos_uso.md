# 📋 Casos de Uso — Módulo 20: Seguimiento Académico a Usuarios por Directivo

**Sistema:** Academia Neiva  
**Módulo:** Seguimiento Académico a Usuarios por Directivo  
**Última actualización:** 2026-08-12  

---

## CU-SEG-01: Iniciar Seguimiento de un Docente

### Descripción
Permite a un Directivo (Rector/Coordinador) asumir la vista de un docente para inspeccionar sus asignaciones académicas, notas cargadas y control de asistencia.

### Actores
- Directivo (Iniciador)
- Docente (Usuario Objetivo)

### Precondiciones
1. El Directivo está autenticado en la plataforma con el rol `directivo`.
2. El docente pertenece al mismo colegio del directivo y posee una cuenta de usuario activa.

### Flujo Principal
1. El Directivo navega a **Gestión de Docentes** (`/dashboard/docentes`).
2. El sistema despliega el listado de docentes institucionales.
3. El Directivo hace clic en el botón "Supervisar Panel / Asistir" de la tarjeta o drawer del docente.
4. El componente invoca `auth.startMonitoring(docenteObj)`.
5. `auth.ts` almacena `previousRole = 'directivo'`, asigna `monitoringUser = docenteObj`, `monitoringType = 'docente'` y cambia `activeRole = 'docente'`.
6. El sistema guarda el estado en `localStorage` y ejecuta `router.push('/dashboard')`.
7. `DashboardLayout.vue` detecta `auth.isMonitoring === true` y despliega el banner ámbar de monitoreo y el menú lateral de docente.
8. El Directivo visualiza el panel del docente en modo **Solo Lectura**.

### Flujos Alternativos
- **Docente sin usuario activo:** Si el docente no posee `id_usuario` registrado, el sistema muestra una alerta: *"Este docente no tiene un usuario activo registrado, no es posible monitorear su panel"* y aborta la acción.

---

## CU-SEG-02: Iniciar Seguimiento de un Estudiante

### Descripción
Permite a un Directivo ingresar al portal de un alumno para auditar calificaciones por periodo, faltas de asistencia, anotaciones del observador y boletines.

### Actores
- Directivo (Iniciador)
- Estudiante (Usuario Objetivo)

### Precondiciones
1. El Directivo está autenticado con rol `directivo`.
2. El estudiante está matriculado en el colegio y su registro incluye un `id_usuario`.

### Flujo Principal
1. El Directivo navega a **Gestión de Estudiantes** (`/dashboard/estudiantes`).
2. Abre la ficha/drawer de detalle del estudiante seleccionado.
3. Presiona el botón "Supervisar Panel".
4. El sistema invoca `auth.startStudentMonitoring(estudianteObj)`.
5. `auth.ts` asigna `monitoringType = 'estudiante'`, conmuta `activeRole = 'estudiante'` y redirige a `/dashboard`.
6. Las vistas del estudiante (`StudentDashboard.vue`, `StudentGradesView.vue`, etc.) resuelven el ID consultando `auth.monitoringUser.id`.
7. El Directivo navega por las asignaturas y calificaciones del alumno en modo solo lectura.

---

## CU-SEG-03: Iniciar Seguimiento de un Padre de Familia / Acudiente

### Descripción
Permite a un Directivo acceder al portal de acudientes para revisar las matrículas asociadas a los hijos del acudiente, boletines familiares y observaciones.

### Actores
- Directivo (Iniciador)
- Padre de Familia / Acudiente (Usuario Objetivo)

### Precondiciones
1. El Directivo está autenticado en la plataforma.
2. El acudiente está vinculado en `ParentManagement.vue` y posee `usuario_activo === true`.

### Flujo Principal
1. El Directivo navega a **Gestión de Padres de Familia** (`/dashboard/padres-familia`).
2. Abre el drawer de detalle del acudiente.
3. Presiona el botón "Supervisar Panel".
4. El sistema invoca `auth.startParentMonitoring(padreObj)`.
5. `auth.ts` conmuta `activeRole = 'padre'`, guarda `monitoringType = 'padre'` y redirige a `/dashboard`.
6. El saludo en `ParentDashboard.vue` muestra el nombre del acudiente (ej. *"Bienvenido, Pedro Pérez, análisis familiar"*).
7. Se despliega la información académica de sus acudidos en modo solo lectura.

---

## CU-SEG-04: Intento de Acceso a Rutas Restringidas durante el Seguimiento

### Descripción
El sistema bloquea activamente cualquier intento del Directivo de ingresar a la Gestión de Traslados mientras se encuentra en modo monitoreo.

### Actores
- Directivo (en seguimiento activo)

### Flujo Principal
1. El Directivo en modo monitoreo intenta ingresar manualmente a `/dashboard/gestion-traslados`.
2. El guard de navegación de Vue Router (`router/index.ts`) detecta `auth.isMonitoring === true`.
3. El guard cancela la navegación hacia traslados y redirige de forma transparente al usuario a `/dashboard`.
4. Adicionalmente, el menú lateral oculta automáticamente la opción de Traslados y `TrasladoManagement.vue` valida en `onMounted` reforzando la redirección.

---

## CU-SEG-05: Finalizar Sesión de Seguimiento

### Descripción
El Directivo concluye el monitoreo y regresa a su perfil y panel de administración institucional original.

### Actores
- Directivo (en seguimiento activo)

### Flujo Principal
1. El Directivo hace clic en el botón "Salir del Seguimiento" ubicado en el banner ámbar del topbar.
2. Se ejecuta la función `auth.stopMonitoring()`.
3. `auth.ts` limpia `monitoringUser` y `monitoringType` de la memoria y de `localStorage`.
4. Se restablece `activeRole = previousRole` (`'directivo'`).
5. El sistema ejecuta `router.push('/dashboard')`.
6. El layout remueve el banner de monitoreo y restablece la Consola de Gestión Directiva original.
