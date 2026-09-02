-- ============================================================================
-- SCRIPT DE CORRECCIÓN DE CODIFICACIÓN (MOJIBAKE / UTF-8 REPAIR)
-- ============================================================================
-- Este script repara automáticamente cualquier carácter corrupto o doblemente
-- codificado en las tablas de la base de datos de AcademiaNeiva.

BEGIN;

-- 1. Estudiantes
UPDATE estudiante 
SET nombre = convert_from(convert_to(nombre, 'latin1'), 'utf8'),
    apellido = convert_from(convert_to(apellido, 'latin1'), 'utf8')
WHERE nombre ~ '[\u00C2\u00C3]' OR apellido ~ '[\u00C2\u00C3]';

-- 2. Usuarios
UPDATE usuario 
SET nombre = convert_from(convert_to(nombre, 'latin1'), 'utf8'),
    apellido = convert_from(convert_to(apellido, 'latin1'), 'utf8')
WHERE nombre ~ '[\u00C2\u00C3]' OR apellido ~ '[\u00C2\u00C3]';

-- 3. Docentes
UPDATE docente 
SET nombre = convert_from(convert_to(nombre, 'latin1'), 'utf8'),
    apellido = convert_from(convert_to(apellido, 'latin1'), 'utf8')
WHERE nombre ~ '[\u00C2\u00C3]' OR apellido ~ '[\u00C2\u00C3]';

-- 4. Padres de familia
UPDATE padre_familia 
SET nombre = convert_from(convert_to(nombre, 'latin1'), 'utf8'),
    apellido = convert_from(convert_to(apellido, 'latin1'), 'utf8')
WHERE nombre ~ '[\u00C2\u00C3]' OR apellido ~ '[\u00C2\u00C3]';

-- 5. Materias
UPDATE materias 
SET nombre = convert_from(convert_to(nombre, 'latin1'), 'utf8')
WHERE nombre ~ '[\u00C2\u00C3]';

-- 6. Competencias
UPDATE competencias 
SET nombre = convert_from(convert_to(nombre, 'latin1'), 'utf8'),
    descripcion = convert_from(convert_to(descripcion, 'latin1'), 'utf8')
WHERE nombre ~ '[\u00C2\u00C3]' OR descripcion ~ '[\u00C2\u00C3]';

-- 7. DBA y Evidencias
UPDATE dba 
SET descripcion = convert_from(convert_to(descripcion, 'latin1'), 'utf8')
WHERE descripcion ~ '[\u00C2\u00C3]';

UPDATE evidencia_aprendizaje 
SET descripcion = convert_from(convert_to(descripcion, 'latin1'), 'utf8')
WHERE descripcion ~ '[\u00C2\u00C3]';

-- 8. Resultados Académicos
UPDATE resultado_academico 
SET observacion = convert_from(convert_to(observacion, 'latin1'), 'utf8')
WHERE observacion ~ '[\u00C2\u00C3]';

-- 9. Auditorías
UPDATE auditoria_supervision
SET motivo_solicitud = convert_from(convert_to(motivo_solicitud, 'latin1'), 'utf8')
WHERE motivo_solicitud ~ '[\u00C2\u00C3]';

COMMIT;
