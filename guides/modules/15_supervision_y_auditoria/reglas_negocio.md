# Reglas de Negocio — Supervisión y Auditoría

Este documento detalla las reglas de negocio técnicas y funcionales del módulo de Supervisión y Auditoría de AcademiaNeiva.

---

## Flujo de Aprobación y Control de Acceso

### RN-SUP-001: Flujo de Aprobación con Re-Autenticación Obligatoria
- **Descripción:** El Administrador General no puede acceder de manera directa a los datos de una institución. Toda sesión de supervisión exige una solicitud explícita previa en estado `SOLICITADA` y la aprobación del Rector o Coordinador del plantel mediante la re-autenticación con su contraseña de usuario en vivo.
- **Motivo:** Garantiza que la supervisión externa respete la autonomía del colegio y evita accesos no autorizados mediante la firma explícita de rectoría.
- **Módulos afectados:** Supervisión y Auditoría, Autenticación y Sesiones.
- **Archivos donde se implementa:** 
  - [adminGeneralController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/adminGeneralController.ts) (`solicitarSupervision`, `aprobarSupervision`)
- **Endpoints relacionados:** 
  - `POST /api/admin/supervision/solicitar`
  - `POST /api/admin/supervision/:id/aprobar`
- **Historias de usuario relacionadas:** HU-SUP-001, HU-SUP-002

---

### RN-SUP-002: Modos de Permiso (`SOLO_LECTURA` vs `EDITOR`)
- **Descripción:** Los privilegios del Administrador General durante la sesión están estrictamente regulados según el modo aprobado:
  - `SOLO_LECTURA`: El middleware `verifyToken` bloquea cualquier petición de tipo `POST`, `PUT`, `PATCH` o `DELETE`, respondiendo con error `403 Forbidden`.
  - `EDITOR`: Permite la modificación de registros pero exige de forma obligatoria adjuntar el parámetro `motivo_cambio` en el cuerpo de cada petición de escritura.
- **Motivo:** Delimita el impacto del Administrador General según la naturaleza técnica de la inspección.
- **Módulos afectados:** Supervisión y Auditoría (Todos los módulos).
- **Archivos donde se implementa:** 
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (Lógica de verificación de modo de supervisión en `verifyToken`)
- **Endpoints relacionados:** Todos los endpoints protegidos.
- **Historias de usuario relacionadas:** HU-SUP-003

---

### RN-SUP-003: Expiración Automática de Sesión y Revocación
- **Descripción:** Cada supervisión posee una marca `duracion_maxima_minutos`. El planificador en segundo plano (`schedulerService.ts`) y el middleware verifican la validez temporal. Al superarse la duración:
  - El estado de la sesión transiciona a `EXPIRADA` y se registra la `fecha_salida`.
  - Se remueven los privilegios del token JWT y el Administrador General es cerrado de la sesión del colegio.
  - Se notifica a los directivos del plantel por email y sistema especificando la duración total y la cantidad de acciones registradas.
- **Motivo:** Impide que las sesiones de supervisión queden abiertas indefinidamente por descuido del usuario.
- **Módulos afectados:** Supervisión y Auditoría, Configuración Académica.
- **Archivos donde se implementa:** 
  - [schedulerService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/schedulerService.ts) (`expireSupervisions`)
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (`verifyToken`)
- **Endpoints relacionados:** N/A (Proceso en background)
- **Historias de usuario relacionadas:** HU-SUP-003, HU-SUP-004

---

## Inmutabilidad de Auditoría

### RN-SUP-004: Inmutabilidad de Bitácoras de Auditoría (Triggers SQL)
- **Descripción:** Las tablas de auditoría `auditoria_supervision` y `auditoria_acciones_realizadas` están protegidas por triggers de base de datos (`proteger_acciones_auditoria` y `proteger_auditoria_finalizada`). Cualquier sentencia SQL que ejecute un `DELETE` o intente modificar una sesión finalizada será abortada inmediatamente por PostgreSQL.
- **Motivo:** Garantiza la inalterabilidad legal de las bitácoras para auditorías de entes de control externos (Ministerio de Educación, Secretarías de Educación).
- **Módulos afectados:** Supervisión y Auditoría.
- **Archivos donde se implementa:** 
  - [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) (Triggers `proteger_acciones_auditoria` y `proteger_auditoria_finalizada`)
  - [tablasAuditoria.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/Auditorias/tablasAuditoria.sql)
- **Endpoints relacionados:** N/A (Capa de persistencia SQL)
- **Historias de usuario relacionadas:** HU-SUP-005, HU-SUP-008

---

### RN-SUP-005: Captura Comparativa en Formato JSONB
- **Descripción:** En acciones de tipo `MODIFICACION` realizadas durante una supervisión, el middleware de auditoría debe capturar el registro original antes del cambio (`valor_antiguo`) y el registro modificado (`valor_nuevo`) y almacenarlos en formato JSONB de PostgreSQL junto con el `motivo_cambio`.
- **Motivo:** Permite reconstruir con precisión milimétrica qué campos fueron modificados y revertir cambios si ocurriesen errores.
- **Módulos afectados:** Supervisión y Auditoría.
- **Archivos donde se implementa:** 
  - [authMiddleware.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/middleware/authMiddleware.ts) (Lógica de intercepción de respuestas JSON y captura de estado previo)
- **Endpoints relacionados:** Todos los endpoints de actualización del sistema (`PUT`, `PATCH`, `POST`).
- **Historias de usuario relacionadas:** HU-SUP-005
