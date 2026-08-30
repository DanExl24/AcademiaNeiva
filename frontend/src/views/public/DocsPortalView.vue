<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
  FolderOpen
} from 'lucide-vue-next'
import { marked } from 'marked'
import { docsService, type DocModule, type DocSearchResult } from '../../services/docsService'

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

// Búsqueda global modal
const searchModalOpen = ref(false)
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<DocSearchResult[]>([])

// Responsive mobile menu
const mobileSidebarOpen = ref(false)
const copiedLink = ref(false)

// Procesa markdown a HTML enriquecido con soporte para GitHub Alerts
const processMarkdownToHtml = (markdown: string): string => {
  // Pre-procesar GitHub alerts
  const processedMd = markdown.replace(
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

  // Asignar IDs a los encabezados para anclas
  html = html.replace(/<h([2-3])>(.*?)<\/h\1>/gi, (_match, level, title) => {
    const plainText = title.replace(/<[^>]+>/g, '').trim()
    const id = plainText
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
    return `<h${level} id="${id}" class="scroll-mt-24 font-black">${title}</h${level}>`
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
      if (matchName || matchingFiles.length > 0) {
        return {
          ...m,
          files: matchName ? m.files : matchingFiles
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
const loadDocument = async (moduleId: string, fileName: string) => {
  loadingContent.value = true
  try {
    const res = await docsService.getContent(moduleId, fileName)
    selectedModuleId.value = moduleId
    selectedFileName.value = fileName
    docTitle.value = res.title
    rawMarkdown.value = res.content
    metadata.value = res.metadata

    // Renderizar Markdown y TOC
    extractToc(res.content)
    renderedHtml.value = processMarkdownToHtml(res.content)

    // Actualizar URL sin reload
    router.replace({
      path: `/docs/${moduleId}/${fileName}`
    })

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    console.error('Error cargando contenido del documento:', error)
    renderedHtml.value = '<div class="p-8 text-center text-slate-500 font-bold">No se pudo cargar el documento solicitado.</div>'
  } finally {
    loadingContent.value = false
    mobileSidebarOpen.value = false
  }
}

// Resolver parámetros de ruta
const resolveRoute = () => {
  const modParam = route.params.module as string
  const fileParam = route.params.file as string

  if (modParam && fileParam) {
    loadDocument(modParam, fileParam)
    return
  }

  // Por defecto abrir 06_matriculas o el primer módulo disponible
  const defaultMod = modules.value.find(m => m.id === '06_matriculas') || modules.value[0]
  if (defaultMod && defaultMod.files.length > 0) {
    loadDocument(defaultMod.id, defaultMod.files[0].fileName)
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
  })

  const currentIndex = flatFiles.findIndex(
    item => item.moduleId === selectedModuleId.value && item.file.fileName === selectedFileName.value
  )

  return {
    prev: currentIndex > 0 ? flatFiles[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < flatFiles.length - 1 ? flatFiles[currentIndex + 1] : null
  }
})

// Búsqueda en tiempo real
let searchTimeout: any = null
watch(searchQuery, (newQ) => {
  clearTimeout(searchTimeout)
  if (!newQ.trim() || newQ.length < 2) {
    searchResults.value = []
    return
  }
  searching.value = true
  searchTimeout = setTimeout(async () => {
    try {
      searchResults.value = await docsService.search(newQ)
    } catch (e) {
      console.error('Error en búsqueda de docs:', e)
    } finally {
      searching.value = false
    }
  }, 250)
})

const openSearchModal = () => {
  searchModalOpen.value = true
  searchQuery.value = ''
  searchResults.value = []
}

const closeSearchModal = () => {
  searchModalOpen.value = false
}

const selectSearchResult = (item: DocSearchResult) => {
  loadDocument(item.module, item.file)
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

onMounted(() => {
  fetchModules()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
    
    <!-- Top Navbar -->
    <header class="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        <!-- Logo y Branding -->
        <div class="flex items-center gap-3">
          <button 
            @click="mobileSidebarOpen = !mobileSidebarOpen" 
            class="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu v-if="!mobileSidebarOpen" :size="20" />
            <X v-else :size="20" />
          </button>

          <router-link to="/docs" class="flex items-center gap-2.5 group">
            <div class="p-2 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-xl shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <BookOpen :size="20" />
            </div>
            <div>
              <span class="font-black text-lg tracking-tight text-slate-900 dark:text-white">Academia<span class="text-indigo-600">Neiva</span></span>
              <span class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">Docs v2.5</span>
            </div>
          </router-link>
        </div>

        <!-- Search Bar Header (Trigger Modal) -->
        <div class="flex-1 max-w-md hidden sm:block">
          <button 
            @click="openSearchModal" 
            class="w-full px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-400 text-xs font-medium flex items-center justify-between transition-all cursor-pointer shadow-inner"
          >
            <span class="flex items-center gap-2">
              <Search :size="15" class="text-slate-400" />
              <span>Buscar en los 21 módulos...</span>
            </span>
            <kbd class="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500">Ctrl K</kbd>
          </button>
        </div>

        <!-- Navigation Links -->
        <div class="flex items-center gap-3">
          <button 
            @click="openSearchModal" 
            class="sm:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Buscar"
          >
            <Search :size="18" />
          </button>

          <router-link 
            to="/" 
            class="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1.5 rounded-xl transition-colors hidden md:block"
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

    <!-- Main Docs Container -->
    <div class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex gap-8 py-8">
      
      <!-- Left Sidebar (Desktop & Mobile Drawer) -->
      <aside 
        :class="[
          'w-72 shrink-0 md:block transition-all duration-300',
          mobileSidebarOpen 
            ? 'fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 p-6 shadow-2xl overflow-y-auto block w-80' 
            : 'hidden'
        ]"
      >
        <div class="sticky top-24 space-y-5">
          
          <!-- Sidebar Search Filter -->
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              v-model="sidebarFilter"
              type="text" 
              placeholder="Filtrar módulos y guías..."
              class="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <!-- Total Count Badge -->
          <div class="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            <span>Módulos del Sistema</span>
            <span class="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-300">{{ filteredModules.length }}</span>
          </div>

          <!-- Modules List Tree -->
          <div class="space-y-1.5 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
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
                class="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left cursor-pointer"
              >
                <div class="flex items-center gap-2 truncate">
                  <FolderOpen :size="15" class="text-indigo-500 shrink-0" />
                  <span class="truncate">{{ mod.name }}</span>
                </div>
                <ChevronDown 
                  :size="14" 
                  :class="['text-slate-400 transition-transform duration-200 shrink-0', openFolders[mod.id] ? 'rotate-0' : '-rotate-90']"
                />
              </button>

              <!-- Files Sub-list -->
              <div v-show="openFolders[mod.id]" class="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-slate-200 dark:border-slate-800 ml-4 my-1">
                <button 
                  v-for="f in mod.files"
                  :key="f.id"
                  @click="loadDocument(mod.id, f.fileName)"
                  :class="[
                    'w-full px-3 py-1.5 rounded-xl text-left text-xs transition-all flex items-center gap-2 font-semibold cursor-pointer',
                    selectedModuleId === mod.id && selectedFileName === f.fileName
                      ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                  ]"
                >
                  <FileText :size="13" class="shrink-0 opacity-80" />
                  <span class="truncate">{{ f.title }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Center Documentation Article Area -->
      <main class="flex-1 min-w-0 max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-xs relative">
        
        <!-- Breadcrumbs & Actions -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 text-xs text-slate-500">
          <div class="flex items-center gap-2 truncate font-medium">
            <router-link to="/docs" class="hover:text-indigo-600">Docs</router-link>
            <ChevronRight :size="13" class="text-slate-400" />
            <span class="text-slate-700 dark:text-slate-300 font-bold truncate">{{ selectedModuleId }}</span>
            <ChevronRight :size="13" class="text-slate-400" />
            <span class="text-indigo-600 dark:text-indigo-400 font-bold truncate">{{ docTitle }}</span>
          </div>

          <button 
            @click="copyCurrentUrl" 
            class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-colors cursor-pointer"
            title="Copiar enlace a esta guía"
          >
            <Check v-if="copiedLink" :size="13" class="text-emerald-600" />
            <Copy v-else :size="13" />
            <span>{{ copiedLink ? '¡Enlace copiado!' : 'Copiar URL' }}</span>
          </button>
        </div>

        <!-- Metadata Bar -->
        <div v-if="metadata" class="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-8 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-1.5 font-medium">
            <Clock :size="14" class="text-indigo-500" />
            <span>{{ metadata.readingTimeMinutes }} min de lectura</span>
          </div>
          <div class="flex items-center gap-1.5 font-medium">
            <FileCheck :size="14" class="text-emerald-500" />
            <span>{{ metadata.wordsCount.toLocaleString() }} palabras</span>
          </div>
          <div class="flex items-center gap-1.5 font-medium">
            <Calendar :size="14" class="text-amber-500" />
            <span>Actualizado: {{ new Date(metadata.lastModified).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) }}</span>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loadingContent" class="py-24 text-center space-y-3">
          <div class="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-xs font-bold text-slate-400">Cargando documentación...</p>
        </div>

        <!-- Markdown Content -->
        <article 
          v-else 
          class="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-sm"
          v-html="renderedHtml"
        >
        </article>

        <!-- Pagination Footer (Prev / Next) -->
        <div class="mt-12 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-if="currentNavigation.prev">
            <button 
              @click="loadDocument(currentNavigation.prev.moduleId, currentNavigation.prev.file.fileName)"
              class="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all text-left group cursor-pointer"
            >
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                <ArrowLeft :size="12" class="group-hover:-translate-x-1 transition-transform" />
                <span>Anterior</span>
              </div>
              <p class="text-xs font-bold text-slate-900 dark:text-white truncate">{{ currentNavigation.prev.file.title }}</p>
              <p class="text-[10px] text-slate-400 truncate">{{ currentNavigation.prev.moduleName }}</p>
            </button>
          </div>
          <div v-else class="hidden sm:block"></div>

          <div v-if="currentNavigation.next">
            <button 
              @click="loadDocument(currentNavigation.next.moduleId, currentNavigation.next.file.fileName)"
              class="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all text-right group cursor-pointer"
            >
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-end gap-1 mb-1">
                <span>Siguiente</span>
                <ArrowRight :size="12" class="group-hover:translate-x-1 transition-transform" />
              </div>
              <p class="text-xs font-bold text-slate-900 dark:text-white truncate">{{ currentNavigation.next.file.title }}</p>
              <p class="text-[10px] text-slate-400 truncate">{{ currentNavigation.next.moduleName }}</p>
            </button>
          </div>
        </div>

      </main>

      <!-- Right Sidebar (Table of Contents / On this page) -->
      <aside class="w-64 shrink-0 hidden xl:block">
        <div class="sticky top-24 space-y-4">
          <div class="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            <Layers :size="14" class="text-indigo-600" />
            <span>En esta página</span>
          </div>

          <div v-if="tableOfContents.length === 0" class="text-xs text-slate-400 font-medium italic">
            Sin secciones secundarias.
          </div>

          <nav v-else class="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto text-xs pr-2">
            <a 
              v-for="item in tableOfContents" 
              :key="item.id"
              :href="`#${item.id}`"
              :class="[
                'block py-1 transition-colors leading-snug',
                item.level === 3 ? 'pl-4 text-[11px]' : 'font-semibold',
                'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              ]"
            >
              {{ item.text }}
            </a>
          </nav>
        </div>
      </aside>

    </div>

    <!-- Search Modal (Ctrl + K) -->
    <div v-if="searchModalOpen" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 md:p-20 overflow-y-auto animate-in fade-in duration-150">
      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-left">
        
        <!-- Search Input -->
        <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search :size="20" class="text-indigo-600 shrink-0" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar por regla, endpoint, caso de uso, rol..."
            class="w-full text-sm font-bold bg-transparent text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            autofocus
          />
          <button @click="closeSearchModal" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <!-- Results Container -->
        <div class="max-h-96 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
          <div v-if="searching" class="py-8 text-center text-xs text-slate-400 font-bold">
            Buscando en todos los módulos...
          </div>

          <div v-else-if="searchQuery.trim().length >= 2 && searchResults.length === 0" class="py-8 text-center text-xs text-slate-400 font-bold">
            No se encontraron coincidencias para "{{ searchQuery }}".
          </div>

          <div v-else-if="!searchQuery" class="py-8 text-center text-xs text-slate-400">
            Escribe al menos 2 caracteres para buscar en toda la documentación del sistema.
          </div>

          <div 
            v-for="(res, idx) in searchResults" 
            :key="idx"
            @click="selectSearchResult(res)"
            class="pt-2 pb-2 px-3 hover:bg-indigo-50 dark:hover:bg-slate-800/60 rounded-2xl cursor-pointer transition-colors space-y-1"
          >
            <div class="flex items-center justify-between text-xs font-black text-indigo-600 dark:text-indigo-400">
              <span>{{ res.moduleName }} › {{ res.fileTitle }}</span>
              <span class="text-[10px] text-slate-400 font-mono">Línea {{ res.lineNumber }}</span>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2">
              {{ res.snippet }}
            </p>
          </div>
        </div>

        <!-- Search Footer -->
        <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Pulsa <kbd class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold">ESC</kbd> para cerrar</span>
          <span>{{ searchResults.length }} resultados</span>
        </div>

      </div>
    </div>

  </div>
</template>

<style>
/* Estilos tipográficos para el renderizador markdown */
.prose h1 {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 900;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #0f172a;
}
.dark .prose h1 {
  color: #f8fafc;
}
.prose h2 {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 900;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
  color: #0f172a;
}
.dark .prose h2 {
  color: #f8fafc;
  border-color: #1e293b;
}
.prose h3 {
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 800;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: #1e293b;
}
.dark .prose h3 {
  color: #f1f5f9;
}
.prose table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
.dark .prose table {
  border-color: #1e293b;
}
.prose th {
  background-color: #f1f5f9;
  padding: 0.75rem 1rem;
  font-weight: 800;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}
.dark .prose th {
  background-color: #1e293b;
  border-color: #334155;
  color: #e2e8f0;
}
.prose td {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid #f1f5f9;
}
.dark .prose td {
  border-color: #1e293b;
}
.prose tr:nth-child(even) {
  background-color: #f8fafc;
}
.dark .prose tr:nth-child(even) {
  background-color: #0f172a;
}
.prose ul {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}
.prose ol {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}
.prose li {
  margin-top: 0.35rem;
  margin-bottom: 0.35rem;
}
.prose a {
  color: #4f46e5;
  text-decoration: underline;
  font-weight: 600;
}
.prose a:hover {
  color: #4338ca;
}
.prose strong {
  font-weight: 800;
}
.prose pre {
  background-color: #0f172a;
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
.prose code:not(pre code) {
  background-color: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  padding: 0.15rem 0.35rem;
  border-radius: 0.375rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  font-weight: 700;
}
</style>
