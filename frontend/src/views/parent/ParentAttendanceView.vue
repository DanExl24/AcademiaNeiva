<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  Calendar,
  CalendarCheck,
  AlertCircle,
  SearchX,
  GraduationCap,
  CreditCard,
  Filter,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle
} from 'lucide-vue-next'

import { useAcademicYearStore } from '../../stores/academicYear'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const loading = ref(true)
const fetchingAttendance = ref(false)

const children = ref<any[]>([])
const selectedChildId = ref<number | null>(null)
const studentInfo = ref<any>(null)

const years = ref<any[]>([])
const selectedYear = ref<number | null>(null)

const periods = ref<any[]>([])
const selectedPeriod = ref<number | null>(null)

const subjects = ref<any[]>([])
const selectedSubject = ref<number | string>('all')

watch(() => yearStore.selectedYearId, (newYearId) => {
  if (newYearId && newYearId !== selectedYear.value) {
    selectedYear.value = newYearId
  }
}, { immediate: true })
const selectedStatus = ref<string>('all')
const selectedDate = ref<string>('')
const attendanceData = ref<{ records: any[], stats: any } | null>(null)

const fetchChildren = async () => {
  try {
    const userId = (auth.isMonitoring && auth.monitoringUser?.id) ? auth.monitoringUser.id : auth.user?.id
    if (!userId) return
    const res = await axios.get(`/api/student/parent-children/${userId}`)
    children.value = res.data
    if (children.value.length > 0 && !selectedChildId.value) {
      selectedChildId.value = children.value[0].id_estudiante
    }
  } catch (err) {
    console.error("Error fetching children:", err)
  } finally {
    loading.value = false
  }
}

const fetchYearsAndInfo = async () => {
  if (!selectedChildId.value) return
  loading.value = true
  try {
    const [yearsRes, infoRes] = await Promise.all([
      axios.get(`/api/student/years/${selectedChildId.value}`),
      axios.get(`/api/student/info/${selectedChildId.value}`)
    ])
    years.value = yearsRes.data
    studentInfo.value = infoRes.data
    
    if (years.value.length > 0) {
      selectedYear.value = years.value[0].id_anio
    }
  } catch (err) {
    console.error("Error fetching years/info:", err)
  } finally {
    loading.value = false
  }
}

const fetchPeriods = async () => {
  if (!selectedChildId.value || !selectedYear.value) return
  try {
    const res = await axios.get(`/api/student/all-periods/${selectedChildId.value}/${selectedYear.value}`)
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
  }
}

const fetchSubjects = async () => {
  if (!selectedChildId.value || !selectedPeriod.value) return
  try {
    const res = await axios.get(`/api/student/grades/${selectedChildId.value}/${selectedPeriod.value}`)
    subjects.value = res.data.grades.map((g: any) => ({
      id_materia: g.id_materia,
      nombre: g.materia
    }))
  } catch (err) {
    console.error("Error fetching subjects:", err)
  }
}

const fetchAttendance = async () => {
  if (!selectedChildId.value || !selectedPeriod.value) return
  fetchingAttendance.value = true
  try {
    let url = `/api/student/attendance/${selectedChildId.value}/${selectedPeriod.value}`
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
    fetchingAttendance.value = false
  }
}

onMounted(async () => {
  await fetchChildren()
})

watch(selectedChildId, async (newVal) => {
  if (newVal) {
    selectedYear.value = null
    selectedPeriod.value = null
    periods.value = []
    attendanceData.value = null
    selectedSubject.value = 'all'
    selectedStatus.value = 'all'
    selectedDate.value = ''
    subjects.value = []
    await fetchYearsAndInfo()
  }
})

watch(selectedYear, async (newVal) => {
  if (newVal) {
    selectedPeriod.value = null
    attendanceData.value = null
    await fetchPeriods()
  }
})

watch(selectedPeriod, async (newVal) => {
  if (newVal) {
    await Promise.all([
      fetchSubjects(),
      fetchAttendance()
    ])
  }
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
    
    <!-- Top Header & Child Selector -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <CalendarCheck :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Asistencia de Hijos
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
          Consulta el registro de asistencia diaria de tus hijos
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <div v-if="children.length > 0" class="flex items-center gap-3 bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm transition-all focus-within:ring-4 focus-within:ring-indigo-500/10">
          <GraduationCap :size="20" class="text-indigo-500" />
          <select 
            v-model="selectedChildId" 
            class="bg-transparent border-none text-sm font-black text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer"
          >
            <option v-for="child in children" :key="child.id_estudiante" :value="child.id_estudiante">
              {{ child.nombre }} {{ child.apellido }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Student Info & Filters -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div v-if="studentInfo">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">Grado Actual</span>
          <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ studentInfo.grado }} - Grupo {{ studentInfo.grupo }}</span>
        </div>
        <p class="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <CreditCard :size="14" />
          Código Estudiantil: <span class="font-bold">{{ studentInfo.codigo }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Calendar :size="18" class="text-slate-400" />
          <select v-model="selectedYear" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option v-for="y in years" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Filter :size="18" class="text-slate-400" />
          <select v-model="selectedPeriod" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="periods.length === 0">
            <option v-if="periods.length === 0" disabled value="">No hay periodos disponibles</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' - En Curso' : '' }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <BookOpen :size="18" class="text-slate-400" />
          <select v-model="selectedSubject" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="subjects.length === 0">
            <option value="all">Todas las materias</option>
            <option v-for="s in subjects" :key="s.id_materia" :value="s.id_materia">{{ s.nombre }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <HelpCircle :size="18" class="text-slate-400" />
          <select v-model="selectedStatus" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option value="all">Estado: Todos</option>
            <option value="PRESENTE">Presente</option>
            <option value="AUSENTE">Ausente</option>
            <option value="TARDE">Tardanza</option>
            <option value="JUSTIFICADA">Justificada</option>
          </select>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Calendar :size="18" class="text-slate-400" />
          <input 
            type="date" 
            v-model="selectedDate" 
            class="bg-transparent border-none text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer"
          />
          <button v-if="selectedDate" @click="selectedDate = ''" class="text-slate-400 hover:text-rose-500">
            <XCircle :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div v-if="attendanceData && !fetchingAttendance" class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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
    <div v-if="loading || fetchingAttendance" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium">Buscando registros de asistencia...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!attendanceData || attendanceData.records.length === 0" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
      <div class="bg-slate-50 dark:bg-slate-800 p-6 rounded-full mb-6">
        <SearchX :size="48" class="text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-800 dark:text-white">Sin registros</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-center px-4 leading-relaxed">
        No se encontraron registros de asistencia para este hijo bajo los filtros seleccionados.
      </p>
    </div>

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
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400 italic">Profe {{ item.docente }}</span>
              </td>
              <td class="px-8 py-6">
                <span class="text-xs text-slate-400 dark:text-slate-500 italic">{{ item.justificacion || 'Sin observaciones' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Help Info -->
    <div class="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex gap-4">
      <div class="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
        <AlertCircle :size="24" />
      </div>
      <div>
        <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1">Información Importante</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
          La asistencia es un factor clave en el proceso de aprendizaje. En caso de ausencias justificadas (médicas o calamidades), asegúrese de que el estudiante entregue el soporte correspondiente a la coordinación para su registro en el sistema.
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>
