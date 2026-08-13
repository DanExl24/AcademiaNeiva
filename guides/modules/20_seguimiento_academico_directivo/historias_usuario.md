# 📖 Historias de Usuario — Módulo 20: Seguimiento Académico a Usuarios por Directivo

**Sistema:** Academia Neiva  
**Módulo:** Seguimiento Académico a Usuarios por Directivo  
**Última actualización:** 2026-08-12  

---

## 1. Historias de Usuario del Directivo (Rector / Coordinador)

### HU-SEG-001: Inspección del Panel del Docente
**Como** Directivo del colegio,  
**Quiero** ingresar al panel de un docente específico desde la Consola de Gestión de Docentes,  
**Para** supervisar sus asignaciones de materias, el estado del observador, el avance del registro de calificaciones y el control de asistencia diaria.

- **Criterios de Aceptación:**
  1. Debe existir el botón "Supervisar Panel / Asistir" en la tarjeta/drawer del docente.
  2. Si el docente no tiene cuenta activa (`id_usuario` nulo), el sistema debe alertar y prevenir la acción.
  3. Al confirmar, el sistema conmuta `activeRole` a `'docente'`, almacena `monitoringUser` y redirige a `/dashboard`.
  4. La interfaz debe indicar claramente que se encuentra en modo monitoreo en solo lectura.

---

### HU-SEG-002: Inspección del Portal del Estudiante
**Como** Directivo del colegio,  
**Quiero** acceder al portal de un estudiante desde la Consola de Gestión de Estudiantes,  
**Para** revisar sus calificaciones por periodo, asistencias, notas en observador del alumno y descargar su boletín oficial en tiempo real.

- **Criterios de Aceptación:**
  1. Debe existir el botón "Supervisar Panel" dentro del drawer de detalle del estudiante.
  2. Al activarlo, `activeRole` cambia automáticamente a `'estudiante'`.
  3. Todas las vistas del estudiante deben resolver el `userId` utilizando el `id_usuario` del estudiante supervisado.
  4. La cabecera y el avatar superior del sistema deben mostrar el nombre del estudiante monitoreado.

---

### HU-SEG-003: Inspección del Portal del Padre de Familia / Acudiente
**Como** Directivo del colegio,  
**Quiero** ingresar al portal de un padre de familia desde la Consola de Gestión de Padres,  
**Para** comprobar cómo visualiza el acudiente el estado de matrícula de su hijo, las notas familiares, el observador y los boletines.

- **Criterios de Aceptación:**
  1. Debe existir el botón "Supervisar Panel" en el drawer del acudiente.
  2. Si el acudiente no tiene cuenta o usuario activo, el sistema debe notificar la imposibilidad de supervisión.
  3. Al presionar el botón, el sistema conmuta `activeRole` a `'padre'`, preservando la sesión del directivo.
  4. La vista del portal de padres debe desplegar el saludo con el nombre del acudiente supervisado (ej. *"Bienvenido, Pedro Pérez, análisis familiar"*).

---

### HU-SEG-004: Restricción de Seguridad y Salida del Seguimiento
**Como** Directivo en modo seguimiento,  
**Quiero** tener un botón siempre visible para salir del monitoreo,  
**Para** finalizar la sesión de acompañamiento y retornar a mi Consola de Gestión Directiva con mi rol original.

- **Criterios de Aceptación:**
  1. En el banner ámbar superior del layout debe existir el botón "Salir del Seguimiento".
  2. Al hacer clic, `auth.stopMonitoring()` debe limpiar el estado de `monitoringUser` y restaurar `activeRole = 'directivo'`.
  3. El sistema debe redirigir inmediatamente a la Consola Directiva (`/dashboard`).
  4. Durante el seguimiento, la ruta de traslados (`/dashboard/gestion-traslados`) no debe estar accesible ni visible en el menú.
