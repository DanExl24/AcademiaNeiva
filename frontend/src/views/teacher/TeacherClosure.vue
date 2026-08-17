<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { 
  GraduationCap, 
  CheckCircle2, 
  Clock, 
  Loader2,
  Lock,
  AlertTriangle,
  Search,
  X,
  ClipboardList,
  SlidersHorizontal
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { teacherService } from '../../services/teacherService'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { getCourseDisplayName } from '../../utils/courseHelper'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const router = useRouter()
const { confirm } = useConfirm()
const toast = useToast()
const loading = ref(true)

const courses = ref<any[]>([])
const periods = ref<any[]>([])
const activePeriodId = ref<number | null>(null)
const processingId = ref<number | null>(null)

// Filtros interactivos
const searchQuery = ref('')
const selectedGrade = ref('')
const selectedJornada = ref('')
const selectedStatus = ref('')
const selectedSubject = ref('')

const uniqueGrades = computed(() => {
  const grades = courses.value.map((c: any) => c.grado_nombre).filter(Boolean)
  return [...new Set(grades)].sort()
})

const uniqueSubjects = computed(() => {
  const subjects = courses.value.map((c: any) => c.materia_nombre).filter(Boolean)
  return [...new Set(subjects)].sort()
})

const uniqueJornadas = computed(() => {
  const jornadas = courses.value.map((c: any) => c.jornada_nombre).filter(Boolean)
  return [...new Set(jornadas)].sort()
})



const filteredCourses = computed(() => {
  return courses.value.filter((c: any) => {
    const matchesSearch = !searchQuery.value || 
      c.materia_nombre?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.grado_nombre?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesGrade = !selectedGrade.value || c.grado_nombre === selectedGrade.value
    const matchesSubject = !selectedSubject.value || c.materia_nombre === selectedSubject.value
    const matchesJornada = !selectedJornada.value || c.jornada_nombre === selectedJornada.value
    const matchesStatus = !selectedStatus.value || 
      (selectedStatus.value === 'cerrado' && c.isClosed) ||
      (selectedStatus.value === 'abierto' && !c.isClosed) ||
      (selectedStatus.value === 'listo' && !c.isClosed && (!c.missingGrades || c.missingGrades.length === 0)) ||
      (selectedStatus.value === 'pendiente' && !c.isClosed && c.missingGrades?.length > 0)
    return matchesSearch && matchesGrade && matchesSubject && matchesJornada && matchesStatus
  })
})

const hasActiveFilters = computed(() => !!searchQuery.value || !!selectedGrade.value || !!selectedSubject.value || !!selectedJornada.value || !!selectedStatus.value)

const clearFilters = () => {
  searchQuery.value = ''
  selectedGrade.value = ''
  selectedSubject.value = ''
  selectedJornada.value = ''
  selectedStatus.value = ''
}

const fetchPeriods = async () => {
  try {
    const schoolId = auth.selectedSchoolId || auth.user?.schoolId || (auth.user as any)?.id_colegio || (auth.isSupervising ? (auth.supervision?.colegio_id || auth.supervision?.id_colegio) : null)
    if (!schoolId) return
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const data = await teacherService.getPeriods(schoolId, params)
    periods.value = ((data as any).periodos || data || []).filter((p: any) => p.estado !== 'PENDIENTE')
    const exists = periods.value.some((p: any) => p.id_periodo === activePeriodId.value)
    if (!exists) {
      const openPeriod = periods.value.find((p: any) => p.estado === 'ABIERTO')
      if (openPeriod) {
        activePeriodId.value = openPeriod.id_periodo
      } else if (periods.value.length > 0) {
        activePeriodId.value = periods.value[periods.value.length - 1].id_periodo
      } else {
        activePeriodId.value = null
      }
    }
  } catch (error) {
  }
}

const fetchCoursesWithStatus = async () => {
  if (!activePeriodId.value) return
  
  try {
    const userId = auth.isMonitoring
      ? auth.monitoringUser?.id
      : (auth.user?.id_usuario || auth.user?.id)

    if (!userId) return

    loading.value = true
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const rawCourses = await teacherService.getCourses(userId, params)
    
    const coursesWithStatus = await Promise.all(rawCourses.map(async (course: any) => {
      try {
        const statusRes = await teacherService.getClosureStatus(course.id_detallegrado, activePeriodId.value!)
        return {
          ...course,
          ...statusRes
        }
      } catch (err: any) {
        return {
          ...course,
          status: 'pendiente',
          error_message: 'Error al verificar estado',
          isClosed: false
        }
      }
    }))
    
    courses.value = coursesWithStatus
  } catch (error) {
  } finally {
    loading.value = false
  }
}

watch(() => yearStore.selectedYearId, async () => {
  activePeriodId.value = null
  await fetchPeriods()
  await fetchCoursesWithStatus()
})

const showJustificationModal = ref(false)
const courseToClose = ref<any>(null)
const pendingEvidences = ref<any[]>([])
const selectedReasonPreset = ref('Tiempo insuficiente por imprevistos del calendario académico')
const customReason = ref('')

const openJustificationModal = (course: any, evidences: any[]) => {
  courseToClose.value = course
  pendingEvidences.value = evidences
  selectedReasonPreset.value = 'Tiempo insuficiente por imprevistos del calendario académico'
  customReason.value = ''
  showJustificationModal.value = true
}

const handleConfirmClosureWithJustification = async () => {
  if (!courseToClose.value) return

  const justification = selectedReasonPreset.value === 'OTRO'
    ? customReason.value.trim()
    : selectedReasonPreset.value

  if (!justification) {
    alert('Por favor especifica el motivo por el cual no se evaluaron las evidencias DBA.')
    return
  }

  try {
    processingId.value = courseToClose.value.id_detallegrado
    const response = await teacherService.closePeriod({
      detailGradeId: courseToClose.value.id_detallegrado,
      periodId: activePeriodId.value,
      userId: auth.user?.id,
      justificacion_evidencias_pendientes: justification
    })
    
    toast.success(response.message || 'Periodo cerrado correctamente')
    showJustificationModal.value = false
    await fetchCoursesWithStatus()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al cerrar el periodo')
  } finally {
    processingId.value = null
  }
}

const handleClosePeriod = async (course: any) => {
  const ok = await confirm({
    title: 'Confirmar Cierre de Materia',
    message: `¿Estás seguro de cerrar el periodo para ${course.materia_nombre} en ${course.grado_nombre}? Una vez cerrada, las notas no podrán modificarse.`,
    confirmText: 'Cerrar Materia',
    type: 'warning'
  })
  if (!ok) return

  try {
    processingId.value = course.id_detallegrado
    const response = await teacherService.closePeriod({
      detailGradeId: course.id_detallegrado,
      periodId: activePeriodId.value,
      userId: auth.user?.id
    })
    
    toast.success(response.message || 'Periodo cerrado correctamente')
    await fetchCoursesWithStatus()
  } catch (error: any) {
    if (error.response?.status === 422 && error.response?.data?.requires_justification) {
      openJustificationModal(course, error.response.data.unevaluated_evidences || [])
    } else {
      toast.error(error.response?.data?.error || 'Error al cerrar el periodo')
    }
  } finally {
    processingId.value = null
  }
}


const activePeriodName = computed(() => {
  const name = periods.value.find(p => p.id_periodo === activePeriodId.value)?.nombre || 'Cargando...'
  return name
})

const navigateToGrades = (course: any) => {
  router.push({ 
    path: '/dashboard/calificaciones', 
    query: { 
      gradoId: course.id_grado,
      subjectId: course.id_materia 
    } 
  })
}

onMounted(async () => {
  await fetchPeriods()
  await fetchCoursesWithStatus()
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-700">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors">
      <div class="space-y-1">
        <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Cierre de Periodo Académico</h1>
        <p class="text-slate-500 dark:text-slate-400 font-medium">Finaliza tus materias para el periodo actual: <span class="text-indigo-600 dark:text-indigo-400 font-bold">{{ activePeriodName }}</span></p>
      </div>
      
      <div class="px-6 py-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl flex items-center gap-3">
        <Clock class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        <div class="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
          Periodo Académico Activo
        </div>
      </div>
    </div>

    <!-- Filtros Interactivos -->
    <div v-if="!loading && courses.length > 0" class="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
      <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex flex-col sm:flex-row flex-wrap gap-4 items-center w-full md:w-auto">
          <div class="relative w-full sm:w-64">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Buscar por materia o grado..." 
              class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300"
            />
            <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>

          <!-- Period Selector -->
          <div v-if="periods.length > 0" class="relative w-full sm:w-48">
            <select 
              v-model="activePeriodId"
              @change="fetchCoursesWithStatus"
              class="w-full pl-4 pr-10 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-sm font-bold text-indigo-700 dark:text-indigo-300 outline-none appearance-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 cursor-pointer"
            >
              <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
                {{ p.nombre }} {{ p.estado === 'ABIERTO' ? '(Abierto)' : '' }}
              </option>
            </select>
          </div>

          <div class="relative w-full sm:w-44">
            <select 
              v-model="selectedGrade"
              class="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300 cursor-pointer"
            >
              <option value="">Todos los Grados</option>
              <option v-for="g in uniqueGrades" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>

          <div class="relative w-full sm:w-44">
            <select 
              v-model="selectedSubject"
              class="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300 cursor-pointer"
            >
              <option value="">Todas las Materias</option>
              <option v-for="s in uniqueSubjects" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div class="relative w-full sm:w-44">
            <select 
              v-model="selectedJornada"
              class="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300 cursor-pointer"
            >
              <option value="">Todas las Jornadas</option>
              <option v-for="j in uniqueJornadas" :key="j" :value="j">{{ j }}</option>
            </select>
          </div>

          <div class="relative w-full sm:w-44">
            <select 
              v-model="selectedStatus"
              class="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300 cursor-pointer"
            >
              <option value="">Todos los Estados</option>
              <option value="cerrado">Cerrado</option>
              <option value="listo">Listo para cerrar</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>

        <button 
          v-if="hasActiveFilters"
          @click="clearFilters"
          class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 shrink-0"
        >
          <X class="w-3.5 h-3.5" />
          Limpiar Filtros
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
      <Loader2 class="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin" />
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium italic">Verificando estado de tus materias...</p>
    </div>

    <!-- No Results -->
    <div v-else-if="filteredCourses.length === 0" class="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
      <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
        <SlidersHorizontal class="w-8 h-8" />
      </div>
      <p class="text-slate-500 dark:text-slate-400 font-bold text-lg">No se encontraron materias con los filtros aplicados</p>
      <button @click="clearFilters" class="mt-4 text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Limpiar todos los filtros</button>
    </div>

    <!-- Course List -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div 
        v-for="course in filteredCourses" 
        :key="course.id_detallegrado"
        class="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden hover:shadow-xl transition-all duration-300 group"
      >
        <!-- Header del Card -->
        <div class="p-6 space-y-4">
          <div class="flex justify-between items-start">
            <div :class="[course.isClosed ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400', 'p-3 rounded-2xl']">
              <CheckCircle2 v-if="course.isClosed" class="w-6 h-6" />
              <GraduationCap v-else class="w-6 h-6" />
            </div>
            <div 
              :class="[
                course.isClosed ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800',
                'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors'
              ]"
            >
              {{ course.isClosed ? 'Cerrado' : 'Abierto' }}
            </div>
          </div>

          <div>
            <h3 class="text-xl font-black text-slate-900 dark:text-white leading-tight mb-1">{{ course.materia_nombre }}</h3>
            <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm">
              {{ getCourseDisplayName({ grado_nombre: course.grado_nombre, seccion_nombre: course.seccion }) }} • {{ course.jornada_nombre }}
            </div>
          </div>

          <!-- Conditions / Warnings / Info -->
          <div class="space-y-3">
            <!-- Closed course info -->
            <div v-if="course.isClosed" class="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-2xl space-y-2">
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span class="text-[10px] font-black text-emerald-900 dark:text-emerald-300 uppercase">Resumen del Periodo</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Promedio del Grupo: <span class="font-black">{{ course.groupAverage != null ? course.groupAverage.toFixed(1) : 'N/A' }}</span></span>
                <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Estudiantes: <span class="font-black text-emerald-600 dark:text-emerald-400">COMPLETADO</span></span>
              </div>
              <div v-if="course.closureData && course.closureData.docente_cierre_nombre" class="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium border-t border-emerald-200/60 dark:border-emerald-900/50 pt-1.5 mt-1">
                Cerrado por: <span class="font-bold text-emerald-950 dark:text-emerald-200">{{ course.closureData.docente_cierre_nombre }}</span>
              </div>
            </div>

            <!-- Missing grades (Pending) -->
            <div v-else-if="course.missingGrades && course.missingGrades.length > 0" class="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900 rounded-2xl">
              <div class="flex items-center gap-2 mb-2">
                <AlertTriangle class="w-4 h-4 text-orange-500" />
                <span class="text-[10px] font-black text-orange-900 dark:text-orange-300 uppercase">Pendiente</span>
              </div>
              <p class="text-[11px] text-orange-700 dark:text-orange-400 font-medium italic">Faltan notas por registrar. Debes calificar a todos los estudiantes ({{ course.missingGrades.length }} pendientes) para poder cerrar la materia.</p>
            </div>
            
            <!-- Ready to close -->
            <div v-else-if="course.activityCount > 0" class="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-2xl">
              <div class="flex items-center gap-2 mb-2">
                <CheckCircle2 class="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span class="text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase">Todo listo</span>
              </div>
              <p class="text-[11px] text-indigo-700 dark:text-indigo-400 font-black">Todo está completo, listo para cerrar.</p>
            </div>
          </div>
        </div>

        <!-- Footer / Actions -->
        <div class="p-6 pt-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 transition-colors mt-auto">
          <div class="flex gap-2">
            <button 
              @click="navigateToGrades(course)"
              class="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <ClipboardList class="w-4 h-4" />
              Revisar
            </button>

            <button 
              v-if="!course.isClosed && !auth.isMonitoring"
              @click="handleClosePeriod(course)"
              :disabled="course.missingGrades?.length > 0 || processingId === course.id_detallegrado"
              class="flex-[1.5] px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Loader2 v-if="processingId === course.id_detallegrado" class="w-4 h-4 animate-spin" />
              <Lock v-else class="w-4 h-4" />
              Cerrar Periodo
            </button>
            <div 
              v-else-if="auth.isMonitoring && !course.isClosed"
              class="flex-[1.5] flex items-center justify-center gap-2 text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900"
            >
              <Lock class="w-4 h-4" />
              Solo Lectura
            </div>
            <div v-else class="flex-[1.5] flex items-center justify-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
              <CheckCircle2 class="w-4 h-4" />
              Materia Cerrada
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && courses.length === 0" class="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-slate-200">
      <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <GraduationCap class="w-10 h-10 text-slate-300" />
      </div>
      <h3 class="text-xl font-black text-slate-400">No tienes materias asignadas</h3>
      <p class="text-slate-400 mt-2">Contacta a la administración para verificar tu carga académica.</p>
    </div>

    <!-- Modal de Justificación de Evidencias DBA Pendientes -->
    <div v-if="showJustificationModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <AlertTriangle class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-lg font-black text-slate-900 dark:text-white">Evidencias DBA Sin Evaluar</h3>
              <p class="text-xs text-slate-500 font-medium">Materia: {{ courseToClose?.materia_nombre }} ({{ courseToClose?.grado_nombre }})</p>
            </div>
          </div>
          <button @click="showJustificationModal = false" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl text-xs text-amber-800 dark:text-amber-300 space-y-2">
          <p class="font-bold">Existen {{ pendingEvidences.length }} evidencia(s) DBA planeadas para este periodo que no fueron asociadas a ninguna actividad evaluativa:</p>
          <ul class="list-disc list-inside space-y-1 text-[11px] max-h-28 overflow-y-auto custom-scrollbar">
            <li v-for="ev in pendingEvidences" :key="ev.id_evidencia_dba" class="font-medium">
              <span class="font-bold">DBA {{ ev.numero_dba }}:</span> {{ ev.descripcion }}
            </li>
          </ul>
        </div>

        <div class="space-y-3">
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Selecciona o escribe el motivo por el cual no se evaluaron:</label>
          
          <select v-model="selectedReasonPreset" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500">
            <option value="Tiempo insuficiente por imprevistos del calendario académico">Tiempo insuficiente por imprevistos del calendario académico</option>
            <option value="Reorganización pedagógica aprobada institucionalmente">Reorganización pedagógica aprobada institucionalmente</option>
            <option value="Contenido cubierto dentro de otra evidencia integrada">Contenido cubierto dentro de otra evidencia integrada</option>
            <option value="OTRO">Otro motivo (especificar abajo)...</option>
          </select>

          <textarea 
            v-if="selectedReasonPreset === 'OTRO'" 
            v-model="customReason" 
            rows="3" 
            placeholder="Escribe la justificación detallada..." 
            class="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button 
            @click="showJustificationModal = false" 
            class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
          <button 
            @click="handleConfirmClosureWithJustification" 
            :disabled="processingId === courseToClose?.id_detallegrado"
            class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Loader2 v-if="processingId === courseToClose?.id_detallegrado" class="w-4 h-4 animate-spin" />
            <span>Confirmar Cierre de Materia</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.2);
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.4);
}
</style>
