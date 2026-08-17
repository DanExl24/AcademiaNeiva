# Marco Normativo, Modelo Jurídico y Soporte de la Estructura Académica en AcademiaNeiva

> **Sustento Legal:** Ley General de Educación (Ley 115 de 1994 - Artículos 10, 11, 12, 27 y ss.), Decreto Único Reglamentario del Sector Educación (Decreto 1075 de 2015) y Doctrina Administrativa (Oficio No. 370-3318/10.06.98 - Secretaría de Educación / Directivos Docentes).
> **Sistema Destino:** Sistema Integrado de Gestión Académica **AcademiaNeiva**
> **Versión del Documento:** 2.0
> **Estado:** Vigente y Aprobado para Arquitectura de Software y Base de Datos

---

## 1. Objetivo del Documento

El presente documento técnico-legal establece y formaliza el marco normativo de la República de Colombia utilizado como fundamento para la definición de la estructura académica, el modelo relacional de datos y las reglas de negocio implementadas en **AcademiaNeiva**.

Específicamente, este documento persigue:

1. **Sustentar la correspondencia legal** entre las disposiciones de la **Ley 115 de 1994** (Ley General de Educación), el **Decreto 1075 de 2015** (DURSE) y las entidades computacionales del sistema.
2. **Justificar técnicamente** las decisiones de modelado de datos y arquitectura de software, demostrando que la representación operativa de los niveles y ciclos educativos no vulnera la estructura jurídica nacional, sino que la optimiza para la gestión institucional.
3. **Servir como guía auditable** para desarrolladores, administradores de base de datos, directivos docentes y entidades fiscalizadoras de educación en la verificación de reglas de matrícula, promoción, repetición y trazabilidad académica de los estudiantes.

---

## 2. Alcance

El alcance de este documento abarca los siguientes aspectos técnicos y jurídicos dentro de la plataforma **AcademiaNeiva**:

- **Organización Normativa de la Educación Formal:** Análisis de los niveles (Preescolar, Básica y Media) y sus respectivos ciclos (Primaria y Secundaria).
- **Mapeo al Modelo de Base de Datos:** Relación entre la normativa nacional y las tablas `nivel_escolar`, `tipo_grado`, `grupos`, `matricula` y `estudiante`.
- **Ciclo de Vida de la Trayectoria Escolar:** Reglas de progresión, promoción gradual, repetición y vinculación formal del educando.
- **Aislamiento Multi-Tenant y Seguridad:** Aplicación de la normativa bajo el esquema multi-institucional (`id_colegio`).
- **Sustento Doctrinario:** Integración del Oficio No. 370-3318/10.06.98 relativo a la autonomía y continuidad organizativa de ciclos y directivos docentes.

> [!NOTE]
> Este documento cumple una función de especificación técnico-legal para el desarrollo y auditoría del software **AcademiaNeiva**. No sustituye el asesoramiento legal formal ante el Ministerio de Educación Nacional (MEN) ni la normativa interna expedida en el Proyecto Educativo Institucional (PEI) de cada establecimiento.

---

## 3. Normativa Aplicable y Fundamentos Jurídicos

### 3.1. Ley 115 de 1994 (Ley General de Educación)

La **Ley 115 de 1994** regula el servicio público de la educación en Colombia. En lo relativo a la estructura académica formal, sus disposiciones fundamentales son:

#### **Artículo 10. Concepto de Educación Formal**

> _"Se entiende por educación formal aquella que se imparte en establecimientos educativos aprobados, en una secuencia regular de ciclos lectivos, con sujeción a pautas curriculares progresivas, y conducente a grados y títulos."_

**Implicación en AcademiaNeiva:** Justifica la existencia de un modelo de datos secuencial, rígido y versionado por años lectivos, donde el progreso del estudiante no es aleatorio sino curricularmente secuenciado mediante promociones de grado.

#### **Artículo 11. Niveles de la Educación Formal**

> _"La educación formal a que se refiere la presente Ley, se organizará en tres (3) niveles:_
> _a) El preescolar que comprenderá mínimo un grado obligatorio;_
> _b) La educación básica con una duración de nueve (9) grados que se desarrollará en dos ciclos: La educación básica primaria de cinco (5) grados y la educación básica secundaria de cuatro (4) grados, y_
> _c) La educación media con una duración de dos (2) grados._
>
> _La educación formal en sus distintos niveles, tiene por objeto desarrollar en el educando conocimientos, habilidades, aptitudes y valores mediante los cuales las personas puedan fundamentar su desarrollo en forma permanente."_

**Doctrina Administrativa y Jurisprudencia Aplicable (Oficio No. 370-3318/10.06.98):**
La Secretaría de Educación y las directivas docentes reconocen formalmente que la Educación Básica, aunque jurídicamente constituye un solo nivel de 9 grados, requiere una diferenciación organizativa y pedagógica clara entre sus dos ciclos (Primaria de 5 grados y Secundaria de 4 grados). Esta diferenciación incide en la asignación de directivos docentes, la estructuración del plan de estudios y la evaluación del desempeño escolar.

#### **Artículo 12. Definición de Niveles y Grados**

> _"El servicio público educativo se prestará en las instituciones educativas en los niveles y grados establecidos en el artículo 11 de esta Ley..."_

### 3.2. Decreto 1075 de 2015 (Decreto Único Reglamentario del Sector Educación - DURSE)

El **Decreto 1075 de 2015** compila las normas reglamentarias del sector educación en Colombia:

- **Evaluación e Institucionalidad (SIEE):** Reglamenta el Sistema Institucional de Evaluación de los Estudiantes, estableciendo la escala de valoración nacional (Superior, Alto, Básico, Bajo) y los criterios de promoción/reprobación.
- **Organización del Año Lectivo y Ciclos:** Define la duración de las jornadas académicas y las intensidades horarias mínimas obligatorias para Básica Primaria, Básica Secundaria y Educación Media.

---

## 4. Estructura de la Educación Formal en Colombia

La estructura legal dispuesta por el Artículo 11 de la Ley 115 de 1994 se jerarquiza de la siguiente manera:

```text
                                EDUCACIÓN FORMAL
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  1. PREESCOLAR                    2. BÁSICA                      3. MEDIA
(Mín. 1 grado obligatorio)     (9 grados totales)             (2 grados totales)
        │                              │                              │
        ├── Jardín / Prejardín         ├──────────────────────┐       ├── 10.º
        └── Transición (Oblig.)        ▼                      ▼       └── 11.º
                                  CICLO PRIMARIA        CICLO SECUNDARIA
                                  (5 grados)            (4 grados)
                                       │                      │
                                       ├── 1.º                ├── 6.º
                                       ├── 2.º                ├── 7.º
                                       ├── 3.º                ├── 8.º
                                       ├── 4.º                └── 9.º
                                       └── 5.º
```

---

## 5. Decisión de Diseño en AcademiaNeiva: Categorías Operativas

### 5.1. Justificación Técnica del Modelado de Datos

El Artículo 11 de la Ley 115 de 1994 define **tres (3) niveles legales**: Preescolar, Básica y Media, dividiendo la Básica en dos ciclos.

Sin embargo, para propósitos de gestión informática, optimización de base de datos y operación académica en los colegios, **AcademiaNeiva** clasifica los niveles en **cuatro (4) categorías operativas** en la entidad `nivel_escolar`:

```text
1. PREESCOLAR
2. PRIMARIA
3. SECUNDARIA
4. MEDIA
```

### 5.2. Matriz de Correspondencia Jurídico-Técnica

| Nivel Ley 115/1994   | Ciclo Legal      | Categoría Operativa en AcademiaNeiva | Grados Asociados (`tipo_grado`) |
| :------------------- | :--------------- | :----------------------------------- | :------------------------------ |
| **Preescolar**       | N/A              | `PREESCOLAR`                         | Jardín, Prejardín, Transición   |
| **Educación Básica** | Ciclo Primaria   | `PRIMARIA`                           | 1.º, 2.º, 3.º, 4.º, 5.º         |
| **Educación Básica** | Ciclo Secundaria | `SECUNDARIA`                         | 6.º, 7.º, 8.º, 9.º              |
| **Educación Media**  | N/A              | `MEDIA`                              | 10.º, 11.º                      |

### 5.3. Ventajas Técnicas y Funcionales de la Decisión

1. **Rendimiento de Consultas Indexadas:** Evita realizar filtrados secundarios complejos o Joins anidados para diferenciar la primaria de la secundaria en reportes de boletines o consolidados por ciclo.
2. **Aislamiento de Modelos Pedagógicos:** En Básica Primaria predomina la figura del docente titular por aula, mientras que en Básica Secundaria opera la distribución de docentes especialistas por asignatura.
3. **Generación de Boletines y SIEE:** Permite aplicar escalas y criterios de evaluación diferenciados entre primaria y secundaria según el PEI institucional.
4. **Fiel Cumplimiento Doctrinario:** Respeta la práctica administrativa avalada en el Oficio 370-3318/10.06.98.

---

## 6. Soporte en el Modelo de Datos de AcademiaNeiva

El modelo relacional de datos de **AcademiaNeiva** traduce la normativa en una arquitectura Multi-Tenant estricta.

### 6.1. Diagrama de Jerarquía Relacional

```text
[colegio] (id_colegio)
    │
    ├──► [nivel_escolar] (id_nivel, nombre: PREESCOLAR | PRIMARIA | SECUNDARIA | MEDIA)
    │        │
    │        └──► [tipo_grado] (id_tipo_grado, nombre, id_nivel)
    │                 │
    │                 └──► [grupos] (id_grupo, id_tipo_grado, id_nivel, id_jornada, id_seccion)
    │                          │
    └──────────────────────────┼──────────────────┐
                               ▼                  ▼
                         [matricula] ◄────── [estudiante]
```

### 6.2. Especificación de Entidades Principales

#### 1. Tabla `nivel_escolar`

Almacena los niveles y ciclos educativos operacionales asignados a cada institución (`id_colegio`).

- `id_nivel` (PK, Serial)
- `nombre` (Varchar): `'PREESCOLAR'`, `'PRIMARIA'`, `'SECUNDARIA'`, `'MEDIA'`
- `id_colegio` (FK -> `colegio.id_colegio`)

#### 2. Tabla `tipo_grado`

Representa los grados académicos definidos por la Ley 115.

- `id_tipo_grado` (PK, Serial)
- `nombre` (Varchar): Ej. `'Primero'`, `'Sexto'`, `'Décimo'`
- `id_nivel` (FK -> `nivel_escolar.id_nivel`)

#### 3. Tabla `grupos`

Representa la unidad operativa donde interactúan estudiantes, docentes y asignaturas (ej. Grupo "6-A", Morning shift).

- `id_grupo` (PK, Serial)
- `id_tipo_grado` (FK -> `tipo_grado.id_tipo_grado`)
- `id_nivel` (FK -> `nivel_escolar.id_nivel`)
- `id_colegio` (FK -> `colegio.id_colegio`)

#### 4. Tabla `matricula`

Constituye el **acto administrativo y jurídico** mediante el cual el educando se vincula formalmente al servicio público educativo durante un año lectivo determinado.

- `id_matricula` (PK, Serial)
- `id_estudiante` (FK -> `estudiante.id_estudiante`)
- `id_grupo` (FK -> `grupos.id_grupo`)
- `id_nivel` (FK -> `nivel_escolar.id_nivel`)
- `id_anio` (FK -> `anio_lectivo.id_anio`)
- `estado` (Enum: `'NUEVO'`, `'MATRICULADO'`, `'CANCELADO'`, `'PROMOVIDO'`, `'REPROBADO'`, `'REINGRESO'`)

---

## 7. Traza de la Trayectoria Académica del Estudiante

El sistema garantiza que la progresión escolar cumpla con la secuencia regular estipulada por el Artículo 10 de la Ley 115:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRAYECTORIA ESCOLAR                            │
└─────────────────────────────────────────────────────────────────────────┘
   [PREESCOLAR]    Transición
                       │
                       ▼
   [PRIMARIA]      1.º ──► 2.º ──► 3.º ──► 4.º ──► 5.º
                                                   │ (Transición de Ciclo)
                                                   ▼
   [SECUNDARIA]    6.º ──► 7.º ──► 8.º ──► 9.º
                                           │ (Transición a Media)
                                           ▼
   [MEDIA]         10.º ──► 11.º ──► [GRADUACIÓN / TÍTULO DE BACHILLER]
```

---

## 8. Reglas de Negocio Codificadas (RN-ACA)

Con base en la Ley 115 de 1994 y el Decreto 1075 de 2015, se imponen las siguientes reglas institucionales obligatorias en el backend:

### **RN-ACA-001: Clasificación de Niveles Operativos**

Todo grado registrado en el sistema debe pertenecer obligatoriamente a una de las cuatro categorías operativas de `nivel_escolar`: `PREESCOLAR`, `PRIMARIA`, `SECUNDARIA` o `MEDIA`.

### **RN-ACA-002: Delimitación de Educación Básica Primaria**

El ciclo de Básica Primaria está compuesto exactamente por cinco (5) grados correlativos (1.º a 5.º), cuyo `id_nivel` debe referenciar a la categoría `PRIMARIA`.

### **RN-ACA-003: Delimitación de Educación Básica Secundaria**

El ciclo de Básica Secundaria está compuesto exactamente por cuatro (4) grados correlativos (6.º a 9.º), cuyo `id_nivel` debe referenciar a la categoría `SECUNDARIA`.

### **RN-ACA-004: Delimitación de Educación Media**

El nivel de Educación Media comprende exactamente dos (2) grados (10.º y 11.º), cuyo `id_nivel` debe referenciar a la categoría `MEDIA`. Su culminación exitosa otorga el título de Bachiller.

### **RN-ACA-005: Obligatoriedad del Grado de Preescolar**

De conformidad con el Artículo 11, Literal a) de la Ley 115, el sistema debe registrar obligatoriamente al menos el grado Transición dentro del nivel `PREESCOLAR` antes de permitir la promoción a 1.º de Primaria.

### **RN-ACA-006: Invariante de Secuencia y Progresión Grado a Grado**

La asignación de un estudiante a un grado superior requiere la comprobación del cumplimiento del plan de estudios del grado inmediatamente anterior, impidiendo saltos de grado no autorizados legalmente.

### **RN-ACA-007: Vinculación Administrativa por Matrícula**

Ningún estudiante puede registrar calificaciones, asistencias o evidencias formativas sin poseer un registro de `matricula` en estado activo (`MATRICULADO`) vinculado a un `id_grupo` y `id_nivel` válidos.

### **RN-ACA-008: Promoción y Repetición de Grado (Decreto 1075 de 2015 - SIEE)**

- Si un estudiante aprueba las asignaturas según los criterios del SIEE institucional, la lógica de promoción registra su estado como `PROMOVIDO` y lo habilita para matricularse en el grado siguiente.
- Si el estudiante no cumple con las condiciones del SIEE, su estado se registra como `REPROBADO`, habilitando su matriculación en el mismo grado para el siguiente año lectivo (repetición).

### **RN-ACA-009: Aislamiento Multi-Tenant por Colegio**

Los catálogos de `nivel_escolar`, `tipo_grado` y `grupos` están estrictamente aislados por la columna `id_colegio`. Ningún usuario o proceso puede vincular estudiantes a grados o niveles pertenecientes a otro colegio.

---

## 9. Matriz de Impacto en los Módulos de AcademiaNeiva

| Módulo del Sistema                  | Aplicación del Marco Normativo y Reglas de Negocio                                                                 |
| :---------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **01. Gestión de Matrículas**       | Asigna estudiantes a`id_nivel` y `id_grupo` verificando la edad y la secuencia de grados antecedentes.             |
| **02. Administración Académica**    | Configuración de los niveles (`nivel_escolar`) y grados (`tipo_grado`) ofertados por la institución.               |
| **03. Evaluación y Calificaciones** | Aplica la escala de valoración nacional (Superior, Alto, Básico, Bajo) según Decreto 1075/2015.                    |
| **04. Promoción y Cierre de Año**   | Automatiza el paso de grado (ej. 5.º a 6.º o 9.º a 10.º) o la repetición según las reglas RN-ACA-008.              |
| **05. Consolidados y Boletines**    | Emite los reportes de rendimiento agrupados legalmente por nivel o ciclo (Primaria, Secundaria, Media).            |
| **06. Reingresos y Traslados**      | Valida antecedentes académicos del estudiante al cambiar de institución o ciclo lectivo.                           |
| **07. Reportes MEN / SIMAT**        | Exporta la información académica en el formato estandarizado de niveles y grados exigido por el Estado colombiano. |

---

## 10. Justificación Técnica de Implementación en Código

Para garantizar la integridad y evitar errores de tipado o consultas SQL vulnerables, el backend de **AcademiaNeiva** utiliza:

1. **Query Builder Tipado (Kysely):** Toda consulta sobre las entidades `nivel_escolar`, `tipo_grado`, `grupos` y `matricula` se realiza mediante Kysely sobre las definiciones de [db.types.ts](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/src/types/db.types.ts), validando existencias de columnas e integridad referencial en tiempo de compilación.
2. **Validación de Schemas (Zod):** Los DTOs de entrada (`matricula.dto.ts`, `student.dto.ts`, `reingreso.dto.ts`) utilizan esquemas Zod estrictos que exigen `id_nivel` e `id_tipo_grado` numéricos válidos.
3. **Constraint de Base de Datos:** PostgreSQL impone claves foráneas con reglas `ON DELETE RESTRICT` para evitar la eliminación accidental de un nivel o grado con matrículas activas.

---

## 11. Conclusión

El diseño de software y base de datos de **AcademiaNeiva** se encuentra plenamente alineado con la **Ley 115 de 1994** y el **Decreto 1075 de 2015**.

La adopción de las cuatro categorías operativas (`PREESCOLAR`, `PRIMARIA`, `SECUNDARIA`, `MEDIA`) dentro de la entidad `nivel_escolar` constituye una **decisión de diseño informático de alto rendimiento** que no contraviene la división tripartita jurídica (Preescolar, Básica, Media), sino que operacionaliza con precisión los dos ciclos de la Educación Básica exigidos por el legislador y respaldados por la doctrina del Ministerio de Educación Nacional.

En consecuencia, el sistema ofrece una base sólida, auditable y jurídicamente conforme para la administración de la trayectoria académica de los estudiantes colombianos.

---

## 12. Referencias Normativas y Doctrinarias

1. **Ley 115 de 1994 (Febrero 8):** _Por la cual se expide la Ley General de Educación._ Congreso de la República de Colombia. Artículos 10, 11, 12, 13, 14, 27 y ss.
2. **Decreto 1075 de 2015 (Mayo 26):** _Decreto Único Reglamentario del Sector Educación (DURSE)._ Ministerio de Educación Nacional de Colombia. Reglamentación del SIEE y organización escolar.
3. **Oficio No. 370-3318/10.06.98:** _Secretaría de Educación. Criterios de organización y continuidad de ciclos en la Educación Básica Primaria y Secundaria para Directivos Docentes._
4. **Constitución Política de Colombia de 1991:** Artículo 67 (Derecho a la educación y obligatoriedad del ciclo básico).
