import fs from "fs/promises";
import path from "path";
import { getGuidesBasePath, getRootReadmePath } from "../controllers/docsController";

export type DocCategory = "RULE" | "HU" | "ENDPOINT" | "TABLE" | "GENERAL";

export interface DocHierarchy {
  l0: string; // Nombre del Módulo (ej. 06. Matrículas e Inscripciones)
  l1: string; // Título del Documento (ej. Tipos, Estados y Transiciones de Matrícula)
  l2?: string; // Sección H2 (ej. 2. Estados de la Matrícula)
  l3?: string; // Subsección H3 (ej. RN-MAT-002: Habilitación de Matrícula Extraordinaria)
}

export interface DocSearchChunk {
  id: string;
  moduleId: string;
  moduleName: string;
  file: string;
  fileTitle: string;
  hierarchy: DocHierarchy;
  heading: string;
  anchor: string;
  category: DocCategory;
  content: string;
  keywords: string[];
  isSubmodule: boolean;
}

export interface DocSearchResult {
  id: string;
  moduleId: string;
  moduleName: string;
  file: string;
  fileTitle: string;
  hierarchy: DocHierarchy;
  heading: string;
  anchor: string;
  category: DocCategory;
  snippet: string;
  highlightedSnippet: string;
  score: number;
}

export interface SearchOptions {
  category?: string;
  moduleId?: string;
  limit?: number;
}

/**
 * Genera un slug seguro para anclas HTML a partir de un título de encabezado.
 * Compatible con marked / github slugger.
 */
export const slugifyHeading = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
    .replace(/[^\w\s-]/g, "") // Remueve caracteres especiales
    .trim()
    .replace(/\s+/g, "-"); // Reemplaza espacios con guiones
};

/**
 * Detecta la categoría semántica principal de un bloque según su contenido y encabezado.
 */
const detectCategory = (heading: string, content: string): DocCategory => {
  const hUpper = heading.toUpperCase();
  const cUpper = content.toUpperCase();

  if (hUpper.includes("RN-") || hUpper.includes("REGLA") || cUpper.includes("RN-GLOBAL-") || cUpper.includes("RN-MAT-") || cUpper.includes("RN-EST-")) {
    return "RULE";
  }

  if (hUpper.includes("HU-") || hUpper.includes("HISTORIA") || cUpper.includes("HU-MAT-") || cUpper.includes("HU-SOP-") || cUpper.includes("COMO ")) {
    return "HU";
  }

  if (
    cUpper.includes("POST /API") || 
    cUpper.includes("GET /API") || 
    cUpper.includes("PUT /API") || 
    cUpper.includes("PATCH /API") || 
    cUpper.includes("DELETE /API") ||
    hUpper.includes("ENDPOINT") ||
    hUpper.includes("API")
  ) {
    return "ENDPOINT";
  }

  if (
    hUpper.includes("TABLA") || 
    hUpper.includes("DICCIONARIO") || 
    hUpper.includes("MODELO DE DATOS") || 
    cUpper.includes("SERIAL PK") || 
    cUpper.includes("FOREIGN KEY") || 
    cUpper.includes("CREATE TABLE")
  ) {
    return "TABLE";
  }

  return "GENERAL";
};

/**
 * Motor Singleton de Búsqueda Jerárquica e Indexación en Memoria
 */
class DocsSearchEngine {
  private chunks: DocSearchChunk[] = [];
  private lastIndexTime: number = 0;
  private isIndexing: boolean = false;
  private cacheTtlMs: number = 60 * 1000; // 1 minuto TTL para refrescar si hay cambios

  /**
   * Construye o refresca el índice en memoria si el TTL ha expirado
   */
  public async ensureIndex(): Promise<void> {
    const now = Date.now();
    if (this.chunks.length > 0 && now - this.lastIndexTime < this.cacheTtlMs) {
      return;
    }

    if (this.isIndexing) return;

    this.isIndexing = true;
    try {
      await this.buildIndex();
      this.lastIndexTime = Date.now();
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Parsea todos los archivos de guides/ y guides/modules/ en fragmentos jerárquicos
   */
  private async buildIndex(): Promise<void> {
    const basePath = await getGuidesBasePath();
    const modulesDir = path.join(basePath, "modules");
    const newChunks: DocSearchChunk[] = [];

    // 1. Indexar Documentos Rectores (README raíz, HISTORIAL, ESTIMACION, MAESTRO)
    const rootReadme = await getRootReadmePath();
    if (rootReadme) {
      await this.indexMarkdownFile(rootReadme, "maestro", "🏛️ 00. Documentos Rectores", "README.md", "Visión General del Proyecto (README)", false, newChunks);
    }

    const docFiles = [
      { name: "HISTORIAL_DE_VERSIONES.md", title: "Historial de Versiones y Changelog" },
      { name: "ESTIMACION_HORAS_TRABAJADAS.md", title: "Estimación de Horas y Auditoría Git" },
      { name: "MAESTRO_DE_INFORMACION.md", title: "Maestro de Información del Sistema" }
    ];

    for (const df of docFiles) {
      const p = path.join(basePath, df.name);
      try {
        await fs.stat(p);
        await this.indexMarkdownFile(p, "maestro", "🏛️ 00. Documentos Rectores", df.name, df.title, false, newChunks);
      } catch {}
    }

    // 2. Indexar Mapa General si existe
    const mapGeneralPath = path.join(modulesDir, "mapa_documentacion.md");
    try {
      await fs.stat(mapGeneralPath);
      await this.indexMarkdownFile(mapGeneralPath, "general", "🗺️ 00. Mapa General", "mapa_documentacion.md", "Mapa General de Documentación", false, newChunks);
    } catch {}

    // 3. Indexar todos los 21 módulos y submódulos
    try {
      const entries = await fs.readdir(modulesDir, { withFileTypes: true });
      const dirEntries = entries
        .filter((e) => e.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      for (const dir of dirEntries) {
        const modId = dir.name;
        const modName = this.formatModuleName(dir.name);
        const dirPath = path.join(modulesDir, dir.name);
        const dirContents = await fs.readdir(dirPath, { withFileTypes: true });

        // Archivos directos del módulo
        for (const f of dirContents.filter((e) => e.isFile() && e.name.endsWith(".md"))) {
          const filePath = path.join(dirPath, f.name);
          const fileTitle = this.formatDocTitle(f.name, false);
          await this.indexMarkdownFile(filePath, modId, modName, f.name, fileTitle, false, newChunks);
        }

        // Archivos en submodules/
        const subDir = dirContents.find((e) => e.isDirectory() && e.name === "submodules");
        if (subDir) {
          const subDirPath = path.join(dirPath, "submodules");
          try {
            const subFiles = await fs.readdir(subDirPath, { withFileTypes: true });
            for (const sf of subFiles.filter((e) => e.isFile() && e.name.endsWith(".md"))) {
              const sfPath = path.join(subDirPath, sf.name);
              const sfTitle = this.formatDocTitle(sf.name, true);
              await this.indexMarkdownFile(sfPath, modId, `${modName} (Submódulo)`, `submodules/${sf.name}`, sfTitle, true, newChunks);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error("[DocsSearchEngine] Error escaneando carpetas de módulos:", err);
    }

    this.chunks = newChunks;
  }

  /**
   * Descompone un archivo Markdown en secciones jerárquicas (H1, H2, H3, Párrafos)
   */
  private async indexMarkdownFile(
    filePath: string,
    moduleId: string,
    moduleName: string,
    fileName: string,
    fileTitle: string,
    isSubmodule: boolean,
    sink: DocSearchChunk[]
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split(/\r?\n/);

      let currentL1 = fileTitle;
      let currentL2 = "";
      let currentL3 = "";
      let currentHeading = fileTitle;
      let currentAnchor = "";
      let currentBuffer: string[] = [];

      const flushChunk = () => {
        const text = currentBuffer.join("\n").trim();
        if (text.length > 10 || currentHeading !== fileTitle) {
          const cat = detectCategory(currentHeading, text);
          const chunkId = `${moduleId}_${fileName}_${currentAnchor || "top"}_${sink.length}`;
          
          sink.push({
            id: chunkId,
            moduleId,
            moduleName,
            file: fileName,
            fileTitle,
            hierarchy: {
              l0: moduleName,
              l1: currentL1,
              ...(currentL2 ? { l2: currentL2 } : {}),
              ...(currentL3 ? { l3: currentL3 } : {})
            },
            heading: currentHeading,
            anchor: currentAnchor,
            category: cat,
            content: text,
            keywords: this.extractKeywords(currentHeading + " " + text),
            isSubmodule
          });
        }
        currentBuffer = [];
      };

      for (const line of lines) {
        const trimmed = line.trim();

        // Detecta H1: # Título
        if (trimmed.startsWith("# ")) {
          flushChunk();
          currentL1 = trimmed.replace(/^#\s+/, "").trim();
          currentL2 = "";
          currentL3 = "";
          currentHeading = currentL1;
          currentAnchor = slugifyHeading(currentL1);
          continue;
        }

        // Detecta H2: ## Sección
        if (trimmed.startsWith("## ")) {
          flushChunk();
          currentL2 = trimmed.replace(/^##\s+/, "").trim();
          currentL3 = "";
          currentHeading = currentL2;
          currentAnchor = slugifyHeading(currentL2);
          continue;
        }

        // Detecta H3: ### Subsección o Regla
        if (trimmed.startsWith("### ")) {
          flushChunk();
          currentL3 = trimmed.replace(/^###\s+/, "").trim();
          currentHeading = currentL3;
          currentAnchor = slugifyHeading(currentL3);
          continue;
        }

        // Detecta H4: #### Detalle
        if (trimmed.startsWith("#### ")) {
          flushChunk();
          const h4 = trimmed.replace(/^####\s+/, "").trim();
          currentHeading = h4;
          currentAnchor = slugifyHeading(h4);
          continue;
        }

        // Línea de contenido ordinario
        if (trimmed.length > 0) {
          currentBuffer.push(line);
        }
      }

      flushChunk();
    } catch (err) {
      // Ignora errores si el archivo no existe o no tiene permisos
    }
  }

  /**
   * Extrae palabras clave normalizadas para búsqueda rápida
   */
  private extractKeywords(text: string): string[] {
    return Array.from(
      new Set(
        text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s-]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 2)
      )
    );
  }

  /**
   * Ejecuta la búsqueda jerárquica con scoring ponderado
   */
  public async search(query: string, options: SearchOptions = {}): Promise<DocSearchResult[]> {
    await this.ensureIndex();

    const rawQ = query.trim();
    if (!rawQ || rawQ.length < 2) return [];

    const normQ = rawQ.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const terms = normQ.split(/\s+/).filter((t) => t.length >= 2);
    if (terms.length === 0) return [];

    const { category, moduleId, limit = 40 } = options;
    const scoredResults: DocSearchResult[] = [];

    for (const chunk of this.chunks) {
      // Filtros opcionales
      if (category && category !== "ALL" && chunk.category !== category) {
        continue;
      }
      if (moduleId && chunk.moduleId !== moduleId) {
        continue;
      }

      let score = 0;
      const headingNorm = chunk.heading.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const contentNorm = chunk.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const fileTitleNorm = chunk.fileTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const moduleNameNorm = chunk.moduleName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // 1. Coincidencia exacta de frase completa
      if (headingNorm.includes(normQ)) {
        score += 80;
      }
      if (contentNorm.includes(normQ)) {
        score += 30;
      }
      if (fileTitleNorm.includes(normQ)) {
        score += 50;
      }

      // 2. Coincidencia de términos individuales
      let matchedTermsCount = 0;
      for (const term of terms) {
        let termScore = 0;

        // Boost si es código de regla exacto (ej. RN-MAT-002, RN-GLOBAL-001)
        if (term.startsWith("rn-") || term.startsWith("hu-")) {
          if (headingNorm.includes(term)) termScore += 100;
          if (contentNorm.includes(term)) termScore += 50;
        }

        // Boost si es endpoint HTTP (ej. POST, GET, /api/...)
        if (term.startsWith("/api") || term === "post" || term === "get" || term === "patch" || term === "delete") {
          if (contentNorm.includes(term)) termScore += 40;
        }

        // Coincidencia en encabezados
        if (headingNorm.includes(term)) {
          termScore += 35;
          if (headingNorm.startsWith(term)) termScore += 15;
        }

        // Coincidencia en título del documento o módulo
        if (fileTitleNorm.includes(term)) termScore += 25;
        if (moduleNameNorm.includes(term)) termScore += 15;

        // Coincidencia en contenido
        if (contentNorm.includes(term)) {
          termScore += 10;
        }

        if (termScore > 0) {
          matchedTermsCount++;
          score += termScore;
        }
      }

      // Si no coincide con todos o la mayoría de los términos, descarta o reduce
      if (matchedTermsCount === 0) continue;
      if (terms.length > 1 && matchedTermsCount < terms.length) {
        score = Math.floor(score * (matchedTermsCount / terms.length) * 0.7);
      }

      // Boost según categoría especializada
      if (chunk.category === "RULE" && (normQ.includes("regla") || normQ.includes("rn-"))) score += 30;
      if (chunk.category === "HU" && (normQ.includes("historia") || normQ.includes("hu-"))) score += 30;
      if (chunk.category === "ENDPOINT" && (normQ.includes("api") || normQ.includes("endpoint"))) score += 30;
      if (chunk.category === "TABLE" && (normQ.includes("tabla") || normQ.includes("bd") || normQ.includes("sql"))) score += 30;

      if (score > 5) {
        const { snippet, highlightedSnippet } = this.generateSnippets(chunk.content, terms, rawQ);

        scoredResults.push({
          id: chunk.id,
          moduleId: chunk.moduleId,
          moduleName: chunk.moduleName,
          file: chunk.file,
          fileTitle: chunk.fileTitle,
          hierarchy: chunk.hierarchy,
          heading: chunk.heading,
          anchor: chunk.anchor,
          category: chunk.category,
          snippet,
          highlightedSnippet,
          score
        });
      }
    }

    // Ordenar de mayor a menor relevancia
    scoredResults.sort((a, b) => b.score - a.score);

    return scoredResults.slice(0, limit);
  }

  /**
   * Genera un fragmento (snippet) contextual con etiquetas <mark> en los términos coincidentes
   */
  private generateSnippets(content: string, terms: string[], fullQuery: string): { snippet: string; highlightedSnippet: string } {
    if (!content) {
      return { snippet: "", highlightedSnippet: "" };
    }

    // Normalizar saltos de línea y Markdown básico
    const clean = content
      .replace(/```[\s\S]*?```/g, " [Código] ")
      .replace(/\|.*?\|/g, " ")
      .replace(/[#*`_\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const cleanLower = clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Buscar la posición de la primera coincidencia
    let matchIdx = -1;
    const fullQNorm = fullQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    matchIdx = cleanLower.indexOf(fullQNorm);

    if (matchIdx === -1) {
      for (const t of terms) {
        const idx = cleanLower.indexOf(t);
        if (idx !== -1) {
          matchIdx = idx;
          break;
        }
      }
    }

    if (matchIdx === -1) {
      matchIdx = 0;
    }

    const windowSize = 160;
    const start = Math.max(0, matchIdx - 40);
    const end = Math.min(clean.length, start + windowSize);

    let snippet = clean.substring(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < clean.length) snippet = snippet + "...";

    // Generar resaltado con <mark>
    let highlightedSnippet = snippet;
    for (const t of terms) {
      try {
        const regex = new RegExp(`(${this.escapeRegExp(t)})`, "gi");
        highlightedSnippet = highlightedSnippet.replace(regex, `<mark class="bg-amber-400/30 text-amber-200 px-0.5 rounded font-bold">$1</mark>`);
      } catch {}
    }

    return { snippet, highlightedSnippet };
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private formatModuleName(dirName: string): string {
    const parts = dirName.split("_");
    const num = parts[0];
    const nameParts = parts.slice(1);
    const title = nameParts
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return `${num}. ${title}`;
  }

  private formatDocTitle(fileName: string, isSubmodule: boolean = false): string {
    const base = path.basename(fileName).replace(/\.md$/i, "");
    const titles: Record<string, string> = {
      matriculas: "Documentación Principal",
      estados_y_tipos_matricula: "Tipos, Estados y Transiciones de Matrícula",
      ESTADOS_Y_TIPOS_MATRICULA: "Tipos, Estados y Transiciones de Matrícula",
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
      README: "Visión General del Proyecto (README)",
      HISTORIAL_DE_VERSIONES: "Historial de Versiones y Changelog",
      ESTIMACION_HORAS_TRABAJADAS: "Estimación de Horas y Auditoría Git"
    };

    if (titles[base]) return titles[base];

    const formatted = base
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return isSubmodule ? `Submódulo: ${formatted}` : formatted;
  }
}

export const docsSearchEngine = new DocsSearchEngine();
