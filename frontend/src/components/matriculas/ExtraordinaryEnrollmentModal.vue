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
  GraduationCap 
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
    notify.addNotification('Por favor busca y selecciona el estudiante existente.', 'error')
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
    console.error('Error autorizando matrícula extraordinaria:', err)
    notify.addNotification(err.response?.data?.error || 'Error al autorizar la matrícula extraordinaria.', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div 
    v-if="isOpen" 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
  >
    <div 
      class="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
            <Sparkles :size="22" />
          </div>
          <div>
            <h2 class="text-xl font-black text-slate-800 dark:text-white tracking-tight">
              Crear Matrícula Extraordinaria
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Autorización excepcional fuera del período ordinario de inscripciones
            </p>
          </div>
        </div>

        <button 
          @click="emit('close')"
          class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Body Form -->
      <form @submit.prevent="handleSubmit" class="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
        <!-- Notice Banner -->
        <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 flex gap-3 text-xs leading-relaxed">
          <AlertTriangle :size="18" class="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p class="font-bold">Proceso Extraordinario Sincronizado</p>
            <p class="mt-0.5 text-amber-800 dark:text-amber-300">
              Al autorizar esta matrícula, el sistema generará un token único y le enviará un correo directo al acudiente para que complete el formulario oficial.
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
                'p-3.5 rounded-2xl border text-left font-bold text-xs transition-all flex items-center gap-3',
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
                'p-3.5 rounded-2xl border text-left font-bold text-xs transition-all flex items-center gap-3',
                studentMode === 'EXISTENTE'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
              ]"
            >
              <GraduationCap :size="18" />
              <div>
                <p class="font-black">Estudiante Existente</p>
                <p class="text-[10px] font-normal opacity-80">Registrado en la institución</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Student Search (Only if EXISTENTE) -->
        <div v-if="studentMode === 'EXISTENTE'" class="space-y-2">
          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Buscar Estudiante Existente *
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

          <!-- Dropdown suggestions -->
          <div 
            v-if="filteredStudents.length > 0 && !selectedStudentId" 
            class="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-md divide-y divide-slate-100 dark:divide-slate-700"
          >
            <div 
              v-for="s in filteredStudents" 
              :key="s.id_estudiante"
              @click="selectStudent(s)"
              class="p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between text-xs"
            >
              <span class="font-bold text-slate-800 dark:text-slate-200">{{ s.nombre }} {{ s.apellido }}</span>
              <span class="text-[10px] text-slate-400 font-mono">Doc: {{ s.documento || s.numero_documento || 'S/D' }}</span>
            </div>
          </div>

          <div v-if="selectedStudent" class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between font-bold">
            <span class="flex items-center gap-1.5">
              <CheckCircle2 :size="15" />
              Estudiante seleccionado: {{ selectedStudent.nombre }} {{ selectedStudent.apellido }}
            </span>
            <button type="button" @click="clearSelectedStudent" class="text-[10px] underline hover:text-emerald-950 dark:hover:text-white cursor-pointer">Cambiar</button>
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
            Teléfono (Opcional)
          </label>
          <div class="relative">
            <Phone :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              v-model="parentPhone"
              type="tel"
              placeholder="3001234567"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <!-- Motivo -->
        <div>
          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Motivo de la Autorización Extraordinaria *
          </label>
          <input 
            v-model="reason"
            type="text"
            required
            placeholder="Ej: Traslado de ciudad extemporáneo, calamidad doméstica, cupo asignado por rectoría"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <!-- Observaciones -->
        <div>
          <label class="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Observaciones o Instrucciones Especiales
          </label>
          <textarea 
            v-model="observations"
            rows="2"
            placeholder="Notas internas para el expediente de la matrícula..."
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          ></textarea>
        </div>

        <!-- Footer Actions -->
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button 
            type="button" 
            @click="emit('close')"
            class="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button 
            type="submit"
            :disabled="loading"
            class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Send v-if="!loading" :size="15" />
            <div v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>{{ loading ? 'Autorizando...' : 'Autorizar y Enviar Enlace' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 9999px;
}
</style>
