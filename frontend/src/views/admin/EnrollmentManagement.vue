<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  Eye,
  Inbox,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  Calendar,
  Sparkles,
  Lock
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'
import { useAcademicYearStore } from '../../stores/academicYear'
import { useConfirm } from '../../composables/useConfirm'
import { enrollmentService } from '../../services/enrollmentService'
import { academicService } from '../../services/academicService'
import { formatDateTime } from '../../utils/dateHelper'
import DataTable from '../../components/ui/DataTable.vue'
import SkeletonTable from '../../components/feedback/SkeletonTable.vue'
import EmptyState from '../../components/feedback/EmptyState.vue'
import EnrollmentReviewDrawer from '../../components/matriculas/EnrollmentReviewDrawer.vue'
import EnrollmentCorrectionModal from '../../components/matriculas/EnrollmentCorrectionModal.vue'
import EnrollmentCancelModal from '../../components/matriculas/EnrollmentCancelModal.vue'
import ExtraordinaryEnrollmentModal from '../../components/matriculas/ExtraordinaryEnrollmentModal.vue'

const auth = useAuthStore()
const notify = useNotificationStore()
const router = useRouter()
const yearStore = useAcademicYearStore()
const { confirm } = useConfirm()

// ─── List State ───────────────────────────────────────────────────────────────
const enrollments = ref<any[]>([])
const loading = ref(true)
const filterStatus = ref('PENDIENTE')
const searchQuery = ref('')
const filterTipo = ref<string>('TODOS')
const filterNivel = ref<number | 'TODOS'>('TODOS')
const filterSortOrder = ref<'OLDEST' | 'NEWEST'>('OLDEST')
const onlyPendingDocs = ref<boolean>(false)
const showExtraordinaryModal = ref(false)
const enrollmentConfig = ref<any>(null)

const isOrdinaryEnrollmentOpen = computed(() => {
  if (!enrollmentConfig.value) return false
  const cfg = enrollmentConfig.value.config || enrollmentConfig.value
  const { habilitada, fecha_inicio, fecha_cierre } = cfg
  
  if (habilitada === false) return false
  if (!fecha_inicio || !fecha_cierre) return false
  
  const now = new Date()
  const start = new Date(fecha_inicio)
  const end = new Date(fecha_cierre)
  end.setHours(23, 59, 59, 999)
  
  return now >= start && now <= end
})

const loadEnrollmentConfig = async () => {
  try {
    const idColegio = Number(auth.user?.schoolId || auth.selectedSchoolId || 1)
    const yearId = yearStore.selectedYearId
    let cfgData: any = null
    if (yearId) {
      cfgData = await academicService.getEnrollmentConfig(idColegio, yearId)
    }
    if (!cfgData || cfgData.fecha_inicio === undefined) {
      const pubConfig = await enrollmentService.getSchoolEnrollmentConfig(idColegio)
      cfgData = pubConfig?.config || pubConfig
    }
    enrollmentConfig.value = cfgData
  } catch (err) {
    console.error('Error cargando configuración de inscripciones:', err)
  }
}

const fetchEnrollments = async () => {
  loading.value = true
  try {
    const idColegio = auth.user?.schoolId || auth.selectedSchoolId || 1
    const data = await enrollmentService.getFiltered(idColegio, {
      estado: 'ALL',
      yearId: yearStore.selectedYearId || undefined
    })
    enrollments.value = data
  } catch (error) {
    console.error('Error fetching enrollments:', error)
    notify.addNotification('Error al cargar las matrículas', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchEnrollments()
  loadEnrollmentConfig()
})
watch(() => yearStore.selectedYearId, () => {
  fetchEnrollments()
  loadEnrollmentConfig()
})

const tabs = [
  { status: 'PENDIENTE',  label: 'Nuevas (Por Revisar)', color: 'amber'   },
  { status: 'CORREGIDA',  label: 'Docs Corregidos',      color: 'purple'  },
  { status: 'CORRECCION', label: 'En Corrección',        color: 'orange'  },
  { status: 'ACTIVA',     label: 'Aprobadas',            color: 'emerald' },
  { status: 'TRASLADADA', label: 'Traslados',            color: 'blue'    },
  { status: 'CANCELADA',  label: 'Canceladas',           color: 'red'     },
]

const stats = computed<Record<string, number>>(() => ({
  PENDIENTE:  enrollments.value.filter(e => e.estado === 'PENDIENTE').length,
  CORREGIDA:  enrollments.value.filter(e => e.estado === 'CORREGIDA').length,
  CORRECCION: enrollments.value.filter(e => e.estado === 'CORRECCION').length,
  ACTIVA:     enrollments.value.filter(e => (e.estado === 'ACTIVA' || e.estado === 'APROBADA') && !e.es_traslado && e.tipo !== 'TRASLADO').length,
  TRASLADADA: enrollments.value.filter(e => e.estado === 'TRASLADADA' || e.tipo === 'TRASLADO' || e.es_traslado).length,
  CANCELADA:  enrollments.value.filter(e => e.estado === 'CANCELADA' || e.estado === 'RECHAZADA').length,
}))

// Map to track order of submission for pending applications (turn / priority ranking)
const oldestPendingMap = computed(() => {
  const map = new Map<number, number>()
  const pendingList = enrollments.value
    .filter(e => e.estado === 'PENDIENTE' || e.estado === 'CORREGIDA' || e.estado === 'CORRECCION' || e.estado === 'RECHAZADA')
    .sort((a, b) => (a.id_matricula || 0) - (b.id_matricula || 0))

  pendingList.forEach((item, index) => {
    map.set(item.id_matricula, index + 1)
  })
  return map
})

const activeTransferPopupId = ref<number | null>(null)
const handleDocumentClick = () => { activeTransferPopupId.value = null }
onMounted(() => document.addEventListener('click', handleDocumentClick))
onUnmounted(() => document.removeEventListener('click', handleDocumentClick))

const hasTransferInfo = (en: any) => {
  return Boolean(
    en.sentido_traslado === 'ENTRANTE' ||
    en.sentido_traslado === 'SALIENTE' ||
    en.es_traslado ||
    en.tipo === 'TRASLADO' ||
    en.colegio_origen_nombre ||
    en.colegio_destino_nombre
  )
}

const toggleTransferInfo = (event: Event, id: number) => {
  event.stopPropagation()
  activeTransferPopupId.value = activeTransferPopupId.value === id ? null : id
}

const getTransferPopupTitle = (en: any) => {
  if (en.sentido_traslado === 'ENTRANTE' || (en.es_traslado && en.colegio_origen_nombre && String(en.id_colegio) === String(en.id_colegio_destino))) {
    return 'Traslado Entrante'
  }
  if (en.sentido_traslado === 'SALIENTE') {
    return 'Traslado Saliente'
  }
  return 'Matrícula por Traslado'
}

const getTransferPopupDesc = (en: any) => {
  if (en.sentido_traslado === 'ENTRANTE' || (en.es_traslado && en.colegio_origen_nombre && String(en.id_colegio) === String(en.id_colegio_destino))) {
    return `Estudiante recibido desde: ${en.colegio_origen_nombre || 'otra institución educativa'}.`
  }
  if (en.sentido_traslado === 'SALIENTE') {
    return `Estudiante trasladado hacia: ${en.colegio_destino_nombre || 'otra institución educativa'}.`
  }
  return 'Matrícula gestionada mediante proceso de traslado interinstitucional.'
}

const availableLevels = computed(() => {
  const map = new Map<number, string>()
  for (const e of enrollments.value) {
    if (e.id_nivel && e.nivel_nombre) {
      map.set(e.id_nivel, e.nivel_nombre)
    }
  }
  return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }))
})

const isAnySecondaryFilterActive = computed(() => {
  return filterTipo.value !== 'TODOS' || filterNivel.value !== 'TODOS' || filterSortOrder.value !== 'OLDEST' || onlyPendingDocs.value || searchQuery.value.trim() !== ''
})

const resetFilters = () => {
  filterTipo.value = 'TODOS'
  filterNivel.value = 'TODOS'
  filterSortOrder.value = 'OLDEST'
  onlyPendingDocs.value = false
  searchQuery.value = ''
}

const exportToCSV = () => {
  if (!filteredEnrollments.value.length) {
    notify.addNotification('No hay matrículas para exportar con los filtros actuales', 'info')
    return
  }

  const headers = ['ID Matrícula', 'Tipo', 'Estado', 'Correo Acudiente', 'Estudiante', 'Documento Estudiante', 'Nivel', 'Grado / Curso', 'Docs Pendientes']
  const rows = filteredEnrollments.value.map(en => [
    en.id_matricula,
    en.tipo || 'REGULAR',
    en.estado,
    en.correo_padre || '',
    en.student_nombre ? `${en.student_nombre} ${en.student_apellido || ''}` : 'N/A',
    en.student_documento || 'N/A',
    en.nivel_nombre || 'N/A',
    en.grado_nombre || (en.id_grado ? `ID ${en.id_grado}` : 'N/A'),
    en.has_pending_docs ? 'SÍ' : 'NO'
  ])

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
    [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `reporte_matriculas_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  notify.addNotification(`Reporte exportado (${filteredEnrollments.value.length} matrículas)`, 'success')
}

const filteredEnrollments = computed(() => {
  let list = enrollments.value.filter(en => {
    if (filterStatus.value === 'ACTIVA') {
      if ((en.estado !== 'ACTIVA' && en.estado !== 'APROBADA') || en.es_traslado || en.tipo === 'TRASLADO') return false
    } else if (filterStatus.value === 'CANCELADA') {
      if (en.estado !== 'CANCELADA' && en.estado !== 'RECHAZADA') return false
    } else if (filterStatus.value === 'TRASLADADA') {
      if (en.estado !== 'TRASLADADA' && en.tipo !== 'TRASLADO' && !en.es_traslado) return false
    } else if (filterStatus.value !== 'TODOS' && en.estado !== filterStatus.value) {
      return false
    }

    if (filterTipo.value !== 'TODOS' && (en.tipo || 'REGULAR').toUpperCase() !== filterTipo.value) {
      return false
    }

    if (filterNivel.value !== 'TODOS' && en.id_nivel !== Number(filterNivel.value)) {
      return false
    }

    if (onlyPendingDocs.value && !en.has_pending_docs) {
      return false
    }

    return true
  })

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(en => {
      const matchMail = en.correo_padre && en.correo_padre.toLowerCase().includes(q)
      const matchId = String(en.id_matricula).includes(q)
      const matchNombre = en.student_nombre && en.student_nombre.toLowerCase().includes(q)
      const matchApellido = en.student_apellido && en.student_apellido.toLowerCase().includes(q)
      const matchFull = en.student_nombre && en.student_apellido && `${en.student_nombre} ${en.student_apellido}`.toLowerCase().includes(q)
      const matchDoc = en.student_documento && String(en.student_documento).toLowerCase().includes(q)
      return matchMail || matchId || matchNombre || matchApellido || matchFull || matchDoc
    })
  }

  return list.sort((a, b) => {
    const idA = a.id_matricula || 0
    const idB = b.id_matricula || 0
    return filterSortOrder.value === 'OLDEST' ? idA - idB : idB - idA
  })
})

const getStatusMeta = (status: string) => {
  if (status === 'PENDIENTE')  return { label: 'Por Revisar',     bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' }
  if (status === 'CORREGIDA')  return { label: 'Docs Corregidos', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' }
  if (status === 'CORRECCION') return { label: 'En Corrección',   bg: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400' }
  if (status === 'RECHAZADA')  return { label: 'Rechazada',       bg: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
  if (status === 'APROBADA')   return { label: 'Aprobada',        bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
  if (status === 'ACTIVA')     return { label: 'Aprobada',        bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
  if (status === 'TRASLADADA') return { label: 'Traslado',        bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' }
  if (status === 'CANCELADA')  return { label: 'Cancelada',       bg: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
  return { label: status, bg: 'bg-slate-100 text-slate-600' }
}

const getTipoMeta = (tipo?: string) => {
  const t = tipo?.toUpperCase() || 'REGULAR'
  if (t === 'REINGRESO')      return { label: 'Reingreso', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400' }
  if (t === 'RENOVACION')     return { label: 'Renovación', bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400' }
  if (t === 'EXTRAORDINARIA') return { label: 'Extraordinaria', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' }
  if (t === 'TRASLADO')       return { label: 'Traslado', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400' }
  return { label: 'Regular', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
}

// ─── Drawer & Modals State ───────────────────────────────────────────────────
const drawerOpen = ref(false)
const detailLoading = ref(false)
const matricula = ref<any>(null)
const studentSummary = ref<any>(null)
const currentStep = ref<number>(1)
const selectedGradeId = ref<number | null>(null)
const savingGrade = ref(false)
const isExportingPDF = ref(false)

const showCorrectionModal = ref(false)
const submittingCorrection = ref(false)

const showCancelModal = ref(false)
const cancelling = ref(false)

const openDrawer = async (id: number) => {
  currentStep.value = 1
  matricula.value = null
  studentSummary.value = null
  detailLoading.value = true
  drawerOpen.value = true
  try {
    const data = await enrollmentService.getDetails(id)
    matricula.value = data
    selectedGradeId.value = data.id_grupo || data.id_grado || (data.availableSections?.[0]?.id_grado ?? null)

    if (data.tipo === 'REINGRESO' && data.id_estudiante) {
      try {
        studentSummary.value = await enrollmentService.getStudentSummary(data.id_estudiante)
      } catch (err) {
        console.error("Error loading student summary:", err)
      }
    }
  } catch {
    notify.addNotification('Error al cargar la matrícula', 'error')
    drawerOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

const closeDrawer = () => { drawerOpen.value = false }

const handleAssignRoom = async () => {
  if (!selectedGradeId.value || !matricula.value) return
  const selected = matricula.value.availableSections?.find((s: any) => s.id_grado === selectedGradeId.value)
  if (selected) {
    savingGrade.value = true
    try {
      await enrollmentService.assignGrade(matricula.value.id_matricula, selected.id_grado)
      matricula.value.seccion = selected.seccion
      matricula.value.id_grado = selected.id_grado
      matricula.value.id_grupo = selected.id_grado
      notify.addNotification(`Salón ${selected.seccion} asignado correctamente`, 'success')
      currentStep.value = 2
    } catch (e) {
      console.error('Error al guardar salón:', e)
      notify.addNotification('No se pudo guardar la asignación del salón', 'error')
    } finally {
      savingGrade.value = false
    }
  } else {
    currentStep.value = 2
  }
}

const handleUpdateDocStatus = async (payload: { idDocumento: number; estado: string }) => {
  try {
    await enrollmentService.updateDocumentStatus(payload.idDocumento, payload.estado)
    const doc = matricula.value?.documentos?.find((d: any) => d.id_documento === payload.idDocumento)
    if (doc) doc.estado = payload.estado
  } catch {
    notify.addNotification('Error al actualizar documento', 'error')
  }
}

const handleConfirmCorrection = async (observations: string) => {
  if (!matricula.value) return
  submittingCorrection.value = true
  try {
    await enrollmentService.requestCorrection(matricula.value.id_matricula, matricula.value.tipo, observations)
    notify.addNotification('Solicitud enviada a corrección exitosamente', 'success')
    showCorrectionModal.value = false
    closeDrawer()
    fetchEnrollments()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al solicitar corrección', 'error')
  } finally {
    submittingCorrection.value = false
  }
}

const handleConfirmCancel = async (payload: { motivo: string; detalles: string; estado_estudiante: 'RETIRADO' | 'EXPULSADO' }) => {
  if (!matricula.value) return
  cancelling.value = true
  try {
    const isPending = matricula.value.estado === 'PENDIENTE'
    await enrollmentService.cancelOrReject(matricula.value.id_matricula, matricula.value.tipo, payload, isPending)
    notify.addNotification('Solicitud de matrícula cancelada exitosamente', 'success')
    showCancelModal.value = false
    closeDrawer()
    fetchEnrollments()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al cancelar la solicitud', 'error')
  } finally {
    cancelling.value = false
  }
}

const handleSaveValidation = async () => {
  const hasRejected = matricula.value?.documentos?.some((d: any) => d.estado === 'RECHAZADO')
  const hasPending = matricula.value?.documentos?.some((d: any) => d.estado === 'PENDIENTE')

  if (hasRejected) {
    const ok = await confirm({
      title: 'Notificar Inconsistencias',
      message: 'Hay documentos rechazados. ¿Deseas enviar una notificación por correo al acudiente para que los corrija?',
      confirmText: 'Notificar al Acudiente',
      type: 'warning'
    })
    if (ok) {
      try {
        await enrollmentService.notifyInconsistencies(matricula.value.id_matricula)
        notify.addNotification('Notificación enviada al padre', 'success')
        closeDrawer()
        fetchEnrollments()
      } catch {
        notify.addNotification('Error al enviar notificación', 'error')
      }
    }
  } else if (hasPending) {
    notify.addNotification('Estado guardado. Aún quedan documentos pendientes de revisar.', 'info')
    closeDrawer()
    fetchEnrollments()
  } else {
    notify.addNotification('Todos los documentos han sido validados exitosamente', 'success')
    closeDrawer()
    fetchEnrollments()
  }
}

const handleFinalizeRegistration = (idMatricula: number) => {
  closeDrawer()
  router.push(`/dashboard/gestion-matriculas/${idMatricula}/registro`)
}

const handleGoToTrasladoDetail = (idSolicitud: number) => {
  closeDrawer()
  router.push({
    name: 'Gestión de Traslados',
    query: { id: idSolicitud }
  })
}

const handleDownloadPDF = (fullMatricula: any) => {
  if (!fullMatricula) return
  notify.addNotification('Generando ficha PDF de matrícula...', 'info')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Gestión de Matrículas
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Revisa y valida la documentación para legalizar inscripciones escolares
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Botón Matrícula Extraordinaria sincronizado con fechas de inscripción ordinaria -->
        <button
          v-if="!auth.isMonitoring"
          @click="isOrdinaryEnrollmentOpen ? null : (showExtraordinaryModal = true)"
          :disabled="isOrdinaryEnrollmentOpen"
          :class="[
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-xs select-none',
            isOrdinaryEnrollmentOpen
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-75'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer'
          ]"
          :title="isOrdinaryEnrollmentOpen 
            ? 'El período ordinario de inscripciones se encuentra vigente. Las matrículas extraordinarias solo se habilitan cuando las inscripciones ordinarias han finalizado o están cerradas.' 
            : 'Crear autorización de matrícula extraordinaria fuera del período ordinario'"
        >
          <Lock v-if="isOrdinaryEnrollmentOpen" :size="14" class="text-slate-400" />
          <Sparkles v-else :size="15" class="text-white animate-pulse" />
          <span>{{ isOrdinaryEnrollmentOpen ? 'Matrícula Extraordinaria (Bloqueada)' : 'Matrícula Extraordinaria' }}</span>
        </button>

        <button
          @click="exportToCSV"
          class="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-colors"
        >
          <FileSpreadsheet :size="15" class="text-emerald-600" />
          <span>Exportar CSV</span>
        </button>

        <button
          @click="fetchEnrollments"
          :disabled="loading"
          class="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-colors"
          title="Recargar datos"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Status Tabs -->
    <div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.status"
        @click="filterStatus = tab.status"
        :class="[
          filterStatus === tab.status
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-slate-200/80 dark:border-slate-700/80',
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all'
        ]"
      >
        <span>{{ tab.label }}</span>
        <span 
          :class="[
            filterStatus === tab.status ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
            'px-2 py-0.5 rounded-full text-[10px] font-black'
          ]"
        >
          {{ stats[tab.status] || 0 }}
        </span>
      </button>
    </div>

    <!-- Search and Filters Bar -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div class="relative lg:col-span-2">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por estudiante, acudiente, documento..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>

      <div>
        <select
          v-model="filterTipo"
          class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
        >
          <option value="TODOS">Todos los Tipos</option>
          <option value="REGULAR">Regular</option>
          <option value="REINGRESO">Reingreso</option>
          <option value="RENOVACION">Renovación</option>
          <option value="EXTRAORDINARIA">Extraordinaria</option>
          <option value="TRASLADO">Traslado</option>
        </select>
      </div>

      <div>
        <select
          v-model="filterNivel"
          class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
        >
          <option value="TODOS">Todos los Niveles</option>
          <option v-for="lvl in availableLevels" :key="lvl.id" :value="lvl.id">{{ lvl.nombre }}</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="filterSortOrder"
          class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
        >
          <option value="OLDEST">Más antiguas</option>
          <option value="NEWEST">Más recientes</option>
        </select>

        <button
          v-if="isAnySecondaryFilterActive"
          @click="resetFilters"
          class="p-2.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 rounded-xl transition-colors shrink-0"
          title="Limpiar Filtros"
        >
          ✕
        </button>
      </div>
    </div>


    <!-- Table Section -->
    <SkeletonTable v-if="loading" :rows="6" :cols="6" />

    <EmptyState
      v-else-if="filteredEnrollments.length === 0"
      title="Sin matrículas en esta categoría"
      description="No se encontraron solicitudes o registros de matrícula para el filtro seleccionado."
    >
      <template #icon>
        <Inbox :size="48" class="text-slate-400" />
      </template>
    </EmptyState>

    <DataTable v-else>
      <template #header>
        <tr>
          <th class="py-4 px-6">Tipo</th>
          <th class="py-4 px-6">Estudiante / Acudiente</th>
          <th class="py-4 px-6">Nivel / Grado</th>
          <th class="py-4 px-6">Fecha Solicitud</th>
          <th class="py-4 px-6">Estado</th>
          <th class="py-4 px-6 text-right">Gestionar</th>
        </tr>
      </template>
      <tr
        v-for="en in filteredEnrollments"
        :key="en.id_matricula"
        class="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
      >
        <td class="py-4 px-6">
          <div class="flex flex-wrap items-center gap-1.5 font-sans">
            <span :class="[getTipoMeta(en.tipo).bg, 'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md']">
              {{ getTipoMeta(en.tipo).label }}
            </span>
            <span 
              v-if="oldestPendingMap.has(en.id_matricula) && (en.estado === 'PENDIENTE' || en.estado === 'CORRECCION')" 
              class="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
            >
              <Clock :size="10" />
              <span>Turno #{{ oldestPendingMap.get(en.id_matricula) }}</span>
            </span>
          </div>
        </td>
        <td class="py-4 px-6">
          <p v-if="en.student_nombre" class="font-bold text-slate-900 dark:text-white text-sm leading-tight">
            {{ en.student_nombre }} {{ en.student_apellido || '' }}
          </p>
          <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">{{ en.correo_padre }}</p>
          <p v-if="en.student_documento" class="text-[10px] text-slate-400 font-mono">Doc: {{ en.student_documento }}</p>
        </td>
        <td class="py-4 px-6">
          <div class="space-y-1">
            <div v-if="en.nivel_nombre" class="flex items-center gap-1.5">
              <span class="inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                {{ en.nivel_nombre }}
              </span>
            </div>
            <p v-if="en.grado_nombre" class="text-xs font-black text-slate-800 dark:text-slate-100">
              {{ en.grado_nombre }}
            </p>
            <p v-else class="text-xs font-bold text-indigo-500 uppercase">ID {{ en.id_grado }}</p>
          </div>
        </td>
        <td class="py-4 px-6 whitespace-nowrap">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Calendar :size="13" class="text-indigo-500 shrink-0" />
            <span>{{ formatDateTime(en.fecha_creacion) }}</span>
          </div>
        </td>
        <td class="py-4 px-6">
          <div class="relative flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click.stop="hasTransferInfo(en) ? toggleTransferInfo($event, en.id_matricula) : null"
                :class="[
                  getStatusMeta(en.estado).bg, 
                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit inline-flex items-center gap-1.5 transition-all',
                  hasTransferInfo(en) ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''
                ]"
              >
                <span>{{ getStatusMeta(en.estado).label }}</span>
                <ArrowDownLeft v-if="en.sentido_traslado === 'ENTRANTE'" :size="11" class="text-emerald-700" />
                <ArrowUpRight v-else-if="en.sentido_traslado === 'SALIENTE'" :size="11" class="text-purple-700" />
                <ArrowLeftRight v-else-if="en.es_traslado || en.tipo === 'TRASLADO'" :size="11" class="text-blue-600" />
              </button>
            </div>

            <!-- Transfer Popover -->
            <div 
              v-if="activeTransferPopupId === en.id_matricula && hasTransferInfo(en)"
              class="absolute left-0 top-full mt-1.5 z-50 w-72 p-3.5 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 text-left animate-in fade-in duration-150"
              @click.stop
            >
              <div class="flex items-start justify-between gap-2 mb-1.5 border-b border-slate-100 dark:border-slate-700/60 pb-1.5">
                <div class="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                  <span>{{ getTransferPopupTitle(en) }}</span>
                </div>
                <button @click.stop="activeTransferPopupId = null" class="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 rounded">✕</button>
              </div>
              <p class="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                {{ getTransferPopupDesc(en) }}
              </p>
            </div>

            <div v-if="en.has_pending_docs && en.estado === 'PENDIENTE'"
                 class="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-lg w-fit">
              <AlertTriangle :size="10" /> Docs Diferidos
            </div>
          </div>
        </td>
        <td class="py-4 px-6 text-right">
          <button
            @click="openDrawer(en.id_matricula)"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 rounded-xl text-xs font-black uppercase tracking-wide transition-all group-hover:shadow-xs"
          >
            <Eye :size="14" /> Gestionar
            <ChevronRight :size="12" />
          </button>
        </td>
      </tr>
    </DataTable>

    <!-- Subcomponent Modals -->
    <EnrollmentReviewDrawer
      :is-open="drawerOpen"
      :matricula="matricula"
      :detail-loading="detailLoading"
      :student-summary="studentSummary"
      v-model:current-step="currentStep"
      v-model:selected-grade-id="selectedGradeId"
      :saving-grade="savingGrade"
      :is-exporting-p-d-f="isExportingPDF"
      @close="closeDrawer"
      @open-correction="showCorrectionModal = true"
      @open-cancel="showCancelModal = true"
      @assign-room="handleAssignRoom"
      @update-doc-status="handleUpdateDocStatus"
      @save-validation="handleSaveValidation"
      @finalize-registration="handleFinalizeRegistration"
      @go-to-traslado-detail="handleGoToTrasladoDetail"
      @download-p-d-f="handleDownloadPDF"
    />

    <EnrollmentCorrectionModal
      :show="showCorrectionModal"
      :submitting="submittingCorrection"
      @close="showCorrectionModal = false"
      @confirm="handleConfirmCorrection"
    />

    <EnrollmentCancelModal
      :show="showCancelModal"
      :submitting="cancelling"
      :tipo-matricula="matricula?.tipo"
      @close="showCancelModal = false"
      @confirm="handleConfirmCancel"
    />

    <!-- Modal de Matrícula Extraordinaria -->
    <ExtraordinaryEnrollmentModal
      :is-open="showExtraordinaryModal"
      @close="showExtraordinaryModal = false"
      @success="fetchEnrollments"
    />
  </div>
</template>
