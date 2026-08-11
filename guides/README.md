# 📖 Portal de Documentación — AcademiaNeiva

Bienvenido a la Base de Conocimiento oficial del sistema **AcademiaNeiva**. Esta guía centraliza todas las especificaciones, arquitectura de software, reglas de negocio e historias de usuario de la plataforma.

---

## 📚 Documentos Maestros del Sistema

- 📘 **[Documento Maestro Funcional y de Negocio (Volumen 1)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Funcional.md)**
  - Propuesta de valor, problemas que resuelve el sistema y roles.
  - Conocimiento del Dominio Educativo Colombiano (conceptos clave explicados).
  - Resumen ejecutivo de los 19 módulos de negocio, reglas globales y diagramas de flujos.

- 📙 **[Documento Maestro Técnico y de Arquitectura (Volumen 2)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Documento_Tecnico.md)**
  - Arquitectura desacoplada de 3 capas (Vue 3 SPA → Express API → PostgreSQL PL/pgSQL Triggers & JSONB).
  - **9 Registros de Decisiones Arquitectónicas (ADRs completos)** (Vue 3, Express, PostgreSQL, Multi-Tenant, JSONB, sync_uuid, Base36, Inmutabilidad Doble y Reapertura por Materia).
  - Modelo de Datos relacional, Triggers SQL, esquema de Seguridad JWT, convención de nombres y guía de instalación/despliegue.
  - **Guía de Onboarding para Nuevos Desarrolladores** (Día 1 a 3, patrones de diseño y cómo crear un módulo nuevo).

- 📜 **[Especificación de Requisitos de Software IEEE Std 830-1998](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeiva_Especificacion_IEEE830.md)**
  - Documento formal conforme a la norma IEEE 830-1998 con guías inteligentes por sección.
  - Catálogo de requisitos funcionales por los 19 módulos (`RF-XXX-00X`), requisitos no funcionales (rendimiento, seguridad, fiabilidad) y apéndices de trazabilidad SQL.


---

## 🗺️ Mapa de Módulos (`guides/modules/`)

Para consultar el detalle de las Historias de Usuario, Reglas de Negocio y Casos de Uso por cada componente, accede a:
- 📄 **[Tabla Navegable de Módulos (guides/modules/README.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/README.md)**

---

## 🎨 Diagramas de Flujo y Casos de Uso
Los diagramas visuales y esquemas gráficos del sistema se encuentran resguardados en la carpeta:
- **[guides/diagrams/](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/diagrams)** (Recursos gráficos institucionales).
