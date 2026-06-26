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
  PieChart 
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { getCourseDisplayName } from '../../utils/courseHelper'

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
  jornada_nombre: string
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
const subjects = ref<SubjectOption[]>([])
const teachers = ref<TeacherOption[]>([])

// Report Data
const coherenciaData = ref<CoherenciaRow[]>([])
const coberturaResumen = ref<CoberturaResumen[]>([])
const coberturaDetalles = ref<CoberturaDetalle[]>([])

// Filter selections
const filterPeriod = ref<string>('TODOS')
const filterGroup = ref<string>('TODOS')
const filterSubject = ref<string>('TODOS')
const filterTeacher = ref<string>('TODOS')
const searchTerm = ref<string>('')

// Cobertura specific filters
const filterCoberturaSubject = ref<string>('TODOS')
const filterCoberturaGroup = ref<string>('TODOS')

// Load filter options
const loadFilterOptions = async () => {
  if (!schoolId.value) return
  try {
    const [settingsRes, teachersRes] = await Promise.all([
      axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`),
      axios.get(`http://localhost:3000/api/academic-admin/teachers/${schoolId.value}`)
    ])
    
    periods.value = (settingsRes.data.periods || []).filter((p: any) => p.estado !== 'PENDIENTE')
    
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
    if (filterGroup.value !== 'TODOS') params.id_grupo = filterGroup.value
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
    if (filterCoberturaGroup.value !== 'TODOS') params.id_grupo = filterCoberturaGroup.value
    if (filterCoberturaSubject.value !== 'TODOS') params.id_materia = filterCoberturaSubject.value

    const res = await axios.get(`http://localhost:3000/api/academic-admin/settings/dba-reportes/cobertura/${schoolId.value}`, { params })
    coberturaResumen.value = res.data.resumen || []
    coberturaDetalles.value = res.data.detalles || []
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
  const query = searchTerm.value.trim().toLowerCase()
  if (!query) return coherenciaData.value
  
  return coherenciaData.value.filter(row => {
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
          
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Periodo</span>
              <select v-model="filterPeriod" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los periodos</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="String(p.id_periodo)">{{ p.nombre }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Curso / Grupo</span>
              <select v-model="filterGroup" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los cursos</option>
                <option v-for="g in groups" :key="g.id_grupo" :value="String(g.id_grupo)">
                  {{ getCourseDisplayName({ tipo_grado_nombre: g.tipo_grado_nombre, seccion_nombre: g.seccion_nombre }) }} ({{ g.jornada_nombre }})
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
          
          <div class="grid grid-cols-1 gap-5 md:grid-cols-3">
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Periodo Lectivo</span>
              <select v-model="filterPeriod" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los periodos</option>
                <option v-for="p in periods" :key="p.id_periodo" :value="String(p.id_periodo)">{{ p.nombre }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="text-xs font-black text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-widest">Grado / Grado Académico</span>
              <select v-model="filterCoberturaGroup" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="TODOS">Todos los grados</option>
                <option v-for="g in groups" :key="g.id_grupo" :value="String(g.id_grupo)">
                  {{ getCourseDisplayName({ tipo_grado_nombre: g.tipo_grado_nombre, seccion_nombre: g.seccion_nombre }) }} ({{ g.jornada_nombre }})
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
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <!-- Resumen por Grado/Materia -->
          <div class="xl:col-span-1 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 space-y-6">
            <h4 class="text-lg font-black text-slate-900 dark:text-white border-b border-slate-100 pb-4 dark:border-slate-800">Resumen por Grado & Área</h4>
            
            <div v-if="coberturaResumen.length === 0" class="py-12 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
              No hay áreas curriculares configuradas o no coinciden con los filtros.
            </div>
            
            <div v-else class="space-y-5">
              <div v-for="res in coberturaResumen" :key="res.area + '-' + res.grado" class="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100/50 dark:border-slate-800">
                <div class="flex justify-between items-start">
                  <div>
                    <h5 class="text-sm font-black text-slate-800 dark:text-slate-200">{{ res.area }}</h5>
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
            <h4 class="text-lg font-black text-slate-900 dark:text-white border-b border-slate-100 pb-4 dark:border-slate-800">Estado Detallado de Evidencias</h4>

            <div v-if="coberturaDetalles.length === 0" class="py-20 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
              No hay evidencias en este rango.
            </div>

            <div v-else class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div v-for="det in coberturaDetalles" :key="det.id_evidencia_dba" class="p-5 rounded-3xl border border-slate-100/80 bg-slate-50/50 dark:bg-slate-800/20 dark:border-slate-800 shadow-inner flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div class="space-y-2 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-xl bg-amber-50 text-amber-800 px-2.5 py-0.5 text-[9px] font-black dark:bg-amber-950/40 dark:text-amber-400 shrink-0 uppercase tracking-wider">
                      DBA #{{ det.numero_dba }}
                    </span>
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-widest">
                      Grado {{ det.grado }} · {{ det.area }}
                    </span>
                  </div>
                  
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {{ det.evidencia_descripcion }}
                  </p>
                  
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
                <div class="shrink-0 flex items-start">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
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
