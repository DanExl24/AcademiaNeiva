# ⚙️ Módulo de Configuración Académica (Años Lectivos, Periodos y Escalas)

**Sistema:** Academia Neiva  
**Módulo:** Configuración de Ciclo de Vida Escolar e Integridad de Periodos  
**Última actualización:** 2026-07-20

---

## 1. Descripción Funcional

Este módulo centraliza la planeación y parametrización temporal de cada institución. Permite a los directivos crear años lectivos, configurar periodos académicos (trimestres con pesos porcentuales definidos), establecer escalas de valoración (valores mínimos, máximos e indicadores) de forma manual o automática, y gestionar las fechas de inicio y cierre de matrículas. Adicionalmente, implementa el motor de protección de periodos académicos, bloqueando cualquier alteración retroactiva de promedios una vez que un periodo es institucionalmente cerrado.

---

## 2. Actores y Permisos

| Rol | Alcance |
|---|---|
| **Directivo** | Configuración completa de años lectivos, periodos (creación, edición, cierre, aprobación, apertura), escalas de valoración y fechas de matrícula. |
| **Docente** | Consulta de escalas y periodos activos para planeación y registro de notas en aula. |
| **Estudiante / Padre** | Consulta pasiva de las escalas de evaluación y periodos para interpretación de boletines. |

---

## 3. Acciones Disponibles

| Acción | Método | Endpoint | Rol Requerido |
|---|---|---|---|
| Obtener configuración académica del colegio | `GET` | `/api/academic-admin/settings/:schoolId` | Autenticado |
| Registrar nuevo año lectivo | `POST` | `/api/academic-admin/settings/years` | Directivo |
| Cambiar estado de año lectivo | `PATCH` | `/api/academic-admin/settings/years/:id/status` | Directivo |
| Eliminar año lectivo | `DELETE` | `/api/academic-admin/settings/years/:id` | Directivo |
| Cambiar tipo de calendario del año lectivo | `PATCH` | `/api/academic-admin/settings/years/:id/calendar-type` | Directivo |
| Eliminar periodo académico sin notas | `DELETE` | `/api/academic-admin/settings/periods/:id` | Directivo |
| Crear periodo académico | `POST` | `/api/academic-admin/settings/periods` | Directivo |
| Modificar peso porcentual del periodo | `PATCH` | `/api/academic-admin/settings/periods/:id/percentage` | Directivo |
| Obtener detalles del cierre de periodo | `GET` | `/api/academic-admin/settings/closure-details/:schoolId/:periodId` | Directivo |
| Cerrar periodo institucionalmente | `POST` | `/api/academic-admin/settings/periods/:id/close` | Directivo |
| Aprobar notas y consolidar periodo | `POST` | `/api/academic-admin/settings/periods/:id/approve` | Directivo |
| Reabrir periodo académico | `POST` | `/api/academic-admin/settings/periods/:id/reopen` | Directivo |
| Reabrir materia específica para un docente | `POST` | `/api/academic-admin/settings/periods/:periodId/reopen-subject/:detailGradeId` | Directivo |
| Crear escala de valoración | `POST` | `/api/academic-admin/settings/scales` | Directivo |
| Actualizar escala de valoración | `PUT` | `/api/academic-admin/settings/scales/:id` | Directivo |
| Configurar escalas en modo manual | `PUT` | `/api/academic-admin/settings/scales/manual` | Directivo |
| Eliminar escala de valoración | `DELETE` | `/api/academic-admin/settings/scales/:id` | Directivo |
| Obtener catálogos académicos globales | `GET` | `/api/academic-admin/catalogs` | Público |

---

## 4. Reglas de Negocio

- **RN-CONF-001 (Ciclo de Vida de los Periodos):** Los periodos académicos transicionan de manera secuencial a través de tres estados regulados por la columna `estado` (de tipo enum `estado_periodo`):
  - `PENDIENTE`: Periodo planificado pero no iniciado. Permite planeación curricular de competencias y evidencias.
  - `ABIERTO`: Periodo lectivo vigente. Habilita a los docentes a registrar actividades, criterios y notas en tiempo real.
  - `CERRADO`: Periodo finalizado y consolidado. Bloquea strictly toda operación de escritura.
- **RN-CONF-002 (Protección Estricta de Datos en Periodo CERRADO):** Para blindar las calificaciones oficiales frente a cambios retroactivos, se aplica una validación backend y de base de datos redundante. Si un periodo está `CERRADO`, se rechaza con error `409 Conflict` o excepción SQL cualquier intento de modificación de notas, actividades o asistencias.
- **RN-CONF-003 (Activación Automática de Periodos por Scheduler):** El backend corre un servicio programador (`schedulerService.ts`) cada hora. Este servicio promueve automáticamente un periodo de `PENDIENTE` a `ABIERTO` si la fecha actual alcanza la fecha de inicio del periodo y el trimestre anterior ya se encuentra `CERRADO`.
- **RN-CONF-004 (Configuración de Escalas de Calificación):** Un colegio puede operar sus escalas en modo `AUTOMATICO` o `MANUAL` (definido en `configuracion_colegio`).
- **RN-CONF-005 (Límite del 100% en Suma de Ponderaciones):** La sumatoria de las ponderaciones porcentuales de los periodos asociados a un año lectivo en el mismo colegio no puede superar el 100%.
- **RN-CONF-006 (Exclusividad del Año Lectivo Activo):** Solo se permite **un (1) año lectivo en estado `ABIERTO`** por colegio a la vez. Al activar un nuevo año, cualquier otro año activo pasa automáticamente a `CERRADO`.
- **RN-CONF-007 (Coherencia y Rango de Fechas del Año Lectivo):** Todo año lectivo define `fecha_inicio` y `fecha_fin` cumpliendo `fecha_fin > fecha_inicio`.
- **RN-CONF-008 (Prohibición de Solapamiento entre Años Lectivos):** Las fechas de vigencia de un año lectivo NO pueden cruzarse con las fechas de ningún otro año lectivo del mismo colegio.
- **RN-CONF-009 (Concurrencia Estricta entre Años Lectivos y Periodos):** Ningún periodo puede tener fechas fuera del rango de su año lectivo. El Primer Periodo inicia con la `fecha_inicio` del año y el Cuarto Periodo termina con la `fecha_fin` del año.
- **RN-CONF-010 (Formato Numérico y Tipo de Calendario en Modo Editor):** La edición del tipo de calendario de un año registrado requiere la activación explícita del Modo Editor y que el año no posea alumnos matriculados o notas registradas.

---

## 5. Implementación

### Backend

| Tipo | Archivo |
|---|---|
| **Controller** | [academicAdminController.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/controllers/academicAdminController.ts) — Gestión de años lectivos, periodos, escalas y cierres institucionales. |
| **Routes** | [academicAdmin.routes.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/routes/academicAdmin.routes.ts) |
| **Helpers de Validación** | [periodHelpers.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/utils/periodHelpers.ts) — Funciones `ensurePeriodOpen`, `ensureSubjectOpen`, `ensureCurrentPeriodOrRespond` llamadas en cascada en los controladores de notas. |
| **Servicio Planificador** | [schedulerService.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/services/schedulerService.ts) — Ejecución automatizada en segundo plano de activación de periodos pendientes. |
| **Triggers de Base de Datos** | [AcademiaNeivaBD.sql](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql) — Función trigger `fn_bloquear_periodo_cerrado()` aplicada en INSERT/UPDATE/DELETE en `notas_actividad`, `observacion_estudiante` y `registro_asistencia`. |

### Frontend

| Tipo | Archivo |
|---|---|
| **Consola de Configuración** | [AcademicSettings.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicSettings.vue) |
| **Vista Periodos** | [AcademicPeriodsView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicPeriodsView.vue) |
| **Vista Escalas** | [AcademicScalesView.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/AcademicScalesView.vue) |
| **Vista Cierres** | [PeriodClosure.vue](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend/src/views/admin/PeriodClosure.vue) |

---

## 6. Modelo de Datos

### Tabla: `anio_lectivo`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_anio` | SERIAL PK | Identificador único del año lectivo. |
| `calendario` | VARCHAR(10) | Etiqueta o rango del año (ej. `2026` o `2025-2026`). |
| `id_colegio` | INT FK | Colegio al que pertenece el año lectivo. |
| `tipo_calendario` | CHAR(1) | Tipo de calendario escolar (`A` o `B`). |
| `estado` | `estado_periodo` | Estado del año lectivo (`ABIERTO` o `CERRADO`). |
| `fecha_inicio` | DATE | Fecha oficial de inicio de la vigencia del año. |
| `fecha_fin` | DATE | Fecha oficial de cierre de la vigencia del año. |

### Tabla: `periodo_academico`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_periodo` | SERIAL PK | Identificador único del periodo. |
| `nombre` | VARCHAR | Nombre del trimestre (ej. Primer Periodo). |
| `estado` | `estado_periodo` | `PENDIENTE`, `ABIERTO`, `CERRADO`. |
| `porcentaje` | NUMERIC(5,2) | Peso del periodo en el año escolar (ej. 25.00). |
| `id_colegio` | INT FK | Colegio del periodo. |
| `id_anio` | INT FK | Año lectivo al que pertenece. |
| `trimestre` | INT | Número secuencial de trimestre (1, 2, 3 o 4). |
| `dia_inicio` / `mes_inicio` | INT | Día y mes de apertura planificada. |
| `dia_fin` / `mes_fin` | INT | Día y mes de cierre planificado. |

### Tabla: `escala_valoracion`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_escalavaloracion` | SERIAL PK | Identificador único del rango de escala. |
| `nivel` | VARCHAR(20) | Nivel descriptivo (ej. `BAJO`, `BASICO`, `ALTO`, `SUPERIOR`). |
| `valor_minimo` | NUMERIC(5,2) | Nota mínima de la escala. |
| `valor_maximo` | NUMERIC(5,2) | Nota máxima de la escala. |
| `id_colegio` | INT FK | Colegio propietario. |

---

## 7. Conexiones con Otros Módulos

- **→ Calificaciones y Actividades**: Valida que no se puedan crear actividades o registrar notas si el periodo está cerrado.
- **→ Cierre de Periodo**: Coordina el flujo de consolidación que culmina en el cambio a `CERRADO`.
- **→ Boletines**: Consume las escalas de valoración y promedios consolidados por periodo.

---

## 8. Validaciones Implementadas

### Backend
- Middleware de base de datos (`fn_bloquear_periodo_cerrado`) que aborta escrituras de notas si el periodo está cerrado.
- El helper `ensureCurrentPeriodOrRespond` intercepta peticiones API y responde con error estructurado `409` antes de tocar la base de datos.
- Validación de que la sumatoria de porcentajes de periodos de un año lectivo no supere el 100%.

### Frontend
- Bloqueo de inputs de notas y botones de guardar en `TeacherGrades.vue` si el periodo activo no se encuentra abierto.
- Mensajes informativos y banners descriptivos con advertencias de bloqueo.

---

## 9. Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| **Trigger + Middleware redundante** | Ofrece doble capa de protección: el middleware Express entrega errores semánticos limpios a la UI, mientras que el trigger SQL garantiza la inmutabilidad de los datos si se accede por consola o consultas crudas. |
| **Scheduler por Hora** | Permite activar los periodos el día programado sin intervención de personal directivo, reduciendo fricción administrativa. |
| **Reapertura de Materias Individuales** | En lugar de reabrir el periodo completo del colegio (lo cual es riesgoso), el directivo puede habilitar temporalmente una única materia para un docente en específico. |
