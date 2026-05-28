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
  Loader2,
  BookOpen
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

interface Criterion {
  id_criterio: number
  id_actividadmateria: number
  id_evidencia: number | null
  descripcion: string
  porcentaje: number | string
}

interface Activity {
  id_actividadmateria: number
  nombre: string
  porcentaje: string | number
  id_competencia: number
  id_evidencia: number | null
  criterios?: Criterion[]
}

interface Competency {
  id_competencia: number
  descripcion: string
  id_periodo: number
}

interface Evidencia {
  id_evidencia: number
  descripcion: string
  orden: number
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
const competency = ref<Competency | null>(null)
const competencyDraft = ref('')
const evidencias = ref<Evidencia[]>([])
const students = ref<Student[]>([])
const gradesMatrix = ref<Record<number, Record<number, any>>>({}) 
const criteriaGradesMatrix = ref<Record<number, Record<number, any>>>({})
const gradeRange = ref({ min: 0, max: 5, approval: 3 })
const saving = ref(false)
const activitiesLoading = ref(false)
const competencySaving = ref(false)

// Estado de nueva actividad
const showAddActivity = ref(false)
const newActivity = ref({
  nombre: '',
  porcentaje: 0,
  id_evidencia: null as number | null
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

const fetchGradeRange = async () => {
  if (!auth.user?.schoolId) return
  try {
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${auth.user.schoolId}`)
    if (response.data?.defaultSettings) {
      gradeRange.value = {
        min: Number(response.data.defaultSettings.nota_minima),
        max: Number(response.data.defaultSettings.nota_maxima),
        approval: Number(response.data.defaultSettings.nota_aprobacion),
      }
    }
  } catch (error) {
    console.error('Error fetching grade range:', error)
  }
}

const initializeMatrixForStudents = () => {
  students.value.forEach(s => {
    if (!gradesMatrix.value[s.id_estudiante]) {
      gradesMatrix.value[s.id_estudiante] = {}
    }
    if (!criteriaGradesMatrix.value[s.id_estudiante]) {
      criteriaGradesMatrix.value[s.id_estudiante] = {}
    }
  })
}

// Cargar notas actuales
const fetchGrades = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) return
  try {
    gradesMatrix.value = {}
    criteriaGradesMatrix.value = {}
    const response = await axios.get(`http://localhost:3000/api/teacher/grades/${selectedGradeId.value}/${selectedSubjectId.value}/${selectedPeriodId.value}`)
    
    response.data.activityGrades.forEach((n: any) => {
      if (!gradesMatrix.value[n.id_estudiante]) gradesMatrix.value[n.id_estudiante] = {}
      gradesMatrix.value[n.id_estudiante][n.id_actividadmateria] = n.nota
    })

    response.data.criteriaGrades.forEach((n: any) => {
      if (!criteriaGradesMatrix.value[n.id_estudiante]) criteriaGradesMatrix.value[n.id_estudiante] = {}
      criteriaGradesMatrix.value[n.id_estudiante][n.id_criterio] = n.nota
    })
    
    // Garantizar que todos los estudiantes cargados tengan una fila en la matriz
    initializeMatrixForStudents()
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
    competency.value = response.data.competencia
    competencyDraft.value = response.data.competencia?.descripcion || ''
    evidencias.value = response.data.evidencias || []
    activities.value = response.data.activities || []
    await fetchGrades()
  } catch (error) {
    console.error('Error fetching activities:', error)
    competency.value = null
    competencyDraft.value = ''
    evidencias.value = []
    activities.value = []
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
    
    initializeMatrixForStudents()
  } catch (error) {
    console.error('Error fetching students:', error)
  }
}

const validateGradeInput = (studentId: number, id: number, type: 'activity' | 'criterion', event: Event) => {
  const input = event.target as HTMLInputElement
  let val = parseFloat(input.value)
  if (isNaN(val)) {
    if (type === 'activity') {
      gradesMatrix.value[studentId][id] = ''
    } else {
      criteriaGradesMatrix.value[studentId][id] = ''
    }
    return
  }
  
  if (val < gradeRange.value.min) {
    val = gradeRange.value.min
  } else if (val > gradeRange.value.max) {
    val = gradeRange.value.max
  }
  
  // Redondear a 1 decimal
  val = parseFloat(val.toFixed(1))
  
  if (type === 'activity') {
    gradesMatrix.value[studentId][id] = val
  } else {
    criteriaGradesMatrix.value[studentId][id] = val
  }
  input.value = val.toString()
}

// Guardar todas las notas
const saveAllGrades = async () => {
  if (saving.value) return
  
  const activityGradesToSave: any[] = []
  const criteriaGradesToSave: any[] = []

  // Validaciones y armado local
  let hasError = false

  Object.keys(gradesMatrix.value).forEach(studentId => {
    const sId = Number(studentId)
    Object.keys(gradesMatrix.value[sId]).forEach(activityId => {
      const aId = Number(activityId)
      const act = activities.value.find(a => a.id_actividadmateria === aId)
      if (act && (!act.criterios || act.criterios.length === 0)) {
        const nota = gradesMatrix.value[sId][aId]
        if (nota !== undefined && nota !== '') {
          const val = parseFloat(nota)
          if (isNaN(val) || val < gradeRange.value.min || val > gradeRange.value.max) {
            hasError = true
            return
          }
          activityGradesToSave.push({
            id_estudiante: sId,
            id_actividadmateria: aId,
            nota: val
          })
        }
      }
    })
  })

  Object.keys(criteriaGradesMatrix.value).forEach(studentId => {
    const sId = Number(studentId)
    Object.keys(criteriaGradesMatrix.value[sId]).forEach(criterioId => {
      const cId = Number(criterioId)
      const nota = criteriaGradesMatrix.value[sId][cId]
      if (nota !== undefined && nota !== '') {
        const val = parseFloat(nota)
        if (isNaN(val) || val < gradeRange.value.min || val > gradeRange.value.max) {
          hasError = true
          return
        }
        criteriaGradesToSave.push({
          id_estudiante: sId,
          id_criterio: cId,
          nota: val
        })
      }
    })
  })

  if (hasError) {
    alert(`Todas las calificaciones deben estar dentro del rango institucional permitido: ${gradeRange.value.min} - ${gradeRange.value.max}`)
    return
  }

  if (activityGradesToSave.length === 0 && criteriaGradesToSave.length === 0) return

  try {
    saving.value = true
    await axios.post('http://localhost:3000/api/teacher/grades', {
      activityGrades: activityGradesToSave,
      criteriaGrades: criteriaGradesToSave,
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
  if (!newActivity.value.nombre || newActivity.value.porcentaje <= 0 || !newActivity.value.id_evidencia) {
    alert('Debes seleccionar una evidencia de aprendizaje, un nombre y un porcentaje.')
    return
  }
  try {
    if (!competency.value) {
      alert('No se ha podido identificar la competencia asociada a este curso.')
      return
    }

    const response = await axios.post('http://localhost:3000/api/teacher/activities', {
      id_competencia: competency.value.id_competencia,
      nombre: newActivity.value.nombre,
      porcentaje: newActivity.value.porcentaje,
      id_evidencia: newActivity.value.id_evidencia,
      id_colegio: auth.user?.schoolId
    })
    initializeMatrixForStudents()
    activities.value.push(response.data)
    newActivity.value = { nombre: '', porcentaje: 0, id_evidencia: null }
    showAddActivity.value = false
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear actividad')
  }
}

const saveCompetency = async () => {
  if (!competency.value || !competencyDraft.value.trim() || competencySaving.value) return

  try {
    competencySaving.value = true
    const response = await axios.put(`http://localhost:3000/api/teacher/competencies/${competency.value.id_competencia}`, {
      descripcion: competencyDraft.value
    })
    competency.value = response.data
    competencyDraft.value = response.data.descripcion
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar la competencia')
  } finally {
    competencySaving.value = false
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

// Calcular la nota computada de una actividad si tiene criterios
const calculateActivityGrade = (studentId: number, act: Activity) => {
  if (!act.criterios || act.criterios.length === 0) {
    const studentGrades = gradesMatrix.value[studentId] || {}
    return parseFloat(studentGrades[act.id_actividadmateria] || 0)
  }

  const cGrades = criteriaGradesMatrix.value[studentId] || {}
  let total = 0
  act.criterios.forEach(c => {
    const nota = parseFloat(cGrades[c.id_criterio] || 0)
    const peso = parseFloat(c.porcentaje.toString()) / 100
    total += nota * peso
  })
  return total
}

// Calcular definitiva de un estudiante
const calculateFinal = (studentId: number) => {
  let total = 0
  
  activities.value.forEach(act => {
    const notaActividad = calculateActivityGrade(studentId, act)
    const peso = parseFloat(act.porcentaje.toString()) / 100
    total += notaActividad * peso
  })
  
  return total.toFixed(1)
}

// Criterios
const newCriterion = ref<Record<number, { descripcion: string, porcentaje: number, id_evidencia: number | null }>>({})

const toggleAddCriterion = (actId: number) => {
  if (!newCriterion.value[actId]) {
    newCriterion.value[actId] = { descripcion: '', porcentaje: 0, id_evidencia: null }
  } else {
    delete newCriterion.value[actId]
  }
}

const addCriterion = async (act: Activity) => {
  const form = newCriterion.value[act.id_actividadmateria]
  if (!form || !form.descripcion || form.porcentaje <= 0) return

  const currentTotal = (act.criterios || []).reduce((sum, c) => sum + parseFloat(c.porcentaje.toString()), 0)
  if (currentTotal + form.porcentaje > 100) {
    alert(`La suma de los porcentajes de los criterios no puede superar el 100%. Actual: ${currentTotal}%`)
    return
  }

  try {
    const response = await axios.post('http://localhost:3000/api/teacher/activities/criteria', {
      id_actividadmateria: act.id_actividadmateria,
      id_evidencia: form.id_evidencia,
      descripcion: form.descripcion,
      porcentaje: form.porcentaje,
      id_colegio: auth.user?.schoolId
    })
    
    if (!act.criterios) act.criterios = []
    act.criterios.push(response.data)
    
    delete newCriterion.value[act.id_actividadmateria]
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear el criterio')
  }
}

const removeCriterion = async (act: Activity, criterionId: number) => {
  if (!confirm('¿Estás seguro de eliminar este criterio?')) return
  try {
    await axios.delete(`http://localhost:3000/api/teacher/activities/criteria/${criterionId}`)
    if (act.criterios) {
      act.criterios = act.criterios.filter(c => c.id_criterio !== criterionId)
    }
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al eliminar el criterio')
  }
}

// Computados
interface TableColumn {
  type: 'activity' | 'criterion' | 'activity_total'
  activity: Activity
  criterion?: Criterion
  id: string
}

const tableColumns = computed<TableColumn[]>(() => {
  const cols: TableColumn[] = []
  activities.value.forEach(act => {
    if (!act.criterios || act.criterios.length === 0) {
      cols.push({ type: 'activity', activity: act, id: `act-${act.id_actividadmateria}` })
    } else {
      act.criterios.forEach(crit => {
        cols.push({ type: 'criterion', activity: act, criterion: crit, id: `crit-${crit.id_criterio}` })
      })
      cols.push({ type: 'activity_total', activity: act, id: `act-${act.id_actividadmateria}-total` })
    }
  })
  return cols
})

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
  gradesMatrix.value = {}
  criteriaGradesMatrix.value = {}
  newCriterion.value = {}
  fetchActivities()
  if (selectedGradeId.value) fetchStudents()
})

onMounted(() => {
  fetchGradeRange()
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
            <select v-model="selectedPeriodId" disabled class="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-pink-500 transition-all outline-none disabled:opacity-70 disabled:cursor-not-allowed">
              <option :value="null">Selecciona Periodo</option>
              <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">{{ p.nombre }}</option>
            </select>
            <p class="text-[11px] font-semibold text-slate-400">El sistema solo habilita el periodo académico actual para docentes.</p>
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
        <!-- Competencia (solo lectura — definida por el directivo) -->
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen class="w-4 h-4 text-violet-500" />
            </div>
            <h3 class="text-lg font-black text-slate-900">Competencia</h3>
          </div>

          <!-- Sin competencia definida -->
          <div
            v-if="!competency || !competencyDraft"
            class="flex flex-col items-center justify-center py-8 text-center"
          >
            <div class="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
              <AlertCircle class="w-6 h-6 text-slate-300" />
            </div>
            <p class="text-sm font-bold text-slate-400">Sin competencia definida</p>
            <p class="text-[11px] text-slate-300 mt-1">El directivo aún no ha definido la competencia para este periodo.</p>
          </div>

          <!-- Competencia definida -->
          <div v-else class="space-y-3">
            <div class="bg-violet-50 border border-violet-100 rounded-2xl p-4">
              <p class="text-sm font-semibold text-violet-900 leading-relaxed">
                {{ competencyDraft }}
              </p>
              
              <div v-if="evidencias.length" class="mt-4 pt-4 border-t border-violet-200/60">
                <h4 class="text-xs font-black text-violet-900 uppercase tracking-wider mb-3">Evidencias de Aprendizaje</h4>
                <ul class="space-y-2">
                  <li v-for="ev in evidencias" :key="ev.id_evidencia" class="flex items-start gap-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-1.5"></div>
                    <span class="text-xs font-medium text-violet-800 leading-relaxed">{{ ev.descripcion }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <div class="flex items-center gap-2 px-1">
              <div class="w-3.5 h-3.5 text-slate-400 shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <p class="text-[11px] text-slate-400 font-semibold">
                Definida por la dirección académica · Solo lectura
              </p>
            </div>
          </div>
        </div>

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

            <div v-for="act in activities" :key="act.id_actividadmateria" class="space-y-2">
              <div class="group flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-pink-200 transition-all">
                <div>
                  <p class="text-sm font-bold text-slate-700">{{ act.nombre }}</p>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Peso: {{ act.porcentaje }}%</p>
                  <p v-if="act.id_evidencia" class="text-[10px] text-violet-500 font-semibold mt-0.5">
                    📋 E{{ evidencias.find(e => e.id_evidencia === act.id_evidencia)?.orden }}: {{ evidencias.find(e => e.id_evidencia === act.id_evidencia)?.descripcion?.substring(0, 40) }}...
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button @click="toggleAddCriterion(act.id_actividadmateria)" class="text-slate-300 hover:text-pink-500 transition-all" title="Añadir criterio">
                    <Plus class="w-4 h-4" />
                  </button>
                  <button @click="removeActivity(act.id_actividadmateria)" class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" title="Eliminar actividad">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Criterios List -->
              <div v-if="act.criterios && act.criterios.length > 0" class="pl-4 pr-2 space-y-2">
                <div v-for="crit in act.criterios" :key="crit.id_criterio" class="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3 shadow-sm group">
                  <div class="flex-1 min-w-0 pr-4">
                    <p class="text-xs font-semibold text-slate-600 truncate">{{ crit.descripcion }}</p>
                    <p class="text-[9px] font-black text-pink-400 uppercase tracking-wider">{{ crit.porcentaje }}%</p>
                  </div>
                  <button @click="removeCriterion(act, crit.id_criterio)" class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Add Criterion Form -->
              <div v-if="newCriterion[act.id_actividadmateria]" class="ml-4 p-3 bg-pink-50/50 rounded-xl border border-pink-100 space-y-3 animate-in zoom-in duration-200">
                <input v-model="newCriterion[act.id_actividadmateria].descripcion" type="text" placeholder="Descripción del criterio" class="w-full bg-white border-0 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-pink-500 outline-none" />
                <div class="flex gap-2">
                  <input v-model.number="newCriterion[act.id_actividadmateria].porcentaje" type="number" placeholder="Peso %" class="w-20 bg-white border-0 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-pink-500 outline-none" />
                  <select v-model="newCriterion[act.id_actividadmateria].id_evidencia" class="flex-1 bg-white border-0 rounded-lg p-2.5 text-xs text-slate-500 font-medium focus:ring-2 focus:ring-pink-500 outline-none">
                    <option :value="null">Sin evidencia (Opcional)</option>
                    <option v-for="ev in evidencias" :key="ev.id_evidencia" :value="ev.id_evidencia">
                      Evidencia {{ ev.orden }}: {{ ev.descripcion.substring(0, 30) }}...
                    </option>
                  </select>
                </div>
                <div class="flex gap-2">
                  <button @click="toggleAddCriterion(act.id_actividadmateria)" class="flex-1 py-1.5 text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                  <button @click="addCriterion(act)" class="flex-1 bg-pink-500 text-white py-1.5 rounded-lg text-[10px] font-bold uppercase shadow-sm">Añadir Criterio</button>
                </div>
              </div>
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
              <div class="space-y-1">
                <label class="text-[10px] font-black text-pink-400 uppercase tracking-wider ml-1">Evidencia de Aprendizaje *</label>
                <select v-model="newActivity.id_evidencia" class="w-full bg-white border-0 rounded-xl p-3 text-xs font-semibold text-slate-600 focus:ring-2 focus:ring-pink-500 outline-none">
                  <option :value="null" disabled>Selecciona una evidencia</option>
                  <option v-for="ev in evidencias" :key="ev.id_evidencia" :value="ev.id_evidencia">
                    E{{ ev.orden }}: {{ ev.descripcion }}
                  </option>
                </select>
              </div>
              <input v-model="newActivity.nombre" type="text" placeholder="Nombre de la actividad (ej: Examen, Taller, Quiz...)" class="w-full bg-white border-0 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-pink-500 outline-none" />
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
                  
                  <th v-for="col in tableColumns" :key="col.id" 
                      :class="['px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center', col.type === 'activity_total' ? 'bg-pink-50/50 text-pink-600' : 'text-slate-400']">
                    <template v-if="col.type === 'activity'">
                      <span class="text-slate-800 font-bold block">{{ col.activity.nombre }}</span>
                      <span class="text-indigo-400 text-[9px] font-bold">{{ col.activity.porcentaje }}%</span>
                    </template>
                    <template v-else-if="col.type === 'criterion'">
                      <span class="text-[9px] font-black text-indigo-500 block mb-1 tracking-normal truncate max-w-[120px] mx-auto">{{ col.activity.nombre }}</span>
                      <span class="text-slate-700 font-bold text-[10px]" :title="col.activity.nombre">{{ col.criterion?.descripcion }}</span><br>
                      <span class="text-pink-400 text-[9px] font-bold">{{ col.criterion?.porcentaje }}%</span>
                    </template>
                    <template v-else-if="col.type === 'activity_total'">
                      <span class="text-[9px] font-black text-pink-500 block mb-1 tracking-normal truncate max-w-[120px] mx-auto">{{ col.activity.nombre }}</span>
                      <span class="font-bold text-pink-700 text-[10px]">Σ Total</span><br>
                      <span class="text-pink-400 text-[9px] font-bold">{{ col.activity.porcentaje }}%</span>
                    </template>
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
                  <td v-for="col in tableColumns" :key="col.id" class="px-4 py-5 text-center">
                    <template v-if="col.type === 'activity'">
                      <input 
                        v-model="gradesMatrix[student.id_estudiante][col.activity.id_actividadmateria]"
                        type="number" 
                        step="0.1" 
                        :min="gradeRange.min" 
                        :max="gradeRange.max"
                        @blur="validateGradeInput(student.id_estudiante, col.activity.id_actividadmateria, 'activity', $event)"
                        placeholder="0.0"
                        class="w-16 bg-white border border-slate-200 rounded-xl p-2.5 text-center text-sm font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      />
                    </template>
                    <template v-else-if="col.type === 'criterion'">
                      <input 
                        v-if="col.criterion"
                        v-model="criteriaGradesMatrix[student.id_estudiante][col.criterion.id_criterio]"
                        type="number" 
                        step="0.1" 
                        :min="gradeRange.min" 
                        :max="gradeRange.max"
                        @blur="validateGradeInput(student.id_estudiante, col.criterion.id_criterio, 'criterion', $event)"
                        placeholder="0.0"
                        class="w-16 bg-white border border-slate-200 rounded-xl p-2.5 text-center text-sm font-black text-slate-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all outline-none"
                      />
                    </template>
                    <template v-else-if="col.type === 'activity_total'">
                      <span class="w-16 inline-block bg-pink-50/50 border border-pink-100 rounded-xl p-2.5 text-center text-sm font-black text-pink-700">
                        {{ calculateActivityGrade(student.id_estudiante, col.activity).toFixed(1) }}
                      </span>
                    </template>
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
