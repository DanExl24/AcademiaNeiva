<script setup lang="ts">
import { ref, onMounted,computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useNotificationStore } from '../stores/notifications'
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
  ShieldCheck
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const notify = useNotificationStore()

const currentStep = ref(1) // 1: Asignar Salón, 2: Documentos, 3: Finalizar
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
    console.log('Enrollment Details:', response.data)
    matricula.value = response.data
    selectedGradeId.value = response.data.id_grado
  } catch (error) {
    notify.addNotification('Error al cargar la solicitud', 'error')
    router.push('/dashboard/gestion-matriculas')
  } finally {
    loading.value = false
  }
}

const assignRoom = () => {
  if (!selectedGradeId.value) return
  
  // Actualizar localmente el grado actual
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
    
    // Update local state
    const doc = matricula.value.documentos.find((d: any) => d.id_documento === idDocumento)
    if (doc) doc.estado = estado
  } catch (error) {
    notify.addNotification('Error al actualizar', 'error')
  }
}

const handleSave = () => {
  const hasRejected = matricula.value.documentos.some((d: any) => d.estado === 'RECHAZADO')
  const hasPending = matricula.value.documentos.some((d: any) => d.estado === 'PENDIENTE')

  if (hasRejected) {
    showNotifyModal.value = true
  } else if (hasPending) {
    showPendingModal.value = true
  } else {
    notify.addNotification('Cambios guardados', 'success')
    router.push('/dashboard/gestion-matriculas')
  }
}

const confirmSaveLater = () => {
  notify.addNotification('Cambios guardados. Recuerda revisar los documentos pendientes después.', 'info')
  router.push('/dashboard/gestion-matriculas')
}

const notifyInconsistencies = async () => {
  try {
    await axios.post(`http://localhost:3000/api/matriculas/notify-inconsistencies/${route.params.id}`)
    notify.addNotification('Notificación enviada al padre', 'success')
    showNotifyModal.value = false
    router.push('/dashboard/gestion-matriculas')
  } catch (error) {
    notify.addNotification('Error al enviar notificación', 'error')
  }
}

const getStatusBadgeClass = (estado: string) => {
  if (estado === 'PENDIENTE') return 'bg-amber-100 text-amber-700'
  if (estado === 'VALIDADO') return 'bg-emerald-100 text-emerald-700'
  return 'bg-red-100 text-red-700'
}

const formatUrl = (url: string) => {
  const filename = url.split(/[\\/]/).pop()
  return `http://localhost:3000/uploads/${filename}`
}

const allValidated = computed(() => {
  if (!matricula.value || !matricula.value.documentos) return false
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
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <button @click="router.back()" class="p-2 hover:bg-gray-100 rounded-xl transition-colors">
        <ArrowLeft :size="24" class="text-gray-600" />
      </button>
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Validación de Documentos</h1>
        <p class="text-gray-500 mt-1">Matrícula #{{ route.params.id }}</p>
      </div>
    </div>

    <!-- Stepper -->
    <div class="max-w-3xl mx-auto mb-10">
      <div class="flex items-center justify-between relative">
        <div class="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 -z-0"></div>
        <div class="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -translate-y-1/2 transition-all duration-500 -z-0" 
             :style="{ width: ((currentStep - 1) / 2) * 100 + '%' }"></div>
        
        <div v-for="s in [1, 2, 3]" :key="s" class="relative z-10 flex flex-col items-center gap-2">
          <div :class="[
            currentStep >= s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200',
            'h-10 w-10 rounded-full border-2 flex items-center justify-center font-bold transition-all duration-500'
          ]">
            <CheckCircle v-if="currentStep > s" :size="20" />
            <span v-else>{{ s }}</span>
          </div>
          <span :class="[currentStep >= s ? 'text-indigo-600 font-bold' : 'text-gray-400', 'text-xs uppercase tracking-wider transition-colors duration-500']">
            {{ s === 1 ? 'Salón' : s === 2 ? 'Documentos' : 'Registro' }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12">
      <div class="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
      <p class="text-gray-500 font-medium">Cargando detalles...</p>
    </div>

    <div v-else-if="matricula" class="space-y-6">
      <!-- Step 1: Asignar Salón -->
      <div v-if="currentStep === 1" class="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div class="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-indigo-50/50">
          <div v-if="matricula.estado === 'ACTIVA'" class="mb-8 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4 animate-in fade-in zoom-in duration-500">
            <div class="p-3 bg-emerald-600 text-white rounded-2xl">
              <ShieldCheck :size="24" />
            </div>
            <div>
              <h3 class="text-lg font-black text-emerald-900">Matrícula Aprobada</h3>
              <p class="text-emerald-700 text-sm">Esta matrícula ya ha sido procesada y el estudiante está activo. No se permiten más cambios.</p>
            </div>
          </div>

          <div class="flex items-center gap-4 mb-8">
            <div class="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
              <ClipboardList :size="28" />
            </div>
            <div>
              <h2 class="text-2xl font-black text-gray-900">Asignación de Salón</h2>
              <p class="text-gray-500">Verifica cupos y asigna el curso específico.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 mb-8">
            <div class="p-6 bg-gray-50 rounded-3xl border border-gray-100">
              <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Referencia de Solicitud</p>
              <div class="flex justify-between items-end">
                <div>
                  <p class="text-xl font-black text-gray-900">{{ matricula.grado_nivel }}</p>
                  <p class="text-indigo-600 font-bold">{{ matricula.tipo_grado }} - {{ matricula.jornada }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-gray-500">Estado Actual</p>
                  <span :class="[getStatusBadgeClass(matricula.estado), 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest']">
                    {{ matricula.estado }}
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <label class="text-sm font-bold text-gray-700 ml-2">Selecciona el Salón Específico</label>
              <div class="grid grid-cols-1 gap-3">
                <button v-for="section in matricula.availableSections" 
                        :key="section.id_grado"
                        @click="selectedGradeId = section.id_grado"
                        :class="[
                          selectedGradeId === section.id_grado ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-100 bg-white hover:border-indigo-200',
                          'flex items-center justify-between p-5 rounded-2xl border-2 transition-all text-left group'
                        ]"
                        :disabled="section.cupos_restantes <= 0 || matricula.estado === 'ACTIVA'">
                  <div class="flex items-center gap-4">
                    <div :class="[
                      selectedGradeId === section.id_grado ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600',
                      'h-12 w-12 rounded-xl flex items-center justify-center text-xl font-black transition-colors'
                    ]">
                      {{ section.seccion }}
                    </div>
                    <div>
                      <p class="font-black text-gray-900">{{ matricula.tipo_grado }} ({{ section.seccion }})</p>
                      <p class="text-xs text-gray-500">{{ matricula.jornada }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p :class="[section.cupos_restantes > 5 ? 'text-emerald-600' : 'text-amber-600', 'text-sm font-black']">
                      {{ section.cupos_restantes }}
                    </p>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Cupos Libres</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <button @click="assignRoom" 
                  :disabled="!selectedGradeId || savingGrade || (matricula.estado === 'ACTIVA' && currentStep === 1)"
                  class="w-full py-5 bg-gray-900 text-white rounded-3xl font-black hover:bg-indigo-600 transition-all shadow-xl shadow-gray-200 disabled:opacity-30 flex items-center justify-center gap-3 active:scale-95">
            <span v-if="savingGrade" class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            <template v-else>
              {{ matricula.estado === 'ACTIVA' ? 'Continuar' : 'Confirmar y Continuar' }}
              <ArrowLeft :size="20" class="rotate-180" />
            </template>
          </button>
        </div>
      </div>

      <!-- Step 2: Documentos -->
      <template v-if="currentStep === 2">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <p class="text-gray-500 text-xs font-bold uppercase tracking-wider">Estudiante</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ matricula.grado_nivel }} - {{ matricula.tipo_grado }}</p>
            <p class="text-sm text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg w-fit mt-1">Jornada {{ matricula.jornada }} - Sección {{ matricula.seccion }}</p>
          </div>
          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <p class="text-gray-500 text-xs font-bold uppercase tracking-wider">Padre / Acudiente</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ matricula.correo_padre }}</p>
            <p class="text-sm text-gray-500 italic">Correo de contacto</p>
          </div>
          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <p class="text-gray-500 text-xs font-bold uppercase tracking-wider">Acciones</p>
            <button @click="currentStep = 1" class="mt-2 text-sm text-indigo-600 hover:underline flex items-center gap-1 font-bold">
              <ArrowLeft :size="14" /> Cambiar Salón
            </button>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <div class="p-8 border-b border-gray-50">
            <h2 class="text-xl font-bold text-gray-900 mb-6">Documentos Entregados</h2>
            
            <div class="space-y-4">
              <div v-for="doc in matricula.documentos" :key="doc.id_documento" 
                   class="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4">
              
                <div class="flex items-start gap-4">
                  <div class="p-3 bg-white rounded-xl border shadow-sm">
                    <FileText :size="24" class="text-indigo-600" />
                  </div>
                  <div>
                    <h3 class="font-bold text-gray-900">{{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}</h3>
                    <div class="flex items-center gap-3 mt-1">
                      <span class="text-sm text-gray-500">Subido en la solicitud</span>
                      <span :class="[getStatusBadgeClass(doc.estado), 'px-2 py-0.5 rounded-full text-xs font-bold']">
                        {{ doc.estado }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 w-full md:w-auto">
                  <a :href="formatUrl(doc.url)" target="_blank" 
                     class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border shadow-sm rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                    <ExternalLink :size="16" />
                    Ver
                  </a>
                  
                  <div class="flex items-center bg-gray-100 rounded-xl p-1">
                    <template v-if="doc.estado === 'PENDIENTE'">
                      <button @click="updateDocumentStatus(doc.id_documento, 'VALIDADO')"
                              :disabled="matricula.estado === 'ACTIVA'"
                              class="px-3 py-1.5 rounded-lg text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-30">
                        <CheckCircle :size="16" />
                        Aprobar
                      </button>
                      <button @click="updateDocumentStatus(doc.id_documento, 'RECHAZADO')"
                              :disabled="matricula.estado === 'ACTIVA'"
                              class="px-3 py-1.5 rounded-lg text-sm font-bold text-red-700 hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-30">
                        <XCircle :size="16" />
                        Rechazar
                      </button>
                    </template>
                    <button v-else
                            @click="updateDocumentStatus(doc.id_documento, 'PENDIENTE')"
                            :disabled="matricula.estado === 'ACTIVA'"
                            class="px-4 py-1.5 rounded-lg text-sm font-bold text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1 disabled:opacity-30">
                      <AlertCircle :size="16" />
                      Verificar Nuevamente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="p-6 bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-4 rounded-b-3xl">
          <div v-if="matricula.estado === 'ACTIVA'" class="flex items-center gap-2 text-emerald-600 font-bold">
            <CheckCircle :size="24" />
            Esta solicitud ya ha sido procesada y aprobada.
          </div>
          <div v-else-if="allValidated" class="flex items-center gap-2 text-indigo-600 font-medium">
            <CheckCircle :size="20" />
            Todos los documentos están validados. Puedes proceder al registro final.
          </div>
          <div v-else class="text-gray-500 text-sm">
            Valida todos los documentos para habilitar el registro final del estudiante.
          </div>

          <div class="flex gap-3">
            <button v-if="matricula.estado === 'ACTIVA'" 
                    @click="currentStep = 3"
                    class="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100">
              Ver Resumen Final
              <ArrowLeft :size="20" class="rotate-180" />
            </button>
            <button v-else-if="matricula.estado === 'PENDIENTE' && allValidated" 
                    @click="currentStep = 3"
                    class="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
              Siguiente Paso
              <ArrowLeft :size="20" class="rotate-180" />
            </button>
            <button v-else-if="matricula.estado === 'PENDIENTE' || matricula.estado === 'RECHAZADA'"
                    @click="handleSave"
                    class="px-10 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-xl shadow-indigo-50 active:scale-95">
              <Save :size="20" />
              Guardar Cambios
            </button>
          </div>
        </div>
      </template>

      <!-- Step 3: Finalizar -->
      <div v-if="currentStep === 3" class="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div class="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-indigo-50/50 text-center">
          <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 mb-6">
            <ShieldCheck :size="40" />
          </div>
          <h2 class="text-3xl font-black text-gray-900">¡Todo Listo!</h2>
          <p class="text-gray-500 mt-4 leading-relaxed">
            Has asignado el salón <span class="font-bold text-gray-900">{{ matricula.tipo_grado }} ({{ matricula.seccion }})</span> y validado todos los documentos correctamente.
          </p>

          <div class="mt-10 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-left">
            <h4 class="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-4">Resumen de Registro</h4>
            <div class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-emerald-700">Institución</span>
                <span class="font-bold text-emerald-900">Colegio Seleccionado</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-emerald-700">Curso</span>
                <span class="font-bold text-emerald-900">{{ matricula.grado_nivel }} - {{ matricula.tipo_grado }} ({{ matricula.seccion }})</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-emerald-700">Jornada</span>
                <span class="font-bold text-emerald-900">{{ matricula.jornada }}</span>
              </div>
            </div>
          </div>

          <div class="mt-10 flex flex-col gap-3">
            <button @click="router.push({ path: `/dashboard/gestion-matriculas/${route.params.id}/registro`, query: { gradeId: matricula.id_grado } })"
                    class="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95">
              Crear Estudiante en el Sistema
              <ArrowLeft :size="20" class="rotate-180" />
            </button>
            <button @click="currentStep = 2" 
                    class="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all">
              Volver a Documentos
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Notificación de Inconsistencias -->
    <div v-if="showNotifyModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div class="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
        <div class="text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-6">
            <AlertCircle :size="32" />
          </div>
          <h3 class="text-2xl font-black text-gray-900">Notificar Inconsistencias</h3>
          <p class="text-gray-500 mt-4 leading-relaxed">
            Se han detectado <span class="font-bold text-red-600">{{ rejectedDocumentsNames.length }}</span> documentos con errores. ¿Deseas notificar al padre para que los corrija?
          </p>
          
          <div class="mt-6 bg-red-50 p-4 rounded-2xl border border-red-100 text-left">
            <p class="text-xs font-bold text-red-800 uppercase tracking-widest mb-2">Documentos a corregir:</p>
            <ul class="text-sm text-red-700 space-y-1">
              <li v-for="name in rejectedDocumentsNames" :key="name" class="flex items-center gap-2">
                <div class="h-1.5 w-1.5 rounded-full bg-red-400"></div>
                {{ name }}
              </li>
            </ul>
          </div>
        </div>
        
        <div class="mt-10 flex flex-col gap-3">
          <button @click="notifyInconsistencies" 
                  class="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
            <Send :size="20" />
            Enviar Correo al Padre
          </button>
          <button @click="showNotifyModal = false" 
                  class="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Documentos Pendientes -->
    <div v-if="showPendingModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div class="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
        <div class="text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-6">
            <AlertTriangle :size="32" />
          </div>
          <h3 class="text-2xl font-black text-gray-900">Documentos Pendientes</h3>
          <p class="text-gray-500 mt-4 leading-relaxed">
            Aún tienes documentos sin evaluar. ¿Deseas revisarlos ahora o prefieres guardar y continuar después?
          </p>
        </div>
        
        <div class="mt-10 flex flex-col gap-3">
          <button @click="showPendingModal = false" 
                  class="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-xl flex items-center justify-center gap-2">
            Revisar ahora
          </button>
          <button @click="confirmSaveLater" 
                  class="w-full py-4 bg-amber-50 text-amber-700 rounded-2xl font-bold hover:bg-amber-100 transition-all border border-amber-100">
            Lo revisaré después
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
