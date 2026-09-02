# ⏱️ Guía Técnica de Auditoría y Estimación de Horas Trabajadas — AcademiaNeiva

**Sistema:** Academia Neiva  
**Área:** Auditoría de Software, Métricas Git y Trazabilidad Forense  
**Script Ejecutable:** [`scripts/estimate_git_hours.js`](file:///c:/Users/alejo/Downloads/segundoProyecto/scripts/estimate_git_hours.js)  
**Documento Rector Generado:** [`guides/ESTIMACION_HORAS_TRABAJADAS.md`](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/ESTIMACION_HORAS_TRABAJADAS.md)  
**Última actualización:** 2026-09-02  

---

## 1. Propósito de esta Guía

En el ciclo de vida de **AcademiaNeiva**, certificar el tiempo real invertido en la arquitectura, programación, refactorización y documentación es un requisito indispensable para auditorías técnicas, justificación de esfuerzo y entregas ante comités de evaluación.

Esta guía documenta cómo funciona el motor de auditoría de Git, cómo se calculan las horas trabajadas mediante el **Algoritmo de Sesiones Temporales Agrupadas (*Time-Clustering Session Algorithm*)** y el paso a paso para **volver a poner al día el documento rector con un solo comando** a medida que se sigan sumando commits en el repositorio.

---

## 2. Ejecución Rápida (Paso a Paso)

Para actualizar automáticamente el informe de horas trabajadas tras haber realizado nuevos commits:

### Paso 1: Abrir la terminal en la raíz del proyecto
Asegúrate de estar en el directorio raíz (`segundoProyecto/`):
```bash
pwd
# Debe apuntar a: .../segundoProyecto
```

### Paso 2: Ejecutar el script automatizado
```bash
node scripts/estimate_git_hours.js
```

### Paso 3: Salida esperada en consola
En aproximadamente 1.5 a 2 segundos verás:
```text
🔍 Iniciando extracción forense del historial Git...
📦 Commits totales detectados: 643
✅ .../guides/ESTIMACION_HORAS_TRABAJADAS.md actualizado con éxito.
📊 Resumen: 643 commits | 66 días | 100 sesiones | 150.4 h probables.
```

### Paso 4: Confirmar y subir a Git
Siguiendo la regla del proyecto:
```bash
git add .
git commit -m "docs(audit): actualizar estimación de horas trabajadas con nuevos commits"
git push
```

---

## 3. Fundamento Matemático y Metodología

El cálculo **no asume un valor arbitrario por commit** (lo cual inflaría desproporcionadamente las horas en commits pequeños o subestimaría sprints complejos). En su lugar, se implementa el modelo estándar de la industria:

### Diagrama de Decisión del Algoritmo
```mermaid
flowchart TD
    Inicio([Nuevo Commit n]) --> Chequeo{¿Existe sesión previa del mismo autor?}
    Chequeo -- No --> NuevaSesion[Crear Sesión #k con +30 min Base de Contexto]
    Chequeo -- Sí --> DeltaCalc[Calcular Delta = Tiempo(Commit n) - Tiempo(Commit n-1)]
    
    DeltaCalc --> GapCheck{¿Delta ≤ 60 minutos?}
    GapCheck -- Sí --> SumarDelta[Sumar Delta exacto a la Sesión Activa]
    GapCheck -- No / Pausa --> CerrarSesion[Cerrar Sesión Previa]
    
    CerrarSesion --> NuevaSesion
    SumarDelta --> Siguiente[Avanzar al siguiente Commit]
    NuevaSesion --> Siguiente
```

### Reglas Clave:
1. **Umbral de Inactividad (*Gap Threshold* = 60 min):**
   - Si entre dos commits consecutivos de un mismo autor transcurren **menos de 60 minutos**, se considera trabajo ininterrumpido y se suma la diferencia exacta de tiempo en minutos.
   - Si transcurren **más de 60 minutos**, se asume que el programador pausó la jornada (almuerzo, descanso o fin del día). La sesión anterior se cierra con su duración acumulada y se abre una nueva sesión independiente.

2. **Tiempo Base de Contexto (*Base Session Time* = 30 min):**
   - Todo primer commit de una sesión (o commit aislado) representa tiempo previo no commiteado: lectura del requerimiento, diseño de arquitectura, codificación y pruebas en local antes de ejecutar `git commit`. Se le asigna una base de 30 minutos en el escenario probable.

3. **Escenarios Comparativos:**
   - 🟢 **Conservador:** Ventana de pausa de 60 min, Base de 20 min por sesión.
   - 🔵 **Probable (Estándar Recomendado):** Ventana de pausa de 60 min, Base de 30 min por sesión.
   - 🟠 **Alto:** Ventana de pausa de 75 min, Base de 45 min por sesión.

---

## 4. Estructura Interna de `scripts/estimate_git_hours.js`

El script está construido en Node.js puro sin dependencias externas pesadas (`child_process`, `fs`, `path` nativos):

| Bloque del Script | Función |
|---|---|
| **1. Extracción de Git** | Ejecuta `git log --reverse --pretty=format:...` para obtener hashes, autores, fechas estrictas ISO y mensajes. |
| **2. Métricas `numstat`** | Ejecuta `git log --numstat` para acumular líneas añadidas, líneas eliminadas y rutas de archivos afectados por cada commit. |
| **3. Clustering de Sesiones** | Itera cronológicamente los commits agrupando por proximidad temporal según el umbral de 60 minutos. |
| **4. Clasificación por Áreas** | Analiza las rutas modificadas (`frontend/`, `backend/`, `guides/`, `db/`, `.github/`) para asignar cada commit a su capa correspondiente (Fullstack, Frontend, Backend, Documentación, Base de Datos, DevOps, Testing). |
| **5. Distribución de 24 Horas** | Genera el histograma horario en arte ASCII para visualizar la franja horaria predominante (diurna vs nocturna). |
| **6. Renderizado Markdown** | Ensambla el documento final con badges SVG de shields.io, tablas de KPIs, métricas por autor y la bitácora completa de sesiones `#1` a `#N`, sobreescribiendo [`guides/ESTIMACION_HORAS_TRABAJADAS.md`](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/ESTIMACION_HORAS_TRABAJADAS.md). |

---

## 5. Personalizaciones Comunes

Si en el futuro deseas adaptar el script para un caso especial:

### A. Modificar la ventana de inactividad o tiempo base
En `scripts/estimate_git_hours.js`, localiza la llamada a `runClustering`:
```javascript
// Para ajustar a 45 minutos de pausa y 25 min base:
const resPersonalizado = runClustering(45, 25);
```

### B. Agregar una nueva categoría o carpeta del proyecto
En el objeto `areas` del script, puedes incorporar nuevas reglas de asignación:
```javascript
const areas = {
  // ...
  mobile: { name: 'App Móvil', count: 0, desc: 'Aplicación React Native / Flutter' }
};

// En la iteración:
if (f.some(x => x.startsWith('mobile/'))) {
  areas.mobile.count++;
}
```

---

## 6. Preguntas Frecuentes (FAQ)

### ¿Qué pasa si hago 5 commits seguidos en 10 minutos?
El algoritmo no suma 5 horas. Suma los 30 minutos base de inicialización más los 10 minutos reales de delta acumulados entre los commits (Total = 40 minutos), reflejando con exactitud el tiempo real trabajado.

### ¿Se pierden los datos históricos al volver a ejecutar el script?
No. El script es **idempotente y determinista**: lee directamente el historial inmutable de Git desde el primer commit del proyecto hasta el más reciente. Si no hay commits nuevos, el resultado es idéntico; si hay commits nuevos, simplemente se agregan a las métricas y a la tabla de sesiones.

### ¿Qué factores no mide Git?
Git solo mide el tiempo con evidencia en código. No contabiliza reuniones presenciales, lectura de decretos del MEN en físico o diseño en papel. Por esta razón, el informe incluye la cláusula de estimación con factores no capturados (**190 a 225 horas hombre reales**).

---

<div align="center">

**AcademiaNeiva** — Guía de Mantenimiento de Auditoría Git  
*Conservar este archivo como referencia permanente para desarrolladores, evaluadores y auditores del proyecto.*

</div>
