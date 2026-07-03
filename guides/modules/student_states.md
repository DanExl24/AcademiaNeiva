# 🎓 Estados de Estudiantes y Matrículas

Este módulo detalla las reglas de negocio que rigen los estados de los estudiantes y sus matrículas en **AcademiaNeiva**, incluyendo sus implicaciones en la autenticación, acceso y reportes estadísticos.

---

## 🔀 Estados de Estudiante y Matrícula

Un estudiante cuenta con un estado personal de ciclo de vida (`estado` en la tabla `estudiante`), el cual se correlaciona con el estado de su matrícula académica del año (`estado` en la tabla `matricula`):

| Estado Estudiante | Estado Matrícula | Descripción | Acceso al Sistema |
| --- | --- | --- | --- |
| `ACTIVO` | `ACTIVA` | Estudiante regular cursando asignaturas. | **Permitido** |
| `SANCIONADO` | `ACTIVA` | Estudiante con proceso disciplinario. Conserva calificaciones pero muestra advertencia en el sistema. | **Permitido** |
| `RETIRADO` | `CANCELADA` | Estudiante desvinculado voluntariamente. Conserva el histórico de notas previas. | **Bloqueado** |
| `EXPULSADO` | `CANCELADA` | Estudiante desvinculado disciplinariamente. | **Bloqueado** |

---

## 🔐 Control de Acceso y Credenciales

El sistema de autenticación del backend valida estrictamente el estado del estudiante y de su usuario (`usuario.activo`):

### Estudiantes Expulsados y Retirados
- El script de semillas inhabilita el acceso del usuario (`activo = false`) para estudiantes en estado `EXPULSADO` o `RETIRADO`.
- Intentar iniciar sesión con el código de un estudiante expulsado o retirado resultará en una denegación inmediata del token de acceso (`401 Unauthorized`).
- El seeder omite la generación de credenciales en el reporte para estudiantes expulsados.

### Estudiantes Sancionados
- Pueden seguir ingresando al portal de estudiantes utilizando su código y contraseña habitual.
- Sus registros de asistencia y notas de periodos previos siguen siendo totalmente consultables por ellos y sus padres.

---

## 📈 Impacto en Boletines y Estadísticas

- **Boletín de Calificaciones**: 
  - Solo los estudiantes con matrícula `ACTIVA` (estados `ACTIVO` y `SANCIONADO`) entran en la generación regular de boletines escolares del periodo y del año lectivo.
  - Los estudiantes retirados y expulsados conservan su historial académico inalterable para auditorías de secretaría de educación, pero su matrícula figura como `CANCELADA` con la causa correspondiente (`motivo_cancelacion`: `RETIRO_VOLUNTARIO` o `EXPULSION`).
- **Dashboard Estadístico**:
  - Las estadísticas académicas de promedios de curso, estudiantes aprobados y reprobados omiten a los alumnos cuya matrícula se encuentre en estado `CANCELADA` para evitar sesgar las métricas del periodo activo.
