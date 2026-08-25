# Casos de Uso — Cierre de Periodo y Generación de Boletines

Este documento describe los flujos de interacción y diagramas de secuencia paso a paso del módulo de **Cierre de Periodo y Boletines** de AcademiaNeiva.

---

## Caso de Uso 1: Cierre de Asignatura por el Docente con Justificación de Evidencias

### Actores
- **Docente Titular de Asignatura**

### Precondiciones
- Todas las actividades evaluativas y criterios de la asignatura han sido calificados para todos los estudiantes con matrícula activa.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Docente as Docente Titular
    participant Frontend as TeacherClosure.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Docente->>Frontend: Clic en "Cerrar Materia" (ej. Matemáticas 10-A, Periodo 1)
    Frontend->>Backend: POST /api/teacher/close-period { detailGradeId: 15, periodId: 2 }
    
    Backend->>DB: Valida que no existan notas pendientes para alumnos activos
    Backend->>DB: Evalúa si hay evidencias DBA planeadas no evaluadas (unevaluatedEvidences)
    
    alt Hay evidencias DBA pendientes sin justificación
        Backend-->>Frontend: 422 Unprocessable Entity { requires_justification: true, unevaluated_evidences: [DBA 3, Ev 2] }
        Frontend-->>Docente: Despliega modal exigiendo ingresar la justificación pedagógica
        Docente->>Frontend: Digita justificación: "Tema aplazado por semanas culturales" y reenvía
        Frontend->>Backend: POST /api/teacher/close-period { detailGradeId: 15, periodId: 2, justificacion_evidencias_pendientes: "..." }
    end

    Backend->>DB: Inicia Transacción
    Backend->>DB: INSERT / UPDATE en cierre_materia (estado = 'CERRADO', fecha_cierre = NOW(), id_docente_cierre)
    Backend->>DB: COMMIT
    Backend-->>Frontend: 200 OK: "Periodo cerrado exitosamente para esta materia"
    Frontend-->>Docente: Muestra insignia "Materia Cerrada" y bloquea la edición de notas
```

---

## Caso de Uso 2: Aprobación y Cierre Institucional del Periodo

### Actores
- **Directivo Escolar** (Coordinador Académico / Rector)

### Precondiciones
- El 100% de las asignaturas en `detalle_grados` para el colegio y año están en estado `CERRADO`.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as PeriodClosure.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Abre consola de Cierres de Periodo
    Frontend->>Backend: GET /api/academic-admin/settings/closure-details/:schoolId/:periodId
    Backend->>DB: Cuenta total asignaturas activas vs. total cerradas en cierre_materia
    Backend-->>Frontend: Retorna { total_materias: 40, cerradas: 40, progreso: 100% }
    Frontend-->>Directivo: Habilita botón "Aprobar y Cerrar Periodo Institucional"

    Directivo->>Frontend: Confirma la aprobación del periodo
    Frontend->>Backend: POST /api/academic-admin/academic-periods/:periodId/approve { schoolId: 1 }
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: UPDATE periodo_academico SET estado = 'CERRADO' WHERE id_periodo = :periodId
    Backend->>DB: COMMIT
    
    Backend-->>Frontend: 200 OK: "Periodo institucional cerrado con éxito"
    Frontend-->>Directivo: Notifica cierre definitivo y habilita la generación de boletines
```

---

## Caso de Uso 3: Reapertura Quirúrgica de Materia por Directivo

### Actores
- **Directivo Escolar**

### Precondiciones
- La materia se encuentra en estado `CERRADO` y un docente requiere corregir una nota de forma justificada.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as PeriodClosure.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Localiza la materia "Ciencias Naturales 8-B" y hace clic en "Reabrir Materia"
    Frontend->>Backend: POST /api/academic-admin/settings/reopen-subject-closure { schoolId: 1, detailGradeId: 28, periodId: 2 }
    
    Backend->>DB: DELETE FROM cierre_materia WHERE id_detallegrado = 28 AND id_periodo = 2
    Backend-->>Frontend: 200 OK: "Materia reabierta exitosamente"
    
    Frontend-->>Directivo: Actualiza la barra de progreso institucional y notifica éxito
    Note over Frontend,Backend: La planilla docente queda habilitada de nuevo para guardar notas
```

---

## Caso de Uso 4: Generación de Boletín Estudiantil con Cálculo de Puesto y Firmas

### Actores
- **Directivo, Estudiante o Acudiente**

### Precondiciones
- El periodo académico se encuentra en estado `CERRADO` institucionalmente.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Estudiante / Acudiente / Directivo
    participant Frontend as StudentBoletinView.vue / BoletinGenerator.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Usuario->>Frontend: Clic en "Ver / Descargar Boletín"
    Frontend->>Backend: GET /api/boletines/student/:id_estudiante/:id_periodo
    
    Backend->>DB: Valida periodo_academico.estado === 'CERRADO'
    Backend->>DB: Consulta datos de colegio (escudo, DANE, calendario) y estudiante
    Backend->>DB: Consulta histórico de notas de trimestres anteriores y actual por materia
    Backend->>DB: Ejecuta RANK() OVER (ORDER BY student_avg DESC) para calcular puesto y total_grupo
    Backend->>DB: Extrae ausencias acumuladas, desempeños y observaciones pedagógicas
    Backend->>DB: Resuelve nombres de Titular de grupo y Rector
    
    Backend-->>Frontend: Retorna JSON estructurado del Boletín
    Frontend-->>Usuario: Renderiza el Boletín Oficial en PDF con firmas, puesto y gráficas de desempeño
```
