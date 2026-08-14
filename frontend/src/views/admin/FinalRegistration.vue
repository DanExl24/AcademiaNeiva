<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
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
  AlertTriangle,
  UserPlus,
  RotateCcw
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const notify = useNotificationStore()

const idMatricula = Number(route.params.id)
const matricula = ref<any>(null)
const loading = ref(true)
const step = ref(1) // 1: Student, 2: Parent

// Selection state for candidate child vs new child
const isNewStudent = ref(false)
const selectedCandidate = ref<any>(null)

// Is input fields locked?
const isStudentInputsDisabled = computed(() => {
  if (selectedCandidate.value) return true
  if (matricula.value?.id_estudiante && !isNewStudent.value) return true
  return false
})

const isParentInputsDisabled = computed(() => {
  if (docMatchInfo.value?.exists) return true
  if (matricula.value?.existing_parent_user) return true
  return false
})

const studentData = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: 2, // Tarjeta de Identidad por defecto (ID 2)
})

const parentData = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: 3, // Cédula de Ciudadanía por defecto (ID 3)
})

const currentDocIndex = ref(0)
const currentDoc = computed(() => {
  if (!matricula.value || !matricula.value.documentos) return null
  return matricula.value.documentos[currentDocIndex.value]
})

const fetchDetails = async () => {
  try {
    const response = await axios.get(`/api/matriculas/${idMatricula}`)
    matricula.value = response.data

    // If explicit student is bound to enrollment (e.g. Reingreso / Ticket)
    if (response.data.id_estudiante || response.data.tipo === 'REINGRESO') {
      studentData.value.nombre = response.data.student_firstname || ''
      studentData.value.apellido = response.data.student_lastname || ''
      studentData.value.documento = response.data.student_document || ''
      studentData.value.id_tipodocumento = Number(response.data.student_id_tipodocumento) || 2
    } else if (response.data.renovacion?.student) {
      const st = response.data.renovacion.student
      selectedCandidate.value = st
      studentData.value.nombre = st.nombre
      studentData.value.apellido = st.apellido
      studentData.value.documento = st.documento
      studentData.value.id_tipodocumento = Number(st.id_tipodocumento) || 2
    }

    // Pre-populate parent data
    if (response.data.parent_firstname) {
      parentData.value.nombre = response.data.parent_firstname
      parentData.value.apellido = response.data.parent_lastname
      parentData.value.documento = response.data.parent_document
      parentData.value.id_tipodocumento = Number(response.data.parent_id_tipodocumento) || 3
    }

    // Si el padre ya tiene cuenta de personal (docente/directivo), pre-poblar formulario
    if (response.data.existing_parent_user) {
      const eu = response.data.existing_parent_user
      parentData.value.nombre = eu.nombre
      parentData.value.apellido = eu.apellido
      if (eu.id_tipodocumento) {
        parentData.value.id_tipodocumento = Number(eu.id_tipodocumento)
      }
    }

    if (studentData.value.documento) {
      checkAcademicWarningForStudent(studentData.value.documento)
    }

    if (parentData.value.documento) {
      verifyDocument()
    }
  } catch (error) {
    notify.addNotification('Error al cargar la solicitud', 'error')
    router.push('/dashboard/gestion-matriculas')
  } finally {
    loading.value = false
  }
}

const academicWarning = ref<any>(null)
const checkAcademicWarningForStudent = async (doc: string) => {
  if (!doc || doc.trim().length < 4) return
  try {
    const res = await axios.get(`${API_BASE_URL}/api/academic-admin/academic-tracking/check-warning`, {
      params: { documento: doc.trim() }
    })
    if (res.data.exists && res.data.warning) {
      academicWarning.value = res.data
    } else {
      academicWarning.value = null
    }
  } catch (err) {
    console.error("Error al consultar advertencia académica:", err)
  }
}

onMounted(fetchDetails)

const selectCandidate = (candidate: any) => {
  if (!candidate.eligible) return
  selectedCandidate.value = candidate
  isNewStudent.value = false
  studentData.value.nombre = candidate.nombre
  studentData.value.apellido = candidate.apellido
  studentData.value.documento = candidate.documento
  studentData.value.id_tipodocumento = Number(candidate.id_tipodocumento) || 2
  checkAcademicWarningForStudent(candidate.documento)
}

const selectNewStudent = () => {
  selectedCandidate.value = null
  isNewStudent.value = true
  studentData.value = { nombre: '', apellido: '', documento: '', id_tipodocumento: 2 }
  academicWarning.value = null
}

const clearCandidateSelection = () => {
  selectedCandidate.value = null
  isNewStudent.value = false
  studentData.value = { nombre: '', apellido: '', documento: '', id_tipodocumento: 2 }
  academicWarning.value = null
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
  // If candidates exist and neither candidate nor new student selected
  if (matricula.value?.renovacion?.is_renovacion && 
      (matricula.value?.renovacion?.candidates || []).length > 0 &&
      !selectedCandidate.value && !isNewStudent.value && !matricula.value?.id_estudiante) {
    notify.addNotification('Por favor selecciona si se renovará un hijo existente o si se registrará un nuevo hijo.', 'warning')
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

  const cleanStudentDoc = studentData.value.documento.trim().replace(/\s+/g, "").toUpperCase();
  const cleanParentDoc = parentData.value.documento.trim().replace(/\s+/g, "").toUpperCase();

  if (cleanStudentDoc === cleanParentDoc) {
    notify.addNotification('El número de documento de identidad no puede ser igual para el estudiante y el acudiente.', 'error')
    return
  }

  try {
    const resolvedIdEstudiante = 
      selectedCandidate.value?.id_estudiante ||
      (isNewStudent.value ? null : (matricula.value?.id_estudiante || null))

    const parsedGradeId = Number(route.query.gradeId)
    const validGradeId = (!isNaN(parsedGradeId) && parsedGradeId > 0) ? parsedGradeId : (matricula.value?.id_grupo || undefined)

    const payload = {
      student: studentData.value,
      parent: parentData.value,
      id_grado: validGradeId,
      existing_parent_user_id: matricula.value?.existing_parent_user?.id_usuario || null,
      id_estudiante: resolvedIdEstudiante
    }
    await axios.post(`/api/matriculas/finalize/${idMatricula}`, payload)
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
let lastMatchedDoc = ''

const onParentDocumentInput = () => {
  parentData.value.documento = sanitizeDocumentNumber(parentData.value.documento)
  if (docMatchInfo.value && parentData.value.documento !== lastMatchedDoc) {
    docMatchInfo.value = null
    parentData.value.nombre = ''
    parentData.value.apellido = ''
    lastMatchedDoc = ''
  }
}

const verifyDocument = async () => {
  const doc = parentData.value.documento ? parentData.value.documento.trim() : ''
  if (doc.length < 5) {
    if (docMatchInfo.value) {
      docMatchInfo.value = null
      parentData.value.nombre = ''
      parentData.value.apellido = ''
      lastMatchedDoc = ''
    }
    return
  }
  
  checkingDocument.value = true
  try {
    const response = await axios.get(`/api/auth/check-document/${doc}`)
    if (response.data.exists && response.data.user) {
      docMatchInfo.value = response.data
      lastMatchedDoc = doc
      parentData.value.nombre = response.data.user.nombre || ''
      parentData.value.apellido = response.data.user.apellido || ''
      if (response.data.user.id_tipodocumento) {
        parentData.value.id_tipodocumento = Number(response.data.user.id_tipodocumento)
      }
      const roles: string[] = response.data.roles || []
      const isStaff = roles.includes('docente') || roles.includes('directivo') || roles.includes('admin')
      if (isStaff) {
        notify.addNotification(`Atención: Este documento pertenece a personal institucional (${response.data.role}: ${response.data.user.nombre} ${response.data.user.apellido}). Se le vinculará también el rol de acudiente.`, 'info')
      } else {
        notify.addNotification(`Usuario acudiente existente detectado: ${response.data.user.nombre} ${response.data.user.apellido}. Se asociará a esta nueva matrícula.`, 'info')
      }
    } else {
      if (docMatchInfo.value) {
        parentData.value.nombre = ''
        parentData.value.apellido = ''
      }
      docMatchInfo.value = null
      lastMatchedDoc = ''
    }
  } catch (err) {
    if (docMatchInfo.value) {
      parentData.value.nombre = ''
      parentData.value.apellido = ''
    }
    docMatchInfo.value = null
    lastMatchedDoc = ''
  } finally {
    checkingDocument.value = false
  }
}

const formatUrl = (target: any) => {
  if (!target) return ''
  if (typeof target === 'object' && target.id_documento) {
    const tokenQuery = target.token_acceso ? `?token=${encodeURIComponent(target.token_acceso)}` : ''
    return `${API_BASE_URL}/api/matriculas/documentos/${target.id_documento}/archivo${tokenQuery}`
  }
  if (typeof target === 'number') {
    return `${API_BASE_URL}/api/matriculas/documentos/${target}/archivo`
  }
  if (typeof target === 'string') {
    if (target.startsWith('http')) return target
    const found = matricula.value?.documentos?.find((d: any) => d.url === target || d.nombre_original === target)
    if (found && found.id_documento) {
      const tokenQuery = found.token_acceso ? `?token=${encodeURIComponent(found.token_acceso)}` : ''
      return `${API_BASE_URL}/api/matriculas/documentos/${found.id_documento}/archivo${tokenQuery}`
    }
    return `${API_BASE_URL}/uploads/${target}`
  }
  return ''
}

const documentLabels: Record<string, string> = {
  documentoIdentidad: 'Documento de Identidad Estudiante',
  documentoPadre: 'Documento del Acudiente',
  registroCivil: 'Registro Civil de Nacimiento',
  salud: 'Certificado de Salud / EPS',
  foto: 'Fotografía 3x4',
  reciboPublico: 'Recibo de Servicios Públicos',
  certificadosEscolaridad: 'Certificados de Estudios Anteriores',
  vacunas: 'Carnet de Vacunación',
  certificadoDiscapacidad: 'Certificado de Discapacidad',
  visa: 'Visa / Permiso de Permanencia'
}

const getStatusColor = (estado: string) => {
  switch (estado) {
    case 'ACTIVO': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    case 'EXPULSADO': return 'bg-red-100 text-red-800 border-red-300'
    case 'GRADUADO': return 'bg-purple-100 text-purple-800 border-purple-300'
    case 'RETIRADO': return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'SANCIONADO': return 'bg-orange-100 text-orange-800 border-orange-300'
    default: return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}
</script>

<template>
  <div v-if="loading" class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
  </div>

  <div v-else-if="matricula" class="min-h-screen bg-gray-50 flex">
    <!-- LEFT: Form Side (60%) -->
    <div class="w-7/12 p-12 overflow-y-auto">
      <div class="max-w-2xl mx-auto">
        <button @click="router.back()" class="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-all font-bold mb-8">
          <ArrowLeft :size="20" />
          Volver a Gestión
        </button>

        <h1 class="text-3xl font-black text-gray-900 mb-2">Registro Final</h1>
        <p class="text-gray-500 mb-8 font-medium">Completa los datos personales para activar la matrícula.</p>

        <!-- BANNER DE EXPULSIÓN DE MATRÍCULA -->
        <div v-if="matricula.expulsion" class="mb-8 font-sans">
          <div class="p-5 bg-red-50 border border-red-200 rounded-3xl flex items-start gap-4">
            <div class="p-2.5 bg-red-600 text-white rounded-xl shrink-0">
              <XCircle :size="20" />
            </div>
            <div>
              <p class="font-black text-red-900 text-sm">Estudiante Expulsado Institucionalmente</p>
              <p class="text-red-800 text-xs mt-1 leading-relaxed">
                Motivo de expulsión: <strong>{{ matricula.expulsion.motivo }}</strong>
              </p>
              <p v-if="matricula.expulsion.observaciones" class="text-red-700 text-xs mt-1 italic">
                "{{ matricula.expulsion.observaciones }}"
              </p>
              <p class="text-red-600 text-[11px] mt-2 font-bold uppercase tracking-wider">
                Ordenado por: {{ matricula.expulsion.directivo_nombre }}
              </p>
            </div>
          </div>
        </div>

        <!-- BANNER DE TRASLADO DE MATRÍCULA -->
        <div v-if="matricula.traslado_info" class="mb-8 font-sans">
          <div class="p-5 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4">
            <div class="p-2.5 bg-amber-600 text-white rounded-xl shrink-0">
              <GraduationCap :size="20" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-black text-amber-950 text-sm">Trazabilidad de Traslado de Matrícula</p>
              <p class="text-amber-900 text-xs mt-1 leading-relaxed">
                Origen: <strong>{{ matricula.traslado_info.colegio_origen_nombre || 'Plantel Origen' }}</strong>
                → Destino: <strong>{{ matricula.traslado_info.colegio_destino_nombre || 'Plantel Destino' }}</strong>
              </p>
              <p v-if="matricula.traslado_info.motivo" class="text-amber-800 text-xs mt-1 italic">
                Motivo: {{ matricula.traslado_info.motivo }}
              </p>
              <div class="mt-2 flex items-center justify-between">
                <span class="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-lg text-[10px] font-black uppercase">
                  Estado: {{ matricula.traslado_info.estado_traslado }}
                </span>
                <router-link to="/dashboard/gestion-matriculas" class="text-xs text-amber-900 font-extrabold hover:underline">
                  Ver en panel de traslados →
                </router-link>
              </div>
            </div>
          </div>
        </div>

        <!-- Advertencia Académica Previa -->
        <div v-if="academicWarning" class="mb-8 font-sans">
          <div 
            class="p-5 rounded-3xl flex items-start gap-4 shadow-sm border-2"
            :class="academicWarning.resultado_calculado === 'NO_PROMOVIDO' ? 'bg-red-50/80 border-red-300' : 'bg-amber-50/80 border-amber-300'"
          >
            <div 
              class="p-2.5 rounded-xl text-white shrink-0 shadow-sm"
              :class="academicWarning.resultado_calculado === 'NO_PROMOVIDO' ? 'bg-red-600' : 'bg-amber-500'"
            >
              <AlertTriangle :size="20" />
            </div>
            <div class="space-y-2 flex-1">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <p 
                  class="font-black text-sm tracking-tight"
                  :class="academicWarning.resultado_calculado === 'NO_PROMOVIDO' ? 'text-red-950' : 'text-amber-950'"
                >
                  ⚠️ Advertencia Académica Informativa — Año Anterior
                </p>
                <span 
                  class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                  :class="academicWarning.resultado_calculado === 'NO_PROMOVIDO' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'"
                >
                  {{ academicWarning.resultado_calculado === 'NO_PROMOVIDO' ? 'No Promovido' : (academicWarning.resultado_calculado === 'APROBADO' ? 'Promovido' : 'Pendiente') }}
                </span>
              </div>

              <p 
                class="text-xs leading-relaxed"
                :class="academicWarning.resultado_calculado === 'NO_PROMOVIDO' ? 'text-red-900' : 'text-amber-900'"
              >
                {{ academicWarning.message }} 
                <span v-if="academicWarning.ultima_matricula">
                  (Grado cursado: <strong>{{ academicWarning.ultima_matricula.grado_nombre }} {{ academicWarning.ultima_matricula.grupo_nombre }}</strong>)
                </span>
              </p>

              <!-- Materias Reprobadas -->
              <div v-if="academicWarning.materias_reprobadas && academicWarning.materias_reprobadas.length > 0" class="pt-1">
                <p class="text-xs font-bold text-slate-700 mb-1">Asignaturas reprobadas:</p>
                <div class="flex flex-wrap gap-1.5">
                  <span 
                    v-for="mat in academicWarning.materias_reprobadas" 
                    :key="mat.id_materia"
                    class="px-2 py-0.5 bg-red-100/90 text-red-800 border border-red-200 text-xs font-medium rounded-lg"
                  >
                    {{ mat.materia_nombre }} (Nota: {{ mat.promedio }})
                  </span>
                </div>
              </div>

              <!-- Decisión Institucional Previa si existe -->
              <div v-if="academicWarning.decision_existente" class="mt-2 p-2.5 bg-white/80 border border-amber-200 rounded-xl text-xs space-y-1">
                <p class="font-bold text-slate-800">
                  📋 Decisión Institucional Registrada: 
                  <span class="text-indigo-600 font-extrabold">{{ academicWarning.decision_existente.decision_tomada?.replace(/_/g, ' ') }}</span>
                </p>
                <p v-if="academicWarning.decision_existente.observacion" class="text-slate-600 italic">
                  "{{ academicWarning.decision_existente.observacion }}"
                </p>
              </div>

              <p class="text-[11px] text-slate-500 italic pt-1">
                * Nota: Esta advertencia es estrictamente informativa para orientar la asignación del grado. No bloquea el proceso de matrícula.
              </p>
            </div>
          </div>
        </div>

        <!-- ===== RENOVACIÓN / ASOCIACIÓN: Candidate Selector ===== -->
        <div v-if="matricula?.renovacion?.is_renovacion" class="mb-8 font-sans space-y-4">

          <!-- Parent detected banner -->
          <div class="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-center gap-3">
            <div class="p-2 bg-sky-600 text-white rounded-xl shrink-0"><Users :size="18" /></div>
            <div>
              <p class="font-black text-sky-900 text-sm">Acudiente registrado detectado</p>
              <p class="text-sky-700 text-xs mt-0.5 font-medium">
                <strong>{{ matricula.renovacion.parent_name }}</strong> ya tiene hijo(s) registrado(s) en este colegio. Selecciona cuál corresponde a esta matrícula o registra un nuevo hijo.
              </p>
            </div>
          </div>

          <!-- STATE 1: Candidate Selected -->
          <div v-if="selectedCandidate" class="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-2xl flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-indigo-600 text-white rounded-xl shrink-0"><UserCheck :size="18" /></div>
              <div>
                <p class="font-black text-indigo-900 text-sm">Renovación — {{ selectedCandidate.apellido }}, {{ selectedCandidate.nombre }}</p>
                <p class="text-indigo-700 text-xs font-medium">
                  Doc: {{ selectedCandidate.documento }}
                  <span v-if="selectedCandidate.grado_nombre" class="ml-2">· {{ selectedCandidate.nivel_nombre }} {{ selectedCandidate.grado_nombre }}</span>
                </p>
              </div>
            </div>
            <button @click="clearCandidateSelection()" class="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
              <RotateCcw :size="14" />
              Cambiar / Limpiar
            </button>
          </div>

          <!-- STATE 2: New Student Selected -->
          <div v-else-if="isNewStudent" class="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-emerald-600 text-white rounded-xl shrink-0"><UserPlus :size="18" /></div>
              <div>
                <p class="font-black text-emerald-900 text-sm">Registrando un Nuevo Hijo</p>
                <p class="text-emerald-700 text-xs font-medium">Los campos de estudiante están habilitados. Ingresa nombres y documento del nuevo hijo.</p>
              </div>
            </div>
            <button @click="clearCandidateSelection()" class="px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
              <RotateCcw :size="14" />
              Cambiar / Limpiar
            </button>
          </div>

          <!-- STATE 3: Unselected -> Show Options List -->
          <div v-else class="space-y-3">
            <p class="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Opciones de Matrícula para este Acudiente:</p>

            <div v-for="candidate in matricula.renovacion.candidates" :key="candidate.id_estudiante">
              <button
                @click="selectCandidate(candidate)"
                :disabled="!candidate.eligible"
                :class="[
                  'w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3',
                  !candidate.eligible
                    ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer shadow-sm'
                ]"
              >
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
              </button>
            </div>

            <!-- Option to Register a NEW Child -->
            <button
              @click="selectNewStudent()"
              class="w-full text-left p-4 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/60 hover:bg-emerald-100/70 hover:border-emerald-500 transition-all flex items-center gap-3 cursor-pointer shadow-sm"
            >
              <div class="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                <UserPlus :size="18" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-black text-emerald-950 text-sm">+ Registrar un nuevo hijo para este acudiente</p>
                <p class="text-xs text-emerald-700 font-medium">Libera los campos para ingresar nombres y documento de un nuevo estudiante.</p>
              </div>
            </button>
          </div>
        </div>
        <!-- ===== FIN Renovación Selector ===== -->

        <div v-else-if="matricula?.tipo === 'REINGRESO'" class="mb-8 font-sans">
          <div class="p-5 bg-violet-50 border border-violet-200 rounded-3xl flex items-start gap-4">
            <div class="p-2.5 bg-violet-600 text-white rounded-xl shrink-0"><CheckCircle :size="20" /></div>
            <div>
              <p class="font-black text-violet-900 text-sm">Reingreso Estudiantil Detectado</p>
              <p class="text-violet-700 text-xs mt-0.5 font-semibold">Estudiante retirado previamente. Se reactivará su ficha en estado ACTIVO.</p>
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
              <input v-model="studentData.nombre" @input="studentData.nombre = sanitizeLettersOnly(studentData.nombre)" type="text" placeholder="Ej: Juan Andrés" :disabled="isStudentInputsDisabled"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Apellidos</label>
              <input v-model="studentData.apellido" @input="studentData.apellido = sanitizeLettersOnly(studentData.apellido)" type="text" placeholder="Ej: Pérez García" :disabled="isStudentInputsDisabled"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Tipo de Documento</label>
              <select v-model="studentData.id_tipodocumento" :disabled="isStudentInputsDisabled" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                <option :value="2">Tarjeta de Identidad</option>
                <option :value="1">Registro Civil</option>
                <option :value="3">Cédula de Ciudadanía</option>
                <option :value="4">Cédula de Extranjería</option>
                <option :value="5">PEP / PPT</option>
                <option :value="6">Pasaporte</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Número de Documento</label>
              <input v-model="studentData.documento" @input="studentData.documento = sanitizeDocumentNumber(studentData.documento)" type="text" placeholder="Ej: 1075..." :disabled="isStudentInputsDisabled"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
          </div>
          <div class="pt-8 flex justify-end">
            <button @click="step = 2" :disabled="selectedCandidate && !selectedCandidate.eligible" class="bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
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
                Persona registrada en la plataforma como
                <span class="uppercase font-extrabold text-amber-950">{{ matricula.existing_parent_user.display_role }}</span>
              </p>
              <p class="text-amber-800 text-xs mt-0.5">
                {{ matricula.existing_parent_user.nombre }} {{ matricula.existing_parent_user.apellido }}
                · {{ matricula.existing_parent_user.email }}
              </p>
              <p class="text-amber-700 text-xs mt-1.5 font-semibold">
                ✨ En este colegio se vinculará únicamente como <strong>Padre de Familia / Acudiente</strong> (sin asignarle rol de docente en esta institución).
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Nombres del Padre</label>
              <input v-model="parentData.nombre" @input="parentData.nombre = sanitizeLettersOnly(parentData.nombre)" type="text" placeholder="Ej: Carlos Mario"
                :disabled="isParentInputsDisabled"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Apellidos del Padre</label>
              <input v-model="parentData.apellido" @input="parentData.apellido = sanitizeLettersOnly(parentData.apellido)" type="text" placeholder="Ej: Pérez Motta"
                :disabled="isParentInputsDisabled"
                class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Tipo de Documento</label>
              <select v-model="parentData.id_tipodocumento" :disabled="isParentInputsDisabled" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 p-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                <option :value="3">Cédula de Ciudadanía</option>
                <option :value="4">Cédula de Extranjería</option>
                <option :value="5">PEP / PPT</option>
                <option :value="6">Pasaporte</option>
                <option :value="2">Tarjeta de Identidad</option>
                <option :value="1">Registro Civil</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-gray-700">Número de Documento</label>
              <div class="relative">
                <input v-model="parentData.documento" @input="onParentDocumentInput" type="text" placeholder="Ej: 1214..." @blur="verifyDocument"
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
            <button @click="handleFinalize" class="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2">
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
          <iframe
            v-if="(currentDoc.mime_type && currentDoc.mime_type.includes('pdf')) || (currentDoc.url && currentDoc.url.toLowerCase().endsWith('.pdf')) || (currentDoc.nombre_original && currentDoc.nombre_original.toLowerCase().endsWith('.pdf'))"
            :src="formatUrl(currentDoc)"
            class="w-full h-full rounded-xl shadow-2xl border-0"
          ></iframe>
          <img
            v-else
            :src="formatUrl(currentDoc)"
            :alt="documentLabels[currentDoc.tipo_documento] || 'Documento'"
            class="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
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
