<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Settings,
  CheckCircle,
  Loader2,
  Search,
  X,
  ClipboardList,
  Download,
  BookOpen,
  Users,
  Eye,
  AlertTriangle
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import axios from 'axios'

const yearStore = useAcademicYearStore()

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
  evidencias_dba?: number[]
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

const schoolId = computed(() => Number(auth.user?.schoolId || auth.selectedSchoolId || 0))


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
const competenciasList = ref<any[]>([])
const students = ref<Student[]>([])
const gradesMatrix = ref<Record<number, Record<number, any>>>({}) 
const criteriaGradesMatrix = ref<Record<number, Record<number, any>>>({})
const gradeRange = ref({ min: 0, max: 5, approval: 3 })
const scales = ref<any[]>([])
const saving = ref(false)
const activitiesLoading = ref(false)

// Búsqueda de estudiantes
const studentSearch = ref('')

const selectedPeriod = computed(() => {
  return periods.value.find(p => p.id_periodo === selectedPeriodId.value)
})

const isPeriodClosed = computed(() => {
  return selectedPeriod.value?.estado === 'CERRADO'
})

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
  id_evidencia: null as number | null,
  evidencias_dba: [] as number[],
  motivo_extra: '',
  justificacion_extra: ''
})

const dbaEvidencesInfo = ref<{
  usaDba: boolean
  versionCurricular?: string
  planeadas: any[]
  extras: any[]
  dba?: any[]
} | null>(null)

const selectedEvidencesNeedJustification = computed(() => {
  if (!newActivity.value.evidencias_dba || newActivity.value.evidencias_dba.length === 0 || !dbaEvidencesInfo.value?.dba) return false
  for (const id of newActivity.value.evidencias_dba) {
    for (const dbaItem of dbaEvidencesInfo.value.dba) {
      const ev = dbaItem.evidencias?.find((e: any) => e.id_evidencia_dba === id)
      if (ev && ev.tipo === 'EXTRA' && ev.planeada_otro_periodo_nombre) {
        return true
      }
    }
  }
  return false
})

// Drawer y filtros
const isDrawerOpen = ref(false)
const showWarningModal = ref(false)
const showExtraModal = ref(false)

const openDrawer = () => {
  if (auth.isMonitoring || isPeriodClosed.value) return
  console.log('openDrawer triggered')
  isDrawerOpen.value = true
}

const closeDrawer = () => {
  console.log('closeDrawer triggered')
  isDrawerOpen.value = false
}

const plannedDbaItems = computed(() => {
  if (!dbaEvidencesInfo.value || !dbaEvidencesInfo.value.dba) return []
  return dbaEvidencesInfo.value.dba.map(dbaItem => {
    const filteredEvs = dbaItem.evidencias.filter((ev: any) => ev.tipo === 'PLANEADA')
    return {
      ...dbaItem,
      evidencias: filteredEvs
    }
  }).filter(dbaItem => dbaItem.evidencias.length > 0)
})

const extraDbaItems = computed(() => {
  if (!dbaEvidencesInfo.value || !dbaEvidencesInfo.value.dba) return []
  return dbaEvidencesInfo.value.dba.map(dbaItem => {
    const filteredEvs = dbaItem.evidencias.filter((ev: any) => ev.tipo === 'EXTRA')
    return {
      ...dbaItem,
      evidencias: filteredEvs
    }
  }).filter(dbaItem => dbaItem.evidencias.length > 0)
})

const selectedExtraEvidencesList = computed(() => {
  if (!newActivity.value.evidencias_dba || newActivity.value.evidencias_dba.length === 0 || !dbaEvidencesInfo.value?.dba) return []
  const list: any[] = []
  for (const id of newActivity.value.evidencias_dba) {
    for (const dbaItem of dbaEvidencesInfo.value.dba) {
      const ev = dbaItem.evidencias?.find((e: any) => e.id_evidencia_dba === id)
      if (ev && ev.tipo === 'EXTRA') {
        list.push({
          id_evidencia_dba: ev.id_evidencia_dba,
          descripcion: ev.descripcion,
          planeada_otro_periodo_nombre: ev.planeada_otro_periodo_nombre,
          numero_dba: dbaItem.numero_dba
        })
      }
    }
  }
  return list
})

const selectedExtraEvidencesCount = computed(() => selectedExtraEvidencesList.value.length)

// Cargar cursos asignados
const fetchMyCourses = async () => {
  // In monitoring mode, load the observed teacher's courses
  const teacherId = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
  try {
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const response = await axios.get(`/api/teacher/courses/${teacherId}`, { params })
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
  }
}

// Cargar periodos
const fetchPeriods = async () => {
  if (!schoolId.value) return
  try {
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const response = await axios.get(`/api/teacher/periods/${schoolId.value}`, { params })
    periods.value = (response.data || []).filter((p: any) => p.estado !== 'PENDIENTE')
    
    const exists = periods.value.some(p => p.id_periodo === selectedPeriodId.value)
    if (!exists) {
      const openPeriod = periods.value.find(p => p.estado === 'ABIERTO')
      if (openPeriod) {
        selectedPeriodId.value = openPeriod.id_periodo
      } else if (periods.value.length > 0) {
        selectedPeriodId.value = periods.value[0].id_periodo
      } else {
        selectedPeriodId.value = null
      }
    }
  } catch (error) {
    periods.value = []
    selectedPeriodId.value = null
  }
}

watch(() => yearStore.selectedYearId, async () => {
  selectedPeriodId.value = null
  await fetchMyCourses()
  await fetchPeriods()
  if (selectedGradeId.value && selectedSubjectId.value && selectedPeriodId.value) {
    await fetchGrades()
  }
})

const fetchGradeRange = async () => {
  if (!schoolId.value) return
  try {
    const response = await axios.get(`/api/academic-admin/settings/${schoolId.value}`)
    if (response.data?.defaultSettings) {
      gradeRange.value = {
        min: Number(response.data.defaultSettings.nota_minima),
        max: Number(response.data.defaultSettings.nota_maxima),
        approval: Number(response.data.defaultSettings.nota_aprobacion),
      }
      scales.value = response.data.scales || []
    }
  } catch (error) {
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
  const gId = course ? course.id_grado : null
  return gId
})

// Cargar notas actuales
const fetchGrades = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) return
  try {
    gradesMatrix.value = {}
    criteriaGradesMatrix.value = {}
    const response = await axios.get(`/api/teacher/grades/${selectedGradeId.value}/${selectedSubjectId.value}/${selectedPeriodId.value}`)
    
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
  }
}

const fetchDbaEvidences = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value) {
    dbaEvidencesInfo.value = null
    return
  }
  try {
    const res = await axios.get(`/api/teacher/courses/${selectedGradeId.value}/${selectedSubjectId.value}/evidencias-dba`, {
      params: { 
        schoolId: schoolId.value,
        periodId: selectedPeriodId.value
      }
    })
    dbaEvidencesInfo.value = res.data
  } catch (error) {
    console.error('Error fetching competency DBA evidences:', error)
    dbaEvidencesInfo.value = null
  }
}

// Cargar actividades
const fetchActivities = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) return
  try {
    activitiesLoading.value = true
    const response = await axios.get(`/api/teacher/activities/${selectedGradeId.value}/${selectedSubjectId.value}/${selectedPeriodId.value}`, {
      params: { userId: auth.user?.id }
    })
    competency.value = response.data.competencia
    competencyDraft.value = response.data.competencia?.descripcion || ''
    evidencias.value = response.data.evidencias || []
    competenciasList.value = response.data.competenciasList || []
    activities.value = response.data.activities || []
    await fetchDbaEvidences()
    await fetchGrades()
  } catch (error) {
    competency.value = null
    competencyDraft.value = ''
    evidencias.value = []
    competenciasList.value = []
    activities.value = []
    dbaEvidencesInfo.value = null
  } finally {
    activitiesLoading.value = false
  }
}

// Cargar estudiantes
const fetchStudents = async () => {
  if (!selectedGradeId.value) return
  try {
    const response = await axios.get(`/api/teacher/students/${selectedGradeId.value}`)
    students.value = response.data
    initializeMatrixForStudents()
  } catch (error: any) {
  }
}

const autosaveStatus = ref<'saved' | 'saving' | 'error'>('saved')
const autosaveErrorMsg = ref('')

const autosaveGrade = async (studentId: number, id: number, type: 'activity' | 'criterion', val: number) => {
  try {
    autosaveStatus.value = 'saving'
    autosaveErrorMsg.value = ''
    
    await axios.post('/api/teacher/grades', {
      activityGrades: type === 'activity' ? [{ id_estudiante: studentId, id_actividadmateria: id, nota: val }] : [],
      criteriaGrades: type === 'criterion' ? [{ id_estudiante: studentId, id_criterio: id, nota: val }] : [],
      schoolId: schoolId.value
    })
    
    autosaveStatus.value = 'saved'
  } catch (error: any) {
    autosaveStatus.value = 'error'
    autosaveErrorMsg.value = error.response?.data?.error || 'Error al autoguardar nota'
    console.error('Error in autosave:', error)
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

  // Disparar autoguardado automático al perder el foco
  autosaveGrade(studentId, id, type, val)
}

// Guardar todas las notas
const saveAllGrades = async (silent = false) => {
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
          const val = parseFloat(nota.toString())
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
        const val = parseFloat(nota.toString())
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
    if (!silent) {
      alert(`Todas las calificaciones deben estar dentro del rango institucional permitido: ${gradeRange.value.min} - ${gradeRange.value.max}`)
    }
    throw new Error('Calificaciones inválidas')
  }

  if (activityGradesToSave.length === 0 && criteriaGradesToSave.length === 0) return

  try {
    saving.value = true
    await axios.post('/api/teacher/grades', {
      activityGrades: activityGradesToSave,
      criteriaGrades: criteriaGradesToSave,
      schoolId: schoolId.value
    })
    if (!silent) {
      alert('Calificaciones guardadas exitosamente')
    }
  } catch (error: any) {
    const msg = error.response?.data?.error || 'Error al guardar calificaciones'
    if (!silent) {
      alert(msg)
    }
    throw new Error(msg)
  } finally {
    saving.value = false
  }
}

// Agregar actividad
const addActivity = async () => {
  const isDba = dbaEvidencesInfo.value?.usaDba
  if (isDba) {
    if (!newActivity.value.nombre || newActivity.value.porcentaje <= 0 || !newActivity.value.evidencias_dba.length) {
      alert('Debes seleccionar al menos una evidencia del DBA, un nombre y un porcentaje.')
      return
    }

    if (selectedEvidencesNeedJustification.value) {
      if (!newActivity.value.motivo_extra) {
        alert('Debes seleccionar un motivo para evaluar evidencias planificadas en otros periodos.')
        return
      }
      if (newActivity.value.motivo_extra === 'OTRO' && !newActivity.value.justificacion_extra.trim()) {
        alert('Debes escribir una justificación detallada para el motivo "Otro".')
        return
      }
    }
  } else {
    if (!newActivity.value.nombre || newActivity.value.porcentaje <= 0 || !newActivity.value.id_evidencia) {
      alert('Debes seleccionar una evidencia de aprendizaje, un nombre y un porcentaje.')
      return
    }
  }

  try {
    // 1. Guardar silenciosamente las notas en pantalla antes de proceder (previene reseteo a 0)
    await saveAllGrades(true)

    // 2. Resolver id_detallegrado usando id_grado (selectedGradeId)
    const matchedCourse = myCourses.value.find(c => c.id_grado === selectedGradeId.value && c.id_materia === selectedSubjectId.value)
    const idDetalleGrado = matchedCourse ? matchedCourse.id_detallegrado : null

    const payload: any = {
      id_competencia: competency.value?.id_competencia || null,
      id_detallegrado: idDetalleGrado,
      id_periodo: selectedPeriodId.value,
      nombre: newActivity.value.nombre,
      porcentaje: newActivity.value.porcentaje,
      id_colegio: schoolId.value
    }

    if (!payload.id_detallegrado) {
      alert('No se pudo identificar la asignación del curso.')
      return
    }

    if (isDba) {
      payload.evidencias_dba = newActivity.value.evidencias_dba
      if (selectedEvidencesNeedJustification.value) {
        payload.motivo_extra = newActivity.value.motivo_extra
        if (newActivity.value.motivo_extra === 'OTRO') {
          payload.justificacion_extra = newActivity.value.justificacion_extra
        }
      }
    } else {
      payload.id_evidencia = newActivity.value.id_evidencia
    }

    await axios.post('/api/teacher/activities', payload)
    newActivity.value = {
      nombre: '',
      porcentaje: 0,
      id_evidencia: null,
      evidencias_dba: [],
      motivo_extra: '',
      justificacion_extra: ''
    }
    showAddActivity.value = false
    await fetchActivities()
  } catch (error: any) {
    // Si fue un error de validación interna de notas, no creamos la actividad y dejamos los cambios en pantalla
    if (error.message !== 'Calificaciones inválidas') {
      alert(error.response?.data?.error || error.message || 'Error al crear actividad')
    }
  }
}

const getDbaEvidenceDetails = (act: Activity) => {
  if (!act.evidencias_dba || !Array.isArray(act.evidencias_dba) || act.evidencias_dba.length === 0) return []
  if (!dbaEvidencesInfo.value) return []
  
  const result: Array<{
    id_evidencia_dba: number
    numero_dba: number
    descripcion: string
    tipo: 'PLANEADA' | 'EXTRA'
    id_competencia: number | null
  }> = []

  for (const id of act.evidencias_dba) {
    let found = false
    if (dbaEvidencesInfo.value.dba) {
      for (const dbaItem of dbaEvidencesInfo.value.dba) {
        const match = dbaItem.evidencias.find((e: any) => e.id_evidencia_dba === id)
        if (match) {
          result.push({
            id_evidencia_dba: id,
            numero_dba: dbaItem.numero_dba,
            descripcion: match.descripcion,
            tipo: match.tipo,
            id_competencia: match.id_competencia || null
          })
          found = true
          break
        }
      }
    }
    
    if (!found) {
      const planeadaMatch = dbaEvidencesInfo.value.planeadas?.find(e => e.id_evidencia_dba === id)
      if (planeadaMatch) {
        result.push({
          id_evidencia_dba: id,
          numero_dba: planeadaMatch.numero_dba,
          descripcion: planeadaMatch.descripcion,
          tipo: 'PLANEADA',
          id_competencia: planeadaMatch.id_competencia || null
        })
      } else {
        const extraMatch = dbaEvidencesInfo.value.extras?.find(e => e.id_evidencia_dba === id)
        if (extraMatch) {
          result.push({
            id_evidencia_dba: id,
            numero_dba: extraMatch.numero_dba,
            descripcion: extraMatch.descripcion,
            tipo: 'EXTRA',
            id_competencia: extraMatch.id_competencia || null
          })
        }
      }
    }
  }
  
  return result
}

// const saveCompetency = async () => {
//   if (!competency.value || !competencyDraft.value.trim() || competencySaving.value) return
// 
//   try {
//     competencySaving.value = true
//     const response = await axios.put(`/api/teacher/competencies/${competency.value.id_competencia}`, {
//       descripcion: competencyDraft.value
//     })
//     competency.value = response.data
//     competencyDraft.value = response.data.descripcion
//   } catch (error: any) {
//     alert(error.response?.data?.error || 'Error al guardar la competencia')
//   } finally {
//     competencySaving.value = false
//   }
// }

// Eliminar actividad
const removeActivity = async (id: number) => {
  if (!confirm('¿Estás seguro de eliminar esta actividad?')) return
  try {
    await axios.delete(`/api/teacher/activities/${id}`)
    activities.value = activities.value.filter(a => a.id_actividadmateria !== id)
  } catch (error) {
    console.error('Error deleting activity:', error)
  }
}

// Actualizar peso de actividad
const updateActivityWeight = async (act: Activity) => {
  const percentage = parseFloat(act.porcentaje.toString())
  if (isNaN(percentage) || percentage <= 0) {
    alert('El peso debe ser un número mayor a 0.')
    await fetchActivities()
    return
  }

  try {
    const payload = {
      nombre: act.nombre,
      porcentaje: percentage,
      evidencias_dba: act.evidencias_dba || []
    }
    await axios.put(`/api/teacher/activities/${act.id_actividadmateria}`, payload)
    await fetchActivities() // Recargar para actualizar los totales y consolidar matrices
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al actualizar el porcentaje de la actividad')
    await fetchActivities()
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

const getLinkedCompetencyIndex = (idCompetencia: number | null) => {
  if (!idCompetencia) return null
  const idx = competenciasList.value.findIndex(comp => Number(comp.id_competencia) === Number(idCompetencia))
  return idx !== -1 ? idx + 1 : null
}

const getDbaNumberForCompetency = (comp: any) => {
  if (!comp || !comp.evidencias || !Array.isArray(comp.evidencias)) return null
  const firstWithDba = comp.evidencias.find((e: any) => e && e.numero_dba !== null && e.numero_dba !== undefined)
  return firstWithDba ? firstWithDba.numero_dba : null
}

const getLinkedActivityForEvidence = (evIdDba: number | null) => {
  if (!evIdDba) return null
  const linkedAct = activities.value.find(act => 
    act.evidencias_dba && Array.isArray(act.evidencias_dba) && act.evidencias_dba.map(Number).includes(Number(evIdDba))
  )
  return linkedAct ? linkedAct.nombre : null
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
    const response = await axios.post('/api/teacher/activities/criteria', {
      id_actividadmateria: act.id_actividadmateria,
      id_evidencia: form.id_evidencia,
      descripcion: form.descripcion,
      porcentaje: form.porcentaje,
      id_colegio: schoolId.value
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
    await axios.delete(`/api/teacher/activities/criteria/${criterionId}`)
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
  if (selectedGradeId.value) {
    fetchStudents()
  } else {
  }
})
watch(schoolId, (newSchoolId) => {
  if (newSchoolId) {
    fetchGradeRange()
    fetchPeriods()
  }
}, { immediate: true })

const exportGradesToCSV = () => {
  if (students.value.length === 0) return

  const dynamicHeaders = tableColumns.value.map(col => {
    if (col.type === 'activity') {
      return `"${col.activity.nombre} (${col.activity.porcentaje}%)"`
    } else if (col.type === 'criterion') {
      return `"${col.activity.nombre} - ${col.criterion?.descripcion} (${col.criterion?.porcentaje}%)"`
    } else {
      return `"Total ${col.activity.nombre} (${col.activity.porcentaje}%)"`
    }
  })

  const headers = [
    'Código Estudiante',
    'Estudiante',
    ...dynamicHeaders,
    'Nota Definitiva',
    'Nivel Desempeño'
  ]

  const rows = students.value.map(st => {
    const rowData = [
      st.codigo,
      `"${st.nombre} ${st.apellido}"`
    ]

    tableColumns.value.forEach(col => {
      if (col.type === 'activity') {
        const studentGrades = gradesMatrix.value[st.id_estudiante] || {}
        rowData.push(studentGrades[col.activity.id_actividadmateria] ?? '')
      } else if (col.type === 'criterion') {
        const cGrades = criteriaGradesMatrix.value[st.id_estudiante] || {}
        rowData.push(cGrades[col.criterion?.id_criterio ?? 0] ?? '')
      } else if (col.type === 'activity_total') {
        rowData.push(calculateActivityGrade(st.id_estudiante, col.activity).toFixed(1))
      }
    })

    const finalGrade = calculateFinal(st.id_estudiante)
    rowData.push(finalGrade)
    rowData.push(getScaleLevel(finalGrade))

    return rowData
  })

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  
  const label = `${selectedGradeName.value || ''}_${selectedSection.value || ''}_${selectedSubjectId.value || ''}`.replace(/\s+/g, '_')
  link.setAttribute('download', `consolidado_notas_${label}_${new Date().toLocaleDateString()}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  fetchMyCourses()
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
      
      <!-- Actions buttons -->
      <div v-if="selectedSubjectId && selectedPeriodId" class="flex flex-wrap items-center gap-3">
        <!-- Autosave Indicator -->
        <div v-if="!auth.isMonitoring && !isPeriodClosed" class="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-850 h-[46px]">
          <div v-if="autosaveStatus === 'saving'" class="flex items-center gap-1.5 text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
            <Loader2 class="w-3.5 h-3.5 animate-spin" />
            <span>Guardando...</span>
          </div>
          <div v-else-if="autosaveStatus === 'saved'" class="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            <CheckCircle class="w-3.5 h-3.5" />
            <span>Guardado</span>
          </div>
          <div v-else-if="autosaveStatus === 'error'" class="flex items-center gap-1.5 text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest" :title="autosaveErrorMsg">
            <AlertCircle class="w-3.5 h-3.5" />
            <span>Error</span>
          </div>
        </div>

        <button 
          v-if="!auth.isMonitoring"
          @click="saveAllGrades(false)"
          :disabled="saving || activitiesLoading || isPeriodClosed"
          class="bg-emerald-600 dark:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Loader2 v-if="saving" class="w-5 h-5 animate-spin" />
          <Save v-else :size="20" />
          {{ saving ? 'Guardando...' : 'Guardar Todo' }}
        </button>
        <button 
          @click="exportGradesToCSV"
          :disabled="saving || activitiesLoading || students.length === 0"
          class="bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
        >
          <Download :size="20" />
          Exportar CSV
        </button>
        <button
          @click="openDrawer"
          class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <BookOpen :size="20" class="text-indigo-500" />
          Configurar Actividades
        </button>
        <div v-if="auth.isMonitoring || isPeriodClosed" class="text-amber-600 font-bold text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-5 py-3 rounded-2xl">
          Solo Lectura
        </div>
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

    <div v-else class="space-y-6 animate-in fade-in duration-500">
      <!-- Read Only Period Warning -->
      <div v-if="isPeriodClosed" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-3xl p-6 flex items-start gap-4 animate-in slide-in-from-top duration-300 transition-colors">
        <AlertCircle class="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 class="font-black text-amber-900 dark:text-amber-200">Planilla en Modo Solo Lectura</h4>
          <p class="text-xs text-amber-700 dark:text-amber-450 mt-1">
            El periodo académico <strong>"{{ selectedPeriod?.nombre }}"</strong> está cerrado institucionalmente y no admite modificaciones en las calificaciones, criterios o actividades.
          </p>
        </div>
      </div>
      <!-- Competency top banner -->
      <div v-if="competency" class="bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100/80 dark:border-violet-900 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all shadow-sm">
        <div class="flex items-start gap-4">
          <div class="p-3 bg-violet-600 dark:bg-violet-500 rounded-2xl text-white shadow-lg shadow-violet-100 dark:shadow-none shrink-0">
            <BookOpen :size="24" />
          </div>
          <div>
            <span class="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest block">Competencia del Periodo</span>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed max-w-4xl whitespace-pre-line">{{ competency.descripcion }}</p>
          </div>
        </div>
        <button 
          v-if="!auth.isMonitoring && !isPeriodClosed"
          @click="openDrawer"
          class="shrink-0 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-violet-700 dark:text-violet-300 font-bold px-6 py-3 rounded-2xl transition-all flex items-center gap-2 active:scale-95 border border-violet-100 dark:border-violet-850 text-xs shadow-sm self-start md:self-auto"
        >
          <Settings :size="16" />
          Configurar Actividades
        </button>
      </div>

      <!-- Grade Matrix Container -->
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

        <!-- Empty Activities State -->
        <div v-if="activities.length === 0 && students.length > 0" class="p-20 text-center">
          <div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <ClipboardList :size="32" />
          </div>
          <p class="text-base font-bold text-slate-700 dark:text-slate-300">No hay actividades creadas para este periodo</p>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Crea actividades y asigna evidencias DBA para comenzar a calificar.</p>
          <button 
            v-if="!auth.isMonitoring && !isPeriodClosed"
            @click="openDrawer"
            class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95"
          >
            <Plus :size="16" />
            Configurar Actividades
          </button>
        </div>

        <!-- Table Container -->
        <div v-else class="overflow-x-auto custom-scrollbar">
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
                      {{ col.type === 'criterion' ? col.criterion?.descripcion : (col.type === 'activity_total' ? 'Σ' : col.activity.nombre) }}
                    </div>
                    <div class="text-[10px] font-bold text-slate-400">
                      {{ col.type === 'criterion' ? col.criterion?.porcentaje : col.activity.porcentaje }}%
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
                    :disabled="auth.isMonitoring || isPeriodClosed"
                    class="w-16 mx-auto bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-2 text-center font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                  <input 
                    v-else-if="col.type === 'criterion' && criteriaGradesMatrix[st.id_estudiante]"
                    type="number"
                    step="0.1"
                    v-model="criteriaGradesMatrix[st.id_estudiante][col.criterion!.id_criterio]"
                    @blur="validateGradeInput(st.id_estudiante, col.criterion!.id_criterio, 'criterion', $event)"
                    :disabled="auth.isMonitoring || isPeriodClosed"
                    class="w-16 mx-auto bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-2 text-center font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-75 disabled:cursor-not-allowed"
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

    <!-- Slide-Over Drawer -->
    <div v-if="isDrawerOpen" class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="closeDrawer"></div>
      
      <div class="absolute inset-y-0 right-0 pl-10 max-w-full flex">
        <div class="w-screen max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all transform duration-300 ease-in-out border-l border-slate-100 dark:border-slate-800">
          <!-- Drawer Header -->
          <div class="px-6 py-5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Settings :size="20" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white leading-none">Gestión Pedagógica</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">Configura actividades y evidencias DBA</p>
              </div>
            </div>
            <button @click="closeDrawer" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <X :size="20" />
            </button>
          </div>
          
          <!-- Drawer Body (scrollable) -->
          <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <!-- Section 1: Active Competency -->
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 bg-violet-50 dark:bg-violet-950/30 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen class="w-4 h-4 text-violet-500 dark:text-violet-400" />
                </div>
                <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Competencia del Periodo</h3>
              </div>

              <div v-if="!competency" class="flex flex-col items-center justify-center py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-850">
                <AlertCircle class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Sin competencia definida</p>
              </div>
              <div v-else class="space-y-4">
                <!-- Si hay competencias estructuradas (agrupadas por DBA) -->
                <div v-if="competenciasList.length" class="space-y-4">
                  <div v-for="(comp, cIdx) in competenciasList" :key="comp.id_competencia" class="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md">
                    <span class="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest block mb-1">
                      Competencia #{{ cIdx + 1 }}{{ getDbaNumberForCompetency(comp) ? ` / DBA #${getDbaNumberForCompetency(comp)}` : '' }}
                    </span>
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{{ comp.descripcion }}</p>
                    
                    <div v-if="comp.evidencias && comp.evidencias.length" class="mt-3 pt-3 border-t border-violet-200/40 dark:border-violet-800/60">
                      <h4 class="text-[9px] font-black text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-2">Evidencias</h4>
                      <ul class="space-y-1.5">
                        <li v-for="ev in comp.evidencias" :key="ev.id_evidencia" class="flex items-start gap-2">
                          <div class="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></div>
                          <span class="text-[10px] font-semibold text-violet-900/80 dark:text-violet-300/80 leading-relaxed">{{ ev.descripcion }}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Fallback tradicional si no se cargaron estructuradas -->
                <div v-else class="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-2xl p-4">
                  <p class="text-sm font-semibold text-violet-900 dark:text-violet-300 leading-relaxed whitespace-pre-line">{{ competency.descripcion }}</p>
                  
                  <div v-if="evidencias.length" class="mt-4 pt-4 border-t border-violet-200/60 dark:border-violet-800/60">
                    <h4 class="text-[10px] font-black text-violet-900 dark:text-violet-400 uppercase tracking-wider mb-2">Evidencias Vinculadas</h4>
                    <ul class="space-y-1.5">
                      <li v-for="ev in evidencias" :key="ev.id_evidencia" class="flex items-start gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></div>
                        <span class="text-[11px] font-medium text-violet-800 dark:text-violet-300/80 leading-relaxed">{{ ev.descripcion }}</span>
                      </li>
                    </ul>
                  </div>
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
            

            <hr class="border-slate-100 dark:border-slate-800" />

            <!-- Section 2: Activities List & Creation -->
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg flex items-center justify-center shrink-0">
                    <ClipboardList class="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Actividades</h3>
                </div>
                <span :class="[totalPercentage === 100 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400', 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter']">
                  {{ totalPercentage }}% / 100%
                </span>
              </div>

              <!-- List of activities -->
              <div class="space-y-4">
                <div v-for="act in activities" :key="act.id_actividadmateria" class="space-y-3">
                  <div class="group relative p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-850 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                    <div class="flex justify-between items-start">
                      <div>
                        <h4 class="text-sm font-bold text-slate-900 dark:text-white">{{ act.nombre }}</h4>
                        <div class="flex items-center gap-1.5 mt-1">
                          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso:</span>
                          <input 
                            v-if="!auth.isMonitoring && !isPeriodClosed"
                            type="number" 
                            v-model.number="act.porcentaje" 
                            @blur="updateActivityWeight(act)"
                            @keyup.enter="($event.target as HTMLInputElement).blur()"
                            class="w-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-black text-center text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                          <span v-else class="text-[10px] font-black text-slate-600 dark:text-slate-400">{{ act.porcentaje }}%</span>
                        </div>
                        
                        <!-- DBA Evidences of Activity -->
                        <div v-if="dbaEvidencesInfo?.usaDba && getDbaEvidenceDetails(act).length > 0" class="mt-2 space-y-1.5">
                          <div v-for="ev in getDbaEvidenceDetails(act)" :key="ev.id_evidencia_dba" class="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex flex-col gap-0.5">
                            <div class="flex items-start gap-1.5 flex-wrap">
                              <span class="shrink-0 font-bold text-emerald-600 dark:text-emerald-400">DBA {{ ev.numero_dba }}:</span>
                              <span>{{ ev.descripcion }}</span>
                              <span :class="ev.tipo === 'PLANEADA' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'" class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase">
                                {{ ev.tipo }}
                              </span>
                            </div>
                            <div v-if="ev.tipo === 'PLANEADA' && getLinkedCompetencyIndex(ev.id_competencia)" class="flex flex-wrap gap-1 mt-1 pl-2">
                              <span class="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-[8px] font-black text-violet-700 dark:text-violet-400 border border-violet-200/40 dark:border-violet-900 uppercase tracking-wider">
                                Competencia {{ getLinkedCompetencyIndex(ev.id_competencia) }}{{ getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1]) ? ` / DBA ${getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1])}` : '' }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Delete & Add Criterion buttons -->
                      <div v-if="!auth.isMonitoring && !isPeriodClosed" class="flex gap-1">
                        <button @click="toggleAddCriterion(act.id_actividadmateria)" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all" title="Añadir criterio">
                          <Plus :size="14" />
                        </button>
                        <button @click="removeActivity(act.id_actividadmateria)" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all" title="Eliminar">
                          <Trash2 :size="14" />
                        </button>
                      </div>
                    </div>

                    <!-- Criteria List -->
                    <div v-if="act.criterios && act.criterios.length > 0" class="mt-4 space-y-2 border-t border-slate-200/60 dark:border-slate-750/60 pt-3">
                      <div v-for="crit in act.criterios" :key="crit.id_criterio" class="flex items-center justify-between bg-white dark:bg-slate-900/50 p-2 rounded-xl text-[11px] group/crit shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900">
                        <span class="font-medium text-slate-600 dark:text-slate-300 truncate pr-2">{{ crit.descripcion }}</span>
                        <div class="flex items-center gap-2 shrink-0">
                          <span class="font-black text-indigo-500">{{ crit.porcentaje }}%</span>
                          <button v-if="!auth.isMonitoring && !isPeriodClosed" @click="removeCriterion(act, crit.id_criterio)" class="text-slate-300 hover:text-red-500 opacity-0 group-hover/crit:opacity-100 p-0.5">
                            <X :size="12" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Add Criterion Form -->
                    <div v-if="newCriterion[act.id_actividadmateria]" class="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-3 animate-in slide-in-from-top-1 duration-200 shadow-sm">
                      <input v-model="newCriterion[act.id_actividadmateria].descripcion" type="text" placeholder="Descripción del criterio..." class="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white" />
                      <div class="flex gap-2">
                        <input v-model.number="newCriterion[act.id_actividadmateria].porcentaje" type="number" placeholder="Peso %" class="w-20 bg-slate-50 dark:bg-slate-800 border-0 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white" />
                        <button @click="addCriterion(act)" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-black uppercase">Añadir</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- New Activity Button & Form -->
              <div v-if="!auth.isMonitoring && !isPeriodClosed && totalPercentage < 100" class="border-t border-slate-100 dark:border-slate-800 pt-6">
                <button 
                  v-if="!showAddActivity"
                  @click="showAddActivity = true"
                  class="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-900 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all font-bold text-sm"
                >
                  <Plus :size="16" />
                  Nueva Actividad
                </button>

                <div v-else class="p-5 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900 space-y-4 animate-in zoom-in-95">
                  <div v-if="dbaEvidencesInfo?.usaDba" class="space-y-4">
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                        <label class="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">Evidencias DBA Planeadas *</label>
                      </div>
                      
                      <!-- DBA Scrollable Selector (Only planned) -->
                      <div class="space-y-4 max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-750 rounded-xl p-3 bg-white dark:bg-slate-900">
                        <div v-if="plannedDbaItems.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
                          No hay evidencias planeadas para este periodo por el directivo.
                        </div>
                        
                        <div v-for="dbaItem in plannedDbaItems" :key="dbaItem.id_dba" class="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                          <div class="flex items-start gap-2">
                            <span class="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[9px] font-black dark:bg-indigo-950/40 dark:text-indigo-400 shrink-0">
                              DBA #{{ dbaItem.numero_dba }}
                            </span>
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-300 leading-normal">
                              {{ dbaItem.enunciado }}
                            </p>
                          </div>
                          
                          <div class="pl-4 space-y-1.5">
                            <label v-for="ev in dbaItem.evidencias" :key="ev.id_evidencia_dba" :class="getLinkedActivityForEvidence(ev.id_evidencia_dba) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'" class="flex flex-col gap-1 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                              <div class="flex items-start gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                                <input type="checkbox" v-model="newActivity.evidencias_dba" :value="ev.id_evidencia_dba" :disabled="!!getLinkedActivityForEvidence(ev.id_evidencia_dba)" class="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" />
                                <div class="flex flex-wrap items-center gap-1.5">
                                  <span>{{ ev.descripcion }}</span>
                                  <span class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                    PLANEADA
                                  </span>
                                  <span v-if="getLinkedActivityForEvidence(ev.id_evidencia_dba)" class="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 rounded px-1.5 py-0.5 text-[8px] font-bold border border-red-200/40 uppercase tracking-wide">
                                    Asignada a: {{ getLinkedActivityForEvidence(ev.id_evidencia_dba) }}
                                  </span>
                                </div>
                              </div>
                              <div v-if="getLinkedCompetencyIndex(ev.id_competencia)" class="flex flex-wrap gap-1 mt-1 pl-6">
                                <span class="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-[8px] font-black text-violet-700 dark:text-violet-400 border border-violet-200/40 dark:border-violet-900 uppercase tracking-wider">
                                  Competencia {{ getLinkedCompetencyIndex(ev.id_competencia) }}{{ getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1]) ? ` / DBA ${getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1])}` : '' }}
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      <!-- Botón para ver todas/extra evidencias -->
                      <div class="mt-1">
                        <button 
                          type="button" 
                          @click="showWarningModal = true"
                          class="w-full flex items-center justify-center gap-1.5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          <Eye :size="13" />
                          Ver todas las evidencias para este curso
                        </button>
                      </div>

                      <!-- Resumen de evidencias extra seleccionadas -->
                      <div v-if="selectedExtraEvidencesCount > 0" class="mt-2 p-4 bg-blue-50/30 dark:bg-blue-950/10 rounded-2xl border border-blue-100 dark:border-blue-900/50 space-y-3">
                        <p class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">
                          Evidencias Extra Seleccionadas ({{ selectedExtraEvidencesCount }})
                        </p>
                        <ul class="space-y-1.5">
                          <li v-for="ev in selectedExtraEvidencesList" :key="ev.id_evidencia_dba" class="text-xs font-semibold text-slate-600 dark:text-slate-350 leading-relaxed flex items-start gap-2">
                            <span class="rounded bg-blue-50 text-blue-700 px-1 py-0.5 text-[8px] font-black dark:bg-blue-950/40 dark:text-blue-400 mt-0.5 shrink-0">DBA #{{ ev.numero_dba }}</span>
                            <div class="flex-1 min-w-0">
                              <span>{{ ev.descripcion }}</span>
                              <span v-if="ev.planeada_otro_periodo_nombre" class="ml-1.5 rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/30">
                                Planeada en: {{ ev.planeada_otro_periodo_nombre }}
                              </span>
                            </div>
                          </li>
                        </ul>

                        <!-- Motivo y Justificación -->
                        <div class="pt-3 border-t border-slate-200/40 dark:border-slate-800 space-y-3">
                          <div class="space-y-1">
                            <label class="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">Motivo del uso EXTRA *</label>
                            <select v-model="newActivity.motivo_extra" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500">
                              <option value="">Selecciona un motivo</option>
                              <option value="RECUPERACION_REFUERZO">Recuperación o refuerzo</option>
                              <option value="ADELANTO_CURRICULAR">Adelanto curricular</option>
                              <option value="INTEGRACION_ASIGNATURA">Integración con otra asignatura</option>
                              <option value="CALENDARIO_INSTITUCIONAL">Ajuste por calendario institucional</option>
                              <option value="NECESIDAD_PEDAGOGICA">Necesidad pedagógica detectada</option>
                              <option value="OTRO">Otro (requiere descripción)</option>
                            </select>
                          </div>
                          <div v-if="newActivity.motivo_extra === 'OTRO'" class="space-y-1">
                            <label class="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">Descripción de la justificación *</label>
                            <textarea v-model="newActivity.justificacion_extra" rows="3" placeholder="Describe brevemente el por qué deseas evaluar esta evidencia..." class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"></textarea>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                  
                  <div v-else class="space-y-1">
                    <label class="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Evidencia *</label>
                    <select v-model="newActivity.id_evidencia" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 outline-none">
                      <option :value="null">Selecciona</option>
                      <option v-for="ev in evidencias" :key="ev.id_evidencia" :value="ev.id_evidencia">
                        E{{ ev.orden }}: {{ ev.descripcion }}
                      </option>
                    </select>
                  </div>

                  <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la actividad</label>
                    <input v-model="newActivity.nombre" type="text" placeholder="Ej: Taller 1, Evaluación..." class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                  </div>

                  <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Peso porcentual</label>
                    <div class="flex items-center gap-3">
                      <input v-model.number="newActivity.porcentaje" type="number" placeholder="Ej: 20" class="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                      <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">% del total</span>
                    </div>
                  </div>

                  <div class="flex gap-2 pt-2">
                    <button @click="showAddActivity = false" class="flex-1 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Cancelar</button>
                    <button @click="addActivity" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 transition-all">Crear Actividad</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal 1: Advertencia de Evidencias Extra -->
    <div v-if="showWarningModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        <div class="flex items-center gap-3 text-amber-500 dark:text-amber-400">
          <div class="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl">
            <AlertTriangle :size="24" />
          </div>
          <h3 class="text-base font-black uppercase tracking-wide text-slate-850 dark:text-white">Advertencia de Evidencias</h3>
        </div>
        <p class="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
          Las evidencias que se mostrarán ya fueron planeadas en periodos anteriores/futuros, o no tienen alguna planeación. Si elige vincular una de estas evidencias con el registro de notas, el estado de la evidencia pasará a <span class="text-blue-600 font-extrabold uppercase">EXTRA</span> para este periodo académico.
        </p>
        <div class="flex gap-2 pt-2">
          <button @click="showWarningModal = false" class="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border border-slate-200 dark:border-slate-800 rounded-2xl">Cancelar</button>
          <button @click="showWarningModal = false; showExtraModal = true" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-xs font-black uppercase active:scale-95 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Entendido, continuar</button>
        </div>
      </div>
    </div>

    <!-- Modal 2: Catálogo de Evidencias Extras/Sin Planear -->
    <div v-if="showExtraModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] space-y-4 animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-white">Evidencias Extras disponibles</h3>
          <button @click="showExtraModal = false" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-855"><X :size="16" /></button>
        </div>

        <div class="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
          <div v-if="extraDbaItems.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic py-8 text-center">
            No hay más evidencias disponibles en el catálogo de DBA para este curso.
          </div>

          <div v-for="dbaItem in extraDbaItems" :key="dbaItem.id_dba" class="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
            <div class="flex items-start gap-2">
              <span class="rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[9px] font-black dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
                DBA #{{ dbaItem.numero_dba }}
              </span>
              <p class="text-xs font-bold text-slate-700 dark:text-slate-350 leading-normal">
                {{ dbaItem.enunciado }}
              </p>
            </div>
            
            <div class="pl-4 space-y-1.5">
              <label v-for="ev in dbaItem.evidencias" :key="ev.id_evidencia_dba" :class="getLinkedActivityForEvidence(ev.id_evidencia_dba) ? 'opacity-60 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/10' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'" class="flex flex-col gap-1 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 transition-all">
                <div class="flex items-start gap-2 text-xs font-bold text-slate-650 dark:text-slate-300">
                  <input type="checkbox" v-model="newActivity.evidencias_dba" :value="ev.id_evidencia_dba" :disabled="!!getLinkedActivityForEvidence(ev.id_evidencia_dba)" class="mt-0.5 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" />
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span>{{ ev.descripcion }}</span>
                    <span class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                      EXTRA
                    </span>
                    <span v-if="ev.planeada_otro_periodo_nombre" class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/30">
                      Planeada en: {{ ev.planeada_otro_periodo_nombre }}
                    </span>
                    <span v-if="getLinkedActivityForEvidence(ev.id_evidencia_dba)" class="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 rounded px-1.5 py-0.5 text-[8px] font-bold border border-red-200/40 uppercase tracking-wide">
                      Asignada a: {{ getLinkedActivityForEvidence(ev.id_evidencia_dba) }}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button @click="showExtraModal = false" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase active:scale-95 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Confirmar Selección</button>
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
