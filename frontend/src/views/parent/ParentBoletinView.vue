<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  FileDown,
  GraduationCap,
  Calendar,
  Clock,
  Sparkles,
  Info
} from 'lucide-vue-next'
import BoletinExportModule from '../../components/boletines/BoletinExportModule.vue'

const auth = useAuthStore()
const loading = ref(true)
const children = ref<any[]>([])
const selectedChildId = ref<number | null>(null)
const selectedChildName = ref('')

const years = ref<any[]>([])
const selectedYear = ref<number | null>(null)

const periods = ref<any[]>([])
const selectedPeriodId = ref<number | null>(null)

const fetchChildren = async () => {
  try {
    const userId = auth.user?.id
    if (!userId) return
    const res = await axios.get(`http://localhost:3000/api/student/parent-children/${userId}`)
    children.value = res.data
    if (children.value.length > 0) {
      selectedChildId.value = children.value[0].id_estudiante
      selectedChildName.value = children.value[0].nombre
    }
  } catch (err) {
    console.error("Error fetching children for boletines:", err)
  } finally {
    loading.value = false
  }
}

const fetchYears = async () => {
  if (!selectedChildId.value) return
  try {
    const res = await axios.get(`http://localhost:3000/api/student/years/${selectedChildId.value}`)
    years.value = res.data
    if (years.value.length > 0) {
      selectedYear.value = years.value[0].id_anio
    }
  } catch (err) {
    console.error("Error fetching years:", err)
  }
}

const fetchPeriods = async () => {
  if (!selectedChildId.value || !selectedYear.value) return
  try {
    const res = await axios.get(`http://localhost:3000/api/student/all-periods/${selectedChildId.value}/${selectedYear.value}`)
    periods.value = res.data
    if (periods.value.length > 0) {
      selectedPeriodId.value = periods.value[periods.value.length - 1].id_periodo
    } else {
      selectedPeriodId.value = null
    }
  } catch (err) {
    console.error("Error fetching periods:", err)
  }
}

onMounted(() => {
  fetchChildren()
})

watch(selectedChildId, async (newVal) => {
  if (newVal) {
    const child = children.value.find(c => c.id_estudiante === newVal)
    selectedChildName.value = child ? child.nombre : ''
    selectedYear.value = null
    selectedPeriodId.value = null
    await fetchYears()
  }
})

watch(selectedYear, async (newVal) => {
  if (newVal) {
    selectedPeriodId.value = null
    await fetchPeriods()
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <FileDown :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Boletines de Hijos
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
          Genera y descarga los reportes académicos de tu familia
        </p>
      </div>

      <!-- Child Selector -->
      <div v-if="children.length > 0" class="flex items-center gap-3 bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm transition-all focus-within:ring-4 focus-within:ring-indigo-500/10">
        <GraduationCap :size="20" class="text-indigo-500" />
        <select 
          v-model="selectedChildId" 
          class="bg-transparent border-none text-sm font-black text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer min-w-[200px]"
        >
          <option v-for="child in children" :key="child.id_estudiante" :value="child.id_estudiante">
            {{ child.nombre }} {{ child.apellido }}
          </option>
        </select>
      </div>
    </div>

    <!-- Main Configuration Card -->
    <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
      <!-- Background Accent -->
      <div class="absolute -right-20 -top-20 h-64 w-64 bg-indigo-50 dark:bg-indigo-950/20 rounded-full blur-3xl opacity-50"></div>
      
      <div class="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div class="space-y-8">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Calendar :size="14" />
                Año Lectivo
              </label>
              <select 
                v-model="selectedYear"
                class="w-full h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-indigo-500 transition-all cursor-pointer outline-none"
              >
                <option v-if="years.length === 0" disabled value="">Sin años</option>
                <option v-for="y in years" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
              </select>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock :size="14" />
                Periodo
              </label>
              <select 
                v-model="selectedPeriodId"
                class="w-full h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-indigo-500 transition-all cursor-pointer outline-none"
              >
                <option v-if="periods.length === 0" disabled value="">No hay periodos disponibles</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' - En Curso' : '' }}</option>
              </select>
            </div>
          </div>

          <div v-if="selectedChildId && selectedPeriodId" class="pt-4 scale-in-center">
            <BoletinExportModule 
              :student-id="selectedChildId" 
              :period-id="selectedPeriodId"
              :student-name="selectedChildName"
            />
          </div>
        </div>

        <div class="flex flex-col items-center justify-center p-10 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 rounded-[3rem] border border-indigo-100 dark:border-indigo-900/50 text-center">
            <div class="relative mb-6">
              <div class="h-24 w-24 rounded-[2rem] bg-white dark:bg-slate-800 flex items-center justify-center shadow-xl animate-bounce duration-[3000ms]">
                <FileDown :size="48" class="text-indigo-600" />
              </div>
              <Sparkles :size="24" class="absolute -top-2 -right-2 text-yellow-400 animate-pulse" />
            </div>
            <h3 class="text-xl font-black text-slate-800 dark:text-white">Exportación Rápida</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              Descarga el boletín oficial en un clic. El archivo incluye el promedio general, ranking y observaciones del docente.
            </p>
        </div>
      </div>
    </div>

    <!-- Help Info -->
    <div class="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-6 rounded-3xl flex gap-4">
      <div class="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
        <Info :size="20" />
      </div>
      <div>
        <h4 class="text-sm font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-widest mb-1">Requisito de Cierre</h4>
        <p class="text-[11px] text-indigo-700 dark:text-indigo-500 leading-relaxed font-semibold italic">
          Los boletines solo pueden generarse una vez que el periodo académico ha sido **cerrado por la institución**. Si el periodo deseado no aparece o muestra error, es posible que aún esté en proceso de calificación.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-40">
       <div class="w-16 h-16 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
       <p class="mt-6 text-slate-500 font-black uppercase tracking-widest text-xs animate-pulse">Obteniendo perfiles familiares...</p>
    </div>

  </div>
</template>

<style scoped>
.scale-in-center {
	animation: scale-in-center 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
}

@keyframes scale-in-center {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
