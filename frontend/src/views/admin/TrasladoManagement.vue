<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
  AlertTriangle,
  Building2, 
  RefreshCw,
  Building,
  Check,
  X,
  ClipboardList
} from 'lucide-vue-next'
import DatosAcademicosTrasladoModal from '../../components/traslados/DatosAcademicosTrasladoModal.vue'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()

interface SolicitudTraslado {
  id_solicitud: number
  tipo: string
  id_usuario: number
  id_colegio_origen: number
  id_colegio_destino: number
  id_matricula: number | null
  estado: string
  motivo: string
  creado_por: number
  fecha_creacion: string
  fecha_finalizacion: string | null
  usuario_nombre: string
  usuario_apellido: string
  usuario_email: string
  usuario_documento: string
  colegio_origen_nombre: string
  colegio_destino_nombre: string
  creador_nombre: string
  creador_apellido: string
  aprobaciones?: Array<{
    id_aprobacion: number
    id_usuario: number
    rol: string
    accion: string
    comentario: string | null
    fecha: string
    id_grupo_destino?: number | null
    usuario_nombre: string
    usuario_apellido: string
    grupo_destino_grado?: string | null
    grupo_destino_seccion?: string | null
    grupo_destino_jornada?: string | null
  }>
  padre?: {
    nombre: string
    apellido: string
    email: string
    documento: string
  } | null
  id_grupo_destino?: number | null
  datos_origen?: {
    grado?: string | null
    seccion?: string | null
    jornada?: string | null
    nivel?: string | null
  } | null
  datos_destino?: {
    id_grupo?: number | null
    grupo_nombre?: string | null
    grado?: string | null
    seccion?: string | null
    jornada?: string | null
  } | null
}

const solicitudes = ref<SolicitudTraslado[]>([])
const vinculaciones = ref<any[]>([])
const colegios = ref<any[]>([])
const personalColegio = ref<any[]>([])
const directivosColegio = ref<any[]>([])
const estudiantesColegio = ref<any[]>([])
const loading = ref(false)
const submitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const searchQuery = ref('')
const selectedStatusFilter = ref('ALL')
const selectedTypeFilter = ref('ALL')

// Modals
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const showAcademicDataModal = ref(false)
const academicTargetId = ref<number | null>(null)
const selectedSolicitud = ref<SolicitudTraslado | null>(null)

// Disponibilidad de cupos en destino
const disponibilidadCupos = ref<{
  grado_nombre: string
  nivel_nombre: string
  cupos_totales_grado: number
  hay_cupos: boolean
  grupos: Array<{
    id_grupo: number
    nombre_completo: string
    seccion: string
    jornada: string
    cupos_disponibles: number
    cupos_totales: number
  }>
} | null>(null)
const selectedGrupoDestino = ref<number | null>(null)

const openAcademicDataModal = (targetId: number) => {
  academicTargetId.value = targetId
  showAcademicDataModal.value = true
}

const isDirectivoDestino = computed(() => {
  if (!selectedSolicitud.value) return false
  const mySchool = auth.selectedSchoolId || (auth.user?.schoolId ? Number(auth.user.schoolId) : null)
  return mySchool === selectedSolicitud.value.id_colegio_destino
})

// Forms
const newTraslado = ref<{
  tipo: string
  id_usuario: number | null
  id_colegio_origen: number | null
  id_colegio_destino: number | null
  id_matricula: number | null
  jornada_sugerida: string
  motivo: string
}>({
  tipo: 'TRASLADO_MATRICULA',
  id_usuario: null,
  id_colegio_origen: 1,
  id_colegio_destino: null,
  id_matricula: null,
  jornada_sugerida: 'INDIFERENTE',
  motivo: ''
})

const approvalForm = ref({
  accion: 'APROBAR',
  comentario: ''
})

// Summary Stats
const stats = computed(() => {
  const list = solicitudes.value
  return {
    total: list.length,
    pendientes: list.filter(s => s.estado === 'SOLICITADA' || s.estado === 'EN_APROBACION').length,
    aprobados: list.filter(s => s.estado === 'APROBADA' || s.estado === 'EJECUTADA').length,
    rechazados: list.filter(s => s.estado === 'RECHAZADA' || s.estado === 'CANCELADA').length
  }
})

// Current user role capabilities
const isAdminGeneral = computed(() => {
  const roles = (auth.user?.roles as string[]) || (auth.user?.role ? [auth.user.role] : [])
  return roles.includes('admin_general') || roles.includes('admin') || auth.user?.role === 'admin'
})

const canUserApproveCurrentModal = computed(() => {
  if (!selectedSolicitud.value) return false
  const s = selectedSolicitud.value
  if (['EJECUTADA', 'RECHAZADA', 'CANCELADA'].includes(s.estado)) return false

  const userId = auth.user?.id ? Number(auth.user.id) : null
  const roles: string[] = (auth.user?.roles as string[]) || (auth.user?.role ? [auth.user.role] : [])
  const currentSchoolId = auth.selectedSchoolId || (auth.user?.schoolId ? Number(auth.user.schoolId) : null)

  if (isAdminGeneral.value) return true

  // Verificar si ya emitió su voto
  const yaVotoUsuario = s.aprobaciones?.some(a => a.id_usuario === userId)
  if (yaVotoUsuario) return false

  // Verificar roles
  if (roles.includes('directivo')) {
    if (currentSchoolId === s.id_colegio_origen) {
      const yaVotoOrigen = s.aprobaciones?.some(a => a.rol === 'DIRECTIVO_ORIGEN')
      if (!yaVotoOrigen) return true
    }
    if (currentSchoolId === s.id_colegio_destino) {
      const yaVotoDestino = s.aprobaciones?.some(a => a.rol === 'DIRECTIVO_DESTINO')
      if (!yaVotoDestino) return true
    }
  }

  if (roles.includes('padre') || userId === s.id_usuario) {
    const yaVotoUsuarioRol = s.aprobaciones?.some(a => a.rol === 'USUARIO')
    if (!yaVotoUsuarioRol) return true
  }

  return false
})

const userAlreadyVotedMessage = computed(() => {
  if (!selectedSolicitud.value) return null
  const userId = auth.user?.id ? Number(auth.user.id) : null
  const voto = selectedSolicitud.value.aprobaciones?.find(a => a.id_usuario === userId)
  if (voto) {
    return `Ya has registrado tu decisión (${voto.accion}) para esta solicitud.`
  }
  return null
})

// API Calls
const fetchSolicitudes = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const schoolId = auth.selectedSchoolId || auth.user?.schoolId
    const params: Record<string, any> = {}
    if (schoolId) params.id_colegio = schoolId
    if (yearStore.selectedYearId) params.yearId = yearStore.selectedYearId

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
  disponibilidadCupos.value = null
  selectedGrupoDestino.value = null
  approvalForm.value = { accion: 'APROBAR', comentario: '' }
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/${solicitud.id_solicitud}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    selectedSolicitud.value = res.data
    selectedGrupoDestino.value = res.data.id_grupo_destino || res.data.datos_destino?.id_grupo || null
    showDetailModal.value = true

    if (solicitud.tipo === 'TRASLADO_MATRICULA') {
      try {
        const cuposRes = await axios.get(`${API_BASE_URL}/api/traslados/${solicitud.id_solicitud}/disponibilidad-cupos?id_colegio=${solicitud.id_colegio_destino}`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        })
        disponibilidadCupos.value = cuposRes.data
      } catch (cuposErr) {
        console.error('Error fetching cupos disponibilidad:', cuposErr)
      }
    }
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
    jornada_sugerida: 'INDIFERENTE',
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
    const payload = {
      tipo: newTraslado.value.tipo === 'TRASLADO_DIRECTIVO' ? 'TRASLADO_USUARIO' : newTraslado.value.tipo,
      id_usuario: idUser,
      id_colegio_origen: idOrigen,
      id_colegio_destino: idDestino,
      id_matricula: newTraslado.value.id_matricula ? Number(newTraslado.value.id_matricula) : null,
      yearId: yearStore.selectedYearId ? Number(yearStore.selectedYearId) : null,
      jornada_sugerida: newTraslado.value.jornada_sugerida || null,
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
      jornada_sugerida: 'INDIFERENTE',
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

  if (accion === 'APROBAR' && disponibilidadCupos.value && !disponibilidadCupos.value.hay_cupos && disponibilidadCupos.value.grupos.length > 0) {
    alert(`No hay cupos disponibles en el grado '${disponibilidadCupos.value.grado_nombre}'. Por favor rechaza la solicitud o habilita cupos en la institución destino.`)
    return
  }

  const confirmMsg = accion === 'APROBAR' 
    ? (selectedGrupoDestino.value 
        ? `¿Estás seguro de aprobar este traslado y asignar al estudiante en el grupo seleccionado?` 
        : '¿Estás seguro de aprobar este traslado?')
    : accion === 'RECHAZAR'
    ? '¿Estás seguro de rechazar esta solicitud de traslado?'
    : '¿Estás seguro de cancelar esta solicitud?'

  if (!confirm(confirmMsg)) return

  const isDestinoOrAdmin = isDirectivoDestino.value || isAdminGeneral.value
  const idGrupoDestinoToSend = (accion === 'APROBAR' && isDestinoOrAdmin) ? (selectedGrupoDestino.value || null) : null

  submitting.value = true
  try {
    await axios.post(`${API_BASE_URL}/api/traslados/${selectedSolicitud.value.id_solicitud}/aprobacion`, {
      accion,
      comentario: approvalForm.value.comentario || null,
      id_grupo_destino: idGrupoDestinoToSend
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
      const origen = (s.colegio_origen_nombre || '').toLowerCase()
      const destino = (s.colegio_destino_nombre || '').toLowerCase()
      const doc = (s.usuario_documento || '').toLowerCase()

      return fullName.includes(q) || origen.includes(q) || destino.includes(q) || doc.includes(q)
    }

    return true
  })
})

const getStatusBadge = (estado: string) => {
  switch (estado) {
    case 'SOLICITADA':
      return { label: 'Solicitada', class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200' }
    case 'EN_APROBACION':
      return { label: 'En Proceso', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200' }
    case 'APROBADA':
    case 'EJECUTADA':
      return { label: 'Aprobada', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200' }
    case 'RECHAZADA':
      return { label: 'Rechazada', class: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200' }
    case 'CANCELADA':
      return { label: 'Cancelada', class: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200' }
    default:
      return { label: estado, class: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200' }
  }
}

const getTypeBadge = (tipo: string) => {
  switch (tipo) {
    case 'TRASLADO_MATRICULA':
      return { label: 'Estudiante / Matrícula', class: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200' }
    case 'TRASLADO_USUARIO':
      return { label: 'Personal / Docente', class: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200' }
    default:
      return { label: tipo, class: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200' }
  }
}

const getApprovalMatrix = (s: SolicitudTraslado) => {
  const aprobaciones = s.aprobaciones || []
  
  const apOrigen = aprobaciones.find(a => a.rol === 'DIRECTIVO_ORIGEN')
  const apDestino = aprobaciones.find(a => a.rol === 'DIRECTIVO_DESTINO')
  const apUsuario = aprobaciones.find(a => a.rol === 'USUARIO')

  return [
    {
      rol: 'DIRECTIVO_ORIGEN',
      label: 'Colegio Origen',
      entidad: s.colegio_origen_nombre,
      aprobacion: apOrigen
    },
    {
      rol: 'DIRECTIVO_DESTINO',
      label: 'Colegio Destino',
      entidad: s.colegio_destino_nombre,
      aprobacion: apDestino
    },
    {
      rol: 'USUARIO',
      label: s.tipo === 'TRASLADO_MATRICULA' ? 'Acudiente Legal' : 'Usuario Trasladado',
      entidad: s.tipo === 'TRASLADO_MATRICULA' 
        ? (s.padre ? `${s.padre.nombre} ${s.padre.apellido}` : 'Padre / Acudiente') 
        : `${s.usuario_nombre} ${s.usuario_apellido}`,
      aprobacion: apUsuario
    }
  ]
}

const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatStudentGrade = (e: any) => {
  if (!e) return 'Sin Grupo'
  if (e.grado_nombre) {
    const parts = [e.grado_nombre]
    if (e.seccion_nombre) parts.push(e.seccion_nombre)
    let str = parts.join(' ')
    if (e.jornada_nombre) str += ` (${e.jornada_nombre})`
    return str
  }
  return e.grado_seccion || 'Sin Grupo'
}

onMounted(() => {
  fetchSolicitudes()
  fetchVinculaciones()
  fetchColegios()
  const schoolId = auth.user?.schoolId ? Number(auth.user.schoolId) : 1
  fetchEstudiantesByColegio(schoolId)
})
</script>

<template>
  <div class="space-y-6">

    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <ArrowLeftRight class="text-indigo-600 dark:text-indigo-400" :size="28" />
          <span>Gestión de Traslados Interinstitucionales</span>
        </h1>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Administración de solicitudes de traslado, consenso de aprobaciones y trazabilidad de vinculaciones
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="fetchSolicitudes"
          class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
          title="Recargar solicitudes"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
        </button>

        <button 
          @click="openCreateModal"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus :size="16" />
          <span>Nueva Solicitud</span>
        </button>
      </div>
    </div>

    <!-- Alert Messages -->
    <div v-if="successMessage" class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center gap-2">
      <CheckCircle2 :size="16" />
      <span>{{ successMessage }}</span>
    </div>

    <div v-if="errorMessage" class="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center gap-2">
      <AlertCircle :size="16" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Stats Counter Bar -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Solicitudes</p>
          <p class="text-2xl font-black text-slate-900 dark:text-white mt-1">{{ stats.total }}</p>
        </div>
        <div class="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
          <ArrowLeftRight :size="20" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-amber-500 uppercase tracking-wider">En Trámite</p>
          <p class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{{ stats.pendientes }}</p>
        </div>
        <div class="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
          <Clock :size="20" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-emerald-500 uppercase tracking-wider">Aprobadas</p>
          <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{{ stats.aprobados }}</p>
        </div>
        <div class="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
          <CheckCircle2 :size="20" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-rose-500 uppercase tracking-wider">Rechazadas</p>
          <p class="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{{ stats.rechazados }}</p>
        </div>
        <div class="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
          <XCircle :size="20" />
        </div>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="relative w-full md:w-80">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por usuario, documento o colegio..."
          class="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div class="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <!-- Status Filter -->
        <select 
          v-model="selectedStatusFilter"
          class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Todos los Estados</option>
          <option value="EN_APROBACION">En Proceso / Votación</option>
          <option value="APROBADA">Aprobadas / Ejecutadas</option>
          <option value="RECHAZADA">Rechazadas</option>
          <option value="CANCELADA">Canceladas</option>
        </select>

        <!-- Type Filter -->
        <select 
          v-model="selectedTypeFilter"
          class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Todos los Tipos</option>
          <option value="TRASLADO_MATRICULA">Matrículas Escolares</option>
          <option value="TRASLADO_USUARIO">Personal / Docentes</option>
        </select>
      </div>
    </div>

    <!-- Main List of Requests Table -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      
      <div v-if="loading" class="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
        <RefreshCw class="animate-spin text-indigo-500" :size="32" />
        <p class="text-xs font-semibold">Cargando solicitudes de traslado...</p>
      </div>

      <div v-else-if="filteredSolicitudes.length === 0" class="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
        <ArrowLeftRight class="text-slate-300 dark:text-slate-700" :size="40" />
        <p class="text-sm font-bold text-slate-600 dark:text-slate-300">No se encontraron solicitudes de traslado</p>
        <p class="text-xs">No hay registros que coincidan con los filtros seleccionados o el año escolar activo.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <th class="px-6 py-4">Usuario / Estudiante</th>
              <th class="px-6 py-4">Tipo</th>
              <th class="px-6 py-4">Origen → Destino</th>
              <th class="px-6 py-4">Consenso de Votos</th>
              <th class="px-6 py-4">Estado</th>
              <th class="px-6 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <tr 
              v-for="s in filteredSolicitudes" 
              :key="s.id_solicitud"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
            >
              <!-- Usuario / Estudiante -->
              <td class="px-6 py-4">
                <div class="space-y-0.5">
                  <p class="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                    {{ s.usuario_nombre }} {{ s.usuario_apellido }}
                  </p>
                  <p class="text-xs text-slate-400 font-mono">Doc: {{ s.usuario_documento }}</p>
                  <p class="text-[10px] text-slate-400">{{ s.usuario_email }}</p>
                </div>
              </td>

              <!-- Tipo -->
              <td class="px-6 py-4">
                <span :class="[getTypeBadge(s.tipo).class, 'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border']">
                  {{ getTypeBadge(s.tipo).label }}
                </span>
              </td>

              <!-- Origen -> Destino -->
              <td class="px-6 py-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Building :size="12" class="shrink-0 text-slate-400" />
                    <span class="font-semibold truncate max-w-[180px]" :title="s.colegio_origen_nombre">{{ s.colegio_origen_nombre }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                    <span class="text-xs">→</span>
                    <Building2 :size="12" class="shrink-0" />
                    <span class="truncate max-w-[180px]" :title="s.colegio_destino_nombre">{{ s.colegio_destino_nombre }}</span>
                  </div>
                </div>
              </td>

              <!-- Consenso Tripartito de Votos -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <div 
                    v-for="item in getApprovalMatrix(s)" 
                    :key="item.rol"
                    :title="`${item.label}: ${item.aprobacion ? 'Aprobado por ' + item.aprobacion.usuario_nombre : 'Pendiente'}`"
                    :class="[
                      'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all',
                      item.aprobacion 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 ring-2 ring-emerald-500/20' 
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    ]"
                  >
                    <Check v-if="item.aprobacion" :size="14" />
                    <Clock v-else :size="12" />
                  </div>
                </div>
              </td>

              <!-- Estado -->
              <td class="px-6 py-4">
                <span :class="[getStatusBadge(s.estado).class, 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border']">
                  {{ getStatusBadge(s.estado).label }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="s.tipo === 'TRASLADO_MATRICULA'"
                    @click.stop="openAcademicDataModal(s.id_solicitud)"
                    class="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all"
                    title="Ver/Exportar Datos Académicos"
                  >
                    <ClipboardList :size="15" />
                  </button>

                  <button 
                    @click="openDetailModal(s)"
                    class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                  >
                    Ver Detalle
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- MODAL: DETALLE Y APROBACIÓN DE SOLICITUD -->
    <div v-if="showDetailModal && selectedSolicitud" class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        <!-- Header Modal -->
        <div class="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div class="flex items-center gap-2">
              <span :class="[getTypeBadge(selectedSolicitud.tipo).class, 'px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border']">
                {{ getTypeBadge(selectedSolicitud.tipo).label }}
              </span>
              <span :class="[getStatusBadge(selectedSolicitud.estado).class, 'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border']">
                {{ getStatusBadge(selectedSolicitud.estado).label }}
              </span>
            </div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white mt-1">
              {{ selectedSolicitud.usuario_nombre }} {{ selectedSolicitud.usuario_apellido }}
            </h2>
            <p class="text-xs text-slate-400 font-mono flex flex-wrap items-center gap-2 mt-0.5">
              <span>Doc: {{ selectedSolicitud.usuario_documento }}</span>
              <span>| ID Solicitud #{{ selectedSolicitud.id_solicitud }}</span>
              <span v-if="selectedSolicitud.datos_origen?.grado" class="font-sans font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                🎓 Grado {{ selectedSolicitud.datos_origen.grado }} <template v-if="selectedSolicitud.datos_origen?.seccion">({{ selectedSolicitud.datos_origen.seccion }})</template>
              </span>
              <span v-if="selectedSolicitud.datos_origen?.jornada" class="font-sans font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                ☀️ Jornada {{ selectedSolicitud.datos_origen.jornada }}
              </span>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button 
              v-if="selectedSolicitud.tipo === 'TRASLADO_MATRICULA'"
              @click="openAcademicDataModal(selectedSolicitud.id_solicitud)"
              class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <ClipboardList :size="14" />
              <span>Datos Académicos</span>
            </button>

            <button 
              @click="showDetailModal = false"
              class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
            >
              <X :size="20" />
            </button>
          </div>
        </div>

        <!-- Transfer Route Info -->
        <div class="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="space-y-0.5 text-center md:text-left flex-1">
            <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Institución de Origen</p>
            <p class="font-bold text-slate-800 dark:text-slate-200 text-sm">{{ selectedSolicitud.colegio_origen_nombre }}</p>
            <div v-if="selectedSolicitud.datos_origen?.grado || selectedSolicitud.datos_origen?.jornada" class="flex flex-wrap items-center gap-1.5 mt-1 justify-center md:justify-start">
              <span v-if="selectedSolicitud.datos_origen?.grado" class="text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900/60">
                Grado {{ selectedSolicitud.datos_origen.grado }} <template v-if="selectedSolicitud.datos_origen?.seccion">({{ selectedSolicitud.datos_origen.seccion }})</template>
              </span>
              <span v-if="selectedSolicitud.datos_origen?.jornada" class="text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/60">
                Jornada {{ selectedSolicitud.datos_origen.jornada }}
              </span>
            </div>
          </div>

          <div class="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full">
            <ArrowLeftRight :size="16" />
          </div>

          <div class="space-y-0.5 text-center md:text-right flex-1">
            <p class="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Institución de Destino</p>
            <p class="font-bold text-indigo-900 dark:text-indigo-300 text-sm">{{ selectedSolicitud.colegio_destino_nombre }}</p>
            <div v-if="selectedSolicitud.datos_destino?.grado || selectedSolicitud.datos_destino?.jornada || selectedSolicitud.datos_destino?.grupo_nombre" class="flex flex-wrap items-center gap-1.5 mt-1 justify-center md:justify-end">
              <span v-if="selectedSolicitud.datos_destino?.grado" class="text-[10px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                Grado {{ selectedSolicitud.datos_destino.grado }} <template v-if="selectedSolicitud.datos_destino?.seccion">({{ selectedSolicitud.datos_destino.seccion }})</template>
              </span>
              <span v-if="selectedSolicitud.datos_destino?.jornada" class="text-[10px] font-black uppercase bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800">
                Jornada {{ selectedSolicitud.datos_destino.jornada }}
              </span>
            </div>
          </div>
        </div>

        <!-- Reason -->
        <div class="space-y-1">
          <label class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Motivo Declarado</label>
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 italic">
            "{{ selectedSolicitud.motivo }}"
          </div>
        </div>

        <!-- Consenso Tripartito Visual Cards -->
        <div class="space-y-3">
          <h3 class="text-xs font-black uppercase text-slate-400 tracking-wider">Consenso Tripartito de Autorización</h3>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div 
              v-for="item in getApprovalMatrix(selectedSolicitud)" 
              :key="item.rol"
              :class="[
                'p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2',
                !item.aprobacion 
                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40' 
                  : item.aprobacion.accion === 'APROBAR'
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
              ]"
            >
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">{{ item.label }}</span>
                  <span :class="[
                    'px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1',
                    !item.aprobacion 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' 
                      : item.aprobacion.accion === 'APROBAR'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : item.aprobacion.accion === 'RECHAZAR'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                      : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                  ]">
                    <Clock v-if="!item.aprobacion" :size="10" />
                    <CheckCircle2 v-else-if="item.aprobacion.accion === 'APROBAR'" :size="10" />
                    <XCircle v-else :size="10" />
                    <span>
                      {{ 
                        !item.aprobacion 
                          ? 'Pendiente' 
                          : item.aprobacion.accion === 'APROBAR' 
                          ? 'Aprobado' 
                          : item.aprobacion.accion === 'RECHAZAR' 
                          ? 'Rechazado' 
                          : 'Cancelado' 
                      }}
                    </span>
                  </span>
                </div>
                <p class="font-bold text-slate-800 dark:text-white text-xs truncate" :title="item.entidad">{{ item.entidad }}</p>
              </div>

              <div class="text-[10px] pt-2 border-t border-slate-200/50 dark:border-slate-800">
                <template v-if="item.aprobacion">
                  <p :class="[
                    'font-bold truncate',
                    item.aprobacion.accion === 'APROBAR' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                  ]">
                    {{ item.aprobacion.accion === 'APROBAR' ? '✓' : '✗' }} {{ item.aprobacion.usuario_nombre }} {{ item.aprobacion.usuario_apellido }}
                  </p>
                  <p class="text-slate-400 font-mono text-[9px] mt-0.5">{{ formatDate(item.aprobacion.fecha) }}</p>
                </template>
                <template v-else>
                  <p class="text-amber-700 dark:text-amber-400 font-semibold italic">
                    ⏳ Pendiente por responder
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
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-bold text-slate-900 dark:text-white">{{ ap.usuario_nombre }} {{ ap.usuario_apellido }}</span>
                    <span class="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-black uppercase">{{ ap.rol }}</span>
                    <span 
                      v-if="ap.accion === 'APROBAR' && ap.grupo_destino_grado && (ap.rol === 'DIRECTIVO_DESTINO' || ap.rol === 'ADMIN_GENERAL')" 
                      class="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px] font-bold"
                    >
                      🎯 Asignó: {{ ap.grupo_destino_grado }} - {{ ap.grupo_destino_seccion }} ({{ ap.grupo_destino_jornada }})
                    </span>
                  </div>
                  <p v-if="ap.comentario" class="text-slate-600 dark:text-slate-400 mt-1 italic font-normal">"{{ ap.comentario }}"</p>
                  <p class="text-[10px] text-slate-400 mt-1">{{ formatDate(ap.fecha) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Verificación de Cupos y Selección de Grupo para Colegio Destino -->
        <div v-if="selectedSolicitud.tipo === 'TRASLADO_MATRICULA' && canUserApproveCurrentModal && (isDirectivoDestino || isAdminGeneral)" class="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black uppercase text-slate-600 dark:text-slate-300">
              Disponibilidad en Grado: <span class="text-indigo-600 dark:text-indigo-400">{{ disponibilidadCupos?.grado_nombre || 'Consultando...' }}</span>
            </span>
            <span v-if="disponibilidadCupos" :class="[
              'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase',
              disponibilidadCupos.hay_cupos ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
            ]">
              {{ disponibilidadCupos.hay_cupos ? `${disponibilidadCupos.cupos_totales_grado} Cupos Disponibles` : 'Sin Cupos' }}
            </span>
          </div>

          <div v-if="disponibilidadCupos && !disponibilidadCupos.hay_cupos && disponibilidadCupos.grupos.length > 0" class="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
            <AlertTriangle :size="16" class="shrink-0" />
            <span>No hay cupos disponibles en el grado solicitado. No es posible aprobar el traslado; debe rechazarlo o habilitar cupos en su institución.</span>
          </div>

          <div v-else-if="disponibilidadCupos && disponibilidadCupos.grupos.length > 0" class="space-y-1.5">
            <label class="block text-[11px] font-bold text-slate-500 uppercase">Seleccionar Grupo / Jornada de Destino (Recomendado):</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button 
                v-for="g in disponibilidadCupos.grupos" 
                :key="g.id_grupo"
                type="button"
                @click="selectedGrupoDestino = selectedGrupoDestino === g.id_grupo ? null : g.id_grupo"
                :disabled="g.cupos_disponibles <= 0"
                :class="[
                  'p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between gap-2',
                  selectedGrupoDestino === g.id_grupo 
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500' 
                    : g.cupos_disponibles > 0 
                    ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300' 
                    : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                ]"
              >
                <div>
                  <p class="font-bold text-slate-800 dark:text-slate-100">{{ g.nombre_completo }}</p>
                  <p class="text-[10px] text-slate-400 font-medium">Jornada: {{ g.jornada }}</p>
                </div>
                <span class="text-[10px] font-black shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {{ g.cupos_disponibles }} cupos
                </span>
              </button>
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
              :disabled="submitting || Boolean(disponibilidadCupos && !disponibilidadCupos.hay_cupos && disponibilidadCupos.grupos.length > 0)"
              class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
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
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-6 md:p-7 shrink-0">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Plus :size="20" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white">Nueva Solicitud de Traslado</h2>
              <p class="text-xs text-slate-400">Registrar traslado interinstitucional de estudiante o usuario</p>
            </div>
          </div>
          <button 
            @click="showCreateModal = false"
            class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- Form Fields (Scrollable) -->
        <div class="p-6 md:p-7 space-y-4 text-xs overflow-y-auto flex-1">
          
          <!-- Tipo de Traslado -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Traslado</label>
            <select 
              v-model="newTraslado.tipo"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="TRASLADO_MATRICULA">Estudiante (Matrícula Escolar)</option>
              <option value="TRASLADO_USUARIO">Personal / Docente</option>
              <option v-if="isAdminGeneral" value="TRASLADO_DIRECTIVO">Directivo (Requiere Autorización)</option>
            </select>
          </div>

          <!-- Colegio Origen (Solo editable para Admin General) -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Institución de Origen</label>
            <select 
              v-if="isAdminGeneral"
              v-model="newTraslado.id_colegio_origen"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option v-for="c in colegios" :key="c.id_colegio" :value="c.id_colegio">
                {{ c.nombre }}
              </option>
            </select>
            <input 
              v-else
              type="text"
              disabled
              :value="colegios.find(c => c.id_colegio === newTraslado.id_colegio_origen)?.nombre || 'Mi Institución Actual'"
              class="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 font-bold"
            />
          </div>

          <!-- Usuario / Estudiante a trasladar -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {{ newTraslado.tipo === 'TRASLADO_MATRICULA' ? 'Estudiante a Trasladar' : 'Usuario / Funcionario a Trasladar' }}
            </label>

            <!-- Selector para Matrícula de Estudiante -->
            <select 
              v-if="newTraslado.tipo === 'TRASLADO_MATRICULA'"
              v-model="newTraslado.id_usuario"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null">Selecciona un estudiante activo...</option>
              <option v-for="e in estudiantesColegio" :key="e.id_usuario" :value="e.id_usuario">
                {{ e.nombre }} {{ e.apellido }} (Doc: {{ e.documento }} | {{ formatStudentGrade(e) }})
              </option>
            </select>

            <!-- Selector para Personal / Docente -->
            <select 
              v-else-if="newTraslado.tipo === 'TRASLADO_USUARIO'"
              v-model="newTraslado.id_usuario"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null">Selecciona un docente/funcionario...</option>
              <option v-for="p in personalColegio" :key="p.id_usuario" :value="p.id_usuario">
                {{ p.nombre }} {{ p.apellido }} (Doc: {{ p.documento }} - {{ p.rol }})
              </option>
            </select>

            <!-- Selector para Directivos (Admin General) -->
            <select 
              v-else
              v-model="newTraslado.id_usuario"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null">Selecciona un directivo...</option>
              <option v-for="d in directivosColegio" :key="d.id_usuario" :value="d.id_usuario">
                {{ d.nombre }} {{ d.apellido }} (Doc: {{ d.documento }})
              </option>
            </select>
          </div>

          <!-- Colegio Destino -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Institución de Destino</label>
            <select 
              v-model="newTraslado.id_colegio_destino"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null">Selecciona la institución receptora...</option>
              <option 
                v-for="c in colegios.filter(col => col.id_colegio !== newTraslado.id_colegio_origen)" 
                :key="c.id_colegio" 
                :value="c.id_colegio"
              >
                {{ c.nombre }}
              </option>
            </select>
          </div>

          <!-- Jornada Sugerida (Solo para matrícula) -->
          <div v-if="newTraslado.tipo === 'TRASLADO_MATRICULA'">
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Jornada de Preferencia (Opcional)</label>
            <select 
              v-model="newTraslado.jornada_sugerida"
              class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="INDIFERENTE">Cualquier Jornada (Indiferente)</option>
              <option value="MAÑANA">Jornada Mañana</option>
              <option value="TARDE">Jornada Tarde</option>
              <option value="COMPLETA">Jornada Completa / Única</option>
              <option value="NOCHE">Jornada Nocturna</option>
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

        <!-- Form Actions (Fixed at bottom) -->
        <div class="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 p-4 md:p-6 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
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
