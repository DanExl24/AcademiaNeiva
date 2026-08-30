<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, 
  Sparkles, 
  Send, 
  Mail, 
  User, 
  Phone, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  GraduationCap,
  Info,
  XCircle,
  Ban,
  ArrowRight
} from 'lucide-vue-next'
import { supportService } from '../../services/supportService'
import { studentService } from '../../services/studentService'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const auth = useAuthStore()
const notify = useNotificationStore()

const loading = ref(false)
const studentMode = ref<'NUEVO' | 'EXISTENTE'>('NUEVO')
const parentName = ref('')
const parentEmail = ref('')
const parentPhone = ref('')
const reason = ref('')
const observations = ref('')

// Existing students search
const schoolStudents = ref<any[]>([])
const loadingStudents = ref(false)
const studentSearchQuery = ref('')
const selectedStudentId = ref<number | null>(null)

const schoolId = computed(() => Number(auth.user?.schoolId || auth.selectedSchoolId || 1))

// Solo registros INACTIVOS son elegibles en extraordinaria. Los RETIRADOS van al Módulo de Reingreso.
const isStudentEligible = (student: any) => {
  const st = (student.estado || student.estado_vigente || '').toUpperCase()
  return st === 'INACTIVO'
}

const getStudentStatusBadge = (student: any) => {
  const st = (student.estado || student.estado_vigente || 'INACTIVO').toUpperCase()
  if (st === 'RETIRADO') {
    return { label: 'Retirado (Ir a Reingreso)', class: 'bg-amber-100 text-amber-800 border-amber-300', eligible: false, reason: 'Debe tramitarse en el Módulo de Reingreso' }
  }
  if (st === 'INACTIVO') {
    return { label: 'Inactivo', class: 'bg-slate-100 text-slate-700 border-slate-300', eligible: true }
  }
  if (st === 'ACTIVO') {
    return { label: 'Activo (No elegible)', class: 'bg-emerald-100 text-emerald-800 border-emerald-300', eligible: false, reason: 'Ya tiene matrícula activa' }
  }
  if (st === 'SANCIONADO') {
    return { label: 'Sancionado (No elegible)', class: 'bg-rose-100 text-rose-800 border-rose-300', eligible: false, reason: 'Sanción disciplinaria vigente' }
  }
  if (st === 'EXPULSADO') {
    return { label: 'Expulsado (Inhabilitado)', class: 'bg-red-100 text-red-800 border-red-300', eligible: false, reason: 'Inhabilitado permanentemente' }
  }
  if (st === 'GRADUADO') {
    return { label: 'Graduado (No elegible)', class: 'bg-purple-100 text-purple-800 border-purple-300', eligible: false, reason: 'Ciclo culminado' }
  }
  return { label: st, class: 'bg-slate-100 text-slate-700 border-slate-300', eligible: false, reason: 'Estado no elegible' }
}

const filteredStudents = computed(() => {
  if (!studentSearchQuery.value.trim()) return schoolStudents.value.slice(0, 10)
  const q = studentSearchQuery.value.toLowerCase()
  return schoolStudents.value
    .filter(s => 
      (s.nombre && s.nombre.toLowerCase().includes(q)) ||
      (s.apellido && s.apellido.toLowerCase().includes(q)) ||
      (s.documento && s.documento.toLowerCase().includes(q)) ||
      (s.numero_documento && s.numero_documento.toLowerCase().includes(q))
    )
    .slice(0, 15)
})

const selectedStudent = computed(() => {
  return schoolStudents.value.find(s => s.id_estudiante === selectedStudentId.value) || null
})

const fetchStudents = async () => {
  if (schoolStudents.value.length > 0 || !schoolId.value) return
  loadingStudents.value = true
  try {
    const data = await studentService.getStudentsBySchool(schoolId.value)
    schoolStudents.value = data || []
  } catch (err) {
    console.error('Error al cargar estudiantes del colegio:', err)
  } finally {
    loadingStudents.value = false
  }
}

watch(() => studentMode.value, (newMode) => {
  if (newMode === 'EXISTENTE') {
    fetchStudents()
  } else {
    selectedStudentId.value = null
    studentSearchQuery.value = ''
  }
})

watch(() => props.isOpen, (open) => {
  if (open) {
    studentMode.value = 'NUEVO'
    parentName.value = ''
    parentEmail.value = ''
    parentPhone.value = ''
    reason.value = ''
    observations.value = ''
    selectedStudentId.value = null
    studentSearchQuery.value = ''
  }
})

const selectStudent = (student: any) => {
  const st = (student.estado || student.estado_vigente || '').toUpperCase()
  if (st === 'RETIRADO') {
    notify.addNotification('Este estudiante está RETIRADO. Para conservar su historial y matriz documental, su cupo debe gestionarse a través del Módulo de Reingreso.', 'warning')
    return
  }

  if (!isStudentEligible(student)) {
    const badge = getStudentStatusBadge(student)
    notify.addNotification(`El estudiante se encuentra ${badge.label}. Solo estudiantes en estado INACTIVO (sin matrícula activa) pueden seleccionarse aquí.`, 'warning')
    return
  }

  selectedStudentId.value = student.id_estudiante
  const doc = student.documento || student.numero_documento || ''
  studentSearchQuery.value = doc 
    ? `${student.nombre} ${student.apellido} (${doc})` 
    : `${student.nombre} ${student.apellido}`

  // Rellenar automáticamente los campos del acudiente / padre de familia
  const acudienteNombre = [student.acudiente_nombre, student.acudiente_apellido].filter(Boolean).join(' ') || student.nombre_acudiente || ''
  if (acudienteNombre) {
    parentName.value = acudienteNombre
  }

  const acudienteCorreo = student.acudiente_email || student.correo_acudiente || student.email || ''
  if (acudienteCorreo) {
    parentEmail.value = acudienteCorreo
  }

  const acudienteTel = student.acudiente_telefono || student.telefono_acudiente || student.telefono || ''
  if (acudienteTel) {
    parentPhone.value = acudienteTel
  }
}

const clearSelectedStudent = () => {
  selectedStudentId.value = null
  studentSearchQuery.value = ''
}

const handleSubmit = async () => {
  if (!parentEmail.value || !parentEmail.value.includes('@')) {
    notify.addNotification('Por favor ingresa un correo electrónico válido para el acudiente.', 'error')
    return
  }

  if (!reason.value.trim()) {
    notify.addNotification('Por favor describe el motivo de la autorización extraordinaria.', 'error')
    return
  }

  if (studentMode.value === 'EXISTENTE' && !selectedStudentId.value) {
    notify.addNotification('Por favor busca y selecciona un estudiante existente en estado Inactivo.', 'error')
    return
  }

  loading.value = true
  try {
    const payload = {
      nombre_acudiente: parentName.value.trim(),
      correo_padre: parentEmail.value.trim(),
      telefono: parentPhone.value.trim() || undefined,
      id_estudiante: studentMode.value === 'EXISTENTE' ? selectedStudentId.value : null,
      motivo: reason.value.trim(),
      observaciones: observations.value.trim() || undefined
    }

    const res = await supportService.authorizeExtraordinaryEnrollment(payload)
    notify.addNotification(res.message || 'Matrícula extraordinaria autorizada exitosamente. Enlace enviado al acudiente.', 'success')
    emit('success')
    emit('close')
  } catch (err: any) {
    const msg = err.response?.data?.error || 'Error autorizando matrícula extraordinaria'
    notify.addNotification(msg, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200 text-left">
      
      <!-- Header -->
      <div class="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
            <Sparkles :size="20" />
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Autorizar Matrícula Extraordinaria</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Emisión de cupo excepcional fuera del calendario ordinario</p>
          </div>
        </div>
        <button 
          @click="emit('close')" 
          class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
        
        <!-- Info Banner -->
        <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3">
          <AlertTriangle :size="18" class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div class="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
            <p class="font-bold">Trámite de Excepción Institucional</p>
            <p class="mt-0.5 text-[11px] opacity-90">
              Se creará un registro previo en estado <span class="font-black">Pendiente</span> y se enviará un enlace de radicación con bypass de calendario al correo del acudiente.
            </p>
          </div>
        </div>

        <!-- Student Mode Selector -->
        <div>
          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Tipo de Estudiante
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="studentMode = 'NUEVO'"
              :class="[
                'p-3.5 rounded-2xl border text-left font-bold text-xs transition-all flex items-center gap-3 cursor-pointer',
                studentMode === 'NUEVO'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
              ]"
            >
              <User :size="18" />
              <div>
                <p class="font-black">Nuevo Ingreso</p>
                <p class="text-[10px] font-normal opacity-80">Aspirante por primera vez</p>
              </div>
            </button>

            <button
              type="button"
              @click="studentMode = 'EXISTENTE'"
              :class="[
                'p-3.5 rounded-2xl border text-left font-bold text-xs transition-all flex items-center gap-3 cursor-pointer',
                studentMode === 'EXISTENTE'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
              ]"
            >
              <GraduationCap :size="18" />
              <div>
                <p class="font-black">Estudiante Inactivo</p>
                <p class="text-[10px] font-normal opacity-80">Sin matrícula activa</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Student Search & Eligibility Card (Only if EXISTENTE) -->
        <div v-if="studentMode === 'EXISTENTE'" class="space-y-3">
          
          <!-- Criterios de Elegibilidad -->
          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div class="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-200">
              <Info :size="14" class="text-indigo-600 dark:text-indigo-400" />
              <span>Criterios de Elegibilidad:</span>
            </div>
            <div class="space-y-1.5 text-[11px]">
              <div class="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 :size="13" class="shrink-0 mt-0.5" />
                <span><strong>Permitido aquí:</strong> Registro en estado <span class="font-black">INACTIVO</span> (sin matrícula formal previa en el año).</span>
              </div>
              <div class="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                <ArrowRight :size="13" class="shrink-0 mt-0.5" />
                <span><strong>Estudiantes RETIRADOS:</strong> Deben gestionarse en el <router-link to="/dashboard/reingreso" class="underline font-black hover:text-amber-950 dark:hover:text-white">Módulo de Reingreso</router-link> para auditar el motivo de retiro y aplicar su matriz documental.</span>
              </div>
              <div class="flex items-start gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                <XCircle :size="13" class="shrink-0 mt-0.5" />
                <span><strong>Bloqueados:</strong> Activo (ya matriculado), Sancionado, Expulsado o Graduado.</span>
              </div>
            </div>
          </div>

          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Buscar Estudiante Inactivo *
          </label>
          <div class="relative">
            <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              v-model="studentSearchQuery"
              type="text" 
              placeholder="Escribe el nombre o documento del estudiante..."
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <!-- Dropdown suggestions with Badges -->
          <div 
            v-if="filteredStudents.length > 0 && !selectedStudentId" 
            class="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-md divide-y divide-slate-100 dark:divide-slate-700"
          >
            <div 
              v-for="s in filteredStudents" 
              :key="s.id_estudiante"
              @click="selectStudent(s)"
              :class="[
                'p-2.5 flex items-center justify-between text-xs transition-colors',
                isStudentEligible(s) 
                  ? 'hover:bg-indigo-50 dark:hover:bg-slate-700/60 cursor-pointer' 
                  : 'bg-slate-50/70 dark:bg-slate-800/50 opacity-60 cursor-not-allowed select-none'
              ]"
            >
              <div>
                <span class="font-bold text-slate-800 dark:text-slate-200">{{ s.nombre }} {{ s.apellido }}</span>
                <span class="text-[10px] text-slate-400 font-mono block">Doc: {{ s.documento || s.numero_documento || 'S/D' }}</span>
              </div>
              
              <div class="flex items-center gap-2">
                <span 
                  :class="[
                    'px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider',
                    getStudentStatusBadge(s).class
                  ]"
                >
                  {{ getStudentStatusBadge(s).label }}
                </span>
                <Ban v-if="!isStudentEligible(s)" :size="12" class="text-rose-500" />
              </div>
            </div>
          </div>

          <!-- Selected Student Preview -->
          <div v-if="selectedStudent" class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs flex items-center justify-between font-bold">
            <div class="flex items-center gap-2">
              <CheckCircle2 :size="16" class="text-emerald-600" />
              <div>
                <p class="text-xs font-black">{{ selectedStudent.nombre }} {{ selectedStudent.apellido }}</p>
                <p class="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                  Estado: <strong class="uppercase">{{ selectedStudent.estado || 'INACTIVO' }}</strong> · Doc: {{ selectedStudent.documento || selectedStudent.numero_documento || 'S/D' }}
                </p>
              </div>
            </div>
            <button type="button" @click="clearSelectedStudent" class="text-[10px] underline hover:text-emerald-950 dark:hover:text-white cursor-pointer font-black">
              Cambiar
            </button>
          </div>
        </div>

        <!-- Acudiente Fields -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nombre del Acudiente
            </label>
            <div class="relative">
              <User :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                v-model="parentName"
                type="text"
                placeholder="Nombre completo del acudiente"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Correo Electrónico del Acudiente *
            </label>
            <div class="relative">
              <Mail :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                v-model="parentEmail"
                type="email"
                required
                placeholder="correo@ejemplo.com"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <!-- Phone Field -->
        <div>
          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Teléfono de Contacto
          </label>
          <div class="relative">
            <Phone :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              v-model="parentPhone"
              type="tel"
              placeholder="Ej. +57 300 123 4567"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <!-- Reason -->
        <div>
          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Motivo de la Excepción *
          </label>
          <textarea
            v-model="reason"
            rows="2"
            required
            placeholder="Describe la justificación de la matrícula extraordinaria..."
            class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          ></textarea>
        </div>

        <!-- Internal Observations -->
        <div>
          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Observaciones Internas de Secretaría (Opcional)
          </label>
          <textarea
            v-model="observations"
            rows="2"
            placeholder="Notas administrativas para control de secretaría..."
            class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            @click="emit('close')"
            :disabled="loading"
            class="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            :disabled="loading || !parentEmail || !reason.trim() || (studentMode === 'EXISTENTE' && !selectedStudentId)"
            class="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            <Send v-if="!loading" :size="14" />
            <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>{{ loading ? 'Autorizando...' : 'Autorizar y Enviar Enlace' }}</span>
          </button>
        </div>

      </form>
    </div>
  </div>
</template>
