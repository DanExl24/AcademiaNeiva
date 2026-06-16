<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import {
  FileDown,
  Clock,
  Sparkles,
  Info,
  Calendar
} from 'lucide-vue-next'
import BoletinExportModule from '../../components/boletines/BoletinExportModule.vue'

const auth = useAuthStore()
const studentId = ref<number | null>(null)
const selectedYear = ref<number | null>(null)
const selectedPeriodId = ref<number | null>(null)
const years = ref<any[]>([])
const periods = ref<any[]>([])
const loading = ref(true)

const fetchStudentId = async () => {
  try {
    const id_usuario = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
    if (!id_usuario) return
    const idRes = await axios.get(`http://localhost:3000/api/student/user-id/${id_usuario}`)
    studentId.value = idRes.data.id_estudiante
    return studentId.value
  } catch (err) {
    console.error('Error fetching student ID:', err)
  }
}

const fetchYears = async () => {
  if (!studentId.value) return
  try {
    const res = await axios.get(`http://localhost:3000/api/student/years/${studentId.value}`)
    years.value = res.data
    if (years.value.length > 0) {
      selectedYear.value = years.value[0].id_año
    }
  } catch (err) {
    console.error("Error fetching years:", err)
  }
}

const fetchPeriods = async () => {
  if (!studentId.value || !selectedYear.value) return
  try {
    const res = await axios.get(`http://localhost:3000/api/student/periods/${studentId.value}/${selectedYear.value}`)
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

onMounted(async () => {
  await fetchStudentId()
  await fetchYears()
  loading.value = false
})

watch(selectedYear, fetchPeriods)
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <FileDown :size="32" class="text-indigo-600 dark:text-indigo-400" />
          Mi Boletín Académico
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
          Descarga tu reporte oficial de calificaciones por periodo
        </p>
      </div>
    </div>

    <!-- Period Selection Card -->
    <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="flex flex-col md:flex-row items-center gap-8">
        <div class="w-full md:w-1/2 space-y-6">
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
                <option v-for="y in years" :key="y.id_año" :value="y.id_año">Año {{ y.calendario }}</option>
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
                <option v-if="periods.length === 0" disabled value="">No hay periodos</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}</option>
              </select>
            </div>
          </div>

          <div v-if="studentId && selectedPeriodId" class="pt-4">
            <BoletinExportModule 
              :student-id="studentId" 
              :period-id="selectedPeriodId" 
            />
          </div>
        </div>

        <div class="w-full md:w-1/2 flex flex-col items-center justify-center p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50 text-center space-y-4">
          <div class="h-20 w-20 rounded-3xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg text-indigo-600">
            <Sparkles :size="40" />
          </div>
          <div>
            <h3 class="text-lg font-black text-slate-800 dark:text-white">Documento Oficial</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Este PDF contiene tu rendimiento académico, asistencia y observaciones del periodo seleccionado.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Important Notice -->
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-6 rounded-3xl flex gap-4">
      <div class="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
        <Info :size="20" />
      </div>
      <div>
        <h4 class="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1">Nota Importante</h4>
        <p class="text-xs text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
          La generación de boletines solo está permitida para periodos académicos que han sido **cerrados oficialmente** por la institución. Si no puedes ver tu boletín, verifica con tu director de grupo.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando configuración...</p>
    </div>

  </div>
</template>

<style scoped>
.animate-in {
  animation-fill-mode: both;
}
</style>
