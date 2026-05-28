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
  CheckCircle2, 
  Users, 
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
const selectedGradeId = ref<number | null>(route.query.gradoId ? Number(route.query.gradoId) : null)
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
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/courses/${auth.user?.id}`)
    myCourses.value = response.data
    if (selectedGradeId.value) {
      const course = myCourses.value.find(c => c.id_grado === selectedGradeId.value)
      if (course) selectedSubjectId.value = course.id_materia
    }
  } catch (error) {
    console.error('Error fetching courses:', error)
  }
}

// Find id_detallegrado
const selectedCourse = computed(() => {
  return myCourses.value.find(c => c.id_grado === selectedGradeId.value && c.id_materia === selectedSubjectId.value)
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
watch([selectedGradeId, selectedSubjectId], () => {
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
const coursesOptions = computed(() => {
  const uniqueGrades: {id: number, label: string}[] = []
  const seen = new Set()
  myCourses.value.forEach(c => {
    if (!seen.has(c.id_grado)) {
      seen.add(c.id_grado)
      uniqueGrades.push({ id: c.id_grado, label: `${c.grado_nombre} ${c.seccion}` })
    }
  })
  return uniqueGrades
})

const subjectsOptions = computed(() => {
  return myCourses.value
    .filter(c => c.id_grado === selectedGradeId.value)
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
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">Asistencia de Grados</h1>
        <p class="text-slate-500 text-lg">Registra, modifica y visualiza la asistencia diaria de tus cursos asignados.</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button 
          v-if="selectedCourse"
          @click="printAttendanceSheet"
          class="bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200/60"
        >
          <Download :size="20" />
          Descargar Formato
        </button>
        <button 
          v-if="selectedCourse && activeTab === 'today' && selectedDate === todayStr"
          @click="saveAllAttendance"
          :disabled="saving || !isEditable"
          class="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2 v-if="saving" class="w-5 h-5 animate-spin" />
          <Save :size="20" />
          {{ saving ? 'Guardando...' : 'Guardar Asistencia' }}
        </button>
      </div>
    </div>

    <!-- Filter Panel (Without date selector on Today tab) -->
    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-end gap-6">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Grado / Curso</label>
          <select v-model="selectedGradeId" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 transition-all outline-none">
            <option :value="null">Seleccionar Grado</option>
            <option v-for="g in coursesOptions" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedGradeId" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 transition-all outline-none disabled:opacity-50">
            <option :value="null">Seleccionar Materia</option>
            <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div v-if="selectedCourse" class="flex p-1 bg-slate-100 rounded-2xl shrink-0">
        <button 
          @click="activeTab = 'today'"
          :class="[activeTab === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900', 'px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2']"
        >
          <CalendarCheck :size="18" />
          Hoy
        </button>
        <button 
          @click="activeTab = 'history'"
          :class="[activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900', 'px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2']"
        >
          <History :size="18" />
          Historial
        </button>
      </div>
    </div>

    <!-- Active date notification (For past days only) -->
    <div v-if="selectedCourse && activeTab === 'today' && selectedDate !== todayStr" class="bg-indigo-50 border border-indigo-150 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
      <div class="flex items-start gap-3">
        <Calendar class="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h4 class="font-black text-indigo-900">Historial: Visualizando fecha {{ selectedDate }}</h4>
          <p class="text-sm text-indigo-700 mt-0.5">Estás en modo de sólo lectura para esta fecha del pasado.</p>
        </div>
      </div>
      <button 
        @click="resetToToday"
        class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all self-start sm:self-center flex items-center gap-1.5"
      >
        <ChevronLeft :size="16" />
        Volver a Hoy
      </button>
    </div>

    <!-- Status warnings -->
    <div v-if="selectedCourse && activeTab === 'today' && !isEditable && selectedDate === todayStr" class="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex items-start gap-4 animate-in slide-in-from-top duration-300">
      <AlertCircle class="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <h4 class="font-black text-amber-900">Control de asistencia bloqueado</h4>
        <p class="text-sm text-amber-700 mt-1">{{ lockReason }}</p>
      </div>
    </div>

    <!-- Unselected course prompt -->
    <div v-if="!selectedCourse" class="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
      <div class="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
        <CalendarCheck class="w-10 h-10 text-slate-300" />
      </div>
      <h3 class="text-xl font-bold text-slate-400">Selecciona curso y materia para comenzar</h3>
      <p class="text-slate-400 text-sm mt-2">Una vez seleccionado el contexto, podrás registrar la asistencia escolar.</p>
    </div>

    <!-- Main Container -->
    <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">
      
      <!-- Left sidebar: Status counts and quick options (Today tab only) -->
      <div v-if="activeTab === 'today'" class="xl:col-span-1 space-y-6">
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
            Resumen del día
          </h3>

          <div class="grid grid-cols-2 gap-4">
            <div class="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Presentes</p>
              <p class="text-3xl font-black text-emerald-700 mt-1">{{ stats.presente }}</p>
            </div>
            <div class="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Ausentes</p>
              <p class="text-3xl font-black text-rose-700 mt-1">{{ stats.ausente }}</p>
            </div>
            <div class="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Retrasos</p>
              <p class="text-3xl font-black text-amber-700 mt-1">{{ stats.tarde }}</p>
            </div>
            <div class="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-center">
              <p class="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Justificadas</p>
              <p class="text-3xl font-black text-blue-700 mt-1">{{ stats.justificada }}</p>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 space-y-3">
            <div class="flex justify-between items-center text-xs font-semibold text-slate-500">
              <span>Sin registrar</span>
              <span class="font-bold text-slate-700">{{ stats.sin_registro }}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2">
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
          class="w-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ThumbsUp :size="18" />
          Marcar todos como Presente
        </button>
      </div>

      <!-- Right content: Students grid (Today tab) or Table (History tab) -->
      <div :class="[activeTab === 'today' ? 'xl:col-span-3' : 'xl:col-span-4']" class="space-y-6">
        
        <!-- Search bar -->
        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <Search class="text-slate-400 shrink-0 ml-2" :size="20" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Buscar estudiante por nombre o código..." 
            class="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
          />
        </div>

        <!-- Today Attendance Grid -->
        <div v-if="activeTab === 'today'">
          <div v-if="loading" class="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Loader2 class="w-10 h-10 text-emerald-600 animate-spin mb-4" />
            <p class="text-slate-500 font-bold text-sm">Cargando listado de estudiantes...</p>
          </div>

          <div v-else-if="filteredStudents.length === 0" class="bg-white rounded-3xl border border-slate-100 p-20 text-center shadow-sm">
            <p class="text-slate-400 font-bold">No se encontraron estudiantes para la búsqueda.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div 
              v-for="student in filteredStudents" 
              :key="student.id_estudiante" 
              class="group p-6 rounded-3xl border border-slate-100 bg-white hover:shadow-xl hover:shadow-emerald-50/50 transition-all duration-300 flex flex-col justify-between space-y-4"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-4">
                  <div class="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-700 shadow-inner flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                    {{ student.nombre.charAt(0) }}
                  </div>
                  <div>
                    <h3 class="font-black text-slate-800 text-md leading-tight">{{ student.nombre }}</h3>
                    <p class="text-[10px] text-slate-400 font-bold font-mono mt-1">{{ student.codigo }}</p>
                  </div>
                </div>
              </div>

              <!-- Justification Input when set to JUSTIFICADA -->
              <div v-if="student.estado === 'JUSTIFICADA'" class="animate-in slide-in-from-top-2 duration-300">
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Motivo de Justificación</label>
                <div class="flex items-center gap-2 bg-slate-50 rounded-xl p-2 border border-slate-200/60">
                  <FileText :size="16" class="text-slate-400 shrink-0" />
                  <input 
                    v-model="student.justificacion"
                    type="text" 
                    placeholder="Ej. Incapacidad médica, cita..."
                    :disabled="!isEditable"
                    class="w-full bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none placeholder-slate-350"
                  />
                </div>
              </div>

              <!-- Button actions -->
              <div class="grid grid-cols-4 gap-2">
                <button 
                  @click="setStatus(student.id_estudiante, 'PRESENTE')"
                  :disabled="!isEditable"
                  :class="[
                    student.estado === 'PRESENTE' ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600',
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
                    student.estado === 'AUSENTE' ? 'bg-rose-500 text-white ring-4 ring-rose-100' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500',
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
                    student.estado === 'TARDE' ? 'bg-amber-500 text-white ring-4 ring-amber-100' : 'bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-500',
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
                    student.estado === 'JUSTIFICADA' ? 'bg-blue-500 text-white ring-4 ring-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-500',
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
          <div class="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div v-if="historyLoading" class="flex flex-col items-center justify-center p-20">
              <Loader2 class="w-10 h-10 text-emerald-600 animate-spin mb-4" />
              <p class="text-slate-500 font-bold text-sm">Cargando reporte histórico...</p>
            </div>

            <div v-else-if="filteredHistory.length === 0" class="p-20 text-center">
              <p class="text-slate-400 font-bold">No se encontraron estudiantes para mostrar historial.</p>
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-slate-50/50 border-b border-slate-100">
                    <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Estudiante</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Presentes</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ausentes</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tardes</th>
                    <th class="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Justificadas</th>
                    <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">% Asistencia</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                  <tr v-for="student in filteredHistory" :key="student.id_estudiante" class="hover:bg-slate-50/50 transition-colors">
                    <td class="px-8 py-5">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                          {{ student.nombre.charAt(0) }}
                        </div>
                        <div>
                          <p class="text-sm font-bold text-slate-700 leading-none mb-1">{{ student.nombre }}</p>
                          <p class="text-[10px] text-slate-400 font-bold font-mono">{{ student.codigo }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-5 text-center font-bold text-emerald-600">{{ student.presentes }}</td>
                    <td class="px-4 py-5 text-center font-bold text-rose-500">{{ student.ausentes }}</td>
                    <td class="px-4 py-5 text-center font-bold text-amber-500">{{ student.tardes }}</td>
                    <td class="px-4 py-5 text-center font-bold text-blue-500">{{ student.justificadas }}</td>
                    <td class="px-8 py-5 text-center">
                      <span 
                        :class="[
                          (student.presentes + student.tardes + student.justificadas) / (student.presentes + student.ausentes + student.tardes + student.justificadas || 1) >= 0.8
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600',
                          'px-4 py-2 rounded-2xl text-xs font-black'
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
            <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar :size="18" class="text-emerald-600" />
                Historial de Fechas
              </h3>
              <p class="text-xs text-slate-500 leading-relaxed">
                Selecciona una de las siguientes fechas registradas para ver su control de asistencia detallado (sólo lectura).
              </p>
              
              <div v-if="recordedDates.length === 0" class="text-center py-8 text-slate-400 text-xs font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                Ninguna fecha registrada
              </div>
              
              <div v-else class="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                <button 
                  v-for="date in recordedDates" 
                  :key="date"
                  @click="viewDate(date)"
                  class="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-emerald-50 hover:border-emerald-200 text-left text-xs font-bold text-slate-700 transition-all"
                >
                  <span>{{ date }}</span>
                  <span class="text-[9px] uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Ver →</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>
