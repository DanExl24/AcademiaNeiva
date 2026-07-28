# Casos de Uso — Matrículas e Inscripciones

Este documento describe los flujos principales de interacción del módulo de Matrículas e Inscripciones de AcademiaNeiva.

---

## Caso de Uso 1: Proceso de Matrícula Regular (Flujo Ordinario)

### Actores
- **Padre de Familia / Aspirante** (Público)
- **Directivo Escolar** (Coordinador de Admisiones / Rector)

### Precondiciones
- El colegio se encuentra en el rango de fechas de inscripciones habilitado.
- El grupo de destino cuenta con cupos disponibles.

### Flujo Principal (Paso a Paso)

```mermaid
sequenceDiagram
    autonumber
    actor Padre as Padre de Familia
    actor Directivo
    participant Sistema
    
    Padre->>Sistema: Diligencia formulario de inscripción y sube archivos
    Sistema->>Sistema: Valida tamaño de archivos y fechas ordinarias
    Sistema->>Sistema: Crea matrícula 'PENDIENTE' y asocia token UUID
    Sistema-->>Padre: Muestra código de seguimiento y envía email
    
    Directivo->>Sistema: Ingresa a panel de control de matrículas
    Sistema-->>Directivo: Muestra solicitudes en estado 'PENDIENTE'
    
    Directivo->>Sistema: Evalúa y valida documentos uno a uno
    Sistema->>Sistema: Cambia estados a 'VALIDADO'
    
    Directivo->>Sistema: Asigna grado escolar y grupo al aspirante
    Sistema->>Sistema: Verifica cupos y cambia estado de matrícula a 'APROBADA'
    
    Directivo->>Sistema: Presiona "Finalizar Matrícula"
    Sistema->>Sistema: Transiciona matrícula a 'ACTIVA'
    Sistema->>Sistema: Crea registro en 'estudiante' con código único
    Sistema->>Sistema: Crea cuenta de 'usuario' (rol estudiante, activo)
    Sistema-->>Directivo: Muestra confirmación de oficialización
```

1. **Inscripción Pública:** El padre de familia accede al formulario de inscripción pública del colegio, ingresa los datos personales del aspirante y los suyos, adjunta los archivos PDF/imágenes obligatorios, y hace clic en "Enviar".
2. **Inicialización de Solicitud:** El sistema verifica que las inscripciones estén abiertas, valida que los archivos no superen el límite de 5MB, almacena los archivos en el servidor local, inserta el registro en la tabla `matricula` en estado `'PENDIENTE'` con un token UUID de seguimiento, y muestra en pantalla el código UUID.
3. **Revisión del Directivo:** El directivo escolar ingresa a su panel de gestión de matrículas, filtra las solicitudes por estado `'PENDIENTE'` y selecciona la ficha del aspirante.
4. **Validación de Documentación:** El directivo abre en línea cada documento (ej. Registro Civil). Tras comprobar que es legible y válido, presiona "Validar". El sistema cambia el estado del archivo a `'VALIDADO'`.
5. **Asignación de Salón:** Al estar todos los documentos validados, el directivo selecciona el Grado y el Grupo de clase (ej. Primero A) en la consola lateral y presiona "Asignar Grupo". El sistema comprueba que queden cupos en "Primero A", asocia el grupo a la matrícula, y promueve el estado de la solicitud a `'APROBADA'`.
6. **Oficialización:** El directivo presiona el botón "Finalizar Matrícula" en el panel. El sistema cambia el estado a `'ACTIVA'`, inserta automáticamente la ficha de `estudiante` activa con su código institucional único, y le crea una cuenta de ingreso en `usuario` con rol `estudiante` y estado `ACTIVO`.

### Flujos Alternativos / Excepciones
- **Excepción 4a (Documento con Inconsistencia):** Si un documento es borroso o incorrecto, el directivo presiona "Rechazar" y digita el motivo. El sistema cambia el estado del documento a `'RECHAZADO'` y el de la matrícula completa a `'CORRECCION'`. El padre de familia, al consultar su token, visualiza los campos rechazados, sube los archivos corregidos y presiona "Enviar Corrección", devolviendo la matrícula a estado `'PENDIENTE'` para una nueva validación directiva.
- **Excepción 5a (Grupo Sin Cupos):** Si el grupo de clase seleccionado ya completó su límite máximo de cupos en base a los alumnos activos matriculados, la acción de asignación del directivo se bloquea y el sistema muestra un mensaje de error indicando que debe liberar cupos o seleccionar un grupo paralelo alternativo.

### Postcondiciones
- El estudiante es dado de alta de manera oficial en la institución y cuenta con credenciales activas para el ingreso a su portal personal.
- La matrícula queda registrada como `'ACTIVA'` y vinculada permanentemente para el año lectivo en curso.

---

## Caso de Uso 2: Proceso de Reingreso de Estudiante Retirado y Renovación Documental

### Actores
- **Directivo Escolar** (Coordinador / Rector)
- **Padre de Familia / Acudiente**

### Precondiciones
- El estudiante se encuentra en estado `RETIRADO` en el sistema.
- Existe un Año Lectivo activo habilitado con grupos y cupos creados.

### Flujo Principal (Paso a Paso)

```mermaid
sequenceDiagram
    autonumber
    actor Directivo
    actor Padre as Padre de Familia / Acudiente
    participant Sistema
    
    Directivo->>Sistema: Ingresa a la consola de Gestión de Reingresos
    Directivo->>Sistema: Selecciona el expediente del estudiante retirado
    Sistema-->>Directivo: Muestra datos del alumno, acudiente e historial de retiro
    
    Directivo->>Sistema: Configura Destino (Año Lectivo, Nivel, Grado, Salón con cupos)
    Sistema->>Sistema: Valida disponibilidad de cupos en el grupo seleccionado
    
    Directivo->>Sistema: Define matriz documental (VIGENTE vs RENOVAR)
    Directivo->>Sistema: Presiona "Enviar Enlace de Reingreso"
    
    Sistema->>Sistema: Crea matrícula 'PENDIENTE_RENOVACION' (tipo REINGRESO)
    Sistema->>Sistema: Pasa ticket de incidencia a 'EN_PROCESO' (Irreversible)
    Sistema->>Sistema: Genera token UUID y envía email al acudiente
    Sistema-->>Directivo: Muestra confirmación de envío exitoso
    
    Padre->>Sistema: Accede al enlace con token desde el correo
    Padre->>Sistema: Sube los documentos requeridos marcados como 'RENOVAR'
    Sistema->>Sistema: Conserva estado 'PENDIENTE_RENOVACION' y actualiza archivos
    
    Directivo->>Sistema: Ingresa a Gestión de Matrículas y revisa documentos
    Directivo->>Sistema: Valida documentos y presiona "Siguiente"
    Directivo->>Sistema: Presiona "Procesar Registro / Renovación"
    
    Sistema->>Sistema: Transiciona matrícula a 'ACTIVA'
    Sistema->>Sistema: Cambia estado de estudiante a 'ACTIVO'
    Sistema-->>Directivo: Confirma reingreso oficializado del estudiante
```

1. **Selección del Expediente:** El directivo ingresa a la vista de **Gestión de Reingresos** (`ReingresoManagement.vue`) y selecciona al estudiante retirado de la lista o desde un ticket de soporte de reingreso.
2. **Carga de Historial:** El sistema presenta el perfil del alumno, los datos de su acudiente registrado y su motivo de retiro.
3. **Configuración de Destino:** El directivo especifica el Año Lectivo Activo, Nivel Escolar, Grado y Grupo/Salón de destino. El selector de salones calcula en tiempo real los cupos disponibles e impide la asignación a cursos sin espacio.
4. **Matriz Documental:** El directivo marca los documentos que se encuentran vigentes (`VIGENTE`) y aquellos que requieren renovación por parte del acudiente (`RENOVAR`).
5. **Apertura de Reingreso y Notificación:** El directivo presiona "Enviar Enlace de Reingreso". El sistema crea la matrícula en estado `PENDIENTE_RENOVACION` con tipo `REINGRESO`, actualiza el ticket asociado a `EN_PROCESO` de forma irreversible, y envía un correo electrónico al acudiente con las instrucciones y el token de seguimiento.
6. **Subsanación por el Acudiente:** El acudiente accede mediante el token recibido por email, sube los archivos requeridos y confirma el envío. La matrícula conserva su estado `PENDIENTE_RENOVACION`.
7. **Revisión y Oficialización:** El directivo abre la matrícula desde la consola de matrículas, valida los documentos renovados, avanza al paso 3 ("Siguiente") y presiona "Procesar Registro / Renovación". El sistema pasa la matrícula a `ACTIVA` y reactiva la ficha del estudiante a `ACTIVO`.

### Flujos Alternativos / Excepciones
- **Excepción 3a (Estudiante Inexistente o Sin Antecedentes):** Si el acudiente abrió un ticket de reingreso pero el alumno no figura en los registros de retirados, el directivo presiona "Notificar Antecedente No Encontrado". El sistema envía un correo al acudiente y cierra la incidencia.
- **Excepción 5a (Ticket de Reingreso Irreversible):** Si el directivo intenta cambiar el estado de un ticket de reingreso a `EN_PROCESO`, la interfaz muestra una alerta informando que la acción notificará al padre y no se podrá revertir a `ABIERTO`.

### Postcondiciones
- El alumno es reintegrado oficialmente en el nuevo grupo escolar con matrícula `ACTIVA` y expediente reactivado.
- Se conserva la trazabilidad histórica de su retiro y su reingreso.

