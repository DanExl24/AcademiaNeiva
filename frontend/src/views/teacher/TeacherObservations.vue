<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Eye,
  Plus,
  Search,
  Award,
  ShieldAlert,
  Lightbulb,
  Loader2,
  AlertCircle,
  Save,
  X,
  Trash2,
  Pencil,
  Calendar,
  MessageSquare,
  Filter,
  Users
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
  tipo: 'ACADEMICA' | 'DISCIPLINARIO' | 'CONVIVENCIAL'
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

// Search and filter
const searchQuery = ref('')
const filterType = ref<'all' | 'fortaleza' | 'debilidad' | 'recomendacion'>('all')
const selectedStudentFilterId = ref<number | null>(null)

// Modal state
const showModal = ref(false)
const editingObservation = ref<Observation | null>(null)
const formData = ref({
  studentId: null as number | null,
  fortalezas: '',
  debilidades: '',
  recomendaciones: '',
  fecha: new Date().toLocaleDateString('en-CA'),
  tipo: 'ACADEMICA' as 'ACADEMICA' | 'DISCIPLINARIO' | 'CONVIVENCIAL'
})

// Confirm delete
const confirmDeleteId = ref<number | null>(null)

// Load my courses
const fetchMyCourses = async () => {
  // In monitoring mode, load the observed teacher's courses
  const teacherId = auth.isMonitoring ? auth.monitoringUser?.id : (auth.user?.id_usuario || auth.user?.id)
  if (!teacherId) return
  try {
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const response = await axios.get(`http://localhost:3000/api/teacher/courses/${teacherId}`, { params })
    myCourses.value = response.data
    
    // Si venimos con parámetros de consulta (ej. desde el cierre)
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
  const schoolId = auth.user?.schoolId || auth.user?.id_colegio
  if (!schoolId) return
  try {
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const response = await axios.get(`http://localhost:3000/api/teacher/periods/${schoolId}`, { params })
    periods.value = (response.data || []).filter((p: any) => p.estado !== 'PENDIENTE')
    // Select first open period by default
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

// Computed: current course (requires subject for observations/editability)
const selectedCourse = computed(() => {
  const course = myCourses.value.find(c => 
    c.grado_nombre === selectedGradeName.value && 
    c.seccion === selectedSection.value && 
    c.jornada_nombre === selectedJornada.value &&
    c.id_materia === selectedSubjectId.value
  )
  return course
})

// Grade ID based only on grade + section + jornada (students belong to group, not subject)
const selectedGradeId = computed(() => {
  const course = myCourses.value.find(c =>
    c.grado_nombre === selectedGradeName.value &&
    c.seccion === selectedSection.value &&
    c.jornada_nombre === selectedJornada.value
  )
  const gId = course ? course.id_grado : null
  return gId
})

// Load students for current grade
const fetchStudents = async () => {
  if (!selectedGradeId.value) return
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/students/${selectedGradeId.value}`)
    students.value = response.data
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
      `http://localhost:3000/api/teacher/observations/${selectedCourse.value.id_detallegrado}/${selectedPeriodId.value}`
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

// Stats
const stats = computed(() => {
  const counts = { fortalezas: 0, debilidades: 0, recomendaciones: 0 }
  observations.value.forEach(o => {
    if (o.fortalezas) counts.fortalezas++
    if (o.debilidades) counts.debilidades++
    if (o.recomendaciones) counts.recomendaciones++
  })
  return counts
})

// Filtered observations
const filteredObservations = computed(() => {
  let result = observations.value

  if (selectedStudentFilterId.value) {
    result = result.filter(o => o.id_estudiante === selectedStudentFilterId.value)
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(o =>
      o.nombre.toLowerCase().includes(query) ||
      (o.fortalezas && o.fortalezas.toLowerCase().includes(query)) ||
      (o.debilidades && o.debilidades.toLowerCase().includes(query)) ||
      (o.recomendaciones && o.recomendaciones.toLowerCase().includes(query))
    )
  }

  if (filterType.value !== 'all') {
    result = result.filter(o => {
      if (filterType.value === 'fortaleza') return !!o.fortalezas
      if (filterType.value === 'debilidad') return !!o.debilidades
      if (filterType.value === 'recomendacion') return !!o.recomendaciones
      return true
    })
  }

  return result
})

// Computed: allowed date range for the selected period
const allowedDateRange = computed(() => {
  if (!selectedPeriodId.value || periods.value.length === 0) return { min: '', max: '' }
  const period = periods.value.find(p => p.id_periodo === selectedPeriodId.value)
  if (!period) return { min: '', max: '' }

  if (!period.mes_inicio || !period.dia_inicio || !period.mes_fin || !period.dia_fin) {
    return { min: '', max: '' }
  }

  let year = period.id_anio ? Number(period.id_anio) : new Date().getFullYear()
  if (year < 2000) {
    year = new Date().getFullYear()
  }
  const pad = (num: number) => String(num).padStart(2, '0')

  const minStr = `${year}-${pad(period.mes_inicio)}-${pad(period.dia_inicio)}`
  
  // Manejo de fin de periodo (podría cruzar el año aunque es raro en periodos académicos estándar)
  let endYear = year
  if (period.mes_fin < period.mes_inicio) {
    endYear = year + 1
  }
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

// Observation types helper
const getObservationTypes = (obs: Observation) => {
  const types: { type: string; text: string; color: string; bg: string; border: string; icon: any }[] = []
  if (obs.fortalezas) {
    types.push({ type: 'Fortaleza', text: obs.fortalezas, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Award })
  }
  if (obs.debilidades) {
    types.push({ type: 'Debilidad', text: obs.debilidades, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: ShieldAlert })
  }
  if (obs.recomendaciones) {
    types.push({ type: 'Recomendación', text: obs.recomendaciones, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Lightbulb })
  }
  return types
}

// Modal: Open new
const openNewModal = () => {
  editingObservation.value = null
  
  let defaultDate = new Date().toLocaleDateString('en-CA')
  const { min, max } = allowedDateRange.value
  if (min && defaultDate < min) {
    defaultDate = min
  } else if (max && defaultDate > max) {
    defaultDate = max
  }

  formData.value = {
    studentId: selectedStudentFilterId.value,
    fortalezas: '',
    debilidades: '',
    recomendaciones: '',
    fecha: defaultDate,
    tipo: 'ACADEMICA'
  }
  showModal.value = true
  fetchStudents()
}

// Modal: Open edit
const openEditModal = (obs: Observation) => {
  editingObservation.value = obs
  formData.value = {
    studentId: obs.id_estudiante,
    fortalezas: obs.fortalezas || '',
    debilidades: obs.debilidades || '',
    recomendaciones: obs.recomendaciones || '',
    fecha: new Date(obs.fecha).toLocaleDateString('en-CA'),
    tipo: obs.tipo || 'ACADEMICA'
  }
  showModal.value = true
  fetchStudents()
}

// Modal: Close
const closeModal = () => {
  showModal.value = false
  editingObservation.value = null
}

// Form validation
const formValid = computed(() => {
  const hasStudent = editingObservation.value ? true : !!formData.value.studentId
  const hasContent =
    formData.value.fortalezas.trim().length > 0 ||
    formData.value.debilidades.trim().length > 0 ||
    formData.value.recomendaciones.trim().length > 0
  const isValid = hasStudent && hasContent
  return isValid
})

// Save observation (create or update)
const saveObservation = async () => {
  if (!formValid.value || saving.value) return

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
          studentId: formData.value.studentId,
          fortalezas: formData.value.fortalezas,
          debilidades: formData.value.debilidades,
          recomendaciones: formData.value.recomendaciones,
          fecha: `${formData.value.fecha}T12:00:00Z`,
          tipo: formData.value.tipo
        }


    if (editingObservation.value) {
      // Update
      await axios.put(`http://localhost:3000/api/teacher/observations/${editingObservation.value.id_observacion}`, payload)
    } else {
      // Create
      await axios.post('http://localhost:3000/api/teacher/observations', payload)
    }

    closeModal()
    await fetchObservations()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar la observación')
  } finally {
    saving.value = false
  }
}

// Delete observation
const deleteObservation = async (id: number) => {
  try {
    await axios.delete(`http://localhost:3000/api/teacher/observations/${id}`)
    confirmDeleteId.value = null
    await fetchObservations()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al eliminar la observación')
  }
}

// Watchers
watch([selectedGradeName, selectedSection, selectedJornada, selectedSubjectId], () => {
  selectedStudentFilterId.value = null
})

// When grade changes, pre-fetch students so modal dropdown is ready
watch(selectedGradeId, (newGradeId) => {
  students.value = []
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

// Pagination
const currentPage = ref(1)
const itemsPerPage = 3

const totalPages = computed(() => {
  const pages = Math.ceil(filteredObservations.value.length / itemsPerPage)
  return pages
})

const paginatedObservations = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  const paginated = filteredObservations.value.slice(start, end)
  return paginated
})

// Reset to page 1 on filter or search changes
watch([selectedGradeName, selectedSection, selectedJornada, selectedSubjectId, selectedPeriodId, searchQuery, filterType, selectedStudentFilterId], () => {
  currentPage.value = 1
})

watch(() => yearStore.selectedYearId, () => {
  selectedGradeName.value = null
  selectedSection.value = null
  selectedJornada.value = null
  selectedSubjectId.value = null
  selectedPeriodId.value = null
  observations.value = []
  students.value = []
  fetchMyCourses()
  fetchPeriods()
})

onMounted(() => {
  fetchMyCourses()
  fetchPeriods()
})

</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-700">
    <!-- Header with Actions -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Observador del Estudiante</h1>
        <p class="text-slate-500 dark:text-slate-400 text-lg transition-colors">Consulta y registra el seguimiento académico: fortalezas, debilidades y recomendaciones.</p>
      </div>
      <button
        v-if="selectedCourse && selectedPeriodId && isEditable && !auth.isMonitoring"
        @click="openNewModal"
        class="bg-amber-600 dark:bg-amber-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-amber-200/50 dark:shadow-none hover:bg-amber-700 dark:hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-2"
      >
        <Plus :size="20" />
        Nueva Observación
      </button>
      <div 
        v-if="auth.isMonitoring && selectedCourse && selectedPeriodId"
        class="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-5 py-3 rounded-2xl"
      >
        Solo Lectura
      </div>
    </div>

    <!-- Filters in cascade -->
    <div class="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-end gap-4 transition-colors">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Grado</label>
          <select v-model="selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600 transition-all outline-none">
            <option :value="null">Selecciona</option>
            <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Sección</label>
          <select v-model="selectedSection" :disabled="!selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="s in sectionOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Jornada</label>
          <select v-model="selectedJornada" :disabled="!selectedSection" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="j in jornadaOptions" :key="j" :value="j">{{ j }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedJornada" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Periodo Académico</label>
          <select v-model="selectedPeriodId" :disabled="periods.length === 0" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Status warnings -->
    <div v-if="selectedCourse && selectedPeriodId && !isEditable" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-3xl p-6 flex items-start gap-4 animate-in slide-in-from-top duration-300 transition-colors">
      <AlertCircle class="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <h4 class="font-black text-amber-900 dark:text-amber-200">Observaciones en modo de solo lectura</h4>
        <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">{{ lockReason }}</p>
      </div>
    </div>

    <!-- Unselected course prompt -->
    <div v-if="!selectedCourse || !selectedPeriodId" class="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-20 text-center transition-colors">
      <div class="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
        <Eye class="w-10 h-10 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-400 dark:text-slate-500">Selecciona grado, materia y periodo para comenzar</h3>
      <p class="text-slate-400 dark:text-slate-500 text-sm mt-2">Una vez seleccionado el contexto, podrás consultar y registrar observaciones académicas.</p>
    </div>

    <!-- Main Content -->
    <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">

      <!-- Sidebar: Stats -->
      <div class="xl:col-span-1 space-y-6">
        <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
          <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare :size="20" class="text-amber-600 dark:text-amber-500" />
            Resumen del Periodo
          </h3>

          <div class="space-y-4">
            <div class="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Award :size="20" class="text-emerald-600 dark:text-emerald-400" />
                </div>
                <span class="text-sm font-bold text-emerald-700 dark:text-emerald-400">Fortalezas</span>
              </div>
              <span class="text-2xl font-black text-emerald-700 dark:text-emerald-300">{{ stats.fortalezas }}</span>
            </div>
            <div class="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-2xl p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                  <ShieldAlert :size="20" class="text-rose-600 dark:text-rose-400" />
                </div>
                <span class="text-sm font-bold text-rose-700 dark:text-rose-400">Debilidades</span>
              </div>
              <span class="text-2xl font-black text-rose-700 dark:text-rose-300">{{ stats.debilidades }}</span>
            </div>
            <div class="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-2xl p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Lightbulb :size="20" class="text-blue-600 dark:text-blue-400" />
                </div>
                <span class="text-sm font-bold text-blue-700 dark:text-blue-400">Recomendaciones</span>
              </div>
              <span class="text-2xl font-black text-blue-700 dark:text-blue-300">{{ stats.recomendaciones }}</span>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div class="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Total observaciones</span>
              <span class="font-bold text-slate-700 dark:text-slate-200">{{ observations.length }}</span>
            </div>
          </div>
        </div>

        <!-- Filter by type -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
          <h3 class="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Filter :size="16" class="text-slate-400 dark:text-slate-500" />
            Filtrar por tipo
          </h3>
          <div class="space-y-2">
            <button
              @click="filterType = 'all'"
              :class="[filterType === 'all' ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              Todas
            </button>
            <button
              @click="filterType = 'fortaleza'"
              :class="[filterType === 'fortaleza' ? 'bg-emerald-600 dark:bg-emerald-500 text-white' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              🏆 Solo Fortalezas
            </button>
            <button
              @click="filterType = 'debilidad'"
              :class="[filterType === 'debilidad' ? 'bg-rose-600 dark:bg-rose-500 text-white' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              ⚠️ Solo Debilidades
            </button>
            <button
              @click="filterType = 'recomendacion'"
              :class="[filterType === 'recomendacion' ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              💡 Solo Recomendaciones
            </button>
          </div>
        </div>
      </div>

      <!-- Right content: Observations List -->
      <div class="xl:col-span-3 space-y-6">

        <!-- Search bar & Quick Student Selector -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <Search class="text-slate-400 dark:text-slate-500 shrink-0 ml-2" :size="20" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por nombre de estudiante o contenido..."
              class="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-sm font-semibold"
            />
          </div>
          <div class="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-2 transition-colors">
            <Users class="text-slate-450 dark:text-slate-500 shrink-0" :size="18" />
            <select
              v-model="selectedStudentFilterId"
              class="w-full bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-350 outline-none focus:ring-0 cursor-pointer"
            >
              <option :value="null">Todos los estudiantes</option>
              <option v-for="s in students" :key="s.id_estudiante" :value="s.id_estudiante">
                {{ s.nombre }} {{ s.apellido }}
              </option>
            </select>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
          <Loader2 class="w-10 h-10 text-amber-600 dark:text-amber-500 animate-spin mb-4" />
          <p class="text-slate-500 dark:text-slate-400 font-bold text-sm">Cargando observaciones...</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredObservations.length === 0" class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-20 text-center shadow-sm transition-colors">
          <div class="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye class="w-8 h-8 text-amber-300 dark:text-amber-600" />
          </div>
          <p class="text-slate-400 dark:text-slate-500 font-bold">{{ observations.length === 0 ? 'No hay observaciones registradas en este periodo.' : 'No se encontraron observaciones con el filtro actual.' }}</p>
          <button
            v-if="isEditable && observations.length === 0 && !auth.isMonitoring"
            @click="openNewModal"
            class="mt-6 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-6 py-3 rounded-2xl font-bold text-sm transition-all inline-flex items-center gap-2"
          >
            <Plus :size="18" />
            Registrar primera observación
          </button>
        </div>

        <!-- Observations Timeline -->
        <div v-else class="space-y-3">
          <div
            v-for="obs in paginatedObservations"
            :key="obs.id_observacion"
            class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group"
          >
            <!-- Card Header -->
            <div class="p-4 pb-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-50 dark:border-slate-800 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                  {{ obs.nombre.charAt(0) }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="font-bold text-slate-900 dark:text-white text-base">{{ obs.nombre }}</h4>
                    <span 
                      v-if="obs.tipo"
                      :class="[
                        obs.tipo === 'ACADEMICA' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : '',
                        obs.tipo === 'DISCIPLINARIO' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' : '',
                        obs.tipo === 'CONVIVENCIAL' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' : '',
                        'px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter'
                      ]"
                    >
                      {{ obs.tipo === 'ACADEMICA' ? 'ACADÉMICO' : obs.tipo }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                    <Calendar :size="10" />
                    {{ formatDate(obs.fecha) }}
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div v-if="isEditable && !auth.isMonitoring" class="flex items-center gap-1.5 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click="openEditModal(obs)"
                  class="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-lg transition-all border border-transparent dark:border-slate-700"
                  title="Editar"
                >
                  <Pencil :size="14" />
                </button>
                <button
                  v-if="confirmDeleteId !== obs.id_observacion"
                  @click="confirmDeleteId = obs.id_observacion"
                  class="bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 dark:text-rose-400 p-2 rounded-lg transition-all border border-transparent dark:border-rose-900/50"
                  title="Eliminar"
                >
                  <Trash2 :size="14" />
                </button>
                <div v-else class="flex items-center gap-1">
                  <button
                    @click="deleteObservation(obs.id_observacion)"
                    class="bg-rose-600 dark:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-rose-700 transition-all"
                  >
                    Confirmar
                  </button>
                  <button
                    @click="confirmDeleteId = null"
                    class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all border"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>

            <!-- Card Body: Observation types -->
            <div class="p-4 pt-2.5 space-y-2">
              <div
                v-for="(t, idx) in getObservationTypes(obs)"
                :key="idx"
                :class="[t.bg, t.border, 'dark:bg-slate-800/40 dark:border-slate-800 p-2.5 px-3.5 rounded-xl border flex items-start gap-2.5 transition-colors']"
              >
                <div :class="[t.bg, 'dark:bg-slate-900/50 w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5']">
                  <component :is="t.icon" :size="12" :class="[t.color, 'dark:text-current opacity-85']" />
                </div>
                <div class="min-w-0 flex-1">
                  <span :class="[t.color, 'dark:text-current opacity-70 text-[9px] font-bold uppercase tracking-widest block mb-0.5']">{{ t.type }}</span>
                  <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{{ t.text }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination Controls -->
          <div v-if="totalPages > 1" class="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors mt-6">
            <button
              @click="currentPage > 1 && currentPage--"
              :disabled="currentPage === 1"
              class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-all border dark:border-slate-800"
            >
              Anterior
            </button>
            
            <div class="flex items-center gap-1.5">
              <button
                v-for="page in totalPages"
                :key="page"
                @click="currentPage = page"
                :class="[
                  currentPage === page
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
                  'w-8 h-8 rounded-xl text-xs font-bold transition-all'
                ]"
              >
                {{ page }}
              </button>
            </div>

            <button
              @click="currentPage < totalPages && currentPage++"
              :disabled="currentPage === totalPages"
              class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-all border dark:border-slate-800"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Create / Edit Observation -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" @click="closeModal"></div>

          <!-- Modal Content -->
          <div class="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 transition-colors">
            <!-- Modal Header -->
            <div class="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-8 pb-6 border-b border-slate-100 dark:border-slate-800 rounded-t-3xl z-10 transition-colors">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-black text-slate-900 dark:text-white transition-colors">
                    {{ editingObservation ? 'Editar Observación' : 'Nueva Observación' }}
                  </h2>
                  <p class="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">
                    {{ editingObservation ? 'Modifica los campos de esta observación.' : 'Registra una observación académica para un estudiante.' }}
                  </p>
                </div>
                <button @click="closeModal" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2.5 rounded-xl transition-all">
                  <X :size="20" class="text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            <!-- Modal Body -->
            <div class="p-8 space-y-6">
              <!-- Student selector (only for new) -->
              <div v-if="!editingObservation" class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Estudiante *</label>
                <select
                  v-model="formData.studentId"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600 transition-all outline-none"
                >
                  <option :value="null">Seleccionar estudiante</option>
                  <option v-for="s in students" :key="s.id_estudiante" :value="s.id_estudiante">
                    {{ s.nombre }} {{ s.apellido }} — {{ s.codigo }}
                  </option>
                </select>
              </div>

              <!-- Editing: show student name -->
              <div v-else class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                <div class="w-10 h-10 rounded-xl bg-amber-600 dark:bg-amber-500 text-white flex items-center justify-center font-bold">
                  {{ editingObservation.nombre.charAt(0) }}
                </div>
                <div>
                  <p class="font-bold text-amber-900 dark:text-amber-200 text-sm transition-colors">{{ editingObservation.nombre }}</p>
                  <p class="text-xs text-amber-700 dark:text-amber-400">Observación del {{ formatDate(editingObservation.fecha) }}</p>
                </div>
              </div>

              <!-- Date selector (only for new) -->
              <div v-if="!editingObservation" class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Fecha de registro *</label>
                <input
                  type="date"
                  v-model="formData.fecha"
                  :min="allowedDateRange.min"
                  :max="allowedDateRange.max"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600 transition-all outline-none"
                />
                <p v-if="allowedDateRange.min || allowedDateRange.max" class="text-[11px] text-amber-600 dark:text-amber-500 font-semibold ml-1">
                  Rango del periodo: {{ formatDate(allowedDateRange.min) }} al {{ formatDate(allowedDateRange.max) }}
                </p>
              </div>

              <!-- Tipo de Seguimiento -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo de Seguimiento *</label>
                <div class="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    @click="formData.tipo = 'ACADEMICA'"
                    :class="[formData.tipo === 'ACADEMICA' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100', 'py-3 px-4 rounded-2xl text-xs font-bold transition-all border border-transparent']"
                  >
                    Académico
                  </button>
                  <button
                    type="button"
                    @click="formData.tipo = 'DISCIPLINARIO'"
                    :class="[formData.tipo === 'DISCIPLINARIO' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100', 'py-3 px-4 rounded-2xl text-xs font-bold transition-all border border-transparent']"
                  >
                    Disciplinario
                  </button>
                  <button
                    type="button"
                    @click="formData.tipo = 'CONVIVENCIAL'"
                    :class="[formData.tipo === 'CONVIVENCIAL' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100', 'py-3 px-4 rounded-2xl text-xs font-bold transition-all border border-transparent']"
                  >
                    Convivencial
                  </button>
                </div>
              </div>

              <!-- Fortalezas -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors">
                  <Award :size="12" />
                  Fortalezas
                </label>
                <textarea
                  v-model="formData.fortalezas"
                  rows="3"
                  placeholder="Describe las fortalezas observadas en el estudiante..."
                  class="w-full bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none resize-none placeholder-emerald-300 dark:placeholder-emerald-800"
                ></textarea>
              </div>

              <!-- Debilidades -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors">
                  <ShieldAlert :size="12" />
                  Debilidades
                </label>
                <textarea
                  v-model="formData.debilidades"
                  rows="3"
                  placeholder="Describe las debilidades observadas en el estudiante..."
                  class="w-full bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 transition-all outline-none resize-none placeholder-rose-300 dark:placeholder-rose-800"
                ></textarea>
              </div>

              <!-- Recomendaciones -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors">
                  <Lightbulb :size="12" />
                  Recomendaciones
                </label>
                <textarea
                  v-model="formData.recomendaciones"
                  rows="3"
                  placeholder="Escribe recomendaciones para el estudiante..."
                  class="w-full bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none placeholder-blue-300 dark:placeholder-blue-800"
                ></textarea>
              </div>

              <!-- Validation message -->
              <div
                v-if="formData.fortalezas.trim() === '' && formData.debilidades.trim() === '' && formData.recomendaciones.trim() === ''"
                class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-center gap-3 transition-colors"
              >
                <AlertCircle :size="18" class="text-amber-600 dark:text-amber-400 shrink-0" />
                <p class="text-sm text-amber-700 dark:text-amber-300 font-semibold transition-colors">Rellene por lo menos un tipo de observación.</p>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-8 pt-6 border-t border-slate-100 dark:border-slate-800 rounded-b-3xl flex items-center justify-end gap-3 transition-colors">
              <button
                @click="closeModal"
                class="px-6 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border dark:border-slate-800"
              >
                Cancelar
              </button>
              <button
                @click="saveObservation"
                :disabled="!formValid || saving"
                class="px-8 py-3 rounded-2xl font-bold text-sm text-white bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-400 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-200/50 dark:shadow-none"
              >
                <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                <Save v-else :size="18" />
                {{ saving ? 'Guardando...' : (editingObservation ? 'Actualizar' : 'Registrar') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
