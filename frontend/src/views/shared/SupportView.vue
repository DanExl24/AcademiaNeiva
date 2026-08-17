<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { 
  LifeBuoy, 
  Send, 
  CheckCircle2, 
  User, 
  Mail, 
  Phone, 
  HelpCircle, 
  FileText, 
  ArrowLeft,
  School,
  Loader2,
  AlertCircle,
  Filter,
  RefreshCw,
  Clock,
  ShieldAlert
} from 'lucide-vue-next'
import axios from 'axios'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { confirm } = useConfirm()
const toast = useToast()


// Comprobar si es directivo o admin general
const isStaff = computed(() => {
  const role = auth.activeRole?.toUpperCase()
  return role === 'DIRECTIVO' || role === 'ADMIN_GENERAL'
})

// Visitante/Docente/Padre/Estudiante Form states
const name = ref('')
const email = ref('')
const phone = ref('')
const category = ref('TECNICO')
const subject = ref('')
const description = ref('')
const selectedSchoolId = ref<number | null>(null)

// Data lists
const schools = ref<any[]>([])
const tickets = ref<any[]>([])
const loading = ref(false)
const loadingSchools = ref(false)
const submitting = ref(false)
const generatedTicketCode = ref<string | null>(null)
const errorMsg = ref('')

// Filter states for Staff
const filterStatus = ref<'TODOS' | 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO' | 'ESCALADO'>('TODOS')
const searchQuery = ref('')
const showEscalatedOnly = ref(false) // Para Directivos: ver escalados al Admin General

// Modo Seguimiento de Tickets para el Usuario
const showTrackingMode = ref(false)

// Observaciones inline
const observationsInputs = ref<Record<number, string>>({})
const submittingObs = ref<Record<number, boolean>>({})

const fetchSchools = async () => {
  if (auth.isAuthenticated) return
  try {
    loadingSchools.value = true
    const res = await axios.get('/api/matriculas')
    schools.value = res.data || []
  } catch (error) {
    console.error('Error fetching schools:', error)
  } finally {
    loadingSchools.value = false
  }
}

const fetchTickets = async () => {
  if (!isStaff.value) return
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    let url = '/api/support/tickets'
    if (showEscalatedOnly.value) {
      url += '?escalados=true'
    }
    const res = await axios.get(url, { headers })
    
    // Al cargar tickets, inicializamos su array de observaciones si vienen serializadas
    tickets.value = (res.data.tickets || []).map((t: any) => {
      let obs = []
      if (typeof t.observaciones === 'string') {
        try {
          obs = JSON.parse(t.observaciones)
        } catch {
          obs = []
        }
      } else if (Array.isArray(t.observaciones)) {
        obs = t.observaciones
      }
      return { ...t, observaciones: obs }
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    errorMsg.value = 'No se pudieron cargar los tickets de soporte de tu institución.'
  } finally {
    loading.value = false
  }
}

const toggleEscalatedFilter = () => {
  showEscalatedOnly.value = !showEscalatedOnly.value
  filterStatus.value = 'TODOS'
  fetchTickets()
}

const updateTicketStatus = async (ticketId: number, newStatus: string) => {
  const t = tickets.value.find(ticket => ticket.id_ticket === ticketId)
  if (!t) return

  if (newStatus === 'EN_PROCESO' && (t.tipo_incidencia === 'REINGRESO' || t.estado === 'ABIERTO')) {
    const okProcess = await confirm({
      title: 'Iniciar Trámite de Reingreso',
      message: 'Al cambiar el estado del ticket a EN PROCESO, se enviará automáticamente un correo electrónico al acudiente notificándole que el trámite ha comenzado. Este ticket ya no podrá volver al estado ABIERTO.',
      confirmText: 'Pasar a En Proceso',
      type: 'warning'
    })
    if (!okProcess) {
      fetchTickets()
      return
    }
  }

  if (newStatus === 'RESUELTO') {
    const ok = await confirm({
      title: 'Resolver Incidencia',
      message: '¿Estás seguro de pasar el estado de este ticket a RESUELTO? Una vez resuelto, el ticket pasará a ser de solo lectura y no se podrán agregar más comentarios ni modificar su estado.',
      confirmText: 'Marcar como Resuelto',
      type: 'primary'
    })
    if (!ok) {
      fetchTickets()
      return
    }
  }

  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.put(`/api/support/tickets/${ticketId}/status`, { estado: newStatus }, { headers })
    
    // Actualizar localmente el estado del ticket
    t.estado = newStatus
    toast.success(`Estado del ticket actualizado a ${newStatus}`)
    // Si el directivo lo marca como ESCALADO (si correspondiese), lo removemos de la lista local
    if (newStatus === 'ESCALADO' && !showEscalatedOnly.value && auth.activeRole?.toUpperCase() === 'DIRECTIVO') {
      tickets.value = tickets.value.filter(ticket => ticket.id_ticket !== ticketId)
    }
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al actualizar el estado del ticket.')
    fetchTickets()
  }
}

const escalateTicketFrontend = async (ticketId: number) => {
  const ok = await confirm({
    title: 'Escalar Incidencia',
    message: '¿Estás seguro de que deseas escalar esta incidencia al Administrador General?',
    confirmText: 'Escalar al Admin',
    type: 'warning'
  })
  if (!ok) return

  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post(`/api/support/tickets/${ticketId}/escalar`, {}, { headers })
    toast.success('Incidencia escalada exitosamente al Administrador General.')
    
    // Remover localmente de la lista, ya que ahora es exclusiva del Admin General (o de ver escalados)
    tickets.value = tickets.value.filter(t => t.id_ticket !== ticketId)
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al escalar la incidencia.')
  }
}


const fetchTrackingTicket = async () => {
  if (!trackingCodeInput.value.trim()) return
  try {
    searchingTracking.value = true
    trackingError.value = ''
    trackingTicketData.value = null

    const res = await axios.get(`/api/support/tickets/track/${trackingCodeInput.value.trim()}`)
    trackingTicketData.value = res.data.ticket
  } catch (error: any) {
    trackingError.value = error.response?.data?.error || 'Error al consultar el seguimiento. Valida que el código sea correcto.'
  } finally {
    searchingTracking.value = false
  }
}

const saveObservation = async (ticketId: number) => {
  const note = observationsInputs.value[ticketId]
  if (!note || !note.trim()) return

  try {
    submittingObs.value[ticketId] = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.post(`/api/support/tickets/${ticketId}/observaciones`, {
      observacion: note
    }, { headers })

    // Actualizar localmente el array de observaciones del ticket
    const t = tickets.value.find(ticket => ticket.id_ticket === ticketId)
    if (t) {
      t.observaciones = res.data.observaciones || []
    }
    observationsInputs.value[ticketId] = ''
    alert('Observación guardada y registrada exitosamente.')
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al registrar la observación.')
  } finally {
    submittingObs.value[ticketId] = false
  }
}

const handleNotifyNonExistent = async (ticketId: number) => {
  const motivo = prompt('Ingresa la observación para notificar que el estudiante no fue encontrado en los registros:')
  if (motivo === null) return
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post(`/api/reingreso/notify-nonexistent/${ticketId}`, { motivo }, { headers })
    alert('Notificación enviada exitosamente al usuario y ticket resuelto.')
    fetchTickets()
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al enviar notificación')
  }
}

const myChildren = ref<any[]>([])
const selectedChildIdForTicket = ref<number | null>(null)
const catalogGrados = ref<any[]>([])
const selectedPreferredGradeIdForTicket = ref<any>('')
const myTickets = ref<any[]>([])
const myTicketsFilter = ref('TODOS')

const fetchGradosCatalog = async () => {
  try {
    const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
    const schoolParam = selectedSchoolId.value ? `?schoolId=${selectedSchoolId.value}` : ''
    const res = await axios.get(`/api/reingreso/catalogs${schoolParam}`, { headers })
    catalogGrados.value = res.data.grados || []
  } catch (err) {
    console.error('Error cargando catálogos de grados:', err)
  }
}
const trackingCodeInput = ref('')
const searchingTracking = ref(false)
const trackingError = ref('')
const trackingTicketData = ref<any>(null)
const visitorResponseInput = ref('')
const submittingVisitorObs = ref<boolean>(false)

// Estados para Modal de Autorización de Matrícula Extraordinaria por Ticket
const showExtraordinaryModal = ref(false)
const selectedTicketForExtraordinary = ref<any>(null)
const extraordinaryStudentMode = ref<'NUEVO' | 'EXISTENTE'>('NUEVO')
const selectedStudentIdForExtraordinary = ref<number | null>(null)
const extraordinaryParentEmail = ref('')
const extraordinaryReason = ref('')
const submittingExtraordinary = ref(false)
const institutionStudents = ref<any[]>([])

const openExtraordinaryModal = async (ticket: any) => {
  selectedTicketForExtraordinary.value = ticket
  extraordinaryParentEmail.value = ticket.correo_remitente || ''
  extraordinaryStudentMode.value = 'NUEVO'
  selectedStudentIdForExtraordinary.value = null
  extraordinaryReason.value = `Autorización de Matrícula Extraordinaria en respuesta al ticket ${ticket.codigo_ticket}`
  showExtraordinaryModal.value = true

  if (auth.token && institutionStudents.value.length === 0) {
    try {
      const headers = { Authorization: `Bearer ${auth.token}` }
      const res = await axios.get('/api/students', { headers })
      institutionStudents.value = res.data.estudiantes || res.data || []
    } catch (err) {
      console.error('Error cargando estudiantes para selector:', err)
    }
  }
}

const submitExtraordinaryEnrollment = async () => {
  if (!selectedTicketForExtraordinary.value) return
  try {
    submittingExtraordinary.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const payload = {
      id_ticket: selectedTicketForExtraordinary.value.id_ticket,
      correo_padre: extraordinaryParentEmail.value,
      id_estudiante: extraordinaryStudentMode.value === 'EXISTENTE' ? selectedStudentIdForExtraordinary.value : null,
      motivo: extraordinaryReason.value
    }
    await axios.post('/api/academic-admin/matriculas/extraordinaria', payload, { headers })
    alert('Matrícula extraordinaria autorizada exitosamente. Se ha enviado el correo con el token de seguimiento al acudiente.')
    showExtraordinaryModal.value = false
    fetchTickets()
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al autorizar la matrícula extraordinaria.')
  } finally {
    submittingExtraordinary.value = false
  }
}

const fetchMyChildren = async () => {
  if (!auth.isAuthenticated || !auth.user?.id) return
  try {
    const res = await axios.get(`/api/student/parent-children/${auth.user.id}`)
    myChildren.value = res.data || []
    if (myChildren.value.length > 0) {
      selectedChildIdForTicket.value = myChildren.value[0].id_estudiante
    }
  } catch (err) {
    console.error('Error cargando hijos del acudiente:', err)
  }
}

const fetchMyTickets = async () => {
  if (!auth.token) return
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('/api/support/tickets', { headers })
    myTickets.value = (res.data.tickets || []).map((t: any) => {
      let obs = []
      if (typeof t.observaciones === 'string') {
        try {
          obs = JSON.parse(t.observaciones)
        } catch {
          obs = []
        }
      } else if (Array.isArray(t.observaciones)) {
        obs = t.observaciones
      }
      return { ...t, observaciones: obs }
    })

    if (myTickets.value.length > 0 && !trackingTicketData.value) {
      selectMyTicket(myTickets.value[0])
    }
  } catch (err) {
    console.error('Error cargando mis tickets:', err)
  } finally {
    loading.value = false
  }
}

const filteredMyTickets = computed(() => {
  let list = myTickets.value
  if (myTicketsFilter.value === 'ESCALADOS') {
    list = list.filter((t: any) => t.fecha_escalado)
  } else if (myTicketsFilter.value !== 'TODOS') {
    list = list.filter((t: any) => t.estado === myTicketsFilter.value)
  }

  if (trackingCodeInput.value.trim()) {
    const q = trackingCodeInput.value.trim().toLowerCase()
    list = list.filter((t: any) => 
      (t.codigo_ticket && t.codigo_ticket.toLowerCase().includes(q)) ||
      t.asunto.toLowerCase().includes(q) ||
      t.descripcion.toLowerCase().includes(q)
    )
  }

  return list
})

const selectMyTicket = (t: any) => {
  trackingTicketData.value = t
  visitorResponseInput.value = ''
}

const canVisitorRespond = computed(() => {
  if (!trackingTicketData.value) return false
  if (trackingTicketData.value.estado === 'RESUELTO') return false
  const obs = trackingTicketData.value.observaciones || []
  if (obs.length === 0) return false
  const lastObs = obs[obs.length - 1]
  return lastObs.tipo === 'ADMIN_GENERAL' || lastObs.tipo === 'DIRECTIVO'
})

const submitVisitorResponse = async () => {
  if (!trackingTicketData.value || !visitorResponseInput.value.trim()) return
  try {
    submittingVisitorObs.value = true
    const ticketId = trackingTicketData.value.id_ticket
    const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
    const res = await axios.post(`/api/support/tickets/${ticketId}/observaciones`, {
      observacion: visitorResponseInput.value.trim()
    }, { headers })

    trackingTicketData.value.observaciones = res.data.observaciones || []
    visitorResponseInput.value = ''
    alert('Respuesta enviada exitosamente.')
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al enviar respuesta')
  } finally {
    submittingVisitorObs.value = false
  }
}

onMounted(() => {
  fetchGradosCatalog()
  if (isStaff.value) {
    fetchTickets()
  } else {
    fetchSchools()
    if (auth.isAuthenticated && auth.user) {
      name.value = auth.user.name || ''
      email.value = auth.user.email || ''
      selectedSchoolId.value = auth.user.schoolId ? Number(auth.user.schoolId) : null
      showTrackingMode.value = true
      fetchMyTickets()
      fetchMyChildren()
    }

    // Cargar parámetros de plantilla desde la URL si están presentes
    if (route.query.tipo_incidencia) {
      category.value = String(route.query.tipo_incidencia)
    }
    if (route.query.asunto) {
      subject.value = String(route.query.asunto)
    }
    if (route.query.descripcion) {
      description.value = String(route.query.descripcion)
    }
  }
})

const isFormValid = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const hasContactInfo = auth.isAuthenticated ? true : (name.value.trim().length > 0 && emailRegex.test(email.value))
  const hasSchool = auth.isAuthenticated ? true : selectedSchoolId.value !== null
  return hasContactInfo && hasSchool && subject.value.trim().length > 0 && description.value.trim().length >= 10
})

const handleSubmit = async () => {
  if (!isFormValid.value || submitting.value) return

  try {
    submitting.value = true
    errorMsg.value = ''

    const headers: any = {}
    if (auth.token) {
      headers.Authorization = `Bearer ${auth.token}`
    }

    const payload = {
      nombre_remitente: name.value,
      correo_remitente: email.value,
      telefono: phone.value || null,
      tipo_incidencia: category.value,
      asunto: subject.value,
      descripcion: description.value,
      id_colegio: selectedSchoolId.value,
      id_estudiante: category.value === 'REINGRESO' ? selectedChildIdForTicket.value : null,
      id_tipo_grado_pretendido: category.value === 'REINGRESO' && selectedPreferredGradeIdForTicket.value ? Number(selectedPreferredGradeIdForTicket.value) : null
    }

    const response = await axios.post('/api/support/tickets', payload, { headers })
    generatedTicketCode.value = response.data.ticketCode
    
    subject.value = ''
    description.value = ''
    phone.value = ''
    alert(`Ticket de soporte creado exitosamente con el código: ${response.data.ticketCode}`)
    showTrackingMode.value = true
    fetchMyTickets()
  } catch (error: any) {
    errorMsg.value = error.response?.data?.error || 'Error al enviar el ticket de soporte.'
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  if (auth.isAuthenticated) {
    router.push('/dashboard')
  } else {
    router.push('/login')
  }
}

// Staff filtering
const filteredTickets = computed(() => {
  let result = tickets.value

  if (filterStatus.value !== 'TODOS') {
    result = result.filter(t => t.estado === filterStatus.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t => 
      t.asunto.toLowerCase().includes(q) ||
      t.descripcion.toLowerCase().includes(q) ||
      t.nombre_remitente.toLowerCase().includes(q) ||
      t.correo_remitente.toLowerCase().includes(q) ||
      `tkt-${new Date(t.fecha_creacion).getFullYear()}-${String(t.id_ticket).padStart(5, '0')}`.toLowerCase().includes(q) ||
      (t.codigo_ticket && t.codigo_ticket.toLowerCase().includes(q))
    )
  }

  return result
})

const getCategoryBadgeClass = (cat: string) => {
  if (cat === 'MATRICULA_EXTRAORDINARIA') return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400'
  if (cat === 'REINGRESO') return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400'
  if (cat === 'TECNICO') return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-455'
  if (cat === 'CALIFICACIONES') return 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/20 dark:text-violet-400'
  if (cat === 'ASISTENCIA') return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400'
  if (cat === 'AUTENTICACION') return 'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400'
  return 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-800/40 dark:text-slate-400'
}

const getCategoryLabel = (cat: string) => {
  if (cat === 'MATRICULA_EXTRAORDINARIA') return 'Matrícula Extraordinaria'
  if (cat === 'REINGRESO') return 'Reingreso Estudiantil'
  if (cat === 'TECNICO') return 'Técnico / Error'
  if (cat === 'CALIFICACIONES') return 'Notas / Periodos'
  if (cat === 'ASISTENCIA') return 'Asistencia'
  if (cat === 'AUTENTICACION') return 'Autenticación'
  return 'General / Sugerencia'
}

const getTicketCode = (t: any) => {
  if (t.codigo_ticket) return t.codigo_ticket
  return `TKT-${new Date(t.fecha_creacion).getFullYear()}-${String(t.id_ticket).padStart(5, '0')}`
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getObservationAuthor = (obs: any) => {
  if (obs.nombre_usuario) {
    const roleText = obs.tipo ? ` (${obs.tipo === 'ADMIN_GENERAL' ? 'Admin General' : 'Directivo'})` : ''
    return `${obs.nombre_usuario}${roleText}`
  }
  return obs.autor || 'Soporte / Sistema'
}

const getObservationDate = (obs: any) => {
  return obs.fecha_creacion || obs.fecha
}

const getObservationText = (obs: any) => {
  return obs.mensaje || obs.texto || ''
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 transition-colors duration-500 flex flex-col justify-center items-center">
    
    <!-- 0. BLOCKED VIEW: When in Monitoring Mode -->
    <div v-if="auth.isMonitoring" class="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
      <div class="w-16 h-16 bg-amber-50 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
        <ShieldAlert class="w-8 h-8" />
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Soporte Técnico Bloqueado</h2>
        <p class="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">Modo Monitoreo Activo</p>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        No está permitido crear ni enviar tickets de soporte técnico en nombre de un docente o acudiente mientras estás en Modo Monitoreo.
      </p>
      <div class="pt-2">
        <button
          @click="router.push('/dashboard')"
          class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-colors shadow-md"
        >
          Volver al Dashboard
        </button>
      </div>
    </div>

    <!-- 1. STAFF VIEW: Tickets Management Dashboard -->
    <div v-else-if="isStaff" class="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-10 relative overflow-hidden transition-all duration-300">
      
      <!-- Back button -->
      <button 
        @click="goBack" 
        class="absolute top-8 left-8 flex items-center gap-2 text-xs font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-widest"
      >
        <ArrowLeft :size="16" />
        Regresar
      </button>

      <!-- Header -->
      <div class="mt-8 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
              <LifeBuoy class="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Bandeja de Soporte</h1>
              <p class="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Tickets recibidos de tu institución educativa
              </p>
            </div>
          </div>
        </div>

        <button 
          @click="fetchTickets" 
          :disabled="loading"
          class="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw :size="14" :class="{'animate-spin': loading}" />
          Refrescar
        </button>
      </div>

      <!-- Filters & Search Bar -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="md:col-span-2 flex gap-3">
          <div class="flex-1 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 rounded-2xl border border-slate-150/40 dark:border-slate-700/60 flex items-center gap-3">
            <Filter class="text-slate-400 shrink-0" :size="18" />
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Buscar por código, asunto, remitente o correo..."
              class="w-full bg-transparent border-none text-slate-850 dark:text-slate-200 placeholder-slate-400 focus:outline-none text-sm font-semibold"
            />
          </div>
          <button 
            v-if="auth.activeRole?.toUpperCase() === 'DIRECTIVO'"
            @click="toggleEscalatedFilter"
            class="px-4 py-3 text-xs font-black uppercase tracking-widest rounded-2xl border transition-all shrink-0 flex items-center gap-2"
            :class="showEscalatedOnly ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-100 dark:shadow-none' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-750'"
          >
            <ShieldAlert :size="14" />
            {{ showEscalatedOnly ? 'Ver Internos' : 'Ver Escalados' }}
          </button>
        </div>

        <div class="bg-slate-50 dark:bg-slate-800/40 px-4 py-2 rounded-2xl border border-slate-150/40 dark:border-slate-700/60 flex items-center gap-2">
          <span class="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest whitespace-nowrap ml-1">Estado:</span>
          <select 
            v-model="filterStatus"
            class="w-full bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-350 outline-none focus:ring-0 cursor-pointer"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ABIERTO">Abiertos</option>
            <option value="EN_PROCESO">En Proceso</option>
            <option value="ESCALADO">Escalados</option>
            <option value="RESUELTO">Resueltos</option>
          </select>
        </div>
      </div>

      <!-- Error status -->
      <div v-if="errorMsg" class="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex items-center gap-3 mb-6">
        <AlertCircle class="w-5 h-5 text-red-650 dark:text-red-405 shrink-0" />
        <p class="text-xs font-bold text-red-700 dark:text-red-405">{{ errorMsg }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center p-20 bg-slate-50/50 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl transition-all">
        <Loader2 class="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
        <p class="text-slate-550 dark:text-slate-400 font-bold text-sm">Consultando bandeja de soporte...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredTickets.length === 0" class="bg-slate-50/30 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] p-16 text-center shadow-inner transition-colors duration-300">
        <LifeBuoy :size="60" class="mx-auto text-slate-200 dark:text-slate-750 mb-4" />
        <h3 class="text-lg font-black text-slate-800 dark:text-slate-200">No se encontraron tickets</h3>
        <p class="text-slate-500 max-w-xs mx-auto mt-2 text-xs font-semibold leading-relaxed">
          No hay solicitudes de soporte técnico registradas que coincidan con los filtros activos.
        </p>
      </div>

      <!-- Tickets list grid -->
      <div v-else class="space-y-4">
        <div 
          v-for="t in filteredTickets" 
          :key="t.id_ticket"
          class="p-6 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 rounded-3xl hover:shadow-md transition-all duration-300"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/50">
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/60 rounded-xl font-mono text-xs font-black">
                {{ getTicketCode(t) }}
              </span>
              <span 
                class="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border rounded-full"
                :class="getCategoryBadgeClass(t.tipo_incidencia)"
              >
                {{ getCategoryLabel(t.tipo_incidencia) }}
              </span>
            </div>

            <!-- Interactive state selector or static label for staff -->
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest">Estado:</span>
              
              <!-- RN-005: Si está escalado y es un Directivo, o si el ticket está RESUELTO, mostrar solo texto plano -->
              <span 
                v-if="t.estado === 'RESUELTO' || ((t.fecha_escalado || t.estado === 'ESCALADO') && auth.activeRole?.toUpperCase() === 'DIRECTIVO')"
                class="px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/80"
                :class="{
                  'text-rose-600 dark:text-rose-455': t.estado === 'ABIERTO',
                  'text-amber-605 dark:text-amber-500': t.estado === 'EN_PROCESO',
                  'text-emerald-600 dark:text-emerald-400': t.estado === 'RESUELTO',
                  'text-indigo-650 dark:text-indigo-400': t.estado === 'ESCALADO'
                }"
              >
                {{ t.estado === 'ABIERTO' ? 'Abierto' : t.estado === 'EN_PROCESO' ? 'En Proceso' : t.estado === 'RESUELTO' ? 'Resuelto' : 'Escalado' }}
              </span>

              <!-- En otro caso, mostrar selector interactivo -->
              <select 
                v-else
                v-model="t.estado"
                @change="updateTicketStatus(t.id_ticket, t.estado)"
                class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer focus:outline-none"
                :class="{
                  'text-rose-600 dark:text-rose-455': t.estado === 'ABIERTO',
                  'text-amber-605 dark:text-amber-500': t.estado === 'EN_PROCESO',
                  'text-emerald-600 dark:text-emerald-400': t.estado === 'RESUELTO',
                  'text-indigo-650 dark:text-indigo-400': t.estado === 'ESCALADO'
                }"
              >
                <option v-if="t.estado === 'ABIERTO'" value="ABIERTO">Abierto</option>
                <option v-if="t.estado === 'ESCALADO'" value="ESCALADO">Escalado</option>
                <option value="EN_PROCESO">En Proceso</option>
                <option value="RESUELTO">Resuelto</option>
              </select>

              <!-- Acciones Especiales para Reingreso (Directivo) -->
              <button 
                v-if="auth.activeRole?.toUpperCase() === 'DIRECTIVO' && t.tipo_incidencia === 'REINGRESO' && t.estado !== 'RESUELTO'"
                @click="router.push(`/dashboard/gestion-reingresos?ticketId=${t.id_ticket}${t.id_estudiante ? '&studentId=' + t.id_estudiante : ''}`)"
                class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                title="Abrir panel especializado de reingreso para este ticket"
              >
                🔄 Procesar Reingreso
              </button>

              <!-- Acciones Especiales para Matrícula Extraordinaria (Directivo) -->
              <button 
                v-if="auth.activeRole?.toUpperCase() === 'DIRECTIVO' && t.tipo_incidencia === 'MATRICULA_EXTRAORDINARIA' && t.estado !== 'RESUELTO'"
                @click="openExtraordinaryModal(t)"
                class="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                title="Autorizar Matrícula Extraordinaria para este ticket"
              >
                ⚡ Autorizar Matrícula Extraordinaria
              </button>

              <button 
                v-if="auth.activeRole?.toUpperCase() === 'DIRECTIVO' && t.tipo_incidencia === 'REINGRESO' && t.estado !== 'RESUELTO'"
                @click="handleNotifyNonExistent(t.id_ticket)"
                class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                title="Notificar por correo que el estudiante no fue hallado"
              >
                ⚠️ Estudiante No Existe
              </button>

              <!-- RN-005: Botón de escalamiento interactivo o deshabilitado -->
              <!-- Caso 1: Ya fue escalado (cualquier estado) -->
              <button 
                v-if="auth.activeRole?.toUpperCase() === 'DIRECTIVO' && t.fecha_escalado"
                disabled
                class="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-750 rounded-xl text-xs font-black uppercase tracking-wider cursor-not-allowed transition-all"
              >
                Escalado
              </button>
              <!-- Caso 2: Resuelto sin escalar -->
              <span 
                v-else-if="auth.activeRole?.toUpperCase() === 'DIRECTIVO' && !t.fecha_escalado && t.estado === 'RESUELTO'"
                class="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 rounded-xl text-xs font-black uppercase tracking-wider"
              >
                No Escalado
              </span>
              <!-- Caso 3: No resuelto y sin escalar → botón activo -->
              <button 
                v-else-if="auth.activeRole?.toUpperCase() === 'DIRECTIVO' && !t.fecha_escalado"
                @click="escalateTicketFrontend(t.id_ticket)"
                class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Escalar
              </button>
            </div>
          </div>

          <!-- Description and details -->
          <div class="py-4 space-y-3">
            <h3 class="font-black text-slate-850 dark:text-slate-200 text-sm">{{ t.asunto }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              {{ t.descripcion }}
            </p>

            <!-- Ficha del Estudiante Seleccionado para Reingreso -->
            <div v-if="t.estudiante_nombre" class="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-0.5">🎓 Estudiante Seleccionado para Reingreso</span>
                <span class="font-bold text-slate-800 dark:text-slate-100">{{ t.estudiante_nombre }} {{ t.estudiante_apellido }}</span>
                <span class="text-slate-500 dark:text-slate-400 text-[11px] block font-mono">Doc: {{ t.estudiante_documento }} | Cód: {{ t.estudiante_codigo || 'N/A' }}</span>
              </div>
              <span class="px-2.5 py-1 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg self-start sm:self-auto">
                Estado: {{ t.estudiante_estado || 'RETIRADO' }}
              </span>
            </div>
          </div>

          <!-- Sender Snapshot Info -->
          <div class="pt-4 border-t border-slate-100 dark:border-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-bold text-slate-655 dark:text-slate-400">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div class="flex items-center gap-1.5">
                <User :size="13" class="text-slate-400" />
                <span>{{ t.nombre_remitente }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Mail :size="13" class="text-slate-400" />
                <a :href="`mailto:${t.correo_remitente}`" class="hover:text-indigo-500 transition-colors">{{ t.correo_remitente }}</a>
              </div>
              <div v-if="t.telefono" class="flex items-center gap-1.5">
                <Phone :size="13" class="text-slate-400" />
                <span>{{ t.telefono }}</span>
              </div>
            </div>

            <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Clock :size="12" />
              <span>{{ formatDate(t.fecha_creacion) }}</span>
            </div>
          </div>

          <!-- Observation Logs -->
          <div v-if="t.observaciones && t.observaciones.length > 0" class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/40 space-y-3">
            <span class="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest">Historial de Observaciones:</span>
            <div class="space-y-2">
              <div v-for="(obs, idx) in t.observaciones" :key="idx" class="p-3 bg-indigo-50/10 dark:bg-slate-850/40 rounded-2xl border border-slate-150/40 dark:border-slate-800/10">
                <div class="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-1">
                  <span>{{ getObservationAuthor(obs) }}</span>
                  <span>{{ formatDate(getObservationDate(obs)) }}</span>
                </div>
                <p class="text-xs text-slate-655 dark:text-slate-350 font-semibold italic whitespace-pre-line">"{{ getObservationText(obs) }}"</p>
              </div>
            </div>
          </div>

          <!-- Observations Input (Only visible when ticket is not RESUELTO) -->
          <div v-if="t.estado !== 'RESUELTO'" class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/40 space-y-2">
            <span class="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest">Agregar Nota de Observación:</span>
            <div class="flex flex-col sm:flex-row gap-3">
              <textarea 
                v-model="observationsInputs[t.id_ticket]" 
                placeholder="Escribe una observación para este ticket..."
                rows="2"
                class="w-full p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl focus:border-indigo-500 outline-none resize-none transition-all"
              ></textarea>
              <button 
                @click="saveObservation(t.id_ticket)"
                :disabled="submittingObs[t.id_ticket] || !observationsInputs[t.id_ticket]?.trim()"
                class="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
              >
                <Loader2 v-if="submittingObs[t.id_ticket]" class="w-3 h-3 animate-spin mr-1" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. GUEST/NORMAL VIEW: Contact support form -->
    <div 
      v-else 
      :class="showTrackingMode ? 'max-w-5xl' : 'max-w-2xl'"
      class="w-full bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-10 relative overflow-hidden transition-all duration-300"
    >
      
      <!-- Back button -->
      <button 
        @click="goBack" 
        class="absolute top-8 left-8 flex items-center gap-2 text-xs font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-widest"
      >
        <ArrowLeft :size="16" />
        Regresar
      </button>

      <!-- Toggle Tracking/Contact switch -->
      <button 
        @click="showTrackingMode = !showTrackingMode; trackingTicketData = null; trackingError = ''" 
        class="absolute top-8 right-8 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
      >
        {{ showTrackingMode ? 'Ir al Formulario' : 'Ver mis tickets / Seguimiento' }}
      </button>

      <!-- Seguimiento de Ticket -->
      <div v-if="showTrackingMode" class="mt-8 space-y-6">
        
        <!-- Caso A: Usuario Autenticado (Docente/Padre) -->
        <div v-if="auth.isAuthenticated" class="space-y-6">
          <div class="text-center max-w-md mx-auto space-y-2">
            <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Mis Tickets de Soporte</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Consulta el estado de tus solicitudes creadas o escribe una respuesta a las observaciones del colegio.
            </p>
          </div>

          <!-- Si hay tickets, mostrar el split panel -->
          <div v-if="myTickets && myTickets.length > 0" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <!-- Columna Izquierda: Listado de Tickets -->
            <div class="lg:col-span-5 space-y-4">
              <!-- Buscador por Código o Palabra clave -->
              <div class="bg-slate-50 dark:bg-slate-800/40 px-3 py-2 rounded-2xl border border-slate-150/40 dark:border-slate-700/65 flex items-center gap-2">
                <input 
                  v-model="trackingCodeInput"
                  type="text"
                  placeholder="Buscar por código (ej: TKT-...) o asunto..."
                  class="w-full bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none placeholder-slate-400"
                />
              </div>

              <!-- Filtro de Estados -->
              <div class="bg-slate-50 dark:bg-slate-800/40 px-3 py-2 rounded-2xl border border-slate-150/40 dark:border-slate-700/65 flex items-center gap-2">
                <span class="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest whitespace-nowrap ml-1">Filtrar Estado:</span>
                <select 
                  v-model="myTicketsFilter"
                  class="w-full bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-350 outline-none focus:ring-0 cursor-pointer"
                >
                  <option value="TODOS">Todos mis tickets</option>
                  <option value="ABIERTO">Abiertos</option>
                  <option value="EN_PROCESO">En Proceso</option>
                  <option value="RESUELTO">Resueltos</option>
                  <option value="ESCALADOS">Escalados al Admin</option>
                </select>
              </div>

              <!-- Lista de Tickets -->
              <div class="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                <div 
                  v-for="t in filteredMyTickets"
                  :key="t.id_ticket"
                  @click="selectMyTicket(t)"
                  class="p-4 rounded-2xl border cursor-pointer transition-all text-left space-y-2"
                  :class="trackingTicketData && trackingTicketData.id_ticket === t.id_ticket
                    ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-500/50 shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700'"
                >
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-750 dark:text-slate-300 rounded-lg font-mono text-[10px] font-black">
                      {{ t.codigo_ticket || getTicketCode(t) }}
                    </span>
                    <div class="flex items-center gap-1.5">
                      <span v-if="t.fecha_escalado" class="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-[9px] font-black text-indigo-650 dark:text-indigo-400 rounded-md">Escalado</span>
                      <span 
                        class="px-1.5 py-0.5 text-[9px] font-black uppercase rounded-md"
                        :class="{
                          'bg-rose-50 text-rose-700': t.estado === 'ABIERTO',
                          'bg-amber-50 text-amber-700': t.estado === 'EN_PROCESO',
                          'bg-emerald-50 text-emerald-700': t.estado === 'RESUELTO',
                          'bg-indigo-50 text-indigo-700': t.estado === 'ESCALADO'
                        }"
                      >
                        {{ t.estado === 'ABIERTO' ? 'Abierto' : t.estado === 'EN_PROCESO' ? 'En Proceso' : t.estado === 'RESUELTO' ? 'Resuelto' : 'Escalado' }}
                      </span>
                    </div>
                  </div>
                  <h4 class="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1">{{ t.asunto }}</h4>
                  <p class="text-[10px] text-slate-455 dark:text-slate-500 font-semibold line-clamp-1 italic">"{{ t.descripcion }}"</p>
                  <div class="flex items-center justify-between text-[9px] text-slate-400 font-bold pt-1 border-t border-slate-50 dark:border-slate-850">
                    <span>{{ formatDate(t.fecha_creacion) }}</span>
                    <span>{{ t.observaciones ? t.observaciones.length : 0 }} obs</span>
                  </div>
                </div>
                
                <div v-if="filteredMyTickets.length === 0" class="p-8 bg-slate-50/50 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                  <p class="text-[11px] text-slate-400 font-bold italic">No se encontraron tickets con este filtro.</p>
                </div>
              </div>
            </div>

            <!-- Columna Derecha: Detalle de Ticket Seleccionado -->
            <div class="lg:col-span-7">
              <div v-if="trackingTicketData" class="p-6 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 rounded-[2rem] space-y-6 shadow-inner animate-in fade-in duration-300">
                
                <!-- DETALLE DEL TICKET -->
                <div class="pb-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                  <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/60 rounded-xl font-mono text-xs font-black">
                    {{ trackingTicketData.codigo_ticket || `TKT-${new Date(trackingTicketData.fecha_creacion).getFullYear()}-${String(trackingTicketData.id_ticket).padStart(5, '0')}` }}
                  </span>
                  
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Estado:</span>
                    <span 
                      class="px-3 py-1 text-[10px] font-black uppercase tracking-wider border rounded-full"
                      :class="{
                        'bg-rose-50 border-rose-100 text-rose-700': trackingTicketData.estado === 'ABIERTO',
                        'bg-amber-50 border-amber-100 text-amber-700': trackingTicketData.estado === 'EN_PROCESO',
                        'bg-emerald-50 border-emerald-100 text-emerald-700': trackingTicketData.estado === 'RESUELTO',
                        'bg-indigo-50 border-indigo-100 text-indigo-700': trackingTicketData.estado === 'ESCALADO'
                      }"
                    >
                      {{ trackingTicketData.estado === 'ABIERTO' ? '🔴 Abierto' : 
                         trackingTicketData.estado === 'EN_PROCESO' ? '🟡 En Proceso' : 
                         trackingTicketData.estado === 'RESUELTO' ? '🟢 Resuelto' : '🔵 Escalado' }}
                    </span>
                  </div>
                </div>

                <div class="space-y-3">
                  <div>
                    <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Asunto:</span>
                    <p class="font-black text-slate-850 dark:text-slate-200 text-sm mt-0.5">{{ trackingTicketData.asunto }}</p>
                  </div>
                  <div>
                    <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Descripción de la Incidencia:</span>
                    <p class="text-xs text-slate-655 dark:text-slate-400 leading-relaxed mt-0.5 whitespace-pre-line">{{ trackingTicketData.descripcion }}</p>
                  </div>
                  <div class="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Colegio:</span>
                      <p class="text-xs font-black text-slate-700 dark:text-slate-300 mt-0.5">{{ trackingTicketData.colegio_nombre || 'General / Público' }}</p>
                    </div>
                    <div>
                      <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Fecha de Creación:</span>
                      <p class="text-xs font-black text-slate-700 dark:text-slate-300 mt-0.5">{{ formatDate(trackingTicketData.fecha_creacion) }}</p>
                    </div>
                  </div>

                  <!-- Ficha del Estudiante Seleccionado para Reingreso (Para el Acudiente) -->
                  <div v-if="trackingTicketData.estudiante_nombre" class="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl space-y-1">
                    <span class="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">🎓 Estudiante Seleccionado para Reingreso:</span>
                    <p class="text-xs font-black text-slate-850 dark:text-slate-100">
                      {{ trackingTicketData.estudiante_nombre }} {{ trackingTicketData.estudiante_apellido }}
                    </p>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Documento: {{ trackingTicketData.estudiante_documento }} | Código: {{ trackingTicketData.estudiante_codigo || 'N/A' }} | Estado: {{ trackingTicketData.estudiante_estado || 'RETIRADO' }}
                    </p>
                  </div>
                </div>

                <!-- Observaciones del Colegio -->
                <div class="pt-6 border-t border-slate-100 dark:border-slate-800/50 space-y-4">
                  <h3 class="text-xs font-black text-slate-850 dark:text-white uppercase tracking-wider">Observaciones del Colegio</h3>
                  
                  <div v-if="!trackingTicketData.observaciones || trackingTicketData.observaciones.length === 0" class="p-6 bg-slate-100/40 dark:bg-slate-800/10 border border-dashed border-slate-250 dark:border-slate-800 rounded-2xl text-center">
                    <p class="text-[11px] text-slate-400 font-semibold italic">El colegio aún no ha registrado notas u observaciones en esta solicitud.</p>
                  </div>
                  <div v-else class="space-y-3">
                    <div 
                      v-for="(obs, idx) in trackingTicketData.observaciones" 
                      :key="idx" 
                      class="p-4 bg-white dark:bg-slate-850 border border-slate-150/40 dark:border-slate-800 rounded-2xl shadow-sm"
                    >
                      <div class="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-2">
                        <span>{{ getObservationAuthor(obs) }}</span>
                        <span>{{ formatDate(getObservationDate(obs)) }}</span>
                      </div>
                      <p class="text-xs text-slate-700 dark:text-slate-350 font-semibold italic whitespace-pre-line">"{{ getObservationText(obs) }}"</p>
                    </div>
                  </div>

                  <!-- Visitor Response Block -->
                  <div v-if="canVisitorRespond" class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 space-y-3">
                    <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest block ml-1">Enviar una respuesta a este ticket:</span>
                    <div class="flex flex-col sm:flex-row gap-3">
                      <textarea 
                        v-model="visitorResponseInput" 
                        placeholder="Escribe tu respuesta aquí..."
                        rows="2"
                        class="w-full p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 outline-none resize-none transition-all"
                      ></textarea>
                      <button 
                        @click="submitVisitorResponse"
                        :disabled="submittingVisitorObs || !visitorResponseInput.trim()"
                        class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
                      >
                        <Loader2 v-if="submittingVisitorObs" class="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Enviar
                      </button>
                    </div>
                  </div>
                  <div v-else-if="trackingTicketData.estado !== 'RESUELTO'" class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 text-center">
                    <p class="text-[10px] text-slate-400 dark:text-slate-550 font-bold italic leading-relaxed">
                      Debes esperar a que el personal del colegio o el administrador responda tu mensaje antes de poder enviar otra respuesta.
                    </p>
                  </div>
                </div>

              </div>
              <div v-else class="p-16 bg-slate-50/30 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center flex flex-col items-center justify-center min-h-[350px]">
                <LifeBuoy class="w-10 h-10 text-slate-350 dark:text-slate-650 mb-3 animate-bounce" />
                <p class="text-xs text-slate-400 font-bold italic">Selecciona uno de tus tickets del listado para ver su historial de observaciones y enviar respuestas.</p>
              </div>
            </div>
          </div>

          <!-- Si no tiene tickets, mostrar mensaje vacío -->
          <div v-else class="p-12 bg-slate-50/30 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center flex flex-col items-center justify-center">
            <LifeBuoy class="w-12 h-12 text-slate-250 dark:text-slate-700 mb-4" />
            <h3 class="text-sm font-black text-slate-600 dark:text-slate-400">Aún no tienes tickets de soporte</h3>
            <p class="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-1 max-w-xs mx-auto leading-relaxed">
              Cuando envíes una solicitud de soporte, podrás consultar su estado y responder a las observaciones del colegio desde aquí.
            </p>
            <button 
              @click="showTrackingMode = false"
              class="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Crear un Ticket
            </button>
          </div>
        </div>

        <!-- Caso B: Visitante Anónimo (Buscador Clásico) -->
        <div v-else class="space-y-6">
          <div class="text-center max-w-md mx-auto space-y-3">
            <div class="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <LifeBuoy class="w-8 h-8" />
            </div>
            <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Seguimiento de Ticket</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Ingresa el código alfanumérico de tu ticket para consultar su estado actual y las observaciones del colegio.
            </p>
          </div>

          <!-- Search Bar -->
          <div class="max-w-md mx-auto space-y-4">
            <div class="flex gap-3">
              <input 
                v-model="trackingCodeInput"
                type="text"
                placeholder="Ej: TKT-1B3X9H7Z"
                class="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-750 dark:text-slate-250 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none"
                @keyup.enter="fetchTrackingTicket"
              />
              <button 
                @click="fetchTrackingTicket"
                :disabled="searchingTracking || !trackingCodeInput.trim()"
                class="px-6 py-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-md"
              >
                <Loader2 v-if="searchingTracking" class="w-4 h-4 animate-spin" />
                Buscar
              </button>
            </div>

            <div v-if="trackingError" class="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 text-rose-700 dark:text-rose-455 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle class="w-5 h-5 text-rose-600 shrink-0" />
              <p class="text-xs font-bold">{{ trackingError }}</p>
            </div>
          </div>

          <!-- Ficha de resultados del buscador -->
          <div v-if="trackingTicketData" class="max-w-xl mx-auto p-6 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 rounded-[2rem] space-y-6 shadow-inner animate-in fade-in duration-300">
            <!-- DETALLE DEL TICKET -->
            <div class="pb-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/60 rounded-xl font-mono text-xs font-black">
                {{ trackingTicketData.codigo_ticket || `TKT-${new Date(trackingTicketData.fecha_creacion).getFullYear()}-${String(trackingTicketData.id_ticket).padStart(5, '0')}` }}
              </span>
              
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Estado:</span>
                <span 
                  class="px-3 py-1 text-[10px] font-black uppercase tracking-wider border rounded-full"
                  :class="{
                    'bg-rose-50 border-rose-100 text-rose-700': trackingTicketData.estado === 'ABIERTO',
                    'bg-amber-50 border-amber-100 text-amber-700': trackingTicketData.estado === 'EN_PROCESO',
                    'bg-emerald-50 border-emerald-100 text-emerald-700': trackingTicketData.estado === 'RESUELTO',
                    'bg-indigo-50 border-indigo-100 text-indigo-700': trackingTicketData.estado === 'ESCALADO'
                  }"
                >
                  {{ trackingTicketData.estado === 'ABIERTO' ? '🔴 Abierto' : 
                     trackingTicketData.estado === 'EN_PROCESO' ? '🟡 En Proceso' : 
                     trackingTicketData.estado === 'RESUELTO' ? '🟢 Resuelto' : '🔵 Escalado' }}
                </span>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Asunto:</span>
                <p class="font-black text-slate-850 dark:text-slate-200 text-sm mt-0.5">{{ trackingTicketData.asunto }}</p>
              </div>
              <div>
                <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Descripción de la Incidencia:</span>
                <p class="text-xs text-slate-655 dark:text-slate-400 leading-relaxed mt-0.5 whitespace-pre-line">{{ trackingTicketData.descripcion }}</p>
              </div>
              <div class="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Colegio:</span>
                  <p class="text-xs font-black text-slate-700 dark:text-slate-300 mt-0.5">{{ trackingTicketData.colegio_nombre || 'General / Público' }}</p>
                </div>
                <div>
                  <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest">Fecha de Creación:</span>
                  <p class="text-xs font-black text-slate-700 dark:text-slate-300 mt-0.5">{{ formatDate(trackingTicketData.fecha_creacion) }}</p>
                </div>
              </div>
            </div>

            <!-- Observaciones del Colegio -->
            <div class="pt-6 border-t border-slate-100 dark:border-slate-800/50 space-y-4">
              <h3 class="text-xs font-black text-slate-850 dark:text-white uppercase tracking-wider">Observaciones del Colegio</h3>
              
              <div v-if="!trackingTicketData.observaciones || trackingTicketData.observaciones.length === 0" class="p-6 bg-slate-100/40 dark:bg-slate-800/10 border border-dashed border-slate-250 dark:border-slate-800 rounded-2xl text-center">
                <p class="text-[11px] text-slate-400 font-semibold italic">El colegio aún no ha registrado notas u observaciones en esta solicitud.</p>
              </div>
              <div v-else class="space-y-3">
                <div 
                  v-for="(obs, idx) in trackingTicketData.observaciones" 
                  :key="idx" 
                  class="p-4 bg-white dark:bg-slate-850 border border-slate-150/40 dark:border-slate-800 rounded-2xl shadow-sm"
                >
                  <div class="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-2">
                    <span>{{ getObservationAuthor(obs) }}</span>
                    <span>{{ formatDate(getObservationDate(obs)) }}</span>
                  </div>
                  <p class="text-xs text-slate-700 dark:text-slate-350 font-semibold italic whitespace-pre-line">"{{ getObservationText(obs) }}"</p>
                </div>
              </div>

              <!-- Visitor Response Block -->
              <div v-if="canVisitorRespond" class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 space-y-3">
                <span class="text-[9px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest block ml-1">Enviar una respuesta a este ticket:</span>
                <div class="flex flex-col sm:flex-row gap-3">
                  <textarea 
                    v-model="visitorResponseInput" 
                    placeholder="Escribe tu respuesta aquí..."
                    rows="2"
                    class="w-full p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 outline-none resize-none transition-all"
                  ></textarea>
                  <button 
                    @click="submitVisitorResponse"
                    :disabled="submittingVisitorObs || !visitorResponseInput.trim()"
                    class="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
                  >
                    <Loader2 v-if="submittingVisitorObs" class="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Enviar
                  </button>
                </div>
              </div>
              <div v-else-if="trackingTicketData.estado !== 'RESUELTO'" class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 text-center">
                <p class="text-[10px] text-slate-450 dark:text-slate-500 font-bold italic leading-relaxed">
                  Debes esperar a que el personal del colegio o el administrador responda tu mensaje antes de poder enviar otra respuesta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main UI form flow -->
      <div v-else-if="!generatedTicketCode" class="mt-8 space-y-8">
        <div class="text-center max-w-md mx-auto space-y-3">
          <div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <LifeBuoy class="w-8 h-8 animate-pulse" />
          </div>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Soporte Técnico</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
            ¿Tienes inconvenientes con la plataforma? Envíanos una solicitud y nuestro equipo te responderá al correo electrónico a la brevedad.
          </p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Nombre -->
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest ml-1">Tu Nombre Completo *</label>
              <div class="relative">
                <input 
                  v-model="name"
                  type="text" 
                  required
                  placeholder="Ej. Juan Pérez"
                  :disabled="auth.isAuthenticated"
                  class="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none disabled:opacity-60"
                />
                <User class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
              </div>
            </div>

            <!-- Correo -->
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest ml-1">Tu Correo Electrónico *</label>
              <div class="relative">
                <input 
                  v-model="email"
                  type="email" 
                  required
                  placeholder="ejemplo@correo.com"
                  :disabled="auth.isAuthenticated"
                  class="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none disabled:opacity-60"
                />
                <Mail class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Teléfono -->
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest ml-1">Teléfono / Celular (Opcional)</label>
              <div class="relative">
                <input 
                  v-model="phone"
                  type="tel" 
                  placeholder="Ej. +57 300 123 4567"
                  class="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none"
                />
                <Phone class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
              </div>
            </div>

            <!-- Tipo Incidencia -->
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo de Incidencia *</label>
              <div class="relative">
                <select 
                  v-model="category"
                  class="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none cursor-pointer"
                >
                  <option value="TECNICO">Problema Técnico / Error de Plataforma</option>
                  <option value="REINGRESO">Solicitud de Reingreso Estudiantil</option>
                  <option value="CALIFICACIONES">Dudas sobre Calificaciones / Periodos</option>
                  <option value="ASISTENCIA">Dudas sobre Asistencia</option>
                  <option value="AUTENTICACION">Problemas de Inicio de Sesión / Contraseña</option>
                  <option value="SOPORTE">Sugerencias / Otro</option>
                </select>
                <HelpCircle class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
              </div>
            </div>
          </div>

          <!-- Mini Tarjeta de Configuración de Reingreso (Para el Acudiente) -->
          <div v-if="category === 'REINGRESO' && myChildren.length > 0" class="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl space-y-3.5 shadow-sm">
            <div class="flex items-center gap-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-2">
              <span class="text-base">🎓</span>
              <div>
                <h3 class="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Datos de Reingreso Estudiantil</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Asocia al alumno y selecciona el grado pretendido sin necesidad de escribirlo.</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <!-- Selector de Estudiante -->
              <div class="space-y-1">
                <label class="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">👤 Estudiante / Hijo a Reingresar *</label>
                <select 
                  v-model="selectedChildIdForTicket"
                  class="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition cursor-pointer shadow-sm"
                >
                  <option v-for="child in myChildren" :key="child.id_estudiante" :value="child.id_estudiante">
                    {{ child.nombre }} {{ child.apellido }} (Doc: {{ child.documento || 'S/N' }}) — Estado: {{ child.estado || 'RETIRADO' }}
                  </option>
                </select>
              </div>

              <!-- Mini Tarjeta / Selector de Grado Requerido -->
              <div class="space-y-1">
                <label class="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">🎯 Grado Requerido / Pretendido</label>
                <select 
                  v-model="selectedPreferredGradeIdForTicket"
                  class="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition cursor-pointer shadow-sm"
                >
                  <option value="">-- Sugerencia Automática por Sistema --</option>
                  <option v-for="gr in catalogGrados" :key="gr.id_tipo_grado" :value="gr.id_tipo_grado">
                    {{ gr.nombre }}
                  </option>
                </select>
              </div>
            </div>

            <p class="text-[10px] text-slate-500 dark:text-slate-400 italic">
              💡 El directivo recibirá directamente la sugerencia pedagógica y la preferencia del acudiente para asignar el salón correspondiente.
            </p>
          </div>

          <!-- Selector de Colegio (Solo para visitantes) -->
          <div v-if="!auth.isAuthenticated" class="space-y-2">
            <label class="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest ml-1">Colegio de la Incidencia *</label>
            <div class="relative">
              <select 
                v-model="selectedSchoolId"
                required
                class="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none cursor-pointer disabled:opacity-50"
                :disabled="loadingSchools"
              >
                <option :value="null" disabled>{{ loadingSchools ? 'Cargando colegios...' : 'Selecciona tu institución educativa' }}</option>
                <option v-for="s in schools" :key="s.id_colegio" :value="s.id_colegio">{{ s.nombre }}</option>
              </select>
              <School class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
            </div>
          </div>

          <!-- Asunto -->
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest ml-1">Asunto de la Solicitud *</label>
            <div class="relative">
              <input 
                v-model="subject"
                type="text" 
                required
                placeholder="Breve resumen del problema..."
                class="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none"
              />
              <FileText class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
            </div>
          </div>

          <!-- Descripción -->
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest ml-1">Descripción del Problema * (Mín. 10 caracteres)</label>
            <textarea 
              v-model="description"
              required
              rows="4"
              placeholder="Explica de manera detallada lo que ocurre..."
              class="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none resize-none"
            ></textarea>
          </div>

          <!-- Error Message -->
          <div v-if="errorMsg" class="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
            <AlertCircle class="w-5 h-5 text-red-655 dark:text-red-405 shrink-0" />
            <p class="text-xs font-bold text-red-700 dark:text-red-455">{{ errorMsg }}</p>
          </div>

          <!-- Submit Button -->
          <button 
            type="submit" 
            :disabled="!isFormValid || submitting"
            class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-150 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
            <Send v-else :size="16" />
            {{ submitting ? 'Enviando...' : 'Enviar Ticket de Soporte' }}
          </button>
        </form>
      </div>

      <!-- Success screen flow -->
      <div v-else class="mt-8 text-center space-y-8 animate-in zoom-in-95 duration-300">
        <div class="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-650 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 class="w-12 h-12" />
        </div>
        <div class="space-y-3">
          <h2 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">¡Ticket Creado con Éxito!</h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto font-semibold leading-relaxed">
            Hemos registrado tu reporte en la base de datos de soporte. Toma nota del número de seguimiento:
          </p>
          <div class="inline-block bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-2xl font-mono text-lg font-black text-slate-800 dark:text-white tracking-wider shadow-inner">
            {{ generatedTicketCode }}
          </div>
          <p class="text-xs text-slate-405 dark:text-slate-500 font-semibold pt-1">
            Una copia de este ticket ha sido enviada al correo del administrador escolar.
          </p>
        </div>

        <button 
          @click="generatedTicketCode = null"
          class="px-8 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
        >
          Enviar Otro Reporte
        </button>
      </div>
    </div>

    <!-- Modal Autorizar Matrícula Extraordinaria por Ticket -->
    <div v-if="showExtraordinaryModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-xl">
              <Zap :size="20" />
            </div>
            <div>
              <h3 class="font-black text-slate-900 dark:text-white text-base">Autorizar Matrícula Extraordinaria</h3>
              <p class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Ticket: {{ selectedTicketForExtraordinary?.codigo_ticket }}</p>
            </div>
          </div>
          <button @click="showExtraordinaryModal = false" class="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
        </div>

        <!-- Opciones de Modalidad de Estudiante -->
        <div class="space-y-2">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Modalidad del Estudiante</label>
          <div class="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              @click="extraordinaryStudentMode = 'NUEVO'"
              class="p-3.5 border rounded-2xl text-left transition-all flex items-center gap-3"
              :class="extraordinaryStudentMode === 'NUEVO' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 font-black' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold'"
            >
              <span class="text-lg">🆕</span>
              <div>
                <p class="text-xs font-bold">Estudiante Nuevo</p>
                <p class="text-[10px] opacity-75">Aspirante por primera vez</p>
              </div>
            </button>

            <button 
              type="button" 
              @click="extraordinaryStudentMode = 'EXISTENTE'"
              class="p-3.5 border rounded-2xl text-left transition-all flex items-center gap-3"
              :class="extraordinaryStudentMode === 'EXISTENTE' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 font-black' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold'"
            >
              <span class="text-lg">👤</span>
              <div>
                <p class="text-xs font-bold">Estudiante Existente</p>
                <p class="text-[10px] opacity-75">Alumno ya registrado</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Selector de Estudiante Existente -->
        <div v-if="extraordinaryStudentMode === 'EXISTENTE'" class="space-y-1.5">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Seleccionar Estudiante *</label>
          <select 
            v-model="selectedStudentIdForExtraordinary"
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
          >
            <option :value="null">-- Seleccionar Estudiante --</option>
            <option v-for="st in institutionStudents" :key="st.id_estudiante" :value="st.id_estudiante">
              {{ st.nombre }} {{ st.apellido }} (Doc: {{ st.documento }})
            </option>
          </select>
        </div>

        <!-- Correo del Acudiente (Precargado desde el Ticket) -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Correo del Acudiente (Precargado desde Ticket) *</label>
          <input 
            v-model="extraordinaryParentEmail"
            type="email"
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
            placeholder="ejemplo@correo.com"
          />
        </div>

        <!-- Motivo de Autorización -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Motivo u Observación de Autorización *</label>
          <textarea 
            v-model="extraordinaryReason"
            rows="3"
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none resize-none"
            placeholder="Indica el motivo de la autorización..."
          ></textarea>
        </div>

        <!-- Botones de Acción -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button 
            type="button"
            @click="showExtraordinaryModal = false"
            class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase"
          >
            Cancelar
          </button>
          <button 
            type="button"
            @click="submitExtraordinaryEnrollment"
            :disabled="submittingExtraordinary || !extraordinaryParentEmail || (extraordinaryStudentMode === 'EXISTENTE' && !selectedStudentIdForExtraordinary)"
            class="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 v-if="submittingExtraordinary" class="w-4 h-4 animate-spin" />
            <span>Enviar Enlace al Acudiente</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 8s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
