import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

// Función para localizar de forma robusta la carpeta guides tanto en local como en Docker
export const getGuidesBasePath = async (): Promise<string> => {
  if (process.env.GUIDES_PATH) {
    return process.env.GUIDES_PATH;
  }

  const possiblePaths = [
    path.resolve(process.cwd(), "guides"),
    path.resolve(process.cwd(), "../guides"),
    path.resolve(__dirname, "../../../guides"),
    path.resolve(__dirname, "../../../../guides"),
    "/app/guides"
  ];

  for (const p of possiblePaths) {
    try {
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        return p;
      }
    } catch {
      // Sigue intentando
    }
  }

  // Fallback por defecto
  return path.resolve(process.cwd(), "../guides");
};

// Localiza de forma determinista y exclusiva el archivo README.md raíz del proyecto (Única Fuente de Verdad)
export const getRootReadmePath = async (): Promise<string | null> => {
  const basePath = await getGuidesBasePath();
  const candidates = [
    path.resolve(basePath, "../README.md"),
    path.resolve(basePath, "PROJECT_README.md"),
    path.resolve(process.cwd(), "README.md"),
    path.resolve(process.cwd(), "../README.md"),
    path.resolve(__dirname, "../../../README.md"),
    path.resolve(__dirname, "../../../../README.md"),
    "/app/README.md",
    path.join(basePath, "README.md")
  ];

  for (const p of candidates) {
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) {
        return p;
      }
    } catch {
      // Sigue intentando
    }
  }

  return null;
};

// Formatea nombres de carpetas de módulos como '06_matriculas' -> '06. Matrículas'
const formatModuleName = (dirName: string): string => {
  const parts = dirName.split("_");
  const num = parts[0];
  const nameParts = parts.slice(1);
  const title = nameParts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${num}. ${title}`;
};

// Formatea nombres de archivos como 'reglas_negocio.md' -> 'Reglas de Negocio' o 'gestion_jornadas.md' -> 'Submódulo: Gestión de Jornadas'
const formatDocTitle = (fileName: string, isSubmodule: boolean = false): string => {
  const base = path.basename(fileName).replace(/\.md$/i, "");
  const titles: Record<string, string> = {
    matriculas: "Documentación Principal",
    casos_uso: "Casos de Uso",
    historias_usuario: "Historias de Usuario",
    reglas_negocio: "Reglas de Negocio",
    autenticacion: "Documentación Principal",
    gestion_colegios: "Documentación Principal",
    usuarios_y_directivos: "Documentación Principal",
    estructura_escolar: "Documentación Principal",
    docentes: "Documentación Principal",
    estudiantes_y_estados: "Documentación Principal",
    configuracion_academica: "Documentación Principal",
    competencias_y_sincronizacion: "Documentación Principal",
    catalogo_dba: "Documentación Principal",
    calificaciones: "Documentación Principal",
    observaciones: "Documentación Principal",
    asistencia: "Documentación Principal",
    cierre_y_boletines: "Documentación Principal",
    supervision_y_auditoria: "Documentación Principal",
    soporte_y_tickets: "Documentación Principal",
    gestion_padres: "Documentación Principal",
    gestion_traslados: "Documentación Principal",
    seguimiento_y_promocion_academica: "Documentación Principal",
    seguimiento_academico_directivo: "Documentación Principal",
    flujo_correos_y_verificaciones: "Documentación Principal",
    mapa_documentacion: "Mapa General de Documentación",
    estados_y_tipos_matricula: "Tipos, Estados y Transiciones de Matrícula",
    ESTADOS_Y_TIPOS_MATRICULA: "Tipos, Estados y Transiciones de Matrícula",
    gestion_jornadas: "Submódulo: Gestión de Jornadas",
    maestro_de_informacion: "Maestro de Información del Sistema",
    MAESTRO_DE_INFORMACION: "Maestro de Información del Sistema",
    ARQUITECTURA_PORTAL_DOCUMENTACION: "Arquitectura del Portal de Documentación Web",
    arquitectura_portal_documentacion: "Arquitectura del Portal de Documentación Web",
    HISTORIAL_DE_VERSIONES: "Historial de Versiones y Changelog",
    historial_de_versiones: "Historial de Versiones y Changelog",
    ESTIMACION_HORAS_TRABAJADAS: "Estimación de Horas y Auditoría Git",
    estimacion_horas_trabajadas: "Estimación de Horas y Auditoría Git",
    README: "Visión General del Proyecto (README)",
    "README.md": "Visión General del Proyecto (README)",
    readme: "Visión General del Proyecto (README)",
    guides_index: "Índice de Guías Técnicas",
    INDICE_GUIAS: "Índice de Guías Técnicas",
    indice_guias: "Índice de Guías Técnicas"
  };

  if (titles[base]) return titles[base];

  const formatted = base
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return isSubmodule ? `Submódulo: ${formatted}` : formatted;
};

/**
 * GET /api/docs/modules
 * Lista todos los módulos disponibles en guides/modules con sus archivos markdown y submódulos.
 */
export const getDocsModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const basePath = await getGuidesBasePath();
    const modulesDir = path.join(basePath, "modules");

    const entries = await fs.readdir(modulesDir, { withFileTypes: true });

    const modules = [];

    // 0. Documentos Rectores (README.md [Única Fuente], HISTORIAL_DE_VERSIONES.md, ESTIMACION_HORAS_TRABAJADAS.md, MAESTRO_DE_INFORMACION.md)
    const masterFiles = [
      {
        id: "README",
        fileName: "README.md",
        relativePath: "README.md",
        title: "Visión General del Proyecto (README)",
        isSubmodule: false
      }
    ];

    // Historial de Versiones
    try {
      await fs.stat(path.join(basePath, "HISTORIAL_DE_VERSIONES.md"));
      masterFiles.push({
        id: "HISTORIAL_DE_VERSIONES",
        fileName: "HISTORIAL_DE_VERSIONES.md",
        relativePath: "HISTORIAL_DE_VERSIONES.md",
        title: "Historial de Versiones y Changelog",
        isSubmodule: false
      });
    } catch {}

    // Estimación de Horas Trabajadas (Auditoría Git)
    try {
      await fs.stat(path.join(basePath, "ESTIMACION_HORAS_TRABAJADAS.md"));
      masterFiles.push({
        id: "ESTIMACION_HORAS_TRABAJADAS",
        fileName: "ESTIMACION_HORAS_TRABAJADAS.md",
        relativePath: "ESTIMACION_HORAS_TRABAJADAS.md",
        title: "Estimación de Horas y Auditoría Git",
        isSubmodule: false
      });
    } catch {}

    let hasMaster = false;
    let masterRelPath = "MAESTRO_DE_INFORMACION.md";
    try {
      await fs.stat(path.join(basePath, "MAESTRO_DE_INFORMACION.md"));
      hasMaster = true;
      masterRelPath = "MAESTRO_DE_INFORMACION.md";
    } catch {
      try {
        await fs.stat(path.join(modulesDir, "MAESTRO_DE_INFORMACION.md"));
        hasMaster = true;
        masterRelPath = "MAESTRO_DE_INFORMACION.md";
      } catch {}
    }

    if (hasMaster) {
      masterFiles.push({
        id: "MAESTRO_DE_INFORMACION",
        fileName: "MAESTRO_DE_INFORMACION.md",
        relativePath: masterRelPath,
        title: "Maestro de Información del Sistema",
        isSubmodule: false
      });
    }

    if (masterFiles.length > 0) {
      modules.push({
        id: "maestro",
        folderName: "",
        name: "🏛️ 00. Documentos Rectores",
        files: masterFiles,
        submodules: []
      });
    }

    // Si existe mapa_documentacion.md en la raíz de modules
    const hasMap = entries.some((e) => e.isFile() && e.name === "mapa_documentacion.md");
    if (hasMap) {
      modules.push({
        id: "general",
        folderName: "",
        name: "🗺️ 00. Mapa General",
        files: [
          {
            id: "mapa_documentacion",
            fileName: "mapa_documentacion.md",
            relativePath: "mapa_documentacion.md",
            title: "Mapa General de Documentación",
            isSubmodule: false
          }
        ],
        submodules: []
      });
    }

    const dirEntries = entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    for (const dir of dirEntries) {
      const dirPath = path.join(modulesDir, dir.name);
      const dirContents = await fs.readdir(dirPath, { withFileTypes: true });

      // 1. Archivos principales del módulo
      const mdFiles = dirContents
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .sort((a, b) => {
          const aBase = path.basename(a.name, ".md").toLowerCase();
          const bBase = path.basename(b.name, ".md").toLowerCase();
          const dirBase = dir.name.replace(/^\d+_/, "").toLowerCase();

          if (aBase === dirBase || aBase === "index" || aBase === "modulo") return -1;
          if (bBase === dirBase || bBase === "index" || bBase === "modulo") return 1;
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        });

      const files = mdFiles.map((file) => ({
        id: path.basename(file.name, ".md"),
        fileName: file.name,
        relativePath: file.name,
        title: formatDocTitle(file.name, false),
        isSubmodule: false
      }));

      // 2. Submódulos (en carpeta 'submodules' o carpetas hijas)
      const submodules = [];
      const submodulesDir = path.join(dirPath, "submodules");
      try {
        const subStat = await fs.stat(submodulesDir);
        if (subStat.isDirectory()) {
          const subContents = await fs.readdir(submodulesDir, { withFileTypes: true });
          const subMdFiles = subContents
            .filter((e) => e.isFile() && e.name.endsWith(".md"))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

          for (const subFile of subMdFiles) {
            submodules.push({
              id: `sub_${path.basename(subFile.name, ".md")}`,
              fileName: subFile.name,
              relativePath: `submodules/${subFile.name}`,
              title: formatDocTitle(subFile.name, true),
              isSubmodule: true
            });
          }
        }
      } catch {
        // No existe carpeta submodules, ignorar
      }

      modules.push({
        id: dir.name,
        folderName: dir.name,
        name: formatModuleName(dir.name),
        files,
        submodules
      });
    }

    res.json({ success: true, modules });
  } catch (error: any) {
    console.error("Error al listar módulos de documentación:", error);
    res.status(500).json({ error: "Error al listar módulos de documentación." });
  }
};

/**
 * GET /api/docs/content
 * Obtiene el contenido de un archivo markdown específico de guides/modules (incluyendo submódulos).
 */
export const getDocContent = async (req: Request, res: Response): Promise<void> => {
  const moduleName = String(req.query.module || "").trim();
  let fileName = String(req.query.file || "").trim();
  const subpath = String(req.query.subpath || "").trim();

  if (!fileName) {
    res.status(400).json({ error: "Debe especificar el parámetro 'file'." });
    return;
  }

  // Normalizar ruta si subpath viene explícito
  let relativeFilePath = fileName;
  if (subpath && !relativeFilePath.startsWith(subpath)) {
    relativeFilePath = path.join(subpath, fileName).replace(/\\/g, "/");
  }

  // Prevención de path traversal
  if (
    moduleName.includes("..") ||
    relativeFilePath.includes("..") ||
    path.isAbsolute(relativeFilePath)
  ) {
    res.status(400).json({ error: "Ruta de archivo no válida." });
    return;
  }

  try {
    const basePath = await getGuidesBasePath();
    let targetPath: string;

    if (moduleName === "maestro") {
      if (
        relativeFilePath === "README.md" ||
        relativeFilePath === "README" ||
        relativeFilePath === "README_ROOT"
      ) {
        // Carga explícita y directa de la Única Fuente de Verdad: el README.md de la raíz del proyecto
        const rootPath = await getRootReadmePath();
        if (!rootPath) {
          res.status(404).json({ error: "Archivo README.md raíz no encontrado." });
          return;
        }
        targetPath = rootPath;
      } else if (
        relativeFilePath === "guides_index.md" ||
        relativeFilePath === "INDICE_GUIAS.md" ||
        relativeFilePath === "INDICE_GUIAS"
      ) {
        // Carga del índice de guías en guides/README.md
        targetPath = path.join(basePath, "README.md");
      } else {
        targetPath = path.join(basePath, relativeFilePath);
        try {
          await fs.stat(targetPath);
        } catch {
          try {
            targetPath = path.join(basePath, "modules", relativeFilePath);
            await fs.stat(targetPath);
          } catch {
            targetPath = path.resolve(basePath, "..", relativeFilePath);
          }
        }
      }
    } else if (!moduleName || moduleName === "general") {
      targetPath = path.join(basePath, "modules", relativeFilePath);
      try {
        await fs.stat(targetPath);
      } catch {
        targetPath = path.join(basePath, relativeFilePath);
      }
    } else {
      targetPath = path.join(basePath, "modules", moduleName, relativeFilePath);
    }

    const stat = await fs.stat(targetPath);
    const content = await fs.readFile(targetPath, "utf-8");

    // Calcular estadísticas de lectura
    const words = content.trim().split(/\s+/).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

    const isSubmodule = relativeFilePath.includes("submodules");
    const baseFileName = path.basename(relativeFilePath);

    res.json({
      success: true,
      module: moduleName,
      file: relativeFilePath,
      title: formatDocTitle(baseFileName, isSubmodule),
      content,
      isSubmodule,
      metadata: {
        sizeBytes: stat.size,
        lastModified: stat.mtime,
        wordsCount: words,
        readingTimeMinutes
      }
    });
  } catch (error: any) {
    console.error("Error al leer archivo de documentación:", error);
    res.status(404).json({ error: "Archivo de documentación no encontrado." });
  }
};

/**
 * GET /api/docs/search?q=...
 * Busca coincidencias en texto dentro de todos los archivos markdown de guides/modules y sus submódulos.
 */
/**
 * GET /api/docs/search?q=...&category=...&moduleId=...
 * Búsqueda jerárquica de alto rendimiento en memoria con scoring ponderado y categorización semántica.
 */
export const searchDocs = async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q || "").trim();
  const category = String(req.query.category || "").trim().toUpperCase();
  const moduleId = String(req.query.moduleId || "").trim();
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 40;

  if (!q || q.length < 2) {
    res.json({ success: true, query: q, totalMatches: 0, results: [] });
    return;
  }

  try {
    const { docsSearchEngine } = await import("../services/docsSearchEngine");
    const results = await docsSearchEngine.search(q, {
      category: category || undefined,
      moduleId: moduleId || undefined,
      limit
    });

    res.json({
      success: true,
      query: q,
      category: category || "ALL",
      totalMatches: results.length,
      results
    });
  } catch (error: any) {
    console.error("Error al buscar en documentación:", error);
    res.status(500).json({ error: "Error durante la búsqueda en documentación." });
  }
};
