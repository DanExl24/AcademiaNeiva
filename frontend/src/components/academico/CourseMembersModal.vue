<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  X, Search, GraduationCap, Users, Mail 
} from 'lucide-vue-next'
import { useAcademicYearStore } from '../../stores/academicYear'
import { getCourseDisplayName } from '../../utils/courseHelper'

interface MemberStudent {
  id_estudiante: number
  nombre: string
  apellido: string
  codigo_estudiantil: string
  documento: string
  tipo_documento: string
  estado_matricula: string
  tipo_matricula: string
  email: string
}

interface MemberTeacher {
  id_detallegrado: number
  id_materia: number
  materia_nombre: string
  id_docente: number
  docente_nombre: string
  docente_apellido: string
  docente_documento: string
  docente_email: string
}

interface GroupDetails {
  group: {
    id_grupo: number
    cupos_totales: number
    nivel_nombre: string
    tipo_grado_nombre: string
    jornada_nombre: string
    seccion_nombre: string
  }
  students: MemberStudent[]
  teachers: MemberTeacher[]
}

const props = defineProps<{
  show: boolean
  loading: boolean
  membersData: GroupDetails | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const yearStore = useAcademicYearStore()
const activeTab = ref<'students' | 'teachers'>('students')
const searchTerm = ref('')

const filteredStudents = computed(() => {
  if (!props.membersData?.students) return []
  const q = searchTerm.value.toLowerCase().trim()
  if (!q) return props.membersData.students
  return props.membersData.students.filter(s =>
    `${s.nombre} ${s.apellido}`.toLowerCase().includes(q) ||
    (s.codigo_estudiantil && s.codigo_estudiantil.toLowerCase().includes(q)) ||
    (s.documento && s.documento.toLowerCase().includes(q))
  )
})

const filteredTeachers = computed(() => {
  if (!props.membersData?.teachers) return []
  const q = searchTerm.value.toLowerCase().trim()
  if (!q) return props.membersData.teachers
  return props.membersData.teachers.filter(t =>
    `${t.docente_nombre} ${t.docente_apellido}`.toLowerCase().includes(q) ||
    t.materia_nombre.toLowerCase().includes(q)
  )
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="emit('close')"></div>
      <div class="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <!-- Modal Header -->
        <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-blue-700 dark:from-indigo-950 dark:to-slate-900 flex items-center justify-between text-white">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-xl font-black uppercase tracking-tight">
                {{ membersData ? getCourseDisplayName(membersData.group) : 'Cargando...' }}
              </h2>
              <span v-if="membersData" class="px-3 py-0.5 bg-white/20 dark:bg-white/10 rounded-full text-[10px] font-black uppercase tracking-wider">
                {{ membersData.group.jornada_nombre }} | {{ membersData.group.nivel_nombre }}
              </span>
            </div>
            <p class="text-xs text-indigo-100 dark:text-slate-400 font-medium mt-1">
              Integrantes registrados en el curso para el Año Lectivo {{ yearStore.selectedYear?.calendario }}
            </p>
          </div>
          <button @click="emit('close')" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
            <X :size="20" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          
          <!-- Loading State -->
          <div v-if="loading" class="py-16 flex flex-col items-center justify-center text-slate-400 font-bold">
            <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            Cargando estudiantes y docentes del curso...
          </div>

          <template v-else-if="membersData">
            <!-- Tab Controls & Search -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl w-full sm:w-auto">
                <button
                  @click="activeTab = 'students'"
                  :class="[
                    activeTab === 'students' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                    'flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wide'
                  ]"
                >
                  <GraduationCap :size="16" />
                  Estudiantes ({{ membersData.students.length }})
                </button>
                <button
                  @click="activeTab = 'teachers'"
                  :class="[
                    activeTab === 'teachers' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                    'flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wide'
                  ]"
                >
                  <Users :size="16" />
                  Docentes & Materias ({{ membersData.teachers.length }})
                </button>
              </div>

              <div class="relative w-full sm:w-64">
                <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
                <input
                  v-model="searchTerm"
                  type="text"
                  :placeholder="activeTab === 'students' ? 'Buscar estudiante...' : 'Buscar materia o docente...'"
                  class="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            <!-- TAB 1: STUDENTS -->
            <div v-if="activeTab === 'students'" class="space-y-3">
              <div v-if="filteredStudents.length === 0" class="py-12 text-center text-slate-400">
                <GraduationCap :size="48" class="mx-auto mb-3 opacity-20" />
                <p class="font-bold text-sm">No hay estudiantes matriculados en este curso.</p>
              </div>

              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  v-for="st in filteredStudents"
                  :key="st.id_estudiante"
                  class="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                >
                  <div class="h-11 w-11 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                    {{ st.nombre.charAt(0) }}{{ st.apellido.charAt(0) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4 class="font-black text-slate-900 dark:text-white text-sm truncate">{{ st.nombre }} {{ st.apellido }}</h4>
                    <p class="text-[10px] font-bold text-slate-400 truncate">
                      <span v-if="st.codigo_estudiantil" class="text-indigo-600 dark:text-indigo-400 font-black">{{ st.codigo_estudiantil }}</span>
                      <span v-if="st.codigo_estudiantil && st.documento"> • </span>
                      <span v-if="st.documento">{{ st.tipo_documento || 'DOC' }}: {{ st.documento }}</span>
                    </p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md text-[9px] font-black uppercase">
                        {{ st.estado_matricula || 'APROBADA' }}
                      </span>
                      <span v-if="st.tipo_matricula" class="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-md text-[9px] font-black uppercase">
                        {{ st.tipo_matricula }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 2: TEACHERS -->
            <div v-if="activeTab === 'teachers'" class="space-y-3">
              <div v-if="filteredTeachers.length === 0" class="py-12 text-center text-slate-400">
                <Users :size="48" class="mx-auto mb-3 opacity-20" />
                <p class="font-bold text-sm">No hay docentes asignados a materias en este curso.</p>
              </div>

              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  v-for="tc in filteredTeachers"
                  :key="tc.id_detallegrado"
                  class="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                >
                  <div class="flex items-center justify-between">
                    <span class="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-wide">
                      {{ tc.materia_nombre }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="h-10 w-10 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                      {{ tc.docente_nombre.charAt(0) }}{{ tc.docente_apellido.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <h5 class="font-black text-slate-900 dark:text-white text-xs truncate">{{ tc.docente_nombre }} {{ tc.docente_apellido }}</h5>
                      <p v-if="tc.docente_email" class="text-[10px] font-medium text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <Mail :size="10" /> {{ tc.docente_email }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
