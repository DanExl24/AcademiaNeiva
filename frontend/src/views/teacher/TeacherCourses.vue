<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  BookOpen, 
  Users, 
  ChevronRight, 
  LayoutGrid,
  GraduationCap,
  ClipboardList
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const viewMode = ref('grades') // 'grades' o 'subjects'
const loading = ref(true)
const rawData = ref([])

interface AcademicGroup {
  id_grado: number
  grado_nombre: string
  nivel: string
  seccion: string
  id_materia: number
  materia_nombre: string
}

const fetchCourses = async () => {
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/teacher/courses/${auth.user?.id}`)
    rawData.value = response.data
  } catch (error) {
    console.error('Error fetching courses:', error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchCourses)

// Agrupación por Grados
const groupedByGrades = computed(() => {
  const groups: Record<string, any> = {}
  rawData.value.forEach((item: AcademicGroup) => {
    const key = `${item.grado_nombre} ${item.seccion}`
    if (!groups[key]) {
      groups[key] = {
        id_grado: item.id_grado,
        nombre: item.grado_nombre,
        seccion: item.seccion,
        nivel: item.nivel,
        materias: []
      }
    }
    groups[key].materias.push({
      id: item.id_materia,
      nombre: item.materia_nombre
    })
  })
  return Object.values(groups)
})

// Agrupación por Materias
const groupedBySubjects = computed(() => {
  const groups: Record<string, any> = {}
  rawData.value.forEach((item: AcademicGroup) => {
    if (!groups[item.materia_nombre]) {
      groups[item.materia_nombre] = {
        nombre: item.materia_nombre,
        cursos: []
      }
    }
    groups[item.materia_nombre].cursos.push({
      id_grado: item.id_grado,
      nombre: `${item.grado_nombre} ${item.seccion}`
    })
  })
  return Object.values(groups)
})

const navigateToGrades = (gradoId: number) => {
  router.push({ name: 'teacher-grades', query: { gradoId } })
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Mis Cursos y Materias</h1>
        <p class="text-slate-500 mt-1">Gestiona tu carga académica y estudiantes</p>
      </div>
      
      <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
        <button 
          @click="viewMode = 'grades'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 font-medium"
          :class="viewMode === 'grades' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'"
        >
          <LayoutGrid class="w-4 h-4" />
          Por Grado
        </button>
        <button 
          @click="viewMode = 'subjects'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 font-medium"
          :class="viewMode === 'subjects' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'"
        >
          <BookOpen class="w-4 h-4" />
          Por Materia
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 font-medium italic">Cargando tu información académica...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="rawData.length === 0" class="bg-white p-12 rounded-3xl text-center border border-dashed border-slate-300">
      <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <GraduationCap class="w-10 h-10 text-slate-300" />
      </div>
      <h3 class="text-xl font-bold text-slate-900">No tienes cursos asignados</h3>
      <p class="text-slate-500 max-w-md mx-auto mt-2">Parece que aún no tienes carga académica registrada en este colegio. Contacta a coordinación.</p>
    </div>

    <!-- Content: By Grade -->
    <div v-else-if="viewMode === 'grades'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="group in groupedByGrades" 
        :key="group.id_grado"
        class="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 overflow-hidden relative"
      >
        <!-- Background Accent -->
        <div class="absolute -right-8 -top-8 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
        
        <div class="relative">
          <div class="flex items-start justify-between mb-6">
            <div class="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span class="text-xl font-black">{{ group.nombre[0] }}</span>
            </div>
            <span class="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold tracking-wider rounded-full uppercase">{{ group.nivel }}</span>
          </div>

          <h3 class="text-2xl font-black text-slate-900 mb-1">{{ group.nombre }} {{ group.seccion }}</h3>
          
          <div class="space-y-4 mt-6">
            <div v-for="materia in group.materias" :key="materia.id" class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group/item hover:bg-indigo-50 hover:border-indigo-100 transition-colors duration-300">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 bg-indigo-400 rounded-full group-hover/item:scale-150 transition-transform"></div>
                <span class="text-sm font-semibold text-slate-700">{{ materia.nombre }}</span>
              </div>
              <ChevronRight class="w-4 h-4 text-slate-300 group-hover/item:text-indigo-400 transition-colors" />
            </div>
          </div>

          <div class="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
            <button class="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors">
              <Users class="w-4 h-4" />
              Ver Alumnos
            </button>
            <button 
              @click="navigateToGrades(group.id_grado)"
              class="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-md shadow-indigo-100 active:scale-95 transition-all"
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
        class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-8 hover:shadow-lg transition-all duration-500"
      >
        <div class="w-20 h-20 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center shrink-0 shadow-inner">
          <BookOpen class="w-10 h-10" />
        </div>
        
        <div class="flex-1">
          <h3 class="text-2xl font-black text-slate-900 mb-6">{{ subject.nombre }}</h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div 
              v-for="curso in subject.cursos" 
              :key="curso.id_grado"
              class="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-teal-50 hover:border-teal-100 transition-all duration-300 cursor-pointer group"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-slate-700">{{ curso.nombre }}</span>
                <ChevronRight class="w-4 h-4 text-slate-300 group-hover:translate-x-1 group-hover:text-teal-500 transition-all" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
