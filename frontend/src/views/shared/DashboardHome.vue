<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp,
  Target,
  AlertTriangle,
  UserCheck,
  Filter
} from 'lucide-vue-next'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'
import { useThemeStore } from '../../stores/theme'

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement, 
  PointElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
)

const theme = useThemeStore()
const auth = useAuthStore()

const loading = ref(true)
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

// Data State
const dashboardData = ref({
  summary: {
    totalStudents: 0,
    totalTeachers: 0,
    attendanceToday: 0,
    generalAverage: 0,
    studentsAtRisk: 0,
    disciplinaryReports: 0,
    desertionRate: 0,
  },
  charts: {
    performanceByGrade: [] as {nombre: string, average: number}[],
    performanceBySubject: [] as {nombre: string, average: number}[],
    evolution: [] as {nombre: string, average: number}[]
  },
  lowPerformance: {
    criticalSubjects: [] as { nombre: string; failures: number }[],
    gradeAlerts: [] as { nombre: string; alerts: number }[],
    groupRisk: [] as { curso: string; at_risk: number; safe: number }[]
  }
})

const periods = ref<any[]>([])
const selectedPeriodId = ref<number | null>(null)

// Computed Stats for Cards
const dashboardStats = computed(() => [
  { name: 'Estudiantes', value: dashboardData.value.summary.totalStudents.toString(), icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
  { name: 'Docentes', value: dashboardData.value.summary.totalTeachers.toString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { name: 'Asistencia Hoy', value: `${dashboardData.value.summary.attendanceToday}%`, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { name: 'Riesgo Académico', value: dashboardData.value.summary.studentsAtRisk.toString(), icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
])

// Chart Configs
const chartOptionsBase = computed(() => {
  const isDark = theme.isDark
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        grid: { color: isDark ? '#334155' : '#f1f5f9' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  }
})

const horizontalOptions = computed(() => {
  const isDark = theme.isDark
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: chartOptionsBase.value.plugins,
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: isDark ? '#334155' : '#f1f5f9' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  }
})

const riskChartData = computed(() => ({
  labels: dashboardData.value.lowPerformance.groupRisk.map(r => r.curso),
  datasets: [
    {
      label: 'En Riesgo',
      data: dashboardData.value.lowPerformance.groupRisk.map(r => r.at_risk),
      backgroundColor: '#f87171',
      borderRadius: 6
    },
    {
      label: 'A Salvo',
      data: dashboardData.value.lowPerformance.groupRisk.map(r => r.safe),
      backgroundColor: '#34d399',
      borderRadius: 6
    }
  ]
}))

const riskChartOptions = computed(() => {
  const isDark = theme.isDark
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      ...chartOptionsBase.value.plugins,
      legend: { display: true, position: 'top' as const, labels: { color: isDark ? '#cbd5e1' : '#475569', font: { weight: 'bold' } } }
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: isDark ? '#334155' : '#f1f5f9' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  }
})

const gradeChartData = computed(() => ({
  labels: dashboardData.value.charts.performanceByGrade.map(g => g.nombre),
  datasets: [{
    label: 'Promedio Grado',
    data: dashboardData.value.charts.performanceByGrade.map(g => g.average),
    backgroundColor: '#6366f1',
    borderRadius: 8
  }]
}))

const subjectChartData = computed(() => ({
  labels: dashboardData.value.charts.performanceBySubject.map(s => s.nombre),
  datasets: [{
    label: 'Promedio Materia',
    data: dashboardData.value.charts.performanceBySubject.map(s => s.average),
    backgroundColor: '#10b981',
    borderRadius: 8
  }]
}))

const evolutionChartData = computed(() => ({
  labels: dashboardData.value.charts.evolution.map(e => e.nombre),
  datasets: [{
    label: 'Media Institucional',
    data: dashboardData.value.charts.evolution.map(e => e.average),
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    fill: true,
    tension: 0.4,
    pointRadius: 6,
    pointBackgroundColor: '#f59e0b'
  }]
}))

// Methods
const fetchDashboard = async () => {
  if (!schoolId.value) return
  loading.value = true
  try {
    const url = `http://localhost:3000/api/academic-admin/dashboard/${schoolId.value}`
    const params = selectedPeriodId.value ? { periodId: selectedPeriodId.value } : {}
    const response = await axios.get(url, { params })
    dashboardData.value = response.data
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
  } finally {
    loading.value = false
  }
}

const loadPeriods = async () => {
  if (!schoolId.value) return
  try {
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`)
    periods.value = response.data.periods
    // Set active period by default if none selected
    if (!selectedPeriodId.value) {
      const active = periods.value.find(p => p.estado === 'ABIERTO')
      if (active) selectedPeriodId.value = active.id_periodo
    }
  } catch (error) {
    console.error('Error loading periods:', error)
  }
}

watch(selectedPeriodId, fetchDashboard)

onMounted(async () => {
  await loadPeriods()
  await fetchDashboard()
})
</script>

<template>
  <div class="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
    
    <!-- Welcome & Period Selector -->
    <div class="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
      <div class="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-100 flex-1 relative overflow-hidden w-full">
        <div class="relative z-10">
          <h1 class="text-3xl font-black">¡Bienvenido, {{ auth.user?.name || 'Director' }}! 👋</h1>
          <p class="mt-2 text-indigo-100 max-w-md font-medium">
            Módulo <span class="font-bold underline text-white">Directivo</span>. Analiza el rendimiento institucional en tiempo real.
          </p>
        </div>
        <div class="absolute -right-10 -bottom-10 h-48 w-48 bg-white/10 rounded-full blur-3xl"></div>
      </div>
      
      <!-- Period Filter -->
      <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm w-full lg:w-72 flex flex-col gap-3">
        <label class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Filter :size="14" />
          Periodo Académico
        </label>
        <select 
          v-model="selectedPeriodId" 
          class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
        >
          <option :value="null">Periodo Activo (Auto)</option>
          <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
            {{ p.nombre }}
          </option>
        </select>
      </div>
    </div>

    <!-- Principal KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div 
        v-for="stat in dashboardStats" 
        :key="stat.name" 
        class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl dark:hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex items-center gap-5 group"
      >
        <div :class="[stat.bg, stat.color, 'p-5 rounded-2xl transition-transform group-hover:scale-110']">
          <component :is="stat.icon" :size="32" stroke-width="2.5" />
        </div>
        <div>
          <p class="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{{ stat.name }}</p>
          <p class="text-3xl font-black text-gray-900 dark:text-white mt-0.5 tracking-tight">
            {{ loading ? '...' : stat.value }}
          </p>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 gap-8">
      
      <!-- Performance by Grade -->
      <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 p-8 shadow-sm flex flex-col min-h-[450px] transition-colors">
        <h3 class="text-lg font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
          <TrendingUp :size="20" class="text-indigo-600" />
          Rendimiento por Grado
        </h3>
        <div class="flex-1 w-full">
          <Bar v-if="!loading" :data="gradeChartData" :options="horizontalOptions as any" />
        </div>
      </div>

      <!-- Performance by Subject -->
      <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 p-8 shadow-sm flex flex-col min-h-[500px] transition-colors">
        <h3 class="text-lg font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
          <BookOpen :size="20" class="text-emerald-500" />
          Rendimiento por Materia (Top 10)
        </h3>
        <div class="flex-1 w-full">
          <Bar v-if="!loading" :data="subjectChartData" :options="horizontalOptions as any" />
        </div>
      </div>

      <!-- Performance Evolution -->
      <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 p-8 shadow-sm flex flex-col min-h-[400px] transition-colors">
        <h3 class="text-lg font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
          <Target :size="20" class="text-amber-500" />
          Evolución del Promedio Institucional
        </h3>
        <div class="flex-1 w-full">
          <Line v-if="!loading" :data="evolutionChartData" :options="chartOptionsBase as any" />
        </div>
      </div>
    </div>

    <!-- Low Performance Analysis Section -->
    <div class="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
      <div class="relative z-10">
        <div class="flex items-center gap-4 mb-10">
          <div class="bg-rose-500 p-4 rounded-3xl shadow-lg shadow-rose-500/20">
            <AlertTriangle :size="32" class="text-white" />
          </div>
          <div>
            <h2 class="text-3xl font-black tracking-tight">Análisis de Desempeño Crítico</h2>
            <p class="text-slate-400 font-medium">Detectando focos de riesgo académico para intervención temprana.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-12">
          <!-- Risk by Course (STACKED HORIZONTAL) -->
          <div class="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[3rem] flex flex-col h-[550px]">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-xl font-bold flex items-center gap-2 text-indigo-400">
                <LayoutDashboard :size="20" />
                Riesgo de Reprobación por Curso
              </h3>
              <div class="flex gap-6 text-[10px] font-black uppercase tracking-widest bg-white/5 px-6 py-3 rounded-2xl border border-white/10">
                <span class="flex items-center gap-2 text-rose-400">
                  <div class="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div> En Riesgo
                </span>
                <span class="flex items-center gap-2 text-emerald-400">
                  <div class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div> A Salvo
                </span>
              </div>
            </div>
            <div class="flex-1 w-full">
              <Bar v-if="!loading" :data="riskChartData" :options="riskChartOptions as any" />
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <!-- Critical Subjects List -->
            <div class="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] flex flex-col h-[450px]">
              <div class="flex flex-col mb-6">
                <h3 class="text-lg font-bold flex items-center gap-2 text-rose-400">
                  <BookOpen :size="20" />
                  Materias Críticas
                </h3>
                <p class="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-tighter">Materias con mayor índice de reprobación</p>
              </div>
              <div class="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                <div 
                  v-for="(sub, idx) in dashboardData.lowPerformance.criticalSubjects" 
                  :key="idx"
                  class="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group"
                >
                  <div class="flex items-center gap-4 min-w-0">
                    <div class="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 font-black text-xs group-hover:scale-110 transition-transform">
                      #{{ idx + 1 }}
                    </div>
                    <span class="font-bold truncate text-sm text-slate-200">{{ sub.nombre }}</span>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-xs font-black bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full whitespace-nowrap">
                      {{ sub.failures }} Estudiantes
                    </span>
                  </div>
                </div>
                <div v-if="dashboardData.lowPerformance.criticalSubjects.length === 0" class="flex flex-col items-center justify-center h-full opacity-30 italic">
                  Sin datos de reprobación
                </div>
              </div>
            </div>

            <!-- Grade Alerts -->
            <div class="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] flex flex-col h-[450px]">
              <div class="flex flex-col mb-6">
                <h3 class="text-lg font-bold flex items-center gap-2 text-amber-400">
                  <Target :size="20" />
                  Alertas por Grado
                </h3>
                <p class="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-tighter">Estudiantes que reprueban una o más materias</p>
              </div>
              <div class="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                <div 
                  v-for="(grado, idx) in dashboardData.lowPerformance.gradeAlerts" 
                  :key="idx"
                  class="flex flex-col gap-2 p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
                >
                  <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-sm text-slate-200">{{ grado.nombre }}</span>
                    <span class="text-xs font-black text-amber-400">{{ grado.alerts }} Estudiantes</span>
                  </div>
                  <div class="w-full h-3 bg-white/5 rounded-full overflow-hidden shadow-inner p-[2px]">
                    <div 
                      class="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000" 
                      :style="{ width: `${Math.min(100, (grado.alerts / (dashboardData.summary.totalStudents || 1)) * 100 * 5)}%` }"
                    ></div>
                  </div>
                </div>
                <div v-if="dashboardData.lowPerformance.gradeAlerts.length === 0" class="flex flex-col items-center justify-center h-full opacity-30 italic">
                  Sin alertas registradas
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Decorative BG -->
      <div class="absolute -right-20 -top-20 h-80 w-80 bg-rose-500/10 rounded-full blur-[100px]"></div>
      <div class="absolute -left-20 -bottom-20 h-80 w-80 bg-indigo-500/10 rounded-full blur-[100px]"></div>
    </div>

    <!-- Average Institutional and Other Indicators -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
        <div class="bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 p-4 rounded-full mb-4">
          <AlertTriangle :size="28" />
        </div>
        <p class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Deserción Académica</p>
        <p class="text-3xl font-black text-gray-900 dark:text-white mt-1">{{ dashboardData.summary.desertionRate }} Estudiantes</p>
        <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-2 italic">Estudiantes retirados o con matrícula cancelada</p>
      </div>

      <div class="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
        <div class="bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 p-4 rounded-full mb-4">
          <ShieldAlert :size="28" />
        </div>
        <p class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Reportes Disciplinarios</p>
        <p class="text-3xl font-black text-gray-900 dark:text-white mt-1">{{ dashboardData.summary.disciplinaryReports }}</p>
        <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-2 italic">Total de seguimientos de tipo disciplinario</p>
      </div>

      <div class="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
        <div class="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 p-4 rounded-full mb-4">
          <Users :size="28" />
        </div>
        <p class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Promedio Institucional</p>
        <p class="text-3xl font-black text-gray-900 dark:text-white mt-1">{{ dashboardData.summary.generalAverage }}</p>
        <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-2 italic">Media general en escala de 0 a 5.0</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
</style>
