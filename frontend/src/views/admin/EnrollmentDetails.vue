<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
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
  Mail
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const notify = useNotificationStore()

const currentStep = ref(1)
const matricula = ref<any>(null)
const loading = ref(true)
const selectedGradeId = ref<number | null>(null)
const savingGrade = ref(false)

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

const fetchDetails = async () => {
  try {
    const response = await axios.get(`http://localhost:3000/api/matriculas/${route.params.id}`)
    matricula.value = response.data
    selectedGradeId.value = response.data.id_grado
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

const toggleTransfer = async () => {
  try {
    await axios.patch(`http://localhost:3000/api/matriculas/transfer-status/${route.params.id}`, {
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

const assignRoom = () => {
  if (!selectedGradeId.value) return
  const selected = matricula.value.availableSections.find((s: any) => s.id_grado === selectedGradeId.value)
  if (selected) {
    matricula.value.seccion = selected.seccion
    matricula.value.id_grado = selected.id_grado
    notify.addNotification(`Salón ${selected.seccion} seleccionado temporalmente`, 'info')
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

        <div class="flex gap-4 pt-4">
          <button @click="router.push('/dashboard/gestion-matriculas')" class="flex-1 py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-xl">
            Volver al Listado
          </button>
          <button @click="showCancelModal = true" class="px-10 py-5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900">
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

        <!-- Cancelled Banner -->
        <div v-if="matricula.estado === 'CANCELADA'" class="p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-3xl flex items-start gap-4">
          <div class="p-2.5 bg-red-600 text-white rounded-2xl"><XCircle :size="20" /></div>
          <div>
            <p class="font-black text-red-900 dark:text-red-300 text-sm">Matrícula Cancelada</p>
            <p class="text-xs text-red-700 dark:text-red-400 mt-1">{{ matricula.motivo_cancelacion }}</p>
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

          <!-- Transfer toggle -->
          <div class="bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900 flex items-center justify-between gap-4">
            <div>
              <p class="font-black text-indigo-900 dark:text-indigo-300 text-sm">Matrícula por Traslado</p>
              <p class="text-[10px] text-indigo-700 dark:text-indigo-400 mt-0.5">Estudiante de otra institución.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="matricula.es_traslado" @change="toggleTransfer" class="sr-only peer" :disabled="isReadonly" />
              <div class="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
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
                  <p class="font-black text-slate-900 dark:text-white text-sm">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
                  <span :class="[getDocStatusClass(doc.estado), 'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full']">{{ doc.estado }}</span>
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
              <button v-else-if="matricula.estado === 'PENDIENTE' && allValidated" @click="currentStep = 3" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 transition-all flex items-center gap-1.5">Siguiente <ArrowLeft :size="14" class="rotate-180" /></button>
              <button v-else-if="['PENDIENTE','RECHAZADA'].includes(matricula.estado)" @click="handleSave" class="px-5 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-600 transition-all flex items-center gap-1.5"><Save :size="14" />Guardar</button>
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
            Crear Estudiante en el Sistema <ArrowLeft :size="18" class="rotate-180" />
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
  </div>
</template>
