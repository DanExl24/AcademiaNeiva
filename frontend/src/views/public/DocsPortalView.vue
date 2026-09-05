<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  BookOpen, 
  Search, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  FileCheck, 
  Calendar, 
  Copy, 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  Layers, 
  ExternalLink,
  Menu,
  X,
  FolderOpen,
  Brain,
  BarChart3,
  Database,
  ShieldCheck,
  Sparkles,
  Workflow,
  Tag,
  Users,
  GraduationCap,
  Building2,
  Lock,
  Landmark,
  Sliders,
  RefreshCw,
  FileSignature,
  CalendarCheck,
  ShieldAlert,
  LifeBuoy,
  HeartHandshake,
  ArrowLeftRight,
  Eye,
  MailCheck,
  Network,
  Zap,
  Award,
  Trash2,
  History
} from 'lucide-vue-next'
import { marked } from 'marked'
import mermaid from 'mermaid'
import { docsService, type DocModule, type DocSearchResult } from '../../services/docsService'
import { MODULES_METADATA, SYSTEM_METRICS, type ModuleSummary } from '../../services/docsMetadata'
import DocsRelationshipGraph from '../../components/docs/DocsRelationshipGraph.vue'

// Configuración de Mermaid con tema oscuro integrado
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  themeVariables: {
    darkMode: true,
    background: '#020617',
    mainBkg: '#0f172a',
    primaryColor: '#4338ca',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#6366f1',
    lineColor: '#818cf8',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    nodeBorder: '#6366f1',
    clusterBkg: '#0b0f19',
    clusterBorder: '#334155',
    titleColor: '#f8fafc',
    edgeLabelBackground: '#020617',
    actorBorder: '#6366f1',
    actorBkg: '#1e1b4b',
    actorTextColor: '#e0e7ff',
    signalColor: '#818cf8',
    signalTextColor: '#f8fafc'
  }
})

const route = useRoute()
const router = useRouter()

// Estado principal
const loadingModules = ref(true)
const loadingContent = ref(false)
const modules = ref<DocModule[]>([])
const selectedModuleId = ref<string>('')
const selectedFileName = ref<string>('')
const docTitle = ref('')
const rawMarkdown = ref('')
const renderedHtml = ref('')
const metadata = ref<{
  sizeBytes: number
  lastModified: string
  wordsCount: number
  readingTimeMinutes: number
} | null>(null)

// Pestaña de modo de vista: 'reading' (Lectura Completa), 'summary' (Ficha Ejecutiva), 'graph' (Grafo Interactivo), 'metrics' (Dashboard Global)
const activeViewTab = ref<'reading' | 'summary' | 'graph' | 'metrics'>('reading')

// Filtro en sidebar
const sidebarFilter = ref('')
const openFolders = ref<Record<string, boolean>>({})

// Table of contents (Headings)
interface TocItem {
  id: string
  text: string
  level: number
}
const tableOfContents = ref<TocItem[]>([])

// Búsqueda global modal y filtros facetados
const searchModalOpen = ref(false)
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<DocSearchResult[]>([])

// Responsive mobile menu
const mobileSidebarOpen = ref(false)
const copiedLink = ref(false)

// Obtener metadata ejecutiva del módulo seleccionado
const currentModuleMeta = computed<ModuleSummary | null>(() => {
  return MODULES_METADATA[selectedModuleId.value] || null
})

// Mapeo de iconos dinámicos para la ficha ejecutiva
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    Landmark,
    Lock,
    Building: Building2,
    Users,
    Network,
    GraduationCap,
    ClipboardList: FileText,
    UserCheck: Users,
    Sliders,
    RefreshCw,
    BookOpen,
    BarChart3,
    FileSignature,
    CalendarCheck,
    FileText,
    ShieldAlert,
    LifeBuoy,
    HeartHandshake,
    ArrowLeftRight,
    Award,
    Eye,
    MailCheck
  }
  return iconMap[iconName] || BookOpen
}

// Renderiza de forma asíncrona todos los contenedores de diagramas Mermaid
const renderMermaidDiagrams = async () => {
  await nextTick()
  const elements = document.querySelectorAll('.mermaid-diagram:not([data-processed="true"])')
  if (elements.length === 0) return

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement
    const encoded = el.getAttribute('data-code')
    const rawCode = encoded ? decodeURIComponent(encoded) : (el.textContent || '')
    if (!rawCode.trim()) continue

    try {
      const uniqueId = `mermaid-svg-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`
      const { svg } = await mermaid.render(uniqueId, rawCode)
      el.innerHTML = `<div class="w-full overflow-x-auto flex justify-center py-2 docs-scrollbar">${svg}</div>`
      el.setAttribute('data-processed', 'true')
    } catch (err) {
      console.error('Error renderizando diagrama Mermaid:', err)
      el.innerHTML = `
        <div class="w-full space-y-2">
          <div class="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between">
            <span>⚠️ Diagrama de Flujo (Vista de Código)</span>
          </div>
          <pre class="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto">${rawCode}</pre>
        </div>
      `
      el.setAttribute('data-processed', 'true')
    }
  }
}

// Procesa markdown a HTML enriquecido con soporte para Mermaid, GitHub Alerts, tablas con scroll y badges HTTP
const processMarkdownToHtml = (markdown: string): string => {
  // 0. Pre-procesar bloques Mermaid
  const preprocessedMermaid = markdown.replace(
    /```mermaid\s*([\s\S]*?)```/gi,
    (_match, code) => {
      const cleanCode = code.trim()
      const encoded = encodeURIComponent(cleanCode)
      return `\n<div class="mermaid-diagram my-8 p-6 rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl overflow-x-auto flex flex-col items-center justify-center docs-scrollbar" data-code="${encoded}"><div class="flex items-center gap-2 text-xs font-bold text-indigo-400 py-6"><div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><span>Generando diagrama interactivo...</span></div></div>\n`
    }
  )

  // 1. Pre-procesar GitHub alerts
  const processedMd = preprocessedMermaid.replace(
    />\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)(?=\n\n|\n[^\s>]|$)/gi,
    (_match, type, content) => {
      const t = type.toUpperCase()
      const cleanText = content.replace(/^>\s*/gm, '').trim()
      const alertConfigs: Record<string, { bg: string; border: string; text: string; title: string; icon: string }> = {
        NOTE: { bg: 'bg-blue-50/90 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-800', text: 'text-blue-900 dark:text-blue-200', title: 'Nota', icon: 'ℹ️' },
        TIP: { bg: 'bg-emerald-50/90 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-800', text: 'text-emerald-900 dark:text-emerald-200', title: 'Consejo', icon: '💡' },
        IMPORTANT: { bg: 'bg-indigo-50/90 dark:bg-indigo-950/40', border: 'border-indigo-300 dark:border-indigo-800', text: 'text-indigo-900 dark:text-indigo-200', title: 'Importante', icon: '📌' },
        WARNING: { bg: 'bg-amber-50/90 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-800', text: 'text-amber-900 dark:text-amber-200', title: 'Advertencia', icon: '⚠️' },
        CAUTION: { bg: 'bg-rose-50/90 dark:bg-rose-950/40', border: 'border-rose-300 dark:border-rose-800', text: 'text-rose-900 dark:text-rose-200', title: 'Precaución', icon: '🛑' }
      }
      const cfg = alertConfigs[t] || alertConfigs.NOTE
      return `\n<div class="my-6 p-4 rounded-2xl border ${cfg.border} ${cfg.bg} ${cfg.text} text-xs shadow-xs"><div class="flex items-center gap-2 font-black text-xs uppercase tracking-wider mb-1"><span>${cfg.icon}</span><span>${cfg.title}</span></div><div class="leading-relaxed opacity-95">${cleanText}</div></div>\n`
    }
  )

  let html = marked.parse(processedMd, { gfm: true, breaks: true }) as string

  // 2. Asignar IDs a los encabezados para navegación suave
  html = html.replace(/<h([2-3])>(.*?)<\/h\1>/gi, (_match, level, title) => {
    const plainText = title.replace(/<[^>]+>/g, '').trim()
    const id = plainText
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
    return `<h${level} id="${id}" class="scroll-mt-24 font-black">${title}</h${level}>`
  })

  // 3. Envolver tablas en un contenedor con scroll horizontal estricto (overflow-x-auto)
  html = html.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    return `<div class="docs-table-wrapper overflow-x-auto w-full max-w-full my-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900/60">${tableHtml}</div>`
  })

  // 4. Badges para métodos HTTP comunes en tablas
  html = html.replace(/<code>(GET|POST|PUT|PATCH|DELETE)<\/code>/g, (_match, verb) => {
    const v = verb.toUpperCase()
    const colorClasses: Record<string, string> = {
      GET: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      POST: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      PUT: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      PATCH: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      DELETE: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
    }
    const c = colorClasses[v] || 'bg-slate-500/15 text-slate-400 border-slate-500/30'
    return `<span class="inline-block font-mono text-[11px] font-black px-2 py-0.5 rounded-lg border ${c}">${v}</span>`
  })

  return html
}

// Extraer tabla de contenidos H2 y H3
const extractToc = (markdown: string) => {
  const lines = markdown.split('\n')
  const toc: TocItem[] = []
  
  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/)
    const h3Match = line.match(/^###\s+(.+)$/)
    
    if (h2Match) {
      const text = h2Match[1].replace(/<[^>]+>/g, '').trim()
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      toc.push({ id, text, level: 2 })
    } else if (h3Match) {
      const text = h3Match[1].replace(/<[^>]+>/g, '').trim()
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      toc.push({ id, text, level: 3 })
    }
  }
  tableOfContents.value = toc
}

// Filtrar módulos en sidebar
const filteredModules = computed(() => {
  if (!sidebarFilter.value.trim()) return modules.value
  const q = sidebarFilter.value.toLowerCase()
  return modules.value
    .map(m => {
      const matchName = m.name.toLowerCase().includes(q)
      const matchingFiles = m.files.filter(f => f.title.toLowerCase().includes(q) || f.fileName.toLowerCase().includes(q))
      const matchingSubmodules = (m.submodules || []).filter(sf => sf.title.toLowerCase().includes(q) || sf.fileName.toLowerCase().includes(q))
      if (matchName || matchingFiles.length > 0 || matchingSubmodules.length > 0) {
        return {
          ...m,
          files: matchName ? m.files : matchingFiles,
          submodules: matchName ? (m.submodules || []) : matchingSubmodules
        }
      }
      return null
    })
    .filter(Boolean) as DocModule[]
})

// Cargar estructura de módulos
const fetchModules = async () => {
  loadingModules.value = true
  try {
    const data = await docsService.getModules()
    modules.value = data
    
    // Auto-abrir carpetas
    data.forEach(m => {
      openFolders.value[m.id] = true
    })

    // Resolver módulo inicial desde ruta
    resolveRoute()
  } catch (error) {
    console.error('Error cargando módulos de documentación:', error)
  } finally {
    loadingModules.value = false
  }
}

// Cargar contenido de un documento específico
const loadDocument = async (moduleId: string, filePath: string, targetAnchor?: string) => {
  loadingContent.value = true
  try {
    const res = await docsService.getContent(moduleId, filePath)
    selectedModuleId.value = moduleId
    selectedFileName.value = res.file || filePath
    docTitle.value = res.title
    rawMarkdown.value = res.content
    metadata.value = res.metadata

    // Renderizar Markdown y TOC
    extractToc(res.content)
    renderedHtml.value = processMarkdownToHtml(res.content)
    renderMermaidDiagrams()

    // Actualizar URL sin reload
    const cleanPath = (res.file || filePath).startsWith('submodules/')
      ? `/docs/${moduleId}/${res.file || filePath}`
      : `/docs/${moduleId}/${res.file || filePath}`

    router.replace({
      path: cleanPath
    })

    // Asegurar vista de lectura activa
    activeViewTab.value = 'reading'

    // Scroll al ancla específica o al tope
    if (targetAnchor) {
      nextTick(() => {
        setTimeout(() => {
          const cleanAnchor = targetAnchor.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
          const el = document.getElementById(targetAnchor) 
            || document.getElementById(cleanAnchor) 
            || document.querySelector(`[id*="${cleanAnchor}"]`)
            || document.querySelector(`h1, h2, h3, h4`)
          
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            el.classList.add('doc-pulse-highlight')
            setTimeout(() => {
              el.classList.remove('doc-pulse-highlight')
            }, 3000)
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }, 200)
      })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (error) {
    console.error('Error cargando contenido del documento:', error)
    renderedHtml.value = '<div class="p-8 text-center text-slate-500 font-bold">No se pudo cargar el documento solicitado.</div>'
  } finally {
    loadingContent.value = false
    mobileSidebarOpen.value = false
  }
}

// Interceptar clics en enlaces internos de los documentos markdown
const handleArticleClick = (e: MouseEvent) => {
  const target = (e.target as HTMLElement).closest('a')
  if (!target) return
  const href = target.getAttribute('href')
  if (!href) return

  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    target.setAttribute('target', '_blank')
    target.setAttribute('rel', 'noopener noreferrer')
    return
  }

  if (href.startsWith('#')) {
    return
  }

  if (href.endsWith('.md') || href.includes('.md#')) {
    e.preventDefault()
    const [fileWithRelativePath, hash] = href.split('#')
    
    // Si apunta a otro módulo con ../
    if (fileWithRelativePath.startsWith('../')) {
      const parts = fileWithRelativePath.replace(/^\.\.\//, '').split('/')
      if (parts.length >= 2) {
        const targetModule = parts[0]
        const targetFile = parts.slice(1).join('/')
        loadDocument(targetModule, targetFile)
      }
    } else {
      loadDocument(selectedModuleId.value, fileWithRelativePath)
    }

    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }
}

// Navegación directa a otro módulo desde la Ficha Ejecutiva o Contenido Relacionado
const navigateToModule = (modId: string) => {
  const targetMod = modules.value.find(m => m.id === modId)
  if (targetMod && targetMod.files.length > 0) {
    loadDocument(targetMod.id, targetMod.files[0].relativePath || targetMod.files[0].fileName)
    activeViewTab.value = 'reading'
  }
}

// Resolver parámetros de ruta
const resolveRoute = () => {
  const modParam = route.params.module as string
  const fileParam = route.params.file as string
  const subfolderParam = (route.params.subfolder || route.params.submodules) as string

  if (modParam && fileParam) {
    let fullFileName = fileParam
    if (subfolderParam === 'submodules' || route.path.includes('/submodules/')) {
      if (!fullFileName.startsWith('submodules/')) {
        fullFileName = `submodules/${fullFileName}`
      }
    }
    loadDocument(modParam, fullFileName)
    return
  }

  // Por defecto abrir Maestro de Información (Documento Rector) o el primer módulo disponible
  const defaultMod = modules.value.find(m => m.id === 'maestro') 
    || modules.value.find(m => m.id === 'general') 
    || modules.value.find(m => m.id === '06_matriculas') 
    || modules.value[0]
    
  if (defaultMod && defaultMod.files.length > 0) {
    loadDocument(defaultMod.id, defaultMod.files[0].relativePath || defaultMod.files[0].fileName)
  }
}

// Alternar carpeta en sidebar
const toggleFolder = (folderId: string) => {
  openFolders.value[folderId] = !openFolders.value[folderId]
}

// Navegación Anterior / Siguiente
const currentNavigation = computed(() => {
  const flatFiles: { moduleId: string; moduleName: string; file: any }[] = []
  modules.value.forEach(m => {
    m.files.forEach(f => {
      flatFiles.push({ moduleId: m.id, moduleName: m.name, file: f })
    })
    if (m.submodules && m.submodules.length > 0) {
      m.submodules.forEach(sf => {
        flatFiles.push({ moduleId: m.id, moduleName: `${m.name} (Submódulo)`, file: sf })
      })
    }
  })

  const currentIndex = flatFiles.findIndex(
    item => item.moduleId === selectedModuleId.value && (
      (item.file.relativePath && item.file.relativePath === selectedFileName.value) || 
      item.file.fileName === selectedFileName.value
    )
  )

  return {
    prev: currentIndex > 0 ? flatFiles[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < flatFiles.length - 1 ? flatFiles[currentIndex + 1] : null
  }
})

// Búsqueda inteligente de alto rendimiento en tiempo real
const selectedResultIndex = ref(0)
const searchCategory = ref<string>('ALL')
const recentSearches = ref<string[]>(JSON.parse(localStorage.getItem('docs_recent_searches') || '[]'))

let searchTimeout: any = null
watch([searchQuery, searchCategory], ([newQ, newCat]) => {
  clearTimeout(searchTimeout)
  selectedResultIndex.value = 0
  if (!newQ.trim() || newQ.length < 2) {
    searchResults.value = []
    return
  }
  searching.value = true
  searchTimeout = setTimeout(async () => {
    try {
      searchResults.value = await docsService.search(newQ, newCat)
    } catch (e) {
      console.error('Error en búsqueda de docs:', e)
    } finally {
      searching.value = false
    }
  }, 150)
})

// Resultados ordenados y filtrados
const filteredSearchResults = computed(() => {
  return searchResults.value
})

const addRecentSearch = (term: string) => {
  if (!term || term.trim().length < 2) return
  const clean = term.trim()
  const list = [clean, ...recentSearches.value.filter(s => s.toLowerCase() !== clean.toLowerCase())].slice(0, 6)
  recentSearches.value = list
  localStorage.setItem('docs_recent_searches', JSON.stringify(list))
}

const clearRecentSearches = () => {
  recentSearches.value = []
  localStorage.removeItem('docs_recent_searches')
}

const selectRecentSearch = (term: string) => {
  searchQuery.value = term
}

const handleArrowDown = () => {
  if (filteredSearchResults.value.length === 0) return
  selectedResultIndex.value = (selectedResultIndex.value + 1) % filteredSearchResults.value.length
}

const handleArrowUp = () => {
  if (filteredSearchResults.value.length === 0) return
  selectedResultIndex.value = (selectedResultIndex.value - 1 + filteredSearchResults.value.length) % filteredSearchResults.value.length
}

const handleEnter = () => {
  if (filteredSearchResults.value.length > 0) {
    const item = filteredSearchResults.value[selectedResultIndex.value] || filteredSearchResults.value[0]
    selectSearchResult(item)
  }
}

const handleTabKey = (e: KeyboardEvent) => {
  e.preventDefault()
  const cats = ['ALL', 'RULE', 'ENDPOINT', 'TABLE', 'HU']
  const nextIdx = (cats.indexOf(searchCategory.value) + 1) % cats.length
  searchCategory.value = cats[nextIdx]
}

const openSearchModal = () => {
  searchModalOpen.value = true
  searchQuery.value = ''
  searchResults.value = []
  selectedResultIndex.value = 0
  searchCategory.value = 'ALL'
}

const closeSearchModal = () => {
  searchModalOpen.value = false
}

const selectSearchResult = (item: DocSearchResult) => {
  if (!item) return
  const term = item.heading || item.fileTitle || searchQuery.value
  if (term) addRecentSearch(term)
  
  const modId = item.moduleId || item.module || selectedModuleId.value
  loadDocument(modId, item.file, item.anchor)
  closeSearchModal()
}

// Copiar enlace directo
const copyCurrentUrl = () => {
  navigator.clipboard.writeText(window.location.href)
  copiedLink.value = true
  setTimeout(() => {
    copiedLink.value = false
  }, 2000)
}

// Manejar atajos de teclado (Ctrl + K)
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchModalOpen.value = !searchModalOpen.value
  }
  if (e.key === 'Escape' && searchModalOpen.value) {
    closeSearchModal()
  }
}

// Re-renderizar diagramas si el usuario regresa a la pestaña de lectura
watch(activeViewTab, (newTab) => {
  if (newTab === 'reading') {
    renderMermaidDiagrams()
  }
})

onMounted(() => {
  fetchModules()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
    
    <!-- Top Navbar -->
    <header class="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-900/90 border-b border-slate-800 transition-colors">
      <div class="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        <!-- Logo y Branding -->
        <div class="flex items-center gap-3">
          <button 
            @click="mobileSidebarOpen = !mobileSidebarOpen" 
            class="md:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <Menu v-if="!mobileSidebarOpen" :size="20" />
            <X v-else :size="20" />
          </button>

          <router-link to="/docs" class="flex items-center gap-2.5 group">
            <div class="p-2 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-xl shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <BookOpen :size="20" />
            </div>
            <div>
              <span class="font-black text-lg tracking-tight text-white">Academia<span class="text-indigo-400">Neiva</span></span>
              <span class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">Docs v2.5</span>
            </div>
          </router-link>
        </div>

        <!-- Search Bar Header (Trigger Modal) -->
        <div class="flex-1 max-w-md hidden sm:block">
          <button 
            @click="openSearchModal" 
            class="w-full px-4 py-2 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-slate-400 text-xs font-medium flex items-center justify-between transition-all cursor-pointer shadow-inner"
          >
            <span class="flex items-center gap-2">
              <Search :size="15" class="text-slate-400" />
              <span>Buscar en el Maestro de Información, 21 módulos y guías...</span>
            </span>
            <kbd class="px-2 py-0.5 text-[10px] font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-400">Ctrl K</kbd>
          </button>
        </div>

        <!-- Navigation Links -->
        <div class="flex items-center gap-3">
          <button 
            @click="openSearchModal" 
            class="sm:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800 cursor-pointer"
            title="Buscar"
          >
            <Search :size="18" />
          </button>

          <button
            @click="activeViewTab = 'graph'"
            class="text-xs font-bold text-slate-300 hover:text-indigo-400 px-3 py-1.5 rounded-xl transition-colors hidden lg:flex items-center gap-1.5 cursor-pointer bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800"
          >
            <Network :size="14" class="text-indigo-400" />
            <span>Grafo de Relaciones</span>
          </button>

          <button
            @click="activeViewTab = 'metrics'"
            class="text-xs font-bold text-slate-300 hover:text-indigo-400 px-3 py-1.5 rounded-xl transition-colors hidden lg:flex items-center gap-1.5 cursor-pointer bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800"
          >
            <BarChart3 :size="14" class="text-indigo-400" />
            <span>Métricas Globales</span>
          </button>

          <router-link 
            to="/" 
            class="text-xs font-bold text-slate-300 hover:text-indigo-400 px-3 py-1.5 rounded-xl transition-colors hidden md:block"
          >
            Inicio
          </router-link>

          <router-link 
            to="/login" 
            class="text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
          >
            <span>Ir a la Plataforma</span>
            <ExternalLink :size="13" />
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main Docs Container (Layout de 3 columnas fluidas con sidebars fijos) -->
    <div class="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 lg:gap-8 py-6 items-start">
      
      <!-- Left Sidebar (Desktop Fijo & Mobile Drawer) -->
      <aside 
        :class="[
          'w-72 shrink-0 transition-all duration-300',
          mobileSidebarOpen 
            ? 'fixed inset-y-0 left-0 z-50 bg-slate-900 p-6 shadow-2xl overflow-y-auto block w-80' 
            : 'hidden md:flex md:flex-col sticky top-20 h-[calc(100vh-6rem)]'
        ]"
      >
        <!-- Sidebar Header Fijo (Buscador y Contador) -->
        <div class="shrink-0 space-y-3 pb-4 border-b border-slate-800/80 mb-3">
          <!-- Sidebar Search Filter -->
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              v-model="sidebarFilter"
              type="text" 
              placeholder="Filtrar módulos y guías..."
              class="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <!-- Total Count Badge -->
          <div class="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
            <span>Ecosistema de Guías</span>
            <span class="bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 border border-slate-700">{{ filteredModules.length }}</span>
          </div>
        </div>

        <!-- Modules List Tree con scroll independiente -->
        <div class="flex-1 overflow-y-auto pr-1.5 space-y-1.5 docs-scrollbar">
          <div v-if="loadingModules" class="py-6 text-center text-xs text-slate-400 font-medium">
            Cargando guías en tiempo real...
          </div>

          <div 
            v-for="mod in filteredModules" 
            :key="mod.id"
            class="rounded-2xl overflow-hidden border border-transparent transition-colors"
          >
            <!-- Folder Header -->
            <button 
              @click="toggleFolder(mod.id)"
              class="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors text-left cursor-pointer"
            >
              <div class="flex items-center gap-2 truncate">
                <FolderOpen :size="15" class="text-indigo-400 shrink-0" />
                <span class="truncate">{{ mod.name }}</span>
              </div>
              <ChevronDown 
                :size="14" 
                :class="['text-slate-400 transition-transform duration-200 shrink-0', openFolders[mod.id] ? 'rotate-0' : '-rotate-90']"
              />
            </button>

            <!-- Files Sub-list -->
            <div v-show="openFolders[mod.id]" class="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-slate-800 ml-4 my-1">
              <!-- Archivos Principales -->
              <button 
                v-for="f in mod.files"
                :key="f.id"
                @click="loadDocument(mod.id, f.relativePath || f.fileName)"
                :class="[
                  'w-full px-3 py-1.5 rounded-xl text-left text-xs transition-all flex items-center gap-2 font-semibold cursor-pointer',
                  selectedModuleId === mod.id && (selectedFileName === f.relativePath || selectedFileName === f.fileName)
                    ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                ]"
              >
                <FileText :size="13" class="shrink-0 opacity-80" />
                <span class="truncate">{{ f.title }}</span>
              </button>

              <!-- Submódulos Anidados si existen -->
              <div v-if="mod.submodules && mod.submodules.length > 0" class="pt-2 mt-1 space-y-0.5 border-t border-slate-800/60">
                <div class="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Layers :size="11" />
                  <span>Submódulos ({{ mod.submodules.length }})</span>
                </div>

                <button 
                  v-for="sub in mod.submodules"
                  :key="sub.id"
                  @click="loadDocument(mod.id, sub.relativePath || ('submodules/' + sub.fileName))"
                  :class="[
                    'w-full px-3 py-1.5 rounded-xl text-left text-xs transition-all flex items-center gap-2 font-semibold cursor-pointer',
                    selectedModuleId === mod.id && (selectedFileName === sub.relativePath || selectedFileName === ('submodules/' + sub.fileName) || selectedFileName === sub.fileName)
                      ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/20'
                      : 'text-indigo-300/80 hover:text-white hover:bg-slate-800/60'
                  ]"
                >
                  <FileText :size="13" class="shrink-0 text-indigo-400 opacity-90" />
                  <span class="truncate">{{ sub.title }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Center Documentation Article Area -->
      <main class="flex-1 min-w-0 bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-xs relative overflow-hidden">
        
        <!-- Header de Navegación y Modos de Vista -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
          
          <!-- Breadcrumbs -->
          <div class="flex items-center gap-2 truncate font-medium text-xs text-slate-400">
            <router-link to="/docs" class="hover:text-indigo-400">Docs</router-link>
            <ChevronRight :size="13" class="text-slate-500" />
            <span class="text-slate-300 font-bold truncate">{{ selectedModuleId === 'maestro' ? 'Documento Rector' : (selectedModuleId === 'general' ? 'Visión General' : selectedModuleId) }}</span>
            <ChevronRight :size="13" class="text-slate-500" />
            <span class="text-indigo-400 font-bold truncate">{{ docTitle }}</span>
          </div>

          <!-- Tabs de Modo de Visualización -->
          <div class="flex items-center gap-2">
            <div class="p-1 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-1 shadow-inner">
              <button
                @click="activeViewTab = 'reading'"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                  activeViewTab === 'reading' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                ]"
              >
                <BookOpen :size="13" />
                <span>Lectura Técnica</span>
              </button>

              <button
                @click="activeViewTab = 'summary'"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                  activeViewTab === 'summary' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                ]"
              >
                <Brain :size="13" />
                <span>Ficha Ejecutiva</span>
              </button>

              <button
                @click="activeViewTab = 'graph'"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                  activeViewTab === 'graph' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                ]"
              >
                <Network :size="13" />
                <span>Grafo de Relaciones</span>
              </button>

              <button
                @click="activeViewTab = 'metrics'"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                  activeViewTab === 'metrics' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                ]"
              >
                <BarChart3 :size="13" />
                <span>Dashboard</span>
              </button>
            </div>

            <!-- Share Button -->
            <button 
              @click="copyCurrentUrl" 
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700"
              title="Copiar enlace a esta guía"
            >
              <Check v-if="copiedLink" :size="13" class="text-emerald-400" />
              <Copy v-else :size="13" />
              <span class="hidden sm:inline">{{ copiedLink ? '¡Copiado!' : 'URL' }}</span>
            </button>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- MODO 1: DASHBOARD GLOBAL Y SALUD DOCS      -->
        <!-- ========================================== -->
        <div v-if="activeViewTab === 'metrics'" class="space-y-8 animate-in fade-in duration-200">
          
          <!-- Banner Principal de Métricas -->
          <div class="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-800/40 relative overflow-hidden shadow-xl">
            <div class="relative z-10 space-y-2 max-w-3xl">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">100% Cobertura</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">Arquitectura Viva</span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Dashboard de Ingeniería y Conocimiento Escolar</h2>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                Métricas consolidadas del sistema AcademiaNeiva: arquitectura de dominio, reglas de negocio transversales, esquema relacional PostgreSQL y cobertura documental.
              </p>
            </div>
          </div>

          <!-- Tarjetas KPI Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <div class="text-2xl font-black text-white">{{ SYSTEM_METRICS.totalModules }}</div>
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Módulos</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <div class="text-2xl font-black text-indigo-400">{{ SYSTEM_METRICS.totalTables }}</div>
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tablas SQL</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <div class="text-2xl font-black text-emerald-400">{{ SYSTEM_METRICS.totalGlobalRules }}</div>
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reglas Globales</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <div class="text-2xl font-black text-amber-400">{{ SYSTEM_METRICS.totalAdrs }}</div>
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ADRs Técnicos</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <div class="text-2xl font-black text-rose-400">{{ SYSTEM_METRICS.totalDomains }}</div>
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dominios</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <div class="text-2xl font-black text-cyan-400">100%</div>
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trazabilidad</div>
            </div>
          </div>

          <!-- Dos Columnas: Distribución de Dominios & Módulos Más Conectados -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <!-- Dominios del Negocio -->
            <div class="p-6 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
                  <Workflow :size="15" class="text-indigo-400" />
                  <span>Distribución por Dominios Funcionales</span>
                </div>
                <span class="text-[10px] text-slate-400 font-bold">6 Dominios</span>
              </div>

              <div class="space-y-3">
                <div 
                  v-for="(dom, i) in SYSTEM_METRICS.domainDistribution" 
                  :key="i"
                  class="space-y-1.5"
                >
                  <div class="flex items-center justify-between text-xs font-bold">
                    <span class="text-slate-300">{{ dom.domain }}</span>
                    <span class="text-slate-400">{{ dom.count }} módulos</span>
                  </div>
                  <div class="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      :class="['h-full rounded-full bg-gradient-to-r', dom.color]"
                      :style="{ width: `${(dom.count / 21) * 100}%` }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Módulos Más Conectados (Centralidad de Dependencias) -->
            <div class="p-6 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
                  <Network :size="15" class="text-emerald-400" />
                  <span>Centralidad y Acoplamiento Intermodular</span>
                </div>
                <span class="text-[10px] text-slate-400 font-bold">Top Conexiones</span>
              </div>

              <div class="space-y-2">
                <div 
                  v-for="item in SYSTEM_METRICS.mostConnectedModules" 
                  :key="item.id"
                  @click="navigateToModule(item.id)"
                  class="p-2.5 rounded-2xl bg-slate-900/80 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-700/50 flex items-center justify-between cursor-pointer transition-all group"
                >
                  <div class="flex items-center gap-2 truncate">
                    <div class="w-2 h-2 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform"></div>
                    <span class="text-xs font-bold text-slate-200 group-hover:text-white truncate">{{ item.name }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {{ item.count }} conexiones
                    </span>
                    <ArrowRight :size="12" class="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Botón para volver a la lectura -->
          <div class="pt-4 text-center">
            <button
              @click="activeViewTab = 'reading'"
              class="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg shadow-indigo-500/20 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <BookOpen :size="14" />
              <span>Volver a la Documentación Técnica</span>
            </button>
          </div>

        </div>

        <!-- ========================================== -->
        <!-- MODO 2: FICHA EJECUTIVA "ENTENDER ESTE MÓDULO" -->
        <!-- ========================================== -->
        <div v-else-if="activeViewTab === 'summary'" class="space-y-8 animate-in fade-in duration-200">
          
          <div v-if="currentModuleMeta" class="space-y-6">
            
            <!-- Header de la Ficha -->
            <div class="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-slate-800 relative overflow-hidden">
              <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                  <div class="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                    <component :is="getIconComponent(currentModuleMeta.icon)" :size="24" />
                  </div>
                  <div>
                    <div class="text-[11px] font-black uppercase tracking-wider text-indigo-400">{{ currentModuleMeta.domain }}</div>
                    <h2 class="text-xl sm:text-2xl font-black text-white">{{ currentModuleMeta.name }}</h2>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                    🟢 {{ currentModuleMeta.status }}
                  </span>
                  <span class="px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300 border border-slate-700">
                    🔗 {{ currentModuleMeta.connectionsCount }} Relaciones
                  </span>
                </div>
              </div>

              <!-- Propósito Principal -->
              <div class="pt-4 space-y-2">
                <div class="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles :size="13" class="text-indigo-400" />
                  <span>¿Qué problema resuelve este módulo?</span>
                </div>
                <p class="text-sm text-slate-200 font-medium leading-relaxed">
                  {{ currentModuleMeta.purpose }}
                </p>
                <p class="text-xs text-slate-400 leading-relaxed pt-1">
                  {{ currentModuleMeta.description }}
                </p>
              </div>
            </div>

            <!-- Actores del Ecosistema -->
            <div class="p-6 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Users :size="14" class="text-indigo-400" />
                <span>¿Quiénes utilizan este módulo?</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="(role, idx) in currentModuleMeta.roles" 
                  :key="idx"
                  class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-indigo-300 shadow-xs flex items-center gap-1.5"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span>{{ role }}</span>
                </span>
              </div>
            </div>

            <!-- Matriz de Dependencias (Entrada / Salida) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <!-- Depende de -->
              <div class="p-5 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-3">
                <div class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <ArrowLeft :size="14" />
                  <span>Depende de (Requiere antes):</span>
                </div>
                <div v-if="currentModuleMeta.dependsOn.length === 0" class="text-xs text-slate-500 italic">
                  No tiene dependencias directas (Módulo Base).
                </div>
                <div v-else class="space-y-1.5">
                  <div 
                    v-for="depId in currentModuleMeta.dependsOn" 
                    :key="depId"
                    @click="navigateToModule(depId)"
                    class="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-all"
                  >
                    <span class="truncate">{{ MODULES_METADATA[depId]?.name || depId }}</span>
                    <ArrowRight :size="12" class="text-slate-500" />
                  </div>
                </div>
              </div>

              <!-- Alimenta a -->
              <div class="p-5 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-3">
                <div class="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <ArrowRight :size="14" />
                  <span>Alimenta / Afecta a:</span>
                </div>
                <div v-if="currentModuleMeta.affects.length === 0" class="text-xs text-slate-500 italic">
                  Módulo terminal de consumo.
                </div>
                <div v-else class="space-y-1.5">
                  <div 
                    v-for="affId in currentModuleMeta.affects" 
                    :key="affId"
                    @click="navigateToModule(affId)"
                    class="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-all"
                  >
                    <span class="truncate">{{ MODULES_METADATA[affId]?.name || affId }}</span>
                    <ArrowRight :size="12" class="text-slate-500" />
                  </div>
                </div>
              </div>

            </div>

            <!-- Tablas de Base de Datos Vinculadas -->
            <div class="p-6 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Database :size="14" class="text-cyan-400" />
                <span>Tablas de Base de Datos Involucradas (PostgreSQL)</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="(tbl, idx) in currentModuleMeta.tables" 
                  :key="idx"
                  class="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-cyan-300 shadow-xs"
                >
                  🗄️ {{ tbl }}
                </span>
              </div>
            </div>

            <!-- Reglas de Negocio & Historias de Usuario -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <!-- Reglas -->
              <div class="p-5 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-3">
                <div class="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck :size="14" />
                  <span>Reglas de Negocio Clave</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span 
                    v-for="(r, idx) in currentModuleMeta.rules" 
                    :key="idx"
                    class="px-2 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-[11px] font-mono font-bold text-indigo-300"
                  >
                    {{ r }}
                  </span>
                </div>
              </div>

              <!-- HUs -->
              <div class="p-5 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-3">
                <div class="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Tag :size="14" />
                  <span>Historias de Usuario (HUs)</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span 
                    v-for="(h, idx) in currentModuleMeta.hus" 
                    :key="idx"
                    class="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-[11px] font-mono font-bold text-emerald-300"
                  >
                    {{ h }}
                  </span>
                </div>
              </div>

            </div>

            <!-- Botón de acción para leer especificación completa -->
            <div class="pt-4 text-center">
              <button
                @click="activeViewTab = 'reading'"
                class="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg shadow-indigo-500/20 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <BookOpen :size="14" />
                <span>Ver Documentación Técnica Completa de este Módulo</span>
              </button>
            </div>

          </div>

          <div v-else class="py-12 text-center text-slate-500 font-bold text-xs">
            Selecciona un módulo en el menú lateral para ver su ficha ejecutiva.
          </div>

        </div>

        <!-- ========================================== -->
        <!-- MODO 3: GRAFO INTERACTIVO DE RELACIONES   -->
        <!-- ========================================== -->
        <div v-else-if="activeViewTab === 'graph'" class="animate-in fade-in duration-200">
          <DocsRelationshipGraph
            :initial-selected-module-id="selectedModuleId"
            @select-module="(id) => { selectedModuleId = id }"
            @view-doc="(id) => { navigateToModule(id); activeViewTab = 'reading' }"
            @view-summary="(id) => { selectedModuleId = id; activeViewTab = 'summary' }"
          />
        </div>

        <!-- ========================================== -->
        <!-- MODO 4: LECTURA TÉCNICA (MARKDOWN ENRIQUECIDO) -->
        <!-- ========================================== -->
        <div v-else class="space-y-6 animate-in fade-in duration-200">
          
          <!-- Metadata Bar -->
          <div v-if="metadata" class="flex flex-wrap items-center gap-4 text-xs text-slate-400 p-3 rounded-2xl bg-slate-800/60 border border-slate-800">
            <div class="flex items-center gap-1.5 font-medium">
              <Clock :size="14" class="text-indigo-400" />
              <span>{{ metadata.readingTimeMinutes }} min de lectura</span>
            </div>
            <div class="flex items-center gap-1.5 font-medium">
              <FileCheck :size="14" class="text-emerald-400" />
              <span>{{ metadata.wordsCount.toLocaleString() }} palabras</span>
            </div>
            <div class="flex items-center gap-1.5 font-medium">
              <Calendar :size="14" class="text-amber-400" />
              <span>Actualizado: {{ new Date(metadata.lastModified).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) }}</span>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loadingContent" class="py-24 text-center space-y-3">
            <div class="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="text-xs font-bold text-slate-400">Cargando documentación...</p>
          </div>

          <!-- Markdown Content con contención estricta e intercepción de enlaces relativos -->
          <article 
            v-else 
            class="docs-content prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm w-full min-w-0"
            v-html="renderedHtml"
            @click="handleArticleClick"
          >
          </article>

          <!-- Bloque de Trazabilidad y Recursos Relacionados al pie del documento -->
          <div v-if="currentModuleMeta && !loadingContent" class="mt-12 p-6 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-400">
                <Workflow :size="14" />
                <span>Trazabilidad y Relaciones del Módulo</span>
              </div>
              <div class="flex items-center gap-3">
                <button 
                  @click="activeViewTab = 'graph'"
                  class="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Network :size="12" />
                  <span>Explorar en Grafo</span>
                </button>
                <button 
                  @click="activeViewTab = 'summary'"
                  class="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver Ficha Rápida</span>
                  <ChevronRight :size="12" />
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <!-- Tablas -->
              <div class="space-y-1.5">
                <span class="font-bold text-slate-400 text-[11px] uppercase tracking-wider">🗄️ Tablas SQL:</span>
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="(t, i) in currentModuleMeta.tables.slice(0, 4)" 
                    :key="i"
                    class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-cyan-300"
                  >
                    {{ t }}
                  </span>
                </div>
              </div>

              <!-- Reglas -->
              <div class="space-y-1.5">
                <span class="font-bold text-slate-400 text-[11px] uppercase tracking-wider">📜 Reglas Asociadas:</span>
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="(r, i) in currentModuleMeta.rules.slice(0, 3)" 
                    :key="i"
                    class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-indigo-300"
                  >
                    {{ r }}
                  </span>
                </div>
              </div>

              <!-- Dependencias -->
              <div class="space-y-1.5">
                <span class="font-bold text-slate-400 text-[11px] uppercase tracking-wider">🔗 Módulos Conectados:</span>
                <div class="flex flex-wrap gap-1">
                  <button 
                    v-for="(dep, i) in currentModuleMeta.dependsOn.slice(0, 3)" 
                    :key="i"
                    @click="navigateToModule(dep)"
                    class="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                  >
                    {{ MODULES_METADATA[dep]?.shortName || dep }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination Footer (Prev / Next) -->
          <div class="mt-8 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div v-if="currentNavigation.prev">
              <button 
                @click="loadDocument(currentNavigation.prev.moduleId, currentNavigation.prev.file.relativePath || currentNavigation.prev.file.fileName)"
                class="w-full p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all text-left group cursor-pointer"
              >
                <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                  <ArrowLeft :size="12" class="group-hover:-translate-x-1 transition-transform" />
                  <span>Anterior</span>
                </div>
                <p class="text-xs font-bold text-white truncate">{{ currentNavigation.prev.file.title }}</p>
                <p class="text-[10px] text-slate-400 truncate">{{ currentNavigation.prev.moduleName }}</p>
              </button>
            </div>
            <div v-else class="hidden sm:block"></div>

            <div v-if="currentNavigation.next">
              <button 
                @click="loadDocument(currentNavigation.next.moduleId, currentNavigation.next.file.relativePath || currentNavigation.next.file.fileName)"
                class="w-full p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all text-right group cursor-pointer"
              >
                <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-end gap-1 mb-1">
                  <span>Siguiente</span>
                  <ArrowRight :size="12" class="group-hover:translate-x-1 transition-transform" />
                </div>
                <p class="text-xs font-bold text-white truncate">{{ currentNavigation.next.file.title }}</p>
                <p class="text-[10px] text-slate-400 truncate">{{ currentNavigation.next.moduleName }}</p>
              </button>
            </div>
          </div>

        </div>

      </main>

      <!-- Right Sidebar (Table of Contents / On this page) -->
      <aside v-if="activeViewTab === 'reading'" class="w-64 shrink-0 hidden 2xl:flex flex-col sticky top-20 h-[calc(100vh-6rem)]">
        <div class="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex-1 flex flex-col overflow-hidden">
          <div class="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider pb-3 border-b border-slate-800 shrink-0">
            <Layers :size="14" class="text-indigo-400" />
            <span>En esta página</span>
          </div>

          <div v-if="tableOfContents.length === 0" class="text-xs text-slate-400 font-medium italic pt-4">
            Sin secciones secundarias.
          </div>

          <nav v-else class="space-y-1.5 flex-1 overflow-y-auto text-xs pr-1 docs-scrollbar pt-3">
            <a 
              v-for="item in tableOfContents" 
              :key="item.id"
              :href="`#${item.id}`"
              :class="[
                'block py-1 transition-colors leading-snug truncate rounded-lg px-2',
                item.level === 3 ? 'pl-4 text-[11px] text-slate-400 hover:text-indigo-300 hover:bg-slate-800/50' : 'font-bold text-slate-300 hover:text-white hover:bg-slate-800'
              ]"
              :title="item.text"
            >
              {{ item.text }}
            </a>
          </nav>
        </div>
      </aside>

    </div>

    <!-- Search Modal: Command Palette Inteligente (Ctrl + K / Cmd + K) -->
    <div v-if="searchModalOpen" class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 md:p-16 overflow-y-auto animate-in fade-in duration-200">
      <div 
        class="relative w-full max-w-3xl bg-slate-900/95 rounded-3xl shadow-2xl border border-slate-800/90 overflow-hidden text-left flex flex-col max-h-[85vh]"
        @click.stop
      >
        
        <!-- Search Input Bar -->
        <div class="p-4 sm:p-5 border-b border-slate-800/80 flex items-center gap-3 bg-slate-950/40">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Search :size="18" />
          </div>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar por regla (ej. RN-MAT-002), endpoint (POST /api/...), tabla SQL, HU..."
            class="w-full text-sm sm:text-base font-bold bg-transparent text-white outline-none placeholder:text-slate-500"
            autofocus
            @keydown.down.prevent="handleArrowDown"
            @keydown.up.prevent="handleArrowUp"
            @keydown.enter.prevent="handleEnter"
            @keydown.tab="handleTabKey"
            @keydown.esc.prevent="closeSearchModal"
          />
          <div class="flex items-center gap-1.5 shrink-0">
            <span v-if="searchQuery" class="text-[10px] font-mono font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md hidden sm:inline">
              {{ filteredSearchResults.length }} resultados
            </span>
            <button @click="closeSearchModal" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer">
              <X :size="18" />
            </button>
          </div>
        </div>

        <!-- Chips de Filtros de Categorías Semánticas -->
        <div class="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/70 flex items-center gap-1.5 overflow-x-auto docs-scrollbar shrink-0">
          <button
            @click="searchCategory = 'ALL'"
            :class="[
              'px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
              searchCategory === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            ]"
          >
            <Layers :size="12" />
            <span>Todos</span>
          </button>
          <button
            @click="searchCategory = 'RULE'"
            :class="[
              'px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
              searchCategory === 'RULE' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            ]"
          >
            <ShieldCheck :size="12" class="text-indigo-400" />
            <span>📜 Reglas (RN)</span>
          </button>
          <button
            @click="searchCategory = 'ENDPOINT'"
            :class="[
              'px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
              searchCategory === 'ENDPOINT' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            ]"
          >
            <Zap :size="12" class="text-emerald-400" />
            <span>⚡ Endpoints API</span>
          </button>
          <button
            @click="searchCategory = 'TABLE'"
            :class="[
              'px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
              searchCategory === 'TABLE' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            ]"
          >
            <Database :size="12" class="text-amber-400" />
            <span>🗄️ Tablas SQL</span>
          </button>
          <button
            @click="searchCategory = 'HU'"
            :class="[
              'px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
              searchCategory === 'HU' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            ]"
          >
            <Tag :size="12" class="text-purple-400" />
            <span>👤 Historias (HU)</span>
          </button>
        </div>

        <!-- Results / Recent Searches Container -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 docs-scrollbar">
          
          <!-- Estado: Buscando -->
          <div v-if="searching" class="py-12 text-center text-xs text-slate-400 font-bold flex flex-col items-center gap-2">
            <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Búsqueda jerárquica en memoria...</span>
          </div>

          <!-- Estado: Sin coincidencias -->
          <div v-else-if="searchQuery.trim().length >= 2 && filteredSearchResults.length === 0" class="py-12 text-center text-xs text-slate-400 font-bold space-y-2">
            <p>No se encontraron secciones ni reglas para <span class="text-indigo-400 font-mono">"{{ searchQuery }}"</span> en la categoría seleccionada.</p>
            <p class="text-[11px] text-slate-500 font-medium">Prueba buscando por código (ej. <code class="text-indigo-300">RN-MAT-002</code>), tabla (ej. <code class="text-indigo-300">matricula</code>) o término general.</p>
          </div>

          <!-- Estado: Vacío (Historial Reciente y Sugerencias) -->
          <div v-else-if="!searchQuery" class="py-4 space-y-4">
            
            <!-- Historial Reciente -->
            <div v-if="recentSearches.length > 0" class="space-y-2">
              <div class="flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span class="flex items-center gap-1.5">
                  <History :size="12" />
                  <span>Búsquedas Recientes</span>
                </span>
                <button @click="clearRecentSearches" class="hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1">
                  <Trash2 :size="11" />
                  <span>Borrar Historial</span>
                </button>
              </div>
              <div class="flex flex-wrap gap-1.5 px-2">
                <button 
                  v-for="(rec, rIdx) in recentSearches" 
                  :key="rIdx"
                  @click="selectRecentSearch(rec)"
                  class="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>{{ rec }}</span>
                  <ArrowRight :size="11" class="text-slate-500" />
                </button>
              </div>
            </div>

            <!-- Sugerencias de Inicio Rápido -->
            <div class="space-y-2 pt-2 border-t border-slate-800/50">
              <div class="px-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>Atajos y Búsquedas Frecuentes</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
                <button 
                  @click="selectRecentSearch('RN-MAT-002')"
                  class="p-2.5 rounded-2xl bg-slate-950/40 hover:bg-slate-800/70 border border-slate-800 text-left transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <span class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs">📜</span>
                  <div>
                    <p class="text-xs font-bold text-white leading-tight">RN-MAT-002 (Matrícula Extraordinaria)</p>
                    <p class="text-[10px] text-slate-400">Bypass de fechas y enlace UUID</p>
                  </div>
                </button>

                <button 
                  @click="selectRecentSearch('estados y tipos de matricula')"
                  class="p-2.5 rounded-2xl bg-slate-950/40 hover:bg-slate-800/70 border border-slate-800 text-left transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">🏷️</span>
                  <div>
                    <p class="text-xs font-bold text-white leading-tight">Tipos y Estados de Matrícula</p>
                    <p class="text-[10px] text-slate-400">Máquina de estados y transiciones</p>
                  </div>
                </button>

                <button 
                  @click="selectRecentSearch('POST /api/matriculas/finalize')"
                  class="p-2.5 rounded-2xl bg-slate-950/40 hover:bg-slate-800/70 border border-slate-800 text-left transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <span class="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs">⚡</span>
                  <div>
                    <p class="text-xs font-bold text-white leading-tight">POST /api/matriculas/finalize</p>
                    <p class="text-[10px] text-slate-400">Oficialización atómica en 6 pasos</p>
                  </div>
                </button>

                <button 
                  @click="selectRecentSearch('auditoria_supervision')"
                  class="p-2.5 rounded-2xl bg-slate-950/40 hover:bg-slate-800/70 border border-slate-800 text-left transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">🗄️</span>
                  <div>
                    <p class="text-xs font-bold text-white leading-tight">Tabla auditoria_supervision</p>
                    <p class="text-[10px] text-slate-400">Bitácora inmutable de supervisión</p>
                  </div>
                </button>
              </div>
            </div>

          </div>

          <!-- Lista de Resultados Jerárquicos -->
          <div v-else class="space-y-1.5">
            <div 
              v-for="(res, idx) in filteredSearchResults" 
              :key="res.id || idx"
              @click="selectSearchResult(res)"
              :class="[
                'p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all border flex flex-col gap-1.5',
                selectedResultIndex === idx 
                  ? 'bg-indigo-950/50 border-indigo-500/60 shadow-lg shadow-indigo-950/30 ring-1 ring-indigo-500/30' 
                  : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800/80 hover:border-slate-700'
              ]"
            >
              <!-- Top bar del resultado: Categoría + Breadcrumbs -->
              <div class="flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span 
                    :class="[
                      res.category === 'RULE' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : '',
                      res.category === 'ENDPOINT' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : '',
                      res.category === 'TABLE' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : '',
                      res.category === 'HU' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : '',
                      res.category === 'GENERAL' || !res.category ? 'bg-slate-800 text-slate-300 border-slate-700' : '',
                      'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border font-mono shrink-0'
                    ]"
                  >
                    {{ res.category === 'RULE' ? '📜 Regla' : res.category === 'ENDPOINT' ? '⚡ Endpoint' : res.category === 'TABLE' ? '🗄️ Tabla' : res.category === 'HU' ? '👤 HU' : '📄 Sección' }}
                  </span>
                  
                  <!-- Breadcrumbs: L0 > L1 > L2 -->
                  <div class="text-[11px] font-bold text-slate-400 truncate flex items-center gap-1 font-mono">
                    <span class="text-indigo-400 truncate">{{ res.hierarchy?.l0 || res.moduleName }}</span>
                    <span class="text-slate-600">›</span>
                    <span class="truncate">{{ res.hierarchy?.l1 || res.fileTitle }}</span>
                    <span v-if="res.hierarchy?.l2" class="text-slate-600 hidden sm:inline">›</span>
                    <span v-if="res.hierarchy?.l2" class="text-slate-500 truncate hidden sm:inline">{{ res.hierarchy.l2 }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <span v-if="selectedResultIndex === idx" class="px-1.5 py-0.5 rounded bg-indigo-600 text-[10px] font-mono font-bold text-white flex items-center gap-1">
                    <span>↵</span>
                  </span>
                </div>
              </div>

              <!-- Título de la sección / encabezado -->
              <h4 class="text-xs sm:text-sm font-black text-white leading-tight break-words flex items-center gap-1.5">
                <span>{{ res.heading || res.fileTitle }}</span>
              </h4>

              <!-- Snippet contextual con <mark> -->
              <p 
                class="text-xs text-slate-300 font-medium leading-relaxed line-clamp-2"
                v-html="res.highlightedSnippet || res.snippet"
              ></p>
            </div>
          </div>

        </div>

        <!-- Search Footer con Atajos de Teclado -->
        <div class="px-5 py-3 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-slate-300 text-[10px]">↑</kbd>
              <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-slate-300 text-[10px]">↓</kbd>
              <span class="text-slate-500">Navegar</span>
            </span>
            <span class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-slate-300 text-[10px]">↵ Enter</kbd>
              <span class="text-slate-500">Ir a Sección</span>
            </span>
            <span class="flex items-center gap-1 hidden sm:flex">
              <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-slate-300 text-[10px]">Tab</kbd>
              <span class="text-slate-500">Filtrar</span>
            </span>
            <span class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-slate-300 text-[10px]">ESC</kbd>
              <span class="text-slate-500">Cerrar</span>
            </span>
          </div>
          <span class="font-mono text-indigo-400 font-bold">Docs Search v2</span>
        </div>

      </div>
    </div>

  </div>
</template>

<style>
/* Animación de destello suave al navegar a una sección (#anchor) */
@keyframes docPulseHighlight {
  0% {
    background-color: rgba(99, 102, 241, 0.35);
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.35);
    border-radius: 0.75rem;
  }
  50% {
    background-color: rgba(99, 102, 241, 0.15);
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.1);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.doc-pulse-highlight {
  animation: docPulseHighlight 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  transition: all 0.5s ease;
}
/* Scrollbar sutil */
.docs-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.docs-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.docs-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 9999px;
}
.docs-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

/* Contenedor wrapper de tablas con scroll horizontal asegurado */
.docs-table-wrapper {
  overflow-x: auto !important;
  max-width: 100% !important;
  display: block;
}

/* Estilos tipográficos estrictos para Markdown */
.docs-content h1 {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 900;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #f8fafc;
}
.docs-content h2 {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 900;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #1e293b;
  padding-bottom: 0.5rem;
  color: #f8fafc;
}
.docs-content h3 {
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 800;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: #f1f5f9;
}
.docs-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
  border-radius: 1rem;
}
.docs-content th {
  background-color: #1e293b;
  padding: 0.75rem 1rem;
  font-weight: 900;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  border-bottom: 1px solid #334155;
  color: #e2e8f0;
  white-space: nowrap;
}
.docs-content td {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid #1e293b;
  color: #cbd5e1;
}
.docs-content tr:nth-child(even) td {
  background-color: rgba(30, 41, 59, 0.3);
}
.docs-content tr:hover td {
  background-color: rgba(99, 102, 241, 0.05);
}
.docs-content ul {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}
.docs-content ol {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}
.docs-content li {
  margin-top: 0.35rem;
  margin-bottom: 0.35rem;
}
.docs-content a {
  color: #818cf8;
  text-decoration: underline;
  font-weight: 600;
}
.docs-content a:hover {
  color: #a5b4fc;
}
.docs-content strong {
  font-weight: 800;
  color: #f8fafc;
}
.docs-content pre {
  background-color: #020617;
  color: #f8fafc;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  overflow-x: auto;
  margin-top: 1.25rem;
  margin-bottom: 1.25rem;
  border: 1px solid #1e293b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
}
.docs-content code:not(pre code) {
  background-color: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  padding: 0.15rem 0.35rem;
  border-radius: 0.375rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  font-weight: 700;
  border: 1px solid rgba(99, 102, 241, 0.25);
}

/* Estilos para diagramas interactivos Mermaid */
.mermaid-diagram {
  min-height: 80px;
}
.mermaid-diagram svg {
  max-width: 100% !important;
  height: auto !important;
  display: block;
}
</style>
