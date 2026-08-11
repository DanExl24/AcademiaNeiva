<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import {
  ArrowLeftRight,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  RefreshCw,
  Check,
  X,
  ChevronRight,
  Info,
  Shield,
  Filter,
  Calendar,
  BarChart3,
  Eye,
  AlertTriangle,
  History
} from 'lucide-vue-next'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const route = useRoute()

// Types
interface Aprobacion {
  id_aprobacion: number
  id_solicitud: number
  id_usuario: number
  usuario_nombre?: string
  usuario_apellido?: string
  usuario_email?: string
  rol: 'DIRECTIVO_ORIGEN' | 'DIRECTIVO_DESTINO' | 'USUARIO' | 'ADMIN_GENERAL' | 'CREADOR'
  accion: 'APROBAR' | 'RECHAZAR' | 'CANCELAR'
  comentario: string | null
  fecha: string
}

interface SolicitudTraslado {
  id_solicitud: number
  tipo: 'TRASLADO_USUARIO' | 'TRASLADO_MATRICULA'
  id_usuario: number
  usuario_nombre: string
  usuario_apellido: string
  usuario_email: string
  usuario_documento: string
  id_colegio_origen: number
  colegio_origen_nombre: string
  id_colegio_destino: number
  colegio_destino_nombre: string
  id_matricula?: number | null
  estado: 'SOLICITADA' | 'EN_APROBACION' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'EJECUTADA'
  motivo: string
  creado_por: number
  creador_nombre: string
  creador_apellido: string
  fecha_creacion: string
  fecha_finalizacion?: string | null
  aprobaciones?: Aprobacion[]
  padre?: {
    id_usuario?: number
    nombre?: string
    apellido?: string
    email?: string
  } | null
}

interface Estadisticas {
  pendientes: string
  en_proceso: string
  completados: string
  rechazados: string
  cancelados: string
  traslados_matricula: string
  traslados_usuario: string
  total: string
}

interface Colegio {
  id_colegio: number
  nombre: string
}

// State
const solicitudes = ref<SolicitudTraslado[]>([])
const estadisticas = ref<Estadisticas | null>(null)
const colegios = ref<Colegio[]>([])
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Active section
const activeSection = ref<'listado' | 'estadisticas'>('listado')

// Detail modal
const showDetailModal = ref(false)
const selectedSolicitud = ref<SolicitudTraslado | null>(null)
const loadingDetail = ref(false)

// Intervention modal
const showIntervencionModal = ref(false)
const intervencionSolicitud = ref<SolicitudTraslado | null>(null)
const intervencionForm = ref({
  accion: 'CANCELAR' as 'CANCELAR' | 'RECHAZAR',
  motivo: ''
})

// Filters
const searchQuery = ref('')
const filterEstado = ref('ALL')
const filterTipo = ref('ALL')
const filterOrigenId = ref<number | null>(null)
const filterDestinoId = ref<number | null>(null)
const filterFechaDesde = ref('')
const filterFechaHasta = ref('')

onMounted(async () => {
  await Promise.all([
    fetchSolicitudes(),
    fetchEstadisticas(),
    fetchColegios()
  ])

  if (route.query.id) {
    const targetId = Number(route.query.id)
    if (!isNaN(targetId)) {
      const found = solicitudes.value.find(s => Number(s.id_solicitud) === targetId)
      if (found) {
        await openDetailModal(found)
      } else {
        await openDetailModal({ id_solicitud: targetId } as any)
      }
    }
  }
})

watch(() => yearStore.selectedYearId, () => {
  fetchSolicitudes()
  fetchEstadisticas()
})

const fetchSolicitudes = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const params: Record<string, string> = {}
    if (yearStore.selectedYearId) params.yearId = String(yearStore.selectedYearId)
    if (filterEstado.value !== 'ALL') params.estado = filterEstado.value
    if (filterTipo.value !== 'ALL') params.tipo = filterTipo.value
    if (filterOrigenId.value) params.id_colegio_origen = String(filterOrigenId.value)
    if (filterDestinoId.value) params.id_colegio_destino = String(filterDestinoId.value)
    if (filterFechaDesde.value) params.fecha_desde = filterFechaDesde.value
    if (filterFechaHasta.value) params.fecha_hasta = filterFechaHasta.value

    const res = await axios.get(`${API_BASE_URL}/api/traslados/admin/global`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      params
    })
    solicitudes.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching traslados globales:', err)
    errorMessage.value = err.response?.data?.error || 'Error al cargar los traslados del sistema'
  } finally {
    loading.value = false
  }
}

const fetchEstadisticas = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/admin/estadisticas`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    estadisticas.value = res.data
  } catch (err: any) {
    console.error('Error fetching estadisticas:', err)
  }
}

const fetchColegios = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/colegios`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    colegios.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching colegios:', err)
  }
}

const applyFilters = async () => {
  await fetchSolicitudes()
}

const resetFilters = () => {
  filterEstado.value = 'ALL'
  filterTipo.value = 'ALL'
  filterOrigenId.value = null
  filterDestinoId.value = null
  filterFechaDesde.value = ''
  filterFechaHasta.value = ''
  fetchSolicitudes()
}

const openDetailModal = async (sol: SolicitudTraslado) => {
  selectedSolicitud.value = null
  showDetailModal.value = true
  loadingDetail.value = true
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/${sol.id_solicitud}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    selectedSolicitud.value = res.data
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al cargar detalle')
    showDetailModal.value = false
  } finally {
    loadingDetail.value = false
  }
}

const openIntervencion = (sol: SolicitudTraslado) => {
  intervencionSolicitud.value = sol
  intervencionForm.value = { accion: 'CANCELAR', motivo: '' }
  showIntervencionModal.value = true
}

const handleIntervencion = async () => {
  if (!intervencionSolicitud.value) return
  if (!intervencionForm.value.motivo.trim() || intervencionForm.value.motivo.trim().length < 10) {
    alert('El motivo de intervención debe tener al menos 10 caracteres.')
    return
  }

  if (!confirm(`¿Confirmas que deseas ${intervencionForm.value.accion.toLowerCase()} esta solicitud por intervención administrativa? Esta acción quedará registrada en el historial de auditoría.`)) return

  submitting.value = true
  try {
    await axios.post(
      `${API_BASE_URL}/api/traslados/${intervencionSolicitud.value.id_solicitud}/intervencion`,
      intervencionForm.value,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )

    successMessage.value = 'Intervención administrativa registrada exitosamente en el historial de auditoría.'
    setTimeout(() => successMessage.value = '', 5000)

    showIntervencionModal.value = false
    if (showDetailModal.value && selectedSolicitud.value?.id_solicitud === intervencionSolicitud.value.id_solicitud) {
      await openDetailModal(intervencionSolicitud.value)
    }
    await Promise.all([fetchSolicitudes(), fetchEstadisticas()])
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al registrar la intervención')
  } finally {
    submitting.value = false
  }
}

// Computed filters on client side (for search text)
const filteredSolicitudes = computed(() => {
  if (!searchQuery.value.trim()) return solicitudes.value
  const q = searchQuery.value.toLowerCase()
  return solicitudes.value.filter(s => {
    const name = `${s.usuario_nombre || ''} ${s.usuario_apellido || ''}`.toLowerCase()
    return (
      name.includes(q) ||
      (s.usuario_documento || '').toLowerCase().includes(q) ||
      (s.colegio_origen_nombre || '').toLowerCase().includes(q) ||
      (s.colegio_destino_nombre || '').toLowerCase().includes(q)
    )
  })
})

// Approval panel: for a given solicitud, which roles have approved / pending
const getApprovalMatrix = (sol: SolicitudTraslado) => {
  const aprobaciones = sol.aprobaciones || []
  const adminAprobacion = aprobaciones.find(a => a.rol === 'ADMIN_GENERAL' && a.accion === 'APROBAR')
  
  const origenAprobacion = aprobaciones.find(a => a.rol === 'DIRECTIVO_ORIGEN' && a.accion === 'APROBAR')
  const destinoAprobacion = aprobaciones.find(a => a.rol === 'DIRECTIVO_DESTINO' && a.accion === 'APROBAR')
  const usuarioAprobacion = aprobaciones.find(a => a.rol === 'USUARIO' && a.accion === 'APROBAR')

  let entidadPadre = sol.tipo === 'TRASLADO_MATRICULA'
    ? (sol.padre ? `${sol.padre.nombre || ''} ${sol.padre.apellido || ''}`.trim() : `Acudiente Legal de ${sol.usuario_nombre}`)
    : `${sol.usuario_nombre} ${sol.usuario_apellido}`

  return [
    {
      rol: 'DIRECTIVO_ORIGEN',
      label: 'Directivo Institución Origen',
      entidad: sol.colegio_origen_nombre,
      aprobacion: origenAprobacion || adminAprobacion,
      esBypassAdmin: !origenAprobacion && !!adminAprobacion
    },
    {
      rol: 'DIRECTIVO_DESTINO',
      label: 'Directivo Institución Destino',
      entidad: sol.colegio_destino_nombre,
      aprobacion: destinoAprobacion || adminAprobacion,
      esBypassAdmin: !destinoAprobacion && !!adminAprobacion
    },
    {
      rol: 'USUARIO',
      label: sol.tipo === 'TRASLADO_MATRICULA' ? 'Padre de Familia / Acudiente Legal' : 'Usuario Afectado',
      entidad: entidadPadre,
      aprobacion: usuarioAprobacion || adminAprobacion,
      esBypassAdmin: !usuarioAprobacion && !!adminAprobacion
    }
  ]
}

const getRolLabel = (rol: string, tipo?: string) => {
  const map: Record<string, string> = {
    DIRECTIVO_ORIGEN: 'Directivo Institución Origen',
    DIRECTIVO_DESTINO: 'Directivo Institución Destino',
    USUARIO: tipo === 'TRASLADO_MATRICULA' ? 'Padre de Familia / Usuario' : 'Usuario Afectado',
    ADMIN_GENERAL: 'Administrador General',
    CREADOR: 'Creador de Solicitud'
  }
  return map[rol] || rol
}

// Helpers
const getStatusBadge = (estado: string) => {
  switch (estado) {
    case 'EN_APROBACION':
    case 'SOLICITADA':
      return { label: 'En Aprobación', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', icon: Clock }
    case 'EJECUTADA':
    case 'APROBADA':
      return { label: estado === 'EJECUTADA' ? 'Ejecutada' : 'Aprobada', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 }
    case 'RECHAZADA':
      return { label: 'Rechazada', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300', icon: XCircle }
    case 'CANCELADA':
      return { label: 'Cancelada', bg: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: AlertCircle }
    default:
      return { label: estado, bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300', icon: Info }
  }
}

const canIntervene = (sol: SolicitudTraslado) => !['RECHAZADA', 'CANCELADA', 'EJECUTADA'].includes(sol.estado)

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="space-y-6 p-4 md:p-8 max-w-full mx-auto">

    <!-- ══════ HEADER ══════ -->
    <div class="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="p-3.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-violet-500/25">
          <ArrowLeftRight :size="24" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Gestión de Traslados</h1>
            <span class="px-2.5 py-0.5 bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 rounded-full text-[10px] font-black uppercase tracking-wider">Admin General</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Supervisión global de traslados interinstitucionales. Historial, auditoría e intervención excepcional.</p>
        </div>
      </div>
      <button
        @click="() => { fetchSolicitudes(); fetchEstadisticas() }"
        class="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        title="Actualizar datos"
      >
        <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Feedback -->
    <div v-if="successMessage" class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center gap-3">
      <CheckCircle2 :size="20" /><span>{{ successMessage }}</span>
    </div>
    <div v-if="errorMessage" class="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-700 dark:text-rose-400 font-bold text-sm flex items-center gap-3">
      <AlertCircle :size="20" /><span>{{ errorMessage }}</span>
    </div>

    <!-- ══════ SECTION TABS ══════ -->
    <div class="flex items-center gap-2">
      <button
        v-for="tab in [{ key: 'listado', label: 'Listado de Traslados', icon: ArrowLeftRight }, { key: 'estadisticas', label: 'Panel de Métricas', icon: BarChart3 }]"
        :key="tab.key"
        @click="activeSection = tab.key as any"
        :class="[
          'flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all',
          activeSection === tab.key
            ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
      >
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- ══════════════════════════════════════════════ -->
    <!-- SECTION 1: LISTADO                            -->
    <!-- ══════════════════════════════════════════════ -->
    <div v-if="activeSection === 'listado'" class="space-y-5">

      <!-- Filters Panel -->
      <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Filter :size="16" />
            <span class="text-xs font-black uppercase tracking-wider">Filtros Avanzados</span>
          </div>
          <button @click="resetFilters" class="text-xs text-slate-400 hover:text-violet-500 font-bold transition-colors">
            Limpiar filtros
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <!-- Search -->
          <div class="relative col-span-1 sm:col-span-2 xl:col-span-1">
            <Search :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por persona, doc. o institución..."
              class="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-white"
            />
          </div>

          <!-- Estado -->
          <select v-model="filterEstado" class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="ALL">Todos los Estados</option>
            <option value="SOLICITADA">Solicitada</option>
            <option value="EN_APROBACION">En Aprobación</option>
            <option value="EJECUTADA">Ejecutada</option>
            <option value="APROBADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>

          <!-- Tipo -->
          <select v-model="filterTipo" class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="ALL">Todos los Tipos</option>
            <option value="TRASLADO_MATRICULA">Traslado de Matrícula</option>
            <option value="TRASLADO_USUARIO">Traslado de Usuario</option>
          </select>

          <!-- Colegio Origen -->
          <select v-model="filterOrigenId" class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option :value="null">Cualquier Origen</option>
            <option v-for="c in colegios" :key="c.id_colegio" :value="c.id_colegio">{{ c.nombre }}</option>
          </select>

          <!-- Colegio Destino -->
          <select v-model="filterDestinoId" class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option :value="null">Cualquier Destino</option>
            <option v-for="c in colegios" :key="c.id_colegio" :value="c.id_colegio">{{ c.nombre }}</option>
          </select>

          <!-- Fecha Desde -->
          <div class="relative">
            <Calendar :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input v-model="filterFechaDesde" type="date" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-300" />
          </div>

          <!-- Fecha Hasta -->
          <div class="relative">
            <Calendar :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input v-model="filterFechaHasta" type="date" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-300" />
          </div>

          <!-- Apply Filters Button -->
          <button @click="applyFilters" class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 col-span-1">
            <Search :size="14" />
            <span>Aplicar Filtros</span>
          </button>
        </div>
      </div>

      <!-- Results count -->
      <div class="flex items-center justify-between px-1">
        <p class="text-xs font-bold text-slate-500 dark:text-slate-400">
          Mostrando <span class="text-violet-600 dark:text-violet-400">{{ filteredSolicitudes.length }}</span> de {{ solicitudes.length }} solicitudes
        </p>
      </div>

      <!-- TABLE -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl overflow-hidden">
        <div v-if="loading" class="p-12 text-center space-y-3">
          <RefreshCw :size="28" class="animate-spin mx-auto text-violet-500" />
          <p class="text-xs font-semibold text-slate-400">Cargando traslados del sistema...</p>
        </div>

        <div v-else-if="filteredSolicitudes.length === 0" class="p-12 text-center space-y-3">
          <Info :size="32" class="mx-auto text-slate-300 dark:text-slate-700" />
          <p class="text-sm font-bold text-slate-600 dark:text-slate-300">No se encontraron solicitudes</p>
          <p class="text-xs text-slate-400">Intenta ajustar los filtros de búsqueda.</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-slate-400 font-black uppercase tracking-wider">
                <th class="py-3.5 px-5">ID / Tipo</th>
                <th class="py-3.5 px-5">Persona Afectada</th>
                <th class="py-3.5 px-5">Origen ➔ Destino</th>
                <th class="py-3.5 px-5">Estado</th>
                <th class="py-3.5 px-5">Fecha</th>
                <th class="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
              <tr
                v-for="sol in filteredSolicitudes"
                :key="sol.id_solicitud"
                class="hover:bg-violet-50/30 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td class="py-4 px-5">
                  <span class="font-mono text-slate-400 text-[11px]">#{{ sol.id_solicitud }}</span>
                  <div class="mt-1">
                    <span :class="[
                      'px-2 py-0.5 rounded-full text-[10px] font-black uppercase',
                      sol.tipo === 'TRASLADO_MATRICULA' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                    ]">{{ sol.tipo === 'TRASLADO_MATRICULA' ? 'Matrícula' : 'Usuario' }}</span>
                  </div>
                </td>

                <td class="py-4 px-5">
                  <p class="font-bold text-slate-900 dark:text-white">{{ sol.usuario_nombre }} {{ sol.usuario_apellido }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">{{ sol.usuario_email }}</p>
                  <p class="text-[10px] font-mono text-slate-400">Doc: {{ sol.usuario_documento || 'S/D' }}</p>
                </td>

                <td class="py-4 px-5">
                  <div class="space-y-1">
                    <div class="flex items-center gap-1.5 text-xs">
                      <Building2 :size="12" class="text-slate-400 shrink-0" />
                      <span class="font-semibold text-slate-600 dark:text-slate-300">{{ sol.colegio_origen_nombre }}</span>
                    </div>
                    <ChevronRight :size="14" class="text-slate-300 dark:text-slate-600 ml-1" />
                    <div class="flex items-center gap-1.5 text-xs">
                      <Building2 :size="12" class="text-violet-500 shrink-0" />
                      <span class="font-bold text-violet-600 dark:text-violet-400">{{ sol.colegio_destino_nombre }}</span>
                    </div>
                  </div>
                </td>

                <td class="py-4 px-5">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" :class="getStatusBadge(sol.estado).bg">
                    <component :is="getStatusBadge(sol.estado).icon" :size="12" />
                    {{ getStatusBadge(sol.estado).label }}
                  </div>
                </td>

                <td class="py-4 px-5 text-slate-500 dark:text-slate-400 text-[11px]">
                  {{ formatDate(sol.fecha_creacion) }}
                  <p v-if="sol.fecha_finalizacion" class="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Fin: {{ formatDate(sol.fecha_finalizacion) }}
                  </p>
                </td>

                <td class="py-4 px-5">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="openDetailModal(sol)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-xl font-bold text-[11px] transition-all"
                    >
                      <Eye :size="13" />
                      <span>Detalle</span>
                    </button>
                    <button
                      v-if="canIntervene(sol)"
                      @click="openIntervencion(sol)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl font-bold text-[11px] transition-all"
                    >
                      <AlertTriangle :size="13" />
                      <span>Intervenir</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ -->
    <!-- SECTION 2: ESTADÍSTICAS / PANEL DE MÉTRICAS  -->
    <!-- ══════════════════════════════════════════════ -->
    <div v-if="activeSection === 'estadisticas'" class="space-y-6">
      <div v-if="!estadisticas" class="p-12 text-center">
        <RefreshCw :size="24" class="animate-spin mx-auto text-violet-500 mb-2" />
        <p class="text-xs text-slate-400">Cargando métricas...</p>
      </div>

      <div v-else class="space-y-6">
        <!-- Por Estado -->
        <div>
          <h2 class="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Traslados por Estado</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div v-for="(stat, key) in [
              { label: 'Pendientes', value: estadisticas.pendientes, color: 'amber', icon: Clock },
              { label: 'En Proceso', value: estadisticas.en_proceso, color: 'blue', icon: RefreshCw },
              { label: 'Completados', value: estadisticas.completados, color: 'emerald', icon: CheckCircle2 },
              { label: 'Rechazados', value: estadisticas.rechazados, color: 'rose', icon: XCircle },
              { label: 'Cancelados', value: estadisticas.cancelados, color: 'slate', icon: AlertCircle },
            ]" :key="key" class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{{ stat.label }}</p>
                <div :class="`p-2 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-600 dark:text-${stat.color}-400`">
                  <component :is="stat.icon" :size="16" />
                </div>
              </div>
              <p class="text-3xl font-black text-slate-800 dark:text-white">{{ stat.value }}</p>
            </div>
          </div>
        </div>

        <!-- Por Tipo -->
        <div>
          <h2 class="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Traslados por Tipo</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm text-center">
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Global</p>
              <p class="text-4xl font-black text-violet-600 dark:text-violet-400">{{ estadisticas.total }}</p>
            </div>
            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm text-center">
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Traslados de Matrícula</p>
              <p class="text-4xl font-black text-indigo-600 dark:text-indigo-400">{{ estadisticas.traslados_matricula }}</p>
              <p class="text-xs text-slate-400 mt-1">Estudiantes entre instituciones</p>
            </div>
            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm text-center">
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Traslados de Usuario</p>
              <p class="text-4xl font-black text-purple-600 dark:text-purple-400">{{ estadisticas.traslados_usuario }}</p>
              <p class="text-xs text-slate-400 mt-1">Personal entre instituciones</p>
            </div>
          </div>
        </div>

        <!-- Restricciones Info -->
        <div class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle :size="20" class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div class="text-xs text-amber-800 dark:text-amber-300">
            <p class="font-black mb-1.5 text-sm">Principios de Funcionamiento del Admin General</p>
            <ul class="space-y-1 font-medium text-amber-700 dark:text-amber-400">
              <li>• Puede visualizar traslados de <strong>todas las instituciones</strong> del sistema.</li>
              <li>• Puede consultar el historial y auditoría completa de cada solicitud.</li>
              <li>• Puede <strong>intervenir excepcionalmente</strong> (cancelar/rechazar) con motivo obligatorio registrado en auditoría.</li>
              <li>• <strong>No reemplaza</strong> las aprobaciones de directivos, padres o usuarios afectados.</li>
              <li>• <strong>No puede eliminar</strong> registros históricos ni modificar manualmente el historial.</li>
              <li>• Toda intervención queda <strong>trazada con fecha, hora y motivo</strong>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ -->
    <!-- MODAL: DETALLE Y AUDITORÍA                    -->
    <!-- ══════════════════════════════════════════════ -->
    <div v-if="showDetailModal" class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl max-h-[92vh] overflow-y-auto">

        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-3xl">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl">
              <History :size="18" />
            </div>
            <div>
              <h2 class="text-base font-black text-slate-900 dark:text-white">
                Detalle de Solicitud #{{ selectedSolicitud?.id_solicitud }}
              </h2>
              <p class="text-[11px] text-slate-400">Historial completo de auditoría</p>
            </div>
          </div>
          <button @click="showDetailModal = false" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div v-if="loadingDetail" class="p-12 text-center">
          <RefreshCw :size="24" class="animate-spin mx-auto text-violet-500 mb-2" />
          <p class="text-xs text-slate-400">Cargando información...</p>
        </div>

        <div v-else-if="selectedSolicitud" class="p-6 space-y-5">

          <!-- Info grid -->
          <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
            <div>
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Persona Afectada</p>
              <p class="font-bold text-slate-900 dark:text-white">{{ selectedSolicitud.usuario_nombre }} {{ selectedSolicitud.usuario_apellido }}</p>
              <p class="text-[11px] text-slate-500">{{ selectedSolicitud.usuario_email }}</p>
              <p class="text-[11px] font-mono text-slate-400">Doc: {{ selectedSolicitud.usuario_documento }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Estado Actual</p>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mt-0.5" :class="getStatusBadge(selectedSolicitud.estado).bg">
                <component :is="getStatusBadge(selectedSolicitud.estado).icon" :size="12" />
                {{ getStatusBadge(selectedSolicitud.estado).label }}
              </div>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Institución Origen</p>
              <p class="font-bold text-slate-700 dark:text-slate-300">{{ selectedSolicitud.colegio_origen_nombre }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Institución Destino</p>
              <p class="font-bold text-violet-600 dark:text-violet-400">{{ selectedSolicitud.colegio_destino_nombre }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Tipo</p>
              <p class="font-bold text-slate-700 dark:text-slate-300">{{ selectedSolicitud.tipo === 'TRASLADO_MATRICULA' ? 'Traslado de Matrícula' : 'Traslado de Usuario' }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Creado por</p>
              <p class="font-bold text-slate-700 dark:text-slate-300">{{ selectedSolicitud.creador_nombre }} {{ selectedSolicitud.creador_apellido }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Motivo</p>
              <p class="font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">{{ selectedSolicitud.motivo }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Fecha Creación</p>
              <p class="font-semibold text-slate-600 dark:text-slate-300">{{ formatDate(selectedSolicitud.fecha_creacion) }}</p>
            </div>
            <div v-if="selectedSolicitud.fecha_finalizacion">
              <p class="text-[10px] font-black uppercase text-slate-400 mb-0.5">Fecha Finalización</p>
              <p class="font-semibold text-emerald-600 dark:text-emerald-400">{{ formatDate(selectedSolicitud.fecha_finalizacion) }}</p>
            </div>
          </div>

          <!-- Approval Matrix Panel -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-black uppercase text-slate-400 tracking-wider">Estado de Aprobaciones Requeridas (Consenso)</h3>
              <span class="text-[10px] font-bold text-slate-400">3 Votos Requeridos</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                v-for="item in getApprovalMatrix(selectedSolicitud)"
                :key="item.rol"
                :class="[
                  'p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2',
                  item.aprobacion
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40'
                ]"
              >
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">{{ item.label }}</span>
                    <span :class="[
                      'px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1',
                      item.aprobacion
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                    ]">
                      <CheckCircle2 v-if="item.aprobacion" :size="10" />
                      <Clock v-else :size="10" />
                      <span>{{ item.aprobacion ? 'Aprobado' : 'Pendiente' }}</span>
                    </span>
                  </div>
                  <p class="font-bold text-slate-800 dark:text-white text-xs truncate" :title="item.entidad">{{ item.entidad }}</p>
                </div>

                <div class="text-[10px] pt-2 border-t border-slate-200/50 dark:border-slate-800">
                  <template v-if="item.aprobacion">
                    <p class="text-emerald-700 dark:text-emerald-400 font-bold truncate">
                      ✓ {{ item.aprobacion.usuario_nombre }} {{ item.aprobacion.usuario_apellido }}
                    </p>
                    <p class="text-slate-400 font-mono text-[9px] mt-0.5">{{ formatDate(item.aprobacion.fecha) }}</p>
                  </template>
                  <template v-else>
                    <p class="text-amber-700 dark:text-amber-400 font-semibold italic">
                      ⏳ Pendiente por aprobar
                    </p>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Audit Timeline -->
          <div>
            <h3 class="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-2">
              Historial de Auditoría ({{ selectedSolicitud.aprobaciones?.length || 0 }} acciones)
            </h3>

            <div v-if="!selectedSolicitud.aprobaciones?.length" class="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
              No hay acciones registradas aún.
            </div>

            <div v-else class="relative space-y-0">
              <!-- Timeline connector -->
              <div class="absolute left-5 top-5 bottom-5 w-px bg-slate-200 dark:bg-slate-700/60 z-0"></div>

              <div
                v-for="ap in selectedSolicitud.aprobaciones"
                :key="ap.id_aprobacion"
                class="relative flex items-start gap-4 pb-4"
              >
                <!-- Timeline dot -->
                <div :class="[
                  'z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm',
                  ap.accion === 'APROBAR' ? 'bg-emerald-500' : ap.accion === 'RECHAZAR' ? 'bg-rose-500' : 'bg-slate-400'
                ]">
                  <Check v-if="ap.accion === 'APROBAR'" :size="16" />
                  <X v-else-if="ap.accion === 'RECHAZAR'" :size="16" />
                  <AlertCircle v-else :size="16" />
                </div>

                <!-- Content -->
                <div class="flex-1 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 text-xs">
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                      <span class="font-black text-slate-900 dark:text-white">{{ ap.usuario_nombre }} {{ ap.usuario_apellido }}</span>
                      <span v-if="ap.rol.includes('INTERVENCION') || ap.comentario?.startsWith('[INTERVENCIÓN')" class="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-full text-[9px] font-black uppercase">Intervención Admin</span>
                      <span v-else class="px-2 py-0.5 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-full text-[9px] font-black uppercase">{{ getRolLabel(ap.rol, selectedSolicitud?.tipo) }}</span>
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono shrink-0">{{ formatDate(ap.fecha) }}</span>
                  </div>
                  <p v-if="ap.comentario" :class="[
                    'italic font-normal mt-1',
                    ap.comentario.startsWith('[INTERVENCIÓN') ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                  ]">
                    "{{ ap.comentario }}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Admin Intervention CTA -->
          <div v-if="canIntervene(selectedSolicitud)" class="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div class="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40 rounded-2xl">
              <AlertTriangle :size="18" class="text-rose-600 dark:text-rose-400 shrink-0" />
              <div class="flex-1 text-xs">
                <p class="font-black text-rose-800 dark:text-rose-300">Intervención Administrativa Excepcional</p>
                <p class="text-rose-600 dark:text-rose-400 font-medium mt-0.5">Usar solo en situaciones excepcionales. Toda intervención queda registrada.</p>
              </div>
              <button
                @click="() => { showDetailModal = false; openIntervencion(selectedSolicitud!) }"
                class="shrink-0 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                Intervenir
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════ -->
    <!-- MODAL: INTERVENCIÓN ADMINISTRATIVA            -->
    <!-- ══════════════════════════════════════════════ -->
    <div v-if="showIntervencionModal && intervencionSolicitud" class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl">

        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <Shield :size="20" />
            </div>
            <div>
              <h2 class="text-base font-black text-slate-900 dark:text-white">Intervención Administrativa</h2>
              <p class="text-[11px] text-slate-400">Solicitud #{{ intervencionSolicitud.id_solicitud }} — {{ intervencionSolicitud.usuario_nombre }} {{ intervencionSolicitud.usuario_apellido }}</p>
            </div>
          </div>
          <button @click="showIntervencionModal = false" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X :size="18" />
          </button>
        </div>

        <!-- Warning notice -->
        <div class="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p class="font-black flex items-center gap-1.5"><AlertTriangle :size="14" /> Advertencia</p>
          <p class="font-medium">Esta intervención quedará registrada permanentemente en el historial de auditoría. Solo úsala en situaciones excepcionales que lo justifiquen.</p>
        </div>

        <!-- Form -->
        <div class="space-y-4 text-xs">
          <div>
            <label class="block font-black text-slate-700 dark:text-slate-300 mb-1.5">Tipo de Intervención</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="opt in [{ value: 'CANCELAR', label: 'Cancelar Solicitud' }, { value: 'RECHAZAR', label: 'Rechazar Solicitud' }]"
                :key="opt.value"
                @click="intervencionForm.accion = opt.value as any"
                :class="[
                  'py-3 px-4 rounded-xl border-2 font-bold transition-all text-center',
                  intervencionForm.accion === opt.value
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-rose-300'
                ]"
              >{{ opt.label }}</button>
            </div>
          </div>

          <div>
            <label class="block font-black text-slate-700 dark:text-slate-300 mb-1.5">
              Motivo de la Intervención <span class="text-rose-500">*</span>
              <span class="text-slate-400 font-medium ml-1">(mín. 10 caracteres)</span>
            </label>
            <textarea
              v-model="intervencionForm.motivo"
              rows="4"
              placeholder="Describe detalladamente el motivo de esta intervención administrativa..."
              :class="[
                'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-white resize-none',
                intervencionForm.motivo.trim().length > 0 && intervencionForm.motivo.trim().length < 10
                  ? 'border-rose-400 dark:border-rose-600'
                  : 'border-slate-200 dark:border-slate-700'
              ]"
            ></textarea>
            <p class="mt-1 text-right text-[10px] font-medium" :class="intervencionForm.motivo.trim().length >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'">
              {{ intervencionForm.motivo.trim().length }} / mín. 10 caracteres
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            @click="showIntervencionModal = false"
            class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
          <button
            @click="handleIntervencion"
            :disabled="submitting || intervencionForm.motivo.trim().length < 10"
            class="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-2"
          >
            <Shield :size="14" />
            {{ submitting ? 'Registrando...' : `Confirmar Intervención (${intervencionForm.accion})` }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
