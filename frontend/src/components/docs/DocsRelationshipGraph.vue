<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  MODULES_METADATA, 
  type ModuleSummary 
} from '../../services/docsMetadata'
import { 
  Network, 
  ArrowRight, 
  ArrowLeft, 
  Database, 
  BookOpen, 
  Brain, 
  Sparkles, 
  Search, 
  Lock, 
  Building2, 
  Users, 
  GraduationCap, 
  FileText, 
  Sliders, 
  RefreshCw, 
  BarChart3, 
  FileSignature, 
  CalendarCheck, 
  ShieldAlert, 
  LifeBuoy, 
  HeartHandshake, 
  ArrowLeftRight, 
  Award, 
  Eye, 
  MailCheck, 
  Landmark 
} from 'lucide-vue-next'

const props = defineProps<{
  initialSelectedModuleId?: string
}>()

const emit = defineEmits<{
  (e: 'select-module', moduleId: string): void
  (e: 'view-doc', moduleId: string): void
  (e: 'view-summary', moduleId: string): void
}>()

// Módulo enfocado actualmente en el grafo
const focusedModuleId = ref<string>(props.initialSelectedModuleId && props.initialSelectedModuleId !== 'maestro' ? props.initialSelectedModuleId : '06_matriculas')

// Filtro por dominio
const selectedDomainFilter = ref<string>('all')

// Búsqueda rápida de nodo
const nodeSearchQuery = ref<string>('')

// Lista de todos los dominios disponibles
const domainsList = [
  { id: 'all', name: 'Todos los Dominios', icon: 'Layers', color: 'border-slate-700 bg-slate-800/80 text-slate-200' },
  { id: 'Identidad, Seguridad y Acceso', name: '🔐 Identidad y Acceso', color: 'border-blue-500/50 bg-blue-950/40 text-blue-300' },
  { id: 'Gobierno Institucional', name: '🏫 Gobierno Escolar', color: 'border-purple-500/50 bg-purple-950/40 text-purple-300' },
  { id: 'Admisión y Movilidad Estudiantil', name: '📋 Admisión y Movilidad', color: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300' },
  { id: 'Currículo y Calidad Pedagógica', name: '📚 Currículo y DBA', color: 'border-amber-500/50 bg-amber-950/40 text-amber-300' },
  { id: 'Evaluación Continua y Rendimiento', name: '📊 Evaluación y Notas', color: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300' },
  { id: 'Auditoría, Gobernanza y Soporte', name: '🕵️ Auditoría y Soporte', color: 'border-rose-500/50 bg-rose-950/40 text-rose-300' }
]

// Posicionamiento de los 21 módulos en 6 capas arquitectónicas (Pipeline de Negocio Escolar)
// Coordenadas calculadas en un lienzo SVG de 1150 x 680
interface NodePosition {
  id: string
  x: number
  y: number
  layer: number
  meta: ModuleSummary
}

const nodePositions = computed<NodePosition[]>(() => {
  const layoutMap: Record<string, { layer: number; indexInLayer: number; totalInLayer: number }> = {
    // Capa 1: Identidad, Seguridad y Catálogo Base
    "01_autenticacion": { layer: 1, indexInLayer: 0, totalInLayer: 3 },
    "02_gestion_colegios": { layer: 1, indexInLayer: 1, totalInLayer: 3 },
    "21_flujo_correos_y_verificaciones": { layer: 1, indexInLayer: 2, totalInLayer: 3 },

    // Capa 2: Gobierno, Estructura Física y Temporal
    "03_usuarios_y_directivos": { layer: 2, indexInLayer: 0, totalInLayer: 3 },
    "04_estructura_escolar": { layer: 2, indexInLayer: 1, totalInLayer: 3 },
    "08_configuracion_academica": { layer: 2, indexInLayer: 2, totalInLayer: 3 },

    // Capa 3: Asignación Docente, Admisión y DBA
    "05_docentes": { layer: 3, indexInLayer: 0, totalInLayer: 3 },
    "06_matriculas": { layer: 3, indexInLayer: 1, totalInLayer: 3 },
    "10_catalogo_dba": { layer: 3, indexInLayer: 2, totalInLayer: 3 },

    // Capa 4: Comunidad Estudiantil y Planeación Curricular
    "07_estudiantes_y_estados": { layer: 4, indexInLayer: 0, totalInLayer: 3 },
    "17_gestion_padres": { layer: 4, indexInLayer: 1, totalInLayer: 3 },
    "09_competencias_y_sincronizacion": { layer: 4, indexInLayer: 2, totalInLayer: 3 },

    // Capa 5: Evaluación Continua, Asistencia y Movilidad
    "11_calificaciones": { layer: 5, indexInLayer: 0, totalInLayer: 4 },
    "12_observaciones": { layer: 5, indexInLayer: 1, totalInLayer: 4 },
    "13_asistencia": { layer: 5, indexInLayer: 2, totalInLayer: 4 },
    "18_gestion_traslados": { layer: 5, indexInLayer: 3, totalInLayer: 4 },

    // Capa 6: Consolidación, Promoción, Acompañamiento y Auditoría
    "14_cierre_y_boletines": { layer: 6, indexInLayer: 0, totalInLayer: 5 },
    "19_seguimiento_y_promocion_academica": { layer: 6, indexInLayer: 1, totalInLayer: 5 },
    "20_seguimiento_academico_directivo": { layer: 6, indexInLayer: 2, totalInLayer: 5 },
    "15_supervision_y_auditoria": { layer: 6, indexInLayer: 3, totalInLayer: 5 },
    "16_soporte_y_tickets": { layer: 6, indexInLayer: 4, totalInLayer: 5 }
  }

  const layerXPositions = [0, 80, 260, 440, 620, 800, 980]
  const layerHeight = 580

  const nodes: NodePosition[] = []

  Object.entries(MODULES_METADATA).forEach(([id, meta]) => {
    if (id === 'maestro') return // El maestro es rector de todos
    const pos = layoutMap[id]
    if (pos) {
      const x = layerXPositions[pos.layer]
      const step = layerHeight / (pos.totalInLayer + 1)
      const y = 40 + step * (pos.indexInLayer + 1)
      nodes.push({ id, x, y, layer: pos.layer, meta })
    }
  })

  return nodes
})

// Mapeo rápido de posiciones por ID
const nodePosMap = computed(() => {
  const map = new Map<string, NodePosition>()
  nodePositions.value.forEach(n => map.set(n.id, n))
  return map
})

// Lista de aristas / conexiones dirigidas entre módulos
interface Edge {
  id: string
  from: string
  to: string
  fromPos: { x: number; y: number }
  toPos: { x: number; y: number }
  isIncomingToFocused: boolean
  isOutgoingFromFocused: boolean
  isRelatedToFocused: boolean
}

const edges = computed<Edge[]>(() => {
  const result: Edge[] = []
  const focused = focusedModuleId.value

  nodePositions.value.forEach(node => {
    // Las dependencias indican: node.id DEPENDE DE depId (flujo de datos: depId -> node.id)
    node.meta.dependsOn.forEach(depId => {
      const source = nodePosMap.value.get(depId)
      const target = node
      if (source && target) {
        const isIncoming = target.id === focused
        const isOutgoing = source.id === focused
        const isRelated = isIncoming || isOutgoing

        result.push({
          id: `${source.id}->${target.id}`,
          from: source.id,
          to: target.id,
          fromPos: { x: source.x + 65, y: source.y },
          toPos: { x: target.x - 65, y: target.y },
          isIncomingToFocused: isIncoming,
          isOutgoingFromFocused: isOutgoing,
          isRelatedToFocused: isRelated
        })
      }
    })
  })

  return result
})

// Metadata del módulo actualmente enfocado en el inspector
const focusedMeta = computed<ModuleSummary | null>(() => {
  return MODULES_METADATA[focusedModuleId.value] || null
})

// Iconos dinámicos
const getModuleIcon = (iconName: string) => {
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

// Colores según dominio para bordes de nodos
const getDomainBorderColor = (domain: string) => {
  if (domain.includes('Identidad')) return 'border-blue-500/70 text-blue-400 shadow-blue-500/10'
  if (domain.includes('Gobierno')) return 'border-purple-500/70 text-purple-400 shadow-purple-500/10'
  if (domain.includes('Admisión')) return 'border-emerald-500/70 text-emerald-400 shadow-emerald-500/10'
  if (domain.includes('Currículo')) return 'border-amber-500/70 text-amber-400 shadow-amber-500/10'
  if (domain.includes('Evaluación')) return 'border-cyan-500/70 text-cyan-400 shadow-cyan-500/10'
  if (domain.includes('Auditoría')) return 'border-rose-500/70 text-rose-400 shadow-rose-500/10'
  return 'border-slate-600 text-slate-300'
}

// Seleccionar nodo
const selectNode = (id: string) => {
  focusedModuleId.value = id
  emit('select-module', id)
}

// Filtrar nodos según búsqueda y dominio
const isNodeVisible = (node: NodePosition) => {
  if (selectedDomainFilter.value !== 'all' && node.meta.domain !== selectedDomainFilter.value) {
    return false
  }
  if (nodeSearchQuery.value.trim()) {
    const q = nodeSearchQuery.value.toLowerCase()
    return (
      node.meta.name.toLowerCase().includes(q) ||
      node.meta.shortName.toLowerCase().includes(q) ||
      node.meta.purpose.toLowerCase().includes(q)
    )
  }
  return true
}

// Comprueba si un nodo es relevante respecto al nodo enfocado
const isNodeRelated = (nodeId: string) => {
  if (!focusedMeta.value) return false
  if (nodeId === focusedModuleId.value) return true
  if (focusedMeta.value.dependsOn.includes(nodeId)) return true
  if (focusedMeta.value.affects.includes(nodeId)) return true
  return false
}

// Genera el path Bézier curvo suave entre dos puntos
const generateBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.45)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-200">
    
    <!-- Header del Grafo con Controles y Filtros -->
    <div class="p-6 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-slate-800 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700/60 flex items-center gap-1">
              <Sparkles :size="11" />
              <span>Arquitectura Viva</span>
            </span>
            <span class="text-xs text-slate-400 font-bold">21 Módulos Interconectados</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Network :size="22" class="text-indigo-400" />
            <span>Grafo Interactivo de Dependencias y Flujo de Negocio</span>
          </h2>
          <p class="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Haz clic en cualquier nodo para iluminar sus dependencias (<span class="text-amber-400 font-bold">Requiere</span>), módulos a los que alimenta (<span class="text-emerald-400 font-bold">Alimenta</span>) y tablas de base de datos involucradas.
          </p>
        </div>

        <!-- Búsqueda rápida de nodo -->
        <div class="w-full sm:w-72 relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            v-model="nodeSearchQuery"
            type="text" 
            placeholder="Buscar módulo en el grafo..."
            class="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      <!-- Chips de Filtro por Dominio Funcional -->
      <div class="pt-2 flex items-center gap-2 overflow-x-auto docs-scrollbar pb-1">
        <button
          v-for="dom in domainsList"
          :key="dom.id"
          @click="selectedDomainFilter = dom.id"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border flex items-center gap-1.5',
            selectedDomainFilter === dom.id
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20 font-black'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          ]"
        >
          <span>{{ dom.name }}</span>
        </button>
      </div>
    </div>

    <!-- Layout Principal: Lienzo del Grafo + Inspector Lateral -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- Canvas SVG Interactivo (9 Columnas en Desktop) -->
      <div class="lg:col-span-8 bg-slate-950 rounded-3xl border border-slate-800 p-4 relative overflow-hidden shadow-2xl">
        
        <!-- Leyenda Flotante -->
        <div class="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-3 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[11px] font-bold shadow-lg">
          <div class="flex items-center gap-1.5 text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-400/40"></span>
            <span>Seleccionado</span>
          </div>
          <div class="flex items-center gap-1.5 text-amber-400">
            <span class="w-3 h-0.5 bg-amber-400"></span>
            <span>Requiere antes (Dependencia)</span>
          </div>
          <div class="flex items-center gap-1.5 text-emerald-400">
            <span class="w-3 h-0.5 bg-emerald-400"></span>
            <span>Alimenta a (Salida)</span>
          </div>
        </div>

        <!-- Contenedor con Scroll Horizontal / Zoom Natural -->
        <div class="overflow-x-auto docs-scrollbar pt-12 pb-4">
          <div class="min-w-[1060px] h-[640px] relative select-none">
            
            <!-- Lienzo SVG para Aristas y Flechas Direccionales -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <!-- Marcador de Flecha Neutra -->
                <marker id="arrow-neutral" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334155" opacity="0.4" />
                </marker>
                
                <!-- Marcador de Flecha Dependencia Entrante (Ámbar) -->
                <marker id="arrow-incoming" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
                </marker>

                <!-- Marcador de Flecha Salida que Alimenta (Esmeralda) -->
                <marker id="arrow-outgoing" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                </marker>
              </defs>

              <!-- Conexiones / Aristas Bézier -->
              <g>
                <path
                  v-for="edge in edges"
                  :key="edge.id"
                  :d="generateBezierPath(edge.fromPos.x, edge.fromPos.y, edge.toPos.x, edge.toPos.y)"
                  fill="none"
                  :stroke="
                    edge.isIncomingToFocused 
                      ? '#f59e0b' 
                      : (edge.isOutgoingFromFocused ? '#10b981' : '#334155')
                  "
                  :stroke-width="edge.isRelatedToFocused ? 2.5 : 1"
                  :stroke-dasharray="edge.isIncomingToFocused ? '4,4' : 'none'"
                  :opacity="
                    focusedModuleId 
                      ? (edge.isRelatedToFocused ? 1 : 0.08) 
                      : 0.25
                  "
                  :marker-end="
                    edge.isIncomingToFocused 
                      ? 'url(#arrow-incoming)' 
                      : (edge.isOutgoingFromFocused ? 'url(#arrow-outgoing)' : 'url(#arrow-neutral)')
                  "
                  class="transition-all duration-300"
                />
              </g>
            </svg>

            <!-- Nodos HTML posicionados sobre el SVG -->
            <div
              v-for="node in nodePositions"
              :key="node.id"
              v-show="isNodeVisible(node)"
              @click="selectNode(node.id)"
              :style="{
                left: `${node.x}px`,
                top: `${node.y}px`,
                transform: 'translate(-50%, -50%)'
              }"
              :class="[
                'absolute z-10 w-36 sm:w-40 p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-lg text-left select-none group',
                node.id === focusedModuleId
                  ? 'bg-indigo-900/90 border-indigo-400 ring-4 ring-indigo-500/30 scale-105 shadow-indigo-500/20'
                  : (
                    focusedModuleId && !isNodeRelated(node.id)
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-40 hover:opacity-100 hover:scale-100'
                      : 'bg-slate-900/90 hover:bg-slate-800/90 hover:scale-105 ' + getDomainBorderColor(node.meta.domain)
                  )
              ]"
            >
              <!-- Icono y Badges -->
              <div class="flex items-center justify-between gap-1 mb-1">
                <div 
                  :class="[
                    'p-1.5 rounded-xl transition-colors',
                    node.id === focusedModuleId ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 group-hover:text-indigo-300'
                  ]"
                >
                  <component :is="getModuleIcon(node.meta.icon)" :size="14" />
                </div>

                <div class="flex items-center gap-1">
                  <!-- Tag Requiere / Alimenta si está relacionado con el enfocado -->
                  <span 
                    v-if="focusedMeta && focusedMeta.dependsOn.includes(node.id)"
                    class="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-800"
                  >
                    Requiere
                  </span>
                  <span 
                    v-else-if="focusedMeta && focusedMeta.affects.includes(node.id)"
                    class="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800"
                  >
                    Alimenta
                  </span>
                  <span v-else class="text-[10px] text-slate-500 font-mono font-bold">
                    {{ node.meta.connectionsCount }}🔗
                  </span>
                </div>
              </div>

              <!-- Título del Módulo -->
              <p :class="['text-xs font-bold truncate', node.id === focusedModuleId ? 'text-white' : 'text-slate-200 group-hover:text-white']">
                {{ node.meta.name }}
              </p>
              <p class="text-[10px] text-slate-400 truncate font-medium">
                {{ node.meta.shortName }}
              </p>
            </div>

            <!-- Etiquetas de las 6 Capas en el fondo -->
            <div class="absolute bottom-2 inset-x-0 flex justify-between px-6 text-[10px] font-black uppercase tracking-wider text-slate-600 pointer-events-none">
              <span>1. Identidad</span>
              <span>2. Gobierno</span>
              <span>3. Asignación</span>
              <span>4. Comunidad</span>
              <span>5. Evaluación</span>
              <span>6. Cierre & Auditoría</span>
            </div>

          </div>
        </div>

      </div>

      <!-- Inspector Lateral de Nodo (3 Columnas en Desktop) -->
      <div class="lg:col-span-4 bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-6 shadow-xl">
        
        <div v-if="focusedMeta" class="space-y-5">
          
          <!-- Header del Módulo Enfocado -->
          <div class="pb-4 border-b border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                {{ focusedMeta.domain }}
              </span>
              <span class="text-xs font-black text-emerald-400">🟢 {{ focusedMeta.status }}</span>
            </div>
            
            <div class="flex items-center gap-3 pt-1">
              <div class="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <component :is="getModuleIcon(focusedMeta.icon)" :size="20" />
              </div>
              <div>
                <h3 class="text-lg font-black text-white leading-tight">{{ focusedMeta.name }}</h3>
                <p class="text-xs text-slate-400 font-bold">{{ focusedMeta.connectionsCount }} Conexiones Intermodulares</p>
              </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed font-medium pt-2">
              {{ focusedMeta.purpose }}
            </p>
          </div>

          <!-- Dependencias: Requiere antes de -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-black uppercase tracking-wider text-amber-400">
              <div class="flex items-center gap-1.5">
                <ArrowLeft :size="13" />
                <span>Depende de ({{ focusedMeta.dependsOn.length }})</span>
              </div>
              <span class="text-[10px] text-slate-500 font-normal">Entradas requeridas</span>
            </div>

            <div v-if="focusedMeta.dependsOn.length === 0" class="text-xs text-slate-500 italic p-2 rounded-xl bg-slate-950/40">
              Módulo fundacional sin dependencias previas.
            </div>
            <div v-else class="space-y-1 max-h-32 overflow-y-auto docs-scrollbar pr-1">
              <button
                v-for="depId in focusedMeta.dependsOn"
                :key="depId"
                @click="selectNode(depId)"
                class="w-full p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-all text-left group"
              >
                <span class="truncate">{{ MODULES_METADATA[depId]?.name || depId }}</span>
                <ArrowRight :size="12" class="text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
              </button>
            </div>
          </div>

          <!-- Impacto: Alimenta a -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-400">
              <div class="flex items-center gap-1.5">
                <ArrowRight :size="13" />
                <span>Alimenta a ({{ focusedMeta.affects.length }})</span>
              </div>
              <span class="text-[10px] text-slate-500 font-normal">Salidas consumidas</span>
            </div>

            <div v-if="focusedMeta.affects.length === 0" class="text-xs text-slate-500 italic p-2 rounded-xl bg-slate-950/40">
              Módulo terminal de consumo.
            </div>
            <div v-else class="space-y-1 max-h-32 overflow-y-auto docs-scrollbar pr-1">
              <button
                v-for="affId in focusedMeta.affects"
                :key="affId"
                @click="selectNode(affId)"
                class="w-full p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-all text-left group"
              >
                <span class="truncate">{{ MODULES_METADATA[affId]?.name || affId }}</span>
                <ArrowRight :size="12" class="text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
              </button>
            </div>
          </div>

          <!-- Tablas de BD Relacionadas -->
          <div class="space-y-2">
            <div class="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Database :size="13" />
              <span>Tablas SQL ({{ focusedMeta.tables.length }})</span>
            </div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="(t, idx) in focusedMeta.tables"
                :key="idx"
                class="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-cyan-300"
              >
                {{ t }}
              </span>
            </div>
          </div>

          <!-- Botones de Acción Directa -->
          <div class="pt-3 border-t border-slate-800 space-y-2">
            <button
              @click="$emit('view-doc', focusedMeta.id)"
              class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen :size="14" />
              <span>Leer Documentación Completa</span>
            </button>

            <button
              @click="$emit('view-summary', focusedMeta.id)"
              class="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Brain :size="14" />
              <span>Ver Ficha Ejecutiva</span>
            </button>
          </div>

        </div>

        <div v-else class="py-12 text-center text-slate-500 font-medium text-xs">
          Selecciona un nodo del grafo para inspeccionar sus dependencias.
        </div>

      </div>

    </div>

  </div>
</template>
