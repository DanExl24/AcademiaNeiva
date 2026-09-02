<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { adminGeneralService } from '../../services/adminGeneralService'
import { 
  FileText, Search, Download, User
} from 'lucide-vue-next'

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

interface ColegioBrief {
  id_colegio: number
  nombre: string
}

const loading = ref(true)
const actions = ref<AccionAuditoria[]>([])
const schools = ref<ColegioBrief[]>([])

const selectedSchool = ref('')
const search = ref('')

// JSON inspector
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
    
    // If the prop is MODIFICACION, we fetch any action related to modifications (CREACION, MODIFICACION, ELIMINACION)
    if (props.tipo === 'MODIFICACION') {
      actions.value = (data || []).filter((a: any) => 
        a.tipo_accion === 'CREACION' || 
        a.tipo_accion === 'MODIFICACION' || 
        a.tipo_accion === 'ELIMINACION'
      )
    } else {
      actions.value = data || []
    }
  } catch (error) {
    console.error('Error fetching audit actions:', error)
  } finally {
    loading.value = false
  }
}


watch([selectedSchool, search, () => props.tipo], () => {
  fetchActions()
})

onMounted(() => {
  fetchSchools()
  fetchActions()
})

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

const exportAllToCSV = () => {
  if (actions.value.length === 0) return

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

  const rows = actions.value.map(act => [
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
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Trazabilidad en tiempo real sobre las operaciones realizadas bajo supervisión.</p>
          </div>
        </div>
        <button 
          v-if="actions.length > 0"
          @click="exportAllToCSV"
          class="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0 cursor-pointer self-stretch sm:self-start md:self-auto"
        >
          <Download :size="16" />
          Exportar CSV
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
          placeholder="Buscar por descripción, recurso, administrador..."
          class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 sm:py-3 pl-10 sm:pl-11 pr-4 text-xs sm:text-sm font-medium outline-none text-slate-900 dark:text-white"
        />
      </div>

      <!-- School selector -->
      <select v-model="selectedSchool" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer w-full sm:w-auto min-w-[180px]">
        <option value="">Todas las instituciones</option>
        <option v-for="school in schools" :key="school.id_colegio" :value="school.id_colegio">{{ school.nombre }}</option>
      </select>
    </div>

    <!-- Log List -->
    <div class="space-y-3.5 sm:space-y-4">
      <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800">
        <span class="animate-pulse font-bold text-xs sm:text-sm">Cargando registros...</span>
      </div>

      <div v-else-if="actions.length === 0" class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-slate-100 dark:border-slate-800">
        <FileText class="mx-auto mb-3 sm:mb-4 text-slate-300 dark:text-slate-700" :size="40" />
        <p class="font-bold text-slate-500 text-xs sm:text-sm">No hay acciones registradas para esta categoría</p>
      </div>

      <div v-else class="space-y-3 sm:space-y-4">
        <div 
          v-for="act in actions" 
          :key="act.id_accion"
          class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all"
        >
          <div class="space-y-3 sm:space-y-4">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3">
              <div class="flex items-start gap-2 sm:gap-2.5">
                <span 
                  :class="[
                    act.tipo_accion === 'CREACION' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : '',
                    act.tipo_accion === 'MODIFICACION' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' : '',
                    act.tipo_accion === 'ELIMINACION' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : '',
                    act.tipo_accion === 'LECTURA' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : '',
                    act.tipo_accion === 'EXPORTACION' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' : '',
                    'px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider block font-mono shrink-0'
                  ]"
                >
                  {{ act.tipo_accion }}
                </span>
                <div class="min-w-0">
                  <h3 class="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-tight break-words">{{ act.accion }}</h3>
                  <p class="text-[10px] sm:text-xs text-indigo-500 font-bold uppercase tracking-wider mt-0.5 font-mono truncate">Módulo: {{ act.modulo }} · {{ act.colegio_nombre }}</p>
                </div>
              </div>
              
              <div class="text-left sm:text-right text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-mono shrink-0">
                {{ new Date(act.fecha_accion).toLocaleString() }}
              </div>
            </div>

            <!-- Recurso afectado & info admin -->
            <div class="text-xs space-y-2 border-t border-slate-50 dark:border-slate-800/40 pt-3 sm:pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div class="space-y-0.5 sm:space-y-1">
                <p class="text-slate-400 font-black uppercase tracking-wider text-[9px] sm:text-[10px]">Recurso</p>
                <p class="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm break-all">{{ act.recurso_afectado }}</p>
              </div>
              <div class="space-y-0.5 sm:space-y-1">
                <p class="text-slate-400 font-black uppercase tracking-wider text-[9px] sm:text-[10px]">Ejecutado Por</p>
                <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs sm:text-sm truncate"><User :size="13" class="shrink-0" /> <span class="truncate">{{ act.admin_nombre }} ({{ act.admin_email }})</span></p>
              </div>
              <div v-if="act.usuario_afectado_nombre" class="col-span-1 md:col-span-2 space-y-0.5 sm:space-y-1">
                <p class="text-slate-400 font-black uppercase tracking-wider text-[9px] sm:text-[10px]">Usuario Afectado</p>
                <p class="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">{{ act.usuario_afectado_nombre }} ({{ act.usuario_afectado_email }})</p>
              </div>
            </div>

            <!-- Motivo de cambio / JSON visualizer -->
            <div v-if="act.tipo_accion === 'MODIFICACION'" class="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-xs space-y-2 sm:space-y-3">
              <p class="text-blue-900 dark:text-blue-400 font-bold">Motivo de la modificación: <span class="font-medium text-slate-700 dark:text-slate-300 block mt-1 bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 break-words">{{ act.motivo_cambio }}</span></p>
              <button @click="openJsonInspector(act)" class="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider underline cursor-pointer">Ver valores antes / después</button>
            </div>
          </div>

          <!-- Actions footer -->
          <div class="flex justify-between items-center border-t border-slate-50 dark:border-slate-800/50 pt-3 sm:pt-4 mt-4 sm:mt-6 gap-2">
            <span class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">
              Auditoría ID: #{{ act.id_auditoria }}
            </span>
            <button @click="handleExportRecord(act)" class="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <Download :size="12" />
              <span class="hidden sm:inline">Exportar Registro</span>
              <span class="sm:hidden">Exportar</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
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
