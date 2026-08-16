<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import {
  Award,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  UserCheck,
  GraduationCap,
  Layers3,
  Calendar,
  AlertOctagon,
  Save,
  Edit,
  Users,
  BookOpen,
  RefreshCw,
  ShieldAlert
} from 'lucide-vue-next'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()

const formatDecisionLabel = (decision: string) => {
  if (!decision) return ''
  switch (decision) {
    case 'PROMOVER_SIGUIENTE_GRADO':
      return 'Promover al siguiente grado'
    case 'MANTENER_GRADO':
      return 'Mantener en el mismo grado'
    case 'MATRICULA_CONDICIONADA':
      return 'Matrícula condicionada'
    case 'OTRA_DECISION':
      return 'Otra decisión académica'
    default:
      return decision.replace(/_/g, ' ')
  }
}

const activeTab = ref<'period' | 'annual' | 'history'>('period')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Filtros principales
const selectedYearId = ref<number | null>(null)
const selectedPeriodId = ref<number | null>(null)
const isCumulativeMode = ref(true)
const cumulativePeriodOrder = ref<number>(1)
const selectedGradeId = ref<number | ''>('')
const selectedGroupId = ref<number | ''>('')
const searchQuery = ref('')

// Catálogos
const years = ref<any[]>([])
const periods = ref<any[]>([])
const grades = ref<any[]>([])
const groups = ref<any[]>([])

// Datos de seguimiento por período / acumulativo
const trackingData = ref<{
  total_estudiantes: number
  aprobados_count: number
  reprobados_count: number
  sin_calificar_count?: number
  min_passing_score: number
  periodos_analizados: number[]
  estudiantes: any[]
}>({
  total_estudiantes: 0,
  aprobados_count: 0,
  reprobados_count: 0,
  sin_calificar_count: 0,
  min_passing_score: 3.0,
  periodos_analizados: [],
  estudiantes: []
})

// Datos de consolidado anual
const annualData = ref<{
  total_estudiantes: number
  promovidos_count: number
  no_promovidos_count: number
  pendientes_count: number
  min_passing_score: number
  total_periodos?: number
  periodos_cerrados?: number
  habilitado_para_promocion?: boolean
  estudiantes: any[]
}>({
  total_estudiantes: 0,
  promovidos_count: 0,
  no_promovidos_count: 0,
  pendientes_count: 0,
  min_passing_score: 3.0,
  total_periodos: 4,
  periodos_cerrados: 0,
  habilitado_para_promocion: true,
  estudiantes: []
})

// Búsqueda de historial de estudiante
const historySearchQuery = ref('')
const studentHistory = ref<any>(null)
const historyLoading = ref(false)

// Estado de filas expandidas
const expandedStudentId = ref<number | null>(null)
const toggleStudentExpand = (id: number) => {
  expandedStudentId.value = expandedStudentId.value === id ? null : id
}

// Modal de Registro de Decisión del Directivo
const showDecisionModal = ref(false)
const targetStudentForDecision = ref<any>(null)
const decisionForm = ref({
  decisionTaken: 'PROMOVER_SIGUIENTE_GRADO',
  assignedGradeId: '' as number | '',
  observation: ''
})

const schoolId = computed(() => auth.selectedSchoolId || (auth.user as any)?.id_colegio || (auth.user?.schoolId ? Number(auth.user.schoolId) : undefined))

// Cargar catálogos iniciales
const loadCatalogs = async () => {
  if (!schoolId.value) return
  loading.value = true
  try {
    const yearIdParam = yearStore.selectedYearId ? `?yearId=${yearStore.selectedYearId}&keys=years,periods` : '?keys=years,periods'
    const [settingsRes, gradesRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/academic-admin/settings/${schoolId.value}${yearIdParam}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      }),
      axios.get(`${API_BASE_URL}/api/academic-admin/grades/${schoolId.value}${yearIdParam}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
    ])

    years.value = settingsRes.data.academicYears || settingsRes.data.years || []
    periods.value = settingsRes.data.periods || []
    grades.value = gradesRes.data.tiposGrado || gradesRes.data.grados || gradesRes.data.grades || []
    groups.value = gradesRes.data.grupos || gradesRes.data.groups || []

    if (yearStore.selectedYearId && years.value.some((y: any) => Number(y.id_anio) === Number(yearStore.selectedYearId))) {
      selectedYearId.value = Number(yearStore.selectedYearId)
    } else if (years.value.length > 0 && !selectedYearId.value) {
      selectedYearId.value = years.value[0].id_anio
    }

    if (periods.value.length > 0 && !selectedPeriodId.value) {
      selectedPeriodId.value = periods.value[0].id_periodo
      cumulativePeriodOrder.value = periods.value.length
    }
  } catch (err: any) {
    console.error("Error al cargar catálogos:", err)
    errorMessage.value = "Error al cargar la información inicial."
  } finally {
    loading.value = false
  }
}

// Filtrar períodos pertenecientes al año seleccionado
const availablePeriodsForYear = computed(() => {
  if (!selectedYearId.value) return periods.value
  return periods.value.filter(p => p.id_anio === selectedYearId.value)
})

// Filtrar grupos por el grado seleccionado
const filteredGroups = computed(() => {
  if (!selectedGradeId.value) return groups.value
  return groups.value.filter(g => g.id_tipo_grado === selectedGradeId.value || g.id_grado === selectedGradeId.value)
})

const showOnlyGraduands = ref(false)

// Filtrar estudiantes por texto de búsqueda y por graduandos
const filteredPeriodStudents = computed(() => {
  let list = trackingData.value.estudiantes || []
  if (showOnlyGraduands.value) {
    list = list.filter(s => s.is_final_grade || s.es_ultimo_grado)
  }
  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.toLowerCase().trim()
  return list.filter(s =>
    (s.nombre && s.nombre.toLowerCase().includes(q)) ||
    (s.apellido && s.apellido.toLowerCase().includes(q)) ||
    (s.documento && s.documento.toLowerCase().includes(q)) ||
    (s.grado_nombre && s.grado_nombre.toLowerCase().includes(q))
  )
})

const filteredAnnualStudents = computed(() => {
  let list = annualData.value.estudiantes || []
  if (showOnlyGraduands.value) {
    list = list.filter(s => s.is_final_grade || s.es_ultimo_grado)
  }
  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.toLowerCase().trim()
  return list.filter(s =>
    (s.nombre && s.nombre.toLowerCase().includes(q)) ||
    (s.apellido && s.apellido.toLowerCase().includes(q)) ||
    (s.documento && s.documento.toLowerCase().includes(q)) ||
    (s.grado_nombre && s.grado_nombre.toLowerCase().includes(q))
  )
})

// Cargar seguimiento por período / acumulativo
const fetchPeriodTracking = async () => {
  if (!schoolId.value || !selectedYearId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const params: any = {
      schoolId: schoolId.value,
      yearId: selectedYearId.value
    }

    if (isCumulativeMode.value) {
      params.cumulativeUpToPeriodOrder = cumulativePeriodOrder.value
    } else if (selectedPeriodId.value) {
      params.periodId = selectedPeriodId.value
    }

    if (selectedGradeId.value) params.gradeId = selectedGradeId.value
    if (selectedGroupId.value) params.groupId = selectedGroupId.value

    const response = await axios.get(`${API_BASE_URL}/api/academic-admin/academic-tracking/period-tracking`, {
      params,
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    trackingData.value = response.data
  } catch (err: any) {
    console.error("Error al cargar seguimiento por período:", err)
    errorMessage.value = err.response?.data?.error || "Error al consultar el seguimiento académico."
  } finally {
    loading.value = false
  }
}

// Cargar consolidado anual
const fetchAnnualConsolidation = async () => {
  if (!schoolId.value || !selectedYearId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const params: any = {
      schoolId: schoolId.value,
      yearId: selectedYearId.value
    }
    if (selectedGradeId.value) params.gradeId = selectedGradeId.value
    if (selectedGroupId.value) params.groupId = selectedGroupId.value

    const response = await axios.get(`${API_BASE_URL}/api/academic-admin/academic-tracking/annual-consolidation`, {
      params,
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    annualData.value = response.data
  } catch (err: any) {
    console.error("Error al cargar consolidación anual:", err)
    errorMessage.value = err.response?.data?.error || "Error al consultar la consolidación anual."
  } finally {
    loading.value = false
  }
}

// Buscar historial de estudiante
const searchStudentHistory = async (studentId?: number) => {
  if (!historySearchQuery.value && !studentId) return
  historyLoading.value = true
  errorMessage.value = ''
  try {
    let targetId = studentId
    if (!targetId && historySearchQuery.value) {
      // Buscar primero por documento
      const warningRes = await axios.get(`${API_BASE_URL}/api/academic-admin/academic-tracking/check-warning`, {
        params: { documento: historySearchQuery.value.trim() },
        headers: { Authorization: `Bearer ${auth.token}` }
      })
      if (warningRes.data.exists && warningRes.data.estudiante?.id_estudiante) {
        targetId = warningRes.data.estudiante.id_estudiante
      } else {
        errorMessage.value = "Estudiante no encontrado con ese número de documento."
        historyLoading.value = false
        return
      }
    }

    if (targetId) {
      const historyRes = await axios.get(`${API_BASE_URL}/api/academic-admin/academic-tracking/student-history/${targetId}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
      studentHistory.value = historyRes.data
    }
  } catch (err: any) {
    console.error("Error al buscar historial del estudiante:", err)
    errorMessage.value = "Error al consultar el historial académico del estudiante."
  } finally {
    historyLoading.value = false
  }
}

// Abrir modal para registrar decisión institucional
const openDecisionModal = (student: any) => {
  targetStudentForDecision.value = student
  decisionForm.value = {
    decisionTaken: student.decision_directivo?.decision_tomada || (student.resultado_anual === 'NO_PROMOVIDO' ? 'MANTENER_GRADO' : 'PROMOVER_SIGUIENTE_GRADO'),
    assignedGradeId: student.decision_directivo?.id_grado_asignado || '',
    observation: student.decision_directivo?.observacion || ''
  }
  showDecisionModal.value = true
}

// Guardar decisión del directivo
const saveDirectiveDecision = async () => {
  if (!targetStudentForDecision.value || !schoolId.value || !selectedYearId.value) return
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await axios.post(`${API_BASE_URL}/api/academic-admin/academic-tracking/record-decision`, {
      schoolId: schoolId.value,
      studentId: targetStudentForDecision.value.id_estudiante,
      previousYearId: selectedYearId.value,
      calculatedResult: targetStudentForDecision.value.resultado_anual || targetStudentForDecision.value.estado_academico,
      decisionTaken: decisionForm.value.decisionTaken,
      previousGradeId: targetStudentForDecision.value.id_grado || null,
      assignedGradeId: decisionForm.value.assignedGradeId ? Number(decisionForm.value.assignedGradeId) : null,
      observation: decisionForm.value.observation
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    successMessage.value = "Decisión institucional registrada exitosamente."
    showDecisionModal.value = false
    
    // Recargar datos activos
    if (activeTab.value === 'period') await fetchPeriodTracking()
    if (activeTab.value === 'annual') await fetchAnnualConsolidation()
  } catch (err: any) {
    console.error("Error al guardar decisión del directivo:", err)
    errorMessage.value = err.response?.data?.error || "Error al registrar la decisión del directivo."
  } finally {
    loading.value = false
  }
}

// Helper para refrescar datos según la pestaña activa
const fetchDataForActiveTab = () => {
  if (activeTab.value === 'period') fetchPeriodTracking()
  else if (activeTab.value === 'annual') fetchAnnualConsolidation()
}

// Observadores de filtros locales
watch([selectedYearId, selectedPeriodId, isCumulativeMode, cumulativePeriodOrder, selectedGradeId, selectedGroupId], () => {
  fetchDataForActiveTab()
})

watch(activeTab, () => {
  fetchDataForActiveTab()
})

// Observar cambios del Año Lectivo Global desde el Header de la App
watch(() => yearStore.selectedYearId, async (newYearId) => {
  if (newYearId) {
    selectedYearId.value = Number(newYearId)
    await loadCatalogs()
    fetchDataForActiveTab()
  }
})

onMounted(async () => {
  if (yearStore.selectedYearId) {
    selectedYearId.value = Number(yearStore.selectedYearId)
  }
  await loadCatalogs()
  fetchDataForActiveTab()
})
</script>

<template>
  <div class="tracking-container">
    <!-- Header principal -->
    <header class="tracking-header">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="header-badge">
            <Award class="w-4 h-4" />
            <span>Gestión Académica Institucional</span>
          </div>
          <h1 class="header-title">Gestión de Aprobados y Seguimiento Académico</h1>
          <p class="header-subtitle">
            Consulte los resultados por período acumulativo, evalúe el desempeño anual y registre decisiones de promoción informadas.
          </p>
        </div>

        <button 
          class="btn-refresh inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition shadow-sm font-semibold text-sm self-start md:self-auto"
          :disabled="loading"
          @click="fetchDataForActiveTab()"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
          <span>Actualizar Datos</span>
        </button>
      </div>
    </header>

    <!-- Alertas -->
    <transition name="fade">
      <div v-if="errorMessage" class="alert alert-error">
        <AlertTriangle class="w-5 h-5 shrink-0" />
        <span class="flex-1">{{ errorMessage }}</span>
        <button class="text-rose-800 hover:text-rose-950 font-bold" @click="errorMessage = ''">×</button>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="successMessage" class="alert alert-success">
        <CheckCircle2 class="w-5 h-5 shrink-0" />
        <span class="flex-1">{{ successMessage }}</span>
        <button class="text-emerald-800 hover:text-emerald-950 font-bold" @click="successMessage = ''">×</button>
      </div>
    </transition>

    <!-- Barra de Filtros Globales (Ultra Compacta en una sola fila) -->
    <div class="filters-card">
      <div class="filters-grid">
        <!-- Año Lectivo -->
        <div class="filter-item">
          <label><Calendar class="w-3.5 h-3.5 text-indigo-600" /> Año Lectivo</label>
          <select v-model="selectedYearId" class="form-select">
            <option v-for="y in years" :key="y.id_anio" :value="y.id_anio">
              {{ y.calendario || 'Año ' + y.id_anio }} ({{ y.estado }})
            </option>
          </select>
        </div>

        <!-- Modo acumulativo vs período individual (Solo pestaña periodo) -->
        <div v-if="activeTab === 'period'" class="filter-item">
          <label><TrendingUp class="w-3.5 h-3.5 text-indigo-600" /> Modalidad</label>
          <div class="toggle-group">
            <button 
              type="button" 
              class="toggle-btn" 
              :class="{ active: isCumulativeMode }"
              @click="isCumulativeMode = true"
            >
              Acumulado
            </button>
            <button 
              type="button" 
              class="toggle-btn" 
              :class="{ active: !isCumulativeMode }"
              @click="isCumulativeMode = false"
            >
              Por Período
            </button>
          </div>
        </div>

        <!-- Selección de Período o Período Acumulado -->
        <div v-if="activeTab === 'period' && isCumulativeMode" class="filter-item">
          <label><Clock class="w-3.5 h-3.5 text-indigo-600" /> Hasta Período</label>
          <select v-model="cumulativePeriodOrder" class="form-select">
            <option v-for="(p, idx) in availablePeriodsForYear" :key="p.id_periodo" :value="idx + 1">
              P1 al P{{ idx + 1 }} ({{ p.nombre }})
            </option>
          </select>
        </div>

        <div v-if="activeTab === 'period' && !isCumulativeMode" class="filter-item">
          <label><Clock class="w-3.5 h-3.5 text-indigo-600" /> Período</label>
          <select v-model="selectedPeriodId" class="form-select">
            <option v-for="p in availablePeriodsForYear" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }}
            </option>
          </select>
        </div>

        <!-- Grado -->
        <div class="filter-item">
          <label><GraduationCap class="w-3.5 h-3.5 text-indigo-600" /> Grado</label>
          <select v-model="selectedGradeId" class="form-select">
            <option value="">Todos los grados</option>
            <option v-for="g in grades" :key="g.id_tipo_grado || g.id_grado" :value="g.id_tipo_grado || g.id_grado">
              {{ g.nombre }}
            </option>
          </select>
        </div>

        <!-- Grupo -->
        <div class="filter-item">
          <label><Layers3 class="w-3.5 h-3.5 text-indigo-600" /> Grupo</label>
          <select v-model="selectedGroupId" class="form-select">
            <option value="">Todos los grupos</option>
            <option v-for="grp in filteredGroups" :key="grp.id_grupo" :value="grp.id_grupo">
              {{ grp.nombre || (grp.tipo_grado_nombre ? grp.tipo_grado_nombre + ' ' + (grp.seccion_nombre || '') + (grp.jornada_nombre ? ' (' + grp.jornada_nombre + ')' : '') : 'Grupo ' + grp.id_grupo) }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Navegación de Pestañas -->
    <div class="tabs-nav">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'period' }"
        @click="activeTab = 'period'"
      >
        <TrendingUp class="w-4 h-4" />
        Seguimiento por Período / Acumulado
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'annual' }"
        @click="activeTab = 'annual'"
      >
        <Award class="w-4 h-4" />
        Consolidado Anual de Promoción
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        <FileText class="w-4 h-4" />
        Historial del Estudiante
      </button>
    </div>

    <!-- CONTENIDO DE PESTAÑA 1: SEGUIMIENTO POR PERÍODO / ACUMULADO -->
    <div v-if="activeTab === 'period'" class="tab-content">
      <!-- Tarjetas de Estadísticas -->
      <div class="stats-grid">
        <div class="stat-card stat-total">
          <div class="stat-icon"><Users class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ trackingData.total_estudiantes || 0 }}</span>
            <span class="stat-label">Total Estudiantes</span>
          </div>
        </div>

        <div class="stat-card stat-approved">
          <div class="stat-icon"><CheckCircle2 class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ trackingData.aprobados_count || 0 }}</span>
            <span class="stat-label">Aprobados</span>
          </div>
        </div>

        <div class="stat-card stat-failed">
          <div class="stat-icon"><XCircle class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ trackingData.reprobados_count || 0 }}</span>
            <span class="stat-label">Reprobados</span>
          </div>
        </div>

        <div v-if="trackingData.sin_calificar_count" class="stat-card stat-warning">
          <div class="stat-icon"><Clock class="w-6 h-6 text-slate-500" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ trackingData.sin_calificar_count || 0 }}</span>
            <span class="stat-label">Sin Calificaciones</span>
          </div>
        </div>
      </div>

      <!-- Tabla de Estudiantes -->
      <div class="table-container shadow-sm">
        <div class="table-header-bar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 class="text-slate-800 font-bold text-sm">Rendimiento Académico por Estudiante</h3>
            <p class="text-[11px] text-slate-500">
              Modalidad: {{ isCumulativeMode ? `Acumulado (Períodos 1 al ${cumulativePeriodOrder})` : 'Período Individual' }}
            </p>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Filtro de Graduandos -->
            <button 
              @click="showOnlyGraduands = !showOnlyGraduands"
              :class="showOnlyGraduands ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'"
              class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5"
              title="Filtrar estudiantes en último año de estudio"
            >
              <GraduationCap class="w-4 h-4 text-amber-500 inline" />
              <span>{{ showOnlyGraduands ? 'Mostrando Graduandos' : 'Solo Graduandos' }}</span>
            </button>

            <!-- Buscador Integrado en Cabecera de Tabla -->
            <div class="relative w-56 sm:w-64">
              <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Buscar estudiante o documento..." 
                class="form-input text-xs pl-8 pr-7 py-1.5"
              />
              <span 
                v-if="searchQuery" 
                class="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
                @click="searchQuery = ''"
              >✕</span>
            </div>

            <span class="badge badge-info text-xs">Mínimo: {{ trackingData.min_passing_score }}</span>
          </div>
        </div>

        <div v-if="loading" class="loading-spinner p-8 text-center text-slate-500">
          <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          <span>Cargando información del período...</span>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Documento</th>
                <th>Curso</th>
                <th>Promedio General</th>
                <th>Estado Académico</th>
                <th>Materias Reprobadas</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="student in filteredPeriodStudents" :key="student.id_estudiante">
                <tr :class="{ 
                  'row-reprobado': student.estado_academico === 'REPROBADO',
                  'border-l-4 border-l-amber-500 bg-amber-50/20': student.is_final_grade || student.es_ultimo_grado
                }">
                  <td class="font-semibold text-slate-800 flex items-center flex-wrap gap-1">
                    <span>{{ student.apellido }} {{ student.nombre }}</span>
                    <span v-if="student.is_final_grade || student.es_ultimo_grado" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 ml-1.5" title="Estudiante en último año escolar">
                      <GraduationCap class="w-3.5 h-3.5 text-amber-600 inline" /> 🎓 Último Año
                    </span>
                  </td>
                  <td>{{ student.documento }}</td>
                  <td>
                    <div class="font-medium text-slate-800">{{ student.grado_nombre }} {{ student.grupo_nombre }}</div>
                    <div v-if="student.jornada_nombre" class="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                      <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span>Jornada {{ student.jornada_nombre }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="font-bold" :class="student.promedio_general !== null ? 'text-slate-700' : 'text-slate-400 italic'">
                      {{ student.promedio_general !== null && student.promedio_general !== undefined ? student.promedio_general : 'N/A' }}
                    </span>
                  </td>
                  <td>
                    <span 
                      class="badge" 
                      :class="{
                        'badge-success': student.estado_academico === 'APROBADO',
                        'badge-danger': student.estado_academico === 'REPROBADO',
                        'bg-slate-100 text-slate-600 border border-slate-200': student.estado_academico === 'SIN_NOTAS'
                      }"
                    >
                      {{ student.estado_academico === 'SIN_NOTAS' ? 'Sin calificaciones' : student.estado_academico }}
                    </span>
                  </td>
                  <td>
                    <span v-if="student.cantidad_reprobadas > 0" class="badge badge-warning">
                      {{ student.cantidad_reprobadas }} materia(s)
                    </span>
                    <span v-else-if="student.estado_academico === 'SIN_NOTAS'" class="text-slate-400 text-xs italic">
                      Pendiente
                    </span>
                    <span v-else class="text-slate-400 text-xs font-medium">Ninguna</span>
                  </td>
                  <td class="text-right">
                    <button class="btn-action" @click="toggleStudentExpand(student.id_estudiante)">
                      <ChevronDown v-if="expandedStudentId !== student.id_estudiante" class="w-4 h-4 mr-1" />
                      <ChevronUp v-else class="w-4 h-4 mr-1" />
                      {{ expandedStudentId === student.id_estudiante ? 'Ocultar' : 'Detalle' }}
                    </button>
                  </td>
                </tr>

                <!-- Detalle expandible con asignaturas y docentes -->
                <tr v-if="expandedStudentId === student.id_estudiante" class="expandable-row">
                  <td colspan="7">
                    <div class="student-details-box">
                      <div class="flex items-center justify-between mb-2">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <BookOpen class="w-4 h-4 text-indigo-600" />
                          Desglose de Asignaturas Cursadas:
                        </h4>
                        <span class="text-xs text-slate-400">{{ student.todas_asignaturas?.length || 0 }} asignaturas asignadas</span>
                      </div>
                      
                      <div v-if="student.todas_asignaturas && student.todas_asignaturas.length > 0" class="subjects-grid">
                        <div 
                          v-for="sub in student.todas_asignaturas" 
                          :key="sub.id_materia"
                          class="subject-card"
                          :class="{ 
                            'subject-failed': sub.estado_materia === 'REPROBADA',
                            'opacity-75 bg-slate-50/50 border-dashed': sub.estado_materia === 'SIN_NOTAS'
                          }"
                        >
                          <div class="subject-title">{{ sub.materia_nombre }}</div>
                          <div class="subject-teacher">Docente: {{ sub.docente_nombre }}</div>
                          <div class="subject-grade flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                            <span>Nota: <strong>{{ sub.calificacion !== null && sub.calificacion !== undefined ? sub.calificacion : 'N/A' }}</strong></span>
                            <span 
                              class="badge text-[11px]" 
                              :class="{
                                'badge-danger': sub.estado_materia === 'REPROBADA',
                                'badge-success': sub.estado_materia === 'APROBADA',
                                'bg-slate-100 text-slate-600 border border-slate-200': sub.estado_materia === 'SIN_NOTAS'
                              }"
                            >
                              {{ sub.estado_materia === 'SIN_NOTAS' ? 'Sin notas' : sub.estado_materia }}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div v-else class="text-xs text-slate-400 italic p-3 text-center bg-slate-50 rounded-lg">
                        No hay materias ni calificaciones registradas para este estudiante en el período evaluado.
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="filteredPeriodStudents.length === 0">
                <td colspan="7" class="text-center py-8 text-slate-400">
                  No se encontraron estudiantes para los filtros o búsqueda especificada.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- CONTENIDO DE PESTAÑA 2: CONSOLIDADO ANUAL -->
    <div v-if="activeTab === 'annual'" class="tab-content">
      <!-- Alerta Informativa RN-19.5: Cierre Mínimo de Períodos -->
      <div v-if="!annualData.habilitado_para_promocion" class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-sm">
        <ShieldAlert class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div class="space-y-1">
          <p class="font-bold text-amber-950 text-sm">Aviso de Regla Institucional (RN-19.5): Promoción en Curso</p>
          <p>
            El año lectivo seleccionado cuenta con <strong>{{ annualData.periodos_cerrados || 0 }} de {{ annualData.total_periodos || 4 }}</strong> períodos cerrados. 
            La promoción anual institucional únicamente se habilita para registro formal cuando el ciclo lectivo se encuentre en su período final o haya culminado todos sus períodos. 
            La siguiente información se presenta de forma preliminar y de apoyo al seguimiento.
          </p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card stat-total">
          <div class="stat-icon"><Users class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ annualData.total_estudiantes }}</span>
            <span class="stat-label">Total Matriculados</span>
          </div>
        </div>

        <div class="stat-card stat-approved">
          <div class="stat-icon"><CheckCircle2 class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ annualData.promovidos_count }}</span>
            <span class="stat-label">Promovidos (0 Reprobadas)</span>
          </div>
        </div>

        <div class="stat-card stat-warning">
          <div class="stat-icon"><AlertOctagon class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ annualData.pendientes_count }}</span>
            <span class="stat-label">Pendientes (1-2 Reprobadas)</span>
          </div>
        </div>

        <div class="stat-card stat-failed">
          <div class="stat-icon"><XCircle class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ annualData.no_promovidos_count }}</span>
            <span class="stat-label">No Promovidos (3+ Reprobadas)</span>
          </div>
        </div>
      </div>

      <div class="table-container shadow-sm">
        <div class="table-header-bar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 class="text-slate-800 font-bold text-sm">Consolidado de Resultados Anuales y Promoción</h3>
            <p class="text-[11px] text-slate-500">Clasificación según reglas de promoción institucional</p>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Filtro de Graduandos -->
            <button 
              @click="showOnlyGraduands = !showOnlyGraduands"
              :class="showOnlyGraduands ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'"
              class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5"
              title="Filtrar estudiantes en último año de estudio"
            >
              <GraduationCap class="w-4 h-4 text-amber-500 inline" />
              <span>{{ showOnlyGraduands ? 'Mostrando Graduandos' : 'Solo Graduandos' }}</span>
            </button>

            <!-- Buscador Integrado en Cabecera de Tabla Anual -->
            <div class="relative w-56 sm:w-64">
              <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Buscar estudiante o documento..." 
                class="form-input text-xs pl-8 pr-7 py-1.5"
              />
              <span 
                v-if="searchQuery" 
                class="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
                @click="searchQuery = ''"
              >✕</span>
            </div>

            <span class="badge badge-info text-xs">Escala Mínima: {{ annualData.min_passing_score }}</span>
          </div>
        </div>

        <div v-if="loading" class="loading-spinner p-8 text-center text-slate-500">
          <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          <span>Calculando consolidado anual...</span>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Documento</th>
                <th>Curso</th>
                <th>Promedio Anual</th>
                <th>Resultado Calculado</th>
                <th>Materias Reprobadas</th>
                <th>Decisión Institucional</th>
                <th class="text-right">Acción Directivo</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="student in filteredAnnualStudents" 
                :key="student.id_estudiante"
                :class="{
                  'border-l-4 border-l-amber-500 bg-amber-50/20': student.is_final_grade || student.es_ultimo_grado
                }"
              >
                <td class="font-semibold text-slate-800 flex items-center flex-wrap gap-1">
                  <span>{{ student.apellido }} {{ student.nombre }}</span>
                  <span v-if="student.is_final_grade || student.es_ultimo_grado" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 ml-1.5" title="Estudiante en último año escolar">
                    <GraduationCap class="w-3.5 h-3.5 text-amber-600 inline" /> 🎓 Último Año
                  </span>
                </td>
                <td>{{ student.documento }}</td>
                <td>
                  <div class="font-medium text-slate-800">{{ student.grado_nombre }} {{ student.grupo_nombre }}</div>
                  <div v-if="student.jornada_nombre" class="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                    <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span>Jornada {{ student.jornada_nombre }}</span>
                  </div>
                </td>
                <td>
                  <span class="font-bold" :class="student.promedio_anual_general !== null ? 'text-slate-700' : 'text-slate-400 italic'">
                    {{ student.promedio_anual_general !== null && student.promedio_anual_general !== undefined ? student.promedio_anual_general : 'N/A' }}
                  </span>
                </td>
                <td>
                  <span 
                    class="badge" 
                    :class="{
                      'badge-success': student.resultado_anual === 'APROBADO',
                      'badge-danger': student.resultado_anual === 'NO_PROMOVIDO',
                      'badge-warning': student.resultado_anual === 'PENDIENTE_RECUPERACION',
                      'bg-slate-100 text-slate-600 border border-slate-200': student.resultado_anual === 'SIN_CALIFICACIONES'
                    }"
                  >
                    {{ 
                      student.resultado_anual === 'SIN_CALIFICACIONES' ? 'Sin Calificaciones' :
                      student.resultado_anual === 'NO_PROMOVIDO' ? 'No Promovido' : 
                      (student.resultado_anual === 'APROBADO' ? 'Promovido' : 'Pendiente') 
                    }}
                  </span>
                </td>
                <td>
                  <div v-if="student.asignaturas_reprobadas.length > 0" class="failed-tags flex flex-wrap gap-1">
                    <span v-for="sub in student.asignaturas_reprobadas" :key="sub.id_materia" class="tag-failed">
                      {{ sub.materia_nombre }} ({{ sub.promedio_anual }})
                    </span>
                  </div>
                  <span v-else class="text-slate-400 text-xs font-medium">Ninguna</span>
                </td>
                <td>
                  <span v-if="student.decision_directivo" class="badge badge-info">
                    {{ formatDecisionLabel(student.decision_directivo.decision_tomada) }}
                  </span>
                  <span v-else-if="student.resultado_anual === 'APROBADO'" class="badge badge-success font-normal">
                    Promovido automáticamente
                  </span>
                  <span v-else class="text-slate-400 text-xs italic">Sin registrar</span>
                </td>
                <td class="text-right">
                  <button 
                    :class="student.decision_directivo ? 'btn-secondary-sm' : 'btn-primary-sm'" 
                    @click="openDecisionModal(student)"
                  >
                    <Edit v-if="student.decision_directivo" class="w-3.5 h-3.5 inline mr-1" />
                    <UserCheck v-else class="w-3.5 h-3.5 inline mr-1" />
                    {{ student.decision_directivo ? 'Editar Decisión' : 'Registrar Decisión' }}
                  </button>
                </td>
              </tr>
              <tr v-if="filteredAnnualStudents.length === 0">
                <td colspan="8" class="text-center py-8 text-slate-400">
                  No hay resultados consolidados para los filtros seleccionados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- CONTENIDO DE PESTAÑA 3: HISTORIAL DEL ESTUDIANTE -->
    <div v-if="activeTab === 'history'" class="tab-content">
      <div class="search-box-card">
        <label class="block text-sm font-bold text-slate-700 mb-2">Buscar estudiante por número de documento:</label>
        <div class="search-input-group">
          <input 
            v-model="historySearchQuery" 
            type="text" 
            placeholder="Ingrese documento de identidad (ej: 1075283921)..."
            class="form-input"
            @keyup.enter="searchStudentHistory()"
          />
          <button class="btn-primary" :disabled="historyLoading" @click="searchStudentHistory()">
            <Search class="w-4 h-4 mr-1.5" /> 
            {{ historyLoading ? 'Buscando...' : 'Buscar Historial' }}
          </button>
        </div>
      </div>

      <div v-if="historyLoading" class="loading-spinner p-8 text-center text-slate-500">
        <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
        <span>Consultando historial del estudiante...</span>
      </div>

      <div v-if="studentHistory" class="history-results mt-6 space-y-6">
        <!-- Tarjeta de Perfil -->
        <div class="student-profile-card">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              {{ studentHistory.estudiante.nombre?.charAt(0) }}{{ studentHistory.estudiante.apellido?.charAt(0) }}
            </div>
            <div>
              <h3 class="text-xl font-black text-slate-800">{{ studentHistory.estudiante.apellido }} {{ studentHistory.estudiante.nombre }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Documento: <strong class="text-slate-700">{{ studentHistory.estudiante.documento }}</strong> • 
                Colegio: <span class="text-indigo-600 font-semibold">{{ studentHistory.estudiante.colegio_nombre }}</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Línea de Tiempo de Matrículas y Promociones -->
        <div class="timeline-container bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 mb-6 flex items-center gap-2">
            <GraduationCap class="w-4 h-4 text-indigo-600" />
            Trayectoria Académica y Matrículas Registradas
          </h4>

          <div v-if="studentHistory.historial_matriculas && studentHistory.historial_matriculas.length > 0" class="timeline">
            <div 
              v-for="mat in studentHistory.historial_matriculas" 
              :key="mat.id_matricula" 
              class="timeline-item"
            >
              <div class="timeline-badge">
                <Calendar class="w-4 h-4" />
              </div>
              <div class="timeline-card">
                <div class="timeline-header flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-100">
                  <h5 class="font-bold text-slate-800 text-sm">
                    Año Lectivo {{ mat.calendario || mat.id_anio }} — Grado: {{ mat.grado_nombre }} {{ mat.grupo_nombre }}
                    <span v-if="mat.jornada_nombre" class="text-xs text-indigo-600 font-normal ml-1">(Jornada {{ mat.jornada_nombre }})</span>
                  </h5>
                  <span class="badge" :class="mat.estado_matricula === 'CULMINADA' ? 'badge-success' : 'badge-info'">
                    Estado: {{ mat.estado_matricula }}
                  </span>
                </div>
                <div class="timeline-body space-y-1.5 text-xs text-slate-600">
                  <p v-if="mat.resultado_calculado">
                    Resultado Anual: 
                    <span 
                      class="font-bold ml-1"
                      :class="{
                        'text-emerald-700': mat.resultado_calculado === 'APROBADO',
                        'text-rose-700': mat.resultado_calculado === 'NO_PROMOVIDO',
                        'text-amber-700': mat.resultado_calculado === 'PENDIENTE_RECUPERACION'
                      }"
                    >
                      {{ mat.resultado_calculado }}
                    </span>
                  </p>
                  <p v-if="mat.decision_tomada">
                    Decisión Institucional: 
                    <span class="text-indigo-600 font-bold ml-1">{{ formatDecisionLabel(mat.decision_tomada) }}</span>
                  </p>
                  <p v-if="mat.observacion" class="p-2 bg-slate-50 rounded-lg text-slate-600 italic mt-1 border border-slate-100">
                    "{{ mat.observacion }}"
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6 text-slate-400 text-xs italic">
            El estudiante no posee historial de matrículas registrado en el sistema.
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DE DECISIÓN DEL DIRECTIVO -->
    <div v-if="showDecisionModal" class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <Award class="w-5 h-5 text-indigo-600" />
            <h3 class="font-black text-slate-800 text-base">
              {{ targetStudentForDecision?.decision_directivo ? 'Editar Decisión Institucional' : 'Registro de Decisión Institucional' }}
            </h3>
          </div>
          <button class="btn-close" @click="showDecisionModal = false">×</button>
        </div>

        <div class="modal-body space-y-4">
          <!-- Resumen del Estudiante -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div class="flex justify-between items-center">
              <span class="font-bold text-slate-800 text-sm">
                {{ targetStudentForDecision?.apellido }} {{ targetStudentForDecision?.nombre }}
              </span>
              <span 
                class="badge" 
                :class="{
                  'badge-success': (targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico) === 'APROBADO',
                  'badge-danger': (targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico) === 'NO_PROMOVIDO',
                  'badge-warning': (targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico) === 'PENDIENTE_RECUPERACION'
                }"
              >
                {{ targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico }}
              </span>
            </div>
            <p class="text-slate-500">
              Documento: <strong>{{ targetStudentForDecision?.documento }}</strong> • 
              Curso: <strong>{{ targetStudentForDecision?.grado_nombre }} {{ targetStudentForDecision?.grupo_nombre }}</strong>
            </p>

            <!-- Resumen de materias reprobadas -->
            <div v-if="targetStudentForDecision?.asignaturas_reprobadas && targetStudentForDecision?.asignaturas_reprobadas.length > 0" class="pt-1">
              <p class="font-bold text-rose-800 mb-1">Materias reprobadas por el estudiante:</p>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="sub in targetStudentForDecision.asignaturas_reprobadas" 
                  :key="sub.id_materia"
                  class="tag-failed text-[11px]"
                >
                  {{ sub.materia_nombre }} ({{ sub.promedio_anual || sub.calificacion }})
                </span>
              </div>
            </div>
          </div>

          <!-- Alerta Informativa para Último Año -->
          <div v-if="targetStudentForDecision?.is_final_grade || targetStudentForDecision?.es_ultimo_grado" class="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2.5 shadow-sm">
            <GraduationCap class="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong>Estudiante en Año de Graduación:</strong> Al aprobar la promoción, su estado cambiará automáticamente a <span class="font-black text-indigo-700 uppercase">GRADUADO</span> y se inscribirá en el libro oficial de graduados.
            </div>
          </div>

          <!-- Selector de Decisión -->
          <div class="form-group">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Decisión adoptada por la institución / directivo:
            </label>
            <select v-model="decisionForm.decisionTaken" class="form-select">
              <option value="PROMOVER_SIGUIENTE_GRADO">
                {{ (targetStudentForDecision?.is_final_grade || targetStudentForDecision?.es_ultimo_grado) ? 'Promover y Graduar Estudiante 🎓' : 'Promover al siguiente grado (Excepción / Aprobación)' }}
              </option>
              <option value="MANTENER_GRADO">Mantener en el mismo grado (No promovido)</option>
              <option value="MATRICULA_CONDICIONADA">Matrícula condicionada con compromisos</option>
              <option value="OTRA_DECISION">Otra decisión institucional personalizada</option>
            </select>
          </div>

          <!-- Grado asignado opcional -->
          <div class="form-group">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Grado institucional sugerido / asignado (Opcional):
            </label>
            <select v-model="decisionForm.assignedGradeId" class="form-select">
              <option value="">Mantener grado por defecto</option>
              <option v-for="g in grades" :key="g.id_tipo_grado || g.id_grado" :value="g.id_tipo_grado || g.id_grado">
                {{ g.nombre }}
              </option>
            </select>
          </div>

          <!-- Justificación u observaciones -->
          <div class="form-group">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Justificación u observaciones institucionales:
            </label>
            <textarea 
              v-model="decisionForm.observation" 
              rows="3" 
              class="form-textarea"
              placeholder="Indique los motivos, actas o acuerdos de la comisión de evaluación y promoción..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="showDecisionModal = false">Cancelar</button>
          <button class="btn-primary" :disabled="loading" @click="saveDirectiveDecision()">
            <Save class="w-4 h-4 inline mr-1.5" /> 
            {{ loading ? 'Guardando...' : 'Guardar Decisión' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tracking-container {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.tracking-header {
  margin-bottom: 1.5rem;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.header-title {
  font-size: 1.75rem;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin-bottom: 0.25rem;
}

.header-subtitle {
  color: #64748b;
  font-size: 0.9rem;
}

.filters-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.875rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  align-items: flex-end;
}

.filter-item label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.25rem;
}

.form-select, .form-input, .form-textarea {
  width: 100%;
  padding: 0.4rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: #f8fafc;
  font-size: 0.8rem;
  color: #1e293b;
  transition: all 0.2s;
}

.form-select:focus, .form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  background: #ffffff;
  box-shadow: 0 0 0 2.5px rgba(79, 70, 229, 0.12);
}

.toggle-group {
  display: flex;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 0.15rem;
  border-radius: 0.5rem;
  height: 2.1rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.2rem 0.45rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-btn.active {
  background: #ffffff;
  color: #4f46e5;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.tabs-nav {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 1.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  font-weight: 700;
  color: #64748b;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #4f46e5;
}

.tab-btn.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.stat-icon {
  padding: 0.75rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-total .stat-icon { background: #eff6ff; color: #2563eb; }
.stat-approved .stat-icon { background: #f0fdf4; color: #16a34a; }
.stat-failed .stat-icon { background: #fef2f2; color: #dc2626; }
.stat-warning .stat-icon { background: #fffbe6; color: #d97706; }

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 900;
  color: #0f172a;
}

.stat-label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 600;
}

.table-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  overflow: hidden;
}

.table-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th, .data-table td {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.875rem;
}

.data-table th {
  background: #f1f5f9;
  font-weight: 700;
  color: #334155;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.row-reprobado {
  background: #fffafa;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.badge-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
.badge-warning { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.badge-info { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }

.tag-failed {
  display: inline-flex;
  padding: 0.15rem 0.5rem;
  background: #fee2e2;
  color: #b91c1c;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-action, .btn-primary-sm, .btn-primary, .btn-secondary, .btn-secondary-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.825rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary-sm {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
}

.btn-secondary-sm:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.btn-action {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #475569;
}

.btn-action:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.btn-primary, .btn-primary-sm {
  background: #4f46e5;
  color: #ffffff;
  border: none;
}

.btn-primary:hover, .btn-primary-sm:hover {
  background: #4338ca;
}

.btn-secondary {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.expandable-row {
  background: #f8fafc;
}

.student-details-box {
  padding: 1.25rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  margin: 0.5rem 0;
}

.subjects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
}

.subject-card {
  padding: 0.85rem;
  border-radius: 0.625rem;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.subject-card.subject-failed {
  border-color: #fca5a5;
  background: #fff5f5;
}

.subject-title {
  font-weight: 700;
  font-size: 0.875rem;
  color: #1e293b;
}

.subject-teacher {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.15rem;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: #ffffff;
  border-radius: 1rem;
  width: 100%;
  max-width: 520px;
  padding: 1.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.85rem;
  margin-bottom: 1.25rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #94a3b8;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #0f172a;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid #e2e8f0;
  padding-top: 1.25rem;
  margin-top: 1.25rem;
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-radius: 0.75rem;
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.alert-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.alert-success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

/* Timeline Historial */
.search-box-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1.25rem;
}

.search-input-group {
  display: flex;
  gap: 0.75rem;
}

.student-profile-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1.25rem;
}

.timeline {
  position: relative;
  padding-left: 2rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 0.75rem;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 2px;
  background: #e2e8f0;
}

.timeline-item {
  position: relative;
  margin-bottom: 1.5rem;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-badge {
  position: absolute;
  left: -2rem;
  top: 0.25rem;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  background: #4f46e5;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 4px #ffffff;
}

.timeline-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>

