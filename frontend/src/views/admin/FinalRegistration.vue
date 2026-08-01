<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useNotificationStore } from '../../stores/notifications'
import { sanitizeLettersOnly, sanitizeDocumentNumber } from '../../utils/validationHelper'
import { 
  ArrowLeft,
  Save,
  CheckCircle,
  Eye,
  ChevronRight,
  ChevronLeft,
  FileText,
  GraduationCap,
  XCircle,
  Users,
  UserCheck,
  AlertTriangle
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const notify = useNotificationStore()

const idMatricula = Number(route.params.id)
const matricula = ref<any>(null)
const loading = ref(true)
const step = ref(1) // 1: Student, 2: Parent

// Selected candidate for multi-child flow
const selectedCandidate = ref<any>(null)
const candidatePicked = computed(() => !!selectedCandidate.value)

// Computed: resolve which student is active for this enrollment
const activeStudent = computed(() => {
  if (selectedCandidate.value) return selectedCandidate.value
  if (matricula.value?.renovacion?.student) return matricula.value.renovacion.student
  return null
})

// Is multi-child picker needed?
const needsCandidatePicker = computed(() => {
  const ren = matricula.value?.renovacion
  if (!ren?.is_renovacion) return false
  // Show picker if there are multiple candidates OR multiple eligible ones
  return (ren.candidates || []).length > 1 && !candidatePicked.value && !ren.student
})

const studentData = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: 1, // CC por defecto
})

const parentData = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: 1,
})

const currentDocIndex = ref(0)
const currentDoc = computed(() => {
  if (!matricula.value || !matricula.value.documentos) return null
  return matricula.value.documentos[currentDocIndex.value]
})

const fetchDetails = async () => {
  try {
    const response = await axios.get(`http://localhost:3000/api/matriculas/${idMatricula}`)
    matricula.value = response.data

    // Pre-populate student data from autoselected candidate
    if (response.data.renovacion?.student) {
      const st = response.data.renovacion.student
      studentData.value.nombre = st.nombre
      studentData.value.apellido = st.apellido
      studentData.value.documento = st.documento
      studentData.value.id_tipodocumento = st.id_tipodocumento || 1
    } else if (response.data.tipo === 'REINGRESO' || response.data.id_estudiante) {
      studentData.value.nombre = response.data.student_firstname || ''
      studentData.value.apellido = response.data.student_lastname || ''
      studentData.value.documento = response.data.student_document || ''
      studentData.value.id_tipodocumento = response.data.student_id_tipodocumento || 1
    }

    // Pre-populate parent data
    if (response.data.parent_firstname) {
      parentData.value.nombre = response.data.parent_firstname
      parentData.value.apellido = response.data.parent_lastname
      parentData.value.documento = response.data.parent_document
      parentData.value.id_tipodocumento = response.data.parent_id_tipodocumento || 2
    }

    // Si el padre ya tiene cuenta de personal (docente/directivo), pre-poblar formulario
    if (response.data.existing_parent_user) {
      const eu = response.data.existing_parent_user
      parentData.value.nombre = eu.nombre
      parentData.value.apellido = eu.apellido
    }
  } catch (error) {
    notify.addNotification('Error al cargar la solicitud', 'error')
    router.push('/dashboard/gestion-matriculas')
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetails)

const selectCandidate = (candidate: any) => {
  if (!candidate.eligible) return
  selectedCandidate.value = candidate
  // Pre-fill form with selected candidate data
  studentData.value.nombre = candidate.nombre
  studentData.value.apellido = candidate.apellido
  studentData.value.documento = candidate.documento
  studentData.value.id_tipodocumento = candidate.id_tipodocumento || 1
}

const clearCandidateSelection = () => {
  selectedCandidate.value = null
  studentData.value = { nombre: '', apellido: '', documento: '', id_tipodocumento: 1 }
}

const nextDoc = () => {
  if (currentDocIndex.value < matricula.value.documentos.length - 1) {
    currentDocIndex.value++
  }
}

const prevDoc = () => {
  if (currentDocIndex.value > 0) {
    currentDocIndex.value--
  }
}

const handleFinalize = async () => {
  // If multi-child picker and no selection yet, block
  if (matricula.value?.renovacion?.is_renovacion && 
      (matricula.value?.renovacion?.candidates || []).length > 1 &&
      !selectedCandidate.value && !matricula.value?.renovacion?.student) {
    notify.addNotification('Debes seleccionar cuál hijo es el que se está renovando.', 'warning')
    return
  }

  // Field text validations
  if (!studentData.value.nombre.trim() || studentData.value.nombre.trim().length < 2) {
    notify.addNotification('Por favor ingresa nombres válidos para el estudiante (mínimo 2 letras).', 'warning')
    return
  }
  if (!studentData.value.apellido.trim() || studentData.value.apellido.trim().length < 2) {
    notify.addNotification('Por favor ingresa apellidos válidos para el estudiante (mínimo 2 letras).', 'warning')
    return
  }
  if (!studentData.value.documento.trim() || studentData.value.documento.trim().length < 4) {
    notify.addNotification('Por favor ingresa un número de documento válido para el estudiante (mínimo 4 caracteres).', 'warning')
    return
  }
  if (!parentData.value.nombre.trim() || parentData.value.nombre.trim().length < 2) {
    notify.addNotification('Por favor ingresa nombres válidos para el acudiente (mínimo 2 letras).', 'warning')
    return
  }
  if (!parentData.value.apellido.trim() || parentData.value.apellido.trim().length < 2) {
    notify.addNotification('Por favor ingresa apellidos válidos para el acudiente (mínimo 2 letras).', 'warning')
    return
  }
  if (!parentData.value.documento.trim() || parentData.value.documento.trim().length < 4) {
    notify.addNotification('Por favor ingresa un número de documento válido para el acudiente (mínimo 4 caracteres).', 'warning')
    return
  }

  try {
    // Resolve id_estudiante: prefer explicit selection, then autoselected student, then reingreso
    const resolvedIdEstudiante = 
      selectedCandidate.value?.id_estudiante ||
      matricula.value?.renovacion?.student?.id_estudiante ||
      matricula.value?.id_estudiante ||
      null

    const parsedGradeId = Number(route.query.gradeId)
    const validGradeId = (!isNaN(parsedGradeId) && parsedGradeId > 0) ? parsedGradeId : (matricula.value?.id_grupo || undefined)

    const payload = {
      student: studentData.value,
      parent: parentData.value,
      id_grado: validGradeId,
      existing_parent_user_id: matricula.value?.existing_parent_user?.id_usuario || null,
      id_estudiante: resolvedIdEstudiante
    }
    await axios.post(`http://localhost:3000/api/matriculas/finalize/${idMatricula}`, payload)
    notify.addNotification('Registro finalizado y matrícula activada exitosamente', 'success')
    setTimeout(() => {
      router.push('/dashboard/gestion-matriculas')
    }, 1500)
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al finalizar el registro', 'error')
  }
}

// Nueva lógica de validación de documento en tiempo real
const checkingDocument = ref(false)
const docMatchInfo = ref<any>(null)

const verifyDocument = async () => {
  if (parentData.value.documento.length < 5) {
    docMatchInfo.value = null
    return
  }
  
  checkingDocument.value = true
  try {
    const response = await axios.get(`http://localhost:3000/api/auth/check-document/${parentData.value.documento}`)
    if (response.data.exists) {
      docMatchInfo.value = response.data
      notify.addNotification(`Atención: Este documento pertenece a un ${response.data.role} (${response.data.user.nombre} ${response.data.user.apellido}). Se vinculará como padre.`, 'info')
    } else {
      docMatchInfo.value = null
    }
  } catch (e) {
    console.error('Error al verificar documento')
  } finally {
    checkingDocument.value = false
  }
}

const formatUrl = (url: string) => {
  const filename = url.split(/[\\\/]/).pop()
  return `http://localhost:3000/uploads/${filename}`
}

const documentLabels: Record<string, string> = {
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

const getStatusColor = (estado: string) => {
  if (estado === 'ACTIVO') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (estado === 'EXPULSADO' || estado === 'RETIRADO') return 'bg-red-100 text-red-700 border-red-200'
  if (estado === 'SANCIONADO') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (estado === 'GRADUADO') return 'bg-indigo-100 text-indigo-700 border-indigo-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}
</script>

<template>
  <div class="h-[calc(100vh-100px)] flex overflow-hidden -m-8">
    <!-- LEFT: Form (60%) -->
    <div class="w-7/12 bg-white overflow-y-auto p-12 border-r border-gray-100">
      <div class="max-w-xl mx-auto">
        <!-- Header -->
        <div class="mb-12">
          <button @click="router.back()" class="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-all font-medium mb-6">
            <ArrowLeft :size="20" />
            <span>Volver al detalle</span>
          </button>
          <h1 class="text-4xl font-extrabold text-gray-900 tracking-tight">Registro Final</h1>
          <p class="text-gray-500 mt-2">Completa los datos personales para activar la matrícula.</p>
        </div>

        <!-- ===== RENOVACIÓN: Multi-child Candidate Picker ===== -->
        <div v-if="matricula?.renovacion?.is_renovacion" class="mb-8 font-sans space-y-4">

          <!-- Parent detected banner -->
          <div class="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-center gap-3">
            <div class="p-2 bg-sky-600 text-white rounded-xl shrink-0"><Users :size="18" /></div>
            <div>
              <p class="font-black text-sky-900 text-sm">Acudiente registrado detectado</p>
              <p class="text-sky-700 text-xs mt-0.5 font-medium">
                <strong>{{ matricula.renovacion.parent_name }}</strong> ya tiene hijos registrados en este colegio. Verifica cuál corresponde a esta matrícula.
              </p>
            </div>
          </div>

          <!-- CASE A: Multiple children → show picker -->
          <div v-if="needsCandidatePicker">
            <p class="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Selecciona el hijo que se está renovando</p>
            <div class="space-y-3">
              <button
                v-for="candidate in matricula.renovacion.candidates"
                :key="candidate.id_estudiante"
                @click="selectCandidate(candidate)"
                :disabled="!candidate.eligible"
                :class="[
                  'w-full text-left p-4 rounded-2xl border-2 transition-all',
                  !candidate.eligible
                    ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
                ]"
              >
                <div class="flex items-center gap-3">
                  <div :class="['p-2 rounded-xl shrink-0', candidate.eligible ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-500']">
                    <UserCheck v-if="candidate.eligible" :size="18" />
                    <AlertTriangle v-else :size="18" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-black text-gray-900 text-sm">{{ candidate.apellido }}, {{ candidate.nombre }}</p>
                    <p class="text-xs text-gray-500 font-medium">
                      Doc: {{ candidate.documento }} 
                      <span v-if="candidate.grado_nombre" class="ml-2">· {{ candidate.nivel_nombre }} {{ candidate.grado_nombre }}</span>
                    </p>
                    <p v-if="candidate.error_message" class="text-xs text-red-600 font-semibold mt-0.5">{{ candidate.error_message }}</p>
                  </div>
                  <span :class="['px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border', getStatusColor(candidate.estado)]">
                    {{ candidate.estado }}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <!-- CASE B: Single autoselected candidate (existing behavior) -->
          <div v-else-if="activeStudent">
            <!-- Selected from picker -->
            <div v-if="candidatePicked" class="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-2xl flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-indigo-600 text-white rounded-xl shrink-0"><UserCheck :size="18" /></div>
                <div>
                  <p class="font-black text-indigo-900 text-sm">{{ activeStudent.apellido }}, {{ activeStudent.nombre }}</p>
                  <p class="text-indigo-700 text-xs font-medium">Doc: {{ activeStudent.documento }}</p>
                </div>
              </div>
              <button v-if="(matricula.renovacion.candidates || []).length > 1" @click="clearCandidateSelection()" class="text-xs text-indigo-600 font-bold hover:underline">Cambiar</button>
            </div>

            <!-- Autoselected (only 1 candidate) -->
            <div v-else>
              <div v-if="matricula.renovacion.error_message" class="p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4">
                <div class="p-2.5 bg-red-600 text-white rounded-xl shrink-0"><XCircle :size="20" /></div>
                <div>
                  <p class="font-black text-red-900 text-sm">Bloqueo de Renovación Académica</p>
                  <p class="text-red-700 text-xs mt-1 font-semibold">{{ matricula.renovacion.error_message }}</p>
                </div>
              </div>
              <div v-else class="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-4">
                <div class="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0"><CheckCircle :size="20" /></div>
                <div>
                  <p class="font-black text-emerald-900 text-sm">Renovación Automática — {{ activeStudent.apellido }}, {{ activeStudent.nombre }}</p>
                  <p class="text-emerald-700 text-xs mt-0.5 font-semibold">Datos del año anterior pre-cargados. Verifica y confirma.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- ===== FIN Renovación ===== -->

        <div v-else-if="matricula?.tipo === 'REINGRESO'" class="mb-8 font-sans">
          <div class="p-5 bg-violet-50 border border-violet-200 rounded-3xl flex items-start gap-4">
            <div class="p-2.5 bg-violet-600 text-white rounded-xl shrink-0"><CheckCircle :size="20" /></div>
            <div>
              <p class="font-black text-violet-900 text-sm">Reingreso Estudiantil Detectado</p>
              <p class="text-violet-700 text-xs mt-0.5 font-semibold">
                Estudiante reingresado (Estado previo: RETIRADO). Motivo: {{ matricula.motivo }}.
              </p>
            </div>
          </div>
        </div>


        <!-- Stepper -->
        <div class="flex items-center gap-8 mb-12">
          <div :class="[step === 1 ? 'text-indigo-600' : 'text-gray-400', 'flex items-center gap-2 font-bold transition-all']">
            <div :class="[step === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-100', 'h-8 w-8 rounded-lg flex items-center justify-center text-sm']">1</div>
            Estudiante
          </div>
          <div class="h-px w-12 bg-gray-100"></div>
          <div :class="[step === 2 ? 'text-indigo-600' : 'text-gray-400', 'flex items-center gap-2 font-bold transition-all']">
            <div :class="[step === 2 ? 'bg-indigo-600 text-white' : 'bg-gray-100', 'h-8 w-8 rounded-lg flex items-center justify-center text-sm']">2</div>
            Padre / Acudiente
          </div>
        </div>

        <!-- FORM STEP 1: Student -->
        <div v-if="step === 1" class="space-y-6 animate-in slide-in-from-left duration-500">
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Nombres</label>
              <input v-model="studentData.nombre" @input="studentData.nombre = sanitizeLettersOnly(studentData.nombre)" type="text" placeholder="Ej: Juan Andrés" :disabled="matricula?.renovacion?.is_renovacion"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Apellidos</label>
              <input v-model="studentData.apellido" @input="studentData.apellido = sanitizeLettersOnly(studentData.apellido)" type="text" placeholder="Ej: Pérez García" :disabled="matricula?.renovacion?.is_renovacion"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Tipo de Documento</label>
              <select v-model="studentData.id_tipodocumento" :disabled="matricula?.renovacion?.is_renovacion" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                <option :value="1">Tarjeta de Identidad</option>
                <option :value="2">Cédula de Ciudadanía</option>
                <option :value="3">Registro Civil</option>
                <option :value="4">Cédula de Extranjería</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Número de Documento</label>
              <input v-model="studentData.documento" @input="studentData.documento = sanitizeDocumentNumber(studentData.documento)" type="text" placeholder="Ej: 1075..." :disabled="matricula?.renovacion?.is_renovacion"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
          </div>
          <div class="pt-8 flex justify-end">
            <button @click="step = 2" :disabled="!!matricula?.renovacion?.error_message" class="bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
              Siguiente: Datos del Padre
              <ChevronRight :size="20" />
            </button>
          </div>
        </div>

        <!-- FORM STEP 2: Parent -->
        <div v-if="step === 2" class="space-y-6 animate-in slide-in-from-right duration-500">

          <!-- Banner: Existing Staff Parent -->
          <div
            v-if="matricula?.existing_parent_user"
            class="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4"
          >
            <div class="p-2.5 bg-amber-500 text-white rounded-xl shrink-0">
              <GraduationCap :size="20" />
            </div>
            <div>
              <p class="font-black text-amber-900 text-sm">
                Acudiente identificado como
                <span class="uppercase font-extrabold">{{ matricula.existing_parent_user.display_role }}</span>
              </p>
              <p class="text-amber-800 text-xs mt-0.5">
                {{ matricula.existing_parent_user.nombre }} {{ matricula.existing_parent_user.apellido }}
                · {{ matricula.existing_parent_user.email }}
              </p>
              <p class="text-amber-700 text-xs mt-1.5 italic">
                Los campos de nombre han sido pre-llenados. Solo verifica el número de documento y guarda.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Nombres del Padre</label>
              <input v-model="parentData.nombre" @input="parentData.nombre = sanitizeLettersOnly(parentData.nombre)" type="text" placeholder="Ej: Carlos Mario"
                :disabled="!!matricula?.existing_parent_user"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Apellidos del Padre</label>
              <input v-model="parentData.apellido" @input="parentData.apellido = sanitizeLettersOnly(parentData.apellido)" type="text" placeholder="Ej: Pérez Motta"
                :disabled="!!matricula?.existing_parent_user"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Tipo de Documento</label>
              <select v-model="parentData.id_tipodocumento" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all">
                <option :value="2">Cédula de Ciudadanía</option>
                <option :value="4">Cédula de Extranjería</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Número de Documento</label>
              <div class="relative">
                <input v-model="parentData.documento" @input="parentData.documento = sanitizeDocumentNumber(parentData.documento)" type="text" placeholder="Ej: 1214..." @blur="verifyDocument"
                  class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all"
                  :class="{'border-indigo-300 bg-indigo-50': docMatchInfo}">
                <div v-if="checkingDocument" class="absolute right-4 top-4">
                  <div class="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
                </div>
                <CheckCircle v-if="docMatchInfo" class="absolute right-4 top-4 text-indigo-600" :size="20" />
              </div>
              <p v-if="docMatchInfo" class="text-xs text-indigo-600 font-bold">
                Usuario detectado: {{ docMatchInfo.user.nombre }} {{ docMatchInfo.user.apellido }} ({{ docMatchInfo.role }})
              </p>
            </div>
          </div>
          <div class="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <div class="flex gap-3">
              <CheckCircle :size="20" class="text-indigo-600 mt-0.5" />
              <p class="text-sm text-indigo-700 font-medium">
                Al guardar, se enviará automáticamente un correo a <strong>{{ matricula?.correo_padre }}</strong> con sus credenciales de acceso.
              </p>
            </div>
          </div>
          <div class="pt-8 flex justify-between">
            <button @click="step = 1" class="text-gray-500 font-bold px-4 py-2 flex items-center gap-2">
              <ChevronLeft :size="20" />
              Atrás
            </button>
            <button @click="handleFinalize" :disabled="!!matricula?.renovacion?.error_message" class="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
              Finalizar y Activar Matrícula
              <Save :size="20" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Document Viewer (40%) -->
    <div class="w-5/12 bg-gray-900 relative flex flex-col">
      <div class="p-6 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div class="flex items-center gap-3 text-white">
          <div class="p-2 bg-indigo-600 rounded-lg">
            <FileText :size="20" />
          </div>
          <div>
            <p class="text-xs text-gray-400 font-bold uppercase">Visor de Documentos</p>
            <p class="text-sm font-bold">{{ currentDoc ? documentLabels[currentDoc.tipo_documento] : 'Cargando...' }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="prevDoc" :disabled="currentDocIndex === 0" class="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-30">
            <ChevronLeft :size="20" />
          </button>
          <span class="text-white text-sm font-mono">{{ currentDocIndex + 1 }} / {{ matricula?.documentos.length }}</span>
          <button @click="nextDoc" :disabled="currentDocIndex === (matricula?.documentos.length - 1)" class="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-30">
            <ChevronRight :size="20" />
          </button>
        </div>
      </div>

      <div class="flex-1 bg-gray-800 flex items-center justify-center p-4">
        <template v-if="currentDoc">
          <iframe v-if="currentDoc.url.toLowerCase().endsWith('.pdf')" :src="formatUrl(currentDoc.url)" class="w-full h-full rounded-xl shadow-2xl"></iframe>
          <img v-else :src="formatUrl(currentDoc.url)" class="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
        </template>
        <div v-else class="text-gray-500 text-center">
          <Eye :size="48" class="mx-auto mb-4 opacity-20" />
          <p>Selecciona un documento para visualizarlo</p>
        </div>
      </div>
      
      <!-- Quick Navigation -->
      <div class="p-4 bg-gray-900 border-t border-gray-800 overflow-x-auto">
        <div class="flex gap-2">
          <button v-for="(doc, idx) in matricula?.documentos" :key="doc.id_documento"
            @click="currentDocIndex = idx as number"
            :class="[currentDocIndex === idx ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-gray-700 text-gray-500 hover:border-gray-500', 'px-3 py-1.5 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all']"
          >
            {{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-in {
  animation-duration: 0.5s;
  animation-fill-mode: both;
}
@keyframes slide-in-from-left {
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slide-in-from-right {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style>
