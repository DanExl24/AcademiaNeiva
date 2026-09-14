# Refactorización Integral de la Base de Datos - AcademiaNeiva

Este directorio contiene la documentación técnica detallada de la **refactorización integral de los 10 módulos de la base de datos de AcademiaNeiva**, realizada para resolver deudas técnicas acumuladas, eliminar redundancias estructurales (violaciones a Tercera Forma Normal - 3NF), depurar tablas huérfanas y blindar la integridad referencial con restricciones y nuevos índices de alto rendimiento.

---

## 🧭 Tabla de Contenidos

| # | Módulo | Migración | Enlace Documental | Estado |
|---|--------|-----------|-------------------|:------:|
| 1 | Institución y Configuración General | `054` | [01_institucion_y_configuracion.md](./01_institucion_y_configuracion.md) | ✅ Finalizado |
| 2 | Estructura Académica Base | `055` | [02_estructura_academica_base.md](./02_estructura_academica_base.md) | ✅ Finalizado |
| 3 | Calendario y Periodos Académicos | `056` | [03_calendario_y_periodos.md](./03_calendario_y_periodos.md) | ✅ Finalizado |
| 4 | Plan Curricular y Competencias | `057` | [04_curriculo_y_competencias.md](./04_curriculo_y_competencias.md) | ✅ Finalizado |
| 5 | Evaluación y Calificaciones | `058` | [05_evaluacion_y_calificaciones.md](./05_evaluacion_y_calificaciones.md) | ✅ Finalizado |
| 6 | Actores Escolares (Comunidad Educativa) | `059` | [06_actores_escolares.md](./06_actores_escolares.md) | ✅ Finalizado |
| 7 | Matrículas y Traslados | `060` | [07_matriculas_y_traslados.md](./07_matriculas_y_traslados.md) | ✅ Finalizado |
| 8 | Asistencia y Convivencia | `061` | [08_asistencia_y_convivencia.md](./08_asistencia_y_convivencia.md) | ✅ Finalizado |
| 9 | Promociones y Cierre Anual | `062` | [09_promociones_y_cierre_anual.md](./09_promociones_y_cierre_anual.md) | ✅ Finalizado |
| 10 | Notificaciones, Seguridad y Auditoría | `063` | [10_notificaciones_seguridad_auditoria.md](./10_notificaciones_seguridad_auditoria.md) | ✅ Finalizado |
| 📊 | **Matriz Consolidada de Tablas, Índices y Reglas** | - | [tablas_deprecadas_indices_y_reglas.md](./tablas_deprecadas_indices_y_reglas.md) | ✅ Finalizado |

---

## 🏛️ Principios Arquitectónicos Aplicados

1. **Normalización Relacional Estricta (3NF)**:
   - Eliminación de dependencias transitivas. Columnas como `id_nivel` que dependían de la jerarquía académica fueron removidas de tablas subordinadas (`grupos`, `estudiante`) y centralizadas en sus entidades canónicas (`tipo_grado`, `matricula`).
2. **Centralización de Configuraciones por Año Lectivo**:
   - Se eliminaron las tablas dispersas de configuración (`configuracion_colegio`, `configuracion_base`, `configuracion_sistema`) trasladando las reglas del SIEE (porcentajes de inasistencia, nota aprobatoria, límite de reprobación) a `anio_lectivo`, permitiendo configuraciones dinámicas históricas por año.
3. **Depuración de Tablas Obsoletas y Huérfanas**:
   - Se archivaron y eliminaron tablas en desuso con cero filas o duplicadas (`grados`, `desempeno`, `contrato_docente`, `notificaciones`, `persona`), pasando de un esquema sobrecargado a **61 tablas físicas canónicas**.
4. **Restricciones de Integridad y Unicidad Compuesta**:
   - Implementación de restricciones `UNIQUE` y llaves foráneas formales para prevenir estados inconsistentes (p. ej. dobles decisiones de promoción en el mismo año, duplicidad de escalas en el mismo ciclo escolar o doble registro de asistencia diario).
5. **Optimización con Índices B-Tree Estratégicos**:
   - Creación de índices compuestos orientados a los flujos más intensivos del sistema (generación masiva de boletines, consultas de asistencia por materia, listados de matrículas por año y estado).
6. **Desacople de Migraciones en Tiempo de Ejecución (Solo Lectura)**:
   - Las migraciones SQL existentes (`backend/src/migrations/*.sql`) se convirtieron en artefactos de **solo lectura histórica**. Ningún archivo de código backend ejecuta archivos `.sql` en tiempo de ejecución.
7. **Adopción Obligatoria del QueryBuilder Tipado Kysely**:
   - Todo acceso a base de datos en código y scripts de siembra (`reset_and_seed.ts`) utiliza el querybuilder de Kysely contra `src/types/db.types.ts`, garantizando validación estricta de tablas y columnas en tiempo de compilación.
