<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { 
  GraduationCap, 
  MessageSquare,
  Bell,
  Zap,
  Star,
  SearchX,
  FileText,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Info,
  BarChart3
} from 'lucide-vue-next'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale,
  ArcElement,
  Filler,
  BarElement
} from 'chart.js'
import { Line, Doughnut, Bar } from 'vue-chartjs'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale,
  ArcElement,
  Filler,
  BarElement
)

import BoletinExportModule from '../../components/boletines/BoletinExportModule.vue'
import { useAcademicYearStore } from '../../stores/academicYear'

const router = useRouter()
const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const selectedChildId = ref<number | null>(null)
const selectedPeriodId = ref<number | 'all' | null>(null)
const loading = ref(true)
const dashboardData = ref<any>({
  children: [],
  studentStats: [],
  recentActivity: [],
  activePeriod: null,
  periods: []
})

const fetchDashboardData = async () => {
  try {
    const id_usuario = auth.user?.id
    const params: any = {}
    if (selectedPeriodId.value) params.id_periodo = selectedPeriodId.value
    if (yearStore.selectedYearId) params.yearId = yearStore.selectedYearId

    // Use full URL to avoid Vite SPA fallback issues
    const response = await axios.get(`http://localhost:3000/api/student/parent-dashboard/${id_usuario}`, { params })
    console.log('[Dashboard] Data Received:', response.data)
    
    // Validate that we got JSON and not an HTML error page
    if (typeof response.data !== 'object' || response.data === null || !response.data.children) {
      throw new Error('Invalid response format (received HTML instead of JSON)')
    }

    dashboardData.value = response.data
    
    if (!selectedPeriodId.value && dashboardData.value?.activePeriod) {
      selectedPeriodId.value = dashboardData.value.activePeriod.id_periodo
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
  } finally {
    loading.value = false
  }
}

// Watch for period changes
watch(selectedPeriodId, () => {
  fetchDashboardData()
})

watch(() => yearStore.selectedYearId, () => {
  fetchDashboardData()
})

onMounted(() => {
  fetchDashboardData()
})

const selectedChild = computed(() => {
  if (selectedChildId.value === null) return null
  return dashboardData.value?.children?.find((c: any) => c.id_estudiante === selectedChildId.value)
})

// Computes aggregated stats for all children
const cumulativeStats = computed(() => {
  const stats = dashboardData.value?.studentStats || []
  if (stats.length === 0) return null

  const totalAvg = stats.reduce((acc: number, s: any) => acc + s.average, 0) / stats.length
  
  // Aggregate attendance
  const attTotal = stats.reduce((acc: any, s: any) => {
    acc.presentes += s.attendanceDetails.presentes
    acc.ausentes += s.attendanceDetails.ausentes
    acc.tardes += s.attendanceDetails.tardes
    acc.total += s.attendanceDetails.total
    return acc
  }, { presentes: 0, ausentes: 0, tardes: 0, total: 0 })
  
  const attRate = attTotal.total > 0 ? (attTotal.presentes / attTotal.total) * 100 : 100

  // Aggregate risks
  const allAtRiskSubjects = stats.flatMap((s: any) => s.atRiskSubjects || [])
  const totalAtRisk = stats.reduce((acc: number, s: any) => acc + s.atRisk, 0)
  const totalPending = stats.reduce((acc: number, s: any) => acc + s.pendingActivities, 0)

  // Aggregate evolution (average of averages per period name)
  const periodMap = new Map<string, { sum: number, count: number }>()
  stats.forEach((s: any) => {
    s.evolution?.forEach((e: any) => {
      const current = periodMap.get(e.periodo) || { sum: 0, count: 0 }
      periodMap.set(e.periodo, { sum: current.sum + e.promedio, count: current.count + 1 })
    })
  })
  const globalEvolution = Array.from(periodMap.entries()).map(([periodo, data]) => ({
    periodo,
    promedio: parseFloat((data.sum / data.count).toFixed(2))
  })).sort((a,b) => a.periodo.localeCompare(b.periodo))

  // Aggregate subjects for all children to calculate averaged grades per unique subject
  const materiasMap = new Map<string, { totalCalificacion: number; count: number; detalles: { estudiante: string; calificacion: number }[] }>()
  
  stats.forEach((s: any) => {
    const child = dashboardData.value?.children?.find((c: any) => c.id_estudiante === s.id_estudiante)
    const childName = child ? `${child.nombre}` : `Estudiante #${s.id_estudiante}`

    s.grades?.forEach((g: any) => {
      const current = materiasMap.get(g.materia) || { totalCalificacion: 0, count: 0, detalles: [] }
      current.totalCalificacion += g.calificacion
      current.count += 1
      current.detalles.push({ estudiante: childName, calificacion: g.calificacion })
      materiasMap.set(g.materia, current)
    })
  })

  const globalGrades = Array.from(materiasMap.entries()).map(([materia, data]) => ({
    materia,
    calificacion: parseFloat((data.totalCalificacion / data.count).toFixed(2)),
    detalles: data.detalles
  }))

  const sortedGlobalGrades = [...globalGrades].sort((a, b) => b.calificacion - a.calificacion)
  const top_materias_mejores = sortedGlobalGrades.slice(0, 5)
  const top_materias_peores = [...sortedGlobalGrades].reverse().slice(0, 5)

  return {
    id_estudiante: null,
    average: parseFloat(totalAvg.toFixed(2)),
    atRisk: totalAtRisk,
    atRiskSubjects: [...new Set(allAtRiskSubjects)],
    attendanceRate: Math.round(attRate),
    attendanceDetails: attTotal,
    pendingActivities: totalPending,
    evolution: globalEvolution,
    top_materias_mejores,
    top_materias_peores
  }
})

const activeStats = computed(() => {
  if (selectedChildId.value === null) return cumulativeStats.value
  return dashboardData.value?.studentStats?.find((s: any) => s.id_estudiante === selectedChildId.value)
})

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Reciente'
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short'
  })
}

// Global Chart: Family Comparison
const familyChartData = computed(() => {
  const children = dashboardData.value?.children || []
  const studentStats = dashboardData.value?.studentStats || []
  return {
    labels: children.map((c: any) => c.nombre),
    datasets: [{
      label: 'Promedio General',
      backgroundColor: children.map((_: any, i: number) => 
        `hsla(${220 + (i * 45)}, 70%, 60%, 0.6)`
      ),
      borderRadius: 12,
      data: children.map((c: any) => {
        const stats = studentStats.find((s: any) => s.id_estudiante === c.id_estudiante)
        return stats ? stats.average : 0
      })
    }]
  }
})

const familyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      callbacks: {
        label: (context: any) => `Promedio: ${context.raw}`
      }
    }
  },
  scales: {
    y: { min: 0, max: 5, grid: { color: 'rgba(0,0,0,0.05)' } },
    x: { grid: { display: false } }
  }
}

// Evolution Chart: Active (Single or Family Avg)
const lineChartData = computed(() => {
  const periodsList = dashboardData.value?.periods || []
  if (periodsList.length === 0) return { labels: [], datasets: [] }
  
  const periodNames = periodsList.map((p: any) => p.nombre)

  const colors = [
    { border: '#4f46e5', bg: 'rgba(79, 70, 229, 0.03)' }, // Indigo
    { border: '#10b981', bg: 'rgba(16, 185, 129, 0.03)' }, // Emerald
    { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.03)' }, // Rose
    { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.03)' }, // Amber
    { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.03)' }  // Violet
  ]

  // If selectedChildId is null (All Children), render one line per child
  if (selectedChildId.value === null) {
    const stats = dashboardData.value?.studentStats || []
    const datasets = stats.map((s: any, idx: number) => {
      const child = dashboardData.value?.children?.find((c: any) => c.id_estudiante === s.id_estudiante)
      const name = child ? child.nombre : `Hijo #${s.id_estudiante}`
      const color = colors[idx % colors.length]

      const data = periodNames.map((pName: string) => {
        const ev = s.evolution?.find((e: any) => e.periodo === pName)
        return ev ? ev.promedio : null
      })

      return {
        label: name,
        backgroundColor: color.bg,
        borderColor: color.border,
        pointBackgroundColor: color.border,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: color.border,
        data,
        fill: true,
        tension: 0.4
      }
    })

    return {
      labels: periodNames,
      datasets
    }
  } else {
    // If a specific child is selected, render only their line
    const s = dashboardData.value?.studentStats?.find((st: any) => st.id_estudiante === selectedChildId.value)
    if (!s) return { labels: [], datasets: [] }

    const child = dashboardData.value?.children?.find((c: any) => c.id_estudiante === selectedChildId.value)
    const name = child ? child.nombre : 'Estudiante'
    
    const data = periodNames.map((pName: string) => {
      const ev = s.evolution?.find((e: any) => e.periodo === pName)
      return ev ? ev.promedio : null
    })

    return {
      labels: periodNames,
      datasets: [
        {
          label: `Promedio de ${name}`,
          backgroundColor: 'rgba(79, 70, 229, 0.05)',
          borderColor: '#4f46e5',
          pointBackgroundColor: '#4f46e5',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#4f46e5',
          data,
          fill: true,
          tension: 0.4
        }
      ]
    }
  }
})

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { 
      display: selectedChildId.value === null, // Display legend only in All Children mode
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        boxWidth: 6,
        padding: 15,
        font: { weight: 'bold' as const, size: 10 }
      }
    },
    tooltip: {
      backgroundColor: '#1e293b',
      padding: 12,
      titleFont: { size: 14, weight: 'bold' as const },
      bodyFont: { size: 13 },
      usePointStyle: true,
    }
  },
  scales: {
    y: { min: 0, max: 5, grid: { display: false } },
    x: { grid: { display: false } }
  }
}

const doughnutChartData = computed(() => {
  if (!activeStats.value) return { labels: [], datasets: [] }
  const det = activeStats.value.attendanceDetails
  return {
    labels: ['Asistencias', 'Inasistencias', 'Tardanzas'],
    datasets: [
      {
        backgroundColor: ['#10b981', '#f43f5e', '#f59e0b'],
        data: [det.presentes, det.ausentes, det.tardes],
        borderWidth: 0,
        hoverOffset: 10
      }
    ]
  }
})

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { usePointStyle: true, padding: 20 } }
  },
  cutout: '70%'
}

// Top 5 Best / Worst Subjects Chart Logic
const activeChartTab = ref<'best' | 'worst'>('best')

const barChartData = computed(() => {
  if (!activeStats.value) return { labels: [], datasets: [] }
  
  const isBest = activeChartTab.value === 'best'
  const items = isBest 
    ? activeStats.value.top_materias_mejores 
    : activeStats.value.top_materias_peores

  if (!items || !items.length) return { labels: [], datasets: [] }

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
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleFont: { size: 12, weight: 'bold' as const },
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (context: any) => {
          const index = context.dataIndex
          const isBest = activeChartTab.value === 'best'
          const items = isBest 
            ? activeStats.value?.top_materias_mejores 
            : activeStats.value?.top_materias_peores

          if (!items || !items[index]) return `Promedio: ${context.raw}`

          const item = items[index]
          // If we are looking at aggregated stats (All Children) and child details exist
          if (item.detalles && item.detalles.length > 0) {
            const lines = [`Promedio General: ${item.calificacion}`]
            item.detalles.forEach((d: any) => {
              lines.push(`${d.estudiante}: ${d.calificacion}`)
            })
            return lines
          }
          return `Promedio: ${item.calificacion}`
        }
      }
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
      ticks: { 
        color: '#94a3b8', 
        stepSize: 1, 
        font: { weight: 'bold' as const, size: 9 },
        callback: (value: any) => {
          // Only show integer labels on Y axis
          if (Math.floor(value) === value) {
            return value
          }
          return ''
        }
      }
    }
  }
}
</script>

<template>
  <div class="space-y-10 animate-in fade-in duration-700 pb-20">
    <div class="relative overflow-hidden group">
      <div class="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 text-white shadow-2xl relative z-10 transition-colors duration-500">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
          <div class="space-y-6">
            <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-indigo-300">
              <Zap :size="16" class="text-amber-400 animate-pulse" />
              Intelligence Core Family
            </div>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
              {{ auth.user?.name.split(' ')[0] }}, <span class="text-indigo-400 italic">análisis familiar.</span>
            </h1>
            
            <div class="flex flex-wrap items-center gap-4">
              <button 
                @click="router.push('/soporte?tipo_incidencia=REINGRESO')"
                class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
              >
                🔄 Solicitar Reingreso Estudiantil
              </button>

              <!-- Child Switcher -->
      <div v-if="dashboardData?.children?.length > 1" class="flex flex-wrap items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
        <button 
          @click="selectedChildId = null"
          :class="[
            'px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap',
            selectedChildId === null ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
          ]"
        >
          Todos
        </button>
        <button 
          v-for="child in dashboardData.children" 
          :key="child.id_estudiante"
          @click="selectedChildId = child.id_estudiante"
          :class="[
            'px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap',
            selectedChildId === child.id_estudiante ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
          ]"
        >
          {{ child.nombre }}
        </button>
      </div>

              <!-- Period Selector -->
              <div v-if="dashboardData?.periods?.length > 0" class="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                <select 
                  v-model="selectedPeriodId"
                  class="bg-transparent text-white text-xs font-black uppercase tracking-wider px-4 py-2 outline-none cursor-pointer appearance-none"
                >
                  <option value="all" class="bg-slate-900 text-white">Todos los Periodos</option>
                  <option v-for="p in dashboardData.periods" :key="p.id_periodo" :value="p.id_periodo" class="bg-slate-900 text-white">
                    {{ p.nombre }}
                  </option>
                </select>
                <Clock :size="16" class="text-indigo-400 mr-2" />
              </div>
            </div>
          </div>

          <div v-if="activeStats" class="flex gap-4 w-full lg:w-auto">
            <div class="flex-1 lg:w-48 bg-white/5 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/10 text-center">
              <p class="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Promedio Actual</p>
              <p class="text-5xl font-black">{{ activeStats.average }}</p>
            </div>
            <div class="flex-1 lg:w-48 bg-emerald-600/20 backdrop-blur-md rounded-[2.5rem] p-6 border border-emerald-500/20 text-center">
              <p class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Asistencia</p>
              <p class="text-5xl font-black text-emerald-400">{{ activeStats.attendanceRate }}%</p>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute -right-20 -top-20 h-96 w-96 bg-indigo-600/20 rounded-full blur-[120px]"></div>
    </div>

    <!-- Family Overview (Global) - ONLY SHOW IN "TODOS" MODE -->
    <div v-if="selectedChildId === null && dashboardData?.children?.length > 1" class="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95 duration-500">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-2xl font-black text-slate-800 dark:text-white">Comparativa Familiar</h2>
          <p class="text-sm text-slate-500 font-medium italic">Rendimiento general de todos los hijos</p>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400">
          <BarChart3 :size="24" />
        </div>
      </div>
      <div class="h-64">
        <Bar :data="familyChartData" :options="familyChartOptions" />
      </div>
    </div>

    <!-- Main Grid: Analytics -->
    <div v-if="!loading && activeStats" class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      <div class="lg:col-span-8 space-y-8">
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-2xl">
                <AlertTriangle :size="24" />
              </div>
              <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Materias en Riesgo</p>
                <p class="text-2xl font-black" :class="activeStats.atRisk > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'">
                  {{ activeStats.atRisk }}
                </p>
              </div>
            </div>
            <p v-if="activeStats.atRisk > 0" class="text-xs text-rose-500 font-medium leading-tight">
               ¡Atención! Materias críticas detectadas: {{ activeStats.atRiskSubjects.join(', ') }}
            </p>
            <p v-else class="text-xs text-emerald-500 font-medium">Todo bajo control académico.</p>
          </div>

          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-2xl">
                <Clock :size="24" />
              </div>
              <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Actividades Pendientes</p>
                <p class="text-2xl font-black text-slate-800 dark:text-white">{{ activeStats.pendingActivities }}</p>
              </div>
            </div>
            <p class="text-xs text-slate-500 font-medium">En el {{ dashboardData.activePeriod?.nombre || 'periodo actual' }}.</p>
          </div>

          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-2xl">
                <GraduationCap :size="24" />
              </div>
              <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Periodo Actual</p>
                <p class="text-sm font-black text-slate-800 dark:text-white uppercase">{{ dashboardData.activePeriod?.nombre || 'Cargando...' }}</p>
              </div>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
               <div class="bg-indigo-600 h-full w-[45%] rounded-full"></div>
            </div>
          </div>
        </div>

        <!-- Gráfica de Evolución (Solo si se selecciona "Todos los periodos") -->
        <div v-if="selectedPeriodId === 'all'" class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-in fade-in duration-500">
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <TrendingUp :size="24" class="text-indigo-600" />
              Evolución del Rendimiento
            </h3>
            <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Info :size="14" />
              Promedios por Periodo
            </div>
          </div>
          <div class="h-80 w-full">
            <Line :data="lineChartData" :options="lineChartOptions" />
          </div>
        </div>

        <!-- Gráfica de Top 5 Materias (Solo si se selecciona un periodo individual) -->
        <div v-else class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between animate-in fade-in duration-500">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <BarChart3 :size="24" class="text-indigo-600" />
                Rendimiento por Materias
              </h3>
              <p class="text-xs text-slate-400 font-medium">Top 5 materias con promedios extremos en el periodo</p>
            </div>
            <!-- Tabs Mejores / Peores -->
            <div class="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl self-start sm:self-auto">
              <button 
                @click="activeChartTab = 'best'"
                :class="[
                  'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                  activeChartTab === 'best' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                ]"
              >
                Mejores
              </button>
              <button 
                @click="activeChartTab = 'worst'"
                :class="[
                  'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                  activeChartTab === 'worst' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                ]"
              >
                Peores
              </button>
            </div>
          </div>
          <div class="h-80 relative">
            <div v-if="!activeStats || !activeStats.top_materias_mejores?.length" class="flex flex-col items-center justify-center h-full opacity-35">
              <BarChart3 :size="48" />
              <span class="text-xs font-bold uppercase tracking-widest mt-2">Sin datos disponibles</span>
            </div>
            <Bar v-else :data="barChartData" :options="barChartOptions" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
             <h3 class="text-xl font-black text-slate-800 dark:text-white mb-6">Asistencia Anual</h3>
             <div class="h-60">
               <Doughnut :data="doughnutChartData" :options="doughnutChartOptions" />
             </div>
           </div>

           <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
             <h3 class="text-xl font-black text-slate-800 dark:text-white mb-4 italic">Perfil Académico</h3>
             <div v-if="selectedChild" class="space-y-4 animate-in slide-in-from-right duration-500">
                <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <span class="text-xs font-bold text-slate-400">Año Escolar</span>
                  <span class="text-sm font-black text-slate-800 dark:text-white">2026</span>
                </div>
                <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <span class="text-xs font-bold text-slate-400">Grado Especial</span>
                  <span class="text-sm font-black text-slate-800 dark:text-white">{{ selectedChild.grado }}</span>
                </div>
                <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <span class="text-xs font-bold text-slate-400">Sección</span>
                  <span class="text-sm font-black text-slate-800 dark:text-white">Grupo {{ selectedChild.grupo }}</span>
                </div>
             </div>
             <div v-else class="py-10 text-center opacity-30 flex flex-col items-center gap-2">
               <Zap :size="48" />
               <p class="text-xs font-black uppercase">Vista Familiar Global</p>
             </div>
             
             <div v-if="selectedChildId && selectedPeriodId" class="mt-4">
               <BoletinExportModule 
                 :student-id="selectedChildId" 
                 :period-id="selectedPeriodId" 
                 :student-name="selectedChild?.nombre"
               />
             </div>

             <router-link to="/dashboard/notas-hijos" class="mt-4 w-full py-4 bg-white/5 border border-white/10 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest text-center shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                Ver Notas Detalladas
                <ChevronRight :size="16" />
             </router-link>
           </div>
        </div>
      </div>

      <div class="lg:col-span-4 space-y-8">
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
           <h3 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 mb-8">
              <Bell :size="20" class="text-amber-500" />
              Notificaciones Recientes
           </h3>

           <div v-if="dashboardData.recentActivity.length === 0" class="py-20 text-center opacity-50 space-y-4">
              <FileText :size="48" class="mx-auto" />
              <p class="text-sm font-bold">Aún no hay actividad reciente.</p>
           </div>

           <div v-else class="space-y-6 max-h-[400px] overflow-y-auto pr-2">
              <div v-for="(act, idx) in dashboardData.recentActivity" :key="idx" class="flex gap-4 group">
                 <div class="relative flex flex-col items-center">
                    <div :class="[
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110',
                      act.tipo_actividad === 'CALIFICACION' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                    ]">
                       <component :is="act.tipo_actividad === 'CALIFICACION' ? Star : MessageSquare" :size="16" />
                    </div>
                    <div v-if="(idx as number) < dashboardData.recentActivity.length - 1" class="w-px flex-1 bg-slate-100 dark:bg-slate-800 my-2"></div>
                 </div>
                 <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                      {{ act.estudiante.split(' ')[0] }} • {{ formatDate(act.fecha) }}
                    </p>
                    <p class="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                       {{ act.tipo_actividad === 'CALIFICACION' ? 'Nueva nota en ' + act.materia : 'Observación registrada' }}
                    </p>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">{{ act.detalle }}</p>
                 </div>
              </div>
           </div>
        </div>

        <div class="bg-slate-900 text-white rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
           <div class="relative z-10">
              <h4 class="text-lg font-black italic">Atención a Padres</h4>
              <p class="text-xs text-slate-400 leading-relaxed font-medium">
                 Si tienes dudas sobre el rendimiento académico o asistencia, solicita una cita con el docente titular.
              </p>
              <div class="pt-4 flex flex-col gap-3">
                 <button @click="router.push('/dashboard/directorio')" class="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                    Directorio Institucional
                 </button>
                 <button @click="router.push('/dashboard/soporte')" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                    Soporte Técnico
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="flex flex-col items-center justify-center py-40">
       <div class="w-16 h-16 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
       <p class="mt-6 text-slate-500 font-black uppercase tracking-widest text-sm animate-pulse">Analizando ecosistema familiar...</p>
    </div>

    <div v-else class="text-center py-40 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
       <SearchX :size="80" class="mx-auto text-slate-200 mb-6" />
       <h2 class="text-2xl font-black">No pudimos encontrar tus datos</h2>
       <p class="text-slate-500 max-w-sm mx-auto mt-2">
         Parece que no tienes hijos matriculados para el año lectivo vigente. Contacta a la institución.
       </p>
    </div>
  </div>
</template>

<style scoped>
.custom-shadow {
  box-shadow: 0 20px 50px rgba(79, 70, 229, 0.1);
}
.animate-in {
  animation-fill-mode: both;
}
.fade-in {
  animation-name: fadeIn;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
