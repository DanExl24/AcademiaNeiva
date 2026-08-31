# Casos de Uso — Estructura Escolar (Grados, Cursos, Jornadas y Materias)

Este documento describe los flujos de interacción y diagramas de secuencia paso a paso del módulo de **Estructura Escolar** de AcademiaNeiva.

---

## Caso de Uso 1: Creación de Cursos Físicos y Control de Aforos

### Actores
- **Directivo Escolar** (Coordinador Académico / Rector)

### Precondiciones
- La institución cuenta con al menos un Nivel Escolar, un Tipo de Grado y una Jornada habilitada.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as GradeManagement.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Abre consola de Grados y Cursos
    Frontend->>Backend: GET /api/academic-admin/grades/:schoolId
    Backend->>DB: Consulta niveles, grados, jornadas, secciones y grupos
    Backend-->>Frontend: Retorna estructura escolar completa

    Directivo->>Frontend: Clic en "Crear Curso" (Nivel, Grado, Jornada, Sección "10-1", Cupos: 35)
    Frontend->>Backend: POST /api/academic-admin/groups { schoolId, idNivel, idJornada, idTipoGrado, seccion_nombre: '10-1', cupos_totales: 35 }
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: Busca o crea '10-1' en tabla secciones
    Backend->>DB: Valida combinación no duplicada (jornada + grado + seccion)
    Backend->>DB: INSERT INTO grupos (id_nivel, id_jornada, id_seccion, id_tipo_grado, cupos_totales, id_colegio)
    Backend->>DB: COMMIT
    
    Backend-->>Frontend: Retorna curso creado (201 Created)
    Frontend-->>Directivo: Muestra el nuevo curso en la tarjeta del grado correspondiente
```

---

## Caso de Uso 2: Renombramiento de Cursos con Desvinculación de Secciones Compartidas

### Actores
- **Directivo Escolar**

### Precondiciones
- Existen cursos paralelos en la institución (ej. "10-A" y "11-A" que comparten la sección "A").

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as GradeManagement.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Selecciona curso "10-A" y digita nuevo nombre: "10-Ciencias"
    Frontend->>Backend: PATCH /api/academic-admin/groups/:id/rename { schoolId, nuevo_nombre: '10-Ciencias' }
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: Consulta cuántos grupos usan la sección 'A' (shared = 2)
    alt shared > 1 (Sección compartida)
        Backend->>DB: INSERT INTO secciones (nombre: '10-Ciencias') RETURNING id_seccion
        Backend->>DB: UPDATE grupos SET id_seccion = nuevo_id WHERE id_grupo = :id
    else shared <= 1 (Sección única)
        Backend->>DB: UPDATE secciones SET nombre = '10-Ciencias' WHERE id_seccion = actual_id
    end
    Backend->>DB: COMMIT
    
    Backend-->>Frontend: Retorna confirmación de éxito
    Frontend-->>Directivo: El curso "10-A" ahora se muestra como "10-Ciencias" sin alterar a "11-A"
```

---

## Caso de Uso 3: Eliminación Forzada de Materia y Respaldo Snapshot en Papelera

### Actores
- **Directivo Escolar**

### Precondiciones
- La materia a eliminar posee asignaciones docentes (`detalle_grados`) o competencias pedagógicas asociadas.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as SubjectManagement.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Clic en "Eliminar Materia" (ej. "Filosofía")
    Frontend->>Backend: DELETE /api/academic-admin/subjects/:id?schoolId=...&force=false
    Backend->>DB: Evalúa asignaciones_count y competencias_count
    Backend-->>Frontend: Retorna 409 Conflict con objeto impact (3 asignaciones, 4 competencias)
    Frontend-->>Directivo: Despliega modal de advertencia con recuento de impacto

    Directivo->>Frontend: Confirma eliminación forzada con bypass
    Frontend->>Backend: DELETE /api/academic-admin/subjects/:id?schoolId=...&force=true
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: Extrae snapshot JSON de todas las asignaciones docentes y competencias
    Backend->>DB: Elimina notas, actividades, evidencias y competencias de la materia
    Backend->>DB: Elimina registros en detalle_grados y materias
    Backend->>DB: INSERT INTO papelera_materias (id_colegio, nombre_materia, data_respaldo) VALUES (..., JSON)
    Backend->>DB: COMMIT
    
    Backend-->>Frontend: Retorna confirmación de eliminación exitosa
    Frontend-->>Directivo: Remueve la materia del catálogo activo y la muestra en la Papelera
```

---

## Caso de Uso 4: Restauración de Materia con Recreación de Asignaciones y Competencias

### Actores
- **Directivo Escolar**

### Precondiciones
- La materia fue eliminada forzadamente y existe su respaldo en la tabla `papelera_materias`.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as SubjectManagement.vue (Papelera)
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Ingresa a la pestaña "Papelera de Materias"
    Frontend->>Backend: GET /api/academic-admin/subjects/trash/:schoolId
    Backend->>DB: Consulta papelera_materias
    Backend-->>Frontend: Retorna lista de materias eliminadas con fecha y snapshot

    Directivo->>Frontend: Clic en "Restaurar" sobre la materia
    Frontend->>Backend: POST /api/academic-admin/subjects { schoolId, nombre: 'Filosofía', trashId: 14 }
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: INSERT INTO materias (nombre, id_colegio) RETURNING id_materia
    Backend->>DB: Lee data_respaldo de papelera_materias WHERE id_papelera = 14
    Backend->>DB: Re-inserta masivamente en detalle_grados (docente + grupo)
    Backend->>DB: Re-inserta masivamente en competencias (descripción + periodo + año + grupo)
    Backend->>DB: DELETE FROM papelera_materias WHERE id_papelera = 14
    Backend->>DB: COMMIT
    
    Backend-->>Frontend: Retorna materia restaurada (201 Created)
    Frontend-->>Directivo: Notifica restauración exitosa con su carga docente y competencias intactas
```

---

## Caso de Uso 5: Habilitación y Retiro de Jornadas Institucionales

### Actores
- **Directivo Escolar** (Coordinador / Rector)

### Precondiciones
- Para la habilitación: La jornada deseada no debe estar habilitada previamente en la institución.
- Para el retiro: La jornada a eliminar no debe tener ningún curso físico (`grupos`) asociado.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as GradeManagement.vue
    participant Modal as JornadaManagementModals.vue
    participant Backend as Express API (gradeGroupController)
    participant DB as PostgreSQL

    Note over Directivo,DB: Flujo A: Habilitación de Turno
    Directivo->>Frontend: Clic en "Habilitar Jornada"
    Frontend->>Modal: Despliega modal con availableJornadasToAdd (ej. 'NOCTURNA')
    Directivo->>Modal: Confirma selección
    Modal->>Backend: POST /api/academic-admin/jornadas { schoolId, nombre: 'NOCTURNA' }
    Backend->>DB: INSERT INTO jornada (id_colegio, nombre) VALUES (:schoolId, 'NOCTURNA') RETURNING *
    Backend-->>Modal: 201 Created
    Modal-->>Frontend: Actualiza catálogo de jornadas activas

    Note over Directivo,DB: Flujo B: Retiro Protegido de Turno
    Directivo->>Frontend: Clic en "Retirar Jornada" sobre 'NOCTURNA'
    Frontend->>Backend: DELETE /api/academic-admin/jornadas/:id?schoolId=...
    Backend->>DB: SELECT COUNT(id_grupo) FROM grupos WHERE id_jornada = :id AND id_colegio = :schoolId
    
    alt count > 0 (Cursos asociados)
        Backend-->>Frontend: 409 Conflict ("Tiene N cursos asociados. Reasigna o elimina los cursos antes")
        Frontend-->>Directivo: Muestra modal de alerta bloqueante
    else count == 0 (Sin cursos)
        Backend->>DB: DELETE FROM jornada WHERE id_jornada = :id AND id_colegio = :schoolId
        Backend-->>Frontend: 200 OK ("Jornada eliminada exitosamente")
        Frontend-->>Directivo: Notificación de retiro exitoso
    end
```

---

## Caso de Uso 6: Reasignación de Cursos entre Jornadas bajo Guarda Institucional

### Actores
- **Directivo Escolar / Administrador General**

### Precondiciones
- La política de reasignación institucional está autorizada (`IS_JORNADA_REASSIGNMENT_ENABLED = true`).
- El curso de origen existe y la jornada de destino pertenece a la misma institución.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as GradeManagement.vue
    participant Modal as JornadaManagementModals.vue
    participant Backend as Express API (gradeGroupController)
    participant DB as PostgreSQL

    Directivo->>Frontend: Clic en "Reasignar Jornada" para el curso "10-A (Mañana)"
    Frontend->>Modal: Abre diálogo con listado de jornadas disponibles
    Directivo->>Modal: Selecciona jornada "TARDE" y confirma
    Modal->>Backend: PATCH /api/academic-admin/groups/:id/jornada { schoolId, id_jornada: :targetId }
    
    Backend->>DB: SELECT * FROM grupos WHERE id_grupo = :id
    Backend->>DB: SELECT * FROM jornada WHERE id_jornada = :targetId AND id_colegio = :schoolId
    Backend->>DB: Valida colisión: SELECT * FROM grupos WHERE id_tipo_grado = :tg AND id_seccion = :sec AND id_jornada = :targetId
    
    alt Existe colisión ("10-A" ya existe en la Tarde)
        Backend-->>Frontend: 409 Conflict ("Ya existe un curso equivalente en la jornada TARDE")
        Frontend-->>Directivo: Alerta de colisión de nomenclatura
    else Sin colisión
        Backend->>DB: UPDATE grupos SET id_jornada = :targetId WHERE id_grupo = :id
        Backend-->>Frontend: 200 OK ("Curso reasignado exitosamente")
        Frontend-->>Directivo: Notificación verde y actualización de la distribución de cursos
    end
```
