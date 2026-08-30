import api from "./api";

export interface DocFile {
  id: string;
  fileName: string;
  title: string;
}

export interface DocModule {
  id: string;
  folderName: string;
  name: string;
  files: DocFile[];
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
  metadata: DocMetadata;
}

export interface DocSearchResult {
  module: string;
  moduleName: string;
  file: string;
  fileTitle: string;
  lineNumber: number;
  snippet: string;
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

  async search(query: string): Promise<DocSearchResult[]> {
    const res = await api.get<{ success: boolean; results: DocSearchResult[] }>("/docs/search", {
      params: { q: query }
    });
    return res.data.results || [];
  }
};
