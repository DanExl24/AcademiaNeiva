# AcademiaNeiva - Portal de Gestión Académica y Curricular

AcademiaNeiva es un sistema de información web avanzado diseñado para la gestión de instituciones educativas de Neiva, permitiendo el control de matrículas, calificaciones, asistencia, planeación curricular alineada con el catálogo oficial del MEN (Derechos Básicos de Aprendizaje - DBA) y auditorías de supervisión.

---

## 🚀 Estructura del Repositorio

El proyecto está organizado en un monorepositorio compuesto por dos subproyectos principales:

- [/frontend](file:///c:/Users/alejo/Downloads/segundoProyecto/frontend): Cliente SPA moderno desarrollado con **Vue 3**, **Vite**, **TypeScript**, **Pinia** y **TailwindCSS**.
- [/backend](file:///c:/Users/alejo/Downloads/segundoProyecto/backend): Servidor REST de API desarrollado en **Node.js** con **Express**, **TypeScript** y base de datos relacional **PostgreSQL**.
- [/guides](file:///c:/Users/alejo/Downloads/segundoProyecto/guides): Documentación técnica del sistema, incluyendo esquemas de bases de datos, diagramas y especificaciones de las reglas de negocio.

---

## 🛠️ Configuración y Despliegue Local

### Requisitos Previos
- **Node.js** (v18 o superior)
- **npm** (v9 o superior)
- **PostgreSQL** (v12 o superior)

### 1. Base de Datos
1. Crea una base de datos vacía en PostgreSQL llamada `AcademiaNeiva`.
2. Edita las variables de conexión en el archivo de entorno del backend.

### 2. Configurar Variables de Entorno
Copia los archivos de entorno de plantilla en el subdirectorio del backend:
- En [/backend](file:///c:/Users/alejo/Downloads/segundoProyecto/backend), asegúrate de tener configurado tu archivo `.env` con las variables de base de datos (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`) y la clave secreta `JWT_SECRET`.

### 3. Instalación e Inicialización del Sistema (Seeder)
Para instalar las dependencias y poblar la base de datos con datos de prueba realistas (usuarios, materias, estudiantes matriculados, calificaciones y asistencia en periodos cerrados), corre en la carpeta del backend:

```bash
# 1. Instalar dependencias en el backend
cd backend
npm install

# 2. Inicializar la base de datos, correr migraciones y poblar datos iniciales
npm run seed:reset
```

> [!TIP]
> Las credenciales de acceso autogeneradas para los directivos, docentes, estudiantes y padres de familia de los 5 colegios sembrados de prueba se guardarán automáticamente en:
> [backend/generated/seed-credentials.md](file:///c:/Users/alejo/Downloads/segundoProyecto/backend/generated/seed-credentials.md)

### 4. Ejecución en Modo Desarrollo
Abre dos terminales para correr ambos servidores de desarrollo en simultáneo:

**Terminal Backend:**
```bash
cd backend
npm run dev
```

**Terminal Frontend:**
```bash
cd frontend
npm install
npm run dev
```

El servidor web del frontend se levantará por defecto en `http://localhost:5173`.

---

## 📖 Documentación del Proyecto

Toda la documentación técnica y las especificaciones de las reglas de negocio se encuentran estructuradas en el directorio [/guides](file:///c:/Users/alejo/Downloads/segundoProyecto/guides):

- 🏠 **[Índice de Guías (guides/README.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/README.md)**: Tabla de contenidos de toda la documentación del portal.
- 📐 **[Arquitectura y Base de Datos (guides/architecture.md)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/architecture.md)**: Estructura del modelo relacional, triggers y roles.
- 🔗 **[Módulos Funcionales (guides/modules/)](file:///c:/Users/alejo/Downloads/segundoProyecto/guides/modules)**: Explicación de flujos de DBA, periodos cerrados, sincronización vertical de competencias, auditorías del Admin General y estados de estudiantes.
