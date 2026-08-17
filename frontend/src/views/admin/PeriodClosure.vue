<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { 
  ArrowLeft, CheckCircle2, Lock, Unlock, SlidersHorizontal, AlertCircle, Search,
  Filter, X, LayoutGrid, Table, Zap, Check, RotateCcw, User
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { getCourseDisplayName } from '../../utils/courseHelper'
import { useAcademicYearStore } from '../../stores/academicYear'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const { confirm } = useConfirm()
const toast = useToast()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))


const loading = ref(true)
const detailsLoading = ref(false)

const periods = ref<any[]>([])
const selectedPeriodId = ref<number | null>(null)
const periodDetails = ref<any>(null)
const teachers = ref<any[]>([])

// Filter states
const filterStatus = ref<'TODOS' | 'PENDIENTE' | 'CERRADO'>('TODOS')
const selectedGrade = ref<string>('')
const selectedShift = ref<string>('')
const selectedSubject = ref<string>('')
const selectedTeacherId = ref<number | null>(null)
const presetIncompleteOnly = ref<boolean>(false)
const presetCompleteOnly = ref<boolean>(false)
const searchQuery = ref<string>('')
const viewMode = ref<'table' | 'byTeacher' | 'byGrade'>('table')

// Flattened assignments array with extra metadata
const allAssignments = computed(() => {
  const list: any[] = []
  if (!teachers.value) return list
  
  teachers.value.forEach(t => {
    if (t.asignaciones) {
      t.asignaciones.forEach((a: any) => {
        list.push({
          id_detallegrado: a.id_detallegrado,
          id_docente: t.id_docente,
          docente_nombre: t.docente_nombre,
          docente_email: t.docente_email,
          docente_cerradas: t.cerradas,
          docente_total: t.total_asignaciones,
          docente_completado: t.cerradas === t.total_asignaciones,
          materia_nombre: a.materia_nombre,
          grado_nombre: a.grado_nombre,
          seccion_nombre: a.seccion_nombre,
          jornada_nombre: a.jornada_nombre || (a.grado.split('·')[1] || '').trim(),
          curso_nombre: a.curso_nombre || (a.grado.split('·')[0] || '').trim(),
          grado: a.grado,
          estado: a.estado
        })
      })
    }
  })
  return list
})

// Unique dropdown options derived from current dataset
const availableGrades = computed(() => {
  const set = new Set<string>()
  allAssignments.value.forEach(a => {
    if (a.curso_nombre) set.add(a.curso_nombre)
  })
  return Array.from(set).sort()
})

const availableShifts = computed(() => {
  const set = new Set<string>()
  allAssignments.value.forEach(a => {
    if (a.jornada_nombre) set.add(a.jornada_nombre)
  })
  return Array.from(set).sort()
})

const availableSubjects = computed(() => {
  const set = new Set<string>()
  allAssignments.value.forEach(a => {
    if (a.materia_nombre) set.add(a.materia_nombre)
  })
  return Array.from(set).sort()
})

const availableTeachers = computed(() => {
  const map = new Map<number, string>()
  allAssignments.value.forEach(a => {
    map.set(a.id_docente, a.docente_nombre)
  })
  return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
})

// Active filters count
const activeFiltersCount = computed(() => {
  let count = 0
  if (filterStatus.value !== 'TODOS') count++
  if (selectedGrade.value) count++
  if (selectedShift.value) count++
  if (selectedSubject.value) count++
  if (selectedTeacherId.value !== null) count++
  if (presetIncompleteOnly.value) count++
  if (presetCompleteOnly.value) count++
  if (searchQuery.value.trim()) count++
  return count
})

const hasActiveFilters = computed(() => activeFiltersCount.value > 0)

const clearAllFilters = () => {
  filterStatus.value = 'TODOS'
  selectedGrade.value = ''
  selectedShift.value = ''
  selectedSubject.value = ''
  selectedTeacherId.value = null
  presetIncompleteOnly.value = false
  presetCompleteOnly.value = false
  searchQuery.value = ''
}

// Preset Toggles
const toggleIncompletePreset = () => {
  if (presetIncompleteOnly.value) {
    presetIncompleteOnly.value = false
  } else {
    presetIncompleteOnly.value = true
    presetCompleteOnly.value = false
  }
}

const toggleCompletePreset = () => {
  if (presetCompleteOnly.value) {
    presetCompleteOnly.value = false
  } else {
    presetCompleteOnly.value = true
    presetIncompleteOnly.value = false
  }
}

// Stat Card Click Handlers
const selectStatusFromCard = (status: 'TODOS' | 'PENDIENTE' | 'CERRADO') => {
  filterStatus.value = status
}

// Main Filtered Assignments logic
const filteredAssignments = computed(() => {
  let res = [...allAssignments.value]

  // Filter by Status (TODOS, PENDIENTE, CERRADO)
  if (filterStatus.value !== 'TODOS') {
    res = res.filter(a => a.estado === filterStatus.value)
  }

  // Filter by Grade / Course
  if (selectedGrade.value) {
    res = res.filter(a => a.curso_nombre === selectedGrade.value)
  }

  // Filter by Shift / Jornada
  if (selectedShift.value) {
    res = res.filter(a => a.jornada_nombre === selectedShift.value)
  }

  // Filter by Subject / Materia
  if (selectedSubject.value) {
    res = res.filter(a => a.materia_nombre === selectedSubject.value)
  }

  // Filter by Teacher
  if (selectedTeacherId.value !== null) {
    res = res.filter(a => a.id_docente === selectedTeacherId.value)
  }

  // Preset: Solo docentes con materias pendientes
  if (presetIncompleteOnly.value) {
    res = res.filter(a => !a.docente_completado)
  }

  // Preset: Solo docentes 100% al día
  if (presetCompleteOnly.value) {
    res = res.filter(a => a.docente_completado)
  }

  // Text search
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    res = res.filter(a => 
      a.docente_nombre.toLowerCase().includes(q) ||
      a.docente_email.toLowerCase().includes(q) ||
      a.materia_nombre.toLowerCase().includes(q) ||
      a.grado.toLowerCase().includes(q)
    )
  }

  return res
})

// Grouped by Teacher view model
const groupedByTeacher = computed(() => {
  const map = new Map<number, {
    id_docente: number
    docente_nombre: string
    docente_email: string
    total: number
    cerradas: number
    pendientes: number
    asignaciones: any[]
  }>()

  filteredAssignments.value.forEach(asig => {
    if (!map.has(asig.id_docente)) {
      map.set(asig.id_docente, {
        id_docente: asig.id_docente,
        docente_nombre: asig.docente_nombre,
        docente_email: asig.docente_email,
        total: 0,
        cerradas: 0,
        pendientes: 0,
        asignaciones: []
      })
    }
    const t = map.get(asig.id_docente)!
    t.asignaciones.push(asig)
    t.total++
    if (asig.estado === 'CERRADO') t.cerradas++
    else t.pendientes++
  })

  return Array.from(map.values()).sort((a, b) => b.pendientes - a.pendientes || a.docente_nombre.localeCompare(b.docente_nombre))
})

// Grouped by Grade view model
const groupedByGrade = computed(() => {
  const map = new Map<string, {
    curso_nombre: string
    jornada_nombre: string
    total: number
    cerradas: number
    pendientes: number
    asignaciones: any[]
  }>()

  filteredAssignments.value.forEach(asig => {
    const key = asig.grado
    if (!map.has(key)) {
      map.set(key, {
        curso_nombre: asig.curso_nombre,
        jornada_nombre: asig.jornada_nombre,
        total: 0,
        cerradas: 0,
        pendientes: 0,
        asignaciones: []
      })
    }
    const g = map.get(key)!
    g.asignaciones.push(asig)
    g.total++
    if (asig.estado === 'CERRADO') g.cerradas++
    else g.pendientes++
  })

  return Array.from(map.values()).sort((a, b) => b.pendientes - a.pendientes || a.curso_nombre.localeCompare(b.curso_nombre))
})

const closingPeriod = ref(false)
const closePeriodPending = ref<any[]>([])
const forceCloseModal = ref(false)

const loadInitialData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const params: any = { keys: 'periods' }
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const response = await axios.get(`/api/academic-admin/settings/${schoolId.value}`, { params })
    periods.value = (response.data.periods || []).filter((p: any) => p.estado !== 'PENDIENTE')
    const openPeriod = periods.value.find(p => p.estado === 'ABIERTO')
    if (openPeriod) {
      selectedPeriodId.value = openPeriod.id_periodo
    } else if (periods.value.length > 0) {
      selectedPeriodId.value = periods.value[0].id_periodo
    } else {
      selectedPeriodId.value = null
      periodDetails.value = null
      teachers.value = []
    }
  } catch (error) {
    console.error('Error loading periods:', error)
  } finally {
    loading.value = false
  }
}

watch(() => yearStore.selectedYearId, () => {
  selectedPeriodId.value = null
  loadInitialData()
})

const loadClosureDetails = async () => {
  if (!schoolId.value || !selectedPeriodId.value) return
  try {
    detailsLoading.value = true
    closePeriodPending.value = []
    forceCloseModal.value = false
    const response = await axios.get(
      `/api/academic-admin/settings/closure-details/${schoolId.value}/${selectedPeriodId.value}`
    )
    periodDetails.value = response.data.periodo
    teachers.value = response.data.teachers
  } catch (error) {
    console.error('Error loading closure details:', error)
    periodDetails.value = null
    teachers.value = []
  } finally {
    detailsLoading.value = false
  }
}

watch(selectedPeriodId, () => {
  if (selectedPeriodId.value) {
    loadClosureDetails()
  }
})

const totalPending = computed(() => {
  let count = 0
  teachers.value.forEach(t => {
    t.asignaciones.forEach((a: any) => {
      if (a.estado !== 'CERRADO') count++
    })
  })
  return count
})

const totalClosed = computed(() => {
  let count = 0
  teachers.value.forEach(t => {
    count += t.cerradas
  })
  return count
})

const totalAssignmentsCount = computed(() => {
  return teachers.value.reduce((sum, t) => sum + t.total_asignaciones, 0)
})

const attemptClosePeriod = async (force = false) => {
  if (!selectedPeriodId.value) return
  try {
    closingPeriod.value = true
    await axios.post(`/api/academic-admin/settings/periods/${selectedPeriodId.value}/close`, {
      schoolId: schoolId.value,
      force,
    })
    
    forceCloseModal.value = false
    closePeriodPending.value = []
    
    if (periodDetails.value) {
      periodDetails.value.estado = 'CERRADO'
    }
    const targetPeriod = periods.value.find(p => p.id_periodo === selectedPeriodId.value)
    if (targetPeriod) targetPeriod.estado = 'CERRADO'
    
    await loadClosureDetails()
  } catch (error: any) {
    if (error.response?.status === 409 && error.response?.data?.pending) {
      forceCloseModal.value = true
      closePeriodPending.value = error.response.data.pending
      return
    }
    alert(error.response?.data?.error || 'No fue posible cerrar el periodo')
  } finally {
    closingPeriod.value = false
  }
}

const reopeningPeriod = ref(false)

const attemptReopenPeriod = async () => {
  if (!selectedPeriodId.value) return
  const ok = await confirm({
    title: 'Reabrir Periodo Académico',
    message: '¿Estás seguro de que deseas REABRIR el periodo académico? Esto cambiará globalmente el estado del periodo de nuevo a ABIERTO.',
    confirmText: 'Reabrir Periodo',
    type: 'warning'
  })
  if (!ok) return
  
  try {
    reopeningPeriod.value = true
    await axios.post(`/api/academic-admin/settings/periods/${selectedPeriodId.value}/reopen`, {
      schoolId: schoolId.value
    })
    
    if (periodDetails.value) {
      periodDetails.value.estado = 'ABIERTO'
    }
    const targetPeriod = periods.value.find(p => p.id_periodo === selectedPeriodId.value)
    if (targetPeriod) targetPeriod.estado = 'ABIERTO'
    
    toast.success('Periodo reabierto correctamente')
    await loadClosureDetails()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'No fue posible reabrir el periodo')
  } finally {
    reopeningPeriod.value = false
  }
}

const reopeningSubject = ref<number | null>(null)

const attemptReopenSubject = async (curso: any) => {
  if (!selectedPeriodId.value) return
  const ok = await confirm({
    title: 'Deshacer Cierre de Materia',
    message: `¿Estás seguro de que deseas DESHACER el cierre de ${curso.grado || curso.materia_nombre}? El docente podrá volver a modificar e ingresar notas.`,
    confirmText: 'Deshacer Cierre',
    type: 'warning'
  })
  if (!ok) return
  
  try {
    reopeningSubject.value = curso.id_detallegrado
    await axios.post(`/api/academic-admin/settings/periods/${selectedPeriodId.value}/reopen-subject/${curso.id_detallegrado}`, {
      schoolId: schoolId.value
    })
    
    toast.success('Cierre de materia deshecho exitosamente')
    await loadClosureDetails()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'No fue posible deshacer el cierre de esta materia.')
  } finally {
    reopeningSubject.value = null
  }
}


onMounted(() => {
  loadInitialData()
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    
    <!-- Header -->
    <div class="flex items-center gap-4">
      <router-link to="/dashboard/configuracion-academica" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-100 dark:border-slate-800">
        <ArrowLeft class="h-5 w-5" />
      </router-link>
      <div>
        <h1 class="text-3xl font-black text-slate-900 dark:text-white">Control de Cierre de Periodo</h1>
        <p class="mt-1 text-slate-500 dark:text-slate-400">Supervisa qué docentes han finalizado la carga académica y ejecuta cierres formales de notas.</p>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 text-center font-bold text-slate-400 shadow-sm">
      Cargando configuración...
    </div>

    <template v-else>
      <div class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <!-- Selector Header -->
        <div class="border-b border-slate-100 dark:border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-3 text-rose-600 dark:text-rose-400">
              <Lock class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white">Seleccionar periodo</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Puedes ver estados y forzar el cierre del periodo en curso.</p>
            </div>
          </div>
          <select 
            v-model="selectedPeriodId"
            class="min-w-[200px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 font-black text-slate-900 dark:text-slate-100 outline-none focus:border-rose-300 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-shadow"
          >
            <option :value="null">Selecciona un periodo</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }} ({{ p.estado }})
            </option>
          </select>
        </div>

        <div v-if="selectedPeriodId && !detailsLoading" class="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-900/50 space-y-6">
          
          <!-- Top Interactive KPI Stat Cards & Status Actions -->
          <div v-if="periodDetails" class="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
            <!-- Interactive KPI Cards -->
            <div class="grid grid-cols-3 gap-3 w-full lg:w-auto">
              <!-- Total Card -->
              <button 
                @click="selectStatusFromCard('TODOS')"
                class="flex flex-col text-left rounded-2xl border px-4 py-3 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
                :class="[
                  filterStatus === 'TODOS' && !presetIncompleteOnly && !presetCompleteOnly
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 ring-2 ring-slate-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-300'
                ]"
              >
                <span class="text-[10px] font-black uppercase tracking-widest opacity-60">Total</span>
                <span class="text-2xl font-black mt-1">{{ totalAssignmentsCount }}</span>
              </button>

              <!-- Cerrados Card -->
              <button 
                @click="selectStatusFromCard('CERRADO')"
                class="flex flex-col text-left rounded-2xl border px-4 py-3 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
                :class="[
                  filterStatus === 'CERRADO' 
                    ? 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-500/20'
                    : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 hover:border-emerald-300'
                ]"
              >
                <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300" :class="filterStatus === 'CERRADO' ? 'text-white' : ''">Cerrados</span>
                <span class="text-2xl font-black mt-1 text-emerald-700 dark:text-emerald-300" :class="filterStatus === 'CERRADO' ? 'text-white' : ''">{{ totalClosed }}</span>
              </button>

              <!-- Faltantes Card -->
              <button 
                @click="selectStatusFromCard('PENDIENTE')"
                class="flex flex-col text-left rounded-2xl border px-4 py-3 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
                :class="[
                  filterStatus === 'PENDIENTE' 
                    ? 'border-amber-600 bg-amber-600 text-white ring-2 ring-amber-500/20'
                    : 'border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:border-amber-300'
                ]"
              >
                <span class="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300" :class="filterStatus === 'PENDIENTE' ? 'text-white' : ''">Faltantes</span>
                <span class="text-2xl font-black mt-1 text-amber-700 dark:text-amber-300" :class="filterStatus === 'PENDIENTE' ? 'text-white' : ''">{{ totalPending }}</span>
              </button>
            </div>

            <!-- Status Badge and Period Actions -->
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2 mr-2">
                <span class="h-3 w-3 rounded-full bg-emerald-500" v-if="periodDetails.estado === 'ABIERTO'"></span>
                <span class="h-3 w-3 rounded-full bg-amber-500" v-else-if="periodDetails.estado === 'PENDIENTE'"></span>
                <span class="h-3 w-3 rounded-full bg-slate-400 dark:bg-slate-500" v-else></span>
                <span 
                  class="text-sm font-black tracking-wide" 
                  :class="[
                    periodDetails.estado === 'ABIERTO' ? 'text-emerald-700 dark:text-emerald-400' : 
                    periodDetails.estado === 'PENDIENTE' ? 'text-amber-700 dark:text-amber-400' : 
                    'text-slate-700 dark:text-slate-300'
                  ]"
                >
                  PERIODO {{ periodDetails.estado }}
                </span>
              </div>

              <template v-if="periodDetails.estado === 'ABIERTO'">
                <button
                  type="button"
                  @click="attemptClosePeriod(false)"
                  :disabled="closingPeriod"
                  class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-rose-500 disabled:opacity-50 hover:shadow-rose-600/20"
                >
                  <Lock class="h-4 w-4" />
                  {{ closingPeriod ? 'Procesando...' : 'Proceder con Cierre' }}
                </button>
              </template>
              <template v-else-if="periodDetails.estado === 'PENDIENTE'">
                <div class="flex flex-col sm:flex-row items-center gap-4">
                  <div class="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl text-amber-700 dark:text-amber-400 font-bold text-xs flex gap-2 items-center border border-amber-200 dark:border-amber-900/40">
                    <AlertCircle class="w-5 h-5 shrink-0" />
                    <span>Periodo pendiente de aprobación. No se pueden gestionar cierres.</span>
                  </div>
                  <router-link
                    to="/dashboard/configuracion-academica/periodos"
                    class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-black text-white hover:bg-amber-600 transition-all shadow-md shadow-amber-200/50 dark:shadow-none"
                  >
                    <span>Configurar y Aprobar</span>
                  </router-link>
                </div>
              </template>
              <template v-else>
                <div class="px-5 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 font-bold text-sm flex gap-2 items-center border border-slate-200 dark:border-slate-700">
                  <CheckCircle2 class="w-5 h-5" />
                  Cierre Completado
                </div>
                <button
                  type="button"
                  @click="attemptReopenPeriod"
                  :disabled="reopeningPeriod"
                  class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-slate-700 px-6 py-3 text-sm font-black transition-all hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50 ring-1 ring-inset ring-slate-200 hover:ring-amber-200"
                  title="Permite volver a recibir correcciones temporalmente"
                >
                  <Unlock class="h-4 w-4" />
                  {{ reopeningPeriod ? 'Abriendo...' : 'Reabrir Periodo' }}
                </button>
              </template>
            </div>
          </div>

          <div v-if="teachers.length === 0" class="text-center py-20 opacity-60">
            <SlidersHorizontal class="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 class="text-lg font-bold text-slate-600 dark:text-slate-300">Sin carga académica</h3>
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">No hay docentes asignados en este periodo.</p>
          </div>

          <div v-else class="space-y-6">

            <!-- FILTER CONTROL PANEL -->
            <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
              
              <!-- Row 1: Header title, View mode toggles & Status tabs -->
              <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div class="flex items-center gap-2">
                  <Filter class="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <h3 class="text-base font-black text-slate-900 dark:text-white">Filtros Interactivos de Control</h3>
                  <span v-if="hasActiveFilters" class="ml-2 px-2.5 py-0.5 text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 rounded-full">
                    {{ activeFiltersCount }} {{ activeFiltersCount === 1 ? 'activo' : 'activos' }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <!-- View Mode Selector -->
                  <div class="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
                    <button 
                      @click="viewMode = 'table'"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      :class="viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                      title="Vista en tabla de asignaciones"
                    >
                      <Table class="w-3.5 h-3.5" />
                      <span>Tabla</span>
                    </button>
                    <button 
                      @click="viewMode = 'byTeacher'"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      :class="viewMode === 'byTeacher' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                      title="Vista agrupada por docente"
                    >
                      <User class="w-3.5 h-3.5" />
                      <span>Por Docente</span>
                    </button>
                    <button 
                      @click="viewMode = 'byGrade'"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      :class="viewMode === 'byGrade' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                      title="Vista agrupada por curso / grado"
                    >
                      <LayoutGrid class="w-3.5 h-3.5" />
                      <span>Por Grado</span>
                    </button>
                  </div>

                  <!-- Status Filter Tabs -->
                  <div class="flex bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-2xl">
                    <button 
                      @click="filterStatus = 'TODOS'"
                      class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                      :class="filterStatus === 'TODOS' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
                    >Todos</button>
                    <button 
                      @click="filterStatus = 'PENDIENTE'"
                      class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                      :class="filterStatus === 'PENDIENTE' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600/70 hover:text-amber-700 dark:hover:text-amber-400'"
                    >Pendientes</button>
                    <button 
                      @click="filterStatus = 'CERRADO'"
                      class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                      :class="filterStatus === 'CERRADO' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600/70 hover:text-emerald-700 dark:hover:text-emerald-400'"
                    >Cerrados</button>
                  </div>
                </div>
              </div>

              <!-- Row 2: Multi-dimensional Select Controls & Search -->
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                
                <!-- Search bar -->
                <div class="sm:col-span-2 md:col-span-2 lg:col-span-2 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 hover:border-slate-300 transition-colors focus-within:ring-4 focus-within:ring-rose-500/10 focus-within:border-rose-300">
                  <Search class="w-4 h-4 text-slate-400 shrink-0" />
                  <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Buscar por docente, materia o curso..."
                    class="bg-transparent border-none outline-none w-full text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 py-1"
                  />
                  <button v-if="searchQuery" @click="searchQuery = ''" class="text-slate-400 hover:text-slate-600">
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Grade Filter Dropdown -->
                <div>
                  <select 
                    v-model="selectedGrade"
                    class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-rose-300 transition-colors"
                  >
                    <option value="">Todos los cursos</option>
                    <option v-for="g in availableGrades" :key="g" :value="g">{{ g }}</option>
                  </select>
                </div>

                <!-- Shift Filter Dropdown -->
                <div>
                  <select 
                    v-model="selectedShift"
                    class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-rose-300 transition-colors"
                  >
                    <option value="">Todas las jornadas</option>
                    <option v-for="s in availableShifts" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>

                <!-- Subject Filter Dropdown -->
                <div>
                  <select 
                    v-model="selectedSubject"
                    class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-rose-300 transition-colors"
                  >
                    <option value="">Todas las materias</option>
                    <option v-for="m in availableSubjects" :key="m" :value="m">{{ m }}</option>
                  </select>
                </div>
              </div>

              <!-- Row 3: Presets & Clear Filters -->
              <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
                  
                  <!-- Preset 1: Solo Docentes Incompletos -->
                  <button 
                    @click="toggleIncompletePreset"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    :class="presetIncompleteOnly ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
                  >
                    <Zap class="w-3.5 h-3.5 text-amber-300" :class="presetIncompleteOnly ? 'text-white' : ''" />
                    <span>Solo Docentes Incompletos</span>
                  </button>

                  <!-- Preset 2: Docentes 100% al dia -->
                  <button 
                    @click="toggleCompletePreset"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    :class="presetCompleteOnly ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
                  >
                    <Check class="w-3.5 h-3.5 text-emerald-300" :class="presetCompleteOnly ? 'text-white' : ''" />
                    <span>100% al Día</span>
                  </button>

                  <!-- Specific Teacher Selector -->
                  <select 
                    v-model="selectedTeacherId"
                    class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-rose-300"
                  >
                    <option :value="null">Todos los docentes</option>
                    <option v-for="t in availableTeachers" :key="t.id" :value="t.id">{{ t.nombre }}</option>
                  </select>
                </div>

                <!-- Clear Filters Button -->
                <button 
                  v-if="hasActiveFilters"
                  @click="clearAllFilters"
                  class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 hover:bg-rose-100 transition-all cursor-pointer"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  <span>Limpiar Filtros</span>
                </button>
              </div>

              <!-- Active Filter Chips Bar -->
              <div v-if="hasActiveFilters" class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros aplicados:</span>
                
                <span v-if="filterStatus !== 'TODOS'" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
                  Estado: {{ filterStatus }}
                  <X @click="filterStatus = 'TODOS'" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>

                <span v-if="selectedGrade" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
                  Curso: {{ selectedGrade }}
                  <X @click="selectedGrade = ''" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>

                <span v-if="selectedShift" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
                  Jornada: {{ selectedShift }}
                  <X @click="selectedShift = ''" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>

                <span v-if="selectedSubject" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
                  Materia: {{ selectedSubject }}
                  <X @click="selectedSubject = ''" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>

                <span v-if="selectedTeacherId !== null" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
                  Docente: {{ availableTeachers.find(t => t.id === selectedTeacherId)?.nombre }}
                  <X @click="selectedTeacherId = null" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>

                <span v-if="presetIncompleteOnly" class="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300">
                  Incompletos
                  <X @click="presetIncompleteOnly = false" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>

                <span v-if="presetCompleteOnly" class="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  100% al Día
                  <X @click="presetCompleteOnly = false" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>

                <span v-if="searchQuery" class="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  "{{ searchQuery }}"
                  <X @click="searchQuery = ''" class="w-3 h-3 cursor-pointer hover:text-rose-500" />
                </span>
              </div>
            </div>

            <!-- Empty Results View -->
            <div v-if="filteredAssignments.length === 0" class="text-center py-16 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
              <Search class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 class="text-lg font-bold text-slate-600 dark:text-slate-300">No se encontraron resultados</h3>
              <p class="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-md mx-auto">
                No hay asignaciones que coincidan con la combinación de filtros seleccionados. Pruebe limpiando algunos filtros.
              </p>
              <button @click="clearAllFilters" class="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-colors">
                <RotateCcw class="w-4 h-4" />
                <span>Limpiar todos los filtros</span>
              </button>
            </div>

            <!-- MODE 1: FLAT DETAILED TABLE VIEW -->
            <div v-else-if="viewMode === 'table'" class="overflow-x-auto bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all">
              <div class="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Mostrando {{ filteredAssignments.length }} asignaciones</span>
              </div>
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Docente</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Asignatura / Materia</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Curso / Grupo</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center">Estado</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50 dark:divide-slate-700/50">
                  <tr 
                    v-for="asig in filteredAssignments" 
                    :key="asig.id_detallegrado"
                    class="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group"
                  >
                    <td class="p-5">
                      <div class="font-extrabold text-slate-900 dark:text-slate-100">
                        {{ asig.docente_nombre }}
                      </div>
                      <div class="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                        {{ asig.docente_email }}
                      </div>
                    </td>
                    <td class="p-5">
                      <span class="font-bold text-slate-700 dark:text-slate-300">
                        {{ asig.materia_nombre }}
                      </span>
                    </td>
                    <td class="p-5">
                      <span class="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl px-3 py-1.5 text-xs border border-indigo-100/30">
                        {{ asig.grado }}
                      </span>
                    </td>
                    <td class="p-5 text-center">
                      <span 
                        class="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full ring-1 ring-inset"
                        :class="asig.estado === 'CERRADO' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-500/20' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 ring-rose-500/20'"
                      >
                        {{ asig.estado }}
                      </span>
                    </td>
                    <td class="p-5 text-right">
                      <div class="flex justify-end items-center gap-2">
                        <button
                          v-if="asig.estado === 'CERRADO'"
                          @click="attemptReopenSubject(asig)"
                          :disabled="reopeningSubject === asig.id_detallegrado"
                          class="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 hover:bg-amber-100 transition-all dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40 disabled:opacity-50 border border-amber-200/30 cursor-pointer"
                          title="Habilitar docente para modificar e ingresar calificaciones"
                        >
                          <Unlock class="w-3.5 h-3.5" />
                          <span>Habilitar</span>
                        </button>
                        <span v-else class="text-xs font-bold text-slate-400 dark:text-slate-500 italic pr-3 select-none">
                          No requiere acción
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- MODE 2: GROUPED BY TEACHER CARDS -->
            <div v-else-if="viewMode === 'byTeacher'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                v-for="tGroup in groupedByTeacher" 
                :key="tGroup.id_docente"
                class="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-200 transition-all"
              >
                <div>
                  <!-- Teacher Card Header -->
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 class="font-extrabold text-slate-900 dark:text-white text-base">{{ tGroup.docente_nombre }}</h4>
                      <p class="text-xs text-slate-400 dark:text-slate-500 font-semibold">{{ tGroup.docente_email }}</p>
                    </div>
                    <span 
                      class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                      :class="tGroup.pendientes === 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'"
                    >
                      {{ tGroup.pendientes === 0 ? '100% Completo' : `${tGroup.pendientes} Pendientes` }}
                    </span>
                  </div>

                  <!-- Progress Bar -->
                  <div class="space-y-1.5 mb-4">
                    <div class="flex justify-between text-xs font-bold text-slate-500">
                      <span>Progreso de Cierre</span>
                      <span>{{ tGroup.cerradas }} / {{ tGroup.total }} materias ({{ Math.round((tGroup.cerradas / tGroup.total) * 100) }}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div 
                        class="h-full rounded-full transition-all duration-500"
                        :class="tGroup.cerradas === tGroup.total ? 'bg-emerald-500' : 'bg-amber-500'"
                        :style="{ width: `${(tGroup.cerradas / tGroup.total) * 100}%` }"
                      ></div>
                    </div>
                  </div>

                  <!-- Assigned Subjects List -->
                  <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <div 
                      v-for="asig in tGroup.asignaciones" 
                      :key="asig.id_detallegrado"
                      class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 text-xs"
                    >
                      <div>
                        <p class="font-black text-slate-800 dark:text-slate-200">{{ asig.materia_nombre }}</p>
                        <p class="text-[11px] text-slate-400 font-semibold">{{ asig.grado }}</p>
                      </div>
                      
                      <div class="flex items-center gap-2">
                        <span 
                          class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                          :class="asig.estado === 'CERRADO' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'"
                        >
                          {{ asig.estado }}
                        </span>

                        <button
                          v-if="asig.estado === 'CERRADO'"
                          @click="attemptReopenSubject(asig)"
                          :disabled="reopeningSubject === asig.id_detallegrado"
                          class="p-1.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200 transition-colors"
                          title="Habilitar materia"
                        >
                          <Unlock class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- MODE 3: GROUPED BY GRADE CARDS -->
            <div v-else-if="viewMode === 'byGrade'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                v-for="gGroup in groupedByGrade" 
                :key="gGroup.curso_nombre + gGroup.jornada_nombre"
                class="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-200 transition-all"
              >
                <div>
                  <!-- Grade Card Header -->
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 class="font-extrabold text-slate-900 dark:text-white text-base">{{ gGroup.curso_nombre }}</h4>
                      <p class="text-xs text-slate-400 dark:text-slate-500 font-semibold">Jornada: {{ gGroup.jornada_nombre }}</p>
                    </div>
                    <span 
                      class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                      :class="gGroup.pendientes === 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'"
                    >
                      {{ gGroup.pendientes === 0 ? 'Listo para Boletines' : `${gGroup.pendientes} Incompletas` }}
                    </span>
                  </div>

                  <!-- Progress Bar -->
                  <div class="space-y-1.5 mb-4">
                    <div class="flex justify-between text-xs font-bold text-slate-500">
                      <span>Estado Consolidación del Grado</span>
                      <span>{{ gGroup.cerradas }} / {{ gGroup.total }} materias ({{ Math.round((gGroup.cerradas / gGroup.total) * 100) }}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div 
                        class="h-full rounded-full transition-all duration-500"
                        :class="gGroup.cerradas === gGroup.total ? 'bg-emerald-500' : 'bg-indigo-500'"
                        :style="{ width: `${(gGroup.cerradas / gGroup.total) * 100}%` }"
                      ></div>
                    </div>
                  </div>

                  <!-- Grade Subjects Breakdown -->
                  <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <div 
                      v-for="asig in gGroup.asignaciones" 
                      :key="asig.id_detallegrado"
                      class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 text-xs"
                    >
                      <div>
                        <p class="font-black text-slate-800 dark:text-slate-200">{{ asig.materia_nombre }}</p>
                        <p class="text-[11px] text-slate-400 font-semibold">Docente: {{ asig.docente_nombre }}</p>
                      </div>
                      
                      <div class="flex items-center gap-2">
                        <span 
                          class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                          :class="asig.estado === 'CERRADO' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'"
                        >
                          {{ asig.estado }}
                        </span>

                        <button
                          v-if="asig.estado === 'CERRADO'"
                          @click="attemptReopenSubject(asig)"
                          :disabled="reopeningSubject === asig.id_detallegrado"
                          class="p-1.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200 transition-colors"
                          title="Habilitar materia"
                        >
                          <Unlock class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
        <div v-else-if="detailsLoading" class="p-16 text-center text-slate-400 font-bold">
          Obteniendo estado de cierres...
        </div>
      </div>
    </template>

    <!-- Force Close Modal -->
    <div v-if="forceCloseModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md">
      <div class="w-full max-w-2xl rounded-[28px] bg-white dark:bg-slate-900 shadow-2xl">
        <div class="border-b border-slate-100 dark:border-slate-800 px-6 py-5 md:px-8">
          <div class="flex gap-3 items-center text-rose-600 dark:text-rose-500 mb-2">
            <AlertCircle class="w-8 h-8" />
            <h2 class="text-2xl font-black text-slate-900 dark:text-white">Cierre Forzado Requerido</h2>
          </div>
          <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Aún existen {{ closePeriodPending.length }} asignaciones que los docentes no han marcado como completadas.
          </p>
        </div>
        <div class="px-6 py-6 md:px-8 md:py-8">
          
          <div class="rounded-3xl border border-rose-100 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-5 mb-6">
            <p class="text-sm font-black text-rose-800 dark:text-rose-300">
              Si procedes, el sistema insertará registros de cierre forzoso en cada una de las materias listadas. Esto bloqueará la posibilidad de que los docentes implicados suban notas o modifiquen su registro posteriormente.
            </p>
          </div>

          <div class="max-h-60 overflow-y-auto pr-2 space-y-3">
            <div v-for="item in closePeriodPending" :key="item.id_detallegrado" class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm">
              <div>
                <p class="font-black text-slate-700 dark:text-slate-200">{{ item.materia_nombre }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">{{ getCourseDisplayName({ tipo_grado_nombre: item.tipo_grado_nombre, seccion_nombre: item.seccion_nombre }) }} · {{ item.jornada_nombre }}</p>
              </div>
              <span class="inline-flex bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider">Pendiente</span>
            </div>
          </div>

          <div class="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
            <button type="button" @click="forceCloseModal = false" class="rounded-2xl border border-slate-200 dark:border-slate-700 px-6 py-4 text-sm font-black text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button type="button" @click="attemptClosePeriod(true)" :disabled="closingPeriod" class="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-8 py-4 text-base font-black text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50">
              <Lock class="w-5 h-5" />
              {{ closingPeriod ? 'Procesando...' : 'Confirmar Cierre Forzado' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
