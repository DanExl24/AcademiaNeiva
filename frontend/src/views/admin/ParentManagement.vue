<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import {
  Users,
  Search,
  UserCheck,
  Mail,
  GraduationCap,
  X,
  Edit2,
  ShieldAlert,
  Eye,
  Filter,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { useRouter } from 'vue-router'

interface ParentItem {
  id_padrefamilia: number
  nombre: string
  apellido: string
  documento: string
  id_tipodocumento: number
  tipo_documento: string
  email: string
  id_usuario: number
  usuario_activo: boolean
  hijos_count: number
  tiene_hijo_sancionado?: boolean
  tiene_hijo_inasistencias?: boolean
  tiene_hijo_riesgo?: boolean
  es_docente?: boolean
  email_docente?: string | null
}

interface ChildDetail {
  id_estudiante: number
  nombre: string
  apellido: string
  documento: string
  codigo: string
  estado: string
  motivo_estado: string | null
  grado_nombre: string | null
  seccion_nombre: string | null
  nivel_nombre: string | null
  jornada_nombre: string | null
  matricula_estado: string | null
  id_grupo: number | null
  id_anio: number | null
  anio_lectivo: string | null
  promedio: number | null
  inasistencias: number
  sanciones_activas: number
}

interface DocumentType {
  id_tipodocumento: number
  tipo: string
}

interface CatalogOption {
  id: number
  nombre: string
}

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const router = useRouter()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const parents = ref<ParentItem[]>([])

const nivelesCatalog = ref<CatalogOption[]>([])
const gradosCatalog = ref<CatalogOption[]>([])

const filterBusqueda = ref('')
const filterEstadoCuenta = ref('TODOS')
const filterAlertaHijo = ref('TODOS')
const filterNivel = ref('')
const filterGrado = ref('')
const filterCantHijos = ref('TODOS')
const filterEstadoMatricula = ref('TODOS')
const filterSoloDocentes = ref(false)

const toggleSoloDocentes = () => {
  filterSoloDocentes.value = !filterSoloDocentes.value
  loadParents()
}

const selectedParentId = ref<number | null>(null)
const drawerOpen = ref(false)
const loadingDetail = ref(false)
const selectedParentDetail = ref<{
  parent: ParentItem & { id_colegio: number; cuenta_creada: string }
  children: ChildDetail[]
  tipos_documento: DocumentType[]
} | null>(null)

const editModalOpen = ref(false)
const savingEdit = ref(false)
const editForm = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: 0
})

const DEFAULT_DOCUMENT_TYPES: DocumentType[] = [
  { id_tipodocumento: 1, tipo: 'Registro Civil' },
  { id_tipodocumento: 2, tipo: 'Tarjeta de Identidad' },
  { id_tipodocumento: 3, tipo: 'Cédula de Ciudadanía' },
  { id_tipodocumento: 4, tipo: 'Cédula de Extranjería' },
  { id_tipodocumento: 5, tipo: 'PEP / PPT' },
  { id_tipodocumento: 6, tipo: 'Pasaporte' }
]

const documentTypes = ref<DocumentType[]>(DEFAULT_DOCUMENT_TYPES)

const hasActiveFilters = computed(() => {
  return (
    filterBusqueda.value.trim() !== '' ||
    filterEstadoCuenta.value !== 'TODOS' ||
    filterAlertaHijo.value !== 'TODOS' ||
    filterNivel.value !== '' ||
    filterGrado.value !== '' ||
    filterCantHijos.value !== 'TODOS' ||
    filterEstadoMatricula.value !== 'TODOS' ||
    filterSoloDocentes.value
  )
})

const resetFilters = () => {
  filterBusqueda.value = ''
  filterEstadoCuenta.value = 'TODOS'
  filterAlertaHijo.value = 'TODOS'
  filterNivel.value = ''
  filterGrado.value = ''
  filterCantHijos.value = 'TODOS'
  filterEstadoMatricula.value = 'TODOS'
  filterSoloDocentes.value = false
  loadParents()
}

const totalParents = computed(() => parents.value.length)
const totalChildrenLinked = computed(() =>
  parents.value.reduce((acc, p) => acc + Number(p.hijos_count || 0), 0)
)
const parentsWithAccount = computed(() => parents.value.filter(p => p.email).length)

const apiBase = import.meta.env.VITE_API_URL || ''

const loadParents = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const params: Record<string, any> = {}

    if (yearStore.selectedYearId) params.yearId = yearStore.selectedYearId
    if (filterBusqueda.value.trim()) params.busqueda = filterBusqueda.value.trim()
    if (filterEstadoCuenta.value !== 'TODOS') params.estadoCuenta = filterEstadoCuenta.value
    if (filterAlertaHijo.value !== 'TODOS') params.alertaHijo = filterAlertaHijo.value
    if (filterNivel.value) params.id_nivel = filterNivel.value
    if (filterGrado.value) params.id_tipo_grado = filterGrado.value
    if (filterCantHijos.value !== 'TODOS') params.cantHijos = filterCantHijos.value
    if (filterEstadoMatricula.value !== 'TODOS') params.estadoMatricula = filterEstadoMatricula.value
    if (filterSoloDocentes.value) params.soloDocentes = 'true'

    const res = await axios.get(`/api/parents/school/${schoolId.value}`, {
      params,
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    parents.value = res.data.parents || []
    if (res.data.catalogs) {
      nivelesCatalog.value = (res.data.catalogs.niveles || []).map((n: any) => ({ id: n.id_nivel, nombre: n.nombre }))
      gradosCatalog.value = (res.data.catalogs.grados || []).map((g: any) => ({ id: g.id_tipo_grado, nombre: g.nombre }))
    }
  } catch (error) {
    console.error('Error al cargar lista de padres:', error)
  } finally {
    loading.value = false
  }
}

watch(() => yearStore.selectedYearId, () => {
  loadParents()
})

let searchTimeout: any = null
const onSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadParents()
  }, 350)
}

const openDrawer = async (parentId: number) => {
  selectedParentId.value = parentId
  drawerOpen.value = true
  loadingDetail.value = true
  selectedParentDetail.value = null

  try {
    const res = await axios.get(`${apiBase}/api/parents/${parentId}/detail`, {
      params: { yearId: yearStore.selectedYearId },
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    selectedParentDetail.value = res.data
    if (res.data.tipos_documento) {
      documentTypes.value = res.data.tipos_documento
    }
  } catch (error) {
    console.error('Error al cargar detalle del padre:', error)
  } finally {
    loadingDetail.value = false
  }
}

const closeDrawer = () => {
  drawerOpen.value = false
  selectedParentId.value = null
  selectedParentDetail.value = null
}

const openEditModal = () => {
  if (!selectedParentDetail.value) return
  const p = selectedParentDetail.value.parent
  editForm.value = {
    nombre: p.nombre,
    apellido: p.apellido,
    documento: p.documento,
    id_tipodocumento: p.id_tipodocumento
  }
  editModalOpen.value = true
}

const saveParentEdit = async () => {
  if (!selectedParentId.value) return
  if (!editForm.value.nombre.trim() || !editForm.value.apellido.trim() || !editForm.value.documento.trim()) {
    alert('Por favor complete todos los campos obligatorios.')
    return
  }

  try {
    savingEdit.value = true
    await axios.put(
      `/api/parents/${selectedParentId.value}`,
      editForm.value,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )
    editModalOpen.value = false
    await loadParents()
    if (selectedParentId.value) {
      await openDrawer(selectedParentId.value)
    }
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al actualizar la información del acudiente.')
  } finally {
    savingEdit.value = false
  }
}

const goToParentMonitoring = () => {
  if (!selectedParentDetail.value) return
  const p = selectedParentDetail.value.parent

  if (!p.id_usuario || !p.usuario_activo) {
    alert('Este acudiente no tiene un usuario activo registrado, no es posible monitorear su portal.')
    return
  }

  auth.startParentMonitoring({
    id: p.id_usuario,
    nombre: p.nombre,
    apellido: p.apellido,
    email: p.email || ''
  })
  closeDrawer()
  router.push('/dashboard')
}

const togglingStatus = ref(false)

const toggleParentAccountStatus = async () => {
  if (!selectedParentDetail.value || !selectedParentId.value) return
  const p = selectedParentDetail.value.parent

  if (!p.id_usuario) {
    alert('Este acudiente no posee una cuenta de usuario registrada en el sistema.')
    return
  }

  const newStatus = !p.usuario_activo
  const actionText = newStatus ? 'ACTIVAR' : 'INACTIVAR'
  
  if (!confirm(`¿Está seguro de que desea ${actionText} la cuenta de acceso de ${p.nombre} ${p.apellido}?`)) {
    return
  }

  try {
    togglingStatus.value = true
    const res = await axios.patch(
      `/api/parents/${selectedParentId.value}/status`,
      { activo: newStatus },
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )

    alert(res.data.message || `Cuenta ${newStatus ? 'activada' : 'inactivada'} correctamente.`)
    await loadParents()
    if (selectedParentId.value) {
      await openDrawer(selectedParentId.value)
    }
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al actualizar el estado de la cuenta.')
  } finally {
    togglingStatus.value = false
  }
}

const getChildStatusBadge = (estado: string) => {
  switch (estado) {
    case 'ACTIVO':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
    case 'SANCIONADO':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
    case 'RETIRADO':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
    case 'EXPULSADO':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
    case 'GRADUADO':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

onMounted(() => {
  loadParents()
})

watch(schoolId, () => {
  loadParents()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 space-y-6 text-slate-800 dark:text-slate-100">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users class="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Gestión de Padres de Familia
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Consola directiva de control, filtros interactivos y seguimiento de acudientes
        </p>
      </div>
    </div>

    <!-- Metric Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acudientes Registrados</p>
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{{ totalParents }}</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Users class="w-6 h-6" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Estudiantes Vinculados</p>
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{{ totalChildrenLinked }}</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <GraduationCap class="w-6 h-6" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cuentas con Usuario Activo</p>
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{{ parentsWithAccount }}</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
          <Mail class="w-6 h-6" />
        </div>
      </div>
    </div>

    <!-- Interactive Filters Section -->
    <div class="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 flex-wrap gap-2">
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <SlidersHorizontal class="w-4 h-4 text-indigo-600" />
          Filtros Interactivos Avanzados
        </h3>
        <div class="flex items-center gap-2">
          <button
            @click="toggleSoloDocentes"
            :class="filterSoloDocentes ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 hover:border-purple-300'"
            class="flex items-center gap-1.5 px-3 py-1 border rounded-lg font-semibold text-xs transition-all cursor-pointer"
            title="Filtrar solo acudientes que también son docentes en la institución"
          >
            <span>👨‍🏫 Padres Docentes</span>
            <span v-if="filterSoloDocentes" class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          </button>
          <button
            v-if="hasActiveFilters"
            @click="resetFilters"
            class="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg transition-colors"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            Limpiar Filtros
          </button>
        </div>
      </div>

      <!-- Filters Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <!-- Search Input -->
        <div class="space-y-1 sm:col-span-2 lg:col-span-1">
          <label class="font-semibold text-slate-600 dark:text-slate-300">Buscar Acudiente</label>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="filterBusqueda"
              @input="onSearchInput"
              type="text"
              placeholder="Nombre, documento o email..."
              class="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <!-- 1. Estado de Cuenta -->
        <div class="space-y-1">
          <label class="font-semibold text-slate-600 dark:text-slate-300">Estado de Cuenta</label>
          <select
            v-model="filterEstadoCuenta"
            @change="loadParents"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Todos los usuarios</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
        </div>

        <!-- 2. Alerta del Hijo -->
        <div class="space-y-1">
          <label class="font-semibold text-slate-600 dark:text-slate-300">Alerta / Condición del Hijo</label>
          <select
            v-model="filterAlertaHijo"
            @change="loadParents"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Todas las alertas</option>
            <option value="RIESGO_ACADEMICO">⚠️ Bajo Promedio (&lt; 3.0)</option>
            <option value="ALTA_INASISTENCIA">📅 Alta Inasistencia (3+ ausencias)</option>
            <option value="CON_SANCION">🛑 Con Sanción Activa</option>
          </select>
        </div>

        <!-- 3. Nivel Escolar -->
        <div class="space-y-1">
          <label class="font-semibold text-slate-600 dark:text-slate-300">Nivel Escolar del Hijo</label>
          <select
            v-model="filterNivel"
            @change="loadParents"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los Niveles</option>
            <option v-for="n in nivelesCatalog" :key="n.id" :value="n.id">
              {{ n.nombre }}
            </option>
          </select>
        </div>

        <!-- 4. Grado Escolar -->
        <div class="space-y-1">
          <label class="font-semibold text-slate-600 dark:text-slate-300">Grado del Hijo</label>
          <select
            v-model="filterGrado"
            @change="loadParents"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los Grados</option>
            <option v-for="g in gradosCatalog" :key="g.id" :value="g.id">
              {{ g.nombre }}
            </option>
          </select>
        </div>

        <!-- 5. Cantidad de Hijos -->
        <div class="space-y-1">
          <label class="font-semibold text-slate-600 dark:text-slate-300">Cantidad de Hijos</label>
          <select
            v-model="filterCantHijos"
            @change="loadParents"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Cualquier cantidad</option>
            <option value="UN_HIJO">1 Hijo</option>
            <option value="MULTIPLES">2+ Hijos (Múltiples)</option>
            <option value="SIN_HIJOS">Sin Hijos Vinculados</option>
          </select>
        </div>

        <!-- 6. Estado de Matrícula -->
        <div class="space-y-1">
          <label class="font-semibold text-slate-600 dark:text-slate-300">Estado Matrícula del Hijo</label>
          <select
            v-model="filterEstadoMatricula"
            @change="loadParents"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVA">Matrícula Activa</option>
            <option value="CORRECCION">En Corrección / Inconsistencia</option>
            <option value="PENDIENTE">Pendiente por Aprobar</option>
            <option value="CANCELADA">Matrícula Cancelada</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-slate-500">
        Cargando padres de familia...
      </div>

      <div v-else-if="parents.length === 0" class="p-8 text-center text-slate-500 space-y-2">
        <Filter class="w-8 h-8 text-slate-400 mx-auto" />
        <p class="font-semibold">No se encontraron padres de familia con los filtros seleccionados.</p>

        <button
          v-if="hasActiveFilters"
          @click="resetFilters"
          class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 underline"
        >
          Limpiar filtros de búsqueda
        </button>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="px-6 py-3">Acudiente</th>
              <th class="px-6 py-3">Documento</th>
              <th class="px-6 py-3">Correo / Usuario</th>
              <th class="px-6 py-3 text-center">Alertas Hijos</th>
              <th class="px-6 py-3 text-center">Hijos A Cargo</th>
              <th class="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
            <tr
              v-for="parent in parents"
              :key="parent.id_padrefamilia"
              class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
              @click="openDrawer(parent.id_padrefamilia)"
            >
              <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span>{{ parent.nombre }} {{ parent.apellido }}</span>
                  <span
                    v-if="parent.es_docente"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                    title="Este acudiente también figura registrado como docente de la institución"
                  >
                    👨‍🏫 También es Docente
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 text-slate-600 dark:text-slate-300">
                <span class="text-xs text-slate-400 font-mono mr-1">{{ parent.tipo_documento || 'CC' }}</span>
                {{ parent.documento }}
              </td>
              <td class="px-6 py-4 text-slate-600 dark:text-slate-300">
                <span v-if="parent.email" class="flex items-center gap-1">
                  <Mail class="w-3.5 h-3.5 text-slate-400" />
                  {{ parent.email }}
                </span>
                <span v-else class="text-xs text-slate-400 italic">Sin usuario asignado</span>
              </td>
              <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <span
                    v-if="parent.tiene_hijo_riesgo"
                    title="Hijo en riesgo académico (promedio < 3.0)"
                    class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  >
                    ⚠️ Riesgo
                  </span>

                  <span
                    v-if="parent.tiene_hijo_inasistencias"
                    title="Hijo con inasistencias elevadas (3+ ausencias)"
                    class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                  >
                    📅 Fallas
                  </span>

                  <span
                    v-if="parent.tiene_hijo_sancionado"
                    title="Hijo con sanción activa"
                    class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  >
                    🛑 Sanción
                  </span>

                  <span
                    v-if="!parent.tiene_hijo_riesgo && !parent.tiene_hijo_inasistencias && !parent.tiene_hijo_sancionado"
                    class="text-xs text-slate-400"
                  >
                    —
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <GraduationCap class="w-3.5 h-3.5" />
                  {{ parent.hijos_count }} {{ parent.hijos_count === 1 ? 'hijo' : 'hijos' }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Ver Expediente"
                  @click.stop="openDrawer(parent.id_padrefamilia)"
                >
                  <Eye class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Drawer Panel -->
    <div v-if="drawerOpen" class="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div class="w-full max-w-xl bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        <!-- Drawer Header -->
        <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Ficha del Acudiente</h2>
            <p class="text-xs text-slate-500">Expediente completo y monitoreo de sus acudidos</p>
          </div>
          <button @click="closeDrawer" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Drawer Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div v-if="loadingDetail" class="p-8 text-center text-slate-500">
            Cargando información del acudiente...
          </div>

          <template v-else-if="selectedParentDetail">
            <!-- Parent Info Card -->
            <div class="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-5 space-y-4">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="text-xl font-bold text-slate-900 dark:text-white">
                    {{ selectedParentDetail.parent.nombre }} {{ selectedParentDetail.parent.apellido }}
                  </h3>
                  <p class="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span class="font-mono text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">
                      {{ selectedParentDetail.parent.tipo_documento }}
                    </span>
                    {{ selectedParentDetail.parent.documento }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="selectedParentDetail.parent.id_usuario && selectedParentDetail.parent.usuario_activo"
                    @click="goToParentMonitoring"
                    class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                    title="Monitorear portal del acudiente (modo vista de lectura)"
                  >
                    <Eye class="w-3.5 h-3.5" />
                    Monitorear Portal
                  </button>
                  <button
                    @click="openEditModal"
                    class="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Edit2 class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Editar
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
                <div>
                  <span class="text-slate-400 block font-medium">Correo Electrónico (Acudiente)</span>
                  <span class="text-slate-700 dark:text-slate-200 font-medium">
                    {{ selectedParentDetail.parent.email || 'No registrado' }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-slate-400 block font-medium">Estado de Cuenta</span>
                    <span
                      class="inline-block font-semibold text-xs"
                      :class="selectedParentDetail.parent.usuario_activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'"
                    >
                      {{ selectedParentDetail.parent.usuario_activo ? '● Activo' : '● Inactivo' }}
                    </span>
                  </div>
                  <button
                    v-if="selectedParentDetail.parent.id_usuario"
                    @click="toggleParentAccountStatus"
                    :disabled="togglingStatus"
                    :class="selectedParentDetail.parent.usuario_activo
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'"
                    class="flex items-center gap-1.5 px-2.5 py-1 border rounded-lg font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    :title="selectedParentDetail.parent.usuario_activo ? 'Inactivar la cuenta de usuario' : 'Activar la cuenta de usuario'"
                  >
                    <UserCheck v-if="!selectedParentDetail.parent.usuario_activo" class="w-3.5 h-3.5" />
                    <ShieldAlert v-else class="w-3.5 h-3.5" />
                    <span>{{ selectedParentDetail.parent.usuario_activo ? 'Inactivar' : 'Activar' }}</span>
                  </button>
                </div>

                <div v-if="selectedParentDetail.parent.es_docente" class="col-span-2 pt-2 border-t border-indigo-100/60 dark:border-indigo-900/50 flex items-center justify-between">
                  <div>
                    <span class="text-slate-400 block font-medium">Perfil Institucional</span>
                    <span class="text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center gap-1">
                      👨‍🏫 También es Docente de la Institución
                    </span>
                  </div>
                  <div v-if="selectedParentDetail.parent.email_docente">
                    <span class="text-slate-400 block font-medium text-right">Correo como Docente</span>
                    <span class="text-slate-700 dark:text-slate-200 font-mono text-xs">
                      {{ selectedParentDetail.parent.email_docente }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Linked Children Section -->
            <div>
              <h4 class="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <GraduationCap class="w-4 h-4 text-indigo-600" />
                Estudiantes a Cargo ({{ selectedParentDetail.children.length }})
              </h4>

              <div v-if="selectedParentDetail.children.length === 0" class="p-6 text-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                Este acudiente no tiene estudiantes vinculados actualmente.
              </div>

              <div v-else class="space-y-4">
                <div
                  v-for="child in selectedParentDetail.children"
                  :key="child.id_estudiante"
                  class="bg-white dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
                >
                  <div class="flex justify-between items-start">
                    <div>
                      <h5 class="font-bold text-slate-900 dark:text-white text-base">
                        {{ child.nombre }} {{ child.apellido }}
                      </h5>
                      <p class="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Cód: {{ child.codigo }}</span>
                        <span>•</span>
                        <span>Doc: {{ child.documento }}</span>
                      </p>
                    </div>
                    <span
                      class="px-2.5 py-0.5 text-xs font-semibold rounded-full"
                      :class="getChildStatusBadge(child.estado)"
                    >
                      {{ child.estado }}
                    </span>
                  </div>

                  <!-- Course / Academic Location -->
                  <div class="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-2.5 text-xs grid grid-cols-2 gap-2 border border-slate-100 dark:border-slate-700">
                    <div>
                      <span class="text-slate-400 block">Curso Actual</span>
                      <span class="font-semibold text-slate-700 dark:text-slate-200">
                        {{ child.grado_nombre && child.seccion_nombre ? `${child.grado_nombre} - ${child.seccion_nombre}` : 'Sin Grupo' }}
                      </span>
                    </div>
                    <div>
                      <span class="text-slate-400 block">Nivel Escolar</span>
                      <span class="font-semibold text-slate-700 dark:text-slate-200">
                        {{ child.nivel_nombre || 'Sin Nivel' }}
                      </span>
                    </div>
                  </div>

                  <!-- Child Academic Summary Stats -->
                  <div class="grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                      <span class="text-slate-500 block text-[10px]">Promedio General</span>
                      <span class="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                        {{ child.promedio !== null ? child.promedio.toFixed(2) : 'N/A' }}
                      </span>
                    </div>

                    <div class="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                      <span class="text-slate-500 block text-[10px]">Inasistencias</span>
                      <span class="text-amber-700 dark:text-amber-400 font-extrabold text-sm">
                        {{ child.inasistencias }}
                      </span>
                    </div>

                    <div class="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                      <span class="text-slate-500 block text-[10px]">Sanciones Activas</span>
                      <span class="text-rose-700 dark:text-rose-400 font-extrabold text-sm">
                        {{ child.sanciones_activas }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editModalOpen" class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl">
        <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
          <h3 class="font-bold text-lg text-slate-900 dark:text-white">Editar Datos del Acudiente</h3>
          <button @click="editModalOpen = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-4 text-sm">
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nombre</label>
            <input
              v-model="editForm.nombre"
              type="text"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Apellido</label>
            <input
              v-model="editForm.apellido"
              type="text"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tipo Doc.</label>
              <select
                v-model="editForm.id_tipodocumento"
                class="w-full px-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs"
              >
                <option v-for="td in documentTypes" :key="td.id_tipodocumento" :value="td.id_tipodocumento">
                  {{ td.tipo }}
                </option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Documento</label>
              <input
                v-model="editForm.documento"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <button
            @click="editModalOpen = false"
            class="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancelar
          </button>
          <button
            @click="saveParentEdit"
            :disabled="savingEdit"
            class="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            {{ savingEdit ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
