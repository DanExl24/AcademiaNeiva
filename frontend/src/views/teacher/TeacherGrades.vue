<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2,
  Settings,
  Users,
  Loader2
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'

interface Course {
  id_grado: number
  grado_nombre: string
  seccion: string
  id_materia: number
  materia_nombre: string
  id_detallegrado: number
}

interface Period {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO'
  porcentaje: number
}

interface Activity {
  id_actividadmateria: number
  nombre: string
  porcentaje: string | number
  id_detallegrado: number
  id_periodo: number
}

interface Student {
  id_estudiante: number
  nombre: string
  apellido: string
  codigo: string
}

const route = useRoute()
const auth = useAuthStore()

// Estado de selección
const selectedGradeId = ref<number | null>(route.query.gradoId ? Number(route.query.gradoId) : null)
const selectedSubjectId = ref<number | null>(null)
const selectedPeriodId = ref<number | null>(null)

// Datos cargados
const myCourses = ref<Course[]>([])
const periods = ref<Period[]>([])
const activities = ref<Activity[]>([])
const students = ref<Student[]>([])
const gradesMatrix = ref<Record<number, Record<number, any>>>({}) 
const saving = ref(false)
const activitiesLoading = ref(false)

// Estado de nueva actividad
const showAddActivity = ref(false)
const newActivity = ref({
  nombre: '',
  porcentaje: 0
})

// Cargar cursos asignados
const fetchMyCourses = async () => {
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/courses/${auth.user?.id}`)
    myCourses.value = response.data
    if (selectedGradeId.value) {
      const course = myCourses.value.find(c => c.id_grado === selectedGradeId.value)
      if (course) selectedSubjectId.value = course.id_materia
    }
  } catch (error) {
    console.error('Error fetching courses:', error)
  }
}

// Cargar periodos
const fetchPeriods = async () => {
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/periods/${auth.user?.schoolId}`)
    periods.value = response.data
    const openPeriod = periods.value.find(p => p.estado === 'ABIERTO')
    if (openPeriod) selectedPeriodId.value = openPeriod.id_periodo
  } catch (error) {
    console.error('Error fetching periods:', error)
  }
}

// Cargar notas actuales
const fetchGrades = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) return
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/grades/${selectedGradeId.value}/${selectedSubjectId.value}/${selectedPeriodId.value}`)
    
    response.data.forEach((n: any) => {
      if (!gradesMatrix.value[n.id_estudiante]) gradesMatrix.value[n.id_estudiante] = {}
      gradesMatrix.value[n.id_estudiante][n.id_actividadmateria] = n.nota
    })
  } catch (error) {
    console.error('Error fetching grades:', error)
  }
}

// Cargar actividades
const fetchActivities = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) return
  try {
    activitiesLoading.value = true
    const response = await axios.get(`http://localhost:3000/api/teacher/activities/${selectedGradeId.value}/${selectedSubjectId.value}/${selectedPeriodId.value}`, {
      params: { userId: auth.user?.id }
    })
    activities.value = response.data
    await fetchGrades()
  } catch (error) {
    console.error('Error fetching activities:', error)
  } finally {
    activitiesLoading.value = false
  }
}

// Cargar estudiantes
const fetchStudents = async () => {
  if (!selectedGradeId.value) return
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/students/${selectedGradeId.value}`)
    students.value = response.data
    
    students.value.forEach(s => {
      if (!gradesMatrix.value[s.id_estudiante]) {
        gradesMatrix.value[s.id_estudiante] = {}
      }
    })
  } catch (error) {
    console.error('Error fetching students:', error)
  }
}

// Guardar todas las notas
const saveAllGrades = async () => {
  if (saving.value) return
  
  const gradesToSave: any[] = []
  Object.keys(gradesMatrix.value).forEach(studentId => {
    const sId = Number(studentId)
    Object.keys(gradesMatrix.value[sId]).forEach(activityId => {
      const aId = Number(activityId)
      const nota = gradesMatrix.value[sId][aId]
      if (nota !== undefined && nota !== '') {
        gradesToSave.push({
          id_estudiante: sId,
          id_actividadmateria: aId,
          nota: nota
        })
      }
    })
  })

  if (gradesToSave.length === 0) return

  try {
    saving.value = true
    await axios.post('http://localhost:3000/api/teacher/grades', {
      grades: gradesToSave,
      schoolId: auth.user?.schoolId
    })
    alert('Calificaciones guardadas exitosamente')
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar calificaciones')
  } finally {
    saving.value = false
  }
}

// Agregar actividad
const addActivity = async () => {
  if (!newActivity.value.nombre || newActivity.value.porcentaje <= 0) return
  try {
    const course = myCourses.value.find(c => c.id_grado === selectedGradeId.value && c.id_materia === selectedSubjectId.value)
    if (!course) return

    const response = await axios.post('http://localhost:3000/api/teacher/activities', {
      id_detallegrado: course.id_detallegrado,
      id_periodo: selectedPeriodId.value,
      nombre: newActivity.value.nombre,
      porcentaje: newActivity.value.porcentaje,
      id_colegio: auth.user?.schoolId
    })
    activities.value.push(response.data)
    newActivity.value = { nombre: '', porcentaje: 0 }
    showAddActivity.value = false
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear actividad')
  }
}

// Eliminar actividad
const removeActivity = async (id: number) => {
  if (!confirm('¿Estás seguro de eliminar esta actividad?')) return
  try {
    await axios.delete(`http://localhost:3000/api/teacher/activities/${id}`)
    activities.value = activities.value.filter(a => a.id_actividadmateria !== id)
  } catch (error) {
    console.error('Error deleting activity:', error)
  }
}

// Calcular definitiva de un estudiante
const calculateFinal = (studentId: number) => {
  const studentGrades = gradesMatrix.value[studentId] || {}
  let total = 0
  
  activities.value.forEach(act => {
    const nota = parseFloat(studentGrades[act.id_actividadmateria] || 0)
    const peso = parseFloat(act.porcentaje.toString()) / 100
    total += nota * peso
  })
  
  return total.toFixed(1)
}

// Computados
const totalPercentage = computed(() => {
  return activities.value.reduce((sum, act) => sum + parseFloat(act.porcentaje.toString()), 0)
})

const coursesOptions = computed(() => {
  const uniqueGrades: {id: number, label: string}[] = []
  const seen = new Set()
  myCourses.value.forEach(c => {
    if (!seen.has(c.id_grado)) {
      seen.add(c.id_grado)
      uniqueGrades.push({ id: c.id_grado, label: `${c.grado_nombre} ${c.seccion}` })
    }
  })
  return uniqueGrades
})

const subjectsOptions = computed(() => {
  return myCourses.value
    .filter(c => c.id_grado === selectedGradeId.value)
    .map(c => ({ id: c.id_materia, label: c.materia_nombre }))
})

// Watchers
watch([selectedGradeId, selectedSubjectId, selectedPeriodId], () => {
  fetchActivities()
  if (selectedGradeId.value) fetchStudents()
})

onMounted(() => {
  fetchMyCourses()
  fetchPeriods()
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-700">
    <!-- Header & Selectors -->
    <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-end gap-6">
      <div class="flex-1 space-y-4">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Panel de Calificaciones</h1>
          <p class="text-slate-500">Gestiona actividades y notas del periodo actual</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Grado / Curso</label>
            <select v-model="selectedGradeId" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-pink-500 transition-all outline-none">
              <option :value="null">Selecciona Grado</option>
              <option v-for="g in coursesOptions" :key="g.id" :value="g.id">{{ g.label }}</option>
            </select>
          </div>
          
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Materia</label>
            <select v-model="selectedSubjectId" :disabled="!selectedGradeId" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-pink-500 transition-all outline-none disabled:opacity-50">
              <option :value="null">Selecciona Materia</option>
              <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
            </select>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Periodo</label>
            <select v-model="selectedPeriodId" class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-pink-500 transition-all outline-none">
              <option :value="null">Selecciona Periodo</option>
              <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <button 
          @click="saveAllGrades"
          :disabled="saving || activities.length === 0"
          class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="saving" class="w-5 h-5 animate-spin" />
          <Save v-else class="w-5 h-5" />
          {{ saving ? 'Guardando...' : 'Guardar Todo' }}
        </button>
      </div>
    </div>

    <div v-if="!selectedGradeId || !selectedSubjectId" class="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
      <div class="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
        <AlertCircle class="w-10 h-10 text-slate-300" />
      </div>
      <h3 class="text-xl font-bold text-slate-400">Selecciona curso y materia para comenzar</h3>
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">
      <!-- Activity Management -->
      <div class="xl:col-span-1 space-y-6">
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
              <Settings class="w-5 h-5 text-pink-500" />
              Actividades
            </h3>
            <span :class="[totalPercentage === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600', 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter']">
              {{ totalPercentage }}% / 100%
            </span>
          </div>

          <div class="space-y-3">
            <div v-for="act in activities" :key="act.id_actividadmateria" class="group flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-pink-200 transition-all">
              <div>
                <p class="text-sm font-bold text-slate-700">{{ act.nombre }}</p>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Peso: {{ act.porcentaje }}%</p>
              </div>
              <button @click="removeActivity(act.id_actividadmateria)" class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>

            <button 
              v-if="!showAddActivity && totalPercentage < 100"
              @click="showAddActivity = true"
              class="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-pink-500 hover:border-pink-200 transition-all font-bold text-sm"
            >
              <Plus class="w-4 h-4" />
              Nueva Actividad
            </button>

            <div v-if="showAddActivity" class="p-4 bg-pink-50 rounded-2xl border border-pink-100 space-y-4 animate-in zoom-in-95 duration-300">
              <input v-model="newActivity.nombre" type="text" placeholder="Nombre (ej: Examen)" class="w-full bg-white border-0 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-pink-500 outline-none" />
              <div class="flex items-center gap-2">
                <input v-model.number="newActivity.porcentaje" type="number" placeholder="%" class="w-20 bg-white border-0 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-pink-500 outline-none" />
                <span class="text-xs font-black text-slate-400">% de peso</span>
              </div>
              <div class="flex gap-2">
                <button @click="showAddActivity = false" class="flex-1 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                <button @click="addActivity" class="flex-1 bg-pink-500 text-white py-2 rounded-xl text-[10px] font-black uppercase shadow-md shadow-pink-100">Crear</button>
              </div>
            </div>
          </div>
        </div>

        <div class="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
          <div class="flex items-start gap-3">
            <AlertCircle class="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <p class="text-[11px] text-indigo-700 leading-relaxed font-semibold">
              Recuerda que la suma de porcentajes debe ser exactamente <span class="font-black underline">100%</span> para que el sistema pueda calcular la definitiva automáticamente.
            </p>
          </div>
        </div>
      </div>

      <!-- Grade Matrix -->
      <div class="xl:col-span-3">
        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
          <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-xl font-black text-slate-900 flex items-center gap-3">
              <Users class="w-6 h-6 text-indigo-500" />
              Registro de Calificaciones
            </h3>
            
            <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-500 tracking-wider">
              <CheckCircle2 class="w-4 h-4 text-emerald-500" />
              Periodo Abierto para Edición
            </div>
          </div>

          <div v-if="activities.length === 0" class="p-20 text-center bg-slate-50/30">
             <div class="w-16 h-16 bg-white rounded-full shadow-inner flex items-center justify-center mx-auto mb-4">
                <Settings class="w-8 h-8 text-slate-200" />
             </div>
             <p class="text-sm font-bold text-slate-400">Define al menos una actividad para empezar a calificar</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="bg-slate-50/50 border-b border-slate-100">
                  <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[250px]">Estudiante</th>
                  <th v-for="act in activities" :key="act.id_actividadmateria" class="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                    {{ act.nombre }}<br>
                    <span class="text-indigo-400">{{ act.porcentaje }}%</span>
                  </th>
                  <th class="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center bg-indigo-50/30">Definitiva</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="student in students" :key="student.id_estudiante" class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-8 py-5">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                        {{ student.nombre[0] }}{{ student.apellido[0] }}
                      </div>
                      <div>
                        <p class="text-sm font-bold text-slate-700 leading-none mb-1">{{ student.nombre }} {{ student.apellido }}</p>
                        <p class="text-[10px] text-slate-400 font-bold font-mono">{{ student.codigo }}</p>
                      </div>
                    </div>
                  </td>
                  
                  <!-- Grade Inputs -->
                  <td v-for="act in activities" :key="act.id_actividadmateria" class="px-6 py-5 text-center">
                    <input 
                      v-model="gradesMatrix[student.id_estudiante][act.id_actividadmateria]"
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="5"
                      placeholder="0.0"
                      class="w-16 bg-white border border-slate-200 rounded-xl p-2.5 text-center text-sm font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    />
                  </td>

                  <td class="px-8 py-5 text-center bg-indigo-50/10">
                    <span 
                      :class="[parseFloat(calculateFinal(student.id_estudiante)) >= 3 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50', 'px-4 py-2 rounded-xl font-black text-lg shadow-sm border border-indigo-100/50']"
                    >
                      {{ calculateFinal(student.id_estudiante) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Loading overlay -->
          <div v-if="activitiesLoading" class="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
             <Loader2 class="w-10 h-10 text-indigo-600 animate-spin mb-4" />
             <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Sincronizando notas...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] {
  -moz-appearance: textfield;
}
</style>
