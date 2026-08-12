<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  Calendar, 
  CalendarCheck,
  AlertCircle, 
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Filter
} from 'lucide-vue-next'

import { useAcademicYearStore } from '../../stores/academicYear'
import NoAcademicRecordsBanner from '../../components/NoAcademicRecordsBanner.vue'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const loading = ref(true)
const studentId = ref<number | null>(null)
const selectedYear = ref<number | null>(yearStore.selectedYearId || null)
const selectedPeriod = ref<number | null>(null)
const selectedSubject = ref<number | string>('all')
const selectedStatus = ref<string>('all')
const selectedDate = ref<string>('')

const years = ref<any[]>([])
const periods = ref<any[]>([])
const subjects = ref<any[]>([])
const attendanceData = ref<{ records: any[], stats: any } | null>(null)
const studentInfo = ref<any>(null)

const displayYears = computed(() => {
  if (yearStore.availableYears.length > 0) return yearStore.availableYears
  return years.value
})

const selectedYearCalendar = computed(() => {
  const y = displayYears.value.find((a: any) => a.id_anio === selectedYear.value)
  return y ? y.calendario : (yearStore.selectedYear?.calendario || '')
})

watch(() => yearStore.selectedYearId, (newYearId) => {
  if (newYearId && newYearId !== selectedYear.value) {
    selectedYear.value = newYearId
  }
}, { immediate: true })

watch(selectedYear, (newYear) => {
  if (newYear && newYear !== yearStore.selectedYearId) {
    yearStore.setSelectedYearId(newYear)
  }
  fetchPeriods()
})

const fetchStudentId = async () => {
  try {
    const userId = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
    if (!userId) return
    const res = await axios.get(`/api/student/user-id/${userId}`)
    studentId.value = res.data.id_estudiante
  } catch (err) {
    console.error("Error fetching student ID:", err)
  }
}

const fetchInitialData = async () => {
  if (!studentId.value) return
  try {
    const [yearsRes, infoRes] = await Promise.all([
      axios.get(`/api/student/years/${studentId.value}`),
      axios.get(`/api/student/info/${studentId.value}`)
    ])
    years.value = yearsRes.data
    studentInfo.value = infoRes.data
    
    if (!selectedYear.value) {
      if (yearStore.selectedYearId) {
        selectedYear.value = yearStore.selectedYearId
      } else if (displayYears.value.length > 0) {
        const currentYearStr = new Date().getFullYear().toString()
        const matchingYear = displayYears.value.find((y: any) => y.calendario === currentYearStr)
        selectedYear.value = matchingYear ? matchingYear.id_anio : displayYears.value[0].id_anio
        yearStore.setSelectedYearId(selectedYear.value!)
      }
    }
    await fetchPeriods()
  } catch (err) {
    console.error("Error fetching initial academic data:", err)
  } finally {
    loading.value = false
  }
}

const fetchPeriods = async () => {
  if (!studentId.value || !selectedYear.value) return
  try {
    const res = await axios.get(`/api/student/all-periods/${studentId.value}/${selectedYear.value}`)
    periods.value = (res.data || []).filter((p: any) => p.estado !== 'PENDIENTE')
    if (periods.value.length > 0) {
      selectedPeriod.value = periods.value[periods.value.length - 1].id_periodo
    } else {
      selectedPeriod.value = null
      attendanceData.value = null
      subjects.value = []
    }
  } catch (err) {
    console.error("Error fetching periods:", err)
    periods.value = []
    selectedPeriod.value = null
    attendanceData.value = null
    subjects.value = []
  }
}

const fetchSubjects = async () => {
  if (!studentId.value || !selectedPeriod.value) return
  try {
    // We reuse the grades endpoint to get the list of active subjects for this period
    const res = await axios.get(`/api/student/grades/${studentId.value}/${selectedPeriod.value}`)
    subjects.value = res.data.grades.map((g: any) => ({
      id_materia: g.id_materia,
      nombre: g.materia
    }))
  } catch (err) {
    console.error("Error fetching subjects:", err)
  }
}

const fetchAttendance = async () => {
  if (!studentId.value || !selectedPeriod.value) return
  loading.value = true
  try {
    let url = `/api/student/attendance/${studentId.value}/${selectedPeriod.value}`
    const queryParams = new URLSearchParams()
    
    if (selectedSubject.value !== 'all') queryParams.append('id_materia', selectedSubject.value.toString())
    if (selectedStatus.value !== 'all') queryParams.append('estado', selectedStatus.value)
    if (selectedDate.value) queryParams.append('fecha', selectedDate.value)
    
    const queryString = queryParams.toString()
    if (queryString) url += `?${queryString}`
    
    const res = await axios.get(url)
    attendanceData.value = res.data
  } catch (err) {
    console.error("Error fetching attendance:", err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchStudentId()
  await fetchInitialData()
})

watch(selectedYear, fetchPeriods)
watch(selectedPeriod, () => {
  fetchSubjects()
  fetchAttendance()
})
watch(selectedSubject, fetchAttendance)
watch(selectedStatus, fetchAttendance)
watch(selectedDate, fetchAttendance)

const states = [
  { label: 'Presentes', key: 'PRESENTE', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400', icon: CheckCircle2 },
  { label: 'Ausencias', key: 'AUSENTE', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400', icon: XCircle },
  { label: 'Tardanzas', key: 'TARDE', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400', icon: Clock },
  { label: 'Justificadas', key: 'JUSTIFICADA', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400', icon: HelpCircle }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PRESENTE': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
    case 'AUSENTE': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400'
    case 'TARDE': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
    case 'JUSTIFICADA': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
  }
}

const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  return new Date(dateString).toLocaleDateString('es-ES', options)
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Top Header & Filters -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <CalendarCheck :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Mi Asistencia
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {{ studentInfo?.grado }} - Grupo {{ studentInfo?.grupo }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Year Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Calendar :size="18" class="text-slate-400" />
          <select v-model="selectedYear" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option v-for="y in displayYears" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
          </select>
        </div>

        <!-- Period Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Filter :size="18" class="text-slate-400" />
          <select v-model="selectedPeriod" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="periods.length === 0">
            <option v-if="periods.length === 0" disabled value="">No hay periodos disponibles</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' - En Curso' : '' }}</option>
          </select>
        </div>

        <!-- Subject Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <BookOpen :size="18" class="text-slate-400" />
          <select v-model="selectedSubject" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="subjects.length === 0">
            <option value="all">Todas las materias</option>
            <option v-for="s in subjects" :key="s.id_materia" :value="s.id_materia">{{ s.nombre }}</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <HelpCircle :size="18" class="text-slate-400" />
          <select v-model="selectedStatus" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option value="all">Cualquier estado</option>
            <option value="PRESENTE">Presente</option>
            <option value="AUSENTE">Ausente</option>
            <option value="TARDE">Tardanza</option>
            <option value="JUSTIFICADA">Justificada</option>
          </select>
        </div>

        <!-- Date Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Calendar :size="18" class="text-slate-400" />
          <input 
            type="date" 
            v-model="selectedDate" 
            class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer"
          />
          <button v-if="selectedDate" @click="selectedDate = ''" class="text-slate-400 hover:text-rose-500 transition-colors">
            <XCircle :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div v-if="attendanceData && !loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      <div 
        v-for="state in states" 
        :key="state.key"
        class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-lg transition-all duration-300"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{{ state.label }}</p>
            <p class="text-3xl font-black mt-1 text-slate-800 dark:text-white">{{ attendanceData.stats[state.key] || 0 }}</p>
          </div>
          <div class="p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300" :class="state.color">
            <component :is="state.icon" :size="24" stroke-width="2.5" />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium animate-pulse">Cargando asistencia...</p>
    </div>

    <!-- Empty State -->
    <NoAcademicRecordsBanner v-else-if="!periods || periods.length === 0 || !attendanceData || attendanceData.records.length === 0" :year-label="selectedYearCalendar" />

    <!-- Attendance Table -->
    <div v-else class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 dark:bg-slate-800/50">
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Fecha</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Estado</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Hora de Llegada</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Materia</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Docente</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Justificación</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr 
              v-for="(item, idx) in attendanceData.records" 
              :key="idx"
              class="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <td class="px-8 py-6">
                <span class="font-bold text-slate-800 dark:text-slate-200 capitalize text-sm">{{ formatDate(item.fecha) }}</span>
              </td>
              <td class="px-8 py-6">
                <div class="flex justify-center">
                  <span 
                    class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                    :class="getStatusColor(item.estado)"
                  >
                    {{ item.estado }}
                  </span>
                </div>
              </td>
              <td class="px-8 py-6">
                <div class="text-center font-bold text-sm text-slate-700 dark:text-slate-300 font-mono">
                  {{ item.hora_llegada || '—' }}
                </div>
              </td>
              <td class="px-8 py-6">
                <span class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ item.materia }}</span>
              </td>
              <td class="px-8 py-6">
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ item.docente }}</span>
              </td>
              <td class="px-8 py-6">
                <span class="text-xs text-slate-400 dark:text-slate-500 italic">{{ item.justificacion || 'Sin observaciones' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Help Alert -->
    <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 p-6 rounded-3xl flex gap-4">
      <AlertCircle :size="24" class="text-indigo-500 shrink-0" />
      <div>
        <h4 class="text-sm font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-widest mb-1">Sobre tu asistencia</h4>
        <p class="text-sm text-indigo-700 dark:text-indigo-500 leading-relaxed font-medium">
          El registro de asistencia es realizado diariamente por cada docente. Si encuentras alguna inconsistencia o necesitas justificar una inasistencia, por favor contacta directamente con el docente de la materia o la coordinación académica.
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>
