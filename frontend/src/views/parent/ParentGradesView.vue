<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { studentService } from '../../services/studentService'
import { 
  Users,
  TrendingUp, 
  Award,
  ChevronRight,
  GraduationCap,
  Calendar,
  SearchX,
  CreditCard,
  AlertCircle
} from 'lucide-vue-next'
import BoletinExportModule from '../../components/boletines/BoletinExportModule.vue'

import { useAcademicYearStore } from '../../stores/academicYear'
import DataTable from '../../components/ui/DataTable.vue'
import SkeletonTable from '../../components/feedback/SkeletonTable.vue'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const router = useRouter()
const loading = ref(true)
const fetchingGrades = ref(false)

const children = ref<any[]>([])
const selectedChildId = ref<number | null>(null)
const studentInfo = ref<any>(null)

const years = ref<any[]>([])
const selectedYear = ref<number | null>(null)

const periods = ref<any[]>([])
const selectedPeriod = ref<number | null>(null)

const academicData = ref<any>(null)

watch(() => yearStore.selectedYearId, (newYearId) => {
  if (newYearId && newYearId !== selectedYear.value) {
    selectedYear.value = newYearId
  }
}, { immediate: true })

const fetchChildren = async () => {
  try {
    const userId = (auth.isMonitoring && auth.monitoringUser) ? (auth.monitoringUser.id || (auth.monitoringUser as any).id_usuario) : (auth.user?.id_usuario || auth.user?.id)
    if (!userId) return
    const data = await studentService.getParentChildren(userId)
    children.value = data
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
      studentService.getYears(selectedChildId.value),
      studentService.getInfo(selectedChildId.value)
    ])
    years.value = yearsRes
    studentInfo.value = infoRes
    
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
    const res = await studentService.getAllPeriods(selectedChildId.value, selectedYear.value)
    periods.value = (res || []).filter((p: any) => p.estado !== 'PENDIENTE')
    if (periods.value.length > 0) {
      selectedPeriod.value = periods.value[periods.value.length - 1].id_periodo
    } else {
      selectedPeriod.value = null
      academicData.value = null
    }
  } catch (err) {
    console.error("Error fetching periods:", err)
  }
}

const fetchGrades = async () => {
  if (!selectedChildId.value || !selectedPeriod.value) return
  fetchingGrades.value = true
  try {
    const res = await studentService.getGrades(selectedChildId.value, selectedPeriod.value)
    academicData.value = res
  } catch (err) {
    console.error("Error fetching grades:", err)
  } finally {
    fetchingGrades.value = false
  }
}

const openDetails = (subject: any) => {
  router.push(`/dashboard/notas-hijos/${selectedChildId.value}/${subject.id_materia}/${selectedPeriod.value}`)
}

onMounted(async () => {
  await fetchChildren()
})

watch(selectedChildId, async (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    // Reset secondary filters to avoid fetching data with old period/year
    selectedYear.value = null
    selectedPeriod.value = null
    periods.value = []
    academicData.value = null
    
    await fetchYearsAndInfo()
  }
})

watch(selectedYear, async (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    selectedPeriod.value = null
    academicData.value = null
    await fetchPeriods()
  }
})

watch(selectedPeriod, async (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    await fetchGrades()
  }
})

const getPerformanceColor = (level: string | null | undefined) => {
  if (!level) return 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
  level = level.toLowerCase()
  if (level.includes('superior')) return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
  if (level.includes('alto')) return 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50'
  if (level.includes('basico')) return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50'
  if (level.includes('bajo')) return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50'
  return 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Top Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <Users :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Calificaciones de Hijos
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
          Seleccione un estudiante para ver su reporte académico
        </p>
      </div>

      <!-- Child Selector & Export -->
      <div class="flex flex-wrap items-center gap-4">
        <div v-if="children.length > 0" class="flex items-center gap-3 bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm transition-all focus-within:ring-4 focus-within:ring-indigo-500/10">
          <GraduationCap :size="20" class="text-indigo-500" />
          <select 
            v-model="selectedChildId" 
            class="bg-transparent border-none text-sm font-black text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer"
          >
            <option v-for="child in children" :key="child.id_estudiante" :value="child.id_estudiante">
              {{ child.nombre }} {{ child.apellido }} {{ child.colegio_nombre ? '· ' + child.colegio_nombre : '' }}
            </option>
          </select>
        </div>
        <div v-if="selectedChildId && selectedPeriod" class="w-full sm:w-auto">
          <BoletinExportModule
            :student-id="selectedChildId"
            :period-id="selectedPeriod"
            :student-name="studentInfo?.nombre || ''"
          />
        </div>
      </div>
    </div>

    <!-- Context & Period Filters -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div v-if="studentInfo">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">Grado Actual</span>
          <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ studentInfo.grado }} - Grupo {{ studentInfo.grupo }}</span>
          <span v-if="children.find(c => c.id_estudiante === selectedChildId)?.colegio_nombre" class="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
            {{ children.find(c => c.id_estudiante === selectedChildId)?.colegio_nombre }}
          </span>
        </div>
        <p class="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <CreditCard :size="14" />
          Código Estudiantil: <span class="font-bold">{{ studentInfo.codigo }}</span>
        </p>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Calendar :size="18" class="text-slate-400" />
          <select v-model="selectedYear" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option v-for="y in years" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <TrendingUp :size="18" class="text-slate-400" />
          <select v-model="selectedPeriod" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="periods.length === 0">
            <option v-if="periods.length === 0" disabled value="">No hay periodos disponibles</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' - En Curso' : '' }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div v-if="academicData && !fetchingGrades" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <div class="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl flex items-center justify-between group overflow-hidden relative">
        <div class="relative z-10">
          <p class="text-xs font-bold uppercase tracking-widest text-indigo-100 opacity-80">Promedio del Estudiante</p>
          <p class="text-4xl font-black mt-1">{{ academicData.promedio_general !== null && academicData.promedio_general !== undefined ? academicData.promedio_general : 'N/A' }}</p>
        </div>
        <div class="bg-white/20 p-4 rounded-2xl relative z-10 group-hover:scale-110 transition-transform duration-300">
          <TrendingUp :size="32" stroke-width="2.5" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all duration-300">
        <div>
          <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nivel de Desempeño</p>
          <p class="text-2xl font-black mt-1 text-slate-800 dark:text-white">{{ academicData.nivel_desempeno || 'N/A' }}</p>
        </div>
        <div class="p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300" :class="getPerformanceColor(academicData.nivel_desempeno)">
          <Award :size="32" stroke-width="2.5" />
        </div>
      </div>

      <div class="hidden lg:flex bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm items-center justify-between group hover:shadow-lg transition-all duration-300">
        <div>
          <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Materias Evaluadas</p>
          <p class="text-2xl font-black mt-1 text-slate-800 dark:text-white">
            {{ academicData.grades.filter((g: any) => g.calificacion !== null && g.calificacion !== undefined).length }} / {{ academicData.grades.length }}
          </p>
        </div>
        <div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
          <AlertCircle :size="32" stroke-width="2.5" />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <SkeletonTable v-if="loading || fetchingGrades" :rows="5" :cols="4" />

    <!-- Empty State -->
    <div v-else-if="!academicData" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 transition-all">
      <div class="bg-slate-50 dark:bg-slate-800 p-6 rounded-full mb-6">
        <SearchX :size="48" class="text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-800 dark:text-white">Sin información disponible</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-center px-4 leading-relaxed italic">
        Selecciona un hijo y un periodo académico para visualizar las calificaciones.
      </p>
    </div>

    <!-- Grades Table -->
    <DataTable v-else>
      <template #header>
        <tr>
          <th class="py-4 px-6">Asignatura</th>
          <th class="py-4 px-6">Docente Responsable</th>
          <th class="py-4 px-6 text-center">Nota</th>
          <th class="py-4 px-6">Evaluación</th>
          <th class="py-4 px-6"></th>
        </tr>
      </template>
      <tr 
        v-for="(item, idx) in academicData.grades" 
        :key="idx"
        @click="openDetails(item)"
        class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
      >
        <td class="py-5 px-6">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center font-black group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              {{ item.materia.charAt(0) }}
            </div>
            <span class="font-bold text-slate-800 dark:text-slate-200">{{ item.materia }}</span>
          </div>
        </td>
        <td class="py-5 px-6">
          <span class="text-sm font-medium text-slate-500 dark:text-slate-400 italic">Profe {{ item.docente }}</span>
        </td>
        <td class="py-5 px-6">
          <div class="flex justify-center">
            <div 
              class="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-black shadow-sm"
              :class="item.calificacion === null || item.calificacion === undefined
                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                : (item.calificacion < 3.0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400')"
            >
              {{ item.calificacion !== null && item.calificacion !== undefined ? item.calificacion : 'N/A' }}
            </div>
          </div>
        </td>
        <td class="py-5 px-6">
          <span 
            class="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm"
            :class="getPerformanceColor(item.desempeno)"
          >
            {{ item.desempeno || 'SIN NOTAS AÚN' }}
          </span>
        </td>
        <td class="py-5 px-6 text-right">
          <ChevronRight :size="18" class="inline-block text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
        </td>
      </tr>
    </DataTable>

    <!-- Help Info -->
    <div class="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex gap-4">
      <div class="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
        <AlertCircle :size="24" />
      </div>
      <div>
        <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1">Información de Consulta</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
          Este panel muestra las notas definitivas reportadas por los docentes tras el cierre de cada periodo académico. Haga clic en una materia para ver el detalle de actividades y criterios.
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.scale-in-center {
	animation: scale-in-center 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
}

@keyframes scale-in-center {
  0% {
    transform: scale(0.98);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
}
</style>
