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
  Loader2, 
  History,
  Clock,
  ThumbsUp,
  FileText,
  Calendar,
  ChevronLeft
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'

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

// Local timezone safe today date format (YYYY-MM-DD)
const todayStr = computed(() => new Date().toLocaleDateString('en-CA'))

// Selectors
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
  const teacherId = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/courses/${teacherId}`)
    myCourses.value = response.data
    
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
    console.error('Error fetching courses:', error)
  }
}

// Find id_detallegrado
const selectedCourse = computed(() => {
  return myCourses.value.find(c => 
    c.grado_nombre === selectedGradeName.value && 
    c.seccion === selectedSection.value && 
    c.jornada_nombre === selectedJornada.value &&
    c.id_materia === selectedSubjectId.value
  )
})

// Load attendance for selected date
const fetchAttendance = async () => {
  if (!selectedCourse.value) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/teacher/attendance/${selectedCourse.value.id_detallegrado}/${selectedDate.value}`)
    students.value = response.data.students
    isEditable.value = response.data.editable
    lockReason.value = response.data.error || ''
  } catch (error: any) {
    console.error('Error fetching attendance:', error)
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
    const response = await axios.get(`http://localhost:3000/api/teacher/attendance-history/${selectedCourse.value.id_detallegrado}`)
    historyData.value = response.data.studentsHistory || []
    recordedDates.value = response.data.recordedDates || []
  } catch (error) {
    console.error('Error fetching history:', error)
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

const filteredHistory = computed(() => {
  if (!searchQuery.value.trim()) return historyData.value
  const query = searchQuery.value.toLowerCase()
  return historyData.value.filter(s => s.nombre.toLowerCase().includes(query) || s.codigo.toLowerCase().includes(query))
})

// Quick status toggling
const setStatus = (studentId: number, status: 'PRESENTE' | 'AUSENTE' | 'TARDE' | 'JUSTIFICADA') => {
  if (!isEditable.value) return
  const student = students.value.find(s => s.id_estudiante === studentId)
  if (student) {
    if (student.estado === status) {
      student.estado = null
      student.justificacion = null
    } else {
      student.estado = status
      if (status !== 'JUSTIFICADA') {
        student.justificacion = null
      }
    }
  }
}

// Mark all as present
const markAllPresent = () => {
  if (!isEditable.value) return
  students.value.forEach(s => {
    s.estado = 'PRESENTE'
    s.justificacion = null
  })
}

// Save all
const saveAllAttendance = async () => {
  if (!selectedCourse.value || saving.value || !isEditable.value) return
  try {
    saving.value = true
    const recordsToSave = students.value.map(s => ({
      id_estudiante: s.id_estudiante,
      estado: s.estado,
      justificacion: s.justificacion
    }))

    await axios.post('http://localhost:3000/api/teacher/attendance', {
      detailGradeId: selectedCourse.value.id_detallegrado,
      date: selectedDate.value,
      records: recordsToSave
    })
    alert('Asistencia guardada exitosamente')
    await fetchAttendance()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar asistencia')
  } finally {
    saving.value = false
  }
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
        <title>Formato de Asistencia - ${courseInfo.grado_nombre} ${courseInfo.seccion}</title>
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
          <p class="meta"><strong>Grado:</strong> ${courseInfo.grado_nombre} ${courseInfo.seccion} | <strong>Materia:</strong> ${courseInfo.materia_nombre}</p>
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

onMounted(() => {
  fetchMyCourses()
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-700">
    <!-- Header with Actions -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Asistencia de Grados</h1>
        <p class="text-slate-500 dark:text-slate-400 text-lg transition-colors">Registra, modifica y visualiza la asistencia diaria de tus cursos asignados.</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button 
          v-if="selectedCourse"
          @click="printAttendanceSheet"
          class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-200/60 dark:border-slate-700/60 shadow-sm"
        >
          <Download :size="20" />
          Descargar Formato
        </button>
        <!-- Save button hidden in monitoring mode -->
        <button 
          v-if="selectedCourse && activeTab === 'today' && selectedDate === todayStr && !auth.isMonitoring"
          @click="saveAllAttendance"
          :disabled="saving || !isEditable"
          class="bg-emerald-600 dark:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 dark:hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2 v-if="saving" class="w-5 h-5 animate-spin" />
          <Save v-else :size="20" />
          {{ saving ? 'Guardando...' : 'Guardar Asistencia' }}
        </button>
        <div 
          v-if="auth.isMonitoring && selectedCourse"
          class="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-5 py-3 rounded-2xl"
        >
          Solo Lectura
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-end gap-6 transition-colors">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Grado</label>
          <select v-model="selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none">
            <option :value="null">Selecciona</option>
            <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Sección</label>
          <select v-model="selectedSection" :disabled="!selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="s in sectionOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Jornada</label>
          <select v-model="selectedJornada" :disabled="!selectedSection" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="j in jornadaOptions" :key="j" :value="j">{{ j }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedJornada" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all outline-none disabled:opacity-50">
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
    <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">
      
      <!-- Left sidebar: Status counts and quick options (Today tab only) -->
      <div v-if="activeTab === 'today'" class="xl:col-span-1 space-y-6">
        <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
          <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            Resumen del día
          </h3>

          <div class="grid grid-cols-2 gap-4">
            <div class="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Presentes</p>
              <p class="text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{{ stats.presente }}</p>
            </div>
            <div class="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Ausentes</p>
              <p class="text-3xl font-black text-rose-700 dark:text-rose-300 mt-1">{{ stats.ausente }}</p>
            </div>
            <div class="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Retrasos</p>
              <p class="text-3xl font-black text-amber-700 dark:text-amber-300 mt-1">{{ stats.tarde }}</p>
            </div>
            <div class="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider">Justificadas</p>
              <p class="text-3xl font-black text-blue-700 dark:text-blue-300 mt-1">{{ stats.justificada }}</p>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div class="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Sin registrar</span>
              <span class="font-bold text-slate-700 dark:text-slate-200">{{ stats.sin_registro }}</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
              <div 
                class="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                :style="{ width: `${students.length ? ((students.length - stats.sin_registro) / students.length) * 100 : 0}%` }"
              ></div>
            </div>
          </div>
        </div>

        <button 
          @click="markAllPresent"
          :disabled="!isEditable || students.length === 0"
          class="w-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <ThumbsUp :size="18" />
          Marcar todos como Presente
        </button>
      </div>

      <!-- Right content: Students grid (Today tab) or Table (History tab) -->
      <div :class="[activeTab === 'today' ? 'xl:col-span-3' : 'xl:col-span-4']" class="space-y-6">
        
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
        <div v-if="activeTab === 'today'">
          <div v-if="loading" class="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
            <Loader2 class="w-10 h-10 text-emerald-600 dark:text-emerald-500 animate-spin mb-4" />
            <p class="text-slate-500 dark:text-slate-400 font-bold text-sm">Cargando listado de estudiantes...</p>
          </div>

          <div v-else-if="filteredStudents.length === 0" class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-20 text-center shadow-sm transition-colors">
            <p class="text-slate-400 dark:text-slate-500 font-bold">No se encontraron estudiantes para la búsqueda.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div 
              v-for="student in filteredStudents" 
              :key="student.id_estudiante" 
              class="group p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-xl hover:shadow-emerald-50/50 dark:hover:shadow-none transition-all duration-300 flex flex-col justify-between space-y-4"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-4">
                  <div class="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 shadow-inner flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                    {{ student.nombre.charAt(0) }}
                  </div>
                  <div>
                    <h3 class="font-black text-slate-800 dark:text-slate-200 text-md leading-tight">{{ student.nombre }}</h3>
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono mt-1">{{ student.codigo }}</p>
                  </div>
                </div>
              </div>

              <!-- Justification Input when set to JUSTIFICADA -->
              <div v-if="student.estado === 'JUSTIFICADA'" class="animate-in slide-in-from-top-2 duration-300">
                <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Motivo de Justificación</label>
                <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl p-2 border border-slate-200/60 dark:border-slate-700/60">
                  <FileText :size="16" class="text-slate-400 dark:text-slate-500 shrink-0" />
                  <input 
                    v-model="student.justificacion"
                    type="text" 
                    placeholder="Ej. Incapacidad médica, cita..."
                    :disabled="!isEditable"
                    class="w-full bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-350 dark:placeholder-slate-600"
                  />
                </div>
              </div>

              <!-- Button actions -->
              <div class="grid grid-cols-4 gap-2">
                <button 
                  @click="setStatus(student.id_estudiante, 'PRESENTE')"
                  :disabled="!isEditable"
                  :class="[
                    student.estado === 'PRESENTE' ? 'bg-emerald-600 dark:bg-emerald-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:text-emerald-600 dark:hover:text-emerald-400',
                    'flex flex-col items-center justify-center p-3 rounded-2xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                  ]"
                  title="Presente"
                >
                  <Check :size="18" />
                  <span class="text-[9px] mt-1">Pres</span>
                </button>
                <button 
                  @click="setStatus(student.id_estudiante, 'AUSENTE')"
                  :disabled="!isEditable"
                  :class="[
                    student.estado === 'AUSENTE' ? 'bg-rose-500 dark:bg-rose-600 text-white ring-4 ring-rose-100 dark:ring-rose-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-500 dark:hover:text-rose-400',
                    'flex flex-col items-center justify-center p-3 rounded-2xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                  ]"
                  title="Ausente"
                >
                  <X :size="18" />
                  <span class="text-[9px] mt-1">Aus</span>
                </button>
                <button 
                  @click="setStatus(student.id_estudiante, 'TARDE')"
                  :disabled="!isEditable"
                  :class="[
                    student.estado === 'TARDE' ? 'bg-amber-500 dark:bg-amber-600 text-white ring-4 ring-amber-100 dark:ring-amber-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-amber-50 dark:hover:bg-amber-900/40 hover:text-amber-500 dark:hover:text-amber-400',
                    'flex flex-col items-center justify-center p-3 rounded-2xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                  ]"
                  title="Retraso"
                >
                  <Clock :size="18" />
                  <span class="text-[9px] mt-1">Tarde</span>
                </button>
                <button 
                  @click="setStatus(student.id_estudiante, 'JUSTIFICADA')"
                  :disabled="!isEditable"
                  :class="[
                    student.estado === 'JUSTIFICADA' ? 'bg-blue-500 dark:bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-500 dark:hover:text-blue-400',
                    'flex flex-col items-center justify-center p-3 rounded-2xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                  ]"
                  title="Justificada"
                >
                  <Minus :size="18" />
                  <span class="text-[9px] mt-1">Just</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- History Attendance Table / Traversal -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          <!-- Student Stats Table -->
          <div class="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            <div v-if="historyLoading" class="flex flex-col items-center justify-center p-20">
              <Loader2 class="w-10 h-10 text-emerald-600 dark:text-emerald-500 animate-spin mb-4" />
              <p class="text-slate-500 dark:text-slate-400 font-bold text-sm">Cargando reporte histórico...</p>
            </div>

            <div v-else-if="filteredHistory.length === 0" class="p-20 text-center">
              <p class="text-slate-400 dark:text-slate-500 font-bold">No se encontraron estudiantes para mostrar historial.</p>
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th class="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[200px]">Estudiante</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center border-l border-slate-100 dark:border-slate-800">Presentes</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center border-l border-slate-100 dark:border-slate-800">Ausentes</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center border-l border-slate-100 dark:border-slate-800">Tardes</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center border-l border-slate-100 dark:border-slate-800">Justificadas</th>
                    <th class="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center border-l border-slate-100 dark:border-slate-800">% Asistencia</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50 dark:divide-slate-800">
                  <tr v-for="student in filteredHistory" :key="student.id_estudiante" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="px-8 py-5">
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
                    <td class="px-4 py-5 text-center font-bold text-emerald-600 dark:text-emerald-400 border-l border-slate-50 dark:border-slate-800 transition-colors">{{ student.presentes }}</td>
                    <td class="px-4 py-5 text-center font-bold text-rose-500 dark:text-rose-400 border-l border-slate-50 dark:border-slate-800 transition-colors">{{ student.ausentes }}</td>
                    <td class="px-4 py-5 text-center font-bold text-amber-500 dark:text-amber-400 border-l border-slate-50 dark:border-slate-800 transition-colors">{{ student.tardes }}</td>
                    <td class="px-4 py-5 text-center font-bold text-blue-500 dark:text-blue-400 border-l border-slate-50 dark:border-slate-800 transition-colors">{{ student.justificadas }}</td>
                    <td class="px-8 py-5 text-center border-l border-slate-50 dark:border-slate-800 transition-colors">
                      <span 
                        :class="[
                          (student.presentes + student.tardes + student.justificadas) / (student.presentes + student.ausentes + student.tardes + student.justificadas || 1) >= 0.8
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900',
                          'px-4 py-2 rounded-2xl text-xs font-black border transition-colors'
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
                </tbody>
              </table>
            </div>
          </div>

          <!-- History Traversal side column -->
          <div class="lg:col-span-1 space-y-6">
            <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
              <h3 class="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar :size="18" class="text-emerald-600 dark:text-emerald-500" />
                Historial de Fechas
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
