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
  Users,
  MessageSquare,
  Filter
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

interface Period {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO'
  porcentaje: number
  id_año: number
  trimestre?: number | null
  dia_inicio?: number | null
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
}

const route = useRoute()
const auth = useAuthStore()

// Selectors
const selectedGradeId = ref<number | null>(route.query.gradoId ? Number(route.query.gradoId) : null)
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

// Modal state
const showModal = ref(false)
const editingObservation = ref<Observation | null>(null)
const formData = ref({
  studentId: null as number | null,
  fortalezas: '',
  debilidades: '',
  recomendaciones: '',
  fecha: new Date().toLocaleDateString('en-CA')
})

// Confirm delete
const confirmDeleteId = ref<number | null>(null)

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

// Load periods
const fetchPeriods = async () => {
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/periods/${auth.user?.schoolId}`)
    periods.value = response.data
    // Select first open period by default
    const openPeriod = periods.value.find(p => p.estado === 'ABIERTO')
    if (openPeriod) selectedPeriodId.value = openPeriod.id_periodo
    else if (periods.value.length > 0) selectedPeriodId.value = periods.value[0].id_periodo
  } catch (error) {
    console.error('Error fetching periods:', error)
  }
}

// Load students for current grade
const fetchStudents = async () => {
  if (!selectedCourse.value) return
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/students/${selectedCourse.value.id_detallegrado}`)
    students.value = response.data
  } catch (error) {
    console.error('Error fetching students:', error)
    students.value = []
  }
}

// Computed: current course
const selectedCourse = computed(() => {
  return myCourses.value.find(c => c.id_grado === selectedGradeId.value && c.id_materia === selectedSubjectId.value)
})

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
    console.error('Error fetching observations:', error)
    observations.value = []
    isEditable.value = false
    lockReason.value = 'Error al cargar las observaciones del servidor.'
  } finally {
    loading.value = false
  }
}

// Dropdown options
const coursesOptions = computed(() => {
  const uniqueGrades: { id: number; label: string }[] = []
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

  const year = period.id_año ? Number(period.id_año) : new Date().getFullYear()
  const trimestre = period.trimestre ? Number(period.trimestre) : 1

  let startMonth = 0 // Ene
  let endMonth = 2   // Mar
  if (trimestre === 2) {
    startMonth = 3   // Abr
    endMonth = 5     // Jun
  } else if (trimestre === 3) {
    startMonth = 6   // Jul
    endMonth = 11    // Dic
  }

  const startDay = period.dia_inicio !== null && period.dia_inicio !== undefined ? Number(period.dia_inicio) : 1
  const pad = (num: number) => String(num).padStart(2, '0')
  const minStr = `${year}-${pad(startMonth + 1)}-${pad(startDay)}`

  let maxStr = ''
  if (period.dia_fin !== null && period.dia_fin !== undefined) {
    maxStr = `${year}-${pad(endMonth + 1)}-${pad(period.dia_fin)}`
  } else {
    const lastDay = new Date(year, endMonth + 1, 0).getDate()
    maxStr = `${year}-${pad(endMonth + 1)}-${pad(lastDay)}`
  }

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
    studentId: null,
    fortalezas: '',
    debilidades: '',
    recomendaciones: '',
    fecha: defaultDate
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
    fecha: new Date(obs.fecha).toLocaleDateString('en-CA')
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
  return hasStudent && hasContent
})

// Save observation (create or update)
const saveObservation = async () => {
  if (!formValid.value || saving.value) return

  try {
    saving.value = true

    if (editingObservation.value) {
      // Update
      await axios.put(`http://localhost:3000/api/teacher/observations/${editingObservation.value.id_observacion}`, {
        fortalezas: formData.value.fortalezas,
        debilidades: formData.value.debilidades,
        recomendaciones: formData.value.recomendaciones
      })
    } else {
      // Create
      await axios.post('http://localhost:3000/api/teacher/observations', {
        detailGradeId: selectedCourse.value!.id_detallegrado,
        periodId: selectedPeriodId.value,
        studentId: formData.value.studentId,
        fortalezas: formData.value.fortalezas,
        debilidades: formData.value.debilidades,
        recomendaciones: formData.value.recomendaciones,
        fecha: `${formData.value.fecha}T12:00:00Z`
      })
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
watch([selectedGradeId, selectedSubjectId, selectedPeriodId], () => {
  observations.value = []
  if (selectedCourse.value && selectedPeriodId.value) {
    fetchObservations()
  }
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
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">Observador del Estudiante</h1>
        <p class="text-slate-500 text-lg">Consulta y registra el seguimiento académico: fortalezas, debilidades y recomendaciones.</p>
      </div>
      <button
        v-if="selectedCourse && selectedPeriodId && isEditable"
        @click="openNewModal"
        class="bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-amber-200/50 hover:bg-amber-700 active:scale-95 transition-all flex items-center gap-2"
      >
        <Plus :size="20" />
        Nueva Observación
      </button>
    </div>

    <!-- Filter Panel -->
    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-end gap-6">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Grado / Curso</label>
          <select v-model="selectedGradeId" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500 transition-all outline-none">
            <option :value="null">Seleccionar Grado</option>
            <option v-for="g in coursesOptions" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedGradeId" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500 transition-all outline-none disabled:opacity-50">
            <option :value="null">Seleccionar Materia</option>
            <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Periodo Académico</label>
          <select v-model="selectedPeriodId" :disabled="periods.length === 0" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500 transition-all outline-none disabled:opacity-50">
            <option :value="null">Seleccionar Periodo</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }} {{ p.estado === 'CERRADO' ? '(Cerrado)' : '' }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Status warnings -->
    <div v-if="selectedCourse && selectedPeriodId && !isEditable" class="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex items-start gap-4 animate-in slide-in-from-top duration-300">
      <AlertCircle class="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <h4 class="font-black text-amber-900">Observaciones en modo de solo lectura</h4>
        <p class="text-sm text-amber-700 mt-1">{{ lockReason }}</p>
      </div>
    </div>

    <!-- Unselected course prompt -->
    <div v-if="!selectedCourse || !selectedPeriodId" class="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
      <div class="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
        <Eye class="w-10 h-10 text-slate-300" />
      </div>
      <h3 class="text-xl font-bold text-slate-400">Selecciona grado, materia y periodo para comenzar</h3>
      <p class="text-slate-400 text-sm mt-2">Una vez seleccionado el contexto, podrás consultar y registrar observaciones académicas.</p>
    </div>

    <!-- Main Content -->
    <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">

      <!-- Sidebar: Stats -->
      <div class="xl:col-span-1 space-y-6">
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
            <MessageSquare :size="20" class="text-amber-600" />
            Resumen del Periodo
          </h3>

          <div class="space-y-4">
            <div class="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Award :size="20" class="text-emerald-600" />
                </div>
                <span class="text-sm font-bold text-emerald-700">Fortalezas</span>
              </div>
              <span class="text-2xl font-black text-emerald-700">{{ stats.fortalezas }}</span>
            </div>
            <div class="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                  <ShieldAlert :size="20" class="text-rose-600" />
                </div>
                <span class="text-sm font-bold text-rose-700">Debilidades</span>
              </div>
              <span class="text-2xl font-black text-rose-700">{{ stats.debilidades }}</span>
            </div>
            <div class="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Lightbulb :size="20" class="text-blue-600" />
                </div>
                <span class="text-sm font-bold text-blue-700">Recomendaciones</span>
              </div>
              <span class="text-2xl font-black text-blue-700">{{ stats.recomendaciones }}</span>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100">
            <div class="flex justify-between items-center text-xs font-semibold text-slate-500">
              <span>Total observaciones</span>
              <span class="font-bold text-slate-700">{{ observations.length }}</span>
            </div>
          </div>
        </div>

        <!-- Filter by type -->
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 class="text-sm font-black text-slate-700 flex items-center gap-2">
            <Filter :size="16" class="text-slate-400" />
            Filtrar por tipo
          </h3>
          <div class="space-y-2">
            <button
              @click="filterType = 'all'"
              :class="[filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              Todas
            </button>
            <button
              @click="filterType = 'fortaleza'"
              :class="[filterType === 'fortaleza' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              🏆 Solo Fortalezas
            </button>
            <button
              @click="filterType = 'debilidad'"
              :class="[filterType === 'debilidad' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              ⚠️ Solo Debilidades
            </button>
            <button
              @click="filterType = 'recomendacion'"
              :class="[filterType === 'recomendacion' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100', 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left']"
            >
              💡 Solo Recomendaciones
            </button>
          </div>
        </div>
      </div>

      <!-- Right content: Observations List -->
      <div class="xl:col-span-3 space-y-6">

        <!-- Search bar -->
        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <Search class="text-slate-400 shrink-0 ml-2" :size="20" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nombre de estudiante o contenido de observación..."
            class="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
          />
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 class="w-10 h-10 text-amber-600 animate-spin mb-4" />
          <p class="text-slate-500 font-bold text-sm">Cargando observaciones...</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredObservations.length === 0" class="bg-white rounded-3xl border border-slate-100 p-20 text-center shadow-sm">
          <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye class="w-8 h-8 text-amber-300" />
          </div>
          <p class="text-slate-400 font-bold">{{ observations.length === 0 ? 'No hay observaciones registradas en este periodo.' : 'No se encontraron observaciones con el filtro actual.' }}</p>
          <button
            v-if="isEditable && observations.length === 0"
            @click="openNewModal"
            class="mt-6 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-6 py-3 rounded-2xl font-bold text-sm transition-all inline-flex items-center gap-2"
          >
            <Plus :size="18" />
            Registrar primera observación
          </button>
        </div>

        <!-- Observations Timeline -->
        <div v-else class="space-y-5">
          <div
            v-for="obs in filteredObservations"
            :key="obs.id_observacion"
            class="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
          >
            <!-- Card Header -->
            <div class="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-amber-200/50">
                  {{ obs.nombre.charAt(0) }}
                </div>
                <div>
                  <h4 class="font-black text-slate-900 text-lg">{{ obs.nombre }}</h4>
                  <div class="flex items-center gap-2 text-xs text-slate-400 font-semibold mt-0.5">
                    <Calendar :size="12" />
                    {{ formatDate(obs.fecha) }}
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div v-if="isEditable" class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click="openEditModal(obs)"
                  class="bg-slate-50 hover:bg-slate-100 text-slate-600 p-2.5 rounded-xl transition-all"
                  title="Editar"
                >
                  <Pencil :size="16" />
                </button>
                <button
                  v-if="confirmDeleteId !== obs.id_observacion"
                  @click="confirmDeleteId = obs.id_observacion"
                  class="bg-rose-50 hover:bg-rose-100 text-rose-500 p-2.5 rounded-xl transition-all"
                  title="Eliminar"
                >
                  <Trash2 :size="16" />
                </button>
                <div v-else class="flex items-center gap-1.5">
                  <button
                    @click="deleteObservation(obs.id_observacion)"
                    class="bg-rose-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-rose-700 transition-all"
                  >
                    Confirmar
                  </button>
                  <button
                    @click="confirmDeleteId = null"
                    class="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>

            <!-- Card Body: Observation types -->
            <div class="p-6 pt-4 space-y-3">
              <div
                v-for="(t, idx) in getObservationTypes(obs)"
                :key="idx"
                :class="[t.bg, t.border, 'p-4 rounded-2xl border flex items-start gap-3']"
              >
                <div :class="[t.bg, 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5']">
                  <component :is="t.icon" :size="16" :class="t.color" />
                </div>
                <div class="min-w-0 flex-1">
                  <span :class="[t.color, 'text-[10px] font-bold uppercase tracking-widest block mb-1']">{{ t.type }}</span>
                  <p class="text-sm text-slate-700 leading-relaxed">{{ t.text }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Create / Edit Observation -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeModal"></div>

          <!-- Modal Content -->
          <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <!-- Modal Header -->
            <div class="sticky top-0 bg-white/95 backdrop-blur-sm p-8 pb-6 border-b border-slate-100 rounded-t-3xl z-10">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-black text-slate-900">
                    {{ editingObservation ? 'Editar Observación' : 'Nueva Observación' }}
                  </h2>
                  <p class="text-slate-500 text-sm mt-1">
                    {{ editingObservation ? 'Modifica los campos de esta observación.' : 'Registra una observación académica para un estudiante.' }}
                  </p>
                </div>
                <button @click="closeModal" class="bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl transition-all">
                  <X :size="20" class="text-slate-500" />
                </button>
              </div>
            </div>

            <!-- Modal Body -->
            <div class="p-8 space-y-6">
              <!-- Student selector (only for new) -->
              <div v-if="!editingObservation" class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estudiante *</label>
                <select
                  v-model="formData.studentId"
                  class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                >
                  <option :value="null">Seleccionar estudiante</option>
                  <option v-for="s in students" :key="s.id_estudiante" :value="s.id_estudiante">
                    {{ s.nombre }} {{ s.apellido }} — {{ s.codigo }}
                  </option>
                </select>
              </div>

              <!-- Editing: show student name -->
              <div v-else class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                  {{ editingObservation.nombre.charAt(0) }}
                </div>
                <div>
                  <p class="font-bold text-amber-900 text-sm">{{ editingObservation.nombre }}</p>
                  <p class="text-xs text-amber-700">Observación del {{ formatDate(editingObservation.fecha) }}</p>
                </div>
              </div>

              <!-- Date selector (only for new) -->
              <div v-if="!editingObservation" class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fecha de registro *</label>
                <input
                  type="date"
                  v-model="formData.fecha"
                  :min="allowedDateRange.min"
                  :max="allowedDateRange.max"
                  class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                />
                <p v-if="allowedDateRange.min || allowedDateRange.max" class="text-[11px] text-amber-600 font-semibold ml-1">
                  Rango del periodo: {{ formatDate(allowedDateRange.min) }} al {{ formatDate(allowedDateRange.max) }}
                </p>
              </div>

              <!-- Fortalezas -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <Award :size="12" />
                  Fortalezas
                </label>
                <textarea
                  v-model="formData.fortalezas"
                  rows="3"
                  placeholder="Describe las fortalezas observadas en el estudiante..."
                  class="w-full bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none resize-none placeholder-emerald-300"
                ></textarea>
              </div>

              <!-- Debilidades -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-rose-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <ShieldAlert :size="12" />
                  Debilidades
                </label>
                <textarea
                  v-model="formData.debilidades"
                  rows="3"
                  placeholder="Describe las debilidades observadas en el estudiante..."
                  class="w-full bg-rose-50/50 border border-rose-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-rose-500 transition-all outline-none resize-none placeholder-rose-300"
                ></textarea>
              </div>

              <!-- Recomendaciones -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-blue-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <Lightbulb :size="12" />
                  Recomendaciones
                </label>
                <textarea
                  v-model="formData.recomendaciones"
                  rows="3"
                  placeholder="Escribe recomendaciones para el estudiante..."
                  class="w-full bg-blue-50/50 border border-blue-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none placeholder-blue-300"
                ></textarea>
              </div>

              <!-- Validation message -->
              <div
                v-if="formData.fortalezas.trim() === '' && formData.debilidades.trim() === '' && formData.recomendaciones.trim() === ''"
                class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3"
              >
                <AlertCircle :size="18" class="text-amber-600 shrink-0" />
                <p class="text-sm text-amber-700 font-semibold">Rellene por lo menos un tipo de observación.</p>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="sticky bottom-0 bg-white/95 backdrop-blur-sm p-8 pt-6 border-t border-slate-100 rounded-b-3xl flex items-center justify-end gap-3">
              <button
                @click="closeModal"
                class="px-6 py-3 rounded-2xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                @click="saveObservation"
                :disabled="!formValid || saving"
                class="px-8 py-3 rounded-2xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-200/50"
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
