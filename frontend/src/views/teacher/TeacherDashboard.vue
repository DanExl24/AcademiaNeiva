<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { teacherService } from '../../services/teacherService'
import { 
  GraduationCap, 
  ClipboardList, 
  CalendarCheck,
  TrendingUp,
  AlertCircle,
  FileX,
  Users,
  BellRing,
  Calendar,
  SlidersHorizontal,
  Sparkles
} from 'lucide-vue-next'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import EmptyChartState from '../../components/charts/EmptyChartState.vue'
import { useThemeStore } from '../../stores/theme'
import { useAcademicYearStore } from '../../stores/academicYear'
import PeriodCountdownBanner from '../../components/PeriodCountdownBanner.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const theme = useThemeStore()
const auth = useAuthStore()
const yearStore = useAcademicYearStore()

const loading = ref(true)
const selectedPeriodId = ref<number | null>(null)
const availablePeriods = ref<any[]>([])

const teacherName = computed(() => {
  return auth.isMonitoring 
    ? (auth.monitoringUser?.nombre || 'Docente') 
    : ((auth.user as any)?.nombre?.split(' ')[0] || auth.user?.name?.split(' ')[0] || 'Docente')
})

const hasCourseGrades = computed(() => {
  return (dashboardData.value.courseAverages || []).some((c: any) => Number(c.average ?? c.promedio ?? 0) > 0)
})

const dashboardData = ref({
  coursesCount: 0,
  studentsCount: 0,
  noGradeActivities: 0,
  upToDateCourses: 0,
  courseAverages: [] as {name: string; shortName: string; average: number}[],
  alerts: [] as {type: string; message: string}[],
  activePeriodInfo: null as any
})

// Quick Stats
const teacherStats = computed(() => [
  { name: 'Cursos Asignados', value: dashboardData.value.coursesCount.toString(), icon: GraduationCap, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  { name: 'Estudiantes Activos', value: dashboardData.value.studentsCount.toString(), icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  { name: 'Sin Evaluar (Actividades)', value: dashboardData.value.noGradeActivities.toString(), icon: FileX, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/40' },
  { name: 'Cursos al Día', value: dashboardData.value.upToDateCourses.toString(), icon: CalendarCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
])

// Chart Config
const chartData = computed(() => {
  return {
    labels: dashboardData.value.courseAverages.map(c => c.shortName),
    datasets: [
      {
        label: 'Promedio Grupal Actual',
        backgroundColor: dashboardData.value.courseAverages.map(c => Number(c.average || 0) < 3.0 ? '#ef4444' : '#6366f1'),
        data: dashboardData.value.courseAverages.map(c => Number(c.average || 0)),
        borderRadius: 8,
        borderWidth: 0,
      }
    ]
  }
})

const chartOptions = computed(() => {
  const isDark = theme.isDark
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context: any) => `Promedio: ${context.parsed.y.toFixed(1)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        grid: { color: isDark ? '#334155' : '#f1f5f9' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { weight: 'bold' } }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { weight: 'bold' } }
      }
    },
    animation: {
      duration: 1200,
      easing: 'easeOutQuart'
    }
  }
})

const fetchDashboard = async () => {
  try {
    loading.value = true
    // When a directivo is monitoring, load data for the observed teacher
    const userId = auth.isMonitoring
      ? auth.monitoringUser?.id
      : (auth.user?.id_usuario || auth.user?.id)
    if (!userId) {
      return
    }
    const params: any = {}
    if (yearStore.selectedYearId) params.yearId = yearStore.selectedYearId
    if (selectedPeriodId.value) params.periodId = selectedPeriodId.value
    const schoolId = auth.selectedSchoolId || auth.user?.schoolId || (auth.user as any)?.id_colegio || (auth.isSupervising ? (auth.supervision?.colegio_id || auth.supervision?.id_colegio) : null)
    if (schoolId) params.schoolId = schoolId

    const data = await teacherService.getDashboard(userId, params)
    dashboardData.value = data
    availablePeriods.value = data.availablePeriods || []

    if (data.activePeriodInfo && !selectedPeriodId.value) {
      selectedPeriodId.value = data.activePeriodInfo.id_periodo
    }
  } catch (error: any) {
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboard()
})

watch(() => yearStore.selectedYearId, () => {
  selectedPeriodId.value = null
  fetchDashboard()
})


const onPeriodChange = () => {
  fetchDashboard()
}

const onYearChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target?.value) {
    yearStore.setSelectedYearId(Number(target.value))
    selectedPeriodId.value = null
    fetchDashboard()
  }
}

const getAlertIcon = (type: string) => {
  switch (type) {
    case 'riesgo': return AlertCircle
    case 'entregas': return FileX
    case 'faltas': return CalendarCheck
    case 'promedio_grupal': return TrendingUp
    default: return BellRing
  }
}

const getAlertColors = (type: string) => {
  switch (type) {
    case 'riesgo': return 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50'
    case 'entregas': return 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50'
    case 'faltas': return 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50'
    case 'promedio_grupal': return 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/50'
    default: return 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-700'
  }
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Contador Regresivo de Cierre de Período Académico -->
    <PeriodCountdownBanner :period-info="dashboardData?.activePeriodInfo" />

    <!-- Welcome Header Card with Glassmorphism & Modern Filter Bar -->
    <div class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-900/95 via-indigo-800/85 to-purple-950/90 dark:from-slate-900/95 dark:via-indigo-950/90 dark:to-purple-950/90 border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-2xl p-7 sm:p-9 text-white transition-all duration-300">
      
      <!-- Ambient Glow Orbs -->
      <div class="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <!-- Identity & Greeting Section -->
        <div class="space-y-3">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/15 backdrop-blur-md text-[11px] font-black uppercase tracking-wider text-indigo-200 shadow-inner">
            <Sparkles :size="13" class="text-amber-300 animate-pulse" />
            <span>Portal Docente • {{ auth.isMonitoring ? 'Supervisión Activa' : 'Panel de Gestión' }}</span>
          </div>

          <div>
            <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              ¡Hola, Profe {{ teacherName }}! <span class="inline-block transform hover:rotate-12 transition-transform duration-300 cursor-default">🍎</span>
            </h1>
            <p class="text-indigo-100/85 dark:text-slate-300 text-sm sm:text-base font-medium mt-1 max-w-xl leading-relaxed">
              Manejas <span class="font-extrabold text-white bg-white/15 dark:bg-white/10 px-2.5 py-0.5 rounded-lg whitespace-nowrap">{{ dashboardData.coursesCount }} cursos</span> activos y <span class="font-extrabold text-white bg-white/15 dark:bg-white/10 px-2.5 py-0.5 rounded-lg whitespace-nowrap">{{ dashboardData.studentsCount }} estudiantes</span> en total.
            </p>
          </div>
        </div>

        <!-- Quick Action Button -->
        <div class="flex flex-col sm:flex-row gap-3 shrink-0">
          <router-link
            v-if="!auth.isMonitoring"
            to="/dashboard/calificaciones"
            class="group inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white text-indigo-950 dark:bg-indigo-600 dark:text-white font-black text-sm shadow-xl shadow-indigo-950/20 hover:shadow-indigo-500/25 hover:bg-indigo-50 dark:hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all duration-200 border border-white/60 dark:border-indigo-400/30"
          >
            <ClipboardList :size="18" class="text-indigo-600 dark:text-white group-hover:rotate-6 transition-transform" />
            <span>Subir Notas</span>
          </router-link>
          <div v-else class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 font-bold text-xs text-white/80 backdrop-blur-md">
            <ClipboardList :size="16" />
            <span>Modo solo lectura</span>
          </div>
        </div>
      </div>

      <!-- Modern Glass Filter Bar -->
      <div class="mt-6 pt-5 border-t border-white/15 dark:border-white/10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
        <div class="flex items-center gap-2 text-indigo-200/90 dark:text-indigo-300 font-black text-xs uppercase tracking-wider">
          <SlidersHorizontal :size="15" />
          <span>Filtros del Dashboard:</span>
        </div>

        <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <!-- Year Selector -->
          <div v-if="yearStore.availableYears.length > 0" class="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 dark:bg-slate-800/60 dark:hover:bg-slate-800/80 border border-white/15 dark:border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md transition-all shadow-sm group flex-1 sm:flex-initial">
            <Calendar :size="15" class="text-indigo-200 group-hover:text-white transition-colors shrink-0" />
            <label class="text-[10px] font-black text-indigo-200/80 uppercase shrink-0">Año:</label>
            <select
              :value="yearStore.selectedYearId"
              @change="onYearChange"
              class="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-2"
            >
              <option v-for="y in yearStore.availableYears" :key="y.id_anio" :value="y.id_anio" class="text-slate-900 bg-white">
                {{ y.calendario }}
              </option>
            </select>
          </div>

          <!-- Period Selector with Status Indicator -->
          <div class="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 dark:bg-slate-800/60 dark:hover:bg-slate-800/80 border border-white/15 dark:border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md transition-all shadow-sm group flex-1 sm:flex-initial">
            <CalendarCheck :size="15" class="text-indigo-200 group-hover:text-white transition-colors shrink-0" />
            <label class="text-[10px] font-black text-indigo-200/80 uppercase shrink-0">Periodo:</label>
            <select
              v-model="selectedPeriodId"
              @change="onPeriodChange"
              class="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-2"
            >
              <option value="all" class="text-slate-900 bg-white">Todos los Periodos (Acumulado)</option>
              <option v-for="p in availablePeriods" :key="p.id_periodo" :value="p.id_periodo" class="text-slate-900 bg-white">
                {{ p.nombre }} {{ p.estado === 'ABIERTO' ? '● Abierto' : '(Cerrado)' }}
              </option>
            </select>
            <!-- Period Status Pill / Dot -->
            <span 
              v-if="dashboardData.activePeriodInfo"
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0',
                dashboardData.activePeriodInfo?.estado === 'ABIERTO' 
                  ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' 
                  : 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
              ]"
            >
              <span :class="['w-1.5 h-1.5 rounded-full', dashboardData.activePeriodInfo?.estado === 'ABIERTO' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400']"></span>
              {{ dashboardData.activePeriodInfo?.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium italic">Calculando estadísticas...</p>
    </div>

    <!-- Analytics Dashboard -->
    <template v-else>
      <!-- Quick Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="stat in teacherStats" 
          :key="stat.name" 
          class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-4 group cursor-default"
        >
          <div :class="[stat.bg, stat.color, 'p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300']">
            <component :is="stat.icon" :size="28" stroke-width="2.5" />
          </div>
          <div>
            <p class="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{{ stat.name }}</p>
            <p class="text-3xl font-black text-slate-800 dark:text-white mt-1 tracking-tight">{{ stat.value }}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Course Averages Chart -->
        <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm transition-colors flex flex-col">
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <TrendingUp :size="24" class="text-indigo-600 dark:text-indigo-400" />
              Promedios Actuales por Curso
            </h3>
            <span class="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full uppercase tracking-wider">
              {{ dashboardData.activePeriodInfo?.nombre || 'Periodo Vigente' }}
            </span>
          </div>
          
          <div class="flex-1 w-full relative min-h-[300px] flex items-center justify-center">
            <Bar 
              v-if="hasCourseGrades"
              :data="chartData" 
              :options="chartOptions as any" 
            />
            <EmptyChartState 
              v-else 
              :icon="TrendingUp"
              :badge-text="dashboardData.activePeriodInfo?.estado === 'CERRADO' ? 'Periodo Cerrado' : 'Periodo en curso'"
              title="Sin promedios calculados aún"
              description="La gráfica de rendimiento por curso se generará automáticamente a medida que existan notas registradas en las actividades del periodo."
            />
          </div>
        </div>

        <!-- Academic Alerts List -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm transition-colors flex flex-col max-h-[500px]">
          <div class="flex items-center justify-between mb-6 shrink-0">
            <h3 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <BellRing :size="22" class="text-rose-600 dark:text-rose-400 mb-0.5" />
              Alertas Académicas
            </h3>
            <span v-if="dashboardData.alerts.length > 0" class="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold">
              {{ dashboardData.alerts.length }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            <div v-if="dashboardData.alerts.length === 0" class="h-full flex flex-col items-center justify-center text-center py-10 opacity-70">
              <CalendarCheck :size="40" class="text-emerald-400 dark:text-emerald-500 mb-3" />
              <p class="text-slate-600 dark:text-slate-300 font-bold">¡Todo en orden!</p>
              <p class="text-sm text-slate-400 mt-1">No hay alertas de bajo rendimiento ni entregas pendientes detectadas.</p>
            </div>
            
            <div 
              v-for="(alert, idx) in dashboardData.alerts" 
              :key="idx" 
              class="p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] flex items-start gap-3"
              :class="getAlertColors(alert.type)"
            >
              <component :is="getAlertIcon(alert.type)" :size="20" class="mt-0.5 shrink-0" stroke-width="2.5" />
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-black uppercase tracking-wider opacity-70 mb-0.5">
                  {{ alert.type.replace('_', ' ') }}
                </p>
                <p class="text-sm font-semibold leading-snug">
                  {{ alert.message }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 9999px;
}
</style>
