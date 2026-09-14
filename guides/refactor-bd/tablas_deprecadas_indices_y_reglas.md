# Matriz Consolidada: Tablas Deprecadas, Índices y Reglas de la Base de Datos

Este documento compila el inventario exhaustivo de las decisiones de diseño aplicadas durante la refactorización integral de la base de datos de **AcademiaNeiva**, detallando las tablas deprecadas y eliminadas, los índices creados para rendimiento y las reglas e invariantes del sistema.

---

## 1. Matriz de Tablas Deprecadas y Eliminadas

A continuación se detalla la justificación técnica de la eliminación de las 8 tablas obsoletas o redundantes que existían en versiones heredadas del sistema:

| Tabla Deprecada / Eliminada | Módulo Afectado | Filas Previas | Motivo de Eliminación y Solución de Reemplazo |
| :--- | :--- | :--- | :--- |
| **`configuracion_colegio`** | Módulo 1 (Institución) | 0 | **Violación 3NF / 1:1 Innecesario**: Los parámetros de configuración de cada institución (logo, lema, resolución MEN, etc.) fueron consolidados directamente en la entidad raíz `colegio`, eliminando joins artificiales. |
| **`configuracion_base`** | Módulo 1 (Institución) | 0 | **Residuo de Prototipo**: Tabla huérfana de pruebas iniciales sin relaciones activas en el backend. |
| **`configuracion_sistema`** | Módulo 1 (Institución) | 0 | **Parámetros Globales Obsoletos**: Reemplazada por variables de entorno seguras (`.env`) en el backend y configuraciones específicas por colegio. |
| **`grados`** | Módulo 2 (Estructura Académica) | 0 | **Ambigüedad y Redundancia**: Competía con `tipo_grado` (catálogo estándar del MEN de Preescolar a 11°) y `detalle_grado` (oferta real de grados por colegio). Su eliminación unificó el modelo curricular. |
| **`desempeno`** | Módulo 5 (Evaluación) | 0 | **Esquema Numérico Antiguo**: Sustituida por `escala_nacional` (Bajo, Básico, Alto, Superior según Decreto 1290) y el subsistema contemporáneo de competencias, evidencias y criterios (`criterio_evaluacion`, `calificacion_criterio`). |
| **`contrato_docente`** | Módulo 6 (Actores Escolares) | 0 | **Módulo Laboral No Operativo**: Tabla desconectada de la asignación académica. La vinculación del docente con su colegio y carga horaria se modela directamente mediante `docente` y `asignacion_profesor`. |
| **`notificaciones`** | Módulo 10 (Notificaciones) | 0 | **Modelo Mono-Colegio Huérfano**: Carecía de `id_colegio` y tipos de audiencia. Reemplazada al 100% por `notificacion_colegio` (multitenant) y `notificaciones_push` (Web Push API). |
| **`persona`** | Módulo 6 (Actores Escolares) | 0 | **Herencia Artificial Incompleta**: Reemplazada por la entidad unificada `usuario` y sus especializaciones de rol (`docente`, `estudiante`, `acudiente`). |

> **Aclaración sobre `grupos.id_nivel`**:
> Adicionalmente, se eliminó la columna `id_nivel` de la tabla `grupos`. Dado que cada grupo apunta obligatoriamente a un `tipo_grado` y este a su vez pertenece a un `nivel_educativo`, almacenar `id_nivel` en `grupos` violaba la Tercera Forma Normal (dependencia transitiva). La consulta ahora se resuelve mediante `JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado`.

---

## 2. Inventario Consolidado de Índices Creados

Para asegurar tiempos de respuesta sub-milisegundo en operaciones de alta concurrencia (boletines masivos, toma de asistencia diaria, consulta de notas y autenticación), se implementó el siguiente conjunto de índices:

### Módulo 1: Institución y Sedes
- `idx_colegio_activo`: `colegio(activo)`
- `idx_sede_colegio`: `sede(id_colegio)`

### Módulo 2: Estructura Académica Base
- `idx_grupos_detalle_grado_anio`: `grupos(id_detalle_grado, id_anio_lectivo)`
- `idx_grupos_director`: `grupos(id_director_grupo)`

### Módulo 3: Calendario y Periodos
- `idx_periodo_anio_activo`: `periodo_academico(id_anio, estado)`
- `idx_cierre_periodo_grupo`: `cierre_periodo(id_grupo, id_periodo)`

### Módulo 4: Currículo y Competencias
- `idx_competencia_materia_grado`: `competencia(id_materia, id_tipo_grado, id_periodo)`
- `idx_evidencia_competencia`: `evidencia_aprendizaje(id_competencia)`
- `idx_criterio_evidencia`: `criterio_evaluacion(id_evidencia)`

### Módulo 5: Evaluación y Calificaciones
- `idx_calificacion_estudiante_criterio`: `calificacion_criterio(id_estudiante, id_criterio)`
- `idx_calificacion_fecha`: `calificacion_criterio(fecha_registro DESC)`
- `idx_resumen_boletin_estudiante_periodo`: `resumen_periodo_estudiante(id_estudiante, id_periodo)`

### Módulo 6: Actores Escolares
- `idx_usuario_email_colegio`: `usuario(email, id_colegio)`
- `idx_estudiante_colegio`: `estudiante(id_colegio)`
- `idx_docente_colegio`: `docente(id_colegio)`
- `idx_acudiente_colegio`: `acudiente(id_colegio)`
- `idx_estudiante_acudiente_parentesco`: `estudiante_acudiente(id_acudiente, id_estudiante)`

### Módulo 7: Matrículas y Traslados
- `idx_documento_matricula_tipo`: `documento_matriculas(id_matricula, tipo_documento)`

### Módulo 8: Asistencia y Convivencia
- `idx_registro_asistencia_sesion_unica`: `UNIQUE INDEX (id_grupo, fecha, hora_inicio, id_materia)`
- `idx_registro_asistencia_detalle_unico`: `UNIQUE INDEX (id_registro_asistencia, id_estudiante)`
- `idx_observacion_estudiante_fecha`: `observacion_estudiante(id_estudiante, fecha DESC)`

### Módulo 9: Promociones y Cierre Anual
- `idx_promociones_estudiante_anio`: `promociones_anuales(id_estudiante, id_anio)`

### Módulo 10: Notificaciones y Auditoría
- `idx_notif_colegio_destinatario`: `notificacion_colegio(id_colegio, destinatario_tipo, id_destinatario, leida)`
- `idx_pwd_reset_token`: `password_reset_tokens(token)`
- `idx_pwd_reset_user_expires`: `password_reset_tokens(id_usuario, expires_at)`
- `idx_auditoria_usuario_fecha`: `auditoria_supervision(id_usuario, fecha_hora DESC)`

---

## 3. Reglas e Invariantes del Sistema

1. **Aislamiento Multitenant**:
   Toda consulta que relacione entidades institucionales debe estar acotada por `id_colegio` (o derivarse jerárquicamente a través de `sede`, `grupo` o `anio_lectivo`).
2. **Prohibición de Migraciones Dinámicas en Runtime**:
   Las migraciones SQL ubicadas en `backend/src/db/migrations/` son exclusivamente de **solo lectura e histórico documental**. Ningún archivo de TypeScript debe ejecutar archivos `.sql` en el arranque del servidor (`ensureCompetencySchema` fue neutralizado a solo verificación de conexión `SELECT 1`).
3. **Uso Exclusivo de Kysely Querybuilder**:
   Queda terminantemente prohibido el uso de strings SQL crudos (`client.query("SELECT ...")`) en archivos del backend. Toda interacción con PostgreSQL debe realizarse mediante Kysely (`db.selectFrom`, `db.insertInto`, etc.), garantizando validación estática de esquemas contra `db.types.ts`.
4. **Unicidad de Períodos y Cierres**:
   - No pueden existir dos períodos con el mismo número de orden en el mismo año lectivo (`UNIQUE (id_anio, numero_periodo)`).
   - Un colegio solo puede tener un registro de cierre oficial por año lectivo (`UNIQUE (id_colegio, id_anio)`).
5. **No Duplicidad de Toma de Asistencia**:
   Un docente o sistema no puede abrir dos sesiones de asistencia para el mismo grupo, materia, fecha y hora de inicio (`idx_registro_asistencia_sesion_unica`).
6. **Integridad en Resoluciones Directivas**:
   Cada estudiante posee a lo sumo una decisión directiva o de promoción extraordinaria por año escolar cerrado (`uq_decision_promocion_estudiante_anio`).
