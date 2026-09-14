# Módulo 10: Notificaciones, Soporte, Seguridad y Auditoría

Este documento detalla el diagnóstico, la resolución de la redundancia de tablas de mensajería, la depuración de esquemas heredados, el endurecimiento de integridad referencial y las políticas de auditoría en **AcademiaNeiva**.

---

## 1. Alcance y Tablas del Módulo

1. `notificacion_colegio`: Mensajería interna institucional y notificaciones multi-inquilino (docentes, estudiantes, directivos y padres).
2. `notificaciones_push`: Suscripciones del navegador y dispositivos móviles (Web Push API / VAPID).
3. `auditoria_supervision`: Registro inmutable de acciones críticas (cambios de notas fuera de fecha, aprobaciones, accesos y modificaciones administrativas).
4. `password_reset_tokens`: Tokens criptográficos temporales para recuperación de contraseñas.
5. `tickets_soporte`: Mesa de ayuda y soporte técnico para usuarios de la plataforma.
6. `tipo_documento`: Catálogo maestro de identificación legal (Cédula de Ciudadanía, Tarjeta de Identidad, Registro Civil, etc.).

---

## 2. Diagnóstico Arquitectónico: El Problema de las 3 Tablas de Notificaciones

### 2.1. Hallazgo Inicial
Durante la inspección de la base de datos se encontraron tres tablas dedicadas a notificaciones:
- `notificaciones` (7 columnas, **0 registros**).
- `notificacion_colegio` (10 columnas, en producción con soporte multitenant).
- `notificaciones_push` (suscripciones de tokens Web Push para el Service Worker).

### 2.2. Por qué existía `notificaciones` y por qué fue eliminada
1. **Origen**: `notificaciones` fue creada en la fase temprana del software como una tabla genérica mono-colegio.
2. **Deficiencia relacional**: Carecía de `id_colegio`, impidiendo el aislamiento de datos entre colegios, y no admitía la segmentación de audiencias (`destinatario_tipo`: `DOCENTES`, `ESTUDIANTES`, `ACUDIENTES`, `GRUPO_ESPECIFICO`).
3. **Evolución**: El equipo de desarrollo introdujo posteriormente `notificacion_colegio` con arquitectura multitenant completa, pero dejó la tabla `notificaciones` como residuo técnico inerte en la base de datos.
4. **Decisión**: Se **eliminó definitivamente** la tabla `notificaciones` (`DROP TABLE notificaciones;`). Toda la mensajería interna ahora está unificada en `notificacion_colegio`, complementada por `notificaciones_push` para los Service Workers.

---

## 3. Endurecimiento de Seguridad e Integridad Referencial

### 3.1. Claves Foráneas Faltantes a `usuario(id_usuario)`
Tres tablas críticas operaban con identificadores numéricos planos sin restricción de clave foránea formal:
- `password_reset_tokens.id_usuario`: Riesgo de tokens emitidos para usuarios inexistentes o no purgados al borrar cuentas.
- `auditoria_supervision.id_usuario`: Riesgo de eventos de auditoría no atribuibles.
- `tickets_soporte.id_usuario`: Solicitudes huérfanas de mesa de ayuda.

Se aplicaron las restricciones formales:
```sql
ALTER TABLE password_reset_tokens
  ADD CONSTRAINT fk_pwd_reset_usuario 
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE;

ALTER TABLE auditoria_supervision
  ADD CONSTRAINT fk_auditoria_usuario 
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE SET NULL;

ALTER TABLE tickets_soporte
  ADD CONSTRAINT fk_tickets_usuario 
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE;
```

### 3.2. Unicidad del Catálogo de Documentos (`tipo_documento`)
- **Problema**: La columna `tipo` admitía duplicados por falta de restricción única.
- **Solución**: `ALTER TABLE tipo_documento ADD CONSTRAINT uq_tipo_documento_tipo UNIQUE (tipo);`.

### 3.3. Optimización de Índices de Notificaciones y Seguridad
- **Bandeja de notificaciones**: La consulta de notificaciones no leídas por usuario en su colegio requería un índice compuesto de alta selectividad:
  ```sql
  CREATE INDEX idx_notif_colegio_destinatario 
    ON notificacion_colegio (id_colegio, destinatario_tipo, id_destinatario, leida);
  ```
- **Validación de tokens de contraseña**:
  ```sql
  CREATE INDEX idx_pwd_reset_token ON password_reset_tokens (token);
  CREATE INDEX idx_pwd_reset_user_expires ON password_reset_tokens (id_usuario, expires_at);
  ```
- **Línea de tiempo de auditoría**:
  ```sql
  CREATE INDEX idx_auditoria_usuario_fecha ON auditoria_supervision (id_usuario, fecha_hora DESC);
  ```

---

## 4. Resumen de Índices y Reglas del Módulo

| Objeto / Regla | Tipo | Propósito |
| :--- | :--- | :--- |
| `uq_tipo_documento_tipo` | `UNIQUE CONSTRAINT` | Impide duplicidad en tipos de documento legal ('CC', 'TI', etc.). |
| `fk_pwd_reset_usuario` | `FOREIGN KEY (ON DELETE CASCADE)` | Vincula los tokens de reseteo a cuentas reales y los purga si se elimina la cuenta. |
| `fk_auditoria_usuario` | `FOREIGN KEY (ON DELETE SET NULL)` | Mantiene el evento de auditoría histórico aun si el usuario es desactivado. |
| `idx_notif_colegio_destinatario` | `INDEX compuesto` | Acelera la campana de notificaciones y filtrado de mensajes no leídos. |
| `idx_pwd_reset_token` | `INDEX` | Búsqueda instantánea de tokens al restablecer contraseñas desde el correo. |
