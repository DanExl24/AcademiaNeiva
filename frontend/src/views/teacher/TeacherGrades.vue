<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Save, 
  Plus, 
  AlertCircle, 
  Settings,
  CheckCircle,
  Loader2,
  Search,
  X,
  ClipboardList,
  Download,
  BookOpen,
  Users
} from 'lucide-vue-next'

import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'
import { gradesService } from '../../services/gradesService'
import TeacherActivityDrawer from '../../components/teacher/TeacherActivityDrawer.vue'
import TeacherExtraEvidenceModal from '../../components/teacher/TeacherExtraEvidenceModal.vue'

import EmptyState from '../../components/feedback/EmptyState.vue'

const yearStore = useAcademicYearStore()
const { confirm } = useConfirm()
const toast = useToast()


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
const studentsLoading = ref(false)

// Búsqueda de estudiantes
const studentSearch = ref('')
const isSubjectClosed = ref(false)

const selectedGradeId = computed<number | null>(() => {
  if (!selectedGradeName.value || !selectedSection.value || !selectedJornada.value) return null
  const course = myCourses.value.find(
    c => c.grado_nombre === selectedGradeName.value && 
         c.seccion === selectedSection.value && 
         c.jornada_nombre === selectedJornada.value
  )
  return course ? course.id_grado : null
})

const isMonitoringOrSupervisor = computed(() => {
  return (
    Boolean(auth.isMonitoring) ||
    auth.activeRole === 'directivo' ||
    auth.activeRole === 'rector' ||
    auth.activeRole === 'coordinador' ||
    auth.activeRole === 'admin_general' ||
    (Boolean(auth.user?.roles?.includes('directivo')) && !auth.user?.roles?.includes('docente'))
  )
})

const selectedPeriod = computed(() => {
  return periods.value.find(p => p.id_periodo === selectedPeriodId.value)
})

const isPeriodClosed = computed(() => {
  return selectedPeriod.value?.estado === 'CERRADO' || isSubjectClosed.value
})

const isReadOnly = computed(() => {
  return isMonitoringOrSupervisor.value || isPeriodClosed.value
})

const checkSubjectClosure = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) {
    isSubjectClosed.value = false
    return
  }
  const matchedCourse = myCourses.value.find((c: any) => c.id_grado === selectedGradeId.value && c.id_materia === selectedSubjectId.value)
  const idDetalleGrado = matchedCourse ? matchedCourse.id_detallegrado : null
  if (!idDetalleGrado) {
    isSubjectClosed.value = false
    return
  }
  try {
    isSubjectClosed.value = await gradesService.checkClosure(idDetalleGrado, selectedPeriodId.value)
  } catch (err) {
    isSubjectClosed.value = false
  }
}

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
  return selectedExtraEvidencesCount.value > 0
})

// Drawer y filtros
const isDrawerOpen = ref(false)
const showWarningModal = ref(false)
const showExtraModal = ref(false)

const openDrawer = () => {
  if (!selectedSubjectId.value) {
    alert('Por favor selecciona primero el grado, sección, jornada y materia.')
    return
  }
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
    const data = await gradesService.getTeacherCourses(teacherId!, yearStore.selectedYearId || undefined)
    myCourses.value = data
    
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
    const data = await gradesService.getPeriods(schoolId.value, yearStore.selectedYearId || undefined)
    periods.value = (data || []).filter((p: any) => p.estado !== 'PENDIENTE')
    
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
    const data = await gradesService.getAcademicSettings(schoolId.value)
    if (data?.defaultSettings) {
      gradeRange.value = {
        min: Number(data.defaultSettings.nota_minima),
        max: Number(data.defaultSettings.nota_maxima),
        approval: Number(data.defaultSettings.nota_aprobacion),
      }
      scales.value = data.scales || []
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

// Cargar notas actuales
const fetchGrades = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) return
  try {
    gradesMatrix.value = {}
    criteriaGradesMatrix.value = {}
    const data = await gradesService.getGrades(selectedGradeId.value, selectedSubjectId.value, selectedPeriodId.value)
    
    data.activityGrades.forEach((n: any) => {
      if (!gradesMatrix.value[n.id_estudiante]) gradesMatrix.value[n.id_estudiante] = {}
      gradesMatrix.value[n.id_estudiante][n.id_actividadmateria] = n.nota
    })

    data.criteriaGrades.forEach((n: any) => {
      if (!criteriaGradesMatrix.value[n.id_estudiante]) criteriaGradesMatrix.value[n.id_estudiante] = {}
      criteriaGradesMatrix.value[n.id_estudiante][n.id_criterio] = n.nota
    })
    
    // Garantizar que todos los estudiantes cargados tengan una fila en la matriz
    initializeMatrixForStudents()
  } catch (error) {
  }
}

const fetchDbaEvidences = async () => {
  if (!selectedGradeId.value || !selectedSubjectId.value || !selectedPeriodId.value) {
    dbaEvidencesInfo.value = null
    return
  }
  try {
    const data = await gradesService.getDbaEvidences(selectedGradeId.value, selectedSubjectId.value, schoolId.value, String(selectedPeriodId.value))
    dbaEvidencesInfo.value = data
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
    await checkSubjectClosure()
    const teacherUserId = isMonitoringOrSupervisor.value ? undefined : auth.user?.id
    const data = await gradesService.getActivities(selectedGradeId.value, selectedSubjectId.value, selectedPeriodId.value, teacherUserId)
    competency.value = data.competencia
    competencyDraft.value = data.competencia?.descripcion || ''
    evidencias.value = data.evidencias || []
    competenciasList.value = data.competenciasList || []
    activities.value = data.activities || []
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
    studentsLoading.value = true
    const data = await gradesService.getStudentsByGrade(selectedGradeId.value)
    students.value = data || []
    initializeMatrixForStudents()
  } catch (error: any) {
    students.value = []
  } finally {
    studentsLoading.value = false
  }
}

const autosaveStatus = ref<'saved' | 'saving' | 'error'>('saved')
const autosaveErrorMsg = ref('')

const autosaveGrade = async (studentId: number, id: number, type: 'activity' | 'criterion', val: number) => {
  if (isReadOnly.value) return
  try {
    autosaveStatus.value = 'saving'
    autosaveErrorMsg.value = ''
    
    await gradesService.saveGrades({
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
    await gradesService.saveGrades({
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
        alert('Debes seleccionar un motivo para evaluar evidencias extra o no planificadas en este periodo.')
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
      if (newActivity.value.motivo_extra) {
        payload.motivo_extra = newActivity.value.motivo_extra
        if (newActivity.value.motivo_extra === 'OTRO') {
          payload.justificacion_extra = newActivity.value.justificacion_extra
        }
      }
    } else {
      payload.id_evidencia = newActivity.value.id_evidencia
    }

    await gradesService.createActivity(payload)
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

// Eliminar actividad
const removeActivity = async (id: number) => {
  const ok = await confirm({
    title: 'Eliminar Actividad',
    message: '¿Estás seguro de eliminar esta actividad evaluativa? Se eliminarán todas las calificaciones y criterios asociados.',
    confirmText: 'Eliminar Actividad',
    type: 'danger'
  })
  if (!ok) return

  try {
    await gradesService.deleteActivity(id)
    activities.value = activities.value.filter(a => a.id_actividadmateria !== id)
    toast.success('Actividad eliminada correctamente')
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al eliminar actividad')
  }
}

// Actualizar peso de actividad
const updateActivityWeight = async (act: Activity) => {
  const percentage = parseFloat(act.porcentaje.toString())
  if (isNaN(percentage) || percentage <= 0) {
    toast.warning('El peso debe ser un número mayor a 0.')
    await fetchActivities()
    return
  }

  try {
    const payload = {
      nombre: act.nombre,
      porcentaje: percentage,
      evidencias_dba: act.evidencias_dba || []
    }
    await gradesService.updateActivity(act.id_actividadmateria, payload)
    toast.success('Peso de actividad actualizado')
    await fetchActivities()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al actualizar el porcentaje de la actividad')
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
    const data = await gradesService.createCriterion({
      id_actividadmateria: act.id_actividadmateria,
      id_evidencia: form.id_evidencia,
      descripcion: form.descripcion,
      porcentaje: form.porcentaje,
      id_colegio: schoolId.value
    })
    
    if (!act.criterios) act.criterios = []
    act.criterios.push(data)
    
    delete newCriterion.value[act.id_actividadmateria]
    toast.success('Criterio creado exitosamente')
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al crear el criterio')
  }
}

const removeCriterion = async (act: Activity, criterionId: number) => {
  const ok = await confirm({
    title: 'Eliminar Criterio',
    message: '¿Estás seguro de eliminar este criterio de evaluación?',
    confirmText: 'Eliminar Criterio',
    type: 'danger'
  })
  if (!ok) return

  try {
    await gradesService.deleteCriterion(criterionId)
    if (act.criterios) {
      act.criterios = act.criterios.filter(c => c.id_criterio !== criterionId)
    }
    toast.success('Criterio eliminado exitosamente')
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al eliminar el criterio')
  }
}

const toggleEvidenceExtra = (id: number) => {
  const index = newActivity.value.evidencias_dba.indexOf(id)
  if (index > -1) {
    newActivity.value.evidencias_dba.splice(index, 1)
  } else {
    newActivity.value.evidencias_dba.push(id)
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
  
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const viewMode = ref<'table' | 'cards'>('table')

const handleGradeKeydown = (stIndex: number, colIndex: number, e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault()
    const nextInput = document.querySelector<HTMLInputElement>(`input[data-grade-cell="${stIndex + 1}-${colIndex}"]`)
    if (nextInput) {
      nextInput.focus()
      nextInput.select()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prevInput = document.querySelector<HTMLInputElement>(`input[data-grade-cell="${stIndex - 1}-${colIndex}"]`)
    if (prevInput) {
      prevInput.focus()
      prevInput.select()
    }
  }
}

onMounted(() => {
  fetchMyCourses()
})
</script>

<template>
  <div class="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
    <!-- Header Card -->
    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 shadow-sm transition-colors">
      <div class="flex items-center gap-3.5 sm:gap-6">
        <div class="p-3 sm:p-4 bg-indigo-600 dark:bg-indigo-500 rounded-xl sm:rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
          <ClipboardList :size="24" class="sm:w-7 sm:h-7" />
        </div>
        <div>
          <h1 class="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Registro de Calificaciones</h1>
          <p class="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm md:text-base mt-0.5">Gestiona actividades, criterios y notas del periodo actual.</p>
        </div>
      </div>
      
      <!-- Actions buttons -->
      <div v-if="selectedSubjectId && selectedPeriodId" class="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
        <!-- Autosave Indicator -->
        <div v-if="!isReadOnly" class="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 h-[40px] sm:h-[44px]">
          <div v-if="autosaveStatus === 'saving'" class="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            <Loader2 class="w-3.5 h-3.5 animate-spin" />
            <span>Guardando...</span>
          </div>
          <div v-else-if="autosaveStatus === 'saved'" class="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <CheckCircle class="w-3.5 h-3.5" />
            <span>Guardado</span>
          </div>
          <div v-else-if="autosaveStatus === 'error'" class="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider" :title="autosaveErrorMsg">
            <AlertCircle class="w-3.5 h-3.5" />
            <span>Error</span>
          </div>
        </div>

        <!-- View Mode Switcher -->
        <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700">
          <button 
            type="button"
            @click="viewMode = 'table'"
            :class="[
              'px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
              viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'
            ]"
            title="Vista Planilla Completa"
          >
            <Users :size="14" />
            <span class="hidden sm:inline">Planilla</span>
          </button>
          <button 
            type="button"
            @click="viewMode = 'cards'"
            :class="[
              'px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
              viewMode === 'cards' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'
            ]"
            title="Modo Ficha Móvil"
          >
            <BookOpen :size="14" />
            <span class="hidden sm:inline">Tarjetas</span>
          </button>
        </div>

        <button 
          v-if="!isMonitoringOrSupervisor"
          @click="saveAllGrades(false)"
          :disabled="saving || activitiesLoading || studentsLoading || isPeriodClosed || students.length === 0"
          class="bg-emerald-600 dark:bg-emerald-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold shadow-md shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
        >
          <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
          <Save v-else :size="16" class="sm:w-4.5 sm:h-4.5" />
          <span>{{ saving ? 'Guardando...' : 'Guardar' }}</span>
        </button>
        <button 
          @click="exportGradesToCSV"
          :disabled="saving || activitiesLoading || studentsLoading || students.length === 0"
          class="bg-indigo-600 dark:bg-indigo-500 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold shadow-md shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
        >
          <Download :size="16" class="sm:w-4.5 sm:h-4.5" />
          <span class="hidden sm:inline">CSV</span>
        </button>
        <button
          @click="openDrawer"
          class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center gap-2 active:scale-95 border border-slate-200 dark:border-slate-700 shadow-xs text-xs sm:text-sm cursor-pointer"
        >
          <BookOpen :size="16" class="text-indigo-500 sm:w-4.5 sm:h-4.5" />
          <span class="hidden sm:inline">{{ isReadOnly ? 'Ver Actividades' : 'Configurar Actividades' }}</span>
        </button>
        <div v-if="isReadOnly" class="text-amber-600 font-bold text-xs sm:text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl">
          Solo Lectura
        </div>
      </div>
    </div>

    <!-- Filtros en cascada -->
    <div class="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-end gap-4 sm:gap-5 transition-colors">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="space-y-1.5">
          <label class="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Grado</label>
          <select v-model="selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Sección</label>
          <select v-model="selectedSection" :disabled="!selectedGradeName" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="s in sectionOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Jornada</label>
          <select v-model="selectedJornada" :disabled="!selectedSection" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="j in jornadaOptions" :key="j" :value="j">{{ j }}</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Materia</label>
          <select v-model="selectedSubjectId" :disabled="!selectedJornada" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 cursor-pointer">
            <option :value="null">Selecciona</option>
            <option v-for="s in subjectsOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
      </div>

      <div class="w-full md:w-64 space-y-1.5">
        <label class="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Periodo</label>
        <select v-model="selectedPeriodId" :disabled="periods.length === 0" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 cursor-pointer">
          <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
            {{ p.nombre }} {{ p.estado === 'CERRADO' ? '(Cerrado)' : '' }}
          </option>
        </select>
      </div>
    </div>

    <!-- Empty Selection State -->
    <div v-if="!selectedSubjectId" class="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-16 sm:p-20 text-center transition-colors">
      <div class="w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-slate-800 rounded-full shadow-xs flex items-center justify-center mx-auto mb-5">
        <AlertCircle class="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-lg sm:text-xl font-bold text-slate-500 dark:text-slate-400">Selecciona grado, sección, jornada y materia para calificar</h3>
    </div>

    <div v-else class="space-y-6 animate-in fade-in duration-500">
      <!-- Read Only Period Warning -->
      <div v-if="isPeriodClosed" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-3xl p-5 sm:p-6 flex items-start gap-4 animate-in slide-in-from-top duration-300 transition-colors">
        <AlertCircle class="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 class="font-black text-amber-900 dark:text-amber-200 text-sm sm:text-base">Planilla en Modo Solo Lectura</h4>
          <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">
            El periodo académico <strong>"{{ selectedPeriod?.nombre }}"</strong> está cerrado institucionalmente y no admite modificaciones en las notas.
          </p>
        </div>
      </div>

      <!-- Competency top banner -->
      <div v-if="competency" class="bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100/80 dark:border-violet-900 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-xs">
        <div class="flex items-start gap-3.5">
          <div class="p-3 bg-violet-600 dark:bg-violet-500 rounded-2xl text-white shadow-md shadow-violet-100 dark:shadow-none shrink-0">
            <BookOpen :size="22" />
          </div>
          <div>
            <span class="text-xs font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider block">Competencia del Periodo</span>
            <p class="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed max-w-4xl whitespace-pre-line">{{ competency.descripcion }}</p>
          </div>
        </div>
        <button 
          @click="openDrawer"
          class="shrink-0 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-violet-700 dark:text-violet-300 font-bold px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 active:scale-95 border border-violet-100 dark:border-violet-850 text-xs shadow-xs self-start md:self-auto cursor-pointer"
        >
          <Settings :size="15" />
          {{ isPeriodClosed ? 'Ver Actividades' : 'Configurar Actividades' }}
        </button>
      </div>

      <!-- Grade Matrix Container -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div class="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div class="flex items-center gap-3">
             <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
               <Users :size="20" />
             </div>
             <h3 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Planilla de Notas</h3>
           </div>

           <!-- In-Table Search -->
           <div v-if="students.length > 0" class="relative w-full md:w-72">
             <input 
               v-model="studentSearch"
               type="text"
               placeholder="Buscar estudiante..."
               class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all duration-300"
             />
             <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
             <button v-if="studentSearch" @click="studentSearch = ''" class="absolute right-3.5 top-3.5 text-slate-400 cursor-pointer">
               <X :size="14" />
             </button>
           </div>
        </div>

        <!-- 1. Loading State -->
        <div v-if="activitiesLoading || studentsLoading" class="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 class="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p class="text-sm font-bold text-slate-600 dark:text-slate-300">Cargando información del curso...</p>
        </div>

        <!-- 2. Empty Students State (Friendly Reassuring Message) -->
        <div v-else-if="students.length === 0" class="p-8 sm:p-14 text-center animate-in fade-in duration-300">
          <div class="max-w-xl mx-auto space-y-6">
            <div class="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Users class="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            
            <div class="space-y-2">
              <h4 class="text-base sm:text-xl font-black text-slate-900 dark:text-white">
                Sin estudiantes matriculados en este curso
              </h4>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Actualmente no hay estudiantes con matrícula activa en este grado y grupo. Mientras secretaría académica realiza la asignación, <strong>puedes avanzar en la planeación creando y configurando las actividades pedagógicas y evidencias DBA</strong>.
              </p>
            </div>

            <!-- Resumen de actividades si ya fueron creadas -->
            <div v-if="activities.length > 0" class="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-left flex items-start gap-3.5 shadow-xs">
              <CheckCircle class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div class="text-xs">
                <p class="font-bold text-emerald-900 dark:text-emerald-300">
                  {{ activities.length }} {{ activities.length === 1 ? 'actividad configurada' : 'actividades configuradas' }} ({{ totalPercentage }}% ponderado)
                </p>
                <p class="text-emerald-700 dark:text-emerald-400/90 mt-0.5 leading-relaxed">
                  Tus actividades están listas y se vincularán automáticamente a los estudiantes tan pronto sean matriculados en la planilla.
                </p>
              </div>
            </div>

            <div class="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button 
                @click="openDrawer"
                class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-md shadow-indigo-100 dark:shadow-none hover:shadow-lg active:scale-95 cursor-pointer text-xs sm:text-sm"
              >
                <BookOpen :size="16" />
                {{ isReadOnly ? 'Ver Actividades' : (activities.length > 0 ? 'Gestionar Actividades' : 'Configurar Actividades') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Empty Activities State (When students exist, but no activities yet) -->
        <EmptyState
          v-else-if="activities.length === 0"
          title="No hay actividades creadas para este periodo"
          description="Crea actividades y asigna evidencias DBA para comenzar a calificar a los estudiantes."
        >
          <template #icon>
            <ClipboardList :size="32" class="text-indigo-600" />
          </template>
          <template #action>
            <button 
              v-if="!isReadOnly"
              @click="openDrawer"
              class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-95 cursor-pointer text-sm"
            >
              <Plus :size="16" />
              Configurar Actividades
            </button>
          </template>
        </EmptyState>

        <!-- 4. Empty Search Results State -->
        <div v-else-if="filteredStudents.length === 0" class="p-12 text-center animate-in fade-in duration-300">
          <Search class="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p class="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron estudiantes</p>
          <p class="text-xs text-slate-400 mt-1">Ningún estudiante coincide con "{{ studentSearch }}".</p>
          <button @click="studentSearch = ''" class="mt-3 text-xs font-bold text-indigo-600 hover:underline cursor-pointer">Limpiar búsqueda</button>
        </div>

        <!-- CARDS VIEW (Modo Evaluación Móvil) -->
        <div v-else-if="viewMode === 'cards'" class="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="(st, stIdx) in filteredStudents" 
            :key="st.id_estudiante"
            class="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
          >
            <!-- Card Header -->
            <div class="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-black shrink-0">
                  {{ st.nombre.charAt(0) }}{{ st.apellido.charAt(0) }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{{ st.nombre }} {{ st.apellido }}</p>
                  <p class="text-xs text-slate-400 font-mono">{{ st.codigo }}</p>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div 
                  :class="[
                    parseFloat(calculateFinal(st.id_estudiante)) >= gradeRange.approval ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
                    'px-3 py-1 rounded-xl font-black text-base border inline-flex items-center gap-1.5'
                  ]"
                >
                  <span class="text-xs font-medium uppercase text-slate-400">Def:</span>
                  {{ calculateFinal(st.id_estudiante) }}
                </div>
              </div>
            </div>

            <!-- Grade Inputs in Card -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                v-for="(col, colIdx) in tableColumns" 
                :key="col.id" 
                class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    {{ col.type === 'criterion' ? col.criterion?.descripcion : col.activity.nombre }}
                  </p>
                  <p class="text-xs text-indigo-500 font-semibold">
                    {{ col.type === 'criterion' ? col.criterion?.porcentaje : col.activity.porcentaje }}%
                  </p>
                </div>
                
                <input 
                  v-if="col.type === 'activity' && gradesMatrix[st.id_estudiante]"
                  type="number"
                  step="0.1"
                  :data-grade-cell="`${stIdx}-${colIdx}`"
                  @keydown="handleGradeKeydown(stIdx, colIdx, $event)"
                  v-model="gradesMatrix[st.id_estudiante][col.activity.id_actividadmateria]"
                  @blur="validateGradeInput(st.id_estudiante, col.activity.id_actividadmateria, 'activity', $event)"
                  :disabled="isReadOnly"
                  class="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center font-bold text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <input 
                  v-else-if="col.type === 'criterion' && criteriaGradesMatrix[st.id_estudiante]"
                  type="number"
                  step="0.1"
                  :data-grade-cell="`${stIdx}-${colIdx}`"
                  @keydown="handleGradeKeydown(stIdx, colIdx, $event)"
                  v-model="criteriaGradesMatrix[st.id_estudiante][col.criterion!.id_criterio]"
                  @blur="validateGradeInput(st.id_estudiante, col.criterion!.id_criterio, 'criterion', $event)"
                  :disabled="isReadOnly"
                  class="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center font-bold text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <div v-else-if="col.type === 'activity_total'" class="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-900">
                  {{ calculateActivityGrade(st.id_estudiante, col.activity).toFixed(1) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TABLE VIEW (Planilla Completa) -->
        <div v-else class="overflow-x-auto custom-scrollbar">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th class="p-4 sm:p-5 text-left text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Estudiante</th>
                
                <!-- Dynamic Columns for Activities/Criteria -->
                <th v-for="col in tableColumns" :key="col.id" 
                    :class="['p-3.5 text-center border-l border-slate-100 dark:border-slate-800 min-w-[120px]', col.type === 'activity_total' ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : '']">
                  <div class="space-y-1">
                    <div v-if="col.type === 'activity'" class="text-xs font-black text-indigo-500 uppercase tracking-wider">{{ col.activity.nombre }}</div>
                    <div v-else-if="col.type === 'criterion'" class="text-xs font-black text-indigo-500 uppercase tracking-wider truncate" :title="col.activity.nombre">{{ col.activity.nombre }}</div>
                    <div v-else-if="col.type === 'activity_total'" class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Total {{ col.activity.nombre }}</div>
                    
                    <div class="text-xs font-black text-slate-700 dark:text-slate-200 truncate max-w-[100px] mx-auto">
                      {{ col.type === 'criterion' ? col.criterion?.descripcion : (col.type === 'activity_total' ? 'Σ' : col.activity.nombre) }}
                    </div>
                    <div class="text-xs font-bold text-slate-400">
                      {{ col.type === 'criterion' ? col.criterion?.porcentaje : col.activity.porcentaje }}%
                    </div>
                  </div>
                </th>

                <th class="p-4 sm:p-5 text-center text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider bg-slate-100 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-700">Nota Definitiva</th>
                <th class="p-4 sm:p-5 text-center text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nivel</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(st, stIdx) in filteredStudents" 
                :key="st.id_estudiante"
                class="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
              >
                <td class="p-4 sm:p-5 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.01)]">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black shrink-0">
                      {{ st.nombre.charAt(0) }}{{ st.apellido.charAt(0) }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{ st.nombre }} {{ st.apellido }}</p>
                      <p class="text-xs font-medium text-slate-400">{{ st.codigo }}</p>
                    </div>
                  </div>
                </td>

                <!-- Grades Inputs -->
                <td v-for="(col, colIdx) in tableColumns" :key="col.id" class="p-2 border-l border-slate-50 dark:border-slate-800/50 text-center">
                  <input 
                    v-if="col.type === 'activity' && gradesMatrix[st.id_estudiante]"
                    type="number"
                    step="0.1"
                    :data-grade-cell="`${stIdx}-${colIdx}`"
                    @keydown="handleGradeKeydown(stIdx, colIdx, $event)"
                    v-model="gradesMatrix[st.id_estudiante][col.activity.id_actividadmateria]"
                    @blur="validateGradeInput(st.id_estudiante, col.activity.id_actividadmateria, 'activity', $event)"
                    :disabled="isReadOnly"
                    class="w-16 mx-auto bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-2 text-center font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                  <input 
                    v-else-if="col.type === 'criterion' && criteriaGradesMatrix[st.id_estudiante]"
                    type="number"
                    step="0.1"
                    :data-grade-cell="`${stIdx}-${colIdx}`"
                    @keydown="handleGradeKeydown(stIdx, colIdx, $event)"
                    v-model="criteriaGradesMatrix[st.id_estudiante][col.criterion!.id_criterio]"
                    @blur="validateGradeInput(st.id_estudiante, col.criterion!.id_criterio, 'criterion', $event)"
                    :disabled="isReadOnly"
                    class="w-16 mx-auto bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-2 text-center font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                  <div v-else-if="col.type === 'activity_total'" class="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 py-2 rounded-lg w-16 mx-auto border border-indigo-100 dark:border-indigo-900">
                    {{ calculateActivityGrade(st.id_estudiante, col.activity).toFixed(1) }}
                  </div>
                </td>

                <!-- Final Grade -->
                <td class="p-4 sm:p-5 text-center bg-slate-50/50 dark:bg-slate-800/30 border-l border-slate-100 dark:border-slate-800">
                  <div 
                    :class="[
                      parseFloat(calculateFinal(st.id_estudiante)) >= gradeRange.approval ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900',
                      'inline-flex items-center justify-center w-14 h-9 rounded-xl font-black text-base border shadow-xs'
                    ]"
                  >
                    {{ calculateFinal(st.id_estudiante) }}
                  </div>
                </td>

                <!-- Academic Scale -->
                <td class="p-4 sm:p-5 text-center">
                  <span 
                    :class="[
                      getScaleClass(getScaleLevel(calculateFinal(st.id_estudiante))),
                      'px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border'
                    ]"
                  >
                    {{ getScaleLevel(calculateFinal(st.id_estudiante)) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div v-if="filteredStudents.length === 0 && students.length > 0" class="p-16 text-center">
          <div class="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <Search class="w-6 h-6 text-slate-300" />
          </div>
        </div>
      </div>
    </div>

    <!-- Slide-Over Drawer -->
    <TeacherActivityDrawer
      :is-open="isDrawerOpen"
      :is-period-closed="isPeriodClosed"
      :is-monitoring="isMonitoringOrSupervisor"
      :competency="competency"
      :competencias-list="competenciasList"
      :evidencias="evidencias"
      :activities="activities"
      :total-percentage="totalPercentage"
      :show-add-activity="showAddActivity"
      :dba-evidences-info="dbaEvidencesInfo"
      :planned-dba-items="plannedDbaItems"
      :new-activity="newActivity"
      :new-criterion="newCriterion"
      :selected-extra-evidences-count="selectedExtraEvidencesCount"
      :selected-extra-evidences-list="selectedExtraEvidencesList"
      :get-dba-number-for-competency="getDbaNumberForCompetency"
      :get-linked-competency-index="getLinkedCompetencyIndex"
      :get-dba-evidence-details="getDbaEvidenceDetails"
      :get-linked-activity-for-evidence="getLinkedActivityForEvidence"
      @close="closeDrawer"
      @update-activity-weight="updateActivityWeight"
      @remove-activity="removeActivity"
      @toggle-add-criterion="toggleAddCriterion"
      @add-criterion="addCriterion"
      @remove-criterion="removeCriterion($event.act, $event.critId)"
      @toggle-show-add-activity="showAddActivity = $event"
      @add-activity="addActivity"
      @open-extra-warning="showWarningModal = true"
    />

    <!-- DBA Extra Evidence Modals -->
    <TeacherExtraEvidenceModal
      :show-warning-modal="showWarningModal"
      :show-extra-modal="showExtraModal"
      :extra-dba-items="extraDbaItems"
      :selected-evidencias-dba="newActivity.evidencias_dba"
      :get-linked-activity-for-evidence="getLinkedActivityForEvidence"
      @close-warning="showWarningModal = false"
      @proceed-to-extra="showWarningModal = false; showExtraModal = true"
      @close-extra="showExtraModal = false"
      @toggle-evidence="toggleEvidenceExtra"
    />
  </div>

</template>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
input[type=number] {
  -moz-appearance: textfield;
  appearance: textfield;
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
