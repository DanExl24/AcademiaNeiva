# Módulo 1: Institución y Configuración General

## 1. Puntos Encontrados Antes de la Refactorización

1. **Dispersión de Tablas de Configuración**:
   - Existían 4 tablas compitiendo para almacenar parámetros institucionales y académicos:
     - `colegio`: Datos identitarios y DANE de la institución.
     - `configuracion_colegio`: Parámetros académicos dispersos (notas aprobatorias, límites de materias reprobadas).
     - `configuracion_base`: Tabla obsoleta con parámetros estáticos heredados sin uso activo.
     - `configuracion_sistema`: Tabla redundante huérfana.
2. **Incapacidad de Trazabilidad Histórica en Reglas SIEE**:
   - Al estar los parámetros del SIEE atados a `configuracion_colegio` (por colegio en lugar de por año escolar), si un colegio cambiaba su política de reprobación del año 2024 al 2025, el cambio alteraba retroactivamente el cálculo de promociones de años anteriores.
3. **Columnas de Fechas Faltantes en `anio_lectivo`**:
   - La tabla `anio_lectivo` solo almacenaba una cadena (`calendario VARCHAR`, ej. `"2025"`), sin columnas formales de tipo `DATE` para fecha de inicio y fecha de finalización del ciclo lectivo.

---

## 2. Decisión de Diseño e Implementación

- **Centralización en `anio_lectivo`**:
  Se incorporaron a la tabla `anio_lectivo` los parámetros oficiales del Sistema Institucional de Evaluación de los Estudiantes (SIEE):
  - `porcentaje_inasistencia_reprobacion NUMERIC(5,2) DEFAULT 25.00`
  - `tipo_promocion VARCHAR(20) DEFAULT 'PORCENTAJE'`
  - `nota_minima_aprobatoria NUMERIC(4,2) DEFAULT 3.00`
  - `limite_materias_reprobadas INTEGER DEFAULT 2`
  - `permite_recuperacion BOOLEAN DEFAULT TRUE`
  - `materias_reprobatorias JSONB DEFAULT '[]'`
  - `fecha_inicio DATE`, `fecha_fin DATE`, `fechas_matricula_ordinaria JSONB`, `fechas_matricula_extraordinaria JSONB`
- **Deprecación y Drop**:
  - Se eliminaron mediante `DROP TABLE IF EXISTS ... CASCADE` las tablas:
    - `configuracion_colegio`
    - `configuracion_base`
    - `configuracion_sistema`

---

## 3. Tablas Deprecadas y Motivo

| Tabla Eliminada | Filas Previas | Motivo de Eliminación |
|-----------------|:-------------:|-----------------------|
| `configuracion_colegio` | 3 | Redundante; sus parámetros académicos dependían del año escolar y fueron migrados a `anio_lectivo`. |
| `configuracion_base` | 0 | Huérfana, obsoleta del sistema heredado sin endpoints ni controladores activos. |
| `configuracion_sistema` | 0 | Huérfana, sin referencias en la lógica de negocio ni en la interfaz. |

---

## 4. Índices Creados

- `idx_anio_lectivo_colegio_estado` en `anio_lectivo(id_colegio, estado)`:
  - Optimiza la consulta frecuente para resolver el año lectivo `"ABIERTO"` de un colegio en tiempo $O(\log n)$.

---

## 5. Nuevas Reglas de la Base de Datos

- **RN-MOD1-01**: Cada colegio maneja sus reglas de promoción (SIEE) de forma independiente y aislada por cada año lectivo en la tabla `anio_lectivo`.
- **RN-MOD1-02**: Ningún parámetro de evaluación altera años pasados; al cerrar un año lectivo, su configuración queda congelada e inmutable.
