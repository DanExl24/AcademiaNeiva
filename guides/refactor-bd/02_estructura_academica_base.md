# Módulo 2: Estructura Académica Base

## 1. Puntos Encontrados Antes de la Refactorización

1. **Duplicidad entre `grados` y `grupos` / `tipo_grado`**:
   - Existía la tabla `grados` que almacenaba `nivel`, `tipo_grado`, `id_jornada`, `id_colegio`, `cupos_totales`, `seccion`.
   - Paralelamente existía `grupos` con `id_tipo_grado`, `id_seccion`, `id_jornada`, `id_colegio`, `id_docente`.
   - Ambas tablas modelaban la misma realidad educativa (un grupo de un grado específico en una jornada y sección). Los controladores tenían que hacer dobles inserciones o sincronizaciones frágiles.
2. **Violación de Tercera Forma Normal (3NF) en `grupos`**:
   - `grupos` contenía la columna `id_nivel`.
   - Sin embargo, `grupos` ya tenía una llave foránea hacia `tipo_grado(id_tipo_grado)`. Y `tipo_grado` ya definía `id_nivel` (`tipo_grado.id_nivel REFERENCES nivel_escolar(id_nivel)`).
   - Mantener `grupos.id_nivel` creaba una dependencia funcional transitiva y abría el riesgo de anomalías de modificación (que un grupo tuviera un `id_nivel` diferente al nivel de su `tipo_grado`).
3. **Rol de la Tabla `secciones`**:
   - Se evaluó si `secciones` era redundante. Se constató que actúa como catálogo canónico de nomenclatura (`A`, `B`, `C`, etc.) con restricciones de llave foránea que protegen la uniformidad de los salones. Por ende, se preservó intacta.

---

## 2. Decisión de Diseño e Implementación

- **Archivado Seguro y Eliminación de `grados`**:
  - Antes de eliminar `grados`, se creó una tabla histórica de respaldo `legacy_grados_archive` mediante `CREATE TABLE legacy_grados_archive AS SELECT * FROM public.grados;`.
  - Se ejecutó `DROP TABLE public.grados CASCADE;`.
  - Se migraron todos los controladores académicos (`gradeGroupController`, `academicYearController`, etc.) para operar exclusivamente sobre `grupos`, `tipo_grado` y `secciones`.
- **Normalización 3NF en `grupos`**:
  - Se eliminó la columna `id_nivel` de `grupos` mediante `ALTER TABLE public.grupos DROP COLUMN id_nivel;`.
  - Toda consulta que requiera el nivel educativo de un grupo ahora realiza un `JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado` y obtiene `tg.id_nivel`, garantizando cero inconsistencias.

---

## 3. Tablas Deprecadas y Motivo

| Tabla Eliminada | Filas Previas | Motivo de Eliminación |
|-----------------|:-------------:|-----------------------|
| `grados` | 42 | 100% redundante con `grupos` y `tipo_grado`. Archivada en `legacy_grados_archive`. |

---

## 4. Índices Creados

- `idx_grupos_colegio_tipo_grado` en `grupos(id_colegio, id_tipo_grado)`:
  - Agiliza la búsqueda de grupos pares (mismo grado en un colegio) para la sincronización curricular y asignación de directores de grupo.
- `idx_tipo_grado_nivel` en `tipo_grado(id_nivel)`:
  - Optimiza la resolución de grados por nivel educativo (Preescolar, Primaria, Secundaria, Media).

---

## 5. Nuevas Reglas de la Base de Datos

- **RN-MOD2-01**: La jerarquía escolar es estrictamente:
  $$\text{colegio} \longrightarrow \text{nivel\_escolar} \longrightarrow \text{tipo\_grado} \longrightarrow \text{grupos}$$
- **RN-MOD2-02**: Ningún grupo puede pertenecer a un nivel educativo distinto al asignado a su grado (`tipo_grado`).
