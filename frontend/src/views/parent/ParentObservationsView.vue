<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  MessageSquare, 
  Calendar, 
  Filter, 
  SearchX,
  Target,
  AlertTriangle,
  Lightbulb,
  User,
  BookOpen,
  GraduationCap,
  CreditCard,
  HelpCircle
} from 'lucide-vue-next'
import BoletinExportModule from '../../components/boletines/BoletinExportModule.vue'

const auth = useAuthStore()
const loading = ref(true)
const fetchingObs = ref(false)

const children = ref<any[]>([])
const selectedChildId = ref<number | null>(null)
const studentInfo = ref<any>(null)

const years = ref<any[]>([])
const selectedYear = ref<number | null>(null)

const periods = ref<any[]>([])
const selectedPeriod = ref<number | null>(null)
const selectedType = ref<string>('all')

const observations = ref<any[]>([])

const fetchChildren = async () => {
  try {
    const userId = auth.user?.id
    if (!userId) return
    const res = await axios.get(`http://localhost:3000/api/student/parent-children/${userId}`)
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
      axios.get(`http://localhost:3000/api/student/years/${selectedChildId.value}`),
      axios.get(`http://localhost:3000/api/student/info/${selectedChildId.value}`)
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
    const res = await axios.get(`http://localhost:3000/api/student/all-periods/${selectedChildId.value}/${selectedYear.value}`)
    periods.value = res.data
    if (periods.value.length > 0) {
      selectedPeriod.value = periods.value[periods.value.length - 1].id_periodo
    }
  } catch (err) {
    console.error("Error fetching periods:", err)
  }
}

const fetchObservations = async () => {
  if (!selectedChildId.value || !selectedPeriod.value) return
  fetchingObs.value = true
  try {
    let url = `http://localhost:3000/api/student/observations/${selectedChildId.value}/${selectedPeriod.value}`
    if (selectedType.value !== 'all') {
      url += `?tipo=${selectedType.value}`
    }
    const res = await axios.get(url)
    observations.value = res.data
  } catch (err) {
    console.error("Error fetching observations:", err)
  } finally {
    fetchingObs.value = false
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
    observations.value = []
    await fetchYearsAndInfo()
  }
})

watch(selectedYear, fetchPeriods)
watch(selectedPeriod, fetchObservations)
watch(selectedType, fetchObservations)

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'ACADEMICA': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'DISCIPLINARIA': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    case 'CONVIVENCIAL': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
  }
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'ACADEMICA': return 'Académica'
    case 'DISCIPLINARIA': return 'Disciplinaria'
    case 'CONVIVENCIAL': return 'Convivencial'
    default: return type
  }
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Top Header & Child Selector -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <MessageSquare :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Observaciones Académicas
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
          Consulta el seguimiento y recomendaciones de tus hijos
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
              {{ child.nombre }} {{ child.apellido }}
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

    <!-- Student Info & Filters -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div v-if="studentInfo" class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">Grado Actual</span>
          <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ studentInfo.grado }} - Grupo {{ studentInfo.grupo }}</span>
        </div>
        <p class="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <CreditCard :size="14" />
          Código Estudiantil: <span class="font-bold font-mono">{{ studentInfo.codigo }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Year Filter -->
        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Calendar :size="18" class="text-slate-400" />
          <select v-model="selectedYear" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option v-for="y in years" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
          </select>
        </div>

        <!-- Period Filter -->
        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Filter :size="18" class="text-slate-400" />
          <select v-model="selectedPeriod" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="periods.length === 0">
            <option v-if="periods.length === 0" disabled value="">No hay periodos disponibles</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' - En Curso' : '' }}</option>
          </select>
        </div>

        <!-- Type Filter -->
        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <HelpCircle :size="18" class="text-slate-400" />
          <select v-model="selectedType" class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option value="all">Tipo: Todos</option>
            <option value="ACADEMICA">Académica</option>
            <option value="DISCIPLINARIA">Disciplinaria</option>
            <option value="CONVIVENCIAL">Convivencial</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Observations List -->
    <div v-if="loading || fetchingObs" class="grid grid-cols-1 gap-6">
      <div v-for="i in 3" :key="i" class="h-48 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 animate-pulse"></div>
    </div>

    <div v-else-if="observations.length === 0" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
      <div class="bg-slate-50 dark:bg-slate-800 p-6 rounded-full mb-6">
        <SearchX :size="48" class="text-slate-300" />
      </div>
      <h3 class="text-xl font-bold text-slate-800 dark:text-white">Sin observaciones</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 text-center max-w-xs">
        No se han encontrado registros académicos para este hijo en el periodo seleccionado.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 gap-6">
      <div 
        v-for="obs in observations" 
        :key="obs.id_observacion"
        class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <!-- Header -->
        <div class="px-6 py-4 bg-indigo-50/30 dark:bg-indigo-900/10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-indigo-600 rounded-xl text-white">
              <BookOpen :size="16" />
            </div>
            <div>
              <h3 class="font-black text-slate-800 dark:text-white leading-none">{{ obs.materia }}</h3>
              <span :class="getTypeBadgeClass(obs.tipo)" class="inline-block mt-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                {{ getTypeLabel(obs.tipo) }}
              </span>
            </div>
          </div>
          <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{{ formatDate(obs.fecha) }}</span>
        </div>

        <!-- Body -->
        <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Target :size="14" />
              <span class="text-[9px] font-black uppercase tracking-widest">Fortalezas</span>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {{ obs.fortalezas || 'N/A' }}
            </p>
          </div>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle :size="14" />
              <span class="text-[9px] font-black uppercase tracking-widest">Debilidades</span>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {{ obs.debilidades || 'N/A' }}
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Lightbulb :size="14" />
              <span class="text-[9px] font-black uppercase tracking-widest">Recomendaciones</span>
            </div>
            <p class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-bold italic">
              {{ obs.recomendaciones || 'Siga así' }}
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
          <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
            <User :size="14" />
            Docente: <span class="font-bold text-slate-700 dark:text-slate-300">{{ obs.docente }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>
