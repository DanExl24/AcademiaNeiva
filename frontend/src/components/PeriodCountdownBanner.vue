<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { academicService } from '../services/academicService'
import { Clock, AlertTriangle, Sparkles } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useAcademicYearStore } from '../stores/academicYear'

interface PeriodInfo {
  id_periodo: number
  nombre: string
  estado: string
  mes_inicio?: number | null
  dia_inicio?: number | null
  mes_fin: number | null
  dia_fin: number | null
  id_anio?: number
  calendario?: string | null
  anio_estado?: string | null
}

const props = defineProps<{
  periodInfo?: PeriodInfo | null
}>()

const auth = useAuthStore()
const yearStore = useAcademicYearStore()

const fetchedPeriod = ref<PeriodInfo | null>(null)
const loading = ref(false)
const timer = ref<any>(null)

// El período efectivo es el que se pasa por prop, o el que se obtiene vía API
const period = computed<PeriodInfo | null>(() => {
  return props.periodInfo || fetchedPeriod.value
})

const schoolId = computed(() => {
  return auth.user?.schoolId || null
})

// No mostrar banner si el usuario es Admin General (Superadmin global)
const isNotAdminGeneral = computed(() => {
  const role = auth.activeRole?.toLowerCase()
  return role !== 'admin_general' && auth.user?.role !== 'admin_general'
})

const isYearOpen = computed(() => {
  // Si el año seleccionado en la store está CERRADO o INACTIVO, no mostrar
  if (yearStore.selectedYear && (yearStore.selectedYear.estado === 'CERRADO' || yearStore.selectedYear.estado === 'INACTIVO')) {
    return false
  }
  // Si la info del período incluye estado del año
  if (period.value?.anio_estado && (period.value.anio_estado === 'CERRADO' || period.value.anio_estado === 'INACTIVO')) {
    return false
  }
  return true
})

const isPeriodStrictlyOpen = computed(() => {
  return period.value?.estado === 'ABIERTO'
})

const timeLeft = ref({
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  isExpired: false,
  isValidDate: false
})

const calculateTimeLeft = () => {
  if (!period.value || !period.value.mes_fin || !period.value.dia_fin) {
    timeLeft.value = { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, isValidDate: false }
    return
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  
  // Mes en JavaScript es 0-indexado (0 = Enero, 11 = Diciembre)
  const targetMonth = period.value.mes_fin - 1
  const targetDay = period.value.dia_fin

  // Si mes_fin es menor que mes_inicio o estamos a fin de año (para calendarios que cruzan año)
  let targetYear = currentYear
  if (period.value.mes_inicio && period.value.mes_fin < period.value.mes_inicio) {
    if (now.getMonth() + 1 >= period.value.mes_inicio) {
      targetYear = currentYear + 1
    }
  }

  // Establecer fecha límite a las 23:59:59 del día de fin
  const deadline = new Date(targetYear, targetMonth, targetDay, 23, 59, 59, 999)
  const diffMs = deadline.getTime() - now.getTime()

  if (diffMs <= 0) {
    timeLeft.value = { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isValidDate: true }
  } else {
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

    timeLeft.value = { days, hours, minutes, seconds, isExpired: false, isValidDate: true }
  }
}

const fetchActivePeriodInfo = async () => {
  if (!isNotAdminGeneral.value) return
  loading.value = true
  try {
    const params: any = {}
    if (schoolId.value) params.schoolId = schoolId.value
    if (yearStore.selectedYearId) params.yearId = yearStore.selectedYearId

    const res = await academicService.getActivePeriodInfo(params)
    fetchedPeriod.value = res?.activePeriod || null
    calculateTimeLeft()
  } catch (err) {
    fetchedPeriod.value = null
  } finally {
    loading.value = false
  }
}

const shouldShow = computed(() => {
  return isNotAdminGeneral.value && isYearOpen.value && isPeriodStrictlyOpen.value && timeLeft.value.isValidDate
})

watch(period, () => {
  calculateTimeLeft()
}, { immediate: true, deep: true })


watch(() => yearStore.selectedYearId, () => {
  if (!props.periodInfo) {
    fetchActivePeriodInfo()
  }
})

watch(schoolId, () => {
  if (!props.periodInfo) {
    fetchActivePeriodInfo()
  }
})

onMounted(() => {
  if (!props.periodInfo) {
    fetchActivePeriodInfo()
  } else {
    calculateTimeLeft()
  }
  
  timer.value = setInterval(() => {
    calculateTimeLeft()
  }, 1000)
})

onUnmounted(() => {
  if (timer.value) clearInterval(timer.value)
})
</script>

<template>
  <div v-if="shouldShow && period" class="mb-6 animate-in fade-in slide-in-from-top-3 duration-500">
    <div :class="[
      'rounded-2xl p-5 md:p-6 text-white shadow-lg relative overflow-hidden transition-all border',
      timeLeft.days <= 5 
        ? 'bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 border-amber-400/30' 
        : 'bg-gradient-to-r from-indigo-700 via-purple-700 to-sky-700 border-indigo-400/30'
    ]">
      
      <!-- Fondo decorativo sutil -->
      <div class="absolute -right-6 -bottom-8 opacity-10 pointer-events-none">
        <Clock :size="160" />
      </div>

      <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
        
        <!-- Información del Período -->
        <div class="flex items-center gap-3.5">
          <div :class="[
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner',
            timeLeft.days <= 5 ? 'bg-white/20 text-amber-100 animate-pulse' : 'bg-white/15 text-indigo-100'
          ]">
            <Clock :size="24" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                Período {{ period.nombre }}
              </span>
              <span v-if="timeLeft.days <= 5 && !timeLeft.isExpired" class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-300 text-amber-950 flex items-center gap-1 animate-bounce">
                <AlertTriangle :size="10" /> Cierre Próximo
              </span>
            </div>
            <h4 class="text-lg font-black text-white mt-1 tracking-tight flex items-center gap-1.5">
              Cierre del Período Académico
              <Sparkles :size="16" class="text-amber-300" />
            </h4>

            <p class="text-xs text-white/80 font-medium">
              <span v-if="timeLeft.isExpired">El período ha alcanzado su fecha límite de registro y calificaciones.</span>
              <span v-else>Tiempo restante para el cierre oficial del registro de actividades y notas.</span>
            </p>
          </div>
        </div>

        <!-- Contador Regresivo -->
        <div v-if="!timeLeft.isExpired" class="flex items-center gap-2 sm:gap-3 self-stretch lg:self-auto justify-center">
          <div class="flex flex-col items-center bg-black/25 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 min-w-[62px]">
            <span class="text-2xl font-black font-mono tracking-tight text-white leading-none">{{ timeLeft.days }}</span>
            <span class="text-[9px] font-extrabold uppercase tracking-wider text-white/75 mt-1">Días</span>
          </div>

          <span class="text-xl font-black text-white/40 pb-2">:</span>

          <div class="flex flex-col items-center bg-black/25 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 min-w-[62px]">
            <span class="text-2xl font-black font-mono tracking-tight text-white leading-none">{{ String(timeLeft.hours).padStart(2, '0') }}</span>
            <span class="text-[9px] font-extrabold uppercase tracking-wider text-white/75 mt-1">Horas</span>
          </div>

          <span class="text-xl font-black text-white/40 pb-2">:</span>

          <div class="flex flex-col items-center bg-black/25 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 min-w-[62px]">
            <span class="text-2xl font-black font-mono tracking-tight text-white leading-none">{{ String(timeLeft.minutes).padStart(2, '0') }}</span>
            <span class="text-[9px] font-extrabold uppercase tracking-wider text-white/75 mt-1">Min</span>
          </div>

          <span class="text-xl font-black text-white/40 pb-2">:</span>

          <div class="flex flex-col items-center bg-black/25 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 min-w-[62px]">
            <span class="text-2xl font-black font-mono tracking-tight text-amber-300 leading-none">{{ String(timeLeft.seconds).padStart(2, '0') }}</span>
            <span class="text-[9px] font-extrabold uppercase tracking-wider text-white/75 mt-1">Seg</span>
          </div>
        </div>

        <div v-else class="px-4 py-2 bg-black/30 rounded-xl text-center border border-white/10">
          <span class="text-xs font-black uppercase text-amber-300">Cierre En Proceso / Finalizado</span>
        </div>

      </div>
    </div>
  </div>
</template>