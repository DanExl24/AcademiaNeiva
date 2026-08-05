<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight,
  GraduationCap,
  Award,
  BookOpenCheck,
  SearchX
} from 'lucide-vue-next'

import { useAcademicYearStore } from '../../stores/academicYear'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const router = useRouter()
const loading = ref(true)
const studentId = ref<number | null>(null)
const selectedYear = ref<number | null>(null)
const selectedPeriod = ref<number | null>(null)

const years = ref<any[]>([])
const periods = ref<any[]>([])
const academicData = ref<any>(null)
const studentInfo = ref<any>(null)

watch(() => yearStore.selectedYearId, (newYearId) => {
  if (newYearId && newYearId !== selectedYear.value) {
    selectedYear.value = newYearId
  }
}, { immediate: true })

const fetchStudentId = async () => {
  try {
    const userId = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
    if (!userId) return
    const res = await axios.get(`/api/student/user-id/${userId}`)
    studentId.value = res.data.id_estudiante
  } catch (err) {
    console.error("Error fetching student ID:", err)
  }
}

const fetchInitialData = async () => {
  if (!studentId.value) return
  try {
    const [yearsRes, infoRes] = await Promise.all([
      axios.get(`/api/student/years/${studentId.value}`),
      axios.get(`/api/student/info/${studentId.value}`)
    ])
    years.value = yearsRes.data
    studentInfo.value = infoRes.data
    
    if (years.value.length > 0) {
      const currentYearStr = new Date().getFullYear().toString()
      const matchingYear = years.value.find((y: any) => y.calendario === currentYearStr)
      selectedYear.value = matchingYear ? matchingYear.id_anio : years.value[0].id_anio
      await fetchPeriods()
    }
  } catch (err) {
    console.error("Error fetching initial academic data:", err)
  } finally {
    loading.value = false
  }
}

const fetchPeriods = async () => {
  if (!studentId.value || !selectedYear.value) return
  try {
    const res = await axios.get(`/api/student/all-periods/${studentId.value}/${selectedYear.value}`)
    periods.value = (res.data || []).filter((p: any) => p.estado !== 'PENDIENTE')
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
  if (!studentId.value || !selectedPeriod.value) return
  loading.value = true
  try {
    const res = await axios.get(`/api/student/grades/${studentId.value}/${selectedPeriod.value}`)
    academicData.value = res.data
  } catch (err) {
    console.error("Error fetching grades:", err)
  } finally {
    loading.value = false
  }
}

const openDetails = (subject: any) => {
  // Navigate to the subview instead of modal
  router.push(`/dashboard/mis-notas/${subject.id_materia}/${selectedPeriod.value}`)
}

onMounted(async () => {
  await fetchStudentId()
  await fetchInitialData()
})

watch(selectedYear, fetchPeriods)
watch(selectedPeriod, fetchGrades)

const getPerformanceColor = (level: string) => {
  level = level.toLowerCase()
  if (level.includes('superior')) return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
  if (level.includes('alto')) return 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50'
  if (level.includes('basico')) return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50'
  if (level.includes('bajo')) return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50'
  return 'text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Top Header & Filters -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <BookOpenCheck :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Mis Calificaciones
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {{ studentInfo?.grado }} - Grupo {{ studentInfo?.grupo }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Calendar :size="18" class="text-slate-400" />
          <select v-model="selectedYear" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer">
            <option v-for="y in years" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
          <TrendingUp :size="18" class="text-slate-400" />
          <select v-model="selectedPeriod" class="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer" :disabled="periods.length === 0">
            <option v-if="periods.length === 0" disabled value="">No hay periodos disponibles</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }} ({{ p.porcentaje }}%){{ p.estado === 'ABIERTO' ? ' - En Curso' : '' }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div v-if="academicData && !loading" class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-between group overflow-hidden relative">
        <div class="relative z-10">
          <p class="text-xs font-bold uppercase tracking-widest text-indigo-100 opacity-80">Promedio General</p>
          <p class="text-4xl font-black mt-1">{{ academicData.promedio_general }}</p>
        </div>
        <div class="bg-white/20 p-4 rounded-2xl relative z-10 group-hover:scale-110 transition-transform duration-300">
          <TrendingUp :size="32" stroke-width="2.5" />
        </div>
        <div class="absolute -right-4 -bottom-4 h-24 w-24 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all duration-300">
        <div>
          <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Desempeño Global</p>
          <p class="text-2xl font-black mt-1 text-slate-800 dark:text-white">{{ academicData.nivel_desempeno }}</p>
        </div>
        <div class="p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300" :class="getPerformanceColor(academicData.nivel_desempeno)">
          <Award :size="32" stroke-width="2.5" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all duration-300">
        <div>
          <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Materias Evaluadas</p>
          <p class="text-2xl font-black mt-1 text-slate-800 dark:text-white">{{ academicData.grades.length }}</p>
        </div>
        <div class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
          <GraduationCap :size="32" stroke-width="2.5" />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium animate-pulse">Cargando tus notas...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!academicData" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
      <div class="bg-slate-50 dark:bg-slate-800 p-6 rounded-full mb-6">
        <SearchX :size="48" class="text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-800 dark:text-white">Sin información disponible</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-center px-4 leading-relaxed">
        No se encontraron calificaciones para el periodo seleccionado. Si el periodo está en curso, es posible que los docentes aún no hayan registrado notas.
      </p>
    </div>

    <!-- Grades Table -->
    <div v-else class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 dark:bg-slate-800/50">
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Materia</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Docente</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Calificación</th>
              <th class="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Desempeño</th>
              <th class="px-6 py-5"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr 
              v-for="(item, idx) in academicData.grades" 
              :key="idx"
              @click="openDetails(item)"
              class="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
            >
              <td class="px-8 py-6">
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                    {{ item.materia.charAt(0) }}
                  </div>
                  <span class="font-bold text-slate-800 dark:text-slate-200">{{ item.materia }}</span>
                </div>
              </td>
              <td class="px-8 py-6">
                <span class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ item.docente }}</span>
              </td>
              <td class="px-8 py-6">
                <div class="flex justify-center">
                  <div 
                    class="h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm"
                    :class="item.calificacion < 3.0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-white'"
                  >
                    {{ item.calificacion }}
                  </div>
                </div>
              </td>
              <td class="px-8 py-6">
                <span 
                  class="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border"
                  :class="getPerformanceColor(item.desempeno)"
                >
                  {{ item.desempeno }}
                </span>
              </td>
              <td class="px-6 py-6 text-right">
                <div class="p-2 text-slate-300 group-hover:text-indigo-500 transition-colors">
                  <ChevronRight :size="20" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Help Alert -->
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-6 rounded-3xl flex gap-4">
      <AlertCircle :size="24" class="text-amber-500 shrink-0" />
      <div>
        <h4 class="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1">Nota importante</h4>
        <p class="text-sm text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
          Las notas visibles en este panel corresponden únicamente a periodos académicos que han sido finalizados y cerrados por la dirección del colegio. Si no visualizas alguna nota, consulta con tu docente titular.
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
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
