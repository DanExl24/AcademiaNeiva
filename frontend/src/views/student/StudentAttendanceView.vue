<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { studentService } from '../../services/studentService'
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
import DataTable from '../../components/ui/DataTable.vue'
import SkeletonTable from '../../components/feedback/SkeletonTable.vue'

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
    const res = await studentService.getByUserId(userId)
    studentId.value = res.id_estudiante
  } catch (err) {
    console.error("Error fetching student ID:", err)
  }
}

const fetchInitialData = async () => {
  if (!studentId.value) return
  try {
    const [yearsRes, infoRes] = await Promise.all([
      studentService.getYears(studentId.value),
      studentService.getInfo(studentId.value)
    ])
    years.value = yearsRes
    studentInfo.value = infoRes
    
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
    const res = await studentService.getAllPeriods(studentId.value, selectedYear.value)
    periods.value = (res || []).filter((p: any) => p.estado !== 'PENDIENTE')
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
    const res = await studentService.getGrades(studentId.value, selectedPeriod.value)
    subjects.value = (res?.grades || []).map((g: any) => ({
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
    const queryParams: Record<string, any> = {}
    
    if (selectedSubject.value !== 'all') queryParams.id_materia = selectedSubject.value
    if (selectedStatus.value !== 'all') queryParams.estado = selectedStatus.value
    if (selectedDate.value) queryParams.fecha = selectedDate.value
    
    const res = await studentService.getAttendance(studentId.value, selectedPeriod.value, queryParams)
    attendanceData.value = res
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
  <div class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Top Header & Filters -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2.5 sm:gap-3">
          <CalendarCheck :size="26" class="text-indigo-600 dark:text-indigo-400 sm:w-8 sm:h-8" />
          <span>Mi Asistencia</span>
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium">
          {{ studentInfo?.grado }} - Grupo {{ studentInfo?.grupo }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <!-- Year Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Calendar :size="16" class="text-slate-400" />
          <select v-model="selectedYear" class="bg-transparent border-none text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option v-for="y in displayYears" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
          </select>
        </div>

        <!-- Period Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Filter :size="16" class="text-slate-400" />
          <select v-model="selectedPeriod" class="bg-transparent border-none text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="periods.length === 0">
            <option v-if="periods.length === 0" disabled value="">No hay periodos disponibles</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' - En Curso' : '' }}</option>
          </select>
        </div>

        <!-- Subject Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <BookOpen :size="16" class="text-slate-400" />
          <select v-model="selectedSubject" class="bg-transparent border-none text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="subjects.length === 0">
            <option value="all">Todas las materias</option>
            <option v-for="s in subjects" :key="s.id_materia" :value="s.id_materia">{{ s.nombre }}</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <HelpCircle :size="16" class="text-slate-400" />
          <select v-model="selectedStatus" class="bg-transparent border-none text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option value="all">Cualquier estado</option>
            <option value="PRESENTE">Presente</option>
            <option value="AUSENTE">Ausente</option>
            <option value="TARDE">Tardanza</option>
            <option value="JUSTIFICADA">Justificada</option>
          </select>
        </div>

        <!-- Date Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Calendar :size="16" class="text-slate-400" />
          <input 
            type="date" 
            v-model="selectedDate" 
            class="bg-transparent border-none text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer"
          />
          <button v-if="selectedDate" @click="selectedDate = ''" class="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">
            <XCircle :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div v-if="attendanceData && !loading" class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-6">
      <div 
        v-for="state in states" 
        :key="state.key"
        class="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-lg transition-all duration-300"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{{ state.label }}</p>
            <p class="text-2xl sm:text-3xl font-black mt-0.5 sm:mt-1 text-slate-800 dark:text-white">{{ attendanceData.stats[state.key] || 0 }}</p>
          </div>
          <div class="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300 shrink-0" :class="state.color">
            <component :is="state.icon" :size="20" stroke-width="2.5" class="sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <SkeletonTable v-if="loading" :rows="5" :cols="6" />

    <!-- Empty State -->
    <NoAcademicRecordsBanner v-else-if="!periods || periods.length === 0 || !attendanceData || attendanceData.records.length === 0" :year-label="selectedYearCalendar" />

    <!-- Attendance Table -->
    <DataTable v-else>
      <template #header>
        <tr>
          <th class="py-3 sm:py-4 px-3 sm:px-6">Fecha</th>
          <th class="py-3 sm:py-4 px-3 sm:px-6 text-center">Estado</th>
          <th class="py-3 sm:py-4 px-3 sm:px-6 text-center hidden sm:table-cell">Hora Llegada</th>
          <th class="py-3 sm:py-4 px-3 sm:px-6">Materia</th>
          <th class="py-3 sm:py-4 px-3 sm:px-6 hidden sm:table-cell">Docente</th>
          <th class="py-3 sm:py-4 px-3 sm:px-6 hidden md:table-cell">Justificación</th>
        </tr>
      </template>
      <tr 
        v-for="(item, idx) in attendanceData.records" 
        :key="idx"
        class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <td class="py-3 sm:py-4 px-3 sm:px-6">
          <span class="font-bold text-slate-800 dark:text-slate-200 capitalize text-xs sm:text-sm block">{{ formatDate(item.fecha) }}</span>
          <span class="text-[10px] text-slate-400 block sm:hidden">{{ item.docente }}</span>
        </td>
        <td class="py-3 sm:py-4 px-3 sm:px-6 text-center">
          <span 
            class="px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider inline-block"
            :class="getStatusColor(item.estado)"
          >
            {{ item.estado }}
          </span>
        </td>
        <td class="py-3 sm:py-4 px-3 sm:px-6 text-center font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-mono hidden sm:table-cell">
          {{ item.hora_llegada || '—' }}
        </td>
        <td class="py-3 sm:py-4 px-3 sm:px-6">
          <span class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">{{ item.materia }}</span>
        </td>
        <td class="py-3 sm:py-4 px-3 sm:px-6 hidden sm:table-cell">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ item.docente }}</span>
        </td>
        <td class="py-3 sm:py-4 px-3 sm:px-6 hidden md:table-cell">
          <span class="text-xs text-slate-400 dark:text-slate-500 italic">{{ item.justificacion || 'Sin observaciones' }}</span>
        </td>
      </tr>
    </DataTable>

    <!-- Help Alert -->
    <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex gap-3 sm:gap-4 items-start">
      <AlertCircle :size="22" class="text-indigo-500 shrink-0 mt-0.5" />
      <div>
        <h4 class="text-xs sm:text-sm font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-widest mb-0.5 sm:mb-1">Control de asistencia</h4>
        <p class="text-xs sm:text-sm text-indigo-700 dark:text-indigo-500 leading-relaxed font-medium">
          El porcentaje de asistencia se calcula automáticamente por cada periodo escolar. Si tienes inasistencias injustificadas, acércate a la coordinación de convivencia con el soporte correspondiente.
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>
