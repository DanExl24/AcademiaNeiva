sn

# 📐 Arquitectura y Modelo de Datos - AcademiaNeiva

Este documento detalla la arquitectura de software, la jerarquía de roles de usuario y las tablas fundamentales de la base de datos relacional de **AcademiaNeiva**.

---

## 💻 Stack Tecnológico

El sistema utiliza una arquitectura cliente-servidor desacoplada:

```mermaid
graph TD
  Client[Vue 3 SPA - Vite/Tailwind] -- REST API / HTTPS --> Server[Express API - Node.js/TypeScript]
  Server -- pg-pool / SQL --> Database[(PostgreSQL Database)]
```

### Frontend

- **Framework**: Vue 3 (Composition API) con TypeScript.
- **Enrutamiento**: Vue Router.
- **Gestión de Estado**: Pinia (con stores especializados en notificaciones, autenticación, etc.).
- **Diseño y Estilos**: TailwindCSS y CSS nativo para vistas personalizadas premium.

### Backend

- **Entorno de Ejecución**: Node.js v18+ con TypeScript.
- **Framework Web**: Express.
- **Base de Datos**: PostgreSQL utilizando el driver nativo de agrupación de conexiones `pg` (pg-pool).

---

## 👤 Jerarquía de Roles y Autenticación

El portal cuenta con 5 roles de usuario principales definidos en la tabla `rol`:

1. **Administrador General (`admin_general`)**:
   - Administra colegios a nivel nacional/local (aprobar, suspender, rechazar).
   - Administra todas las cuentas de usuario registradas en el sistema global.
   - Solicita sesiones de supervisión a los colegios bajo aprobación explícita de sus directivos.
2. **Directivo (`directivo`)**:
   - Administra la planeación del colegio (períodos lectivos, escalas de evaluación, asignaciones docentes).
   - Administra los estudiantes, matrículas, profesores, y aprueba/rechaza las solicitudes de supervisión del Administrador General.
   - Cargos típicos: `RECTOR`, `COORDINADOR`.
3. **Docente (`docente`)**:
   - Registra actividades, calificaciones y asistencias de los cursos bajo su asignación académica (`detalle_grados`).
   - Define descripciones de evidencias y criterios evaluativos en periodos abiertos.
4. **Estudiante (`estudiante`)**:
   - Consulta sus calificaciones detalladas, fallas de asistencia, boletines y observaciones acumuladas en su dashboard personal.
   - Autenticación mediante código estudiantil (`codigo`).
5. **Padre de Familia (`padre`)**:
   - Supervisa a múltiples hijos (incluso en diferentes colegios).
   - Accede a boletines, notas y registros de inasistencias en tiempo real.

---

## 🗄️ Esquema de Base de Datos y Entidades

El diseño de datos está definido en [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql). A continuación se resumen las entidades críticas del sistema:

### Estructura Escolar e Instituciones

- `colegio`: Define las instituciones (nombre, dane, dominio, calendario 'A' o 'B', estado 'Activo'/'Suspendido').
- `año_lectivo`: Controla los calendarios académicos específicos de cada escuela (`calendario`, `id_colegio`).
- `periodo_academico`: Trimestres académicos (`trimestre`, `estado: ABIERTO/PENDIENTE/CERRADO`, `porcentaje`).
- `configuracion_colegio`: Configuración de límites evaluativos (`nota_minima`, `nota_maxima`, `nota_aprobacion`, `escala_modo`).

### Matrículas y Cursos

- `nivel_escolar` y `tipo_grado`: Jerarquía escolar (ej. PRIMARIA -> PRIMERO).
- `grupos` y `grados`: Cursos del año (ej. Primero A, Primero B).
- `materias`: Asignaturas del catálogo (ej. Matemáticas, Español).
- `detalle_grados`: Relación n-to-n que asigna materias, docentes y grupos.
- `matricula`: Vincula al estudiante con un grupo, año lectivo y estado de matrícula (`ACTIVA`/`CANCELADA`).

### Académico y Planeación Curricular

- `competencias`: Plan curricular. Posee la columna `sync_uuid` para coordinar la sincronización entre cursos paralelos.
- `evidencia_aprendizaje`: Evidencias pedagógicas asociadas a una competencia (pueden ser libres o enlazadas a un `id_evidencia_dba` oficial).
- `actividad_materia`: Evaluaciones del periodo creadas por los docentes. Posee el campo `fecha_creacion` (TIMESTAMPTZ).
- `criterio_evaluacion`: Distribución porcentual de notas dentro de una actividad académica.
- `notas_actividad` / `nota_criterio`: Notas individuales de los estudiantes.
- `resultado_academico`: Promedios oficiales del periodo calculados al cerrar la materia.
- `registro_asistencia`: Registros de fallas (`AUSENTE`, `PRESENTE`, `TARDE`, `JUSTIFICADA`).

---

## 🏛️ Modelo de Vinculación Multi-Colegio: `usuario_colegio` vs. Entidades de Rol

Para soportar docentes, estudiantes y directivos que pertenecen a más de una institución simultáneamente sin duplicar su identidad ni mezclar su información académica, el sistema implementa una separación limpia de responsabilidades:

```mermaid
graph TD
    U["usuario (Persona Global)"] --> UC1["usuario_colegio (Permisos Colegio 1)"]
    U --> UC2["usuario_colegio (Permisos Colegio 2)"]
    U --> D1["docente (Perfil Académico Colegio 1)"]
    U --> D2["docente (Perfil Académico Colegio 2)"]
    D1 --> DG1["detalle_grados (Carga Colegio 1)"]
    D2 --> DG2["detalle_grados (Carga Colegio 2)"]
```

### Fuentes de Verdad

1. **`usuario` (Identidad Global de la Persona)**:
   - **Propósito**: Guarda la identidad física única (Nombre, Apellido, Cédula, Email, Password Hash).
   - **`id_colegio`**: Es `NULLABLE` para permitir usuarios transversales y administradores globales.

2. **`usuario_colegio` (Fuente de Verdad Administrativa y de Autenticación)**:
   - **Propósito**: Define si una persona tiene acceso y autorización activa en una institución específica (`id_usuario`, `id_colegio`, `id_rol`, `estado`).
   - **Uso**: Controla el inicio de sesión, el menú selector de colegio en la barra superior (`x-school-id`), el middleware de seguridad y los traslados multi-institución.

3. **`docente` / `estudiante` (Fuente de Verdad Operativa y Académica)**:
   - **Propósito**: Representa la entidad operativa del rol dentro de un colegio concreto.
   - **Restricción Única**: `UNIQUE (id_usuario, id_colegio)` permite que la misma persona tenga un registro independiente en cada colegio donde labora o estudia.
   - **Uso**: Es la clave foránea (`id_docente` / `id_estudiante`) vinculada a cargas lectivas (`detalle_grados`), calificaciones (`resultado_academico`), asistencias (`registro_asistencia`) y cierres de materia (`cierre_materia`).

### Ventajas de esta Arquitectura
- **Aislamiento de Carga Lectiva**: Un docente puede tener el `id_docente: 12` en el Colegio A y el `id_docente: 15` en el Colegio B. Sus asignaciones, horarios y notas no se mezclan.
- **Trazabilidad e Historial**: Si una persona es inactivada en `usuario_colegio` para el Colegio A, pierde acceso al colegio en la plataforma, pero todo su historial de firmas, calificaciones y evidencias registradas en `docente` / `detalle_grados` para el Colegio A permanece **100% inalterado por auditoría**.

