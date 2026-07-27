<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { 
  ArrowLeft, 
  BarChart3, 
  CheckCircle2, 
  Download, 
  AlertTriangle, 
  SlidersHorizontal, 
  Search, 
  RefreshCw, 
  PieChart,
  X,
  BookOpen
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

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
  }[]
}

const auth = useAuthStore()
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
    const res = await axios.get(`http://localhost:3000/api/academic-admin/settings/dba-catalogo/${schoolId.value}`)
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
    // Filter evidences by status and period
    const filteredEvidences = dba.evidencias.filter(ev => {
      const isPlanned = ev.planeaciones && ev.planeaciones.length > 0

      // Status filter
      if (catalogStatusFilter.value === 'PLANEADAS' && !isPlanned) return false
      if (catalogStatusFilter.value === 'LIBRES' && isPlanned) return false

      // Period filter
      if (catalogPeriodFilter.value !== 'TODOS') {
        if (!isPlanned) return false
        const matchesPeriod = ev.planeaciones.some(p => String(p.id_periodo) === catalogPeriodFilter.value)
        if (!matchesPeriod) return false
      }

      // Search text filter
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
    // Grade filter
    if (catalogGradeFilter.value !== 'TODOS') {
      if ((dba.grado || '').trim().toLowerCase() !== catalogGradeFilter.value.trim().toLowerCase()) {
        return false
      }
    }

    // Subject/Area filter
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

// Helper to group planeaciones by period, subject and competency
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

// Filter selections
const filterPeriod = ref<string>('TODOS')
const filterGroup = ref<string>('TODOS')
const filterSubject = ref<string>('TODOS')
const filterTeacher = ref<string>('TODOS')
const filterCoherenciaStatus = ref<string>('TODOS')
const searchTerm = ref<string>('')

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
    const [settingsRes, teachersRes] = await Promise.all([
      axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`),
      axios.get(`http://localhost:3000/api/academic-admin/teachers/${schoolId.value}`)
    ])
    
    periods.value = settingsRes.data.periods || []
    
    // Unique groups and subjects from settings assignments
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

    // Build unique grades list
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
    if (filterPeriod.value !== 'TODOS') params.id_periodo = filterPeriod.value
    if (filterGroup.value !== 'TODOS') params.grado = filterGroup.value
    if (filterSubject.value !== 'TODOS') params.id_materia = filterSubject.value
    if (filterTeacher.value !== 'TODOS') params.id_docente = filterTeacher.value

    const res = await axios.get(`http://localhost:3000/api/academic-admin/settings/dba-reportes/coherencia/${schoolId.value}`, { params })
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
    if (filterPeriod.value !== 'TODOS') params.id_periodo = filterPeriod.value
    if (filterCoberturaGroup.value !== 'TODOS') params.grado = filterCoberturaGroup.value
    if (filterCoberturaSubject.value !== 'TODOS') params.id_materia = filterCoberturaSubject.value

    const res = await axios.get(`http://localhost:3000/api/academic-admin/settings/dba-reportes/cobertura/${schoolId.value}`, { params })
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

// Refresh data triggered by filters
watch([filterPeriod, filterGroup, filterSubject, filterTeacher], fetchCoherenciaReport)
watch([filterPeriod, filterCoberturaGroup, filterCoberturaSubject], fetchCoberturaReport)

// Search filtering on client side for coherencia
const filteredCoherencia = computed(() => {
  let list = coherenciaData.value

  const query = searchTerm.value.trim().toLowerCase()
  if (query) {
    list = list.filter(row => {
      const act = (row.actividad_nombre || '').toLowerCase()
      const doc = (row.docente_nombre || '').toLowerCase()
      const desc = (row.evidencia_descripcion || '').toLowerCase()
      const dba = (row.dba_enunciado || '').toLowerCase()
      const comp = (row.competencia_descripcion || '').toLowerCase()
      const subj = (row.materia_nombre || '').toLowerCase()
      
      return act.includes(query) || 
             doc.includes(query) || 
             desc.includes(query) || 
             dba.includes(query) || 
             comp.includes(query) ||
             subj.includes(query)
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
    'Evidencia Descripción', 'DBA Enunciado', 'Fecha Creación'
  ]
  
  const rows = filteredCoherencia.value.map(row => [
    `"${row.periodo_nombre}"`,
    `"${row.grupo_nombre}"`,
    `"${row.docente_nombre}"`,
    `"${row.materia_nombre}"`,
    `"${row.actividad_nombre}"`,
    row.actividad_porcentaje,
    `"${row.estado_coherencia}"`,
    `"${row.evidencia_descripcion}"`,
    `"${row.dba_enunciado}"`,
    `"${new Date(row.actividad_fecha).toLocaleDateString()}"`
  ])
  
  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `reporte_coherencia_dba_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header Banner -->
    <div class="overflow-hidden rounded-[32px] border border-amber-100 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_42%),linear-gradient(135deg,#1c1917_0%,#451a03_52%,#78350f_100%)] p-8 text-white shadow-sm md:p-10 dark:border-amber-950/20">
      <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div class="max-w-3xl">
          <router-link
            to="/dashboard/configuracion-academica"
            class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white/90 transition hover:bg-white/15"
          >
            <ArrowLeft class="h-4 w-4" />
            Volver a configuración académica
          </router-link>
          <h1 class="mt-5 text-3xl font-black tracking-tight md:text-4xl">Reportes y Coherencia DBA</h1>
          <p class="mt-3 max-w-2xl text-sm font-semibold text-amber-50/90 md:text-base">
            Monitorea el nivel de cobertura del catálogo nacional oficial de Derechos Básicos de Aprendizaje (DBA) y la coherencia pedagógica entre planeación y ejecución del aula.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="openCatalogModal"
            class="inline-flex items-center gap-2.5 rounded-2xl border border-amber-300/30 bg-amber-500/20 px-5 py-3 text-sm font-black text-amber-200 backdrop-blur-md transition hover:bg-amber-500/30 hover:border-amber-300/50 shadow-lg active:scale-95 shrink-0"
          >
            <BookOpen class="h-4 w-4 text-amber-300" />
            Ver Catálogo Oficial DBA
          </button>
        </div>
      </div>

      <!-- Tab Selectors -->
      <div class="mt-8 flex gap-3 border-t border-white/10 pt-6">
        <button
          type="button"
          @click="activeTab = 'coherencia'"
          :class="activeTab === 'coherencia' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 border-amber-500' : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white border-transparent'"
          class="inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-black transition-all border uppercase tracking-wider"
        >
          <PieChart class="h-4 w-4" />
          Coherencia Curricular
        </button>
        <button
          type="button"
          @click="activeTab = 'cobertura'"
          :class="activeTab === 'cobertura' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 border-amber-500' : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white border-transparent'"
          class="inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-black transition-all border uppercase tracking-wider"
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
        <!-- KPI Cards Grid -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <p class="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">Evidencias Evaluadas</p>
            <p class="mt-2 text-3xl font-black text-slate-900 dark:text-white">{{ coherenciaStats.total }}</p>
            <p class="mt-2 text-xs font-semibold text-slate-400">Total en el rango de búsqueda</p>
          </div>
          
          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <p class="text-[10px] uppercase font-black tracking-widest text-emerald-500 dark:text-emerald-400">Evidencias Planeadas</p>
            <p class="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">{{ coherenciaStats.planeadas }}</p>
            <p class="mt-2 text-xs font-semibold text-slate-400">Evaluadas dentro de la planeación</p>
          </div>

          <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <p class="text-[10px] uppercase font-black tracking-widest text-amber-500 dark:text-amber-400">Evidencias Adicionales (Extras)</p>
            <p class="mt-2 text-3xl font-black text-amber-600 dark:text-amber-400">{{ coherenciaStats.extras }}</p>
            <p class="mt-2 text-xs font-semibold text-slate-400">Evaluadas fuera de la planeación</p>
          </div>

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

        <!-- Filter bar -->
        <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div class="flex items-center gap-3 border-b border-slate-100 pb-5 mb-5 dark:border-slate-800">
            <SlidersHorizontal class="h-5 w-5 text-amber-500" />
            <h3 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Filtros de Búsqueda</h3>
          </div>
          
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6">
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Periodo</span>
              <select v-model="filterPeriod" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los periodos</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="String(p.id_periodo)">{{ p.nombre }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Grado Académico</span>
              <select v-model="filterGroup" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los grados</option>
                <option v-for="gName in grades" :key="gName" :value="gName">
                  Grado {{ gName }}
                </option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Materia</span>
              <select v-model="filterSubject" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todas las materias</option>
                <option v-for="s in subjects" :key="s.id_materia" :value="String(s.id_materia)">{{ s.nombre }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Docente</span>
              <select v-model="filterTeacher" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los docentes</option>
                <option v-for="t in teachers" :key="t.id_docente" :value="String(t.id_docente)">{{ t.nombre }} {{ t.apellido }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Estado</span>
              <select v-model="filterCoherenciaStatus" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los estados</option>
                <option value="PLANEADAS">Planeadas</option>
                <option value="EXTRAS">Extras</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Búsqueda rápida</span>
              <div class="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:bg-slate-800 dark:border-slate-700">
                <Search class="h-4 w-4 text-slate-400" />
                <input v-model="searchTerm" type="text" placeholder="Filtrar por texto..." class="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none dark:text-white" />
              </div>
            </label>
          </div>
        </div>

        <!-- Coherencia Table Card -->
        <div class="rounded-3xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div class="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div>
              <h4 class="text-lg font-black text-slate-900 dark:text-white">Detalle de Actividades y Evidencias Evaluadas</h4>
              <p class="text-xs font-semibold text-slate-400 mt-1">{{ filteredCoherencia.length }} registros disponibles</p>
            </div>
            <button
              v-if="filteredCoherencia.length > 0"
              @click="exportCoherenciaCSV"
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-500 uppercase tracking-widest shadow-md shadow-amber-900/10 transition"
            >
              <Download class="h-4 w-4" />
              Exportar CSV
            </button>
          </div>

          <div v-if="filteredCoherencia.length === 0" class="py-16 text-center">
            <AlertTriangle class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p class="text-base font-black text-slate-700 dark:text-slate-400">No se encontraron registros de coherencia.</p>
            <p class="text-sm font-semibold text-slate-400 dark:text-slate-500 max-w-md mx-auto mt-1">Ajusta los filtros de búsqueda o asegúrate de que los docentes hayan calificado actividades asociadas a evidencias DBA.</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-100 text-left dark:bg-slate-800/40 dark:border-slate-800">
                  <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Docente</th>
                  <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Curso & Materia</th>
                  <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Actividad</th>
                  <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Enunciado DBA</th>
                  <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Evidencia del Catálogo</th>
                  <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Coherencia</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="row in filteredCoherencia" :key="row.id_actividadmateria + '-' + row.id_evidencia_dba" class="hover:bg-slate-50/50 transition dark:hover:bg-slate-800/30">
                  <td class="px-6 py-4">
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ row.docente_nombre }}</p>
                    <p class="text-[10px] font-semibold text-slate-400">Docente Asignado</p>
                  </td>
                  <td class="px-6 py-4">
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ row.grupo_nombre }}</p>
                    <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">{{ row.materia_nombre }}</p>
                  </td>
                  <td class="px-6 py-4">
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ row.actividad_nombre }}</p>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso: {{ row.actividad_porcentaje }}%</p>
                  </td>
                  <td class="px-6 py-4 max-w-xs">
                    <span class="inline-flex rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 shrink-0 mb-1.5">DBA #{{ row.numero_dba }}</span>
                    <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed" :title="row.dba_enunciado">{{ row.dba_enunciado }}</p>
                  </td>
                  <td class="px-6 py-4 max-w-sm">
                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{{ row.evidencia_descripcion }}</p>
                    
                    <!-- Motivo/Justificación de evidencia EXTRA -->
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
                  <td class="px-6 py-4 text-center">
                    <span
                      :class="row.estado_coherencia === 'PLANEADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30'"
                      class="inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border shadow-sm"
                    >
                      {{ row.estado_coherencia }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
                  placeholder="Buscar materia o grado..."
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 dark:bg-slate-800/80 dark:border-slate-700 dark:text-white"
                />
                <button 
                  v-if="searchResumenTerm"
                  @click="searchResumenTerm = ''"
                  class="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold p-0.5"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            
            <div v-if="coberturaResumen.length === 0" class="py-12 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
              No hay áreas curriculares configuradas o no coinciden con los filtros.
            </div>

            <div v-else-if="filteredCoberturaResumen.length === 0" class="py-12 text-center text-xs font-bold text-slate-400 dark:text-slate-500 space-y-2">
              <p>Sin resultados para "{{ searchResumenTerm }}".</p>
              <button @click="searchResumenTerm = ''" class="text-indigo-600 dark:text-indigo-400 hover:underline">
                Limpiar búsqueda
              </button>
            </div>
            
            <!-- Contenedor con Scrollbar Interno Fijo -->
            <div v-else class="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1.5 custom-scrollbar">
              <div 
                v-for="res in filteredCoberturaResumen" 
                :key="res.area + '-' + res.grado"
                @click="toggleSelectResumenCard(res)"
                :class="selectedResumenCard && selectedResumenCard.area === res.area && selectedResumenCard.grado === res.grado
                  ? 'ring-2 ring-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-md scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100/50 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800/70'"
                class="space-y-2 p-4 rounded-2xl border cursor-pointer transition-all duration-200 relative group"
              >
                <div class="flex justify-between items-start">
                  <div>
                    <div class="flex items-center gap-2">
                      <h5 class="text-sm font-black text-slate-800 dark:text-slate-200">{{ res.area }}</h5>
                      <span v-if="selectedResumenCard && selectedResumenCard.area === res.area && selectedResumenCard.grado === res.grado" class="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-600 text-white shadow-xs">
                        Seleccionado
                      </span>
                    </div>
                    <p class="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mt-0.5">Grado {{ res.grado }}</p>
                  </div>
                  <span class="text-xs font-black text-slate-600 dark:text-slate-300">
                    {{ res.evidencias_evaluadas }} / {{ res.total_evidencias }}
                  </span>
                </div>
                
                <div class="flex items-center gap-3">
                  <div class="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                      :class="res.total_evidencias > 0 && (res.evidencias_evaluadas / res.total_evidencias) >= 0.75 ? 'bg-emerald-500' : (res.evidencias_evaluadas / res.total_evidencias) >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'" 
                      class="h-2 rounded-full transition-all" 
                      :style="{ width: `${res.total_evidencias > 0 ? (res.evidencias_evaluadas / res.total_evidencias) * 100 : 0}%` }"
                    ></div>
                  </div>
                  <span class="text-xs font-extrabold text-slate-500 shrink-0">
                    {{ res.total_evidencias > 0 ? Math.round((res.evidencias_evaluadas / res.total_evidencias) * 100) : 0 }}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Detalle de Evidencias Cubiertas vs Pendientes -->
          <div class="xl:col-span-2 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h4 class="text-lg font-black text-slate-900 dark:text-white">Estado Detallado de Evidencias</h4>
                <span 
                  v-if="selectedResumenCard" 
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm animate-in fade-in"
                >
                  <span>{{ selectedResumenCard.area }} · Grado {{ selectedResumenCard.grado }}</span>
                  <button 
                    @click.stop="selectedResumenCard = null" 
                    class="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                    title="Quitar filtro de tarjeta"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              
              <button 
                v-if="selectedResumenCard" 
                @click="selectedResumenCard = null" 
                class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Ver todas ({{ coberturaDetalles.length }})
              </button>
            </div>

            <div v-if="filteredCoberturaDetalles.length === 0" class="py-20 text-center text-sm font-bold text-slate-400 dark:text-slate-500 space-y-3">
              <p v-if="selectedResumenCard">No hay evidencias registradas para {{ selectedResumenCard.area }} - Grado {{ selectedResumenCard.grado }}.</p>
              <p v-else>No hay evidencias en este rango.</p>
              <button v-if="selectedResumenCard" @click="selectedResumenCard = null" class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors dark:bg-indigo-950 dark:text-indigo-300">
                Limpiar filtro de tarjeta
              </button>
            </div>

            <div v-else class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div v-for="det in filteredCoberturaDetalles" :key="det.id_evidencia_dba" class="p-5 rounded-3xl border border-slate-100/80 bg-slate-50/50 dark:bg-slate-800/20 dark:border-slate-800 shadow-inner flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div class="space-y-2 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-xl bg-amber-50 text-amber-800 px-2.5 py-0.5 text-[9px] font-black dark:bg-amber-950/40 dark:text-amber-400 shrink-0 uppercase tracking-wider">
                      DBA #{{ det.numero_dba }}
                    </span>
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-widest">
                      Grado {{ det.grado }} · {{ det.area }}
                    </span>
                  </div>
                  
                  <!-- Enunciado del DBA -->
                  <div v-if="det.dba_enunciado" class="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-900/30">
                    <span class="text-[9px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest block mb-0.5">Enunciado del DBA:</span>
                    <p class="text-xs font-bold text-amber-950 dark:text-amber-200 leading-relaxed italic">
                      "{{ det.dba_enunciado }}"
                    </p>
                  </div>

                  <!-- Descripción de la Evidencia -->
                  <div class="pt-0.5">
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Evidencia #{{ det.evidencia_orden || 1 }}:</span>
                    <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {{ det.evidencia_descripcion }}
                    </p>
                  </div>
                  
                  <!-- Evaluations information -->
                  <div v-if="det.evaluaciones && det.evaluaciones.length > 0" class="pt-3 border-t border-slate-200/50 dark:border-slate-700/50 space-y-2">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actividades Evaluadas:</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div v-for="(ev, idx) in det.evaluaciones" :key="idx" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-xs shadow-sm">
                        <p class="font-bold text-slate-800 dark:text-slate-200">{{ ev.actividad_nombre }} ({{ ev.actividad_porcentaje }}%)</p>
                        <p class="text-[10px] font-semibold text-slate-500 mt-0.5">Grupo: {{ ev.grupo_nombre }} · Docente: {{ ev.docente_nombre }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Status indicator -->
                <div class="shrink-0 flex flex-col gap-2 items-end">
                  <!-- Cobertura Status -->
                  <span 
                    v-if="det.evaluaciones && det.evaluaciones.length > 0"
                    class="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border shadow-sm inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    Cubierta
                  </span>
                  <span 
                    v-else
                    class="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border inline-flex items-center gap-1.5"
                  >
                    Pendiente
                  </span>

                  <!-- Estado Planeación Status -->
                  <span 
                    v-if="det.es_planeada"
                    class="bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900/30 rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest border inline-flex items-center"
                  >
                    Planeada
                  </span>
                  <span 
                    v-else-if="det.evaluaciones && det.evaluaciones.length > 0"
                    class="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30 rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest border inline-flex items-center"
                  >
                    Extra
                  </span>
                  <span 
                    v-else
                    class="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest border inline-flex items-center"
                  >
                    Sin Planear
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal del Catálogo Oficial de DBA -->
    <div 
      v-if="showCatalogModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-300"
    >
      <div class="relative flex flex-col w-full max-w-6xl max-h-[90vh] rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
        <!-- Header Modal -->
        <div class="flex items-center justify-between border-b border-slate-100 bg-slate-900 p-6 md:px-8 text-white dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <BookOpen class="h-6 w-6" />
            </div>
            <div>
              <h3 class="text-xl font-black tracking-tight text-white">Catálogo Oficial de DBA & Evidencias</h3>
              <p class="text-xs font-semibold text-slate-400">Consulta los derechos básicos, su estado de planeación por periodo y las evidencias disponibles.</p>
            </div>
          </div>
          
          <button 
            @click="showCatalogModal = false" 
            class="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X class="h-6 w-6" />
          </button>
        </div>

        <!-- Body Scrollable -->
        <div class="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
          <!-- KPI Stats bar -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Evidencias</p>
              <p class="text-2xl font-black text-slate-900 dark:text-white mt-1">{{ catalogStats.totalEvidences }}</p>
            </div>
            <div class="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/30">
              <p class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Planeadas / Vinculadas</p>
              <p class="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{{ catalogStats.plannedEvidences }}</p>
            </div>
            <div class="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/30">
              <p class="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Libres / Sin Planear</p>
              <p class="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{{ catalogStats.freeEvidences }}</p>
            </div>
            <div class="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/30">
              <p class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">% Avance de Planeación</p>
              <p class="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">{{ catalogStats.pct }}%</p>
            </div>
          </div>

          <!-- Filters Toolbar -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <!-- Filter Grado -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grado</label>
              <select v-model="catalogGradeFilter" class="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los grados</option>
                <option v-for="g in grades" :key="g" :value="g">Grado {{ g }}</option>
              </select>
            </div>

            <!-- Filter Area -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Área / Materia</label>
              <select v-model="catalogSubjectFilter" class="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todas las áreas</option>
                <option v-for="s in subjects" :key="s.id_materia" :value="String(s.id_materia)">{{ s.nombre }}</option>
              </select>
            </div>

            <!-- Filter Status -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado Planeación</label>
              <select v-model="catalogStatusFilter" class="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los estados</option>
                <option value="PLANEADAS">🟢 Solo Planeadas</option>
                <option value="LIBRES">⚪ Solo Libres / Sin Planear</option>
              </select>
            </div>

            <!-- Filter Period -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Periodo Lectivo</label>
              <select v-model="catalogPeriodFilter" class="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los periodos</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="String(p.id_periodo)">{{ p.nombre }}{{ p.estado ? ' (' + p.estado + ')' : '' }}</option>
              </select>
            </div>

            <!-- Search Bar -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Buscar</label>
              <div class="relative">
                <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input 
                  v-model="catalogSearchTerm"
                  type="text"
                  placeholder="Buscar DBA, evidencia o competencia..."
                  class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="catalogLoading" class="py-20 text-center space-y-3">
            <RefreshCw class="h-8 w-8 text-amber-500 animate-spin mx-auto" />
            <p class="text-sm font-bold text-slate-500">Cargando catálogo oficial de DBA y estado de planeación...</p>
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredCatalog.length === 0" class="py-20 text-center text-sm font-bold text-slate-400 dark:text-slate-500 space-y-2">
            <p>No se encontraron evidencias DBA que coincidan con los filtros seleccionados.</p>
          </div>

          <!-- DBA Catalog List -->
          <div v-else class="space-y-6">
            <div 
              v-for="dba in filteredCatalog" 
              :key="dba.id_dba"
              class="rounded-3xl border border-slate-100 bg-slate-50/50 p-6 dark:bg-slate-800/30 dark:border-slate-800 space-y-4 shadow-sm"
            >
              <!-- DBA Header -->
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-3 dark:border-slate-700/60">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <span class="rounded-xl bg-amber-500 text-white px-3 py-1 text-xs font-black shadow-xs">
                    DBA #{{ dba.numero_dba }}
                  </span>
                  <span class="rounded-full bg-slate-200 text-slate-700 px-3 py-0.5 text-xs font-bold dark:bg-slate-700 dark:text-slate-300">
                    Grado {{ dba.grado }} · {{ dba.area }}
                  </span>
                  <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Versión: {{ dba.version_curricular }}
                  </span>
                </div>
              </div>

              <!-- DBA Enunciado -->
              <p class="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                {{ dba.dba_enunciado }}
              </p>

              <!-- Evidences Sub-list -->
              <div class="space-y-3 pt-2">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias de Aprendizaje:</p>
                <div class="grid grid-cols-1 gap-3">
                  <div 
                    v-for="ev in dba.evidencias" 
                    :key="ev.id_evidencia_dba"
                    class="p-4 rounded-2xl bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-4"
                  >
                    <div class="space-y-2 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-slate-400">#{{ ev.orden }}</span>
                        <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                          {{ ev.descripcion }}
                        </p>
                      </div>

                      <!-- Details of Period and Competency if Planned (Grouped) -->
                      <div v-if="ev.planeaciones && ev.planeaciones.length > 0" class="pt-2 space-y-2">
                        <div 
                          v-for="(gPlan, gIdx) in getGroupedPlaneaciones(ev.planeaciones)" 
                          :key="gIdx"
                          class="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-900/40 space-y-2"
                        >
                          <!-- Header of Competency Group -->
                          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/50 dark:border-emerald-900/30 pb-2">
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs shrink-0">
                                {{ gPlan.periodo_nombre }}
                              </span>
                              <span class="text-xs font-black text-emerald-950 dark:text-emerald-200">
                                {{ gPlan.materia_nombre }}
                              </span>
                            </div>
                          </div>

                          <!-- Competencia vinculada -->
                          <div v-if="gPlan.competencia_descripcion" class="text-xs font-semibold text-slate-700 dark:text-slate-300 italic pt-0.5 leading-relaxed">
                            <span class="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest not-italic block mb-0.5">Competencia Asignada:</span>
                            "{{ gPlan.competencia_descripcion }}"
                          </div>

                          <!-- Sub-tarjetas de Cursos / Grados asignados -->
                          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span class="text-[10px] font-black text-emerald-700/80 dark:text-emerald-400 uppercase tracking-widest mr-1">Cursos planeados:</span>
                            <span 
                              v-for="(grpName, grpIdx) in gPlan.grupos" 
                              :key="grpIdx"
                              class="inline-flex items-center px-2.5 py-1 rounded-xl bg-white border border-emerald-200/80 text-emerald-900 dark:bg-slate-900 dark:border-emerald-800/50 dark:text-emerald-300 text-[10px] font-extrabold shadow-2xs"
                            >
                              {{ grpName }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Status Badge -->
                    <div class="shrink-0 flex items-start">
                      <span 
                        v-if="ev.planeaciones && ev.planeaciones.length > 0"
                        class="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 class="h-3.5 w-3.5 text-emerald-600" />
                        Planeada ({{ getGroupedPlaneaciones(ev.planeaciones).length }})
                      </span>
                      <span 
                        v-else
                        class="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5"
                      >
                        Libre / Sin Planear
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
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
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
