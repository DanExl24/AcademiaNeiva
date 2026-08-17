# 📙 AcademiaNeiva — Documento Técnico de Arquitectura e Ingeniería

---

## Portada

**Sistema de Gestión Académica Institucional Multitenant — AcademiaNeiva**  
**Manual de Arquitectura de Software, Patrones de Diseño e Ingeniería (Volumen 2: Técnico)**  
**Versión:** 2.5.0  
**Fecha:** 16 de Agosto de 2026  
**Autor:** Arquitecto de Software Senior & Lead Technical Writer  
**Estado:** Aprobado — Documento Maestro Técnico  

---

## Historial de Versiones

| Versión | Fecha | Autor | Cambios y Descripciones |
|---|---|---|---|
| 1.0.0 | 2026-01-15 | Equipo de Desarrollo | Diseño inicial de la API Express, modelos relacionales y tokens JWT. |
| 1.5.0 | 2026-04-10 | Equipo de Desarrollo | Implementación de Triggers de inmutabilidad PL/pgSQL y captura de deltas JSONB en auditorías. |
| 2.0.0 | 2026-07-21 | Arquitecto Senior | Redacción del Manual de Ingeniería con 9 ADRs completos, guía de onboarding para nuevos desarrolladores y especificaciones de despliegue. |
| 2.5.0 | 2026-08-16 | Senior Software Architect & Lead Engineer | Actualización técnica integral: incorporación de Kysely Query Builder con tipado estático TypeScript (`db.types.ts`), capa de validación de esquemas Zod (ADR-010 y ADR-011), arquitectura de 21 módulos, flujo de verificación OTP transaccional y patrón de seguimiento directivo espejo en Pinia. |

---

## Tabla de Contenido

- [1. Introducción Técnica](#1-introducción-técnica)
- [2. Arquitectura de Software](#2-arquitectura-de-software)
- [3. Registro de Decisiones Arquitectónicas (ADRs)](#3-registro-de-decisiones-arquitectónicas-adrs)
- [4. Modelo de Datos Relacional y Triggers SQL](#4-modelo-de-datos-relacional-y-triggers-sql)
- [5. Esquema de Seguridad, JWT y Blacklist](#5-esquema-de-seguridad-jwt-y-blacklist)
- [6. Integración entre Módulos y Servicios](#6-integración-entre-módulos-y-servicios)
- [7. Convenciones, Nomenclatura y UUIDs](#7-convenciones-nomenclatura-y-uuids)
- [8. Stack Tecnológico y Justificaciones](#8-stack-tecnológico-y-justificaciones)
- [9. Guía de Instalación y Configuración Local](#9-guía-de-instalación-y-configuración-local)
- [10. Especificaciones para Despliegue en Producción](#10-especificaciones-para-despliegue-en-producción)
- [11. Guía de Onboarding para Nuevos Desarrolladores](#11-guía-de-onboarding-para-nuevos-desarrolladores)
- [12. Glosario Técnico y Referencias](#12-glosario-técnico-y-referencias)

---

## 1. Introducción Técnica

### Propósito
Este manual es la **referencia técnica definitiva para ingenieros de software, arquitectos y desarrolladores** que ingresen al proyecto **AcademiaNeiva**. Su meta es explicar la arquitectura del sistema, los patrones de código elegidos, los mecanismos de persistencia en PostgreSQL y los **11 Registros de Decisiones Arquitectónicas (ADRs)** para transmitir no solo *cómo funciona* la plataforma, sino *por qué fue diseñada de esta manera*.

### Perfil del Desarrollador Objetivo
Desarrollador Fullstack o Backend/Frontend con conocimientos en TypeScript, Vue 3 (Composition API), Node.js, Express, Kysely y PostgreSQL relacional. Este documento elimina la necesidad de consultar al autor original del código.

---

## 2. Arquitectura de Software

El sistema utiliza una **Arquitectura en Capas Desacoplada** (Client-Server REST API) orientada al aislamiento Multi-Tenant por columna discriminadora `id_colegio`.

### Diagrama General de Capas Técnicas

```mermaid
graph TD
    subgraph ClientLayer ["1. Capa de Presentación (Frontend Vue 3 SPA)"]
        Views["Vistas (.vue)"]
        Pinia["Stores de Estado (auth, academicYear)"]
        Router["Vue Router (Route Guards & Role Check)"]
        MonitoreoUI["Modo Seguimiento Pedagógico (Espejo)"]
    end

    subgraph SecurityLayer ["2. Capa de Control & Seguridad (Express Middleware)"]
        Limiter["Express Rate Limiter"]
        AuthMid["authMiddleware.ts (JWT, jti & Status Verification)"]
        AuditMid["Middleware Interceptor (Auditoría JSONB)"]
    end

    subgraph ValidationLayer ["3. Capa de Validación de Esquemas (Zod DTOs)"]
        ZodSchemas["Zod Schemas (Validación de Payloads & Tipos)"]
    end

    subgraph ApplicationLayer ["4. Capa de Lógica de Negocio (Backend Express API)"]
        Controllers["21 Módulos de Controladores Express (.ts)"]
        Services["Servicios (Scheduler, OTP, SMTP, PDF Generator)"]
    end

    subgraph DataAccessLayer ["5. Capa de Acceso a Datos (Kysely Query Builder)"]
        Kysely["Kysely Query Builder (db.types.ts)"]
        Pool["PostgreSQL Connection Pool"]
    end

    subgraph DatabaseLayer ["6. Capa de Persistencia e Inmutabilidad (PostgreSQL)"]
        Tables[(Base de Datos Relacional)]
        Triggers["Triggers SQL (fn_bloquear_periodo_cerrado & proteger_auditoria)"]
        Blacklist["Tabla token_blacklist (jti)"]
        OTPStore["Tabla codigo_verificacion_email"]
    end

    Views --> Router
    Router --> Pinia
    Pinia --> MonitoreoUI
    Router -->|Peticiones HTTP REST| Limiter
    Limiter --> AuthMid
    AuthMid --> AuditMid
    AuditMid --> ZodSchemas
    ZodSchemas --> Controllers
    Controllers --> Services
    Controllers --> Kysely
    Kysely --> Pool
    Pool --> Tables
    Tables --> Triggers
    AuthMid --> Blacklist
    Services --> OTPStore
```

---

## 3. Registro de Decisiones Arquitectónicas (ADRs)

---

### ADR-001: Selección de Vue 3 (Composition API) + Pinia para el Frontend
- **Problema:** Se requería una interfaz altamente interactiva, reactiva y modular capaz de gestionar planillas de notas masivas con renderizado instantáneo de promedios.
- **Alternativas Consideradas:** 
  1. *React.js*: Requería mayor boilerplate y librerías externas de gestión de estado.
  2. *Blade / SSR Monolítico*: Degradaba la experiencia del usuario al recargar la página completa en cada cambio de celda de nota.
- **Decisión Tomada:** Adoptar **Vue 3 con Composition API + TypeScript** y **Pinia** para la gestión de estado centralizada (`auth`, `academicYear`).
- **Ventajas:** Excelente reactividad con `ref()` y `computed()`, tipado estático estricto y menor huella de memoria en cliente.
- **Consecuencias:** Se debe asegurar que las operaciones pesadas de cálculo de promedios se mantengan sincronizadas entre la vista de Vue y el backend.

---

### ADR-002: Selección de Node.js + Express.js Desacoplado para la API REST
- **Problema:** Necesidad de una API RESTful ligera, de alta concurrencia y capaz de procesar operaciones E/S no bloqueantes (envío de emails, generación de PDFs en background y webhooks).
- **Alternativas Consideradas:** 
  1. *Spring Boot (Java)*: Mayor tiempo de inicio y consumo de memoria RAM elevado en servidores de despliegue.
  2. *Laravel (PHP)*: Acoplamiento monolítico por defecto; requería configuraciones adicionales para operar como API REST desvinculada.
- **Decisión Tomada:** Construir una **API REST desacoplada en Node.js con Express.js y TypeScript**.
- **Ventajas:** Mismo lenguaje (TypeScript) en frontend y backend, arquitectura E/S asíncrona ideal para notificaciones y escalabilidad horizontal simple.
- **Consecuencias:** Se requiere implementar un manejo de errores asíncrono estricto (`try/catch` y middleware global) para evitar cierres del proceso Node.

---

### ADR-003: Selección de PostgreSQL con Triggers PL/pgSQL
- **Problema:** Necesidad de garantizar la inmutabilidad legal de las notas y las bitácoras de auditoría, impidiendo que sentencias SQL accidentales o maliciosas eliminen o modifiquen registros cerrados.
- **Alternativas Consideradas:** 
  1. *MySQL / MariaDB*: Soporte de triggers y funciones almacenadas con sintaxis menos potente que PL/pgSQL.
  2. *MongoDB*: Ausencia de restricciones de integridad referencial nativas y soporte de transacciones complejas más costoso.
- **Decisión Tomada:** Adoptar **PostgreSQL** como motor de base de datos primario utilizando funciones PL/pgSQL y columnas JSONB.
- **Ventajas:** Permite ejecutar triggers de inmutabilidad (`fn_bloquear_periodo_cerrado`, `proteger_acciones_auditoria`) directamente en la capa de persistencia. Si el backend falla, la base de datos aborta la sentencia.
- **Consecuencias:** Se debe mantener la sincronización entre las migraciones SQL y los modelos TypeScript del backend.

---

### ADR-004: Diseño Multi-Tenant con Discriminador `id_colegio`
- **Problema:** Permitir que múltiples instituciones educativas utilicen el sistema manteniendo un aislamiento total de sus datos sin disparar los costos de infraestructura.
- **Alternativas Consideradas:** 
  1. *Database-per-tenant*: Una base de datos independiente por colegio. Muy costoso en mantenimiento de migraciones y servidores.
  2. *Schema-per-tenant*: Un esquema PostgreSQL por colegio. Complejo para consultas de analítica global del Admin General.
- **Decisión Tomada:** Utilizar un **Esquema Único Compartido con columna discriminadora `id_colegio`** en todas las tablas institucionales.
- **Ventajas:** Mantenimiento centralizado de migraciones, costos de hosting mínimos y analítica global inmediata para el Administrador General.
- **Consecuencias:** El middleware de autenticación (`verifyToken`) debe inyectar y validar obligatoriamente el `schoolId` en el 100% de las consultas SQL para prevenir fuga de información entre inquilinos.

---

### ADR-005: Almacenamiento JSONB de Deltas (`valor_antiguo`, `valor_nuevo`)
- **Problema:** Registrar auditorías detalladas de los cambios realizados por el Administrador General durante una supervisión sin crear tablas de auditoría dedicadas para cada una de las 48 tablas del sistema.
- **Alternativas Consideradas:** 
  1. *Tablas de histórico clonadas*: Duplica el número de tablas en la base de datos y requiere mantenimiento de triggers por tabla.
  2. *Archivos de log de texto plano (`.log`)*: Difíciles de consultar, filtrar o exportar desde la interfaz de usuario.
- **Decisión Tomada:** Utilizar una **columna tipo `JSONB` (`valor_antiguo`, `valor_nuevo`)** en la tabla `auditoria_acciones_realizadas`.
- **Ventajas:** Estructura flexible capaz de almacenar cualquier registro modificado manteniendo la capacidad de indexación y consulta JSON de PostgreSQL.
- **Consecuencias:** El middleware de auditoría debe capturar el estado del objeto antes de ejecutar la actualización.

---

### ADR-006: Sincronización en Caliente mediante `sync_uuid` para Cursos Paralelos
- **Problema:** Evitar que los directivos o profesores tengan que transcribir la misma competencia varias veces para cursos del mismo nivel (ej. Primero A, B y C).
- **Alternativas Consideradas:** 
  1. *Vinculación por `id_grado` únicamente*: Impedía que un profesor pudiera personalizar levemente la descripción para un grupo en particular.
  2. *Duplicación manual sin enlace*: Provocaba desajustes si se corregía una falta de ortografía en el enunciado.
- **Decisión Tomada:** Crear competencias independientes por grupo pero asignándoles el mismo **`sync_uuid` (UUIDv4)**.
- **Ventajas:** Al editar una competencia, el backend actualiza en bloque todos los registros con el mismo `sync_uuid`, manteniendo la capacidad de personalización si se desvincula.
- **Consecuencias:** Las operaciones de actualización deben ejecutarse dentro de una transacción atómica SQL.

---

### ADR-007: Codificación Base36 para Ofuscación de Tickets Públicos
- **Problema:** Permitir a visitantes anónimos consultar el estado de sus tickets de soporte sin exponer IDs correlativos numéricos de base de datos que faciliten ataques de enumeración.
- **Alternativas Consideradas:** 
  1. *IDs Autoincrementales simples (`/tickets/12`)*: Vulnerable a scraping.
  2. *UUID v4 estándar*: Muy largo y difícil de digitar por un usuario en un formulario impreso o de soporte.
- **Decisión Tomada:** Generar un **código Base36 corto prefijado por `TKT-`** (ej. `TKT-1B3X9H7Z`) calculado a partir de un entero derivado del año, colegio, documento y ticket.
- **Ventajas:** Código legible, amigable para el usuario y resistente a ataques de enumeración.
- **Consecuencias:** Se requiere una función de codificación/decodificación determinista en el controlador de soporte.

---

### ADR-008: Doble Capa de Inmutabilidad (Middleware Express + Trigger SQL)
- **Problema:** Asegurar que los periodos cerrados no reciban modificaciones ni por peticiones HTTP ni por scripts de consola o acceso directo a base de datos.
- **Alternativas Consideradas:** 
  1. *Validación únicamente en Controllers Node*: Vulnerable si un desarrollador olvida incluir el helper de validación en una nueva ruta API.
  2. *Validación únicamente en SQL*: Lanza excepciones crudas que retornarían errores 500 no semánticos al cliente HTTP.
- **Decisión Tomada:** Implementar una **Doble Capa de Protección**:
  - Layer 1 (Express): Helper `ensureCurrentPeriodOrRespond` que retorna respuestas HTTP `409 Conflict` con mensajes descriptivos.
  - Layer 2 (PostgreSQL): Trigger `fn_bloquear_periodo_cerrado` que lanza `RAISE EXCEPTION` en SQL.
- **Ventajas:** Errores limpios y semánticos para la UI y protección infranqueable a nivel de base de datos.
- **Consecuencias:** En scripts de migración o seeds de prueba se debe enviar `SET my.app.bypass_triggers = 'true'`.

---

### ADR-009: Cierre por Materia Desacoplado con Reapertura Individual
- **Problema:** Permitir a un Rector autorizar la corrección de una nota a un solo profesor sin necesidad de reabrir el periodo lectivo completo de todo el colegio.
- **Alternativas Consideradas:** 
  1. *Cierre global únicamente*: Obligaba a reabrir el periodo a 50 profesores cuando solo uno cometía un error en una nota.
- **Decisión Tomada:** Implementar una tabla de cierre por asignatura (`cierre_materia`).
- **Ventajas:** El Rector puede eliminar el registro en `cierre_materia` para una asignatura específica (`reopenSubjectClosure`), habilitando de nuevo la planilla del docente sin desproteger al resto del plantel.
- **Consecuencias:** El cierre institucional requiere verificar que el 100% de las filas en `cierre_materia` estén cerradas.

---

### ADR-010: Adopción de Kysely como Query Builder SQL Fuertemente Tipado
- **Problema:** Las consultas SQL manuales con strings crudos (`pool.query(...)`) carecían de comprobación de tipos en tiempo de compilación, lo que facilitaba errores silenciosos por nombres de columnas desactualizadas, tipos incompatibles o fallos en relaciones.
- **Alternativas Consideradas:** 
  1. *Prisma / TypeORM*: ORMs pesados con sobrecarga en tiempo de ejecución y limitaciones para subconsultas complejas de analítica.
  2. *Strings SQL crudos con `pg`*: Vulnerables a erratas y sin autocompletado en el IDE.
- **Decisión Tomada:** Adoptar **Kysely** como constructor de consultas SQL tipadas contra PostgreSQL, respaldado por la definición de esquemas en `backend/src/types/db.types.ts`.
- **Ventajas:** Validación total en compilación (`tsc`), autocompletado inteligente de tablas y columnas, prevención de inyecciones SQL y cero sobrecarga de rendimiento en runtime.
- **Consecuencias:** Todas las nuevas tablas y columnas de base de datos deben reflejarse en `db.types.ts`.

---

### ADR-011: Validación y Sanitización de DTOs con Zod
- **Problema:** Se requería un mecanismo declarativo, estricto y unificado para validar los datos que ingresan a los controladores (`req.body`, `req.query`, `req.params`) antes de ejecutar lógica de negocio o interactuar con la base de datos.
- **Alternativas Consideradas:** 
  1. *Joi / express-validator*: Requieren sintaxis verbosa y no ofrecen inferencia estricta y nativa de tipos TypeScript.
  2. *Validación manual con bloques `if`*: Propensa a olvidos y genera código repetitivo.
- **Decisión Tomada:** Estandarizar la validación de DTOs utilizando **Zod** (`z.object({...})`) en la capa de entrada de la API.
- **Ventajas:** Tipos inferidos automáticamente (`z.infer<typeof Schema>`), validación de patrones (teléfonos 7-20 dígitos, emails, enums), mensajes de error semánticos y protección contra payloads maliciosos.
- **Consecuencias:** Los controladores deben validar la carga útil con `.safeParse()` o middlewares dedicados antes de continuar.

---

## 4. Modelo de Datos Relacional y Triggers SQL

### Triggers SQL Relevantes en PostgreSQL

#### Trigger 1: Bloqueo de Periodos Cerrados (`fn_bloquear_periodo_cerrado`)
```sql
CREATE OR REPLACE FUNCTION public.fn_bloquear_periodo_cerrado() 
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_id_periodo INTEGER;
    v_estado VARCHAR(20);
BEGIN
    -- Permitir bypass para scripts de seed de pruebas
    IF current_setting('my.app.bypass_triggers', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Determinar id_periodo según la tabla evaluada
    IF TG_TABLE_NAME = 'notas_actividad' THEN
        SELECT id_periodo INTO v_id_periodo FROM actividad_materia 
        WHERE id_actividadmateria = COALESCE(NEW.id_actividadmateria, OLD.id_actividadmateria);
    ELSIF TG_TABLE_NAME = 'observacion_estudiante' THEN
        v_id_periodo := COALESCE(NEW.id_periodo, OLD.id_periodo);
    END IF;

    -- Validar estado del periodo
    IF v_id_periodo IS NOT NULL THEN
        SELECT estado INTO v_estado FROM periodo_academico WHERE id_periodo = v_id_periodo;
        IF v_estado = 'CERRADO' THEN
            RAISE EXCEPTION 'Operación denegada: El periodo académico está cerrado.';
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
```

#### Trigger 2: Inmutabilidad de Acciones de Auditoría (`proteger_acciones_auditoria`)
```sql
CREATE OR REPLACE FUNCTION public.proteger_acciones_auditoria()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('my.app.bypass_triggers', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Operación ilegal: Los registros de bitácora de auditoría son legalmente inmutables.';
END;
$$;
```

---

## 5. Esquema de Seguridad, JWT y Blacklist

### Flujo de Verificación de Middleware (`verifyToken`)

```mermaid
sequenceDiagram
    autonumber
    participant Cliente as Frontend Client
    participant Middleware as authMiddleware.ts
    participant Blacklist as DB token_blacklist
    participant UserDB as DB usuario
    participant Zod as Zod DTO Validation
    participant Controller as Controller Express (Kysely)

    Cliente->>Middleware: Petición HTTP + Header Authorization: Bearer <JWT>
    Middleware->>Middleware: Verifica firma de JWT con JWT_SECRET
    
    Alt Token Inválido o Expirado
        Middleware-->>Cliente: Responde 401 Unauthorized (Token Expirado)
    End

    Middleware->>Blacklist: Consulta jti en tabla token_blacklist
    Alt Token en Blacklist
        Middleware-->>Cliente: Responde 401 Unauthorized (Sesión Revocada)
    End

    Middleware->>UserDB: Consulta estado y logged_out_at del usuario
    Alt iat < logged_out_at O estado != 'ACTIVO'
        Middleware-->>Cliente: Responde 401 Unauthorized (Cuenta Inactiva/Cierre Forzado)
    End

    Middleware->>Zod: Pasa control y valida req.body contra esquema Zod
    Alt Fallo en Validación Zod
        Zod-->>Cliente: Responde 400 Bad Request (Detalle de Errores de Validación)
    End

    Zod->>Controller: Inyecta datos validados y ejecuta controlador mediante Kysely
```

---

## 6. Integración entre Módulos y Servicios

### Matriz de Dependencias entre Servicios (21 Módulos)

```
[01: Autenticación & Blacklist] ◄──── [15: Supervisión & Auditoría] ◄──── [20: Seguimiento Directivo]
          ▲                                      │                                  │
          │                                      ▼                                  ▼
[21: Flujo Correos & OTP] ──────────► [06: Matrículas] ────────────────► [18: Traslados]
          │                                      │                                  │
          ▼                                      ▼                                  ▼
[02: Colegios] ─────────────────────► [07: Estudiantes] ───────────────► [17: Padres de Familia]
          │                                      │                                  │
          ▼                                      ▼                                  ▼
[04: Estructura Escolar] ───────────► [05: Docentes] ──────────────────► [13: Asistencia]
          │                                      │                                  │
          ▼                                      ▼                                  ▼
[10: Catálogo DBA] ─────────────────► [09: Competencias] ──────────────► [11: Calificaciones]
          │                                                                         │
          ▼                                                                         ▼
[08: Configuración Académica] ─────────────────────────────────────────► [12: Observaciones]
          │                                                                         │
          ▼                                                                         ▼
[19: Seguimiento & Promoción] ◄──────────────────────────────────────── [14: Cierre & Boletines PDF]
                                                                                    │
                                                                                    ▼
                                                                         [16: Soporte & Tickets]
```

---

## 7. Convenciones, Nomenclatura y UUIDs

1. **Uso de UUIDv4**:
   - `sync_uuid`: Agrupación de competencias en cursos paralelos.
   - `token_seguimiento`: Acceso seguro a inscripciones y traslados públicos sin credenciales.
2. **Nomenclatura de Archivos en Frontend**:
   - Vistas: PascalCase (ej. `TeacherGrades.vue`, `SupervisionManagement.vue`).
   - Stores: camelCase (ej. `auth.ts`, `academicYear.ts`).
3. **Nomenclatura en Backend**:
   - Controladores: camelCase terminados en Controller (ej. `authController.ts`, `gradingController.ts`).
   - Esquemas DTO: camelCase terminados en Schema (ej. `teacherSchema.ts`, `matriculaSchema.ts`).
   - Rutas: minúsculas separadas por puntos (ej. `auth.routes.ts`, `academicAdmin.routes.ts`).
4. **Patrón de Query Builder (Kysely)**:
   - Utilizar siempre `db.selectFrom(...)`, `db.insertInto(...)`, `db.updateTable(...)` evitando sentencias SQL sin tipar.

---

## 8. Stack Tecnológico y Justificaciones

- **Vue 3 + TypeScript (Vite)**: Reactividad nativa con Composition API y verificación de tipos en tiempo de compilación.
- **Pinia**: Gestión de estado centralizada para autenticación, roles, año lectivo seleccionado y modo seguimiento.
- **Express.js**: Framework minimalista sin sobrecarga para construir APIs REST orientadas a micro-respuestas JSON.
- **Kysely**: Query Builder SQL fuertemente tipado que enlaza directamente con los tipos de PostgreSQL (`db.types.ts`).
- **Zod**: Validación declarativa y sanitización estricta de esquemas en todas las peticiones mutativas.
- **PostgreSQL 14+**: Motor de base de datos relacional robusto con soporte JSONB nativo y triggers en PL/pgSQL.
- **Nodemailer**: Motor de mensajería SMTP para correos transaccionales y códigos OTP de 6 dígitos.
- **HTML2PDF / PDFKit**: Generación de boletines oficiales PDF con fidelidad tipográfica.

---

## 9. Guía de Instalación y Configuración Local

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/DanExl24/AcademiaNeiva.git
cd segundoProyecto

# Instalar backend
cd backend
npm install

# Instalar frontend
cd ../frontend
npm install
```

### 2. Configurar Base de Datos PostgreSQL
```bash
# Crear base de datos local
createdb -U postgres academianeiva

# Importar el esquema e inyectar triggers
psql -U postgres -d academianeiva -f guides/AcademiaNeivaBD.sql
```

### 3. Iniciar Servidores de Desarrollo
```bash
# Backend (en carpeta /backend)
npm run dev

# Frontend (en carpeta /frontend)
npm run dev
```

---

## 10. Especificaciones para Despliegue en Producción

### Archivo de Variables de Entorno (`.env`)
```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://usuario:password_seguro@localhost:5432/academianeiva
JWT_SECRET=super_secret_key_firma_tokens_academianeiva_2026
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@academianeiva.edu.co
SMTP_PASS=app_password_segura
```

---

## 11. Guía de Onboarding para Nuevos Desarrolladores

### Pasos Recomendados para Entender el Código (Día 1 a Día 3)

1. **Día 1 — Dominio y Esquema:** Lee el [Documento Funcional Maestro](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Funcional.md) para comprender los 18 conceptos escolares (DBA, Periodos, Cursos Paralelos, OTP). Revisa el modelo relacional en `guides/AcademiaNeivaBD.sql` y `backend/src/types/db.types.ts`.
2. **Día 2 — Autenticación, Zod y Kysely:** Examina `backend/src/middleware/authMiddleware.ts` y comprende la inyección de `req.user.schoolId`, la validación de esquemas con Zod y la construcción de consultas con Kysely (`backend/src/config/kysely.ts`).
3. **Día 3 — Flujo de Calificaciones y Periodos:** Estudia `backend/src/controllers/gradingController.ts` y `backend/src/utils/periodHelpers.ts` para entender la protección de doble capa contra periodos cerrados.

### ¿Cómo agregar un nuevo módulo o funcionalidad siguiendo las convenciones?

1. **Base de Datos**: Define la tabla en PostgreSQL asegurando incluir la columna `id_colegio INT NOT NULL REFERENCES colegio(id_colegio)` y actualiza `db.types.ts`.
2. **Backend**:
   - Define el esquema Zod en `backend/src/dtos/nuevoModuloSchema.ts`.
   - Crea las rutas en `backend/src/routes/nuevoModulo.routes.ts`.
   - Implementa los métodos en `backend/src/controllers/nuevoModuloController.ts` usando Kysely (`db.selectFrom(...)`).
   - Inyecta `verifyToken` en todas las rutas protegidas.
3. **Frontend**:
   - Crea la vista Vue en `frontend/src/views/rol/NuevaVista.vue`.
   - Agrega la ruta en `frontend/src/router/index.ts` especificando `meta: { requiresAuth: true, roles: ['directivo'] }`.
4. **Documentación**:
   - Crea la carpeta `guides/modules/XX_nuevo_modulo/` con sus respectivos `historias_usuario.md`, `reglas_negocio.md`, `casos_uso.md` y `nuevo_modulo.md`.
   - Registra el nuevo módulo en `guides/modules/mapa_documentacion.md` y en los documentos maestros.

---

## 12. Glosario Técnico y Referencias

- **ADR**: Architecture Decision Record (Registro de Decisiones Arquitectónicas).
- **Kysely**: Constructor de consultas SQL fuertemente tipado con autocompletado y validación estática en TypeScript.
- **Zod**: Librería de validación de esquemas y tipos en runtime con inferencia estática para TypeScript.
- **JTI**: JWT ID (Identificador único de token usado para revocación en blacklist).
- **SPA**: Single Page Application (Aplicación de Página Única).
- **OTP**: One-Time Password de 6 dígitos numéricos para validación transaccional por correo electrónico.

---

### Matriz de Enlaces a la Documentación Modular Completa
- 🗺️ **[Mapa General de Módulos (guides/modules/mapa_documentacion.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/mapa_documentacion.md)**
- 📄 **[Documentación Técnica Integral (guides/AcademiaNeiva_Documentacion_Tecnica_Integral.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documentacion_Tecnica_Integral.md)**
- 📘 **[Manual Funcional Maestro (guides/AcademiaNeiva_Documento_Funcional.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Funcional.md)**
- 🌐 **[Reglas Generales y Transversales (guides/reglas_negocio_generales.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/reglas_negocio_generales.md)**
