<script setup lang="ts">
import { ref, computed, onMounted, watch }  from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { 
  ArrowLeftRight, 
  Search, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Building2, 
  RefreshCw,
  Building,
  Check,
  X,
  ChevronRight,
  Info,
  ClipboardList
} from 'lucide-vue-next'
import DatosAcademicosTrasladoModal from '../../components/traslados/DatosAcademicosTrasladoModal.vue'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const route = useRoute()

const showAcademicDataModal = ref(false)
const academicTargetId = ref<number | null>(null)

// Types & Interfaces
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

interface Vinculacion {
  id_usuario_colegio: number
  id_usuario: number
  id_colegio: number
  colegio_nombre: string
  escudo_url?: string | null
  rol_nombre: string
  estado: 'ACTIVO' | 'INACTIVO'
  fecha_inicio: string
  fecha_fin?: string | null
}

interface Colegio {
  id_colegio: number
  nombre: string
  logo_url?: string
}

interface EstudianteOption {
  id_estudiante: number
  id_usuario: number
  nombre: string
  apellido: string
  documento?: string
  codigo?: string
  grado?: string
  seccion?: string
  matricula_id?: number | null
}

// Active Tab
const activeTab = ref<'solicitudes' | 'vinculaciones'>('solicitudes')

// Data State
const solicitudes = ref<SolicitudTraslado[]>([])
const vinculaciones = ref<Vinculacion[]>([])
const colegios = ref<Colegio[]>([])
const estudiantesColegio = ref<EstudianteOption[]>([])
const personalColegio = ref<{ id_usuario: number; nombre: string; apellido: string; email: string; documento?: string; rol_nombre: string }[]>([])
const directivosColegio = ref<{ id_usuario: number; nombre: string; apellido: string; email: string; documento?: string; rol_nombre: string }[]>([])

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Filters
const searchQuery = ref('')
const selectedStatusFilter = ref<string>('ALL')
const selectedTypeFilter = ref<string>('ALL')

// Modals
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const selectedSolicitud = ref<SolicitudTraslado | null>(null)

// Create Form Data
const newTraslado = ref({
  tipo: 'TRASLADO_MATRICULA' as 'TRASLADO_MATRICULA' | 'TRASLADO_USUARIO' | 'TRASLADO_DIRECTIVO',
  id_usuario: null as number | null,
  id_colegio_origen: auth.user?.schoolId || 1,
  id_colegio_destino: null as number | null,
  id_matricula: null as number | null,
  motivo: ''
})

// Computed
const isAdminGeneral = computed(() => !!(auth.user?.roles?.includes('admin_general')))

// Approval Form Data
const approvalForm = ref({
  accion: 'APROBAR' as 'APROBAR' | 'RECHAZAR' | 'CANCELAR',
  comentario: ''
})

// Fetch Data on Mount
onMounted(async () => {
  await Promise.all([
    fetchSolicitudes(),
    fetchVinculaciones(),
    fetchColegios(),
    fetchEstudiantes(),
    fetchPersonalColegio(),
    fetchDirectivosColegio()
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

const fetchSolicitudes = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const params: Record<string, any> = {}
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const res = await axios.get(`${API_BASE_URL}/api/traslados`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      params
    })
    solicitudes.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching solicitudes de traslado:', err)
    errorMessage.value = err.response?.data?.error || 'Error al cargar las solicitudes de traslado'
  } finally {
    loading.value = false
  }
}

const fetchVinculaciones = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/mis-vinculaciones`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    vinculaciones.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching vinculaciones:', err)
  }
}

const fetchColegios = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/matriculas`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    colegios.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching colegios:', err)
  }
}

const fetchEstudiantes = async () => {
  const schoolId = auth.user?.schoolId ? Number(auth.user.schoolId) : 1
  await fetchEstudiantesByColegio(schoolId)
}

const fetchPersonalColegio = async (schoolId?: number) => {
  const sid = schoolId || (auth.user?.schoolId ? Number(auth.user.schoolId) : 1)
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/personal/${sid}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    personalColegio.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching personal colegio:', err)
  }
}

const fetchDirectivosColegio = async (schoolId?: number) => {
  if (!isAdminGeneral.value) return
  const sid = schoolId || (auth.user?.schoolId ? Number(auth.user.schoolId) : 1)
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/directivos/${sid}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    directivosColegio.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching directivos colegio:', err)
  }
}

const fetchEstudiantesByColegio = async (schoolId: number) => {
  try {
    const params: Record<string, any> = {
      estado: 'ACTIVO'
    }
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const res = await axios.get(`${API_BASE_URL}/api/student/colegio/${schoolId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      params
    })
    estudiantesColegio.value = res.data || []
  } catch (err: any) {
    console.error('Error fetching estudiantes by colegio:', err)
  }
}

// Watch año lectivo seleccionado para refrescar las solicitudes y estudiantes
watch(() => yearStore.selectedYearId, () => {
  fetchSolicitudes()
  const sid = newTraslado.value.id_colegio_origen ? Number(newTraslado.value.id_colegio_origen) : (auth.user?.schoolId ? Number(auth.user.schoolId) : 1)
  fetchEstudiantesByColegio(sid)
})

// Watch el tipo de traslado: limpiar selección al cambiar
watch(() => newTraslado.value.tipo, () => {
  newTraslado.value.id_usuario = null
  newTraslado.value.id_matricula = null
})

// Watch colegio_origen: recargar personal/directivos según la institución elegida
watch(() => newTraslado.value.id_colegio_origen, (newId) => {
  newTraslado.value.id_usuario = null
  newTraslado.value.id_matricula = null
  const sid = newId ? Number(newId) : undefined
  if (sid) {
    fetchPersonalColegio(sid)
    fetchDirectivosColegio(sid)
    fetchEstudiantesByColegio(sid)
  }
})

// Auto-asignar id_matricula cuando se selecciona un estudiante para TRASLADO_MATRICULA
watch(() => newTraslado.value.id_usuario, (newUserId) => {
  if (newTraslado.value.tipo === 'TRASLADO_MATRICULA' && newUserId) {
    const est = estudiantesColegio.value.find(e => e.id_usuario === newUserId)
    if (est && est.matricula_id) {
      newTraslado.value.id_matricula = est.matricula_id
    } else {
      newTraslado.value.id_matricula = null
    }
  } else {
    newTraslado.value.id_matricula = null
  }
})

const openDetailModal = async (solicitud: SolicitudTraslado) => {
  selectedSolicitud.value = null
  approvalForm.value = { accion: 'APROBAR', comentario: '' }
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/${solicitud.id_solicitud}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    selectedSolicitud.value = res.data
    showDetailModal.value = true
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al cargar detalle de solicitud')
  }
}

const openCreateModal = () => {
  const originSchoolId = auth.selectedSchoolId || (auth.user?.schoolId ? Number(auth.user.schoolId) : (colegios.value[0]?.id_colegio || 1))
  newTraslado.value = {
    tipo: 'TRASLADO_MATRICULA',
    id_usuario: null,
    id_colegio_origen: originSchoolId,
    id_colegio_destino: null,
    id_matricula: null,
    motivo: ''
  }
  if (originSchoolId) {
    fetchPersonalColegio(originSchoolId)
    fetchDirectivosColegio(originSchoolId)
    fetchEstudiantesByColegio(originSchoolId)
  }
  showCreateModal.value = true
}

const handleCreateTraslado = async () => {
  const idUser = newTraslado.value.id_usuario ? Number(newTraslado.value.id_usuario) : null
  const idOrigen = newTraslado.value.id_colegio_origen ? Number(newTraslado.value.id_colegio_origen) : null
  const idDestino = newTraslado.value.id_colegio_destino ? Number(newTraslado.value.id_colegio_destino) : null
  const motivoTxt = newTraslado.value.motivo ? newTraslado.value.motivo.trim() : ''

  if (!idUser || !idOrigen || !idDestino || !motivoTxt || isNaN(idUser) || isNaN(idOrigen) || isNaN(idDestino)) {
    alert('Por favor completa todos los campos requeridos.')
    return
  }

  if (idOrigen === idDestino) {
    alert('La institución de origen y destino deben ser diferentes.')
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    // TRASLADO_DIRECTIVO es un subtipo de TRASLADO_USUARIO en el backend
    const payload = {
      tipo: newTraslado.value.tipo === 'TRASLADO_DIRECTIVO' ? 'TRASLADO_USUARIO' : newTraslado.value.tipo,
      id_usuario: idUser,
      id_colegio_origen: idOrigen,
      id_colegio_destino: idDestino,
      id_matricula: newTraslado.value.id_matricula ? Number(newTraslado.value.id_matricula) : null,
      yearId: yearStore.selectedYearId ? Number(yearStore.selectedYearId) : null,
      motivo: motivoTxt
    }
    await axios.post(`${API_BASE_URL}/api/traslados`, payload, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    successMessage.value = 'Solicitud de traslado registrada exitosamente.'
    setTimeout(() => successMessage.value = '', 4000)
    showCreateModal.value = false
    
    // Reset form
    newTraslado.value = {
      tipo: 'TRASLADO_MATRICULA',
      id_usuario: null,
      id_colegio_origen: auth.selectedSchoolId || (auth.user?.schoolId ? Number(auth.user.schoolId) : 1),
      id_colegio_destino: null,
      id_matricula: null,
      motivo: ''
    }

    await fetchSolicitudes()
  } catch (err: any) {
    console.error('Error creando traslado:', err)
    alert(err.response?.data?.error || 'Error al registrar la solicitud de traslado')
  } finally {
    submitting.value = false
  }
}

const handleProcessApproval = async (accion: 'APROBAR' | 'RECHAZAR' | 'CANCELAR') => {
  if (!selectedSolicitud.value) return

  const confirmMsg = accion === 'APROBAR' 
    ? '¿Estás seguro de aprobar este traslado?' 
    : accion === 'RECHAZAR'
    ? '¿Estás seguro de rechazar esta solicitud de traslado?'
    : '¿Estás seguro de cancelar esta solicitud?'

  if (!confirm(confirmMsg)) return

  submitting.value = true
  try {
    await axios.post(`${API_BASE_URL}/api/traslados/${selectedSolicitud.value.id_solicitud}/aprobacion`, {
      accion,
      comentario: approvalForm.value.comentario || null
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    successMessage.value = `Acción ${accion.toLowerCase()} registrada exitosamente.`
    setTimeout(() => successMessage.value = '', 4000)
    
    // Refetch details & list
    await openDetailModal(selectedSolicitud.value)
    await fetchSolicitudes()
  } catch (err: any) {
    console.error('Error al procesar aprobación:', err)
    alert(err.response?.data?.error || 'Error al procesar la aprobación del traslado')
  } finally {
    submitting.value = false
  }
}

// Filtered Requests
const filteredSolicitudes = computed(() => {
  return solicitudes.value.filter(s => {
    // Status filter
    if (selectedStatusFilter.value !== 'ALL' && s.estado !== selectedStatusFilter.value) {
      return false
    }

    // Type filter
    if (selectedTypeFilter.value !== 'ALL' && s.tipo !== selectedTypeFilter.value) {
      return false
    }

    // Search query
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const fullName = `${s.usuario_nombre || ''} ${s.usuario_apellido || ''}`.toLowerCase()
      const doc = (s.usuario_documento || '').toLowerCase()
      const origen = (s.colegio_origen_nombre || '').toLowerCase()
      const destino = (s.colegio_destino_nombre || '').toLowerCase()

      return fullName.includes(q) || doc.includes(q) || origen.includes(q) || destino.includes(q)
    }

    return true
  })
})

// Stats Calculations
const totalSolicitudes = computed(() => solicitudes.value.length)
const enAprobacionCount = computed(() => solicitudes.value.filter(s => ['SOLICITADA', 'EN_APROBACION'].includes(s.estado)).length)
const ejecutadasCount = computed(() => solicitudes.value.filter(s => ['EJECUTADA', 'APROBADA'].includes(s.estado)).length)
const rechazadasCount = computed(() => solicitudes.value.filter(s => ['RECHAZADA', 'CANCELADA'].includes(s.estado)).length)

// Helpers
const getStatusBadge = (estado: string) => {
  switch (estado) {
    case 'EN_APROBACION':
    case 'SOLICITADA':
      return { label: 'En Aprobación', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', icon: Clock }
    case 'EJECUTADA':
    case 'APROBADA':
      return { label: 'Ejecutada / Aprobada', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 }
    case 'RECHAZADA':
      return { label: 'Rechazada', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300', icon: XCircle }
    case 'CANCELADA':
      return { label: 'Cancelada', bg: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: AlertCircle }
    default:
      return { label: estado, bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300', icon: Info }
  }
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Matriz de Aprobaciones Requeridas (Consenso Tripartito)
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

// Can User Approve in Modal?
const userAlreadyVotedMessage = computed(() => {
  if (!selectedSolicitud.value) return ''
  const aprobaciones = selectedSolicitud.value.aprobaciones || []
  const userId = auth.user?.id ? Number(auth.user.id) : null
  const userSchool = auth.user?.schoolId ? Number(auth.user.schoolId) : null
  const roles = auth.user?.roles || []

  // 1. Verificar si el usuario específico por su ID ya votó
  const userVote = aprobaciones.find(a => Number(a.id_usuario) === userId)
  if (userVote) {
    return `Ya has registrado tu decisión (${userVote.accion}) para esta solicitud.`
  }

  // 2. Evaluar roles específicos del usuario autenticado
  const isPadre = roles.includes('padre')
  const isTargetUser = userId !== null && userId === selectedSolicitud.value.id_usuario
  const isParentOfStudent = selectedSolicitud.value.padre && Number(selectedSolicitud.value.padre.id_usuario) === userId
  const isFamily = isPadre || isTargetUser || isParentOfStudent

  const isDirectivo = roles.includes('directivo')
  const isOrigenSchool = userSchool !== null && userSchool === selectedSolicitud.value.id_colegio_origen
  const isDestinoSchool = userSchool !== null && userSchool === selectedSolicitud.value.id_colegio_destino
  const isAdmin = roles.includes('admin_general')

  const usuarioVote = aprobaciones.find(a => a.rol === 'USUARIO')
  const origenVote = aprobaciones.find(a => a.rol === 'DIRECTIVO_ORIGEN')
  const destinoVote = aprobaciones.find(a => a.rol === 'DIRECTIVO_DESTINO')
  const adminVote = aprobaciones.find(a => a.rol === 'ADMIN_GENERAL')

  // Si actúa como Padre / Familia / Usuario afectado:
  if (isFamily) {
    if (usuarioVote) {
      return 'El voto del Padre de Familia / Acudiente ya se encuentra registrado.'
    }
    return '' // Habilitado para votar como USUARIO
  }

  // Si actúa como Directivo de Origen:
  if (isDirectivo && isOrigenSchool) {
    if (origenVote) {
      return 'La institución de Origen (Directivo Origen) ya registró su voto para esta solicitud.'
    }
    return '' // Habilitado para votar como DIRECTIVO_ORIGEN
  }

  // Si actúa como Directivo de Destino:
  if (isDirectivo && isDestinoSchool) {
    if (destinoVote) {
      return 'La institución de Destino (Directivo Destino) ya registró su voto para esta solicitud.'
    }
    return '' // Habilitado para votar como DIRECTIVO_DESTINO
  }

  // Si actúa como Administrador General:
  if (isAdmin) {
    if (adminVote) {
      return 'El Administrador General ya registró su voto ejecutiva para esta solicitud.'
    }
    return ''
  }

  return 'No posees autorización o rol vigente para emitir voto en esta solicitud.'
})

const canUserApproveCurrentModal = computed(() => {
  if (!selectedSolicitud.value) return false
  if (['EJECUTADA', 'RECHAZADA', 'CANCELADA', 'APROBADA'].includes(selectedSolicitud.value.estado)) return false
  if (userAlreadyVotedMessage.value) return false

  const userSchool = auth.user?.schoolId ? Number(auth.user.schoolId) : null
  const userId = auth.user?.id ? Number(auth.user.id) : null
  const roles = auth.user?.roles || []

  const isPadre = roles.includes('padre')
  const isTargetUser = userId !== null && userId === selectedSolicitud.value.id_usuario
  const isParentOfStudent = selectedSolicitud.value.padre && Number(selectedSolicitud.value.padre.id_usuario) === userId
  const isFamily = isPadre || isTargetUser || isParentOfStudent

  const isDirectivo = roles.includes('directivo')
  const isOrigenSchool = userSchool !== null && userSchool === selectedSolicitud.value.id_colegio_origen
  const isDestinoSchool = userSchool !== null && userSchool === selectedSolicitud.value.id_colegio_destino
  const isAdmin = roles.includes('admin_general')

  if (isAdmin) return true
  if (isFamily) return true
  if (isDirectivo && (isOrigenSchool || isDestinoSchool)) return true

  return false
})
</script>

<template>
  <div class="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none backdrop-blur-xl">
      <div>
        <div class="flex items-center gap-3">
          <div class="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <ArrowLeftRight :size="24" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              Gestión de Traslados Interinstitucionales
            </h1>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Administración de solicitudes de traslado, consenso de aprobaciones y trazabilidad de vinculaciones
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="fetchSolicitudes" 
          class="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          title="Actualizar datos"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
        </button>

        <button 
          @click="openCreateModal"
          class="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus :size="18" />
          <span>Nueva Solicitud de Traslado</span>
        </button>
      </div>
    </div>

    <!-- Feedback Alerts -->
    <div v-if="successMessage" class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center gap-3">
      <CheckCircle2 :size="20" />
      <span>{{ successMessage }}</span>
    </div>

    <div v-if="errorMessage" class="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 font-bold text-sm flex items-center gap-3">
      <AlertCircle :size="20" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
      <button 
        @click="activeTab = 'solicitudes'"
        :class="[
          'px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2',
          activeTab === 'solicitudes'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
      >
        <ArrowLeftRight :size="16" />
        <span>Solicitudes de Traslado ({{ solicitudes.length }})</span>
      </button>

      <button 
        @click="activeTab = 'vinculaciones'"
        :class="[
          'px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2',
          activeTab === 'vinculaciones'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
      >
        <Building2 :size="16" />
        <span>Mis Vinculaciones Institucionales ({{ vinculaciones.length }})</span>
      </button>
    </div>

    <!-- TAB 1: SOLICITUDES DE TRASLADO -->
    <div v-if="activeTab === 'solicitudes'" class="space-y-6">
      <!-- Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Solicitudes</p>
            <p class="text-2xl font-black text-slate-800 dark:text-white mt-1">{{ totalSolicitudes }}</p>
          </div>
          <div class="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <ArrowLeftRight :size="20" />
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">En Aprobación</p>
            <p class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{{ enAprobacionCount }}</p>
          </div>
          <div class="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock :size="20" />
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ejecutadas / Exitosas</p>
            <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{{ ejecutadasCount }}</p>
          </div>
          <div class="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 :size="20" />
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Rechazadas / Canceladas</p>
            <p class="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{{ rechazadasCount }}</p>
          </div>
          <div class="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
            <XCircle :size="20" />
          </div>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <!-- Search -->
        <div class="relative w-full md:w-80">
          <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por estudiante, documento o colegio..."
            class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Filter Selects -->
        <div class="flex items-center gap-3 w-full md:w-auto">
          <select 
            v-model="selectedStatusFilter"
            class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="EN_APROBACION">En Aprobación</option>
            <option value="EJECUTADA">Ejecutada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>

          <select 
            v-model="selectedTypeFilter"
            class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todos los Tipos</option>
            <option value="TRASLADO_MATRICULA">Matrícula</option>
            <option value="TRASLADO_USUARIO">Usuario / Personal</option>
          </select>
        </div>
      </div>

      <!-- Solicitudes Table / List -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl overflow-hidden">
        <div v-if="loading" class="p-12 text-center text-slate-400 space-y-3">
          <RefreshCw :size="28" class="animate-spin mx-auto text-indigo-500" />
          <p class="text-xs font-semibold">Cargando solicitudes de traslado...</p>
        </div>

        <div v-else-if="filteredSolicitudes.length === 0" class="p-12 text-center text-slate-400 space-y-3">
          <Info :size="32" class="mx-auto text-slate-300 dark:text-slate-600" />
          <p class="text-sm font-bold text-slate-600 dark:text-slate-300">No se encontraron solicitudes de traslado</p>
          <p class="text-xs text-slate-400">Intenta cambiar los filtros de búsqueda o registra una nueva solicitud.</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 font-bold uppercase tracking-wider">
                <th class="py-4 px-6">ID / Tipo</th>
                <th class="py-4 px-6">Estudiante / Usuario</th>
                <th class="py-4 px-6">Institución Origen ➔ Destino</th>
                <th class="py-4 px-6">Estado</th>
                <th class="py-4 px-6">Fecha Solicitud</th>
                <th class="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
              <tr v-for="sol in filteredSolicitudes" :key="sol.id_solicitud" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td class="py-4 px-6">
                  <span class="font-mono text-slate-400">#{{ sol.id_solicitud }}</span>
                  <div class="mt-1">
                    <span :class="[
                      'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                      sol.tipo === 'TRASLADO_MATRICULA' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                    ]">
                      {{ sol.tipo === 'TRASLADO_MATRICULA' ? 'Matrícula' : 'Usuario' }}
                    </span>
                  </div>
                </td>

                <td class="py-4 px-6">
                  <p class="font-bold text-slate-900 dark:text-white">{{ sol.usuario_nombre }} {{ sol.usuario_apellido }}</p>
                  <p class="text-[11px] text-slate-400 font-mono">{{ sol.usuario_email }} | Doc: {{ sol.usuario_documento || 'Sin doc' }}</p>
                </td>

                <td class="py-4 px-6">
                  <div class="flex items-center gap-2 text-xs">
                    <span class="font-bold text-slate-700 dark:text-slate-300">{{ sol.colegio_origen_nombre }}</span>
                    <ChevronRight :size="14" class="text-slate-400" />
                    <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ sol.colegio_destino_nombre }}</span>
                  </div>
                </td>

                <td class="py-4 px-6">
                  <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" :class="getStatusBadge(sol.estado).bg">
                    <component :is="getStatusBadge(sol.estado).icon" :size="14" />
                    <span>{{ getStatusBadge(sol.estado).label }}</span>
                  </div>
                </td>

                <td class="py-4 px-6 text-slate-500 dark:text-slate-400">
                  {{ formatDate(sol.fecha_creacion) }}
                </td>

                <td class="py-4 px-6 text-right">
                  <button 
                    @click="openDetailModal(sol)"
                    class="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Ver Detalle</span>
                    <ChevronRight :size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: VINCULACIONES INSTITUCIONALES -->
    <div v-if="activeTab === 'vinculaciones'" class="space-y-6">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-6">
        <h2 class="text-lg font-black text-slate-800 dark:text-white mb-1">Historial de Vinculaciones Institucionales</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-6">Muestra los colegios y roles a los que has estado vinculado dentro del ecosistema AcademiaNeiva</p>

        <div v-if="vinculaciones.length === 0" class="p-8 text-center text-slate-400">
          <Building :size="32" class="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p class="text-xs">No tienes vinculaciones registradas en tu historial.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="vinc in vinculaciones" 
            :key="vinc.id_usuario_colegio"
            class="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between space-y-4"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Building2 :size="20" />
                </div>
                <div>
                  <h3 class="font-bold text-slate-900 dark:text-white text-sm">{{ vinc.colegio_nombre }}</h3>
                  <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Rol: {{ vinc.rol_nombre }}</p>
                </div>
              </div>
              <span :class="[
                'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                vinc.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              ]">
                {{ vinc.estado }}
              </span>
            </div>

            <div class="text-[11px] text-slate-400 space-y-1 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
              <p>Vinculado desde: <span class="font-semibold text-slate-700 dark:text-slate-300">{{ formatDate(vinc.fecha_inicio) }}</span></p>
              <p v-if="vinc.fecha_fin">Vinculado hasta: <span class="font-semibold text-slate-700 dark:text-slate-300">{{ formatDate(vinc.fecha_fin) }}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: DETALLE Y CRONOLOGÍA DE APROBACIONES -->
    <div v-if="showDetailModal && selectedSolicitud" class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <ArrowLeftRight :size="20" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white">Detalle de Traslado #{{ selectedSolicitud.id_solicitud }}</h2>
              <p class="text-xs text-slate-400">Cronología de votos y resolución institucional</p>
            </div>
          </div>
          <button @click="showDetailModal = false" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X :size="20" />
          </button>
        </div>

        <!-- Info Summary Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
          <div>
            <p class="text-slate-400 font-bold uppercase text-[10px]">Estudiante / Usuario</p>
            <p class="font-bold text-slate-800 dark:text-white text-sm mt-0.5">{{ selectedSolicitud.usuario_nombre }} {{ selectedSolicitud.usuario_apellido }}</p>
            <p class="text-slate-500 dark:text-slate-400 text-[11px]">Doc: {{ selectedSolicitud.usuario_documento }}</p>
          </div>

          <div>
            <p class="text-slate-400 font-bold uppercase text-[10px]">Estado Actual</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-1" :class="getStatusBadge(selectedSolicitud.estado).bg">
              <component :is="getStatusBadge(selectedSolicitud.estado).icon" :size="14" />
              <span>{{ getStatusBadge(selectedSolicitud.estado).label }}</span>
            </div>
          </div>

          <div>
            <p class="text-slate-400 font-bold uppercase text-[10px]">Colegio Origen</p>
            <p class="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{{ selectedSolicitud.colegio_origen_nombre }}</p>
          </div>

          <div>
            <p class="text-slate-400 font-bold uppercase text-[10px]">Colegio Destino</p>
            <p class="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{{ selectedSolicitud.colegio_destino_nombre }}</p>
          </div>

          <div class="md:col-span-2">
            <p class="text-slate-400 font-bold uppercase text-[10px]">Motivo del Traslado</p>
            <p class="font-medium text-slate-700 dark:text-slate-300 mt-0.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">{{ selectedSolicitud.motivo }}</p>
          </div>

          <!-- Botón de Exportar Datos Académicos de Traslado -->
          <div class="md:col-span-2 pt-1">
            <button 
              @click="academicTargetId = selectedSolicitud.id_solicitud; showAcademicDataModal = true"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 uppercase tracking-wider transition-all"
            >
              <ClipboardList :size="16" />
              Datos académicos de traslados
            </button>
          </div>
        </div>

        <!-- Consenso Matrix Section (Estado de Aprobaciones Requeridas) -->
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

        <!-- Approvals Timeline -->
        <div class="space-y-3">
          <h3 class="text-xs font-black uppercase text-slate-400 tracking-wider">Historial de Auditoría y Votos Registrados</h3>
          
          <div v-if="!selectedSolicitud.aprobaciones || selectedSolicitud.aprobaciones.length === 0" class="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
            Aún no se registran votos de aprobación para esta solicitud.
          </div>

          <div v-else class="space-y-2">
            <div 
              v-for="ap in selectedSolicitud.aprobaciones" 
              :key="ap.id_aprobacion"
              class="p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs"
              :class="[
                ap.accion === 'APROBAR' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-300' : 'bg-rose-500/5 border-rose-500/20 text-rose-900 dark:text-rose-300'
              ]"
            >
              <div class="flex items-start gap-3">
                <div :class="[
                  'p-2 rounded-xl text-white font-bold mt-0.5',
                  ap.accion === 'APROBAR' ? 'bg-emerald-500' : 'bg-rose-500'
                ]">
                  <Check v-if="ap.accion === 'APROBAR'" :size="16" />
                  <X v-else :size="16" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900 dark:text-white">{{ ap.usuario_nombre }} {{ ap.usuario_apellido }}</span>
                    <span class="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-black uppercase">{{ ap.rol }}</span>
                  </div>
                  <p v-if="ap.comentario" class="text-slate-600 dark:text-slate-400 mt-1 italic font-normal">"{{ ap.comentario }}"</p>
                  <p class="text-[10px] text-slate-400 mt-1">{{ formatDate(ap.fecha) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Already Voted Banner -->
        <div v-if="userAlreadyVotedMessage && !['EJECUTADA', 'RECHAZADA', 'CANCELADA'].includes(selectedSolicitud.estado)" class="border-t border-slate-100 dark:border-slate-800 pt-4">
          <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center gap-3">
            <CheckCircle2 :size="18" />
            <span>{{ userAlreadyVotedMessage }}</span>
          </div>
        </div>

        <!-- Action Form in Modal (if user can act) -->
        <div v-if="canUserApproveCurrentModal" class="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
          <h3 class="text-xs font-black uppercase text-slate-400 tracking-wider">Registrar mi Decisión</h3>
          
          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Comentario u Observación (Opcional)</label>
            <input 
              v-model="approvalForm.comentario"
              type="text"
              placeholder="Ingresa algún comentario sobre tu voto..."
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div class="flex items-center gap-3">
            <button 
              @click="handleProcessApproval('APROBAR')"
              :disabled="submitting"
              class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Aprobar Traslado
            </button>
            
            <button 
              @click="handleProcessApproval('RECHAZAR')"
              :disabled="submitting"
              class="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- MODAL: CREAR SOLICITUD DE TRASLADO -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-6 shadow-2xl">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Plus :size="20" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white">Nueva Solicitud de Traslado</h2>
              <p class="text-xs text-slate-400">Completa la información para iniciar el flujo de aprobación tripartita</p>
            </div>
          </div>
          <button @click="showCreateModal = false" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X :size="20" />
          </button>
        </div>

        <!-- Form Body -->
        <div class="space-y-4 text-xs">
          <!-- Tipo -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Traslado</label>
            <select 
              v-model="newTraslado.tipo"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="TRASLADO_MATRICULA">Traslado de Estudiante (con Matrícula)</option>
              <option value="TRASLADO_USUARIO">Traslado de Usuario / Personal</option>
              <option v-if="isAdminGeneral" value="TRASLADO_DIRECTIVO">Traslado de Directivo Institucional</option>
            </select>
            <p v-if="newTraslado.tipo === 'TRASLADO_DIRECTIVO'" class="mt-1 text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
              ⚠️ Solo disponible para el Administrador General. Requiere aprobación del Admin + Directivo Origen + Directivo Destino.
            </p>
          </div>

          <!-- Selección de Colegio Origen (solo admin_general puede elegirlo) -->
          <div v-if="isAdminGeneral">
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Institución de Origen</label>
            <select
              v-model.number="newTraslado.id_colegio_origen"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null" disabled>-- Selecciona la institución de origen --</option>
              <option v-for="col in colegios" :key="col.id_colegio" :value="col.id_colegio">
                {{ col.nombre }}
              </option>
            </select>
          </div>

          <!-- Estudiante / Usuario Selector (cambia según tipo) -->
          <div v-if="newTraslado.tipo === 'TRASLADO_MATRICULA'">
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Seleccionar Estudiante</label>
            <select 
              v-model.number="newTraslado.id_usuario"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null" disabled>-- Selecciona un estudiante --</option>
              <option v-for="est in estudiantesColegio" :key="est.id_estudiante" :value="est.id_usuario">
                {{ est.nombre }} {{ est.apellido }} ({{ est.codigo || est.documento || 'Sin código' }}) - {{ est.grado || '' }} {{ est.seccion || '' }}
              </option>
            </select>
          </div>

          <!-- Selector de Personal (Docentes, Padres, etc.) para TRASLADO_USUARIO -->
          <div v-else-if="newTraslado.tipo === 'TRASLADO_USUARIO'">
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Seleccionar Personal (Docente / Acudiente / otro)</label>
            <select 
              v-model.number="newTraslado.id_usuario"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null" disabled>-- Selecciona el usuario --</option>
              <option v-for="p in personalColegio" :key="p.id_usuario" :value="p.id_usuario">
                {{ p.nombre }} {{ p.apellido }} ({{ p.rol_nombre }}) - {{ p.email }}
              </option>
            </select>
            <p v-if="personalColegio.length === 0" class="text-[10px] text-amber-600 dark:text-amber-400 mt-1">No se encontró personal disponible para traslado en esta institución.</p>
          </div>

          <!-- Selector de Directivos para TRASLADO_DIRECTIVO (solo admin_general) -->
          <div v-else-if="newTraslado.tipo === 'TRASLADO_DIRECTIVO'">
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Seleccionar Directivo a Trasladar</label>
            <select 
              v-model.number="newTraslado.id_usuario"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option :value="null" disabled>-- Selecciona el directivo --</option>
              <option v-for="d in directivosColegio" :key="d.id_usuario" :value="d.id_usuario">
                {{ d.nombre }} {{ d.apellido }} (Directivo) - {{ d.email }}
              </option>
            </select>
            <p v-if="directivosColegio.length === 0" class="text-[10px] text-amber-600 dark:text-amber-400 mt-1">No se encontraron directivos en la institución seleccionada.</p>
          </div>

          <!-- Colegio Destino Selector -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Institución de Destino</label>
            <select 
              v-model.number="newTraslado.id_colegio_destino"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null" disabled>-- Selecciona la institución de destino --</option>
              <option 
                v-for="col in colegios" 
                :key="col.id_colegio" 
                :value="col.id_colegio"
                :disabled="col.id_colegio === newTraslado.id_colegio_origen"
              >
                {{ col.nombre }} {{ col.id_colegio === newTraslado.id_colegio_origen ? '(Colegio Origen Actual)' : '' }}
              </option>
            </select>
          </div>

          <!-- Motivo -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Motivo del Traslado (Obligatorio)</label>
            <textarea 
              v-model="newTraslado.motivo"
              rows="3"
              placeholder="Explica la razón del traslado interinstitucional..."
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button 
            @click="showCreateModal = false"
            class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
          
          <button 
            @click="handleCreateTraslado"
            :disabled="submitting || !newTraslado.id_usuario || !newTraslado.id_colegio_origen || !newTraslado.id_colegio_destino || !newTraslado.motivo.trim()"
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
          >
            {{ submitting ? 'Enviando...' : 'Enviar Solicitud' }}
          </button>
        </div>

      </div>
    </div>

    <!-- Modal de Exportación de Datos Académicos del Traslado -->
    <DatosAcademicosTrasladoModal 
      :show="showAcademicDataModal" 
      :target-id="academicTargetId"
      @close="showAcademicDataModal = false"
    />
  </div>
</template>
