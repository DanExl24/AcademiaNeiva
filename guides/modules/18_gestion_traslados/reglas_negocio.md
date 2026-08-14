# 📜 Reglas de Negocio — Módulo de Gestión de Traslados

**Sistema:** Academia Neiva  
**Módulo:** Gestión de Traslados (Interinstitucionales e Internos)  
**Última actualización:** 2026-08-14

---

## 1. Identidad Única y Multi-Vinculación

### RN-TRA-001: Arquitectura de Identidad Global
- Todo usuario del sistema posee un único registro identificador en la tabla global `usuario`.
- Las relaciones de un usuario con distintas instituciones educativas se almacenan en la tabla intermedia `usuario_colegio`.
- Un usuario solo puede tener **un vínculo en estado `ACTIVO`** por cada rol desempeñado dentro de un colegio en un momento dado.
- Al ejecutarse un traslado, el vínculo con el colegio origen cambia a `INACTIVO` asignando la fecha actual en `fecha_fin`, mientras que el vínculo con el colegio destino pasa a `ACTIVO` registrando `fecha_inicio`.

---

## 2. Flujo y Consenso de Aprobación

### RN-TRA-002: Consenso Tripartito de Aprobación
Para que una solicitud de traslado interinstitucional regular complete su ciclo y pase a ejecución, se requiere la aprobación explícita de **tres partes involucradas**:
1. **Institución de Origen (`DIRECTIVO_ORIGEN`):** Directivo de la institución que transfiere al usuario.
2. **Institución de Destino (`DIRECTIVO_DESTINO`):** Directivo de la institución que recibe al usuario.
3. **Padre de Familia / Acudiente Legal (`USUARIO`):** Para solicitudes de `TRASLADO_MATRICULA` (estudiantes menores de edad), la aprobación con rol `USUARIO` recae exclusivamente sobre el **Padre de Familia o Acudiente legal registrado**. En traslados de personal adulto (`TRASLADO_USUARIO`), la otorga el usuario afectado.

### RN-TRA-003: Facultad de Bypass del Administrador General
- El rol `ADMIN_GENERAL` posee autoridad ejecutiva global.
- Si un `ADMIN_GENERAL` emite un voto de aprobación (`APROBAR`), la solicitud se considera plenamente autorizada y desencadena la transacción de ejecución inmediata sin requerir los votos de origen, destino o acudiente.

### RN-TRA-004: Auto-Aprobación del Creador de la Solicitud
- Cuando una solicitud es registrada por un usuario autorizado (por ejemplo, un directivo de origen o el propio acudiente del estudiante), el sistema crea automáticamente el registro de aprobación en `traslado_aprobacion` correspondiente a dicho rol.
- Si el creador es el acudiente del estudiante (o usuario afectado), el rol asignado es `USUARIO`. Si es directivo del colegio origen, se asigna `DIRECTIVO_ORIGEN`.

### RN-TRA-005: Restricción de Origen y Destino Distintos
- Los parámetros `id_colegio_origen` e `id_colegio_destino` deben corresponder a colegios registrados existentes y ser estrictamente diferentes.
- Intentar registrar un traslado donde el colegio de origen y destino sean idénticos retornará una excepción de validación DTO (`400 Bad Request`).

### RN-TRA-006: Control de Solicitudes Duplicadas
- El sistema prohíbe la creación de múltiples solicitudes de traslado simultáneas para un mismo usuario entre los mismos colegios.
- Si existe una solicitud en estado `SOLICITADA` o `EN_APROBACION`, el servidor bloqueará la nueva solicitud con el mensaje *"Ya existe una solicitud de traslado pendiente para este usuario"*.

---

## 3. Integridad Transaccional y Matrículas

### RN-TRA-007: Atomicidad de Ejecución con Bloqueo `FOR UPDATE` y Kysely
- La ejecución del traslado dentro de `ejecutarTrasladoTransaccional` se realiza obligatoriamente dentro de una transacción PostgreSQL procesada con Kysely QueryBuilder.
- Se utiliza `.forUpdate()` sobre la fila de `solicitud_traslado` para prevenir condiciones de carrera cuando dos directivos intenten aprobar simultáneamente.
- Si la solicitud ya se encuentra en estado `EJECUTADA`, la transacción realiza un `COMMIT` limpio e idempotente sin duplicar modificaciones.

### RN-TRA-008: Actualización de Estado de Matrícula y Estudiante
- En traslados de tipo `TRASLADO_MATRICULA` vinculados a una matrícula activa:
  - La fila correspondiente en `matricula` actualiza su columna `estado` a `'TRASLADADA'`.
  - El registro en `estudiante` actualiza su columna `id_colegio` asignando la ID de la institución de destino.
  - La solicitud en `solicitud_traslado` actualiza su estado a `'EJECUTADA'` fijando `fecha_finalizacion = NOW()`.

---

## 4. Validación de Cupos, Asignación de Aula y Notificaciones

### RN-TRA-009: Traslado Interno de Grupo y Notificación por Correo
- Al reasignar un estudiante de grupo o sección dentro de la misma sede:
  - Es obligatorio suministrar un motivo del traslado (campo no vacío).
  - El sistema actualiza `matricula.id_grupo`.
  - Se desencadena de forma asíncrona la función `NotificationService.sendStudentTransferEmail`, enviando un correo al email registrado del acudiente con los nombres del estudiante, curso anterior, nuevo curso asignado y la justificación dada por la institución.

### RN-TRA-010: Irreversibilidad de Resoluciones Definitivas
- Cuando una solicitud alcanza un estado final (`APROBADA`, `RECHAZADA`, `CANCELADA`, `EJECUTADA`), queda congelada.
- Cualquier intento posterior de registrar un nuevo voto mediante `POST /api/traslados/:id/aprobacion` será rechazado por el backend con el error *"La solicitud ya se encuentra en estado final"*.

### RN-TRA-011: Unicidad e Imposibilidad de Votos Duplicados
- Cada rol participante (`DIRECTIVO_ORIGEN`, `DIRECTIVO_DESTINO`, `USUARIO`, `ADMIN_GENERAL`) o usuario solo puede emitir un único voto por solicitud de traslado.
- Si una solicitud ya posee una decisión registrada para un determinado rol o por un determinado usuario, el servidor rechazará los intentos posteriores con un error `400 Bad Request` impidiendo duplicidades en el consenso.

### RN-TRA-012: Validación Obligatoria de Cupos por Grado en Destino
- Al momento de recibir una solicitud de `TRASLADO_MATRICULA`, el sistema consulta en tiempo real las secciones del grado correspondiente al estudiante en la institución de destino (`GET /api/traslados/:id/disponibilidad-cupos`).
- Si la sumatoria de cupos disponibles en todas las secciones del grado receptor es igual a 0 (`cupos_totales_grado === 0`), el sistema **inhabilita y bloquea la acción de aprobación** para el directivo de destino y el Administrador General.
- El directivo debe obligatoriamente rechazar la solicitud o proceder con la apertura formal de cupos antes de poder admitir el traslado.

### RN-TRA-013: Asignación Directa de Sección y Jornada en el Acto de Aprobación
- Durante la aprobación del traslado, el directivo receptor (o Admin General) puede seleccionar el grupo y jornada de destino específico (`id_grupo_destino`).
- Si se suministra `id_grupo_destino`, la transacción de traslado asigna directamente dicho grupo y nivel escolar a la nueva matrícula en el colegio destino, garantizando la inserción del cupo de forma atómica.
- Si no se especifica grupo en el momento de la aprobación, la matrícula en destino se crea con estado `ACTIVA` y grupo nulo, exhibiendo en la bandeja de matrículas el distintivo `⚠️ PENDIENTE ASIGNAR SALÓN` para su asignación posterior en el cajón de matrícula.

### RN-TRA-014: Notificación Email Formal de Traslado Interinstitucional Aprobado
- Al completarse la transacción atómica de un traslado de matrícula, el sistema despacha automáticamente un correo formal al acudiente (`NotificationService.sendInterInstitutionalTransferApprovedEmail`).
- El correo detalla el nombre del estudiante, colegio origen, colegio receptor, grado lectivo y el grupo/jornada escolar asignado.

