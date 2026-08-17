<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { 
  ShieldAlert, ShieldCheck, Check, X, Eye, 
  AlertCircle, History, User
} from 'lucide-vue-next'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const { confirm } = useConfirm()
const toast = useToast()


interface Supervision {
  id_auditoria: number
  id_admin_general: number
  id_colegio: number
  motivo_solicitud: string
  fecha_solicitud: string
  tipo_supervision: 'SOLO_LECTURA' | 'EDITOR'
  estado_supervision: 'SOLICITADA' | 'APROBADA' | 'ACTIVA' | 'FINALIZADA' | 'REVOCADA' | 'EXPIRADA'
  fecha_aprobacion?: string
  fecha_entrada?: string
  fecha_salida?: string
  duracion_maxima_minutos: number
  fecha_revocacion?: string
  admin_nombre: string
  admin_email: string
  directivo_nombre?: string
  directivo_apellido?: string
  directivo_revocador_nombre?: string
  directivo_revocador_apellido?: string
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

const loading = ref(true)
const supervisions = ref<Supervision[]>([])
const activeTab = ref<'pendientes' | 'activas' | 'historial' | 'rechazadas'>('pendientes')
const search = ref('')

// Action & Rejection Modals
const showRevocationModal = ref(false)
const revocationReason = ref('')
const selectedSupervision = ref<Supervision | null>(null)
const processingAction = ref(false)

// Audit Log Modals
const showActionsModal = ref(false)
const loadingActions = ref(false)
const actions = ref<AccionAuditoria[]>([])

// JSON viewer modal
const showJsonModal = ref(false)
const activeAction = ref<AccionAuditoria | null>(null)
const oldJson = ref<any>(null)
const newJson = ref<any>(null)

// Current School Context
const schoolId = computed(() => Number(auth.user?.schoolId || auth.selectedSchoolId || 0))

const fetchSupervisions = async () => {
  if (!schoolId.value) {
    loading.value = false
    return
  }
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const params: any = {}
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const res = await axios.get(`/api/admin/colegio/${schoolId.value}/supervisiones`, { headers, params })
    supervisions.value = res.data
  } catch (error) {
    console.error('Error fetching supervisions for school:', error)
  } finally {
    loading.value = false
  }
}

watch(() => yearStore.selectedYearId, () => {
  fetchSupervisions()
})

onMounted(() => {
  fetchSupervisions()
})

// Segmented computed lists
const filteredList = computed(() => {
  let list = supervisions.value
  
  if (activeTab.value === 'pendientes') {
    list = list.filter(s => s.estado_supervision === 'SOLICITADA')
  } else if (activeTab.value === 'activas') {
    list = list.filter(s => s.estado_supervision === 'APROBADA' || s.estado_supervision === 'ACTIVA')
  } else if (activeTab.value === 'historial') {
    list = list.filter(s => s.estado_supervision === 'FINALIZADA' || s.estado_supervision === 'EXPIRADA')
  } else if (activeTab.value === 'rechazadas') {
    list = list.filter(s => s.estado_supervision === 'REVOCADA')
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(s => 
      s.admin_nombre.toLowerCase().includes(q) ||
      s.admin_email.toLowerCase().includes(q) ||
      s.motivo_solicitud.toLowerCase().includes(q)
    )
  }

  return list
})

// Counts
const countPendientes = computed(() => supervisions.value.filter(s => s.estado_supervision === 'SOLICITADA').length)
const countActivas = computed(() => supervisions.value.filter(s => s.estado_supervision === 'APROBADA' || s.estado_supervision === 'ACTIVA').length)
const countHistorial = computed(() => supervisions.value.filter(s => s.estado_supervision === 'FINALIZADA' || s.estado_supervision === 'EXPIRADA').length)
const countRechazadas = computed(() => supervisions.value.filter(s => s.estado_supervision === 'REVOCADA').length)

// Approving
const handleApprove = async (sup: Supervision) => {
  if (yearStore.isReadonlyYear) {
    toast.error('Acción no permitida: El año lectivo seleccionado se encuentra CERRADO.')
    return
  }
  const ok = await confirm({
    title: 'Aprobar Solicitud de Supervisión',
    message: `¿Estás seguro de que deseas APROBAR la solicitud de supervisión de ${sup.admin_nombre}?`,
    confirmText: 'Aprobar Supervisión',
    type: 'primary'
  })
  if (!ok) return

  try {
    processingAction.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post(`/api/admin/supervision/${sup.id_auditoria}/aprobar`, {}, { headers })
    toast.success('Supervisión aprobada exitosamente. Se ha notificado al Administrador General.')
    await fetchSupervisions()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al aprobar la supervisión')
  } finally {
    processingAction.value = false
  }
}

// Rejecting or Revoking (Both map to setting REVOCADA with reason)
const openRejectOrRevoke = (sup: Supervision) => {
  if (yearStore.isReadonlyYear) {
    toast.error('Acción no permitida: El año lectivo seleccionado se encuentra CERRADO.')
    return
  }
  selectedSupervision.value = sup
  revocationReason.value = ''
  showRevocationModal.value = true
}

const handleRejectOrRevoke = async () => {
  if (yearStore.isReadonlyYear) {
    toast.error('Acción no permitida: El año lectivo seleccionado se encuentra CERRADO.')
    return
  }
  if (!selectedSupervision.value) return
  if (!revocationReason.value.trim()) {
    toast.warning('Por favor ingrese el motivo del rechazo o la revocación.')
    return
  }

  const isReject = selectedSupervision.value.estado_supervision === 'SOLICITADA'
  const actionText = isReject ? 'rechazar la solicitud' : 'revocar la supervisión activa'

  try {
    processingAction.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post(`/api/admin/supervision/${selectedSupervision.value.id_auditoria}/revocar`, {
      motivo: revocationReason.value
    }, { headers })
    
    toast.success(`Supervisión ${isReject ? 'rechazada' : 'revocada'} exitosamente.`)
    showRevocationModal.value = false
    selectedSupervision.value = null
    await fetchSupervisions()
  } catch (error: any) {
    toast.error(error.response?.data?.error || `Error al ${actionText}`)
  } finally {
    processingAction.value = false
  }
}


// Visualizing actions
const viewActions = async (sup: Supervision) => {
  selectedSupervision.value = sup
  showActionsModal.value = true
  try {
    loadingActions.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get(`/api/admin/supervision/${sup.id_auditoria}/acciones-directivo`, { headers })
    actions.value = res.data
  } catch (error) {
    console.error('Error fetching actions:', error)
  } finally {
    loadingActions.value = false
  }
}

const openJsonInspector = (action: AccionAuditoria) => {
  activeAction.value = action
  oldJson.value = typeof action.valor_antiguo === 'string' ? JSON.parse(action.valor_antiguo) : action.valor_antiguo
  newJson.value = typeof action.valor_nuevo === 'string' ? JSON.parse(action.valor_nuevo) : action.valor_nuevo
  showJsonModal.value = true
}
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <ShieldAlert :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Supervisiones de Auditoría</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Gestiona y audita las solicitudes de acceso por parte del Administrador General.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Error/Warning state when school context is missing -->
    <div v-if="!schoolId" class="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/60 p-6 rounded-3xl flex items-center gap-4 text-amber-900 dark:text-amber-300">
      <AlertCircle class="shrink-0" :size="24" />
      <div>
        <h3 class="font-bold">Sin Contexto de Colegio</h3>
        <p class="text-sm opacity-90">No hemos podido detectar tu colegio activo. Selecciona tu colegio en el panel o vuelve a iniciar sesión.</p>
      </div>
    </div>

    <template v-else>
      <!-- Alerta Informativa: Año Lectivo Cerrado (Modo Solo Lectura) -->
      <div v-if="yearStore.isReadonlyYear" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl p-5 flex items-center gap-4 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-200">
        <div class="p-3 bg-amber-500 text-white rounded-2xl shrink-0">
          <AlertCircle :size="24" />
        </div>
        <div class="text-sm">
          <h3 class="font-black uppercase tracking-wider text-xs">🔒 Año Lectivo {{ yearStore.selectedYear?.calendario }} — CERRADO (Histórico)</h3>
          <p class="text-xs opacity-90 mt-0.5">
            El año lectivo seleccionado se encuentra cerrado. Las solicitudes y sesiones de supervisión mostradas corresponden al historial de este ciclo escolar y no admiten nuevas aprobaciones o revocaciones.
          </p>
        </div>
      </div>

      <!-- Navigation & Tabs -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div class="flex flex-wrap gap-2">
          <button 
            @click="activeTab = 'pendientes'" 
            :class="[
              activeTab === 'pendientes' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
              'px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2'
            ]"
          >
            <span>Pendientes</span>
            <span :class="[activeTab === 'pendientes' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', 'px-2 py-0.5 rounded-lg text-xs font-bold']">
              {{ countPendientes }}
            </span>
          </button>

          <button 
            @click="activeTab = 'activas'" 
            :class="[
              activeTab === 'activas' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
              'px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2'
            ]"
          >
            <span>Activas</span>
            <span :class="[activeTab === 'activas' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', 'px-2 py-0.5 rounded-lg text-xs font-bold']">
              {{ countActivas }}
            </span>
          </button>

          <button 
            @click="activeTab = 'historial'" 
            :class="[
              activeTab === 'historial' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
              'px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2'
            ]"
          >
            <span>Historial</span>
            <span :class="[activeTab === 'historial' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', 'px-2 py-0.5 rounded-lg text-xs font-bold']">
              {{ countHistorial }}
            </span>
          </button>

          <button 
            @click="activeTab = 'rechazadas'" 
            :class="[
              activeTab === 'rechazadas' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
              'px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2'
            ]"
          >
            <span>Rechazadas/Revocadas</span>
            <span :class="[activeTab === 'rechazadas' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', 'px-2 py-0.5 rounded-lg text-xs font-bold']">
              {{ countRechazadas }}
            </span>
          </button>
        </div>

        <div class="relative w-full md:w-64 shrink-0">
          <input 
            v-model="search" 
            type="text" 
            placeholder="Buscar por motivo o admin..."
            class="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-white"
          />
        </div>
      </div>

      <!-- Main Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
        <div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p class="mt-4 text-sm text-slate-400 font-medium">Cargando supervisiones...</p>
      </div>

      <!-- Content Empty State -->
      <div v-else-if="filteredList.length === 0" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 text-slate-400">
        <History :size="48" class="opacity-30 mb-4" />
        <h3 class="font-bold text-slate-700 dark:text-slate-300">No se encontraron supervisiones</h3>
        <p class="text-sm opacity-80 mt-1">No hay registros que coincidan con los filtros seleccionados.</p>
      </div>

      <!-- Table View -->
      <div v-else class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900">
                <th class="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Administrador General</th>
                <th class="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Tipo Acceso</th>
                <th class="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Motivo Solicitud</th>
                <th class="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Duración Max</th>
                <th class="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Estado / Fechas</th>
                <th class="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              <tr 
                v-for="sup in filteredList" 
                :key="sup.id_auditoria"
                class="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <!-- Admin details -->
                <td class="py-4 px-6">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <User :size="16" />
                    </div>
                    <div>
                      <h4 class="font-bold text-slate-950 dark:text-white text-sm leading-snug">{{ sup.admin_nombre }}</h4>
                      <p class="text-xs text-slate-400 leading-snug font-mono">{{ sup.admin_email }}</p>
                    </div>
                  </div>
                </td>

                <!-- Type of Supervision -->
                <td class="py-4 px-6">
                  <span 
                    :class="[
                      sup.tipo_supervision === 'EDITOR' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400',
                      'px-3 py-1.5 rounded-xl text-xs font-bold'
                    ]"
                  >
                    {{ sup.tipo_supervision === 'EDITOR' ? 'Editor' : 'Solo Lectura' }}
                  </span>
                </td>

                <!-- Motivo -->
                <td class="py-4 px-6 max-w-xs">
                  <p class="text-sm text-slate-600 dark:text-slate-300 font-medium truncate">{{ sup.motivo_solicitud }}</p>
                </td>

                <!-- Max duration -->
                <td class="py-4 px-6 text-sm text-slate-600 dark:text-slate-300 font-semibold font-mono">
                  {{ sup.duracion_maxima_minutos }} min
                </td>

                <!-- Status & timestamps -->
                <td class="py-4 px-6">
                  <div class="space-y-1">
                    <span 
                      :class="[
                        sup.estado_supervision === 'SOLICITADA' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' : '',
                        sup.estado_supervision === 'APROBADA' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400' : '',
                        sup.estado_supervision === 'ACTIVA' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-none animate-pulse' : '',
                        sup.estado_supervision === 'FINALIZADA' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : '',
                        sup.estado_supervision === 'EXPIRADA' ? 'bg-slate-100 text-slate-400 dark:bg-slate-800/50' : '',
                        sup.estado_supervision === 'REVOCADA' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : '',
                        'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-block font-mono'
                      ]"
                    >
                      {{ sup.estado_supervision }}
                    </span>
                    <div class="text-[10px] text-slate-400 font-medium font-mono">
                      <span>Solicitado: {{ new Date(sup.fecha_solicitud).toLocaleDateString() }}</span>
                    </div>
                  </div>
                </td>

                <!-- Actions -->
                <td class="py-4 px-6 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <!-- Actions for PENDING request -->
                    <template v-if="sup.estado_supervision === 'SOLICITADA'">
                      <button 
                        @click="handleApprove(sup)" 
                        :disabled="processingAction"
                        class="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-xl transition-all"
                        title="Aprobar Solicitud"
                      >
                        <Check :size="16" />
                      </button>
                      <button 
                        @click="openRejectOrRevoke(sup)" 
                        :disabled="processingAction"
                        class="p-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/30 rounded-xl transition-all"
                        title="Rechazar Solicitud"
                      >
                        <X :size="16" />
                      </button>
                    </template>

                    <!-- Actions for ACTIVE / APPROVED supervision -->
                    <template v-else-if="sup.estado_supervision === 'APROBADA' || sup.estado_supervision === 'ACTIVA'">
                      <button 
                        @click="openRejectOrRevoke(sup)" 
                        :disabled="processingAction"
                        class="px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-xs font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-950/30 transition-all flex items-center gap-1.5"
                        title="Revocar Acceso"
                      >
                        <ShieldCheck :size="14" />
                        <span>Revocar</span>
                      </button>
                    </template>

                    <!-- Actions for HISTORY -->
                    <template v-else-if="sup.estado_supervision === 'FINALIZADA' || sup.estado_supervision === 'EXPIRADA'">
                      <button 
                        @click="viewActions(sup)"
                        class="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 text-xs font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/30 transition-all flex items-center gap-1.5"
                      >
                        <Eye :size="14" />
                        <span>Ver Auditoría</span>
                      </button>
                    </template>

                    <!-- Actions for REVOKED -->
                    <template v-else-if="sup.estado_supervision === 'REVOCADA'">
                      <span class="text-xs text-slate-400 dark:text-slate-500 font-bold block max-w-[200px] truncate text-right">
                        Revocado por {{ sup.directivo_revocador_nombre || 'Directivo' }}
                      </span>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Modals (Using Teleport) -->
    <Teleport to="body">
      <!-- Reject / Revoke Reason Modal -->
      <div v-if="showRevocationModal && selectedSupervision" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showRevocationModal = false"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 p-8 space-y-6">
          <div class="flex items-start gap-4">
            <div class="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl text-red-600 dark:text-red-400 shrink-0">
              <ShieldAlert :size="24" />
            </div>
            <div>
              <h3 class="text-lg font-black text-slate-900 dark:text-white">
                {{ selectedSupervision.estado_supervision === 'SOLICITADA' ? 'Rechazar Solicitud' : 'Revocar Supervisión' }}
              </h3>
              <p class="text-sm text-slate-400 mt-1">
                {{ selectedSupervision.estado_supervision === 'SOLICITADA' 
                  ? 'Por favor, ingrese el motivo del rechazo. Este motivo le será enviado por correo al administrador.' 
                  : 'Esta acción cancelará inmediatamente el acceso de supervisión y cerrará su sesión de rector heredada.' }}
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-wider">Motivo / Razón</label>
            <textarea 
              v-model="revocationReason" 
              rows="3" 
              placeholder="Describa el motivo..."
              class="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-white"
            ></textarea>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button 
              @click="showRevocationModal = false" 
              class="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              @click="handleRejectOrRevoke" 
              :disabled="processingAction"
              class="px-5 py-3 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
            >
              <span v-if="processingAction" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Confirmar</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Audit Trail Actions List Modal -->
      <div v-if="showActionsModal && selectedSupervision" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showActionsModal = false"></div>
        <div class="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh]">
          <!-- Header -->
          <div class="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900 shrink-0">
            <div class="flex items-center gap-4">
              <div class="p-3.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <History :size="24" />
              </div>
              <div>
                <h3 class="text-lg font-black text-slate-900 dark:text-white leading-tight">Bitácora de Cambios de Supervisión</h3>
                <p class="text-sm text-slate-400 font-medium">Auditoría #{{ selectedSupervision.id_auditoria }} • Realizado por: {{ selectedSupervision.admin_nombre }}</p>
              </div>
            </div>
            <button 
              @click="showActionsModal = false" 
              class="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <X :size="20" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-8 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
            <!-- Loader -->
            <div v-if="loadingActions" class="flex flex-col items-center justify-center py-20">
              <div class="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p class="mt-3 text-xs text-slate-400 font-medium">Cargando bitácora de acciones...</p>
            </div>

            <!-- Empty audit trail -->
            <div v-else-if="actions.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShieldCheck :size="48" class="opacity-20 mb-3" />
              <p class="font-bold">No se registraron acciones o cambios durante esta supervisión</p>
            </div>

            <!-- Actions list -->
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
                  <p class="text-blue-900 dark:text-blue-400 font-bold">Motivo de la modificación: <span class="font-medium text-slate-700 dark:text-slate-300 block mt-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">{{ act.motivo_cambio || 'No especificado' }}</span></p>
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
