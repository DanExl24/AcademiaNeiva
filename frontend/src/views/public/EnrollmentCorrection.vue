<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { enrollmentService } from '../../services/enrollmentService'
import { useNotificationStore } from '../../stores/notifications'
import { 
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  Upload,
  CheckCircle2,
  School
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const notify = useNotificationStore()

const token = route.params.id as string
const matricula = ref<any>(null)
const loading = ref(true)
const submittng = ref(false)
const newFiles = ref<Record<string, File | null>>({})

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

const fetchDetails = async () => {
  try {
    const data = await enrollmentService.getDetails(token)
    matricula.value = data

    // Si es extraordinaria y aún no tiene documentos radicados, redirigir al formulario completo de matrícula
    if (data && data.tipo === 'EXTRAORDINARIA' && (!data.documentos || data.documentos.length === 0)) {
      router.replace(`/matricula?token=${token}`)
      return
    }

    // Inicializar objeto de nuevos archivos
    if (matricula.value.documentos && Array.isArray(matricula.value.documentos)) {
      matricula.value.documentos.forEach((doc: any) => {
        newFiles.value[doc.tipo_documento] = null
      })
    }
  } catch (error) {
    notify.addNotification('El enlace es inválido o ha expirado', 'error')
    router.push('/')
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetails)

const handleFileUpload = (event: any, key: string) => {
  const file = event.target.files[0]
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      notify.addNotification('El archivo no debe pesar más de 5MB', 'warning')
      return
    }
    newFiles.value[key] = file
  }
}

const submitCorrections = async () => {
  const filesToUpload = Object.entries(newFiles.value).filter(([_, file]) => file !== null)
  
  if (filesToUpload.length === 0) {
    notify.addNotification('No has cargado ningún documento nuevo para corregir.', 'warning')
    return
  }

  // Verificar que todos los RECHAZADOS tengan un nuevo archivo
  const rejectedWithoutNew = matricula.value.documentos.filter((d: any) => d.estado === 'RECHAZADO' && !newFiles.value[d.tipo_documento])
  if (rejectedWithoutNew.length > 0) {
    notify.addNotification('Debes corregir todos los documentos rechazados.', 'warning')
    return
  }

  submittng.value = true
  try {
    const formData = new FormData()
    filesToUpload.forEach(([key, file]) => {
      formData.append(key, file as File)
    })

    await enrollmentService.updateDocuments(token, formData)

    notify.addNotification('Documentos actualizados exitosamente. Tu solicitud ha pasado a revisión con el estado "Docs Corregidos".', 'success')
    setTimeout(() => {
      router.push('/')
    }, 2000)
  } catch (error) {
    notify.addNotification('Error al actualizar documentos', 'error')
  } finally {
    submittng.value = false
  }
}


const getStatusClass = (estado: string) => {
  if (estado === 'VALIDADO') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (estado === 'RECHAZADO') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
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
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-6 sm:py-12 px-3.5 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-8 sm:mb-12 flex items-center justify-between">
        <button @click="router.push('/')" class="flex items-center gap-2 text-xs sm:text-sm text-gray-500 hover:text-indigo-600 transition-all font-medium cursor-pointer">
          <ArrowLeft :size="18" />
          <span>Volver al inicio</span>
        </button>
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-1.5 sm:p-2 bg-indigo-600 rounded-lg text-white">
            <School :size="20" class="sm:w-6 sm:h-6" />
          </div>
          <span class="text-base sm:text-xl font-bold tracking-tight text-gray-900">Corrección de Documentos</span>
        </div>
      </div>

      <div v-if="loading" class="text-center py-16 sm:py-20">
        <div class="animate-spin inline-block w-8 h-8 sm:w-10 sm:h-10 border-4 border-indigo-600 border-t-transparent rounded-full mb-3 sm:mb-4"></div>
        <p class="text-gray-500 text-xs sm:text-sm font-bold">Cargando tu solicitud...</p>
      </div>

      <div v-else-if="matricula" class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- Info Card -->
        <div class="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-gray-200 shadow-sm">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2">Estado de tu Solicitud</h2>
          <p class="text-xs sm:text-sm text-gray-500">Revisa los documentos marcados como rechazados y sube la versión corregida.</p>
          
          <div class="mt-4 sm:mt-6 flex items-start sm:items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-amber-50 rounded-xl sm:rounded-2xl border border-amber-100" v-if="matricula.documentos.some((d: any) => d.estado === 'RECHAZADO')">
            <AlertCircle class="text-amber-600 shrink-0 mt-0.5 sm:mt-0" :size="20" />
            <p class="text-xs sm:text-sm text-amber-800 font-medium leading-relaxed">
              Tienes documentos con observaciones. Por favor actualízalos para continuar con el proceso.
            </p>
          </div>
        </div>

        <!-- Document List -->
        <div class="grid grid-cols-1 gap-3.5 sm:gap-4">
          <div v-for="doc in matricula.documentos" :key="doc.id_documento" 
            class="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 transition-all hover:shadow-md"
            :class="{'ring-2 ring-red-500 ring-offset-2': doc.estado === 'RECHAZADO'}"
          >
            <div class="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <div class="p-2.5 sm:p-3 bg-gray-50 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <FileText :size="22" :class="doc.estado === 'RECHAZADO' ? 'text-red-500' : 'text-indigo-600'" />
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-sm sm:text-base text-gray-900 truncate">{{ docLabels[doc.tipo_documento] || doc.tipo_documento }}</h3>
                <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5">
                  <span :class="[getStatusClass(doc.estado), 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border']">
                    {{ doc.estado === 'VALIDADO' ? '✅ VALIDADO' : doc.estado === 'RECHAZADO' ? '❌ RECHAZADO' : '⏳ PENDIENTE' }}
                  </span>

                  <span 
                    v-if="(matricula?.tipo === 'REINGRESO' || matricula?.tipo === 'RENOVACION') && doc.estado_renovacion"
                    :class="[getRenewalStatusClass(doc.estado_renovacion), 'px-2 py-0.5 rounded-full text-[10px] font-bold border']"
                  >
                    {{ getRenewalStatusLabel(doc.estado_renovacion) }}
                  </span>

                  <span v-if="newFiles[doc.tipo_documento]" class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">
                    CORREGIDO
                  </span>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label class="w-full sm:w-auto">
                <input type="file" class="hidden" @change="e => handleFileUpload(e, doc.tipo_documento)" accept=".pdf,image/*">
                <div class="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm"
                  :class="newFiles[doc.tipo_documento] ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'"
                >
                  <Upload :size="16" v-if="!newFiles[doc.tipo_documento]" />
                  <CheckCircle2 :size="16" v-else />
                  <span>{{ newFiles[doc.tipo_documento] ? 'Cambiar archivo' : (doc.estado === 'RECHAZADO' ? 'Subir Corrección' : 'Actualizar Documento') }}</span>
                </div>
              </label>
              
              <div v-if="newFiles[doc.tipo_documento]" class="text-[11px] sm:text-xs text-emerald-600 font-bold truncate max-w-xs">
                📄 {{ newFiles[doc.tipo_documento]?.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm gap-4 sm:gap-6">
          <div class="text-gray-500 text-xs sm:text-sm text-center sm:text-left">
            <p v-if="Object.values(newFiles).filter(f => f !== null).length === 0">No has realizado cambios aún.</p>
            <p v-else class="text-indigo-600 font-bold">Has cargado {{ Object.values(newFiles).filter(f => f !== null).length }} documento(s) para corregir.</p>
          </div>
          <button 
            @click="submitCorrections"
            :disabled="submittng || Object.values(newFiles).filter(f => f !== null).length === 0"
            class="w-full sm:w-auto bg-gray-900 text-white px-8 sm:px-12 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            <div v-if="submittng" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <template v-else>
              <span>Enviar Correcciones</span>
              <CheckCircle :size="18" />
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-in {
  animation: slide-in 0.6s ease-out;
}
@keyframes slide-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
