<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { dbaService } from '../../services/dbaService'
import api from '../../services/api'
import { 
  ArrowLeft, 
  BarChart3, 
  Download, 
  AlertTriangle, 
  SlidersHorizontal, 
  Search, 
  RefreshCw, 
  PieChart,
  X,
  BookOpen,
  Filter,
  Layers,
  Table,
  Zap,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Users,
  HelpCircle,
  Target
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import DataTable from '../../components/ui/DataTable.vue'
import DbaCatalogModal from '../../components/dba/DbaCatalogModal.vue'


interface PeriodOption {
  id_periodo: number
  nombre: string
  estado: string
}

interface GroupOption {
  id_grupo: number
  nivel_nombre: string
  tipo_grado_nombre: string
  seccion_nombre: string
  jornada_nombre?: string
}

interface SubjectOption {
  id_materia: number
  nombre: string
}

interface TeacherOption {
  id_docente: number
  nombre: string
  apellido: string
}

interface CoherenciaRow {
  id_actividadmateria: number
  actividad_nombre: string
  actividad_porcentaje: number
  actividad_fecha: string
  id_competencia: number
  competencia_descripcion: string
  competencia_nombre: string | null
  id_periodo: number
  periodo_nombre: string
  id_grupo: number
  grupo_nombre: string
  id_materia: number
  materia_nombre: string
  id_docente: number
  docente_nombre: string
  id_evidencia_dba: number
  evidencia_descripcion: string
  evidencia_orden: number
  id_dba: number
  numero_dba: number
  dba_enunciado: string
  estado_coherencia: 'PLANEADA' | 'EXTRA'
  motivo_extra?: string
  justificacion_extra?: string
  jornada_nombre?: string
  total_estudiantes?: number
  estudiantes_calificados?: number
  estudiantes_pendientes?: number
  estado_calificacion?: 'COMPLETO' | 'PARCIAL' | 'SIN_CALIFICAR'
}

interface CoberturaResumen {
  area: string
  grado: string
  version_curricular: string
  total_evidencias: number
  evidencias_evaluadas: number
}

interface CoberturaDetalle {
  id_dba: number
  numero_dba: number
  dba_enunciado: string
  area: string
  grado: string
  id_evidencia_dba: number
  evidencia_descripcion: string
  evidencia_orden: number
  es_planeada?: boolean
  evaluaciones: {
    actividad_nombre: string
    actividad_porcentaje: number
    grupo_nombre: string
    docente_nombre: string
    periodo_nombre?: string
    total_estudiantes?: number
    estudiantes_calificados?: number
    estado_calificacion?: 'COMPLETO' | 'PARCIAL' | 'SIN_CALIFICAR'
  }[]
}

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const activeTab = ref<'coherencia' | 'cobertura'>('coherencia')
const loading = ref(true)
const fetchingReports = ref(false)

// Options for filters
const periods = ref<PeriodOption[]>([])
const groups = ref<GroupOption[]>([])
const grades = ref<string[]>([])
const subjects = ref<SubjectOption[]>([])
const teachers = ref<TeacherOption[]>([])

// Catalog Modal Interfaces & State
interface CatalogDbaEvidencia {
  id_evidencia_dba: number
  descripcion: string
  orden: number
  planeaciones: {
    id_competencia: number
    competencia_descripcion: string
    competencia_nombre: string | null
    id_periodo: number
    periodo_nombre: string
    id_materia: number
    materia_nombre: string
    id_grupo: number
    grupo_nombre: string
  }[]
}

interface CatalogDbaItem {
  id_dba: number
  numero_dba: number
  dba_enunciado: string
  area: string
  grado: string
  version_curricular: string
  evidencias: CatalogDbaEvidencia[]
}

const showCatalogModal = ref(false)
const catalogLoading = ref(false)
const catalogData = ref<CatalogDbaItem[]>([])

// Catalog filters
const catalogGradeFilter = ref<string>('TODOS')
const catalogSubjectFilter = ref<string>('TODOS')
const catalogStatusFilter = ref<'TODOS' | 'PLANEADAS' | 'LIBRES'>('TODOS')
const catalogPeriodFilter = ref<string>('TODOS')
const catalogSearchTerm = ref<string>('')

const openCatalogModal = async () => {
  showCatalogModal.value = true
  if (catalogData.value.length === 0) {
    await fetchCatalogData()
  }
}

const fetchCatalogData = async () => {
  if (!schoolId.value) return
  try {
    catalogLoading.value = true
    catalogData.value = await dbaService.getSchoolCatalogData(schoolId.value, yearStore.selectedYearId || undefined)
  } catch (error) {
    console.error('Error loading catalog data:', error)
  } finally {
    catalogLoading.value = false
  }
}


// Catalog computed statistics
const catalogStats = computed(() => {
  let totalEvidences = 0
  let plannedEvidences = 0
  let freeEvidences = 0

  for (const dba of filteredCatalog.value) {
    for (const ev of dba.evidencias) {
      totalEvidences++
      if (ev.planeaciones && ev.planeaciones.length > 0) {
        plannedEvidences++
      } else {
        freeEvidences++
      }
    }
  }

  const pct = totalEvidences > 0 ? Math.round((plannedEvidences / totalEvidences) * 100) : 0
  return { totalEvidences, plannedEvidences, freeEvidences, pct }
})

// Filtered Catalog
const filteredCatalog = computed(() => {
  const search = catalogSearchTerm.value.trim().toLowerCase()

  return catalogData.value.map(dba => {
    const filteredEvidences = dba.evidencias.filter(ev => {
      const isPlanned = ev.planeaciones && ev.planeaciones.length > 0

      if (catalogStatusFilter.value === 'PLANEADAS' && !isPlanned) return false
      if (catalogStatusFilter.value === 'LIBRES' && isPlanned) return false

      if (catalogPeriodFilter.value !== 'TODOS') {
        if (!isPlanned) return false
        const matchesPeriod = ev.planeaciones.some(p => String(p.id_periodo) === catalogPeriodFilter.value)
        if (!matchesPeriod) return false
      }

      if (search) {
        const matchEvDesc = (ev.descripcion || '').toLowerCase().includes(search)
        const matchDbaEnum = (dba.dba_enunciado || '').toLowerCase().includes(search)
        const matchDbaNum = String(dba.numero_dba).includes(search)
        const matchComp = (ev.planeaciones || []).some(p =>
          (p.competencia_descripcion || '').toLowerCase().includes(search)
        )
        if (!matchEvDesc && !matchDbaEnum && !matchDbaNum && !matchComp) return false
      }

      return true
    })

    return {
      ...dba,
      evidencias: filteredEvidences
    }
  }).filter(dba => {
    if (catalogGradeFilter.value !== 'TODOS') {
      if ((dba.grado || '').trim().toLowerCase() !== catalogGradeFilter.value.trim().toLowerCase()) {
        return false
      }
    }

    if (catalogSubjectFilter.value !== 'TODOS') {
      const targetSubject = subjects.value.find(s => String(s.id_materia) === catalogSubjectFilter.value)
      const targetAreaName = targetSubject ? targetSubject.nombre.trim().toLowerCase() : catalogSubjectFilter.value.trim().toLowerCase()
      if ((dba.area || '').trim().toLowerCase() !== targetAreaName) {
        return false
      }
    }

    return dba.evidencias.length > 0
  })
})

interface GroupedPlaneacion {
  periodo_nombre: string
  materia_nombre: string
  competencia_descripcion?: string
  grupos: string[]
}

const getGroupedPlaneaciones = (planeaciones: CatalogDbaEvidencia['planeaciones']): GroupedPlaneacion[] => {
  if (!planeaciones || planeaciones.length === 0) return []

  const map = new Map<string, GroupedPlaneacion>()

  for (const p of planeaciones) {
    const compDesc = (p.competencia_descripcion || '').trim()
    const key = `${p.periodo_nombre}___${p.materia_nombre}___${compDesc}`
    
    if (!map.has(key)) {
      map.set(key, {
        periodo_nombre: p.periodo_nombre,
        materia_nombre: p.materia_nombre,
        competencia_descripcion: compDesc || undefined,
        grupos: []
      })
    }

    const item = map.get(key)!
    if (p.grupo_nombre && !item.grupos.includes(p.grupo_nombre)) {
      item.grupos.push(p.grupo_nombre)
    }
  }

  return Array.from(map.values())
}

// Report Data
const coherenciaData = ref<CoherenciaRow[]>([])
const coberturaResumen = ref<CoberturaResumen[]>([])
const coberturaDetalles = ref<CoberturaDetalle[]>([])

// Coherencia Filter Selections & View Mode
const coherenciaViewMode = ref<'groupedActivity' | 'groupedDba' | 'groupedTeacher' | 'table'>('groupedActivity')
const filterPeriod = ref<string>('TODOS')
const filterGroup = ref<string>('TODOS')
const filterCoherenciaGrade = ref<string>('TODOS')
const filterSubject = ref<string>('TODOS')
const filterTeacher = ref<string>('TODOS')
const filterCoherenciaStatus = ref<string>('TODOS')
const presetCoherenciaExtrasOnly = ref<boolean>(false)
const presetCoherenciaPlaneadasOnly = ref<boolean>(false)
const presetCoherenciaPendientesOnly = ref<boolean>(false)
const filterHideEmptyGroups = ref<boolean>(true)
const showExecutiveGuide = ref<boolean>(false)
const searchTerm = ref<string>('')

// Collapsible Accordion State for Activity Cards
const collapsedActivityCards = ref<Set<string>>(new Set())

// Collapsible Accordion State for Teacher Cards (Matriz Ejecutiva)
const collapsedTeacherCards = ref<Set<string>>(new Set())

const toggleTeacherCard = (docenteNombre: string) => {
  const set = new Set(collapsedTeacherCards.value)
  if (set.has(docenteNombre)) {
    set.delete(docenteNombre)
  } else {
    set.add(docenteNombre)
  }
  collapsedTeacherCards.value = set
}

const isTeacherCardCollapsed = (docenteNombre: string) => collapsedTeacherCards.value.has(docenteNombre)

const expandAllTeachers = () => {
  collapsedTeacherCards.value = new Set()
}

const collapseAllTeachers = () => {
  const set = new Set<string>()
  groupedCoherenciaByTeacher.value.forEach(t => set.add(t.docente_nombre))
  collapsedTeacherCards.value = set
}

const getTeacherInitials = (name: string): string => {
  if (!name) return 'DO'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const filterByTeacherAndSwitch = (docenteNombre: string) => {
  const teacherObj = teachers.value.find(t => `${t.nombre} ${t.apellido}`.trim().toLowerCase() === docenteNombre.trim().toLowerCase())
  if (teacherObj) {
    filterTeacher.value = String(teacherObj.id_docente)
  } else {
    searchTerm.value = docenteNombre
  }
  coherenciaViewMode.value = 'groupedActivity'
}

const toggleActivityCard = (key: string) => {
  const set = new Set(collapsedActivityCards.value)
  if (set.has(key)) {
    set.delete(key)
  } else {
    set.add(key)
  }
  collapsedActivityCards.value = set
}

const isActivityCardCollapsed = (key: string) => collapsedActivityCards.value.has(key)

const expandAllActivities = () => {
  collapsedActivityCards.value = new Set()
}

const collapseAllActivities = () => {
  const set = new Set<string>()
  groupedCoherenciaByActivity.value.forEach(act => {
    const key = `${act.id_actividadmateria}_${act.docente_nombre}_${act.grupo_nombre}_${act.materia_nombre}`
    set.add(key)
  })
  collapsedActivityCards.value = set
}

// Collapsible Accordion State for DBA Cards
const collapsedDbaCards = ref<Set<number>>(new Set())

const toggleDbaCard = (id_dba: number) => {
  const set = new Set(collapsedDbaCards.value)
  if (set.has(id_dba)) {
    set.delete(id_dba)
  } else {
    set.add(id_dba)
  }
  collapsedDbaCards.value = set
}

const isDbaCardCollapsed = (id_dba: number) => collapsedDbaCards.value.has(id_dba)

const expandAllDbas = () => {
  collapsedDbaCards.value = new Set()
}

const collapseAllDbas = () => {
  const set = new Set<number>()
  groupedCoherenciaByDba.value.forEach(d => set.add(d.id_dba))
  collapsedDbaCards.value = set
}

// Collapsible Accordion State for Cobertura Cards
const collapsedCoberturaCards = ref<Set<string>>(new Set())

const toggleCoberturaCard = (key: string) => {
  const set = new Set(collapsedCoberturaCards.value)
  if (set.has(key)) {
    set.delete(key)
  } else {
    set.add(key)
  }
  collapsedCoberturaCards.value = set
}

const isCoberturaCardCollapsed = (key: string) => collapsedCoberturaCards.value.has(key)

const expandAllCoberturaCards = () => {
  collapsedCoberturaCards.value = new Set()
}

const collapseAllCoberturaCards = () => {
  const set = new Set<string>()
  filteredCoberturaDetalles.value.forEach(det => {
    const key = `${det.id_evidencia_dba}_${det.grado}_${det.area}`
    set.add(key)
  })
  collapsedCoberturaCards.value = set
}

// Collapsible Accordion State for Catalog Modal DBA Cards
const collapsedCatalogDbaCards = ref<Set<number>>(new Set())

const toggleCatalogDbaCard = (id_dba: number) => {
  const set = new Set(collapsedCatalogDbaCards.value)
  if (set.has(id_dba)) {
    set.delete(id_dba)
  } else {
    set.add(id_dba)
  }
  collapsedCatalogDbaCards.value = set
}

const isCatalogDbaCardCollapsed = (id_dba: number) => collapsedCatalogDbaCards.value.has(id_dba)

// Cobertura specific filters & selection card filter
const filterCoberturaSubject = ref<string>('TODOS')
const filterCoberturaGroup = ref<string>('TODOS')
const filterEvidenceStatus = ref<string>('TODOS')
const selectedResumenCard = ref<{ area: string; grado: string } | null>(null)
const searchResumenTerm = ref<string>('')

const toggleSelectResumenCard = (res: CoberturaResumen) => {
  if (selectedResumenCard.value && selectedResumenCard.value.area === res.area && selectedResumenCard.value.grado === res.grado) {
    selectedResumenCard.value = null
  } else {
    selectedResumenCard.value = { area: res.area, grado: res.grado }
  }
}

const filteredCoberturaResumen = computed(() => {
  const query = searchResumenTerm.value.trim().toLowerCase()
  if (!query) return coberturaResumen.value

  return coberturaResumen.value.filter(res => {
    const areaName = (res.area || '').toLowerCase()
    const gradoName = (res.grado || '').toLowerCase()
    return areaName.includes(query) || gradoName.includes(query)
  })
})

const filteredCoberturaDetalles = computed(() => {
  let list = coberturaDetalles.value
  
  if (selectedResumenCard.value) {
    const { area, grado } = selectedResumenCard.value
    list = list.filter(det => {
      const matchArea = (det.area || '').trim().toLowerCase() === area.trim().toLowerCase()
      const matchGrado = (det.grado || '').trim().toLowerCase() === grado.trim().toLowerCase()
      return matchArea && matchGrado
    })
  }

  const status = filterEvidenceStatus.value
  if (status !== 'TODOS') {
    list = list.filter(det => {
      const esPlaneada = !!det.es_planeada
      const esEvaluada = det.evaluaciones && det.evaluaciones.length > 0

      if (status === 'PLANEADAS') {
        return esPlaneada
      } else if (status === 'EXTRAS') {
        return !esPlaneada && esEvaluada
      } else if (status === 'SIN_PLANEAR') {
        return !esPlaneada && !esEvaluada
      }
      return true
    })
  }

  return list
})

// Load filter options
const loadFilterOptions = async () => {
  if (!schoolId.value) return
  try {
    const params: any = { keys: 'periods,assignments' }
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const [settingsRes, teachersRes] = await Promise.all([
      api.get(`/academic-admin/settings/${schoolId.value}`, { params }),
      api.get(`/academic-admin/teachers/${schoolId.value}`, { params })
    ])
    
    periods.value = settingsRes.data.periods || []
    
    const assignments = settingsRes.data.assignments || []
    const uniqueGroupsMap = new Map<number, GroupOption>()
    const uniqueSubjectsMap = new Map<number, SubjectOption>()
    
    for (const a of assignments) {
      if (a.id_grupo) {
        uniqueGroupsMap.set(a.id_grupo, {
          id_grupo: a.id_grupo,
          nivel_nombre: a.nivel_nombre,
          tipo_grado_nombre: a.tipo_grado_nombre,
          seccion_nombre: a.seccion_nombre,
          jornada_nombre: a.jornada_nombre
        })
      }
      if (a.id_materia) {
        uniqueSubjectsMap.set(a.id_materia, {
          id_materia: a.id_materia,
          nombre: a.materia_nombre
        })
      }
    }
    
    groups.value = Array.from(uniqueGroupsMap.values())
    subjects.value = Array.from(uniqueSubjectsMap.values())
    teachers.value = teachersRes.data.teachers || []

    const gradeNamesSet = new Set<string>()
    for (const a of assignments) {
      if (a.tipo_grado_nombre) {
        gradeNamesSet.add(a.tipo_grado_nombre.trim())
      }
    }

    const standardGradesOrder = [
      'PARVULOS', 'PREJARDIN', 'JARDIN', 'TRANSICION',
      'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO',
      'SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO', 'DECIMO', 'ONCE'
    ]

    grades.value = Array.from(gradeNamesSet).sort((a, b) => {
      const idxA = standardGradesOrder.indexOf(a.toUpperCase())
      const idxB = standardGradesOrder.indexOf(b.toUpperCase())
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })
  } catch (error) {
    console.error('Error loading report filters:', error)
  }
}

// Fetch Coherencia Report
const fetchCoherenciaReport = async () => {
  if (!schoolId.value) return
  try {
    fetchingReports.value = true
    const params: any = {}
    if (yearStore.selectedYearId) {
      params.id_anio = yearStore.selectedYearId
    }
    if (filterPeriod.value !== 'TODOS') params.id_periodo = filterPeriod.value
    if (filterGroup.value !== 'TODOS') params.grado = filterGroup.value
    else if (filterCoherenciaGrade.value !== 'TODOS') params.grado = filterCoherenciaGrade.value
    if (filterSubject.value !== 'TODOS') params.id_materia = filterSubject.value
    if (filterTeacher.value !== 'TODOS') params.id_docente = filterTeacher.value

    coherenciaData.value = await dbaService.getSchoolCoherenciaReport(schoolId.value, params)
  } catch (error) {
    console.error('Error loading coherencia report:', error)
  } finally {
    fetchingReports.value = false
  }
}

const hasLoadedCobertura = ref(false)

// Fetch Cobertura Report
const fetchCoberturaReport = async () => {
  if (!schoolId.value) return
  try {
    fetchingReports.value = true
    const params: any = {}
    if (yearStore.selectedYearId) {
      params.id_anio = yearStore.selectedYearId
    }
    if (filterPeriod.value !== 'TODOS') params.id_periodo = filterPeriod.value
    if (filterCoberturaGroup.value !== 'TODOS') params.grado = filterCoberturaGroup.value
    if (filterCoberturaSubject.value !== 'TODOS') params.id_materia = filterCoberturaSubject.value

    const res = await dbaService.getSchoolCoberturaReport(schoolId.value, params)
    coberturaResumen.value = res.resumen || []
    coberturaDetalles.value = res.detalles || []
    selectedResumenCard.value = null
    searchResumenTerm.value = ''
    hasLoadedCobertura.value = true
  } catch (error) {
    console.error('Error loading cobertura report:', error)
  } finally {
    fetchingReports.value = false
  }
}

const loadData = async () => {
  loading.value = true
  hasLoadedCobertura.value = false
  await loadFilterOptions()
  if (activeTab.value === 'coherencia') {
    await fetchCoherenciaReport()
  } else {
    await fetchCoberturaReport()
  }
  loading.value = false
}

// Carga activa por pestaña para evitar mostrar ceros en transiciones
const isCurrentTabLoading = computed(() => {
  if (loading.value) return true
  if (activeTab.value === 'cobertura' && !hasLoadedCobertura.value) return true
  if (activeTab.value === 'coherencia' && coherenciaData.value.length === 0 && fetchingReports.value) return true
  return false
})

// Lazy load Cobertura tab when switched to it
watch(activeTab, async (newTab) => {
  if (newTab === 'cobertura' && !hasLoadedCobertura.value) {
    await fetchCoberturaReport()
  } else if (newTab === 'coherencia' && coherenciaData.value.length === 0) {
    await fetchCoherenciaReport()
  }
})

// Refresh data triggered by filters & academic year store
watch([filterPeriod, filterGroup, filterCoherenciaGrade, filterSubject, filterTeacher], () => {
  if (activeTab.value === 'coherencia') {
    fetchCoherenciaReport()
  }
})
watch([filterPeriod, filterCoberturaGroup, filterCoberturaSubject], () => {
  if (activeTab.value === 'cobertura' || hasLoadedCobertura.value) {
    fetchCoberturaReport()
  }
})
watch(() => yearStore.selectedYearId, async () => {
  catalogData.value = []
  coherenciaData.value = []
  coberturaResumen.value = []
  coberturaDetalles.value = []
  hasLoadedCobertura.value = false
  await loadData()
})

// Active Coherencia Filters & Clear Handlers
const activeCoherenciaFiltersCount = computed(() => {
  let count = 0
  if (filterPeriod.value !== 'TODOS') count++
  if (filterGroup.value !== 'TODOS' || filterCoherenciaGrade.value !== 'TODOS') count++
  if (filterSubject.value !== 'TODOS') count++
  if (filterTeacher.value !== 'TODOS') count++
  if (filterCoherenciaStatus.value !== 'TODOS') count++
  if (presetCoherenciaExtrasOnly.value) count++
  if (presetCoherenciaPlaneadasOnly.value) count++
  if (presetCoherenciaPendientesOnly.value) count++
  if (!filterHideEmptyGroups.value) count++
  if (searchTerm.value.trim()) count++
  return count
})

const hasActiveCoherenciaFilters = computed(() => activeCoherenciaFiltersCount.value > 0)

const clearCoherenciaFilters = () => {
  filterPeriod.value = 'TODOS'
  filterGroup.value = 'TODOS'
  filterCoherenciaGrade.value = 'TODOS'
  filterSubject.value = 'TODOS'
  filterTeacher.value = 'TODOS'
  filterCoherenciaStatus.value = 'TODOS'
  presetCoherenciaExtrasOnly.value = false
  presetCoherenciaPlaneadasOnly.value = false
  presetCoherenciaPendientesOnly.value = false
  filterHideEmptyGroups.value = true
  searchTerm.value = ''
}

const toggleCoherenciaExtrasPreset = () => {
  if (presetCoherenciaExtrasOnly.value) {
    presetCoherenciaExtrasOnly.value = false
  } else {
    presetCoherenciaExtrasOnly.value = true
    presetCoherenciaPlaneadasOnly.value = false
    presetCoherenciaPendientesOnly.value = false
  }
}

const toggleCoherenciaPlaneadasPreset = () => {
  if (presetCoherenciaPlaneadasOnly.value) {
    presetCoherenciaPlaneadasOnly.value = false
  } else {
    presetCoherenciaPlaneadasOnly.value = true
    presetCoherenciaExtrasOnly.value = false
    presetCoherenciaPendientesOnly.value = false
  }
}

const toggleCoherenciaPendientesPreset = () => {
  if (presetCoherenciaPendientesOnly.value) {
    presetCoherenciaPendientesOnly.value = false
  } else {
    presetCoherenciaPendientesOnly.value = true
    presetCoherenciaExtrasOnly.value = false
    presetCoherenciaPlaneadasOnly.value = false
  }
}

const selectCoherenciaStatusFromCard = (status: 'TODOS' | 'PLANEADAS' | 'EXTRAS') => {
  filterCoherenciaStatus.value = status
  presetCoherenciaExtrasOnly.value = false
  presetCoherenciaPlaneadasOnly.value = false
  presetCoherenciaPendientesOnly.value = false
}

// Search & Preset filtering for coherencia
const filteredCoherencia = computed(() => {
  let list = coherenciaData.value

  if (filterHideEmptyGroups.value) {
    list = list.filter(r => (r.total_estudiantes || 0) > 0)
  }

  if (presetCoherenciaExtrasOnly.value) {
    list = list.filter(r => r.estado_coherencia === 'EXTRA')
  }

  if (presetCoherenciaPlaneadasOnly.value) {
    list = list.filter(r => r.estado_coherencia === 'PLANEADA')
  }

  if (presetCoherenciaPendientesOnly.value) {
    list = list.filter(r => (r.estado_calificacion || 'SIN_CALIFICAR') !== 'COMPLETO')
  }

  const query = searchTerm.value.trim().toLowerCase()
  if (query) {
    list = list.filter(row => {
      const act = (row.actividad_nombre || '').toLowerCase()
      const doc = (row.docente_nombre || '').toLowerCase()
      const desc = (row.evidencia_descripcion || '').toLowerCase()
      const dba = (row.dba_enunciado || '').toLowerCase()
      const comp = (row.competencia_descripcion || '').toLowerCase()
      const compNom = (row.competencia_nombre || '').toLowerCase()
      const subj = (row.materia_nombre || '').toLowerCase()
      const group = (row.grupo_nombre || '').toLowerCase()
      
      return act.includes(query) || 
             doc.includes(query) || 
             desc.includes(query) || 
             dba.includes(query) || 
             comp.includes(query) ||
             compNom.includes(query) ||
             subj.includes(query) ||
             group.includes(query)
    })
  }

  const status = filterCoherenciaStatus.value
  if (status !== 'TODOS') {
    list = list.filter(row => {
      if (status === 'PLANEADAS') {
        return row.estado_coherencia === 'PLANEADA'
      } else if (status === 'EXTRAS') {
        return row.estado_coherencia === 'EXTRA'
      }
      return true
    })
  }

  return list
})

// GROUPING 1: Grouped by Activity (Eliminates Repetitive Rows)
const groupedCoherenciaByActivity = computed(() => {
  const map = new Map<string, {
    id_actividadmateria: number
    actividad_nombre: string
    actividad_porcentaje: number
    actividad_fecha: string
    docente_nombre: string
    grupo_nombre: string
    jornada_nombre?: string
    competencia_nombre?: string | null
    competencia_descripcion?: string
    materia_nombre: string
    periodo_nombre: string
    tiene_extras: boolean
    total_estudiantes: number
    estudiantes_calificados: number
    estudiantes_pendientes: number
    estado_calificacion: 'COMPLETO' | 'PARCIAL' | 'SIN_CALIFICAR'
    evidencias: Array<{
      id_evidencia_dba: number
      evidencia_descripcion: string
      id_dba: number
      numero_dba: number
      dba_enunciado: string
      estado_coherencia: 'PLANEADA' | 'EXTRA'
      motivo_extra?: string
      justificacion_extra?: string
    }>
  }>()

  filteredCoherencia.value.forEach(row => {
    const key = `${row.id_actividadmateria}_${row.docente_nombre}_${row.grupo_nombre}_${row.materia_nombre}`
    if (!map.has(key)) {
      map.set(key, {
        id_actividadmateria: row.id_actividadmateria,
        actividad_nombre: row.actividad_nombre,
        actividad_porcentaje: row.actividad_porcentaje,
        actividad_fecha: row.actividad_fecha,
        docente_nombre: row.docente_nombre,
        grupo_nombre: row.grupo_nombre,
        jornada_nombre: row.jornada_nombre,
        competencia_nombre: row.competencia_nombre,
        competencia_descripcion: row.competencia_descripcion,
        materia_nombre: row.materia_nombre,
        periodo_nombre: row.periodo_nombre,
        tiene_extras: false,
        total_estudiantes: row.total_estudiantes || 0,
        estudiantes_calificados: row.estudiantes_calificados || 0,
        estudiantes_pendientes: row.estudiantes_pendientes || 0,
        estado_calificacion: row.estado_calificacion || 'SIN_CALIFICAR',
        evidencias: []
      })
    }
    const actGroup = map.get(key)!
    if (row.estado_coherencia === 'EXTRA') {
      actGroup.tiene_extras = true
    }

    const exists = actGroup.evidencias.some(e => e.id_evidencia_dba === row.id_evidencia_dba)
    if (!exists) {
      actGroup.evidencias.push({
        id_evidencia_dba: row.id_evidencia_dba,
        evidencia_descripcion: row.evidencia_descripcion,
        id_dba: row.id_dba,
        numero_dba: row.numero_dba,
        dba_enunciado: row.dba_enunciado,
        estado_coherencia: row.estado_coherencia,
        motivo_extra: row.motivo_extra,
        justificacion_extra: row.justificacion_extra
      })
    }
  })

  return Array.from(map.values())
})

// GROUPING 2: Grouped by DBA
const groupedCoherenciaByDba = computed(() => {
  const map = new Map<number, {
    id_dba: number
    numero_dba: number
    dba_enunciado: string
    actividadesMap: Map<string, any>
  }>()

  filteredCoherencia.value.forEach(row => {
    if (!map.has(row.id_dba)) {
      map.set(row.id_dba, {
        id_dba: row.id_dba,
        numero_dba: row.numero_dba,
        dba_enunciado: row.dba_enunciado,
        actividadesMap: new Map()
      })
    }
    const dbaGroup = map.get(row.id_dba)!
    const actKey = `${row.id_actividadmateria}_${row.id_evidencia_dba}`
    if (!dbaGroup.actividadesMap.has(actKey)) {
      dbaGroup.actividadesMap.set(actKey, {
        id_actividadmateria: row.id_actividadmateria,
        actividad_nombre: row.actividad_nombre,
        actividad_porcentaje: row.actividad_porcentaje,
        docente_nombre: row.docente_nombre,
        grupo_nombre: row.grupo_nombre,
        materia_nombre: row.materia_nombre,
        periodo_nombre: row.periodo_nombre,
        evidencia_descripcion: row.evidencia_descripcion,
        estado_coherencia: row.estado_coherencia,
        motivo_extra: row.motivo_extra,
        justificacion_extra: row.justificacion_extra
      })
    }
  })

  return Array.from(map.values()).map(dba => ({
    id_dba: dba.id_dba,
    numero_dba: dba.numero_dba,
    dba_enunciado: dba.dba_enunciado,
    actividades: Array.from(dba.actividadesMap.values())
  })).sort((a, b) => a.numero_dba - b.numero_dba)
})

// GROUPING 3: Grouped by Teacher (Executive Directorial Matrix)
export interface TeacherExecutiveActivity {
  id_actividadmateria: number
  actividad_nombre: string
  materia_nombre: string
  grupo_nombre: string
  jornada_nombre?: string
  periodo_nombre: string
  competencia_nombre?: string | null
  competencia_descripcion?: string
  total_estudiantes: number
  estudiantes_calificados: number
  estudiantes_pendientes: number
  estado_calificacion: 'COMPLETO' | 'PARCIAL' | 'SIN_CALIFICAR'
}

export interface TeacherExecutiveStats {
  id_docente: number
  docente_nombre: string
  materias: string[]
  grupos: string[]
  total_actividades: number
  total_estudiantes_evaluables: number
  total_estudiantes_calificados: number
  total_estudiantes_pendientes: number
  tasa_calificacion: number
  estado_general: 'COMPLETO' | 'PARCIAL' | 'SIN_CALIFICAR'
  actividades: TeacherExecutiveActivity[]
}

const groupedCoherenciaByTeacher = computed<TeacherExecutiveStats[]>(() => {
  const map = new Map<string, TeacherExecutiveStats>()

  groupedCoherenciaByActivity.value.forEach(act => {
    const teacherName = (act.docente_nombre || 'Docente no asignado').trim()
    if (!map.has(teacherName)) {
      map.set(teacherName, {
        id_docente: 0,
        docente_nombre: teacherName,
        materias: [],
        grupos: [],
        total_actividades: 0,
        total_estudiantes_evaluables: 0,
        total_estudiantes_calificados: 0,
        total_estudiantes_pendientes: 0,
        tasa_calificacion: 0,
        estado_general: 'COMPLETO',
        actividades: []
      })
    }
    const t = map.get(teacherName)!
    if (act.materia_nombre && !t.materias.includes(act.materia_nombre)) {
      t.materias.push(act.materia_nombre)
    }
    if (act.grupo_nombre && !t.grupos.includes(act.grupo_nombre)) {
      t.grupos.push(act.grupo_nombre)
    }
    t.total_actividades++
    t.total_estudiantes_evaluables += act.total_estudiantes || 0
    t.total_estudiantes_calificados += act.estudiantes_calificados || 0
    t.total_estudiantes_pendientes += act.estudiantes_pendientes || 0
    t.actividades.push({
      id_actividadmateria: act.id_actividadmateria,
      actividad_nombre: act.actividad_nombre,
      materia_nombre: act.materia_nombre,
      grupo_nombre: act.grupo_nombre,
      jornada_nombre: act.jornada_nombre,
      periodo_nombre: act.periodo_nombre,
      competencia_nombre: act.competencia_nombre,
      competencia_descripcion: act.competencia_descripcion,
      total_estudiantes: act.total_estudiantes || 0,
      estudiantes_calificados: act.estudiantes_calificados || 0,
      estudiantes_pendientes: act.estudiantes_pendientes || 0,
      estado_calificacion: act.estado_calificacion
    })
  })

  const result = Array.from(map.values()).map(t => {
    const tasa = t.total_estudiantes_evaluables > 0
      ? Math.round((t.total_estudiantes_calificados / t.total_estudiantes_evaluables) * 100)
      : (t.total_actividades > 0 ? 0 : 100)

    let estado: 'COMPLETO' | 'PARCIAL' | 'SIN_CALIFICAR' = 'COMPLETO'
    if (t.total_estudiantes_calificados === 0 && t.total_estudiantes_evaluables > 0) {
      estado = 'SIN_CALIFICAR'
    } else if (t.total_estudiantes_pendientes > 0) {
      estado = 'PARCIAL'
    }

    return {
      ...t,
      tasa_calificacion: tasa,
      estado_general: estado
    }
  })

  return result.sort((a, b) => {
    if (a.estado_general !== 'COMPLETO' && b.estado_general === 'COMPLETO') return -1
    if (a.estado_general === 'COMPLETO' && b.estado_general !== 'COMPLETO') return 1
    return a.docente_nombre.localeCompare(b.docente_nombre)
  })
})

const directivosComplianceStats = computed(() => {
  const teacherList = groupedCoherenciaByTeacher.value
  const totalTeachers = teacherList.length
  const teachersAlDia = teacherList.filter(t => t.estado_general === 'COMPLETO').length
  const teachersPendientes = totalTeachers - teachersAlDia

  let totalEstudiantes = 0
  let totalCalificados = 0
  teacherList.forEach(t => {
    totalEstudiantes += t.total_estudiantes_evaluables
    totalCalificados += t.total_estudiantes_calificados
  })

  const tasaGlobal = totalEstudiantes > 0 ? Math.round((totalCalificados / totalEstudiantes) * 100) : 100

  return {
    totalTeachers,
    teachersAlDia,
    teachersPendientes,
    tasaGlobal
  }
})

// Coherencia Statistics
const coherenciaStats = computed(() => {
  const total = filteredCoherencia.value.length
  if (total === 0) return { total: 0, planeadas: 0, extras: 0, pct: 0 }
  
  const planeadas = filteredCoherencia.value.filter(r => r.estado_coherencia === 'PLANEADA').length
  const extras = total - planeadas
  const pct = Math.round((planeadas / total) * 100)
  
  return { total, planeadas, extras, pct }
})

// Cobertura Statistics
const coberturaStats = computed(() => {
  let totalEvs = 0
  let evaluatedEvs = 0
  
  for (const r of coberturaResumen.value) {
    totalEvs += r.total_evidencias
    evaluatedEvs += r.evidencias_evaluadas
  }
  
  const pct = totalEvs > 0 ? Math.round((evaluatedEvs / totalEvs) * 100) : 0
  const pending = totalEvs - evaluatedEvs
  
  return { total: totalEvs, covered: evaluatedEvs, pending, pct }
})

const getCoherencePctClass = (pct: number) => {
  if (pct >= 85) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400'
  if (pct >= 60) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400'
  return 'text-rose-500 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400'
}

const getCoherenceProgressBarClass = (pct: number) => {
  if (pct >= 85) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

const formatMotivoExtra = (motivo?: string) => {
  if (!motivo) return 'No especificado'
  const map: Record<string, string> = {
    'RECUPERACION_REFUERZO': 'Recuperación o refuerzo',
    'ADELANTO_CURRICULAR': 'Adelanto curricular',
    'INTEGRACION_ASIGNATURA': 'Integración con otra asignatura',
    'CALENDARIO_INSTITUCIONAL': 'Ajuste por calendario institucional',
    'NECESIDAD_PEDAGOGICA': 'Necesidad pedagógica detectada',
    'OTRO': 'Otro'
  }
  return map[motivo] || motivo
}

// CSV Export for Coherencia
const exportCoherenciaCSV = () => {
  if (filteredCoherencia.value.length === 0) return
  
  const headers = [
    'Periodo', 'Grupo', 'Docente', 'Materia', 
    'Actividad', 'Peso %', 'Tipo Evidencia', 
    'Evidencia DBA', 'Enunciado DBA', 'Motivo Extra', 'Justificacion Extra'
  ]

  const rows = filteredCoherencia.value.map(r => [
    `"${r.periodo_nombre || ''}"`,
    `"${r.grupo_nombre || ''}"`,
    `"${r.docente_nombre || ''}"`,
    `"${r.materia_nombre || ''}"`,
    `"${r.actividad_nombre || ''}"`,
    `"${r.actividad_porcentaje}%"`,
    `"${r.estado_coherencia}"`,
    `"${(r.evidencia_descripcion || '').replace(/"/g, '""')}"`,
    `"${(r.dba_enunciado || '').replace(/"/g, '""')}"`,
    `"${formatMotivoExtra(r.motivo_extra)}"`,
    `"${(r.justificacion_extra || '').replace(/"/g, '""')}"`
  ])

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `Reporte_Coherencia_DBA_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6 sm:space-y-8 pb-12 animate-in fade-in duration-500">
    
    <!-- Top Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-center gap-3 sm:gap-4">
        <router-link to="/dashboard/configuracion-academica" class="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 shrink-0">
          <ArrowLeft class="h-4 w-4 sm:h-5 sm:w-5" />
        </router-link>
        <div>
          <div class="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Coherencia y Cobertura DBA</h1>
            <button
              @click="openCatalogModal"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-amber-50 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black text-amber-700 hover:bg-amber-100 transition border border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40 cursor-pointer"
            >
              <BookOpen class="h-3.5 w-3.5" />
              <span>Ver Catálogo Global</span>
            </button>
            <button
              @click="showExecutiveGuide = !showExecutiveGuide"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-indigo-50 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black text-indigo-700 hover:bg-indigo-100 transition border border-indigo-200/50 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/40 cursor-pointer"
            >
              <HelpCircle class="h-3.5 w-3.5" />
              <span>{{ showExecutiveGuide ? 'Ocultar Guía' : 'ℹ️ Guía Directiva' }}</span>
            </button>
            <span v-if="fetchingReports && !isCurrentTabLoading" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-200/40 animate-pulse">
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              <span>Actualizando datos...</span>
            </span>
          </div>
          <p class="mt-1 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Analiza la correspondencia entre la planeación curricular y la evaluación docente en aula.</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex rounded-2xl sm:rounded-3xl bg-slate-900/90 p-1 sm:p-1.5 backdrop-blur-md shadow-xl dark:bg-slate-800/90 border border-slate-800 w-full sm:w-auto">
        <button
          type="button"
          @click="activeTab = 'coherencia'"
          :class="activeTab === 'coherencia' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 border-amber-500' : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white border-transparent'"
          class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-black transition-all border uppercase tracking-wider cursor-pointer"
        >
          <PieChart class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Coherencia Curricular</span>
        </button>
        <button
          type="button"
          @click="activeTab = 'cobertura'"
          :class="activeTab === 'cobertura' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 border-amber-500' : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white border-transparent'"
          class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-black transition-all border uppercase tracking-wider cursor-pointer"
        >
          <BarChart3 class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Cobertura del Catálogo</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isCurrentTabLoading" class="rounded-2xl sm:rounded-[32px] border border-slate-100 bg-white p-12 sm:p-24 text-center dark:bg-slate-900 dark:border-slate-800 shadow-sm animate-in fade-in duration-300">
      <RefreshCw class="mx-auto h-10 w-10 sm:h-12 sm:w-12 animate-spin text-amber-500 mb-4" />
      <p class="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
        {{ activeTab === 'cobertura' ? 'Calculando Cobertura del Catálogo DBA...' : 'Cargando Reportes Analíticos DBA...' }}
      </p>
      <p class="text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-500 mt-1.5">
        Procesando evidencias curriculares y registros evaluativos en tiempo real...
      </p>
    </div>

    <template v-else>
      <!-- SECTION 1: COHERENCIA CURRICULAR -->
      <div v-if="activeTab === 'coherencia'" class="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        
        <!-- EXECUTIVE GUIDANCE BANNER FOR DIRECTORS -->
        <div v-if="showExecutiveGuide" class="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-900/90 via-slate-900/90 to-amber-950/80 text-white shadow-xl border border-indigo-500/20 space-y-4 animate-in fade-in duration-300">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400 border border-white/10">
                <HelpCircle class="w-5 h-5" />
              </div>
              <div>
                <h3 class="text-base font-black tracking-wide">Guía de Interpretación para Directivos y Coordinación</h3>
                <p class="text-xs text-indigo-200">Conceptos clave para auditar el cumplimiento pedagógico y normativo en el colegio</p>
              </div>
            </div>
            <button @click="showExecutiveGuide = false" class="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <!-- Card 1: Coherencia -->
            <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div class="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <Layers class="w-4 h-4" />
                <span>1. Coherencia Curricular</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">
                Compara lo que el docente planificó en el plan de estudios frente a lo que efectivamente evalúa en el aula.
              </p>
              <ul class="text-[11px] text-slate-300/90 space-y-1">
                <li><b class="text-emerald-400">Planeada:</b> La actividad evalúa exactamente una evidencia aprobada en la planeación curricular.</li>
                <li><b class="text-amber-400">Desvío / Extra:</b> Evidencia evaluada fuera de planeación (requiere justificación pedagógica registrada).</li>
              </ul>
            </div>

            <!-- Card 2: Cobertura DBA -->
            <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div class="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                <BookOpen class="w-4 h-4" />
                <span>2. Cobertura del Catálogo</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">
                Mide el avance institucional frente a los Derechos Básicos de Aprendizaje (DBA) expedidos por el MEN para cada grado y área.
              </p>
              <p class="text-[11px] text-slate-300/90">
                Permite verificar con certeza que todos los estudiantes fueron evaluados en las competencias mínimas nacionales.
              </p>
            </div>

            <!-- Card 3: Auditoría de Calificación -->
            <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div class="flex items-center gap-2 text-rose-400 text-xs font-black uppercase tracking-wider">
                <AlertTriangle class="w-4 h-4" />
                <span>3. Auditoría de Calificación</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">
                Supervisa si los docentes ya asentaron notas definitivas a los estudiantes en las actividades creadas.
              </p>
              <ul class="text-[11px] text-slate-300/90 space-y-1">
                <li><b class="text-emerald-400">Completo (100%):</b> Todos los alumnos matriculados tienen nota.</li>
                <li><b class="text-amber-400">Parcial:</b> Hay alumnos pendientes de asentar nota.</li>
                <li><b class="text-rose-400">Sin Calificar:</b> Cero notas asentadas en el sistema.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Interactive KPI Cards Grid -->
        <div class="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          <!-- Total Card -->
          <button 
            @click="selectCoherenciaStatusFromCard('TODOS')"
            class="rounded-2xl sm:rounded-3xl border p-4 sm:p-6 text-left shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            :class="[
              filterCoherenciaStatus === 'TODOS' && !presetCoherenciaExtrasOnly && !presetCoherenciaPlaneadasOnly
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 ring-2 ring-slate-900/20'
                : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 text-slate-900 dark:text-white'
            ]"
          >
            <p class="text-[9px] sm:text-[10px] uppercase font-black tracking-widest opacity-60">Evidencias Evaluadas</p>
            <p class="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-black">{{ coherenciaStats.total }}</p>
            <p class="mt-1 sm:mt-2 text-[10px] sm:text-xs font-semibold opacity-70 truncate">Total en el rango</p>
          </button>
          
          <!-- Planeadas Card -->
          <button 
            @click="selectCoherenciaStatusFromCard('PLANEADAS')"
            class="rounded-2xl sm:rounded-3xl border p-4 sm:p-6 text-left shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            :class="[
              filterCoherenciaStatus === 'PLANEADAS' || presetCoherenciaPlaneadasOnly
                ? 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-500/20'
                : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 text-emerald-900 dark:text-emerald-200'
            ]"
          >
            <p class="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-400" :class="filterCoherenciaStatus === 'PLANEADAS' || presetCoherenciaPlaneadasOnly ? 'text-white' : ''">Evidencias Planeadas</p>
            <p class="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400" :class="filterCoherenciaStatus === 'PLANEADAS' || presetCoherenciaPlaneadasOnly ? 'text-white' : ''">{{ coherenciaStats.planeadas }}</p>
            <p class="mt-1 sm:mt-2 text-[10px] sm:text-xs font-semibold opacity-70 truncate">En planeación</p>
          </button>

          <!-- Extras Card -->
          <button 
            @click="selectCoherenciaStatusFromCard('EXTRAS')"
            class="rounded-2xl sm:rounded-3xl border p-4 sm:p-6 text-left shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            :class="[
              filterCoherenciaStatus === 'EXTRAS' || presetCoherenciaExtrasOnly
                ? 'border-amber-600 bg-amber-600 text-white ring-2 ring-amber-500/20'
                : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 text-amber-900 dark:text-amber-200'
            ]"
          >
            <p class="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-amber-600 dark:text-amber-400" :class="filterCoherenciaStatus === 'EXTRAS' || presetCoherenciaExtrasOnly ? 'text-white' : ''">Evidencias Extras (Desvíos)</p>
            <p class="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400" :class="filterCoherenciaStatus === 'EXTRAS' || presetCoherenciaExtrasOnly ? 'text-white' : ''">{{ coherenciaStats.extras }}</p>
            <p class="mt-1 sm:mt-2 text-[10px] sm:text-xs font-semibold opacity-70 truncate">Fuera de planeación</p>
          </button>

          <!-- Metric Card -->
          <div class="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between col-span-2 lg:col-span-1">
            <div>
              <p class="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-slate-400">Coherencia Curricular</p>
              <div class="mt-1.5 sm:mt-2 flex items-baseline gap-2">
                <span class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{{ coherenciaStats.pct }}%</span>
                <span :class="getCoherencePctClass(coherenciaStats.pct)" class="rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase">
                  {{ coherenciaStats.pct >= 85 ? 'Alta' : coherenciaStats.pct >= 60 ? 'Media' : 'Baja' }}
                </span>
              </div>
            </div>
            <div class="mt-3 sm:mt-4 w-full bg-slate-100 rounded-full h-2 sm:h-2.5 dark:bg-slate-800 overflow-hidden">
              <div :class="getCoherenceProgressBarClass(coherenciaStats.pct)" class="h-2 sm:h-2.5 rounded-full transition-all duration-500" :style="{ width: `${coherenciaStats.pct}%` }"></div>
            </div>
          </div>
        </div>

        <!-- EXECUTIVE COMPLIANCE SEMAPHORE BAR -->
        <div class="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Auditoría Docente Institucional:</span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-black shadow-xs">
              <Check class="w-3.5 h-3.5 text-emerald-600" /> {{ directivosComplianceStats.teachersAlDia }} Docentes al Día
            </span>
            <button 
              @click="toggleCoherenciaPendientesPreset"
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-transform hover:scale-105 cursor-pointer shadow-xs border"
              :class="directivosComplianceStats.teachersPendientes > 0 
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300/40' 
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'"
              title="Clic para filtrar solo actividades pendientes por evaluar"
            >
              <AlertTriangle class="w-3.5 h-3.5 text-rose-600" /> 
              <span>{{ directivosComplianceStats.teachersPendientes }} Docentes con Pendientes</span>
            </button>
          </div>

          <div class="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Tasa Global de Calificación:</span>
            <span class="font-black text-slate-900 dark:text-white text-sm">{{ directivosComplianceStats.tasaGlobal }}%</span>
            <div class="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                class="h-2 rounded-full transition-all duration-500" 
                :class="directivosComplianceStats.tasaGlobal >= 85 ? 'bg-emerald-500' : directivosComplianceStats.tasaGlobal >= 60 ? 'bg-amber-500' : 'bg-rose-500'"
                :style="{ width: `${directivosComplianceStats.tasaGlobal}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- MULTI-DIMENSIONAL INTERACTIVE FILTER PANEL -->
        <div class="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-4 sm:space-y-5">
          
          <!-- Row 1: Header, View Mode Selector & Status Tabs -->
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <Filter class="w-5 h-5 text-amber-500" />
              <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Filtros de Auditoría</h3>
              <span v-if="hasActiveCoherenciaFilters" class="ml-2 px-2.5 py-0.5 text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-full">
                {{ activeCoherenciaFiltersCount }} {{ activeCoherenciaFiltersCount === 1 ? 'activo' : 'activos' }}
              </span>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <!-- View Mode Toggles -->
              <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                <button 
                  @click="coherenciaViewMode = 'groupedActivity'"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="coherenciaViewMode === 'groupedActivity' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                  title="Vista agrupada por actividad evaluativa (sin repetición)"
                >
                  <Layers class="w-3.5 h-3.5" />
                  <span>Por Actividad</span>
                </button>

                <button 
                  @click="coherenciaViewMode = 'groupedDba'"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="coherenciaViewMode === 'groupedDba' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                  title="Vista agrupada por Derecho Básico de Aprendizaje"
                >
                  <BookOpen class="w-3.5 h-3.5" />
                  <span>Por DBA</span>
                </button>

                <button 
                  @click="coherenciaViewMode = 'groupedTeacher'"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="coherenciaViewMode === 'groupedTeacher' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                  title="Matriz Ejecutiva de Supervisión Docente"
                >
                  <Users class="w-3.5 h-3.5" />
                  <span>Por Docente (Matriz)</span>
                </button>

                <button 
                  @click="coherenciaViewMode = 'table'"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="coherenciaViewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                  title="Vista en tabla detallada"
                >
                  <Table class="w-3.5 h-3.5" />
                  <span>Tabla</span>
                </button>
              </div>

              <!-- Status Tabs -->
              <div class="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl">
                <button 
                  @click="filterCoherenciaStatus = 'TODOS'"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="filterCoherenciaStatus === 'TODOS' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
                >Todos</button>
                <button 
                  @click="filterCoherenciaStatus = 'PLANEADAS'"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="filterCoherenciaStatus === 'PLANEADAS' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600/70 hover:text-emerald-700 dark:hover:text-emerald-400'"
                >Planeadas</button>
                <button 
                  @click="filterCoherenciaStatus = 'EXTRAS'"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="filterCoherenciaStatus === 'EXTRAS' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600/70 hover:text-amber-700 dark:hover:text-amber-400'"
                >Extras</button>
              </div>
            </div>
          </div>

          <!-- Row 2: Dropdowns & Search -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <!-- Search bar -->
            <div class="sm:col-span-2 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 hover:border-slate-300 transition-colors focus-within:ring-4 focus-within:ring-amber-500/10 focus-within:border-amber-300">
              <Search class="w-4 h-4 text-slate-400 shrink-0" />
              <input 
                v-model="searchTerm" 
                type="text" 
                placeholder="Buscar docente, materia, actividad o DBA..."
                class="bg-transparent border-none outline-none w-full text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 py-1"
              />
              <button v-if="searchTerm" @click="searchTerm = ''" class="text-slate-400 hover:text-slate-600">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Period Select -->
            <div>
              <select v-model="filterPeriod" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-amber-300 transition-colors">
                <option value="TODOS">Todos los periodos</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="String(p.id_periodo)">{{ p.nombre }}</option>
              </select>
            </div>

            <!-- Grade Select -->
            <div>
              <select v-model="filterCoherenciaGrade" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-amber-300 transition-colors">
                <option value="TODOS">Todos los grados</option>
                <option v-for="gName in grades" :key="gName" :value="gName">
                  Grado {{ gName }}
                </option>
              </select>
            </div>

            <!-- Subject Select -->
            <div>
              <select v-model="filterSubject" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-amber-300 transition-colors">
                <option value="TODOS">Todas las materias</option>
                <option v-for="s in subjects" :key="s.id_materia" :value="String(s.id_materia)">{{ s.nombre }}</option>
              </select>
            </div>
          </div>

          <!-- Row 3: Presets & Clear Button -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
              
              <!-- Preset 1: Solo Desvíos / Extras con Justificación -->
              <button 
                @click="toggleCoherenciaExtrasPreset"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                :class="presetCoherenciaExtrasOnly ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
              >
                <Zap class="w-3.5 h-3.5 text-amber-300" :class="presetCoherenciaExtrasOnly ? 'text-white' : ''" />
                <span>Solo Desvíos / Extras</span>
              </button>

              <!-- Preset 2: Solo Planeadas -->
              <button 
                @click="toggleCoherenciaPlaneadasPreset"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                :class="presetCoherenciaPlaneadasOnly ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
              >
                <Check class="w-3.5 h-3.5 text-emerald-300" :class="presetCoherenciaPlaneadasOnly ? 'text-white' : ''" />
                <span>Solo Planeadas</span>
              </button>

              <!-- Preset 3: Pendientes de Calificar (Seguimiento Directivo) -->
              <button 
                @click="toggleCoherenciaPendientesPreset"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                :class="presetCoherenciaPendientesOnly ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
                title="Mostrar solo actividades donde los docentes tienen notas pendientes por asentar"
              >
                <AlertTriangle class="w-3.5 h-3.5 text-rose-300" :class="presetCoherenciaPendientesOnly ? 'text-white' : ''" />
                <span>Pendientes por Evaluar</span>
              </button>

              <!-- Preset 4: Ocultar grupos sin estudiantes -->
              <button 
                @click="filterHideEmptyGroups = !filterHideEmptyGroups"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                :class="filterHideEmptyGroups ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
                title="Ocultar actividades de grupos sin alumnos matriculados (0/0 evaluados)"
              >
                <Users class="w-3.5 h-3.5" :class="filterHideEmptyGroups ? 'text-indigo-200' : 'text-slate-400'" />
                <span>{{ filterHideEmptyGroups ? 'Ocultando cursos vacíos' : 'Mostrando cursos vacíos' }}</span>
              </button>

              <!-- Teacher Select Dropdown -->
              <select v-model="filterTeacher" class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-amber-300">
                <option value="TODOS">Todos los docentes</option>
                <option v-for="t in teachers" :key="t.id_docente" :value="String(t.id_docente)">{{ t.nombre }} {{ t.apellido }}</option>
              </select>
            </div>

            <!-- Clear Filters Button -->
            <button 
              v-if="hasActiveCoherenciaFilters"
              @click="clearCoherenciaFilters"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 hover:bg-amber-100 transition-all cursor-pointer"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          </div>

          <!-- Active Filter Chips Bar -->
          <div v-if="hasActiveCoherenciaFilters" class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros aplicados:</span>
            
            <span v-if="filterCoherenciaStatus !== 'TODOS'" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
              Estado: {{ filterCoherenciaStatus }}
              <X @click="filterCoherenciaStatus = 'TODOS'" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="filterCoherenciaGrade !== 'TODOS'" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
              Grado: {{ filterCoherenciaGrade }}
              <X @click="filterCoherenciaGrade = 'TODOS'" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="filterPeriod !== 'TODOS'" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
              Periodo: {{ periods.find(p => String(p.id_periodo) === filterPeriod)?.nombre }}
              <X @click="filterPeriod = 'TODOS'" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="filterSubject !== 'TODOS'" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
              Materia: {{ subjects.find(s => String(s.id_materia) === filterSubject)?.nombre }}
              <X @click="filterSubject = 'TODOS'" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="filterTeacher !== 'TODOS'" class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
              Docente: {{ teachers.find(t => String(t.id_docente) === filterTeacher)?.nombre }}
              <X @click="filterTeacher = 'TODOS'" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="presetCoherenciaExtrasOnly" class="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300">
              Solo Extras
              <X @click="presetCoherenciaExtrasOnly = false" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="presetCoherenciaPlaneadasOnly" class="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Solo Planeadas
              <X @click="presetCoherenciaPlaneadasOnly = false" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="presetCoherenciaPendientesOnly" class="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-800 dark:text-rose-300">
              Pendientes de Calificar
              <X @click="presetCoherenciaPendientesOnly = false" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="!filterHideEmptyGroups" class="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-800 dark:text-indigo-300">
              Incluyendo cursos vacíos
              <X @click="filterHideEmptyGroups = true" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>

            <span v-if="searchTerm" class="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300">
              "{{ searchTerm }}"
              <X @click="searchTerm = ''" class="w-3 h-3 cursor-pointer hover:text-amber-500" />
            </span>
          </div>
        </div>

        <!-- COHERENCIA MAIN CONTENT CONTAINER -->
        <div class="rounded-3xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 p-6 space-y-6">
          
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 class="text-lg font-black text-slate-900 dark:text-white">Análisis de Coherencia Curricular</h4>
              <p class="text-xs font-semibold text-slate-400 mt-0.5">
                <template v-if="coherenciaViewMode === 'groupedActivity'">
                  {{ groupedCoherenciaByActivity.length }} actividades evaluativas consolidadas sin redundancia.
                </template>
                <template v-else-if="coherenciaViewMode === 'groupedDba'">
                  {{ groupedCoherenciaByDba.length }} Derechos Básicos de Aprendizaje con evaluaciones en aula.
                </template>
                <template v-else-if="coherenciaViewMode === 'groupedTeacher'">
                  {{ groupedCoherenciaByTeacher.length }} docentes supervisados en su avance evaluativo institucional.
                </template>
                <template v-else>
                  {{ filteredCoherencia.length }} registros detallados disponibles.
                </template>
              </p>
            </div>

            <!-- Global Accordion Controls (Expand/Collapse All) & Export Button -->
            <div class="flex flex-wrap items-center gap-3">
              <template v-if="coherenciaViewMode === 'groupedActivity'">
                <button 
                  @click="expandAllActivities"
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  title="Desplegar todas las tarjetas"
                >
                  <ChevronsDown class="w-3.5 h-3.5" />
                  <span>Expandir todo</span>
                </button>
                <button 
                  @click="collapseAllActivities"
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  title="Plegar todas las tarjetas"
                >
                  <ChevronsUp class="w-3.5 h-3.5" />
                  <span>Colapsar todo</span>
                </button>
              </template>

              <template v-else-if="coherenciaViewMode === 'groupedDba'">
                <button 
                  @click="expandAllDbas"
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                >
                  <ChevronsDown class="w-3.5 h-3.5" />
                  <span>Expandir todo</span>
                </button>
                <button 
                  @click="collapseAllDbas"
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                >
                  <ChevronsUp class="w-3.5 h-3.5" />
                  <span>Colapsar todo</span>
                </button>
              </template>

              <template v-else-if="coherenciaViewMode === 'groupedTeacher'">
                <button 
                  @click="expandAllTeachers"
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  title="Desplegar todas las fichas de docentes"
                >
                  <ChevronsDown class="w-3.5 h-3.5" />
                  <span>Expandir todo</span>
                </button>
                <button 
                  @click="collapseAllTeachers"
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  title="Plegar todas las fichas de docentes"
                >
                  <ChevronsUp class="w-3.5 h-3.5" />
                  <span>Colapsar todo</span>
                </button>
              </template>

              <button
                v-if="filteredCoherencia.length > 0"
                @click="exportCoherenciaCSV"
                type="button"
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-500 uppercase tracking-widest shadow-md shadow-amber-900/10 transition cursor-pointer"
              >
                <Download class="h-4 w-4" />
                Exportar CSV
              </button>
            </div>
          </div>

          <div v-if="filteredCoherencia.length === 0" class="py-16 text-center">
            <AlertTriangle class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p class="text-base font-black text-slate-700 dark:text-slate-400">No se encontraron registros de coherencia.</p>
            <p class="text-sm font-semibold text-slate-400 dark:text-slate-500 max-w-md mx-auto mt-1">Ajusta los filtros de búsqueda o desactiva "Ocultar cursos vacíos" para revisar grupos sin matriculados.</p>
            <button @click="clearCoherenciaFilters" class="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 transition-colors cursor-pointer">
              <RotateCcw class="w-4 h-4" />
              <span>Limpiar filtros</span>
            </button>
          </div>

          <!-- MODE 1: GROUPED BY ACTIVITY (EXPANDABLE / COLLAPSIBLE ACCORDION) -->
          <div v-else-if="coherenciaViewMode === 'groupedActivity'" class="grid grid-cols-1 gap-4">
            <div 
              v-for="actGroup in groupedCoherenciaByActivity" 
              :key="`${actGroup.id_actividadmateria}_${actGroup.docente_nombre}_${actGroup.grupo_nombre}_${actGroup.materia_nombre}`"
              class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-5 md:p-6 space-y-4 hover:border-slate-200 transition-all shadow-sm"
            >
              <!-- Clickable Accordion Header -->
              <div 
                @click="toggleActivityCard(`${actGroup.id_actividadmateria}_${actGroup.docente_nombre}_${actGroup.grupo_nombre}_${actGroup.materia_nombre}`)"
                class="flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none group"
                :class="!isActivityCardCollapsed(`${actGroup.id_actividadmateria}_${actGroup.docente_nombre}_${actGroup.grupo_nombre}_${actGroup.materia_nombre}`) ? 'pb-4 border-b border-slate-200/60 dark:border-slate-800' : ''"
              >
                <div class="space-y-1.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-extrabold text-slate-900 dark:text-white text-base group-hover:text-amber-600 transition-colors">{{ actGroup.actividad_nombre }}</span>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      Peso: {{ actGroup.actividad_porcentaje }}%
                    </span>
                    <span 
                      v-if="actGroup.tiene_extras" 
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1"
                    >
                      <Zap class="w-3 h-3" /> Contiene Desvíos Extras
                    </span>

                    <!-- Badge de Calificación Docente en Aula -->
                    <span 
                      v-if="actGroup.estado_calificacion === 'COMPLETO'" 
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 shadow-xs"
                      :title="`Todos los estudiantes tienen nota asentada (${actGroup.estudiantes_calificados} de ${actGroup.total_estudiantes})`"
                    >
                      <Check class="w-3 h-3 text-emerald-600" /> {{ actGroup.estudiantes_calificados }}/{{ actGroup.total_estudiantes }} Evaluados (100%)
                    </span>
                    <span 
                      v-else-if="actGroup.estado_calificacion === 'PARCIAL'" 
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 flex items-center gap-1 shadow-xs border border-amber-300/40"
                      :title="`Evaluación parcial: Faltan ${actGroup.estudiantes_pendientes} estudiantes por calificar`"
                    >
                      <AlertTriangle class="w-3 h-3 text-amber-600" /> {{ actGroup.estudiantes_calificados }}/{{ actGroup.total_estudiantes }} Evaluados · Faltan {{ actGroup.estudiantes_pendientes }}
                    </span>
                    <span 
                      v-else 
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1 shadow-xs border border-rose-300/40"
                      :title="`El docente creó la actividad pero no ha calificado a ningún estudiante (0 de ${actGroup.total_estudiantes})`"
                    >
                      <AlertTriangle class="w-3 h-3 text-rose-600" /> 0/{{ actGroup.total_estudiantes }} Evaluados · Sin Calificar
                    </span>
                  </div>

                  <!-- Competencia Asociada Pill -->
                  <div v-if="actGroup.competencia_nombre || actGroup.competencia_descripcion" class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-100/70 dark:bg-slate-800/70 px-2.5 py-1 rounded-xl w-fit">
                    <Target class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span class="font-extrabold text-slate-800 dark:text-slate-200">{{ actGroup.competencia_nombre || 'Competencia' }}:</span>
                    <span class="line-clamp-1 max-w-xl text-[11px]">{{ actGroup.competencia_descripcion }}</span>
                  </div>

                  <!-- Meta Info Line con Jornada explícita -->
                  <div class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span class="text-slate-800 dark:text-slate-200 font-extrabold">{{ actGroup.docente_nombre }}</span>
                    <span>·</span>
                    <span class="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-lg border border-indigo-100/30 font-extrabold">{{ actGroup.grupo_nombre }}</span>
                    <span>·</span>
                    <span class="text-amber-700 dark:text-amber-400 font-extrabold uppercase">{{ actGroup.materia_nombre }}</span>
                    <span v-if="actGroup.periodo_nombre">· {{ actGroup.periodo_nombre }}</span>
                  </div>
                </div>

                <!-- Toggle Badge / Chevron Icon -->
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-xs font-bold text-slate-400 dark:text-slate-500">
                    {{ actGroup.evidencias.length }} {{ actGroup.evidencias.length === 1 ? 'evidencia' : 'evidencias' }}
                  </span>
                  <div class="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 group-hover:border-amber-400 group-hover:text-amber-600 transition-colors">
                    <ChevronUp v-if="!isActivityCardCollapsed(`${actGroup.id_actividadmateria}_${actGroup.docente_nombre}_${actGroup.grupo_nombre}_${actGroup.materia_nombre}`)" class="w-4 h-4" />
                    <ChevronDown v-else class="w-4 h-4" />
                  </div>
                </div>
              </div>

              <!-- Collapsible Body -->
              <div v-if="!isActivityCardCollapsed(`${actGroup.id_actividadmateria}_${actGroup.docente_nombre}_${actGroup.grupo_nombre}_${actGroup.materia_nombre}`)" class="space-y-3 pt-1 animate-in fade-in duration-200">
                <p class="text-[11px] font-black uppercase tracking-widest text-slate-400">Evidencias DBA Vinculadas ({{ actGroup.evidencias.length }})</p>
                <div 
                  v-for="ev in actGroup.evidencias" 
                  :key="ev.id_evidencia_dba"
                  class="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700/60 flex flex-col md:flex-row md:items-start justify-between gap-3 shadow-sm"
                >
                  <div class="space-y-1.5 max-w-3xl">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex rounded-lg bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-400 border border-amber-200/40">
                        DBA #{{ ev.numero_dba }}
                      </span>
                      <p class="text-xs font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1" :title="ev.dba_enunciado">
                        {{ ev.dba_enunciado }}
                      </p>
                    </div>
                    <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {{ ev.evidencia_descripcion }}
                    </p>

                    <!-- Extra Justification Box -->
                    <div v-if="ev.estado_coherencia === 'EXTRA'" class="mt-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200/50 text-xs dark:bg-amber-950/30 dark:border-amber-900/40">
                      <div class="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-extrabold uppercase text-[9px] tracking-wider mb-1">
                        <AlertTriangle :size="12" />
                        <span>Justificación Docente:</span>
                      </div>
                      <p class="font-bold text-slate-700 dark:text-slate-300">
                        <span class="text-slate-500">Motivo:</span> {{ formatMotivoExtra(ev.motivo_extra) }}
                      </p>
                      <p v-if="ev.justificacion_extra" class="mt-1 text-slate-600 dark:text-slate-400 italic">
                        "{{ ev.justificacion_extra }}"
                      </p>
                    </div>
                  </div>

                  <div class="shrink-0">
                    <span
                      :class="ev.estado_coherencia === 'PLANEADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30'"
                      class="inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border shadow-sm"
                    >
                      {{ ev.estado_coherencia }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- MODE 2: GROUPED BY DBA (EXPANDABLE / COLLAPSIBLE ACCORDION) -->
          <div v-else-if="coherenciaViewMode === 'groupedDba'" class="grid grid-cols-1 gap-6">
            <div 
              v-for="dbaGroup in groupedCoherenciaByDba" 
              :key="dbaGroup.id_dba"
              class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 p-6 space-y-4 shadow-sm"
            >
              <!-- Clickable Accordion Header -->
              <div 
                @click="toggleDbaCard(dbaGroup.id_dba)"
                class="flex items-start justify-between gap-4 cursor-pointer select-none group"
                :class="!isDbaCardCollapsed(dbaGroup.id_dba) ? 'border-b border-slate-100 dark:border-slate-700/60 pb-3' : ''"
              >
                <div>
                  <span class="inline-flex rounded-lg bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-black text-amber-700 dark:text-amber-400 border border-amber-200/40 mb-1">
                    DBA #{{ dbaGroup.numero_dba }}
                  </span>
                  <h4 class="text-sm font-black text-slate-900 dark:text-white leading-relaxed group-hover:text-amber-600 transition-colors">{{ dbaGroup.dba_enunciado }}</h4>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="px-3 py-1 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    {{ dbaGroup.actividades.length }} evaluadas
                  </span>
                  <div class="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 group-hover:border-amber-400 group-hover:text-amber-600 transition-colors">
                    <ChevronUp v-if="!isDbaCardCollapsed(dbaGroup.id_dba)" class="w-4 h-4" />
                    <ChevronDown v-else class="w-4 h-4" />
                  </div>
                </div>
              </div>

              <!-- Collapsible Body -->
              <div v-if="!isDbaCardCollapsed(dbaGroup.id_dba)" class="space-y-3 pt-1 animate-in fade-in duration-200">
                <div 
                  v-for="(act, idx) in dbaGroup.actividades" 
                  :key="idx"
                  class="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs"
                >
                  <div class="space-y-1">
                    <p class="font-black text-slate-900 dark:text-white text-sm">{{ act.actividad_nombre }} ({{ act.actividad_porcentaje }}%)</p>
                    <p class="text-slate-500 font-semibold">
                      <span class="font-extrabold text-slate-800 dark:text-slate-200">{{ act.docente_nombre }}</span> · {{ act.grupo_nombre }} · <span class="text-amber-600 dark:text-amber-400 font-bold uppercase">{{ act.materia_nombre }}</span>
                    </p>
                    <p class="text-slate-700 dark:text-slate-300 font-semibold mt-1">Evidencia: {{ act.evidencia_descripcion }}</p>
                    
                    <div v-if="act.estado_coherencia === 'EXTRA'" class="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200/40 dark:bg-amber-950/30">
                      <p class="font-bold text-amber-800 dark:text-amber-300"><span class="text-slate-500">Motivo:</span> {{ formatMotivoExtra(act.motivo_extra) }}</p>
                      <p v-if="act.justificacion_extra" class="italic text-slate-600 dark:text-slate-400">"{{ act.justificacion_extra }}"</p>
                    </div>
                  </div>

                  <span 
                    :class="act.estado_coherencia === 'PLANEADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400'"
                    class="inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border shrink-0"
                  >
                    {{ act.estado_coherencia }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- MODE 3: GROUPED BY TEACHER (EXECUTIVE DIRECTORIAL MATRIX) -->
          <div v-else-if="coherenciaViewMode === 'groupedTeacher'" class="grid grid-cols-1 gap-4">
            <div 
              v-for="tGroup in groupedCoherenciaByTeacher" 
              :key="tGroup.docente_nombre"
              class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 space-y-4 hover:border-slate-200 transition-all shadow-sm"
            >
              <!-- Teacher Card Header -->
              <div 
                @click="toggleTeacherCard(tGroup.docente_nombre)"
                class="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none group"
                :class="!isTeacherCardCollapsed(tGroup.docente_nombre) ? 'pb-4 border-b border-slate-100 dark:border-slate-800' : ''"
              >
                <div class="flex items-start gap-3.5">
                  <div class="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black text-sm flex items-center justify-center shrink-0 border border-amber-200/50 shadow-xs">
                    {{ getTeacherInitials(tGroup.docente_nombre) }}
                  </div>
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h4 class="text-base font-black text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                        {{ tGroup.docente_nombre }}
                      </h4>
                      <!-- Badge Estado General -->
                      <span 
                        v-if="tGroup.estado_general === 'COMPLETO'"
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 shadow-xs"
                      >
                        <Check class="w-3 h-3 text-emerald-600" /> Al Día (100% Calificado)
                      </span>
                      <span 
                        v-else-if="tGroup.estado_general === 'PARCIAL'"
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 flex items-center gap-1 shadow-xs border border-amber-300/40"
                      >
                        <AlertTriangle class="w-3 h-3 text-amber-600" /> Calificación Parcial (Faltan {{ tGroup.total_estudiantes_pendientes }} notas)
                      </span>
                      <span 
                        v-else
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1 shadow-xs border border-rose-300/40"
                      >
                        <AlertTriangle class="w-3 h-3 text-rose-600" /> Sin Calificar ({{ tGroup.total_estudiantes_pendientes }} pendientes)
                      </span>
                    </div>

                    <!-- Materias y Cursos asignados -->
                    <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      <span class="text-amber-700 dark:text-amber-400 font-black uppercase">
                        {{ tGroup.materias.join(', ') || 'Sin materia registrada' }}
                      </span>
                      <span>·</span>
                      <span>{{ tGroup.grupos.length }} {{ tGroup.grupos.length === 1 ? 'grupo asignado' : 'grupos asignados' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Right side: Quick stats & chevron -->
                <div class="flex items-center gap-4 shrink-0">
                  <!-- Progress mini bar -->
                  <div class="hidden sm:flex flex-col items-end gap-1 min-w-[140px]">
                    <div class="flex items-center gap-2 text-xs font-black">
                      <span class="text-slate-700 dark:text-slate-200">{{ tGroup.total_estudiantes_calificados }} / {{ tGroup.total_estudiantes_evaluables }}</span>
                      <span class="text-amber-600 dark:text-amber-400">({{ tGroup.tasa_calificacion }}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        class="h-1.5 rounded-full transition-all duration-500" 
                        :class="tGroup.tasa_calificacion === 100 ? 'bg-emerald-500' : tGroup.tasa_calificacion > 0 ? 'bg-amber-500' : 'bg-rose-500'" 
                        :style="{ width: `${tGroup.tasa_calificacion}%` }"
                      ></div>
                    </div>
                  </div>

                  <div class="text-right">
                    <p class="text-xs font-black text-slate-800 dark:text-slate-200">{{ tGroup.total_actividades }}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actividades</p>
                  </div>

                  <div class="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 group-hover:border-amber-400 group-hover:text-amber-600 transition-colors">
                    <ChevronUp v-if="!isTeacherCardCollapsed(tGroup.docente_nombre)" class="w-4 h-4" />
                    <ChevronDown v-else class="w-4 h-4" />
                  </div>
                </div>
              </div>

              <!-- Collapsible Activities List for Teacher -->
              <div v-if="!isTeacherCardCollapsed(tGroup.docente_nombre)" class="space-y-3 pt-1 animate-in fade-in duration-200">
                <div class="flex items-center justify-between">
                  <p class="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Actividades Evaluativas Asignadas ({{ tGroup.actividades.length }})
                  </p>
                  <button 
                    @click.stop="filterByTeacherAndSwitch(tGroup.docente_nombre)"
                    type="button"
                    class="text-[11px] font-black text-amber-600 hover:text-amber-700 underline cursor-pointer"
                  >
                    Ver actividades en detalle &rarr;
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div 
                    v-for="act in tGroup.actividades" 
                    :key="act.id_actividadmateria + '_' + act.grupo_nombre"
                    class="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div class="flex items-center justify-between gap-2 mb-1">
                        <span class="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">{{ act.actividad_nombre }}</span>
                        <span 
                          v-if="act.estado_calificacion === 'COMPLETO'"
                          class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0"
                        >
                          100%
                        </span>
                        <span 
                          v-else-if="act.estado_calificacion === 'PARCIAL'"
                          class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shrink-0"
                        >
                          Faltan {{ act.estudiantes_pendientes }}
                        </span>
                        <span 
                          v-else
                          class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 shrink-0"
                        >
                          Sin nota
                        </span>
                      </div>
                      
                      <p class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{{ act.grupo_nombre }}</p>
                      <p class="text-[10px] font-semibold text-slate-400 mt-0.5">{{ act.materia_nombre }} · {{ act.periodo_nombre }}</p>
                      
                      <div v-if="act.competencia_nombre || act.competencia_descripcion" class="mt-2 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 bg-white/60 dark:bg-slate-900/40 p-1.5 rounded-lg">
                        <span class="font-bold text-slate-700 dark:text-slate-300">{{ act.competencia_nombre || 'Competencia' }}:</span> {{ act.competencia_descripcion }}
                      </div>
                    </div>

                    <div class="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px] font-bold text-slate-500">
                      <span>Calificados:</span>
                      <span class="font-black text-slate-700 dark:text-slate-200">{{ act.estudiantes_calificados }} de {{ act.total_estudiantes }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- MODE 4: DETAILED FLAT TABLE -->
          <DataTable v-else>
            <template #header>
              <tr>
                <th class="py-4 px-6">Docente</th>
                <th class="py-4 px-6">Curso & Materia</th>
                <th class="py-4 px-6">Actividad</th>
                <th class="py-4 px-6">Enunciado DBA</th>
                <th class="py-4 px-6">Evidencia del Catálogo</th>
                <th class="py-4 px-6 text-center">Coherencia</th>
              </tr>
            </template>
            <tr v-for="row in filteredCoherencia" :key="row.id_actividadmateria + '-' + row.id_evidencia_dba" class="hover:bg-slate-50/50 transition dark:hover:bg-slate-800/30">
              <td class="py-4 px-6">
                <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ row.docente_nombre }}</p>
                <p class="text-[10px] font-semibold text-slate-400">Docente Asignado</p>
              </td>
              <td class="py-4 px-6">
                <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ row.grupo_nombre }}</p>
                <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">{{ row.materia_nombre }}</p>
              </td>
              <td class="py-4 px-6">
                <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ row.actividad_nombre }}</p>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso: {{ row.actividad_porcentaje }}%</p>
              </td>
              <td class="py-4 px-6 max-w-xs">
                <span class="inline-flex rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 shrink-0 mb-1.5">DBA #{{ row.numero_dba }}</span>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed" :title="row.dba_enunciado">{{ row.dba_enunciado }}</p>
              </td>
              <td class="py-4 px-6 max-w-sm">
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{{ row.evidencia_descripcion }}</p>
                
                <div v-if="row.estado_coherencia === 'EXTRA'" class="mt-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-250/30 text-xs dark:bg-amber-950/20 dark:border-amber-900/30">
                  <div class="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-extrabold uppercase text-[9px] tracking-wider mb-1">
                    <AlertTriangle :size="12" />
                    <span>Justificación Docente:</span>
                  </div>
                  <p class="font-bold text-slate-700 dark:text-slate-350">
                    <span class="text-slate-500">Motivo:</span> {{ formatMotivoExtra(row.motivo_extra) }}
                  </p>
                  <p v-if="row.justificacion_extra" class="mt-1 text-slate-600 dark:text-slate-400 italic">
                    "{{ row.justificacion_extra }}"
                  </p>
                </div>
              </td>
              <td class="py-4 px-6 text-center">
                <span
                  :class="row.estado_coherencia === 'PLANEADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30'"
                  class="inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border shadow-sm"
                >
                  {{ row.estado_coherencia }}
                </span>
              </td>
            </tr>
          </DataTable>
        </div>
      </div>

      <!-- SECTION 2: COBERTURA DEL CATALOGO -->
      <div v-if="activeTab === 'cobertura'" class="space-y-8 animate-in fade-in duration-300">
        <!-- KPI Cards Grid -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <p class="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Evidencias Catálogo</p>
            <p class="mt-2 text-3xl font-black text-slate-900 dark:text-white">{{ coberturaStats.total }}</p>
            <p class="mt-2 text-xs font-semibold text-slate-400">Asignadas por curricular activo</p>
          </div>
          
          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <p class="text-[10px] uppercase font-black tracking-widest text-emerald-500 dark:text-emerald-400">Evidencias Cubiertas</p>
            <p class="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">{{ coberturaStats.covered }}</p>
            <p class="mt-2 text-xs font-semibold text-slate-400">Evaluadas al menos una vez</p>
          </div>

          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <p class="text-[10px] uppercase font-black tracking-widest text-rose-500 dark:text-rose-400">Evidencias Pendientes</p>
            <p class="mt-2 text-3xl font-black text-rose-600 dark:text-rose-400">{{ coberturaStats.pending }}</p>
            <p class="mt-2 text-xs font-semibold text-slate-400">Sin actividades registradas</p>
          </div>

          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <p class="text-[10px] uppercase font-black tracking-widest text-slate-400">Cobertura del Catálogo</p>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-3xl font-black text-slate-900 dark:text-white">{{ coberturaStats.pct }}%</span>
                <span :class="getCoherencePctClass(coberturaStats.pct)" class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase">
                  {{ coberturaStats.pct >= 75 ? 'Excelente' : coberturaStats.pct >= 50 ? 'Regular' : 'Crítica' }}
                </span>
              </div>
            </div>
            <div class="mt-4 w-full bg-slate-100 rounded-full h-2.5 dark:bg-slate-800 overflow-hidden">
              <div :class="getCoherenceProgressBarClass(coberturaStats.pct)" class="h-2.5 rounded-full transition-all duration-500" :style="{ width: `${coberturaStats.pct}%` }"></div>
            </div>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div class="flex items-center gap-3 border-b border-slate-100 pb-5 mb-5 dark:border-slate-800">
            <SlidersHorizontal class="h-5 w-5 text-amber-500" />
            <h3 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Filtros del Catálogo</h3>
          </div>
          
          <div class="grid grid-cols-1 gap-5 md:grid-cols-4">
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Periodo Lectivo</span>
              <select v-model="filterPeriod" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los periodos</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="String(p.id_periodo)">{{ p.nombre }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Grado Académico</span>
              <select v-model="filterCoberturaGroup" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los grados</option>
                <option v-for="gName in grades" :key="gName" :value="gName">
                  Grado {{ gName }}
                </option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Área / Asignatura</span>
              <select v-model="filterCoberturaSubject" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todas las áreas</option>
                <option v-for="s in subjects" :key="s.id_materia" :value="String(s.id_materia)">{{ s.nombre }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Estado de Evidencia</span>
              <select v-model="filterEvidenceStatus" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los estados</option>
                <option value="PLANEADAS">Planeadas</option>
                <option value="EXTRAS">Extras</option>
                <option value="SIN_PLANEAR">Sin Planear</option>
              </select>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <!-- Resumen por Grado/Materia -->
          <div class="xl:col-span-1 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-5">
            <div class="space-y-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div class="flex items-center justify-between">
                <h4 class="text-lg font-black text-slate-900 dark:text-white">Resumen por Grado & Área</h4>
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic">Clic para filtrar</span>
              </div>

              <!-- Mini Buscador Rápido de Tarjetas -->
              <div class="relative">
                <Search class="absolute left-3.5 top-3 h-3.5 w-3.5 text-slate-400" />
                <input 
                  v-model="searchResumenTerm"
                  type="text" 
                  placeholder="Buscar área o grado..." 
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-amber-300 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
            </div>

            <div v-if="filteredCoberturaResumen.length === 0" class="py-8 text-center text-xs font-bold text-slate-400">
              No se encontraron áreas.
            </div>

            <div v-else class="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              <div 
                v-for="res in filteredCoberturaResumen" 
                :key="res.area + '-' + res.grado"
                @click="toggleSelectResumenCard(res)"
                :class="selectedResumenCard && selectedResumenCard.area === res.area && selectedResumenCard.grado === res.grado ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-500/20' : 'border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700'"
                class="rounded-2xl border p-4 transition cursor-pointer"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <h5 class="text-sm font-extrabold text-slate-800 dark:text-slate-200">{{ res.area }}</h5>
                    <p class="text-xs font-semibold text-slate-400 dark:text-slate-500">Grado {{ res.grado }} ({{ res.version_curricular }})</p>
                  </div>
                  <span 
                    :class="res.evidencias_evaluadas >= res.total_evidencias ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'"
                    class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase"
                  >
                    {{ Math.round((res.evidencias_evaluadas / Math.max(res.total_evidencias, 1)) * 100) }}%
                  </span>
                </div>
                <div class="mt-3 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>Evaluadas: {{ res.evidencias_evaluadas }} / {{ res.total_evidencias }}</span>
                  <span class="text-[10px] text-amber-600 font-extrabold" v-if="selectedResumenCard && selectedResumenCard.area === res.area && selectedResumenCard.grado === res.grado">Filtro activo ✕</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Detalles Evidencia por Evidencia (Acordeón Desplegable) -->
          <div class="xl:col-span-2 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-5">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h4 class="text-lg font-black text-slate-900 dark:text-white">Estado Cobertura por Evidencia</h4>
                <p class="text-xs font-semibold text-slate-400">
                  <span v-if="selectedResumenCard" class="text-amber-600 font-black">Filtrado por {{ selectedResumenCard.area }} - {{ selectedResumenCard.grado }} · </span>
                  {{ filteredCoberturaDetalles.length }} evidencias encontradas
                </p>
              </div>

              <!-- Controls: Expand/Collapse All + Quitar Filtro -->
              <div class="flex items-center gap-2">
                <button 
                  @click="expandAllCoberturaCards"
                  type="button"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  title="Expandir todas las evidencias"
                >
                  <ChevronsDown class="w-3.5 h-3.5" />
                  <span>Expandir todo</span>
                </button>
                <button 
                  @click="collapseAllCoberturaCards"
                  type="button"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  title="Colapsar todas las evidencias"
                >
                  <ChevronsUp class="w-3.5 h-3.5" />
                  <span>Colapsar todo</span>
                </button>
                <button 
                  v-if="selectedResumenCard" 
                  @click="selectedResumenCard = null"
                  type="button" 
                  class="text-xs font-bold text-rose-500 hover:underline cursor-pointer ml-1"
                >
                  Quitar filtro de tarjeta
                </button>
              </div>
            </div>

            <div v-if="filteredCoberturaDetalles.length === 0" class="py-16 text-center">
              <AlertTriangle class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p class="text-sm font-bold text-slate-600 dark:text-slate-400">No hay evidencias registradas para esta selección.</p>
            </div>

            <div v-else class="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              <div 
                v-for="det in filteredCoberturaDetalles" 
                :key="`${det.id_evidencia_dba}_${det.grado}_${det.area}`"
                class="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-4 transition hover:border-slate-200 dark:hover:border-slate-700 space-y-3 shadow-sm"
              >
                <!-- Clickable Accordion Header -->
                <div 
                  @click="toggleCoberturaCard(`${det.id_evidencia_dba}_${det.grado}_${det.area}`)"
                  class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between cursor-pointer select-none group"
                  :class="!isCoberturaCardCollapsed(`${det.id_evidencia_dba}_${det.grado}_${det.area}`) ? 'pb-3 border-b border-slate-100 dark:border-slate-700/60' : ''"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-lg bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/40">DBA #{{ det.numero_dba }}</span>
                    <span class="text-xs font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 transition-colors">{{ det.area }} — Grado {{ det.grado }}</span>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <span 
                      v-if="det.es_planeada" 
                      class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100/40"
                    >
                      PLANEADA
                    </span>
                    <span 
                      :class="det.evaluaciones && det.evaluaciones.length > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'"
                      class="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                    >
                      {{ det.evaluaciones && det.evaluaciones.length > 0 ? 'EVALUADA' : 'PENDIENTE' }}
                    </span>

                    <div class="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 group-hover:border-amber-400 group-hover:text-amber-600 transition-colors">
                      <ChevronUp v-if="!isCoberturaCardCollapsed(`${det.id_evidencia_dba}_${det.grado}_${det.area}`)" class="w-4 h-4" />
                      <ChevronDown v-else class="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <!-- Collapsible Body: Descripcion + Evaluaciones asociadas -->
                <div 
                  v-if="!isCoberturaCardCollapsed(`${det.id_evidencia_dba}_${det.grado}_${det.area}`)" 
                  class="pt-1 space-y-3 animate-in fade-in duration-200"
                >
                  <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{{ det.evidencia_descripcion }}</p>

                  <div v-if="det.evaluaciones && det.evaluaciones.length > 0" class="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-1.5">
                    <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Evaluada en las siguientes actividades ({{ det.evaluaciones.length }}):</p>
                    <div 
                      v-for="(ev, idx) in det.evaluaciones" 
                      :key="idx" 
                      class="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300"
                    >
                      <span class="font-bold">{{ ev.actividad_nombre }} ({{ ev.actividad_porcentaje }}%)</span>
                      <div class="flex items-center gap-2">
                        <span>{{ ev.docente_nombre }} — {{ ev.grupo_nombre }} <span v-if="ev.periodo_nombre" class="text-slate-400 font-normal">({{ ev.periodo_nombre }})</span></span>
                        <span 
                          v-if="ev.total_estudiantes" 
                          :class="ev.estado_calificacion === 'COMPLETO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : ev.estado_calificacion === 'PARCIAL' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'"
                          class="px-2 py-0.5 rounded-md text-[10px] font-black"
                        >
                          {{ ev.estudiantes_calificados || 0 }}/{{ ev.total_estudiantes }} notas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal Catálogo Global Directivo -->
    <DbaCatalogModal
      :show="showCatalogModal"
      :catalog-loading="catalogLoading"
      :catalog-stats="catalogStats"
      v-model:catalog-search-term="catalogSearchTerm"
      v-model:catalog-grade-filter="catalogGradeFilter"
      v-model:catalog-subject-filter="catalogSubjectFilter"
      v-model:catalog-status-filter="catalogStatusFilter"
      :grades="grades"
      :subjects="subjects"
      :filtered-catalog="filteredCatalog"
      :is-catalog-dba-card-collapsed="isCatalogDbaCardCollapsed"
      :get-grouped-planeaciones="getGroupedPlaneaciones"
      @close="showCatalogModal = false"
      @toggle-catalog-dba-card="toggleCatalogDbaCard"
    />


  </div>
</template>
