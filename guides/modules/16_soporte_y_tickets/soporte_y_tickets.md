# 🎟️ Módulo de Soporte y Gestión de Tickets

**Sistema:** Academia Neiva  
**Módulo:** Soporte Técnico e Incidencias (`tickets_soporte`)  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo proporciona un canal de comunicación centralizado, seguro y auditable para reportar incidencias técnicas, académicas o administrativas en la plataforma. Permite tanto a visitantes anónimos como a usuarios autenticados (Estudiantes, Docentes y Padres de Familia) abrir solicitudes de soporte y realizar el seguimiento interactivo. Por otro lado, ofrece consolas de gestión para que los directivos resuelvan incidencias de su colegio y para que el Administrador General atienda casos críticos escalados a nivel de plataforma.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Visitante Anónimo** | Crear tickets públicos (asociados a un colegio de la lista) y consultar o responder su ticket mediante código Base36 ofuscado. |
| **Docente / Estudiante / Padre** | Crear tickets vinculados de forma automática a su usuario y colegio. Consultar el historial en la bandeja "Mis Tickets" y responder bajo la regla de turnos. |
| **Directivo Escolar** | Visualizar y gestionar de forma exclusiva los tickets pertenecientes a su `id_colegio`. Agregar observaciones, cambiar estados y escalar tickets al Admin General. |
| **Administrador General** | Visualizar de forma global únicamente los tickets que hayan sido **escalados** por los directivos. Agregar notas globales y resolver las solicitudes. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Registrar un nuevo ticket de soporte | `POST` | `/api/support/tickets` | Público (Opcional Bearer) |
| Consultar estado de ticket por código Base36 | `GET` | `/api/support/tickets/track/:code` | Público |
| Registrar observación del remitente en el hilo | `POST` | `/api/support/tickets/track/:code/observaciones` | Público |
| Listar tickets de soporte en la bandeja de gestión | `GET` | `/api/support/tickets` | Directivo / Admin |
| Cambiar estado de un ticket de soporte | `PUT` | `/api/support/tickets/:id/status` | Directivo / Admin |
| Escalar ticket al Administrador General | `POST` | `/api/support/tickets/:id/escalar` | Directivo |
| Registrar observación institucional en el ticket | `POST` | `/api/support/tickets/:id/observaciones` | Directivo / Admin |

---

## 4. Reglas de Negocio

- **RN-TKT-001 (Ciclo de Vida de Estados):** Los tickets transicionan a través de los estados `'ABIERTO'`, `'EN_PROCESO'` y `'RESUELTO'`.
  - Todo ticket nace en estado `'ABIERTO'` con `fecha_escalado = NULL`.
  - Un ticket solo puede permanecer en estado `'ABIERTO'` si **no posee ninguna observación** y **no ha sido escalado**.
  - Al ingresar la primera nota (del colegio o del remitente) o al escalar, el estado se promueve automáticamente a `'EN_PROCESO'`.
- **RN-TKT-002 (Inmutabilidad de Tickets Resueltos):** Una vez que un ticket es marcado en estado `'RESUELTO'`, se convierte en un registro de **solo lectura**. No se permite agregar nuevas observaciones ni revertir su estado por parte de directivos, administradores ni usuarios.
- **RN-TKT-003 (Regla de Turnos en Conversación - Ping-Pong):** Para evitar el envío repetitivo de mensajes, el remitente (estudiante, padre, docente o visitante) únicamente puede enviar una respuesta si:
  - El ticket tiene al menos una nota registrada.
  - El autor del último mensaje en el historial es de tipo `DIRECTIVO` o `ADMIN_GENERAL`.
  - Si la última nota es del remitente, el botón de envío y la caja de texto se deshabilitan.
- **RN-TKT-004 (Bloqueo de Control por Escalamiento):** Cuando un directivo escala un ticket, se registra el timestamp en `fecha_escalado`. A partir de ese momento:
  - El directivo pierde los permisos de edición sobre el ticket y el selector de estado queda deshabilitado en su interfaz.
  - El Administrador General asume la responsabilidad exclusiva del caso.
  - La marca de escalado es inalterable, conservando el hecho histórico.
- **RN-TKT-005 (Código Base36 Ofuscado):** Los códigos de ticket públicos (ej. `TKT-1B3X9H7Z`) se generan mediante codificación Base36 sobre un entero de 22 dígitos derivado de: Año (4d) + ID Colegio (3d) + Documento/Teléfono (10d) + ID Ticket (5d). Esto previene ataques de enumeración y scraping.
- **RN-TKT-006 (Auditoría de Eventos de Sistema):** Todo cambio de estado, escalamiento o alteración crítica genera automáticamente una nota con tipo `'SISTEMA'`. Estas notas son inalterables y no pueden ser borradas.
- **RN-TKT-007 (Irreversibilidad de Tickets de Incidencia de Reingreso):** Los tickets con categoría de incidencia `REINGRESO` que se pasen al estado `'EN_PROCESO'` advierten al directivo de la acción irreversible, envían un correo automático al acudiente informando el inicio del trámite y bloquean su retorno a `'ABIERTO'`.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller** | [supportController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/supportController.ts) — Creación de tickets, generación del código Base36, validación de turnos y registro de notas. |
| **Routes** | [support.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/support.routes.ts) |
| **Migración SQL** | `018_fix_old_escalated_tickets.sql` — Corrección de datos históricos para estandarizar tickets con estado antiguo `'ESCALADO'` hacia la columna `fecha_escalado` y estado `'EN_PROCESO'`. |

### Frontend

| Tipo | Archivo |
|---|---|
| **Bandeja y Formulario** | [SupportView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/shared/SupportView.vue) — Interfaz dividida (Split-pane) para la visualización del hilo y envío de respuestas. |
| **Acceso Público** | [LandingView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/public/LandingView.vue) — Enlace público a soporte en la Landing Page institucional. |

---

## 6. Modelo de Datos

### Tabla: `tickets_soporte`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_ticket` | SERIAL PK | Identificador secuencial interno. |
| `id_usuario` | INT FK | Usuario autenticado creador (NULL para visitantes). |
| `id_colegio` | INT FK | Colegio del ticket (aislamiento multi-tenant). |
| `nombre_remitente` | VARCHAR(150) | Nombre del reportante. |
| `correo_remitente` | VARCHAR(150) | Correo electrónico de contacto. |
| `tipo_incidencia` | VARCHAR(50) | Categoría (`TECNICO`, `CALIFICACIONES`, `ASISTENCIA`, etc.). |
| `asunto` | VARCHAR(200) | Asunto resumido de la falla. |
| `descripcion` | TEXT | Detalle de la incidencia. |
| `estado` | VARCHAR(50) | Estado actual (`ABIERTO`, `EN_PROCESO`, `RESUELTO`). |
| `fecha_escalado` | TIMESTAMPTZ | Registro de fecha del escalamiento al admin general (NULL por defecto). |
| `codigo_ticket` | VARCHAR(50) | Código Base36 visible al usuario (ej. `TKT-1B3X9H7Z`). |
| `observaciones` | JSONB | Historial cronológico de notas y auditorías automáticas. |

### Estructura del Objeto JSONB en `observaciones`

```json
[
  {
    "id_usuario": 12,
    "nombre_usuario": "Rector Carlos",
    "tipo": "DIRECTIVO",
    "mensaje": "Se revisará el caso con soporte técnico.",
    "fecha_creacion": "2026-07-20T10:15:00.000Z"
  },
  {
    "id_usuario": null,
    "nombre_usuario": "Sistema (Auditoría)",
    "tipo": "SISTEMA",
    "mensaje": "El Directivo Rector Carlos escaló esta solicitud al Administrador General.",
    "fecha_creacion": "2026-07-20T10:20:00.000Z"
  }
]
```

---

## 7. Conexiones con Otros Módulos

- **→ Autenticación**: El controlador lee los datos de sesión activa en `req.user` para inyectar automáticamente el documento, correo e ID de colegio del usuario autenticado en la solicitud.
- **→ Colegios**: Aísla las consultas de la bandeja del directivo en base a su `id_colegio`.
- **→ Admin General**: El dashboard global de administración visualiza exclusivamente las incidencias con escalado vigente.

---

## 8. Validaciones Implementadas

### Backend
- Validación de que no se puedan insertar observaciones en tickets en estado `RESUELTO`.
- Comprobación de que la última nota en `observaciones` no pertenezca al remitente antes de permitirle enviar un nuevo mensaje.
- Validación de que el directivo comparta el mismo `id_colegio` que el ticket antes de autorizar lectura o edición (aislamiento multi-tenant).

### Frontend
- Diálogo de confirmación interactivo antes de consolidar el ticket en estado `RESUELTO`.
- Desactivación dinámica del área de texto y el botón de enviar en la bandeja si no corresponde el turno de respuesta al usuario.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Columna `observaciones` tipo JSONB** | Permite almacenar un historial ordenado y anidado de mensajes, respuestas y registros de auditoría de sistema en una sola columna, evitando múltiples consultas JOIN en bases de datos con alto tráfico de incidencias. |
| **`fecha_escalado` en lugar de boolean** | La marca temporal proporciona un booleano implícito (`fecha_escalado IS NOT NULL`), y a su vez permite medir los tiempos de SLA de respuesta del Administrador General. |
| **Código Base36 Ofuscado** | Previene que atacantes externos descubran los IDs numéricos correlativos del colegio o del ticket mediante la manipulación de la URL de seguimiento. |
