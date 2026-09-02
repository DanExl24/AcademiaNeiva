import api from "./api";

export interface DocFile {
  id: string;
  fileName: string;
  relativePath?: string;
  title: string;
  isSubmodule?: boolean;
}

export interface DocModule {
  id: string;
  folderName: string;
  name: string;
  files: DocFile[];
  submodules?: DocFile[];
}

export interface DocMetadata {
  sizeBytes: number;
  lastModified: string;
  wordsCount: number;
  readingTimeMinutes: number;
}

export interface DocContentResponse {
  success: boolean;
  module: string;
  file: string;
  title: string;
  content: string;
  isSubmodule?: boolean;
  metadata: DocMetadata;
}

export type DocCategory = "RULE" | "HU" | "ENDPOINT" | "TABLE" | "GENERAL";

export interface DocHierarchy {
  l0: string; // Nombre del Módulo
  l1: string; // Título del Documento
  l2?: string; // Sección H2
  l3?: string; // Subsección H3
}

export interface DocSearchResult {
  id?: string;
  moduleId?: string;
  module?: string;
  moduleName: string;
  file: string;
  fileTitle: string;
  hierarchy?: DocHierarchy;
  heading?: string;
  anchor?: string;
  category?: DocCategory;
  snippet: string;
  highlightedSnippet?: string;
  score?: number;
  lineNumber?: number;
  isSubmodule?: boolean;
}

export const docsService = {
  async getModules(): Promise<DocModule[]> {
    const res = await api.get<{ success: boolean; modules: DocModule[] }>("/docs/modules");
    return res.data.modules || [];
  },

  async getContent(module: string, file: string): Promise<DocContentResponse> {
    const res = await api.get<DocContentResponse>("/docs/content", {
      params: { module, file }
    });
    return res.data;
  },

  async search(query: string, category?: string, moduleId?: string): Promise<DocSearchResult[]> {
    const res = await api.get<{ success: boolean; results: DocSearchResult[] }>("/docs/search", {
      params: { 
        q: query,
        category: category && category !== "ALL" ? category : undefined,
        moduleId: moduleId || undefined
      }
    });
    return res.data.results || [];
  }
};
