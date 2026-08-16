# 🐞 Registro Oficial de Defectos y Bugs — QA / Testing E2E (AcademiaNeiva)

Este documento centraliza todos los defectos funcionales (**Tipo D: Bug Real**) detectados durante la ejecución de las pruebas E2E automatizadas con Playwright.

> **Regla de QA**: No se realiza ninguna corrección en el código del sistema durante la fase de análisis y testeo. Cada defecto se documenta en esta bitácora con evidencias completas para su resolución en la fase posterior de estabilización.

---

## 📊 Resumen de Defectos por Módulo

| Módulo | Total Defectos | Críticos (P0) | Importantes (P1) | Secundarios (P2) | Estado |
|---|---|---|---|---|---|
| 01. Autenticación y Sesiones | 0 | 0 | 0 | 0 | ✅ Validado (15/15 PASS) |
| 02. Gestión de Colegios | 0 | 0 | 0 | 0 | ✅ Validado (8/8 PASS) |
| 03. Usuarios y Directivos | 2 | 1 | 1 | 0 | 🔍 2 Defectos Registrados (9/9 PASS con control QA) |
| 04. Estructura Escolar | 0 | 0 | 0 | 0 | Pendiente |
| 05. Docentes | 0 | 0 | 0 | 0 | Pendiente |
| 06. Matrículas e Inscripciones | 0 | 0 | 0 | 0 | Pendiente |
| 07. Estudiantes y Estados | 0 | 0 | 0 | 0 | Pendiente |
| 08. Configuración Académica | 0 | 0 | 0 | 0 | Pendiente |
| 09. Competencias y Sincronización | 0 | 0 | 0 | 0 | Pendiente |
| 10. Catálogo DBA | 0 | 0 | 0 | 0 | Pendiente |
| 11. Calificaciones y Actividades | 0 | 0 | 0 | 0 | Pendiente |
| 12. Observaciones del Estudiante | 0 | 0 | 0 | 0 | Pendiente |
| 13. Asistencia Escolar | 0 | 0 | 0 | 0 | Pendiente |
| 14. Cierre y Boletines | 0 | 0 | 0 | 0 | Pendiente |
| 15. Supervisión y Auditoría | 0 | 0 | 0 | 0 | Pendiente |
| 16. Soporte y Tickets | 0 | 0 | 0 | 0 | Pendiente |
| 17. Gestión de Padres | 0 | 0 | 0 | 0 | Pendiente |
| 18. Gestión de Traslados | 0 | 0 | 0 | 0 | Pendiente |
| 19. Seguimiento y Promoción | 0 | 0 | 0 | 0 | Pendiente |
| 20. Seguimiento Académico Directivo | 0 | 0 | 0 | 0 | Pendiente |
| 21. Flujo de Correos y OTP | 0 | 0 | 0 | 0 | Pendiente |

---

## 📋 Plantilla de Registro de Incidencia (Fase 10)

```markdown
### BUG-[MOD]-[NUM]: [Título breve del error]
- **Módulo**: [Nombre del Módulo]
- **Funcionalidad**: [Acción probada]
- **Rol**: [ADMIN / DIRECTIVO / DOCENTE / ESTUDIANTE / PADRE]
- **Prioridad**: [P0 - Crítica / P1 - Importante / P2 - Secundaria]
- **Precondición**: [Estado inicial de la base de datos o sesión]
- **Pasos para reproducir**:
  1. Paso 1
  2. Paso 2
  3. Paso 3
- **Resultado Esperado**: [Comportamiento según HU / Regla de Negocio]
- **Resultado Obtenido**: [Error en UI / Código HTTP 500 / Fallo de validación]
- **URL / Endpoint**: `[URL / Endpoint]`
- **Request Payload**:
  ```json
  {}
  ```
- **Response Payload**:
  ```json
  {}
  ```
- **Evidencia**: `reports/test-results/...` (Trace / Screenshot / Log)
- **Regla de Negocio / HU Asociada**: [RN-XXX-000 / HU-XXX-000]
```

---

## 🗂️ Registro Detallado de Bugs Detectados

### BUG-USR-001: Contraseña temporal no se visualiza en el modal de restablecimiento (UI)
- **Módulo**: 03. Usuarios y Directivos
- **Funcionalidad**: Restablecimiento de contraseña de usuario por Admin General
- **Rol**: ADMIN GENERAL
- **Prioridad**: P1 - Importante
- **Precondición**: Usuario existente en el sistema.
- **Pasos para reproducir**:
  1. Iniciar sesión como `admin_general`.
  2. Navegar a `/dashboard/usuarios`.
  3. Localizar a un usuario y pulsar en la acción de llave *"Restablecer Contraseña"*.
  4. Confirmar el diálogo nativo del navegador.
  5. Observar el modal con título *"Contraseña Restablecida"*.
- **Resultado Esperado**: El modal debe mostrar en el recuadro la contraseña temporal generada por el backend.
- **Resultado Obtenido**: El recuadro de la contraseña temporal aparece en blanco. En el frontend (`UsuariosList.vue:402`), se accede a `res.data.tempPassword`, pero el backend (`adminGeneralController.ts:601`) retorna la propiedad con clave `password_temporal`.
- **URL / Endpoint**: `POST /api/admin/usuarios/:id/restablecer-password`
- **Response Payload**:
  ```json
  {
    "message": "Contraseña restablecida exitosamente",
    "password_temporal": "aB3$kL9p",
    "must_change_password": true
  }
  ```
- **Evidencia**: `playwright/tests/03_usuarios_y_directivos/usuarios-crud.spec.ts` (`TC-USR-004-01`).
- **Regla de Negocio / HU Asociada**: `HU-DIR-004` (Gestión de credenciales y seguridad).

---

### BUG-USR-002: Error SQL 42703 (HTTP 500) al crear usuario directivo o docente directamente desde el panel
- **Módulo**: 03. Usuarios y Directivos
- **Funcionalidad**: Creación directa de directivos/docentes desde `/dashboard/usuarios`
- **Rol**: ADMIN GENERAL
- **Prioridad**: P0 - Crítica
- **Precondición**: Admin General autenticado en la plataforma.
- **Pasos para reproducir**:
  1. Ingresar a `/dashboard/usuarios`.
  2. Hacer clic en *"Nuevo Usuario"*.
  3. Seleccionar Rol `directivo` (o `docente`), elegir una Institución Educativa y completar nombre, apellido, email, contraseña y documento válido.
  4. Pulsar en *"Confirmar y Crear Usuario"*.
- **Resultado Esperado**: El backend crea el registro en `usuario` y vincula al colegio en `usuario_colegio` / `directivo`, retornando HTTP 201 y cerrando el modal.
- **Resultado Obtenido**: El servidor responde con **HTTP 500** `{"error":"Error interno del servidor al crear usuario."}`. En los logs del servidor se evidencia `error: column "id_colegio" of relation "usuario" does not exist` al ejecutar la consulta SQL cruda `INSERT INTO usuario (..., id_colegio, ...)`.
- **URL / Endpoint**: `POST /api/admin/usuarios`
- **Evidencia en Logs**: `backend/src/controllers/adminGeneralController.ts:2870`
- **Regla de Negocio / HU Asociada**: `HU-DIR-006` / `RN-DIR-006` (Creación de directivos y docentes sin matrícula).
