<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Search, School, CheckCircle2, XCircle, AlertTriangle, FileText, RefreshCw } from 'lucide-vue-next'
import { enrollmentService } from '../../services/enrollmentService'
import { useNotificationStore } from '../../stores/notifications'


const route = useRoute()
const notify = useNotificationStore()

const tokenInput = ref('')
const loading = ref(false)
const matricula = ref<any>(null)
const searched = ref(false)

const docLabels: Record<string, string> = {
  registroCivil: 'Registro Civil',
  documentoIdentidad: 'Doc. Identidad Estudiante',
  documentoPadre: 'Doc. Identidad Acudiente',
  vacunas: 'Carné de Vacunas',
  salud: 'Certificado Salud',
  foto: 'Foto 3x4',
  reciboPublico: 'Recibo Público',
  visa: 'Visa / PPT',
  certificadoDiscapacidad: 'Diagnóstico Médico',
  certificadosEscolaridad: 'Certificados de Escolaridad'
}

const statusMap: Record<string, { label: string, colorClass: string, desc: string }> = {
  PENDIENTE: { 
    label: 'Pendiente de Revisión', 
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
    desc: 'Tu solicitud ha sido recibida y se encuentra en proceso de validación por parte de la secretaría académica.' 
  },
  CORRECCION: { 
    label: 'Inconsistencias Detectadas', 
    colorClass: 'bg-orange-50 text-orange-700 border-orange-200',
    desc: 'Se han detectado observaciones en los documentos cargados. Revisa el botón de corrección inferior para subir los archivos requeridos.' 
  },
  RECHAZADA: { 
    label: 'Inconsistencias Detectadas', 
    colorClass: 'bg-orange-50 text-orange-700 border-orange-200',
    desc: 'Se han detectado observaciones en los documentos cargados. Revisa el botón de corrección inferior para subir los archivos requeridos.' 
  },
  APROBADA: { 
    label: 'Documentos Aprobados', 
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    desc: 'Tus documentos han sido validados exitosamente y el cupo está reservado. La institución procederá con la oficialización final.' 
  },
  ACTIVA: { 
    label: 'Matrícula Oficializada', 
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    desc: '¡Felicidades! La matrícula ha sido validada y oficializada de manera exitosa. Las credenciales de acceso se enviaron a tu correo.' 
  },
  TRASLADADA: { 
    label: 'Traslado Aprobado', 
    colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    desc: 'El estudiante ha sido trasladado e incorporado a la institución.' 
  },
  CANCELADA: { 
    label: 'Matrícula Cancelada', 
    colorClass: 'bg-gray-100 text-gray-700 border-gray-300',
    desc: 'Esta solicitud de matrícula fue cancelada por la administración de la institución.' 
  }
}

const fetchTracking = async (tokenVal: string) => {
  if (!tokenVal || tokenVal.trim().length < 20) {
    notify.addNotification('Por favor ingresa un token de seguimiento válido.', 'warning')
    return
  }

  try {
    loading.value = true
    searched.value = true
    const data = await enrollmentService.getDetails(tokenVal.trim())
    matricula.value = data
  } catch (error: any) {
    console.error('Error fetching tracking:', error)
    matricula.value = null
    notify.addNotification('No se encontró ninguna matrícula con ese token. Verifica e intenta de nuevo.', 'error')
  } finally {
    loading.value = false
  }
}


const getRenewalStatusLabel = (state?: string) => {
  switch (state) {
    case 'VIGENTE': return '✅ VIGENTE (Conservado en archivo)'
    case 'RECOMENDADO_ACTUALIZAR': return '⚠️ SE RECOMIENDA ACTUALIZAR'
    case 'OBLIGATORIO_ACTUALIZAR': return '❌ REQUERIDO ACTUALIZAR'
    case 'DESACTUALIZADO_POR_FECHA': return '❌ VENCIDO / REQUIERE NUEVA TARJETA'
    default: return null
  }
}

const getRenewalStatusClass = (state?: string) => {
  switch (state) {
    case 'VIGENTE': return 'bg-emerald-50 text-emerald-800 border-emerald-300'
    case 'RECOMENDADO_ACTUALIZAR': return 'bg-amber-50 text-amber-800 border-amber-300'
    case 'OBLIGATORIO_ACTUALIZAR': return 'bg-rose-50 text-rose-800 border-rose-300'
    case 'DESACTUALIZADO_POR_FECHA': return 'bg-purple-50 text-purple-800 border-purple-300'
    default: return 'bg-gray-100 text-gray-700 border-gray-300'
  }
}

onMounted(() => {
  const queryToken = route.query.token as string
  if (queryToken) {
    tokenInput.value = queryToken
    fetchTracking(queryToken)
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-6 sm:py-12 px-3.5 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-8 sm:mb-12 flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 text-xs sm:text-sm text-gray-500 hover:text-indigo-600 transition-all font-medium">
          <ArrowLeft :size="18" />
          <span>Volver al Inicio</span>
        </router-link>
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-1.5 sm:p-2 bg-indigo-600 rounded-lg text-white">
            <School :size="20" class="sm:w-6 sm:h-6" />
          </div>
          <span class="text-base sm:text-xl font-bold tracking-tight">Academia<span class="text-indigo-600">Neiva</span></span>
        </div>
      </div>

      <!-- Tracking Search Box -->
      <div class="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2">Consulta de Estado de Matrícula</h1>
        <p class="text-xs sm:text-sm text-gray-600 mb-5 sm:mb-6">Ingresa el token único de seguimiento que fue enviado a tu correo electrónico al radicar el formulario.</p>
        
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="relative flex-grow">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search :size="18" />
            </div>
            <input 
              v-model="tokenInput" 
              type="text" 
              class="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm bg-gray-50"
              placeholder="Ej: 123e4567-e89b-12d3-a456-426614174000"
              :disabled="loading"
            />
          </div>
          <button 
            @click="fetchTracking(tokenInput)"
            :disabled="loading"
            class="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw v-if="loading" :size="16" class="animate-spin" />
            <span>Consultar Estado</span>
          </button>
        </div>
      </div>

      <!-- Tracking Results -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-12">
        <RefreshCw class="animate-spin text-indigo-600 mb-4" :size="36" />
        <p class="text-gray-500 text-xs sm:text-sm">Buscando información de tu solicitud...</p>
      </div>

      <div v-else-if="matricula" class="space-y-5 sm:space-y-6">
        <!-- Main Status Card -->
        <div class="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-gray-100 pb-5 sm:pb-6 mb-5 sm:mb-6">
            <div>
              <p class="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Código de Solicitud</p>
              <h2 class="text-base sm:text-lg font-bold text-gray-900 break-all">{{ matricula.token_seguimiento }}</h2>
            </div>
            <div>
              <span 
                :class="[
                  'inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold border uppercase tracking-wide',
                  statusMap[matricula.estado]?.colorClass || 'bg-gray-100 text-gray-700'
                ]"
              >
                {{ statusMap[matricula.estado]?.label || matricula.estado }}
              </span>
            </div>
          </div>

          <div class="space-y-3.5 sm:space-y-4">
            <div>
              <h3 class="text-xs sm:text-sm font-semibold text-gray-500">Nivel y Grado Solicitado</h3>
              <p class="text-sm sm:text-base font-bold text-gray-800">{{ matricula.grado_nivel }} - {{ matricula.tipo_grado }} ({{ matricula.jornada }})</p>
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-semibold text-gray-500">Correo Electrónico de Contacto</h3>
              <p class="text-sm sm:text-base font-medium text-gray-800 break-all">{{ matricula.correo_padre }}</p>
            </div>
            <div class="bg-gray-50 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 mt-3 sm:mt-4">
              <p class="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {{ statusMap[matricula.estado]?.desc }}
              </p>
            </div>

            <!-- Call to action si es Matrícula Extraordinaria pendiente de cargue inicial -->
            <div v-if="matricula.tipo === 'EXTRAORDINARIA' && (!matricula.documentos || matricula.documentos.length === 0)" class="mt-5 sm:mt-6 p-4 sm:p-6 bg-amber-50 border border-amber-200 rounded-xl sm:rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle :size="20" />
                </div>
                <div>
                  <h4 class="text-xs sm:text-sm font-black text-amber-900">Autorización Extraordinaria Habilitada</h4>
                  <p class="text-xs text-amber-800 mt-1 leading-relaxed">
                    Cuentas con autorización institucional para radicar tu matrícula. Completa el formulario de inscripción y sube los documentos requeridos.
                  </p>
                </div>
              </div>
              <router-link 
                :to="`/matricula?token=${matricula.token_seguimiento}`" 
                class="w-full md:w-auto text-center bg-amber-600 text-white text-xs font-black px-5 py-3 rounded-xl hover:bg-amber-700 transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
              >
                Completar Matrícula
              </router-link>
            </div>

            <!-- Call to action if action required (CORRECCION / RECHAZADA) -->
            <div v-else-if="matricula.estado === 'CORRECCION' || matricula.estado === 'RECHAZADA'" class="mt-5 sm:mt-6 p-4 sm:p-6 bg-red-50 border border-red-100 rounded-xl sm:rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5">
                  <AlertTriangle :size="20" />
                </div>
                <div>
                  <h4 class="text-xs sm:text-sm font-bold text-red-800">Inconsistencias en Documentos</h4>
                  <p class="text-xs text-red-700 mt-1 leading-relaxed">
                    Algunos documentos fueron rechazados por el revisor académico. Debes corregirlos para continuar con el proceso.
                  </p>
                </div>
              </div>
              <router-link 
                :to="`/matricula/corregir/${matricula.token_seguimiento}`" 
                class="w-full md:w-auto text-center bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-700 transition-colors shadow-sm active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
              >
                Corregir Documentación
              </router-link>
            </div>
          </div>
        </div>

        <!-- Documents Status Card -->
        <div class="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100">
          <h3 class="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-6">Listado de Documentos Cargados</h3>
          <div class="divide-y divide-gray-100">
            <div 
              v-for="doc in matricula.documentos" 
              :key="doc.id_documento" 
              class="py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 first:pt-0 last:pb-0"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 sm:p-2.5 bg-gray-50 text-gray-500 rounded-xl shrink-0">
                  <FileText :size="18" class="sm:w-5 sm:h-5" />
                </div>
                <div class="min-w-0">
                  <p class="text-xs sm:text-sm font-bold text-gray-800 truncate">{{ docLabels[doc.tipo_documento] || doc.tipo_documento }}</p>
                  <p class="text-[10px] text-gray-400 mt-0.5">Subido el {{ new Date(doc.fecha).toLocaleDateString('es-CO') }}</p>
                </div>
              </div>
              
              <div class="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
                <span v-if="doc.estado === 'VALIDADO'" class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle2 :size="12" />
                  <span>Validado</span>
                </span>
                <span v-else-if="doc.estado === 'RECHAZADO'" class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  <XCircle :size="12" />
                  <span>Rechazado</span>
                </span>
                <span v-else class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                  <AlertTriangle :size="12" />
                  <span>Pendiente</span>
                </span>

                <span 
                  v-if="(matricula?.tipo === 'REINGRESO' || matricula?.tipo === 'RENOVACION') && doc.estado_renovacion"
                  :class="[getRenewalStatusClass(doc.estado_renovacion), 'px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] font-bold border']"
                >
                  {{ getRenewalStatusLabel(doc.estado_renovacion) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="searched" class="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center py-12">
        <XCircle class="mx-auto text-gray-300 mb-4" :size="48" />
        <h3 class="text-lg font-bold text-gray-900 mb-1">No se encontraron resultados</h3>
        <p class="text-sm text-gray-500 max-w-sm mx-auto">Valida que el token ingresado coincida exactamente con el enviado a tu correo.</p>
      </div>
    </div>
  </div>
</template>
