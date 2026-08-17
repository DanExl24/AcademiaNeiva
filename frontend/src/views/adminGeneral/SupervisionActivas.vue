<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supervisionService } from '../../services/supervisionService'
import { useAuthStore } from '../../stores/auth'
import { 
  ShieldAlert, StopCircle, Clock
} from 'lucide-vue-next'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'
import EmptyState from '../../components/feedback/EmptyState.vue'

const auth = useAuthStore()
const { confirm } = useConfirm()
const toast = useToast()



interface SupervisionActiva {
  id_auditoria: number
  id_colegio: number
  colegio_nombre: string
  motivo_solicitud: string
  fecha_solicitud: string
  tipo_supervision: 'SOLO_LECTURA' | 'EDITOR'
  estado_supervision: 'ACTIVA'
  duracion_maxima_minutos: number
  fecha_entrada: string
  motivo_entrada?: string
}

const loading = ref(true)
const activeSupervisions = ref<SupervisionActiva[]>([])
const timers = ref<Record<number, string>>({})
let timerInterval: any = null

const fetchActiveSupervisions = async () => {
  try {
    loading.value = true
    const data = await supervisionService.getHistorial()
    activeSupervisions.value = (data || []).filter((r: any) => r.estado_supervision === 'ACTIVA')
    updateTimers()
  } catch (error) {
    console.error('Error fetching active supervisions:', error)
  } finally {
    loading.value = false
  }
}

const updateTimers = () => {
  activeSupervisions.value.forEach(sup => {
    const start = new Date(sup.fecha_entrada).getTime()
    const durationMs = sup.duracion_maxima_minutos * 60 * 1000
    const end = start + durationMs
    const now = new Date().getTime()
    const diff = end - now

    if (diff <= 0) {
      timers.value[sup.id_auditoria] = 'Expirado'
      // Auto-exit if it's the currently active supervision session in this browser
      if (auth.supervision?.id_auditoria === sup.id_auditoria) {
        handleAutoExit(sup.id_auditoria)
      }
    } else {
      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      timers.value[sup.id_auditoria] = `${minutes}m ${seconds}s`
    }
  })
}

const handleAutoExit = async (id: number) => {
  try {
    await supervisionService.salirSupervision(id)
  } catch (e) {
    console.error('Error auto-exiting supervision:', e)
  }
  auth.stopSupervision()
  window.location.href = '/dashboard'
}

const handleExit = async (sup: SupervisionActiva) => {
  const ok = await confirm({
    title: 'Finalizar Supervisión',
    message: `¿Estás seguro de que deseas finalizar la sesión de supervisión en ${sup.colegio_nombre}?`,
    confirmText: 'Finalizar Supervisión',
    type: 'danger'
  })
  if (!ok) return

  try {
    const resData = await supervisionService.salirSupervision(sup.id_auditoria)
    toast.success(`Supervisión finalizada. Duración: ${resData.duracion}. Acciones auditadas: ${resData.total_acciones}`)
    
    // Stop local Pinia supervision context if this is the supervision we were in
    if (auth.supervision?.id_auditoria === sup.id_auditoria) {
      auth.stopSupervision()
      window.location.href = '/dashboard'
    } else {
      await fetchActiveSupervisions()
    }
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al salir de la supervisión')
  }
}



onMounted(() => {
  fetchActiveSupervisions()
  timerInterval = setInterval(updateTimers, 1000)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
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
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Supervisiones Activas</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Visualiza las sesiones de auditoría en ejecución y el tiempo restante de acceso.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Active list -->
    <div class="space-y-4">
      <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
        <span class="animate-pulse font-bold">Cargando supervisiones activas...</span>
      </div>

      <EmptyState 
        v-else-if="activeSupervisions.length === 0"
        title="No hay supervisiones en ejecución"
        description="Actualmente ningún auditor o administrador general tiene una sesión activa abierta en los colegios."
      >
        <template #icon>
          <ShieldAlert class="w-8 h-8 text-indigo-500" />
        </template>
      </EmptyState>


      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          v-for="sup in activeSupervisions" 
          :key="sup.id_auditoria"
          class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div class="space-y-4">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black text-slate-900 dark:text-white text-lg leading-tight">{{ sup.colegio_nombre }}</h3>
                <p class="text-xs text-indigo-500 font-bold uppercase mt-0.5 tracking-wider">{{ sup.tipo_supervision === 'EDITOR' ? 'Modo Editor' : 'Solo Lectura' }}</p>
              </div>
              
              <!-- Countdown timer badge -->
              <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 font-mono">
                <Clock :size="14" class="animate-spin" />
                {{ timers[sup.id_auditoria] || 'Calculando...' }}
              </span>
            </div>

            <!-- Justificación de entrada -->
            <div class="text-xs space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
              <span class="font-black text-slate-400 uppercase tracking-wider text-[10px]">Motivo de la Entrada</span>
              <p class="font-medium text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{{ sup.motivo_entrada || sup.motivo_solicitud }}</p>
            </div>

            <!-- Details -->
            <div class="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800/40 pt-4">
              <p>Entrada: <span class="font-bold text-slate-900 dark:text-white">{{ new Date(sup.fecha_entrada).toLocaleTimeString() }}</span></p>
              <p>Duración Autorizada: <span class="font-bold text-slate-900 dark:text-white">{{ sup.duracion_maxima_minutos }} Minutos</span></p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end border-t border-slate-50 dark:border-slate-800/50 pt-4 mt-6">
            <button 
              @click="handleExit(sup)"
              class="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:translate-y-[1px]"
            >
              <StopCircle :size="14" />
              Finalizar Supervisión
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
