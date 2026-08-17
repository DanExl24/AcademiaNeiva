# AUDITORÍA ARQUITECTÓNICA Y UX/UI SENIOR — FRONTEND ACADEMIANEIVA

**Fecha:** 14 de Agosto de 2026  
**Proyecto:** AcademiaNeiva (Frontend)  
**Tecnologías:** Vue 3 (Composition API / `<script setup>`), TypeScript, Vite, TailwindCSS, Pinia, Vue Router 4, Lucide Icons  
**Rol del Auditor:** Arquitecto UI/UX Senior especializado en Sistemas Administrativos y Plataformas Académicas  

---

## 1. RESUMEN EJECUTIVO Y DIAGNÓSTICO GLOBAL

El frontend de **AcademiaNeiva** presenta una cobertura funcional integral para los 5 roles clave del ecosistema escolar (Directivo, Docente, Estudiante, Padre de Familia y Administrador General). No obstante, a nivel de ingeniería de software, arquitectura de componentes y experiencia de usuario (UX/UI), el sistema exhibe un alto nivel de fragmentación y deuda técnica:

1. **Vistas Monolíticas Extensas ("God Components")**: Existen más de 12 vistas troncales que superan las 1.000 líneas de código (e.g. `EnrollmentManagement.vue` con 2.267 líneas, `DbaReportsView.vue` con 1.947 líneas, `TeacherGrades.vue` con 1.743 líneas, `SupportView.vue` con 1.580 líneas). Estas vistas aglutinan tablas, modales, llamadas a la API, lógica matemática de promedios, generación de PDFs y estilos en un único archivo sin descomposición modular.
2. **Ausencia de un Sistema de Diseño y Componentes Base**: La carpeta `src/components/` contiene únicamente 7 componentes. Elementos transversales como modales, tablas, botones, formularios, drawers, badges, inputs y estados de carga se encuentran duplicados y reescritos directamente en cada vista.
3. **Contaminación de Paleta Semántica en TailwindCSS**: En `tailwind.config.js`, las clases de color semántico `emerald` e `indigo` fueron vinculadas a la misma variable CSS dinámica (`var(--color-primary)`), eliminando la distinción entre estados de éxito (verde) y el color de marca institucional.
4. **Degradación de UX por Diálogos Nativos Bloqueantes**: Se detectaron **más de 166 ocurrencias de `alert()` y `confirm()`** en lugar de modales de confirmación accesibles o toasts no intrusivos.
5. **Brechas de Responsive y Accesibilidad**: El layout carece de un drawer/menú colapsable adaptado para dispositivos móviles, las tablas complejas carecen de scroll horizontal responsivo estructurado y los botones con solo iconos no incluyen etiquetas accesibles (`aria-label`).

---

## 2. INVENTARIO COMPLETO DE RUTAS Y VISTAS

| Módulo / Rol | Ruta | Vista / Archivo | Propósito UX |
| :--- | :--- | :--- | :--- |
| **Público** | `/` | `src/views/public/LandingView.vue` | Presentación institucional y acceso al portal |
| **Público** | `/matricula` | `src/views/public/EnrollmentView.vue` | Formulario de pre-matrícula pública |
| **Público** | `/matricula/seguimiento` | `src/views/public/MatriculaTrackingView.vue` | Consulta de estado de solicitud por token |
| **Público** | `/matricula/corregir/:id` | `src/views/public/EnrollmentCorrection.vue` | Subsanación de documentos rechazados |
| **Público / Shared**| `/soporte` | `src/views/shared/SupportView.vue` | Creación pública y seguimiento de tickets |
| **Auth** | `/login` | `src/views/auth/LoginView.vue` | Inicio de sesión multi-rol |
| **Auth** | `/select-school` | `src/views/auth/SelectSchoolView.vue` | Selección de sede/institución activa |
| **Auth** | `/forgot-password` | `src/views/auth/ForgotPasswordView.vue` | Solicitud de restablecimiento de contraseña |
| **Auth** | `/reset-password/:token`| `src/views/auth/ResetPasswordView.vue` | Cambio seguro de contraseña con token |
| **Layout Base**| `/dashboard` | `src/layouts/DashboardLayout.vue` | Shell global, navegación lateral y header |
| **Shared** | `/dashboard` | `src/views/shared/DashboardHomeDispatcher.vue` | Enrutador automático según rol activo |
| **Shared** | `/dashboard/directorio` | `src/views/shared/DirectoryView.vue` | Directorio institucional de contactos |
| **Shared** | `/dashboard/mi-cuenta` | `src/views/shared/ProfileView.vue` | Perfil, avatar, contraseña y preferencias |
| **Shared** | `/dashboard/soporte` | `src/views/shared/SupportView.vue` | Mesa de ayuda y escalamiento |
| **Directivo** | `/dashboard/mi-colegio` | `src/views/admin/MySchool.vue` | Identidad institucional y paleta dinámica |
| **Directivo** | `/dashboard/gestion-matriculas` | `src/views/admin/EnrollmentManagement.vue` | Auditoría, aprobación y corrección de matrículas |
| **Directivo** | `/dashboard/gestion-matriculas/:id` | `src/views/admin/EnrollmentDetails.vue` | Ficha de matrícula y visor de adjuntos |
| **Directivo** | `/dashboard/gestion-matriculas/:id/registro` | `src/views/admin/FinalRegistration.vue` | Asignación de código y formalización |
| **Directivo** | `/dashboard/gestion-reingresos` | `src/views/admin/ReingresoManagement.vue` | Reincorporación de estudiantes antiguos |
| **Directivo** | `/dashboard/gestion-traslados` | `src/views/admin/TrasladoManagement.vue` | Solicitud y recepción de traslados inter-colegio |
| **Directivo** | `/dashboard/gestion-grados` | `src/views/admin/GradeManagement.vue` | Estructura de niveles, grados y secciones |
| **Directivo** | `/dashboard/gestion-materias` | `src/views/admin/SubjectManagement.vue` | Asignaturas, áreas y asignación académica |
| **Directivo** | `/dashboard/docentes` | `src/views/admin/TeacherManagement.vue` | Planta docente, contratos y asignación |
| **Directivo** | `/dashboard/gestion-estudiantes` | `src/views/admin/StudentManagement.vue` | Expedientes, traslados internos y sanciones |
| **Directivo** | `/dashboard/padres-familia` | `src/views/admin/ParentManagement.vue` | Acudientes y vinculación familiar |
| **Directivo** | `/dashboard/configuracion-academica` | `src/views/admin/AcademicSettings.vue` | Hub de ajustes curriculares |
| **Directivo** | `.../gestion-aprobados` | `src/views/admin/AcademicTrackingView.vue` | Promoción y seguimiento de reprobados |
| **Directivo** | `.../inscripciones` | `src/views/admin/AcademicEnrollmentDatesView.vue` | Ventanas de fechas para inscripciones |
| **Directivo** | `.../competencias` | `src/views/admin/AcademicCompetenciesView.vue` | Banco de competencias y vinculación DBA |
| **Directivo** | `.../cierres` | `src/views/admin/PeriodClosure.vue` | Cierre institucional de periodos y actas |
| **Directivo** | `.../escalas` | `src/views/admin/AcademicScalesView.vue` | Escala de valoración institucional (SIEE) |
| **Directivo** | `.../periodos` | `src/views/admin/AcademicPeriodsView.vue` | Periodos académicos y porcentajes anuales |
| **Directivo** | `.../reportes-dba` | `src/views/admin/DbaReportsView.vue` | Coherencia y cobertura curricular DBA |
| **Directivo** | `/dashboard/boletines` | `src/views/admin/BoletinGenerator.vue` | Generación masiva y descarga de boletines |
| **Directivo** | `/dashboard/supervisiones` | `src/views/admin/SupervisionManagement.vue` | Auditoría de accesos externos y revocación |
| **Docente** | `/dashboard/mis-cursos` | `src/views/teacher/TeacherCourses.vue` | Carga académica asignada |
| **Docente** | `/dashboard/calificaciones` | `src/views/teacher/TeacherGrades.vue` | Planilla de notas, actividades y criterios |
| **Docente** | `/dashboard/asistencia` | `src/views/teacher/TeacherAttendance.vue` | Control diario de asistencia y novedades |
| **Docente** | `/dashboard/observador` | `src/views/teacher/TeacherObservations.vue` | Bitácora disciplinaria y formativa |
| **Docente** | `/dashboard/cierre-periodo` | `src/views/teacher/TeacherClosure.vue` | Consolidación y cierre de asignaturas |
| **Estudiante** | `/dashboard/mis-notas` | `src/views/student/StudentGradesView.vue` | Promedios y calificaciones por periodo |
| **Estudiante** | `/dashboard/mis-notas/:mat/:per` | `src/views/student/SubjectDetailsView.vue` | Desglose de actividades y evidencias |
| **Estudiante** | `/dashboard/mi-asistencia` | `src/views/student/StudentAttendanceView.vue` | Historial de fallas y justificaciones |
| **Estudiante** | `/dashboard/mi-observacion` | `src/views/student/StudentObservationsView.vue` | Observador del estudiante |
| **Estudiante** | `/dashboard/mi-boletin` | `src/views/student/StudentBoletinView.vue` | Descarga y visualización de boletines |
| **Padre** | `/dashboard/hijos` | `src/views/parent/ParentDashboard.vue` | Selector de hijo y vista general |
| **Padre** | `/dashboard/notas-hijos` | `src/views/parent/ParentGradesView.vue` | Calificaciones de los acudidos |
| **Padre** | `/dashboard/boletines-hijos` | `src/views/parent/ParentBoletinView.vue` | Boletines académicos de los hijos |
| **Padre** | `/dashboard/asistencia-hijos` | `src/views/parent/ParentAttendanceView.vue` | Asistencia de los hijos |
| **Padre** | `/dashboard/observaciones-hijos`| `src/views/parent/ParentObservationsView.vue` | Novedades del observador de los hijos |
| **Padre** | `/dashboard/matricula-hijos` | `src/views/parent/ParentEnrollmentView.vue` | Documentación y estado de matrícula |
| **Admin General** | `/dashboard/colegios` | `src/views/adminGeneral/ColegiosList.vue` | Gestión de instituciones y suscripciones |
| **Admin General** | `/dashboard/usuarios` | `src/views/adminGeneral/UsuariosList.vue` | Administración global de identidades y accesos |
| **Admin General** | `.../supervision/solicitudes` | `src/views/adminGeneral/SupervisionSolicitudes.vue` | Peticiones de supervisión |
| **Admin General** | `.../supervision/activas` | `src/views/adminGeneral/SupervisionActivas.vue` | Monitor de sesiones de supervisión en curso |
| **Admin General** | `.../supervision/historial` | `src/views/adminGeneral/SupervisionHistorial.vue` | Bitácora de accesos anteriores |
| **Admin General** | `.../auditorias/:tipo` | `src/views/adminGeneral/AuditoriasList.vue` | Logs de lecturas, cambios y exportaciones |
| **Admin General** | `.../notificaciones` | `src/views/adminGeneral/NotificacionesList.vue` | Alertas globales del sistema |
| **Admin General** | `.../configuracion` | `src/views/adminGeneral/ConfiguracionPanel.vue` | Parámetros globales y backups |
| **Admin General** | `.../catalogo-dba` | `src/views/adminGeneral/DbaGlobalView.vue` | Estándares curriculares nacionales DBA |
| **Admin General** | `.../gestion-traslados` | `src/views/admin/AdminTrasladosView.vue` | Matriz central de traslados entre colegios |

---

## 3. INVENTARIO DE COMPONENTES (EXISTENTES VS FALTANTES)

### Componentes Existentes en `src/components/`
1. `HelloWorld.vue`: Boilerplate no utilizado. **(A eliminar)**
2. `NoAcademicRecordsBanner.vue`: Banner de advertencia de falta de periodos.
3. `NotificationToast.vue`: Renderizador flotante de notificaciones Pinia.
4. `PeriodCountdownBanner.vue`: Temporizador de cierre de periodo.
5. `boletines/BoletinPreview.vue`: Renderizador visual del boletín oficial.
6. `boletines/BoletinExportModule.vue`: Módulo de exportación PDF.
7. `traslados/DatosAcademicosTrasladoModal.vue`: Modal de notas para traslados.

### Componentes Faltantes del Sistema de Diseño
- **Primitivas UI**: `BaseButton`, `BaseInput`, `BaseSelect`, `BaseTextarea`, `BaseBadge`, `BaseCard`.
- **Diálogos & Modales**: `BaseModal`, `BaseDrawer`, `ConfirmModal` (reemplazo de `confirm()`).
- **Tablas & Datos**: `DataTable` (con contenedor scroll y columnas sticky), `StatCard`, `PageHeader`.
- **Feedback & UX**: `EmptyState`, `SkeletonTable`, `SkeletonCard`, `BaseSpinner`, `AppBreadcrumb`.

---

## 4. ANÁLISIS DE CONSISTENCIA VISUAL, ACCESIBILIDAD Y RESPONSIVIDAD

### 4.1 Consistencia Visual y Sistema de Diseño
- **Colores en `tailwind.config.js`**:
  Al configurar `emerald` con `var(--color-primary)`, los badges de estado exitoso (como "Aprobado", "Matriculado", "Activo") pierden su color verde funcional y adoptan el color primario del colegio. Esto genera confusión cognitiva grave (el usuario no puede distinguir a simple vista si un badge denota éxito o branding).
- **Clases Arbitrarias y Tipografía**:
  Uso de clases no estándar o inventadas (`text-slate-350`, `text-slate-650`, `shadow-rose-250`, `via-red-650`). El tamaño de fuente varía erráticamente: en algunas tablas se usa `text-[10px]`, en otras `text-xs`, en otras `text-sm`.
- **Bordes y Sombras**:
  Los radios de borde oscilan entre `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` y `rounded-[32px]` sin una jerarquía clara por nivel de componente.

### 4.2 UX, Navegación y Flujo de Interacción
- **Ausencia de Drawer Móvil en `DashboardLayout.vue`**:
  En resoluciones `< 768px`, el sidebar `aside` permanece fijo con `w-64` o `w-20`, sin soporte para menú hamburguesa ni overlay deslizable, inutilizando el espacio de trabajo en celulares y tablets.
- **Feedback Bloqueante (`alert()` y `confirm()`)**:
  Interrupciones abruptas del navegador en operaciones críticas (como calificar, guardar asistencia, revocar supervisión o matricular) que rompen la continuidad visual y no guardan coherencia con la identidad de la plataforma.
- **Falta de Debounce en Búsquedas**:
  Vistas como `StudentManagement.vue`, `TeacherGrades.vue` y `EnrollmentManagement.vue` ejecutan filtrados en caliente en cada pulsación sin debounce, provocando lag en listas grandes.

### 4.3 Accesibilidad (a11y)
- Botones de acción basados únicamente en iconos (`<Eye />`, `<Trash2 />`, `<Edit2 />`) carecen de `aria-label` o `title` accesible para lectores de pantalla.
- Los modales custom no implementan atrapamiento de foco (`focus trap`) ni retornan el foco al elemento disparador al cerrarse.
- Contrastes reducidos en temas oscuros al usar combinaciones de `text-slate-400` sobre `bg-slate-900` en textos de tamaño inferior a 12px.

---

## 5. AUDITORÍA CLASIFICADA DE PROBLEMAS

### CLASIFICACIÓN: CRÍTICO

#### [C-01] Destrucción de la paleta semántica de estado (Éxito vs Branding)
- **Archivo**: `src/tailwind.config.js` (Líneas 26-37)
- **Componente**: Configuración global de TailwindCSS
- **Problema**: El objeto `emerald` fue sobrescrito completamente para usar `var(--color-primary)` (el mismo valor que `indigo`). Esto provoca que badges, alertas, botones de éxito y estados "APROBADO" / "MATRICULADO" se pinten de color púrpura/azul institucional en vez de verde esmeralda.
- **Impacto UX/UI**: Quiebre grave de la semántica de la interfaz. Los usuarios pierden el feedback visual intuitivo de éxito/aprobación, incrementando la carga cognitiva y el riesgo de error al revisar estados.
- **Recomendación**: Restaurar la paleta nativa de `emerald` / `green` en Tailwind y definir tokens dedicados (`brand-primary`, `brand-secondary`) para la personalización institucional.
- **Prioridad**: CRÍTICO
- **Esfuerzo Estimado**: 1 hora

#### [C-02] Bloqueo de UI con diálogos nativos `alert()` y `confirm()`
- **Archivo**: Más de 25 archivos (`TeacherGrades.vue`, `TeacherAttendance.vue`, `SupportView.vue`, `UsuariosList.vue`, `EnrollmentManagement.vue`, etc.)
- **Componente**: Flujo de feedback global en todas las vistas
- **Problema**: Se encontraron **166 llamadas a `alert()` y `confirm()`**. Estas llamadas congelan el hilo de ejecución de JavaScript, no se pueden estilar, no respetan el tema oscuro, no son accesibles y degradan la percepción de calidad del producto.
- **Impacto UX/UI**: Experiencia de usuario arcaica y frustrante. En móviles, los diálogos nativos bloquean la pantalla completa y confunden al usuario.
- **Recomendación**: Crear un composable `useConfirm()` respaldado por un componente `ConfirmModal.vue`, e integrar los mensajes informativos al `NotificationToast.vue` vía `useNotificationStore`.
- **Prioridad**: CRÍTICO
- **Esfuerzo Estimado**: 6 horas

#### [C-03] Inoperabilidad del Dashboard en Dispositivos Móviles
- **Archivo**: `src/layouts/DashboardLayout.vue` (Líneas 688-782)
- **Componente**: `DashboardLayout` (Sidebar y Header)
- **Problema**: El sidebar lateral es un elemento estático de 256px (`w-64`) o 80px (`w-20`) que no se oculta en pantallas pequeñas (`< 768px`). No existe botón de menú hamburguesa ni backdrop deslizable (off-canvas drawer).
- **Impacto UX/UI**: En smartphones y tablets, el sidebar ocupa más del 60% del ancho visible, aplastando el contenido principal y haciendo inusable la aplicación en campo.
- **Recomendación**: Implementar comportamiento `hidden md:flex` para el sidebar fijo, agregar botón hamburguesa en el navbar y montar un drawer deslizable con backdrop para móviles.
- **Prioridad**: CRÍTICO
- **Esfuerzo Estimado**: 4 horas

---

### CLASIFICACIÓN: ALTO

#### [A-01] Vistas Monolíticas Gigantes ("God Views") sin Modularización
- **Archivos**:
  - `src/views/admin/EnrollmentManagement.vue` (2.267 líneas, 140 KB)
  - `src/views/admin/DbaReportsView.vue` (1.947 líneas, 98 KB)
  - `src/views/teacher/TeacherGrades.vue` (1.743 líneas, 88 KB)
  - `src/views/shared/SupportView.vue` (1.580 líneas, 84 KB)
  - `src/views/admin/StudentManagement.vue` (1.366 líneas, 78 KB)
  - `src/views/admin/AcademicCompetenciesView.vue` (1.290 líneas, 80 KB)
- **Componente**: Vistas troncales de administración y docencia
- **Problema**: Cada vista contiene en un solo archivo: tablas, 4 a 6 modales embebidos, lógica de cálculo de promedios, llamadas API directas con axios, conversores a PDF y estilos inline.
- **Impacto UX/UI**: Rendimiento deficiente (re-renders masivos del DOM ante cualquier cambio de input), parpadeos en interfaz, lentitud de scroll en planillas de notas y extrema fragilidad ante cambios.
- **Recomendación**: Descomponer cada vista en subcomponentes (`GradesTable`, `ActivityModal`, `CriterionModal`, `EnrollmentReviewDrawer`, `StudentSanctionModal`, etc.) y composables especializados de lógica (`useGrades`, `useEnrollmentReview`).
- **Prioridad**: ALTO
- **Esfuerzo Estimado**: 16 horas

#### [A-02] Sobrecarga Frágil de Modo Solo Lectura mediante CSS Global
- **Archivo**: `src/layouts/DashboardLayout.vue` (Líneas 1050-1076)
- **Componente**: Estilos globales `.supervision-readonly-mode`
- **Problema**: El modo "Solo Lectura" en supervisiones deshabilita controles mediante selectores CSS agresivos que buscan clases de Tailwind específicas (`button.bg-indigo-600`, `button.bg-red-600`, `td.text-right button`, `pointer-events: none !important`).
- **Impacto UX/UI**: Si un botón cambia de color o diseño en cualquier vista, el modo solo lectura deja de protegerlo o, por el contrario, bloquea botones de navegación y lectura legítimos (como cerrar modales o cambiar de pestaña). No hay indicación accesible (`aria-disabled`) para el usuario.
- **Recomendación**: Centralizar el estado de solo lectura en un composable/provide `usePermissions()` o directiva `v-permission`, aplicando `disabled` semántico y tooltips explicativos ("Acción no permitida en modo solo lectura").
- **Prioridad**: ALTO
- **Esfuerzo Estimado**: 5 horas

#### [A-03] Falta de Contenedores con Desplazamiento Responsivo en Tablas Complejas
- **Archivos**: `TeacherGrades.vue`, `TeacherAttendance.vue`, `DbaReportsView.vue`, `GradeManagement.vue`
- **Componente**: Planillas y matrices de datos
- **Problema**: Las tablas con más de 8 columnas o matrices de notas dinámicas provocan desbordamiento horizontal que deforma la estructura del layout general o corta los botones de acción en pantallas estándar (laptops de 1366x768 o tablets).
- **Impacto UX/UI**: Pérdida de contexto del estudiante/fila al desplazarse, columnas de notas no visibles y botones de acción inaccesibles sin zoom-out.
- **Recomendación**: Implementar un componente `DataTable.vue` con contenedor `overflow-x-auto`, columnas fijas (`sticky left-0` para el nombre del estudiante y `sticky right-0` para la nota final/acciones) y sombreado de scroll.
- **Prioridad**: ALTO
- **Esfuerzo Estimado**: 6 horas

---

### CLASIFICACIÓN: MEDIO

#### [M-01] Duplicación y Falta de Sincronización en el Sistema de Notificaciones / Toasts
- **Archivos**: `src/layouts/DashboardLayout.vue` vs `src/components/NotificationToast.vue`
- **Componente**: Sistema de Toasts
- **Problema**: `DashboardLayout` implementa un array local de toasts (`toasts.value` en la esquina inferior derecha) mientras que `NotificationToast.vue` está montado en `App.vue` utilizando `useNotificationStore` (en la esquina superior derecha). Ambos sistemas coexisten y se superponen.
- **Impacto UX/UI**: Mensajes de notificación duplicados o desalineados en pantalla, desconexión en tiempos de expiración y estilos heterogéneos.
- **Recomendación**: Eliminar el array y renderizado manual de toasts en `DashboardLayout.vue`, unificando todos los avisos a través del store `useNotificationStore` y el componente `NotificationToast.vue`.
- **Prioridad**: MEDIO
- **Esfuerzo Estimado**: 2 horas

#### [M-02] Inconsistencia en Estados de Carga (Loading States)
- **Archivos**: Múltiples vistas (`StudentManagement.vue`, `TeacherAttendance.vue`, `ColegiosList.vue`, etc.)
- **Componente**: Feedback de carga asíncrona
- **Problema**: Coexisten 4 patrones distintos de loading: texto simple `"Cargando..."`, spinners de `Lucide` (`Loader2`), pantallas en blanco temporales y bloques opacos. No existen skeletons en las vistas principales.
- **Impacto UX/UI**: Sensación de lentitud, cambios bruscos de diseño (Cumulative Layout Shift - CLS) y desorientación del usuario durante la carga de datos.
- **Recomendación**: Crear componentes `SkeletonTable.vue`, `SkeletonCard.vue` y `BaseSpinner.vue` para estandarizar las transiciones de carga en toda la plataforma.
- **Prioridad**: MEDIO
- **Esfuerzo Estimado**: 4 horas

#### [M-03] Estados Vacíos (Empty States) Genéricos y Pobres
- **Archivos**: `StudentObservationsView.vue`, `ParentObservationsView.vue`, `NotificacionesList.vue`
- **Componente**: Vistas de consulta sin registros
- **Problema**: Cuando una lista no tiene registros, muchas vistas muestran una celda de tabla vacía, un contenedor en blanco o un texto plano sin orientación ni llamada a la acción.
- **Impacto UX/UI**: El usuario no sabe si la vista falló, si aún está cargando o si realmente no existen registros.
- **Recomendación**: Crear un componente `EmptyState.vue` con ilustración/icono contextual, título informativo, descripción explicativa y botón de acción sugerida (ej. "Crear primera observación" o "Actualizar").
- **Prioridad**: MEDIO
- **Esfuerzo Estimado**: 3 horas

#### [M-04] Jerarquía y Estilos de Botones Caóticos
- **Archivos**: Todas las vistas de administración y docencia
- **Componente**: Botones y disparadores de acción
- **Problema**: Se observan botones primarios con distintas alturas (`py-1.5`, `py-2`, `py-3`, `py-4`), diferentes sombras (`shadow-sm`, `shadow-lg`, `shadow-indigo-100`, `shadow-rose-250`), radios dispares (`rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-[32px]`) y pesos de fuente desalineados (`font-semibold`, `font-bold`, `font-black`).
- **Impacto UX/UI**: Falta de pulido visual y jerarquía difusa entre acciones principales, secundarias y destructivas.
- **Recomendación**: Implementar `BaseButton.vue` con variantes estrictas (`primary`, `secondary`, `danger`, `outline`, `ghost`) y tamaños normalizados (`sm`, `md`, `lg`).
- **Prioridad**: MEDIO
- **Esfuerzo Estimado**: 5 horas

---

### CLASIFICACIÓN: BAJO

#### [B-01] Uso de Clases de Tailwind Inexistentes / Tipos Arbitrarios
- **Archivos**: `src/layouts/DashboardLayout.vue`, `src/views/shared/DashboardHome.vue`
- **Componente**: Estilos utilitarios
- **Problema**: Presencia de clases inventadas como `text-slate-350`, `text-slate-650`, `via-red-650` o `shadow-rose-250` que no forman parte de la configuración ni de Tailwind estándar, generando estilos rotos o silenciosamente omitidos.
- **Impacto UX/UI**: Inconsistencias menores de color y sombra según el navegador.
- **Recomendación**: Limpiar las clases arbitrarias reemplazándolas por la escala estándar de Tailwind (`slate-300`, `slate-400`, `slate-600`, `slate-700`).
- **Prioridad**: BAJO
- **Esfuerzo Estimado**: 1.5 horas

#### [B-02] Archivos Muertos y No Utilizados en el Árbol de Fuentes
- **Archivos**:
  - `src/components/HelloWorld.vue`
  - `src/views/HomeView.vue`
- **Componente**: Módulos residuales de inicialización
- **Problema**: Archivos de ejemplo generados por el scaffolding inicial de Vite que no tienen ninguna referencia en el router ni en otros componentes.
- **Impacto UX/UI**: Ruido en el repositorio y confusión para el equipo de desarrollo.
- **Recomendación**: Eliminar los archivos huérfanos.
- **Prioridad**: BAJO
- **Esfuerzo Estimado**: 15 minutos

#### [B-03] Falta de Debounce en Inputs de Búsqueda
- **Archivos**: `EnrollmentManagement.vue`, `StudentManagement.vue`
- **Componente**: Filtros de búsqueda en listas
- **Problema**: El filtrado computado o peticiones de búsqueda se ejecutan síncronamente con cada pulsación de tecla (`input`), sin retardo de espera.
- **Impacto UX/UI**: Micro-bloqueos en el teclado cuando la tabla contiene cientos de estudiantes o matrículas.
- **Recomendación**: Aplicar un composable `useDebounce` (300ms) a todos los campos de búsqueda en tablas.
- **Prioridad**: BAJO
- **Esfuerzo Estimado**: 2 horas

---

### CLASIFICACIÓN: MEJORA

#### [MEJ-01] Implementación de Breadcrumbs Globales en Rutas Anidadas
- **Archivo**: `src/layouts/DashboardLayout.vue`
- **Componente**: Header de Navegación
- **Problema**: En vistas profundas (ej. `/dashboard/gestion-matriculas/:id/registro` o `/dashboard/mis-notas/:id_materia/:id_periodo`), el título del header solo muestra el nombre de la ruta actual sin ruta de migas de pan (breadcrumbs) para regresar fácilmente al nivel anterior.
- **Impacto UX/UI**: Pérdida de ubicación espacial del usuario en jerarquías profundas de navegación.
- **Recomendación**: Integrar un componente `AppBreadcrumb.vue` dinámico en el header del layout basado en `route.matched`.
- **Prioridad**: MEJORA
- **Esfuerzo Estimado**: 3 horas

#### [MEJ-02] Tooltips de Ayuda Contextual en Módulos Normativos (DBA / SIEE)
- **Archivos**: `AcademicCompetenciesView.vue`, `DbaReportsView.vue`, `TeacherGrades.vue`
- **Componente**: Formularios y tablas de asignación curricular
- **Problema**: Términos técnicos como "Evidencias DBA", "Competencia Transversal", "Escala Nacional MEN" o "Coherencia Curricular" no disponen de tooltips o infografías de ayuda para docentes o directivos nuevos.
- **Impacto UX/UI**: Curva de aprendizaje empinada para docentes y riesgo de mala parametrización de actividades de evaluación.
- **Recomendación**: Incorporar iconos de ayuda `<HelpCircle />` con tooltips accesibles y explicaciones concisas de los lineamientos del MEN.
- **Prioridad**: MEJORA
- **Esfuerzo Estimado**: 4 horas

---

## 6. PLAN DE REFACTORIZACIÓN ORDENADO POR IMPACTO

### Fase 1: Cimientos Críticos & Quick Wins (Inmediata)
- **Objetivo**: Corregir de inmediato las fallas de semántica visual, bloqueos de UI y problemas de visualización en smartphones.
1. **Corregir `tailwind.config.js`**: Restaurar la escala funcional verde de `emerald` y configurar `brand-primary` / `brand-secondary` para la identidad dinámica de cada colegio.
2. **Crear `ConfirmModal.vue` y composable `useConfirm`**: Reemplazar progresivamente los 166 `alert()` y `confirm()`.
3. **Añadir soporte móvil al `DashboardLayout.vue`**: Sidebar ocultable, botón hamburguesa en header y drawer con backdrop blur.
4. **Unificar sistema de notificaciones**: Eliminar el array de toasts inline en `DashboardLayout.vue` y canalizar todo por `useNotificationStore`.

### Fase 2: Construcción de la Biblioteca de Componentes Base (Design System)
- **Objetivo**: Proveer un conjunto de primitivas reutilizables y consistentes para evitar duplicación de código.
1. **Formularios & Botones**: `BaseButton`, `BaseInput`, `BaseSelect`, `BaseTextarea`, `BaseBadge`.
2. **Contenedores & Diálogos**: `BaseModal`, `BaseDrawer`, `BaseCard`, `PageHeader`.
3. **Tablas & Datos**: `DataTable` con soporte responsivo y scroll horizontal protegido.
4. **Feedback**: `EmptyState`, `SkeletonTable`, `SkeletonCard`.

### Fase 3: Descomposición y Modularización de Vistas Monolíticas
- **Objetivo**: Dividir los archivos de más de 1.000 líneas en componentes pequeños, desacoplados y testeables.
1. **Módulo Calificaciones Docente (`TeacherGrades.vue`)**:
   - `GradesCourseSelector.vue`
   - `GradesMatrixTable.vue`
   - `ActivityFormModal.vue`
   - `CriterionFormModal.vue`
   - `DbaEvidenceSelector.vue`
2. **Módulo Gestión de Matrículas (`EnrollmentManagement.vue`)**:
   - `EnrollmentStatsHeader.vue`
   - `EnrollmentTable.vue`
   - `EnrollmentReviewDrawer.vue` (con visor de documentos integrado)
   - `EnrollmentCorrectionModal.vue`
3. **Módulos Directivos y Reportes**:
   - Modularizar `DbaReportsView.vue`, `StudentManagement.vue`, `AcademicCompetenciesView.vue` y `SupportView.vue`.

### Fase 4: Accesibilidad, Experiencia de Navegación y Pulido Final
- **Objetivo**: Garantizar accesibilidad AA, navegación fluida y ayuda contextual.
1. **Accesibilidad (a11y)**: Etiquetas `aria-label` en botones con iconos, focus trap en modales y navegación por teclado.
2. **Navegación**: `AppBreadcrumb.vue` en el header del layout para rutas profundas.
3. **Rendimiento**: Integrar debounce de 300ms en todos los campos de búsqueda en vivo.
4. **Ayuda Contextual**: Tooltips en métricas y conceptos curriculares DBA / SIEE.

---

### Resumen de Esfuerzo Estimado por Fase

| Fase | Alcance Principal | Horas Estimadas |
| :--- | :--- | :--- |
| **Fase 1** | Quick Wins (Tailwind, Toasts, useConfirm, Sidebar móvil) | ~13.5 h |
| **Fase 2** | Design System Base (12 componentes primitivos) | ~18.0 h |
| **Fase 3** | Refactorización de Vistas Monolíticas (Top 6 vistas) | ~32.0 h |
| **Fase 4** | Accesibilidad, Breadcrumbs, Debounce y Polish | ~10.5 h |
| **TOTAL** | **Transformación Arquitectónica UI/UX Completa** | **~74.0 h** |
