<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  GraduationCap, 
  ClipboardList, 
  CalendarCheck,
  TrendingUp,
  AlertCircle,
  FileX,
  Users,
  BellRing
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
import { useThemeStore } from '../../stores/theme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const theme = useThemeStore()
const auth = useAuthStore()

const loading = ref(true)
const dashboardData = ref({
  coursesCount: 0,
  studentsCount: 0,
  noGradeActivities: 0,
  upToDateCourses: 0,
  courseAverages: [] as {name: string; shortName: string; average: number}[],
  alerts: [] as {type: string; message: string}[]
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
        backgroundColor: dashboardData.value.courseAverages.map(c => c.average < 3.0 ? '#ef4444' : '#6366f1'),
        data: dashboardData.value.courseAverages.map(c => c.average),
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
    // When a directivo is monitoring, load data for the observed teacher
    const userId = auth.isMonitoring
      ? auth.monitoringUser?.id
      : (auth.user?.id_usuario || auth.user?.id)
    if (!userId) return
    const response = await axios.get(`http://localhost:3000/api/teacher/dashboard/${userId}`)
    dashboardData.value = response.data
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboard()
})

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
    
    <!-- Welcome Header -->
    <div class="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 md:p-10 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
      <div class="relative z-10 transition-transform hover:scale-[1.02] duration-300">
        <h1 class="text-3xl md:text-4xl font-black mb-3 text-white tracking-tight">¡Hola, Profe {{ (auth.user as any)?.nombre?.split(' ')[0] || auth.user?.name?.split(' ')[0] || '' }}! 🍎</h1>
        <p class="text-indigo-100 text-lg max-w-md font-medium leading-relaxed">
          Manejas <span class="font-extrabold text-white bg-white/20 px-2 py-0.5 rounded-lg ml-1 whitespace-nowrap">{{ dashboardData.coursesCount }} cursos</span> activos actualmente. Cuentas con {{ dashboardData.studentsCount }} estudiantes en total.
        </p>
      </div>
      <div class="flex flex-col sm:flex-row gap-4 relative z-10">
        <router-link
          v-if="!auth.isMonitoring"
          to="/dashboard/calificaciones"
          class="bg-white/10 hover:bg-white/25 active:scale-95 border border-white/20 backdrop-blur-md px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ring-1 ring-white/10 text-white"
        >
          <ClipboardList :size="20" class="text-indigo-200" />
          Subir Notas
        </router-link>
        <div v-else class="bg-white/10 border border-white/20 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 text-white/70">
          <ClipboardList :size="20" />
          Panel en solo lectura
        </div>
      </div>
      <!-- Background Accents -->
      <div class="absolute -right-20 -bottom-20 h-96 w-96 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute right-40 top-0 h-40 w-40 bg-indigo-400/30 rounded-full blur-2xl animate-pulse pointer-events-none"></div>
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
              Periodo Vigente
            </span>
          </div>
          
          <div class="flex-1 w-full relative min-h-[300px]">
            <Bar 
              v-if="dashboardData.courseAverages.length > 0"
              :data="chartData" 
              :options="chartOptions as any" 
            />
            <div 
              v-else 
              class="absolute inset-0 flex flex-col items-center justify-center text-center opacity-70"
            >
              <FileX :size="48" class="text-slate-300 dark:text-slate-600 mb-4" />
              <p class="text-slate-500 dark:text-slate-400 font-semibold">No hay promedios calculados aún.</p>
              <p class="text-xs text-slate-400 dark:text-slate-500">Agrega calificaciones para ver la gráfica.</p>
            </div>
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
  @apply bg-slate-200 dark:bg-slate-700 rounded-full;
}
</style>
