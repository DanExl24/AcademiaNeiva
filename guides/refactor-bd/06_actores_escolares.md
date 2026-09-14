# Módulo 6: Actores Escolares (Comunidad Educativa)

## 1. Puntos Encontrados Antes de la Refactorización

1. **Tabla Obsoleta `contrato_docente`**:
   - Existía la tabla `contrato_docente` con 0 filas.
   - El modelo de contratación y estado del docente ya está formalizado directamente en la tabla `docente` (columna `estado VARCHAR(20) DEFAULT 'ACTIVO'`) y en `usuario_colegio` (que modela las vinculaciones multi-tenant por colegio y rol). `contrato_docente` era un remanente muerto que generaba confusión.
2. **Violación de Tercera Forma Normal (3NF) en `estudiante`**:
   - La tabla `estudiante` contenía una columna `id_nivel`.
   - Sin embargo, un estudiante no tiene un nivel educativo estático en su hoja de vida básica: el nivel educativo del estudiante cambia año a año y pertenece a su **matrícula** (`matricula.id_nivel` o `matricula.id_grupo -> tipo_grado.id_nivel`).
   - Tener `id_nivel` en `estudiante` violaba 3NF e impedía que el estudiante fuera promovido de Primaria a Secundaria sin alterar su registro maestro histórico.
3. **Falta de Unicidad en el Código de Estudiante por Colegio**:
   - La columna `codigo` en `estudiante` no tenía restricción `UNIQUE (id_colegio, codigo)`, lo que permitía colisiones de códigos estudiantiles en una misma institución.
4. **Duplicidad en Relaciones Familiares (`detalle_padrefamilia`)**:
   - No existía restricción `UNIQUE (id_padrefamilia, id_estudiante)`, permitiendo que un padre fuera vinculado múltiples veces al mismo hijo.

---

## 2. Decisión de Diseño e Implementación

- **Deprecación y Eliminación de `contrato_docente`**:
  - Se ejecutó `DROP TABLE IF EXISTS public.contrato_docente CASCADE;`.
- **Normalización 3NF en `estudiante`**:
  - Se eliminó la columna `id_nivel` de `estudiante` mediante `ALTER TABLE public.estudiante DROP COLUMN id_nivel;`.
  - El nivel escolar ahora se resuelve exclusivamente a través de la matrícula activa del estudiante en el año lectivo correspondiente.
- **Unicidad y Restricciones Familiares**:
  - Se añadió la restricción `uq_estudiante_colegio_codigo UNIQUE (id_colegio, codigo)`.
  - Se añadió la restricción `uq_detalle_padrefamilia UNIQUE (id_padrefamilia, id_estudiante)`.

---

## 3. Tablas Deprecadas y Motivo

| Tabla Eliminada | Filas Previas | Motivo de Eliminación |
|-----------------|:-------------:|-----------------------|
| `contrato_docente` | 0 | Huérfana y sin uso; la vinculación laboral está gestionada en `docente.estado` y `usuario_colegio`. |

---

## 4. Índices Creados

| Nombre del Índice | Tabla | Columnas Indexadas | Propósito |
|-------------------|-------|-------------------|-----------|
| `idx_estudiante_colegio_codigo` | `estudiante` | `(id_colegio, codigo)` | Búsqueda rápida por código en el portal estudiantil. |
| `idx_estudiante_usuario` | `estudiante` | `(id_usuario)` | Resolución de perfil desde la sesión JWT. |
| `idx_docente_usuario_colegio` | `docente` | `(id_colegio, id_usuario)` | Autenticación y cambio de rol docente. |
| `idx_detalle_padrefamilia_estudiante` | `detalle_padrefamilia` | `(id_estudiante)` | Listado de acudientes asociados a un alumno. |

---

## 5. Nuevas Reglas de la Base de Datos

- **RN-MOD6-01**: El código estudiantil (`codigo`) es único por colegio.
- **RN-MOD6-02**: El nivel escolar de un alumno no es una propiedad estática de la persona, sino un estado académico dinámico definido en su matrícula anual.
- **RN-MOD6-03**: No pueden existir relaciones duplicadas entre un padre de familia y el mismo estudiante.
