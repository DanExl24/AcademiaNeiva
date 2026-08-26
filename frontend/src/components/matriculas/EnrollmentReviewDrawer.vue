<script setup lang="ts">
import { computed } from 'vue'
import { API_BASE_URL } from '../../services/api'
import {
  X,
  CheckCircle,
  ArrowLeftRight,
  ArrowLeft,
  ShieldCheck,
  User,
  MapPin,
  FileText,
  ExternalLink,
  Download,
  BookOpen,
  XCircle,
  Save
} from 'lucide-vue-next'


interface Props {
  isOpen: boolean
  matricula: any
  detailLoading: boolean
  studentSummary: any
  currentStep: number
  selectedGradeId: number | null
  savingGrade: boolean
  isExportingPDF: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:currentStep', step: number): void
  (e: 'update:selectedGradeId', id: number | null): void
  (e: 'openCorrection'): void
  (e: 'openCancel'): void
  (e: 'approveException', id: number): void
  (e: 'assignRoom'): void
  (e: 'updateDocStatus', payload: { idDocumento: number; estado: string }): void
  (e: 'downloadPDF', matricula: any): void
  (e: 'saveValidation'): void
  (e: 'confirmSaveLater'): void
  (e: 'goToTrasladoDetail', idSolicitud: number): void
  (e: 'finalizeRegistration', idMatricula: number): void
}>()

const isReadonly = computed(() =>
  props.matricula && ['ACTIVA', 'TRASLADADA', 'CANCELADA', 'RECHAZADA'].includes(props.matricula.estado)
)

const allValidated = computed(() => {
  if (!props.matricula?.documentos) return false
  return props.matricula.documentos.every((d: any) => d.estado === 'VALIDADO')
})

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

const getDocLabel = (type: string) => {
  if (!type) return 'Documento'
  const key = type.trim()
  if (documentLabels[key]) return documentLabels[key]
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str: string) => str.toUpperCase())
}

const getDocStatusClass = (estado: string) => {
  if (estado === 'PENDIENTE') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
  if (estado === 'VALIDADO')  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
  return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
}

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

const getRenewalBadgeClass = (state?: string) => {
  switch (state) {
    case 'VIGENTE': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'PENDIENTE': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
    case 'EXONERADO': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
    default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
  }
}

const formatRenewalStateLabel = (state?: string) => {
  switch (state) {
    case 'VIGENTE': return 'Vigente'
    case 'PENDIENTE': return 'Pendiente'
    case 'EXONERADO': return 'Exonerado'
    default: return state || 'Desconocido'
  }
}

const formatUrl = (target: any) => {
  if (!target) return '#'
  if (typeof target === 'object' && target.id_documento) {
    const tokenQuery = target.token_acceso ? `?token=${encodeURIComponent(target.token_acceso)}` : ''
    return `${API_BASE_URL}/api/matriculas/documentos/${target.id_documento}/archivo${tokenQuery}`
  }
  if (typeof target === 'number') {
    return `${API_BASE_URL}/api/matriculas/documentos/${target}/archivo`
  }
  if (typeof target === 'string') {
    const found = props.matricula?.documentos?.find((d: any) => d.url === target || d.url_anterior === target)
    if (found && found.id_documento) {
      const tokenQuery = found.token_acceso ? `?token=${encodeURIComponent(found.token_acceso)}` : ''
      return `${API_BASE_URL}/api/matriculas/documentos/${found.id_documento}/archivo${tokenQuery}`
    }
    return '#'
  }
  return '#'
}

const formatDateTime = (date: string | null | undefined) => {
  if (!date) return 'Sin fecha'
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'Sin fecha'
  const dateStr = d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  const timeStr = d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
  return `${dateStr}, ${timeStr}`
}

</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="isOpen" class="fixed inset-0 z-[200] flex">
        <div class="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-xs" @click="emit('close')"></div>

        <Transition name="drawer-slide">
          <div v-if="isOpen" class="fixed right-0 top-0 h-full w-full max-w-[760px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
            <!-- Drawer Header -->
            <div class="px-8 py-6 bg-gradient-to-r from-indigo-600 to-violet-700 dark:from-indigo-900 dark:to-violet-900 shrink-0 text-left">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-indigo-200 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-1">
                    Matrícula #{{ matricula?.id_matricula }}
                  </p>
                  <h2 class="text-xl font-black text-white">
                    {{ matricula && ['ACTIVA', 'TRASLADADA', 'CANCELADA', 'RECHAZADA'].includes(matricula.estado) ? 'Detalle de Matrícula' : 'Validación de Documentos' }}
                  </h2>
                  <p v-if="matricula" class="text-indigo-200 text-sm mt-1">
                    {{ ['ACTIVA', 'TRASLADADA', 'CANCELADA', 'RECHAZADA'].includes(matricula.estado) ? (matricula.student_firstname ? (matricula.student_firstname + ' ' + matricula.student_lastname) : matricula.correo_padre) : matricula.correo_padre }}
                  </p>
                </div>
                <button @click="emit('close')" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all shrink-0 mt-1">
                  <X :size="20" />
                </button>
              </div>

              <!-- Stepper inside header (Only for non-approved/non-finished) -->
              <div v-if="matricula && !['ACTIVA', 'TRASLADADA', 'CANCELADA', 'RECHAZADA'].includes(matricula.estado)" class="mt-6 flex items-center gap-0">
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
            <div v-else-if="matricula" class="flex-1 overflow-y-auto custom-scrollbar text-left">
              <!-- ── READONLY / SUMMARY VIEW ── -->
              <div v-if="['ACTIVA', 'TRASLADADA', 'CANCELADA', 'RECHAZADA'].includes(matricula.estado)" class="p-8 space-y-8">
                <!-- Status Header Card (Especial para Cancelada) -->
                <div v-if="matricula.estado === 'CANCELADA'"
                     class="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-[2rem] p-8 text-center space-y-4">
                  <div class="w-20 h-20 bg-red-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-red-200 dark:shadow-none">
                    <XCircle :size="40" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-red-900 dark:text-red-300">Matrícula Cancelada</h3>
                    <p class="text-red-700 dark:text-red-400 text-sm font-medium mt-1">
                      Esta matrícula fue cancelada y no se encuentra activa en la institución.
                    </p>
                  </div>
                  <div v-if="matricula.detalles_cancelacion || matricula.motivo_cancelacion" class="mt-4 p-5 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-red-200/60 dark:border-red-900/60 text-left space-y-2">
                    <div class="flex items-center justify-between text-xs font-black text-red-800 dark:text-red-400 uppercase tracking-wider">
                      <span>Motivo de Cancelación</span>
                      <span v-if="matricula.categoria_motivo" class="px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-[10px] font-black">{{ matricula.categoria_motivo }}</span>
                    </div>
                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                      {{ matricula.detalles_cancelacion || matricula.motivo_cancelacion }}
                    </p>
                    <div class="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span v-if="matricula.fecha_cancelacion">Fecha: {{ formatDateTime(matricula.fecha_cancelacion) }}</span>
                      <span v-if="matricula.usuario_cancelacion_nombre || matricula.cancelado_por">Por: {{ matricula.usuario_cancelacion_nombre || matricula.cancelado_por }}</span>
                    </div>
                  </div>
                </div>

                <!-- Status Header Card (Especial para Rechazada) -->
                <div v-else-if="matricula.estado === 'RECHAZADA'"
                     class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-[2rem] p-8 text-center space-y-4">
                  <div class="w-20 h-20 bg-amber-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-amber-200 dark:shadow-none">
                    <XCircle :size="40" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-amber-900 dark:text-amber-300">Solicitud Rechazada</h3>
                    <p class="text-amber-700 dark:text-amber-400 text-sm font-medium mt-1">
                      Esta solicitud de matrícula fue rechazada durante la fase de revisión.
                    </p>
                  </div>
                </div>

                <!-- Status Header Card (Especial para Matrícula de Traslado) -->
                <div v-else-if="matricula.estado === 'TRASLADADA' || matricula.tipo === 'TRASLADO' || matricula.es_traslado || matricula.traslado_info"
                     class="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white rounded-[2rem] p-8 space-y-6 shadow-xl border border-indigo-500/30">
                  <div class="flex items-center justify-between border-b border-white/10 pb-4">
                    <div class="flex items-center gap-3">
                      <div class="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30">
                        <ArrowLeftRight :size="24" />
                      </div>
                      <div>
                        <span class="text-[10px] font-black uppercase tracking-widest text-indigo-300">Trazabilidad de Traslado Interinstitucional</span>
                        <h3 class="text-xl font-black text-white">Matrícula Trasladada</h3>
                      </div>
                    </div>
                    <span :class="[
                      matricula.traslado_info?.estado_traslado === 'EJECUTADA' || matricula.estado === 'TRASLADADA' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                      'px-3.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-full border shadow-xs'
                    ]">
                      {{ matricula.traslado_info?.estado_traslado || matricula.estado }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div class="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                      <p class="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Institución de Origen</p>
                      <p class="font-bold text-white text-sm">{{ matricula.traslado_info?.colegio_origen_nombre || matricula.school_name || 'Colegio de Origen' }}</p>
                    </div>
                    <div class="p-4 bg-indigo-500/15 rounded-2xl border border-indigo-500/30 space-y-1">
                      <p class="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Institución Receptor (Trasladado a)</p>
                      <p class="font-bold text-white text-sm">{{ matricula.traslado_info?.colegio_destino_nombre || 'Colegio Destino' }}</p>
                    </div>
                  </div>

                  <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                    <div class="text-left w-full sm:w-auto">
                      <p class="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Fecha de Aprobación y Ejecución</p>
                      <p class="text-sm font-bold text-white mt-0.5">
                        {{ formatDateTime(matricula.traslado_info?.fecha_finalizacion || matricula.fecha_aprobacion) }}
                      </p>
                    </div>

                    <button 
                      v-if="matricula.traslado_info?.id_solicitud"
                      @click="emit('goToTrasladoDetail', matricula.traslado_info.id_solicitud)"
                      class="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/40 hover:scale-[1.02]"
                    >
                      <ExternalLink :size="16" />
                      <span>Ver Detalle en Gestión de Traslados</span>
                    </button>
                  </div>
                </div>

                <!-- Status Header Card Estándar para Matrículas Regulares -->
                <div v-else class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-[2rem] p-8 text-center space-y-4">
                  <div class="w-20 h-20 bg-emerald-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200 dark:shadow-none">
                    <ShieldCheck :size="40" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-emerald-900 dark:text-emerald-300">Solicitud Finalizada</h3>
                    <p class="text-emerald-700 dark:text-emerald-400 text-sm font-medium mt-1">
                      El estudiante ha sido registrado exitosamente en el sistema.
                    </p>
                  </div>
                </div>

                <!-- Student & Parent Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div class="flex items-center gap-3 pb-4 border-b border-slate-50 dark:border-slate-700">
                      <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <User :size="20" />
                      </div>
                      <h4 class="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Datos del Estudiante</h4>
                    </div>
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
                  </div>

                  <div class="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div class="flex items-center gap-3 pb-4 border-b border-slate-50 dark:border-slate-700">
                      <div class="p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
                        <MapPin :size="20" />
                      </div>
                      <h4 class="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Acudiente</h4>
                    </div>
                    <div>
                      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</p>
                      <p class="font-bold text-slate-900 dark:text-white">{{ matricula.parent_firstname }} {{ matricula.parent_lastname }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo Electrónico</p>
                      <p class="text-sm font-bold text-indigo-600 dark:text-indigo-400 break-all">{{ matricula.correo_padre }}</p>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex flex-col sm:flex-row gap-3 pt-4">
                  <button 
                    v-if="matricula.estado === 'ACTIVA'"
                    @click="emit('openCancel')" 
                    class="flex-1 py-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900 cursor-pointer"
                  >
                    Cancelar Matrícula
                  </button>
                  <button 
                    @click="emit('downloadPDF', matricula)" 
                    :disabled="isExportingPDF"
                    class="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wide hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <span v-if="isExportingPDF" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <Download v-else :size="16" />
                    Descargar Ficha (PDF)
                  </button>
                  <button @click="emit('close')" class="flex-1 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl cursor-pointer">
                    Cerrar Detalle
                  </button>
                </div>
              </div>

              <!-- ── STEP 1: Assign Room ── -->
              <div v-else-if="currentStep === 1" class="p-8 space-y-6">
                <div class="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-6">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Referencia de Solicitud</p>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xl font-black text-slate-900 dark:text-white">{{ matricula.grado_nivel }}</p>
                      <p class="text-sm font-bold text-indigo-500">{{ matricula.tipo_grado }} · {{ matricula.jornada }}</p>
                    </div>
                    <span :class="[getStatusMeta(matricula.estado).bg, 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest']">
                      {{ getStatusMeta(matricula.estado).label }}
                    </span>
                  </div>
                </div>

                <!-- Section Selector -->
                <div v-if="!isReadonly" class="space-y-3">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Seleccionar Salón / Grupo</p>
                  <div class="space-y-2">
                    <button
                      v-for="section in matricula.availableSections"
                      :key="section.id_grado"
                      @click="emit('update:selectedGradeId', section.id_grado)"
                      :disabled="section.cupos_restantes <= 0"
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
                  @click="emit('assignRoom')"
                  :disabled="!selectedGradeId || savingGrade"
                  class="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <span>Confirmar y Continuar a Documentos</span>
                  <ArrowLeft :size="18" class="rotate-180" />
                </button>
              </div>

              <!-- ── STEP 2: Documents Review ── -->
              <div v-else-if="currentStep === 2" class="p-8 space-y-6">
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
                    <button @click="emit('update:currentStep', 1)" class="text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center gap-1 hover:underline">
                      <ArrowLeft :size="14" /> Cambiar Salón
                    </button>
                  </div>
                </div>

                <!-- Documents List -->
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
                      <div class="p-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 shadow-xs">
                        <FileText :size="18" class="text-indigo-500" />
                      </div>
                      <div>
                        <div class="flex items-center gap-2 flex-wrap">
                          <p class="font-black text-slate-900 dark:text-white text-sm">{{ getDocLabel(doc.tipo_documento) }}</p>
                          <span :class="[getDocStatusClass(doc.estado), 'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full']">{{ doc.estado }}</span>
                          <span v-if="doc.estado_renovacion" :class="[getRenewalBadgeClass(doc.estado_renovacion), 'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border']">
                            {{ formatRenewalStateLabel(doc.estado_renovacion) }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      <a :href="formatUrl(doc.url)" target="_blank"
                         class="p-2 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all shadow-xs">
                        <ExternalLink :size="16" />
                      </a>
                      <div class="flex items-center bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl p-1 gap-1">
                        <button
                          @click="emit('updateDocStatus', { idDocumento: doc.id_documento, estado: 'VALIDADO' })"
                          :class="[doc.estado === 'VALIDADO' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-emerald-600', 'p-1.5 rounded-lg text-xs font-black transition-all']"
                          title="Validar Documento"
                        >
                          <CheckCircle :size="14" />
                        </button>
                        <button
                          @click="emit('updateDocStatus', { idDocumento: doc.id_documento, estado: 'RECHAZADO' })"
                          :class="[doc.estado === 'RECHAZADO' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-red-600', 'p-1.5 rounded-lg text-xs font-black transition-all']"
                          title="Rechazar Documento"
                        >
                          <XCircle :size="14" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Review Actions Bar -->
                <div class="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    @click="emit('saveValidation')"
                    class="w-full sm:w-auto flex-1 py-3.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Save :size="15" />
                    <span>Guardar Estado</span>
                  </button>

                  <button
                    v-if="allValidated"
                    @click="emit('finalizeRegistration', matricula.id_matricula)"
                    class="w-full sm:w-auto flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <CheckCircle :size="15" />
                    <span>Finalizar Registro Completo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s ease-out;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
