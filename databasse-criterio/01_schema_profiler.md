# Reporte Estructural y Semántico de Base de Datos
## Agente 01: Schema Profiler
**Proyecto:** AcademiaNeiva  
**RDBMS:** PostgreSQL (v15+ / v18 dump)  
**Esquema:** `public`  
**Total de Tablas Analizadas:** 62  
**Total de Enums:** 26  
**Total de Vistas:** 7  
**Total de Triggers:** 12  
**Fecha:** 2026-09-04  

---

## 1. Declaración de Alcance y Metodología

El presente informe ha sido elaborado bajo el estricto mandato del rol **# 1. Schema Profiler**.

### Reglas Metodológicas Aplicadas
1. **Neutralidad Descriptiva:** No se emiten juicios de valor, calificaciones de diseño ni recomendaciones de modificación sobre el esquema.
2. **Delimitación Epistémica:** Se separa explícitamente cada **hecho observable** (definiciones DDL explícitas: columnas, tipos de datos, restricciones `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `CHECK`, `NOT NULL`, `DEFAULT`, `INDEX`, `TRIGGER`, `VIEW`) de cada **inferencia semántica o cardinalidad deducida**.
3. **Calificación de Certeza:** Toda inferencia o deducción semántica cuenta con un nivel de confianza explícito (**Alta**, **Media** o **Baja**), fundamentado en la evidencia textual y estructural disponible.
4. **Ausencia de Juicio de Normalización:** No se reportan anomalías de normalización (1FN, 2FN, 3FN, BCNF) ni sugerencias de refactorización, preservando la exclusividad analítica para los agentes auditores posteriores.

---

## 2. Inventario Global del Esquema

### 2.1 Tipos Enumerados Personalizados (`ENUM`)
El esquema define **26** tipos enumerados nativos en PostgreSQL:

| Nombre del Enum | Valores Permitidos |
| :--- | :--- |
| `accion_aprobacion_traslado` | `APROBAR`, `RECHAZAR`, `CANCELAR` |
| `decision_promocion_tipo` | `PROMOVER_SIGUIENTE_GRADO`, `MANTENER_GRADO`, `MATRICULA_CONDICIONADA`, `OTRA_DECISION` |
| `estado_asistencia` | `PRESENTE`, `AUSENTE`, `TARDE`, `JUSTIFICADA` |
| `estado_cierre_materia` | `ABIERTO`, `CERRADO` |
| `estado_colegio` | `PENDIENTE`, `ACTIVO`, `SUSPENDIDO`, `RECHAZADO`, `ELIMINADO` |
| `estado_dba` | `ACTIVO`, `INACTIVO` |
| `estado_documento` | `PENDIENTE`, `VALIDADO`, `RECHAZADO` |
| `estado_estudiante` | `ACTIVO`, `SANCIONADO`, `EXPULSADO`, `RETIRADO`, `GRADUADO` |
| `estado_matricula` | `PENDIENTE`, `ACTIVA`, `CANCELADA`, `TRASLADADA`, `RECHAZADA`, `CORRECCION`, `APROBADA`, `CULMINADA`, `PENDIENTE_RENOVACION`, `CORREGIDA` |
| `estado_periodo` | `ABIERTO`, `CERRADO`, `PENDIENTE` |
| `estado_renovacion_documento` | `VIGENTE`, `RECOMENDADO_ACTUALIZAR`, `OBLIGATORIO_ACTUALIZAR`, `DESACTUALIZADO_POR_FECHA` |
| `estado_resultado` | `APROBADO`, `REPROBADO`, `EN_PROCESO` |
| `estado_sancion` | `ACTIVA`, `REVOCADA`, `VENCIDA` |
| `estado_solicitud_traslado` | `SOLICITADA`, `EN_APROBACION`, `APROBADA`, `RECHAZADA`, `CANCELADA`, `EJECUTADA` |
| `estado_supervision` | `SOLICITADA`, `APROBADA`, `ACTIVA`, `FINALIZADA`, `REVOCADA`, `EXPIRADA` |
| `estado_ticket_soporte` | `ABIERTO`, `EN_PROCESO`, `RESUELTO`, `ESCALADO` |
| `estado_usuario_sistema` | `ACTIVO`, `SUSPENDIDO`, `BANEADO`, `ELIMINADO` |
| `resultado_consolidado_anual` | `APROBADO`, `NO_PROMOVIDO`, `PENDIENTE_RECUPERACION`, `PENDIENTE_DECISION` |
| `tipo_accion_auditoria` | `LECTURA`, `CREACION`, `MODIFICACION`, `ELIMINACION`, `EXPORTACION` |
| `tipo_documento_identidad` | `TI`, `CC`, `CE`, `RC`, `PAS` |
| `tipo_incidencia_soporte` | `TECNICO`, `CALIFICACIONES`, `ASISTENCIA`, `AUTENTICACION`, `SOPORTE`, `REINGRESO`, `MATRICULA_EXTRAORDINARIA` |
| `tipo_jornada` | `MAÑANA`, `TARDE`, `NOCTURNA`, `UNICA` |
| `tipo_matricula` | `REGULAR`, `RENOVACION`, `REINGRESO`, `EXTRAORDINARIA`, `TRASLADO` |
| `tipo_observacion` | `ACADEMICA`, `CONVIVENCIA`, `OTRO`, `DISCIPLINARIA` |
| `tipo_supervision` | `SOLO_LECTURA`, `EDITOR` |
| `tipo_traslado` | `TRASLADO_USUARIO`, `TRASLADO_MATRICULA` |

---

### 2.2 Clasificación Estructural de Tablas
Las **62** tablas se clasifican de acuerdo con su función estructural identificable en el catálogo:

| Categoría Estructural | Cantidad | Tablas |
| :--- | :---: | :--- |
| **Entidad Principal** | 2 | `colegio`, `usuario` |
| **Entidad Dependiente / Perfiles / Académica** | 18 | `anio_lectivo`, `directivo`, `docente`, `estudiante`, `padre_familia`, `grados`, `grupos`, `periodo_academico`, `competencias`, `evidencia_aprendizaje`, `evidencias_dba`, `actividad_materia`, `criterio_evaluacion`, `desempeno`, `documento_matriculas`, `contrato_docente`, `tipo_grado`, `nivel_escolar` |
| **Tabla Puente / Relación** | 7 | `usuario_colegio`, `usuario_rol`, `detalle_padrefamilia`, `detalle_grados`, `actividad_evidencia_dba`, `dba_dimensiones_preescolar`, `colegio_version_curricular` |
| **Catálogo** | 8 | `rol`, `tipo_documento`, `tipo_sancion`, `secciones`, `jornada`, `materias`, `dimensiones_preescolar`, `dba` |
| **Configuración** | 6 | `configuracion_colegio`, `configuracion_base`, `configuracion_sistema`, `configuracion_plataforma`, `configuracion_inscripcion`, `escala_valoracion` |
| **Transaccional** | 13 | `matricula`, `notas_actividad`, `nota_criterio`, `registro_asistencia`, `observacion_estudiante`, `sancion`, `solicitud_traslado`, `traslado_aprobacion`, `decision_promocion_directivo`, `notificacion_colegio`, `notificacion_supervision`, `tickets_soporte`, `email_change_tokens` |
| **Histórico** | 2 | `registro_graduados`, `cierre_materia` |
| **Auditoría / Seguridad** | 5 | `auditoria_supervision`, `auditoria_acciones_realizadas`, `papelera_materias`, `token_blacklist`, `password_reset_tokens` |
| **Desconocida** | 0 | - |

---

### 2.3 Patrones Relacionales Identificados

#### 2.3.1 Relaciones 1:1 Identificadas
- **`configuracion_colegio` → `colegio`**
  - *Hecho Observable:* La columna `id_colegio` es simultáneamente la clave primaria (`PRIMARY KEY`) y clave foránea (`FOREIGN KEY REFERENCES colegio(id_colegio)`).
  - *Inferencia:* Relación uno a uno obligatoria por colegio. Un colegio no puede poseer más de un registro de configuración institucional. (Confianza: **Alta**)
- **`registro_graduados` → `estudiante`**
  - *Hecho Observable:* La clave foránea `id_estudiante` posee una restricción de unicidad estricta (`UNIQUE CONSTRAINT uq_registro_graduado_estudiante`).
  - *Inferencia:* Relación uno a uno. Cada estudiante registrado como graduado solo puede poseer un registro oficial de grado en el libro protocolario. (Confianza: **Alta**)

#### 2.3.2 Relaciones Muchos a Muchos (N:M) y Tablas Puente
- **`actividad_evidencia_dba`**: Interconecta `actividad_materia` y `evidencias_dba` con clave primaria compuesta `(id_actividadmateria, id_evidencia_dba)`.
- **`dba_dimensiones_preescolar`**: Interconecta `dba` y `dimensiones_preescolar` con clave primaria compuesta `(id_dba, id_dimension)`.
- **`usuario_rol`**: Interconecta `usuario` y `rol` con clave primaria compuesta `(id_usuario, id_rol)`.
- **`usuario_colegio`**: Interconecta `usuario`, `colegio` y `rol` con restricción `UNIQUE (id_usuario, id_colegio, id_rol)`.
- **`detalle_padrefamilia`**: Interconecta `padre_familia` con `estudiante` bajo el ámbito de un `colegio` mediante restricción `UNIQUE (id_padrefamilia, id_estudiante)`.
- **`detalle_grados`**: Tabla asociativa compleja de carga académica que vincula `docente`, `materias`, `grupos` y `anio_lectivo` en un `colegio`.
- **`colegio_version_curricular`**: Mapea la versión curricular institucional por colegio.

#### 2.3.3 Tablas con Múltiples Claves Foráneas (Multi-FK ≥ 3)
Tablas con alta densidad de interdependencia referencial:
- `actividad_materia` (6 FKs: `detalle_grados`, `periodo_academico`, `colegio`, `competencias`, `evidencia_aprendizaje`, `docente`)
- `grupos` (6 FKs: `colegio`, `jornada`, `nivel_escolar`, `secciones`, `tipo_grado`, `docente`)
- `matricula` (6 FKs: `estudiante`, `colegio`, `grupos`, `anio_lectivo`, `tipo_documento_acudiente`, `tipo_documento_estudiante`)
- `competencias` (6 FKs: `colegio`, `materias`, `anio_lectivo`, `nivel_escolar`, `tipo_grado`, `periodo_academico`)
- `detalle_grados` (5 FKs: `docente`, `grupos`, `materias`, `anio_lectivo`, `colegio`)
- `decision_promocion_directivo` (5 FKs: `estudiante`, `colegio`, `anio_lectivo`, `grados` [origen], `grados` [destino])
- `observacion_estudiante` (4 FKs: `estudiante`, `periodo_academico`, `detalle_grados`, `colegio`)
- `resultado_academico` (4 FKs: `estudiante`, `periodo_academico`, `detalle_grados`, `docente`)
- `auditoria_supervision` (3 FKs: `colegio`, `directivo` [supervisado], `directivo` [creador])
- `cierre_materia` (3 FKs: `detalle_grados`, `periodo_academico`, `docente`)
- `criterio_evaluacion` (3 FKs: `actividad_materia`, `colegio`, `evidencia_aprendizaje`)
- `detalle_padrefamilia` (3 FKs: `estudiante`, `padre_familia`, `colegio`)
- `evidencia_aprendizaje` (3 FKs: `competencias`, `evidencias_dba`, `colegio`)
- `nota_criterio` (3 FKs: `criterio_evaluacion`, `estudiante`, `colegio`)
- `notas_actividad` (3 FKs: `actividad_materia`, `estudiante`, `escala_valoracion`)
- `registro_asistencia` (3 FKs: `estudiante`, `detalle_grados`, `colegio`)
- `sancion` (3 FKs: `estudiante`, `tipo_sancion`, `colegio`)
- `solicitud_traslado` (3 FKs: `matricula`, `colegio` [origen], `colegio` [destino])
- `usuario` (3 FKs: `tipo_documento`, `usuario` [auto-referencia], `colegio`)

#### 2.3.4 Jerarquías y Relaciones Reflexivas
- **Jerarquía de Control / Moderación en `usuario`:**
  - *Hecho Observable:* La columna `usuario.baneado_por` cuenta con restricción `FOREIGN KEY REFERENCES usuario(id_usuario)`.
  - *Inferencia:* Estructura jerárquica reflexiva que vincula a un usuario infractor con el usuario administrativo que ejecutó la restricción de cuenta. (Confianza: **Alta**)
- **Jerarquía Temporal Institucional:**
  - *Hecho Observable:* `colegio` → `anio_lectivo` → `periodo_academico`.
  - *Inferencia:* Jerarquía de ciclo de vida académico estricta. (Confianza: **Alta**)
- **Jerarquía Curricular y Pedagógica MEN:**
  - *Hecho Observable:* `dba` → `evidencias_dba` → `evidencia_aprendizaje` → `actividad_evidencia_dba` / `criterio_evaluacion`.
  - *Inferencia:* Cascada de especificación pedagógica desde la norma nacional hasta el instrumento de aula. (Confianza: **Alta**)

#### 2.3.5 Entidades Compartidas y Roles de Persona
- **Entidad de Identidad Central (`usuario`):**
  - *Hecho Observable:* Existen 4 entidades con perfiles personales que contienen la columna `id_usuario integer`: `directivo.id_usuario`, `docente.id_usuario`, `estudiante.id_usuario` y `padre_familia.id_usuario`. En el DDL, ninguna de estas 4 columnas cuenta con una restricción explícita `FOREIGN KEY` hacia `usuario(id_usuario)`.
  - *Inferencia:* `usuario` representa la cuenta/identidad transversal, mientras que `directivo`, `docente`, `estudiante` y `padre_familia` representan perfiles o roles del dominio escolar. La vinculación referencial es lógica/semántica en la capa de aplicación o pendiente en DDL. (Confianza: **Alta**)
- **Entidad Tenant de Aislamiento (`colegio`):**
  - *Hecho Observable:* 38 de las 62 tablas poseen una columna `id_colegio integer` vinculada con o sin FK explícita.
  - *Inferencia:* `colegio` constituye el límite de particionamiento de datos institucional del sistema. (Confianza: **Alta**)

---

### 2.4 Columnas Nominales `id_*` sin Restricción `FOREIGN KEY` Explícita en DDL
Se identifican formalmente las siguientes columnas cuyo nombre sugiere vinculación referencial con otra entidad pero que en el DDL carecen de `ADD CONSTRAINT ... FOREIGN KEY`:

| Tabla | Columna | Tipo | Referencia Inferida | Confianza de la Inferencia |
| :--- | :--- | :--- | :--- | :---: |
| `auditoria_acciones_realizadas` | `id_usuario_afectado` | `integer` | `usuario(id_usuario)` | **Alta** |
| `auditoria_supervision` | `id_admin_general` | `integer` | `usuario(id_usuario)` | **Alta** |
| `decision_promocion_directivo` | `id_usuario_decision` | `integer` | `usuario(id_usuario)` | **Alta** |
| `directivo` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `docente` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `email_change_tokens` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `escala_valoracion` | `id_colegio` | `integer` | `colegio(id_colegio)` | **Alta** |
| `estudiante` | `id_nivel` | `integer` | `nivel_escolar(id_nivel)` | **Alta** |
| `estudiante` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `grados` | `id_jornada` | `integer` | `jornada(id_jornada)` | **Alta** |
| `grados` | `id_colegio` | `integer` | `colegio(id_colegio)` | **Alta** |
| `matricula` | `id_usuario_responsable` | `integer` | `usuario(id_usuario)` | **Alta** |
| `notas_actividad` | `id_colegio` | `integer` | `colegio(id_colegio)` | **Alta** |
| `padre_familia` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `papelera_materias` | `id_colegio` | `integer` | `colegio(id_colegio)` | **Alta** |
| `password_reset_tokens` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `registro_graduados` | `id_usuario_registro` | `integer` | `usuario(id_usuario)` | **Alta** |
| `solicitud_traslado` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `tickets_soporte` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `traslado_aprobacion` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `usuario_colegio` | `id_usuario` | `integer` | `usuario(id_usuario)` | **Alta** |
| `usuario_colegio` | `id_rol` | `integer` | `rol(id_rol)` | **Alta** |

---

### 2.5 Vistas del Esquema (`VIEWS`)
El esquema contiene **7** vistas SQL predefinidas:

| Nombre de Vista | Propósito Aparente | Tablas Origen Observables |
| :--- | :--- | :--- |
| `vw_asistencia_estudiante` | Agregación / Normalización analítica | public.registro_asistencia GROUP BY id_estudiante, id_detallegrado |
| `vw_notas_enriquecidas` | Agregación / Normalización analítica | (((public.notas_actividad n ,  public.estudiante e ON ((e.id_estudiante = n.id_estudiante))) ,  public.activida |
| `vw_promedio_estudiante_periodo` | Agregación / Normalización analítica | public.vw_notas_enriquecidas GROUP BY id_estudiante, id_periodo, id_colegio |
| `vw_promedio_normalizado` | Agregación / Normalización analítica | (public.vw_promedio_estudiante_periodo p ,  public.configuracion_colegio cfg ON ((cfg.id_colegio = p.id_colegio)) |
| `vw_desempeno_estudiante` | Agregación / Normalización analítica | (public.vw_promedio_normalizado p ,  public.escala_valoracion d ON (((p.promedio_normalizado >= d.valor_minimo) A |
| `vw_observaciones_estudiante` | Agregación / Normalización analítica | public.observacion_estudiante GROUP BY id_estudiante, id_periodo |
| `vw_promedio_materia` | Agregación / Normalización analítica | ((public.notas_actividad n ,  public.actividad_materia a ON ((a.id_actividadmateria = n.id_actividadmateria))) JO |

---

### 2.6 Disparadores (`TRIGGERS`)
El esquema define **12** disparadores activos asociados a funciones PL/pgSQL:

| Trigger | Tabla | Evento / Momento | Función Ejecutada | Propósito Observable |
| :--- | :--- | :--- | :--- | :--- |
| `trg_bloquear_asistencia_periodo` | `registro_asistencia` | BEFORE | `fn_bloquear_periodo_cerrado()` | Bloquear cambios en periodos cerrados |
| `trg_bloquear_notas_periodo` | `notas_actividad` | BEFORE | `fn_bloquear_periodo_cerrado()` | Bloquear cambios en periodos cerrados |
| `trg_bloquear_observacion_periodo` | `observacion_estudiante` | BEFORE | `fn_bloquear_periodo_cerrado()` | Bloquear cambios en periodos cerrados |
| `trg_prevent_closed_actividad_materia` | `actividad_materia` | BEFORE | `trg_check_subject_not_closed()` | Impedir modificación sobre materia cerrada |
| `trg_prevent_closed_criterio_evaluacion` | `criterio_evaluacion` | BEFORE | `trg_check_subject_not_closed()` | Impedir modificación sobre materia cerrada |
| `trg_prevent_closed_nota_criterio` | `nota_criterio` | BEFORE | `trg_check_subject_not_closed()` | Impedir modificación sobre materia cerrada |
| `trg_prevent_closed_notas_actividad` | `notas_actividad` | BEFORE | `trg_check_subject_not_closed()` | Impedir modificación sobre materia cerrada |
| `trg_prevent_closed_observacion_estudiante` | `observacion_estudiante` | BEFORE | `trg_check_subject_not_closed()` | Impedir modificación sobre materia cerrada |
| `trg_prevent_closed_registro_asistencia` | `registro_asistencia` | BEFORE | `trg_check_subject_not_closed()` | Impedir modificación sobre materia cerrada |
| `trg_proteger_acciones` | `auditoria_acciones_realizadas` | BEFORE | `proteger_acciones_auditoria()` | Inmutabilidad de auditoría y soft-delete |
| `trg_proteger_auditoria` | `auditoria_supervision` | BEFORE | `proteger_auditoria_finalizada()` | Inmutabilidad de auditoría y soft-delete |
| `trg_sync_estudiante_sancion` | `sancion` | AFTER | `fn_sync_estudiante_sancion()` | Sincronizar estado disciplinario de estudiante |

---

## 3. Fichas Técnicas Detalladas de las 62 Tablas

A continuación se desglosa el inventario completo, exhaustivo y estructurado de cada una de las tablas del esquema:

### 3.1 Tabla: `actividad_evidencia_dba`

- **Categoría Estructural:** tabla puente
- **Propósito Aparente:** Asocia las actividades de materia con las evidencias de Derechos Básicos de Aprendizaje (DBA) alcanzadas.
- **Posibles Responsabilidades:** Gestionar la relación N:M entre actividades evaluativas institucionales y evidencias curriculares oficiales del MEN.
- **Total de Columnas:** 2

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_actividadmateria` | `integer` | NO | - | **PK, FK, IDX** | SÍ | SÍ | NO | SÍ |
| `id_evidencia_dba` | `integer` | NO | - | **PK, FK, IDX** | SÍ | SÍ | NO | SÍ |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `actividad_evidencia_dba_pkey` (`id_actividadmateria, id_evidencia_dba`)
- **Claves Foráneas Salientes (FK):**
- FK `id_actividadmateria` → `actividad_materia(id_actividadmateria)` [ON DELETE CASCADE]
- FK `id_evidencia_dba` → `evidencias_dba(id_evidencia_dba)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_actividad_evidencia_dba_act` (NON-UNIQUE) sobre `(id_actividadmateria)`
- `idx_actividad_evidencia_dba_ev` (NON-UNIQUE) sobre `(id_evidencia_dba)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `actividad_evidencia_dba` → `actividad_materia`: Cardinalidad inferible **N:1** (`actividad_materia` 1:N `actividad_evidencia_dba`) (Evidencia: la FK no está restringida a unicidad en `actividad_evidencia_dba`). Confianza: **Alta**.
- `actividad_evidencia_dba` → `evidencias_dba`: Cardinalidad inferible **N:1** (`evidencias_dba` 1:N `actividad_evidencia_dba`) (Evidencia: la FK no está restringida a unicidad en `actividad_evidencia_dba`). Confianza: **Alta**.

---

### 3.2 Tabla: `actividad_materia`

- **Categoría Estructural:** entidad dependiente / transaccional
- **Propósito Aparente:** Almacena la programación y definición de actividades evaluativas por materia, periodo y colegio.
- **Posibles Responsabilidades:** Definir el instrumento evaluativo, ponderación porcentual y vinculación curricular de una asignatura.
- **Total de Columnas:** 12

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_actividadmateria` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_detallegrado` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_periodo` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `nombre` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `porcentaje` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_competencia` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_evidencia` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `fecha_creacion` | `timestamp with time zone` | SÍ | `now()` | - | NO | NO | NO | NO |
| `motivo_extra` | `character varying(100)` | SÍ | `NULL::character varying` | - | NO | NO | NO | NO |
| `justificacion_extra` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `id_docente_creador` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `actividad_materia_pkey` (`id_actividadmateria`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_competencia` → `competencias(id_competencia)` [ON DELETE CASCADE]
- FK `id_detallegrado` → `detalle_grados(id_detallegrado)` [ON DELETE CASCADE]
- FK `id_docente_creador` → `docente(id_docente)` [NO ACTION]
- FK `id_evidencia` → `evidencia_aprendizaje(id_evidencia)` [ON DELETE SET NULL]
- FK `id_periodo` → `periodo_academico(id_periodo)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_evidencia_dba(id_actividadmateria)` referencian a `actividad_materia(id_actividadmateria)`
- `criterio_evaluacion(id_actividadmateria)` referencian a `actividad_materia(id_actividadmateria)`
- `desempeno(id_actividadmateria)` referencian a `actividad_materia(id_actividadmateria)`
- `notas_actividad(id_actividadmateria)` referencian a `actividad_materia(id_actividadmateria)`
- **Cardinalidades Inferibles:**
- `actividad_materia` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `actividad_materia`) (Evidencia: la FK no está restringida a unicidad en `actividad_materia`). Confianza: **Alta**.
- `actividad_materia` → `competencias`: Cardinalidad inferible **N:1** (`competencias` 1:N `actividad_materia`) (Evidencia: la FK no está restringida a unicidad en `actividad_materia`). Confianza: **Alta**.
- `actividad_materia` → `detalle_grados`: Cardinalidad inferible **N:1** (`detalle_grados` 1:N `actividad_materia`) (Evidencia: la FK no está restringida a unicidad en `actividad_materia`). Confianza: **Alta**.
- `actividad_materia` → `docente`: Cardinalidad inferible **N:1** (`docente` 1:N `actividad_materia`) (Evidencia: la FK no está restringida a unicidad en `actividad_materia`). Confianza: **Alta**.
- `actividad_materia` → `evidencia_aprendizaje`: Cardinalidad inferible **N:1** (`evidencia_aprendizaje` 1:N `actividad_materia`) (Evidencia: la FK no está restringida a unicidad en `actividad_materia`). Confianza: **Alta**.
- `actividad_materia` → `periodo_academico`: Cardinalidad inferible **N:1** (`periodo_academico` 1:N `actividad_materia`) (Evidencia: la FK no está restringida a unicidad en `actividad_materia`). Confianza: **Alta**.

---

### 3.3 Tabla: `anio_lectivo`

- **Categoría Estructural:** entidad dependiente / configuración
- **Propósito Aparente:** Gestiona los ciclos lectivos escolares anuales por institución educativa.
- **Posibles Responsabilidades:** Delimitar el marco temporal de vigencia académica, calendario (A/B) y estado operativo del año.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_anio` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `calendario` | `character varying(10)` | SÍ | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `tipo_calendario` | `character(1)` | SÍ | `'A'::bpchar` | - | NO | NO | NO | NO |
| `estado` | `public.estado_periodo` | SÍ | `'ABIERTO'::public.estado_periodo` | - | NO | NO | NO | NO |
| `fecha_inicio` | `date` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_fin` | `date` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `año_lectivo_pkey` (`id_anio`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- `chk_calendario`: `((calendario)::text ~ '^[0-9]{4}(-[0-9]{4})?$'::text)`
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `competencias(id_anio)` referencian a `anio_lectivo(id_anio)`
- `configuracion_inscripcion(id_anio)` referencian a `anio_lectivo(id_anio)`
- `decision_promocion_directivo(id_anio_anterior)` referencian a `anio_lectivo(id_anio)`
- `detalle_grados(id_anio)` referencian a `anio_lectivo(id_anio)`
- `matricula(id_anio)` referencian a `anio_lectivo(id_anio)`
- `periodo_academico(id_anio)` referencian a `anio_lectivo(id_anio)`
- `registro_graduados(id_anio)` referencian a `anio_lectivo(id_anio)`
- **Cardinalidades Inferibles:**
- `anio_lectivo` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `anio_lectivo`) (Evidencia: la FK no está restringida a unicidad en `anio_lectivo`). Confianza: **Alta**.

---

### 3.4 Tabla: `auditoria_acciones_realizadas`

- **Categoría Estructural:** auditoría
- **Propósito Aparente:** Bitácora inmutable de operaciones atómicas ejecutadas durante sesiones de supervisión externa.
- **Posibles Responsabilidades:** Registrar la acción, recurso afectado, valores anteriores y nuevos, y estado de auditoría.
- **Total de Columnas:** 11

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_accion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_auditoria` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `fecha_accion` | `timestamp with time zone` | NO | `now()` | **IDX** | NO | NO | NO | SÍ |
| `modulo` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `tipo_accion` | `public.tipo_accion_auditoria` | NO | - | **IDX** | NO | NO | NO | SÍ |
| `accion` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `recurso_afectado` | `text` | NO | - | - | NO | NO | NO | NO |
| `id_usuario_afectado` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `valor_antiguo` | `jsonb` | SÍ | - | - | NO | NO | NO | NO |
| `valor_nuevo` | `jsonb` | SÍ | - | - | NO | NO | NO | NO |
| `motivo_cambio` | `text` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `auditoria_acciones_realizadas_pkey` (`id_accion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_auditoria` → `auditoria_supervision(id_auditoria)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- `chk_modificacion_completa`: `((tipo_accion <> 'MODIFICACION'::public.tipo_accion_auditoria) OR ((valor_antiguo IS NOT NULL) AND (valor_nuevo IS NOT NULL) AND (motivo_cambio IS NOT NULL)))`
- **Índices Declarados:**
- `idx_audit_acc_auditoria` (NON-UNIQUE) sobre `(id_auditoria)`
- `idx_audit_acc_fecha` (NON-UNIQUE) sobre `(fecha_accion)`
- `idx_audit_acc_tipo` (NON-UNIQUE) sobre `(tipo_accion)`
- `idx_audit_acc_usuario` (NON-UNIQUE) sobre `(id_usuario_afectado IS NOT NULL)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `auditoria_acciones_realizadas` → `auditoria_supervision`: Cardinalidad inferible **N:1** (`auditoria_supervision` 1:N `auditoria_acciones_realizadas`) (Evidencia: la FK no está restringida a unicidad en `auditoria_acciones_realizadas`). Confianza: **Alta**.

---

### 3.5 Tabla: `auditoria_supervision`

- **Categoría Estructural:** auditoría
- **Propósito Aparente:** Registra los procesos y periodos de auditoría o supervisión autorizados a un colegio.
- **Posibles Responsabilidades:** Gestionar el ciclo de vida de la supervisión, permisos concedidos, fechas límite y justificación de auditoría.
- **Total de Columnas:** 19

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_auditoria` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_admin_general` | `integer` | NO | - | **IDX** | NO | NO | NO | SÍ |
| `id_colegio` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_directivo_aprobador` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `motivo_solicitud` | `text` | NO | - | - | NO | NO | NO | NO |
| `fecha_solicitud` | `timestamp with time zone` | NO | `now()` | **IDX** | NO | NO | NO | SÍ |
| `tipo_supervision` | `public.tipo_supervision` | NO | - | - | NO | NO | NO | NO |
| `estado_supervision` | `public.estado_supervision` | NO | `'SOLICITADA'::public.estado_supervision` | **IDX** | NO | NO | NO | SÍ |
| `fecha_aprobacion` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `motivo_entrada` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_entrada` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_salida` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `duracion_maxima_minutos` | `integer` | NO | `60` | - | NO | NO | NO | NO |
| `revocado_por` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `fecha_revocacion` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `ip_admin` | `character varying(45)` | SÍ | - | - | NO | NO | NO | NO |
| `eliminado` | `boolean` | NO | `false` | - | NO | NO | NO | NO |
| `fecha_retencion_hasta` | `timestamp with time zone` | NO | `(now() + '5 years'::interval)` | - | NO | NO | NO | NO |
| `motivo_revocacion` | `text` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `auditoria_supervision_pkey` (`id_auditoria`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_directivo_aprobador` → `directivo(id)` [NO ACTION]
- FK `revocado_por` → `directivo(id)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_audit_sup_admin` (NON-UNIQUE) sobre `(id_admin_general)`
- `idx_audit_sup_colegio` (NON-UNIQUE) sobre `(id_colegio)`
- `idx_audit_sup_eliminado` (NON-UNIQUE) sobre `(eliminado = false)`
- `idx_audit_sup_estado` (NON-UNIQUE) sobre `(estado_supervision)`
- `idx_audit_sup_fecha` (NON-UNIQUE) sobre `(fecha_solicitud)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `auditoria_acciones_realizadas(id_auditoria)` referencian a `auditoria_supervision(id_auditoria)`
- `notificacion_supervision(id_auditoria)` referencian a `auditoria_supervision(id_auditoria)`
- **Cardinalidades Inferibles:**
- `auditoria_supervision` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `auditoria_supervision`) (Evidencia: la FK no está restringida a unicidad en `auditoria_supervision`). Confianza: **Alta**.
- `auditoria_supervision` → `directivo`: Cardinalidad inferible **N:1** (`directivo` 1:N `auditoria_supervision`) (Evidencia: la FK no está restringida a unicidad en `auditoria_supervision`). Confianza: **Alta**.
- `auditoria_supervision` → `directivo`: Cardinalidad inferible **N:1** (`directivo` 1:N `auditoria_supervision`) (Evidencia: la FK no está restringida a unicidad en `auditoria_supervision`). Confianza: **Alta**.

---

### 3.6 Tabla: `cierre_materia`

- **Categoría Estructural:** transaccional / histórico
- **Propósito Aparente:** Registra el congelamiento o cierre formal de calificaciones de una materia en un periodo académico específico.
- **Posibles Responsabilidades:** Impedir alteraciones retroactivas de notas mediante trigger y almacenar la justificación del cierre.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_cierremateria` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_detallegrado` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_periodo` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `estado` | `public.estado_cierre_materia` | NO | - | - | NO | NO | NO | NO |
| `fecha_cierre` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `justificacion_evidencias_pendientes` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `id_docente_cierre` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `cierre_materia_pkey` (`id_cierremateria`)
- **Claves Foráneas Salientes (FK):**
- FK `id_detallegrado` → `detalle_grados(id_detallegrado)` [NO ACTION]
- FK `id_docente_cierre` → `docente(id_docente)` [ON DELETE SET NULL]
- FK `id_periodo` → `periodo_academico(id_periodo)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `cierre_materia` → `detalle_grados`: Cardinalidad inferible **N:1** (`detalle_grados` 1:N `cierre_materia`) (Evidencia: la FK no está restringida a unicidad en `cierre_materia`). Confianza: **Alta**.
- `cierre_materia` → `docente`: Cardinalidad inferible **N:1** (`docente` 1:N `cierre_materia`) (Evidencia: la FK no está restringida a unicidad en `cierre_materia`). Confianza: **Alta**.
- `cierre_materia` → `periodo_academico`: Cardinalidad inferible **N:1** (`periodo_academico` 1:N `cierre_materia`) (Evidencia: la FK no está restringida a unicidad en `cierre_materia`). Confianza: **Alta**.

---

### 3.7 Tabla: `colegio`

- **Categoría Estructural:** entidad principal
- **Propósito Aparente:** Representa la institución educativa (tenant) en el esquema multi-inquilino.
- **Posibles Responsabilidades:** Centralizar los datos institucionales, código DANE, NIT, rectoría, estado de operación y clave de aislamiento de datos.
- **Total de Columnas:** 16

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_colegio` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `text` | NO | - | - | NO | NO | NO | NO |
| `tipo_colegio` | `character varying(20)` | NO | - | - | NO | NO | NO | NO |
| `sede` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `contacto` | `numeric` | NO | - | - | NO | NO | NO | NO |
| `correo` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `dane` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `tipo_calendario` | `character(1)` | SÍ | `'A'::bpchar` | - | NO | NO | NO | NO |
| `estado` | `public.estado_colegio` | NO | `'ACTIVO'::public.estado_colegio` | **IDX** | NO | NO | NO | SÍ |
| `fecha_registro` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |
| `motivo_rechazo` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_cambio_estado` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `escudo_url` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `colores` | `character varying(255)` | SÍ | - | - | NO | NO | NO | NO |
| `color_primario` | `character varying(50)` | SÍ | `NULL::character varying` | - | NO | NO | NO | NO |
| `color_secundario` | `character varying(50)` | SÍ | `NULL::character varying` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `colegio_pkey` (`id_colegio`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_colegio_estado` (NON-UNIQUE) sobre `(estado)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_materia(id_colegio)` referencian a `colegio(id_colegio)`
- `anio_lectivo(id_colegio)` referencian a `colegio(id_colegio)`
- `auditoria_supervision(id_colegio)` referencian a `colegio(id_colegio)`
- `colegio_version_curricular(id_colegio)` referencian a `colegio(id_colegio)`
- `competencias(id_colegio)` referencian a `colegio(id_colegio)`
- `configuracion_colegio(id_colegio)` referencian a `colegio(id_colegio)`
- `configuracion_inscripcion(id_colegio)` referencian a `colegio(id_colegio)`
- `configuracion_sistema(id_colegio)` referencian a `colegio(id_colegio)`
- `contrato_docente(id_colegio)` referencian a `colegio(id_colegio)`
- `criterio_evaluacion(id_colegio)` referencian a `colegio(id_colegio)`
- `decision_promocion_directivo(id_colegio)` referencian a `colegio(id_colegio)`
- `desempeno(id_colegio)` referencian a `colegio(id_colegio)`
- `detalle_grados(id_colegio)` referencian a `colegio(id_colegio)`
- `detalle_padrefamilia(id_colegio)` referencian a `colegio(id_colegio)`
- `directivo(id_colegio)` referencian a `colegio(id_colegio)`
- `docente(id_colegio)` referencian a `colegio(id_colegio)`
- `documento_matriculas(id_colegio)` referencian a `colegio(id_colegio)`
- `estudiante(id_colegio)` referencian a `colegio(id_colegio)`
- `evidencia_aprendizaje(id_colegio)` referencian a `colegio(id_colegio)`
- `grupos(id_colegio)` referencian a `colegio(id_colegio)`
- `jornada(id_colegio)` referencian a `colegio(id_colegio)`
- `materias(id_colegio)` referencian a `colegio(id_colegio)`
- `matricula(id_colegio)` referencian a `colegio(id_colegio)`
- `nivel_escolar(id_colegio)` referencian a `colegio(id_colegio)`
- `nota_criterio(id_colegio)` referencian a `colegio(id_colegio)`
- `notificacion_colegio(id_colegio)` referencian a `colegio(id_colegio)`
- `observacion_estudiante(id_colegio)` referencian a `colegio(id_colegio)`
- `padre_familia(id_colegio)` referencian a `colegio(id_colegio)`
- `periodo_academico(id_colegio)` referencian a `colegio(id_colegio)`
- `registro_asistencia(id_colegio)` referencian a `colegio(id_colegio)`
- `solicitud_traslado(id_colegio_destino)` referencian a `colegio(id_colegio)`
- `solicitud_traslado(id_colegio_origen)` referencian a `colegio(id_colegio)`
- `tickets_soporte(id_colegio)` referencian a `colegio(id_colegio)`
- `usuario(id_colegio)` referencian a `colegio(id_colegio)`
- `usuario_colegio(id_colegio)` referencian a `colegio(id_colegio)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.8 Tabla: `colegio_version_curricular`

- **Categoría Estructural:** configuración / relación
- **Propósito Aparente:** Asigna a un colegio una versión de lineamientos curriculares y catálogo de DBA.
- **Posibles Responsabilidades:** Vincular el colegio con el estándar de aprendizaje vigente seleccionado.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK, UQ, IDX** | NO | SÍ | SÍ | SÍ |
| `area` | `character varying(100)` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `grado` | `character varying(50)` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `version_curricular` | `character varying(20)` | NO | - | - | NO | NO | NO | NO |
| `fecha_asignacion` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `colegio_version_curricular_pkey` (`id`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `uq_colegio_area_grado` (`id_colegio, area, grado`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_colegio_version_colegio` (NON-UNIQUE) sobre `(id_colegio)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `colegio_version_curricular` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `colegio_version_curricular`) (Evidencia: la FK no está restringida a unicidad en `colegio_version_curricular`). Confianza: **Alta**.

---

### 3.9 Tabla: `competencias`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Define competencias académicas específicas asociadas a materias, grados y periodos en un colegio.
- **Posibles Responsabilidades:** Estructurar los objetivos formativos que sustentan la planeación de clase y evaluación.
- **Total de Columnas:** 10

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_competencia` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_anio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_grupo` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_materia` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_periodo` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `descripcion` | `text` | NO | `'Competencia pendiente por definir.'::text` | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `nombre` | `character varying(200)` | SÍ | - | - | NO | NO | NO | NO |
| `sync_uuid` | `uuid` | SÍ | - | **IDX** | NO | NO | NO | SÍ |
| `id_dimension` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `competencias_pkey` (`id_competencia`)
- **Claves Foráneas Salientes (FK):**
- FK `id_anio` → `anio_lectivo(id_anio)` [ON DELETE CASCADE]
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- FK `id_dimension` → `dimensiones_preescolar(id_dimension)` [ON DELETE SET NULL]
- FK `id_grupo` → `grupos(id_grupo)` [ON DELETE CASCADE]
- FK `id_materia` → `materias(id_materia)` [ON DELETE CASCADE]
- FK `id_periodo` → `periodo_academico(id_periodo)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_competencias_sync_uuid` (NON-UNIQUE) sobre `(sync_uuid)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_materia(id_competencia)` referencian a `competencias(id_competencia)`
- `evidencia_aprendizaje(id_competencia)` referencian a `competencias(id_competencia)`
- **Cardinalidades Inferibles:**
- `competencias` → `anio_lectivo`: Cardinalidad inferible **N:1** (`anio_lectivo` 1:N `competencias`) (Evidencia: la FK no está restringida a unicidad en `competencias`). Confianza: **Alta**.
- `competencias` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `competencias`) (Evidencia: la FK no está restringida a unicidad en `competencias`). Confianza: **Alta**.
- `competencias` → `dimensiones_preescolar`: Cardinalidad inferible **N:1** (`dimensiones_preescolar` 1:N `competencias`) (Evidencia: la FK no está restringida a unicidad en `competencias`). Confianza: **Alta**.
- `competencias` → `grupos`: Cardinalidad inferible **N:1** (`grupos` 1:N `competencias`) (Evidencia: la FK no está restringida a unicidad en `competencias`). Confianza: **Alta**.
- `competencias` → `materias`: Cardinalidad inferible **N:1** (`materias` 1:N `competencias`) (Evidencia: la FK no está restringida a unicidad en `competencias`). Confianza: **Alta**.
- `competencias` → `periodo_academico`: Cardinalidad inferible **N:1** (`periodo_academico` 1:N `competencias`) (Evidencia: la FK no está restringida a unicidad en `competencias`). Confianza: **Alta**.

---

### 3.10 Tabla: `configuracion_base`

- **Categoría Estructural:** catálogo / configuración
- **Propósito Aparente:** Catálogo de parámetros de configuración base disponibles para el sistema.
- **Posibles Responsabilidades:** Definir claves, descripciones y tipos de parámetros configurables transversales.
- **Total de Columnas:** 5

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_config_base` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `clave` | `character varying(100)` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `descripcion` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `valor_default` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `tipo` | `character varying(20)` | NO | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `configuracion_base_pkey` (`id_config_base`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `configuracion_base_clave_key` (`clave`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `configuracion_sistema(id_config_base)` referencian a `configuracion_base(id_config_base)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.11 Tabla: `configuracion_colegio`

- **Categoría Estructural:** configuración
- **Propósito Aparente:** Parámetros institucionales específicos para un colegio (1:1 con colegio).
- **Posibles Responsabilidades:** Configurar escala de calificación máxima, nota mínima aprobatoria, límites de inasistencias y reglas de promoción.
- **Total de Columnas:** 5

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_colegio` | `integer` | NO | - | **PK, FK** | SÍ | SÍ | NO | NO |
| `nota_minima` | `numeric(5,2)` | NO | `0` | - | NO | NO | NO | NO |
| `nota_maxima` | `numeric(5,2)` | NO | `5` | - | NO | NO | NO | NO |
| `nota_aprobacion` | `numeric(5,2)` | NO | `3` | - | NO | NO | NO | NO |
| `escala_modo` | `character varying(20)` | NO | `'AUTOMATICO'::character varying` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `configuracion_colegio_pkey` (`id_colegio`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `configuracion_colegio` → `colegio`: Cardinalidad inferible **1:1** (Evidencia: la FK forma parte exclusiva de la PK o posee restricción UNIQUE). Confianza: **Alta**.

---

### 3.12 Tabla: `configuracion_inscripcion`

- **Categoría Estructural:** configuración / entidad dependiente
- **Propósito Aparente:** Configura las fechas y políticas de inscripción y renovación de matrícula para un año lectivo.
- **Posibles Responsabilidades:** Controlar los plazos ordinarios/extraordinarios de admisión y costos asociados.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_configuracion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK, UQ, IDX** | NO | SÍ | SÍ | SÍ |
| `id_anio` | `integer` | NO | - | **FK, UQ** | NO | SÍ | SÍ | NO |
| `fecha_inicio` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `fecha_cierre` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `habilitada` | `boolean` | NO | `true` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `configuracion_inscripcion_pkey` (`id_configuracion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_anio` → `anio_lectivo(id_anio)` [ON DELETE CASCADE]
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `uq_colegio_anio` (`id_colegio, id_anio`)
- **Restricciones CHECK:**
- `chk_fechas`: `(fecha_cierre > fecha_inicio)`
- **Índices Declarados:**
- `idx_config_inscripcion_colegio` (NON-UNIQUE) sobre `(id_colegio)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `configuracion_inscripcion` → `anio_lectivo`: Cardinalidad inferible **N:1** (`anio_lectivo` 1:N `configuracion_inscripcion`) (Evidencia: la FK no está restringida a unicidad en `configuracion_inscripcion`). Confianza: **Alta**.
- `configuracion_inscripcion` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `configuracion_inscripcion`) (Evidencia: la FK no está restringida a unicidad en `configuracion_inscripcion`). Confianza: **Alta**.

---

### 3.13 Tabla: `configuracion_plataforma`

- **Categoría Estructural:** configuración
- **Propósito Aparente:** Variables globales del sistema operativo de la plataforma.
- **Posibles Responsabilidades:** Almacenar claves de configuración técnica global y flags de mantenimiento.
- **Total de Columnas:** 5

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `clave` | `character varying(100)` | NO | - | **PK** | SÍ | NO | NO | NO |
| `valor` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `descripcion` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `actualizado_por` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_actualizacion` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `configuracion_plataforma_pkey` (`clave`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.14 Tabla: `configuracion_sistema`

- **Categoría Estructural:** configuración
- **Propósito Aparente:** Valores específicos asignados a parámetros de configuración por cada colegio.
- **Posibles Responsabilidades:** Parametrizar el comportamiento funcional por institución.
- **Total de Columnas:** 5

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_configuracion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK, UQ** | NO | SÍ | SÍ | NO |
| `clave` | `character varying(100)` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `valor` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `id_config_base` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `configuracion_sistema_pkey` (`id_configuracion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_config_base` → `configuracion_base(id_config_base)` [NO ACTION]
- FK `id_colegio` → `colegio(id_colegio)` [ON UPDATE CASCADE ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `unique_configuracion` (`id_colegio, clave`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `configuracion_sistema` → `configuracion_base`: Cardinalidad inferible **N:1** (`configuracion_base` 1:N `configuracion_sistema`) (Evidencia: la FK no está restringida a unicidad en `configuracion_sistema`). Confianza: **Alta**.
- `configuracion_sistema` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `configuracion_sistema`) (Evidencia: la FK no está restringida a unicidad en `configuracion_sistema`). Confianza: **Alta**.

---

### 3.15 Tabla: `contrato_docente`

- **Categoría Estructural:** catálogo / entidad dependiente
- **Propósito Aparente:** Tipificación o condiciones de vinculación laboral de docentes por colegio.
- **Posibles Responsabilidades:** Registrar la modalidad de contrato, horas y condiciones contractuales.
- **Total de Columnas:** 3

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_contratodocente` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `estado` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `contrato_docente_pkey` (`id_contratodocente`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `docente(id_contratodocente)` referencian a `contrato_docente(id_contratodocente)`
- **Cardinalidades Inferibles:**
- `contrato_docente` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `contrato_docente`) (Evidencia: la FK no está restringida a unicidad en `contrato_docente`). Confianza: **Alta**.

---

### 3.16 Tabla: `criterio_evaluacion`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Desagrega una actividad evaluativa en criterios o rúbricas específicas.
- **Posibles Responsabilidades:** Permitir calificación analítica por competencias dentro de una misma actividad.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_criterio` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_actividadmateria` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_evidencia` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `descripcion` | `text` | NO | - | - | NO | NO | NO | NO |
| `porcentaje` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `criterio_evaluacion_pkey` (`id_criterio`)
- **Claves Foráneas Salientes (FK):**
- FK `id_actividadmateria` → `actividad_materia(id_actividadmateria)` [ON DELETE CASCADE]
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- FK `id_evidencia` → `evidencia_aprendizaje(id_evidencia)` [ON DELETE SET NULL]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `nota_criterio(id_criterio)` referencian a `criterio_evaluacion(id_criterio)`
- **Cardinalidades Inferibles:**
- `criterio_evaluacion` → `actividad_materia`: Cardinalidad inferible **N:1** (`actividad_materia` 1:N `criterio_evaluacion`) (Evidencia: la FK no está restringida a unicidad en `criterio_evaluacion`). Confianza: **Alta**.
- `criterio_evaluacion` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `criterio_evaluacion`) (Evidencia: la FK no está restringida a unicidad en `criterio_evaluacion`). Confianza: **Alta**.
- `criterio_evaluacion` → `evidencia_aprendizaje`: Cardinalidad inferible **N:1** (`evidencia_aprendizaje` 1:N `criterio_evaluacion`) (Evidencia: la FK no está restringida a unicidad en `criterio_evaluacion`). Confianza: **Alta**.

---

### 3.17 Tabla: `dba`

- **Categoría Estructural:** catálogo
- **Propósito Aparente:** Estándar oficial de Derechos Básicos de Aprendizaje formulados por el MEN.
- **Posibles Responsabilidades:** Almacenar el código, grado, área y enunciado de cada derecho básico de aprendizaje.
- **Total de Columnas:** 9

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_dba` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `area` | `character varying(100)` | NO | - | **UQ, IDX** | NO | NO | SÍ | SÍ |
| `grado` | `character varying(50)` | NO | - | **UQ, IDX** | NO | NO | SÍ | SÍ |
| `numero_dba` | `integer` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `enunciado` | `text` | NO | - | - | NO | NO | NO | NO |
| `version_curricular` | `character varying(20)` | NO | - | **UQ, IDX** | NO | NO | SÍ | SÍ |
| `estado` | `public.estado_dba` | NO | `'ACTIVO'::public.estado_dba` | - | NO | NO | NO | NO |
| `created_at` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |
| `updated_at` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `dba_pkey` (`id_dba`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `uq_dba_area_grado_num_version` (`area, grado, numero_dba, version_curricular`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_dba_area_grado` (NON-UNIQUE) sobre `(area, grado)`
- `idx_dba_estado` (NON-UNIQUE) sobre `(estado = 'ACTIVO'::public.estado_dba)`
- `idx_dba_version` (NON-UNIQUE) sobre `(version_curricular)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `dba_dimensiones_preescolar(id_dba)` referencian a `dba(id_dba)`
- `evidencias_dba(id_dba)` referencian a `dba(id_dba)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.18 Tabla: `dba_dimensiones_preescolar`

- **Categoría Estructural:** tabla puente
- **Propósito Aparente:** Asocia Derechos Básicos de Aprendizaje con las dimensiones del desarrollo infantil en preescolar.
- **Posibles Responsabilidades:** Mapear la relación N:M entre DBA de educación inicial y dimensiones formativas.
- **Total de Columnas:** 2

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_dba` | `integer` | NO | - | **PK, FK** | SÍ | SÍ | NO | NO |
| `id_dimension` | `integer` | NO | - | **PK, FK** | SÍ | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `dba_dimensiones_preescolar_pkey` (`id_dba, id_dimension`)
- **Claves Foráneas Salientes (FK):**
- FK `id_dba` → `dba(id_dba)` [ON DELETE CASCADE]
- FK `id_dimension` → `dimensiones_preescolar(id_dimension)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `dba_dimensiones_preescolar` → `dba`: Cardinalidad inferible **N:1** (`dba` 1:N `dba_dimensiones_preescolar`) (Evidencia: la FK no está restringida a unicidad en `dba_dimensiones_preescolar`). Confianza: **Alta**.
- `dba_dimensiones_preescolar` → `dimensiones_preescolar`: Cardinalidad inferible **N:1** (`dimensiones_preescolar` 1:N `dba_dimensiones_preescolar`) (Evidencia: la FK no está restringida a unicidad en `dba_dimensiones_preescolar`). Confianza: **Alta**.

---

### 3.19 Tabla: `decision_promocion_directivo`

- **Categoría Estructural:** transaccional / histórico
- **Propósito Aparente:** Almacena la resolución oficial de promoción escolar tomada por directivos/comité de evaluación.
- **Posibles Responsabilidades:** Formalizar si un estudiante es promovido, retenido o condicionado, con acta y justificación.
- **Total de Columnas:** 11

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_decision` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_estudiante` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_colegio` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_anio_anterior` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `resultado_calculado` | `public.resultado_consolidado_anual` | NO | - | - | NO | NO | NO | NO |
| `decision_tomada` | `public.decision_promocion_tipo` | NO | - | - | NO | NO | NO | NO |
| `id_grado_anterior` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_grado_asignado` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_usuario_decision` | `integer` | NO | - | - | NO | NO | NO | NO |
| `fecha_decision` | `timestamp with time zone` | SÍ | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |
| `observacion` | `text` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `decision_promocion_directivo_pkey` (`id_decision`)
- **Claves Foráneas Salientes (FK):**
- FK `id_anio_anterior` → `anio_lectivo(id_anio)` [ON DELETE CASCADE]
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- FK `id_estudiante` → `estudiante(id_estudiante)` [ON DELETE CASCADE]
- FK `id_grado_anterior` → `grados(id_grado)` [ON DELETE SET NULL]
- FK `id_grado_asignado` → `grados(id_grado)` [ON DELETE SET NULL]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_decision_promocion_anio` (NON-UNIQUE) sobre `(id_anio_anterior)`
- `idx_decision_promocion_estudiante` (NON-UNIQUE) sobre `(id_estudiante, id_colegio)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `decision_promocion_directivo` → `anio_lectivo`: Cardinalidad inferible **N:1** (`anio_lectivo` 1:N `decision_promocion_directivo`) (Evidencia: la FK no está restringida a unicidad en `decision_promocion_directivo`). Confianza: **Alta**.
- `decision_promocion_directivo` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `decision_promocion_directivo`) (Evidencia: la FK no está restringida a unicidad en `decision_promocion_directivo`). Confianza: **Alta**.
- `decision_promocion_directivo` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `decision_promocion_directivo`) (Evidencia: la FK no está restringida a unicidad en `decision_promocion_directivo`). Confianza: **Alta**.
- `decision_promocion_directivo` → `grados`: Cardinalidad inferible **N:1** (`grados` 1:N `decision_promocion_directivo`) (Evidencia: la FK no está restringida a unicidad en `decision_promocion_directivo`). Confianza: **Alta**.
- `decision_promocion_directivo` → `grados`: Cardinalidad inferible **N:1** (`grados` 1:N `decision_promocion_directivo`) (Evidencia: la FK no está restringida a unicidad en `decision_promocion_directivo`). Confianza: **Alta**.

---

### 3.20 Tabla: `desempeno`

- **Categoría Estructural:** entidad dependiente / configuración
- **Propósito Aparente:** Descriptores cualitativos de desempeño asociados a actividades evaluativas.
- **Posibles Responsabilidades:** Almacenar textos de retroalimentación cualitativa para boletines.
- **Total de Columnas:** 4

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_desempeno` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `descripcion` | `text` | NO | - | - | NO | NO | NO | NO |
| `id_actividadmateria` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `desempeno_pkey` (`id_desempeno`)
- **Claves Foráneas Salientes (FK):**
- FK `id_actividadmateria` → `actividad_materia(id_actividadmateria)` [NO ACTION]
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `desempeno` → `actividad_materia`: Cardinalidad inferible **N:1** (`actividad_materia` 1:N `desempeno`) (Evidencia: la FK no está restringida a unicidad en `desempeno`). Confianza: **Alta**.
- `desempeno` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `desempeno`) (Evidencia: la FK no está restringida a unicidad en `desempeno`). Confianza: **Alta**.

---

### 3.21 Tabla: `detalle_grados`

- **Categoría Estructural:** tabla puente / relación
- **Propósito Aparente:** Asignación académica de carga horaria: vincula materia, grupo, docente y año lectivo.
- **Posibles Responsabilidades:** Materializar la distribución académica que docentes dictan en qué grupos y materias.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_detallegrado` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_materia` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_docente` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_grupo` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_anio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `detalle_grados_pkey` (`id_detallegrado`)
- **Claves Foráneas Salientes (FK):**
- FK `id_anio` → `anio_lectivo(id_anio)` [ON DELETE CASCADE]
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_docente` → `docente(id_docente)` [NO ACTION]
- FK `id_materia` → `materias(id_materia)` [NO ACTION]
- FK `id_grupo` → `grupos(id_grupo)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_materia(id_detallegrado)` referencian a `detalle_grados(id_detallegrado)`
- `cierre_materia(id_detallegrado)` referencian a `detalle_grados(id_detallegrado)`
- `observacion_estudiante(id_detallegrado)` referencian a `detalle_grados(id_detallegrado)`
- `registro_asistencia(id_detallegrado)` referencian a `detalle_grados(id_detallegrado)`
- `resultado_academico(id_detallegrado)` referencian a `detalle_grados(id_detallegrado)`
- **Cardinalidades Inferibles:**
- `detalle_grados` → `anio_lectivo`: Cardinalidad inferible **N:1** (`anio_lectivo` 1:N `detalle_grados`) (Evidencia: la FK no está restringida a unicidad en `detalle_grados`). Confianza: **Alta**.
- `detalle_grados` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `detalle_grados`) (Evidencia: la FK no está restringida a unicidad en `detalle_grados`). Confianza: **Alta**.
- `detalle_grados` → `docente`: Cardinalidad inferible **N:1** (`docente` 1:N `detalle_grados`) (Evidencia: la FK no está restringida a unicidad en `detalle_grados`). Confianza: **Alta**.
- `detalle_grados` → `materias`: Cardinalidad inferible **N:1** (`materias` 1:N `detalle_grados`) (Evidencia: la FK no está restringida a unicidad en `detalle_grados`). Confianza: **Alta**.
- `detalle_grados` → `grupos`: Cardinalidad inferible **N:1** (`grupos` 1:N `detalle_grados`) (Evidencia: la FK no está restringida a unicidad en `detalle_grados`). Confianza: **Alta**.

---

### 3.22 Tabla: `detalle_padrefamilia`

- **Categoría Estructural:** tabla puente / relación
- **Propósito Aparente:** Vincula a un acudiente/padre de familia con sus estudiantes asociados por colegio.
- **Posibles Responsabilidades:** Gestionar el parentesco, representación legal y custodia escolar de estudiantes.
- **Total de Columnas:** 4

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_detallepadrefamilia` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_padrefamilia` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_estudiante` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `detalle_padrefamilia_pkey` (`id_detallepadrefamilia`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_estudiante` → `estudiante(id_estudiante)` [NO ACTION]
- FK `id_padrefamilia` → `padre_familia(id_padrefamilia)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_detalle_padrefamilia_padrefamilia` (NON-UNIQUE) sobre `(id_padrefamilia)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `detalle_padrefamilia` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `detalle_padrefamilia`) (Evidencia: la FK no está restringida a unicidad en `detalle_padrefamilia`). Confianza: **Alta**.
- `detalle_padrefamilia` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `detalle_padrefamilia`) (Evidencia: la FK no está restringida a unicidad en `detalle_padrefamilia`). Confianza: **Alta**.
- `detalle_padrefamilia` → `padre_familia`: Cardinalidad inferible **N:1** (`padre_familia` 1:N `detalle_padrefamilia`) (Evidencia: la FK no está restringida a unicidad en `detalle_padrefamilia`). Confianza: **Alta**.

---

### 3.23 Tabla: `dimensiones_preescolar`

- **Categoría Estructural:** catálogo
- **Propósito Aparente:** Catálogo de dimensiones de desarrollo para el nivel preescolar (cognitiva, comunicativa, etc.).
- **Posibles Responsabilidades:** Estandarizar los ejes de valoración en primera infancia.
- **Total de Columnas:** 2

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_dimension` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(100)` | NO | - | **UQ** | NO | NO | SÍ | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `dimensiones_preescolar_pkey` (`id_dimension`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `dimensiones_preescolar_nombre_key` (`nombre`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `competencias(id_dimension)` referencian a `dimensiones_preescolar(id_dimension)`
- `dba_dimensiones_preescolar(id_dimension)` referencian a `dimensiones_preescolar(id_dimension)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.24 Tabla: `directivo`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Perfil y datos funcionales de directivos y administrativos escolares.
- **Posibles Responsabilidades:** Registrar cargo directivo, vinculación a colegio y datos de contacto profesional.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_usuario` | `integer` | SÍ | - | **UQ** | NO | NO | SÍ | NO |
| `cargo` | `character varying(100)` | SÍ | - | - | NO | NO | NO | NO |
| `estado` | `public.estado_usuario_sistema` | NO | `'ACTIVO'::public.estado_usuario_sistema` | - | NO | NO | NO | NO |
| `fecha_vinculacion` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |
| `fecha_desvinculacion` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `directivo_pkey` (`id`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- **Restricciones UNIQUE:**
- `directivo_id_usuario_key` (`id_usuario`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `auditoria_supervision(id_directivo_aprobador)` referencian a `directivo(id)`
- `auditoria_supervision(revocado_por)` referencian a `directivo(id)`
- `notificacion_colegio(id_directivo)` referencian a `directivo(id)`
- `notificacion_supervision(id_directivo)` referencian a `directivo(id)`
- `sancion(id_directivo)` referencian a `directivo(id)`
- **Cardinalidades Inferibles:**
- `directivo` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `directivo`) (Evidencia: la FK no está restringida a unicidad en `directivo`). Confianza: **Alta**.

---

### 3.25 Tabla: `docente`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Perfil y datos académicos del cuerpo docente institucional.
- **Posibles Responsabilidades:** Registrar especialidad docente, escalafón, vinculación contractual y pertenencia institucional.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_docente` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `apellido` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `id_contratodocente` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK, UQ** | NO | SÍ | SÍ | NO |
| `id_usuario` | `integer` | SÍ | - | **UQ** | NO | NO | SÍ | NO |
| `estado` | `character varying(20)` | NO | `'ACTIVO'::character varying` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `docente_pkey` (`id_docente`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- FK `id_contratodocente` → `contrato_docente(id_contratodocente)` [NO ACTION]
- **Restricciones UNIQUE:**
- `docente_id_usuario_id_colegio_key` (`id_usuario, id_colegio`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_materia(id_docente_creador)` referencian a `docente(id_docente)`
- `cierre_materia(id_docente_cierre)` referencian a `docente(id_docente)`
- `detalle_grados(id_docente)` referencian a `docente(id_docente)`
- `grupos(id_docente)` referencian a `docente(id_docente)`
- `resultado_academico(id_docente)` referencian a `docente(id_docente)`
- **Cardinalidades Inferibles:**
- `docente` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `docente`) (Evidencia: la FK no está restringida a unicidad en `docente`). Confianza: **Alta**.
- `docente` → `contrato_docente`: Cardinalidad inferible **N:1** (`contrato_docente` 1:N `docente`) (Evidencia: la FK no está restringida a unicidad en `docente`). Confianza: **Alta**.

---

### 3.26 Tabla: `documento_matriculas`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Expediente digital de documentos y anexos asociados a una matrícula estudiantil.
- **Posibles Responsabilidades:** Almacenar URLs de archivos, tipo de soporte, estado de validación y caducidad documental.
- **Total de Columnas:** 14

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_documento` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_matricula` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `tipo_documento` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `url` | `text` | NO | - | - | NO | NO | NO | NO |
| `estado` | `public.estado_documento` | NO | `'PENDIENTE'::public.estado_documento` | - | NO | NO | NO | NO |
| `fecha` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `version` | `integer` | NO | `1` | - | NO | NO | NO | NO |
| `fecha_expedicion` | `date` | SÍ | - | - | NO | NO | NO | NO |
| `estado_renovacion` | `public.estado_renovacion_documento` | SÍ | `'VIGENTE'::public.estado_renovacion_documento` | - | NO | NO | NO | NO |
| `contenido` | `bytea` | SÍ | - | - | NO | NO | NO | NO |
| `mime_type` | `character varying(100)` | SÍ | - | - | NO | NO | NO | NO |
| `nombre_original` | `character varying(255)` | SÍ | - | - | NO | NO | NO | NO |
| `tamano_bytes` | `integer` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `documento_matriculas_pkey` (`id_documento`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_matricula` → `matricula(id_matricula)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `documento_matriculas` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `documento_matriculas`) (Evidencia: la FK no está restringida a unicidad en `documento_matriculas`). Confianza: **Alta**.
- `documento_matriculas` → `matricula`: Cardinalidad inferible **N:1** (`matricula` 1:N `documento_matriculas`) (Evidencia: la FK no está restringida a unicidad en `documento_matriculas`). Confianza: **Alta**.

---

### 3.27 Tabla: `email_change_tokens`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Gestión de tokens criptográficos para confirmación de cambio de correo electrónico.
- **Posibles Responsabilidades:** Garantizar verificación de identidad antes de conmutar emails de usuario.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_usuario` | `integer` | SÍ | - | **IDX** | NO | NO | NO | SÍ |
| `nuevo_email` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `codigo` | `character varying(6)` | NO | - | **IDX** | NO | NO | NO | SÍ |
| `expires_at` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `used` | `boolean` | SÍ | `false` | - | NO | NO | NO | NO |
| `created_at` | `timestamp with time zone` | SÍ | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `email_change_tokens_pkey` (`id`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_email_change_codigo` (NON-UNIQUE) sobre `(codigo)`
- `idx_email_change_usuario` (NON-UNIQUE) sobre `(id_usuario)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.28 Tabla: `escala_valoracion`

- **Categoría Estructural:** catálogo / configuración
- **Propósito Aparente:** Rango de calificaciones numéricas y sus equivalencias cualitativas (Superior, Alto, Básico, Bajo).
- **Posibles Responsabilidades:** Definir límites mínimo/máximo y descriptores de escala institucional según Decreto 1290.
- **Total de Columnas:** 5

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_escalavaloracion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nivel` | `character varying(20)` | NO | - | - | NO | NO | NO | NO |
| `valor_minimo` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `valor_maximo` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `escala_valoracion_pkey` (`id_escalavaloracion`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `notas_actividad(id_escalavaloracion)` referencian a `escala_valoracion(id_escalavaloracion)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.29 Tabla: `estudiante`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Perfil del alumno, historial personal y vinculación con la institución educativa.
- **Posibles Responsabilidades:** Almacenar datos demográficos, código de estudiante, estado disciplinario y vinculación a colegio.
- **Total de Columnas:** 9

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_estudiante` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `apellido` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `codigo` | `character varying(20)` | NO | - | - | NO | NO | NO | NO |
| `id_nivel` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_usuario` | `integer` | SÍ | - | **UQ** | NO | NO | SÍ | NO |
| `estado` | `public.estado_estudiante` | SÍ | `'ACTIVO'::public.estado_estudiante` | - | NO | NO | NO | NO |
| `motivo_estado` | `text` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `estudiante_pkey` (`id_estudiante`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `estudiante_id_usuario_key` (`id_usuario`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `decision_promocion_directivo(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `detalle_padrefamilia(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `matricula(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `nota_criterio(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `notas_actividad(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `observacion_estudiante(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `registro_asistencia(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `registro_graduados(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `resultado_academico(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `sancion(id_estudiante)` referencian a `estudiante(id_estudiante)`
- `tickets_soporte(id_estudiante)` referencian a `estudiante(id_estudiante)`
- **Cardinalidades Inferibles:**
- `estudiante` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `estudiante`) (Evidencia: la FK no está restringida a unicidad en `estudiante`). Confianza: **Alta**.

---

### 3.30 Tabla: `evidencia_aprendizaje`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Manifestaciones observables de aprendizaje vinculadas a competencias institucionales y DBA.
- **Posibles Responsabilidades:** Conectar la planeación docente con descriptores específicos de logro.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_evidencia` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_competencia` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `descripcion` | `text` | NO | - | - | NO | NO | NO | NO |
| `orden` | `integer` | NO | `0` | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_evidencia_dba` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `evidencia_aprendizaje_pkey` (`id_evidencia`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- FK `id_competencia` → `competencias(id_competencia)` [ON DELETE CASCADE]
- FK `id_evidencia_dba` → `evidencias_dba(id_evidencia_dba)` [ON DELETE SET NULL]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_evidencia_aprendizaje_dba` (NON-UNIQUE) sobre `(id_evidencia_dba IS NOT NULL)`
- `idx_evidencia_competencia` (NON-UNIQUE) sobre `(id_competencia)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_materia(id_evidencia)` referencian a `evidencia_aprendizaje(id_evidencia)`
- `criterio_evaluacion(id_evidencia)` referencian a `evidencia_aprendizaje(id_evidencia)`
- **Cardinalidades Inferibles:**
- `evidencia_aprendizaje` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `evidencia_aprendizaje`) (Evidencia: la FK no está restringida a unicidad en `evidencia_aprendizaje`). Confianza: **Alta**.
- `evidencia_aprendizaje` → `competencias`: Cardinalidad inferible **N:1** (`competencias` 1:N `evidencia_aprendizaje`) (Evidencia: la FK no está restringida a unicidad en `evidencia_aprendizaje`). Confianza: **Alta**.
- `evidencia_aprendizaje` → `evidencias_dba`: Cardinalidad inferible **N:1** (`evidencias_dba` 1:N `evidencia_aprendizaje`) (Evidencia: la FK no está restringida a unicidad en `evidencia_aprendizaje`). Confianza: **Alta**.

---

### 3.31 Tabla: `evidencias_dba`

- **Categoría Estructural:** catálogo / entidad dependiente
- **Propósito Aparente:** Evidencias oficiales desagregadas de cada Derecho Básico de Aprendizaje del MEN.
- **Posibles Responsabilidades:** Catalogar las conductas o desempeños esperados de cada DBA.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_evidencia_dba` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_dba` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `descripcion` | `text` | NO | - | - | NO | NO | NO | NO |
| `orden` | `integer` | NO | `1` | - | NO | NO | NO | NO |
| `estado` | `public.estado_dba` | NO | `'ACTIVO'::public.estado_dba` | - | NO | NO | NO | NO |
| `created_at` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `evidencias_dba_pkey` (`id_evidencia_dba`)
- **Claves Foráneas Salientes (FK):**
- FK `id_dba` → `dba(id_dba)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_evidencias_dba_dba` (NON-UNIQUE) sobre `(id_dba)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_evidencia_dba(id_evidencia_dba)` referencian a `evidencias_dba(id_evidencia_dba)`
- `evidencia_aprendizaje(id_evidencia_dba)` referencian a `evidencias_dba(id_evidencia_dba)`
- **Cardinalidades Inferibles:**
- `evidencias_dba` → `dba`: Cardinalidad inferible **N:1** (`dba` 1:N `evidencias_dba`) (Evidencia: la FK no está restringida a unicidad en `evidencias_dba`). Confianza: **Alta**.

---

### 3.32 Tabla: `grados`

- **Categoría Estructural:** entidad dependiente / configuración
- **Propósito Aparente:** Definición de grados escolares ofrecidos por institución, jornada y capacidad de cupos.
- **Posibles Responsabilidades:** Estructurar la oferta de grados educativos y cupos totales proyectados.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_grado` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nivel` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `tipo_grado` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `id_jornada` | `integer` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | - | NO | NO | NO | NO |
| `cupos_totales` | `integer` | NO | `30` | - | NO | NO | NO | NO |
| `seccion` | `character varying(10)` | SÍ | `'A'::character varying` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `grados_pkey` (`id_grado`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `decision_promocion_directivo(id_grado_anterior)` referencian a `grados(id_grado)`
- `decision_promocion_directivo(id_grado_asignado)` referencian a `grados(id_grado)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.33 Tabla: `grupos`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Salones o aulas de clase formalmente constituidas (ej. 10-A, 11-B).
- **Posibles Responsabilidades:** Organizar a los estudiantes por sección, jornada, nivel y asignar director de grupo.
- **Total de Columnas:** 8

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_grupo` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_nivel` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_jornada` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_seccion` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `cupos_totales` | `integer` | NO | `0` | - | NO | NO | NO | NO |
| `id_tipo_grado` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_docente` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `grupos_pkey` (`id_grupo`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_jornada` → `jornada(id_jornada)` [NO ACTION]
- FK `id_nivel` → `nivel_escolar(id_nivel)` [NO ACTION]
- FK `id_seccion` → `secciones(id_seccion)` [NO ACTION]
- FK `id_tipo_grado` → `tipo_grado(id_tipo_grado)` [NO ACTION]
- FK `id_docente` → `docente(id_docente)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- `chk_cupos`: `(cupos_totales >= 0)`
- **Índices Declarados:**
- `idx_grupos_tipo_grado` (NON-UNIQUE) sobre `(id_tipo_grado)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `competencias(id_grupo)` referencian a `grupos(id_grupo)`
- `detalle_grados(id_grupo)` referencian a `grupos(id_grupo)`
- `matricula(id_grupo)` referencian a `grupos(id_grupo)`
- **Cardinalidades Inferibles:**
- `grupos` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `grupos`) (Evidencia: la FK no está restringida a unicidad en `grupos`). Confianza: **Alta**.
- `grupos` → `jornada`: Cardinalidad inferible **N:1** (`jornada` 1:N `grupos`) (Evidencia: la FK no está restringida a unicidad en `grupos`). Confianza: **Alta**.
- `grupos` → `nivel_escolar`: Cardinalidad inferible **N:1** (`nivel_escolar` 1:N `grupos`) (Evidencia: la FK no está restringida a unicidad en `grupos`). Confianza: **Alta**.
- `grupos` → `secciones`: Cardinalidad inferible **N:1** (`secciones` 1:N `grupos`) (Evidencia: la FK no está restringida a unicidad en `grupos`). Confianza: **Alta**.
- `grupos` → `tipo_grado`: Cardinalidad inferible **N:1** (`tipo_grado` 1:N `grupos`) (Evidencia: la FK no está restringida a unicidad en `grupos`). Confianza: **Alta**.
- `grupos` → `docente`: Cardinalidad inferible **N:1** (`docente` 1:N `grupos`) (Evidencia: la FK no está restringida a unicidad en `grupos`). Confianza: **Alta**.

---

### 3.34 Tabla: `jornada`

- **Categoría Estructural:** catálogo / entidad dependiente
- **Propósito Aparente:** Jornadas escolares administradas por cada institución (Mañana, Tarde, Única, Nocturna).
- **Posibles Responsabilidades:** Definir tipos de turnos lectivos por colegio.
- **Total de Columnas:** 3

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_jornada` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `public.tipo_jornada` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `jornada_pkey` (`id_jornada`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `grupos(id_jornada)` referencian a `jornada(id_jornada)`
- **Cardinalidades Inferibles:**
- `jornada` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `jornada`) (Evidencia: la FK no está restringida a unicidad en `jornada`). Confianza: **Alta**.

---

### 3.35 Tabla: `materias`

- **Categoría Estructural:** catálogo / entidad dependiente
- **Propósito Aparente:** Catálogo de asignaturas o áreas curriculares institucionales.
- **Posibles Responsabilidades:** Registrar nombres de materias curriculares activas por colegio.
- **Total de Columnas:** 3

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_materia` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `materias_pkey` (`id_materia`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `competencias(id_materia)` referencian a `materias(id_materia)`
- `detalle_grados(id_materia)` referencian a `materias(id_materia)`
- **Cardinalidades Inferibles:**
- `materias` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `materias`) (Evidencia: la FK no está restringida a unicidad en `materias`). Confianza: **Alta**.

---

### 3.36 Tabla: `matricula`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Formalización de la vinculación académica de un estudiante a un grupo en un año lectivo.
- **Posibles Responsabilidades:** Gestionar el estado de matrícula, tipo (regular, traslado, repitente), folio y trazabilidad administrativa.
- **Total de Columnas:** 21

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_matricula` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_estudiante` | `integer` | SÍ | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_nivel` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_anio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `estado` | `public.estado_matricula` | NO | - | - | NO | NO | NO | NO |
| `correo_padre` | `character varying(100)` | SÍ | - | - | NO | NO | NO | NO |
| `tiene_discapacidad` | `boolean` | SÍ | `false` | - | NO | NO | NO | NO |
| `es_extranjero` | `boolean` | SÍ | `false` | - | NO | NO | NO | NO |
| `token_seguimiento` | `uuid` | NO | `public.uuid_generate_v4()` | **UQ** | NO | NO | SÍ | NO |
| `id_grupo` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `motivo_cancelacion` | `character varying(100)` | SÍ | - | - | NO | NO | NO | NO |
| `detalles_cancelacion` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `es_traslado` | `boolean` | SÍ | `false` | - | NO | NO | NO | NO |
| `fecha_aprobacion` | `timestamp without time zone` | SÍ | - | - | NO | NO | NO | NO |
| `tipo` | `public.tipo_matricula` | NO | `'REGULAR'::public.tipo_matricula` | - | NO | NO | NO | NO |
| `motivo` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `observaciones` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `id_usuario_responsable` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_creacion` | `timestamp without time zone` | SÍ | `now()` | - | NO | NO | NO | NO |
| `id_ticket` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `matricula_pkey` (`id_matricula`)
- **Claves Foráneas Salientes (FK):**
- FK `id_anio` → `anio_lectivo(id_anio)` [ON UPDATE CASCADE ON DELETE RESTRICT]
- FK `id_estudiante` → `estudiante(id_estudiante)` [ON UPDATE CASCADE ON DELETE RESTRICT]
- FK `id_grupo` → `grupos(id_grupo)` [NO ACTION]
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_nivel` → `nivel_escolar(id_nivel)` [NO ACTION]
- FK `id_ticket` → `tickets_soporte(id_ticket)` [ON DELETE SET NULL]
- **Restricciones UNIQUE:**
- `matricula_token_key` (`token_seguimiento`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_matricula_estudiante` (NON-UNIQUE) sobre `(id_estudiante)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `documento_matriculas(id_matricula)` referencian a `matricula(id_matricula)`
- `solicitud_traslado(id_matricula)` referencian a `matricula(id_matricula)`
- **Cardinalidades Inferibles:**
- `matricula` → `anio_lectivo`: Cardinalidad inferible **N:1** (`anio_lectivo` 1:N `matricula`) (Evidencia: la FK no está restringida a unicidad en `matricula`). Confianza: **Alta**.
- `matricula` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `matricula`) (Evidencia: la FK no está restringida a unicidad en `matricula`). Confianza: **Alta**.
- `matricula` → `grupos`: Cardinalidad inferible **N:1** (`grupos` 1:N `matricula`) (Evidencia: la FK no está restringida a unicidad en `matricula`). Confianza: **Alta**.
- `matricula` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `matricula`) (Evidencia: la FK no está restringida a unicidad en `matricula`). Confianza: **Alta**.
- `matricula` → `nivel_escolar`: Cardinalidad inferible **N:1** (`nivel_escolar` 1:N `matricula`) (Evidencia: la FK no está restringida a unicidad en `matricula`). Confianza: **Alta**.
- `matricula` → `tickets_soporte`: Cardinalidad inferible **N:1** (`tickets_soporte` 1:N `matricula`) (Evidencia: la FK no está restringida a unicidad en `matricula`). Confianza: **Alta**.

---

### 3.37 Tabla: `nivel_escolar`

- **Categoría Estructural:** catálogo / entidad dependiente
- **Propósito Aparente:** Niveles educativos institucionales (Preescolar, Básica Primaria, Básica Secundaria, Media).
- **Posibles Responsabilidades:** Estructurar los bloques de formación según la Ley 115.
- **Total de Columnas:** 3

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_nivel` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `nivel_escolar_pkey` (`id_nivel`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `grupos(id_nivel)` referencian a `nivel_escolar(id_nivel)`
- `matricula(id_nivel)` referencian a `nivel_escolar(id_nivel)`
- `tipo_grado(id_nivel)` referencian a `nivel_escolar(id_nivel)`
- **Cardinalidades Inferibles:**
- `nivel_escolar` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `nivel_escolar`) (Evidencia: la FK no está restringida a unicidad en `nivel_escolar`). Confianza: **Alta**.

---

### 3.38 Tabla: `nota_criterio`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Registro detallado de calificaciones por criterio de evaluación analítico.
- **Posibles Responsabilidades:** Almacenar la nota específica que un estudiante obtiene en una rúbrica concreta.
- **Total de Columnas:** 5

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_nota_criterio` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_criterio` | `integer` | NO | - | **FK, UQ** | NO | SÍ | SÍ | NO |
| `id_estudiante` | `integer` | NO | - | **FK, UQ** | NO | SÍ | SÍ | NO |
| `nota` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `nota_criterio_pkey` (`id_nota_criterio`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- FK `id_criterio` → `criterio_evaluacion(id_criterio)` [ON DELETE CASCADE]
- FK `id_estudiante` → `estudiante(id_estudiante)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `nota_criterio_id_criterio_id_estudiante_key` (`id_criterio, id_estudiante`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `nota_criterio` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `nota_criterio`) (Evidencia: la FK no está restringida a unicidad en `nota_criterio`). Confianza: **Alta**.
- `nota_criterio` → `criterio_evaluacion`: Cardinalidad inferible **N:1** (`criterio_evaluacion` 1:N `nota_criterio`) (Evidencia: la FK no está restringida a unicidad en `nota_criterio`). Confianza: **Alta**.
- `nota_criterio` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `nota_criterio`) (Evidencia: la FK no está restringida a unicidad en `nota_criterio`). Confianza: **Alta**.

---

### 3.39 Tabla: `notas_actividad`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Calificación cuantitativa asignada a un estudiante en una actividad evaluativa.
- **Posibles Responsabilidades:** Almacenar la nota numérica, referencia a escala y observaciones evaluativas.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_notaactividad` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_actividadmateria` | `integer` | NO | - | **FK, UQ, IDX** | NO | SÍ | SÍ | SÍ |
| `id_estudiante` | `integer` | NO | - | **FK, UQ, IDX** | NO | SÍ | SÍ | SÍ |
| `id_escalavaloracion` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `nota` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `notas_actividad_pkey` (`id_notaactividad`)
- **Claves Foráneas Salientes (FK):**
- FK `id_actividadmateria` → `actividad_materia(id_actividadmateria)` [ON DELETE CASCADE]
- FK `id_escalavaloracion` → `escala_valoracion(id_escalavaloracion)` [NO ACTION]
- FK `id_estudiante` → `estudiante(id_estudiante)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `unique_actividad_estudiante` (`id_actividadmateria, id_estudiante`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_notas_actividad` (NON-UNIQUE) sobre `(id_actividadmateria)`
- `idx_notas_estudiante` (NON-UNIQUE) sobre `(id_estudiante)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `notas_actividad` → `actividad_materia`: Cardinalidad inferible **N:1** (`actividad_materia` 1:N `notas_actividad`) (Evidencia: la FK no está restringida a unicidad en `notas_actividad`). Confianza: **Alta**.
- `notas_actividad` → `escala_valoracion`: Cardinalidad inferible **N:1** (`escala_valoracion` 1:N `notas_actividad`) (Evidencia: la FK no está restringida a unicidad en `notas_actividad`). Confianza: **Alta**.
- `notas_actividad` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `notas_actividad`) (Evidencia: la FK no está restringida a unicidad en `notas_actividad`). Confianza: **Alta**.

---

### 3.40 Tabla: `notificacion_colegio`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Comunicaciones y alertas dirigidas al personal administrativo o directivo de un colegio.
- **Posibles Responsabilidades:** Registrar avisos de sistema, fecha de lectura y prioridad.
- **Total de Columnas:** 9

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_notificacion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_directivo` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `tipo` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `mensaje` | `text` | NO | - | - | NO | NO | NO | NO |
| `estado_anterior` | `character varying(20)` | SÍ | - | - | NO | NO | NO | NO |
| `estado_nuevo` | `character varying(20)` | SÍ | - | - | NO | NO | NO | NO |
| `leida` | `boolean` | NO | `false` | - | NO | NO | NO | NO |
| `fecha_notificacion` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `notificacion_colegio_pkey` (`id_notificacion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_directivo` → `directivo(id)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_notif_col_colegio` (NON-UNIQUE) sobre `(id_colegio)`
- `idx_notif_col_directivo` (NON-UNIQUE) sobre `(id_directivo)`
- `idx_notif_col_leida` (NON-UNIQUE) sobre `(leida = false)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `notificacion_colegio` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `notificacion_colegio`) (Evidencia: la FK no está restringida a unicidad en `notificacion_colegio`). Confianza: **Alta**.
- `notificacion_colegio` → `directivo`: Cardinalidad inferible **N:1** (`directivo` 1:N `notificacion_colegio`) (Evidencia: la FK no está restringida a unicidad en `notificacion_colegio`). Confianza: **Alta**.

---

### 3.41 Tabla: `notificacion_supervision`

- **Categoría Estructural:** transaccional / auditoría
- **Propósito Aparente:** Alertas y notificaciones generadas en el contexto de procesos de supervisión externa.
- **Posibles Responsabilidades:** Informar eventos de auditoría y fechas límite a supervisores y auditados.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_notificacion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_auditoria` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_directivo` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `tipo_notificacion` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `mensaje` | `text` | NO | - | - | NO | NO | NO | NO |
| `leida` | `boolean` | NO | `false` | - | NO | NO | NO | NO |
| `fecha_notificacion` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `notificacion_supervision_pkey` (`id_notificacion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_auditoria` → `auditoria_supervision(id_auditoria)` [NO ACTION]
- FK `id_directivo` → `directivo(id)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_notif_sup_auditoria` (NON-UNIQUE) sobre `(id_auditoria)`
- `idx_notif_sup_directivo` (NON-UNIQUE) sobre `(id_directivo)`
- `idx_notif_sup_leida` (NON-UNIQUE) sobre `(leida = false)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `notificacion_supervision` → `auditoria_supervision`: Cardinalidad inferible **N:1** (`auditoria_supervision` 1:N `notificacion_supervision`) (Evidencia: la FK no está restringida a unicidad en `notificacion_supervision`). Confianza: **Alta**.
- `notificacion_supervision` → `directivo`: Cardinalidad inferible **N:1** (`directivo` 1:N `notificacion_supervision`) (Evidencia: la FK no está restringida a unicidad en `notificacion_supervision`). Confianza: **Alta**.

---

### 3.42 Tabla: `observacion_estudiante`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Anotaciones de seguimiento académico, comportamental o disciplinario del alumno.
- **Posibles Responsabilidades:** Consignar fortalezas, debilidades y recomendaciones por materia y periodo.
- **Total de Columnas:** 10

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_observacion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_estudiante` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_detallegrado` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_periodo` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `fortalezas` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `debilidades` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `recomendaciones` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `fecha` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `tipo` | `public.tipo_observacion` | SÍ | `'ACADEMICA'::public.tipo_observacion` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `observacion_estudiante_pkey` (`id_observacion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_detallegrado` → `detalle_grados(id_detallegrado)` [NO ACTION]
- FK `id_estudiante` → `estudiante(id_estudiante)` [NO ACTION]
- FK `id_periodo` → `periodo_academico(id_periodo)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_observacion_estudiante` (NON-UNIQUE) sobre `(id_estudiante)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `observacion_estudiante` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `observacion_estudiante`) (Evidencia: la FK no está restringida a unicidad en `observacion_estudiante`). Confianza: **Alta**.
- `observacion_estudiante` → `detalle_grados`: Cardinalidad inferible **N:1** (`detalle_grados` 1:N `observacion_estudiante`) (Evidencia: la FK no está restringida a unicidad en `observacion_estudiante`). Confianza: **Alta**.
- `observacion_estudiante` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `observacion_estudiante`) (Evidencia: la FK no está restringida a unicidad en `observacion_estudiante`). Confianza: **Alta**.
- `observacion_estudiante` → `periodo_academico`: Cardinalidad inferible **N:1** (`periodo_academico` 1:N `observacion_estudiante`) (Evidencia: la FK no está restringida a unicidad en `observacion_estudiante`). Confianza: **Alta**.

---

### 3.43 Tabla: `padre_familia`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Perfil y datos de contacto de padres, acudientes o representantes legales.
- **Posibles Responsabilidades:** Centralizar información de acudientes para comunicaciones institucionales.
- **Total de Columnas:** 5

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_padrefamilia` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `apellido` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_usuario` | `integer` | SÍ | - | **UQ** | NO | NO | SÍ | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `padre_familia_pkey` (`id_padrefamilia`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `padre_familia_id_usuario_key` (`id_usuario`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `detalle_padrefamilia(id_padrefamilia)` referencian a `padre_familia(id_padrefamilia)`
- **Cardinalidades Inferibles:**
- `padre_familia` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `padre_familia`) (Evidencia: la FK no está restringida a unicidad en `padre_familia`). Confianza: **Alta**.

---

### 3.44 Tabla: `papelera_materias`

- **Categoría Estructural:** histórico / auditoría
- **Propósito Aparente:** Registro de preservación de materias dadas de baja lógica o eliminadas.
- **Posibles Responsabilidades:** Mantener trazabilidad de asignaturas archivadas para preservación histórica.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_papelera` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_colegio` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `nombre_materia` | `character varying(255)` | SÍ | - | - | NO | NO | NO | NO |
| `data_respaldo` | `jsonb` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_borrado` | `timestamp without time zone` | SÍ | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |
| `fecha_expiracion` | `timestamp without time zone` | SÍ | `(CURRENT_TIMESTAMP + '30 days'::interval)` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `papelera_materias_pkey` (`id_papelera`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.45 Tabla: `password_reset_tokens`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Tokens temporales para el restablecimiento de contraseñas de usuarios.
- **Posibles Responsabilidades:** Gestionar expiración y un solo uso de links de restablecimiento.
- **Total de Columnas:** 6

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_usuario` | `integer` | NO | - | - | NO | NO | NO | NO |
| `token` | `character varying(255)` | NO | - | **UQ, IDX** | NO | NO | SÍ | SÍ |
| `expires_at` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `used` | `boolean` | NO | `false` | - | NO | NO | NO | NO |
| `created_at` | `timestamp with time zone` | NO | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `password_reset_tokens_pkey` (`id`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `password_reset_tokens_token_key` (`token`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_password_reset_token` (NON-UNIQUE) sobre `(token)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.46 Tabla: `periodo_academico`

- **Categoría Estructural:** entidad dependiente
- **Propósito Aparente:** Divisiones temporales del año lectivo (Periodo 1, Periodo 2, etc.) por colegio.
- **Posibles Responsabilidades:** Fijar fechas de inicio/cierre, ponderación porcentual y estado de digitación de notas.
- **Total de Columnas:** 11

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_periodo` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(100)` | NO | - | - | NO | NO | NO | NO |
| `estado` | `public.estado_periodo` | NO | - | - | NO | NO | NO | NO |
| `porcentaje` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `id_anio` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `trimestre` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `dia_inicio` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `dia_fin` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `mes_inicio` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `mes_fin` | `integer` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `periodo_academico_pkey` (`id_periodo`)
- **Claves Foráneas Salientes (FK):**
- FK `id_anio` → `anio_lectivo(id_anio)` [NO ACTION]
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `actividad_materia(id_periodo)` referencian a `periodo_academico(id_periodo)`
- `cierre_materia(id_periodo)` referencian a `periodo_academico(id_periodo)`
- `competencias(id_periodo)` referencian a `periodo_academico(id_periodo)`
- `observacion_estudiante(id_periodo)` referencian a `periodo_academico(id_periodo)`
- `resultado_academico(id_periodo)` referencian a `periodo_academico(id_periodo)`
- **Cardinalidades Inferibles:**
- `periodo_academico` → `anio_lectivo`: Cardinalidad inferible **N:1** (`anio_lectivo` 1:N `periodo_academico`) (Evidencia: la FK no está restringida a unicidad en `periodo_academico`). Confianza: **Alta**.
- `periodo_academico` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `periodo_academico`) (Evidencia: la FK no está restringida a unicidad en `periodo_academico`). Confianza: **Alta**.

---

### 3.47 Tabla: `registro_asistencia`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Control diario o por clase de asistencia escolar de los estudiantes.
- **Posibles Responsabilidades:** Registrar estados (Presente, Ausente, Tarde, Justificada) y justificaciones por materia/fecha.
- **Total de Columnas:** 8

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_registroasistencia` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_estudiante` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_detallegrado` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `fecha` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `estado` | `public.estado_asistencia` | NO | `'PRESENTE'::public.estado_asistencia` | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `justificacion` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `hora_llegada` | `time without time zone` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `registro_asistencia_pkey` (`id_registroasistencia`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_detallegrado` → `detalle_grados(id_detallegrado)` [NO ACTION]
- FK `id_estudiante` → `estudiante(id_estudiante)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_asistencia_estudiante` (NON-UNIQUE) sobre `(id_estudiante)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `registro_asistencia` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `registro_asistencia`) (Evidencia: la FK no está restringida a unicidad en `registro_asistencia`). Confianza: **Alta**.
- `registro_asistencia` → `detalle_grados`: Cardinalidad inferible **N:1** (`detalle_grados` 1:N `registro_asistencia`) (Evidencia: la FK no está restringida a unicidad en `registro_asistencia`). Confianza: **Alta**.
- `registro_asistencia` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `registro_asistencia`) (Evidencia: la FK no está restringida a unicidad en `registro_asistencia`). Confianza: **Alta**.

---

### 3.48 Tabla: `registro_graduados`

- **Categoría Estructural:** histórico
- **Propósito Aparente:** Libro y registro protocolario de graduación de bachilleres o estudiantes que culminan ciclo.
- **Posibles Responsabilidades:** Preservar número de acta, libro, folio y fecha oficial de graduación.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_graduado` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_estudiante` | `integer` | NO | - | **FK, UQ** | NO | SÍ | SÍ | NO |
| `fecha_graduacion` | `timestamp with time zone` | NO | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |
| `observaciones` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `id_usuario_registro` | `integer` | SÍ | - | - | NO | NO | NO | NO |
| `creado_en` | `timestamp with time zone` | NO | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |
| `id_anio` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `registro_graduados_pkey` (`id_graduado`)
- **Claves Foráneas Salientes (FK):**
- FK `id_anio` → `anio_lectivo(id_anio)` [NO ACTION]
- FK `id_estudiante` → `estudiante(id_estudiante)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `registro_graduados_id_estudiante_key` (`id_estudiante`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `registro_graduados` → `anio_lectivo`: Cardinalidad inferible **N:1** (`anio_lectivo` 1:N `registro_graduados`) (Evidencia: la FK no está restringida a unicidad en `registro_graduados`). Confianza: **Alta**.
- `registro_graduados` → `estudiante`: Cardinalidad inferible **1:1** (Evidencia: la FK forma parte exclusiva de la PK o posee restricción UNIQUE). Confianza: **Alta**.

---

### 3.49 Tabla: `resultado_academico`

- **Categoría Estructural:** transaccional / histórico
- **Propósito Aparente:** Consolidado periódico o anual de rendimiento por asignatura para generación de boletines.
- **Posibles Responsabilidades:** Almacenar promedios consolidados, faltas acumuladas y estado final de aprobación.
- **Total de Columnas:** 9

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_resultado` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_estudiante` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_detallegrado` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_periodo` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `promedio` | `numeric(5,2)` | NO | - | - | NO | NO | NO | NO |
| `estado` | `public.estado_resultado` | NO | - | - | NO | NO | NO | NO |
| `fecha_cierre` | `timestamp with time zone` | NO | - | - | NO | NO | NO | NO |
| `id_docente` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `observacion` | `text` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `resultado_academico_pkey` (`id_resultado`)
- **Claves Foráneas Salientes (FK):**
- FK `id_detallegrado` → `detalle_grados(id_detallegrado)` [NO ACTION]
- FK `id_docente` → `docente(id_docente)` [NO ACTION]
- FK `id_estudiante` → `estudiante(id_estudiante)` [NO ACTION]
- FK `id_periodo` → `periodo_academico(id_periodo)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `resultado_academico` → `detalle_grados`: Cardinalidad inferible **N:1** (`detalle_grados` 1:N `resultado_academico`) (Evidencia: la FK no está restringida a unicidad en `resultado_academico`). Confianza: **Alta**.
- `resultado_academico` → `docente`: Cardinalidad inferible **N:1** (`docente` 1:N `resultado_academico`) (Evidencia: la FK no está restringida a unicidad en `resultado_academico`). Confianza: **Alta**.
- `resultado_academico` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `resultado_academico`) (Evidencia: la FK no está restringida a unicidad en `resultado_academico`). Confianza: **Alta**.
- `resultado_academico` → `periodo_academico`: Cardinalidad inferible **N:1** (`periodo_academico` 1:N `resultado_academico`) (Evidencia: la FK no está restringida a unicidad en `resultado_academico`). Confianza: **Alta**.

---

### 3.50 Tabla: `rol`

- **Categoría Estructural:** catálogo
- **Propósito Aparente:** Catálogo de roles y niveles de privilegio del sistema.
- **Posibles Responsabilidades:** Definir los nombres de los roles de acceso.
- **Total de Columnas:** 2

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_rol` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(50)` | NO | - | **UQ** | NO | NO | SÍ | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `rol_pkey` (`id_rol`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `rol_nombre_key` (`nombre`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `usuario_rol(id_rol)` referencian a `rol(id_rol)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.51 Tabla: `sancion`

- **Categoría Estructural:** transaccional / histórico
- **Propósito Aparente:** Procesos disciplinarios y sanciones aplicadas a estudiantes.
- **Posibles Responsabilidades:** Gestionar periodos de sanción, tipificación de falta, descargos y sincronizar estado del alumno.
- **Total de Columnas:** 10

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_sancion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_estudiante` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `id_tipo_sancion` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `motivo` | `text` | NO | - | - | NO | NO | NO | NO |
| `fecha_inicio` | `date` | NO | `CURRENT_DATE` | - | NO | NO | NO | NO |
| `fecha_fin` | `date` | NO | - | - | NO | NO | NO | NO |
| `estado` | `public.estado_sancion` | SÍ | `'ACTIVA'::public.estado_sancion` | - | NO | NO | NO | NO |
| `observaciones` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `id_directivo` | `integer` | NO | - | **FK** | NO | SÍ | NO | NO |
| `creado_en` | `timestamp with time zone` | SÍ | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `sancion_pkey` (`id_sancion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_directivo` → `directivo(id)` [ON DELETE CASCADE]
- FK `id_estudiante` → `estudiante(id_estudiante)` [ON DELETE CASCADE]
- FK `id_tipo_sancion` → `tipo_sancion(id_tipo_sancion)` [NO ACTION]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- `chk_fechas_sancion`: `(fecha_fin >= fecha_inicio)`
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `sancion` → `directivo`: Cardinalidad inferible **N:1** (`directivo` 1:N `sancion`) (Evidencia: la FK no está restringida a unicidad en `sancion`). Confianza: **Alta**.
- `sancion` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `sancion`) (Evidencia: la FK no está restringida a unicidad en `sancion`). Confianza: **Alta**.
- `sancion` → `tipo_sancion`: Cardinalidad inferible **N:1** (`tipo_sancion` 1:N `sancion`) (Evidencia: la FK no está restringida a unicidad en `sancion`). Confianza: **Alta**.

---

### 3.52 Tabla: `secciones`

- **Categoría Estructural:** catálogo
- **Propósito Aparente:** Catálogo de letras identificadoras de secciones de cursos (A, B, C, D...).
- **Posibles Responsabilidades:** Estandarizar la nomenclatura de salones de clase.
- **Total de Columnas:** 2

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_seccion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(10)` | NO | - | **UQ** | NO | NO | SÍ | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `secciones_pkey` (`id_seccion`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `secciones_nombre_key` (`nombre`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `grupos(id_seccion)` referencian a `secciones(id_seccion)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.53 Tabla: `solicitud_traslado`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Trámite de solicitud de traslado institucional o de matrícula de un estudiante.
- **Posibles Responsabilidades:** Gestionar la petición de paso entre colegios, motivos y estados de solicitud.
- **Total de Columnas:** 11

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_solicitud` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `tipo` | `public.tipo_traslado` | NO | `'TRASLADO_USUARIO'::public.tipo_traslado` | - | NO | NO | NO | NO |
| `id_usuario` | `integer` | NO | - | **IDX** | NO | NO | NO | SÍ |
| `id_colegio_origen` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_colegio_destino` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_matricula` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `estado` | `public.estado_solicitud_traslado` | NO | `'SOLICITADA'::public.estado_solicitud_traslado` | - | NO | NO | NO | NO |
| `motivo` | `text` | NO | - | - | NO | NO | NO | NO |
| `creado_por` | `integer` | NO | - | - | NO | NO | NO | NO |
| `fecha_creacion` | `timestamp with time zone` | SÍ | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |
| `fecha_finalizacion` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `solicitud_traslado_pkey` (`id_solicitud`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio_destino` → `colegio(id_colegio)` [NO ACTION]
- FK `id_colegio_origen` → `colegio(id_colegio)` [NO ACTION]
- FK `id_matricula` → `matricula(id_matricula)` [ON DELETE SET NULL]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- `chk_origen_destino_diff`: `(id_colegio_origen <> id_colegio_destino)`
- **Índices Declarados:**
- `idx_solicitud_traslado_destino` (NON-UNIQUE) sobre `(id_colegio_destino)`
- `idx_solicitud_traslado_origen` (NON-UNIQUE) sobre `(id_colegio_origen)`
- `idx_solicitud_traslado_usr` (NON-UNIQUE) sobre `(id_usuario)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `traslado_aprobacion(id_solicitud)` referencian a `solicitud_traslado(id_solicitud)`
- **Cardinalidades Inferibles:**
- `solicitud_traslado` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `solicitud_traslado`) (Evidencia: la FK no está restringida a unicidad en `solicitud_traslado`). Confianza: **Alta**.
- `solicitud_traslado` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `solicitud_traslado`) (Evidencia: la FK no está restringida a unicidad en `solicitud_traslado`). Confianza: **Alta**.
- `solicitud_traslado` → `matricula`: Cardinalidad inferible **N:1** (`matricula` 1:N `solicitud_traslado`) (Evidencia: la FK no está restringida a unicidad en `solicitud_traslado`). Confianza: **Alta**.

---

### 3.54 Tabla: `tickets_soporte`

- **Categoría Estructural:** transaccional
- **Propósito Aparente:** Mesa de ayuda e incidencias técnicas o académicas reportadas en la plataforma.
- **Posibles Responsabilidades:** Controlar estado, prioridad, tipo de incidencia y seguimiento de soporte.
- **Total de Columnas:** 15

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_ticket` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_usuario` | `integer` | SÍ | - | **IDX** | NO | NO | NO | SÍ |
| `nombre_remitente` | `character varying(155)` | NO | - | - | NO | NO | NO | NO |
| `correo_remitente` | `character varying(155)` | NO | - | - | NO | NO | NO | NO |
| `telefono` | `character varying(50)` | SÍ | - | - | NO | NO | NO | NO |
| `tipo_incidencia` | `public.tipo_incidencia_soporte` | NO | - | - | NO | NO | NO | NO |
| `asunto` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `descripcion` | `text` | NO | - | - | NO | NO | NO | NO |
| `estado` | `public.estado_ticket_soporte` | SÍ | `'ABIERTO'::public.estado_ticket_soporte` | **IDX** | NO | NO | NO | SÍ |
| `fecha_creacion` | `timestamp with time zone` | SÍ | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |
| `id_colegio` | `integer` | SÍ | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `observaciones` | `jsonb` | SÍ | `'[]'::jsonb` | - | NO | NO | NO | NO |
| `codigo_ticket` | `character varying(50)` | SÍ | - | **UQ, IDX** | NO | NO | SÍ | SÍ |
| `fecha_escalado` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `id_estudiante` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `tickets_soporte_pkey` (`id_ticket`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- FK `id_estudiante` → `estudiante(id_estudiante)` [ON DELETE SET NULL]
- **Restricciones UNIQUE:**
- `tickets_soporte_codigo_ticket_key` (`codigo_ticket`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_tickets_codigo` (NON-UNIQUE) sobre `(codigo_ticket)`
- `idx_tickets_colegio` (NON-UNIQUE) sobre `(id_colegio)`
- `idx_tickets_estado` (NON-UNIQUE) sobre `(estado)`
- `idx_tickets_usuario` (NON-UNIQUE) sobre `(id_usuario)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `matricula(id_ticket)` referencian a `tickets_soporte(id_ticket)`
- **Cardinalidades Inferibles:**
- `tickets_soporte` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `tickets_soporte`) (Evidencia: la FK no está restringida a unicidad en `tickets_soporte`). Confianza: **Alta**.
- `tickets_soporte` → `estudiante`: Cardinalidad inferible **N:1** (`estudiante` 1:N `tickets_soporte`) (Evidencia: la FK no está restringida a unicidad en `tickets_soporte`). Confianza: **Alta**.

---

### 3.55 Tabla: `tipo_documento`

- **Categoría Estructural:** catálogo
- **Propósito Aparente:** Tipos de documentos de identificación institucional o legal.
- **Posibles Responsabilidades:** Catalogar denominaciones documentales.
- **Total de Columnas:** 2

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_tipodocumento` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `tipo` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `tipo_documento_pkey` (`id_tipodocumento`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `usuario(id_tipodocumento)` referencian a `tipo_documento(id_tipodocumento)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.56 Tabla: `tipo_grado`

- **Categoría Estructural:** catálogo / entidad dependiente
- **Propósito Aparente:** Etiología de grados escolares por colegio (Primero, Segundo... Once).
- **Posibles Responsabilidades:** Clasificar los peldaños secuenciales de la trayectoria educativa.
- **Total de Columnas:** 3

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_tipo_grado` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(50)` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `id_nivel` | `integer` | NO | - | **FK, UQ** | NO | SÍ | SÍ | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `tipo_grado_tabla_pkey` (`id_tipo_grado`)
- **Claves Foráneas Salientes (FK):**
- FK `id_nivel` → `nivel_escolar(id_nivel)` [NO ACTION]
- **Restricciones UNIQUE:**
- `uq_tipo_grado` (`nombre, id_nivel`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `grupos(id_tipo_grado)` referencian a `tipo_grado(id_tipo_grado)`
- **Cardinalidades Inferibles:**
- `tipo_grado` → `nivel_escolar`: Cardinalidad inferible **N:1** (`nivel_escolar` 1:N `tipo_grado`) (Evidencia: la FK no está restringida a unicidad en `tipo_grado`). Confianza: **Alta**.

---

### 3.57 Tabla: `tipo_sancion`

- **Categoría Estructural:** catálogo
- **Propósito Aparente:** Catálogo de tipos de medidas disciplinarias institucionales.
- **Posibles Responsabilidades:** Definir tipologías de sanción (amonestación, suspensión, expulsión).
- **Total de Columnas:** 3

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_tipo_sancion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `nombre` | `character varying(100)` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `descripcion` | `text` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `tipo_sancion_pkey` (`id_tipo_sancion`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `tipo_sancion_nombre_key` (`nombre`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `sancion(id_tipo_sancion)` referencian a `tipo_sancion(id_tipo_sancion)`
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.58 Tabla: `token_blacklist`

- **Categoría Estructural:** seguridad / auditoría
- **Propósito Aparente:** Lista negra de tokens JWT invalidados por logout o caducidad forzada.
- **Posibles Responsabilidades:** Prevenir reutilización de credenciales de sesión vulneradas o cerradas.
- **Total de Columnas:** 4

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `jti` | `character varying(255)` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `expires_at` | `timestamp with time zone` | NO | - | **IDX** | NO | NO | NO | SÍ |
| `created_at` | `timestamp with time zone` | SÍ | `now()` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `token_blacklist_pkey` (`id`)
- **Claves Foráneas Salientes (FK):**
- *Sin claves foráneas salientes definidas en DDL.*
- **Restricciones UNIQUE:**
- `token_blacklist_jti_key` (`jti`)
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_token_blacklist_expires_at` (NON-UNIQUE) sobre `(expires_at)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- *No contiene FK salientes directas para inferir cardinalidad relacional.*

---

### 3.59 Tabla: `traslado_aprobacion`

- **Categoría Estructural:** transaccional / auditoría
- **Propósito Aparente:** Historial de firmas, aprobaciones y rechazos de solicitudes de traslado.
- **Posibles Responsabilidades:** Registrar la trazabilidad de decisiones de rectores o coordinadores involucrados.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_aprobacion` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_solicitud` | `integer` | NO | - | **FK, IDX** | NO | SÍ | NO | SÍ |
| `id_usuario` | `integer` | NO | - | - | NO | NO | NO | NO |
| `rol` | `character varying(50)` | NO | - | - | NO | NO | NO | NO |
| `accion` | `public.accion_aprobacion_traslado` | NO | - | - | NO | NO | NO | NO |
| `comentario` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `fecha` | `timestamp with time zone` | SÍ | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `traslado_aprobacion_pkey` (`id_aprobacion`)
- **Claves Foráneas Salientes (FK):**
- FK `id_solicitud` → `solicitud_traslado(id_solicitud)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- `idx_traslado_aprobacion_sol` (NON-UNIQUE) sobre `(id_solicitud)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `traslado_aprobacion` → `solicitud_traslado`: Cardinalidad inferible **N:1** (`solicitud_traslado` 1:N `traslado_aprobacion`) (Evidencia: la FK no está restringida a unicidad en `traslado_aprobacion`). Confianza: **Alta**.

---

### 3.60 Tabla: `usuario`

- **Categoría Estructural:** entidad principal
- **Propósito Aparente:** Entidad central de identidad, credenciales y autenticación de personas en el sistema.
- **Posibles Responsabilidades:** Custodiar credenciales (hash de clave), documento de identidad, estado de cuenta y bloqueo.
- **Total de Columnas:** 15

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_usuario` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `email` | `character varying(255)` | SÍ | - | **UQ, IDX** | NO | NO | SÍ | SÍ |
| `password` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `nombre` | `character varying(255)` | NO | - | - | NO | NO | NO | NO |
| `apellido` | `character varying(255)` | SÍ | - | - | NO | NO | NO | NO |
| `activo` | `boolean` | SÍ | `true` | - | NO | NO | NO | NO |
| `fecha_creacion` | `timestamp with time zone` | SÍ | `now()` | - | NO | NO | NO | NO |
| `estado` | `public.estado_usuario_sistema` | NO | `'ACTIVO'::public.estado_usuario_sistema` | **IDX** | NO | NO | NO | SÍ |
| `motivo_baneo` | `text` | SÍ | - | - | NO | NO | NO | NO |
| `fecha_baneo` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `baneado_por` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `logged_out_at` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |
| `id_tipodocumento` | `integer` | SÍ | - | **FK** | NO | SÍ | NO | NO |
| `documento` | `character varying(50)` | SÍ | - | **IDX** | NO | NO | NO | SÍ |
| `telefono` | `character varying(50)` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `usuario_pkey` (`id_usuario`)
- **Claves Foráneas Salientes (FK):**
- FK `baneado_por` → `usuario(id_usuario)` [NO ACTION]
- FK `id_colegio` → `colegio(id_colegio)` [NO ACTION]
- FK `id_tipodocumento` → `tipo_documento(id_tipodocumento)` [NO ACTION]
- **Restricciones UNIQUE:**
- `usuario_email_key` (`email`)
- **Restricciones CHECK:**
- `chk_usuario_documento_format`: `((documento IS NULL) OR ((documento)::text ~ '^[a-zA-Z0-9]+$'::text))`
- **Índices Declarados:**
- `idx_usuario_colegio` (NON-UNIQUE) sobre `(id_colegio)`
- `idx_usuario_documento` (NON-UNIQUE) sobre `(documento)`
- `idx_usuario_email` (NON-UNIQUE) sobre `(email)`
- `idx_usuario_estado` (NON-UNIQUE) sobre `(estado)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- `usuario_rol(id_usuario)` referencian a `usuario(id_usuario)`
- **Cardinalidades Inferibles:**
- `usuario` → `usuario`: Cardinalidad inferible **N:1** (`usuario` 1:N `usuario`) (Evidencia: la FK no está restringida a unicidad en `usuario`). Confianza: **Alta**.
- `usuario` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `usuario`) (Evidencia: la FK no está restringida a unicidad en `usuario`). Confianza: **Alta**.
- `usuario` → `tipo_documento`: Cardinalidad inferible **N:1** (`tipo_documento` 1:N `usuario`) (Evidencia: la FK no está restringida a unicidad en `usuario`). Confianza: **Alta**.

---

### 3.61 Tabla: `usuario_colegio`

- **Categoría Estructural:** tabla puente / relación
- **Propósito Aparente:** Mapea la membresía y rol de un usuario en un colegio específico (soporte multitenant).
- **Posibles Responsabilidades:** Establecer la relación multi-rol y multi-colegio sin duplicar identidades.
- **Total de Columnas:** 7

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_usuario_colegio` | `integer` | NO | - | **PK** | SÍ | NO | NO | NO |
| `id_usuario` | `integer` | NO | - | **UQ, IDX** | NO | NO | SÍ | SÍ |
| `id_colegio` | `integer` | NO | - | **FK, UQ, IDX** | NO | SÍ | SÍ | SÍ |
| `id_rol` | `integer` | NO | - | **UQ** | NO | NO | SÍ | NO |
| `estado` | `character varying(20)` | NO | `'ACTIVO'::character varying` | - | NO | NO | NO | NO |
| `fecha_inicio` | `timestamp with time zone` | SÍ | `CURRENT_TIMESTAMP` | - | NO | NO | NO | NO |
| `fecha_fin` | `timestamp with time zone` | SÍ | - | - | NO | NO | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `usuario_colegio_pkey` (`id_usuario_colegio`)
- **Claves Foráneas Salientes (FK):**
- FK `id_colegio` → `colegio(id_colegio)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- `uq_usuario_colegio_rol` (`id_usuario, id_colegio, id_rol`)
- **Restricciones CHECK:**
- `usuario_colegio_estado_check`: `((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying, 'SUSPENDIDO'::character varying])::text[]))`
- **Índices Declarados:**
- `idx_usuario_colegio_col` (NON-UNIQUE) sobre `(id_colegio)`
- `idx_usuario_colegio_usr` (NON-UNIQUE) sobre `(id_usuario)`

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `usuario_colegio` → `colegio`: Cardinalidad inferible **N:1** (`colegio` 1:N `usuario_colegio`) (Evidencia: la FK no está restringida a unicidad en `usuario_colegio`). Confianza: **Alta**.

---

### 3.62 Tabla: `usuario_rol`

- **Categoría Estructural:** tabla puente / relación
- **Propósito Aparente:** Asignación global de roles a usuarios en la plataforma.
- **Posibles Responsabilidades:** Gestionar privilegios de usuario.
- **Total de Columnas:** 2

#### Columnas y Restricciones Atómicas
| Nombre | Tipo de Dato | Nulo | Default | Restricciones | PK | FK | UQ | IDX |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `id_usuario` | `integer` | NO | - | **PK, FK** | SÍ | SÍ | NO | NO |
| `id_rol` | `integer` | NO | - | **PK, FK** | SÍ | SÍ | NO | NO |

#### Restricciones de Tabla Observables
- **Clave Primaria (PK):** `usuario_rol_pkey` (`id_usuario, id_rol`)
- **Claves Foráneas Salientes (FK):**
- FK `id_rol` → `rol(id_rol)` [ON DELETE CASCADE]
- FK `id_usuario` → `usuario(id_usuario)` [ON DELETE CASCADE]
- **Restricciones UNIQUE:**
- *Sin restricciones de unicidad explícitas adicionales.*
- **Restricciones CHECK:**
- *Sin restricciones CHECK de tabla explícitas.*
- **Índices Declarados:**
- *Solo índice implícito de PK.*

#### Relaciones y Cardinalidades Inferibles
- **Referencias Entrantes (Observables):**
- *Ninguna otra tabla posee FK que apunte a esta tabla en el DDL.*
- **Cardinalidades Inferibles:**
- `usuario_rol` → `rol`: Cardinalidad inferible **N:1** (`rol` 1:N `usuario_rol`) (Evidencia: la FK no está restringida a unicidad en `usuario_rol`). Confianza: **Alta**.
- `usuario_rol` → `usuario`: Cardinalidad inferible **N:1** (`usuario` 1:N `usuario_rol`) (Evidencia: la FK no está restringida a unicidad en `usuario_rol`). Confianza: **Alta**.

---
