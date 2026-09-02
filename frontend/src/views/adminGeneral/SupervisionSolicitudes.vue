<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supervisionService } from '../../services/supervisionService'
import { adminGeneralService } from '../../services/adminGeneralService'
import { useAuthStore } from '../../stores/auth'
import { 
  ShieldAlert, Plus, ShieldCheck, Clock, Lock, Play, AlertCircle
} from 'lucide-vue-next'
import EmptyState from '../../components/feedback/EmptyState.vue'


const auth = useAuthStore()
const router = useRouter()

interface Solicitud {
  id_auditoria: number
  id_colegio: number
  colegio_nombre: string
  motivo_solicitud: string
  fecha_solicitud: string
  tipo_supervision: 'SOLO_LECTURA' | 'EDITOR'
  estado_supervision: 'SOLICITADA' | 'APROBADA' | 'ACTIVA' | 'FINALIZADA' | 'REVOCADA' | 'EXPIRADA'
  duracion_maxima_minutos: number
  directivo_nombre?: string
  directivo_apellido?: string
  fecha_aprobacion?: string
}

interface ColegioBrief {
  id_colegio: number
  nombre: string
}

const loading = ref(true)
const requests = ref<Solicitud[]>([])
const activeSchools = ref<ColegioBrief[]>([])

// Modals
const showRequestModal = ref(false)
const showAuthModal = ref(false)
const saving = ref(false)
const authenticating = ref(false)

const selectedRequest = ref<Solicitud | null>(null)
const adminPassword = ref('')
const entryReason = ref('')

const configLimits = ref({
  minDuration: 5,
  maxDuration: 300
})

const form = ref({
  id_colegio: '',
  tipo_supervision: 'SOLO_LECTURA',
  duracion_maxima_minutos: 60,
  motivo: ''
})

const fetchConfigLimits = async () => {
  try {
    const data = await adminGeneralService.getConfiguracion()
    if (data.supervision_duracion_minima_minutos) {
      configLimits.value.minDuration = Number(data.supervision_duracion_minima_minutos.valor)
    }
    if (data.supervision_duracion_maxima_minutos) {
      configLimits.value.maxDuration = Number(data.supervision_duracion_maxima_minutos.valor)
    }
  } catch (error) {
    console.error('Error fetching config limits:', error)
  }
}

const fetchSchools = async () => {
  try {
    const data = await adminGeneralService.getColegios()
    activeSchools.value = (data || [])
      .filter((c: any) => c.estado === 'ACTIVO')
      .map((c: any) => ({ id_colegio: c.id_colegio, nombre: c.nombre }))
  } catch (error) {
    console.error('Error fetching active schools:', error)
  }
}

const fetchRequests = async () => {
  try {
    loading.value = true
    const data = await supervisionService.getHistorial()
    // Solicitudes are pending (SOLICITADA) or approved (APROBADA)
    requests.value = (data || []).filter((r: any) => r.estado_supervision === 'SOLICITADA' || r.estado_supervision === 'APROBADA')
  } catch (error) {
    console.error('Error fetching supervision requests:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchConfigLimits()
  fetchSchools()
  fetchRequests()
})

const openRequest = () => {
  form.value = {
    id_colegio: activeSchools.value[0]?.id_colegio ? String(activeSchools.value[0].id_colegio) : '',
    tipo_supervision: 'SOLO_LECTURA',
    duracion_maxima_minutos: configLimits.value.minDuration,
    motivo: ''
  }
  showRequestModal.value = true
}

const handleRequest = async () => {
  if (!form.value.id_colegio || !form.value.motivo.trim()) {
    alert('Por favor complete los campos obligatorios.')
    return
  }
  try {
    saving.value = true
    await supervisionService.solicitarSupervision({
      id_colegio: Number(form.value.id_colegio),
      tipo_supervision: form.value.tipo_supervision,
      duracion_maxima_minutos: Number(form.value.duracion_maxima_minutos),
      motivo: form.value.motivo
    })
    showRequestModal.value = false
    await fetchRequests()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al solicitar supervisión')
  } finally {
    saving.value = false
  }
}

const openAuth = (request: Solicitud) => {
  selectedRequest.value = request
  adminPassword.value = ''
  entryReason.value = request.motivo_solicitud
  showAuthModal.value = true
}

const handleEnter = async () => {
  if (!selectedRequest.value || !adminPassword.value) return
  try {
    authenticating.value = true
    await supervisionService.entrarSupervision(selectedRequest.value.id_auditoria, {
      password: adminPassword.value,
      motivo_entrada: entryReason.value
    })

    showAuthModal.value = false
    
    // Store in Pinia to switch active role to Rector and set target schoolId
    auth.startSupervision({
      id_auditoria: selectedRequest.value.id_auditoria,
      id_colegio: selectedRequest.value.id_colegio,
      colegio_nombre: selectedRequest.value.colegio_nombre,
      tipo_supervision: selectedRequest.value.tipo_supervision,
      duracion_maxima_minutos: selectedRequest.value.duracion_maxima_minutos,
      fecha_entrada: new Date().toISOString()
    })

    alert(`Has iniciado supervisión en ${selectedRequest.value.colegio_nombre}. Redirigiendo...`)
    router.push('/dashboard')
  } catch (error: any) {
    alert(error.response?.data?.error || 'Re-autenticación fallida')
  } finally {
    authenticating.value = false
  }
}

</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-16">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-4 sm:px-8 py-6 sm:py-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <ShieldAlert :size="26" class="sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">Solicitudes de Supervisión</h1>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Crea solicitudes formales de auditoría y accede a las instituciones aprobadas.</p>
          </div>
        </div>
        
        <button 
          v-if="!auth.isSupervising"
          @click="openRequest" 
          class="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none cursor-pointer self-stretch sm:self-start md:self-auto"
        >
          <Plus :size="16" class="sm:w-4.5 sm:h-4.5" />
          <span>Solicitar Supervisión</span>
        </button>
      </div>
    </div>

    <!-- Instructions / Warning Banner -->
    <div class="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-indigo-100/50 dark:border-indigo-900/40 flex items-start gap-3 sm:gap-4">
      <div class="p-2 sm:p-2.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
        <ShieldCheck :size="18" class="sm:w-5.5 sm:h-5.5" />
      </div>
      <div class="space-y-1">
        <h4 class="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">Flujo de Control de Supervisión</h4>
        <p class="text-[11px] sm:text-xs text-indigo-700/80 dark:text-indigo-400/80 font-semibold leading-relaxed">
          1. Solicita acceso a un colegio indicando el modo (Solo Lectura / Editor) y la justificación. <br>
          2. Un directivo activo de esa institución debe aprobar formalmente el acceso. <br>
          3. Una vez aprobado, haz clic en <strong>Entrar en Supervisión</strong>, re-autentícate por seguridad con tu contraseña, y heredarás temporalmente los permisos de Rector.
        </p>
      </div>
    </div>

    <!-- Solicitudes Section -->
    <div class="space-y-3 sm:space-y-4">
      <h3 class="text-xs sm:text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
        <Clock :size="15" />
        Supervisiones Pendientes o Aprobadas
      </h3>

      <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800">
        <span class="animate-pulse font-bold text-xs sm:text-sm">Cargando solicitudes...</span>
      </div>

      <EmptyState 
        v-else-if="requests.length === 0"
        title="No hay solicitudes activas pendientes ni aprobadas"
        description="Puedes crear una nueva solicitud de acceso temporal a cualquier institución educativa."
      >
        <template #icon>
          <ShieldAlert class="w-8 h-8 text-indigo-500" />
        </template>
        <template v-if="!auth.isSupervising" #action>
          <button @click="openRequest" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm cursor-pointer">
            Crear primera solicitud
          </button>
        </template>
      </EmptyState>


      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div 
          v-for="req in requests" 
          :key="req.id_auditoria"
          class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div class="space-y-3 sm:space-y-4">
            <div class="flex justify-between items-start gap-2">
              <div class="min-w-0">
                <h3 class="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-tight truncate">{{ req.colegio_nombre }}</h3>
                <p class="text-[10px] sm:text-xs text-indigo-500 font-bold uppercase mt-0.5 tracking-wider truncate">{{ req.tipo_supervision === 'EDITOR' ? 'Modo Editor (Cambios)' : 'Solo Lectura' }}</p>
              </div>
              <span 
                :class="[
                  req.estado_supervision === 'APROBADA' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400',
                  'px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0'
                ]"
              >
                {{ req.estado_supervision === 'APROBADA' ? 'APROBADA' : 'PENDIENTE' }}
              </span>
            </div>

            <!-- Justificación -->
            <div class="text-xs space-y-1 bg-slate-50 dark:bg-slate-800/40 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
              <span class="font-black text-slate-400 uppercase tracking-wider text-[9px] sm:text-[10px]">Justificación de Solicitud</span>
              <p class="font-medium text-slate-700 dark:text-slate-300 mt-1 leading-relaxed text-xs sm:text-sm break-words">{{ req.motivo_solicitud }}</p>
            </div>

            <!-- Metadata -->
            <div class="grid grid-cols-2 gap-2 sm:gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <p>Duración: <span class="font-bold text-slate-900 dark:text-white">{{ req.duracion_maxima_minutos }} Minutos</span></p>
              <p>Fecha Solicitud: <span class="font-medium text-slate-900 dark:text-white">{{ new Date(req.fecha_solicitud).toLocaleDateString() }}</span></p>
            </div>

            <!-- Approval info if approved -->
            <div v-if="req.estado_supervision === 'APROBADA' && req.fecha_aprobacion" class="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/30 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-xs space-y-1">
              <span class="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[9px] sm:text-[10px]">Aprobado Por</span>
              <p class="font-medium text-slate-700 dark:text-slate-300 truncate">{{ req.directivo_nombre }} {{ req.directivo_apellido || '' }}</p>
              <p class="text-[10px] text-slate-400">{{ new Date(req.fecha_aprobacion).toLocaleString() }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end border-t border-slate-50 dark:border-slate-800/50 pt-3 sm:pt-4 mt-4 sm:mt-6">
            <button 
              v-if="req.estado_supervision === 'APROBADA' && !auth.isSupervising"
              @click="openAuth(req)"
              class="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:translate-y-[1px] cursor-pointer"
            >
              <Play :size="14" />
              <span>Entrar en Supervisión</span>
            </button>
            <span v-else-if="auth.isSupervising" class="text-xs font-bold text-slate-400 italic">Sal del modo supervisión actual primero</span>
            <span v-else class="text-xs font-bold text-amber-500 flex items-center gap-1"><AlertCircle :size="14" /> Esperando aprobación directiva</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <!-- Create Request Modal -->
      <div v-if="showRequestModal" class="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showRequestModal = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90dvh] flex flex-col">
          <div class="px-5 sm:px-8 pt-5 sm:pt-8 pb-4 sm:pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 class="text-lg sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 sm:gap-3">
              <ShieldAlert :size="20" class="text-indigo-600 sm:w-6 sm:h-6" />
              Solicitar Supervisión
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-0.5 sm:mt-1">Ingresa el motivo formal del monitoreo.</p>
          </div>

          <div class="p-4 sm:p-8 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
            <div class="space-y-1">
              <label class="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Colegio Objetivo *</label>
              <select v-model="form.id_colegio" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white cursor-pointer">
                <option value="" disabled>Selecciona un colegio activo</option>
                <option v-for="school in activeSchools" :key="school.id_colegio" :value="school.id_colegio">{{ school.nombre }}</option>
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div class="space-y-1">
                <label class="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Modo de Supervisión</label>
                <select v-model="form.tipo_supervision" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white cursor-pointer">
                  <option value="SOLO_LECTURA">Solo Lectura</option>
                  <option value="EDITOR">Modo Editor (Cambios)</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duración Autorizada (Minutos)</label>
                <input v-model.number="form.duracion_maxima_minutos" type="number" :min="configLimits.minDuration" :max="configLimits.maxDuration" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white" />
                <p class="text-[9px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">Rango permitido: {{ configLimits.minDuration }} – {{ configLimits.maxDuration }} minutos</p>
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Motivo de Supervisión *</label>
              <textarea 
                v-model="form.motivo"
                placeholder="Detalla de forma explícita el motivo de la supervisión..."
                rows="4"
                class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs font-bold outline-none text-slate-900 dark:text-white resize-none"
              ></textarea>
            </div>
          </div>

          <div class="flex gap-2.5 sm:gap-3 p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button @click="showRequestModal = false" class="flex-1 px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs sm:text-sm cursor-pointer">Cancelar</button>
            <button @click="handleRequest" :disabled="saving" class="flex-[2] bg-indigo-600 text-white px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none text-xs sm:text-sm cursor-pointer">
              {{ saving ? 'Enviando...' : 'Enviar Solicitud' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Auth Prompt Modal -->
      <div v-if="showAuthModal && selectedRequest" class="fixed inset-0 z-[110] flex items-center justify-center p-3.5 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showAuthModal = false"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90dvh] flex flex-col">
          <div class="p-5 sm:p-8 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
            <div class="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
              <Lock :size="28" class="sm:w-8 sm:h-8" />
            </div>
            <div class="text-center">
              <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Re-autenticación Requerida</h2>
              <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Por favor re-escribe tu contraseña de administrador general para autorizar el modo supervisión en {{ selectedRequest.colegio_nombre }}.</p>
            </div>

            <div class="space-y-2.5 sm:space-y-3">
              <div class="space-y-1">
                <label class="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tu Contraseña *</label>
                <input v-model="adminPassword" type="password" placeholder="••••••••" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white" />
              </div>

              <div class="space-y-1">
                <label class="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Motivo de Entrada *</label>
                <textarea 
                  v-model="entryReason"
                  placeholder="Explica la razón de por qué inicias en este momento..."
                  rows="3"
                  class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 sm:p-3 text-xs font-bold outline-none text-slate-900 dark:text-white resize-none"
                ></textarea>
              </div>
            </div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 flex gap-2.5 sm:gap-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button @click="showAuthModal = false" class="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs cursor-pointer">Cancelar</button>
            <button 
              @click="handleEnter"
              :disabled="authenticating || !adminPassword"
              class="flex-1 bg-indigo-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all text-xs shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {{ authenticating ? 'Verificando...' : 'Iniciar Sesión' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
