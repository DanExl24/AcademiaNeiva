<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { adminGeneralService } from '../../services/adminGeneralService'
import { socketService } from '../../services/socketService'
import { Doughnut, Line } from 'vue-chartjs'
import EmptyChartState from '../../components/charts/EmptyChartState.vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js'
import { 
  School, 
  Users, 
  Activity, 
  Database, 
  HardDrive, 
  Mail, 
  Network, 
  Sparkles,
  RefreshCw,
  TrendingUp
} from 'lucide-vue-next'
import DataTable from '../../components/ui/DataTable.vue'
import SkeletonTable from '../../components/feedback/SkeletonTable.vue'
import EmptyState from '../../components/feedback/EmptyState.vue'

// Register Chart.js components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement
)

const loading = ref(true)

const stats = ref<any>(null)
const error = ref('')

const fetchStats = async () => {
  try {
    loading.value = true
    error.value = ''
    const data = await adminGeneralService.getDashboardStats()
    stats.value = data
  } catch (err: any) {
    console.error('Error fetching admin dashboard stats:', err)
    error.value = 'No se pudieron cargar las estadísticas del panel general.'
  } finally {
    loading.value = false
  }
}


// WebSocket: escuchar actualizaciones de sesiones activas en tiempo real
let cleanupSocket: (() => void) | null = null

onMounted(() => {
  fetchStats()

  // Suscribirse al evento de sesiones activas
  cleanupSocket = socketService.on('active_sessions_update', (data: { conectados: number }) => {
    if (stats.value && stats.value.usuarios) {
      stats.value.usuarios.conectados = data.conectados
    }
  })
})

onUnmounted(() => {
  if (cleanupSocket) {
    cleanupSocket()
    cleanupSocket = null
  }
})


// Chart 1: Platform Growth (Line Chart)
const growthChartData = computed(() => {
  if (!stats.value || !stats.value.crecimiento) {
    return { labels: [], datasets: [] }
  }
  return {
    labels: stats.value.crecimiento.map((c: any) => c.mes),
    datasets: [{
      label: 'Colegios Registrados',
      data: stats.value.crecimiento.map((c: any) => c.colegios),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#fff',
      pointHoverRadius: 6,
      pointRadius: 4
    }]
  }
})

const growthChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      padding: 10,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' as const } }
    },
    y: {
      min: 0,
      grid: { color: 'rgba(148, 163, 184, 0.06)' },
      ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' as const } }
    }
  }
}

// Chart 2: User Distribution (Doughnut Chart)
const distributionChartData = computed(() => {
  if (!stats.value || !stats.value.distribucionUsuarios) {
    return { labels: [], datasets: [] }
  }
  const d = stats.value.distribucionUsuarios
  return {
    labels: ['Directivos', 'Docentes', 'Padres', 'Estudiantes'],
    datasets: [{
      data: [d.directivos, d.docentes, d.padres, d.estudiantes],
      backgroundColor: ['#6366f1', '#f59e0b', '#ec4899', '#10b981'],
      hoverOffset: 6,
      borderWidth: 0
    }]
  }
})

const hasGrowthData = computed(() => {
  const data = growthChartData.value?.datasets?.[0]?.data || []
  return data.length > 0 && data.some((v: any) => Number(v) > 0)
})

const hasDistributionData = computed(() => {
  const data = distributionChartData.value?.datasets?.[0]?.data || []
  return data.length > 0 && data.some((v: any) => Number(v) > 0)
})

const distributionChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        color: '#64748b',
        font: { weight: 'bold' as const, size: 11 },
        padding: 14,
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
</script>

<template>
  <div class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Welcome Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
      <div>
        <div class="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-2xl px-3.5 sm:px-4 py-1 sm:py-1.5 mb-2.5 sm:mb-3 text-[11px] sm:text-xs font-black uppercase tracking-wider">
          <Sparkles :size="14" class="animate-pulse" />
          Panel Global
        </div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white leading-tight">
          Dashboard Administrador General
        </h1>
        <p class="text-slate-400 dark:text-slate-500 font-medium text-xs sm:text-sm mt-0.5 sm:mt-1">
          Supervisión en tiempo real de colegios, usuarios, auditorías de acceso y salud del sistema.
        </p>
      </div>

      <button 
        @click="fetchStats"
        class="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all self-start md:self-auto cursor-pointer"
      >
        <RefreshCw :size="15" :class="{ 'animate-spin': loading }" />
        Actualizar Datos
      </button>
    </div>

    <!-- Error message banner -->
    <div v-if="error" class="p-3.5 sm:p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-semibold text-xs sm:text-sm flex items-center justify-between gap-3">
      <span>{{ error }}</span>
      <button @click="fetchStats" class="underline hover:text-white text-xs font-black cursor-pointer">Reintentar</button>
    </div>

    <!-- 1. RESUMEN GENERAL (Tarjetas superiores) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6">
      
      <!-- Colegios Registrados -->
      <div class="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-900 p-4 sm:p-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 text-slate-100 dark:text-slate-900 opacity-20 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
          <School :size="80" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Colegios</span>
          <div class="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 p-1.5 sm:p-2 rounded-xl">
            <School :size="16" class="sm:w-4.5 sm:h-4.5" />
          </div>
        </div>
        <div class="mt-3 sm:mt-4">
          <div v-if="loading" class="h-7 sm:h-8 w-14 sm:w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
          <p v-else class="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white font-mono leading-none">
            {{ stats?.colegios?.total ?? 0 }}
          </p>
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1">Registrados</p>
        </div>
      </div>

      <!-- Colegios Activos -->
      <div class="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-900 p-4 sm:p-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 text-emerald-100 dark:text-emerald-950/20 opacity-20 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
          <School :size="80" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Activos</span>
          <div class="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 p-1.5 sm:p-2 rounded-xl">
            <div class="h-3 w-3 sm:h-3.5 sm:w-3.5 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div class="mt-3 sm:mt-4">
          <div v-if="loading" class="h-7 sm:h-8 w-14 sm:w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
          <p v-else class="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-450 font-mono leading-none">
            {{ stats?.colegios?.activos ?? 0 }}
          </p>
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1">Operando</p>
        </div>
      </div>

      <!-- Colegios Pendientes -->
      <div class="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-900 p-4 sm:p-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 text-amber-100 dark:text-amber-950/20 opacity-20 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
          <School :size="80" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Pendientes</span>
          <div class="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 p-1.5 sm:p-2 rounded-xl">
            <div class="h-3 w-3 sm:h-3.5 sm:w-3.5 bg-amber-500 rounded-full"></div>
          </div>
        </div>
        <div class="mt-3 sm:mt-4">
          <div v-if="loading" class="h-7 sm:h-8 w-14 sm:w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
          <p v-else class="text-2xl sm:text-3xl font-black text-amber-500 font-mono leading-none">
            {{ stats?.colegios?.pendientes ?? 0 }}
          </p>
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1">Por Aprobación</p>
        </div>
      </div>

      <!-- Colegios Suspendidos -->
      <div class="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-900 p-4 sm:p-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 text-rose-100 dark:text-rose-950/20 opacity-20 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
          <School :size="80" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Suspendidos</span>
          <div class="bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-450 p-1.5 sm:p-2 rounded-xl">
            <div class="h-3 w-3 sm:h-3.5 sm:w-3.5 bg-rose-500 rounded-full"></div>
          </div>
        </div>
        <div class="mt-3 sm:mt-4">
          <div v-if="loading" class="h-7 sm:h-8 w-14 sm:w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
          <p v-else class="text-2xl sm:text-3xl font-black text-rose-500 font-mono leading-none">
            {{ stats?.colegios?.suspendidos ?? 0 }}
          </p>
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1">Revocado</p>
        </div>
      </div>

      <!-- Usuarios Totales -->
      <div class="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-900 p-4 sm:p-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 text-slate-100 dark:text-slate-900 opacity-20 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
          <Users :size="80" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Usuarios</span>
          <div class="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 p-1.5 sm:p-2 rounded-xl">
            <Users :size="16" class="sm:w-4.5 sm:h-4.5" />
          </div>
        </div>
        <div class="mt-3 sm:mt-4">
          <div v-if="loading" class="h-7 sm:h-8 w-16 sm:w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
          <p v-else class="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white font-mono leading-none">
            {{ stats?.usuarios?.total?.toLocaleString() ?? 0 }}
          </p>
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1">Cuentas</p>
        </div>
      </div>

      <!-- Usuarios Conectados (Tiempo Real) -->
      <div class="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-3xl border border-emerald-200 dark:border-emerald-900/50 p-4 sm:p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 transition-all duration-300 shadow-sm relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 text-emerald-100 dark:text-emerald-950/20 opacity-20 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
          <Users :size="80" />
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">En Línea</span>
            <span class="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
              <span class="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              LIVE
            </span>
          </div>
          <div class="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 p-1.5 sm:p-2 rounded-xl">
            <Activity :size="16" class="animate-pulse sm:w-4.5 sm:h-4.5" />
          </div>
        </div>
        <div class="mt-3 sm:mt-4">
          <div v-if="loading" class="h-7 sm:h-8 w-14 sm:w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
          <p v-else class="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-450 font-mono leading-none">
            {{ stats?.usuarios?.conectados?.toLocaleString() ?? 0 }}
          </p>
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1">Sesiones</p>
        </div>
      </div>

    </div>

    <!-- 2 & 3. GRÁFICOS (Crecimiento & Distribución de Usuarios) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      
      <!-- Crecimiento de la Plataforma (Line) -->
      <div class="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 p-4 sm:p-6 shadow-sm flex flex-col min-h-[320px] sm:min-h-[350px]">
        <div class="mb-4 sm:mb-6">
          <h3 class="text-base sm:text-lg font-black text-slate-800 dark:text-white">Crecimiento de la Plataforma</h3>
          <p class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Nuevos colegios registrados por mes</p>
        </div>
        <div class="flex-1 relative min-h-[200px] sm:min-h-[220px] flex items-center justify-center">
          <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <Line v-else-if="hasGrowthData" :data="growthChartData" :options="growthChartOptions" />
          <EmptyChartState 
            v-else 
            :icon="TrendingUp"
            title="Sin registros de crecimiento mensual"
            description="La curva de crecimiento se generará automáticamente al registrarse colegios e instituciones en la plataforma."
          />
        </div>
      </div>

      <!-- Distribución de Usuarios (Doughnut) -->
      <div class="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 p-4 sm:p-6 shadow-sm flex flex-col min-h-[320px] sm:min-h-[350px]">
        <div class="mb-4 sm:mb-6">
          <h3 class="text-base sm:text-lg font-black text-slate-800 dark:text-white">Distribución de Usuarios</h3>
          <p class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Distribución de cuentas activas por rol</p>
        </div>
        <div class="flex-1 relative flex items-center justify-center min-h-[200px] sm:min-h-[220px]">
          <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="hasDistributionData" class="w-full h-full relative min-h-[180px] sm:min-h-[200px]">
            <Doughnut :data="distributionChartData" :options="distributionChartOptions" />
          </div>
          <EmptyChartState 
            v-else 
            :icon="Users"
            :compact="true"
            title="Sin usuarios activos registrados"
            description="La distribución de roles se generará en cuanto existan usuarios activos en el sistema."
          />
        </div>
      </div>

    </div>

    <!-- 4, 5, 6, 7 & 8. WIDGETS (Actividad, Supervisión, Auditorías & Salud) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      
      <!-- Actividad Reciente (Table) -->
      <div class="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 p-4 sm:p-6 shadow-sm flex flex-col min-h-[340px] sm:min-h-[380px]">
        <div class="mb-4 sm:mb-6">
          <h3 class="text-base sm:text-lg font-black text-slate-800 dark:text-white">Actividad Reciente</h3>
          <p class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Bitácora de auditoría y operaciones del sistema</p>
        </div>
        <div class="flex-1 relative">
          <SkeletonTable v-if="loading" :rows="4" :cols="2" />
          
          <EmptyState
            v-else-if="!stats?.actividad || stats.actividad.length === 0"
            title="Sin actividad reciente"
            description="No se registran eventos de auditoría u operaciones en este momento."
          >
            <template #icon>
              <Activity class="w-8 h-8 text-indigo-500" />
            </template>
          </EmptyState>

          <DataTable v-else>
            <template #header>
              <tr>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4 w-1/3 sm:w-1/4 text-xs">Tiempo</th>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4 w-2/3 sm:w-3/4 text-xs">Operación / Suceso</th>
              </tr>
            </template>
            <tr v-for="(act, idx) in stats.actividad" :key="idx" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <td class="py-2.5 sm:py-3.5 px-3 sm:px-4 font-semibold text-slate-500 dark:text-slate-400 font-mono text-[11px] sm:text-xs">{{ act.tiempo }}</td>
              <td class="py-2.5 sm:py-3.5 px-3 sm:px-4 text-slate-700 dark:text-slate-300 font-medium leading-relaxed text-[11px] sm:text-xs">{{ act.descripcion }}</td>
            </tr>
          </DataTable>
        </div>
      </div>

      <!-- Columna Derecha (Widgets de Supervisión, Auditoría y Salud) -->
      <div class="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
        
        <!-- Solicitudes de Supervisión (Widget) -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
          <div class="mb-3 sm:mb-4">
            <h3 class="text-sm sm:text-base font-black text-slate-800 dark:text-white">Solicitudes de Supervisión</h3>
            <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Control de acceso institucional del mes</p>
          </div>
          <div v-if="loading" class="h-16 flex items-center justify-center">
            <div class="w-6 h-6 border-3 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 text-center mt-2">
            <div class="bg-slate-50 dark:bg-slate-950 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100/50 dark:border-slate-900">
              <span class="text-base sm:text-lg font-black text-amber-500 font-mono block">{{ stats?.supervisiones?.pendientes ?? 0 }}</span>
              <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pendientes</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-950 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100/50 dark:border-slate-900">
              <span class="text-base sm:text-lg font-black text-indigo-500 font-mono block">{{ stats?.supervisiones?.aprobadas ?? 0 }}</span>
              <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Aprobadas</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-950 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100/50 dark:border-slate-900">
              <span class="text-base sm:text-lg font-black text-emerald-500 font-mono block">{{ stats?.supervisiones?.activas ?? 0 }}</span>
              <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Activas</span>
            </div>
            <div class="bg-slate-50 dark:bg-slate-950 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100/50 dark:border-slate-900">
              <span class="text-base sm:text-lg font-black text-slate-400 font-mono block">{{ stats?.supervisiones?.terminadas ?? 0 }}</span>
              <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Cerradas</span>
            </div>
          </div>
        </div>

        <!-- Auditorías Resumen (Panel rápido) -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
          <div class="mb-3 sm:mb-4">
            <h3 class="text-sm sm:text-base font-black text-slate-800 dark:text-white">Auditorías y Cambios</h3>
            <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resumen de operaciones registradas este mes</p>
          </div>
          <div v-if="loading" class="h-16 flex items-center justify-center">
            <div class="w-6 h-6 border-3 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <div v-else class="space-y-2.5 sm:space-y-3 mt-2">
            <div class="flex items-center justify-between text-xs sm:text-sm">
              <span class="text-slate-500 dark:text-slate-400 font-medium">Sesiones de supervisión</span>
              <span class="font-extrabold text-slate-800 dark:text-white font-mono">{{ stats?.auditoriasResumen?.supervisionesMes ?? 0 }}</span>
            </div>
            <div class="flex items-center justify-between text-xs sm:text-sm border-t border-slate-50 dark:border-slate-800/40 pt-2 sm:pt-2.5">
              <span class="text-slate-500 dark:text-slate-400 font-medium">Modificaciones (EDITOR)</span>
              <span class="font-extrabold text-slate-800 dark:text-white font-mono">{{ stats?.auditoriasResumen?.modificaciones ?? 0 }}</span>
            </div>
            <div class="flex items-center justify-between text-xs sm:text-sm border-t border-slate-50 dark:border-slate-800/40 pt-2 sm:pt-2.5">
              <span class="text-slate-500 dark:text-slate-400 font-medium">Exportaciones de reportes</span>
              <span class="font-extrabold text-slate-800 dark:text-white font-mono">{{ stats?.auditoriasResumen?.exportaciones ?? 0 }}</span>
            </div>
            <div class="flex items-center justify-between text-xs sm:text-sm border-t border-slate-50 dark:border-slate-800/40 pt-2 sm:pt-2.5">
              <span class="text-slate-500 dark:text-slate-400 font-medium">Consultas y lecturas</span>
              <span class="font-extrabold text-slate-800 dark:text-white font-mono">{{ stats?.auditoriasResumen?.lecturas ?? 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Salud de la Plataforma (Widget diagnósticos) -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
          <div class="mb-3 sm:mb-4">
            <h3 class="text-sm sm:text-base font-black text-slate-800 dark:text-white">Salud de la Plataforma</h3>
            <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estado y disponibilidad de infraestructura global</p>
          </div>
          <div v-if="loading" class="h-16 flex items-center justify-center">
            <div class="w-6 h-6 border-3 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5 mt-2">
            
            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/60 p-2 sm:p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-900">
              <Database :size="16" class="text-slate-400 dark:text-slate-600 shrink-0" />
              <div class="min-w-0">
                <span class="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wide block">Base Datos</span>
                <span class="text-[11px] sm:text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5">
                  {{ stats?.salud?.database }} OK
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/60 p-2 sm:p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-900">
              <Network :size="16" class="text-slate-400 dark:text-slate-600 shrink-0" />
              <div class="min-w-0">
                <span class="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wide block">Servidor API</span>
                <span class="text-[11px] sm:text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5">
                  {{ stats?.salud?.api }} OK
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/60 p-2 sm:p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-900">
              <Network :size="16" class="text-slate-400 dark:text-slate-600 shrink-0" />
              <div class="min-w-0">
                <span class="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wide block">WebSockets</span>
                <span class="text-[11px] sm:text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5">
                  {{ stats?.salud?.websocket }} OK
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/60 p-2 sm:p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-900">
              <Mail :size="16" class="text-slate-400 dark:text-slate-600 shrink-0" />
              <div class="min-w-0">
                <span class="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wide block">Correos SMTP</span>
                <span class="text-[11px] sm:text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5">
                  {{ stats?.salud?.correos }} OK
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/60 p-2 sm:p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-900 col-span-1 sm:col-span-2">
              <HardDrive :size="16" class="text-slate-400 dark:text-slate-600 shrink-0" />
              <div class="min-w-0 flex-1">
                <span class="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wide block">Almacenamiento (Disco)</span>
                <div class="flex items-center gap-2 mt-1">
                  <!-- Progress Bar -->
                  <div class="flex-1 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      :class="[
                        parseInt(stats?.salud?.almacenamiento || '0') >= 90 ? 'bg-red-500' : 
                        parseInt(stats?.salud?.almacenamiento || '0') >= 75 ? 'bg-amber-500' : 'bg-emerald-500', 
                        'h-full rounded-full transition-all duration-500'
                      ]" 
                      :style="{ width: stats?.salud?.almacenamiento || '0%' }"
                    ></div>
                  </div>
                  <span 
                    :class="[
                      parseInt(stats?.salud?.almacenamiento || '0') >= 90 ? 'text-red-500' : 
                      parseInt(stats?.salud?.almacenamiento || '0') >= 75 ? 'text-amber-500' : 'text-emerald-500',
                      'text-[11px] sm:text-xs font-black font-mono'
                    ]"
                  >
                    {{ stats?.salud?.almacenamiento }}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>

  </div>
</template>

<style scoped>
</style>
