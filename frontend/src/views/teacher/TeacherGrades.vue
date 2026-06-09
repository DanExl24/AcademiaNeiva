<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Settings,
  Loader2,
  Search,
  X,
  ClipboardList
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
  jornada_nombre: string
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
const selectedGradeName = ref<string | null>(null)
const selectedSection = ref<string | null>(null)
const selectedJornada = ref<string | null>(null)
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
const scales = ref<any[]>([])
const saving = ref(false)
const activitiesLoading = ref(false)
const competencySaving = ref(false)

// Búsqueda de estudiantes
const studentSearch = ref('')

const filteredStudents = computed(() => {
  const allStudents = Array.isArray(students.value) ? students.value : []
  if (!studentSearch.value.trim()) return allStudents
  
  const query = studentSearch.value.toLowerCase().trim()
  return allStudents.filter(s => {
    const nombre = (s.nombre || '').toLowerCase()
    const apellido = (s.apellido || '').toLowerCase()
    const codigo = (s.codigo || '').toLowerCase()
    return nombre.includes(query) || apellido.includes(query) || codigo.includes(query)
  })
})

// Estado de nueva actividad
const showAddActivity = ref(false)
const newActivity = ref({
  nombre: '',
  porcentaje: 0,
  id_evidencia: null as number | null
})

// Cargar cursos asignados
const fetchMyCourses = async () => {
  // In monitoring mode, load the observed teacher's courses
  const teacherId = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
  try {
    const response = await axios.get(`http://localhost:3000/api/teacher/courses/${teacherId}`)
    myCourses.value = response.data
    
    if (route.query.gradoId) {
      const gId = Number(route.query.gradoId)
      const sId = route.query.subjectId ? Number(route.query.subjectId) : null
      
      const course = myCourses.value.find(c => c.id_grado === gId)
      if (course) {
        selectedGradeName.value = course.grado_nombre
        selectedSection.value = course.seccion
        selectedJornada.value = course.jornada_nombre
        if (sId) selectedSubjectId.value = sId
      }
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
      scales.value = response.data.scales || []
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

// ID de Grado (Grupo) seleccionado basado en los filtros
const selectedGradeId = computed(() => {
  const course = myCourses.value.find(c => 
    c.grado_nombre === selectedGradeName.value && 
    c.seccion === selectedSection.value && 
    c.jornada_nombre === selectedJornada.value
  )
  return course ? course.id_grado : null
})

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

const getScaleLevel = (grade: string | number) => {
  const val = typeof grade === 'string' ? parseFloat(grade) : grade
  if (isNaN(val)) return 'N/A'
  
  // Encontrar la escala que contiene la nota
  const scale = scales.value.find(s => {
    const min = parseFloat(s.valor_minimo)
    const max = parseFloat(s.valor_maximo)
    return val >= min && val <= max
  })
  
  return scale ? scale.nivel : 'N/A'
}

const getScaleClass = (level: string) => {
  switch (level.toUpperCase()) {
    case 'SUPERIOR': return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
    case 'ALTO': return 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900'
    case 'BASICO': return 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
    case 'BAJO': return 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
    default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
  }
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

const gradeOptions = computed(() => {
  const grades = myCourses.value.map(c => c.grado_nombre)
  return [...new Set(grades)].sort()
})

const sectionOptions = computed(() => {
  if (!selectedGradeName.value) return []
  const sections = myCourses.value
    .filter(c => c.grado_nombre === selectedGradeName.value)
    .map(c => c.seccion)
  return [...new Set(sections)].sort()
})

const jornadaOptions = computed(() => {
  if (!selectedGradeName.value || !selectedSection.value) return []
  const jornadas = myCourses.value
    .filter(c => c.grado_nombre === selectedGradeName.value && c.seccion === selectedSection.value)
    .map(c => c.jornada_nombre)
  return [...new Set(jornadas)].sort()
})

const subjectsOptions = computed(() => {
  if (!selectedGradeName.value || !selectedSection.value || !selectedJornada.value) return []
  return myCourses.value
    .filter(c => 
      c.grado_nombre === selectedGradeName.value && 
      c.seccion === selectedSection.value && 
      c.jornada_nombre === selectedJornada.value
    )
    .map(c => ({ id: c.id_materia, label: c.materia_nombre }))
})

// Watchers
watch([selectedGradeName, selectedSection, selectedJornada], () => {
  selectedSubjectId.value = null
})

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
    <!-- Header Card -->
    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm transition-colors">
      <div class="flex items-center gap-6">
        <div class="p-4 bg-indigo-600 dark:bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
          <ClipboardList :size="32" />
        </div>
        <div>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Registro de Calificaciones</h1>
          <p class="text-slate-500 dark:text-slate-400 font-medium text-lg">Gestiona actividades y notas del periodo actual.</p>
        </div>
      </div>
      
      <!-- Save button: hidden in monitoring mode -->
      <div v-if="selectedSubjectId && selectedPeriodId && !auth.isMonitoring" class="flex gap-3">
        <button 
          @click="saveAllGrades"
          :disabled="saving || activitiesLoading"
          class="bg-emerald-600 dark:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Loader2 v-if="saving" class="w-5 h-5 animate-spin" />
          <Save v-else :size="20" />
          {{ saving ? 'Guardando...' : 'Guardar Todo' }}
        </button>
      </div>
      <div v-if="selectedSubjectId && selectedPeriodId && auth.isMonitoring" class="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-5 py-3 rounded-2xl">
        Solo Lectura
      </div>
    </div>

    <!-- Filtros en cascada -->
    <div class="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-end gap-6 transition-colors">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Grado</label>
          <select v-model="selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none">
            <option :value="null">Selecciona</option>
            <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Sección</label>
          <select v-model="selectedSection" :disabled="!selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="s in sectionOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Jornada</label>
          <select v-model="selectedJornada" :disabled="!selectedSection" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="j in jornadaOptions" :key="j" :value="j">{{ j }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedJornada" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50">
            <option :value="null">Selecciona</option>
            <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
      </div>

      <div class="w-full md:w-64 space-y-2">
        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Periodo Académico</label>
        <select v-model="selectedPeriodId" :disabled="periods.length === 0" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50">
          <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
            {{ p.nombre }} {{ p.estado === 'CERRADO' ? '(Cerrado)' : '' }}
          </option>
        </select>
      </div>
    </div>

    <!-- Empty Selection State -->
    <div v-if="!selectedSubjectId" class="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-20 text-center transition-colors">
      <div class="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
        <AlertCircle class="w-10 h-10 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-xl font-bold text-slate-400 dark:text-slate-500">Selecciona grado, sección, jornada y materia para comenzar</h3>
    </div>

    <!-- Main Content Grid -->
    <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">
      <!-- Left Panel: Activities & Competency -->
      <div class="xl:col-span-1 space-y-6">
        <!-- Competency View -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 bg-violet-50 dark:bg-violet-950/30 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen class="w-4 h-4 text-violet-500 dark:text-violet-400" />
            </div>
            <h3 class="text-lg font-black text-slate-900 dark:text-white">Competencia</h3>
          </div>

          <div v-if="!competencyDraft" class="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle class="w-8 h-8 text-slate-200 dark:text-slate-700 mb-2" />
            <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Sin competencia definida</p>
          </div>
          <div v-else class="space-y-4">
            <div class="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-2xl p-4">
              <p class="text-sm font-semibold text-violet-900 dark:text-violet-300 leading-relaxed">{{ competencyDraft }}</p>
              
              <div v-if="evidencias.length" class="mt-4 pt-4 border-t border-violet-200/60 dark:border-violet-800/60">
                <h4 class="text-[10px] font-black text-violet-900 dark:text-violet-400 uppercase tracking-wider mb-2">Evidencias</h4>
                <ul class="space-y-1.5">
                  <li v-for="ev in evidencias" :key="ev.id_evidencia" class="flex items-start gap-2">
                    <div class="w-1 h-1 rounded-full bg-violet-400 mt-1.5 shrink-0"></div>
                    <span class="text-[11px] font-medium text-violet-800 dark:text-violet-300/80">{{ ev.descripcion }}</span>
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
              <p class="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                Definida por la dirección académica
              </p>
            </div>
          </div>
        </div>

        <!-- Activities List -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Settings class="w-5 h-5 text-indigo-500" />
              Actividades
            </h3>
            <span :class="[totalPercentage === 100 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400', 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter']">
              {{ totalPercentage }}% / 100%
            </span>
          </div>

          <div class="space-y-4">
            <div v-for="act in activities" :key="act.id_actividadmateria" class="space-y-3">
              <div class="group relative p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                <div class="flex justify-between items-start">
                  <div>
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white">{{ act.nombre }}</h4>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Peso: {{ act.porcentaje }}%</p>
                  </div>
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="toggleAddCriterion(act.id_actividadmateria)" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all" title="Añadir criterio">
                      <Plus :size="14" />
                    </button>
                    <button @click="removeActivity(act.id_actividadmateria)" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all" title="Eliminar">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>

                <!-- Criterios List -->
                <div v-if="act.criterios && act.criterios.length > 0" class="mt-4 space-y-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                  <div v-for="crit in act.criterios" :key="crit.id_criterio" class="flex items-center justify-between bg-white dark:bg-slate-900/50 p-2 rounded-xl text-[11px] group/crit shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900">
                    <span class="font-medium text-slate-600 dark:text-slate-300 truncate pr-2">{{ crit.descripcion }}</span>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="font-black text-indigo-500">{{ crit.porcentaje }}%</span>
                      <button @click="removeCriterion(act, crit.id_criterio)" class="text-slate-300 hover:text-red-500 opacity-0 group-hover/crit:opacity-100 p-0.5">
                        <X :size="12" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Add Criterion Form -->
                <div v-if="newCriterion[act.id_actividadmateria]" class="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-3 animate-in slide-in-from-top-1 duration-200 shadow-sm">
                  <input v-model="newCriterion[act.id_actividadmateria].descripcion" type="text" placeholder="Descripción..." class="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white" />
                  <div class="flex gap-2">
                    <input v-model.number="newCriterion[act.id_actividadmateria].porcentaje" type="number" placeholder="Peso %" class="w-20 bg-slate-50 dark:bg-slate-800 border-0 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white" />
                    <button @click="addCriterion(act)" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-black uppercase">Añadir</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- New Activity Button/Form: hidden in monitoring mode -->
            <button 
              v-if="!showAddActivity && totalPercentage < 100 && !auth.isMonitoring"
              @click="showAddActivity = true"
              class="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all font-bold text-sm"
            >
              <Plus :size="16" />
              Nueva Actividad
            </button>

            <div v-if="showAddActivity" class="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900 space-y-4 animate-in zoom-in-95">
              <div class="space-y-1">
                <label class="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Evidencia *</label>
                <select v-model="newActivity.id_evidencia" class="w-full bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 outline-none">
                  <option :value="null">Selecciona</option>
                  <option v-for="ev in evidencias" :key="ev.id_evidencia" :value="ev.id_evidencia">
                    E{{ ev.orden }}: {{ ev.descripcion }}
                  </option>
                </select>
              </div>
              <input v-model="newActivity.nombre" type="text" placeholder="Nombre (ej: Taller 1)" class="w-full bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900 rounded-xl px-3 py-2.5 text-xs font-bold outline-none dark:text-white" />
              <div class="flex items-center gap-3">
                <input v-model.number="newActivity.porcentaje" type="number" placeholder="%" class="w-24 bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900 rounded-xl px-3 py-2.5 text-xs font-bold outline-none dark:text-white" />
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">% del total</span>
              </div>
              <div class="flex gap-2">
                <button @click="showAddActivity = false" class="flex-1 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                <button @click="addActivity" class="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 dark:shadow-none">Crear</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Grade Matrix -->
      <div class="xl:col-span-3 space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div class="flex items-center gap-3">
               <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                 <Users :size="20" />
               </div>
               <h3 class="text-xl font-black text-slate-900 dark:text-white">Planilla de Notas</h3>
             </div>

             <!-- In-Table Search -->
             <div v-if="students.length > 0" class="relative w-full md:w-72">
               <input 
                 v-model="studentSearch"
                 type="text"
                 placeholder="Buscar estudiante..."
                 class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300"
               />
               <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
               <button v-if="studentSearch" @click="studentSearch = ''" class="absolute right-3.5 top-3.5 text-slate-400">
                 <X :size="14" />
               </button>
             </div>
          </div>

          <!-- Table Container -->
          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th class="p-6 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Estudiante</th>
                  
                  <!-- Dynamic Columns for Activities/Criteria -->
                  <th v-for="col in tableColumns" :key="col.id" 
                      :class="['p-4 text-center border-l border-slate-100 dark:border-slate-800 min-w-[120px]', col.type === 'activity_total' ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : '']">
                    <div class="space-y-1">
                      <div v-if="col.type === 'activity'" class="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">{{ col.activity.nombre }}</div>
                      <div v-else-if="col.type === 'criterion'" class="text-[9px] font-black text-indigo-500 uppercase tracking-tighter truncate" :title="col.activity.nombre">{{ col.activity.nombre }}</div>
                      <div v-else-if="col.type === 'activity_total'" class="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">Total {{ col.activity.nombre }}</div>
                      
                      <div class="text-xs font-black text-slate-700 dark:text-slate-200 truncate max-w-[100px] mx-auto">
                        {{ col.type === 'criterion' ? col.criterion.descripcion : (col.type === 'activity_total' ? 'Σ' : col.activity.nombre) }}
                      </div>
                      <div class="text-[10px] font-bold text-slate-400">
                        {{ col.type === 'criterion' ? col.criterion.porcentaje : col.activity.porcentaje }}%
                      </div>
                    </div>
                  </th>

                  <th class="p-6 text-center text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest bg-slate-100 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Nota Definitiva</th>
                  <th class="p-6 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nivel</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="st in filteredStudents" 
                  :key="st.id_estudiante"
                  class="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                >
                  <td class="p-6 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.01)]">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black">
                        {{ st.nombre.charAt(0) }}{{ st.apellido.charAt(0) }}
                      </div>
                      <div>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">{{ st.nombre }} {{ st.apellido }}</p>
                        <p class="text-[9px] font-medium text-slate-400">{{ st.codigo }}</p>
                      </div>
                    </div>
                  </td>

                  <!-- Grades Inputs -->
                  <td v-for="col in tableColumns" :key="col.id" class="p-2 border-l border-slate-50 dark:border-slate-800/50 text-center">
                    <input 
                      v-if="col.type === 'activity' && gradesMatrix[st.id_estudiante]"
                      type="number"
                      step="0.1"
                      v-model="gradesMatrix[st.id_estudiante][col.activity.id_actividadmateria]"
                      @blur="validateGradeInput(st.id_estudiante, col.activity.id_actividadmateria, 'activity', $event)"
                      class="w-16 mx-auto bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-2 text-center font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <input 
                      v-else-if="col.type === 'criterion' && criteriaGradesMatrix[st.id_estudiante]"
                      type="number"
                      step="0.1"
                      v-model="criteriaGradesMatrix[st.id_estudiante][col.criterion.id_criterio]"
                      @blur="validateGradeInput(st.id_estudiante, col.criterion.id_criterio, 'criterion', $event)"
                      class="w-16 mx-auto bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-2 text-center font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div v-else-if="col.type === 'activity_total'" class="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 py-2 rounded-lg w-16 mx-auto border border-indigo-100 dark:border-indigo-900">
                      {{ calculateActivityGrade(st.id_estudiante, col.activity).toFixed(1) }}
                    </div>
                  </td>

                  <!-- Final Grade -->
                  <td class="p-6 text-center bg-slate-50/50 dark:bg-slate-800/30 border-l border-slate-100 dark:border-slate-800">
                    <div 
                      :class="[
                        parseFloat(calculateFinal(st.id_estudiante)) >= gradeRange.approval ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900',
                        'inline-flex items-center justify-center w-14 h-10 rounded-xl font-black text-lg border shadow-sm'
                      ]"
                    >
                      {{ calculateFinal(st.id_estudiante) }}
                    </div>
                  </td>

                  <!-- Academic Scale -->
                  <td class="p-6 text-center">
                    <span 
                      :class="[
                        getScaleClass(getScaleLevel(calculateFinal(st.id_estudiante))),
                        'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border'
                      ]"
                    >
                      {{ getScaleLevel(calculateFinal(st.id_estudiante)) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-if="filteredStudents.length === 0 && students.length > 0" class="p-20 text-center">
            <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search class="w-8 h-8 text-slate-300" />
            </div>
            <p class="text-sm font-bold text-slate-400">No se encontraron estudiantes con ese nombre o código</p>
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

.custom-scrollbar::-webkit-scrollbar {
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #1e293b;
}
</style>
