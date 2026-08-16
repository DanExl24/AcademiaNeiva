# 🎭 Suite E2E Playwright — AcademiaNeiva

Suite de pruebas end-to-end automatizada diseñada según la arquitectura y fases establecidas en [playwrightTest.md](file:///c:/Users/alejo/Downloads/segundoProyecto/playwrightTest.md).

## 📁 Estructura del Proyecto

```
playwright/
├── .env.test                  # Configuración de URLs y BD de testing
├── playwright.config.ts       # Runner de Playwright
├── tsconfig.json              # Tipado TypeScript
├── fixtures/                  # Fixtures compartidos y autenticación
├── pages/                     # Page Object Models (POM)
├── helpers/                   # Helpers de BD y utilidades
├── data/                      # Credenciales y datos sintéticos
├── tests/                     # Tests organizados por módulo (01..21)
├── bug-tracker/               # Registro de incidencias (BUG-REGISTRY.md)
└── reports/                   # Evidencias de ejecución (trazas, videos, capturas)
```

## 🚀 Comandos de Ejecución

```bash
# Instalar dependencias en playwright/
npm install

# Instalar navegadores Playwright
npx playwright install chromium

# Ejecutar todos los tests E2E
npm run test:e2e

# Ejecutar solo tests críticos
npm run test:e2e:critical

# Ejecutar con interfaz interactiva
npm run test:e2e:ui

# Ver reporte HTML
npm run test:report
```

## 🛡️ Reglas de QA

1. **No corregir código en desarrollo durante el testing**: Todo fallo funcional se reporta en `bug-tracker/BUG-REGISTRY.md`.
2. **Trazabilidad estricta**: Cada test debe mapear a una Historia de Usuario (HU) y Regla de Negocio (RN) documentada en `guides/modules/`.
3. **No inventar requisitos**: Si una regla no está clara, se marca como `UNKNOWN`.
