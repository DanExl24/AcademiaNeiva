<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  BookOpen, 
  Users, 
  ChevronRight, 
  LayoutGrid,
  GraduationCap,
  ClipboardList,
  SlidersHorizontal,
  X,
  Hash,
  FileText
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { watch } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { getCourseDisplayName } from '../../utils/courseHelper'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const router = useRouter()
const viewMode = ref('grades') // 'grades' o 'subjects'
const loading = ref(true)
const rawData = ref([])

// Filtros reactivos
const selectedGrade = ref('')
const selectedJornada = ref('')
const searchQuery = ref('')

interface AcademicGroup {
  id_grado: number
  grado_nombre: string
  nivel: string
  seccion: string
  jornada_nombre: string
  id_materia: number
  materia_nombre: string
}

const fetchCourses = async () => {
  try {
    loading.value = true
    const userId = auth.isMonitoring
      ? auth.monitoringUser?.id
      : (auth.user?.id_usuario || auth.user?.id)
    
    if (!userId) {
      return
    }
    
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const response = await axios.get(`/api/teacher/courses/${userId}`, { params })
    rawData.value = response.data
  } catch (error: any) {
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchCourses()
})

watch(() => yearStore.selectedYearId, fetchCourses)

// Extraer grados únicos para el filtro
const uniqueGrades = computed(() => {
  const grades = rawData.value.map((item: AcademicGroup) => item.grado_nombre)
  return [...new Set(grades)].sort()
})

// Extraer jornadas únicas para el filtro
const uniqueJornadas = computed(() => {
  const jornadas = rawData.value.map((item: AcademicGroup) => item.jornada_nombre)
  return [...new Set(jornadas)].filter(Boolean).sort()
})

// Filtrar rawData antes de agrupar
const filteredRawData = computed(() => {
  return rawData.value.filter((item: AcademicGroup) => {
    const matchesGrade = !selectedGrade.value || item.grado_nombre === selectedGrade.value
    const matchesJornada = !selectedJornada.value || item.jornada_nombre === selectedJornada.value
    const matchesSearch = !searchQuery.value || 
      item.grado_nombre.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.materia_nombre.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesGrade && matchesJornada && matchesSearch
  })
})

// Agrupación por Grados (separados por id_grado que es el id_grupo único)
const groupedByGrades = computed(() => {
  const groups: Record<string, any> = {}
  filteredRawData.value.forEach((item: AcademicGroup) => {
    const key = String(item.id_grado)
    if (!groups[key]) {
      groups[key] = {
        id_grado: item.id_grado,
        nombre: item.grado_nombre,
        seccion: item.seccion,
        nivel: item.nivel,
        jornada: item.jornada_nombre,
        materias: []
      }
    }
    if (!groups[key].materias.some((m: any) => m.id === item.id_materia)) {
      groups[key].materias.push({
        id: item.id_materia,
        nombre: item.materia_nombre
      })
    }
  })
  return Object.values(groups)
})

// Agrupación por Materias
const groupedBySubjects = computed(() => {
  const groups: Record<string, any> = {}
  filteredRawData.value.forEach((item: AcademicGroup) => {
    if (!groups[item.materia_nombre]) {
      groups[item.materia_nombre] = {
        nombre: item.materia_nombre,
        cursos: []
      }
    }
    if (!groups[item.materia_nombre].cursos.some((c: any) => c.id_grado === item.id_grado)) {
      groups[item.materia_nombre].cursos.push({
        id_grado: item.id_grado,
        nombre: getCourseDisplayName({ grado_nombre: item.grado_nombre, seccion_nombre: item.seccion }),
        jornada: item.jornada_nombre
      })
    }
  })
  return Object.values(groups)
})

const clearFilters = () => {
  selectedGrade.value = ''
  selectedJornada.value = ''
  searchQuery.value = ''
}

const getJornadaColorClass = (jornada: string) => {
  const norm = String(jornada || '').toUpperCase()
  if (norm.includes('MAÑANA') || norm.includes('MANANA')) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  if (norm.includes('TARDE')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }
  if (norm.includes('UNICA') || norm.includes('ÚNICA')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

const navigateToGrades = (gradoId: number) => {
  router.push({ name: 'teacher-grades', query: { gradoId } })
}

// --- Modal Ver Alumnos ---
const showStudentsModal = ref(false)
const studentsModalTitle = ref('')
const studentsLoading = ref(false)
const studentsList = ref<any[]>([])

const openStudentsModal = async (group: any) => {
  studentsModalTitle.value = `${getCourseDisplayName({ grado_nombre: group.nombre, seccion_nombre: group.seccion })} — ${group.jornada || ''}`
  showStudentsModal.value = true
  studentsLoading.value = true
  studentsList.value = []
  try {
    const response = await axios.get(`/api/teacher/students/${group.id_grado}`)
    studentsList.value = response.data
    console.log('[TeacherCourses] openStudentsModal OK:', studentsList.value.length, 'for gradeId', group.id_grado)
  } catch (error: any) {
    console.error('[TeacherCourses] openStudentsModal error:', error?.response?.data || error?.message || error)
  } finally {
    studentsLoading.value = false
  }
}

const closeStudentsModal = () => {
  showStudentsModal.value = false
  studentsList.value = []
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Mis Cursos y Materias</h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1">Gestiona tu carga académica y estudiantes</p>
      </div>
      
      <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button 
          @click="viewMode = 'grades'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 font-medium"
          :class="viewMode === 'grades' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
        >
          <LayoutGrid class="w-4 h-4" />
          Por Grado
        </button>
        <button 
          @click="viewMode = 'subjects'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 font-medium"
          :class="viewMode === 'subjects' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
        >
          <BookOpen class="w-4 h-4" />
          Por Materia
        </button>
      </div>
    </div>

    <!-- Barra de Filtros -->
    <div v-if="rawData.length > 0" class="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between transition-colors">
      <div class="flex flex-col sm:flex-row flex-wrap gap-4 items-center w-full md:w-auto">
        <!-- Buscador -->
        <div class="relative w-full sm:w-64">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Buscar por grado o materia..." 
            class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300"
          />
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>

        <!-- Filtro por Grado -->
        <div class="relative w-full sm:w-48">
          <select 
            v-model="selectedGrade"
            class="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300 cursor-pointer"
          >
            <option value="">Todos los Grados</option>
            <option v-for="g in uniqueGrades" :key="g" :value="g">{{ g }}</option>
          </select>
          <div class="absolute right-3.5 top-3.5 pointer-events-none text-slate-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>

        <!-- Filtro por Jornada -->
        <div class="relative w-full sm:w-48">
          <select 
            v-model="selectedJornada"
            class="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300 cursor-pointer"
          >
            <option value="">Todas las Jornadas</option>
            <option v-for="j in uniqueJornadas" :key="j" :value="j">{{ j }}</option>
          </select>
          <div class="absolute right-3.5 top-3.5 pointer-events-none text-slate-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
      </div>

      <!-- Limpiar filtros -->
      <button 
        v-if="selectedGrade || selectedJornada || searchQuery"
        @click="clearFilters"
        class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 shrink-0"
      >
        Limpiar Filtros
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium italic">Cargando tu información académica...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="rawData.length === 0" class="bg-white dark:bg-slate-900 p-12 rounded-3xl text-center border border-dashed border-slate-300 dark:border-slate-700 transition-colors">
      <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
        <GraduationCap class="w-10 h-10 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-900 dark:text-white">No tienes cursos asignados</h3>
      <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">Parece que aún no tienes carga académica registrada en este colegio. Contacta a coordinación.</p>
    </div>

    <!-- No results from search/filters -->
    <div v-else-if="groupedByGrades.length === 0 && groupedBySubjects.length === 0" class="bg-white dark:bg-slate-900 p-12 rounded-3xl text-center border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
      <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
        <SlidersHorizontal class="w-10 h-10 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-900 dark:text-white">Sin resultados</h3>
      <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">Prueba ajustando los filtros de búsqueda.</p>
    </div>

    <!-- Content: By Grade -->
    <div v-else-if="viewMode === 'grades'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="group in groupedByGrades" 
        :key="group.id_grado"
        class="group bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 overflow-hidden relative"
      >
        <!-- Background Accent -->
        <div class="absolute -right-8 -top-8 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
        
        <div class="relative">
          <div class="flex items-start justify-between mb-6">
            <div class="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <span class="text-xl font-black">{{ group.nombre[0] }}</span>
            </div>
            <div class="flex flex-col items-end gap-1.5">
              <span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold tracking-wider rounded-full uppercase">{{ group.nivel }}</span>
              <span 
                v-if="group.jornada" 
                class="px-2.5 py-0.5 border text-[9px] font-black tracking-wider rounded-full uppercase transition-all duration-300"
                :class="getJornadaColorClass(group.jornada)"
              >
                {{ group.jornada }}
              </span>
            </div>
          </div>

          <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-1">{{ getCourseDisplayName({ grado_nombre: group.nombre, seccion_nombre: group.seccion }) }}</h3>
          
          <div class="space-y-4 mt-6">
            <div v-for="materia in group.materias" :key="materia.id" class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 group/item hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-100 dark:hover:border-indigo-800 transition-colors duration-300">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 bg-indigo-400 rounded-full group-hover/item:scale-150 transition-transform"></div>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ materia.nombre }}</span>
              </div>
              <ChevronRight class="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover/item:text-indigo-400 transition-colors" />
            </div>
          </div>

          <div class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button 
              @click="openStudentsModal(group)"
              class="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-lg"
            >
              <Users class="w-4 h-4" />
              Ver Alumnos
            </button>
            <button 
              @click="navigateToGrades(group.id_grado)"
              class="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-md shadow-indigo-100 dark:shadow-none active:scale-95 transition-all"
            >
              <ClipboardList class="w-4 h-4" />
              Calificar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content: By Subject -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div 
        v-for="subject in groupedBySubjects" 
        :key="subject.nombre"
        class="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-8 hover:shadow-lg transition-all duration-500"
      >
        <div class="w-20 h-20 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-3xl flex items-center justify-center shrink-0 shadow-inner">
          <BookOpen class="w-10 h-10" />
        </div>
        
        <div class="flex-1">
          <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-6">{{ subject.nombre }}</h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div 
              v-for="curso in subject.cursos" 
              :key="curso.id_grado"
              @click="navigateToGrades(curso.id_grado)"
              class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-100 dark:hover:border-teal-800 transition-all duration-300 cursor-pointer group"
            >
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ curso.nombre }}</span>
                  <span 
                    v-if="curso.jornada" 
                    class="text-[9px] font-black tracking-wider rounded-full uppercase mt-1.5 px-2 py-0.5 border w-fit"
                    :class="getJornadaColorClass(curso.jornada)"
                  >
                    {{ curso.jornada }}
                  </span>
                </div>
                <ChevronRight class="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-1 group-hover:text-teal-500 transition-all" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  <!-- Modal: Ver Alumnos -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="showStudentsModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeStudentsModal"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>

        <!-- Modal Panel -->
        <div class="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border dark:border-slate-800">
          <!-- Header -->
          <div class="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Users class="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 class="text-lg font-black text-white leading-tight">Lista de Alumnos</h2>
                <p class="text-indigo-200 text-xs font-medium mt-0.5">{{ studentsModalTitle }}</p>
              </div>
            </div>
            <button
              @click="closeStudentsModal"
              class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
            >
              <X class="w-5 h-5 text-white" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto dark:bg-slate-900">
            <!-- Loading -->
            <div v-if="studentsLoading" class="flex flex-col items-center justify-center py-16">
              <div class="w-10 h-10 border-4 border-indigo-100 dark:border-slate-800 border-t-indigo-600 rounded-full animate-spin"></div>
              <p class="mt-4 text-slate-400 dark:text-slate-500 text-sm font-medium">Cargando alumnos...</p>
            </div>

            <!-- Empty -->
            <div v-else-if="studentsList.length === 0" class="flex flex-col items-center justify-center py-16">
              <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <Users class="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <p class="text-slate-500 dark:text-slate-400 font-semibold">No hay alumnos matriculados</p>
              <p class="text-slate-400 dark:text-slate-500 text-xs mt-1">Este curso no tiene estudiantes activos registrados.</p>
            </div>

            <!-- Student List -->
            <div v-else class="p-4 space-y-2">
              <!-- Count badge -->
              <div class="flex items-center justify-between px-2 py-1 mb-4">
                <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Estudiantes</span>
                <span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black rounded-full">
                  {{ studentsList.length }} alumno{{ studentsList.length !== 1 ? 's' : '' }}
                </span>
              </div>

              <div
                v-for="(student, index) in studentsList"
                :key="student.id_estudiante"
                class="flex items-center gap-4 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-100 dark:hover:border-indigo-800 transition-all duration-200 group"
              >
                <!-- Avatar / Number -->
                <div class="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-100 dark:shadow-none">
                  <span class="text-xs font-black text-white">{{ index + 1 }}</span>
                </div>

                <!-- Name & details -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-slate-900 dark:text-slate-200 truncate">
                    {{ student.apellido }}, {{ student.nombre }}
                  </p>
                  <div class="flex items-center gap-3 mt-0.5">
                    <span class="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                      <Hash class="w-3 h-3" />
                      {{ student.codigo || 'Sin código' }}
                    </span>
                    <span class="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                      <FileText class="w-3 h-3" />
                      {{ student.documento || 'Sin doc.' }}
                    </span>
                  </div>
                </div>

                <!-- Indicator -->
                <div class="w-2 h-2 bg-emerald-400 rounded-full shrink-0 group-hover:bg-indigo-400 transition-colors"></div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t border-slate-100 dark:border-slate-800 p-4 shrink-0 bg-slate-50/80 dark:bg-slate-800/50">
            <button
              @click="closeStudentsModal"
              class="w-full py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100 dark:shadow-none"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</div>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .relative,
.modal-fade-leave-active .relative {
  transition: transform 0.25s ease;
}
.modal-fade-enter-from .relative {
  transform: scale(0.95) translateY(8px);
}
.modal-fade-leave-to .relative {
  transform: scale(0.95);
}
</style>
