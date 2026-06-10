# Migración de Escalas Valorativas

## ¿Qué sucede cuando se cambia el rango de notas del colegio?

Cuando un directivo actualiza la configuración de notas del colegio (`nota_minima`, `nota_maxima`, `nota_aprobacion`), el sistema ejecuta automáticamente una **migración proporcional** de todas las notas existentes.

---

## Fórmula de Rescalado

Cada nota existente se convierte al nuevo rango usando interpolación lineal:

```
ratio = (nota_actual - min_anterior) / (max_anterior - min_anterior)
nota_nueva = min_nuevo + ratio * (max_nuevo - min_nuevo)
```

**Ejemplo:**

- Rango anterior: `0.0 – 5.0`
- Rango nuevo: `0 – 100`
- Nota original: `4.0`

```
ratio = (4.0 - 0.0) / (5.0 - 0.0) = 0.8
nota_nueva = 0 + 0.8 * 100 = 80
```

El ratio se fuerza entre `0` y `1` para evitar notas fuera del nuevo rango.

---

## Tablas afectadas

| Tabla                 | Columna    | Precisión   |
| --------------------- | ---------- | ----------- |
| `notas_actividad`     | `nota`     | 1 decimal   |
| `nota_criterio`       | `nota`     | 1 decimal   |
| `resultado_academico` | `promedio` | 2 decimales |

Adicionalmente, la tabla `escala_valoracion` (BAJO, BASICO, ALTO, SUPERIOR) también se recalcula automáticamente para cubrir el nuevo rango.

---

## Flujo completo

```
Directivo actualiza configuracion_colegio (nota_minima, nota_maxima, nota_aprobacion)
    │
    ▼
syncSchoolScalesAndGrades (transacción ACID)
    │
    ├─ 1. Recalcula escala_valoracion con los nuevos límites
    │      (BAJO, BASICO, ALTO, SUPERIOR)
    │
    ├─ 2. Escala todas las notas_actividad
    │      → Actualiza nota y id_escalavaloracion
    │
    ├─ 3. Escala todas las notas en nota_criterio
    │
    └─ 4. Escala los promedios en resultado_academico
           (filtrado por colegio via JOIN con detalle_grados)
```

Si algún paso falla, la transacción completa hace **ROLLBACK**, dejando la base de datos intacta.

---

## Referencia de código

Función central: `syncSchoolScalesAndGrades` en  
`backend/src/controllers/academicAdminController.ts`

Invocada desde:

- `updateSchoolDefaultSettings` → cuando el directivo guarda la configuración
- `updateManualScaleConfiguration` → cuando ajusta los cortes manuales de escala
