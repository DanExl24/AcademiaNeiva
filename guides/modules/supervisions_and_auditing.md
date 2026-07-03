# 🕵️ Auditoría y Modo Supervisión del Administrador General

Este módulo detalla las reglas de seguridad, el flujo de aprobación y las políticas de inmutabilidad del **Modo Supervisión** del Administrador General y la auditoría de acciones por los directivos en **AcademiaNeiva**.

---

## 🔒 Flujo de Aprobación de la Supervisión

El Administrador General puede ingresar a auditar la información de un colegio heredando temporalmente el rol de **Rector** bajo un estricto flujo de control de acceso:

```
[Admin General] -- Solicita Supervisión --> [Directivos del Colegio]
                                                     │
[Supervisión Activa] <-- Autoriza Re-autenticación ──┘
```

1. **Solicitud de Supervisión**:
   - El Administrador General selecciona el colegio y envía una solicitud.
   - Debe registrar obligatoriamente el **motivo** y la **fecha de solicitud**.
   - El tipo de supervisión puede ser: `SOLO_LECTURA` o `EDITOR`.
2. **Aprobación de Directivos**:
   - Un directivo del colegio (Rector o Coordinador) debe revisar y autorizar la solicitud.
   - **Re-autenticación obligatoria**: Antes de aprobar, el directivo debe ingresar nuevamente su contraseña para verificar su identidad.
   - Al aprobar, el sistema registra qué directivo autorizó el acceso, la fecha/hora exacta y la duración máxima permitida (minutos).

---

## 🛡️ Políticas y Control de Acceso durante la Sesión

### 1. Duración Límite de la Sesión
- Cada sesión de supervisión tiene un tiempo máximo autorizado.
- Un servicio programador (`schedulerService.ts`) corre en el backend monitoreando las sesiones activas. 
- Cuando el tiempo expira, la sesión del Administrador General se **cierra automáticamente** y se revocan los permisos de forma inmediata.

### 2. Notificaciones a Directivos
- Al iniciar la sesión de supervisión, el sistema envía una notificación a todos los directivos del colegio informando la entrada del Administrador General.
- Al cerrar la sesión (ya sea manualmente o por expiración de tiempo), se les notifica la salida.

### 3. Restricciones del Modo de Supervisión
- **`SOLO_LECTURA`**: El Administrador General solo puede visualizar calificaciones, datos e informes, denegando cualquier petición de escritura (POST, PUT, DELETE).
- **`EDITOR`**: Permite realizar modificaciones curriculares o correcciones. Toda modificación requiere ingresar obligatoriamente un **motivo del cambio**.

---

## 📝 Registro e Inmutabilidad de Auditorías

Todas las acciones que realice el Administrador General mientras hereda los permisos del rector se registran en la tabla `auditoria_acciones_realizadas`:

### Campos Obligatorios en Edición
Para cualquier acción que implique una modificación (POST, PUT, DELETE):
- **Valor anterior** (`valor_antiguo`): El estado del registro antes del cambio en formato JSON.
- **Valor nuevo`** (`valor_nuevo`): El nuevo estado del registro en formato JSON.
- **Motivo de modificación** (`motivo_cambio`): Explicación textual provista por el administrador.

### Auditoría de Exportaciones
- Cualquier exportación de datos (descarga de boletines PDF, reportes en formato CSV, etc.) se registra de manera independiente como una acción de auditoría crítica.

### Inmutabilidad de Logs
- Una vez finalizada la supervisión, **los registros de auditoría no pueden ser modificados ni eliminados** bajo ninguna circunstancia desde la aplicación.

---

## 🗄️ Estructura de Tablas en la Base de Datos

Definidas en [tablasAuditoria.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/Auditorias/tablasAuditoria.sql):

### `auditoria_supervision`
Almacena las sesiones de supervisión solicitadas y autorizadas:
- `id_auditoria`, `id_admin_general`, `id_colegio`, `id_directivo_aprobador`.
- `fecha_entrada`, `fecha_salida`, `motivo_auditoria`.
- `estado_auditoria` (ej. `PENDIENTE`, `ACTIVA`, `FINALIZADA`).
- `tipo_auditoria` (ej. `SOLO_LECTURA`, `EDITOR`).

### `auditoria_acciones_realizadas`
Almacena el log de acciones de la sesión:
- `id`, `id_auditoria`, `fecha_accion`, `modulo`, `accion`, `recurso_afectado`.
- `valor_antiguo` (JSONB), `valor_nuevo` (JSONB), `motivo_cambio` (TEXT).
