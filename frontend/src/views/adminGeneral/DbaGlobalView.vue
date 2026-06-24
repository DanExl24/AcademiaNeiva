<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { 
  BookOpen, Plus, Search, Edit3, CheckCircle, XCircle, 
  ChevronDown, ChevronUp, Book, Layers, Award, School, Settings, X,
  Upload
} from 'lucide-vue-next'

const auth = useAuthStore()

// Interfaces
interface EvidenciaDba {
  id_evidencia_dba: number
  id_dba: number
  descripcion: string
  orden: number
  estado: 'ACTIVO' | 'INACTIVO'
  created_at: string
}

interface Dba {
  id_dba: number
  area: string
  grado: string
  numero_dba: number
  enunciado: string
  version_curricular: string
  estado: 'ACTIVO' | 'INACTIVO'
  total_evidencias?: number
  evidencias?: EvidenciaDba[]
  isExpanded?: boolean
  created_at?: string
  updated_at?: string
}

interface Colegio {
  id_colegio: number
  nombre: string
  tipo_colegio: string
  sede: string
  dane: string
  estado: string
}

interface Asignacion {
  id: number
  id_colegio: number
  nombre_colegio?: string
  area: string
  grado: string
  version_curricular: string
  fecha_asignacion: string
}

// State
const loading = ref(true)
const saving = ref(false)
const dbaList = ref<Dba[]>([])
const areas = ref<string[]>([])
const versions = ref<string[]>([])
const colleges = ref<Colegio[]>([])
const activeSchoolAssignments = ref<Asignacion[]>([])

// Pagination & Filters
const page = ref(1)
const limit = ref(10)
const totalCount = ref(0)
const totalPages = ref(1)

const filters = ref({
  area: 'TODOS',
  grado: 'TODOS',
  version: 'TODOS',
  estado: 'TODOS',
  busqueda: ''
})

// Stats KPI
const stats = ref({
  totalDba: 0,
  totalEvidencias: 0,
  totalAreas: 0,
  totalVersiones: 0,
  totalActivos: 0
})

// Modals State
const showDbaModal = ref(false)
const showEvidenceModal = ref(false)
const showAssignModal = ref(false)
const showViewAssignmentsModal = ref(false)
const showImportModal = ref(false)

// Forms
const selectedDba = ref<Dba | null>(null)
const importFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const importForm = ref({
  area: 'Ciencias Naturales',
  version_curricular: '2016',
  start_page: 8
})
const importResult = ref<{ message: string; summary: string } | null>(null)
const dbaForm = ref({
  area: '',
  grado: 'PRIMERO',
  numero_dba: 1,
  enunciado: '',
  version_curricular: '2016'
})

const selectedEvidence = ref<EvidenciaDba | null>(null)
const parentDba = ref<Dba | null>(null)
const evidenceForm = ref({
  descripcion: '',
  orden: 1
})

const assignForm = ref({
  id_colegio: '',
  area: '',
  grado: 'PRIMERO',
  version_curricular: ''
})

const selectedSchoolForView = ref<Colegio | null>(null)

// Grade Lists
const gradeOptions = [
  'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO',
  'SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO', 'DECIMO', 'ONCE'
]

// Common headers helper
const getHeaders = () => ({
  headers: { Authorization: `Bearer ${auth.token}` }
})

// API Calls
const fetchStats = async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/admin/dba/estadisticas', getHeaders())
    stats.value = res.data
  } catch (error) {
    console.error('Error fetching dba stats:', error)
  }
}

const fetchMeta = async () => {
  try {
    const [areasRes, versionsRes, collegesRes] = await Promise.all([
      axios.get('http://localhost:3000/api/admin/dba/areas', getHeaders()),
      axios.get('http://localhost:3000/api/admin/dba/versiones', getHeaders()),
      axios.get('http://localhost:3000/api/admin/colegios', getHeaders())
    ])
    areas.value = areasRes.data
    versions.value = versionsRes.data
    // Filter active colleges
    colleges.value = collegesRes.data.filter((c: Colegio) => c.estado === 'ACTIVO')
  } catch (error) {
    console.error('Error fetching dba metadata:', error)
  }
}

const fetchDbaList = async () => {
  try {
    loading.value = true
    const params: any = {
      page: page.value,
      limit: limit.value,
      area: filters.value.area !== 'TODOS' ? filters.value.area : undefined,
      grado: filters.value.grado !== 'TODOS' ? filters.value.grado : undefined,
      version: filters.value.version !== 'TODOS' ? filters.value.version : undefined,
      estado: filters.value.estado !== 'TODOS' ? filters.value.estado : undefined,
      busqueda: filters.value.busqueda || undefined
    }

    const res = await axios.get('http://localhost:3000/api/admin/dba', {
      headers: { Authorization: `Bearer ${auth.token}` },
      params
    })
    
    // Get total count header
    const totalHeader = res.headers['x-total-count']
    totalCount.value = totalHeader ? Number(totalHeader) : res.data.length
    totalPages.value = Math.ceil(totalCount.value / limit.value) || 1

    dbaList.value = res.data.map((d: Dba) => ({
      ...d,
      isExpanded: false,
      evidencias: []
    }))
  } catch (error) {
    console.error('Error fetching dba list:', error)
  } finally {
    loading.value = false
  }
}

// Toggle DBA Expand to fetch evidences on demand
const toggleExpandDba = async (dba: Dba) => {
  dba.isExpanded = !dba.isExpanded
  if (dba.isExpanded && (!dba.evidencias || dba.evidencias.length === 0)) {
    try {
      const res = await axios.get(`http://localhost:3000/api/admin/dba/${dba.id_dba}`, getHeaders())
      dba.evidencias = res.data.evidencias
    } catch (error) {
      console.error('Error fetching dba details/evidences:', error)
    }
  }
}

// Watchers
watch([filters, page], () => {
  fetchDbaList()
}, { deep: true })

watch(() => filters.value, () => {
  page.value = 1 // Reset page on filter change
}, { deep: true })

// Lifecycle Hook
onMounted(async () => {
  await Promise.all([
    fetchStats(),
    fetchMeta(),
    fetchDbaList()
  ])
})

// DBA actions
const openCreateDba = () => {
  selectedDba.value = null
  dbaForm.value = {
    area: '',
    grado: 'PRIMERO',
    numero_dba: stats.value.totalDba ? stats.value.totalDba + 1 : 1,
    enunciado: '',
    version_curricular: '2016'
  }
  showDbaModal.value = true
}

const openEditDba = (dba: Dba) => {
  selectedDba.value = dba
  dbaForm.value = {
    area: dba.area,
    grado: dba.grado,
    numero_dba: dba.numero_dba,
    enunciado: dba.enunciado,
    version_curricular: dba.version_curricular
  }
  showDbaModal.value = true
}

const handleSaveDba = async () => {
  if (!dbaForm.value.area || !dbaForm.value.enunciado || !dbaForm.value.version_curricular) {
    alert('Por favor complete los campos obligatorios.')
    return
  }
  
  try {
    saving.value = true
    if (selectedDba.value) {
      // Edit
      await axios.put(`http://localhost:3000/api/admin/dba/${selectedDba.value.id_dba}`, dbaForm.value, getHeaders())
    } else {
      // Create
      await axios.post('http://localhost:3000/api/admin/dba', dbaForm.value, getHeaders())
    }
    showDbaModal.value = false
    await Promise.all([fetchStats(), fetchMeta(), fetchDbaList()])
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar DBA')
  } finally {
    saving.value = false
  }
}

const toggleDbaStatus = async (dba: Dba) => {
  const newStatus = dba.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
  const action = newStatus === 'ACTIVO' ? 'activar' : 'desactivar'
  if (confirm(`¿Estás seguro de que deseas ${action} el DBA #${dba.numero_dba}?`)) {
    try {
      await axios.patch(`http://localhost:3000/api/admin/dba/${dba.id_dba}/estado`, { estado: newStatus }, getHeaders())
      dba.estado = newStatus
      await fetchStats()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al cambiar estado del DBA')
    }
  }
}

// Evidence Actions
const openCreateEvidence = (dba: Dba) => {
  parentDba.value = dba
  selectedEvidence.value = null
  evidenceForm.value = {
    descripcion: '',
    orden: (dba.evidencias?.length || 0) + 1
  }
  showEvidenceModal.value = true
}

const openEditEvidence = (dba: Dba, ev: EvidenciaDba) => {
  parentDba.value = dba
  selectedEvidence.value = ev
  evidenceForm.value = {
    descripcion: ev.descripcion,
    orden: ev.orden
  }
  showEvidenceModal.value = true
}

const handleSaveEvidence = async () => {
  if (!evidenceForm.value.descripcion) {
    alert('La descripción es obligatoria.')
    return
  }

  try {
    saving.value = true
    if (selectedEvidence.value) {
      // Edit
      const res = await axios.put(`http://localhost:3000/api/admin/dba/evidencias/${selectedEvidence.value.id_evidencia_dba}`, evidenceForm.value, getHeaders())
      // Update local state
      if (parentDba.value && parentDba.value.evidencias) {
        const idx = parentDba.value.evidencias.findIndex(e => e.id_evidencia_dba === selectedEvidence.value!.id_evidencia_dba)
        if (idx !== -1) parentDba.value.evidencias[idx] = res.data
      }
    } else if (parentDba.value) {
      // Create
      const res = await axios.post(`http://localhost:3000/api/admin/dba/${parentDba.value.id_dba}/evidencias`, evidenceForm.value, getHeaders())
      if (!parentDba.value.evidencias) parentDba.value.evidencias = []
      parentDba.value.evidencias.push(res.data)
      parentDba.value.total_evidencias = (parentDba.value.total_evidencias || 0) + 1
    }
    showEvidenceModal.value = false
    await fetchStats()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar evidencia')
  } finally {
    saving.value = false
  }
}

const toggleEvidenceStatus = async (ev: EvidenciaDba) => {
  const newStatus = ev.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
  try {
    const res = await axios.patch(`http://localhost:3000/api/admin/dba/evidencias/${ev.id_evidencia_dba}/estado`, { estado: newStatus }, getHeaders())
    ev.estado = res.data.estado
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al cambiar estado de la evidencia')
  }
}

// Assignment Actions
const openAssignVersion = () => {
  assignForm.value = {
    id_colegio: colleges.value[0]?.id_colegio?.toString() || '',
    area: areas.value[0] || 'Ciencias Naturales',
    grado: 'PRIMERO',
    version_curricular: versions.value[0] || '2016'
  }
  showAssignModal.value = true
}

const handleAssignVersion = async () => {
  if (!assignForm.value.id_colegio || !assignForm.value.area || !assignForm.value.version_curricular) {
    alert('Todos los campos son obligatorios.')
    return
  }

  try {
    saving.value = true
    await axios.post('http://localhost:3000/api/admin/dba/assign-version', {
      id_colegio: Number(assignForm.value.id_colegio),
      area: assignForm.value.area,
      grado: assignForm.value.grado,
      version_curricular: assignForm.value.version_curricular
    }, getHeaders())
    
    alert('Versión curricular asignada exitosamente.')
    showAssignModal.value = false
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al asignar versión al colegio')
  } finally {
    saving.value = false
  }
}

const viewAssignments = async (college: Colegio) => {
  selectedSchoolForView.value = college
  try {
    const res = await axios.get(`http://localhost:3000/api/admin/dba/asignaciones/${college.id_colegio}`, getHeaders())
    activeSchoolAssignments.value = res.data
    showViewAssignmentsModal.value = true
  } catch (error) {
    console.error('Error fetching assignments:', error)
  }
}

const openImportModal = () => {
  importFile.value = null
  if (fileInput.value) fileInput.value.value = ''
  importForm.value = {
    area: 'Ciencias Naturales',
    version_curricular: '2016',
    start_page: 8
  }
  importResult.value = null
  showImportModal.value = true
}

const onFileChange = (e: any) => {
  const files = e.target.files
  if (files && files.length > 0) {
    importFile.value = files[0]
  }
}

const handleImportPDF = async () => {
  if (!importFile.value) {
    alert('Por favor seleccione un archivo PDF.')
    return
  }
  if (!importForm.value.area || !importForm.value.version_curricular) {
    alert('El área y la versión curricular son obligatorios.')
    return
  }

  try {
    saving.value = true
    importResult.value = null
    
    const formData = new FormData()
    formData.append('pdf', importFile.value)
    formData.append('area', importForm.value.area)
    formData.append('version_curricular', importForm.value.version_curricular)
    formData.append('start_page', String(importForm.value.start_page))

    const res = await axios.post('http://localhost:3000/api/admin/dba/importar', formData, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'multipart/form-data'
      }
    })

    importResult.value = {
      message: res.data.message,
      summary: res.data.summary
    }

    // Refresh data
    await Promise.all([fetchStats(), fetchMeta(), fetchDbaList()])
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al importar PDF')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <BookOpen :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Catálogo DBA Global</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Derechos Básicos de Aprendizaje del Ministerio de Educación Nacional de Colombia.</p>
          </div>
        </div>
        
        <div class="flex gap-3">
          <button @click="openAssignVersion" class="flex items-center gap-2 px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <School :size="18" />
            Asignar a Colegio
          </button>
          <button @click="openImportModal" class="flex items-center gap-2 px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-305 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <Upload :size="18" />
            Importar PDF
          </button>
          <button @click="openCreateDba" class="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">
            <Plus :size="18" />
            Nuevo DBA
          </button>
        </div>
      </div>
    </div>

    <!-- KPIs Row -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <!-- Total DBA -->
      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
          <Book :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total DBA</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.totalDba }}</h3>
        </div>
      </div>

      <!-- Evidencias -->
      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
          <Layers :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Evidencias</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.totalEvidencias }}</h3>
        </div>
      </div>

      <!-- Áreas -->
      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 rounded-2xl">
          <Award :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Áreas</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.totalAreas }}</h3>
        </div>
      </div>

      <!-- Versiones -->
      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-2xl">
          <Settings :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Versiones</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.totalVersiones }}</h3>
        </div>
      </div>

      <!-- Activos -->
      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 col-span-2 md:col-span-1">
        <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
          <CheckCircle :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Activos</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.totalActivos }}</h3>
        </div>
      </div>
    </div>

    <!-- Filters Panel -->
    <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Area Filter -->
        <div>
          <label class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Área Académica</label>
          <select v-model="filters.area" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="TODOS">Todas las áreas</option>
            <option v-for="area in areas" :key="area" :value="area">{{ area }}</option>
          </select>
        </div>

        <!-- Grade Filter -->
        <div>
          <label class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Grado</label>
          <select v-model="filters.grado" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="TODOS">Todos los grados</option>
            <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
          </select>
        </div>

        <!-- Version Filter -->
        <div>
          <label class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Versión Curricular</label>
          <select v-model="filters.version" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="TODOS">Todas las versiones</option>
            <option v-for="ver in versions" :key="ver" :value="ver">{{ ver }}</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div>
          <label class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Estado</label>
          <select v-model="filters.estado" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="TODOS">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        </div>

        <!-- Search Filter -->
        <div>
          <label class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Buscar</label>
          <div class="relative">
            <input v-model="filters.busqueda" type="text" placeholder="Buscar enunciado..." class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <Search class="absolute left-3.5 top-3 text-slate-400" :size="16" />
          </div>
        </div>
      </div>
    </div>

    <!-- Active Assignments Shortcut -->
    <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm" v-if="colleges.length > 0">
      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
        <School :size="18" class="text-indigo-500" />
        Configuraciones Curriculares por Colegio
      </h3>
      <div class="flex flex-wrap gap-2">
        <button 
          v-for="col in colleges" 
          :key="col.id_colegio" 
          @click="viewAssignments(col)"
          class="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/20 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5"
        >
          {{ col.nombre }}
        </button>
      </div>
    </div>

    <!-- List of DBAs -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-bold text-sm">Cargando catálogo...</p>
    </div>

    <div v-else-if="dbaList.length === 0" class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center">
      <BookOpen :size="48" class="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
      <h3 class="text-lg font-bold text-slate-800 dark:text-white">No se encontraron DBAs</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-2">Prueba cambiando los filtros de búsqueda o registra un nuevo DBA.</p>
    </div>

    <div v-else class="space-y-4">
      <div 
        v-for="dba in dbaList" 
        :key="dba.id_dba" 
        class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm transition-all overflow-hidden"
      >
        <!-- Card Header / DBA Summary Info -->
        <div 
          @click="toggleExpandDba(dba)"
          class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all"
        >
          <div class="flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-1 text-xs font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-md">
                DBA #{{ dba.numero_dba }}
              </span>
              <span class="px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                {{ dba.area }}
              </span>
              <span class="px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                {{ dba.grado }}
              </span>
              <span class="px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                Versión: {{ dba.version_curricular }}
              </span>
              <span 
                class="px-2.5 py-1 text-xs font-bold rounded-md"
                :class="dba.estado === 'ACTIVO' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'"
              >
                {{ dba.estado }}
              </span>
            </div>
            
            <p class="text-slate-850 dark:text-slate-200 font-bold leading-relaxed pr-6">
              {{ dba.enunciado }}
            </p>
          </div>

          <div class="flex items-center gap-4 self-end md:self-auto">
            <span class="text-xs font-bold text-slate-400">
              {{ dba.total_evidencias || dba.evidencias?.length || 0 }} evidencias
            </span>
            <div class="text-slate-400">
              <ChevronDown v-if="!dba.isExpanded" :size="20" />
              <ChevronUp v-else :size="20" />
            </div>
          </div>
        </div>

        <!-- Card Body / Expanded Evidences and Actions -->
        <div v-if="dba.isExpanded" class="border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 p-6 space-y-6">
          <!-- Evidences List -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Evidencias de Aprendizaje</h4>
              <button 
                v-if="dba.estado === 'ACTIVO'"
                @click.stop="openCreateEvidence(dba)" 
                class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-650 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all"
              >
                <Plus :size="14" />
                Agregar Evidencia
              </button>
            </div>
            
            <div v-if="!dba.evidencias || dba.evidencias.length === 0" class="text-slate-400 text-xs italic py-2">
              No hay evidencias registradas para este DBA.
            </div>
            
            <div v-else class="space-y-3">
              <div 
                v-for="ev in dba.evidencias" 
                :key="ev.id_evidencia_dba"
                class="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-sm transition-all flex items-start justify-between gap-4"
              >
                <div class="flex items-start gap-3">
                  <span class="mt-0.5 px-2 py-0.5 text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 rounded-md">
                    #{{ ev.orden }}
                  </span>
                  <div class="space-y-1">
                    <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-normal" :class="ev.estado === 'INACTIVO' ? 'line-through text-slate-400 dark:text-slate-500' : ''">
                      {{ ev.descripcion }}
                    </p>
                    <span class="text-[10px] font-bold" :class="ev.estado === 'ACTIVO' ? 'text-emerald-555' : 'text-red-500'">
                      {{ ev.estado }}
                    </span>
                  </div>
                </div>

                <!-- Evidence action buttons -->
                <div class="flex items-center gap-1">
                  <button 
                    @click.stop="openEditEvidence(dba, ev)" 
                    class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-all"
                    title="Editar Evidencia"
                  >
                    <Edit3 :size="14" />
                  </button>
                  <button 
                    @click.stop="toggleEvidenceStatus(ev)" 
                    class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                    :class="ev.estado === 'ACTIVO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'"
                    :title="ev.estado === 'ACTIVO' ? 'Desactivar Evidencia' : 'Activar Evidencia'"
                  >
                    <CheckCircle v-if="ev.estado === 'ACTIVO'" :size="14" />
                    <XCircle v-else :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- DBA Admin Actions -->
          <div class="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between items-center">
            <span class="text-xs text-slate-400 dark:text-slate-550">
              Registrado: {{ new Date(dba.created_at || Date.now()).toLocaleDateString() }}
            </span>
            <div class="flex gap-2">
              <button 
                @click.stop="toggleDbaStatus(dba)" 
                class="px-4 py-2 border rounded-xl font-bold text-xs transition-all"
                :class="dba.estado === 'ACTIVO' ? 'border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20' : 'border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'"
              >
                {{ dba.estado === 'ACTIVO' ? 'Inactivar DBA' : 'Activar DBA' }}
              </button>
              <button 
                @click.stop="openEditDba(dba)" 
                class="flex items-center gap-1 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-650 dark:text-indigo-400 rounded-xl font-bold text-xs transition-all"
              >
                <Edit3 :size="14" />
                Editar DBA
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-4">
        <span class="text-xs font-bold text-slate-500">
          Mostrando página {{ page }} de {{ totalPages }} ({{ totalCount }} registros)
        </span>
        <div class="flex gap-2">
          <button 
            :disabled="page === 1" 
            @click="page--" 
            class="px-3 py-1.5 border border-slate-200 dark:border-slate-700 disabled:opacity-50 text-slate-650 dark:text-slate-350 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Anterior
          </button>
          <button 
            :disabled="page === totalPages" 
            @click="page++" 
            class="px-3 py-1.5 border border-slate-200 dark:border-slate-700 disabled:opacity-50 text-slate-650 dark:text-slate-350 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 1: Crear/Editar DBA -->
    <div v-if="showDbaModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-black text-slate-900 dark:text-white">
            {{ selectedDba ? 'Editar Derecho Básico' : 'Registrar Derecho Básico (DBA)' }}
          </h3>
          <button @click="showDbaModal = false" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Área -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Área Académica *</label>
            <input v-model="dbaForm.area" type="text" placeholder="Ej. Ciencias Naturales" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Versión Curricular -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Versión Curricular *</label>
            <input v-model="dbaForm.version_curricular" type="text" placeholder="Ej. 2016" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Grado -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Grado *</label>
            <select v-model="dbaForm.grado" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </div>

          <!-- Número -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Número de DBA *</label>
            <input v-model.number="dbaForm.numero_dba" type="number" min="1" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Enunciado -->
          <div class="sm:col-span-2">
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Enunciado (Aprendizaje Estructurante) *</label>
            <textarea v-model="dbaForm.enunciado" rows="4" placeholder="Escribe el enunciado de aprendizaje..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="showDbaModal = false" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Cancelar
          </button>
          <button :disabled="saving" @click="handleSaveDba" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
            <span v-if="saving" class="animate-spin border-2 border-white border-t-transparent rounded-full h-4 w-4"></span>
            Guardar
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 2: Crear/Editar Evidencia -->
    <div v-if="showEvidenceModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-xl p-8 space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-black text-slate-900 dark:text-white">
            {{ selectedEvidence ? 'Editar Evidencia de Aprendizaje' : 'Agregar Evidencia' }}
          </h3>
          <button @click="showEvidenceModal = false" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <div class="space-y-4">
          <div class="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl">
            <span class="text-[10px] font-black uppercase text-indigo-500">DBA Asociado</span>
            <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
              #{{ parentDba?.numero_dba }} - {{ parentDba?.enunciado }}
            </p>
          </div>

          <!-- Orden -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Orden de Visualización *</label>
            <input v-model.number="evidenceForm.orden" type="number" min="1" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Descripción -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Descripción de la Evidencia *</label>
            <textarea v-model="evidenceForm.descripcion" rows="4" placeholder="Ej. Compara cambios físicos en..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="showEvidenceModal = false" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Cancelar
          </button>
          <button :disabled="saving" @click="handleSaveEvidence" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
            <span v-if="saving" class="animate-spin border-2 border-white border-t-transparent rounded-full h-4 w-4"></span>
            Guardar
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 3: Asignar versión a Colegio -->
    <div v-if="showAssignModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-lg p-8 space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-black text-slate-900 dark:text-white">
            Asignar Versión Curricular a Colegio
          </h3>
          <button @click="showAssignModal = false" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Colegio -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Colegio *</label>
            <select v-model="assignForm.id_colegio" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="" disabled>Seleccione un colegio</option>
              <option v-for="col in colleges" :key="col.id_colegio" :value="col.id_colegio.toString()">
                {{ col.nombre }}
              </option>
            </select>
          </div>

          <!-- Área -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Área Académica *</label>
            <select v-model="assignForm.area" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="area in areas" :key="area" :value="area">{{ area }}</option>
            </select>
          </div>

          <!-- Grado -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Grado *</label>
            <select v-model="assignForm.grado" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </div>

          <!-- Versión Curricular -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Versión Curricular *</label>
            <select v-model="assignForm.version_curricular" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="ver in versions" :key="ver" :value="ver">{{ ver }}</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="showAssignModal = false" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Cancelar
          </button>
          <button :disabled="saving" @click="handleAssignVersion" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
            <span v-if="saving" class="animate-spin border-2 border-white border-t-transparent rounded-full h-4 w-4"></span>
            Asignar
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 4: Ver Asignaciones de un Colegio -->
    <div v-if="showViewAssignmentsModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-8 space-y-6">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-lg font-black text-slate-900 dark:text-white">
              Configuración Curricular Asignada
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ selectedSchoolForView?.nombre }}</p>
          </div>
          <button @click="showViewAssignmentsModal = false" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <div class="max-h-[50vh] overflow-y-auto">
          <div v-if="activeSchoolAssignments.length === 0" class="text-center py-8 text-slate-400 text-sm italic">
            El colegio no tiene ninguna versión curricular asignada en este momento.
          </div>
          <table v-else class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400">
                <th class="pb-3">Área</th>
                <th class="pb-3">Grado</th>
                <th class="pb-3 text-center">Versión Curricular</th>
                <th class="pb-3 text-right">Asignado el</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="asig in activeSchoolAssignments" 
                :key="asig.id"
                class="border-b border-slate-50 dark:border-slate-800/50 last:border-none text-xs font-semibold text-slate-750 dark:text-slate-300"
              >
                <td class="py-3.5">{{ asig.area }}</td>
                <td class="py-3.5">{{ asig.grado }}</td>
                <td class="py-3.5 text-center">
                  <span class="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 font-bold rounded-md">
                    {{ asig.version_curricular }}
                  </span>
                </td>
                <td class="py-3.5 text-right text-slate-450">
                  {{ new Date(asig.fecha_asignacion).toLocaleDateString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="showViewAssignmentsModal = false" class="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 5: Importar DBA desde PDF -->
    <div v-if="showImportModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-xl p-8 space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Upload :size="20" class="text-indigo-500" />
            Importar DBA desde PDF Curricular
          </h3>
          <button @click="showImportModal = false" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <!-- If result exists, show success summary -->
        <div v-if="importResult" class="space-y-4">
          <div class="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center gap-3">
            <CheckCircle :size="24" />
            <div>
              <p class="text-sm font-bold">{{ importResult.message }}</p>
            </div>
          </div>

          <div class="p-5 bg-slate-50 dark:bg-slate-800/55 rounded-2xl border border-slate-100 dark:border-slate-850">
            <span class="text-[10px] font-black uppercase text-slate-400 block mb-2">Resumen del Procesamiento</span>
            <pre class="text-xs font-semibold text-slate-750 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{{ importResult.summary }}</pre>
          </div>

          <div class="flex justify-end pt-2">
            <button @click="showImportModal = false" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
              Aceptar
            </button>
          </div>
        </div>

        <!-- Form layout -->
        <div v-else class="space-y-4">
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Sube el archivo PDF oficial emitido por el MEN para el área académica correspondiente. El sistema detectará las páginas del catálogo, estructurará las columnas visuales y poblará las evidencias de forma automática.
          </p>

          <!-- File selector -->
          <div class="border-2 border-dashed border-slate-205 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-indigo-500 transition-all relative">
            <input type="file" ref="fileInput" @change="onFileChange" accept=".pdf" class="absolute inset-0 opacity-0 cursor-pointer" />
            <div class="space-y-2">
              <Upload class="mx-auto text-slate-400" :size="32" />
              <div class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {{ importFile ? importFile.name : 'Selecciona o arrastra el archivo PDF' }}
              </div>
              <p class="text-xs text-slate-400">Tamaño máximo recomendado: 15MB</p>
            </div>
          </div>

          <!-- Area & Version -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Área Académica *</label>
              <input v-model="importForm.area" type="text" placeholder="Ej. Ciencias Naturales" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Versión Curricular *</label>
              <input v-model="importForm.version_curricular" type="text" placeholder="Ej. 2016" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div class="sm:col-span-2">
              <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Página de Inicio en el PDF *</label>
              <input v-model.number="importForm.start_page" type="number" min="1" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <span class="text-[10px] font-bold text-slate-400 mt-1 block">Número de página física (1-indexed) donde inician los DBA, descartando introducciones.</span>
            </div>
          </div>

          <!-- Spinner showing progress -->
          <div v-if="saving" class="flex flex-col items-center justify-center p-4 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-2xl border border-indigo-50/50 dark:border-indigo-950/20">
            <div class="animate-spin rounded-full h-8 w-8 border-3 border-indigo-650 border-t-transparent"></div>
            <p class="mt-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold text-center">
              Parseando PDF e importando evidencias... Esto puede tomar unos segundos.
            </p>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button @click="showImportModal = false" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              Cancelar
            </button>
            <button :disabled="saving || !importFile" @click="handleImportPDF" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
              Importar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;  
  overflow: hidden;
}
</style>
