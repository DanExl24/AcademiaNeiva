<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { 
  History, Search, Eye, Download, Calendar, Clock, ShieldCheck, Info
} from 'lucide-vue-next'

const auth = useAuthStore()

interface Supervision {
  id_auditoria: number
  id_colegio: number
  colegio_nombre: string
  motivo_solicitud: string
  fecha_solicitud: string
  tipo_supervision: 'SOLO_LECTURA' | 'EDITOR'
  estado_supervision: 'FINALIZADA' | 'REVOCADA' | 'EXPIRADA'
  duracion_maxima_minutos: number
  fecha_entrada: string
  fecha_salida: string
  directivo_nombre?: string
  directivo_apellido?: string
  directivo_revocador_nombre?: string
  directivo_revocador_apellido?: string
  motivo_revocacion?: string
  admin_nombre?: string
  admin_email?: string
  total_acciones?: number
}

interface AccionAuditoria {
  id_accion: number
  fecha_accion: string
  modulo: string
  tipo_accion: 'LECTURA' | 'CREACION' | 'MODIFICACION' | 'ELIMINACION' | 'EXPORTACION'
  accion: string
  recurso_afectado: string
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
const history = ref<Supervision[]>([])
const schools = ref<ColegioBrief[]>([])

const selectedSchool = ref('')
const selectedEstado = ref('')
const search = ref('')

// Modals
const showActionsModal = ref(false)
const loadingActions = ref(false)
const selectedSupervision = ref<Supervision | null>(null)
const actions = ref<AccionAuditoria[]>([])

// JSON inspector
const showJsonModal = ref(false)
const oldJson = ref<any>(null)
const newJson = ref<any>(null)
const activeAction = ref<AccionAuditoria | null>(null)

const fetchSchools = async () => {
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('http://localhost:3000/api/admin/colegios', { headers })
    schools.value = res.data.map((c: any) => ({ id_colegio: c.id_colegio, nombre: c.nombre }))
  } catch (error) {
    console.error('Error fetching schools:', error)
  }
}

const fetchHistory = async () => {
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('http://localhost:3000/api/admin/supervision/historial', {
      headers,
      params: {
        id_colegio: selectedSchool.value || undefined,
        estado: selectedEstado.value || undefined
      }
    })
    // Filter to only show closed states
    history.value = res.data.filter((r: any) => 
      r.estado_supervision === 'FINALIZADA' || 
      r.estado_supervision === 'REVOCADA' || 
      r.estado_supervision === 'EXPIRADA'
    )
  } catch (error) {
    console.error('Error fetching supervision history:', error)
  } finally {
    loading.value = false
  }
}

watch([selectedSchool, selectedEstado], () => {
  fetchHistory()
})

onMounted(() => {
  fetchSchools()
  fetchHistory()
})

const viewActions = async (sup: Supervision) => {
  selectedSupervision.value = sup
  showActionsModal.value = true
  try {
    loadingActions.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get(`http://localhost:3000/api/admin/supervision/${sup.id_auditoria}/acciones`, { headers })
    actions.value = res.data
  } catch (error) {
    console.error('Error fetching actions:', error)
  } finally {
    loadingActions.value = false
  }
}

const openJsonInspector = (action: AccionAuditoria) => {
  activeAction.value = action
  oldJson.value = action.valor_antiguo
  newJson.value = action.valor_nuevo
  showJsonModal.value = true
}

const handleExport = async (sup: Supervision) => {
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.post(`http://localhost:3000/api/admin/supervision/${sup.id_auditoria}/exportar`, {}, { headers })
    
    // Create download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `auditoria_supervision_${sup.id_auditoria}_${sup.colegio_nombre.replace(/\s+/g, '_')}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    
    alert('Auditoría exportada y descargada exitosamente.')
    if (selectedSupervision.value?.id_auditoria === sup.id_auditoria) {
      // Refresh actions trail as export gets logged as a new action!
      await viewActions(sup)
    }
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al exportar auditoría')
  }
}
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <History :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Historial de Supervisiones</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Revisa las supervisiones completadas, inspecciona sus bitácoras de cambios y exporta auditorías.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
        <input 
          v-model="search" 
          type="text" 
          placeholder="Filtrar por nombre de colegio..."
          class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none text-slate-900 dark:text-white"
        />
      </div>

      <div class="flex gap-3">
        <!-- School selector -->
        <select v-model="selectedSchool" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer max-w-[200px]">
          <option value="">Todas las instituciones</option>
          <option v-for="school in schools" :key="school.id_colegio" :value="school.id_colegio">{{ school.nombre }}</option>
        </select>

        <!-- Status selector -->
        <select v-model="selectedEstado" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer min-w-[150px]">
          <option value="">Todos los cierres</option>
          <option value="FINALIZADA">Finalizadas</option>
          <option value="REVOCADA">Revocadas</option>
          <option value="EXPIRADA">Expiradas</option>
        </select>
      </div>
    </div>

    <!-- History List -->
    <div class="space-y-4">
      <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
        <span class="animate-pulse font-bold">Cargando historial...</span>
      </div>

      <div v-else-if="history.length === 0" class="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-800">
        <History class="mx-auto mb-4 text-slate-300 dark:text-slate-700" :size="48" />
        <p class="font-bold text-slate-500">No hay registros en el historial de supervisión</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          v-for="sup in history" 
          :key="sup.id_auditoria"
          class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div class="space-y-4">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black text-slate-900 dark:text-white text-lg leading-tight">{{ sup.colegio_nombre }}</h3>
                <p class="text-xs text-indigo-500 font-bold uppercase mt-0.5 tracking-wider">{{ sup.tipo_supervision === 'EDITOR' ? 'Modo Editor' : 'Solo Lectura' }}</p>
              </div>
              <span 
                :class="[
                  sup.estado_supervision === 'FINALIZADA' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : '',
                  sup.estado_supervision === 'REVOCADA' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : '',
                  sup.estado_supervision === 'EXPIRADA' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' : '',
                  'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider'
                ]"
              >
                {{ sup.estado_supervision }}
              </span>
            </div>

            <!-- Justification details -->
            <div class="text-xs space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
              <span class="font-black text-slate-400 uppercase tracking-wider text-[10px]">Motivo de la Supervisión</span>
              <p class="font-medium text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{{ sup.motivo_solicitud }}</p>
            </div>

            <!-- Revocation details -->
            <div v-if="sup.estado_supervision === 'REVOCADA'" class="text-xs space-y-1.5 bg-red-50/50 dark:bg-red-950/10 p-3 rounded-2xl border border-red-200/20 dark:border-red-900/30">
              <span class="font-black text-red-600 dark:text-red-400 uppercase tracking-wider text-[10px]">Motivo de la Revocación</span>
              <p class="font-medium text-red-950 dark:text-red-300 leading-relaxed">{{ sup.motivo_revocacion || 'No especificado' }}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Revocado por: <span class="text-slate-600 dark:text-slate-300">{{ sup.directivo_revocador_nombre }} {{ sup.directivo_revocador_apellido || '' }}</span></p>
            </div>

            <!-- Meta details -->
            <div class="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800/40 pt-4">
              <p class="flex items-center gap-1"><Calendar :size="13" /> Entrada: <span class="font-bold text-slate-800 dark:text-slate-300">{{ sup.fecha_entrada ? new Date(sup.fecha_entrada).toLocaleDateString() : 'N/A' }} {{ sup.fecha_entrada ? new Date(sup.fecha_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '' }}</span></p>
              <p class="flex items-center gap-1"><Clock :size="13" /> Salida: <span class="font-bold text-slate-800 dark:text-slate-300">{{ sup.fecha_salida ? new Date(sup.fecha_salida).toLocaleDateString() : 'N/A' }} {{ sup.fecha_salida ? new Date(sup.fecha_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '' }}</span></p>
              <p class="col-span-2">Aprobó: <span class="font-bold text-slate-800 dark:text-slate-300">{{ sup.directivo_nombre || 'N/A' }} {{ sup.directivo_apellido || '' }}</span></p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/50 pt-4 mt-6">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">
              Acciones: {{ sup.total_acciones ?? 0 }}
            </span>
            <div class="flex gap-2">
              <button @click="viewActions(sup)" class="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all">
                <Eye :size="14" />
                Bitácora
              </button>
              <button @click="handleExport(sup)" class="flex items-center gap-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all">
                <Download :size="14" />
                Exportar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <!-- Actions Trail Modal -->
      <div v-if="showActionsModal && selectedSupervision" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showActionsModal = false"></div>
        <div class="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
            <div>
              <h2 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck :size="24" class="text-indigo-600" />
                Acciones Realizadas
              </h2>
              <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Supervisión en {{ selectedSupervision.colegio_nombre }}</p>
            </div>
            <button @click="handleExport(selectedSupervision)" class="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md">
              <Download :size="14" />
              Exportar Todo
            </button>
          </div>

          <!-- Actions List -->
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <div v-if="loadingActions" class="h-full flex items-center justify-center text-slate-400">
              <span class="animate-pulse font-bold">Cargando bitácora...</span>
            </div>

            <div v-else-if="actions.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400">
              <Info :size="48" class="opacity-20 mb-4" />
              <p class="font-bold">No se registraron acciones durante este periodo de supervisión</p>
            </div>

            <div v-else class="space-y-4">
              <div 
                v-for="act in actions" 
                :key="act.id_accion"
                class="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60 p-5 rounded-2xl space-y-3"
              >
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div class="flex items-start gap-2.5">
                    <span 
                      :class="[
                        act.tipo_accion === 'CREACION' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : '',
                        act.tipo_accion === 'MODIFICACION' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' : '',
                        act.tipo_accion === 'ELIMINACION' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : '',
                        act.tipo_accion === 'LECTURA' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : '',
                        act.tipo_accion === 'EXPORTACION' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' : '',
                        'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider block font-mono shrink-0'
                      ]"
                    >
                      {{ act.tipo_accion }}
                    </span>
                    <div>
                      <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ act.accion }}</h4>
                      <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5 font-mono">Módulo: {{ act.modulo }}</p>
                    </div>
                  </div>
                  <div class="text-right text-xs text-slate-400 font-mono">
                    {{ new Date(act.fecha_accion).toLocaleString() }}
                  </div>
                </div>

                <div class="text-xs space-y-1.5 border-t border-slate-100 dark:border-slate-800/40 pt-3">
                  <p class="text-slate-500 font-bold">Recurso afectado: <span class="font-semibold text-slate-800 dark:text-slate-200">{{ act.recurso_afectado }}</span></p>
                  <p v-if="act.usuario_afectado_nombre" class="text-slate-500 font-bold">Usuario afectado: <span class="font-semibold text-slate-800 dark:text-slate-200">{{ act.usuario_afectado_nombre }} ({{ act.usuario_afectado_email }})</span></p>
                </div>

                <!-- Motivo de cambio / JSON visualizer -->
                <div v-if="act.tipo_accion === 'MODIFICACION'" class="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/30 p-3 rounded-xl text-xs space-y-2">
                  <p class="text-blue-900 dark:text-blue-400 font-bold">Motivo de la modificación: <span class="font-medium text-slate-700 dark:text-slate-300 block mt-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">{{ act.motivo_cambio }}</span></p>
                  <button @click="openJsonInspector(act)" class="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider underline">Ver valores antes / después</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0 bg-slate-50/50 dark:bg-slate-900">
            <button @click="showActionsModal = false" class="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-bold text-sm hover:translate-y-[-2px] transition-all">Cerrar Bitácora</button>
          </div>
        </div>
      </div>

      <!-- JSON Inspector Modal -->
      <div v-if="showJsonModal && activeAction" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showJsonModal = false"></div>
        <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800">
          <div class="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-lg font-black text-slate-900 dark:text-white">Cambios en el Registro</h3>
            <p class="text-xs text-slate-400 font-medium mt-0.5">{{ activeAction.accion }}</p>
          </div>
          
          <div class="p-6 grid grid-cols-2 gap-4 h-[400px] overflow-hidden">
            <div class="flex flex-col h-full">
              <span class="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Valor Anterior</span>
              <pre class="flex-1 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl text-[10px] font-mono text-slate-800 dark:text-slate-200 overflow-auto border border-slate-100 dark:border-slate-800">{{ JSON.stringify(oldJson, null, 2) }}</pre>
            </div>
            <div class="flex flex-col h-full">
              <span class="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Valor Nuevo</span>
              <pre class="flex-1 bg-indigo-50/20 dark:bg-indigo-950/10 p-4 rounded-2xl text-[10px] font-mono text-indigo-950 dark:text-indigo-200 overflow-auto border border-indigo-100/20 dark:border-indigo-900/30">{{ JSON.stringify(newJson, null, 2) }}</pre>
            </div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex justify-end border-t border-slate-100 dark:border-slate-800">
            <button @click="showJsonModal = false" class="px-6 py-2.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-bold text-xs">Cerrar Visor</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
