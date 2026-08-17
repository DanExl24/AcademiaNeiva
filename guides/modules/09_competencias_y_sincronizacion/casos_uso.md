# Casos de Uso — Competencias Pedagógicas y Sincronización en Caliente

Este documento describe los flujos de interacción y diagramas de secuencia paso a paso del módulo de **Competencias y Sincronización** de AcademiaNeiva.

---

## Caso de Uso 1: Creación de Multicompetencia y Sincronización en Cursos Paralelos

### Actores
- **Directivo Escolar** (Coordinador Académico / Rector)

### Precondiciones
- El periodo académico se encuentra en estado `ABIERTO`.
- Existen cursos paralelos configurados para el grado escolar (ej. 10-A, 10-B y 10-C).

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as AcademicCompetenciesView.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Selecciona Materia, Periodo y Curso "10-A", digita descripción y envía
    Frontend->>Backend: POST /api/academic-admin/settings/competencies { schoolId, idGrupo, idMateria, idPeriodo, descripcion }
    
    Backend->>DB: Inicia Transacción (BEGIN)
    Backend->>DB: getGradePeerGroups -> Identifica cursos paralelos: [10-A, 10-B, 10-C]
    Backend->>Backend: Genera sync_uuid = randomUUID()
    
    loop Para cada curso paralelo (10-A, 10-B, 10-C)
        Backend->>DB: INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, sync_uuid)
        Backend->>DB: ensureDefaultEvidencias -> Inserta 3 evidencias formativas por defecto
    end
    
    Backend->>DB: Confirma Transacción (COMMIT)
    Backend-->>Frontend: Retorna competencia creada (200 OK)
    Frontend-->>Directivo: Muestra la competencia sincronizada en las pestañas de 10-A, 10-B y 10-C
```

---

## Caso de Uso 2: Vinculación de Evidencias DBA con Reemplazo de Evidencias por Defecto

### Actores
- **Directivo Escolar**

### Precondiciones
- La competencia fue creada previamente con evidencias formativas por defecto.
- El catálogo de DBA de la asignatura se encuentra configurado para el grado.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as AcademicCompetenciesView.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Marca 2 evidencias oficiales de DBA (ej. DBA #3 - Evidencias 1 y 2) y guarda
    Frontend->>Backend: POST /api/academic-admin/settings/competencies { ..., id_evidencias_dba: [45, 46] }
    
    Backend->>DB: Inicia Transacción
    Backend->>DB: Valida que las evidencias DBA no estén asignadas en otro periodo (alreadyAssignedRes)
    Backend->>DB: DELETE FROM evidencia_aprendizaje WHERE id_evidencia_dba IS NULL (Remueve evidencias por defecto)
    
    loop Para cada competencia hermana (mismo sync_uuid)
        Backend->>DB: INSERT / UPDATE evidencia_aprendizaje con id_evidencia_dba (45, 46)
    end
    
    Backend->>DB: COMMIT
    Backend-->>Frontend: Retorna competencia con evidencias oficiales vinculadas
    Frontend-->>Directivo: Refleja las evidencias de DBA sincronizadas en todos los paralelos
```

---

## Caso de Uso 3: Intento de Eliminación con Verificación de Uso Evaluativo (`usage-check`)

### Actores
- **Directivo Escolar**

### Precondiciones
- Un docente ya ha creado actividades evaluativas o calificado notas sobre la competencia.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo as Directivo Escolar
    participant Frontend as AcademicCompetenciesView.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Directivo->>Frontend: Clic en "Eliminar Competencia"
    Frontend->>Backend: GET /api/academic-admin/settings/competencies/:id/usage-check
    Backend->>DB: Consulta actividad_materia y nota_criterio para el sync_uuid
    Backend-->>Frontend: Retorna { isUsed: true, teachersUsage: [{ docente: 'Prof. Carlos', total_actividades: 2, total_notas: 35 }] }
    
    Frontend-->>Directivo: Despliega modal de BLOQUEO: "La competencia tiene actividades evaluativas asignadas por docentes"

    Directivo->>Frontend: Intenta forzar la eliminación
    Frontend->>Backend: DELETE /api/academic-admin/settings/competencies/:id
    Backend->>DB: Valida nuevamente usageRes.count > 0
    Backend-->>Frontend: 409 Conflict: "No se puede eliminar la competencia porque tiene 2 actividad(es) evaluativa(s)"
    Frontend-->>Directivo: Muestra alerta de error y preserva los datos intactos
```

---

## Caso de Uso 4: Edición de Competencia por el Docente con Validación de Cierre

### Actores
- **Docente Titular**

### Precondiciones
- El docente tiene asignada la materia en `detalle_grados`.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Docente as Docente de Asignatura
    participant Frontend as TeacherGrades.vue
    participant Backend as Express API
    participant DB as PostgreSQL

    Docente->>Frontend: Modifica el texto de la competencia desde la planilla y hace clic en "Guardar"
    Frontend->>Backend: PUT /api/teacher/competencies/:id { descripcion: "Nueva redacción pedagógica..." }
    
    Backend->>DB: Valida periodo_academico.estado !== 'CERRADO'
    Backend->>DB: Valida ensureSubjectOpen (cierre_materia !== 'CERRADO')
    
    alt Si la materia o periodo están cerrados
        Backend-->>Frontend: Retorna 409 Conflict ("No se puede modificar: materia/periodo cerrado")
        Frontend-->>Docente: Muestra notificación de error y bloquea la edición
    else Si está abierta
        Backend->>DB: Inicia Transacción
        Backend->>DB: UPDATE competencias SET descripcion = $1 WHERE sync_uuid = $2
        Backend->>DB: COMMIT
        Backend-->>Frontend: Retorna competencia actualizada (200 OK)
        Frontend-->>Docente: Muestra confirmación de sincronización exitosa en el grado
    end
```
