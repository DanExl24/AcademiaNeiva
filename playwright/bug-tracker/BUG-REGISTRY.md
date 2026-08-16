# 🐞 Registro Oficial de Defectos y Bugs — QA / Testing E2E (AcademiaNeiva)

Este documento centraliza todos los defectos funcionales (**Tipo D: Bug Real**) detectados durante la ejecución de las pruebas E2E automatizadas con Playwright.

> **Regla de QA**: No se realiza ninguna corrección en el código del sistema durante la fase de análisis y testeo. Cada defecto se documenta en esta bitácora con evidencias completas para su resolución en la fase posterior de estabilización.

---

## 📊 Resumen de Defectos por Módulo

| Módulo | Total Defectos | Críticos (P0) | Importantes (P1) | Secundarios (P2) | Estado |
|---|---|---|---|---|---|
| 01. Autenticación y Sesiones | 0 | 0 | 0 | 0 | Pendiente |
| 02. Gestión de Colegios | 0 | 0 | 0 | 0 | Pendiente |
| 03. Usuarios y Directivos | 0 | 0 | 0 | 0 | Pendiente |
| 04. Estructura Escolar | 0 | 0 | 0 | 0 | Pendiente |
| 05. Docentes | 0 | 0 | 0 | 0 | Pendiente |
| 06. Matrículas e Inscripciones | 0 | 0 | 0 | 0 | Pendiente |
| 07. Estudiantes y Estados | 0 | 0 | 0 | 0 | Pendiente |
| 08. Configuración Académica | 0 | 0 | 0 | 0 | Pendiente |
| 09. Competencias y Sincronización | 0 | 0 | 0 | 0 | Pendiente |
| 10. Catálogo DBA | 0 | 0 | 0 | 0 | Pendiente |
| 11. Calificaciones y Actividades | 0 | 0 | 0 | 0 | Pendiente |
| 12. Observaciones del Estudiante | 0 | 0 | 0 | 0 | Pendiente |
| 13. Asistencia Escolar | 0 | 0 | 0 | 0 | Pendiente |
| 14. Cierre y Boletines | 0 | 0 | 0 | 0 | Pendiente |
| 15. Supervisión y Auditoría | 0 | 0 | 0 | 0 | Pendiente |
| 16. Soporte y Tickets | 0 | 0 | 0 | 0 | Pendiente |
| 17. Gestión de Padres | 0 | 0 | 0 | 0 | Pendiente |
| 18. Gestión de Traslados | 0 | 0 | 0 | 0 | Pendiente |
| 19. Seguimiento y Promoción | 0 | 0 | 0 | 0 | Pendiente |
| 20. Seguimiento Académico Directivo | 0 | 0 | 0 | 0 | Pendiente |
| 21. Flujo de Correos y OTP | 0 | 0 | 0 | 0 | Pendiente |

---

## 📋 Plantilla de Registro de Incidencia (Fase 10)

```markdown
### BUG-[MOD]-[NUM]: [Título breve del error]
- **Módulo**: [Nombre del Módulo]
- **Funcionalidad**: [Acción probada]
- **Rol**: [ADMIN / DIRECTIVO / DOCENTE / ESTUDIANTE / PADRE]
- **Prioridad**: [P0 - Crítica / P1 - Importante / P2 - Secundaria]
- **Precondición**: [Estado inicial de la base de datos o sesión]
- **Pasos para reproducir**:
  1. Paso 1
  2. Paso 2
  3. Paso 3
- **Resultado Esperado**: [Comportamiento según HU / Regla de Negocio]
- **Resultado Obtenido**: [Error en UI / Código HTTP 500 / Fallo de validación]
- **URL / Endpoint**: `[URL / Endpoint]`
- **Request Payload**:
  ```json
  {}
  ```
- **Response Payload**:
  ```json
  {}
  ```
- **Evidencia**: `reports/test-results/...` (Trace / Screenshot / Log)
- **Regla de Negocio / HU Asociada**: [RN-XXX-000 / HU-XXX-000]
```

---

## 🗂️ Registro Detallado de Bugs Detectados

*(Las incidencias se irán agregando aquí conforme se ejecuten las pruebas de cada módulo)*
