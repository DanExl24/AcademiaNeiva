# 🌐 Módulo Global (Reglas Universales del Sistema)

## 📌 Propósito del Módulo
El **Módulo Global** (`modulo_global`) centraliza las reglas de negocio, constantes institucionales, validaciones cruzadas y formatos estándar que rigen a **todas** las entidades y submódulos de la plataforma **AcademiaNeiva**.

A diferencia de los módulos específicos (como `01_autenticacion` o `06_matriculas`), las reglas definidas aquí aplican universalmente en todo el sistema sin importar desde qué panel o rol se consuman.

---

## 📂 Contenido del Módulo

1. [Reglas de Validación de Documentos de Identidad](./reglas_documentos.md)
   - Especificaciones técnicas de formatos (CC, TI, RC, CE, PEP/PPT, Pasaporte).
   - Estructuras Regex y mensajes de error estandarizados.
   - Unicidad global a nivel de la tabla `usuario`.

---

## 📐 Principios Globales del Sistema

1. **Identidad Única Centralizada**:
   - Todo usuario del sistema (Directivos, Docentes, Padres, Estudiantes, Admins) posee su identidad en la tabla central `usuario`.
   - Las tablas de roles (`docente`, `estudiante`, `padre_familia`) almacenan exclusivamente metadatos específicos del rol académico.

2. **Validación en Múltiples Capas (Defense in Depth)**:
   - **Frontend:** Máscaras dinámicas y placeholders según el tipo de documento seleccionado.
   - **DTO (Zod):** Validación de tipos, formatos y expresiones regulares antes de procesar controladores.
   - **Service/Helper Backend:** Normalización (`normalizeDocument`) y chequeos de unicidad global (`validateDocumentUniqueness`).
   - **Base de Datos (PostgreSQL):** Restricción física `CHECK (documento IS NULL OR documento ~ '^[a-zA-Z0-9]+$')` en la tabla `usuario`.
