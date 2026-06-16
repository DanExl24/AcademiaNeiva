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
  BookOpen
} from 'lucide-vue-next'

const auth = useAuthStore()
const loading = ref(true)
const studentId = ref<number | null>(null)
const selectedYear = ref<number | null>(null)
const selectedPeriod = ref<number | null>(null)
const selectedType = ref<string>('all')

const years = ref<any[]>([])
const periods = ref<any[]>([])
const observations = ref<any[]>([])
const studentInfo = ref<any>(null)

const fetchStudentId = async () => {
  try {
    const userId = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
    if (!userId) return
    const res = await axios.get(`http://localhost:3000/api/student/user-id/${userId}`)
    studentId.value = res.data.id_estudiante
  } catch (err) {
    console.error("Error fetching student ID:", err)
  }
}

const fetchInitialData = async () => {
  if (!studentId.value) return
  try {
    const [yearsRes, infoRes] = await Promise.all([
      axios.get(`http://localhost:3000/api/student/years/${studentId.value}`),
      axios.get(`http://localhost:3000/api/student/info/${studentId.value}`)
    ])
    years.value = yearsRes.data
    studentInfo.value = infoRes.data
    
    if (years.value.length > 0) {
      selectedYear.value = years.value[0].id_año
    }
  } catch (err) {
    console.error("Error fetching initial academic data:", err)
  }
}

const fetchPeriods = async () => {
  if (!studentId.value || !selectedYear.value) return
  try {
    const res = await axios.get(`http://localhost:3000/api/student/periods/${studentId.value}/${selectedYear.value}`)
    periods.value = res.data
    if (periods.value.length > 0) {
      selectedPeriod.value = periods.value[periods.value.length - 1].id_periodo
    }
  } catch (err) {
    console.error("Error fetching periods:", err)
  }
}

const fetchObservations = async () => {
  if (!studentId.value || !selectedPeriod.value) return
  loading.value = true
  try {
    let url = `http://localhost:3000/api/student/observations/${studentId.value}/${selectedPeriod.value}`
    if (selectedType.value !== 'all') {
      url += `?tipo=${selectedType.value}`
    }
    const res = await axios.get(url)
    observations.value = res.data
  } catch (err) {
    console.error("Error fetching observations:", err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchStudentId()
  await fetchInitialData()
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
    
    <!-- Top Header & Filters -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <MessageSquare :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Mis Observaciones
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Retroalimentación académica y de convivencia
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Year Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Calendar :size="18" class="text-slate-400" />
          <select v-model="selectedYear" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option v-for="y in years" :key="y.id_año" :value="y.id_año">Año {{ y.calendario }}</option>
          </select>
        </div>

        <!-- Period Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Filter :size="18" class="text-slate-400" />
          <select v-model="selectedPeriod" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="periods.length === 0">
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}</option>
          </select>
        </div>

        <!-- Type Filter -->
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <HelpCircle :size="18" class="text-slate-400" />
          <select v-model="selectedType" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option value="all">Cualquier tipo</option>
            <option value="ACADEMICA">Académica</option>
            <option value="DISCIPLINARIA">Disciplinaria</option>
            <option value="CONVIVENCIAL">Convivencial</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Observations List -->
    <div v-if="loading" class="grid grid-cols-1 gap-6">
      <div v-for="i in 2" :key="i" class="h-64 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 animate-pulse"></div>
    </div>

    <div v-else-if="observations.length === 0" class="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
      <div class="bg-indigo-50 dark:bg-slate-800 p-6 rounded-full mb-6 text-indigo-500">
        <SearchX :size="48" />
      </div>
      <h3 class="text-xl font-bold text-slate-800 dark:text-white">Sin observaciones</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 text-center max-w-xs">
        No se han registrado observaciones para este periodo académico aún.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 gap-8">
      <div 
        v-for="obs in observations" 
        :key="obs.id_observacion"
        class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all duration-300"
      >
        <!-- Card Header -->
        <div class="bg-slate-50/50 dark:bg-slate-800/40 px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <BookOpen :size="20" />
            </div>
            <div>
              <h3 class="text-lg font-black text-slate-800 dark:text-white leading-none">{{ obs.materia }}</h3>
              <div class="flex items-center gap-3 mt-2">
                <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <User :size="14" class="text-indigo-500" />
                  {{ obs.docente }}
                </div>
                <span :class="getTypeBadgeClass(obs.tipo)" class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                  {{ getTypeLabel(obs.tipo) }}
                </span>
              </div>
            </div>
          </div>
          <div class="text-xs font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700">
            Registrado el {{ formatDate(obs.fecha) }}
          </div>
        </div>

        <!-- Card Content -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
          
          <!-- Fortalezas -->
          <div class="p-8 space-y-4 group">
            <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Target :size="18" />
              <span class="text-[10px] font-black uppercase tracking-widest">Fortalezas</span>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {{ obs.fortalezas || 'No se registraron fortalezas específicas.' }}
            </p>
          </div>

          <!-- Debilidades -->
          <div class="p-8 space-y-4 bg-slate-50/20 dark:bg-slate-900/20">
            <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle :size="18" />
              <span class="text-[10px] font-black uppercase tracking-widest">Debilidades</span>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {{ obs.debilidades || 'No se registraron debilidades específicas.' }}
            </p>
          </div>

          <!-- Recomendaciones -->
          <div class="p-8 space-y-4">
            <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Lightbulb :size="18" />
              <span class="text-[10px] font-black uppercase tracking-widest">Recomendaciones</span>
            </div>
            <p class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-bold italic">
              "{{ obs.recomendaciones || 'Continuar con el proceso de aprendizaje de manera constante.' }}"
            </p>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>
