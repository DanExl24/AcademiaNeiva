# Casos de Uso — Matrículas e Inscripciones

Este documento describe los flujos de interacción y diagramas de secuencia paso a paso del módulo de **Matrículas e Inscripciones** de AcademiaNeiva.

---

## Caso de Uso 1: Proceso de Matrícula Regular (Flujo Ordinario con OTP)

### Actores
- **Padre de Familia / Acudiente** (Público)
- **Directivo Escolar** (Coordinador de Admisiones / Rector)

### Precondiciones
- El colegio cuenta con un Año Lectivo activo en estado `ABIERTO`.
- La fecha actual se encuentra dentro del rango `[fecha_inicio, fecha_cierre]` configurado en `configuracion_inscripcion` con `habilitada = true`.
- Existen grupos y cupos configurados.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Padre as Padre de Familia / Acudiente
    actor Directivo as Directivo Escolar
    participant Frontend as Vue 3 App
    participant Backend as Express + Kysely
    participant DB as PostgreSQL
    participant SMTP as NotificationService

    %% Paso 1: Verificación OTP
    Padre->>Frontend: Digita correo del acudiente y clic en "Enviar Código OTP"
    Frontend->>Backend: POST /api/matriculas/send-email-code { email }
    Backend->>DB: Inserta en codigo_verificacion_email (15 min)
    Backend->>SMTP: Envía código de 6 dígitos al correo
    Padre->>Frontend: Ingresa código OTP de 6 dígitos
    Frontend->>Backend: POST /api/matriculas/verify-email-code { email, code }
    Backend->>DB: Marca verified = true
    Frontend-->>Padre: Habilita el formulario de inscripción

    %% Paso 2: Radicación
    Padre->>Frontend: Selecciona nivel/grado, adjunta archivos (PDF/img) y envía
    Frontend->>Backend: POST /api/matriculas/submit (Multipart FormData)
    Backend->>Backend: Valida isVerified(email, 2 horas) y fechas en configuracion_inscripcion
    Backend->>DB: Inserta matricula (PENDIENTE, token UUID) + documento_matriculas (BYTEA)
    Backend->>SMTP: Envía correo de confirmación con Token de Seguimiento
    Frontend-->>Padre: Muestra pantalla de éxito con Token UUID

    %% Paso 3: Evaluación y Subsanación
    Directivo->>Frontend: Ingresa a Gestión de Matrículas (EnrollmentManagement.vue)
    Frontend->>Backend: GET /api/matriculas/filtered/:idColegio?estado=PENDIENTE
    Directivo->>Frontend: Abre expediente (EnrollmentDetails.vue)
    Frontend->>Backend: GET /api/matriculas/:id (Retorna docs con tokens efímeros y cupos)
    Directivo->>Frontend: Inspecciona PDFs y valida/rechaza cada documento
    Frontend->>Backend: PATCH /api/matriculas/document/:idDoc { estado: 'VALIDADO'/'RECHAZADO' }
    
    alt Si hay documentos rechazados
        Directivo->>Frontend: Clic en "Notificar Inconsistencias"
        Frontend->>Backend: POST /api/matriculas/notify-inconsistencies/:id
        Backend->>DB: Actualiza matricula.estado = 'CORRECCION'
        Backend->>SMTP: Envía email al padre con observaciones
        Padre->>Frontend: Accede por token a EnrollmentCorrection.vue y sube archivos corregidos
        Frontend->>Backend: POST /api/matriculas/update-documents/:token (Files)
        Backend->>DB: Inserta en documento_matriculas con version = version + 1 y matricula.estado = 'CORREGIDA'
    end

    %% Paso 4: Asignación y Formalización
    Directivo->>Frontend: Selecciona aula física y clic en "Asignar Salón"
    Frontend->>Backend: POST /api/matriculas/assign-grade/:id { idGrado }
    Backend->>DB: Actualiza matricula.id_grupo
    Directivo->>Frontend: Clic en "Continuar a Formalización" (FinalRegistration.vue)
    Frontend->>Backend: GET /api/auth/check-document/:doc (Verifica acudiente)
    Directivo->>Frontend: Confirma datos de estudiante y acudiente y clic en "Finalizar Registro"
    Frontend->>Backend: POST /api/matriculas/finalize/:id { student, parent, id_grado }
    Backend->>DB: Transacción: FOR UPDATE en grupos, crea estudiante, usuario, padre, vinculo parentesco, matricula -> ACTIVA
    Backend->>SMTP: Envía email con credenciales institucionales
    Frontend-->>Directivo: Muestra confirmación de oficialización exitosa
```

### Paso a Paso Detallado
1. **Verificación Previa OTP:** El acudiente ingresa a `EnrollmentView.vue`, digita su correo y solicita el código OTP de 6 dígitos. Una vez validado el código, se desbloquean los campos de selección escolar.
2. **Envío de Solicitud:** El acudiente selecciona el colegio, nivel, tipo de grado y grupo de preferencia, adjunta los archivos solicitados (máx 5MB) y envía la solicitud. El backend valida la verificación previa del correo (`isVerified`), almacena los archivos binarios en `documento_matriculas` (`BYTEA`) e inserta la matrícula en estado `PENDIENTE`.
3. **Revisión Directiva:** El directivo ingresa a `EnrollmentManagement.vue` y abre el expediente en `EnrollmentDetails.vue`. El visor carga los archivos protegidos mediante tokens efímeros firmados (`verifyDocumentToken`). El directivo valida o rechaza individualmente cada documento.
4. **Subsanación por el Acudiente:** Si hay documentos rechazados, el directivo presiona "Notificar Inconsistencias", pasando la matrícula a `CORRECCION`. El acudiente ingresa por su token a `EnrollmentCorrection.vue`, sube los archivos corregidos y el sistema los inserta con `version = max_version + 1`, pasando la matrícula al estado `CORREGIDA`.
5. **Asignación de Aula:** El directivo selecciona el salón definitivo con base en los cupos en tiempo real y presiona "Asignar Salón".
6. **Formalización Final:** En `FinalRegistration.vue`, el directivo valida la información personal del estudiante y acudiente (con autocompletado y detección de rol docente si aplica) y presiona "Finalizar Registro". El backend ejecuta la transacción atómica con bloqueo `FOR UPDATE`, crea al estudiante con código institucional, crea la cuenta del padre en `usuario_colegio`, activa la matrícula (`ACTIVA`) y despacha las credenciales por correo electrónico.

---

## Caso de Uso 2: Proceso de Reingreso de Estudiante Retirado

### Actores
- **Directivo Escolar** (Coordinador / Rector)
- **Padre de Familia / Acudiente**

### Precondiciones
- El estudiante se encuentra en estado `RETIRADO` en el sistema (alumnos `EXPULSADO` o `GRADUADO` están bloqueados).
- Existe un Año Lectivo activo habilitado con grupos y cupos creados.

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Directivo
    actor Padre as Padre de Familia / Acudiente
    participant Sistema as AcademiaNeiva API & Frontend

    Directivo->>Sistema: Ingresa a Gestión de Reingresos (ReingresoManagement.vue)
    Directivo->>Sistema: Selecciona al alumno retirado desde la lista o ticket de soporte
    Sistema-->>Directivo: Despliega ficha del alumno, acudiente y motivo histórico de retiro
    
    Directivo->>Sistema: Configura Destino (Año Lectivo, Nivel, Grado, Salón con cupos en vivo)
    Directivo->>Sistema: Define matriz documental (VIGENTE vs RENOVAR)
    Directivo->>Sistema: Presiona "Enviar Enlace de Reingreso"
    
    Sistema->>Sistema: Crea matrícula 'PENDIENTE_RENOVACION' (tipo REINGRESO)
    Sistema->>Sistema: Pasa ticket de incidencia a 'EN_PROCESO' (Irreversible)
    Sistema->>Sistema: Genera token UUID y despacha email con enlace al acudiente
    Sistema-->>Directivo: Muestra confirmación de envío exitoso
    
    Padre->>Sistema: Accede mediante el enlace del correo con token
    Padre->>Sistema: Carga únicamente los documentos marcados como 'RENOVAR'
    Sistema->>Sistema: Actualiza archivos y conserva estado 'PENDIENTE_RENOVACION'
    
    Directivo->>Sistema: Abre la solicitud en Gestión de Matrículas
    Directivo->>Sistema: Valida documentos renovados y pasa a FinalRegistration.vue
    Directivo->>Sistema: Presiona "Procesar Registro / Renovación"
    
    Sistema->>Sistema: Transición atómica: matricula -> ACTIVA, estudiante -> ACTIVO, resuelve ticket de soporte
    Sistema-->>Directivo: Confirma reingreso oficializado del estudiante
```

---

## Caso de Uso 3: Matrícula Extraordinaria por Mesa de Soporte

### Actores
- **Padre de Familia / Solicitante**
- **Directivo Escolar**

### Precondiciones
- El solicitante radica un Ticket de Soporte con tipo de incidencia `MATRICULA_EXTRAORDINARIA` solicitando cupo extemporáneo.

### Flujo Operativo Paso a Paso
1. **Autorización Directiva en Soporte:** El directivo ingresa a `SupportView.vue`, abre el ticket de matrícula extraordinaria y presiona "Autorizar Matrícula Extraordinaria".
2. **Pre-creación de Matrícula:** El directivo selecciona si es un estudiante nuevo o existente. El backend ejecuta `POST /api/academic-admin/matriculas/extraordinaria`, pre-creando la fila en `matricula` en estado `PENDIENTE` con `tipo = 'EXTRAORDINARIA'`, asociando el `id_ticket` y generando un `token_seguimiento`.
3. **Radicación sin Restricción de Fechas:** El acudiente recibe el enlace con el token (`EnrollmentView.vue?token=...`). Al detectar `isExtraordinaryToken = true`, el formulario omite la validación de fechas regulares de `configuracion_inscripcion` y permite adjuntar los documentos.
4. **Evaluación y Resolución Automática:** El directivo revisa los documentos en `EnrollmentDetails.vue` y formaliza en `FinalRegistration.vue`. Al finalizar (`finalizeEnrollment`), el backend activa la matrícula y **actualiza automáticamente el ticket de soporte asociado a estado `'RESUELTO'`**.

---

## Caso de Uso 4: Formalización con Detección de Múltiples Hijos / Doble Rol Docente

### Actores
- **Directivo Escolar**

### Precondiciones
- El acudiente que radicó la solicitud ya posee una cuenta en el sistema (bien sea porque tiene otros hijos matriculados previamente, o porque labora como docente/directivo en el colegio).

### Flujo Operativo Paso a Paso
1. **Detección de Candidatos a Renovación en Paso 1 (Estudiante):**
   - Al cargar `FinalRegistration.vue`, el backend retorna el objeto `renovacion.candidates` con todos los hijos registrados bajo el correo del acudiente.
   - El directivo visualiza un panel interactivo con la lista de hijos elegibles y la opción **"Registrar Nuevo Hermano"**.
   - **Bifurcación Obligatoria:**
     - Si el directivo selecciona a uno de los hijos (`selectedCandidate`), el sistema precarga sus datos y reutiliza su `id_estudiante`, preparándolo para renovación.
     - Si el directivo marca "Registrar Nuevo Hermano" (`isNewStudent`), el sistema limpia los campos del alumno para crear un nuevo estudiante independiente.
2. **Detección y Doble Rol en Paso 2 (Acudiente):**
   - Al ingresar o validar el documento del acudiente, `checkDocument` detecta que el usuario ya existe.
   - Si el acudiente labora como **Docente o Directivo** (`es_docente = true`):
     - El sistema despliega la alerta visual informativa: *"Atención: Este documento pertenece a personal institucional (Docente: Nombre Apellido). Se le vinculará también el rol de acudiente."*
     - Bloquea los campos de nombres para evitar alterar su identidad oficial.
3. **Ejecución Transaccional Segura:**
   - Al presionar "Finalizar Registro", `finalizeEnrollment` no crea un nuevo usuario para el padre: vincula el rol `padre` en `usuario_rol`, crea la relación institucional en `usuario_colegio` (`estado = 'ACTIVO'`), y conserva intactas sus asignaciones y permisos docentes.
   - Inserta la relación en `detalle_padrefamilia` vinculando al nuevo hijo con el padre existente.
