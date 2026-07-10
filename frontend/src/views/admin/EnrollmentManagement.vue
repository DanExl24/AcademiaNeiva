<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import axios from 'axios'
import html2pdf from 'html2pdf.js'
import {
  Search,
  Eye,
  Inbox,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ArrowLeftRight,
  FileText,
  CheckCircle,
  ExternalLink,
  Save,
  Send,
  ClipboardList,
  ChevronRight,
  BookOpen,
  User,
  Mail,
  MapPin,
  Download,
  X,
  ArrowLeft,
  Plus
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'
import { useRouter } from 'vue-router'
import { getCourseDisplayName } from '../../utils/courseHelper'

const auth = useAuthStore()
const notify = useNotificationStore()
const router = useRouter()

// ─── List State ───────────────────────────────────────────────────────────────
const enrollments = ref<any[]>([])
const loading = ref(true)
const filterStatus = ref('PENDIENTE')
const searchQuery = ref('')

const fetchEnrollments = async () => {
  loading.value = true
  try {
    const idColegio = auth.user?.schoolId || 1
    const response = await axios.get(`http://localhost:3000/api/matriculas/filtered/${idColegio}`, {
      params: { estado: 'ALL' }
    })
    enrollments.value = response.data
  } catch (error) {
    console.error('Error fetching enrollments:', error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchEnrollments)

const tabs = [
  { status: 'PENDIENTE',   label: 'Por Revisar',    color: 'amber'   },
  { status: 'RECHAZADA',   label: 'En Corrección',  color: 'orange'  },
  { status: 'CORRECCION',  label: 'Docs Corregidos',color: 'purple'  },
  { status: 'ACTIVA',      label: 'Aprobadas',      color: 'emerald' },
  { status: 'TRASLADADA',  label: 'Traslados',      color: 'blue'    },
  { status: 'CANCELADA',   label: 'Canceladas',     color: 'red'     },
]

const stats = computed(() => ({
  pending:     enrollments.value.filter(e => e.estado === 'PENDIENTE').length,
  rejected:    enrollments.value.filter(e => e.estado === 'RECHAZADA' || e.estado === 'APROBADA').length,
  corrected:   enrollments.value.filter(e => e.estado === 'CORRECCION').length,
  active:      enrollments.value.filter(e => e.estado === 'ACTIVA').length,
  transferred: enrollments.value.filter(e => e.estado === 'TRASLADADA').length,
  cancelled:   enrollments.value.filter(e => e.estado === 'CANCELADA').length,
}))

const filteredEnrollments = computed(() => {
  let list = enrollments.value.filter(en => {
    if (filterStatus.value === 'RECHAZADA') {
      return en.estado === 'RECHAZADA' || en.estado === 'APROBADA'
    }
    return en.estado === filterStatus.value
  })
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(en =>
      en.correo_padre.toLowerCase().includes(q) ||
      String(en.id_matricula).includes(q)
    )
  }
  return list
})

const getStatusMeta = (status: string) => {
  if (status === 'PENDIENTE')  return { label: 'Por Revisar',     bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' }
  if (status === 'RECHAZADA')  return { label: 'En Corrección',   bg: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' }
  if (status === 'APROBADA')   return { label: 'Excepción Aprobada', bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' }
  if (status === 'CORRECCION') return { label: 'Docs Corregidos', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' }
  if (status === 'ACTIVA')     return { label: 'Aprobada',        bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
  if (status === 'TRASLADADA') return { label: 'Traslado',        bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' }
  if (status === 'CANCELADA')  return { label: 'Cancelada',       bg: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
  return { label: status, bg: 'bg-slate-100 text-slate-600' }
}

// ─── Drawer / Detail State ────────────────────────────────────────────────────
const drawerOpen = ref(false)
const detailLoading = ref(false)
const matricula = ref<any>(null)
const currentStep = ref(1)
const selectedGradeId = ref<number | null>(null)
const savingGrade = ref(false)
const showNotifyModal = ref(false)
const showPendingModal = ref(false)
const showCancelModal = ref(false)
const cancelMotivo = ref('Retiro Voluntario')
const cancelDetalles = ref('')
const cancelling = ref(false)

const documentLabels: Record<string, string> = {
  registroCivil: 'Registro Civil',
  documentoIdentidad: 'Doc. Identidad Padre/Madre',
  documentoPadre: 'Documento Acudiente Extra',
  vacunas: 'Carnet de Vacunas',
  salud: 'Certificado EPS',
  foto: 'Foto Tamaño Documento',
  visa: 'Visa (Estudiantes Extranjeros)',
  reciboPublico: 'Recibo Servicio Público',
  certificadoDiscapacidad: 'Certificado Discapacidad',
  certificadosEscolaridad: 'Certificado de Escolaridad (Años anteriores)',
}

const studentSummary = ref<any>(null)

const openDrawer = async (id: number) => {
  currentStep.value = 1
  matricula.value = null
  studentSummary.value = null
  detailLoading.value = true
  drawerOpen.value = true
  try {
    const response = await axios.get(`http://localhost:3000/api/matriculas/${id}`)
    matricula.value = response.data
    selectedGradeId.value = response.data.id_grado

    // Fetch academic summary if it is a reingreso
    if (response.data.tipo === 'REINGRESO' && response.data.id_estudiante) {
      try {
        const studentSumRes = await axios.get(`http://localhost:3000/api/student/${response.data.id_estudiante}/summary`)
        studentSummary.value = studentSumRes.data
      } catch (err) {
        console.error("Error loading student academic history:", err)
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

const handleKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer() }
onMounted(() => document.addEventListener('keydown', handleKeydown))

const isReadonly = computed(() =>
  matricula.value && (matricula.value.estado === 'ACTIVA' || matricula.value.estado === 'TRASLADADA' || matricula.value.estado === 'CANCELADA')
)

const allValidated = computed(() => {
  if (!matricula.value?.documentos) return false
  return matricula.value.documentos.every((d: any) => d.estado === 'VALIDADO')
})

const rejectedDocumentsNames = computed(() => {
  if (!matricula.value) return []
  return matricula.value.documentos
    .filter((d: any) => d.estado === 'RECHAZADO')
    .map((d: any) => documentLabels[d.tipo_documento] || d.tipo_documento)
})

const getDocStatusClass = (estado: string) => {
  if (estado === 'PENDIENTE') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
  if (estado === 'VALIDADO')  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
  return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
}

const formatUrl = (url: string) => `http://localhost:3000/uploads/${url.split(/[\\/]/).pop()}`

const formatDate = (date: string | null) => {
  if (!date) return 'Sin fecha'
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const assignRoom = () => {
  if (!selectedGradeId.value) return
  const selected = matricula.value.availableSections.find((s: any) => s.id_grado === selectedGradeId.value)
  if (selected) {
    matricula.value.seccion = selected.seccion
    matricula.value.id_grado = selected.id_grado
    notify.addNotification(`Salón ${selected.seccion} seleccionado`, 'info')
  }
  currentStep.value = 2
}

const updateDocumentStatus = async (idDocumento: number, estado: string) => {
  try {
    await axios.patch(`http://localhost:3000/api/matriculas/document/${idDocumento}`, { estado })
    const doc = matricula.value.documentos.find((d: any) => d.id_documento === idDocumento)
    if (doc) doc.estado = estado
  } catch {
    notify.addNotification('Error al actualizar', 'error')
  }
}

const handleSave = () => {
  const hasRejected = matricula.value.documentos.some((d: any) => d.estado === 'RECHAZADO')
  const hasPending  = matricula.value.documentos.some((d: any) => d.estado === 'PENDIENTE')
  if (hasRejected)     showNotifyModal.value = true
  else if (hasPending) showPendingModal.value = true
  else {
    notify.addNotification('Cambios guardados', 'success')
    closeDrawer()
    fetchEnrollments()
  }
}

const confirmSaveLater = () => {
  notify.addNotification('Guardado. Recuerda revisar los documentos pendientes después.', 'info')
  showPendingModal.value = false
  closeDrawer()
  fetchEnrollments()
}

const notifyInconsistencies = async () => {
  try {
    await axios.post(`http://localhost:3000/api/matriculas/notify-inconsistencies/${matricula.value.id_matricula}`)
    notify.addNotification('Notificación enviada al padre', 'success')
    showNotifyModal.value = false
    closeDrawer()
    fetchEnrollments()
  } catch {
    notify.addNotification('Error al enviar notificación', 'error')
  }
}

const toggleTransfer = async () => {
  try {
    await axios.patch(`http://localhost:3000/api/matriculas/transfer-status/${matricula.value.id_matricula}`, {
      es_traslado: matricula.value.es_traslado
    })
    notify.addNotification('Estado de traslado actualizado', 'success')
  } catch {
    notify.addNotification('Error al actualizar estado de traslado', 'error')
    matricula.value.es_traslado = !matricula.value.es_traslado
  }
}

const cancelEnrollment = async () => {
  if (!cancelMotivo.value) return
  cancelling.value = true
  try {
    await axios.post(`http://localhost:3000/api/matriculas/cancel/${matricula.value.id_matricula}`, {
      motivo: cancelMotivo.value, detalles: cancelDetalles.value
    })
    notify.addNotification('Matrícula cancelada exitosamente', 'success')
    showCancelModal.value = false
    await openDrawer(matricula.value.id_matricula)
    fetchEnrollments()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al cancelar', 'error')
  } finally {
    cancelling.value = false
  }
}

// ─── PDF Export State & Functions ──────────────────────────────────────────────
const isExportingPDF = ref(false)
const tempPrintableRef = ref<HTMLElement | null>(null)
const tempMatricula = ref<any>(null)

const downloadPDF = async (fullMatricula: any) => {
  if (!fullMatricula || isExportingPDF.value) return
  isExportingPDF.value = true
  try {
    tempMatricula.value = fullMatricula
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 500)) // Give Vue 500ms to render the template fully
    const opt = {
      margin:       0,
      filename:     `ficha_matricula_${fullMatricula.student_code || 'SIN_CODIGO'}_${fullMatricula.id_matricula}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 816 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const },
      pagebreak:    { mode: ['css', 'legacy'] }
    }
    if (tempPrintableRef.value) {
      await html2pdf().set(opt).from(tempPrintableRef.value).save()
    }
  } catch (err) {
    console.error("Error al exportar ficha en PDF:", err)
    notify.addNotification("Error al generar el PDF de la ficha", "error")
  } finally {
    tempMatricula.value = null
    isExportingPDF.value = false
  }
}

const fetchAndDownloadPDF = async (id: number) => {
  try {
    const response = await axios.get(`http://localhost:3000/api/matriculas/${id}`)
    await downloadPDF(response.data)
  } catch (err) {
    console.error("Error fetching matricula details for PDF:", err)
    notify.addNotification("Error al cargar detalles de la matrícula", "error")
  }
}

// ─── Extraordinary & Reingreso Enrollment State ──────────────────────────────
const showExtraordinaryModal = ref(false)
const extraordinaryLoading = ref(false)
const extraordinaryForm = ref({
  correo_padre: '',
  id_nivel: null as number | null,
  id_grupo: null as number | null,
  id_anio: null as number | null,
  id_estudiante: null as number | null,
  tiene_discapacidad: false,
  es_extranjero: false,
  motivo: '',
  observaciones: '',
})

// Reingreso
const showReingresoModal = ref(false)
const reingresoLoading = ref(false)
const reingresoForm = ref({
  id_estudiante: null as number | null,
  id_nivel: null as number | null,
  id_grupo: null as number | null,
  id_anio: null as number | null,
  tiene_discapacidad: false,
  es_extranjero: false,
  motivo: 'Se retiró voluntariamente',
  observaciones: '',
})

const catalogNiveles = ref<any[]>([])
const catalogGrupos = ref<any[]>([])
const catalogYears = ref<any[]>([])
const institutionStudents = ref<any[]>([])

const retiredStudents = computed(() => {
  return institutionStudents.value.filter(s => s.estado === 'RETIRADO')
})

const fetchExtraordinaryCatalogs = async () => {
  try {
    const idColegio = auth.user?.schoolId || 1
    // Fetch levels & groups
    const gradesRes = await axios.get(`http://localhost:3000/api/academic-admin/grades/${idColegio}`)
    catalogNiveles.value = gradesRes.data.niveles || []
    catalogGrupos.value = gradesRes.data.grupos || []
    
    // Fetch academic years
    const settingsRes = await axios.get(`http://localhost:3000/api/academic-admin/settings/${idColegio}`)
    catalogYears.value = settingsRes.data.academicYears || []
    
    // Fetch students, filter out EXPULSADO & GRADUADO
    const studentsRes = await axios.get(`http://localhost:3000/api/student/colegio/${idColegio}`)
    institutionStudents.value = (studentsRes.data || []).filter(
      (s: any) => s.estado !== 'EXPULSADO' && s.estado !== 'GRADUADO'
    )
  } catch (error) {
    console.error('Error fetching catalogs:', error)
  }
}

onMounted(async () => {
  await fetchExtraordinaryCatalogs()
})

const getYearId = (y: any) => y.id_anio || y['id_anio'] || y.id_ao;

watch(catalogYears, (years) => {
  const activeYear = years.find(y => y.estado === 'ABIERTO')
  if (activeYear) {
    const activeYearId = getYearId(activeYear)
    if (!extraordinaryForm.value.id_anio) {
      extraordinaryForm.value.id_anio = activeYearId
    }
    if (!reingresoForm.value.id_anio) {
      reingresoForm.value.id_anio = activeYearId
    }
  }
})

const filteredExtraordinaryGroups = computed(() => {
  if (!extraordinaryForm.value.id_nivel) return []
  return catalogGrupos.value.filter(g => g.id_nivel === extraordinaryForm.value.id_nivel)
})

const filteredReingresoGroups = computed(() => {
  if (!reingresoForm.value.id_nivel) return []
  return catalogGrupos.value.filter(g => g.id_nivel === reingresoForm.value.id_nivel)
})

const onStudentSelected = () => {
  const selectedStudentId = extraordinaryForm.value.id_estudiante
  if (selectedStudentId) {
    const student = institutionStudents.value.find(s => s.id_estudiante === selectedStudentId)
    if (student) {
      axios.get(`http://localhost:3000/api/student/${selectedStudentId}/summary`)
        .then(res => {
          if (res.data.parent && res.data.parent.email) {
            extraordinaryForm.value.correo_padre = res.data.parent.email
          }
        })
        .catch(err => {
          console.error("Error fetching student parent email:", err)
        })
    }
  } else {
    extraordinaryForm.value.correo_padre = ''
  }
}

const openReingresoModal = () => {
  reingresoForm.value = {
    id_estudiante: null,
    id_nivel: null,
    id_grupo: null,
    id_anio: catalogYears.value.find(y => y.estado === 'ABIERTO') ? getYearId(catalogYears.value.find(y => y.estado === 'ABIERTO')) : null,
    tiene_discapacidad: false,
    es_extranjero: false,
    motivo: 'Se retiró voluntariamente',
    observaciones: '',
  }
  showReingresoModal.value = true
}

const onReingresoStudentSelected = () => {
  const selectedStudentId = reingresoForm.value.id_estudiante
  if (selectedStudentId) {
    const student = institutionStudents.value.find(s => s.id_estudiante === selectedStudentId)
    if (student) {
      if (student.id_nivel) {
        reingresoForm.value.id_nivel = student.id_nivel
      }
    }
  }
}

const submitExtraordinary = async () => {
  if (!extraordinaryForm.value.correo_padre || !extraordinaryForm.value.id_nivel || !extraordinaryForm.value.id_grupo || !extraordinaryForm.value.id_anio || !extraordinaryForm.value.motivo) {
    notify.addNotification('Por favor, rellene todos los campos obligatorios.', 'error')
    return
  }
  if (extraordinaryForm.value.id_estudiante) {
    const student = institutionStudents.value.find(s => s.id_estudiante === extraordinaryForm.value.id_estudiante)
    if (student && (student.matricula_estado === 'ACTIVA' || student.id_grupo)) {
      notify.addNotification('El estudiante ya cuenta con una matrícula ACTIVA.', 'error')
      return
    }
  }
  extraordinaryLoading.value = true
  try {
    const payload = {
      ...extraordinaryForm.value,
      id_nivel: Number(extraordinaryForm.value.id_nivel),
      id_grupo: Number(extraordinaryForm.value.id_grupo),
      id_anio: Number(extraordinaryForm.value.id_anio),
      id_estudiante: extraordinaryForm.value.id_estudiante ? Number(extraordinaryForm.value.id_estudiante) : null,
    }
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post('http://localhost:3000/api/academic-admin/matriculas/extraordinaria', payload, { headers })
    notify.addNotification('Matrícula extraordinaria creada exitosamente.', 'success')
    showExtraordinaryModal.value = false
    // Reset form
    extraordinaryForm.value = {
      correo_padre: '',
      id_nivel: null,
      id_grupo: null,
      id_anio: catalogYears.value.find(y => y.estado === 'ABIERTO') ? getYearId(catalogYears.value.find(y => y.estado === 'ABIERTO')) : null,
      id_estudiante: null,
      tiene_discapacidad: false,
      es_extranjero: false,
      motivo: '',
      observaciones: '',
    }
    fetchEnrollments()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al crear matrícula extraordinaria', 'error')
  } finally {
    extraordinaryLoading.value = false
  }
}

const submitReingreso = async () => {
  if (!reingresoForm.value.id_estudiante || !reingresoForm.value.id_nivel || !reingresoForm.value.id_grupo || !reingresoForm.value.id_anio || !reingresoForm.value.motivo) {
    notify.addNotification('Por favor, rellene todos los campos obligatorios.', 'error')
    return
  }
  reingresoLoading.value = true
  try {
    const payload = {
      ...reingresoForm.value,
      id_estudiante: Number(reingresoForm.value.id_estudiante),
      id_nivel: Number(reingresoForm.value.id_nivel),
      id_grupo: Number(reingresoForm.value.id_grupo),
      id_anio: Number(reingresoForm.value.id_anio),
    }
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post('http://localhost:3000/api/academic-admin/matriculas/reingreso', payload, { headers })
    notify.addNotification('Solicitud de reingreso creada exitosamente.', 'success')
    showReingresoModal.value = false
    fetchEnrollments()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al crear solicitud de reingreso', 'error')
  } finally {
    reingresoLoading.value = false
  }
}

const approveException = async (id: number) => {
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const endpoint = matricula.value?.tipo === 'REINGRESO'
      ? `http://localhost:3000/api/academic-admin/matriculas/reingreso/${id}/aprobar`
      : `http://localhost:3000/api/academic-admin/matriculas/extraordinaria/${id}/aprobar`;
    const response = await axios.post(endpoint, {}, { headers })
    notify.addNotification(response.data.message || 'Solicitud aprobada exitosamente', 'success')
    closeDrawer()
    fetchEnrollments()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al aprobar solicitud', 'error')
  }
}

const rejectException = async (id: number) => {
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const endpoint = matricula.value?.tipo === 'REINGRESO'
      ? `http://localhost:3000/api/academic-admin/matriculas/reingreso/${id}/rechazar`
      : `http://localhost:3000/api/academic-admin/matriculas/extraordinaria/${id}/rechazar`;
    const response = await axios.post(endpoint, {}, { headers })
    notify.addNotification(response.data.message || 'Solicitud rechazada exitosamente', 'success')
    closeDrawer()
    fetchEnrollments()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al rechazar solicitud', 'error')
  }
}
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div class="flex items-center gap-4">
        <div class="p-3.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
          <ClipboardList :size="28" />
        </div>
        <div>
          <h1 class="text-xl font-black text-slate-900 dark:text-white">Gestión de Matrículas</h1>
          <p class="text-slate-400 dark:text-slate-500 text-sm font-medium">Supervisa y valida las solicitudes de ingreso a la institución.</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 self-start sm:self-center">
        <button @click="showExtraordinaryModal = true" class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center gap-2">
          <Plus :size="16" /> Nueva Matrícula Extraordinaria
        </button>
        <button @click="openReingresoModal" class="px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-lg shadow-violet-100 dark:shadow-none flex items-center gap-2">
          <Plus :size="16" /> Nuevo Reingreso de Estudiante
        </button>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
      <button
        v-for="(tab, i) in tabs" :key="tab.status"
        @click="filterStatus = tab.status"
        :class="[
          filterStatus === tab.status
            ? 'ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-lg'
            : 'hover:shadow-md',
          'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 transition-all text-left'
        ]"
      >
        <p class="text-2xl font-black text-slate-900 dark:text-white">
          {{ [stats.pending, stats.rejected, stats.corrected, stats.active, stats.transferred, stats.cancelled][i] }}
        </p>
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{{ tab.label }}</p>
        <div :class="[
          filterStatus === tab.status ? 'w-full' : 'w-0',
          'h-0.5 rounded-full mt-2 transition-all duration-300',
          tab.color === 'amber'   ? 'bg-amber-500' :
          tab.color === 'orange'  ? 'bg-orange-500' :
          tab.color === 'purple'  ? 'bg-purple-500' :
          tab.color === 'emerald' ? 'bg-emerald-500' :
          tab.color === 'blue'    ? 'bg-blue-500' : 'bg-red-500'
        ]"></div>
      </button>
    </div>

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="18" />
      <input
        v-model="searchQuery" type="text"
        placeholder="Buscar por correo del padre o número de matrícula..."
        class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold outline-none text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/10 transition-all"
      />
    </div>

    <!-- List -->
    <div v-if="loading" class="h-48 flex items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
      <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3"></div>
      <span class="text-slate-400 font-bold text-sm">Cargando matrículas...</span>
    </div>

    <div v-else class="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
      <!-- Empty state -->
      <div v-if="filteredEnrollments.length === 0" class="py-20 text-center text-slate-400">
        <Inbox :size="48" class="mx-auto mb-4 opacity-10" />
        <p class="font-black uppercase text-sm tracking-widest">Sin matrículas en esta categoría</p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 dark:bg-slate-800/50">
            <tr class="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
              <th class="px-6 py-4">ID / Token</th>
              <th class="px-6 py-4">Correo Padre</th>
              <th class="px-6 py-4">Grado</th>
              <th class="px-6 py-4">Estado</th>
              <th class="px-6 py-4 text-right">Gestionar</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50 dark:divide-slate-800">
            <tr
              v-for="en in filteredEnrollments"
              :key="en.id_matricula"
              class="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td class="px-6 py-4">
                <div class="flex items-center gap-1.5 font-sans">
                  <p class="font-black text-slate-900 dark:text-white text-sm">#{{ en.id_matricula }}</p>
                  <span v-if="en.tipo === 'EXTRAORDINARIA'" class="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">Extraordinaria</span>
                  <span v-else-if="en.tipo === 'REINGRESO'" class="bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">Reingreso</span>
                </div>
                <p class="text-[10px] text-slate-400 font-mono">{{ en.token_seguimiento?.substring(0,10) }}...</p>
              </td>
              <td class="px-6 py-4">
                <p class="font-semibold text-slate-700 dark:text-slate-300 text-sm">{{ en.correo_padre }}</p>
              </td>
              <td class="px-6 py-4">
                <p class="text-xs font-bold text-indigo-500 uppercase">ID {{ en.id_grado }}</p>
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-col gap-1.5">
                  <span :class="[getStatusMeta(en.estado).bg, 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit']">
                    {{ getStatusMeta(en.estado).label }}
                  </span>
                  <div v-if="en.es_traslado && ['TRASLADADA','ACTIVA','PENDIENTE'].includes(en.estado)"
                       class="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded-lg w-fit">
                    <ArrowLeftRight :size="10" /> Traslado
                  </div>
                  <div v-if="en.has_pending_docs && en.estado === 'PENDIENTE'"
                       class="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-lg w-fit">
                    <AlertTriangle :size="10" /> Docs Diferidos
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="en.estado === 'ACTIVA' || en.estado === 'TRASLADADA'"
                    @click.stop="fetchAndDownloadPDF(en.id_matricula)"
                    :disabled="isExportingPDF"
                    class="inline-flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wide transition-all disabled:opacity-50 active:scale-95 shrink-0"
                    title="Descargar Ficha PDF"
                  >
                    <Download :size="14" />
                  </button>
                  <button
                    @click="openDrawer(en.id_matricula)"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 rounded-xl text-xs font-black uppercase tracking-wide transition-all group-hover:shadow-md"
                  >
                    <Eye :size="14" /> Gestionar
                    <ChevronRight :size="12" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ─── SLIDE-OVER DRAWER ──────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-[200] flex">
        <div class="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm" @click="closeDrawer"></div>

        <Transition name="drawer-slide">
          <div v-if="drawerOpen" class="fixed right-0 top-0 h-full w-full max-w-[760px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">

            <!-- Drawer Header -->
            <div class="px-8 py-6 bg-gradient-to-r from-indigo-600 to-violet-700 dark:from-indigo-900 dark:to-violet-900 shrink-0">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-indigo-200 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-1">
                    Matrícula #{{ matricula?.id_matricula }}
                  </p>
                  <h2 class="text-xl font-black text-white">
                    {{ matricula && ['ACTIVA', 'TRASLADADA'].includes(matricula.estado) ? 'Detalle de Matrícula' : 'Validación de Documentos' }}
                  </h2>
                  <p v-if="matricula" class="text-indigo-200 text-sm mt-1">
                    {{ ['ACTIVA', 'TRASLADADA'].includes(matricula.estado) ? matricula.student_firstname + ' ' + matricula.student_lastname : matricula.correo_padre }}
                  </p>
                </div>
                <button @click="closeDrawer" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all shrink-0 mt-1">
                  <X :size="20" />
                </button>
              </div>

              <!-- Stepper inside header (Only for non-approved) -->
              <div v-if="matricula && !['ACTIVA', 'TRASLADADA', 'CANCELADA'].includes(matricula.estado)" class="mt-6 flex items-center gap-0">
                <div
                  v-for="s in [{ n: 1, label: 'Salón' }, { n: 2, label: 'Documentos' }, { n: 3, label: 'Registro' }]"
                  :key="s.n"
                  class="flex items-center flex-1 last:flex-none"
                >
                  <div class="flex flex-col items-center gap-1">
                    <div :class="[
                      currentStep >= s.n ? 'bg-white text-indigo-700' : 'bg-white/20 text-white/60',
                      'h-8 w-8 rounded-full flex items-center justify-center font-black text-sm transition-all shrink-0'
                    ]">
                      <CheckCircle v-if="currentStep > s.n" :size="16" />
                      <span v-else>{{ s.n }}</span>
                    </div>
                    <span :class="[currentStep >= s.n ? 'text-white' : 'text-white/50', 'text-[9px] font-black uppercase tracking-widest']">{{ s.label }}</span>
                  </div>
                  <div v-if="s.n < 3" :class="[currentStep > s.n ? 'bg-white' : 'bg-white/20', 'h-0.5 flex-1 mb-4 transition-colors duration-500']"></div>
                </div>
              </div>
            </div>

            <!-- Drawer Loading -->
            <div v-if="detailLoading" class="flex-1 flex items-center justify-center">
              <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <!-- Drawer Body -->
            <div v-else-if="matricula" class="flex-1 overflow-y-auto custom-scrollbar">

              <!-- ── EXTRAORDINARY & REINGRESO PENDING EXCEPTION VIEW ─────────────────── -->
              <div v-if="(matricula.tipo === 'EXTRAORDINARIA' || matricula.tipo === 'REINGRESO') && matricula.estado === 'PENDIENTE'" class="p-8 space-y-6">
                <div :class="[matricula.tipo === 'REINGRESO' ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900 text-violet-950 dark:text-violet-300' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900 text-amber-950 dark:text-amber-300', 'border rounded-[2rem] p-8 text-center space-y-4']">
                  <div :class="[matricula.tipo === 'REINGRESO' ? 'bg-violet-600' : 'bg-amber-600', 'w-20 h-20 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg']">
                    <AlertTriangle v-if="matricula.tipo === 'EXTRAORDINARIA'" :size="40" />
                    <ArrowLeftRight v-else :size="40" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black">{{ matricula.tipo === 'REINGRESO' ? 'Solicitud de Reingreso' : 'Excepción de Matrícula' }}</h3>
                    <p class="text-sm font-medium mt-1 opacity-80">
                      {{ matricula.tipo === 'REINGRESO' ? 'Esta es una solicitud de reingreso estudiantil que requiere aprobación.' : 'Esta es una solicitud de matrícula extraordinaria que requiere aprobación.' }}
                    </p>
                  </div>
                </div>

                <!-- Info Grid -->
                <div class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo Electrónico del Acudiente</p>
                    <p class="font-bold text-slate-900 dark:text-white">{{ matricula.correo_padre }}</p>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nivel Escolar</p>
                      <p class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ matricula.grado_nivel }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sección / Grupo</p>
                      <p class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</p>
                    </div>
                  </div>

                  <div v-if="matricula.id_estudiante" class="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900">
                    <p class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">
                      {{ matricula.tipo === 'REINGRESO' ? 'Ficha del Estudiante a Reingresar' : 'Estudiante Pre-asociado' }}
                    </p>
                    <p class="font-black text-indigo-900 dark:text-indigo-200">
                      {{ matricula.student_firstname }} {{ matricula.student_lastname }}
                    </p>
                    <p class="text-[10px] text-indigo-500 font-bold">Código: {{ matricula.student_code }} | Documento: {{ matricula.student_document }}</p>
                  </div>

                  <div class="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Motivo de Solicitud</p>
                    <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 italic">
                      "{{ matricula.motivo }}"
                    </p>
                  </div>

                  <div v-if="matricula.observaciones" class="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Observaciones</p>
                    <p class="text-xs text-slate-600 dark:text-slate-400">
                      {{ matricula.observaciones }}
                    </p>
                  </div>
                </div>

                <!-- Historial Académico para Reingreso (DR05) -->
                <div v-if="matricula.tipo === 'REINGRESO' && studentSummary" class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
                  <h4 class="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-wider border-b pb-2">Historial Académico Previo</h4>
                  <div class="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p class="text-slate-400">Promedio General (GPA):</p>
                      <p class="font-bold text-slate-800 dark:text-slate-200" :class="studentSummary.gpa < 3.0 ? 'text-red-500' : 'text-emerald-500'">{{ studentSummary.gpa || 'N/A' }}</p>
                    </div>
                    <div>
                      <p class="text-slate-400">Inasistencias totales:</p>
                      <p class="font-bold text-slate-800 dark:text-slate-200">{{ studentSummary.total_inasistencias }}</p>
                    </div>
                    <div>
                      <p class="text-slate-400">Reportes Disciplinarios:</p>
                      <p class="font-bold text-slate-800 dark:text-slate-200">{{ studentSummary.total_disciplinarias }}</p>
                    </div>
                    <div>
                      <p class="text-slate-400">Estado Académico:</p>
                      <p class="font-bold uppercase" :class="studentSummary.estado_academico === 'Crítico' ? 'text-red-500' : studentSummary.estado_academico === 'En riesgo' ? 'text-amber-500' : 'text-emerald-500'">{{ studentSummary.estado_academico }}</p>
                    </div>
                  </div>
                  
                  <div v-if="studentSummary.failed_subjects && studentSummary.failed_subjects.length > 0" class="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl">
                    <p class="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-1">Materias Reprobadas (Último período):</p>
                    <ul class="text-[11px] text-red-600 dark:text-red-400 list-disc list-inside">
                      <li v-for="subj in studentSummary.failed_subjects" :key="subj.id_materia">
                        {{ subj.materia }}: <strong class="font-black">{{ subj.calificacion }}</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Exception approval actions -->
                <div class="flex flex-col sm:flex-row gap-3 pt-4">
                  <button @click="rejectException(matricula.id_matricula)" class="flex-1 py-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900">
                    Rechazar Solicitud
                  </button>
                  <button @click="approveException(matricula.id_matricula)" class="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl">
                    Aprobar Solicitud
                  </button>
                </div>
              </div>

              <!-- ── EXTRAORDINARY & REINGRESO APPROVED (WAITING FOR DOCS) VIEW ────────── -->
              <div v-else-if="(matricula.tipo === 'EXTRAORDINARIA' || matricula.tipo === 'REINGRESO') && matricula.estado === 'APROBADA'" class="p-8 space-y-6">
                <div class="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-[2rem] p-8 text-center space-y-4">
                  <div class="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200 dark:shadow-none">
                    <ShieldCheck :size="40" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-indigo-950 dark:text-indigo-300">Solicitud Aprobada</h3>
                    <p class="text-indigo-700 dark:text-indigo-400 text-sm font-medium mt-1">
                      Esperando que el acudiente suba los documentos requeridos.
                    </p>
                  </div>
                </div>

                <div class="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-6 space-y-4">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enlace de Seguimiento para el Acudiente</p>
                  <p class="text-[11px] font-mono text-slate-500 select-all p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl break-all">
                    http://localhost:5173/matricula/corregir/{{ matricula.token_seguimiento }}
                  </p>
                  <p class="text-xs text-slate-500">
                    Puedes copiar este enlace y enviarlo directamente al acudiente si es necesario.
                  </p>
                </div>

                <!-- Info Grid -->
                <div class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo Electrónico del Acudiente</p>
                    <p class="font-bold text-slate-900 dark:text-white">{{ matricula.correo_padre }}</p>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grado / Grupo Asignado</p>
                      <p class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</p>
                    </div>
                    <div>
                      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jornada</p>
                      <p class="text-sm font-bold text-slate-700 dark:text-slate-300 text-capitalize">{{ matricula.jornada }}</p>
                    </div>
                  </div>
                </div>
                <button @click="closeDrawer" class="w-full py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xl">
                  Cerrar Detalle
                </button>
              </div>

              <!-- ── APPROVED SUMMARY VIEW ────────────────────────────────── -->
              <div v-else-if="matricula.estado === 'ACTIVA' || matricula.estado === 'TRASLADADA'" class="p-8 space-y-8">
                <!-- Status Header Card -->
                <div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-[2rem] p-8 text-center space-y-4">
                  <div class="w-20 h-20 bg-emerald-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200 dark:shadow-none">
                    <ShieldCheck :size="40" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-emerald-900 dark:text-emerald-300">Solicitud Finalizada</h3>
                    <p class="text-emerald-700 dark:text-emerald-400 text-sm font-medium mt-1">
                      El estudiante ha sido registrado exitosamente en el sistema.
                    </p>
                  </div>
                  <div class="flex items-center justify-center gap-6 pt-2">
                    <div class="text-center">
                      <p class="text-[10px] font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-widest">Fecha de Aprobación</p>
                      <p class="text-sm font-bold text-emerald-900 dark:text-emerald-300">{{ formatDate(matricula.fecha_aprobacion) }}</p>
                    </div>
                    <div class="h-8 w-px bg-emerald-200 dark:bg-emerald-800"></div>
                    <div class="text-center">
                      <p class="text-[10px] font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-widest">Estado Final</p>
                      <span class="px-3 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                        {{ matricula.estado }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Student & Parent Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Student Card -->
                  <div class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
                    <div class="flex items-center gap-3 pb-4 border-b border-slate-50 dark:border-slate-700">
                      <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <User :size="20" />
                      </div>
                      <h4 class="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Datos del Estudiante</h4>
                    </div>
                    
                    <div class="space-y-4">
                      <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</p>
                        <p class="font-bold text-slate-900 dark:text-white">{{ matricula.student_firstname }} {{ matricula.student_lastname }}</p>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Documento</p>
                          <p class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ matricula.student_document }}</p>
                        </div>
                        <div>
                          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Código Portal</p>
                          <p class="text-sm font-bold text-indigo-600 dark:text-indigo-400">{{ matricula.student_code }}</p>
                        </div>
                      </div>
                      <div class="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Curso Asignado</p>
                        <p class="font-black text-slate-900 dark:text-white">{{ matricula.tipo_grado }} - {{ matricula.seccion }}</p>
                        <p class="text-[10px] font-bold text-indigo-500 uppercase mt-0.5">{{ matricula.grado_nivel }} · {{ matricula.jornada }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Parent Card -->
                  <div class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
                    <div class="flex items-center gap-3 pb-4 border-b border-slate-50 dark:border-slate-700">
                      <div class="p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
                        <MapPin :size="20" />
                      </div>
                      <h4 class="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Información del Acudiente</h4>
                    </div>

                    <div class="space-y-4">
                      <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</p>
                        <p class="font-bold text-slate-900 dark:text-white">{{ matricula.parent_firstname }} {{ matricula.parent_lastname }}</p>
                      </div>
                      <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Documento de Identidad</p>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ matricula.parent_document }}</p>
                      </div>
                      <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo Electrónico</p>
                        <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-bold break-all">
                          <Mail :size="14" />
                          {{ matricula.correo_padre }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Document Access Section -->
                <div class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div class="flex items-center justify-between pb-2 border-b border-slate-50 dark:border-slate-700">
                    <div class="flex items-center gap-2">
                       <FileText :size="16" class="text-slate-400" />
                       <h4 class="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-[0.2em]">Documentación Adjunta</h4>
                    </div>
                    <span class="text-[10px] font-black text-emerald-500 uppercase">Validados</span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div v-for="doc in matricula.documentos" :key="doc.id_documento" 
                         class="group flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-200 transition-all">
                      <div class="flex items-center gap-3 overflow-hidden">
                        <div class="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                          <FileText :size="14" class="text-indigo-500" />
                        </div>
                        <p class="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate tracking-tight">
                          {{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}
                        </p>
                      </div>
                      <a :href="formatUrl(doc.url)" target="_blank" class="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-500 rounded-lg transition-colors">
                        <ExternalLink :size="14" />
                      </a>
                    </div>
                  </div>
                </div>

                 <div class="flex flex-col sm:flex-row gap-3 pt-4">
                  <button @click="showCancelModal = true" class="flex-1 py-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900 font-sans">
                    Cancelar Matrícula
                  </button>
                  <button 
                    @click="downloadPDF(matricula)" 
                    :disabled="isExportingPDF"
                    class="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wide hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <span v-if="isExportingPDF" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <Download v-else :size="16" />
                    Descargar Ficha (PDF)
                  </button>
                  <button @click="closeDrawer" class="flex-1 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xl">
                    Cerrar Detalle
                  </button>
                </div>
              </div>

              <!-- ── STEP 1: Assign Room (Non-Approved) ────────────────────── -->
              <div v-else-if="currentStep === 1" class="p-8 space-y-6">
                <!-- Active/Transferred banner -->
                <div v-if="matricula.estado === 'ACTIVA' || matricula.estado === 'TRASLADADA'"
                     :class="['p-5 rounded-3xl flex items-start sm:items-center justify-between gap-4',
                               matricula.estado === 'ACTIVA' ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900' : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900']">
                  <div class="flex items-center gap-3">
                    <div :class="[matricula.estado === 'ACTIVA' ? 'bg-emerald-600' : 'bg-blue-600', 'p-2.5 text-white rounded-2xl']">
                      <ShieldCheck :size="20" />
                    </div>
                    <div>
                      <p :class="[matricula.estado === 'ACTIVA' ? 'text-emerald-900 dark:text-emerald-300' : 'text-blue-900 dark:text-blue-300', 'font-black text-sm']">
                        {{ matricula.estado === 'ACTIVA' ? 'Matrícula Aprobada (Activa)' : 'Matrícula por Traslado' }}
                      </p>
                      <p :class="[matricula.estado === 'ACTIVA' ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400', 'text-xs font-medium']">
                        Procesada exitosamente.
                      </p>
                    </div>
                  </div>
                  <button @click="showCancelModal = true" class="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-red-700 transition-all shrink-0">
                    Cancelar
                  </button>
                </div>

                <!-- Cancelled banner -->
                <div v-if="matricula.estado === 'CANCELADA'" class="p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-3xl flex items-start gap-4">
                  <div class="p-2.5 bg-red-600 text-white rounded-2xl"><XCircle :size="20" /></div>
                  <div>
                    <p class="font-black text-red-900 dark:text-red-300 text-sm">Matrícula Cancelada</p>
                    <p class="text-xs font-bold text-red-700 dark:text-red-400 mt-1">{{ matricula.motivo_cancelacion || 'Sin motivo especificado.' }}</p>
                    <p v-if="matricula.detalles_cancelacion" class="text-[10px] text-red-600 dark:text-red-500 mt-1">{{ matricula.detalles_cancelacion }}</p>
                  </div>
                </div>

                <!-- Info card -->
                <div class="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-6">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Referencia de Solicitud</p>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xl font-black text-slate-900 dark:text-white">{{ matricula.grado_nivel }}</p>
                      <p class="text-sm font-bold text-indigo-500">{{ matricula.tipo_grado }} · {{ matricula.jornada }}</p>
                    </div>
                    <span :class="[getStatusMeta(matricula.estado).bg, 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest']">{{ getStatusMeta(matricula.estado).label }}</span>
                  </div>
                </div>

                <!-- Transfer toggle -->
                <div class="bg-indigo-50/50 dark:bg-indigo-950/10 rounded-3xl p-5 border border-indigo-100 dark:border-indigo-900 flex items-center justify-between gap-4">
                  <div>
                    <p class="font-black text-indigo-900 dark:text-indigo-300 text-sm">Matrícula por Traslado</p>
                    <p class="text-[10px] text-indigo-700 dark:text-indigo-400 mt-0.5">Estudiante proveniente de otra institución.</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="matricula.es_traslado" @change="toggleTransfer" class="sr-only peer" :disabled="isReadonly" />
                    <div class="w-12 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <!-- Section Selector -->
                <div class="space-y-3">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Seleccionar Salón</p>
                  <div class="space-y-2">
                    <button
                      v-for="section in matricula.availableSections"
                      :key="section.id_grado"
                      @click="selectedGradeId = section.id_grado"
                      :disabled="section.cupos_restantes <= 0 || isReadonly"
                      :class="[
                        selectedGradeId === section.id_grado
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 ring-2 ring-indigo-100 dark:ring-indigo-900'
                          : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-800',
                        section.cupos_restantes <= 0 ? 'opacity-40 cursor-not-allowed' : '',
                        'w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all'
                      ]"
                    >
                      <div class="flex items-center gap-3">
                        <div :class="[selectedGradeId === section.id_grado ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400', 'h-11 w-11 rounded-xl flex items-center justify-center font-black text-lg transition-colors']">
                          {{ section.seccion }}
                        </div>
                        <div>
                          <p class="font-black text-slate-900 dark:text-white text-sm">{{ matricula.tipo_grado }} ({{ section.seccion }})</p>
                          <p class="text-[10px] text-slate-400">{{ matricula.jornada }}</p>
                        </div>
                      </div>
                      <div class="text-right">
                        <p :class="[section.cupos_restantes > 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400', 'text-lg font-black']">{{ section.cupos_restantes }}</p>
                        <p class="text-[9px] uppercase tracking-widest text-slate-400 font-black">cupos</p>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  @click="assignRoom"
                  :disabled="!selectedGradeId || savingGrade || isReadonly"
                  class="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {{ matricula.estado === 'ACTIVA' ? 'Continuar' : 'Confirmar y Continuar' }}
                  <ArrowLeft :size="18" class="rotate-180" />
                </button>
              </div>

              <!-- ── STEP 2: Documents ──────────────────────────────────────── -->
              <div v-if="currentStep === 2" class="p-8 space-y-6">
                <!-- Context bar -->
                <div class="grid grid-cols-3 gap-3">
                  <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nivel</p>
                    <p class="font-black text-slate-900 dark:text-white text-sm">{{ matricula.grado_nivel }}</p>
                    <p class="text-[10px] text-indigo-500 font-bold">{{ matricula.tipo_grado }} · Sección {{ matricula.seccion }}</p>
                  </div>
                  <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Padre</p>
                    <p class="font-bold text-slate-900 dark:text-white text-xs break-all">{{ matricula.correo_padre }}</p>
                  </div>
                  <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 flex items-center justify-center">
                    <button @click="currentStep = 1" class="text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center gap-1 hover:underline">
                      <ArrowLeft :size="14" /> Cambiar Salón
                    </button>
                  </div>
                </div>

                <!-- Documents -->
                <div class="space-y-3">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <BookOpen :size="13" />Documentos Entregados
                  </p>
                  <div
                    v-for="doc in matricula.documentos"
                    :key="doc.id_documento"
                    class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div class="flex items-center gap-3 flex-1">
                      <div class="p-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm">
                        <FileText :size="18" class="text-indigo-500" />
                      </div>
                      <div>
                        <p class="font-black text-slate-900 dark:text-white text-sm">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
                        <span :class="[getDocStatusClass(doc.estado), 'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full']">{{ doc.estado }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <a :href="formatUrl(doc.url)" target="_blank"
                         class="p-2 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all shadow-sm">
                        <ExternalLink :size="16" />
                      </a>
                      <div class="flex items-center bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl p-1 gap-1">
                        <template v-if="doc.estado === 'PENDIENTE'">
                          <button @click="updateDocumentStatus(doc.id_documento, 'VALIDADO')" :disabled="isReadonly"
                                  class="px-3 py-1.5 rounded-lg text-xs font-black text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-30 flex items-center gap-1">
                            <CheckCircle :size="14" />OK
                          </button>
                          <button @click="updateDocumentStatus(doc.id_documento, 'RECHAZADO')" :disabled="isReadonly"
                                  class="px-3 py-1.5 rounded-lg text-xs font-black text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors disabled:opacity-30 flex items-center gap-1">
                            <XCircle :size="14" />No
                          </button>
                        </template>
                        <button v-else @click="updateDocumentStatus(doc.id_documento, 'PENDIENTE')" :disabled="isReadonly"
                                class="px-3 py-1.5 rounded-lg text-xs font-black text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-30 flex items-center gap-1">
                          <AlertCircle :size="14" />Re-revisar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Step 2 footer actions -->
                <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div v-if="isReadonly" class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle :size="18" />Matrícula ya procesada.
                  </div>
                  <div v-else-if="allValidated" class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                    <CheckCircle :size="18" />Todos los documentos validados.
                  </div>
                  <div v-else class="text-slate-500 dark:text-slate-400 text-xs font-medium">Valida todos los documentos para continuar.</div>

                  <div class="flex gap-2">
                    <button v-if="isReadonly" @click="currentStep = 3"
                            class="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-100 dark:shadow-none">
                      Ver Resumen <ArrowLeft :size="14" class="rotate-180" />
                    </button>
                    <button v-else-if="['PENDIENTE', 'CORRECCION'].includes(matricula.estado) && allValidated" @click="currentStep = 3"
                            class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-100 dark:shadow-none">
                      Siguiente <ArrowLeft :size="14" class="rotate-180" />
                    </button>
                    <button v-else-if="['PENDIENTE','RECHAZADA','CORRECCION'].includes(matricula.estado)" @click="handleSave"
                            class="px-5 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-indigo-600 transition-all flex items-center gap-1.5">
                      <Save :size="14" />Guardar
                    </button>
                  </div>
                </div>
              </div>

              <!-- ── STEP 3: Finalize ───────────────────────────────────────── -->
              <div v-if="currentStep === 3" class="p-8">
                <div class="text-center space-y-4">
                  <div class="mx-auto w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ShieldCheck :size="40" />
                  </div>
                  <h2 class="text-2xl font-black text-slate-900 dark:text-white">¡Todo Listo!</h2>
                  <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                    Salón <strong class="text-slate-900 dark:text-white">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</strong> asignado y documentos validados.
                  </p>
                </div>

                <div class="mt-8 p-6 bg-emerald-50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100 dark:border-emerald-900 space-y-3">
                  <p class="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest mb-3">Resumen de Registro</p>
                  <div class="flex justify-between text-sm"><span class="text-emerald-700 dark:text-emerald-400">Nivel</span><span class="font-black text-emerald-900 dark:text-emerald-200">{{ matricula.grado_nivel }}</span></div>
                  <div class="flex justify-between text-sm"><span class="text-emerald-700 dark:text-emerald-400">Curso</span><span class="font-black text-emerald-900 dark:text-emerald-200">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</span></div>
                  <div class="flex justify-between text-sm"><span class="text-emerald-700 dark:text-emerald-400">Jornada</span><span class="font-black text-emerald-900 dark:text-emerald-200">{{ matricula.jornada }}</span></div>
                </div>

                <div class="mt-6 space-y-3">
                  <button
                    @click="router.push({ path: `/dashboard/gestion-matriculas/${matricula.id_matricula}/registro`, query: { gradeId: matricula.id_grado } })"
                    class="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2"
                  >
                    Crear Estudiante en el Sistema <ArrowLeft :size="18" class="rotate-180" />
                  </button>
                  <button @click="currentStep = 2" class="w-full py-3.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-sm">
                    Volver a Documentos
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- ── Notify Inconsistencies Modal ─────────────────────────── -->
    <div v-if="showNotifyModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="showNotifyModal = false"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden">
        <div class="p-8 text-center">
          <div class="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><AlertCircle :size="32" /></div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white uppercase">Notificar Inconsistencias</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-3 leading-relaxed">
            Se detectaron <strong class="text-red-600">{{ rejectedDocumentsNames.length }}</strong> documentos rechazados. ¿Notificar al padre?
          </p>
          <div v-if="rejectedDocumentsNames.length" class="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-2xl text-left text-sm text-red-700 dark:text-red-400 space-y-1">
            <li v-for="n in rejectedDocumentsNames" :key="n" class="list-disc list-inside">{{ n }}</li>
          </div>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800/50 px-8 py-6 flex gap-3">
          <button @click="showNotifyModal = false" class="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs uppercase">Cancelar</button>
          <button @click="notifyInconsistencies" class="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"><Send :size="14" />Enviar Correo</button>
        </div>
      </div>
    </div>

    <!-- ── Pending Docs Modal ────────────────────────────────────── -->
    <div v-if="showPendingModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="showPendingModal = false"></div>
      <div class="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden">
        <div class="p-8 text-center">
          <div class="w-14 h-14 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><AlertTriangle :size="28" /></div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white uppercase">Docs Pendientes</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-3 leading-relaxed">Aún tienes documentos sin evaluar. ¿Revisarlos ahora o guardar para después?</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800/50 px-8 py-6 flex gap-3">
          <button @click="showPendingModal = false" class="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs uppercase">Revisar</button>
          <button @click="confirmSaveLater" class="flex-[2] bg-amber-500 text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-amber-600 transition-all">Después</button>
        </div>
      </div>
    </div>

    <!-- ── Cancel Enrollment Modal ───────────────────────────────── -->
    <div v-if="showCancelModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="showCancelModal = false"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden">
        <div class="p-8 text-center">
          <div class="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><XCircle :size="28" /></div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white uppercase">Cancelar Matrícula</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-2">Esta acción es irreversible y liberará el cupo asignado.</p>
        </div>
        <div class="px-8 pb-8 space-y-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo</label>
            <select v-model="cancelMotivo" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white">
              <option>Inconsistencias Graves en Documentos</option>
              <option>Retiro Voluntario</option>
              <option>Falta de Pago / Costos</option>
              <option>Traslado a Otra Institución</option>
              <option>Otro</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detalles (Opcional)</label>
            <textarea v-model="cancelDetalles" rows="3" placeholder="Explica brevemente..." class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white"></textarea>
          </div>
          <div class="flex gap-3 pt-1">
            <button @click="showCancelModal = false" :disabled="cancelling" class="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase">Volver</button>
            <button @click="cancelEnrollment" :disabled="cancelling" class="flex-[2] bg-red-600 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50">
              <span v-if="cancelling" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span v-else>Confirmar</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Nueva Matrícula Extraordinaria Modal ─────────────────── -->
    <div v-if="showExtraordinaryModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="showExtraordinaryModal = false"></div>
      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Modal Header -->
        <div class="px-8 py-6 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0 flex justify-between items-center">
          <div>
            <h3 class="text-lg font-black uppercase tracking-wider text-white">Nueva Matrícula Extraordinaria</h3>
            <p class="text-xs text-indigo-100 mt-1">Registra una excepción de matrícula fuera del calendario ordinario.</p>
          </div>
          <button @click="showExtraordinaryModal = false" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
            <X :size="20" />
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Student Type Selection -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estudiante Existente (Opcional - Renovaciones)</label>
              <select v-model="extraordinaryForm.id_estudiante" @change="onStudentSelected" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-indigo-400">
                <option :value="null">-- Registrar Estudiante Nuevo --</option>
                <option v-for="student in institutionStudents" :key="student.id_estudiante" :value="student.id_estudiante" :disabled="student.matricula_estado === 'ACTIVA' || !!student.id_grupo">
                  {{ student.nombre }} {{ student.apellido }} (Doc: {{ student.documento }} / Cód: {{ student.codigo }}){{ (student.matricula_estado === 'ACTIVA' || student.id_grupo) ? ' - [Matrícula ACTIVA]' : '' }}
                </option>
              </select>
            </div>

            <!-- Parent Email -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico del Acudiente *</label>
              <div class="relative">
                <Mail class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
                <input v-model="extraordinaryForm.correo_padre" type="email" placeholder="acudiente@ejemplo.com" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-3.5 pl-12 pr-4 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-indigo-400" />
              </div>
            </div>

            <!-- Academic Year -->
            <div class="space-y-1.5 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Año Lectivo *</label>
              <select v-model="extraordinaryForm.id_anio" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-indigo-400">
                <option v-for="year in catalogYears" :key="getYearId(year)" :value="getYearId(year)">
                  Año {{ year.calendario }}
                </option>
              </select>
            </div>

            <!-- Level Selection -->
            <div class="space-y-1.5 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel Escolar *</label>
              <select v-model="extraordinaryForm.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-indigo-400">
                <option v-for="nivel in catalogNiveles" :key="nivel.id_nivel" :value="nivel.id_nivel">
                  {{ nivel.nombre }}
                </option>
              </select>
            </div>

            <!-- Group Selection -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grado / Grupo Asignado *</label>
              <select v-model="extraordinaryForm.id_grupo" :disabled="!extraordinaryForm.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed">
                <option :value="null">-- Seleccione el Grupo --</option>
                <option v-for="g in filteredExtraordinaryGroups" :key="g.id_grupo" :value="g.id_grupo">
                  {{ getCourseDisplayName({ tipo_grado_nombre: g.tipo_grado_nombre, seccion_nombre: g.seccion_nombre }) }} ({{ g.jornada_nombre }}) - Cupos Disp: {{ g.cupos_totales - g.matriculas_count }}
                </option>
              </select>
            </div>

            <!-- Checkboxes for foreign/disabled -->
            <div class="flex items-center gap-6 col-span-2 py-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="extraordinaryForm.tiene_discapacidad" class="rounded text-indigo-600 focus:ring-indigo-500" />
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Tiene discapacidad</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="extraordinaryForm.es_extranjero" class="rounded text-indigo-600 focus:ring-indigo-500" />
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Es extranjero</span>
              </label>
            </div>

            <!-- Reason (textarea) -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 font-sans">Motivo de Excepción *</label>
              <textarea v-model="extraordinaryForm.motivo" rows="3" placeholder="Justificación obligatoria de la matrícula extraordinaria..." class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-indigo-400"></textarea>
            </div>

            <!-- Observations (textarea) -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 font-sans">Observaciones Adicionales</label>
              <textarea v-model="extraordinaryForm.observaciones" rows="2" placeholder="Notas internas u observaciones opcionales..." class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-indigo-400"></textarea>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="bg-slate-50 dark:bg-slate-800/50 px-8 py-6 flex gap-3 shrink-0">
          <button @click="showExtraordinaryModal = false" :disabled="extraordinaryLoading" class="flex-1 py-3.5 rounded-xl font-black text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs uppercase">Cancelar</button>
          <button @click="submitExtraordinary" :disabled="extraordinaryLoading" class="flex-[2] bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50">
            <span v-if="extraordinaryLoading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span v-else>Registrar Matrícula</span>
          </button>
        </div>

      </div>
    </div>

    <!-- ── Nuevo Reingreso de Estudiante Modal ─────────────────── -->
    <div v-if="showReingresoModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="showReingresoModal = false"></div>
      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Modal Header -->
        <div class="px-8 py-6 bg-gradient-to-r from-violet-600 to-indigo-700 text-white shrink-0 flex justify-between items-center">
          <div>
            <h3 class="text-lg font-black uppercase tracking-wider text-white">Nuevo Reingreso de Estudiante</h3>
            <p class="text-xs text-indigo-100 mt-1">Registra la solicitud de reingreso para un estudiante previamente retirado o desertor.</p>
          </div>
          <button @click="showReingresoModal = false" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
            <X :size="20" />
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Student Selector -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estudiante Retirado *</label>
              <select v-model="reingresoForm.id_estudiante" @change="onReingresoStudentSelected" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-violet-400">
                <option :value="null">-- Seleccione el Estudiante --</option>
                <option v-for="student in retiredStudents" :key="student.id_estudiante" :value="student.id_estudiante">
                  {{ student.nombre }} {{ student.apellido }} (Doc: {{ student.documento }} / Cód: {{ student.codigo }})
                </option>
              </select>
            </div>

            <!-- Academic Year -->
            <div class="space-y-1.5 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Año Lectivo *</label>
              <select v-model="reingresoForm.id_anio" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-violet-400">
                <option v-for="year in catalogYears" :key="getYearId(year)" :value="getYearId(year)">
                  Año {{ year.calendario }}
                </option>
              </select>
            </div>

            <!-- Level Selection -->
            <div class="space-y-1.5 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel Escolar *</label>
              <select v-model="reingresoForm.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-violet-400">
                <option v-for="nivel in catalogNiveles" :key="nivel.id_nivel" :value="nivel.id_nivel">
                  {{ nivel.nombre }}
                </option>
              </select>
            </div>

            <!-- Group Selection -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grado / Grupo Asignado *</label>
              <select v-model="reingresoForm.id_grupo" :disabled="!reingresoForm.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed">
                <option :value="null">-- Seleccione el Grupo --</option>
                <option v-for="g in filteredReingresoGroups" :key="g.id_grupo" :value="g.id_grupo">
                  {{ getCourseDisplayName({ tipo_grado_nombre: g.tipo_grado_nombre, seccion_nombre: g.seccion_nombre }) }} ({{ g.jornada_nombre }}) - Cupos Disp: {{ g.cupos_totales - g.matriculas_count }}
                </option>
              </select>
            </div>

            <!-- Checkboxes for foreign/disabled -->
            <div class="flex items-center gap-6 col-span-2 py-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="reingresoForm.tiene_discapacidad" class="rounded text-violet-600 focus:ring-violet-500" />
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Tiene discapacidad</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="reingresoForm.es_extranjero" class="rounded text-violet-600 focus:ring-violet-500" />
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Es extranjero</span>
              </label>
            </div>

            <!-- Reason Selector -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo del Reingreso *</label>
              <select v-model="reingresoForm.motivo" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-violet-400">
                <option>Desertó el año pasado</option>
                <option>Se retiró voluntariamente</option>
                <option>Se ausentó un año o más</option>
                <option>Quiere volver al colegio</option>
                <option>Otro</option>
              </select>
            </div>

            <!-- Observations (textarea) -->
            <div class="space-y-1.5 col-span-2 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 font-sans">Observaciones o Notas Académicas</label>
              <textarea v-model="reingresoForm.observaciones" rows="2" placeholder="Notas sobre el estado académico del estudiante o condiciones particulares de reingreso..." class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-semibold outline-none text-slate-900 dark:text-white transition-all focus:border-violet-400"></textarea>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="bg-slate-50 dark:bg-slate-800/50 px-8 py-6 flex gap-3 shrink-0">
          <button @click="showReingresoModal = false" :disabled="reingresoLoading" class="flex-1 py-3.5 rounded-xl font-black text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs uppercase">Cancelar</button>
          <button @click="submitReingreso" :disabled="reingresoLoading" class="flex-[2] bg-violet-600 text-white py-3.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-violet-700 transition-all disabled:opacity-50">
            <span v-if="reingresoLoading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span v-else>Solicitar Reingreso</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>

  <!-- Hidden Printable Ficha de Matricula Template -->
  <div v-if="tempMatricula" style="position: fixed; top: 0; left: 0; width: 816px; height: 100vh; overflow: hidden; pointer-events: none; opacity: 0.005; z-index: -99999;">
    <div ref="tempPrintableRef" style="width: 816px; padding: 48px; background-color: #ffffff; color: #0f172a; font-family: 'Inter', system-ui, -apple-system, sans-serif; box-sizing: border-box;">
    <!-- Header -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 30px;">
      <!-- School Shield (Left) -->
      <div style="width: 120px; height: 90px; flex-shrink: 0;">
        <img v-if="tempMatricula.escudo_url" :src="`http://localhost:3000${tempMatricula.escudo_url}`" crossorigin="anonymous" style="width: 120px; height: 90px; object-fit: contain;" />
        <div v-else style="width: 120px; height: 90px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
      </div>
      <!-- Title (Center) -->
      <div style="text-align: center; flex: 1; padding: 0 20px;">
        <h1 style="font-size: 24px; font-weight: 900; text-transform: uppercase; color: #1e1b4b; margin: 0; letter-spacing: -0.025em;">{{ tempMatricula.school_name || 'ACADEMIANEIVA' }}</h1>
        <p style="font-size: 11px; font-weight: 800; color: #4f46e5; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.15em;">Ficha Oficial de Matrícula Académica</p>
        <p style="font-size: 10px; font-weight: 500; color: #64748b; margin: 4px 0 0 0;">Matrícula Código: #{{ tempMatricula.id_matricula }} | Generado el: {{ new Date().toLocaleDateString('es-CO') }}</p>
      </div>
      <!-- Graduation Cap (Right) -->
      <div style="width: 90px; height: 90px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5"/></svg>
      </div>
    </div>

    <!-- General Grid -->
    <div style="display: flex; gap: 20px; margin-bottom: 35px;">
      <!-- Student Information Card -->
      <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; background-color: #fafafa;">
        <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #4338ca; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; letter-spacing: 0.05em;">Datos del Estudiante</h3>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0; width: 45%;">Nombres:</td>
              <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ tempMatricula.student_firstname }}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Apellidos:</td>
              <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ tempMatricula.student_lastname }}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Documento:</td>
              <td style="font-weight: 700; color: #334155; padding: 6px 0;">{{ tempMatricula.student_document }}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Código Portal:</td>
              <td style="font-weight: 800; color: #4338ca; padding: 6px 0; font-family: monospace;">{{ tempMatricula.student_code }}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Nivel / Grado:</td>
              <td style="font-weight: 700; color: #334155; padding: 6px 0;">{{ tempMatricula.grado_nivel }}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Curso Sección:</td>
              <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ tempMatricula.tipo_grado }} ({{ tempMatricula.seccion }})</td>
            </tr>
            <tr>
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Jornada:</td>
              <td style="font-weight: 800; color: #4338ca; padding: 6px 0; text-transform: uppercase;">{{ tempMatricula.jornada }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Parent Information Card -->
      <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; background-color: #fafafa;">
        <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #b45309; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; letter-spacing: 0.05em;">Datos del Acudiente</h3>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0; width: 45%;">Nombres:</td>
              <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ tempMatricula.parent_firstname }}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Apellidos:</td>
              <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ tempMatricula.parent_lastname }}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Identificación:</td>
              <td style="font-weight: 700; color: #334155; padding: 6px 0;">{{ tempMatricula.parent_document }}</td>
            </tr>
            <tr>
              <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Correo Electrónico:</td>
              <td style="font-weight: 700; color: #4338ca; padding: 6px 0; word-break: break-all;">{{ tempMatricula.correo_padre }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Validated Documents -->
    <div style="border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; margin-bottom: 45px;">
      <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #334155; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; letter-spacing: 0.05em;">Documentación Verificada y Validada</h3>
      <div v-if="tempMatricula.documentos && tempMatricula.documentos.length > 0" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div v-for="doc in tempMatricula.documentos" :key="doc.id_documento" style="font-size: 11px; display: flex; align-items: center; gap: 8px;">
          <span style="color: #10b981; font-weight: 900; font-size: 14px;">✔</span>
          <span style="font-weight: 700; color: #334155;">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</span>
          <span style="color: #64748b; font-size: 9px; font-style: italic;">({{ doc.estado }})</span>
        </div>
      </div>
      <div v-else style="padding: 12px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; display: flex; align-items: center; gap: 8px; color: #b45309; font-size: 11px; font-weight: 700; line-height: 1.4;">
        <span style="font-size: 14px; margin-right: 4px;">⚠</span>
        <span>Atención: Esta matrícula se encuentra registrada para desarrollo y no cuenta con documentos de validación adjuntos en el sistema.</span>
      </div>
    </div>

    <!-- Attached Document Pages -->
    <template v-if="tempMatricula.documentos && tempMatricula.documentos.length > 0">
      <div v-for="doc in tempMatricula.documentos" :key="'attach-' + doc.id_documento" style="page-break-before: always;">
        <!-- Document Page Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 24px;">
          <div style="width: 80px; height: 64px; flex-shrink: 0;">
            <img v-if="tempMatricula.escudo_url" :src="`http://localhost:3000${tempMatricula.escudo_url}`" crossorigin="anonymous" style="width: 80px; height: 64px; object-fit: contain;" />
            <div v-else style="width: 80px; height: 64px; background: #f1f5f9; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
          </div>
          <div style="text-align: center; flex: 1; padding: 0 16px;">
            <p style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #1e1b4b; margin: 0;">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
            <p style="font-size: 9px; font-weight: 600; color: #64748b; margin: 4px 0 0 0;">Estudiante: {{ tempMatricula.student_firstname }} {{ tempMatricula.student_lastname }} · Doc: {{ tempMatricula.student_document }}</p>
          </div>
          <div style="width: 64px; height: 64px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5"/></svg>
          </div>
        </div>
        <!-- Document Content -->
        <div v-if="doc.url && !doc.url.toLowerCase().endsWith('.pdf')" style="text-align: center; padding: 10px;">
          <img :src="formatUrl(doc.url)" crossorigin="anonymous" style="max-width: 100%; max-height: 820px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0;" />
        </div>
        <div v-else-if="doc.url && doc.url.toLowerCase().endsWith('.pdf')" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; border: 2px dashed #cbd5e1; border-radius: 20px; margin: 40px 0; background: #f8fafc;">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <p style="font-size: 16px; font-weight: 800; color: #334155; margin: 20px 0 6px 0;">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
          <p style="font-size: 11px; font-weight: 600; color: #94a3b8; margin: 0;">Documento PDF adjunto digitalmente — Ver en plataforma</p>
        </div>
        <div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; border: 2px dashed #fef3c7; border-radius: 20px; margin: 40px 0; background: #fffbeb;">
          <p style="font-size: 14px; font-weight: 700; color: #b45309;">Documento pendiente de carga</p>
        </div>
      </div>
    </template>

    <!-- Signatures -->
    <div style="display: flex; justify-content: space-between; margin-top: 100px; padding-left: 20px; padding-right: 20px;">
      <div style="text-align: center; width: 280px;">
        <div style="border-bottom: 1px solid #94a3b8; height: 1px; margin-bottom: 10px;"></div>
        <p style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">{{ tempMatricula.parent_firstname }} {{ tempMatricula.parent_lastname }}</p>
        <p style="font-size: 10px; font-weight: 600; color: #64748b; margin: 4px 0 0 0;">Firma del Acudiente Responsable</p>
        <p style="font-size: 9px; font-weight: 500; color: #94a3b8; margin: 2px 0 0 0;">Documento: {{ tempMatricula.parent_document }}</p>
      </div>
      
      <div style="text-align: center; width: 280px;">
        <div style="border-bottom: 1px solid #94a3b8; height: 1px; margin-bottom: 10px;"></div>
        <p style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">Secretaría Académica</p>
        <p style="font-size: 10px; font-weight: 600; color: #64748b; margin: 4px 0 0 0;">Firma de Aprobación Institucional</p>
        <p style="font-size: 9px; font-weight: 500; color: #94a3b8; margin: 2px 0 0 0;">Firma Autorizada</p>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active { transition: opacity 0.3s ease; }
.drawer-fade-enter-from,
.drawer-fade-leave-to { opacity: 0; }

.drawer-slide-enter-active,
.drawer-slide-leave-active { transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-slide-enter-from,
.drawer-slide-leave-to { transform: translateX(100%); }

.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
</style>
