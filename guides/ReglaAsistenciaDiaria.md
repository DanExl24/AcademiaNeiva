# Regla de Negocio: Límite de Asistencia Diaria

Para garantizar la integridad de los datos académicos y reflejar la realidad pedagógica de la institución, se ha implementado una validación estricta en el registro de asistencia.

## Descripción de la Regla

**Ningún estudiante puede tener más de 7 bloques académicos o registros de asistencia en un mismo día.**

Esta regla se aplica de forma automática en el servidor cada vez que un docente intenta guardar el listado de asistencia. Si un estudiante ya cuenta con 7 registros (en diferentes materias) para esa fecha, el sistema impedirá nuevos registros para ese alumno.

## Beneficios de la Implementación

1. **Integridad de Datos**: Evita inconsistencias donde un estudiante parece estar presente en una cantidad de materias físicamente imposible para una jornada escolar.
2. **Prevención de Errores Humanos**: Controla casos donde se pueda estar duplicando información por error administrativo o de digitación.
3. **Consistencia Estadística**: Asegura que los reportes de ausentismo y las tarjetas de resumen en el portal del estudiante muestren datos coherentes y verídicos.
4. **Validación Pedagógica**: Alinea el sistema con las recomendaciones de carga académica diaria (Primaria: 4-6 materias, Secundaria/Media: 5-7 materias).
5. **Ahorro de Tiempo en Auditoría**: Reduce la necesidad de limpiar datos inconsistentes manualmente en el futuro.

## Consideraciones Técnicas

- La validación es **insensible al orden** de registro (no importa qué docente registre primero).
- Permite la **actualización de registros existentes**: Si un docente necesita corregir la asistencia de su propia materia, el límite no se verá afectado ya que el sistema reconoce que es el mismo bloque académico.
- El sistema informa proactivamente el nombre del estudiante que ha excedido el límite para facilitar la corrección inmediata por parte del docente.
