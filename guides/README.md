# 📖 Portal de Documentación — AcademiaNeiva

Bienvenido a la Base de Conocimiento oficial y centro de ingeniería del sistema **AcademiaNeiva**. Esta suite centraliza todas las especificaciones funcionales, arquitectura de software, marcos normativos, protocolos de seguridad, reglas de negocio e historias de usuario de la plataforma.

---

## 🗂️ Estructura y Organización de la Documentación

Toda la documentación técnica y funcional ha sido categorizada en carpetas temáticas para facilitar su consulta y mantenimiento:

```
guides/
├── 📚 maestros/                # Documentos maestros, funcionales, técnicos e IEEE 830
├── 📐 arquitectura_y_datos/   # Arquitectura de software, esquema relacional SQL y diagramas DBML
├── 🔒 seguridad/              # Documento técnico de seguridad, RBAC, JWT y validación OTP
├── ⚖️ normativa_y_legal/      # Marcos normativos colombianos (Ley 115, Dec 1290, Dec 1075)
├── 📋 reglas_negocio/         # Compendio maestro de reglas de negocio globales y transversales
├── 🔍 auditorias_y_calidad/   # Auditorías de interfaz UI/UX, inspecciones y logs históricos
├── 🧩 modules/                # Documentación individual y detallada de los 21 módulos funcionales
├── 📊 diagrams/               # Diagramas de arquitectura, flujos de datos y modelos ER
├── 🎓 DBA/                    # Catálogo nacional de Derechos Básicos de Aprendizaje (MEN)
├── 👶 curso_transicion/       # Directrices pedagógicas para el grado de Transición y Preescolar
└── 📄 Boletin/                # Modelos y especificaciones de diseño para boletines oficiales PDF
```

---

## 1. 📚 Documentos Maestros (`guides/maestros/`)

- 📜 **[Historial de Versiones y Changelog (v1.0.0 a v2.5.0)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/HISTORIAL_DE_VERSIONES.md)**
  - Trazabilidad cronológica completa desde el génesis hasta la versión actual: hitos, arquitectura, seguridad y roadmap.
- 🏛️ **[Arquitectura del Portal de Documentación Web](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/ARQUITECTURA_PORTAL_DOCUMENTACION.md)**
  - Guía técnica del visor web `/docs`, parseo de Markdown, grafo SVG Bézier de 6 capas y fichas ejecutivas.
- 📄 **[Documentación Técnica Integral (v2.5.0)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/maestros/AcademiaNeiva_Documentacion_Tecnica_Integral.md)**
  - Visión holística del sistema: arquitectura en 3 capas, resumen ejecutivo de los 21 módulos, stack tecnológico (Kysely/Zod), seguridad y matriz de referencias.
- 📘 **[Manual Funcional y de Negocio Maestro — Vol. 1](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/maestros/AcademiaNeiva_Documento_Funcional.md)**
  - Propuesta de valor, problemas de negocio resueltos, dominio escolar colombiano (18 conceptos clave), fichas de los 21 módulos y diagramas de secuencias operativas.
- 📙 **[Manual Técnico de Arquitectura e Ingeniería — Vol. 2](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/maestros/AcademiaNeiva_Documento_Tecnico.md)**
  - Arquitectura detallada, 11 ADRs (incluyendo Kysely y Zod), triggers PL/pgSQL, esquema de seguridad, guía de onboarding y patrones de desarrollo.
- 📜 **[Especificación de Requisitos de Software IEEE Std 830-1998](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/maestros/AcademiaNeiva_Especificacion_IEEE830.md)**
  - Documento contractual formal bajo el estándar IEEE 830 con catálogo completo de RF por módulo, RNF y matriz de trazabilidad.
- 📋 **[Plantilla de Requisitos IEEE](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/maestros/plantila_ieee.md)**
  - Guía base para la formulación de nuevas especificaciones.

---

## 2. 📐 Arquitectura y Persistencia de Datos (`guides/arquitectura_y_datos/`)

- 📐 **[Arquitectura y Modelo de Datos (`architecture.md`)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/arquitectura_y_datos/architecture.md)**
  - Diagrama de capas con Kysely/Zod, jerarquía de roles, modelo multi-colegio (`usuario_colegio` vs `docente`/`estudiante`) y catálogo de entidades.
- 🗄️ **[Esquema de Base de Datos PostgreSQL (`AcademiaNeivaBD.sql`)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/arquitectura_y_datos/AcademiaNeivaBD.sql)**
  - Script SQL maestro con tablas, llaves foráneas, índices y triggers PL/pgSQL de inmutabilidad.
- 📊 **[Esquema DBML Relacional (`AcademiaNeivaBD.dbml`)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/arquitectura_y_datos/AcademiaNeivaBD.dbml)**
  - Definición del modelo entidad-relación para renderizado gráfico.

---

## 3. 🔒 Seguridad y Control de Acceso (`guides/seguridad/`)

- 🛡️ **[Documento Técnico de Seguridad](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/seguridad/Documento_Tecnico_Seguridad_AcademiaNeiva.md)**
  - Tríada CIA, segmentación de red Docker, autenticación JWT con JTI y Blacklist, verificación transaccional OTP de 6 dígitos (expiración 15 min), URLs firmadas anti-IDOR, aislamiento de contraseñas de terceros en perfil, modo solo lectura en acompañamiento directivo y scorecard de madurez (4.8 / 5.0).

---

## 4. ⚖️ Marco Normativo y Legal Colombiano (`guides/normativa_y_legal/`)

Documentos que sustentan la conformidad legal del software ante el Ministerio de Educación Nacional de Colombia:

- ⚖️ **[Marco Normativo Ley 115 de 1994 (Ley General de Educación)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/normativa_y_legal/Marco_Normativo_Ley115_AcademiaNeiva.md)**
- 🏅 **[Decreto 1290 de 2009 — Evaluación y Promoción Escolar (SIEE)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/normativa_y_legal/Decreto_1290_2009_Evaluacion_y_Promocion_SIEE.md)**
- 📑 **[Reporte de Análisis del Decreto 1075 de 2015](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/normativa_y_legal/Reporte_Analisis_Decreto1075_AcademiaNeiva.md)**
- 📋 **[Plan de Implementación Decreto 1075](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/normativa_y_legal/Plan_Implementacion_Decreto1075_100_AcademiaNeiva.md)**

---

## 5. 📋 Reglas de Negocio Globales (`guides/reglas_negocio/`)

- 🌐 **[Reglas de Negocio Generales y Transversales](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/reglas_negocio/reglas_negocio_generales.md)**
  - Compendio integral de todas las reglas de negocio del sistema ordenadas por categoría (Seguridad, Matrícula, Calificaciones, Cierres, Asistencia, Periodos, DBA, etc.).

---

## 6. 🔍 Auditorías y Calidad (`guides/auditorias_y_calidad/`)

- 🎨 **[Auditoría UI/UX del Frontend](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/auditorias_y_calidad/Auditoria_UI_UX_Frontend_AcademiaNeiva.md)**
  - Análisis de diseño, usabilidad, consistencia de componentes y accesibilidad.
- 📁 **[Carpeta de Auditorías y Registros Históricos (`guides/Auditorias/`)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/Auditorias)**

---

## 7. 🧩 Módulos Funcionales Individuales (`guides/modules/`)

Cada uno de los 21 módulos cuenta con su carpeta cuádruple (`*.md`, `historias_usuario.md`, `reglas_negocio.md`, `casos_uso.md`):

- 🗺️ **[Mapa General de Navegación de los 21 Módulos (`mapa_documentacion.md`)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/mapa_documentacion.md)**
- 📄 **[Índice de Módulos (`guides/modules/README.md`)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules/README.md)**

---

## 8. 🎨 Recursos Pedagógicos y Gráficos

- 🎓 **[Derechos Básicos de Aprendizaje (DBA)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/DBA)**
- 👶 **[Lineamientos para Grado Transición](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/curso_transicion)**
- 📄 **[Especificaciones de Boletines PDF](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/Boletin)**
- 📊 **[Diagramas Arquitectónicos e Ilustraciones](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/diagrams)**
