<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import html2pdf from 'html2pdf.js'
import { useNotificationStore } from '../../stores/notifications'
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  ExternalLink,
  Save,
  AlertCircle,
  AlertTriangle,
  Send,
  ClipboardList,
  ShieldCheck,
  User,
  Mail,
  GraduationCap,
  Download
} from 'lucide-vue-next'

import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

const route = useRoute()
const router = useRouter()
const notify = useNotificationStore()

const currentStep = ref(1)
const matricula = ref<any>(null)
const loading = ref(true)
const selectedGradeId = ref<number | null>(null)
const savingGrade = ref(false)
const pdfPagesMap = ref<Record<number, string[]>>({})

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
  certificadosEscolaridad: 'Certificado de Escolaridad (Años anteriores)'
}

const renderAllPdfDocuments = async () => {
  if (!matricula.value || !matricula.value.documentos) return
  for (const doc of matricula.value.documentos) {
    if (doc.url && doc.url.toLowerCase().endsWith('.pdf')) {
      try {
        const fullUrl = formatUrl(doc.url)
        const loadingTask = pdfjsLib.getDocument({ url: fullUrl } as any)
        const pdf = await loadingTask.promise
        const pages: string[] = []

        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) continue

          canvas.height = viewport.height
          canvas.width = viewport.width

          await (page.render({ canvasContext: context, viewport, canvas } as any)).promise
          pages.push(canvas.toDataURL('image/png'))
        }

        pdfPagesMap.value[doc.id_documento] = pages
      } catch (err) {
        console.error(`Error procesando páginas de PDF para doc ${doc.id_documento}:`, err)
      }
    }
  }
}

const fetchDetails = async () => {
  try {
    const response = await axios.get(`http://localhost:3000/api/matriculas/${route.params.id}`)
    matricula.value = response.data
    selectedGradeId.value = response.data.id_grado
    renderAllPdfDocuments()
  } catch {
    notify.addNotification('Error al cargar la solicitud', 'error')
    router.push('/dashboard/gestion-matriculas')
  } finally {
    loading.value = false
  }
}

const showCancelModal = ref(false)
const cancelMotivo = ref('Retiro Voluntario')
const cancelDetalles = ref('')
const cancelling = ref(false)

const isReadonly = computed(() =>
  matricula.value && ['ACTIVA', 'TRASLADADA', 'CANCELADA'].includes(matricula.value.estado)
)



const cancelEnrollment = async () => {
  if (!cancelMotivo.value) return
  cancelling.value = true
  try {
    await axios.post(`http://localhost:3000/api/matriculas/cancel/${route.params.id}`, {
      motivo: cancelMotivo.value, detalles: cancelDetalles.value
    })
    notify.addNotification('Matrícula cancelada exitosamente', 'success')
    showCancelModal.value = false
    fetchDetails()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al cancelar la matrícula', 'error')
  } finally {
    cancelling.value = false
  }
}

const assignRoom = async () => {
  if (!selectedGradeId.value) return
  const selected = matricula.value.availableSections.find((s: any) => s.id_grado === selectedGradeId.value)
  if (selected) {
    savingGrade.value = true
    try {
      await axios.post(`http://localhost:3000/api/matriculas/assign-grade/${route.params.id}`, {
        idGrado: selected.id_grado
      })
      matricula.value.seccion = selected.seccion
      matricula.value.id_grado = selected.id_grado
      matricula.value.id_grupo = selected.id_grado
      notify.addNotification(`Salón ${selected.seccion} asignado y guardado correctamente`, 'success')
    } catch (e) {
      console.error('Error al guardar salón:', e)
      notify.addNotification('No se pudo guardar la asignación del salón en el servidor', 'error')
    } finally {
      savingGrade.value = false
    }
  }
  currentStep.value = 2
}

onMounted(fetchDetails)

const showNotifyModal = ref(false)
const showPendingModal = ref(false)

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
  const hasPending = matricula.value.documentos.some((d: any) => d.estado === 'PENDIENTE')
  if (hasRejected) showNotifyModal.value = true
  else if (hasPending) showPendingModal.value = true
  else {
    notify.addNotification('Cambios guardados', 'success')
    router.push('/dashboard/gestion-matriculas')
  }
}

const confirmSaveLater = () => {
  notify.addNotification('Guardado. Recuerda revisar los pendientes después.', 'info')
  router.push('/dashboard/gestion-matriculas')
}

const notifyInconsistencies = async () => {
  try {
    await axios.post(`http://localhost:3000/api/matriculas/notify-inconsistencies/${route.params.id}`)
    notify.addNotification('Notificación enviada al padre', 'success')
    showNotifyModal.value = false
    router.push('/dashboard/gestion-matriculas')
  } catch {
    notify.addNotification('Error al enviar notificación', 'error')
  }
}

const getDocStatusClass = (estado: string) => {
  if (estado === 'PENDIENTE') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
  if (estado === 'VALIDADO')  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
  return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
}

const getStatusMeta = (status: string) => {
  if (status === 'PENDIENTE')  return { label: 'Por Revisar',     bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' }
  if (status === 'RECHAZADA')  return { label: 'En Corrección',   bg: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' }
  if (status === 'CORRECCION') return { label: 'Docs Corregidos', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' }
  if (status === 'ACTIVA')     return { label: 'Aprobada',        bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
  if (status === 'TRASLADADA') return { label: 'Traslado',        bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' }
  if (status === 'CANCELADA')  return { label: 'Cancelada',       bg: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
  return { label: status, bg: 'bg-slate-100 text-slate-600' }
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

const isExportingPDF = ref(false)
const printableRef = ref<HTMLElement | null>(null)

const downloadEnrollmentPDF = async () => {
  if (!matricula.value || isExportingPDF.value || !printableRef.value) return
  isExportingPDF.value = true

  try {
    const opt = {
      margin:       0,
      filename:     `ficha_matricula_${matricula.value.student_code}_${matricula.value.id_matricula}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 816 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const },
      pagebreak:    { mode: ['css', 'legacy'] }
    }
    
    await html2pdf().set(opt).from(printableRef.value!).save()
  } catch (err) {
    console.error("Error al exportar ficha en PDF:", err)
    notify.addNotification("Error al generar el PDF de la ficha", "error")
  } finally {
    isExportingPDF.value = false
  }
}

const getRenewalBadgeClass = (state?: string) => {
  switch (state) {
    case 'VIGENTE': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'RECOMENDADO_ACTUALIZAR': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
    case 'OBLIGATORIO_ACTUALIZAR': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
    case 'DESACTUALIZADO_POR_FECHA': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}

const formatRenewalStateLabel = (state?: string) => {
  switch (state) {
    case 'VIGENTE': return 'VIGENTE (Conservar)'
    case 'RECOMENDADO_ACTUALIZAR': return 'RECOMENDADO ACTUALIZAR'
    case 'OBLIGATORIO_ACTUALIZAR': return 'OBLIGATORIO ACTUALIZAR'
    case 'DESACTUALIZADO_POR_FECHA': return 'DESACTUALIZADO POR FECHA'
    default: return state || ''
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-6 flex items-center gap-4">
      <button @click="router.back()" class="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
        <ArrowLeft :size="22" class="text-slate-600 dark:text-slate-400" />
      </button>
      <div>
        <h1 class="text-xl font-black text-slate-900 dark:text-white">
           {{ matricula && ['ACTIVA', 'TRASLADADA'].includes(matricula.estado) ? 'Matrícula Aprobada' : 'Validación de Documentos' }}
        </h1>
        <p class="text-slate-400 dark:text-slate-500 text-sm font-medium">Matrícula #{{ route.params.id }}</p>
      </div>
    </div>

    <!-- Stepper (Only for non-finalized) -->
    <div v-if="matricula && !['ACTIVA', 'TRASLADADA', 'CANCELADA'].includes(matricula.estado)" class="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm p-6">
      <div class="flex items-center gap-0">
        <div
          v-for="s in [{ n: 1, label: 'Salón' }, { n: 2, label: 'Documentos' }, { n: 3, label: 'Registro' }]"
          :key="s.n"
          class="flex items-center flex-1 last:flex-none"
        >
          <div class="flex flex-col items-center gap-1">
            <div :class="[
              currentStep >= s.n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700',
              'h-10 w-10 rounded-full border-2 flex items-center justify-center font-black transition-all'
            ]">
              <CheckCircle v-if="currentStep > s.n" :size="18" />
              <span v-else>{{ s.n }}</span>
            </div>
            <span :class="[currentStep >= s.n ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold', 'text-[10px] uppercase tracking-widest transition-colors']">{{ s.label }}</span>
          </div>
          <div v-if="s.n < 3" :class="[currentStep > s.n ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700', 'h-0.5 flex-1 mb-5 transition-colors duration-500']"></div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="h-48 flex items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
      <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3"></div>
      <span class="text-slate-400 font-bold text-sm">Cargando detalles...</span>
    </div>

    <div v-else-if="matricula" class="space-y-6">
      <!-- ── APPROVED SUMMARY VIEW ────────────────────────────────── -->
      <div v-if="matricula.estado === 'ACTIVA' || matricula.estado === 'TRASLADADA'" class="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- Status Header Card -->
        <div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-[2.5rem] p-10 text-center space-y-4 shadow-xl shadow-emerald-50 dark:shadow-none">
          <div class="w-24 h-24 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-lg">
            <ShieldCheck :size="48" />
          </div>
          <div>
            <h3 class="text-3xl font-black text-emerald-900 dark:text-emerald-300">Estudiante Registrado</h3>
            <p class="text-emerald-700 dark:text-emerald-400 text-lg font-medium mt-1">
              La matrícula ha sido procesada y el estudiante ya forma parte de la institución.
            </p>
          </div>
          <div class="flex items-center justify-center gap-10 pt-4">
            <div class="text-center">
              <p class="text-xs font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-[0.2em]">Fecha de Aprobación</p>
              <p class="text-lg font-bold text-emerald-900 dark:text-emerald-300 mt-1">{{ formatDate(matricula.fecha_aprobacion) }}</p>
            </div>
            <div class="h-12 w-px bg-emerald-200 dark:bg-emerald-800"></div>
            <div class="text-center">
              <p class="text-xs font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-[0.2em]">Estado</p>
              <span class="inline-block px-4 py-1 bg-emerald-600 text-white rounded-full text-xs font-black uppercase tracking-widest mt-1">
                {{ matricula.estado }}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Student Card -->
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-6 shadow-sm">
            <div class="flex items-center gap-3 pb-4 border-b border-slate-50 dark:border-slate-800">
              <div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <User :size="24" />
              </div>
              <h4 class="font-black text-slate-900 dark:text-white uppercase text-sm tracking-widest">Estudiante</h4>
            </div>
            
            <div class="space-y-5">
              <div>
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre Completo</p>
                <p class="text-lg font-bold text-slate-900 dark:text-white">{{ matricula.student_firstname }} {{ matricula.student_lastname }}</p>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Documento</p>
                  <p class="font-bold text-slate-700 dark:text-slate-300">{{ matricula.student_document }}</p>
                </div>
                <div>
                  <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Código Portal</p>
                  <p class="font-bold text-indigo-600 dark:text-indigo-400">{{ matricula.student_code }}</p>
                </div>
              </div>
              <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Grado y Sección</p>
                <p class="text-xl font-black text-slate-900 dark:text-white">{{ matricula.tipo_grado }} · {{ matricula.seccion }}</p>
                <p class="text-xs font-bold text-indigo-500 uppercase mt-1">{{ matricula.grado_nivel }} · {{ matricula.jornada }}</p>
              </div>
            </div>
          </div>

          <!-- Parent Card -->
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-6 shadow-sm">
            <div class="flex items-center gap-3 pb-4 border-b border-slate-50 dark:border-slate-800">
              <div class="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Mail :size="24" />
              </div>
              <h4 class="font-black text-slate-900 dark:text-white uppercase text-sm tracking-widest">Acudiente</h4>
            </div>

            <div class="space-y-5">
              <div>
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre Completo</p>
                <p class="text-lg font-bold text-slate-900 dark:text-white">{{ matricula.parent_firstname }} {{ matricula.parent_lastname }}</p>
              </div>
              <div>
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Identificación</p>
                <p class="font-bold text-slate-700 dark:text-slate-300">{{ matricula.parent_document }}</p>
              </div>
              <div>
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">E-mail de Contacto</p>
                <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  {{ matricula.correo_padre }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Document Access Section -->
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-6 shadow-sm">
          <div class="flex items-center justify-between pb-4 border-b border-slate-50 dark:border-slate-800">
            <div class="flex items-center gap-3">
              <div class="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl">
                <FileText :size="24" />
              </div>
              <h4 class="font-black text-slate-900 dark:text-white uppercase text-sm tracking-widest">Documentación Adjunta</h4>
            </div>
            <span class="px-4 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-black uppercase tracking-widest">Verificados</span>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div v-for="doc in matricula.documentos" :key="doc.id_documento" 
                 class="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl hover:border-indigo-200 transition-all">
              <div class="flex items-center gap-4 overflow-hidden">
                <div class="p-2.5 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                  <FileText :size="18" class="text-indigo-500" />
                </div>
                <div class="overflow-hidden">
                  <p class="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}
                  </p>
                  <p class="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Archivo PDF/IMG</p>
                </div>
              </div>
              <a :href="formatUrl(doc.url)" target="_blank" class="p-2 hover:bg-white dark:hover:bg-slate-700 text-indigo-500 rounded-xl transition-all shadow-sm">
                <ExternalLink :size="18" />
              </a>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-4 pt-4">
          <button @click="router.push('/dashboard/gestion-matriculas')" class="flex-1 py-5 bg-slate-900 dark:bg-slate-800 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xl">
            Volver al Listado
          </button>
          <button 
            @click="downloadEnrollmentPDF" 
            :disabled="isExportingPDF"
            class="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-indigo-750 transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <span v-if="isExportingPDF" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <Download v-else :size="18" />
            Descargar Ficha (PDF)
          </button>
          <button @click="showCancelModal = true" class="px-8 py-5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900 shrink-0">
            Cancelar Matrícula
          </button>
        </div>
      </div>

      <!-- ── STEP 1 ── -->
      <div v-if="currentStep === 1" class="space-y-4">
        <!-- Active Banner -->
        <div v-if="matricula.estado === 'ACTIVA' || matricula.estado === 'TRASLADADA'"
             :class="['p-5 rounded-3xl flex items-start sm:items-center justify-between gap-4 border', matricula.estado === 'ACTIVA' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900']">
          <div class="flex items-center gap-3">
            <div :class="[matricula.estado === 'ACTIVA' ? 'bg-emerald-600' : 'bg-blue-600', 'p-2.5 text-white rounded-2xl']"><ShieldCheck :size="20" /></div>
            <div>
              <p :class="[matricula.estado === 'ACTIVA' ? 'text-emerald-900 dark:text-emerald-300' : 'text-blue-900 dark:text-blue-300', 'font-black text-sm']">Matrícula Aprobada</p>
              <p :class="[matricula.estado === 'ACTIVA' ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400', 'text-xs font-medium']">Procesada exitosamente.</p>
            </div>
          </div>
          <button @click="showCancelModal = true" class="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all">Cancelar</button>
        </div>

        <!-- ⚠️ BANNER: Este padre es Docente/Directivo -->
        <div
          v-if="matricula.existing_parent_user && !['ACTIVA', 'TRASLADADA', 'CANCELADA'].includes(matricula.estado)"
          class="p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-start gap-4"
        >
          <div class="p-2.5 bg-amber-500 text-white rounded-2xl shrink-0">
            <GraduationCap :size="20" />
          </div>
          <div class="flex-1">
            <p class="font-black text-amber-900 dark:text-amber-300 text-sm">
              Este acudiente ya tiene cuenta activa como
              <span class="uppercase">{{ matricula.existing_parent_user.display_role }}</span>
            </p>
            <p class="text-amber-800 dark:text-amber-400 text-xs mt-1 font-medium">
              <strong>{{ matricula.existing_parent_user.nombre }} {{ matricula.existing_parent_user.apellido }}</strong>
              — {{ matricula.existing_parent_user.email }}
            </p>
            <p class="text-amber-700 dark:text-amber-500 text-xs mt-1.5 italic">
              Al aprobar, el estudiante se vinculará automáticamente a su cuenta existente y se le asignará el rol de Padre.
            </p>
          </div>
        </div>

        <!-- Cancelled Banner -->
        <div v-if="matricula.estado === 'CANCELADA'" class="p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-3xl flex items-start gap-4">
          <div class="p-2.5 bg-red-600 text-white rounded-2xl"><XCircle :size="20" /></div>
          <div>
            <p class="font-black text-red-900 dark:text-red-300 text-sm">Matrícula Cancelada</p>
            <p class="text-xs font-bold text-red-700 dark:text-red-400 mt-1">
              Motivo: {{ matricula.detalles_cancelacion || matricula.motivo_cancelacion || matricula.student_motivo_estado || 'Sin motivo especificado.' }}
            </p>
            <p v-if="matricula.motivo_cancelacion && matricula.detalles_cancelacion && matricula.motivo_cancelacion !== 'Retiro de Estudiante'" class="text-[10px] text-red-600 dark:text-red-500 mt-1">
              Categoría: {{ matricula.motivo_cancelacion }}
            </p>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-8 space-y-6">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl"><ClipboardList :size="22" /></div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white">Asignación de Salón</h2>
              <p class="text-slate-400 text-sm">Verifica cupos y asigna el curso específico.</p>
            </div>
          </div>

          <!-- Info -->
          <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p class="text-xl font-black text-slate-900 dark:text-white">{{ matricula.grado_nivel }}</p>
              <p class="text-sm font-bold text-indigo-500">{{ matricula.tipo_grado }} · {{ matricula.jornada }}</p>
            </div>
            <span :class="[getStatusMeta(matricula.estado).bg, 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest']">{{ getStatusMeta(matricula.estado).label }}</span>
          </div>


          <!-- Section selector -->
          <div class="space-y-2">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Seleccionar Salón</p>
            <button
              v-for="section in matricula.availableSections" :key="section.id_grado"
              @click="selectedGradeId = section.id_grado"
              :disabled="section.cupos_restantes <= 0 || isReadonly"
              :class="[
                selectedGradeId === section.id_grado ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 ring-2 ring-indigo-100' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200',
                section.cupos_restantes <= 0 ? 'opacity-40 cursor-not-allowed' : '',
                'w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all'
              ]"
            >
              <div class="flex items-center gap-3">
                <div :class="[selectedGradeId === section.id_grado ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400', 'h-11 w-11 rounded-xl flex items-center justify-center font-black text-lg transition-colors']">{{ section.seccion }}</div>
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

          <button @click="assignRoom" :disabled="!selectedGradeId || savingGrade || isReadonly"
                  class="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2">
            {{ matricula.estado === 'ACTIVA' ? 'Continuar' : 'Confirmar y Continuar' }}
            <ArrowLeft :size="18" class="rotate-180" />
          </button>
        </div>
      </div>

      <!-- ── STEP 2 ── -->
      <template v-if="currentStep === 2">
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nivel</p>
            <p class="font-black text-slate-900 dark:text-white text-sm">{{ matricula.grado_nivel }}</p>
            <p class="text-[10px] text-indigo-500 font-bold">{{ matricula.tipo_grado }} · {{ matricula.seccion }}</p>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Padre</p>
            <p class="font-bold text-slate-900 dark:text-white text-xs break-all">{{ matricula.correo_padre }}</p>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center justify-center">
            <button @click="currentStep = 1" class="text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center gap-1 hover:underline">
              <ArrowLeft :size="14" /> Cambiar Salón
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="p-6 border-b border-slate-50 dark:border-slate-800">
            <h2 class="text-lg font-black text-slate-900 dark:text-white">Documentos Entregados</h2>
          </div>
          <div class="p-6 space-y-3">
            <div v-for="doc in matricula.documentos" :key="doc.id_documento"
                 class="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 gap-3">
              <div class="flex items-center gap-3 flex-1">
                <div class="p-2.5 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl shadow-sm"><FileText :size="18" class="text-indigo-500" /></div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-black text-slate-900 dark:text-white text-sm">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
                    <span :class="[getDocStatusClass(doc.estado), 'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full']">{{ doc.estado }}</span>
                    <span v-if="doc.estado_renovacion" :class="[getRenewalBadgeClass(doc.estado_renovacion), 'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border']">
                      {{ formatRenewalStateLabel(doc.estado_renovacion) }}
                    </span>
                  </div>
                  <div v-if="doc.url_anterior" class="flex items-center gap-2 mt-1 text-[11px]">
                    <span class="text-slate-400 font-bold">Archivo anterior (v{{ doc.version_anterior || 1 }}):</span>
                    <a :href="formatUrl(doc.url_anterior)" target="_blank" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                      <FileText :size="12" /> Ver archivo antiguo ↗
                    </a>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a :href="formatUrl(doc.url)" target="_blank" class="p-2 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all"><ExternalLink :size="16" /></a>
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
          <div class="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div v-if="isReadonly" class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm"><CheckCircle :size="18" />Ya procesada y aprobada.</div>
            <div v-else-if="allValidated" class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm"><CheckCircle :size="18" />Todos los documentos validados.</div>
            <div v-else class="text-slate-500 dark:text-slate-400 text-xs font-medium">Valida todos los documentos para continuar.</div>
            <div class="flex gap-2">
              <button v-if="isReadonly" @click="currentStep = 3" class="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-emerald-700 transition-all flex items-center gap-1.5">Ver Resumen <ArrowLeft :size="14" class="rotate-180" /></button>
              <button v-else-if="allValidated" @click="currentStep = 3" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 transition-all flex items-center gap-1.5">Siguiente <ArrowLeft :size="14" class="rotate-180" /></button>
              <button v-else @click="handleSave" class="px-5 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-600 transition-all flex items-center gap-1.5"><Save :size="14" />Guardar</button>
            </div>
          </div>
        </div>
      </template>

      <!-- ── STEP 3 ── -->
      <div v-if="currentStep === 3" class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl p-10 text-center space-y-6">
        <div class="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto"><ShieldCheck :size="40" /></div>
        <div>
          <h2 class="text-2xl font-black text-slate-900 dark:text-white">¡Todo Listo!</h2>
          <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm">Salón <strong class="text-slate-900 dark:text-white">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</strong> asignado y documentos validados.</p>
        </div>
        <div class="p-6 bg-emerald-50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100 dark:border-emerald-900 text-left space-y-3">
          <p class="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Resumen</p>
          <div class="flex justify-between text-sm"><span class="text-emerald-700 dark:text-emerald-400">Nivel</span><span class="font-black text-emerald-900 dark:text-emerald-200">{{ matricula.grado_nivel }}</span></div>
          <div class="flex justify-between text-sm"><span class="text-emerald-700 dark:text-emerald-400">Curso</span><span class="font-black text-emerald-900 dark:text-emerald-200">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</span></div>
          <div class="flex justify-between text-sm"><span class="text-emerald-700 dark:text-emerald-400">Jornada</span><span class="font-black text-emerald-900 dark:text-emerald-200">{{ matricula.jornada }}</span></div>
        </div>
        <div class="space-y-3">
          <button @click="router.push({ path: `/dashboard/gestion-matriculas/${route.params.id}/registro`, query: { gradeId: matricula.id_grado } })"
                  class="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2">
            {{ (matricula.renovacion?.is_renovacion || matricula.id_estudiante || matricula.tipo === 'REINGRESO' || matricula.tipo === 'RENOVACION') ? 'Procesar Registro / Renovación' : 'Crear Estudiante en el Sistema' }} <ArrowLeft :size="18" class="rotate-180" />
          </button>
          <button @click="currentStep = 2" class="w-full py-3.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-sm">Volver a Documentos</button>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <div v-if="showNotifyModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8">
        <div class="text-center">
          <div class="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><AlertCircle :size="32" /></div>
          <h3 class="text-xl font-black text-slate-900 dark:text-white">Notificar Inconsistencias</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-3">{{ rejectedDocumentsNames.length }} documentos rechazados. ¿Notificar al padre?</p>
          <div class="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-2xl text-left text-sm text-red-700 dark:text-red-400 space-y-1">
            <li v-for="n in rejectedDocumentsNames" :key="n" class="list-disc list-inside">{{ n }}</li>
          </div>
        </div>
        <div class="mt-8 flex flex-col gap-3">
          <button @click="notifyInconsistencies" class="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><Send :size="18" />Enviar Correo</button>
          <button @click="showNotifyModal = false" class="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Cancelar</button>
        </div>
      </div>
    </div>

    <div v-if="showPendingModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8">
        <div class="text-center">
          <div class="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><AlertTriangle :size="32" /></div>
          <h3 class="text-xl font-black text-slate-900 dark:text-white">Docs Pendientes</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-3">¿Revisar ahora o guardar para después?</p>
        </div>
        <div class="mt-8 flex flex-col gap-3">
          <button @click="showPendingModal = false" class="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">Revisar ahora</button>
          <button @click="confirmSaveLater" class="w-full py-4 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-2xl font-bold hover:bg-amber-100 transition-all border border-amber-100 dark:border-amber-900">Lo revisaré después</button>
        </div>
      </div>
    </div>

    <div v-if="showCancelModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8">
        <div class="text-center">
          <div class="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><XCircle :size="32" /></div>
          <h3 class="text-xl font-black text-slate-900 dark:text-white">Cancelar Matrícula</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-2">Esta acción es irreversible y liberará el cupo asignado.</p>
        </div>
        <div class="mt-6 space-y-4">
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Motivo</label>
            <select v-model="cancelMotivo" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-white outline-none">
              <option>Inconsistencias Graves en Documentos</option>
              <option>Retiro Voluntario</option>
              <option>Falta de Pago / Costos</option>
              <option>Traslado a Otra Institución</option>
              <option>Otro</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Detalles Adicionales</label>
            <textarea v-model="cancelDetalles" rows="3" placeholder="Detalles del motivo..." class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white outline-none"></textarea>
          </div>
        </div>
        <div class="mt-6 flex gap-3">
          <button @click="showCancelModal = false" :disabled="cancelling" class="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase">Volver</button>
          <button @click="cancelEnrollment" :disabled="cancelling" class="flex-[2] bg-red-600 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50">
            <span v-if="cancelling" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span v-else>Confirmar Cancelación</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Hidden Printable Ficha de Matricula Template -->
    <div v-if="matricula" style="position: fixed; top: 0; left: 0; width: 816px; height: 100vh; overflow: hidden; pointer-events: none; opacity: 0.005; z-index: -99999;">
      <div ref="printableRef" style="width: 816px; padding: 48px; background-color: #ffffff; color: #0f172a; font-family: 'Inter', system-ui, -apple-system, sans-serif; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 30px;">
        <!-- School Shield (Left) -->
        <div style="width: 120px; height: 90px; flex-shrink: 0;">
          <img v-if="matricula.escudo_url" :src="`http://localhost:3000${matricula.escudo_url}`" crossorigin="anonymous" style="width: 120px; height: 90px; object-fit: contain;" />
          <div v-else style="width: 120px; height: 90px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
        </div>
        <!-- Title (Center) -->
        <div style="text-align: center; flex: 1; padding: 0 20px;">
          <h1 style="font-size: 24px; font-weight: 900; text-transform: uppercase; color: #1e1b4b; margin: 0; letter-spacing: -0.025em;">{{ matricula.school_name || 'ACADEMIANEIVA' }}</h1>
          <p style="font-size: 11px; font-weight: 800; color: #4f46e5; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.15em;">Ficha Oficial de Matrícula Académica</p>
          <p style="font-size: 10px; font-weight: 500; color: #64748b; margin: 4px 0 0 0;">Matrícula Código: #{{ route.params.id }} | Generado el: {{ new Date().toLocaleDateString('es-CO') }}</p>
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
                <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ matricula.student_firstname }}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Apellidos:</td>
                <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ matricula.student_lastname }}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Documento:</td>
                <td style="font-weight: 700; color: #334155; padding: 6px 0;">{{ matricula.student_document }}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Código Portal:</td>
                <td style="font-weight: 800; color: #4338ca; padding: 6px 0; font-family: monospace;">{{ matricula.student_code }}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Nivel / Grado:</td>
                <td style="font-weight: 700; color: #334155; padding: 6px 0;">{{ matricula.grado_nivel }}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Curso Sección:</td>
                <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</td>
              </tr>
              <tr>
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Jornada:</td>
                <td style="font-weight: 800; color: #4338ca; padding: 6px 0; text-transform: uppercase;">{{ matricula.jornada }}</td>
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
                <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ matricula.parent_firstname }}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Apellidos:</td>
                <td style="font-weight: 800; color: #0f172a; padding: 6px 0;">{{ matricula.parent_lastname }}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Identificación:</td>
                <td style="font-weight: 700; color: #334155; padding: 6px 0;">{{ matricula.parent_document }}</td>
              </tr>
              <tr>
                <td style="font-weight: 700; color: #64748b; padding: 6px 0;">Correo Electrónico:</td>
                <td style="font-weight: 700; color: #4338ca; padding: 6px 0; word-break: break-all;">{{ matricula.correo_padre }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Validated Documents Summary -->
      <div style="border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; margin-bottom: 45px;">
        <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #334155; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; letter-spacing: 0.05em;">Documentación Verificada y Validada</h3>
        <div v-if="matricula.documentos && matricula.documentos.length > 0" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div v-for="doc in matricula.documentos" :key="doc.id_documento" style="font-size: 11px; display: flex; align-items: center; gap: 8px;">
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
      <template v-if="matricula.documentos && matricula.documentos.length > 0">
        <div v-for="doc in matricula.documentos" :key="'attach-' + doc.id_documento" style="page-break-before: always;">
          <!-- Document Page Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 24px;">
            <div style="width: 80px; height: 64px; flex-shrink: 0;">
              <img v-if="matricula.escudo_url" :src="`http://localhost:3000${matricula.escudo_url}`" crossorigin="anonymous" style="width: 80px; height: 64px; object-fit: contain;" />
              <div v-else style="width: 80px; height: 64px; background: #f1f5f9; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
            </div>
            <div style="text-align: center; flex: 1; padding: 0 16px;">
              <p style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #1e1b4b; margin: 0;">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
              <p style="font-size: 9px; font-weight: 600; color: #64748b; margin: 4px 0 0 0;">Estudiante: {{ matricula.student_firstname }} {{ matricula.student_lastname }} · Doc: {{ matricula.student_document }}</p>
            </div>
            <div style="width: 64px; height: 64px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5"/></svg>
            </div>
          </div>
          <!-- Document Content -->
          <div v-if="doc.url && !doc.url.toLowerCase().endsWith('.pdf')" style="text-align: center; padding: 10px;">
            <img :src="formatUrl(doc.url)" crossorigin="anonymous" style="max-width: 100%; max-height: 820px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0;" />
          </div>
          <div v-else-if="doc.url && doc.url.toLowerCase().endsWith('.pdf')">
            <div v-if="pdfPagesMap[doc.id_documento] && pdfPagesMap[doc.id_documento].length > 0" style="text-align: center; padding: 10px;">
              <div v-for="(pageImg, pIdx) in pdfPagesMap[doc.id_documento]" :key="pIdx" style="margin-bottom: 20px;">
                <img :src="pageImg" style="max-width: 100%; max-height: 820px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0;" />
              </div>
            </div>
            <div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; border: 2px dashed #cbd5e1; border-radius: 20px; margin: 40px 0; background: #f8fafc;">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <p style="font-size: 16px; font-weight: 800; color: #334155; margin: 20px 0 6px 0;">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
              <p style="font-size: 11px; font-weight: 600; color: #94a3b8; margin: 0;">Documento PDF adjunto digitalmente — Ver en plataforma</p>
            </div>
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
          <p style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">{{ matricula.parent_firstname }} {{ matricula.parent_lastname }}</p>
          <p style="font-size: 10px; font-weight: 600; color: #64748b; margin: 4px 0 0 0;">Firma del Acudiente Responsable</p>
          <p style="font-size: 9px; font-weight: 500; color: #94a3b8; margin: 2px 0 0 0;">Documento: {{ matricula.parent_document }}</p>
        </div>
        
        <div style="text-align: center; width: 280px;">
          <div style="border-bottom: 1px solid #94a3b8; height: 1px; margin-bottom: 10px;"></div>
          <p style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">Secretaría Académica</p>
          <p style="font-size: 10px; font-weight: 600; color: #64748b; margin: 4px 0 0 0;">Firma de Aprobación Institucional</p>
          <p style="font-size: 9px; font-weight: 500; color: #94a3b8; margin: 2px 0 0 0;">Colegio AcademiaNeiva</p>
        </div>
      </div>
    </div>
  </div>
</div>
</template>
