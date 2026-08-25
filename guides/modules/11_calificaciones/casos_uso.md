# Casos de Uso — Calificaciones, Actividades y Evaluación Curricular

Este documento describe los flujos de interacción y diagramas de secuencia paso a paso del módulo de **Calificaciones y Actividades** de AcademiaNeiva.

---

## Caso de Uso 1: Creación de Actividad con Criterios Porcentuales y Evidencias DBA

### Actores
- **Docente Titular de Asignatura**

### Precondiciones
- El docente tiene asignada la materia en `detalle_grados` para el año y curso actual.
- El periodo académico se encuentra en estado `ABIERTO`.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Docente as Docente Titular
    participant Frontend as TeacherGrades.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Docente->>Frontend: Clic en "Nueva Actividad" (Nombre: "Taller Grupal", Ponderación: 30%, Evidencia DBA #2)
    Frontend->>Backend: POST /api/teacher/activities { nombre: 'Taller Grupal', porcentaje: 30, evidencias_dba: [12], id_colegio: 1 }
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: Valida sum(porcentaje) <= 100% para la materia/periodo
    Backend->>DB: INSERT INTO actividad_materia (nombre, porcentaje, id_docente_creador) RETURNING id_actividadmateria
    Backend->>DB: INSERT INTO actividad_evidencia_dba (id_actividadmateria, id_evidencia_dba)
    Backend->>DB: COMMIT
    Backend-->>Frontend: Retorna actividad creada (201 Created)

    Docente->>Frontend: Desglosa la actividad creando Criterio "Exposición Oral" (50%) y "Informe Escrito" (50%)
    Frontend->>Backend: POST /api/teacher/activities/criteria { id_actividadmateria: 42, descripcion: 'Exposición Oral', porcentaje: 50 }
    Backend->>DB: INSERT INTO criterio_evaluacion (...)
    Backend-->>Frontend: Retorna criterio creado (201 Created)
    Frontend-->>Docente: Muestra la actividad desglosada en dos columnas de criterio en la planilla
```

---

## Caso de Uso 2: Creación de Actividad con Evidencia Extra y Justificación Pedagógica

### Actores
- **Docente Titular**

### Precondiciones
- El docente selecciona una evidencia de DBA que pertenece al grado pero fue planificada para otro periodo.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Docente as Docente Titular
    participant Frontend as TeacherGrades.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Docente->>Frontend: Selecciona Evidencia DBA no planificada en el periodo actual
    Frontend->>Frontend: Detecta evidencia fuera de planeación y despliega campos de justificación obligatoria
    Docente->>Frontend: Selecciona Motivo: "REFUERZO" y envía formulario
    Frontend->>Backend: POST /api/teacher/activities { ..., motivo_extra: 'REFUERZO', evidencias_dba: [18] }
    
    Backend->>DB: Valida que motivo_extra esté presente y no vacío
    Backend->>DB: INSERT INTO actividad_materia (..., motivo_extra: 'REFUERZO')
    Backend-->>Frontend: Retorna actividad creada con trazabilidad de refuerzo pedagógico
    Frontend-->>Docente: Muestra la actividad con insignia "Refuerzo Pedagógico" en la planilla
```

---

## Caso de Uso 3: Registro Masivo de Calificaciones con Sincronización Automática Criterio-Actividad

### Actores
- **Docente Titular**

### Precondiciones
- La actividad cuenta con criterios configurados (ej. Criterio 1: 50%, Criterio 2: 50%).

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Docente as Docente Titular
    participant Frontend as TeacherGrades.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Docente->>Frontend: Digita notas en la planilla para el estudiante Juan (Crit 1: 4.0, Crit 2: 5.0) y presiona "Guardar Notas"
    Frontend->>Backend: POST /api/teacher/grades { schoolId: 1, criteriaGrades: [{ id_criterio: 1, id_estudiante: 10, nota: 4.0 }, { id_criterio: 2, id_estudiante: 10, nota: 5.0 }] }
    
    Backend->>DB: Inicia Transacción (BEGIN)
    Backend->>DB: Valida matrícula ACTIVA para el estudiante Juan en el colegio
    Backend->>DB: INSERT / UPDATE en nota_criterio (Crit 1 = 4.0, Crit 2 = 5.0)
    
    Backend->>DB: Calcula promedio ponderado: (4.0*50 + 5.0*50) / 100 = 4.5
    Backend->>DB: Ubica escala_valoracion para 4.5 -> 'ALTO'
    Backend->>DB: INSERT / UPDATE en notas_actividad (id_actividadmateria, id_estudiante: 10, nota: 4.5, id_escalavaloracion: 'ALTO')
    
    Backend->>DB: Confirma Transacción (COMMIT)
    Backend-->>Frontend: Retorna confirmación de guardado exitoso
    Frontend-->>Docente: Actualiza la celda resumen de la actividad con 4.5 (Desempeño Alto)
```

---

## Caso de Uso 4: Intento de Calificación sobre Estudiantes Inactivos o Periodo Cerrado

### Actores
- **Docente Titular**

### Precondiciones
- Un estudiante del listado fue transferido de colegio (estado matrícula: `TRASLADADA`) o el directivo cerró el periodo escolar.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Docente as Docente Titular
    participant Frontend as TeacherGrades.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Docente->>Frontend: Modifica una calificación y hace clic en "Guardar Notas"
    Frontend->>Backend: POST /api/teacher/grades { schoolId: 1, activityGrades: [...] }
    
    alt Si el periodo o la materia están CERRADOS
        Backend->>DB: ensurePeriodOpen / ensureSubjectOpen
        Backend-->>Frontend: 409 Conflict: "No se pueden guardar notas: periodo/materia cerrado"
        Frontend-->>Docente: Muestra alerta de bloqueo y deshabilita los campos de edición
    else Si hay estudiantes trasladados/inactivos
        Backend->>DB: Consulta matricula WHERE estado IN ('ACTIVA', 'APROBADA')
        Backend-->>Frontend: 409 Conflict: "No es posible registrar calificaciones. El estudiante Pedro no posee matrícula activa (trasladado)"
        Frontend-->>Docente: Muestra advertencia detallada con los nombres de los estudiantes bloqueados
    end
```
