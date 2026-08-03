<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-6 transition-colors duration-500">
    <div class="max-w-7xl mx-auto space-y-6">
      
      <!-- Top Navigation & Header -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <button 
              @click="$router.go(-1)" 
              class="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl transition-all"
              title="Volver"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 class="text-2xl font-black bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-200 bg-clip-text text-transparent">
              🔄 Panel de Gestión de Reingresos Estudiantiles
            </h1>
          </div>
          <p class="text-slate-500 dark:text-slate-400 text-xs font-semibold pl-12">
            Gestión personalizada de la matriz documental y envío de enlaces priorizados para estudiantes retirados.
          </p>
        </div>

        <div v-if="ticketId" class="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-2xl">
          <span>🎟️ Procesando Ticket #{{ ticketId }}</span>
        </div>
      </div>

      <!-- Ticket Context Banner (If opened from a ticket) -->
      <div v-if="ticketContext" class="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 p-5 rounded-3xl space-y-3 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
            <span>📩 Datos de la Solicitud recibida vía Ticket</span>
            <span class="text-xs text-amber-600 dark:text-amber-300/70 font-normal">({{ ticketContext.correo_remitente }})</span>
          </div>
          <span class="px-3 py-1 bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold rounded-xl">
            {{ ticketContext.codigo_ticket || 'TKT-' + ticketContext.id_ticket }}
          </span>
        </div>
        <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p><strong>Remitente:</strong> {{ ticketContext.nombre_remitente }} | <strong>Teléfono:</strong> {{ ticketContext.telefono || 'Sin teléfono' }}</p>
          <p><strong>Asunto:</strong> {{ ticketContext.asunto }}</p>
          <p class="text-slate-500 dark:text-slate-400 italic">"{{ ticketContext.descripcion }}"</p>
        </div>

        <!-- Quick Select Suggested Students -->
        <div v-if="suggestedStudents.length > 0" class="pt-3 border-t border-amber-500/20 flex flex-wrap items-center gap-3">
          <span class="text-xs font-bold text-amber-700 dark:text-amber-400">Estudiantes vinculados al acudiente:</span>
          <button 
            v-for="s in suggestedStudents" 
            :key="s.id_estudiante"
            @click="selectSuggestedStudent(s.id_estudiante)"
            class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>👤 {{ s.nombre }} {{ s.apellido }}</span>
            <span class="text-[10px] opacity-90">({{ s.estado }})</span>
          </button>
        </div>
      </div>

      <!-- Main Grid Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Left Column: Student Selector & Info -->
        <div class="lg:col-span-1 space-y-6">
          
          <!-- Student Search & Selection Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-4">
            <h2 class="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>🔍 Buscar / Seleccionar Estudiante</span>
            </h2>

            <div class="space-y-3">
              <!-- Search filter input -->
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="Filtrar por nombre o documento..."
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-semibold"
              />

              <div class="space-y-1.5">
                <label class="text-xs font-bold text-slate-500 dark:text-slate-400">Seleccionar Alumno de la Lista</label>
                <select 
                  v-model="selectedStudentId" 
                  @change="loadStudentHistory"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                >
                  <option value="" disabled>-- Selecciona un estudiante --</option>
                  <option v-for="s in filteredStudentsList" :key="s.id_estudiante" :value="s.id_estudiante">
                    [{{ s.estado }}] {{ s.apellido }}, {{ s.nombre }} (Doc: {{ s.documento }})
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Student Profile Summary Card -->
          <div v-if="student" class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 class="text-base font-bold text-slate-800 dark:text-slate-200">👤 Expediente del Alumno</h2>
              <span 
                :class="student.estado === 'RETIRADO' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'" 
                class="px-3 py-1 text-xs font-bold border rounded-xl"
              >
                {{ student.estado }}
              </span>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <span class="text-slate-400 block font-semibold">Nombre Completo</span>
                <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">{{ student.nombre }} {{ student.apellido }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <span class="text-slate-400 block font-semibold">Documento</span>
                  <span class="text-slate-700 dark:text-slate-300 font-mono font-bold">{{ student.tipo_documento_nombre || 'DOC' }}: {{ student.documento }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block font-semibold">Código Institucional</span>
                  <span class="text-slate-700 dark:text-slate-300 font-mono font-bold">{{ student.codigo || 'N/A' }}</span>
                </div>
              </div>

              <div v-if="student.motivo_estado" class="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200/60 dark:border-amber-900/60">
                <span class="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider block mb-0.5">Motivo del Retiro</span>
                <p class="text-xs font-semibold text-slate-750 dark:text-slate-300 italic">"{{ student.motivo_estado }}"</p>
              </div>

              <div v-if="lastEnrollment" class="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-750 space-y-1">
                <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Último Registro Escolar</span>
                <p class="text-xs text-slate-700 dark:text-slate-300">
                  Año: <strong>{{ lastEnrollment.anio_lectivo }}</strong> — Nivel: <strong>{{ lastEnrollment.nombre_nivel }}</strong>
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Grupo: {{ lastEnrollment.nombre_grupo || 'Sin asignar' }}</p>
              </div>

              <div v-if="parent" class="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-750 space-y-1">
                <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">Acudiente Registrado</span>
                <p class="text-xs text-slate-700 dark:text-slate-300 font-bold">{{ parent.nombre }} {{ parent.apellido }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">{{ parent.email }}</p>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column: Target Configuration & Document Renewal Matrix Management -->
        <div class="lg:col-span-2 space-y-6">

          <!-- Target Enrollment Configuration (Horizontal Layout at top) -->
          <div v-if="student" class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 class="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>🎯 Configuración de Destino</span>
              </h2>
              <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Parámetros de reingreso y salón asignado</span>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1">Año Lectivo Activo</label>
                <select v-model="targetForm.id_anio" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-slate-800 dark:text-slate-200 font-bold">
                  <option v-for="a in academicYears" :key="a.id_anio" :value="a.id_anio">
                    {{ a.anio }} ({{ a.estado }})
                  </option>
                </select>
              </div>

              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1">Nivel Escolar</label>
                <select v-model="targetForm.id_nivel" @change="onLevelChange" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-slate-800 dark:text-slate-200 font-bold">
                  <option v-for="n in levels" :key="n.id_nivel" :value="n.id_nivel">
                    {{ n.nombre }}
                  </option>
                </select>
              </div>

              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1">Grado Destino</label>
                <select v-model="targetForm.id_tipo_grado" @change="onGradeChange" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-slate-800 dark:text-slate-200 font-bold">
                  <option value="" disabled>-- Selecciona grado --</option>
                  <option v-for="gr in availableGrados" :key="gr.id_tipo_grado" :value="gr.id_tipo_grado">
                    {{ gr.grado_nombre }}
                  </option>
                </select>
              </div>

              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1">Grupo / Salón Asignado</label>
                <select v-model="targetForm.id_grupo" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-slate-800 dark:text-slate-200 font-bold">
                  <option value="" disabled>-- Selecciona grupo --</option>
                  <option v-for="g in availableSections" :key="g.id_grupo" :value="g.id_grupo">
                    {{ g.seccion_nombre }} (Cupos: {{ g.cupos_disponibles }} de {{ g.cupos_totales }})
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1">Correo de Notificación del Acudiente</label>
                <input 
                  type="email" 
                  v-model="targetForm.correo_padre" 
                  placeholder="correo@ejemplo.com"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-slate-800 dark:text-slate-200 font-mono font-bold"
                />
              </div>

              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1">Observaciones para el Acudiente</label>
                <input 
                  type="text" 
                  v-model="targetForm.observaciones" 
                  placeholder="Ej: Reingreso autorizado tras comité académico..."
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-slate-800 dark:text-slate-200 font-semibold"
                />
              </div>
            </div>
          </div>
          <div class="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
            
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>📋 Matriz de Renovación de Documentos</span>
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                  El sistema evaluó la vigencia de los archivos anteriores. Ajusta qué documentos se exigen renovar obligatoriamente.
                </p>
              </div>

              <div v-if="documents.length" class="text-right">
                <span class="text-xs font-bold px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                  {{ validCount }} Vigentes | {{ requiredCount }} A Renovación
                </span>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="py-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
              <svg class="animate-spin h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="font-bold text-xs">Cargando expediente e historial de documentos...</span>
            </div>

            <!-- No Student Selected Prompt -->
            <div v-else-if="!student" class="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-3">
              <div class="text-4xl">🎓</div>
              <p class="text-slate-700 dark:text-slate-200 font-bold text-sm">Selecciona un estudiante para cargar su matriz de documentos</p>
              <p class="text-xs text-slate-400 dark:text-slate-500 font-semibold">Podrás personalizar individualmente qué archivos conservar y cuáles exigir como nuevos.</p>
            </div>

            <!-- Documents Table -->
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead class="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th class="py-3.5 px-4">Documento</th>
                    <th class="py-3.5 px-4">Última Versión</th>
                    <th class="py-3.5 px-4">Sugerencia Sistema</th>
                    <th class="py-3.5 px-4">Estado Exigido por Directivo</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200/60 dark:divide-slate-800">
                  <tr v-for="(doc, idx) in documents" :key="idx" class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td class="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {{ formatDocType(doc.tipo_documento) }}
                    </td>

                    <td class="py-4 px-4 font-mono">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700">v{{ doc.version || 1 }}</span>
                        <a v-if="doc.url && doc.url !== 'PENDIENTE'" :href="formatUrl(doc.url)" target="_blank" class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                          Ver archivo ↗
                        </a>
                        <span v-else class="text-slate-400 italic">No adjunto</span>
                      </div>
                    </td>

                    <td class="py-4 px-4">
                      <span :class="getBadgeClass(doc.estado_renovacion_sugerido)" class="px-2.5 py-1 rounded-xl text-[10px] font-bold inline-block border">
                        {{ doc.estado_renovacion_sugerido }}
                      </span>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">{{ doc.motivo_sugerencia }}</p>
                    </td>

                    <td class="py-4 px-4">
                      <select 
                        v-model="doc.estado_renovacion"
                        class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 font-bold cursor-pointer"
                      >
                        <option value="VIGENTE">✅ VIGENTE (Conservar archivo)</option>
                        <option value="RECOMENDADO_ACTUALIZAR">⚠️ RECOMENDADO ACTUALIZAR</option>
                        <option value="OBLIGATORIO_ACTUALIZAR">❌ OBLIGATORIO ACTUALIZAR</option>
                        <option value="DESACTUALIZADO_POR_FECHA">❌ DESACTUALIZADO POR FECHA</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Submit Action Footer -->
            <div v-if="student" class="pt-6 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Al presionar enviar, la matrícula quedará registrada en estado <span class="text-emerald-600 dark:text-emerald-400 font-bold">PENDIENTE</span> (Tipo: <span class="text-teal-600 dark:text-teal-400 font-bold">REINGRESO</span>) y se enviará el enlace al acudiente.
              </p>
              
              <button 
                @click="submitReingresoLink" 
                :disabled="submitting || !targetForm.id_nivel || !targetForm.id_grupo"
                class="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                <span v-if="submitting">Enviando...</span>
                <span v-else>🚀 Autorizar y Enviar Enlace al Acudiente</span>
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import type { SendReingresoPayload } from '../../types/reingreso.types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const ticketId = ref(route.query.ticketId || null)
const selectedStudentId = ref(route.query.studentId ? Number(route.query.studentId) : '')

const allStudents = ref<any[]>([])
const searchQuery = ref('')
const ticketContext = ref<any>(null)
const suggestedStudents = ref<any[]>([])

const student = ref<any>(null)
const lastEnrollment = ref<any>(null)
const parent = ref<any>(null)
const documents = ref<any[]>([])
const levels = ref<any[]>([])
const groups = ref<any[]>([])
const academicYears = ref<any[]>([])

const loading = ref(false)
const submitting = ref(false)

const targetForm = reactive({
  id_anio: '',
  id_nivel: '',
  id_tipo_grado: '',
  id_grupo: '',
  correo_padre: '',
  observaciones: ''
})

const getAuthHeaders = () => {
  const token = auth.token || localStorage.getItem('token')
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

const availableGrados = computed(() => {
  const map = new Map()
  groups.value.forEach(g => {
    if (g.id_tipo_grado && !map.has(g.id_tipo_grado)) {
      map.set(g.id_tipo_grado, {
        id_tipo_grado: g.id_tipo_grado,
        grado_nombre: g.grado_nombre
      })
    }
  })
  return Array.from(map.values())
})

const availableSections = computed(() => {
  if (!targetForm.id_tipo_grado) return groups.value
  return groups.value.filter(g => g.id_tipo_grado === targetForm.id_tipo_grado)
})

const onLevelChange = async () => {
  targetForm.id_tipo_grado = ''
  targetForm.id_grupo = ''
  await loadGroups()
}

const onGradeChange = () => {
  targetForm.id_grupo = ''
  const sections = availableSections.value
  if (sections.length > 0) {
    targetForm.id_grupo = sections[0].id_grupo
  }
}

const filteredStudentsList = computed(() => {
  if (!searchQuery.value.trim()) return allStudents.value
  const q = searchQuery.value.toLowerCase()
  return allStudents.value.filter((s: any) => 
    s.nombre.toLowerCase().includes(q) ||
    s.apellido.toLowerCase().includes(q) ||
    s.documento.toLowerCase().includes(q) ||
    (s.codigo && s.codigo.toLowerCase().includes(q))
  )
})

const validCount = computed(() => documents.value.filter((d: any) => d.estado_renovacion === 'VIGENTE').length)
const requiredCount = computed(() => documents.value.filter((d: any) => d.estado_renovacion !== 'VIGENTE').length)

onMounted(async () => {
  await fetchAllStudents()
  await fetchCatalogs()
  if (ticketId.value) {
    await loadTicketContext()
  }
  if (selectedStudentId.value) {
    await loadStudentHistory()
  }
})

const fetchAllStudents = async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/student/colegio/' + getSchoolId(), getAuthHeaders())
    const all = res.data || []
    allStudents.value = all.filter((s: any) => s.estado === 'RETIRADO')
  } catch (err) {
    console.error('Error cargando estudiantes:', err)
  }
}

const loadTicketContext = async () => {
  if (!ticketId.value) return
  try {
    const res = await axios.get(`http://localhost:3000/api/reingreso/ticket-context/${ticketId.value}`, getAuthHeaders())
    ticketContext.value = res.data.ticket
    suggestedStudents.value = res.data.suggestedStudents || []
    if (ticketContext.value && ticketContext.value.correo_remitente) {
      targetForm.correo_padre = ticketContext.value.correo_remitente
    }
    if (suggestedStudents.value.length === 1 && !selectedStudentId.value) {
      selectedStudentId.value = Number(suggestedStudents.value[0].id_estudiante)
      await loadStudentHistory()
    }
  } catch (err) {
    console.error('Error cargando contexto del ticket:', err)
  }
}

const selectSuggestedStudent = async (studentId: any) => {
  selectedStudentId.value = Number(studentId)
  await loadStudentHistory()
}

const fetchCatalogs = async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/reingreso/catalogs', getAuthHeaders())
    academicYears.value = res.data.anios || []
    levels.value = res.data.niveles || []
    if (academicYears.value.length > 0) {
      const active = academicYears.value.find(a => a.estado === 'ABIERTO') || academicYears.value[0]
      targetForm.id_anio = active.id_anio
    }
    if (levels.value.length > 0) {
      targetForm.id_nivel = levels.value[0].id_nivel
      await loadGroups()
    }
  } catch (err) {
    console.error('Error cargando catálogos:', err)
  }
}

const loadGroups = async () => {
  if (!targetForm.id_nivel) return
  try {
    const res = await axios.get(`http://localhost:3000/api/reingreso/groups?nivelId=${targetForm.id_nivel}`, getAuthHeaders())
    groups.value = res.data || []
    if (availableGrados.value.length > 0) {
      targetForm.id_tipo_grado = availableGrados.value[0].id_tipo_grado
      onGradeChange()
    }
  } catch (err) {
    console.error('Error cargando grupos:', err)
  }
}

const loadStudentHistory = async () => {
  if (!selectedStudentId.value) return
  loading.value = true
  
  // Reset fields to avoid stale values from previously selected student
  targetForm.correo_padre = ''
  targetForm.observaciones = ''
  targetForm.id_tipo_grado = ''
  targetForm.id_grupo = ''

  try {
    const res = await axios.get(`http://localhost:3000/api/reingreso/student-history/${selectedStudentId.value}`, getAuthHeaders())
    student.value = res.data.student
    lastEnrollment.value = res.data.lastEnrollment
    parent.value = res.data.parent
    documents.value = (res.data.documents || []).map((d: any) => ({
      ...d,
      estado_renovacion: d.estado_renovacion_sugerido || 'VIGENTE'
    }))

    if (parent.value && parent.value.email) {
      targetForm.correo_padre = parent.value.email
    } else if (ticketContext.value && ticketContext.value.correo_remitente) {
      targetForm.correo_padre = ticketContext.value.correo_remitente
    }

    if (lastEnrollment.value && lastEnrollment.value.id_nivel) {
      targetForm.id_nivel = lastEnrollment.value.id_nivel
    }

    await loadGroups()
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al cargar expediente del estudiante')
    student.value = null
  } finally {
    loading.value = false
  }
}

const submitReingresoLink = async () => {
  if (!selectedStudentId.value || !targetForm.id_nivel || !targetForm.id_grupo || !targetForm.correo_padre) {
    alert('Por favor completa todos los campos de configuración obligatorios.')
    return
  }

  submitting.value = true
  try {
    const payload: SendReingresoPayload = {
      id_estudiante: Number(selectedStudentId.value),
      id_nivel: Number(targetForm.id_nivel),
      id_grupo: Number(targetForm.id_grupo),
      id_anio: Number(targetForm.id_anio),
      id_ticket: ticketId.value ? Number(ticketId.value) : null,
      correo_padre: targetForm.correo_padre,
      observaciones: targetForm.observaciones,
      document_config: documents.value.map((d: any) => ({
        tipo_documento: d.tipo_documento,
        estado_renovacion: d.estado_renovacion,
        url: d.url
      }))
    }

    const res = await axios.post('http://localhost:3000/api/reingreso/send-parent-link', payload, getAuthHeaders())
    alert(res.data.message || 'Enlace de reingreso enviado con éxito.')
    router.push('/dashboard/gestion-matriculas')
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al enviar enlace de reingreso')
  } finally {
    submitting.value = false
  }
}

const getSchoolId = () => {
  const user = auth.user || JSON.parse(localStorage.getItem('user') || '{}')
  return user.schoolId || 1
}

const formatDocType = (type: string) => {
  if (!type) return 'Documento'
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str: string) => str.toUpperCase())
}

const formatUrl = (target: any) => {
  if (!target || target === 'PENDIENTE') return '#'
  if (typeof target === 'object' && target.id_documento) {
    return `http://localhost:3000/api/matriculas/documentos/${target.id_documento}/archivo`
  }
  if (typeof target === 'number') {
    return `http://localhost:3000/api/matriculas/documentos/${target}/archivo`
  }
  if (typeof target === 'string') {
    if (target.startsWith('http')) return target
    const found = documents.value?.find((d: any) => d.url === target)
    if (found && found.id_documento) {
      return `http://localhost:3000/api/matriculas/documentos/${found.id_documento}/archivo`
    }
    const filename = target.split(/[\\/]/).pop()
    return `http://localhost:3000/uploads/${filename}`
  }
  return '#'
}

const getBadgeClass = (state: string) => {
  switch (state) {
    case 'VIGENTE': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'RECOMENDADO_ACTUALIZAR': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
    case 'OBLIGATORIO_ACTUALIZAR': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
    case 'DESACTUALIZADO_POR_FECHA': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}
</script>
