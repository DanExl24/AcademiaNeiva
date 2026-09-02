<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  CalendarCheck, 
  Search, 
  Check, 
  X, 
  Minus, 
  Download, 
  Save, 
  AlertCircle,
  CheckCircle,
  Loader2,
  History,
  Clock,
  ThumbsUp,
  FileText,
  Calendar,
  ChevronLeft
} from 'lucide-vue-next'
import { teacherService } from '../../services/teacherService'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { getCourseDisplayName } from '../../utils/courseHelper'
import DataTable from '../../components/ui/DataTable.vue'
import SkeletonTable from '../../components/feedback/SkeletonTable.vue'
import EmptyState from '../../components/feedback/EmptyState.vue'

interface Course {
  id_grado: number
  grado_nombre: string
  seccion: string
  id_materia: number
  materia_nombre: string
  id_detallegrado: number
  jornada_nombre: string
}

interface StudentAttendance {
  id_estudiante: number
  nombre: string
  documento: string
  codigo: string
  estado: 'PRESENTE' | 'AUSENTE' | 'TARDE' | 'JUSTIFICADA' | null
  justificacion: string | null
  hora_llegada: string | null
}

interface StudentHistory {
  id_estudiante: number
  nombre: string
  documento: string
  codigo: string
  presentes: number
  ausentes: number
  tardes: number
  justificadas: number
}

const route = useRoute()
const auth = useAuthStore()
const yearStore = useAcademicYearStore()

// Local timezone safe today date format (YYYY-MM-DD)
const todayStr = computed(() => new Date().toLocaleDateString('en-CA'))

// Selectors
const selectedGradeName = ref<string | null>(null)
const selectedSection = ref<string | null>(null)
const selectedJornada = ref<string | null>(null)
const selectedSubjectId = ref<number | null>(null)
const selectedDate = ref(todayStr.value)
const activeTab = ref<'today' | 'history'>('today')

// Data
const myCourses = ref<Course[]>([])
const students = ref<StudentAttendance[]>([])
const historyData = ref<StudentHistory[]>([])
const recordedDates = ref<string[]>([])
const isEditable = ref(true)
const lockReason = ref('')
const loading = ref(false)
const saving = ref(false)
const historyLoading = ref(false)
const searchQuery = ref('')

// Load assigned courses
const fetchMyCourses = async () => {
  // In monitoring mode, load the observed teacher's courses
  const teacherId = auth.isMonitoring ? auth.monitoringUser?.id : (auth.user?.id_usuario || auth.user?.id)
  if (!teacherId) return
  try {
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const data = await teacherService.getCourses(teacherId, params)
    myCourses.value = data as any
    
    if (route.query.gradoId) {
      const gId = Number(route.query.gradoId)
      const sId = route.query.subjectId ? Number(route.query.subjectId) : null
      
      const course = myCourses.value.find(c => c.id_grado === gId)
      if (course) {
        selectedGradeName.value = course.grado_nombre
        selectedSection.value = course.seccion
        selectedJornada.value = course.jornada_nombre
        if (sId) selectedSubjectId.value = sId
      }
    }
  } catch (error) {
  }
}

// Find id_detallegrado
const selectedCourse = computed(() => {
  const course = myCourses.value.find(c => 
    c.grado_nombre === selectedGradeName.value && 
    c.seccion === selectedSection.value && 
    c.jornada_nombre === selectedJornada.value &&
    c.id_materia === selectedSubjectId.value
  )
  return course
})

// Load attendance for selected date
const fetchAttendance = async () => {
  if (!selectedCourse.value) return
  try {
    loading.value = true
    currentPage.value = 1
    const resData: any = await teacherService.getAttendance(selectedCourse.value.id_detallegrado, selectedDate.value)
    students.value = resData.students || resData
    isEditable.value = resData.editable ?? true
    lockReason.value = resData.error || ''
  } catch (error: any) {
    students.value = []
    isEditable.value = false
    lockReason.value = 'Error al cargar la asistencia del servidor.'
  } finally {
    loading.value = false
  }
}

// Load attendance history
const fetchHistory = async () => {
  if (!selectedCourse.value) return
  try {
    historyLoading.value = true
    const resData: any = await teacherService.getAttendanceHistory(selectedCourse.value.id_detallegrado)
    historyData.value = resData.studentsHistory || []
    recordedDates.value = resData.recordedDates || []
  } catch (error: any) {
    historyData.value = []
    recordedDates.value = []
  } finally {
    historyLoading.value = false
  }
}



// Navigate to specific date
const viewDate = (date: string) => {
  selectedDate.value = date
  activeTab.value = 'today'
}

// Reset date to today
const resetToToday = () => {
  selectedDate.value = todayStr.value
  fetchAttendance()
}

// Watchers
watch([selectedGradeName, selectedSection, selectedJornada], () => {
  selectedSubjectId.value = null
})

watch([selectedCourse, selectedSubjectId], () => {
  students.value = []
  historyData.value = []
  recordedDates.value = []
  if (selectedCourse.value) {
    if (activeTab.value === 'today') {
      fetchAttendance()
    } else {
      fetchHistory()
    }
  }
})

watch(selectedDate, () => {
  if (selectedCourse.value && activeTab.value === 'today') {
    fetchAttendance()
  }
})

watch(activeTab, (newTab) => {
  if (selectedCourse.value) {
    if (newTab === 'today') {
      fetchAttendance()
    } else {
      fetchHistory()
    }
  }
})

watch(() => yearStore.selectedYearId, () => {
  selectedGradeName.value = null
  selectedSection.value = null
  selectedJornada.value = null
  selectedSubjectId.value = null
  students.value = []
  historyData.value = []
  recordedDates.value = []
  fetchMyCourses()
})

// Dropdowns compute
const gradeOptions = computed(() => {
  const grades = myCourses.value.map(c => c.grado_nombre)
  return [...new Set(grades)].sort()
})

const sectionOptions = computed(() => {
  if (!selectedGradeName.value) return []
  const sections = myCourses.value
    .filter(c => c.grado_nombre === selectedGradeName.value)
    .map(c => c.seccion)
  return [...new Set(sections)].sort()
})

const jornadaOptions = computed(() => {
  if (!selectedGradeName.value || !selectedSection.value) return []
  const jornadas = myCourses.value
    .filter(c => c.grado_nombre === selectedGradeName.value && c.seccion === selectedSection.value)
    .map(c => c.jornada_nombre)
  return [...new Set(jornadas)].sort()
})

const subjectsOptions = computed(() => {
  if (!selectedGradeName.value || !selectedSection.value || !selectedJornada.value) return []
  return myCourses.value
    .filter(c => 
      c.grado_nombre === selectedGradeName.value && 
      c.seccion === selectedSection.value && 
      c.jornada_nombre === selectedJornada.value
    )
    .map(c => ({ id: c.id_materia, label: c.materia_nombre }))
})

// Stats
const stats = computed(() => {
  const counts = { presente: 0, ausente: 0, tarde: 0, justificada: 0, sin_registro: 0 }
  students.value.forEach(s => {
    if (s.estado === 'PRESENTE') counts.presente++
    else if (s.estado === 'AUSENTE') counts.ausente++
    else if (s.estado === 'TARDE') counts.tarde++
    else if (s.estado === 'JUSTIFICADA') counts.justificada++
    else counts.sin_registro++
  })
  return counts
})

// Filtered students
const filteredStudents = computed(() => {
  if (!searchQuery.value.trim()) return students.value
  const query = searchQuery.value.toLowerCase()
  return students.value.filter(s => s.nombre.toLowerCase().includes(query) || s.codigo.toLowerCase().includes(query))
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(12)

const paginatedStudents = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value
  const endIndex = startIndex + itemsPerPage.value
  return filteredStudents.value.slice(startIndex, endIndex)
})

const totalPages = computed(() => {
  return Math.ceil(filteredStudents.value.length / itemsPerPage.value) || 1
})

watch(searchQuery, () => {
  currentPage.value = 1
})

const filteredHistory = computed(() => {
  if (!searchQuery.value.trim()) return historyData.value
  const query = searchQuery.value.toLowerCase()
  return historyData.value.filter(s => s.nombre.toLowerCase().includes(query) || s.codigo.toLowerCase().includes(query))
})

// Check overall editability (false when period closed or in monitoring mode)
const canEditAttendance = computed(() => {
  return isEditable.value && !auth.isMonitoring
})

// Default arrival time state & helpers
const defaultTime = ref('07:00')

const setTimeNow = () => {
  if (!canEditAttendance.value) return
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  defaultTime.value = `${hh}:${mm}`
}

const autosaveStatus = ref<'saved' | 'saving' | 'error'>('saved')
const autosaveErrorMsg = ref('')

const calculateLateTime = (baseTime: string, addMinutesCount = 5): string => {
  const [hh, mm] = (baseTime || '07:00').split(':').map(Number)
  const lateMin = (hh * 60 + mm + addMinutesCount) % (24 * 60)
  const lateHh = String(Math.floor(lateMin / 60)).padStart(2, '0')
  const lateMm = String(lateMin % 60).padStart(2, '0')
  return `${lateHh}:${lateMm}`
}

const saveAllAttendance = async (silent = false) => {
  if (!selectedCourse.value || !canEditAttendance.value) return
  if (saving.value && !silent) return

  // FORCER: Garantizar que todo estudiante con estado TARDE tenga una hora de llegada estrictamente mayor a la hora de ingreso normal
  students.value.forEach(student => {
    if (student.estado === 'TARDE') {
      if (!student.hora_llegada || student.hora_llegada <= defaultTime.value) {
        student.hora_llegada = calculateLateTime(defaultTime.value, 5)
      }
    }
  })

  try {
    if (silent) {
      autosaveStatus.value = 'saving'
      autosaveErrorMsg.value = ''
    } else {
      saving.value = true
    }

    const recordsToSave = students.value.map(s => ({
      id_estudiante: s.id_estudiante,
      estado: s.estado,
      justificacion: s.justificacion,
      hora_llegada: s.hora_llegada
    }))

    await teacherService.saveAttendance({
      detailGradeId: selectedCourse.value.id_detallegrado,
      date: selectedDate.value,
      records: recordsToSave
    })

    if (silent) {
      autosaveStatus.value = 'saved'
    } else {
      alert('Asistencia guardada exitosamente')
      await fetchAttendance()
    }

  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Error al guardar asistencia'
    autosaveStatus.value = 'error'
    autosaveErrorMsg.value = errorMsg
    if (!silent) {
      alert(errorMsg)
    }
  } finally {
    if (!silent) {
      saving.value = false
    }
  }
}

const applyDefaultTimeToAll = () => {
  if (!canEditAttendance.value) return
  students.value.forEach(student => {
    if (student.estado === 'PRESENTE') {
      student.hora_llegada = defaultTime.value
    } else if (student.estado === 'TARDE') {
      student.hora_llegada = calculateLateTime(defaultTime.value, 15)
    }
  })
  saveAllAttendance(true)
}

// Quick status toggling
const setStatus = (studentId: number, status: 'PRESENTE' | 'AUSENTE' | 'TARDE' | 'JUSTIFICADA') => {
  if (!canEditAttendance.value) return
  const student = students.value.find(s => s.id_estudiante === studentId)
  if (student) {
    if (student.estado === status) {
      student.estado = null
      student.justificacion = null
      student.hora_llegada = null
    } else {
      student.estado = status
      if (status !== 'JUSTIFICADA') {
        student.justificacion = null
      }
      if (status === 'PRESENTE') {
        if (!student.hora_llegada) {
          student.hora_llegada = defaultTime.value
        }
      } else if (status === 'TARDE') {
        if (!student.hora_llegada || student.hora_llegada <= defaultTime.value) {
          student.hora_llegada = calculateLateTime(defaultTime.value, 15)
        }
      } else {
        student.hora_llegada = null
      }
    }
    saveAllAttendance(true)
  }
}

// Mark all as present
const markAllPresent = () => {
  if (!canEditAttendance.value) return
  students.value.forEach(s => {
    s.estado = 'PRESENTE'
    s.justificacion = null
    s.hora_llegada = defaultTime.value
  })
  saveAllAttendance(true)
}

// Print / Physical download format
const printAttendanceSheet = () => {
  if (!selectedCourse.value) return
  
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const courseInfo = selectedCourse.value
  const dateStr = selectedDate.value
  
  let rows = ''
  if (activeTab.value === 'today') {
    students.value.forEach((s, idx) => {
      const stateLabel = s.estado === 'JUSTIFICADA' && s.justificacion 
        ? `JUSTIFICADA (${s.justificacion})`
        : (s.estado || 'SIN REGISTRO');
      rows += `
        <tr>
          <td>${idx + 1}</td>
          <td>${s.codigo}</td>
          <td>${s.nombre}</td>
          <td>${stateLabel}</td>
          <td class="sign-cell"></td>
        </tr>
      `
    })
  } else {
    historyData.value.forEach((s, idx) => {
      const total = s.presentes + s.ausentes + s.tardes + s.justificadas
      const rate = total > 0 ? Math.round(((s.presentes + s.tardes + s.justificadas) / total) * 100) : 100
      rows += `
        <tr>
          <td>${idx + 1}</td>
          <td>${s.codigo}</td>
          <td>${s.nombre}</td>
          <td>${s.presentes} / ${total}</td>
          <td>${s.ausentes}</td>
          <td>${s.tardes}</td>
          <td>${s.justificadas}</td>
          <td>${rate}%</td>
        </tr>
      `
    })
  }

  const headers = activeTab.value === 'today' 
    ? `<th>N°</th><th>Código</th><th>Estudiante</th><th>Estado Hoy</th><th>Observaciones / Firma</th>`
    : `<th>N°</th><th>Código</th><th>Estudiante</th><th>Asistencias</th><th>Inasistencias</th><th>Retrasos</th><th>Justificadas</th><th>% Asist.</th>`

  printWindow.document.write(`
    <html>
      <head>
        <title>Formato de Asistencia - ${getCourseDisplayName({ grado_nombre: courseInfo.grado_nombre, seccion_nombre: courseInfo.seccion })}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; }
          .header { margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; }
          .meta { font-size: 14px; color: #64748b; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 12px 10px; text-align: left; font-size: 13px; }
          th { bg-color: #f8fafc; font-weight: bold; }
          .sign-cell { width: 200px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Control de Asistencia Escolar</h1>
          <p class="meta"><strong>Grado:</strong> ${getCourseDisplayName({ grado_nombre: courseInfo.grado_nombre, seccion_nombre: courseInfo.seccion })} | <strong>Materia:</strong> ${courseInfo.materia_nombre}</p>
          <p class="meta"><strong>Fecha de reporte:</strong> ${dateStr} | <strong>Tipo:</strong> ${activeTab.value === 'today' ? 'Control Diario' : 'Reporte Consolidado Histórico'}</p>
        </div>
        <table>
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); window.close(); }
        <\/script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

const exportHistoryToCSV = () => {
  if (!selectedCourse.value || historyData.value.length === 0) return

  const courseInfo = selectedCourse.value
  const headers = [
    'Código Estudiante',
    'Estudiante',
    'Grado',
    'Sección',
    'Materia',
    'Jornada',
    'Presentes (Asistencias)',
    'Ausentes (Inasistencias)',
    'Retrasos (Tardes)',
    'Justificadas',
    'Porcentaje Asistencia'
  ]

  const rows = historyData.value.map(s => {
    const total = s.presentes + s.ausentes + s.tardes + s.justificadas
    const rate = total > 0 ? Math.round(((s.presentes + s.tardes + s.justificadas) / total) * 100) : 100

    return [
      s.codigo,
      `"${s.nombre.replace(/"/g, '""')}"`,
      `"${courseInfo.grado_nombre.replace(/"/g, '""')}"`,
      `"${courseInfo.seccion.replace(/"/g, '""')}"`,
      `"${courseInfo.materia_nombre.replace(/"/g, '""')}"`,
      `"${courseInfo.jornada_nombre.replace(/"/g, '""')}"`,
      s.presentes,
      s.ausentes,
      s.tardes,
      s.justificadas,
      `${rate}%`
    ]
  })

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `asistencia_historial_${getCourseDisplayName({ grado_nombre: courseInfo.grado_nombre, seccion_nombre: courseInfo.seccion }).replace(/\s+/g, '_')}_${new Date().toLocaleDateString()}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  fetchMyCourses()
})
</script>

<template>
  <div class="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
    <!-- Header with Actions -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Asistencia de Grados</h1>
        <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-sm md:text-base mt-0.5 transition-colors">Registra, modifica y visualiza la asistencia diaria de tus cursos asignados.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <button 
          v-if="selectedCourse"
          @click="printAttendanceSheet"
          class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-200/60 dark:border-slate-700/60 shadow-sm text-xs sm:text-sm cursor-pointer"
        >
          <Download :size="16" class="sm:w-5 sm:h-5" />
          <span>Descargar Formato</span>
        </button>
        <button 
          v-if="selectedCourse && activeTab === 'history' && historyData.length > 0"
          @click="exportHistoryToCSV"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center gap-2 shadow-md text-xs sm:text-sm cursor-pointer"
        >
          <Download :size="16" class="sm:w-5 sm:h-5" />
          <span>Exportar (CSV)</span>
        </button>
        <!-- Autosave Indicator -->
        <div v-if="selectedCourse && activeTab === 'today' && selectedDate === todayStr && !auth.isMonitoring && isEditable" class="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-850 h-[40px] sm:h-[46px]">
          <div v-if="autosaveStatus === 'saving'" class="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
            <Loader2 class="w-3.5 h-3.5 animate-spin" />
            <span>Guardando...</span>
          </div>
          <div v-else-if="autosaveStatus === 'saved'" class="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            <CheckCircle class="w-3.5 h-3.5" />
            <span>Guardado</span>
          </div>
          <div v-else-if="autosaveStatus === 'error'" class="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest" :title="autosaveErrorMsg">
            <AlertCircle class="w-3.5 h-3.5" />
            <span>Error</span>
          </div>
        </div>

        <!-- Save button hidden in monitoring mode -->
        <button 
          v-if="selectedCourse && activeTab === 'today' && selectedDate === todayStr && !auth.isMonitoring"
          @click="saveAllAttendance(false)"
          :disabled="saving || !isEditable"
          class="bg-emerald-600 dark:bg-emerald-500 text-white px-5 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 dark:hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer"
        >
          <Loader2 v-if="saving" class="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          <Save v-else :size="16" class="sm:w-5 sm:h-5" />
          <span>{{ saving ? 'Guardando...' : 'Guardar Asistencia' }}</span>
        </button>
        <div 
          v-if="auth.isMonitoring && selectedCourse"
          class="flex items-center gap-2 text-amber-600 font-bold text-xs sm:text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl"
        >
          Solo Lectura
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-end gap-4 sm:gap-6 transition-colors">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="space-y-1.5">
          <label class="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Grado</label>
          <select v-model="selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Sección</label>
          <select v-model="selectedSection" :disabled="!selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none disabled:opacity-50 cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="s in sectionOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Jornada</label>
          <select v-model="selectedJornada" :disabled="!selectedSection" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none disabled:opacity-50 cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="j in jornadaOptions" :key="j" :value="j">{{ j }}</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedJornada" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none disabled:opacity-50 cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div v-if="selectedCourse" class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl shrink-0 transition-colors">
        <button 
          @click="activeTab = 'today'"
          :class="[activeTab === 'today' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200', 'px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2']"
        >
          <CalendarCheck :size="18" />
          Hoy
        </button>
        <button 
          @click="activeTab = 'history'"
          :class="[activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200', 'px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2']"
        >
          <History :size="18" />
          Historial
        </button>
      </div>
    </div>

    <!-- Error Alert Banner for Autosave / Validation Errors -->
    <div v-if="autosaveStatus === 'error' && autosaveErrorMsg" class="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-5 rounded-3xl flex items-center justify-between gap-4 text-red-700 dark:text-red-300 shadow-sm animate-in fade-in slide-in-from-top duration-300">
      <div class="flex items-center gap-3.5">
        <div class="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/60 flex items-center justify-center shrink-0">
          <AlertCircle class="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h4 class="text-xs font-black uppercase tracking-wider text-red-800 dark:text-red-200">Error al guardar la asistencia</h4>
          <p class="text-xs font-bold leading-relaxed mt-0.5">{{ autosaveErrorMsg }}</p>
        </div>
      </div>
      <button @click="autosaveStatus = 'saved'; autosaveErrorMsg = ''" class="px-4 py-2 bg-red-100 dark:bg-red-900/60 hover:bg-red-200 text-red-800 dark:text-red-200 rounded-xl text-xs font-bold transition-all shrink-0">
        Entendido
      </button>
    </div>

    <!-- Active date notification (For past days only) -->
    <div v-if="selectedCourse && activeTab === 'today' && selectedDate !== todayStr" class="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-150 dark:border-indigo-900 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
      <div class="flex items-start gap-3">
        <Calendar class="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h4 class="font-black text-indigo-900 dark:text-indigo-200">Historial: Visualizando fecha {{ selectedDate }}</h4>
          <p class="text-sm text-indigo-700 dark:text-indigo-400 mt-0.5">Estás en modo de sólo lectura para esta fecha del pasado.</p>
        </div>
      </div>
      <button 
        @click="resetToToday"
        class="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all self-start sm:self-center flex items-center gap-1.5 shadow-md shadow-indigo-100 dark:shadow-none"
      >
        <ChevronLeft :size="16" />
        Volver a Hoy
      </button>
    </div>

    <!-- Status warnings -->
    <div v-if="selectedCourse && activeTab === 'today' && !isEditable && selectedDate === todayStr" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-3xl p-6 flex items-start gap-4 animate-in slide-in-from-top duration-300">
      <AlertCircle class="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <h4 class="font-black text-amber-900 dark:text-amber-200">Control de asistencia bloqueado</h4>
        <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">{{ lockReason }}</p>
      </div>
    </div>

    <!-- Unselected course prompt -->
    <div v-if="!selectedCourse" class="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-20 text-center transition-colors">
      <div class="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
        <CalendarCheck class="w-10 h-10 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-400 dark:text-slate-500">Selecciona curso y materia para comenzar</h3>
      <p class="text-slate-400 dark:text-slate-500 text-sm mt-2">Una vez seleccionado el contexto, podrás registrar la asistencia escolar.</p>
    </div>

    <!-- Main Container -->
    <div v-else class="space-y-6">
      
      <!-- Content Wrapper -->
      <div class="space-y-6">
        
        <!-- Search bar -->
        <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
          <Search class="text-slate-400 dark:text-slate-500 shrink-0 ml-2" :size="20" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Buscar estudiante por nombre o código..." 
            class="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-sm font-semibold"
          />
        </div>

        <!-- Today Attendance Grid -->
        <div v-if="activeTab === 'today'" class="space-y-6">
          
          <!-- Resumen del día y Herramientas (Horizontal) -->
          <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <!-- Stats Grid -->
            <div class="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/70 dark:border-emerald-900 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                <div>
                  <p class="text-[9px] font-black text-emerald-650 dark:text-emerald-400 uppercase tracking-widest">Presentes</p>
                  <p class="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{{ stats.presente }}</p>
                </div>
                <div class="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-450 flex items-center justify-center">
                  <Check :size="16" />
                </div>
              </div>
              <div class="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/70 dark:border-rose-900 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                <div>
                  <p class="text-[9px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">Ausentes</p>
                  <p class="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{{ stats.ausente }}</p>
                </div>
                <div class="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-450 flex items-center justify-center">
                  <X :size="16" />
                </div>
              </div>
              <div class="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/70 dark:border-amber-900 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                <div>
                  <p class="text-[9px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest">Retrasos</p>
                  <p class="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{{ stats.tarde }}</p>
                </div>
                <div class="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-450 flex items-center justify-center">
                  <Clock :size="16" />
                </div>
              </div>
              <div class="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/70 dark:border-blue-900 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                <div>
                  <p class="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest">Justificadas</p>
                  <p class="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{{ stats.justificada }}</p>
                </div>
                <div class="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-450 flex items-center justify-center">
                  <Minus :size="16" />
                </div>
              </div>
            </div>

            <!-- Tools bar -->
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
              <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-150 dark:border-slate-700 w-full sm:w-auto">
                <Clock :size="13" class="text-indigo-500 shrink-0" />
                <input 
                  v-model="defaultTime" 
                  type="time" 
                  :disabled="!canEditAttendance"
                  class="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-16" 
                />
                <button 
                  @click="setTimeNow"
                  :disabled="!canEditAttendance"
                  class="bg-white dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-650 text-[9px] font-bold whitespace-nowrap transition-all"
                >
                  Actual
                </button>
              </div>
              <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button 
                  @click="applyDefaultTimeToAll"
                  :disabled="!canEditAttendance || students.length === 0"
                  class="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-850 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg font-bold text-[10px] whitespace-nowrap transition-all"
                >
                  Aplicar Hora
                </button>
                <button 
                  @click="markAllPresent"
                  :disabled="!canEditAttendance || students.length === 0"
                  class="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-850 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg font-bold text-[10px] whitespace-nowrap transition-all flex items-center gap-1"
                >
                  <ThumbsUp :size="11" />
                  Todos Pres
                </button>
              </div>
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="loading" class="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
            <Loader2 class="w-10 h-10 text-emerald-600 dark:text-emerald-500 animate-spin mb-4" />
            <p class="text-slate-500 dark:text-slate-400 font-bold text-sm">Cargando listado de estudiantes...</p>
          </div>

          <!-- Empty state -->
          <div v-else-if="filteredStudents.length === 0" class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-20 text-center shadow-sm transition-colors">
            <p class="text-slate-400 dark:text-slate-500 font-bold">No se encontraron estudiantes para la búsqueda.</p>
          </div>

          <!-- Students grid -->
          <div v-else class="space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              <div 
                v-for="student in paginatedStudents" 
                :key="student.id_estudiante" 
                class="group p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg transition-all duration-300 flex flex-col justify-between h-[210px] space-y-2 relative"
              >
                <!-- Avatar & Name -->
                <div class="flex items-center gap-3">
                  <div class="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 shadow-inner flex items-center justify-center font-bold text-sm shrink-0">
                    {{ student.nombre.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <h3 class="font-bold text-slate-800 dark:text-slate-200 text-xs leading-tight truncate" :title="student.nombre">{{ student.nombre }}</h3>
                    <p class="text-[9px] text-slate-400 dark:text-slate-500 font-bold font-mono mt-0.5">{{ student.codigo }}</p>
                  </div>
                </div>

                <!-- Input conditional sections (Time or Justification) -->
                <div class="grow flex flex-col justify-center">
                  <!-- Justification Input when set to JUSTIFICADA -->
                  <div v-if="student.estado === 'JUSTIFICADA'" class="animate-in slide-in-from-top-1 duration-200">
                    <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg p-1.5 border border-slate-200/60 dark:border-slate-700/60">
                      <FileText :size="12" class="text-slate-400 dark:text-slate-500 shrink-0" />
                      <input 
                        v-model="student.justificacion"
                        type="text" 
                        placeholder="Motivo de inasistencia..."
                        :disabled="!canEditAttendance"
                        @blur="saveAllAttendance(true)"
                        class="w-full bg-transparent border-none text-[10px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-350 dark:placeholder-slate-650 truncate"
                      />
                    </div>
                  </div>

                  <!-- Arrival Time Input when set to PRESENTE or TARDE -->
                  <div v-else-if="student.estado === 'PRESENTE' || student.estado === 'TARDE'" class="animate-in slide-in-from-top-1 duration-200">
                    <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg p-1.5 border border-slate-200/60 dark:border-slate-700/60">
                      <Clock :size="12" class="text-slate-400 dark:text-slate-500 shrink-0" />
                      <input 
                        v-model="student.hora_llegada"
                        type="time" 
                        :disabled="!canEditAttendance"
                        @change="saveAllAttendance(true)"
                        @blur="saveAllAttendance(true)"
                        class="w-full bg-transparent border-none text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <!-- Empty state placeholder -->
                  <div v-else class="flex items-center">
                    <span class="text-[9px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-wider">Sin registrar</span>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="grid grid-cols-4 gap-1 pt-1.5 border-t border-slate-50 dark:border-slate-800/40">
                  <button 
                    @click="setStatus(student.id_estudiante, 'PRESENTE')"
                    :disabled="!canEditAttendance"
                    :class="[
                      student.estado === 'PRESENTE' ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-black' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-600 dark:hover:text-emerald-400',
                      'flex flex-col items-center justify-center py-1 rounded-lg transition-all disabled:opacity-50 text-[8px]'
                    ]"
                    title="Presente"
                  >
                    <Check :size="12" />
                    <span class="mt-0.5 scale-90">Pres</span>
                  </button>
                  <button 
                    @click="setStatus(student.id_estudiante, 'AUSENTE')"
                    :disabled="!canEditAttendance"
                    :class="[
                      student.estado === 'AUSENTE' ? 'bg-rose-500 dark:bg-rose-600 text-white font-black' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-500 dark:hover:text-rose-400',
                      'flex flex-col items-center justify-center py-1 rounded-lg transition-all disabled:opacity-50 text-[8px]'
                    ]"
                    title="Ausente"
                  >
                    <X :size="12" />
                    <span class="mt-0.5 scale-90">Aus</span>
                  </button>
                  <button 
                    @click="setStatus(student.id_estudiante, 'TARDE')"
                    :disabled="!canEditAttendance"
                    :class="[
                      student.estado === 'TARDE' ? 'bg-amber-500 dark:bg-amber-600 text-white font-black' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-500 dark:hover:text-amber-400',
                      'flex flex-col items-center justify-center py-1 rounded-lg transition-all disabled:opacity-50 text-[8px]'
                    ]"
                    title="Retraso"
                  >
                    <Clock :size="12" />
                    <span class="mt-0.5 scale-90">Tarde</span>
                  </button>
                  <button 
                    @click="setStatus(student.id_estudiante, 'JUSTIFICADA')"
                    :disabled="!canEditAttendance"
                    :class="[
                      student.estado === 'JUSTIFICADA' ? 'bg-blue-500 dark:bg-blue-600 text-white font-black' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-500 dark:hover:text-blue-400',
                      'flex flex-col items-center justify-center py-1 rounded-lg transition-all disabled:opacity-50 text-[8px]'
                    ]"
                    title="Justificada"
                  >
                    <Minus :size="12" />
                    <span class="mt-0.5 scale-90">Just</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-850">
              <button 
                @click="currentPage = Math.max(1, currentPage - 1)" 
                :disabled="currentPage === 1"
                class="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                Anterior
              </button>
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
                Página {{ currentPage }} de {{ totalPages }}
              </span>
              <button 
                @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                :disabled="currentPage === totalPages"
                class="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>

        <!-- History Attendance Table / Traversal -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          <!-- Student Stats Table -->
          <div class="lg:col-span-3 space-y-4">
            <SkeletonTable v-if="historyLoading" :rows="6" :cols="6" />

            <EmptyState
              v-else-if="filteredHistory.length === 0"
              title="Sin estudiantes"
              description="No se encontraron estudiantes para mostrar en el reporte histórico."
            >
              <template #icon>
                <CalendarCheck class="w-8 h-8 text-emerald-500" />
              </template>
            </EmptyState>

            <DataTable v-else>
              <template #header>
                <tr>
                  <th class="py-4 px-6 min-w-[200px]">Estudiante</th>
                  <th class="py-4 px-4 text-center">Presentes</th>
                  <th class="py-4 px-4 text-center">Ausentes</th>
                  <th class="py-4 px-4 text-center">Tardes</th>
                  <th class="py-4 px-4 text-center">Justificadas</th>
                  <th class="py-4 px-6 text-center">% Asistencia</th>
                </tr>
              </template>
              <tr v-for="student in filteredHistory" :key="student.id_estudiante" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="py-4 px-6">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xs uppercase transition-colors">
                      {{ student.nombre.charAt(0) }}
                    </div>
                    <div>
                      <p class="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none mb-1 transition-colors">{{ student.nombre }}</p>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono">{{ student.codigo }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400 transition-colors">{{ student.presentes }}</td>
                <td class="py-4 px-4 text-center font-bold text-rose-500 dark:text-rose-400 transition-colors">{{ student.ausentes }}</td>
                <td class="py-4 px-4 text-center font-bold text-amber-500 dark:text-amber-400 transition-colors">{{ student.tardes }}</td>
                <td class="py-4 px-4 text-center font-bold text-blue-500 dark:text-blue-400 transition-colors">{{ student.justificadas }}</td>
                <td class="py-4 px-6 text-center transition-colors">
                  <span 
                    :class="[
                      (student.presentes + student.tardes + student.justificadas) / (student.presentes + student.ausentes + student.tardes + student.justificadas || 1) >= 0.8
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900',
                      'px-3.5 py-1.5 rounded-2xl text-xs font-black border transition-colors inline-block'
                    ]"
                  >
                    {{ 
                      student.presentes + student.ausentes + student.tardes + student.justificadas > 0
                        ? Math.round(((student.presentes + student.tardes + student.justificadas) / (student.presentes + student.ausentes + student.tardes + student.justificadas)) * 100)
                        : 100 
                    }}%
                  </span>
                </td>
              </tr>
            </DataTable>
          </div>

          <!-- History Traversal side column -->
          <div class="lg:col-span-1 space-y-4 sm:space-y-6">
            <div class="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3 sm:space-y-4 transition-colors">
              <h3 class="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar :size="18" class="text-emerald-600 dark:text-emerald-500" />
                <span>Historial de Fechas</span>
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                Selecciona una de las siguientes fechas registradas para ver su control de asistencia detallado (sólo lectura).
              </p>
              
              <div v-if="recordedDates.length === 0" class="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl transition-colors">
                Ninguna fecha registrada
              </div>
              
              <div v-else class="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                <button 
                  v-for="date in recordedDates" 
                  :key="date"
                  @click="viewDate(date)"
                  class="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:border-emerald-200 dark:hover:border-emerald-800 text-left text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
                >
                  <span>{{ date }}</span>
                  <span class="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md transition-colors">Ver →</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #1e293b;
}
</style>
