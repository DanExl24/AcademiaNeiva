<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { adminGeneralService } from '../../services/adminGeneralService'
import { 
  FileText, Search, Download, User, Eye, ShieldCheck, Building2, Calendar, 
  Layers, ArrowRight, X, Info
} from 'lucide-vue-next'
import EmptyState from '../../components/feedback/EmptyState.vue'

const props = defineProps<{
  tipo: 'LECTURA' | 'MODIFICACION' | 'EXPORTACION'
}>()

interface AccionAuditoria {
  id_accion: number
  id_auditoria: number
  fecha_accion: string
  modulo: string
  tipo_accion: 'LECTURA' | 'CREACION' | 'MODIFICACION' | 'ELIMINACION' | 'EXPORTACION'
  accion: string
  recurso_afectado: string
  colegio_nombre: string
  admin_nombre: string
  admin_email: string
  usuario_afectado_nombre?: string
  usuario_afectado_email?: string
  valor_antiguo?: any
  valor_nuevo?: any
  motivo_cambio?: string
}

interface GrupoAuditoria {
  id_auditoria: number
  colegio_nombre: string
  admin_nombre: string
  admin_email: string
  primera_fecha: string
  ultima_fecha: string
  modulos: string[]
  conteo_tipos: Record<string, number>
  total_acciones: number
  acciones: AccionAuditoria[]
}

interface ColegioBrief {
  id_colegio: number
  nombre: string
}

const loading = ref(true)
const rawActions = ref<AccionAuditoria[]>([])
const schools = ref<ColegioBrief[]>([])

const selectedSchool = ref('')
const search = ref('')

// Modal de detalles de auditoría agrupada
const showAuditModal = ref(false)
const selectedGroup = ref<GrupoAuditoria | null>(null)
const modalSearch = ref('')

// JSON inspector modal
const showJsonModal = ref(false)
const oldJson = ref<any>(null)
const newJson = ref<any>(null)
const activeAction = ref<AccionAuditoria | null>(null)

const fetchSchools = async () => {
  try {
    const data = await adminGeneralService.getColegios()
    schools.value = (data || []).map((c: any) => ({ id_colegio: c.id_colegio, nombre: c.nombre }))
  } catch (error) {
    console.error('Error fetching schools:', error)
  }
}

const fetchActions = async () => {
  try {
    loading.value = true
    const params = {
      tipo_accion: props.tipo === 'MODIFICACION' ? undefined : props.tipo,
      id_colegio: selectedSchool.value || undefined,
      search: search.value || undefined
    }
    const data = await adminGeneralService.getAuditorias(params)
    
    // Si la prop es MODIFICACION, filtramos acciones de escritura (CREACION, MODIFICACION, ELIMINACION)
    if (props.tipo === 'MODIFICACION') {
      rawActions.value = (data || []).filter((a: any) => 
        a.tipo_accion === 'CREACION' || 
        a.tipo_accion === 'MODIFICACION' || 
        a.tipo_accion === 'ELIMINACION'
      )
    } else {
      rawActions.value = data || []
    }
  } catch (error) {
    console.error('Error fetching audit actions:', error)
  } finally {
    loading.value = false
  }
}

// Agrupación de acciones por ID de Auditoría
const groupedAuditorias = computed<GrupoAuditoria[]>(() => {
  const map = new Map<number, GrupoAuditoria>()

  for (const act of rawActions.value) {
    if (!map.has(act.id_auditoria)) {
      map.set(act.id_auditoria, {
        id_auditoria: act.id_auditoria,
        colegio_nombre: act.colegio_nombre || 'Institución no identificada',
        admin_nombre: act.admin_nombre || 'Administrador General',
        admin_email: act.admin_email || '',
        primera_fecha: act.fecha_accion,
        ultima_fecha: act.fecha_accion,
        modulos: [act.modulo].filter(Boolean),
        conteo_tipos: { [act.tipo_accion]: 1 },
        total_acciones: 1,
        acciones: [act]
      })
    } else {
      const group = map.get(act.id_auditoria)!
      group.total_acciones++
      group.acciones.push(act)
      if (act.modulo && !group.modulos.includes(act.modulo)) {
        group.modulos.push(act.modulo)
      }
      group.conteo_tipos[act.tipo_accion] = (group.conteo_tipos[act.tipo_accion] || 0) + 1
      if (new Date(act.fecha_accion) < new Date(group.primera_fecha)) {
        group.primera_fecha = act.fecha_accion
      }
      if (new Date(act.fecha_accion) > new Date(group.ultima_fecha)) {
        group.ultima_fecha = act.fecha_accion
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.ultima_fecha).getTime() - new Date(a.ultima_fecha).getTime()
  )
})

// Acciones filtradas dentro del modal de detalle
const modalFilteredActions = computed(() => {
  if (!selectedGroup.value) return []
  if (!modalSearch.value.trim()) return selectedGroup.value.acciones

  const term = modalSearch.value.toLowerCase().trim()
  return selectedGroup.value.acciones.filter(act => 
    (act.accion && act.accion.toLowerCase().includes(term)) ||
    (act.modulo && act.modulo.toLowerCase().includes(term)) ||
    (act.recurso_afectado && act.recurso_afectado.toLowerCase().includes(term)) ||
    (act.motivo_cambio && act.motivo_cambio.toLowerCase().includes(term))
  )
})

watch([selectedSchool, search, () => props.tipo], () => {
  fetchActions()
})

onMounted(() => {
  fetchSchools()
  fetchActions()
})

const openAuditDetails = (group: GrupoAuditoria) => {
  selectedGroup.value = group
  modalSearch.value = ''
  showAuditModal.value = true
}

const openJsonInspector = (action: AccionAuditoria) => {
  activeAction.value = action
  oldJson.value = action.valor_antiguo
  newJson.value = action.valor_nuevo
  showJsonModal.value = true
}

const handleExportRecord = (action: AccionAuditoria) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(action, null, 2))
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute("href", dataStr)
  downloadAnchor.setAttribute("download", `auditoria_registro_${action.id_accion}.json`)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  downloadAnchor.remove()
}

const handleExportGroup = (group: GrupoAuditoria) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(group, null, 2))
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute("href", dataStr)
  downloadAnchor.setAttribute("download", `auditoria_sesion_${group.id_auditoria}_${group.colegio_nombre.replace(/\s+/g, '_')}.json`)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  downloadAnchor.remove()
}

const exportAllToCSV = () => {
  if (rawActions.value.length === 0) return

  const headers = [
    'ID Accion',
    'ID Auditoria',
    'Fecha',
    'Tipo Accion',
    'Modulo',
    'Accion Realizada',
    'Recurso Afectado',
    'Colegio',
    'Admin Nombre',
    'Admin Email',
    'Usuario Afectado',
    'Usuario Afectado Email',
    'Motivo Cambio'
  ]

  const rows = rawActions.value.map(act => [
    act.id_accion,
    act.id_auditoria,
    new Date(act.fecha_accion).toLocaleString(),
    act.tipo_accion,
    act.modulo,
    `"${(act.accion || '').replace(/"/g, '""')}"`,
    `"${(act.recurso_afectado || '').replace(/"/g, '""')}"`,
    `"${(act.colegio_nombre || '').replace(/"/g, '""')}"`,
    `"${(act.admin_nombre || '').replace(/"/g, '""')}"`,
    `"${(act.admin_email || '').replace(/"/g, '""')}"`,
    `"${(act.usuario_afectado_nombre || '').replace(/"/g, '""')}"`,
    `"${(act.usuario_afectado_email || '').replace(/"/g, '""')}"`,
    `"${(act.motivo_cambio || '').replace(/"/g, '""')}"`
  ])

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `auditorias_${props.tipo.toLowerCase()}_${new Date().toLocaleDateString()}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-16">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-4 sm:px-8 py-6 sm:py-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <FileText :size="26" class="sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              Bitácora de Auditoría — {{ props.tipo === 'LECTURA' ? 'Consultas y Lecturas' : props.tipo === 'MODIFICACION' ? 'Escritura y Modificaciones' : 'Exportaciones de Datos' }}
            </h1>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Sesiones de supervisión agrupadas con el registro consolidado de acciones y consultas.
            </p>
          </div>
        </div>
        <button 
          v-if="rawActions.length > 0"
          @click="exportAllToCSV"
          class="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0 cursor-pointer self-stretch sm:self-start md:self-auto"
        >
          <Download :size="16" />
          Exportar CSV Global
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
        <input 
          v-model="search" 
          type="text" 
          placeholder="Buscar por descripción, recurso, administrador o módulo..."
          class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 sm:py-3 pl-10 sm:pl-11 pr-4 text-xs sm:text-sm font-medium outline-none text-slate-900 dark:text-white"
        />
      </div>

      <!-- School selector -->
      <select v-model="selectedSchool" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer w-full sm:w-auto min-w-[200px]">
        <option value="">Todas las instituciones</option>
        <option v-for="school in schools" :key="school.id_colegio" :value="school.id_colegio">{{ school.nombre }}</option>
      </select>
    </div>

    <!-- Cards grouped by Audit Session -->
    <div class="space-y-4">
      <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800">
        <span class="animate-pulse font-bold text-xs sm:text-sm">Cargando registros de auditoría...</span>
      </div>

      <EmptyState 
        v-else-if="groupedAuditorias.length === 0"
        title="No hay auditorías registradas"
        description="No se encontraron sesiones de supervisión con acciones registradas para los filtros seleccionados."
      >
        <template #icon>
          <FileText class="w-8 h-8 text-indigo-500" />
        </template>
      </EmptyState>

      <div v-else class="grid grid-cols-1 gap-4 sm:gap-5">
        <div 
          v-for="group in groupedAuditorias" 
          :key="group.id_auditoria"
          class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div class="space-y-4 sm:space-y-5">
            <!-- Header Card: ID, Colegio & Action count -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/60">
              <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-mono text-xs sm:text-sm font-black rounded-lg border border-indigo-100/60 dark:border-indigo-800/40 shrink-0">
                  Auditoría #{{ group.id_auditoria }}
                </span>
                <div class="min-w-0">
                  <h3 class="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-tight truncate flex items-center gap-2">
                    <Building2 :size="16" class="text-slate-400 shrink-0" />
                    <span>{{ group.colegio_nombre }}</span>
                  </h3>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <span class="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs font-black rounded-full uppercase tracking-wider">
                  {{ group.total_acciones }} {{ group.total_acciones === 1 ? 'acción registrada' : 'acciones registradas' }}
                </span>
              </div>
            </div>

            <!-- Details: Supervisor & Dates -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4 text-xs">
              <div class="space-y-1 bg-slate-50/70 dark:bg-slate-800/30 p-3 sm:p-3.5 rounded-xl border border-slate-100/70 dark:border-slate-800/50">
                <p class="text-slate-400 font-black uppercase tracking-wider text-[10px]">Supervisado Por</p>
                <p class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs sm:text-sm truncate">
                  <User :size="14" class="text-indigo-500 shrink-0" />
                  <span class="truncate">{{ group.admin_nombre }}</span>
                </p>
                <p class="text-[11px] text-slate-400 font-medium truncate">{{ group.admin_email }}</p>
              </div>

              <div class="space-y-1 bg-slate-50/70 dark:bg-slate-800/30 p-3 sm:p-3.5 rounded-xl border border-slate-100/70 dark:border-slate-800/50">
                <p class="text-slate-400 font-black uppercase tracking-wider text-[10px]">Fecha de Operaciones</p>
                <p class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Calendar :size="14" class="text-indigo-500 shrink-0" />
                  <span>{{ new Date(group.ultima_fecha).toLocaleDateString() }}</span>
                </p>
                <p class="text-[11px] text-slate-400 font-medium">
                  {{ new Date(group.primera_fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                  <span v-if="group.primera_fecha !== group.ultima_fecha"> - {{ new Date(group.ultima_fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                </p>
              </div>

              <div class="space-y-1 bg-slate-50/70 dark:bg-slate-800/30 p-3 sm:p-3.5 rounded-xl border border-slate-100/70 dark:border-slate-800/50 sm:col-span-2 md:col-span-1">
                <p class="text-slate-400 font-black uppercase tracking-wider text-[10px]">Módulos Afectados</p>
                <div class="flex flex-wrap gap-1.5 pt-0.5">
                  <span 
                    v-for="mod in group.modulos" 
                    :key="mod"
                    class="px-2 py-0.5 bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-md uppercase font-mono"
                  >
                    {{ mod }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Preview of latest 2 actions -->
            <div class="space-y-2 pt-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers :size="12" /> Vista previa de acciones recientes en esta sesión:
              </span>
              <div class="space-y-1.5">
                <div 
                  v-for="previewAct in group.acciones.slice(0, 2)" 
                  :key="previewAct.id_accion"
                  class="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800/50"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span 
                      :class="[
                        previewAct.tipo_accion === 'CREACION' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : '',
                        previewAct.tipo_accion === 'MODIFICACION' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' : '',
                        previewAct.tipo_accion === 'ELIMINACION' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : '',
                        previewAct.tipo_accion === 'LECTURA' ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : '',
                        previewAct.tipo_accion === 'EXPORTACION' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' : '',
                        'px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider font-mono shrink-0'
                      ]"
                    >
                      {{ previewAct.tipo_accion }}
                    </span>
                    <span class="font-bold text-slate-800 dark:text-slate-200 truncate">{{ previewAct.accion }}</span>
                    <span class="text-slate-400 font-mono text-[10px] hidden md:inline truncate">({{ previewAct.recurso_afectado }})</span>
                  </div>
                  <span class="text-[10px] text-slate-400 font-mono shrink-0">
                    {{ new Date(previewAct.fecha_accion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                  </span>
                </div>
                <div v-if="group.acciones.length > 2" class="text-[11px] text-slate-400 font-medium pl-1">
                  + {{ group.acciones.length - 2 }} acción(es) más en esta auditoría...
                </div>
              </div>
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="flex flex-col sm:flex-row justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-4 mt-5 gap-3">
            <span class="text-[11px] text-slate-400 font-medium">
              Sesión de auditoría #{{ group.id_auditoria }}
            </span>
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <button 
                @click="handleExportGroup(group)" 
                class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Exportar archivo JSON con todas las acciones de esta auditoría"
              >
                <Download :size="14" />
                <span>Exportar Sesión</span>
              </button>
              <button 
                @click="openAuditDetails(group)" 
                class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Eye :size="14" />
                <span>Ver Detalles ({{ group.total_acciones }})</span>
                <ArrowRight :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <!-- Modal: Detalle Completo de Acciones de la Auditoría Agrupada -->
      <div v-if="showAuditModal && selectedGroup" class="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showAuditModal = false"></div>
        <div class="relative w-full max-w-4xl max-h-[92dvh] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          
          <!-- Modal Header -->
          <div class="px-5 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-black rounded">
                  Auditoría #{{ selectedGroup.id_auditoria }}
                </span>
                <span class="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  {{ selectedGroup.total_acciones }} acciones
                </span>
              </div>
              <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2 truncate">
                <ShieldCheck :size="20" class="text-indigo-600 shrink-0" />
                <span class="truncate">{{ selectedGroup.colegio_nombre }}</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Supervisado por: <span class="font-bold text-slate-700 dark:text-slate-300">{{ selectedGroup.admin_nombre }}</span> ({{ selectedGroup.admin_email }})
              </p>
            </div>

            <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button 
                @click="handleExportGroup(selectedGroup)" 
                class="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-sm cursor-pointer"
              >
                <Download :size="14" />
                <span>Exportar</span>
              </button>
              <button 
                @click="showAuditModal = false" 
                class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X :size="20" />
              </button>
            </div>
          </div>

          <!-- Internal Search Bar inside Modal -->
          <div class="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <div class="relative">
              <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="15" />
              <input 
                v-model="modalSearch" 
                type="text" 
                placeholder="Filtrar acciones dentro de esta auditoría por nombre, recurso, módulo..."
                class="w-full bg-slate-50 dark:bg-slate-800/60 border-none rounded-xl py-2 pl-10 pr-4 text-xs sm:text-sm font-medium outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <!-- Actions List inside Modal -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
            <EmptyState 
              v-if="modalFilteredActions.length === 0"
              title="Sin coincidencias"
              description="No hay acciones que coincidan con la búsqueda dentro de esta sesión."
            >
              <template #icon>
                <Info class="w-8 h-8 text-slate-400" />
              </template>
            </EmptyState>

            <div v-else class="space-y-3 sm:space-y-4">
              <div 
                v-for="act in modalFilteredActions" 
                :key="act.id_accion"
                class="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/70 p-4 sm:p-5 rounded-2xl space-y-3 hover:border-indigo-100 dark:hover:border-indigo-900/40 transition-all"
              >
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div class="flex items-start gap-2.5 min-w-0">
                    <span 
                      :class="[
                        act.tipo_accion === 'CREACION' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : '',
                        act.tipo_accion === 'MODIFICACION' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' : '',
                        act.tipo_accion === 'ELIMINACION' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : '',
                        act.tipo_accion === 'LECTURA' ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : '',
                        act.tipo_accion === 'EXPORTACION' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' : '',
                        'px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider block font-mono shrink-0'
                      ]"
                    >
                      {{ act.tipo_accion }}
                    </span>
                    <div class="min-w-0">
                      <h4 class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight break-words">{{ act.accion }}</h4>
                      <p class="text-[10px] sm:text-xs text-indigo-500 font-bold uppercase tracking-wider mt-0.5 font-mono truncate">Módulo: {{ act.modulo }}</p>
                    </div>
                  </div>
                  <div class="text-left sm:text-right text-[10px] sm:text-xs text-slate-400 font-mono shrink-0">
                    {{ new Date(act.fecha_accion).toLocaleString() }}
                  </div>
                </div>

                <div class="text-xs space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 pt-2.5 sm:pt-3">
                  <p class="text-slate-500 font-bold text-xs">
                    Recurso afectado: 
                    <span class="font-semibold text-slate-800 dark:text-slate-200 break-all">{{ act.recurso_afectado }}</span>
                  </p>
                  <p v-if="act.usuario_afectado_nombre" class="text-slate-500 font-bold text-xs truncate">
                    Usuario afectado: 
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ act.usuario_afectado_nombre }} ({{ act.usuario_afectado_email }})</span>
                  </p>
                </div>

                <!-- Motivo de cambio / JSON visualizer -->
                <div v-if="act.tipo_accion === 'MODIFICACION'" class="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/30 p-2.5 sm:p-3 rounded-xl text-xs space-y-2">
                  <p class="text-blue-900 dark:text-blue-400 font-bold text-xs">
                    Motivo de la modificación: 
                    <span class="font-medium text-slate-700 dark:text-slate-300 block mt-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 break-words">{{ act.motivo_cambio }}</span>
                  </p>
                  <button @click="openJsonInspector(act)" class="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider underline cursor-pointer">
                    Ver valores antes / después
                  </button>
                </div>

                <!-- Single action export button -->
                <div class="flex justify-end pt-1">
                  <button 
                    @click="handleExportRecord(act)" 
                    class="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Download :size="12" />
                    <span>Exportar Registro #{{ act.id_accion }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 shrink-0">
            <span class="text-xs text-slate-400 font-medium">
              Mostrando {{ modalFilteredActions.length }} de {{ selectedGroup.total_acciones }} acciones
            </span>
            <button 
              @click="showAuditModal = false" 
              class="px-5 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer hover:opacity-90 transition-opacity"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      </div>

      <!-- JSON Inspector Modal -->
      <div v-if="showJsonModal && activeAction" class="fixed inset-0 z-[120] flex items-center justify-center p-3.5 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showJsonModal = false"></div>
        <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90dvh] flex flex-col">
          <div class="px-5 sm:px-8 pt-5 sm:pt-8 pb-3.5 sm:pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">Cambios en el Registro</h3>
            <p class="text-xs text-slate-400 font-medium mt-0.5 truncate">{{ activeAction.accion }}</p>
          </div>
          
          <div class="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto flex-1">
            <div class="flex flex-col min-h-[160px] sm:min-h-[220px]">
              <span class="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2">Valor Anterior</span>
              <pre class="flex-1 bg-slate-50 dark:bg-slate-800/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-[10px] font-mono text-slate-800 dark:text-slate-200 overflow-auto border border-slate-100 dark:border-slate-800 max-h-[200px] sm:max-h-[300px]">{{ JSON.stringify(oldJson, null, 2) }}</pre>
            </div>
            <div class="flex flex-col min-h-[160px] sm:min-h-[220px]">
              <span class="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2">Valor Nuevo</span>
              <pre class="flex-1 bg-indigo-50/20 dark:bg-indigo-950/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-[10px] font-mono text-indigo-950 dark:text-indigo-200 overflow-auto border border-indigo-100/20 dark:border-indigo-900/30 max-h-[200px] sm:max-h-[300px]">{{ JSON.stringify(newJson, null, 2) }}</pre>
            </div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 flex justify-end border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button @click="showJsonModal = false" class="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer">Cerrar Visor</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
