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
    gestion_jornadas: "Submódulo: Gestión de Jornadas",
    maestro_de_informacion: "Maestro de Información del Sistema",
    MAESTRO_DE_INFORMACION: "Maestro de Información del Sistema",
    ARQUITECTURA_PORTAL_DOCUMENTACION: "Arquitectura del Portal de Documentación Web",
    arquitectura_portal_documentacion: "Arquitectura del Portal de Documentación Web"
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

    // 0. Documentos Rectores (README, MAESTRO_DE_INFORMACION.md, ARQUITECTURA_PORTAL_DOCUMENTACION.md)
    const masterFiles = [];

    // README General del Proyecto
    let hasReadme = false;
    let readmePath = "README.md";
    try {
      await fs.stat(path.resolve(basePath, "../README.md"));
      hasReadme = true;
    } catch {
      try {
        await fs.stat(path.join(basePath, "README.md"));
        hasReadme = true;
      } catch {}
    }

    if (hasReadme) {
      masterFiles.push({
        id: "README",
        fileName: "README.md",
        relativePath: "README.md",
        title: "Visión General del Proyecto (README)",
        isSubmodule: false
      });
    }

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

    try {
      await fs.stat(path.join(basePath, "ARQUITECTURA_PORTAL_DOCUMENTACION.md"));
      masterFiles.push({
        id: "ARQUITECTURA_PORTAL_DOCUMENTACION",
        fileName: "ARQUITECTURA_PORTAL_DOCUMENTACION.md",
        relativePath: "ARQUITECTURA_PORTAL_DOCUMENTACION.md",
        title: "Arquitectura del Portal de Documentación Web",
        isSubmodule: false
      });
    } catch {}

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
          const order = ["matriculas.md", "reglas_negocio.md", "casos_uso.md", "historias_usuario.md"];
          const idxA = order.indexOf(a.name);
          const idxB = order.indexOf(b.name);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((f) => ({
          id: f.name.replace(/\.md$/i, ""),
          fileName: f.name,
          relativePath: f.name,
          title: formatDocTitle(f.name, false),
          isSubmodule: false
        }));

      // 2. Submódulos si existe carpeta 'submodules'
      let submodules: any[] = [];
      const hasSubmodulesDir = dirContents.some((e) => e.isDirectory() && e.name === "submodules");
      if (hasSubmodulesDir) {
        const submodulesDirPath = path.join(dirPath, "submodules");
        try {
          const subEntries = await fs.readdir(submodulesDirPath, { withFileTypes: true });
          submodules = subEntries
            .filter((e) => e.isFile() && e.name.endsWith(".md"))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => ({
              id: `submodule_${f.name.replace(/\.md$/i, "")}`,
              fileName: f.name,
              relativePath: `submodules/${f.name}`,
              title: formatDocTitle(f.name, true),
              isSubmodule: true
            }));
        } catch {
          // Ignorar error de lectura en subcarpeta
        }
      }

      modules.push({
        id: dir.name,
        folderName: dir.name,
        name: formatModuleName(dir.name),
        files: mdFiles,
        submodules
      });
    }

    res.json({
      success: true,
      totalModules: modules.length,
      modules
    });
  } catch (error: any) {
    console.error("Error al obtener lista de módulos de documentación:", error);
    res.status(500).json({ error: "No se pudo leer la estructura de documentación.", details: error.message });
  }
};

/**
 * GET /api/docs/content
 * Obtiene el contenido de un archivo markdown específico de guides/modules (incluyendo submódulos).
 * Query params:
 *  - module: nombre de la carpeta (ej. '04_estructura_escolar' o vacío si es archivo raíz de modules)
 *  - file: ruta relativa del archivo (ej. 'estructura_escolar.md' o 'submodules/gestion_jornadas.md')
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
export const searchDocs = async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q || q.length < 2) {
    res.json({ success: true, results: [] });
    return;
  }

  try {
    const basePath = await getGuidesBasePath();
    const modulesDir = path.join(basePath, "modules");

    const entries = await fs.readdir(modulesDir, { withFileTypes: true });
    const results: any[] = [];

    // Función auxiliar para escanear un archivo
    const scanFile = async (
      filePath: string, 
      modId: string, 
      modName: string, 
      fRelPath: string, 
      isSubmodule: boolean = false
    ) => {
      try {
        const text = await fs.readFile(filePath, "utf-8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.toLowerCase().includes(q)) {
            const snippet = line.trim();
            results.push({
              module: modId,
              moduleName: modName,
              file: fRelPath,
              fileTitle: formatDocTitle(path.basename(fRelPath), isSubmodule),
              isSubmodule,
              lineNumber: i + 1,
              snippet: snippet.length > 200 ? snippet.substring(0, 200) + "..." : snippet
            });
            if (results.length >= 40) break;
          }
        }
      } catch {
        // Ignorar archivo si no se puede leer
      }
    };

    // Escanear README general del proyecto si existe
    const rootReadmePath = path.resolve(basePath, "../README.md");
    try {
      await scanFile(rootReadmePath, "maestro", "🏛️ 00. Documentos Rectores", "README.md", false);
    } catch {
      try {
        await scanFile(path.join(basePath, "README.md"), "maestro", "🏛️ 00. Documentos Rectores", "README.md", false);
      } catch {}
    }

    // Escanear archivo maestro de información si existe
    const masterPath = path.join(basePath, "MAESTRO_DE_INFORMACION.md");
    try {
      await scanFile(masterPath, "maestro", "🏛️ 00. Documentos Rectores", "MAESTRO_DE_INFORMACION.md", false);
    } catch {
      try {
        await scanFile(path.join(modulesDir, "MAESTRO_DE_INFORMACION.md"), "maestro", "🏛️ 00. Documentos Rectores", "MAESTRO_DE_INFORMACION.md", false);
      } catch {}
    }

    // Escanear archivo de arquitectura del portal si existe
    const archPath = path.join(basePath, "ARQUITECTURA_PORTAL_DOCUMENTACION.md");
    try {
      await scanFile(archPath, "maestro", "🏛️ 00. Documentos Rectores", "ARQUITECTURA_PORTAL_DOCUMENTACION.md", false);
    } catch {}

    // Escanear archivo raíz mapa_documentacion si existe
    const mapPath = path.join(modulesDir, "mapa_documentacion.md");
    try {
      await scanFile(mapPath, "general", "🗺️ 00. Mapa General", "mapa_documentacion.md", false);
    } catch {}

    // Escanear cada módulo y sus submódulos
    for (const dir of entries.filter((e) => e.isDirectory())) {
      if (results.length >= 40) break;
      const dirPath = path.join(modulesDir, dir.name);
      const dirContents = await fs.readdir(dirPath, { withFileTypes: true });

      // 1. Archivos directos del módulo
      for (const f of dirContents.filter((e) => e.isFile() && e.name.endsWith(".md"))) {
        if (results.length >= 40) break;
        const fPath = path.join(dirPath, f.name);
        await scanFile(fPath, dir.name, formatModuleName(dir.name), f.name, false);
      }

      // 2. Archivos en carpeta 'submodules'
      const subDir = dirContents.find((e) => e.isDirectory() && e.name === "submodules");
      if (subDir) {
        const subDirPath = path.join(dirPath, "submodules");
        try {
          const subFiles = await fs.readdir(subDirPath, { withFileTypes: true });
          for (const sf of subFiles.filter((e) => e.isFile() && e.name.endsWith(".md"))) {
            if (results.length >= 40) break;
            const sfPath = path.join(subDirPath, sf.name);
            await scanFile(
              sfPath, 
              dir.name, 
              `${formatModuleName(dir.name)}`, 
              `submodules/${sf.name}`, 
              true
            );
          }
        } catch {}
      }
    }

    res.json({
      success: true,
      query: q,
      totalMatches: results.length,
      results
    });
  } catch (error: any) {
    console.error("Error al buscar en documentación:", error);
    res.status(500).json({ error: "Error durante la búsqueda en documentación." });
  }
};
