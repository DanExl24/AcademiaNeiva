<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { parentService } from '../../services/parentService'
import { useAuthStore } from '../../stores/auth'
import { 
  GraduationCap, 
  MessageSquare,
  Bell,
  Zap,
  Star,
  FileText,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Info,
  BarChart3,
  CalendarCheck
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
import EmptyChartState from '../../components/charts/EmptyChartState.vue'

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
import PeriodCountdownBanner from '../../components/PeriodCountdownBanner.vue'

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
    const id_usuario = (auth.isMonitoring && auth.monitoringUser) ? (auth.monitoringUser.id || (auth.monitoringUser as any).id_usuario) : (auth.user?.id_usuario || auth.user?.id)
    const params: any = {}
    if (selectedPeriodId.value) params.id_periodo = selectedPeriodId.value
    if (yearStore.selectedYearId) params.yearId = yearStore.selectedYearId

    const data = await parentService.getParentDashboard(id_usuario, params)
    console.log('[Dashboard] Data Received:', data)
    
    // Validate that we got JSON and not an HTML error page
    if (typeof data !== 'object' || data === null || !data.children) {
      throw new Error('Invalid response format (received HTML instead of JSON)')
    }

    dashboardData.value = data


    // Si el padre tiene sólo 1 hijo, seleccionarlo automáticamente por defecto
    if (dashboardData.value?.children?.length === 1 && !selectedChildId.value) {
      selectedChildId.value = dashboardData.value.children[0].id_estudiante
    }
    
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

watch(() => auth.monitoringUser, () => {
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
      if (g.calificacion === null || g.calificacion === undefined || isNaN(Number(g.calificacion))) return
      const calif = Number(g.calificacion)
      const current = materiasMap.get(g.materia) || { totalCalificacion: 0, count: 0, detalles: [] }
      const existingIdx = current.detalles.findIndex((d: any) => d.estudiante === childName)
      if (existingIdx >= 0) {
        current.totalCalificacion -= current.detalles[existingIdx].calificacion
        current.detalles[existingIdx].calificacion = calif
        current.totalCalificacion += calif
      } else {
        current.totalCalificacion += calif
        current.count += 1
        current.detalles.push({ estudiante: childName, calificacion: calif })
      }
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

const hasFamilyGrades = computed(() => {
  const stats = dashboardData.value?.studentStats || []
  return stats.length > 0 && stats.some((s: any) => Number(s.average) > 0)
})

const hasEvolutionData = computed(() => {
  const datasets = lineChartData.value?.datasets || []
  return datasets.length > 0 && datasets.some((d: any) => d.data?.some((v: any) => v !== null && Number(v) > 0))
})

const hasSubjectGrades = computed(() => {
  const list = activeChartTab.value === 'best' 
    ? (activeStats.value?.top_materias_mejores || [])
    : (activeStats.value?.top_materias_peores || [])
  return list.length > 0 && list.some((m: any) => Number(m.calificacion) > 0)
})

const hasAttendanceData = computed(() => {
  return Boolean(activeStats.value?.attendanceDetails && activeStats.value.attendanceDetails.total > 0)
})

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Reciente'
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short'
  })
}

const maxGrade = computed(() => {
  const val = Number(dashboardData.value?.defaultSettings?.nota_maxima)
  return val > 0 ? val : 5
})

const approvalGrade = computed(() => {
  const val = Number(dashboardData.value?.defaultSettings?.nota_aprobacion)
  return val > 0 ? val : 3.0
})

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
        return stats ? Number(stats.average || 0) : 0
      })
    }]
  }
})

const familyChartOptions = computed(() => ({
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
    y: { min: 0, max: maxGrade.value, grid: { color: 'rgba(0,0,0,0.05)' } },
    x: { grid: { display: false } }
  }
}))

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
        return ev && ev.promedio !== null ? Number(ev.promedio) : null
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
      return ev && ev.promedio !== null ? Number(ev.promedio) : null
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

const lineChartOptions = computed(() => ({
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
    y: { min: 0, max: maxGrade.value, grid: { display: false } },
    x: { grid: { display: false } }
  }
}))

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
      data: items.map((i: any) => Number(i.calificacion || 0)),
      backgroundColor: isBest ? 'rgba(99, 102, 241, 0.85)' : 'rgba(244, 63, 94, 0.85)',
      borderColor: isBest ? '#6366f1' : '#f43f5e',
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false
    }]
  }
})

const barChartOptions = computed(() => ({
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
            const validDetalles = item.detalles.filter((d: any) => d.calificacion !== null && d.calificacion !== undefined && !isNaN(Number(d.calificacion)))
            if (validDetalles.length > 0) {
              const lines = [`Promedio General: ${item.calificacion}`]
              validDetalles.forEach((d: any) => {
                lines.push(`${d.estudiante}: ${d.calificacion}`)
              })
              return lines
            }
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
      max: maxGrade.value,
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
}))
</script>

<template>
  <div class="space-y-6 sm:space-y-10 animate-in fade-in duration-700 pb-20">
    
    <!-- Contador Regresivo de Cierre de Período Académico -->
    <PeriodCountdownBanner :period-info="dashboardData?.activePeriod" />

    <div class="relative overflow-hidden group">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[3rem] p-4 sm:p-8 lg:p-10 text-white shadow-2xl relative z-10 transition-colors duration-500">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 sm:gap-10">
          <div class="space-y-3 sm:space-y-6 w-full lg:w-auto">
            <div class="inline-flex items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur-xl px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-2xl text-[9px] sm:text-xs font-black uppercase tracking-widest text-indigo-300">
              <Zap :size="13" class="text-amber-400 animate-pulse sm:w-4 sm:h-4" />
              Intelligence Core Family
            </div>
            <h1 class="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-tight">
              {{ (auth.isMonitoring && auth.monitoringUser) ? auth.monitoringUser.nombre : (auth.user?.name?.split(' ')[0] || 'Acudiente') }}, <span class="text-indigo-400 italic">análisis familiar.</span>
            </h1>
            
            <div class="flex flex-wrap items-center gap-2 sm:gap-4 pt-1">
              <button 
                @click="router.push('/soporte?tipo_incidencia=REINGRESO')"
                class="w-full sm:w-auto px-3.5 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
              >
                🔄 Solicitar Reingreso Estudiantil
              </button>

              <button 
                @click="router.push('/dashboard/matricula-hijos')"
                class="w-full sm:w-auto px-3.5 sm:px-5 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
              >
                📄 Matrícula y Expediente Digital
              </button>

              <!-- Child Switcher -->
              <div v-if="dashboardData?.children?.length > 1" class="w-full sm:w-auto flex flex-wrap items-center gap-1 sm:gap-2 bg-white/5 p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-white/10">
                <button 
                  @click="selectedChildId = null"
                  :class="[
                    'px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
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
                    'px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 cursor-pointer',
                    selectedChildId === child.id_estudiante ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  ]"
                >
                  <span>{{ child.nombre }}</span>
                  <span v-if="child.colegio_nombre" :class="selectedChildId === child.id_estudiante ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'" class="px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[8px] sm:text-[9px] font-bold">
                    {{ child.colegio_nombre }}
                  </span>
                </button>
              </div>

              <!-- Period Selector -->
              <div v-if="dashboardData?.periods?.length > 0" class="flex items-center gap-1.5 sm:gap-2 bg-white/5 p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-white/10">
                <select 
                  v-model="selectedPeriodId"
                  class="bg-transparent text-white text-[11px] sm:text-xs font-black uppercase tracking-wider px-2.5 sm:px-4 py-1 sm:py-2 outline-none cursor-pointer appearance-none"
                >
                  <option value="all" class="bg-slate-900 text-white">Todos los Periodos</option>
                  <option v-for="p in dashboardData.periods" :key="p.id_periodo" :value="p.id_periodo" class="bg-slate-900 text-white">
                    {{ p.nombre }}
                  </option>
                </select>
                <Clock :size="14" class="text-indigo-400 mr-2 sm:w-4 sm:h-4" />
              </div>
            </div>
          </div>

          <div v-if="activeStats" class="grid grid-cols-2 sm:flex sm:flex-row gap-2.5 sm:gap-4 w-full lg:w-auto">
            <div class="flex-1 lg:w-44 bg-white/5 backdrop-blur-md rounded-xl sm:rounded-[2.5rem] p-3.5 sm:p-6 border border-white/10 text-center flex flex-col justify-center">
              <p class="text-[9px] sm:text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-0.5 sm:mb-1">Promedio</p>
              <p class="text-2xl sm:text-5xl font-black">{{ activeStats.average > 0 ? activeStats.average : 'S/C' }}</p>
              <p v-if="!activeStats.average || activeStats.average === 0" class="text-[9px] text-indigo-300/80 font-bold uppercase tracking-wider mt-0.5 sm:mt-1">Sin Calificaciones</p>
            </div>
            <div class="flex-1 lg:w-44 bg-emerald-600/20 backdrop-blur-md rounded-xl sm:rounded-[2.5rem] p-3.5 sm:p-6 border border-emerald-500/20 text-center flex flex-col justify-center">
              <p class="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-0.5 sm:mb-1">Asistencia</p>
              <p class="text-2xl sm:text-5xl font-black text-emerald-400">{{ hasAttendanceData ? `${activeStats.attendanceRate}%` : '100%' }}</p>
              <p v-if="!hasAttendanceData" class="text-[9px] text-emerald-300/80 font-bold uppercase tracking-wider mt-0.5 sm:mt-1">Sin Inasistencias</p>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute -right-20 -top-20 h-96 w-96 bg-indigo-600/20 rounded-full blur-[120px]"></div>
    </div>

    <!-- Family Overview (Global) - ONLY SHOW IN "TODOS" MODE -->
    <div v-if="selectedChildId === null && dashboardData?.children?.length > 1" class="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95 duration-500">
      <div class="flex items-center justify-between mb-4 sm:mb-8">
        <div>
          <h2 class="text-lg sm:text-2xl font-black text-slate-800 dark:text-white">Comparativa Familiar</h2>
          <p class="text-xs sm:text-sm text-slate-500 font-medium italic">Rendimiento general de todos los hijos</p>
        </div>
        <div class="p-2 sm:p-3 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl text-slate-400">
          <BarChart3 :size="18" class="sm:w-6 sm:h-6" />
        </div>
      </div>
      <div class="h-60 sm:h-64">
        <Bar v-if="hasFamilyGrades" :data="familyChartData" :options="familyChartOptions" />
        <EmptyChartState 
          v-else 
          :icon="BarChart3"
          title="En espera de calificaciones familiares" 
          description="La comparativa general de rendimiento entre tus hijos se activará automáticamente al registrarse las primeras evaluaciones del año lectivo." 
        />
      </div>
    </div>

    <!-- Main Grid: Analytics -->
    <div v-if="!loading && activeStats" class="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
      
      <div class="lg:col-span-8 space-y-6 sm:space-y-8">
        
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-6">
          <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-4">
              <div class="p-2 sm:p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl sm:rounded-2xl shrink-0">
                <AlertTriangle :size="18" class="sm:w-6 sm:h-6" />
              </div>
              <div class="min-w-0">
                <p class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Materias Riesgo</p>
                <p class="text-xl sm:text-2xl font-black" :class="activeStats.atRisk > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'">
                  {{ activeStats.atRisk }}
                </p>
              </div>
            </div>
            <p v-if="activeStats.atRisk > 0" class="text-[11px] sm:text-xs text-rose-500 font-medium leading-tight">
               ¡Atención! &lt; {{ approvalGrade }}: {{ activeStats.atRiskSubjects.join(', ') }}
            </p>
            <p v-else class="text-[11px] sm:text-xs text-emerald-500 font-medium">Todo bajo control.</p>
          </div>

          <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-4">
              <div class="p-2 sm:p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-xl sm:rounded-2xl shrink-0">
                <Clock :size="18" class="sm:w-6 sm:h-6" />
              </div>
              <div class="min-w-0">
                <p class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Pendientes</p>
                <p class="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">{{ activeStats.pendingActivities }}</p>
              </div>
            </div>
            <p class="text-[11px] sm:text-xs text-slate-500 font-medium truncate">En el {{ dashboardData.activePeriod?.nombre || 'periodo actual' }}.</p>
          </div>

          <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-4">
              <div class="p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                <GraduationCap :size="18" class="sm:w-6 sm:h-6" />
              </div>
              <div class="min-w-0">
                <p class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Periodo Actual</p>
                <p class="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase truncate">{{ dashboardData.activePeriod?.nombre || 'Cargando...' }}</p>
              </div>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 sm:h-2 rounded-full overflow-hidden">
               <div class="bg-indigo-600 h-full w-[45%] rounded-full"></div>
            </div>
          </div>

          <!-- Quick Access: Expediente Digital Card -->
          <div 
            @click="router.push('/dashboard/matricula-hijos')"
            class="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/40 dark:to-purple-950/40 p-3.5 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-indigo-100 dark:border-indigo-900/60 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer group flex flex-col justify-between"
          >
            <div class="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-3">
              <div class="p-2 sm:p-3 bg-indigo-600 text-white rounded-xl sm:rounded-2xl shadow-md group-hover:scale-110 transition-transform shrink-0">
                <FileText :size="18" class="sm:w-5 sm:h-5" />
              </div>
              <div class="min-w-0">
                <p class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 truncate">Expediente</p>
                <p class="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">Matrícula</p>
              </div>
            </div>
            <div class="pt-1 flex items-center justify-between text-[10px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Ver ficha</span>
              <ChevronRight :size="14" class="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        <!-- Gráfica de Evolución (Solo si se selecciona "Todos los periodos") -->
        <div v-if="selectedPeriodId === 'all'" class="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-in fade-in duration-500">
          <div class="flex items-center justify-between mb-4 sm:mb-8">
            <h3 class="text-base sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 sm:gap-3">
              <TrendingUp :size="18" class="text-indigo-600 sm:w-6 sm:h-6" />
              <span>Evolución del Rendimiento</span>
            </h3>
            <div class="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Info :size="13" />
              <span class="hidden xs:inline">Promedios por Periodo</span>
            </div>
          </div>
          <div class="h-60 sm:h-80 w-full">
            <Line v-if="hasEvolutionData" :data="lineChartData" :options="lineChartOptions" />
            <EmptyChartState 
              v-else 
              :icon="TrendingUp"
              title="Evolución académica en preparación" 
              description="La trayectoria del promedio por periodos se trazará automáticamente al cerrar o evaluar los periodos académicos del año lectivo." 
            />
          </div>
        </div>

        <!-- Gráfica de Top 5 Materias (Solo si se selecciona un periodo individual) -->
        <div v-else class="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between animate-in fade-in duration-500">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <h3 class="text-base sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 sm:gap-3">
                <BarChart3 :size="18" class="text-indigo-600 sm:w-6 sm:h-6" />
                <span>Rendimiento por Materias</span>
              </h3>
              <p class="text-xs text-slate-400 font-medium">Top 5 materias con promedios extremos en el periodo</p>
            </div>
            <!-- Tabs Mejores / Peores -->
            <div class="flex bg-slate-50 dark:bg-slate-800 p-1 sm:p-1.5 rounded-xl self-start sm:self-auto">
              <button 
                @click="activeChartTab = 'best'"
                :class="[
                  'px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
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
                  'px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                  activeChartTab === 'worst' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                ]"
              >
                Peores
              </button>
            </div>
          </div>
          <div class="h-60 sm:h-80 relative">
            <Bar v-if="hasSubjectGrades" :data="barChartData" :options="barChartOptions" />
            <EmptyChartState 
              v-else 
              :icon="BarChart3"
              title="Sin calificaciones en este periodo" 
              description="Aún no se han publicado notas para las asignaturas del periodo académico seleccionado." 
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
           <div class="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
             <h3 class="text-base sm:text-xl font-black text-slate-800 dark:text-white mb-3 sm:mb-6">Asistencia Anual</h3>
             <div class="h-48 sm:h-60 flex items-center justify-center">
               <Doughnut v-if="hasAttendanceData" :data="doughnutChartData" :options="doughnutChartOptions" />
               <EmptyChartState 
                 v-else 
                 :icon="CalendarCheck"
                 :compact="true"
                 badge-text="Asistencia al 100%"
                 title="Sin inasistencias reportadas" 
                 description="El estudiante registra puntualidad completa y no tiene inasistencias reportadas en el año." 
               />
             </div>
           </div>

           <div class="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
             <div class="flex items-center justify-between mb-3 sm:mb-4">
               <h3 class="text-base sm:text-xl font-black text-slate-800 dark:text-white italic">Perfil Académico</h3>
               <span v-if="selectedChild" class="px-2 sm:px-3 py-0.5 sm:py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800">
                 {{ selectedChild.nombre }}
               </span>
             </div>

             <!-- Detalle para hijo seleccionado -->
             <div v-if="selectedChild" class="space-y-2.5 sm:space-y-3 animate-in slide-in-from-right duration-500">
                 <div class="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700/50">
                   <span class="text-xs font-bold text-slate-400">Estudiante</span>
                   <div class="flex items-center gap-2">
                     <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white">{{ selectedChild.nombre }} {{ selectedChild.apellido }}</span>
                     <span v-if="selectedChild.estado_estudiante && selectedChild.estado_estudiante !== 'ACTIVO'" :class="[
                       selectedChild.estado_estudiante === 'GRADUADO'
                         ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                         : selectedChild.estado_estudiante === 'RETIRADO'
                         ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                         : selectedChild.estado_estudiante === 'SANCIONADO'
                         ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                         : selectedChild.estado_estudiante === 'EXPULSADO'
                         ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800'
                         : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
                       'px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider border'
                     ]">
                       {{ selectedChild.estado_estudiante }}
                     </span>
                   </div>
                 </div>
                <div class="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700/50">
                  <span class="text-xs font-bold text-slate-400">Estado Matrícula</span>
                  <span :class="[
                    selectedChild.estado_matricula === 'ACTIVA' || selectedChild.estado_matricula === 'APROBADA'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : selectedChild.estado_matricula === 'TRASLADADA'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      : selectedChild.estado_matricula === 'PENDIENTE' || selectedChild.estado_matricula === 'PENDIENTE_RENOVACION'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : selectedChild.estado_matricula === 'CANCELADA' || selectedChild.estado_matricula === 'RECHAZADA'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : selectedChild.estado_matricula === 'INACTIVA'
                      ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
                    'px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider border shadow-xs'
                  ]">
                    {{ selectedChild.estado_matricula || 'MATRICULADO' }}
                  </span>
                </div>
                <div class="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700/50">
                  <span class="text-xs font-bold text-slate-400">Grado</span>
                  <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white">{{ selectedChild.grado || selectedChild.nivel || 'Sin Asignar' }}</span>
                </div>
                <div class="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700/50">
                  <span class="text-xs font-bold text-slate-400">Grupo</span>
                  <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white">{{ selectedChild.grupo || (selectedChild.seccion ? 'Sección ' + selectedChild.seccion : 'Sin Grupo') }}</span>
                </div>
                <div class="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700/50">
                  <span class="text-xs font-bold text-slate-400">Jornada</span>
                  <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase">{{ selectedChild.jornada || 'Única' }}</span>
                </div>
                <div v-if="selectedChild.codigo" class="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700/50">
                  <span class="text-xs font-bold text-slate-400">Código</span>
                  <span class="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">{{ selectedChild.codigo }}</span>
                </div>
             </div>

             <!-- Lista interactiva si se tiene seleccionada la "Vista Familiar Global" con varios hijos -->
             <div v-else-if="dashboardData?.children?.length" class="space-y-2 sm:space-y-2.5">
               <p class="text-[11px] text-slate-400 font-bold mb-1">Hijos Registrados en el Sistema:</p>
               <div 
                 v-for="child in dashboardData.children" 
                 :key="child.id_estudiante"
                 @click="selectedChildId = child.id_estudiante"
                 class="p-3 sm:p-3.5 bg-slate-50 hover:bg-indigo-50/60 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-700/60 cursor-pointer transition-all flex items-center justify-between group"
               >
                 <div>
                   <p class="text-xs font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                     {{ child.nombre }} {{ child.apellido }}
                   </p>
                   <p class="text-[10px] font-bold text-slate-400 mt-0.5">
                     {{ child.grado || 'Estudiante' }} • {{ child.grupo || 'Sin Grupo' }} • Jornada {{ child.jornada || 'Única' }}
                   </p>
                 </div>
                 <span class="px-2 sm:px-2.5 py-1 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 rounded-lg sm:rounded-xl shadow-xs text-[9px] sm:text-[10px] font-black uppercase tracking-wider group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center gap-1">
                   Ver ➔
                 </span>
               </div>
             </div>

             <div v-else class="py-10 text-center opacity-30 flex flex-col items-center gap-2">
               <Zap :size="48" />
               <p class="text-xs font-black uppercase">Sin Perfil Disponible</p>
             </div>
             
             <div v-if="selectedChildId && selectedPeriodId" class="mt-3 sm:mt-4">
               <BoletinExportModule 
                 :student-id="selectedChildId" 
                 :period-id="selectedPeriodId" 
                 :student-name="selectedChild?.nombre"
               />
             </div>

             <router-link to="/dashboard/notas-hijos" class="mt-3 sm:mt-4 w-full py-3 sm:py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest text-center transition-all flex items-center justify-center gap-2">
                Ver Notas Detalladas
                <ChevronRight :size="16" />
             </router-link>
           </div>
        </div>
      </div>

      <div class="lg:col-span-4 space-y-6 sm:space-y-8">
        <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-8">
           <h3 class="text-lg sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 mb-4 sm:mb-8">
              <Bell :size="18" class="text-amber-500 sm:w-5 sm:h-5" />
              <span>Notificaciones Recientes</span>
           </h3>

           <div v-if="dashboardData.recentActivity.length === 0" class="py-12 sm:py-20 text-center opacity-50 space-y-3 sm:space-y-4">
              <FileText :size="40" class="mx-auto text-slate-300 dark:text-slate-600 sm:w-12 sm:h-12" />
              <p class="text-xs sm:text-sm font-bold">Aún no hay actividad reciente.</p>
           </div>

           <div v-else class="space-y-4 sm:space-y-6 max-h-[400px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
              <div v-for="(act, idx) in dashboardData.recentActivity" :key="idx" class="flex gap-3 sm:gap-4 group">
                 <div class="relative flex flex-col items-center">
                    <div :class="[
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110',
                      act.tipo_actividad === 'CALIFICACION' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                    ]">
                       <component :is="act.tipo_actividad === 'CALIFICACION' ? Star : MessageSquare" :size="14" class="sm:w-4 sm:h-4" />
                    </div>
                    <div v-if="(idx as number) < dashboardData.recentActivity.length - 1" class="w-px flex-1 bg-slate-100 dark:bg-slate-800 my-1.5 sm:my-2"></div>
                 </div>
                 <div class="min-w-0">
                    <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                      {{ act.estudiante.split(' ')[0] }} • {{ formatDate(act.fecha) }}
                    </p>
                    <p class="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-tight">
                       {{ act.tipo_actividad === 'CALIFICACION' ? 'Nueva nota en ' + act.materia : 'Observación registrada' }}
                    </p>
                    <p class="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 italic line-clamp-2">{{ act.detalle }}</p>
                 </div>
              </div>
           </div>
        </div>

        <div class="bg-slate-900 text-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 space-y-4 sm:space-y-6 relative overflow-hidden">
           <div class="relative z-10">
              <h4 class="text-base sm:text-lg font-black italic">Atención a Padres</h4>
              <p class="text-xs text-slate-400 leading-relaxed font-medium mt-1">
                 Si tienes dudas sobre el rendimiento académico o asistencia, solicita una cita con el docente titular.
              </p>
              <div class="pt-3 sm:pt-4 flex flex-col gap-2.5 sm:gap-3">
                 <button @click="router.push('/dashboard/directorio')" class="w-full py-3 sm:py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                    Directorio Institucional
                 </button>
                 <button @click="router.push('/dashboard/soporte')" class="w-full py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                    Soporte Técnico
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="flex flex-col items-center justify-center py-24 sm:py-40">
       <div class="w-12 h-12 sm:w-16 sm:h-16 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
       <p class="mt-4 sm:mt-6 text-slate-500 font-black uppercase tracking-widest text-xs sm:text-sm animate-pulse">Analizando ecosistema familiar...</p>
    </div>

    <div v-else class="text-center py-12 sm:py-20 px-4 sm:px-6 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[3rem] border-2 border-dashed border-indigo-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto">
       <div class="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-sm">
         <GraduationCap :size="28" class="sm:w-9 sm:h-9" />
       </div>
       <h2 class="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">¡Hola! Aviso sobre la matrícula</h2>
       <p class="text-slate-600 dark:text-slate-300 max-w-md mx-auto mt-2 sm:mt-3 font-medium text-xs sm:text-sm leading-relaxed">
         Aún no tienes hijos matriculados para el año lectivo <span class="font-black text-indigo-600 dark:text-indigo-400">{{ yearStore.selectedYear?.calendario || 'seleccionado' }}</span>.
       </p>
       <p class="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 mt-1.5 sm:mt-2">
         Si crees que se trata de un error o deseas iniciar el proceso de matrícula o reingreso, comunícate con la institución educativa.
       </p>
       <div class="mt-5 sm:mt-6">
         <button 
           @click="router.push('/soporte?tipo_incidencia=REINGRESO')"
           class="px-5 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer"
         >
           🔄 Solicitar Matrícula / Reingreso Estudiantil
         </button>
       </div>
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
