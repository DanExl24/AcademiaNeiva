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

// Formatea nombres de archivos como 'reglas_negocio.md' -> 'Reglas de Negocio'
const formatDocTitle = (fileName: string): string => {
  const base = fileName.replace(/\.md$/i, "");
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
    mapa_documentacion: "Mapa General de Documentación"
  };

  if (titles[base]) return titles[base];

  return base
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

/**
 * GET /api/docs/modules
 * Lista todos los módulos disponibles en guides/modules con sus archivos markdown.
 */
export const getDocsModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const basePath = await getGuidesBasePath();
    const modulesDir = path.join(basePath, "modules");

    const entries = await fs.readdir(modulesDir, { withFileTypes: true });

    const modules = [];

    // Si existe mapa_documentacion.md en la raíz de modules
    const hasMap = entries.some((e) => e.isFile() && e.name === "mapa_documentacion.md");
    if (hasMap) {
      modules.push({
        id: "general",
        folderName: "",
        name: "00. Visión General",
        files: [
          {
            id: "mapa_documentacion",
            fileName: "mapa_documentacion.md",
            title: "Mapa General de Documentación"
          }
        ]
      });
    }

    const dirEntries = entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    for (const dir of dirEntries) {
      const dirPath = path.join(modulesDir, dir.name);
      const filesInDir = await fs.readdir(dirPath);
      const mdFiles = filesInDir
        .filter((f) => f.endsWith(".md"))
        .sort((a, b) => {
          // Orden estándar: principal, reglas, casos, historias
          const order = ["matriculas.md", "reglas_negocio.md", "casos_uso.md", "historias_usuario.md"];
          const idxA = order.indexOf(a);
          const idxB = order.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        })
        .map((f) => ({
          id: f.replace(/\.md$/i, ""),
          fileName: f,
          title: formatDocTitle(f)
        }));

      modules.push({
        id: dir.name,
        folderName: dir.name,
        name: formatModuleName(dir.name),
        files: mdFiles
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
 * Obtiene el contenido de un archivo markdown específico de guides/modules.
 * Query params:
 *  - module: nombre de la carpeta (ej. '06_matriculas' o vacío si es archivo raíz de modules)
 *  - file: nombre del archivo (ej. 'matriculas.md' o 'reglas_negocio.md')
 */
export const getDocContent = async (req: Request, res: Response): Promise<void> => {
  const moduleName = String(req.query.module || "").trim();
  const fileName = String(req.query.file || "").trim();

  if (!fileName) {
    res.status(400).json({ error: "Debe especificar el parámetro 'file'." });
    return;
  }

  // Prevención de path traversal
  if (moduleName.includes("..") || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    res.status(400).json({ error: "Ruta de archivo no válida." });
    return;
  }

  try {
    const basePath = await getGuidesBasePath();
    const targetPath = moduleName && moduleName !== "general"
      ? path.join(basePath, "modules", moduleName, fileName)
      : path.join(basePath, "modules", fileName);

    const stat = await fs.stat(targetPath);
    const content = await fs.readFile(targetPath, "utf-8");

    // Calcular estadísticas de lectura
    const words = content.trim().split(/\s+/).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

    res.json({
      success: true,
      module: moduleName,
      file: fileName,
      title: formatDocTitle(fileName),
      content,
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
 * Busca coincidencias en texto dentro de todos los archivos markdown de guides/modules.
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
    const scanFile = async (filePath: string, modId: string, modName: string, fName: string) => {
      try {
        const text = await fs.readFile(filePath, "utf-8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.toLowerCase().includes(q)) {
            // Obtener contexto de líneas
            const snippet = line.trim();
            results.push({
              module: modId,
              moduleName: modName,
              file: fName,
              fileTitle: formatDocTitle(fName),
              lineNumber: i + 1,
              snippet: snippet.length > 200 ? snippet.substring(0, 200) + "..." : snippet
            });
            if (results.length >= 30) break;
          }
        }
      } catch {
        // Ignorar archivo si no se puede leer
      }
    };

    // Escanear archivo raíz mapa_documentacion si existe
    const mapPath = path.join(modulesDir, "mapa_documentacion.md");
    try {
      await scanFile(mapPath, "general", "00. Visión General", "mapa_documentacion.md");
    } catch {}

    // Escanear cada módulo
    for (const dir of entries.filter((e) => e.isDirectory())) {
      if (results.length >= 30) break;
      const dirPath = path.join(modulesDir, dir.name);
      const files = await fs.readdir(dirPath);
      for (const f of files.filter((file) => file.endsWith(".md"))) {
        if (results.length >= 30) break;
        const fPath = path.join(dirPath, f);
        await scanFile(fPath, dir.name, formatModuleName(dir.name), f);
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
