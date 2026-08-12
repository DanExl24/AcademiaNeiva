<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Eye,
  Search,
  Award,
  ShieldAlert,
  Lightbulb,
  Loader2,
  AlertCircle,
  Save,
  Trash2,
  Pencil,
  MessageSquare,
  Users,
  CheckCircle2,
  ChevronRight
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
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

interface Period {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO'
  porcentaje: number
  id_anio: number
  mes_inicio?: number | null
  dia_inicio?: number | null
  mes_fin?: number | null
  dia_fin?: number | null
}

interface Student {
  id_estudiante: number
  nombre: string
  apellido: string
  codigo: string
}

interface Observation {
  id_observacion: number
  id_estudiante: number
  nombre: string
  documento: string
  codigo: string
  fortalezas: string | null
  debilidades: string | null
  recomendaciones: string | null
  fecha: string
  tipo: string
}

const route = useRoute()
const auth = useAuthStore()
const yearStore = useAcademicYearStore()

// Selectors
const selectedGradeName = ref<string | null>(null)
const selectedSection = ref<string | null>(null)
const selectedJornada = ref<string | null>(null)
const selectedSubjectId = ref<number | null>(null)
const selectedPeriodId = ref<number | null>(null)

// Data
const myCourses = ref<Course[]>([])
const periods = ref<Period[]>([])
const observations = ref<Observation[]>([])
const students = ref<Student[]>([])
const isEditable = ref(true)
const lockReason = ref('')
const loading = ref(false)
const saving = ref(false)

// Active Student Focus
const activeStudentId = ref<number | null>(null)
const editingObservation = ref<Observation | null>(null)

// Search and Roster Filter
const studentSearchQuery = ref('')
const rosterFilter = ref<'all' | 'pending' | 'completed'>('all')

// Database Observation Types
const dbObservationTypes = ref<string[]>([])
const selectedObservationTypeFilter = ref<string>('all')

const fetchObservationTypes = async () => {
  try {
    const response = await axios.get('/api/teacher/observations/types')
    dbObservationTypes.value = response.data.types || []
  } catch (error) {
    console.error('Error fetching observation types:', error)
  }
}

const formatObservationTypeLabel = (tipo: string) => {
  switch (tipo) {
    case 'ACADEMICA': return 'Académico'
    case 'CONVIVENCIAL':
    case 'CONVIVENCIA': return 'Convivencial'
    case 'DISCIPLINARIO':
    case 'DISCIPLINARIA': return 'Disciplinario'
    case 'OTRO': return 'Otro'
    default: return tipo
  }
}

// Form Data
const formData = ref({
  fortalezas: '',
  debilidades: '',
  recomendaciones: '',
  fecha: new Date().toLocaleDateString('en-CA'),
  tipo: 'ACADEMICA' as string
})

// Confirm delete
const confirmDeleteId = ref<number | null>(null)

// Load my courses
const fetchMyCourses = async () => {
  const teacherId = auth.isMonitoring ? auth.monitoringUser?.id : (auth.user?.id_usuario || auth.user?.id)
  if (!teacherId) return
  try {
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const response = await axios.get(`/api/teacher/courses/${teacherId}`, { params })
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
  }
}

// Load periods
const fetchPeriods = async () => {
  const schoolId = auth.user?.schoolId || (auth.user as any)?.id_colegio
  if (!schoolId) return
  try {
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const response = await axios.get(`/api/teacher/periods/${schoolId}`, { params })
    periods.value = (response.data || []).filter((p: any) => p.estado !== 'PENDIENTE')
    const openPeriod = periods.value.find(p => p.estado === 'ABIERTO')
    if (openPeriod) {
      selectedPeriodId.value = openPeriod.id_periodo
    } else if (periods.value.length > 0) {
      selectedPeriodId.value = periods.value[0].id_periodo
    } else {
      selectedPeriodId.value = null
    }
  } catch (error) {
  }
}

// Computed: current course
const selectedCourse = computed(() => {
  return myCourses.value.find(c => 
    c.grado_nombre === selectedGradeName.value && 
    c.seccion === selectedSection.value && 
    c.jornada_nombre === selectedJornada.value &&
    c.id_materia === selectedSubjectId.value
  )
})

const selectedGradeId = computed(() => {
  const course = myCourses.value.find(c =>
    c.grado_nombre === selectedGradeName.value &&
    c.seccion === selectedSection.value &&
    c.jornada_nombre === selectedJornada.value
  )
  return course ? course.id_grado : null
})

// Load students
const fetchStudents = async () => {
  if (!selectedGradeId.value) return
  try {
    const response = await axios.get(`/api/teacher/students/${selectedGradeId.value}`)
    students.value = response.data || []
    if (students.value.length > 0 && !activeStudentId.value) {
      selectStudent(students.value[0].id_estudiante)
    }
  } catch (error: any) {
    students.value = []
  }
}

// Load observations
const fetchObservations = async () => {
  if (!selectedCourse.value || !selectedPeriodId.value) return
  try {
    loading.value = true
    const response = await axios.get(
      `/api/teacher/observations/${selectedCourse.value.id_detallegrado}/${selectedPeriodId.value}`
    )
    observations.value = response.data.observations || []
    isEditable.value = response.data.editable
    lockReason.value = response.data.error || ''
  } catch (error: any) {
    observations.value = []
    isEditable.value = false
    lockReason.value = 'Error al cargar las observaciones del servidor.'
  } finally {
    loading.value = false
  }
}

// Dropdown options
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

// Map of observations per student
const studentStatusMap = computed(() => {
  const map: Record<number, { hasObservation: boolean; count: number; observations: Observation[] }> = {}
  students.value.forEach(s => {
    const studentObs = observations.value.filter(o => o.id_estudiante === s.id_estudiante)
    map[s.id_estudiante] = {
      hasObservation: studentObs.length > 0,
      count: studentObs.length,
      observations: studentObs
    }
  })
  return map
})

// Filtered student roster
const filteredStudents = computed(() => {
  let list = students.value

  if (studentSearchQuery.value.trim()) {
    const q = studentSearchQuery.value.toLowerCase()
    list = list.filter(s => 
      `${s.nombre} ${s.apellido}`.toLowerCase().includes(q) ||
      (s.codigo && s.codigo.toLowerCase().includes(q))
    )
  }

  if (rosterFilter.value === 'completed') {
    list = list.filter(s => studentStatusMap.value[s.id_estudiante]?.hasObservation)
  } else if (rosterFilter.value === 'pending') {
    list = list.filter(s => !studentStatusMap.value[s.id_estudiante]?.hasObservation)
  }

  return list
})

// Focused active student object
const activeStudent = computed(() => {
  return students.value.find(s => s.id_estudiante === activeStudentId.value) || null
})

// Observations for focused active student
const activeStudentObservations = computed(() => {
  if (!activeStudentId.value) return []
  let list = observations.value.filter(o => o.id_estudiante === activeStudentId.value)
  if (selectedObservationTypeFilter.value !== 'all') {
    const typeFilter = selectedObservationTypeFilter.value
    list = list.filter(o => {
      if (typeFilter === 'ACADEMICA') return o.tipo === 'ACADEMICA'
      if (typeFilter === 'DISCIPLINARIA') return o.tipo === 'DISCIPLINARIO' || o.tipo === 'DISCIPLINARIA'
      if (typeFilter === 'CONVIVENCIA') return o.tipo === 'CONVIVENCIAL' || o.tipo === 'CONVIVENCIA'
      if (typeFilter === 'OTRO') return o.tipo === 'OTRO'
      return o.tipo === typeFilter
    })
  }
  return list
})

// Stats summary
const rosterStats = computed(() => {
  const total = students.value.length
  let completed = 0
  students.value.forEach(s => {
    if (studentStatusMap.value[s.id_estudiante]?.hasObservation) completed++
  })
  return {
    total,
    completed,
    pending: total - completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  }
})

// Allowed date range
const allowedDateRange = computed(() => {
  if (!selectedPeriodId.value || periods.value.length === 0) return { min: '', max: '' }
  const period = periods.value.find(p => p.id_periodo === selectedPeriodId.value)
  if (!period || !period.mes_inicio || !period.dia_inicio || !period.mes_fin || !period.dia_fin) {
    return { min: '', max: '' }
  }

  let year = period.id_anio ? Number(period.id_anio) : new Date().getFullYear()
  if (year < 2000) year = new Date().getFullYear()
  const pad = (num: number) => String(num).padStart(2, '0')

  const minStr = `${year}-${pad(period.mes_inicio)}-${pad(period.dia_inicio)}`
  let endYear = year
  if (period.mes_fin < period.mes_inicio) endYear = year + 1
  const maxStr = `${endYear}-${pad(period.mes_fin)}-${pad(period.dia_fin)}`

  return { min: minStr, max: maxStr }
})

// Format date for display
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  if (dateStr.length === 10) {
    const [year, month, day] = dateStr.split('-')
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${day} ${months[Number(month) - 1]}. ${year}`
  }
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Select student
const selectStudent = (studentId: number) => {
  activeStudentId.value = studentId
  editingObservation.value = null
  resetForm()
}

// Reset Form
const resetForm = () => {
  let defaultDate = new Date().toLocaleDateString('en-CA')
  const { min, max } = allowedDateRange.value
  if (min && defaultDate < min) defaultDate = min
  else if (max && defaultDate > max) defaultDate = max

  formData.value = {
    fortalezas: '',
    debilidades: '',
    recomendaciones: '',
    fecha: defaultDate,
    tipo: 'ACADEMICA'
  }
}

// Edit existing observation inline
const startEditObservation = (obs: Observation) => {
  editingObservation.value = obs
  formData.value = {
    fortalezas: obs.fortalezas || '',
    debilidades: obs.debilidades || '',
    recomendaciones: obs.recomendaciones || '',
    fecha: new Date(obs.fecha).toLocaleDateString('en-CA'),
    tipo: obs.tipo || 'ACADEMICA'
  }
}

// Cancel editing
const cancelEdit = () => {
  editingObservation.value = null
  resetForm()
}

// Form validation
const formValid = computed(() => {
  const hasContent =
    formData.value.fortalezas.trim().length > 0 ||
    formData.value.debilidades.trim().length > 0 ||
    formData.value.recomendaciones.trim().length > 0
  return !!activeStudentId.value && hasContent
})

// Save Observation & Auto-Advance to next pending student
const saveObservationAndAdvance = async () => {
  if (!formValid.value || saving.value || !activeStudentId.value) return

  try {
    saving.value = true
    const payload = editingObservation.value
      ? {
          fortalezas: formData.value.fortalezas,
          debilidades: formData.value.debilidades,
          recomendaciones: formData.value.recomendaciones,
          tipo: formData.value.tipo
        }
      : {
          detailGradeId: selectedCourse.value!.id_detallegrado,
          periodId: selectedPeriodId.value,
          studentId: activeStudentId.value,
          fortalezas: formData.value.fortalezas,
          debilidades: formData.value.debilidades,
          recomendaciones: formData.value.recomendaciones,
          fecha: `${formData.value.fecha}T12:00:00Z`,
          tipo: formData.value.tipo
        }

    if (editingObservation.value) {
      await axios.put(`/api/teacher/observations/${editingObservation.value.id_observacion}`, payload)
    } else {
      await axios.post('/api/teacher/observations', payload)
    }

    const savedStudentId = activeStudentId.value
    await fetchObservations()

    // Auto Advance Logic: Find next student without observation or simply next student in roster
    const currentIndex = students.value.findIndex(s => s.id_estudiante === savedStudentId)
    if (currentIndex !== -1) {
      // Look for next pending student first
      let nextStudent = students.value.slice(currentIndex + 1).find(s => !studentStatusMap.value[s.id_estudiante]?.hasObservation)
      // If no pending student ahead, pick the immediate next student in array
      if (!nextStudent && currentIndex < students.value.length - 1) {
        nextStudent = students.value[currentIndex + 1]
      }
      
      if (nextStudent) {
        selectStudent(nextStudent.id_estudiante)
      } else {
        editingObservation.value = null
        resetForm()
      }
    }
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar la observación')
  } finally {
    saving.value = false
  }
}

// Delete observation
const deleteObservation = async (id: number) => {
  try {
    await axios.delete(`/api/teacher/observations/${id}`)
    confirmDeleteId.value = null
    await fetchObservations()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al eliminar la observación')
  }
}

// Watchers
watch([selectedGradeName, selectedSection, selectedJornada, selectedSubjectId], () => {
  activeStudentId.value = null
})

watch(selectedGradeId, (newGradeId) => {
  students.value = []
  activeStudentId.value = null
  if (newGradeId) {
    fetchStudents()
  }
})

watch([selectedCourse, selectedPeriodId], () => {
  observations.value = []
  if (selectedCourse.value && selectedPeriodId.value) {
    fetchObservations()
  }
})

watch(() => yearStore.selectedYearId, () => {
  selectedGradeName.value = null
  selectedSection.value = null
  selectedJornada.value = null
  selectedSubjectId.value = null
  selectedPeriodId.value = null
  observations.value = []
  students.value = []
  activeStudentId.value = null
  fetchMyCourses()
  fetchPeriods()
  fetchObservationTypes()
})

onMounted(() => {
  fetchMyCourses()
  fetchPeriods()
  fetchObservationTypes()
})
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-500 pb-8">
    
    <!-- Top Header Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <MessageSquare :size="28" class="text-amber-600 dark:text-amber-500" />
          Observador del Estudiante
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Mesa de trabajo dividida: registro fluido sin scroll para todos tus estudiantes.</p>
      </div>

      <!-- Quick Progress Badge -->
      <div v-if="selectedCourse && selectedPeriodId && students.length > 0" class="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 px-5 rounded-2xl shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 font-black text-xs">
          {{ rosterStats.percentage }}%
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-black text-slate-800 dark:text-slate-200">Progreso del Grupo</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
              {{ rosterStats.completed }}/{{ rosterStats.total }} Evaluados
            </span>
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Quedan {{ rosterStats.pending }} pendientes por observar</p>
        </div>
      </div>
    </div>

    <!-- Cascade Context Filters Bar (Compact Sticky Header) -->
    <div class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <div class="space-y-1">
          <label class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Grado</label>
          <select v-model="selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none">
            <option :value="null">Selecciona</option>
            <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="space-y-1">
          <label class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Sección</label>
          <select v-model="selectedSection" :disabled="!selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="s in sectionOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="space-y-1">
          <label class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Jornada</label>
          <select v-model="selectedJornada" :disabled="!selectedSection" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="j in jornadaOptions" :key="j" :value="j">{{ j }}</option>
          </select>
        </div>

        <div class="space-y-1">
          <label class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedJornada" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>

        <div class="space-y-1">
          <label class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
          <select v-model="selectedPeriodId" :disabled="periods.length === 0" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Status Lock Warning -->
    <div v-if="selectedCourse && selectedPeriodId && !isEditable" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-center gap-3">
      <AlertCircle class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div>
        <h4 class="font-bold text-xs text-amber-900 dark:text-amber-200">Modo de Solo Lectura</h4>
        <p class="text-xs text-amber-700 dark:text-amber-400">{{ lockReason }}</p>
      </div>
    </div>

    <!-- Empty Prompt: Course Not Selected -->
    <div v-if="!selectedCourse || !selectedPeriodId" class="bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-16 text-center">
      <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
        <Eye class="w-8 h-8 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-lg font-bold text-slate-400 dark:text-slate-500">Selecciona grado, materia y periodo para comenzar</h3>
      <p class="text-slate-400 dark:text-slate-500 text-xs mt-1">Una vez seleccionado el grupo, la mesa de trabajo en 2 columnas se cargará automáticamente.</p>
    </div>

    <!-- Main Workspace (Split View 2 Columns) -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

      <!-- LEFT COLUMN: Student Roster (45% Width / col-span-5) -->
      <div class="lg:col-span-5 space-y-4">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 space-y-4">
          
          <!-- Search & Status Filter Pills -->
          <div class="space-y-3">
            <div class="relative">
              <Search class="absolute left-3.5 top-3.5 text-slate-400" :size="16" />
              <input
                v-model="studentSearchQuery"
                type="text"
                placeholder="Buscar alumno por nombre o código..."
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <!-- Filter Pills -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                @click="rosterFilter = 'all'"
                :class="[rosterFilter === 'all' ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100', 'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0']"
              >
                Todos ({{ students.length }})
              </button>
              <button
                @click="rosterFilter = 'pending'"
                :class="[rosterFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100', 'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0']"
              >
                ⚠️ Sin registrar ({{ rosterStats.pending }})
              </button>
              <button
                @click="rosterFilter = 'completed'"
                :class="[rosterFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100', 'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0']"
              >
                ✓ Evaluados ({{ rosterStats.completed }})
              </button>
            </div>
          </div>

          <!-- Student Roster Scrollable List -->
          <div v-if="loading" class="p-8 text-center space-y-3">
            <Loader2 class="w-8 h-8 text-amber-600 animate-spin mx-auto" />
            <p class="text-xs text-slate-400 font-bold">Cargando nómina del curso...</p>
          </div>

          <div v-else-if="filteredStudents.length === 0" class="p-8 text-center">
            <p class="text-xs font-bold text-slate-400">No se encontraron estudiantes con el filtro actual.</p>
          </div>

          <div v-else class="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            <div
              v-for="s in filteredStudents"
              :key="s.id_estudiante"
              @click="selectStudent(s.id_estudiante)"
              :class="[
                activeStudentId === s.id_estudiante
                  ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                  : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700',
                'p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group relative overflow-hidden'
              ]"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div :class="[activeStudentId === s.id_estudiante ? 'from-amber-500 to-amber-600 text-white' : 'from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 text-slate-700 dark:text-slate-200', 'w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center font-black text-xs shrink-0 shadow-sm']">
                  {{ s.nombre.charAt(0) }}
                </div>
                <div class="min-w-0">
                  <h4 class="font-bold text-xs text-slate-800 dark:text-white truncate group-hover:text-amber-600 transition-colors">
                    {{ s.nombre }} {{ s.apellido }}
                  </h4>
                  <p class="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                    Cód: {{ s.codigo }}
                  </p>
                </div>
              </div>

              <!-- Badges & Indicator -->
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="studentStatusMap[s.id_estudiante]?.hasObservation"
                  class="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight flex items-center gap-1"
                >
                  <CheckCircle2 :size="10" />
                  {{ studentStatusMap[s.id_estudiante].count }} Obs.
                </span>
                <span
                  v-else
                  class="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight"
                >
                  Pendiente
                </span>
                <ChevronRight :size="14" :class="[activeStudentId === s.id_estudiante ? 'text-amber-600 translate-x-0.5' : 'text-slate-300 opacity-0 group-hover:opacity-100', 'transition-all']" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Fixed Observation Workbench (55% Width / col-span-7) -->
      <div class="lg:col-span-7 space-y-4 lg:sticky lg:top-4">
        
        <div v-if="!activeStudent" class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center shadow-sm">
          <Users class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p class="text-slate-400 font-bold text-sm">Selecciona un alumno de la nómina izquierda para registrar su observación.</p>
        </div>

        <div v-else class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          
          <!-- Focused Student Header Bar -->
          <div class="bg-slate-50/80 dark:bg-slate-800/60 p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                {{ activeStudent.nombre.charAt(0) }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-black text-slate-900 dark:text-white text-base">{{ activeStudent.nombre }} {{ activeStudent.apellido }}</h3>
                  <span
                    v-if="studentStatusMap[activeStudent.id_estudiante]?.hasObservation"
                    class="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[9px] font-black uppercase"
                  >
                    ✓ Con Observación
                  </span>
                </div>
                <p class="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">Código: {{ activeStudent.codigo }}</p>
              </div>
            </div>

            <div v-if="editingObservation" class="flex items-center gap-2 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-xl text-xs font-bold">
              <Pencil :size="12" />
              Editando observación
              <button @click="cancelEdit" class="ml-2 underline text-[10px] hover:opacity-80">Cancelar</button>
            </div>
          </div>

          <!-- Registration Form Body -->
          <div class="p-6 space-y-5">
            
            <!-- Type Selector (DB Driven) -->
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo de Observación (BD) *</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="t in (dbObservationTypes.length > 0 ? dbObservationTypes : ['ACADEMICA', 'CONVIVENCIA', 'DISCIPLINARIA', 'OTRO'])"
                  :key="t"
                  type="button"
                  @click="formData.tipo = (t === 'CONVIVENCIA' ? 'CONVIVENCIAL' : (t === 'DISCIPLINARIA' ? 'DISCIPLINARIO' : t)) as any"
                  :class="[
                    (formData.tipo === t || (t === 'CONVIVENCIA' && formData.tipo === 'CONVIVENCIAL') || (t === 'DISCIPLINARIA' && formData.tipo === 'DISCIPLINARIO'))
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-200/50'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100',
                    'py-2.5 px-3 rounded-xl text-xs font-bold transition-all border border-transparent text-center'
                  ]"
                >
                  {{ formatObservationTypeLabel(t) }}
                </button>
              </div>
            </div>

            <!-- Date Picker (New Observation) -->
            <div v-if="!editingObservation" class="space-y-1">
              <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Fecha de Registro</label>
              <input
                type="date"
                v-model="formData.fecha"
                :min="allowedDateRange.min"
                :max="allowedDateRange.max"
                class="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <!-- Text Areas: Fortalezas, Debilidades, Recomendaciones -->
            <div class="space-y-4">
              <!-- Fortalezas -->
              <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  <Award :size="12" />
                  Fortalezas Académicas / Actitudinales
                </label>
                <textarea
                  v-model="formData.fortalezas"
                  rows="2"
                  placeholder="Escribe los aspectos positivos destacados..."
                  class="w-full bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 rounded-2xl p-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none placeholder-emerald-300 dark:placeholder-emerald-800"
                ></textarea>
              </div>

              <!-- Debilidades -->
              <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  <ShieldAlert :size="12" />
                  Debilidades / Puntos a Mejorar
                </label>
                <textarea
                  v-model="formData.debilidades"
                  rows="2"
                  placeholder="Describe las áreas que requieren atención..."
                  class="w-full bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/50 rounded-2xl p-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none resize-none placeholder-rose-300 dark:placeholder-rose-800"
                ></textarea>
              </div>

              <!-- Recomendaciones -->
              <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  <Lightbulb :size="12" />
                  Recomendaciones Pedagógicas
                </label>
                <textarea
                  v-model="formData.recomendaciones"
                  rows="2"
                  placeholder="Indica sugerencias formativas..."
                  class="w-full bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/50 rounded-2xl p-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder-blue-300 dark:placeholder-blue-800"
                ></textarea>
              </div>
            </div>

            <!-- Primary Action Button: Save & Advance -->
            <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                @click="resetForm"
                type="button"
                class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Limpiar campos
              </button>

              <button
                @click="saveObservationAndAdvance"
                :disabled="!formValid || saving || !isEditable || auth.isMonitoring"
                class="w-full sm:w-auto bg-amber-600 dark:bg-amber-500 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-amber-200/50 dark:shadow-none hover:bg-amber-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                <Save v-else :size="16" />
                {{ saving ? 'Guardando...' : (editingObservation ? 'Actualizar Observación' : 'Guardar y Avanzar al Siguiente ➔') }}
              </button>
            </div>
          </div>

          <!-- Existing Observations History for Active Student -->
          <div v-if="activeStudentObservations.length > 0" class="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-3">
            <h4 class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest pt-4 flex items-center justify-between">
              <span>Historial del Alumno ({{ activeStudentObservations.length }})</span>
              <!-- Filter by Type inside student history -->
              <select v-model="selectedObservationTypeFilter" class="bg-slate-100 dark:bg-slate-800 border-none text-[10px] font-bold rounded-lg px-2 py-1 outline-none">
                <option value="all">Filtro Tipo: Todos</option>
                <option v-for="t in dbObservationTypes" :key="t" :value="t">{{ formatObservationTypeLabel(t) }}</option>
              </select>
            </h4>

            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div
                v-for="obs in activeStudentObservations"
                :key="obs.id_observacion"
                class="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2 text-xs"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-md text-[9px] font-black uppercase">
                      {{ formatObservationTypeLabel(obs.tipo) }}
                    </span>
                    <span class="text-[10px] text-slate-400 font-semibold">{{ formatDate(obs.fecha) }}</span>
                  </div>

                  <div v-if="isEditable && !auth.isMonitoring" class="flex items-center gap-1">
                    <button @click="startEditObservation(obs)" class="p-1 text-slate-400 hover:text-amber-600 transition-colors" title="Editar">
                      <Pencil :size="12" />
                    </button>
                    <button v-if="confirmDeleteId !== obs.id_observacion" @click="confirmDeleteId = obs.id_observacion" class="p-1 text-rose-400 hover:text-rose-600 transition-colors" title="Eliminar">
                      <Trash2 :size="12" />
                    </button>
                    <button v-else @click="deleteObservation(obs.id_observacion)" class="bg-rose-600 text-white px-2 py-0.5 rounded text-[9px] font-bold">
                      Confirmar
                    </button>
                  </div>
                </div>

                <div class="space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  <p v-if="obs.fortalezas"><strong class="text-emerald-600 dark:text-emerald-400">Fortalezas:</strong> {{ obs.fortalezas }}</p>
                  <p v-if="obs.debilidades"><strong class="text-rose-600 dark:text-rose-400">Debilidades:</strong> {{ obs.debilidades }}</p>
                  <p v-if="obs.recomendaciones"><strong class="text-blue-600 dark:text-blue-400">Recomendaciones:</strong> {{ obs.recomendaciones }}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>

  </div>
</template>

<style scoped>
</style>
