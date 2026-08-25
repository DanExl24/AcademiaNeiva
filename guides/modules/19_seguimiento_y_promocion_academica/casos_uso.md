# Casos de Uso — Seguimiento Académico, Promoción y Reprobación Anual

Este documento describe los flujos de interacción y diagramas de secuencia paso a paso del módulo de **Seguimiento Académico y Promoción Anual** de AcademiaNeiva.

---

## Caso de Uso 1: Consolidación Anual y Clasificación de Promoción

### Actores
- **Directivo Escolar** (Coordinador Académico / Rector)

### Precondiciones
- El año lectivo cuenta con periodos académicos y notas registradas.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as AcademicTrackingView.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Ingresa a "Consolidado Anual de Promoción" para el Grado 10
    Frontend->>Backend: GET /api/academic-admin/academic-tracking/annual-consolidation?schoolId=1&yearId=5&gradeId=10
    
    Backend->>DB: Consulta promedios por materia para todos los periodos del año
    Backend->>DB: Calcula promedio anual por asignatura dividiendo entre total periodos del año
    Backend->>DB: getMaxGradeIdForSchool -> Determina si es último grado (is_final_grade)
    Backend->>DB: Clasifica cada estudiante (0 reprobadas: APROBADO, 1-2: PENDIENTE, >=3: NO_PROMOVIDO)
    
    Backend-->>Frontend: Retorna lista de estudiantes clasificados con materias reprobadas y banderas de graduando
    Frontend-->>Directivo: Muestra la tabla de consolidado con insignias de estado y botones de decisión
```

---

## Caso de Uso 2: Promoción y Graduación Automática de Graduandos

### Actores
- **Directivo Escolar**

### Precondiciones
- El estudiante pertenece al grado superior de la institución (`is_final_grade: true`) y ha culminado el año escolar.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as AcademicTrackingView.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Abre modal de decisión sobre el estudiante graduando Juan (Grado 11)
    Frontend->>Frontend: Detecta is_final_grade=true y despliega botón "Promover y Graduar Estudiante 🎓"
    Directivo->>Frontend: Selecciona "PROMOVER_SIGUIENTE_GRADO" e ingresa observación del acta de grado
    Frontend->>Backend: POST /api/academic-admin/academic-tracking/record-decision { studentId: 45, decisionTaken: 'PROMOVER_SIGUIENTE_GRADO', ... }
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: Valida que el año lectivo no esté CERRADO y esté en periodo final (RN-19.5)
    Backend->>DB: UPDATE estudiante SET estado = 'GRADUADO' WHERE id_estudiante = 45
    Backend->>DB: INSERT INTO registro_graduados (id_estudiante, fecha_graduacion, id_usuario_registro, id_anio)
    Backend->>DB: INSERT / UPDATE en decision_promocion_directivo (decision_tomada: 'PROMOVER_SIGUIENTE_GRADO', id_grado_asignado: null)
    Backend->>DB: COMMIT
    
    Backend-->>Frontend: 200 OK { autoGraduated: true, message: "Estudiante graduado y promovido exitosamente" }
    Frontend-->>Directivo: Muestra notificación de graduación exitosa con ícono de birrete 🎓
```

---

## Caso de Uso 3: Registro de Decisión Directiva con Condición de Periodo Final

### Actores
- **Directivo Escolar**

### Precondiciones
- El estudiante presenta 3 asignaturas reprobadas (`NO_PROMOVIDO`) y el comité directivo decide mantener el grado.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as AcademicTrackingView.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Selecciona Decisión "MANTENER_GRADO", asigna grado repetido e ingresa justificación
    Frontend->>Backend: POST /api/academic-admin/academic-tracking/record-decision { studentId: 12, decisionTaken: 'MANTENER_GRADO', assignedGradeId: 8, ... }
    
    Backend->>DB: Verifica closedPeriodsCount >= totalPeriodsCount - 1
    alt Si el año lectivo no ha llegado a su periodo final
        Backend-->>Frontend: 400 Bad Request ("No es posible registrar decisión: año lectivo en curso inicial")
        Frontend-->>Directivo: Muestra alerta de bloqueo
    else Si está en periodo final o concluido
        Backend->>DB: INSERT / UPDATE decision_promocion_directivo
        Backend-->>Frontend: 200 OK: "Decisión directiva registrada exitosamente"
        Frontend-->>Directivo: Actualiza la tarjeta del estudiante mostrando la decisión adoptada
    end
```

---

## Caso de Uso 4: Verificación Informativa de Advertencia en Matrícula

### Actores
- **Directivo Escolar**

### Precondiciones
- El directivo está formalizando la matrícula de un estudiante en `FinalRegistration.vue`.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as FinalRegistration.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Digita documento de identidad del estudiante
    Frontend->>Backend: GET /api/academic-admin/academic-tracking/check-warning?documento=1075283921
    
    Backend->>DB: Consulta última matrícula del alumno y calificaciones de dicho año lectivo
    Backend->>DB: Detecta 2 materias reprobadas en el año anterior (Matemáticas: 2.5, Física: 2.8)
    Backend-->>Frontend: Retorna { warning: true, cantidad_materias_reprobadas: 2, materias_reprobadas: [...] }
    
    Frontend-->>Directivo: Despliega tarjeta amarilla: "⚠️ Advertencia académica: Reprobó 2 asignaturas en el ciclo lectivo anterior"
    Note over Directivo,Frontend: El directivo evalúa el antecedente y formaliza la matrícula según criterio institucional
```
