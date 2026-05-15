# Documentación Técnica del Sistema de Matrículas Académicas

## 1. Arquitectura General del Sistema

El proyecto implementa una arquitectura cliente-servidor completamente desacoplada (REST API), dividida en dos aplicaciones independientes:

```
segundoProyecto/
├── backend/          # API REST (Node.js + Express + TypeScript)
├── frontend/         # SPA (Vue 3 + Vite + TypeScript + Pinia)
├── guides/           # Documentación del proyecto
└── actu.sql          # Dump de la base de datos PostgreSQL
```

---

## 2. Stack Tecnológico

### Backend

| Tecnología | Propósito |
|-------------|-----------|
| **Express 5.2** | Framework HTTP para APIs REST |
| **TypeScript** | Tipado estático para mayor robustez |
| **PostgreSQL + pg** | Base de datos relacional con cliente node-pg |
| **JSON Web Token (JWT)** | Autenticación sin estado |
| **Bcrypt** | Hash de contraseñas |
| **Multer** | Manejo de upload de archivos (documentos PDF/IMG) |
| **Nodemailer** | Envío de correos electrónicos |
| **Zod** | Validación de esquemas de datos |
| **Puppeteer** | Generación de PDFs (futuro) |
| **Helmet** | Seguridad headers HTTP |
| **Cors** | Cross-Origin Resource Sharing |

### Frontend

| Tecnología | Propósito |
|-------------|-----------|
| **Vue 3** | Framework progresivo (Composition API) |
| **Vite** | Build tool y dev server |
| **TypeScript** | Tipado estático |
| **Pinia** | Gestión de estado (stores reactivos) |
| **Vue Router 5** | Enrutamiento SPA |
| **Axios** | Cliente HTTP para consumo de API |
| **Tailwind CSS** | Framework de estilos utilitarios |
| **Lucide Vue Next** | Iconos SVG |
| **Vee Validate** | Validación de formularios |
| **Chart.js + Vue-Chartjs** | Visualización de gráficos |
| **Zod** | Validación en frontend (paralelo con backend) |

---

## 3. Estructura del Backend

```
backend/
├── src/
│   ├── app.ts                  # Configuración Express principal
│   ├── server.ts               # Punto de entrada, listeners HTTP
│   ├── config/
│   │   ├── db.ts               # Pool de conexión PostgreSQL
│   │   └── multer.ts           # Configuración upload de archivos
│   ├── controllers/
│   │   └── matriculaController.ts  # Lógica de endpoints de matrícula
│   ├── services/
│   │   ├── matriculaService.ts     # Lógica de negocio principal
│   │   ├── notificationService.ts  # Envío de emails
│   │   └── gradoService.ts         # Consulta de grados disponibles
│   ├── routes/
│   │   ├── matricula.routes.ts     # Endpoints de matrícula
│   │   └── grado.routes.ts        # Endpoints de grados
│   ├── seed.ts                   # Datos iniciales
│   └── *.ts                      # Scripts de migración
├── uploads/                      # Archivos subidos por usuarios
├── package.json
└── tsconfig.json
```

### Puertos y Variables de Entorno

- **Backend**: `http://localhost:3000`
- **Frontend**: `http://localhost:5173`
- Variables esperadas en `.env`:
  ```
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  ```

---

## 4. Estructura del Frontend

```
frontend/
├── src/
│   ├── main.ts                  # bootstrap Vue + Pinia + Router
│   ├── App.vue                  # Root component
│   ├── router/
│   │   └── index.ts             # Definición de rutas
│   ├── stores/
│   │   ├── auth.ts              # Estado auth (token, user)
│   │   ├── notifications.ts    # Sistema de toasts
│   │   └── index.ts             # Export centralizado
│   ├── views/
│   │   ├── LandingView.vue      # Landing page pública
│   │   ├── LoginView.vue        # Autenticación
│   │   ├── EnrollmentView.vue   # Formulario de matrícula (público)
│   │   ├── EnrollmentCorrection.vue  # Corrección de docs por padre
│   │   ├── DashboardLayout.vue  # Layout autenticado (sidebar + header)
│   │   ├── DashboardHome.vue    # Home del dashboard
│   │   ├── EnrollmentManagement.vue   # Lista de matrículas
│   │   ├── EnrollmentDetails.vue     # Detalle de una matrícula
│   │   └── FinalRegistration.vue     # Registro final (datos estudiante)
│   ├── components/
│   │   └── NotificationToast.vue    # Componente toast
│   ├── layouts/
│   │   └── DashboardLayout.vue
│   ├── assets/
│   └── styles/
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

### Rutas del Frontend

| Ruta | Componente | Acceso |
|------|------------|--------|
| `/` | LandingView | Público |
| `/login` | LoginView | Público |
| `/matricula` | EnrollmentView | Público |
| `/matricula/corregir/:token` | EnrollmentCorrection | Público (token) |
| `/dashboard` | DashboardLayout | Requiere auth |
| `/dashboard/gestion-matriculas` | EnrollmentManagement | Requiere auth |
| `/dashboard/gestion-matriculas/:id` | EnrollmentDetails | Requiere auth |
| `/dashboard/gestion-matriculas/:id/registro` | FinalRegistration | Requiere auth |

---

## 5. Modelo de Base de Datos

El dump completo está en `actu.sql`. A continuación se documentan las entidades más importantes del sistema de matrículas:

### Tablas Principales

#### usuario
```sql
- id_usuario (PK)
- correo (UNIQUE)
- password (hash bcrypt)
- estado (activo/inactivo)
- fecha_creacion
- id_colegio (FK)
```
**Propósito**: Autenticación centralizada. Un usuario puede tener múltiples roles.

#### rol
```sql
- id_rol (PK)
- nombre (ADMIN, DIRECTIVO, DOCENTE, PADRE_FAMILIA, ESTUDIANTE)
```
**Propósito**: Roles del sistema.

#### usuario_rol
```sql
- id_usuario_rol (PK)
- id_usuario (FK)
- id_rol (FK)
```
**Propósito**: Relación muchos a muchos usuario-rol (un usuario puede ser docente Y padre).

#### colegio
```sql
- id_colegio (PK)
- nombre
- tipo_colegio
- sede
- contacto
- correo
- dane (código DANE)
```
**Propósito**: Soporte multi-tenant (múltiples instituciones).

#### grados
```sql
- id_grado (PK)
- nivel (PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA)
- id_jornada (FK)
- id_colegio (FK)
- cupos_totales
- tipo_grado (enum: PREJARDIN...ONCE)
- seccion (A, B, C...)
```
**Propósito**: Definición de cursos con cupos.

#### jornada
```sql
- id_jornada (PK)
- nombre (enum: MAÑANA, TARDE, NOCTURNA, UNICA)
- id_colegio (FK)
```

#### matricula
```sql
- id_matricula (PK)
- id_estudiante (FK, nullable)
- id_nivel (FK, nullable)
- id_grado (FK)
- id_colegio (FK)
- id_año (FK)
- estado (enum: PENDIENTE, ACTIVA, CANCELADA, TRASLADADA, RECHAZADA)
- correo_padre
- tiene_discapacidad (boolean)
- es_extranjero (boolean)
- token_seguimiento (UUID, UNIQUE)
```
**Propósito**: Solicitud de matrícula. Primero se crea sin estudiante (id_estudiante = NULL), luego se completa.

#### documento_matriculas
```sql
- id_documento (PK)
- id_matricula (FK)
- tipo_documento (registroCivil, documentoIdentidad, documentoPadre, ...)
- url (path archivo)
- estado (enum: PENDIENTE, VALIDADO, RECHAZADO)
- fecha
- id_colegio (FK)
```
**Propósito**: Documentos soporte de la matrícula.

#### estudiante
```sql
- id_estudiante (PK)
- nombre
- apellido
- documento
- codigo
- id_tipodocumento (FK)
- id_grado (FK)
- id_nivel (FK)
- id_colegio (FK)
- id_usuario (FK, UNIQUE)
```

#### padre_familia
```sql
- id_padrefamilia (PK)
- nombre
- apellido
- documeno (documento)
- id_tipodocumento (FK)
- id_colegio (FK)
- id_usuario (FK, UNIQUE)
```

#### detalle_padrefamilia
```sql
- id_detallepadrefamilia (PK)
- id_padrefamilia (FK)
- id_estudiante (FK)
- id_colegio (FK)
```
**Propósito**: Vínculo padre-estudiante (un padre puede tener varios hijos).

#### docente
```sql
- id_docente (PK)
- nombre, apellido, documento
- id_tipodocumento (FK)
- id_contratodocente (FK)
- id_colegio (FK)
- id_usuario (FK, UNIQUE)
```

#### materias, detalle_grados, actividad_materia, notas_actividad
Estructura para gestión académica (calificaciones, actividades, periodos).

#### periodo_academico, año_lectivo
Definición temporal del año escolar.

#### Views para Reportes
- `vw_asistencia_estudiante`: Conteo de presentes/ausentes
- `vw_notas_enriquecidas`: Notas con contexto de materia/docente
- `vw_promedio_estudiante_periodo`: Promedio por periodo
- `vw_promedio_normalizado`: Normalización a escala 1-5
- `vw_desempeno_estudiante`: Nivel de desempeño (SUPERIOR, ALTO, BÁSICO, BAJO)

---

## 6. Endpoints de la API

### Matrículas (`/api/matriculas`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Listar todos los colegios |
| POST | `/submit` | Enviar solicitud de matrícula (con archivos) |
| GET | `/pending/:idColegio` | Listar matrículas pendientes |
| GET | `/filtered/:idColegio?estado=` | Listar filtrado por estado |
| GET | `/:id` | Obtener detalle (por ID o token) |
| PATCH | `/document/:idDocumento` | Validar/rechazar documento |
| POST | `/assign-grade/:id` | Asignar grado a matrícula |
| POST | `/notify-inconsistencies/:id` | Notificar padre sobre docs rechazados |
| POST | `/update-documents/:token` | Padre corrige documentos |
| POST | `/finalize/:id` | Finalizar registro (crear estudiante + padre) |

### Grados (`/api/grados`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/available/:idColegio` | Listar grados con cupos disponibles |

---

## 7. Flujos del Sistema de Matrículas

### Flujo Principal (MR01 - MR04)

```
+----------+     +-------------+     +-------------+     +-------------+
|  Padre   |     |   Sistema   |     |  Directivo  |     |   Sistema   |
+----------+     +-------------+     +-------------+     +-------------+
     |               |                   |                   |
     | 1. Submit     |                   |                   |
     |-------->>>>>>>|                   |                   |
     |               |                   |                   |
     |               | 2. Revisión docs  |                   |
     |               |<------------------|                   |
     |               |                   |                   |
     | 3. Notificar  |                   |                   |
     |<-------------|                   |                   |
     | (si hay error)|                   |                   |
     |               |                   |                   |
     | 4. Corregir   |                   |                   |
     |-------->>>>>>>|                   |                   |
     |               |                   |                   |
     |               | 5. Aprobar docs   |                   |
     |               |<------------------|                   |
     |               |                   |                   |
     | 6. Solicitar datos|              |                   |
     |<-------------|                   |                   |
     |               |                   |                   |
     | 7. Registrar  |                   |                   |
     |    estudiante |                   |                   |
     |-------->>>>>>>|                   |                   |
     |               |                   |                   |
     | 8. Matrícula  |                   |                   |
     |    ACTIVA     |<------------------|                   |
     |               |                   |                   |
     | 9. Confirmar  |                   |                   |
     |<-------------|                   |                   |
```

### Reglas de Documentos por Nivel

| Documento | Preescolar | Primaria | Secundaria/Media |
|-----------|-------------|----------|------------------|
| Registro Civil | ✅ | ✅ | ❌ |
| Vacunas (PAI) | ✅ | ✅ | ❌ |
| Doc. Identidad Est. | ❌ | ✅ | ✅ |
| Certificados Escolaridad | ✅ | ✅ | ❌ |
| Doc. Identidad Acudiente | ✅ | ✅ | ✅ |
| Certificado Salud (SGSSS) | ✅ | ✅ | ✅ |
| Foto 3x4 | ✅ | ✅ | ✅ |
| Recibo Servicio Público | ✅ | ✅ | ✅ |
| Visa/PPT | Si es extranjero | Si es extranjero | Si es extranjero |
| Certificado Discapacidad | Si tiene | Si tiene | Si tiene |

---

## 8. Servicios del Backend

### MatriculaService

Contiene la lógica de negocio principal:

- `createEnrollment(data, files)`: Crea solicitud con documentos
- `getAllPending(idColegio)`: Lista pendiente
- `getDetails(idMatricula)`: Detalle con documentos y secciones disponibles
- `updateDocumentStatus(idDoc, estado)`: Valida o rechaza documento
- `assignGrade(idMat, idGrado)`: Asigna grado
- `notifyInconsistencies(idMat)`: Envía email al padre con docs rechazados
- `getByToken(token)`: Consulta pública por token
- `updateDocumentsByToken(token, files)`: Padre corrige
- `finalizeEnrollment(idMat, data)`: Crea estudiante + padre, cambia estado a ACTIVA

### NotificationService

- `sendApprovalEmail(to, parentName, studentName)`: Email de aprobación con credenciales
- `sendRejectionEmail(to, parentName, reason, token)`: Email de rechazo con link de corrección

### GradoService

- `getAvailable(idColegio)`: Lista grados con cupos restantes

---

## 9. Estado del Frontend (Pinia)

### Auth Store
```typescript
- user: User | null
- token: string | null
- isAuthenticated: computed<boolean>
- setUser(user, token)
- logout()
```

### Notification Store
```typescript
- notifications: Array<{id, message, type}>
- addNotification(message, type: 'success' | 'error' | 'warning')
- removeNotification(id)
```

---

## 10. Características Implementadas vs Pendientes

### ✅ Implementado

- Formulario público de matrícula con upload de documentos
- Validación dinámica de documentos según nivel
- Backend Express con TypeScript
- Base de datos PostgreSQL completa (tablas, enum types, FK, views)
- API REST para gestión de matrículas
- Dashboard autenticado con router
- Lista de matrículas pendientes
- Detalle de matrícula con validación de documentos
- Notificaciones por email (Nodemailer)
- Corrección de documentos por padre (via token)
- Finalización de registro (creación de estudiante + padre)
- Sistema de cupos por grado/jornada

### ⏳ Pendiente / En Construcción

- Login real con JWT (UI presente, backend no implementado completamente)
- Gestión de calificaciones (notas, actividades, periodos)
- Registro de asistencia
- Generación de boletines PDF
- Portal de notas para padre/estudiante
- Reportes estadísticos
- Gráficos de rendimiento (Dashboard placeholders)

---

## 11. Scripts de Base de Datos

El proyecto incluye varios scripts de migración/utilidad en `backend/src/`:
- `seed.ts`: Población inicial de datos
- `debug_db.ts`: Herramientas de debug
- `migrate_original.ts`, `update_solicitud.ts`, etc.: Migraciones

---

## 12. Ejecución del Proyecto

### Backend
```bash
cd backend
npm install
npm run dev    # Inicia en localhost:3000
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # Inicia en localhost:5173
```

### Base de Datos
Requiere PostgreSQL 18+. Ejecutar `actu.sql` para crear el schema completo.

---

## 13. Consideraciones de Seguridad

- Contraseñas hasheadas con bcrypt (10 rounds)
- Tokens JWT para sesión
- Helmet para headers de seguridad
- CORS configurado
- Archivos subidos a carpeta `/uploads` servida estáticamente
- Validación de documentos obligatorios según nivel
- Aislamiento por `id_colegio` en todas las consultas

---

## 14. Extensiones Futuras Identificadas

- [ ] Login y autenticación JWT completa
- [ ] Módulo de calificaciones y actividades
- [ ] Registro de asistencia diaria
- [ ] Generación de boletines PDF con Puppeteer
- [ ] Portal padre/estudiante (consulta notas, reportes)
- [ ] Dashboard con gráficos Chart.js
- [ ] Módulo de docentes y asignación a materias
- [ ] Periodos académicos y cierre de notas
- [ ] Certificados académicos

---

*Documento generado automáticamente. Última actualización: Mayo 2026*