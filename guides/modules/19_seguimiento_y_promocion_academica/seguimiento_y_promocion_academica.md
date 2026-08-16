# 🏅 Módulo 19: Seguimiento Académico, Promoción y Reprobación Anual

## 1. Descripción General
El módulo de **Seguimiento Académico, Promoción y Reprobación Anual** brinda una gestión integral del rendimiento de los estudiantes en el sistema **AcademiaNeiva**. Permite a los directivos consultar el desempeño de los estudiantes período a período (de forma individual o **acumulativa hasta el período N**), consolidar el resultado anual lectivo, mantener un historial académico continuo por estudiante y utilizar esta información como insumo de apoyo a la decisión durante el proceso de matrícula y promoción.

El sistema identifica a los estudiantes con asignaturas reprobadas, emite **advertencias académicas informativas** al directivo durante la matrícula y registra la **decisión institucional** que adopte el directivo (promover, mantener grado, matrícula condicionada, etc.) sin bloquear rígida o automáticamente los procesos administrativos.

Adicionalmente, el módulo integra un **control avanzado para estudiantes del último año lectivo (graduandos)**. Detecta dinámicamente el grado de mayor nivel configurado en la institución (sin quedar fijo a un nombre de grado como Grado 11 - ONCE), resalta visualmente las tarjetas y filas de dichos estudiantes en la interfaz directiva, ofrece un filtro rápido **"Solo Graduandos"** y ejecuta automáticamente la **graduación del estudiante** (cambio de estado a `GRADUADO` e inscripción en `registro_graduados`) cuando el directivo autoriza su promoción anual.

---

## 2. Componentes Técnicos

### 2.1. Modelo de Base de Datos y Tipos ENUM

#### ENUMs de PostgreSQL
- `public.resultado_consolidado_anual`:
  - `'APROBADO'`
  - `'NO_PROMOVIDO'`
  - `'PENDIENTE_RECUPERACION'`
  - `'PENDIENTE_DECISION'`
- `public.decision_promocion_tipo`:
  - `'PROMOVER_SIGUIENTE_GRADO'`
  - `'MANTENER_GRADO'`
  - `'MATRICULA_CONDICIONADA'`
  - `'OTRA_DECISION'`

#### Tabla `decision_promocion_directivo`
Almacena la trazabilidad de las decisiones de promoción registradas por el personal directivo.

```sql
CREATE TABLE IF NOT EXISTS public.decision_promocion_directivo (
    id_decision SERIAL PRIMARY KEY,
    id_estudiante INTEGER NOT NULL REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE,
    id_colegio INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE,
    id_anio_anterior INTEGER NOT NULL REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE,
    resultado_calculado public.resultado_consolidado_anual NOT NULL,
    decision_tomada public.decision_promocion_tipo NOT NULL,
    id_grado_anterior INTEGER REFERENCES public.grados(id_grado) ON DELETE SET NULL,
    id_grado_asignado INTEGER REFERENCES public.grados(id_grado) ON DELETE SET NULL,
    id_usuario_decision INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    fecha_decision TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT
);
```

#### Tabla `registro_graduados`
Registra el historial oficial de los estudiantes que han completado satisfactoriamente su ciclo escolar y graduación.

```sql
CREATE TABLE IF NOT EXISTS public.registro_graduados (
    id_graduado SERIAL PRIMARY KEY,
    id_estudiante INTEGER NOT NULL REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE,
    id_anio INTEGER REFERENCES public.anio_lectivo(id_anio) ON DELETE SET NULL,
    fecha_graduacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    id_usuario_registro INTEGER REFERENCES public.usuario(id_usuario) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2.2. Endpoints del Servidor (Backend Express + Kysely + Zod)

Ubicación: `backend/src/controllers/academicAdmin/academicTrackingController.ts` y `backend/src/routes/academicAdmin.routes.ts`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/academic-admin/academic-tracking/period-tracking` | Consulta el rendimiento de estudiantes por período individual o acumulativo (Períodos 1..N). Retorna promedios ponderados cotejados con la escala institucional, asignaturas reprobadas por estudiante con docente asignado e inyecta las propiedades de detección de último grado (`is_final_grade` / `es_ultimo_grado`). |
| `GET` | `/api/academic-admin/academic-tracking/annual-consolidation` | Genera la consolidación anual del resultado académico. Clasifica a los estudiantes en Promovidos, No Promovidos o Pendientes, inyectando los atributos de último grado para el resaltado y la lógica de graduación. |
| `GET` | `/api/academic-admin/academic-tracking/student-history/:studentId` | Recupera el historial académico de varios años del estudiante. |
| `GET` | `/api/academic-admin/academic-tracking/check-warning` | Consulta por número de documento durante el flujo de matrícula para determinar si el estudiante reprueba el año anterior y generar la advertencia. |
| `POST` | `/api/academic-admin/academic-tracking/record-decision` | Registra la decisión del directivo validada con esquemas Zod. Si el estudiante pertenece al último grado y la decisión es `PROMOVER_SIGUIENTE_GRADO`, actualiza automáticamente el estado del alumno a `GRADUADO`, inscribe su entrada en `registro_graduados` y deja `id_grado_asignado = null`. |

---

### 2.3. Frontend (Vue 3 + Tailwind CSS + Lucide Icons)

- **Vista Principal Directivo**: `frontend/src/views/admin/AcademicTrackingView.vue` (`/dashboard/gestion-aprobados`).
  - **Pestaña 1**: Seguimiento por Período / Acumulado (conmutación individual vs acumulado P1..PN, botón de filtro **"Solo Graduandos"**, distintivo 🎓 **"Último Año"** en tarjetas/filas y desglose por asignatura).
  - **Pestaña 2**: Consolidado Anual de Promoción y modal para registrar la decisión del directivo (con texto dinámico **"Promover y Graduar Estudiante 🎓"** y notificación de graduación para los graduandos).
  - **Pestaña 3**: Historial del Estudiante y línea de tiempo por año lectivo.
- **Barra de Navegación**: Enlace **"Gestión Aprobados"** con ícono `Award` en `DashboardLayout.vue`.
- **Advertencia en Matrícula**: Componente informativo **⚠️ Advertencia académica** en `FinalRegistration.vue` que muestra asignaturas y año reprobado sin bloquear la matrícula.
