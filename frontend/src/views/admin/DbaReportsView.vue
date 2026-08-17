<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
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
  ChevronsUp
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import DataTable from '../../components/ui/DataTable.vue'

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
    const params: any = {}
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const res = await axios.get(`/api/academic-admin/settings/dba-catalogo/${schoolId.value}`, { params })
    catalogData.value = res.data || []
  } catch (error) {
    console.error('Error loading DBA catalog for directivo:', error)
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
const coherenciaViewMode = ref<'groupedActivity' | 'groupedDba' | 'table'>('groupedActivity')
const filterPeriod = ref<string>('TODOS')
const filterGroup = ref<string>('TODOS')
const filterCoherenciaGrade = ref<string>('TODOS')
const filterSubject = ref<string>('TODOS')
const filterTeacher = ref<string>('TODOS')
const filterCoherenciaStatus = ref<string>('TODOS')
const presetCoherenciaExtrasOnly = ref<boolean>(false)
const presetCoherenciaPlaneadasOnly = ref<boolean>(false)
const searchTerm = ref<string>('')

// Collapsible Accordion State for Activity Cards
const collapsedActivityCards = ref<Set<string>>(new Set())

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
      axios.get(`/api/academic-admin/settings/${schoolId.value}`, { params }),
      axios.get(`/api/academic-admin/teachers/${schoolId.value}`, { params })
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

    const res = await axios.get(`/api/academic-admin/settings/dba-reportes/coherencia/${schoolId.value}`, { params })
    coherenciaData.value = res.data || []
  } catch (error) {
    console.error('Error loading coherencia report:', error)
  } finally {
    fetchingReports.value = false
  }
}

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

    const res = await axios.get(`/api/academic-admin/settings/dba-reportes/cobertura/${schoolId.value}`, { params })
    coberturaResumen.value = res.data.resumen || []
    coberturaDetalles.value = res.data.detalles || []
    selectedResumenCard.value = null
    searchResumenTerm.value = ''
  } catch (error) {
    console.error('Error loading cobertura report:', error)
  } finally {
    fetchingReports.value = false
  }
}

const loadData = async () => {
  loading.value = true
  await loadFilterOptions()
  await Promise.all([
    fetchCoherenciaReport(),
    fetchCoberturaReport()
  ])
  loading.value = false
}

// Refresh data triggered by filters & academic year store
watch([filterPeriod, filterGroup, filterCoherenciaGrade, filterSubject, filterTeacher], fetchCoherenciaReport)
watch([filterPeriod, filterCoberturaGroup, filterCoberturaSubject], fetchCoberturaReport)
watch(() => yearStore.selectedYearId, async () => {
  catalogData.value = []
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
  searchTerm.value = ''
}

const toggleCoherenciaExtrasPreset = () => {
  if (presetCoherenciaExtrasOnly.value) {
    presetCoherenciaExtrasOnly.value = false
  } else {
    presetCoherenciaExtrasOnly.value = true
    presetCoherenciaPlaneadasOnly.value = false
  }
}

const toggleCoherenciaPlaneadasPreset = () => {
  if (presetCoherenciaPlaneadasOnly.value) {
    presetCoherenciaPlaneadasOnly.value = false
  } else {
    presetCoherenciaPlaneadasOnly.value = true
    presetCoherenciaExtrasOnly.value = false
  }
}

const selectCoherenciaStatusFromCard = (status: 'TODOS' | 'PLANEADAS' | 'EXTRAS') => {
  filterCoherenciaStatus.value = status
  presetCoherenciaExtrasOnly.value = false
  presetCoherenciaPlaneadasOnly.value = false
}

// Search & Preset filtering for coherencia
const filteredCoherencia = computed(() => {
  let list = coherenciaData.value

  if (presetCoherenciaExtrasOnly.value) {
    list = list.filter(r => r.estado_coherencia === 'EXTRA')
  }

  if (presetCoherenciaPlaneadasOnly.value) {
    list = list.filter(r => r.estado_coherencia === 'PLANEADA')
  }

  const query = searchTerm.value.trim().toLowerCase()
  if (query) {
    list = list.filter(row => {
      const act = (row.actividad_nombre || '').toLowerCase()
      const doc = (row.docente_nombre || '').toLowerCase()
      const desc = (row.evidencia_descripcion || '').toLowerCase()
      const dba = (row.dba_enunciado || '').toLowerCase()
      const comp = (row.competencia_descripcion || '').toLowerCase()
      const subj = (row.materia_nombre || '').toLowerCase()
      const group = (row.grupo_nombre || '').toLowerCase()
      
      return act.includes(query) || 
             doc.includes(query) || 
             desc.includes(query) || 
             dba.includes(query) || 
             comp.includes(query) ||
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
    materia_nombre: string
    periodo_nombre: string
    tiene_extras: boolean
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
        materia_nombre: row.materia_nombre,
        periodo_nombre: row.periodo_nombre,
        tiene_extras: false,
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
  <div class="space-y-8 pb-12 animate-in fade-in duration-500">
    
    <!-- Top Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="flex items-center gap-4">
        <router-link to="/dashboard/configuracion-academica" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800">
          <ArrowLeft class="h-5 w-5" />
        </router-link>
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-3xl font-black text-slate-900 dark:text-white">Coherencia y Cobertura DBA</h1>
            <button
              @click="openCatalogModal"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 hover:bg-amber-100 transition border border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40 cursor-pointer"
            >
              <BookOpen class="h-3.5 w-3.5" />
              <span>Ver Catálogo Global</span>
            </button>
          </div>
          <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Analiza la correspondencia entre la planeación curricular y la evaluación docente en aula.</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex rounded-3xl bg-slate-900/90 p-1.5 backdrop-blur-md shadow-xl dark:bg-slate-800/90 border border-slate-800">
        <button
          type="button"
          @click="activeTab = 'coherencia'"
          :class="activeTab === 'coherencia' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 border-amber-500' : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white border-transparent'"
          class="inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-black transition-all border uppercase tracking-wider cursor-pointer"
        >
          <PieChart class="h-4 w-4" />
          Coherencia Curricular
        </button>
        <button
          type="button"
          @click="activeTab = 'cobertura'"
          :class="activeTab === 'cobertura' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 border-amber-500' : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white border-transparent'"
          class="inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-black transition-all border uppercase tracking-wider cursor-pointer"
        >
          <BarChart3 class="h-4 w-4" />
          Cobertura del Catálogo
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="rounded-[32px] border border-slate-100 bg-white p-20 text-center dark:bg-slate-900 dark:border-slate-800">
      <RefreshCw class="mx-auto h-10 w-10 animate-spin text-amber-500 mb-4" />
      <p class="text-base font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Cargando reportes analíticos...</p>
      <p class="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-1">Esto puede demorar unos segundos.</p>
    </div>

    <template v-else>
      <!-- SECTION 1: COHERENCIA CURRICULAR -->
      <div v-if="activeTab === 'coherencia'" class="space-y-8 animate-in fade-in duration-300">
        
        <!-- Interactive KPI Cards Grid -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total Card -->
          <button 
            @click="selectCoherenciaStatusFromCard('TODOS')"
            class="rounded-3xl border p-6 text-left shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            :class="[
              filterCoherenciaStatus === 'TODOS' && !presetCoherenciaExtrasOnly && !presetCoherenciaPlaneadasOnly
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 ring-2 ring-slate-900/20'
                : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 text-slate-900 dark:text-white'
            ]"
          >
            <p class="text-[10px] uppercase font-black tracking-widest opacity-60">Evidencias Evaluadas</p>
            <p class="mt-2 text-3xl font-black">{{ coherenciaStats.total }}</p>
            <p class="mt-2 text-xs font-semibold opacity-70">Total en el rango de búsqueda</p>
          </button>
          
          <!-- Planeadas Card -->
          <button 
            @click="selectCoherenciaStatusFromCard('PLANEADAS')"
            class="rounded-3xl border p-6 text-left shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            :class="[
              filterCoherenciaStatus === 'PLANEADAS' || presetCoherenciaPlaneadasOnly
                ? 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-500/20'
                : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 text-emerald-900 dark:text-emerald-200'
            ]"
          >
            <p class="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-400" :class="filterCoherenciaStatus === 'PLANEADAS' || presetCoherenciaPlaneadasOnly ? 'text-white' : ''">Evidencias Planeadas</p>
            <p class="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400" :class="filterCoherenciaStatus === 'PLANEADAS' || presetCoherenciaPlaneadasOnly ? 'text-white' : ''">{{ coherenciaStats.planeadas }}</p>
            <p class="mt-2 text-xs font-semibold opacity-70">Evaluadas dentro de planeación</p>
          </button>

          <!-- Extras Card -->
          <button 
            @click="selectCoherenciaStatusFromCard('EXTRAS')"
            class="rounded-3xl border p-6 text-left shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            :class="[
              filterCoherenciaStatus === 'EXTRAS' || presetCoherenciaExtrasOnly
                ? 'border-amber-600 bg-amber-600 text-white ring-2 ring-amber-500/20'
                : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 text-amber-900 dark:text-amber-200'
            ]"
          >
            <p class="text-[10px] uppercase font-black tracking-widest text-amber-600 dark:text-amber-400" :class="filterCoherenciaStatus === 'EXTRAS' || presetCoherenciaExtrasOnly ? 'text-white' : ''">Evidencias Extras (Desvíos)</p>
            <p class="mt-2 text-3xl font-black text-amber-600 dark:text-amber-400" :class="filterCoherenciaStatus === 'EXTRAS' || presetCoherenciaExtrasOnly ? 'text-white' : ''">{{ coherenciaStats.extras }}</p>
            <p class="mt-2 text-xs font-semibold opacity-70">Evaluadas fuera de planeación</p>
          </button>

          <!-- Metric Card -->
          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <p class="text-[10px] uppercase font-black tracking-widest text-slate-400">Coherencia Curricular</p>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-3xl font-black text-slate-900 dark:text-white">{{ coherenciaStats.pct }}%</span>
                <span :class="getCoherencePctClass(coherenciaStats.pct)" class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase">
                  {{ coherenciaStats.pct >= 85 ? 'Alta' : coherenciaStats.pct >= 60 ? 'Media' : 'Baja' }}
                </span>
              </div>
            </div>
            <div class="mt-4 w-full bg-slate-100 rounded-full h-2.5 dark:bg-slate-800 overflow-hidden">
              <div :class="getCoherenceProgressBarClass(coherenciaStats.pct)" class="h-2.5 rounded-full transition-all duration-500" :style="{ width: `${coherenciaStats.pct}%` }"></div>
            </div>
          </div>
        </div>

        <!-- MULTI-DIMENSIONAL INTERACTIVE FILTER PANEL -->
        <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-5">
          
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
                  <span>Por Actividad (Limpio)</span>
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
            <p class="text-sm font-semibold text-slate-400 dark:text-slate-500 max-w-md mx-auto mt-1">Ajusta los filtros de búsqueda o asegúrate de que los docentes hayan calificado actividades asociadas a evidencias DBA.</p>
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
                <div class="space-y-1">
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
                  </div>
                  <div class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span class="text-slate-800 dark:text-slate-200 font-extrabold">{{ actGroup.docente_nombre }}</span>
                    <span>·</span>
                    <span class="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-100/30">{{ actGroup.grupo_nombre }}</span>
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

          <!-- MODE 3: DETAILED FLAT TABLE -->
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
                      class="flex flex-wrap items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/40 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300"
                    >
                      <span class="font-bold">{{ ev.actividad_nombre }} ({{ ev.actividad_porcentaje }}%)</span>
                      <span>{{ ev.docente_nombre }} — {{ ev.grupo_nombre }} <span v-if="ev.periodo_nombre" class="text-slate-400 font-normal">({{ ev.periodo_nombre }})</span></span>
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
    <div v-if="showCatalogModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div class="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <!-- Header Modal -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-6">
          <div class="flex items-center gap-3">
            <div class="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-600 dark:text-amber-400">
              <BookOpen class="h-6 w-6" />
            </div>
            <div>
              <h3 class="text-xl font-black text-slate-900 dark:text-white">Catálogo Global de Derechos Básicos de Aprendizaje</h3>
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Consulta las evidencias oficializadas y su estado de planeación en las competencias del colegio.</p>
            </div>
          </div>
          <button @click="showCatalogModal = false" class="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition cursor-pointer">
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Filter Controls Modal -->
        <div class="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4">
          <!-- Stats Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Evidencias Totales</p>
              <p class="text-xl font-black text-slate-900 dark:text-white mt-0.5">{{ catalogStats.totalEvidences }}</p>
            </div>
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-emerald-500">Evidencias Planificadas</p>
              <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{{ catalogStats.plannedEvidences }}</p>
            </div>
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-amber-500">Evidencias Libres</p>
              <p class="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{{ catalogStats.freeEvidences }}</p>
            </div>
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-indigo-500">% Integración Escolar</p>
              <p class="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{{ catalogStats.pct }}%</p>
            </div>
          </div>

          <!-- Selects & Search -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div class="sm:col-span-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 dark:bg-slate-800 dark:border-slate-700">
              <Search class="h-4 w-4 text-slate-400 shrink-0" />
              <input v-model="catalogSearchTerm" type="text" placeholder="Buscar evidencia, DBA o competencia..." class="w-full bg-transparent text-xs font-semibold text-slate-700 outline-none dark:text-white" />
            </div>

            <select v-model="catalogGradeFilter" class="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
              <option value="TODOS">Todos los grados</option>
              <option v-for="gName in grades" :key="gName" :value="gName">Grado {{ gName }}</option>
            </select>

            <select v-model="catalogSubjectFilter" class="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
              <option value="TODOS">Todas las áreas</option>
              <option v-for="s in subjects" :key="s.id_materia" :value="String(s.id_materia)">{{ s.nombre }}</option>
            </select>

            <select v-model="catalogStatusFilter" class="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
              <option value="TODOS">Todos los estados</option>
              <option value="PLANEADAS">Planeadas</option>
              <option value="LIBRES">Libres</option>
            </select>
          </div>
        </div>

        <!-- Content Body Modal -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div v-if="catalogLoading" class="py-16 text-center text-slate-400 font-bold">
            <RefreshCw class="mx-auto h-8 w-8 animate-spin text-amber-500 mb-2" />
            Cargando catálogo oficial...
          </div>

          <div v-else-if="filteredCatalog.length === 0" class="py-16 text-center text-slate-400 font-bold">
            <AlertTriangle class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
            No se encontraron Derechos Básicos de Aprendizaje con los filtros seleccionados.
          </div>

          <div v-else class="space-y-6">
            <div 
              v-for="dba in filteredCatalog" 
              :key="dba.id_dba"
              class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6 space-y-4 shadow-sm"
            >
              <!-- Clickable Accordion Header -->
              <div 
                @click="toggleCatalogDbaCard(dba.id_dba)"
                class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 cursor-pointer select-none group"
                :class="!isCatalogDbaCardCollapsed(dba.id_dba) ? 'border-b border-slate-200/60 dark:border-slate-800 pb-3' : ''"
              >
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="rounded-lg bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/40">
                      DBA #{{ dba.numero_dba }}
                    </span>
                    <span class="text-xs font-extrabold text-slate-700 dark:text-slate-300">{{ dba.area }} — Grado {{ dba.grado }}</span>
                    <span class="text-[10px] font-bold text-slate-400">({{ dba.version_curricular }})</span>
                  </div>
                  <h4 class="text-sm font-black text-slate-900 dark:text-white leading-relaxed group-hover:text-amber-600 transition-colors">{{ dba.dba_enunciado }}</h4>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="px-3 py-1 rounded-full text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {{ dba.evidencias.length }} evidencias
                  </span>
                  <div class="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 group-hover:border-amber-400 group-hover:text-amber-600 transition-colors">
                    <ChevronUp v-if="!isCatalogDbaCardCollapsed(dba.id_dba)" class="w-4 h-4" />
                    <ChevronDown v-else class="w-4 h-4" />
                  </div>
                </div>
              </div>

              <!-- Collapsible Evidencias Body -->
              <div v-if="!isCatalogDbaCardCollapsed(dba.id_dba)" class="space-y-3 pt-1 animate-in fade-in duration-200">
                <div 
                  v-for="ev in dba.evidencias" 
                  :key="ev.id_evidencia_dba"
                  class="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700/60 space-y-2 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                      <span class="text-slate-400 font-extrabold mr-1">#{{ ev.orden }}</span>
                      {{ ev.descripcion }}
                    </p>
                    <span 
                      :class="ev.planeaciones && ev.planeaciones.length > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border-slate-200'"
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0"
                    >
                      {{ ev.planeaciones && ev.planeaciones.length > 0 ? 'PLANEADA' : 'LIBRE' }}
                    </span>
                  </div>

                  <!-- Planeaciones Vinculadas agrupadas -->
                  <div v-if="ev.planeaciones && ev.planeaciones.length > 0" class="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Vinculada en la planeación curricular de:</p>
                    <div 
                      v-for="(grpPlan, pIdx) in getGroupedPlaneaciones(ev.planeaciones)" 
                      :key="pIdx"
                      class="flex flex-wrap items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/60 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 border border-slate-100/80 dark:border-slate-800"
                    >
                      <div>
                        <span class="font-extrabold text-amber-700 dark:text-amber-400 mr-2">{{ grpPlan.materia_nombre }}</span>
                        <span class="font-semibold text-slate-500">({{ grpPlan.periodo_nombre }})</span>
                        <p v-if="grpPlan.competencia_descripcion" class="text-[11px] text-slate-600 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                          "{{ grpPlan.competencia_descripcion }}"
                        </p>
                      </div>
                      <div class="flex flex-wrap gap-1 mt-1 sm:mt-0">
                        <span v-for="gName in grpPlan.grupos" :key="gName" class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] border border-indigo-100/30">
                          {{ gName }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/80 flex justify-end">
          <button @click="showCatalogModal = false" class="rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer">
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
