# 🏅 Módulo 19: Seguimiento Académico, Promoción y Reprobación Anual

## 1. Descripción General
El módulo de **Seguimiento Académico, Promoción y Reprobación Anual** brinda una gestión integral del rendimiento de los estudiantes en el sistema **AcademiaNeiva**. Permite a los directivos consultar el desempeño de los estudiantes período a período (de forma individual o **acumulativa hasta el período N**), consolidar el resultado anual lectivo, mantener un historial académico continuo por estudiante y utilizar esta información como insumo de apoyo a la decisión durante el proceso de matrícula y promoción.

El sistema identifica a los estudiantes con asignaturas reprobadas, emite **advertencias académicas informativas** al directivo durante la matrícula y registra la **decisión institucional** que adopte el directivo (promover, mantener grado, matrícula condicionada, etc.) sin bloquear rígida o automáticamente los procesos administrativos.

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

---

### 2.2. Endpoints del Servidor (Backend Express + Kysely + Zod)

Ubicación: `backend/src/controllers/academicAdmin/academicTrackingController.ts` y `backend/src/routes/academicAdmin.routes.ts`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/academic-admin/academic-tracking/period-tracking` | Consulta el rendimiento de estudiantes por período individual o acumulativo (Períodos 1..N). Retorna promedios ponderados cotejados con la escala institucional, contadores de aprobados/reprobados y materias reprobadas por estudiante con docente asignado. |
| `GET` | `/api/academic-admin/academic-tracking/annual-consolidation` | Genera la consolidación anual del resultado académico. Clasifica a los estudiantes en Aprobados/Promovidos, No Promovidos o Pendientes. |
| `GET` | `/api/academic-admin/academic-tracking/student-history/:studentId` | Recupera el historial académico de varios años del estudiante. |
| `GET` | `/api/academic-admin/academic-tracking/check-warning` | Consulta por número de documento durante el flujo de matrícula para determinar si el estudiante reprueba el año anterior y generar la advertencia. |
| `POST` | `/api/academic-admin/academic-tracking/record-decision` | Registra la decisión del directivo validada con esquemas Zod. |

---

### 2.3. Frontend (Vue 3 + Tailwind CSS + Lucide Icons)

- **Vista Principal Directivo**: `frontend/src/views/admin/AcademicTrackingView.vue` (`/dashboard/gestion-aprobados`).
  - **Pestaña 1**: Seguimiento por Período / Acumulado (conmutación individual vs acumulado P1..PN, tarjetas de estadísticas y tabla expandible por estudiante).
  - **Pestaña 2**: Consolidado Anual de Promoción y modal para registrar la decisión del directivo.
  - **Pestaña 3**: Historial del Estudiante y línea de tiempo por año lectivo.
- **Barra de Navegación**: Enlace **"Gestión Aprobados"** con ícono `Award` en `DashboardLayout.vue`.
- **Advertencia en Matrícula**: Componente informativo **⚠️ Advertencia académica** en `FinalRegistration.vue` que muestra asignaturas y año reprobado sin bloquear la matrícula.
