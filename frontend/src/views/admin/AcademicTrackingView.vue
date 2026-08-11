<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { useAuthStore } from '../../stores/auth'
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
  Save
} from 'lucide-vue-next'

const auth = useAuthStore()

const activeTab = ref<'period' | 'annual' | 'history' | 'decisions'>('period')
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
  min_passing_score: number
  periodos_analizados: number[]
  estudiantes: any[]
}>({
  total_estudiantes: 0,
  aprobados_count: 0,
  reprobados_count: 0,
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
  estudiantes: any[]
}>({
  total_estudiantes: 0,
  promovidos_count: 0,
  no_promovidos_count: 0,
  pendientes_count: 0,
  min_passing_score: 3.0,
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
  observation: ''
})

const schoolId = computed(() => auth.selectedSchoolId || (auth.user as any)?.id_colegio || (auth.user?.schoolId ? Number(auth.user.schoolId) : undefined))

// Cargar catálogos iniciales
const loadCatalogs = async () => {
  if (!schoolId.value) return
  loading.value = true
  try {
    const [yearsRes, settingsRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/academic-admin/settings/${schoolId.value}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      }),
      axios.get(`${API_BASE_URL}/api/academic-admin/grades/${schoolId.value}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
    ])

    years.value = yearsRes.data.years || []
    periods.value = yearsRes.data.periods || []
    grades.value = settingsRes.data.grades || []
    groups.value = settingsRes.data.groups || []

    if (years.value.length > 0 && !selectedYearId.value) {
      selectedYearId.value = years.value[0].id_anio
    }

    if (periods.value.length > 0 && !selectedPeriodId.value) {
      selectedPeriodId.value = periods.value[0].id_periodo;
      cumulativePeriodOrder.value = periods.value.length;
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
    decisionTaken: student.decision_directivo?.decision_tomada || 'PROMOVER_SIGUIENTE_GRADO',
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
      observation: decisionForm.value.observation
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    successMessage.value = "Decisión registrada exitosamente."
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

// Observadores de filtros
watch([selectedYearId, selectedPeriodId, isCumulativeMode, cumulativePeriodOrder, selectedGradeId, selectedGroupId], () => {
  if (activeTab.value === 'period') fetchPeriodTracking()
  else if (activeTab.value === 'annual') fetchAnnualConsolidation()
})

watch(activeTab, (newTab) => {
  if (newTab === 'period') fetchPeriodTracking()
  else if (newTab === 'annual') fetchAnnualConsolidation()
})

onMounted(async () => {
  await loadCatalogs()
  fetchPeriodTracking()
})
</script>

<template>
  <div class="tracking-container">
    <!-- Header principal -->
    <header class="tracking-header">
      <div class="header-titles">
        <div class="header-badge">
          <Award class="w-4 h-4" />
          <span>Gestión Académica Institucional</span>
        </div>
        <h1 class="header-title">Gestión de Aprobados y Seguimiento Académico</h1>
        <p class="header-subtitle">
          Consulte los resultados por período acumulativo, evalúe el desempeño anual y registre decisiones de promoción informadas.
        </p>
      </div>
    </header>

    <!-- Alertas -->
    <div v-if="errorMessage" class="alert alert-error">
      <AlertTriangle class="w-5 h-5 shrink-0" />
      <span>{{ errorMessage }}</span>
    </div>
    <div v-if="successMessage" class="alert alert-success">
      <CheckCircle2 class="w-5 h-5 shrink-0" />
      <span>{{ successMessage }}</span>
    </div>

    <!-- Barra de Filtros Globales -->
    <div class="filters-card">
      <div class="filters-grid">
        <!-- Año Lectivo -->
        <div class="filter-item">
          <label><Calendar class="w-4 h-4" /> Año Lectivo</label>
          <select v-model="selectedYearId" class="form-select">
            <option v-for="y in years" :key="y.id_anio" :value="y.id_anio">
              {{ y.calendario || 'Año ' + y.id_anio }} ({{ y.estado }})
            </option>
          </select>
        </div>

        <!-- Modo acumulativo vs período individual -->
        <div v-if="activeTab === 'period'" class="filter-item">
          <label><TrendingUp class="w-4 h-4" /> Modalidad de Consulta</label>
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
          <label><Clock class="w-4 h-4" /> Acumulado Hasta Período</label>
          <select v-model="cumulativePeriodOrder" class="form-select">
            <option v-for="(p, idx) in availablePeriodsForYear" :key="p.id_periodo" :value="idx + 1">
              Período 1 al Período {{ idx + 1 }} ({{ p.nombre }})
            </option>
          </select>
        </div>

        <div v-if="activeTab === 'period' && !isCumulativeMode" class="filter-item">
          <label><Clock class="w-4 h-4" /> Período Académico</label>
          <select v-model="selectedPeriodId" class="form-select">
            <option v-for="p in availablePeriodsForYear" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }}
            </option>
          </select>
        </div>

        <!-- Grado -->
        <div class="filter-item">
          <label><GraduationCap class="w-4 h-4" /> Grado</label>
          <select v-model="selectedGradeId" class="form-select">
            <option value="">Todos los grados</option>
            <option v-for="g in grades" :key="g.id_grado" :value="g.id_grado">
              {{ g.nombre }}
            </option>
          </select>
        </div>

        <!-- Grupo -->
        <div class="filter-item">
          <label><Layers3 class="w-4 h-4" /> Grupo</label>
          <select v-model="selectedGroupId" class="form-select">
            <option value="">Todos los grupos</option>
            <option v-for="grp in groups" :key="grp.id_grupo" :value="grp.id_grupo">
              {{ grp.nombre }}
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
            <span class="stat-value">{{ trackingData.total_estudiantes }}</span>
            <span class="stat-label">Total Estudiantes Evaluados</span>
          </div>
        </div>

        <div class="stat-card stat-approved">
          <div class="stat-icon"><CheckCircle2 class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ trackingData.aprobados_count }}</span>
            <span class="stat-label">Estudiantes Aprobados</span>
          </div>
        </div>

        <div class="stat-card stat-failed">
          <div class="stat-icon"><XCircle class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ trackingData.reprobados_count }}</span>
            <span class="stat-label">Estudiantes Reprobados</span>
          </div>
        </div>
      </div>

      <!-- Tabla de Estudiantes -->
      <div class="table-container shadow-sm">
        <div class="table-header-bar">
          <h3>Rendimiento Académico por Estudiante</h3>
          <span class="badge badge-info">Mínimo Aprobatorio: {{ trackingData.min_passing_score }}</span>
        </div>

        <div v-if="loading" class="loading-spinner">
          Cargando información del período...
        </div>

        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Documento</th>
              <th>Curso</th>
              <th>Estado Académico</th>
              <th>Materias Reprobadas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="student in trackingData.estudiantes" :key="student.id_estudiante">
              <tr :class="{ 'row-reprobado': student.estado_academico === 'REPROBADO' }">
                <td class="font-medium">
                  {{ student.apellido }} {{ student.nombre }}
                </td>
                <td>{{ student.documento }}</td>
                <td>{{ student.grado_nombre }} {{ student.grupo_nombre }}</td>
                <td>
                  <span class="badge" :class="student.estado_academico === 'APROBADO' ? 'badge-success' : 'badge-danger'">
                    {{ student.estado_academico }}
                  </span>
                </td>
                <td>
                  <span v-if="student.cantidad_reprobadas > 0" class="badge badge-warning">
                    {{ student.cantidad_reprobadas }} materia(s)
                  </span>
                  <span v-else class="text-muted">Ninguna</span>
                </td>
                <td>
                  <button class="btn-action" @click="toggleStudentExpand(student.id_estudiante)">
                    <ChevronDown v-if="expandedStudentId !== student.id_estudiante" class="w-4 h-4" />
                    <ChevronUp v-else class="w-4 h-4" />
                    Detalle
                  </button>
                </td>
              </tr>

              <!-- Detalle expandible con asignaturas y docentes -->
              <tr v-if="expandedStudentId === student.id_estudiante" class="expandable-row">
                <td colspan="6">
                  <div class="student-details-box">
                    <h4>Desglose de Asignaturas:</h4>
                    <div class="subjects-grid">
                      <div 
                        v-for="sub in student.todas_asignaturas" 
                        :key="sub.id_materia"
                        class="subject-card"
                        :class="{ 'subject-failed': sub.estado_materia === 'REPROBADA' }"
                      >
                        <div class="subject-title">{{ sub.materia_nombre }}</div>
                        <div class="subject-teacher">Docente: {{ sub.docente_nombre }}</div>
                        <div class="subject-grade">
                          Nota: <strong>{{ sub.calificacion }}</strong>
                          <span class="badge" :class="sub.estado_materia === 'REPROBADA' ? 'badge-danger' : 'badge-success'">
                            {{ sub.estado_materia }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="trackingData.estudiantes.length === 0">
              <td colspan="6" class="text-center py-6 text-muted">
                No hay registros académicos para los filtros seleccionados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CONTENIDO DE PESTAÑA 2: CONSOLIDADO ANUAL -->
    <div v-if="activeTab === 'annual'" class="tab-content">
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
            <span class="stat-label">Promovidos</span>
          </div>
        </div>

        <div class="stat-card stat-failed">
          <div class="stat-icon"><XCircle class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ annualData.no_promovidos_count }}</span>
            <span class="stat-label">No Promovidos</span>
          </div>
        </div>

        <div class="stat-card stat-warning">
          <div class="stat-icon"><AlertOctagon class="w-6 h-6" /></div>
          <div class="stat-data">
            <span class="stat-value">{{ annualData.pendientes_count }}</span>
            <span class="stat-label">Pendientes / Recuperación</span>
          </div>
        </div>
      </div>

      <div class="table-container shadow-sm">
        <div class="table-header-bar">
          <h3>Consolidado de Resultados Anuales</h3>
          <span class="text-muted text-sm">Información institucional de promoción</span>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Documento</th>
              <th>Curso</th>
              <th>Resultado Calculado</th>
              <th>Materias Reprobadas Anual</th>
              <th>Decisión Institucional</th>
              <th>Acción Directivo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in annualData.estudiantes" :key="student.id_estudiante">
              <td class="font-medium">{{ student.apellido }} {{ student.nombre }}</td>
              <td>{{ student.documento }}</td>
              <td>{{ student.grado_nombre }} {{ student.grupo_nombre }}</td>
              <td>
                <span 
                  class="badge" 
                  :class="{
                    'badge-success': student.resultado_anual === 'APROBADO',
                    'badge-danger': student.resultado_anual === 'NO_PROMOVIDO',
                    'badge-warning': student.resultado_anual === 'PENDIENTE_RECUPERACION'
                  }"
                >
                  {{ student.resultado_anual === 'NO_PROMOVIDO' ? 'No Promovido' : (student.resultado_anual === 'APROBADO' ? 'Promovido' : 'Pendiente') }}
                </span>
              </td>
              <td>
                <div v-if="student.asignaturas_reprobadas.length > 0" class="failed-tags">
                  <span v-for="sub in student.asignaturas_reprobadas" :key="sub.id_materia" class="tag-failed">
                    {{ sub.materia_nombre }} ({{ sub.promedio_anual }})
                  </span>
                </div>
                <span v-else class="text-muted">Ninguna</span>
              </td>
              <td>
                <span v-if="student.decision_directivo" class="badge badge-info">
                  {{ student.decision_directivo.decision_tomada }}
                </span>
                <span v-else class="text-muted">Sin registrar</span>
              </td>
              <td>
                <button class="btn-primary-sm" @click="openDecisionModal(student)">
                  <UserCheck class="w-4 h-4 inline mr-1" />
                  Registrar Decisión
                </button>
              </td>
            </tr>
            <tr v-if="annualData.estudiantes.length === 0">
              <td colspan="7" class="text-center py-6 text-muted">
                No hay resultados anuales consolidados para el año seleccionado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CONTENIDO DE PESTAÑA 3: HISTORIAL DEL ESTUDIANTE -->
    <div v-if="activeTab === 'history'" class="tab-content">
      <div class="search-box-card">
        <label>Buscar estudiante por número de documento:</label>
        <div class="search-input-group">
          <input 
            v-model="historySearchQuery" 
            type="text" 
            placeholder="Ingrese documento de identidad..."
            class="form-input"
            @keyup.enter="searchStudentHistory()"
          />
          <button class="btn-primary" @click="searchStudentHistory()">
            <Search class="w-4 h-4" /> Buscar Historial
          </button>
        </div>
      </div>

      <div v-if="historyLoading" class="loading-spinner">
        Consultando historial del estudiante...
      </div>

      <div v-if="studentHistory" class="history-results">
        <div class="student-profile-card">
          <h3>{{ studentHistory.estudiante.apellido }} {{ studentHistory.estudiante.nombre }}</h3>
          <p>Documento: <strong>{{ studentHistory.estudiante.documento }}</strong> | Colegio: {{ studentHistory.estudiante.colegio_nombre }}</p>
        </div>

        <div class="timeline">
          <div v-for="mat in studentHistory.historial_matriculas" :key="mat.id_matricula" class="timeline-item">
            <div class="timeline-badge">
              <GraduationCap class="w-5 h-5" />
            </div>
            <div class="timeline-card">
              <div class="timeline-header">
                <h4>Grado: {{ mat.grado_nombre }} {{ mat.grupo_nombre }} (Año {{ mat.calendario || mat.id_anio }})</h4>
                <span class="badge" :class="mat.estado_matricula === 'CULMINADA' ? 'badge-success' : 'badge-info'">
                  Matrícula {{ mat.estado_matricula }}
                </span>
              </div>
              <div class="timeline-body">
                <p v-if="mat.resultado_calculado">
                  Resultado Anual Calculado: <strong>{{ mat.resultado_calculado }}</strong>
                </p>
                <p v-if="mat.decision_tomada">
                  Decisión Institucional Registrada: <span class="text-primary font-semibold">{{ mat.decision_tomada }}</span>
                </p>
                <p v-if="mat.observacion" class="text-sm italic text-muted mt-2">
                  Observación: "{{ mat.observacion }}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DE DECISIÓN DEL DIRECTIVO -->
    <div v-if="showDecisionModal" class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Registro de Decisión Institucional de Promoción</h3>
          <button class="btn-close" @click="showDecisionModal = false">×</button>
        </div>

        <div class="modal-body">
          <p>
            Estudiante: <strong>{{ targetStudentForDecision?.apellido }} {{ targetStudentForDecision?.nombre }}</strong>
          </p>
          <p class="text-sm text-muted mb-4">
            Resultado calculado por el sistema: <strong>{{ targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico }}</strong>
          </p>

          <div class="form-group mb-4">
            <label>Decisión tomada por la institución / directivo:</label>
            <select v-model="decisionForm.decisionTaken" class="form-select">
              <option value="PROMOVER_SIGUIENTE_GRADO">Promover al siguiente grado</option>
              <option value="MANTENER_GRADO">Mantener en el mismo grado</option>
              <option value="MATRICULA_CONDICIONADA">Matrícula condicionada</option>
              <option value="OTRA_DECISION">Otra decisión académica institucional</option>
            </select>
          </div>

          <div class="form-group mb-4">
            <label>Justificación u observaciones:</label>
            <textarea 
              v-model="decisionForm.observation" 
              rows="3" 
              class="form-textarea"
              placeholder="Escriba la justificación institucional..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="showDecisionModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveDirectiveDecision()">
            <Save class="w-4 h-4 inline mr-1" /> Guardar Decisión
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
  background: var(--color-primary-rgb, rgba(37, 99, 235, 0.1));
  color: var(--color-primary, #2563eb);
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.header-title {
  font-size: 1.875rem;
  font-weight: 800;
  color: #1e293b;

  margin-bottom: 0.25rem;
}

.header-subtitle {
  color: #64748b;
  font-size: 0.95rem;
}

.filters-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.filter-item label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.35rem;
}

.form-select, .form-input, .form-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: #f8fafc;
  font-size: 0.9rem;
  color: #1e293b;
  transition: all 0.2s;
}

.form-select:focus, .form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #2563eb;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.toggle-group {
  display: flex;
  background: #e2e8f0;
  padding: 0.2rem;
  border-radius: 0.5rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.4rem 0.75rem;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
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
  font-size: 0.95rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #2563eb;
}

.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: #ffffff;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.stat-icon {
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.stat-total .stat-icon { background: #eff6ff; color: #2563eb; }
.stat-approved .stat-icon { background: #f0fdf4; color: #16a34a; }
.stat-failed .stat-icon { background: #fef2f2; color: #dc2626; }
.stat-warning .stat-icon { background: #fffbe6; color: #d97706; }

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
}

.stat-label {
  font-size: 0.85rem;
  color: #64748b;
}

.table-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
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
  font-size: 0.9rem;
}

.data-table th {
  background: #f1f5f9;
  font-weight: 700;
  color: #334155;
}

.row-reprobado {
  background: #fff5f5;
}

.badge {
  display: inline-flex;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-success { background: #dcfce7; color: #15803d; }
.badge-danger { background: #fee2e2; color: #b91c1c; }
.badge-warning { background: #fef3c7; color: #b45309; }
.badge-info { background: #dbeafe; color: #1d4ed8; }

.btn-action, .btn-primary-sm, .btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
}

.btn-action:hover { background: #e2e8f0; }

.btn-primary, .btn-primary-sm {
  background: #2563eb;
  color: #ffffff;
  border: none;
}

.btn-primary:hover, .btn-primary-sm:hover { background: #1d4ed8; }

.btn-secondary {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
}

.expandable-row {
  background: #f8fafc;
}

.student-details-box {
  padding: 1rem;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}

.subjects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.subject-card {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.subject-card.subject-failed {
  border-color: #fca5a5;
  background: #fef2f2;
}

.subject-title { font-weight: 700; font-size: 0.9rem; color: #1e293b; }
.subject-teacher { font-size: 0.8rem; color: #64748b; margin-bottom: 0.3rem; }

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: #ffffff;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 500px;
  padding: 1.5rem;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid #e2e8f0;
  padding-top: 1rem;
  margin-top: 1rem;
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
</style>
