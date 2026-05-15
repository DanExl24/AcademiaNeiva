<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
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

const token = route.params.id
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
    const response = await axios.get(`http://localhost:3000/api/matriculas/${token}`)
    matricula.value = response.data
    // Inicializar objeto de nuevos archivos
    matricula.value.documentos.forEach((doc: any) => {
      newFiles.value[doc.tipo_documento] = null
    })
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

    await axios.post(`http://localhost:3000/api/matriculas/update-documents/${token}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    notify.addNotification('Documentos actualizados exitosamente. Serán validados nuevamente.', 'success')
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
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-12 flex items-center justify-between">
        <button @click="router.push('/')" class="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-all font-medium">
          <ArrowLeft :size="20" />
          <span>Volver al inicio</span>
        </button>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-600 rounded-lg text-white">
            <School :size="24" />
          </div>
          <span class="text-xl font-bold tracking-tight text-gray-900">Corrección de Documentos</span>
        </div>
      </div>

      <div v-if="loading" class="text-center py-20">
        <div class="animate-spin inline-block w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
        <p class="text-gray-500 font-bold">Cargando tu solicitud...</p>
      </div>

      <div v-else-if="matricula" class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- Info Card -->
        <div class="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Estado de tu Solicitud</h2>
          <p class="text-gray-500">Revisa los documentos marcados como rechazados y sube la versión corregida.</p>
          
          <div class="mt-6 flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100" v-if="matricula.documentos.some((d: any) => d.estado === 'RECHAZADO')">
            <AlertCircle class="text-amber-600" :size="24" />
            <p class="text-sm text-amber-800 font-medium">
              Tienes documentos con observaciones. Por favor actualízalos para continuar con el proceso.
            </p>
          </div>
        </div>

        <!-- Document List -->
        <div class="grid grid-cols-1 gap-4">
          <div v-for="doc in matricula.documentos" :key="doc.id_documento" 
            class="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md"
            :class="{'ring-2 ring-red-500 ring-offset-2': doc.estado === 'RECHAZADO'}"
          >
            <div class="flex items-center gap-4">
              <div class="p-3 bg-gray-50 rounded-xl">
                <FileText :size="24" :class="doc.estado === 'RECHAZADO' ? 'text-red-500' : 'text-indigo-600'" />
              </div>
              <div>
                <h3 class="font-bold text-gray-900">{{ docLabels[doc.tipo_documento] || doc.tipo_documento }}</h3>
                <div class="flex items-center gap-2 mt-1">
                  <span :class="[getStatusClass(doc.estado), 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border']">
                    {{ doc.estado }}
                  </span>
                  <span v-if="newFiles[doc.tipo_documento]" class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">
                    CORREGIDO
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <label class="flex-1 md:flex-none">
                <input type="file" class="hidden" @change="e => handleFileUpload(e, doc.tipo_documento)" accept=".pdf,image/*">
                <div class="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm"
                  :class="newFiles[doc.tipo_documento] ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'"
                >
                  <Upload :size="18" v-if="!newFiles[doc.tipo_documento]" />
                  <CheckCircle2 :size="18" v-else />
                  {{ newFiles[doc.tipo_documento] ? 'Cambiar archivo' : (doc.estado === 'RECHAZADO' ? 'Subir Corrección' : 'Actualizar Documento') }}
                </div>
              </label>
              
              <div v-if="newFiles[doc.tipo_documento]" class="text-xs text-emerald-600 font-bold hidden md:block">
                {{ newFiles[doc.tipo_documento]?.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-8 rounded-3xl border border-gray-100 shadow-sm gap-6">
          <div class="text-gray-500 text-sm">
            <p v-if="Object.values(newFiles).filter(f => f !== null).length === 0">No has realizado cambios.</p>
            <p v-else class="text-indigo-600 font-bold">Has cargado {{ Object.values(newFiles).filter(f => f !== null).length }} documento(s) para corregir.</p>
          </div>
          <button 
            @click="submitCorrections"
            :disabled="submittng || Object.values(newFiles).filter(f => f !== null).length === 0"
            class="w-full sm:w-auto bg-gray-900 text-white px-12 py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <div v-if="submittng" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <template v-else>
              Enviar Correcciones
              <CheckCircle :size="20" />
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
