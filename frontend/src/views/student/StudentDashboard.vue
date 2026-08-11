<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import {
  GraduationCap,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  MessageSquare,
  Star,
  Sparkles,
  Clock,
  FileDown,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  CalendarDays
} from 'lucide-vue-next'
import BoletinExportModule from '../../components/boletines/BoletinExportModule.vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
} from 'chart.js'

// Register Chart.js components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
)

import { useAcademicYearStore } from '../../stores/academicYear'
import PeriodCountdownBanner from '../../components/PeriodCountdownBanner.vue'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const studentId = ref<number | null>(null)
const selectedPeriodId = ref<number | null>(null)
const selectedYearId = ref<number | null>(null)
const academicYears = ref<any[]>([])
const periods = ref<any[]>([])
const loading = ref(true)

watch(() => yearStore.selectedYearId, (newYearId) => {
  if (newYearId && newYearId !== selectedYearId.value) {
    selectedYearId.value = newYearId
  }
}, { immediate: true })

// Stats state
const dashboardStats = ref<any>(null)
const statsLoading = ref(true)
const statsError = ref('')
const activeChartTab = ref<'best' | 'worst'>('best')

const fetchStudentData = async () => {
  try {
    const id_usuario = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
    if (!id_usuario) return

    // Get student ID
    const idRes = await axios.get(`/api/student/user-id/${id_usuario}`)
    studentId.value = idRes.data.id_estudiante

    if (studentId.value) {
      // Get all academic years
      const yearsRes = await axios.get(`/api/student/years/${studentId.value}`)
      academicYears.value = yearsRes.data
      
      if (academicYears.value.length > 0) {
        // Default to current calendar year match, or first in list
        const currentYearStr = new Date().getFullYear().toString()
        const matchingYear = academicYears.value.find((y: any) => y.calendario === currentYearStr)
        selectedYearId.value = matchingYear ? matchingYear['id_anio'] : academicYears.value[0]['id_anio']
        await loadPeriodsForYear()
      } else {
        statsLoading.value = false
      }
    } else {
      statsLoading.value = false
    }
  } catch (err) {
    console.error('Error fetching student dashboard data:', err)
    statsLoading.value = false
  } finally {
    loading.value = false
  }
}

const loadPeriodsForYear = async () => {
  if (!studentId.value || !selectedYearId.value) return
  try {
    const periodsRes = await axios.get(`/api/student/all-periods/${studentId.value}/${selectedYearId.value}`)
    periods.value = (periodsRes.data || []).filter((p: any) => p.estado !== 'PENDIENTE')
    
    if (periods.value.length > 0) {
      // Default to the open period, or the last one
      const openPeriod = periods.value.find((p: any) => p.estado === 'ABIERTO')
      selectedPeriodId.value = openPeriod ? openPeriod.id_periodo : periods.value[periods.value.length - 1].id_periodo
    } else {
      selectedPeriodId.value = null
      dashboardStats.value = null
      statsLoading.value = false
    }
  } catch (err) {
    console.error('Error loading periods for year:', err)
    statsLoading.value = false
  }
}

const fetchStats = async () => {
  if (!studentId.value || !selectedPeriodId.value) {
    statsLoading.value = false
    return
  }
  
  statsLoading.value = true
  statsError.value = ''
  
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get(
      `/api/student/dashboard-stats/${studentId.value}/${selectedPeriodId.value}`,
      { headers }
    )
    dashboardStats.value = res.data
  } catch (err: any) {
    console.error('Error fetching dashboard stats:', err)
    statsError.value = 'No se pudieron cargar las estadísticas del periodo'
  } finally {
    statsLoading.value = false
  }
}

onMounted(async () => {
  await fetchStudentData()
})

// Watch for year change to reload periods
watch(selectedYearId, () => {
  loadPeriodsForYear()
})

// Watch for period change to reload statistics
watch(selectedPeriodId, () => {
  fetchStats()
})

const studentName = auth.isMonitoring ? auth.monitoringUser?.nombre : (auth.user?.name?.split(' ')[0] || 'Estudiante')

// Chart configs
const barChartData = computed(() => {
  if (!dashboardStats.value) return { labels: [], datasets: [] }
  
  const isBest = activeChartTab.value === 'best'
  const items = isBest 
    ? dashboardStats.value.top_materias_mejores 
    : dashboardStats.value.top_materias_peores

  return {
    labels: items.map((i: any) => i.materia.length > 15 ? i.materia.substring(0, 15) + '...' : i.materia),
    datasets: [{
      label: isBest ? 'Mejores Promedios' : 'Peores Promedios',
      data: items.map((i: any) => i.calificacion),
      backgroundColor: isBest ? 'rgba(99, 102, 241, 0.85)' : 'rgba(244, 63, 94, 0.85)',
      borderColor: isBest ? '#6366f1' : '#f43f5e',
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false
    }]
  }
})

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleFont: { size: 12, weight: 'bold' as const },
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { weight: 'bold' as const, size: 9 } }
    },
    y: {
      min: 0,
      max: 5,
      grid: { color: 'rgba(148, 163, 184, 0.08)' },
      ticks: { color: '#94a3b8', stepSize: 1, font: { weight: 'bold' as const, size: 9 } }
    }
  }
}

const doughnutChartData = computed(() => {
  if (!dashboardStats.value) return { labels: [], datasets: [] }
  const c = dashboardStats.value.reportes_conteo
  return {
    labels: ['Académicos', 'Disciplinarios', 'Convivenciales'],
    datasets: [{
      data: [c.ACADEMICA, c.DISCIPLINARIA, c.CONVIVENCIAL],
      backgroundColor: ['#6366f1', '#f59e0b', '#ec4899'],
      hoverOffset: 4,
      borderWidth: 0
    }]
  }
})

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        color: '#64748b',
        font: { weight: 'bold' as const, size: 10 },
        padding: 12,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      padding: 10,
      cornerRadius: 8
    }
  },
  cutout: '70%'
}

// Check if there are observations to draw
const hasObservations = computed(() => {
  if (!dashboardStats.value) return false
  const c = dashboardStats.value.reportes_conteo
  return (c.ACADEMICA + c.DISCIPLINARIA + c.CONVIVENCIAL) > 0
})

</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

    <!-- Contador Regresivo de Cierre de Período Académico -->
    <PeriodCountdownBanner />

    <!-- Welcome Hero Banner -->
    <div class="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 rounded-3xl p-8 md:p-10 text-white shadow-2xl">
      <!-- Background Accents -->
      <div class="absolute -right-24 -top-20 h-72 w-72 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute left-1/2 -bottom-16 h-56 w-56 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none"></div>
      <div class="absolute right-1/4 top-6 h-24 w-24 bg-violet-400/30 rounded-full blur-xl animate-pulse pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2 mb-5">
            <Sparkles :size="16" class="text-yellow-300" />
            <span class="text-sm font-bold text-white/90">Portal Estudiantil</span>
          </div>
          <h1 class="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            ¡Hola, <span class="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">{{ studentName }}</span>! 🎓
          </h1>
          <p class="mt-4 text-indigo-100 text-lg font-medium max-w-lg leading-relaxed">
            Bienvenido a tu portal académico. Aquí podrás consultar tus notas, asistencias, observaciones y tu historial académico.
          </p>

          <!-- Year & Period Selectors -->
          <div v-if="academicYears.length > 0" class="mt-6 flex flex-wrap items-center gap-3">
            <div class="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
              <CalendarDays :size="18" class="text-indigo-200" />
              <select 
                v-model="selectedYearId"
                class="bg-transparent text-white text-sm font-bold outline-none cursor-pointer appearance-none pr-6"
                style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right center; background-size: 1.2em;"
              >
                <option v-for="y in academicYears" :key="y['id_anio']" :value="y['id_anio']" class="text-slate-900">
                  Año {{ y.calendario }}
                </option>
              </select>
            </div>

            <div v-if="periods.length > 0" class="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
              <Clock :size="18" class="text-indigo-200" />
              <select 
                v-model="selectedPeriodId"
                class="bg-transparent text-white text-sm font-bold outline-none cursor-pointer appearance-none pr-6"
                style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right center; background-size: 1.2em;"
              >
                <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo" class="text-slate-900">
                  {{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' (Activo)' : '' }}
                </option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Student Card Avatar -->
        <div class="shrink-0 flex flex-col items-center gap-3">
          <div class="h-24 w-24 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-xl">
            <GraduationCap :size="48" class="text-white" />
          </div>
          <div class="flex items-center gap-1.5 bg-emerald-400/20 border border-emerald-400/30 rounded-full px-3 py-1">
            <div class="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span class="text-emerald-200 text-xs font-bold">Activo</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Stats Banner (KPIs Vivos con protección opcional) -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
      <!-- Card Promedio -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm">
        <div class="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-4 rounded-2xl">
          <ClipboardList :size="24" stroke-width="2.5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Promedio General</p>
          <div v-if="statsLoading" class="h-6 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1"></div>
          <p v-else-if="dashboardStats?.promedio_general !== null" class="text-2xl font-black text-slate-800 dark:text-white mt-0.5 font-mono">
            {{ dashboardStats.promedio_general }}
          </p>
          <p v-else class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 italic leading-tight">
            Faltan datos para cubrir este registro
          </p>
        </div>
      </div>

      <!-- Card Materias -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm">
        <div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl">
          <BookOpen :size="24" stroke-width="2.5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Materias (A/R)</p>
          <div v-if="statsLoading" class="h-6 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1"></div>
          <div v-else-if="dashboardStats?.materias_aprobadas !== null" class="flex items-baseline gap-1.5 mt-0.5">
            <span class="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {{ dashboardStats.materias_aprobadas }}
            </span>
            <span class="text-[10px] text-slate-400 font-bold uppercase">A</span>
            <span v-if="dashboardStats?.materias_reprobadas > 0" class="text-2xl font-black text-rose-500 dark:text-rose-400 ml-1.5">
              {{ dashboardStats.materias_reprobadas }}
            </span>
            <span v-if="dashboardStats?.materias_reprobadas > 0" class="text-[10px] text-slate-400 font-bold uppercase">R</span>
          </div>
          <div v-else class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 italic leading-tight">
            Sin datos suficientes
          </div>
        </div>
      </div>

      <!-- Card Asistencia -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm">
        <div class="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-4 rounded-2xl">
          <CalendarCheck :size="24" stroke-width="2.5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Asistencia</p>
          <div v-if="statsLoading" class="h-6 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1"></div>
          <div v-else-if="dashboardStats?.asistencia_porcentaje !== null" class="mt-0.5">
            <p class="text-2xl font-black text-slate-800 dark:text-white font-mono leading-none">
              {{ dashboardStats.asistencia_porcentaje }}%
            </p>
            <p class="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mt-1">
              {{ dashboardStats?.inasistencias_total ?? 0 }} fallas
            </p>
          </div>
          <div v-else class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 italic leading-tight">
            Sin datos suficientes
          </div>
        </div>
      </div>

      <!-- Card Puesto Académico -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm">
        <div class="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-4 rounded-2xl">
          <Star :size="24" stroke-width="2.5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Puesto en Grupo</p>
          <div v-if="statsLoading" class="h-6 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1"></div>
          <p v-else-if="dashboardStats?.puesto_academico" class="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
            {{ dashboardStats.puesto_academico.puesto }}° <span class="text-xs font-bold text-slate-400">de {{ dashboardStats.puesto_academico.total_estudiantes }}</span>
          </p>
          <p v-else class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 italic leading-tight">
            Sin datos suficientes
          </p>
        </div>
      </div>
    </div>

    <!-- Charts Section (Gráficos interactivos de rendimiento) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Chart Mejores / Peores Materias (Bar) -->
      <div class="lg:col-span-7 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col min-h-[350px]">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-lg font-black text-slate-800 dark:text-white">Rendimiento por Materias</h3>
            <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Top 5 del periodo seleccionado</p>
          </div>
          
          <!-- Tabs switch -->
          <div class="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 self-start">
            <button
              @click="activeChartTab = 'best'"
              :class="[
                'px-4 py-1.5 text-xs font-bold rounded-lg transition-all',
                activeChartTab === 'best'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              ]"
            >
              <span class="flex items-center gap-1.5"><ThumbsUp :size="12" /> Mejores</span>
            </button>
            <button
              @click="activeChartTab = 'worst'"
              :class="[
                'px-4 py-1.5 text-xs font-bold rounded-lg transition-all',
                activeChartTab === 'worst'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              ]"
            >
              <span class="flex items-center gap-1.5"><ThumbsDown :size="12" /> Bajos</span>
            </button>
          </div>
        </div>

        <div class="flex-1 relative min-h-[200px]">
          <div v-if="statsLoading" class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!dashboardStats || !dashboardStats?.has_calificaciones || dashboardStats?.top_materias_mejores?.length === 0" class="absolute inset-0 flex items-center justify-center text-slate-400 italic text-sm">
            Faltan datos para cubrir este registro.
          </div>
          <Bar v-else :data="barChartData" :options="barChartOptions" />
        </div>
      </div>

      <!-- Chart Observaciones / Reportes (Doughnut) -->
      <div class="lg:col-span-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col min-h-[350px]">
        <div class="mb-6">
          <h3 class="text-lg font-black text-slate-800 dark:text-white">Observaciones y Reportes</h3>
          <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Distribución de registros de convivencia</p>
        </div>

        <div class="flex-1 relative flex items-center justify-center min-h-[200px]">
          <div v-if="statsLoading" class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!hasObservations" class="flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div class="h-16 w-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-700 mb-4 border border-dashed border-slate-200 dark:border-slate-800">
              <MessageSquare :size="28" />
            </div>
            <p class="text-sm font-black uppercase tracking-wider text-slate-500">Excelente Conducta</p>
            <p class="text-xs mt-1 max-w-[200px] leading-relaxed">No tienes reportes disciplinarios ni convivenciales este periodo.</p>
          </div>
          <div v-else class="w-full h-full min-h-[200px] relative">
            <Doughnut :data="doughnutChartData" :options="doughnutChartOptions" />
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-15px]">
              <span class="text-3xl font-black text-slate-700 dark:text-white leading-none">
                {{ (dashboardStats?.reportes_conteo?.ACADEMICA || 0) + (dashboardStats?.reportes_conteo?.DISCIPLINARIA || 0) + (dashboardStats?.reportes_conteo?.CONVIVENCIAL || 0) }}
              </span>
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Registros</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actividades Recientes & Boletín Oficial -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Actividades Recientes (Timeline) - Ocupa 8 columnas para mayor holgura -->
      <div class="lg:col-span-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col">
        <div class="mb-6">
          <h3 class="text-lg font-black text-slate-800 dark:text-white">Últimas Actividades Evaluadas</h3>
          <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Actividades de materias activas del periodo</p>
        </div>

        <div class="flex-1 relative min-h-[220px]">
          <!-- No Active Enrollment Warning -->
          <div v-if="!statsLoading && (!dashboardStats || periods.length === 0)" class="text-center py-20 px-6 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-indigo-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto">
             <div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
               <GraduationCap :size="36" />
             </div>
             <h2 class="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">¡Hola {{ (studentName || '').split(' ')[0] }}! Aviso de Matrícula</h2>
             <p class="text-slate-600 dark:text-slate-300 max-w-md mx-auto mt-3 font-medium text-sm leading-relaxed">
               Aún no tienes una matrícula activa para el año lectivo <span class="font-black text-indigo-600 dark:text-indigo-400">{{ yearStore.selectedYear?.calendario || 'seleccionado' }}</span>.
             </p>
             <p class="text-xs text-slate-400 dark:text-slate-500 mt-2">
               Si crees que se trata de un error o deseas consultar el estado de tu proceso de matrícula, comunícate con la administración de tu colegio.
             </p>
          </div>
          <div v-else-if="statsLoading" class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!dashboardStats || dashboardStats?.actividades_recientes?.length === 0" class="absolute inset-0 flex flex-col items-center justify-center text-center text-slate-400 p-6">
            <Calendar :size="32" class="text-slate-300 mb-2" />
            <p class="text-sm italic">No hay actividades publicadas para tu grupo este periodo.</p>
          </div>
          <div v-else class="space-y-5">
            <div 
              v-for="(act, idx) in dashboardStats?.actividades_recientes" 
              :key="idx" 
              class="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 pb-1 last:pb-0"
            >
              <!-- Timeline Dot -->
              <div 
                :class="[
                  'absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900',
                  act.calificada ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'
                ]"
              ></div>

              <div class="flex items-start justify-between gap-4">
                <div>
                  <h4 class="text-sm font-black text-slate-700 dark:text-slate-200 leading-snug">
                    {{ act.actividad }}
                    <span class="text-[9px] font-black uppercase text-slate-400 ml-1.5">({{ act.porcentaje }}%)</span>
                  </h4>
                  <p class="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">
                    {{ act.materia }}
                  </p>
                </div>
                
                <div class="shrink-0 text-right">
                  <span 
                    v-if="act.calificada && act.nota !== null" 
                    :class="[
                      'px-3 py-1 rounded-xl text-xs font-black font-mono',
                      act.nota >= 3.0 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                        : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30'
                    ]"
                  >
                    {{ act.nota.toFixed(2) }}
                  </span>
                  <span 
                    v-else 
                    class="bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border border-slate-100 dark:border-slate-800"
                  >
                    Pendiente
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Boletin Export Card (Ocupa 4 columnas al lado de las actividades) -->
      <div class="lg:col-span-4 flex flex-col justify-stretch">
        <div 
          v-if="studentId && selectedPeriodId"
          class="group relative bg-indigo-900/5 dark:bg-indigo-900/10 rounded-3xl border-2 border-indigo-100 dark:border-indigo-900/40 p-6 transition-all duration-300 hover:shadow-xl overflow-hidden flex-1 flex flex-col justify-between"
        >
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <div>
            <div class="bg-indigo-100 dark:bg-indigo-900/55 text-indigo-600 dark:text-indigo-400 p-4 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300 mb-6">
              <FileDown :size="28" stroke-width="2.5" />
            </div>
            <h3 class="text-lg font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              Boletín Oficial
              <span class="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">PDF</span>
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Descarga tu reporte oficial consolidado de calificaciones correspondientes al periodo seleccionado.
            </p>
          </div>
          
          <BoletinExportModule 
            :student-id="studentId" 
            :period-id="selectedPeriodId" 
          />
        </div>
      </div>

    </div>

  </div>
</template>
