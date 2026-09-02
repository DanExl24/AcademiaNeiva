<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { studentService } from '../../services/studentService'
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
import { useAcademicYearStore } from '../../stores/academicYear'
import NoAcademicRecordsBanner from '../../components/NoAcademicRecordsBanner.vue'

const yearStore = useAcademicYearStore()
const studentId = ref<number | null>(null)
const selectedYear = ref<number | null>(yearStore.selectedYearId || null)
const selectedPeriodId = ref<number | null>(null)
const years = ref<any[]>([])
const periods = ref<any[]>([])
const loading = ref(true)

const displayYears = computed(() => {
  if (yearStore.availableYears.length > 0) return yearStore.availableYears
  return years.value
})

const selectedYearCalendar = computed(() => {
  const y = displayYears.value.find((a: any) => a.id_anio === selectedYear.value)
  return y ? y.calendario : (yearStore.selectedYear?.calendario || '')
})

watch(() => yearStore.selectedYearId, (newYearId) => {
  if (newYearId && newYearId !== selectedYear.value) {
    selectedYear.value = newYearId
  }
}, { immediate: true })

const fetchStudentId = async () => {
  try {
    const id_usuario = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
    if (!id_usuario) return
    const idRes = await studentService.getByUserId(id_usuario)
    studentId.value = idRes.id_estudiante
    return studentId.value
  } catch (err) {
    console.error('Error fetching student ID:', err)
  }
}

const fetchYears = async () => {
  if (!studentId.value) return
  try {
    const res = await studentService.getYears(studentId.value)
    years.value = res
    
    if (!selectedYear.value) {
      if (yearStore.selectedYearId) {
        selectedYear.value = yearStore.selectedYearId
      } else if (displayYears.value.length > 0) {
        const currentYearStr = new Date().getFullYear().toString()
        const matchingYear = displayYears.value.find((y: any) => y.calendario === currentYearStr)
        selectedYear.value = matchingYear ? matchingYear.id_anio : displayYears.value[0].id_anio
        if (selectedYear.value) yearStore.setSelectedYearId(selectedYear.value)
      }
    }
    await fetchPeriods()
  } catch (err) {
    console.error("Error fetching years:", err)
  }
}

const fetchPeriods = async () => {
  if (!studentId.value || !selectedYear.value) return
  try {
    const res = await studentService.getAllPeriods(studentId.value, selectedYear.value)
    periods.value = (res || []).filter((p: any) => p.estado === 'CERRADO')
    if (periods.value.length > 0) {
      selectedPeriodId.value = periods.value[periods.value.length - 1].id_periodo
    } else {
      selectedPeriodId.value = null
    }
  } catch (err) {
    console.error("Error fetching periods:", err)
    periods.value = []
    selectedPeriodId.value = null
  }
}


onMounted(async () => {
  await fetchStudentId()
  await fetchYears()
  loading.value = false
})

watch(selectedYear, (newYear) => {
  if (newYear) {
    if (newYear !== yearStore.selectedYearId) {
      yearStore.setSelectedYearId(newYear)
    }
    fetchPeriods()
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2.5 sm:gap-3">
          <FileDown :size="26" class="text-indigo-600 dark:text-indigo-400 sm:w-8 sm:h-8" />
          <span>Mi Boletín Académico</span>
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium italic">
          Descarga tu reporte oficial de calificaciones por periodo
        </p>
      </div>
    </div>

    <!-- Empty State if no periods/records for selected year -->
    <NoAcademicRecordsBanner v-if="!loading && (!periods || periods.length === 0)" :year-label="selectedYearCalendar" />

    <!-- Period Selection Card -->
    <div v-else class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
        <div class="w-full md:w-1/2 space-y-4 sm:space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div class="space-y-1.5 sm:space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Calendar :size="14" />
                Año Lectivo
              </label>
              <select 
                v-model="selectedYear"
                class="w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-3.5 sm:px-4 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:border-indigo-500 transition-all cursor-pointer outline-none"
              >
                <option v-if="displayYears.length === 0" disabled value="">Sin años</option>
                <option v-for="y in displayYears" :key="y.id_anio" :value="y.id_anio">Año {{ y.calendario }}</option>
              </select>
            </div>

            <div class="space-y-1.5 sm:space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock :size="14" />
                Periodo
              </label>
              <select 
                v-model="selectedPeriodId"
                class="w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-3.5 sm:px-4 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:border-indigo-500 transition-all cursor-pointer outline-none"
              >
                <option v-if="periods.length === 0" disabled value="">No hay periodos cerrados</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}</option>
              </select>
            </div>
          </div>

          <div v-if="studentId && selectedPeriodId" class="pt-2 sm:pt-4">
            <BoletinExportModule 
              :student-id="studentId" 
              :period-id="selectedPeriodId" 
            />
          </div>
        </div>

        <div class="w-full md:w-1/2 flex flex-col items-center justify-center p-5 sm:p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl sm:rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50 text-center space-y-3 sm:space-y-4">
          <div class="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg text-indigo-600">
            <Sparkles :size="32" class="sm:w-10 sm:h-10" />
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-black text-slate-800 dark:text-white">Documento Oficial</h3>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2">
              Este PDF contiene tu rendimiento académico, asistencia y observaciones del periodo seleccionado.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Important Notice -->
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex gap-3 sm:gap-4 items-start">
      <div class="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
        <Info :size="18" class="sm:w-5 sm:h-5" />
      </div>
      <div>
        <h4 class="text-xs sm:text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-0.5 sm:mb-1">Nota Importante</h4>
        <p class="text-xs sm:text-sm text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
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
