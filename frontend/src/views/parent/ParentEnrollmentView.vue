<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { useAuthStore } from '../../stores/auth'
import { 
  FileText, 
  GraduationCap, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  School,
  ShieldCheck,
  Loader2
} from 'lucide-vue-next'

interface Child {
  id_estudiante: number
  nombre: string
  apellido: string
  codigo: string
  grado_nombre?: string
  seccion_nombre?: string
}

interface EnrollmentDoc {
  id_documento: number
  id_matricula: number
  tipo_documento: string
  url: string
  estado: string
  fecha: string
  version: number
  mime_type?: string
  nombre_original?: string
  token_acceso?: string
}

const auth = useAuthStore()
const loadingChildren = ref(true)
const loadingEnrollment = ref(false)
const children = ref<Child[]>([])
const selectedStudentId = ref<number | null>(null)
const enrollmentData = ref<any>(null)
const documents = ref<EnrollmentDoc[]>([])
const selectedDocIndex = ref(0)

const documentLabels: Record<string, string> = {
  documentoIdentidad: 'Doc. Identidad Estudiante',
  documentoPadre: 'Doc. Identidad Acudiente',
  registroCivil: 'Registro Civil de Nacimiento',
  salud: 'Certificado de Salud / EPS',
  foto: 'Fotografía 3x4',
  reciboPublico: 'Recibo de Servicios Públicos',
  certificadosEscolaridad: 'Certificados de Estudios Anteriores',
  vacunas: 'Carnet de Vacunación',
  certificadoDiscapacidad: 'Certificado de Discapacidad',
  visa: 'Visa / Permiso de Permanencia'
}

const currentDoc = computed(() => {
  if (documents.value.length === 0) return null
  return documents.value[selectedDocIndex.value] || null
})

// Load parent's children
const fetchChildren = async () => {
  const userId = (auth.isMonitoring && auth.monitoringUser?.id) ? auth.monitoringUser.id : auth.user?.id
  if (!userId) return
  try {
    loadingChildren.value = true
    const response = await axios.get(`/api/student/parent-children/${userId}`)
    children.value = response.data || []
    if (children.value.length > 0) {
      selectedStudentId.value = children.value[0].id_estudiante
    }
  } catch (error) {
    console.error('Error al cargar hijos del acudiente:', error)
    children.value = []
  } finally {
    loadingChildren.value = false
  }
}

// Load enrollment and documents for selected student
const fetchEnrollmentData = async () => {
  if (!selectedStudentId.value) return
  try {
    loadingEnrollment.value = true
    selectedDocIndex.value = 0
    const response = await axios.get(`/api/student/parent/enrollment/${selectedStudentId.value}`)
    enrollmentData.value = response.data.matricula || null
    documents.value = response.data.documentos || []
  } catch (error) {
    console.error('Error al cargar matrícula del estudiante:', error)
    enrollmentData.value = null
    documents.value = []
  } finally {
    loadingEnrollment.value = false
  }
}

const formatDocUrl = (doc: EnrollmentDoc | null) => {
  if (!doc || !doc.id_documento) return ''
  const tokenQuery = doc.token_acceso ? `?token=${encodeURIComponent(doc.token_acceso)}` : ''
  return `${API_BASE_URL}/api/matriculas/documentos/${doc.id_documento}/archivo${tokenQuery}`
}

const getStatusBadge = (estado: string) => {
  switch (estado) {
    case 'VALIDADO':
    case 'APROBADA':
    case 'ACTIVA': return { label: estado, class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
    case 'PENDIENTE': return { label: 'PENDIENTE', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' }
    case 'RECHAZADO':
    case 'CORRECCION': return { label: 'EN CORRECCIÓN', class: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' }
    default: return { label: estado, class: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Sin fecha'
  return new Date(dateStr).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

const prevDoc = () => {
  if (selectedDocIndex.value > 0) selectedDocIndex.value--
}

const nextDoc = () => {
  if (selectedDocIndex.value < documents.value.length - 1) selectedDocIndex.value++
}

watch(selectedStudentId, () => {
  fetchEnrollmentData()
})

onMounted(async () => {
  await fetchChildren()
})
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-500 pb-16">
    
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <FileText :size="28" class="text-indigo-600 dark:text-indigo-400" />
          Matrícula y Expediente Digital
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-xs mt-1">Consulta el estado oficial de la matrícula activa de tu hijo y visualiza sus documentos adjuntos entregados.</p>
      </div>

      <!-- Child Selector Pills -->
      <div v-if="children.length > 1" class="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          v-for="child in children"
          :key="child.id_estudiante"
          @click="selectedStudentId = child.id_estudiante"
          :class="[
            selectedStudentId === child.id_estudiante
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none ring-2 ring-indigo-300'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 border border-slate-200 dark:border-slate-700',
            'px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0'
          ]"
        >
          <div class="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center font-black text-[10px]">
            {{ child.nombre.charAt(0) }}
          </div>
          <span>{{ child.nombre }} {{ child.apellido.split(' ')[0] }}</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loadingChildren || loadingEnrollment" class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center shadow-sm">
      <Loader2 class="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
      <p class="text-xs font-bold text-slate-500 dark:text-slate-400">Cargando expediente de la matrícula...</p>
    </div>

    <!-- Empty State: No Children or No Enrollment -->
    <div v-else-if="!enrollmentData" class="bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-14 text-center space-y-3">
      <div class="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mx-auto text-slate-400">
        <GraduationCap :size="32" />
      </div>
      <h3 class="text-base font-bold text-slate-700 dark:text-slate-300">No se encontró una matrícula activa registrada</h3>
      <p class="text-xs text-slate-400 max-w-md mx-auto">Comunícate con la secretaría del colegio si necesitas gestionar la inscripción o reactivación de matrícula.</p>
    </div>

    <!-- MAIN WORKSPACE: GRID LAYOUT (FICHA + VISOR DIGITAL) -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- LEFT COLUMN: FICHA OFICIAL + RESUMEN DOCUMENTOS (~42% / col-span-5) -->
      <div class="lg:col-span-5 space-y-5">
        
        <!-- Official Active Enrollment Card -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
          
          <div class="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <School :size="24" />
              </div>
              <div>
                <h3 class="font-black text-slate-900 dark:text-white text-base leading-tight">{{ enrollmentData.school_name || 'Institución Educativa' }}</h3>
                <p class="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">Año Lectivo: {{ enrollmentData.year_label || 'Vigente' }}</p>
              </div>
            </div>

            <span :class="[getStatusBadge(enrollmentData.estado).class, 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0']">
              {{ getStatusBadge(enrollmentData.estado).label }}
            </span>
          </div>

          <!-- Student Profile Summary -->
          <div class="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-2xl space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-400 font-semibold">Estudiante:</span>
              <strong class="text-slate-800 dark:text-slate-200 font-bold">{{ enrollmentData.student_firstname }} {{ enrollmentData.student_lastname }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 font-semibold">Documento Identidad:</span>
              <span class="font-mono text-slate-700 dark:text-slate-300 font-bold">{{ enrollmentData.student_document || 'Registrado' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 font-semibold">Código Institucional:</span>
              <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">#{{ enrollmentData.student_code || 'N/A' }}</span>
            </div>
          </div>

          <!-- Academic Group & Section Details -->
          <div class="grid grid-cols-2 gap-3 pt-1">
            <div class="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/40">
              <span class="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">Grado y Salón</span>
              <p class="font-black text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {{ enrollmentData.tipo_grado }} ({{ enrollmentData.seccion }})
              </p>
            </div>
            <div class="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100/50 dark:border-purple-900/40">
              <span class="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider block">Jornada Escolar</span>
              <p class="font-black text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {{ enrollmentData.jornada }}
              </p>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
            <span>Ticket Matrícula: <strong class="font-mono text-slate-500">#{{ enrollmentData.id_matricula }}</strong></span>
            <span>Registrada el: {{ formatDate(enrollmentData.fecha_creacion) }}</span>
          </div>

        </div>

        <!-- Document Checklist Summary -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h4 class="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldCheck :size="16" class="text-indigo-600" />
              Expediente Digital ({{ documents.length }})
            </h4>
            <span class="text-[10px] text-slate-400 font-semibold">Selecciona para ver</span>
          </div>

          <div class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="(doc, idx) in documents"
              :key="doc.id_documento"
              @click="selectedDocIndex = idx"
              :class="[
                selectedDocIndex === idx
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-100'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-indigo-200',
                'p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2'
              ]"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <FileText :size="16" :class="selectedDocIndex === idx ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'" />
                <span class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                  {{ documentLabels[doc.tipo_documento] || doc.tipo_documento }}
                </span>
              </div>

              <span :class="[getStatusBadge(doc.estado).class, 'px-2 py-0.5 rounded-md text-[9px] font-black uppercase shrink-0']">
                {{ getStatusBadge(doc.estado).label }}
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- RIGHT COLUMN: INTERACTIVE DOCUMENT VISOR (~58% / col-span-7) -->
      <div class="lg:col-span-7 bg-slate-900 rounded-3xl overflow-hidden shadow-xl flex flex-col min-h-[580px] border border-slate-800">
        
        <!-- Visor Header Bar -->
        <div class="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
              <Eye :size="18" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Visor Seguro de Documentos</p>
              <h4 class="text-xs font-black text-white truncate">
                {{ currentDoc ? (documentLabels[currentDoc.tipo_documento] || currentDoc.tipo_documento) : 'Sin documento' }}
              </h4>
            </div>
          </div>

          <!-- Viewer Navigation & Action Controls -->
          <div v-if="currentDoc" class="flex items-center gap-2 shrink-0">
            <button @click="prevDoc" :disabled="selectedDocIndex === 0" class="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-30 transition">
              <ChevronLeft :size="16" />
            </button>
            <span class="text-white text-xs font-mono px-1">{{ selectedDocIndex + 1 }} / {{ documents.length }}</span>
            <button @click="nextDoc" :disabled="selectedDocIndex === documents.length - 1" class="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-30 transition">
              <ChevronRight :size="16" />
            </button>
            
            <a
              :href="formatDocUrl(currentDoc)"
              target="_blank"
              class="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink :size="14" />
              Abrir
            </a>
          </div>
        </div>

        <!-- Embedded Viewer Container -->
        <div class="flex-1 bg-slate-950 flex items-center justify-center p-4 min-h-[460px]">
          <template v-if="currentDoc">
            <iframe
              v-if="(currentDoc.mime_type && currentDoc.mime_type.includes('pdf')) || (currentDoc.url && currentDoc.url.toLowerCase().endsWith('.pdf')) || (currentDoc.nombre_original && currentDoc.nombre_original.toLowerCase().endsWith('.pdf'))"
              :src="formatDocUrl(currentDoc)"
              class="w-full h-full min-h-[460px] rounded-2xl border-0 bg-white"
            ></iframe>
            <img
              v-else
              :src="formatDocUrl(currentDoc)"
              :alt="documentLabels[currentDoc.tipo_documento] || 'Documento'"
              class="max-w-full max-h-[500px] object-contain rounded-2xl shadow-2xl"
            />
          </template>

          <div v-else class="text-slate-500 text-center p-8 space-y-2">
            <Eye :size="48" class="mx-auto opacity-20" />
            <p class="text-xs font-bold">Selecciona un documento de la lista para visualizarlo aquí.</p>
          </div>
        </div>

        <!-- Visor Bottom Info Bar -->
        <div v-if="currentDoc" class="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Archivo: <strong class="text-slate-200 font-mono">{{ currentDoc.nombre_original || currentDoc.url }}</strong></span>
          <span>Estado: <strong class="text-indigo-400 font-bold uppercase">{{ currentDoc.estado }}</strong></span>
        </div>

      </div>

    </div>

  </div>
</template>
