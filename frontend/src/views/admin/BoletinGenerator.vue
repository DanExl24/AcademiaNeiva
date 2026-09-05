<template>
  <div class="max-w-6xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-16">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Generador de Boletines</h1>
        <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Configura y exporta los boletines académicos del periodo cerrado o informes parciales de traslado.</p>
      </div>
    </div>

    <!-- Selector de Tipo de Reporte -->
    <div class="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl w-full sm:w-fit border border-slate-200 dark:border-slate-700">
      <button 
        @click="reportMode = 'regular'" 
        :class="[
          'flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2',
          reportMode === 'regular' 
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        ]"
      >
        <span>📊 Boletín de Periodo</span>
      </button>
      <button 
        @click="reportMode = 'transfer'" 
        :class="[
          'flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2',
          reportMode === 'transfer' 
            ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20' 
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        ]"
      >
        <span>📜 Informe Parcial Traslado</span>
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <!-- Año Lectivo Selector -->
        <div>
          <label class="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Año Lectivo</label>
          <select 
            v-model="selectedYear" 
            @change="handleYearChange"
            class="w-full h-10 sm:h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow text-xs sm:text-sm font-medium cursor-pointer"
          >
            <option v-for="year in availableYears" :key="year.id_anio" :value="year.id_anio">
              {{ year.calendario }} {{ year.estado ? `(${year.estado})` : '' }}
            </option>
          </select>
        </div>

        <!-- Periodo Académico (solo requerido en modo regular) -->
        <div v-if="reportMode === 'regular'">
          <label class="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Periodo Académico</label>
          <select v-model="selectedPeriodo" class="w-full h-10 sm:h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow text-xs sm:text-sm cursor-pointer">
            <option value="">Seleccione un periodo cerrado</option>
            <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
              {{ periodo.nombre }} {{ getPeriodYearLabel(periodo.id_anio) }}
            </option>
          </select>
        </div>

        <div v-else>
          <label class="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Corte Temporal</label>
          <div class="w-full h-10 sm:h-11 px-3 sm:px-4 flex items-center rounded-xl border border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 text-xs font-bold">
            ⚡ Corte a hoy
          </div>
        </div>

        <div>
          <label class="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Nivel</label>
          <select v-model="selectedLevel" class="w-full h-10 sm:h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow text-xs sm:text-sm cursor-pointer">
            <option value="">Seleccione nivel</option>
            <option v-for="level in levels" :key="level.id_nivel" :value="level.id_nivel">
              {{ level.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Grupo</label>
          <select v-model="selectedGroup" @change="fetchStudentsForGroup" :disabled="!selectedLevel" class="w-full h-10 sm:h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow disabled:bg-slate-50 dark:disabled:bg-slate-950/40 disabled:text-slate-400 dark:disabled:text-slate-600 text-xs sm:text-sm cursor-pointer">
            <option value="">Seleccione grupo</option>
            <option v-for="grupo in filteredGroups" :key="grupo.id_grupo" :value="grupo.id_grupo">
              {{ getCourseDisplayName({ tipo_grado_nombre: grupo.tipo_grado_nombre, seccion_nombre: grupo.seccion_nombre }) }} ({{ grupo.jornada_nombre }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">
            {{ reportMode === 'transfer' ? 'Estudiante Requerido' : 'Estudiante Opcional' }}
          </label>
          <select v-model="selectedStudent" :disabled="!selectedGroup" class="w-full h-10 sm:h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow disabled:bg-slate-50 dark:disabled:bg-slate-950/40 disabled:text-slate-400 dark:disabled:text-slate-600 text-xs sm:text-sm cursor-pointer truncate">
            <option value="">{{ reportMode === 'transfer' ? 'Seleccione estudiante' : 'Todos (Generación masiva)' }}</option>
            <option v-for="student in students" :key="student.id_estudiante" :value="student.id_estudiante">
              {{ cleanMojibake(student.nombre) }} {{ cleanMojibake(student.apellido) }} {{ student.codigo ? `(${student.codigo})` : '' }}
            </option>
          </select>
        </div>
      </div>

      <!-- Banner de Ayuda si no hay estudiantes en el grupo para el año actual -->
      <div v-if="selectedGroup && students.length === 0 && !isLoading" class="p-3 sm:p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 sm:gap-3">
        <span class="text-base sm:text-lg">ℹ️</span>
        <div class="text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p class="font-bold">No se encontraron estudiantes matriculados en este grupo para el año lectivo seleccionado.</p>
          <p v-if="hasAlternativeYearWithData">
            💡 El historial académico con calificaciones y matrículas consolidadas se encuentra en el año lectivo <strong>{{ alternativeYearName }}</strong>.
            <button @click="switchToAlternativeYear" class="underline font-bold ml-1 cursor-pointer text-amber-900 dark:text-amber-200 hover:text-amber-950">
              Cambiar al año {{ alternativeYearName }}
            </button>
          </p>
        </div>
      </div>
      
      <div class="mt-3 sm:mt-4 flex justify-end">
        <button 
          @click="fetchBoletinData" 
          :disabled="(reportMode === 'regular' && (!selectedPeriodo || !selectedGroup)) || (reportMode === 'transfer' && !selectedStudent) || isLoading"
          :class="[
            'w-full sm:w-auto inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer',
            reportMode === 'transfer' 
              ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 focus:ring-amber-500' 
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 focus:ring-indigo-500'
          ]"
        >
          <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoading ? 'Cargando...' : (reportMode === 'transfer' ? 'Generar Informe Parcial' : 'Visualizar Boletines') }}
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 border-l-4 dark:border-l-red-500 p-3 sm:p-4 rounded-r-xl shadow-sm">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-xs sm:text-sm text-red-700 dark:text-red-400 font-medium">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Results Overview & Download PDF -->
    <div v-if="boletinesData.length > 0" class="bg-indigo-50 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
      <div class="flex items-center">
        <div class="p-2.5 sm:p-3 bg-indigo-100 dark:bg-indigo-900/35 rounded-full mr-3 sm:mr-4 text-indigo-600 dark:text-indigo-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 class="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-300">Listos para Generar</h3>
          <p class="text-xs sm:text-sm text-indigo-700 dark:text-indigo-400">{{ boletinesData.length }} {{ boletinesData.length === 1 ? 'boletín cargado' : 'boletines cargados' }} exitosamente.</p>
        </div>
      </div>
      <button 
        @click="exportToPDF" 
        :disabled="isExporting"
        class="w-full sm:w-auto inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 border border-transparent text-xs sm:text-sm font-bold rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
      >
        <svg v-if="isExporting" class="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="mr-2 -ml-1 h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {{ isExporting ? 'Generando PDFs...' : 'Descargar en PDF' }}
      </button>
    </div>

    <!-- Previews with horizontal scrolling wrapper for small screens -->
    <div class="space-y-8 sm:space-y-12 overflow-x-auto pb-4">
      <div v-for="(b, idx) in boletinesData" :key="idx" class="relative min-w-[700px] lg:min-w-0">
        <BoletinPreview :data="b" :ref="el => collectPreviewRefs(el, idx)" />
        <div class="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-full h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
          {{ idx + 1 }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore, type AcademicYear } from '../../stores/academicYear'
import { boletinService } from '../../services/boletinService'
import { academicService } from '../../services/academicService'
import { studentService } from '../../services/studentService'
import BoletinPreview from '../../components/boletines/BoletinPreview.vue'
import html2pdf from 'html2pdf.js'
import { getCourseDisplayName, cleanMojibake } from '../../utils/courseHelper'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()

const reportMode = ref<'regular' | 'transfer'>('regular')

const selectedYear = ref<number | null>(yearStore.selectedYearId)
const availableYears = computed<AcademicYear[]>(() => yearStore.availableYears || [])

const periodos = ref<any[]>([])
const allPeriodsRaw = ref<any[]>([])
const levels = ref<any[]>([])
const groups = ref<any[]>([])
const students = ref<any[]>([])

const selectedPeriodo = ref('')
const selectedLevel = ref('')
const selectedGroup = ref('')
const selectedStudent = ref('')

const isLoading = ref(false)
const isExporting = ref(false)
const error = ref('')

const boletinesData = ref<any[]>([])
const previewRefs = ref<any[]>([])

const filteredGroups = computed(() => {
  if (!selectedLevel.value) return []
  return groups.value.filter(g => String(g.id_nivel) === String(selectedLevel.value))
})

const allStudents = ref<any[]>([])

const getPeriodYearLabel = (id_anio: number) => {
  const y = availableYears.value.find(a => a.id_anio === id_anio)
  return y ? `(${y.calendario})` : ''
}

const hasAlternativeYearWithData = computed(() => {
  const currentId = selectedYear.value
  const alt = availableYears.value.find(y => y.id_anio !== currentId)
  return !!alt
})

const alternativeYearName = computed(() => {
  const currentId = selectedYear.value
  const alt = availableYears.value.find(y => y.id_anio !== currentId)
  return alt ? `${alt.calendario}` : ''
})

const switchToAlternativeYear = () => {
  const currentId = selectedYear.value
  const alt = availableYears.value.find(y => y.id_anio !== currentId)
  if (alt) {
    selectedYear.value = alt.id_anio
    yearStore.setSelectedYearId(alt.id_anio)
    fetchInitialData()
  }
}

const handleYearChange = () => {
  if (selectedYear.value) {
    yearStore.setSelectedYearId(selectedYear.value)
    selectedPeriodo.value = ''
    selectedGroup.value = ''
    selectedStudent.value = ''
    students.value = []
    fetchInitialData()
  }
}

const fetchInitialData = async () => {
  try {
    error.value = ''
    const schoolId = Number(auth.user?.schoolId) || 1

    if (availableYears.value.length === 0) {
      await yearStore.loadYearsForSchool(schoolId)
    }
    if (!selectedYear.value && yearStore.selectedYearId) {
      selectedYear.value = yearStore.selectedYearId
    }

    const currentYearId = selectedYear.value || yearStore.selectedYearId
    const yearParams = currentYearId ? { id_anio: currentYearId, yearId: currentYearId } : {}
    
    const [settingsData, gradesData, studentsData] = await Promise.all([
      academicService.getSettings(schoolId, { ...yearParams, keys: 'periods,scales' }),
      academicService.getGradesAndGroups(schoolId, yearParams),
      studentService.getStudentsBySchool(schoolId, yearParams)
    ])
    
    allPeriodsRaw.value = settingsData.periods || []
    
    // Periodos cerrados filtrados por el año seleccionado
    let closedP = (settingsData.periods || []).filter((p: any) => p.estado === 'CERRADO')
    if (currentYearId) {
      const yearSpecific = closedP.filter((p: any) => p.id_anio === currentYearId)
      if (yearSpecific.length > 0) {
        closedP = yearSpecific
      }
    }
    periodos.value = closedP
    levels.value = gradesData.niveles || []
    groups.value = gradesData.grupos || []

    let finalStudents = studentsData || []
    // Si el año consultado no tiene estudiantes matriculados en grupos (ej. año recién creado o filtrado vacío),
    // consultar el listado institucional para enlazar los estudiantes a sus grupos y permitir la emisión
    const hasEnrolledStudents = finalStudents.some((s: any) => s.id_grupo !== null && s.id_grupo !== undefined)
    if (!hasEnrolledStudents) {
      try {
        const fallbackStudents = await studentService.getStudentsBySchool(schoolId)
        if (fallbackStudents && fallbackStudents.length > 0) {
          finalStudents = fallbackStudents
        }
      } catch (eFallback) {
        console.warn('Fallback student fetch error:', eFallback)
      }
    }

    allStudents.value = finalStudents
    if (selectedGroup.value) {
      fetchStudentsForGroup()
    }
  } catch (err) {
    console.error("Error al cargar datos iniciales:", err)
    error.value = "Hubo un problema de conexión para obtener listas."
  }
}

onMounted(() => {
  fetchInitialData()
})

watch(() => yearStore.selectedYearId, (newYear) => {
  if (newYear && newYear !== selectedYear.value) {
    selectedYear.value = newYear
    selectedPeriodo.value = ''
    selectedGroup.value = ''
    selectedStudent.value = ''
    students.value = []
    fetchInitialData()
  }
})

watch(selectedLevel, () => {
  selectedGroup.value = ''
  selectedStudent.value = ''
  students.value = []
})

watch(selectedGroup, () => {
  selectedStudent.value = ''
  fetchStudentsForGroup()
})

watch(reportMode, () => {
  boletinesData.value = []
  error.value = ''
  if (selectedGroup.value) {
    fetchStudentsForGroup()
  }
})

const fetchStudentsForGroup = () => {
  if (!selectedGroup.value) {
    students.value = []
    return
  }
  // En modo traslado, permitir ver todos los estudiantes del grupo para emitir el certificado
  if (reportMode.value === 'transfer') {
    students.value = allStudents.value.filter((s: any) => String(s.id_grupo) === String(selectedGroup.value))
  } else {
    // Filtrar de los estudiantes cargados asegurando los que pertenezcan a dicho grupo
    students.value = allStudents.value.filter(
      (s: any) =>
        String(s.id_grupo) === String(selectedGroup.value) &&
        s.matricula_estado !== 'TRASLADADA' &&
        (s.matricula_estado === 'ACTIVA' || s.matricula_estado === 'APROBADA' || s.estado_vigente === 'ACTIVO' || s.estado === 'ACTIVO')
    )
  }
}

const collectPreviewRefs = (el: any, index: number) => {
  if (el) {
    previewRefs.value[index] = el
  }
}

const fetchBoletinData = async () => {
  error.value = ''
  isLoading.value = true
  boletinesData.value = []
  previewRefs.value = []

  try {
    if (reportMode.value === 'transfer') {
      if (!selectedStudent.value) {
        error.value = 'Debe seleccionar un estudiante para generar el informe parcial de traslado.'
        return
      }
      const data = await boletinService.getStudentTransferPartialReport(selectedStudent.value, selectedYear.value)
      boletinesData.value.push(data)
    } else {
      // Si hay un estudiante específico, trae solo ese.
      if (selectedStudent.value) {
        const data = await boletinService.getStudentBoletin(selectedStudent.value, selectedPeriodo.value)
        boletinesData.value.push(data)
      } else {
        const groupData = await boletinService.getGroupBoletin(selectedGroup.value, selectedPeriodo.value)
        const ids = groupData.students || []
        
        for (const id of ids) {
          try {
            const sData = await boletinService.getStudentBoletin(id, selectedPeriodo.value)
            boletinesData.value.push(sData)
          } catch (errId) {
            console.error(`[fetchBoletinData] Failed to load student ${id}:`, errId)
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[fetchBoletinData] Caught error:', err)
    error.value = err.response?.data?.error || err.message || 'Error al conectar con el servidor'
  } finally {
    isLoading.value = false
  }
}

const exportToPDF = async () => {
  isExporting.value = true
  try {
    await nextTick()
    
    for (let i = 0; i < previewRefs.value.length; i++) {
        const preview = previewRefs.value[i]
        const element = preview.boletinRef

        const opt = {
            margin:       0.5,
            filename:     `boletin_${boletinesData.value[i]?.estudiante?.codigo || 'estudiante'}_${boletinesData.value[i]?.periodo || 'periodo'}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
        }

        await new Promise(resolve => setTimeout(resolve, 500))
        await html2pdf().set(opt).from(element).save()
    }
  } catch (err: any) {
      console.error(err)
      error.value = "Error convirtiendo a PDF"
  } finally {
      isExporting.value = false
  }
}
</script>
