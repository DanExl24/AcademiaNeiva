# Módulo 7: Matrículas y Traslados

Este documento detalla el diagnóstico, los hallazgos de integridad referencial, la refactorización y las decisiones de diseño aplicadas al módulo de matrículas, legalización documental, traslados y graduaciones de **AcademiaNeiva**.

---

## 1. Alcance y Tablas del Módulo

El módulo de matrículas y ciclo de vida escolar gestiona la vinculación formal del estudiante a la institución, el seguimiento de la entrega documental requerida por el MEN, el historial de movilidad entre sedes/colegios y el registro de grado final:

1. `matricula`: Relación central entre el estudiante, la sede/colegio, el año lectivo y el grupo asignado, con control de estado (`MATRICULADO`, `RETIRADO`, `TRASLADADO`, etc.).
2. `documento_matriculas`: Soporte de digitalización y validación de requisitos físicos (certificado médico, registro civil, boletines previos, paz y salvo).
3. `traslados_estudiante`: Auditoría y trazabilidad del flujo de solicitud, aprobación y motivos de traslado interno o externo.
4. `registro_graduados`: Libro de actas de grado, diploma, folio y cohorte de egresados de bachillerato y básica.

---

## 2. Puntos Críticos Encontrados en la Auditoría

### 2.1. Cohorte de Graduados Huérfana de Año Lectivo (`registro_graduados.id_anio`)
- **Problema**: La columna `id_anio` en `registro_graduados` admitía valores `NULL`.
- **Impacto**: Permitía registrar graduados sin asociarlos formalmente a la vigencia académica/año escolar en que se expidió el acta de grado. En auditorías del Ministerio de Educación (SIMAT) o emisión de duplicados de diplomas, una promoción sin año lectivo es inválida.
- **Solución**: Restricción `NOT NULL` con FK formal hacia `anio_lectivo(id_anio)`.

### 2.2. Falta de Claves Foráneas Formales en Traslados (`traslados_estudiante`)
- **Problema**: Las columnas `id_usuario_solicita` y `id_usuario_aprueba` estaban definidas como enteros planos sin clave foránea (`FOREIGN KEY`) hacia la tabla `usuario`.
- **Impacto**: Si un funcionario solicitaba o autorizaba un traslado y posteriormente cambiaba su rol o se depuraba la tabla de usuarios, quedaban identificadores huérfanos sin validación de integridad referencial.
- **Solución**: Establecimiento de FK explícitas:
  - `fk_traslado_usuario_solicita` -> `usuario(id_usuario)`
  - `fk_traslado_usuario_aprueba` -> `usuario(id_usuario)`

### 2.3. Consultas Secuenciales en Verificación Documental (`documento_matriculas`)
- **Problema**: La verificación de documentos por matrícula realizaba búsquedas por `(id_matricula, tipo_documento)` sin un índice compuesto.
- **Impacto**: En procesos de legalización masiva a inicio de año (donde miles de matrículas cargan 5 a 8 documentos cada una), las consultas de completitud documental producían cuellos de botella por barrido secuencial (`Seq Scan`).
- **Solución**: Creación del índice `idx_documento_matricula_tipo` sobre `(id_matricula, tipo_documento)`.

---

## 3. Decisiones de Diseño y Esquema Resultante

### 3.1. Invariante de Unicidad en Matrículas Activas
Un estudiante solo debe tener una matrícula activa por año lectivo en una institución. Aunque un alumno puede tener historial de matrículas previas (anuladas o trasladadas), la concurrencia en estado activo está blindada por la lógica de negocio y el índice único sobre `(id_estudiante, id_anio)` cuando el estado no es cancelado.

### 3.2. Estructura de Claves y Restricciones
```sql
-- Relación obligatoria de año en graduaciones
ALTER TABLE registro_graduados 
  ALTER COLUMN id_anio SET NOT NULL,
  ADD CONSTRAINT fk_graduados_anio 
    FOREIGN KEY (id_anio) REFERENCES anio_lectivo(id_anio) ON DELETE RESTRICT;

-- FKs formales de auditoría en traslados
ALTER TABLE traslados_estudiante
  ADD CONSTRAINT fk_traslados_usuario_solicita 
    FOREIGN KEY (id_usuario_solicita) REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_traslados_usuario_aprueba 
    FOREIGN KEY (id_usuario_aprueba) REFERENCES usuario(id_usuario) ON DELETE RESTRICT;

-- Índice para auditoría documental rápida
CREATE INDEX idx_documento_matricula_tipo 
  ON documento_matriculas (id_matricula, tipo_documento);
```

---

## 4. Resumen de Índices y Reglas del Módulo

| Objeto / Regla | Tipo | Propósito |
| :--- | :--- | :--- |
| `idx_documento_matricula_tipo` | `INDEX (id_matricula, tipo_documento)` | Acelera la verificación de requisitos de matrícula pendientes por entregar. |
| `fk_graduados_anio` | `FOREIGN KEY NOT NULL` | Garantiza que todo diploma y acta pertenezca a un año escolar legítimo. |
| `fk_traslados_usuario_*` | `FOREIGN KEY` | Trazabilidad del personal administrativo o directivo que gestiona la movilidad del estudiante. |
