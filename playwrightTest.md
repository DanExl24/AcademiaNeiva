Documento técnico: Estrategia de automatización E2E con Playwright + Agente IA

1. Objetivo

Implementar una estrategia automatizada de pruebas E2E para el sistema AcademiaNeiva, utilizando Playwright y un agente de IA capaz de analizar la aplicación, documentación funcional, reglas de negocio y resultados de ejecución.

El objetivo principal es reducir la necesidad de ejecutar manualmente los mismos flujos funcionales y aumentar la cobertura de pruebas sobre:

Funcionalidades.
Historias de usuario.
Reglas de negocio.
Validaciones.
Permisos y roles.
Flujos positivos y negativos.
Casos límite.
Integridad de los datos.
Navegación.
Comportamiento ante errores.

La IA debe actuar como asistente de generación, ejecución, diagnóstico y mantenimiento de pruebas, pero no debe considerarse automáticamente como autoridad sobre el comportamiento esperado del sistema.

2. Arquitectura general

La estrategia propuesta seguirá este flujo:

Documentación funcional
│
├── Historias de usuario
├── Reglas de negocio
├── Casos de uso
└── Requisitos
│
▼
Análisis del sistema
│
▼
Inventario de funcionalidades
│
▼
Matriz de cobertura
│
▼
Plan de pruebas E2E
│
▼
Generación de tests
│
▼
Ejecución Playwright
│
▼
Análisis de resultados
┌─────┴─────┐
▼ ▼
Error del test Bug real
│ │
▼ ▼
Healer Reporte
│ │
└─────┬─────┘
▼
Re-ejecución
│
▼
Suite estabilizada

La idea fundamental es separar qué debería hacer el sistema de cómo se prueba.

3. Fase 0: Preparación del entorno

Antes de generar pruebas, se debe preparar un entorno controlado.

Objetivos

Garantizar que las pruebas no interfieran con datos reales ni produzcan resultados inconsistentes.

Requisitos
Ambiente de pruebas independiente.
Base de datos de testing.
Variables de entorno específicas.
Usuario de prueba para cada rol necesario.
Datos iniciales controlados.
Playwright configurado.
Navegadores definidos.
Scripts de ejecución.
Sistema de generación de reportes.

Ejemplo:

AcademiaNeiva
│
├── backend
├── frontend
├── tests
│ └── e2e
│
├── playwright.config.ts
└── .env.test

Debe existir una separación clara:

Producción
≠
Desarrollo
≠
Testing E2E

Esto es importante especialmente para pruebas que crean, modifican o eliminan información.

4. Fase 1: Reconocimiento del sistema

Esta fase consiste en permitir que el agente conozca el sistema antes de escribir tests.

Debe analizar:

Frontend
Rutas.
Vistas.
Componentes.
Formularios.
Botones.
Tablas.
Modales.
Estados.
Mensajes.
Navegación.
Guards.
Permisos.
Backend
Endpoints.
Métodos HTTP.
Validaciones.
Middleware.
Autenticación.
Autorización.
Manejo de errores.
Servicios.
Acceso a datos.
Base de datos
Tablas.
Relaciones.
Constraints.
Estados.
Restricciones de integridad.
Documentación

Especialmente:

historias_usuario.md
reglas_negocio.md
casos_uso.md

El agente debe establecer una relación entre documentación y funcionalidades reales.

Por ejemplo:

HU-MAT-001
│
├── POST /matriculas
├── Vista Crear Matrícula
├── Formulario matrícula
└── Tabla matricula
Resultado

Se debe producir un inventario funcional.

Ejemplo:

Módulo Funcionalidad Rol Prioridad
Matrículas Crear matrícula Directivo Alta
Matrículas Editar matrícula Directivo Alta
Matrículas Consultar matrícula Directivo Alta
Matrículas Cancelar matrícula Directivo Alta
Seguimiento Registrar calificación Docente Alta
Seguimiento Consultar calificaciones Padre Media

No se deben generar cientos de tests todavía.

Primero hay que saber qué existe.

5. Fase 2: Matriz de trazabilidad

Esta es probablemente la fase más importante.

Cada prueba debe poder relacionarse con un requisito.

La estructura recomendada:

Requisito
↓
Historia de usuario
↓
Regla de negocio
↓
Caso de prueba
↓
Test Playwright
↓
Resultado

Ejemplo:

HU-MAT-003
"Crear matrícula"

RB-MAT-007
"No se permite matricular dos veces al mismo
estudiante en el mismo periodo."

TC-MAT-003-01
Crear matrícula válida.

TC-MAT-003-02
Intentar matrícula duplicada.

TC-MAT-003-03
Intentar matrícula sin estudiante.

TC-MAT-003-04
Intentar matrícula con periodo cerrado.

Esto permite posteriormente responder:

¿Qué reglas de negocio están realmente automatizadas?

Y no simplemente:

Tenemos 436 tests.

Porque tener 436 tests que comprueban que los botones son redondos no impresiona a nadie.

6. Fase 3: Diseño de casos de prueba

Antes de escribir código, la IA debe generar casos de prueba.

Cada funcionalidad debería analizarse desde diferentes perspectivas.

6.1 Happy Path

Flujo esperado.

Login
↓
Matrículas
↓
Nueva matrícula
↓
Datos válidos
↓
Guardar
↓
Confirmación
6.2 Validaciones
Campo obligatorio vacío
Tipo incorrecto
Longitud incorrecta
Valor inválido
Duplicados
6.3 Casos límite

Por ejemplo:

mínimo permitido
máximo permitido
fecha límite
último periodo
primer periodo
6.4 Autorización

Cada rol debe probarse.

ADMIN
DIRECTIVO
DOCENTE
PADRE
ESTUDIANTE

No todos necesitan ejecutar todas las funciones.

Se debe verificar tanto:

"puede acceder"

como:

"NO puede acceder"
6.5 Estados

Por ejemplo:

Periodo abierto
Periodo cerrado
Estudiante activo
Estudiante retirado
Matrícula activa
Matrícula cancelada
6.6 Errores del backend

Debe comprobarse que:

Backend falla
↓
Frontend recibe error
↓
Usuario recibe mensaje
↓
UI permanece consistente 7. Fase 4: Priorización

No todas las pruebas tienen la misma importancia.

Se recomienda utilizar tres niveles.

P0 - Críticas

Si fallan, el sistema prácticamente no funciona.

Login
Autenticación
Permisos
Matrícula
Persistencia
P1 - Importantes

Funciones centrales pero no necesariamente bloqueantes.

Edición
Consultas
Seguimiento académico
Calificaciones
Promoción
P2 - Secundarias
Filtros
Ordenamiento
Detalles visuales
Casos poco frecuentes

La primera suite debe centrarse en P0 y P1.

8. Fase 5: Diseño de la arquitectura Playwright

La suite no debería convertirse en una carpeta con 300 archivos donde nadie sabe qué demonios está pasando.

Una estructura razonable:

tests/
└── e2e/
├── auth/
│ ├── login.spec.ts
│ └── permissions.spec.ts
│
├── matriculas/
│ ├── crear.spec.ts
│ ├── editar.spec.ts
│ ├── cancelar.spec.ts
│ └── validaciones.spec.ts
│
├── estudiantes/
│ ├── crear.spec.ts
│ └── consultar.spec.ts
│
├── seguimiento/
│ ├── calificaciones.spec.ts
│ └── promocion.spec.ts
│
├── traslados/
│ └── traslado.spec.ts
│
├── fixtures/
├── pages/
├── helpers/
└── data/
Page Objects

Los flujos repetitivos deberían abstraerse.

Por ejemplo:

LoginPage
MatriculaPage
EstudiantePage
SeguimientoPage

Esto permite evitar:

test 1 → locator
test 2 → mismo locator
test 3 → mismo locator
test 4 → mismo locator

y centralizar comportamiento.

9. Fase 6: Generación de tests mediante IA

Aquí entra el agente.

El agente debe recibir:

Documentación

- Inventario
- Matriz de trazabilidad
- Arquitectura Playwright
- Convenciones del proyecto

Y generar los tests.

Pero hay una regla importante:

La IA no debe inventar requisitos.

Si una regla no está documentada y tampoco puede inferirse con seguridad del comportamiento existente, debe marcarla como:

UNKNOWN

en lugar de inventarse una interpretación.

10. Fase 7: Ejecución inicial

Una vez generados los tests:

npx playwright test

La primera ejecución sirve como baseline.

No se debe intentar corregir todo inmediatamente.

Los resultados deben clasificarse:

PASS
FAIL
SKIPPED
BLOCKED

Y los FAIL deben clasificarse posteriormente.

11. Fase 8: Diagnóstico automático

Cuando un test falla, el agente debe determinar la causa.

Tipo A: Locator roto

Ejemplo:

getByRole("button", { name: "Guardar" })

ya no encuentra el botón porque cambió el texto.

Esto es un problema del test.

Tipo B: Timing

Ejemplo:

element not visible

Puede ser una condición de sincronización.

También podría ser un problema del test.

Tipo C: Cambio legítimo de UI

El sistema cambió intencionalmente.

Debe actualizarse el test.

Tipo D: Bug funcional

Ejemplo:

POST /matriculas → 500

o:

UI muestra "Matrícula creada"
pero el registro no existe.

Eso debe clasificarse como:

REAL BUG 12. Fase 9: Healing de pruebas

Aquí puede utilizarse el agente Healer de Playwright.

Su objetivo es reparar pruebas que dejaron de funcionar debido a cambios legítimos.

Ejemplo:

Antes:
button "Guardar matrícula"

Después:
button "Crear matrícula"

El Healer puede detectar el nuevo elemento y adaptar el locator.

Pero existe una regla crítica:

El Healer no debe utilizarse para ocultar bugs funcionales.

Si:

test → falla

no significa automáticamente:

test → incorrecto

Puede significar:

test → detectó un bug. 13. Fase 10: Validación de bugs

Cuando la IA detecte un posible bug debe generar información suficiente para reproducirlo.

Como mínimo:

ID
Módulo
Funcionalidad
Rol
Precondiciones
Pasos
Resultado esperado
Resultado obtenido
URL
Request
Response
Screenshot
Trace
Console errors

Ejemplo:

BUG-MAT-014

Módulo:
Matrículas

Rol:
Directivo

Precondición:
Periodo académico cerrado.

Pasos:

1. Acceder a Matrículas.
2. Seleccionar estudiante.
3. Crear matrícula.
4. Guardar.

Esperado:
La operación debe ser rechazada.

Obtenido:
La matrícula es creada correctamente.

Eso ya sirve para que un desarrollador arregle el problema sin tener que jugar a las adivinanzas.

14. Fase 11: Re-ejecución

Después de corregir:

Bug
↓
Corrección
↓
Test original
↓
PASS

Pero también:

Corrección
↓
Suite completa
↓
¿Regresiones?

Porque arreglar una función y romper otras tres es un clásico humano bastante documentado.

15. Fase 12: Regresión automatizada

Una vez estabilizada la suite, se debe poder ejecutar completa mediante:

npm run test:e2e

Y dividirla en niveles:

npm run test:e2e:smoke
npm run test:e2e:critical
npm run test:e2e:full
Smoke

Tests rápidos:

login
dashboard
rutas principales
operaciones críticas
Critical

P0 + P1.

Full

Toda la suite.

16. Fase 13: Evidencias

Cada ejecución debe generar evidencias.

Recomendado:

screenshots
videos
traces
HTML report
console logs
network logs

Especialmente para errores.

Playwright permite utilizar su sistema de trazas para inspeccionar posteriormente una ejecución fallida.

La idea es que un fallo sea reproducible incluso sin tener que volver a ejecutar manualmente todo el flujo.

17. Fase 14: Integración CI/CD

Una vez estabilizada la suite:

Git push
↓
CI
↓
Build
↓
Backend
↓
Frontend
↓
Playwright
↓
Tests
↓
Report

Idealmente:

Pull Request
↓
Smoke tests
↓
PASS → merge permitido
FAIL → revisión

Y para releases:

Release
↓
Full E2E
↓
PASS
↓
Deploy 18. Fase 15: Mantenimiento

Los tests E2E no son "crear una vez y olvidarse".

Cada modificación importante del sistema debe actualizar:

Historia de usuario
↓
Regla de negocio
↓
Caso de prueba
↓
Test Playwright

La IA puede ayudar enormemente aquí.

Por ejemplo:

Cambio:
Se modifica flujo de matrícula.

IA:

1. Busca funcionalidades afectadas.
2. Busca tests relacionados.
3. Detecta posibles incompatibilidades.
4. Actualiza tests.
5. Ejecuta pruebas.
6. Reporta regresiones.
7. Fase 16: Métricas

No mediría el éxito por cantidad de tests.

Usaría:

Cobertura funcional
funcionalidades automatizadas /
funcionalidades totales
Cobertura de reglas
reglas de negocio probadas /
reglas de negocio identificadas
Tasa de éxito
tests PASS /
tests ejecutados
Flakiness

Cantidad de tests que pasan/fallan de manera inconsistente.

Defectos encontrados
bugs encontrados por automatización
Tiempo ahorrado

Comparación:

ejecución manual
vs
ejecución automatizada

Esta última puede ser especialmente interesante para justificar el proyecto.

20. Flujo operativo final

Una vez implementado todo:

    ┌──────────────────────┐
                │ Documentación        │
                │ funcional            │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ Agente IA            │
                │ analiza sistema      │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ Inventario funcional │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ Matriz trazabilidad  │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ Test Plan            │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ Playwright Generator │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ Ejecución E2E        │
                └──────────┬───────────┘
                           ↓
                    ┌──────┴──────┐
                    ↓             ↓
                  PASS          FAIL
                                  ↓
                         ┌────────────────┐
                         │ IA diagnostica │
                         └───────┬────────┘
                                 ↓
                    ┌────────────┴────────────┐
                    ↓                         ↓
               Test roto                  Bug real
                    ↓                         ↓
                 Healer                   Reporte
                    ↓                         ↓
                    └────────────┬────────────┘
                                 ↓
                         Re-ejecución
                                 ↓
                          Suite estable

21. Distribución de responsabilidades

Una arquitectura sana sería:

Responsabilidad IA QA/Desarrollador
Explorar aplicación ✅
Inventariar funcionalidades ✅ ✅
Proponer casos de prueba ✅ ✅
Validar casos ✅
Generar tests ✅
Ejecutar tests ✅
Analizar fallos ✅ ✅
Reparar locators ✅
Determinar reglas ambiguas ✅
Confirmar bugs ✅
Corregir código ⚠️ ✅
Mantener documentación ✅ ✅
Aprobar release ✅

La IA debería automatizar el trabajo mecánico y analítico, pero la decisión final sobre comportamiento funcional debería permanecer bajo control humano.

22. Orden recomendado para AcademiaNeiva

No empezaría por todo el sistema.

Lo implementaría así:

FASE 1
Infraestructura Playwright
↓
FASE 2
Autenticación + roles
↓
FASE 3
Módulos críticos
↓
FASE 4
Matriz de trazabilidad
↓
FASE 5
Generación IA
↓
FASE 6
Primera ejecución completa
↓
FASE 7
Clasificación de fallos
↓
FASE 8
Healing
↓
FASE 9
Corrección de bugs
↓
FASE 10
Suite de regresión
↓
FASE 11
CI/CD
