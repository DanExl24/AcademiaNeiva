<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { 
  ArrowLeft, Plus, Search, BookOpenCheck, Sparkles, RefreshCw, 
  PenSquare, Trash2, Check, X, AlertTriangle 
} from 'lucide-vue-next'
import { academicService } from '../../services/academicService'
import { useAuthStore } from '../../stores/auth'

import { useNotificationStore } from '../../stores/notifications'
import { getCourseDisplayName } from '../../utils/courseHelper'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'

const { confirm } = useConfirm()
const toast = useToast()


interface AcademicPeriod {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO'
  porcentaje: number
  id_año: number
}

interface AssignmentOption {
  id_detallegrado: number
  id_grupo: number
  id_materia: number
  materia_nombre: string
  nivel_nombre: string
  tipo_grado_nombre: string
  seccion_nombre: string
  jornada_nombre: string
}

interface CompetencyItem {
  id_competencia: number
  id_grupo: number
  id_materia: number
  id_periodo: number
  descripcion: string
  estado: 'PENDIENTE' | 'DEFINIDA'
  materia_nombre: string
  periodo_nombre: string
  nivel_nombre: string
  tipo_grado_nombre: string
  seccion_nombre: string
  jornada_nombre: string
  usa_dba?: boolean
  id_dimension?: number | null
  dimension_nombre?: string | null
  evidencias: {
    id_evidencia: number
    descripcion: string
    orden: number
    id_evidencia_dba?: number | null
    numero_dba?: number | null
    dba_enunciado?: string | null
  }[]
}

import { useAcademicYearStore } from '../../stores/academicYear'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const notify = useNotificationStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const saving = ref(false)
const competencyModal = ref(false)

const dbaModal = ref(false)
const loadingDba = ref(false)
const availableDba = ref<any[]>([])
const dbaVersion = ref<string | null>(null)
const selectedCompetenciaForDba = ref<CompetencyItem | null>(null)
const checkedDbaEvidences = ref<number[]>([])
const dbaSearch = ref('')

const loadingFormDba = ref(false)
const availableFormDba = ref<any[]>([])
const formDbaVersion = ref<string | null>(null)
const checkedFormDbaEvidences = ref<number[]>([])
const showFormDba = ref(false)
const formDbaSearch = ref('')

const editingCompetencyIsUsed = ref(false)
const editingCompetencyOriginalEvidences = ref<number[]>([])

const periods = ref<AcademicPeriod[]>([])
const assignments = ref<AssignmentOption[]>([])
const competencies = ref<CompetencyItem[]>([])
const dimensions = ref<{ id_dimension: number; nombre: string }[]>([])

const isPeriodClosed = (id_periodo: any): boolean => {
  if (!id_periodo) return false
  const p = periods.value.find(p => String(p.id_periodo) === String(id_periodo))
  return p?.estado === 'CERRADO'
}

const search = ref('')
const selectedPeriod = ref('')
const selectedGrade = ref('')
const selectedSubject = ref('')
const selectedStatus = ref('')

// Diagnostic DBA state
interface DiagnosticData {
  totalDba: number
  unusedDbaCount: number
  unusedDbas: string[]
  totalEvidences: number
  freeEvidencesCount: number
}

const diagnosticData = ref<DiagnosticData | null>(null)
const loadingDiagnostic = ref(false)

const fetchDiagnostic = async () => {
  if (!selectedGrade.value || !selectedSubject.value || !schoolId.value) {
    diagnosticData.value = null
    return
  }

  const [nivel, tipoGrado] = selectedGrade.value.split(':')
  const sampleAssignment = assignments.value.find(a => 
    a.nivel_nombre === nivel && 
    a.tipo_grado_nombre === tipoGrado && 
    String(a.id_materia) === selectedSubject.value
  )

  if (!sampleAssignment) {
    diagnosticData.value = null
    return
  }

  try {
    loadingDiagnostic.value = true
    const dbaList = await academicService.getDbaPlaneacionDisponibles(schoolId.value, {
      id_grupo: sampleAssignment.id_grupo,
      id_materia: sampleAssignment.id_materia
    })

    const list: any[] = (dbaList as any).dba || dbaList || []
    let totalEvidences = 0
    let freeEvidencesCount = 0
    let unusedDbaCount = 0
    const unusedDbas: string[] = []

    for (const dba of list) {
      let dbaHasPlannedEvidence = false
      if (Array.isArray(dba.evidencias)) {
        for (const ev of dba.evidencias) {
          totalEvidences++
          if (ev.asignada) {
            dbaHasPlannedEvidence = true
          } else {
            freeEvidencesCount++
          }
        }
      }
      if (!dbaHasPlannedEvidence) {
        unusedDbaCount++
        unusedDbas.push(`DBA #${dba.numero_dba}`)
      }
    }

    diagnosticData.value = {
      totalDba: list.length,
      unusedDbaCount,
      unusedDbas,
      totalEvidences,
      freeEvidencesCount
    }
  } catch (error) {
    console.error('Error fetching DBA diagnostic:', error)
    diagnosticData.value = null
  } finally {
    loadingDiagnostic.value = false
  }
}

watch([selectedGrade, selectedSubject], fetchDiagnostic)

// Delete Competency Warning Modal State
const showDeleteModal = ref(false)
const competenciaToDelete = ref<CompetencyItem | null>(null)
const loadingDeleteCheck = ref(false)
const deleteUsageInfo = ref<{
  isUsed: boolean
  descripcion: string
  teachersUsage: {
    docente_nombre: string
    materia_nombre: string
    grupo_nombre: string
    total_actividades: number
    total_notas: number
  }[]
} | null>(null)

const promptDeleteCompetencia = async (item: CompetencyItem) => {
  competenciaToDelete.value = item
  showDeleteModal.value = true
  loadingDeleteCheck.value = true
  deleteUsageInfo.value = null

  try {
    const data = await academicService.checkCompetencyUsage(item.id_competencia, schoolId.value)
    deleteUsageInfo.value = data
  } catch (error) {
    console.error('Error checking competency usage:', error)
    notify.addNotification('No se pudo verificar el uso de la competencia', 'error')
  } finally {
    loadingDeleteCheck.value = false
  }
}

const confirmDeleteCompetencia = async () => {
  if (!competenciaToDelete.value) return

  try {
    saving.value = true
    await academicService.deleteCompetency(competenciaToDelete.value.id_competencia, schoolId.value)
    notify.addNotification('Competencia eliminada exitosamente', 'success')
    showDeleteModal.value = false
    competenciaToDelete.value = null
    deleteUsageInfo.value = null
    await loadData()
    if (selectedGrade.value && selectedSubject.value) {
      await fetchDiagnostic()
    }
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al eliminar la competencia', 'error')
  } finally {
    saving.value = false
  }

}

const competencyForm = ref({
  id_periodo: '',
  gradeKey: '',
  subjectKey: '',
  descripcion: '',
  id_dimension: '' as string | number,
})

const gradeChoices = computed(() => {
  const map = new Map<string, { key: string; label: string }>()

  for (const item of assignments.value) {
    const key = `${item.nivel_nombre}:${item.tipo_grado_nombre}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: `${item.nivel_nombre} · ${item.tipo_grado_nombre}`,
      })
    }
  }

  return Array.from(map.values())
})

const assignmentChoices = computed(() =>
  assignments.value.map((item) => ({
    ...item,
    key: `${item.id_grupo}:${item.id_materia}`,
    gradeKey: `${item.nivel_nombre}:${item.tipo_grado_nombre}`,
    courseKey: String(item.id_grupo),
    subjectKey: String(item.id_materia),
    label: `${getCourseDisplayName({ tipo_grado_nombre: item.tipo_grado_nombre, seccion_nombre: item.seccion_nombre })} · ${item.jornada_nombre} · ${item.materia_nombre}`,
  }))
)

const subjectChoices = computed(() => {
  const map = new Map<string, { key: string; label: string }>()

  for (const item of assignmentChoices.value) {
    if (selectedGrade.value && item.gradeKey !== selectedGrade.value) continue

    if (!map.has(item.subjectKey)) {
      map.set(item.subjectKey, {
        key: item.subjectKey,
        label: item.materia_nombre,
      })
    }
  }

  return Array.from(map.values())
})

const formSubjectChoices = computed(() => {
  const map = new Map<string, { key: string; label: string }>()

  for (const item of assignmentChoices.value) {
    if (competencyForm.value.gradeKey && item.gradeKey !== competencyForm.value.gradeKey) continue

    if (!map.has(item.subjectKey)) {
      map.set(item.subjectKey, {
        key: item.subjectKey,
        label: item.materia_nombre,
      })
    }
  }

  return Array.from(map.values())
})

const gradeScopedCompetencies = computed(() => {
  const unique = new Map<string, CompetencyItem>()

  for (const item of competencies.value) {
    const key = `${item.nivel_nombre}:${item.tipo_grado_nombre}:${item.id_materia}:${item.id_periodo}`
    if (!unique.has(key)) {
      unique.set(key, item)
    } else {
      const existing = unique.get(key)!
      if ((!existing.evidencias || existing.evidencias.length === 0) && item.evidencias && item.evidencias.length > 0) {
        unique.set(key, item)
      }
    }
  }

  return Array.from(unique.values())
})

const filteredCompetencies = computed(() => {
  const term = search.value.trim().toLowerCase()

  return gradeScopedCompetencies.value.filter((item) => {
    const gradeKey = `${item.nivel_nombre}:${item.tipo_grado_nombre}`
    const subjectKey = String(item.id_materia)
    const matchesPeriod = !selectedPeriod.value || String(item.id_periodo) === selectedPeriod.value
    const matchesGrade = !selectedGrade.value || gradeKey === selectedGrade.value
    const matchesSubject = !selectedSubject.value || subjectKey === selectedSubject.value
    const matchesStatus = !selectedStatus.value || item.estado === selectedStatus.value
    const matchesSearch =
      !term ||
      item.materia_nombre.toLowerCase().includes(term) ||
      item.descripcion.toLowerCase().includes(term) ||
      item.tipo_grado_nombre.toLowerCase().includes(term) ||
      item.seccion_nombre.toLowerCase().includes(term) ||
      item.periodo_nombre.toLowerCase().includes(term)

    return matchesPeriod && matchesGrade && matchesSubject && matchesStatus && matchesSearch
  })
})

const competencyStats = computed(() => {
  const uniqueSubjects = new Set(gradeScopedCompetencies.value.map((item) => item.id_materia)).size
  const uniqueContexts = new Set(gradeScopedCompetencies.value.map((item) => `${item.nivel_nombre}:${item.tipo_grado_nombre}:${item.id_materia}:${item.id_periodo}`)).size
  const pending = gradeScopedCompetencies.value.filter((item) => item.estado === 'PENDIENTE').length
  const defined = gradeScopedCompetencies.value.filter((item) => item.estado === 'DEFINIDA').length

  return {
    total: gradeScopedCompetencies.value.length,
    subjects: uniqueSubjects,
    contexts: uniqueContexts,
    pending,
    defined,
  }
})

const loadData = async () => {
  if (!schoolId.value) return

  try {
    loading.value = true
    const params: any = { keys: 'periods,assignments,competencies,dimensions' }
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const response = await academicService.getSettings(schoolId.value, params)
    periods.value = response.periods || []
    assignments.value = response.assignments
    competencies.value = response.competencies
    dimensions.value = response.dimensions || []
  } catch (error) {
    console.error('Error loading academic competencies:', error)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  competencyForm.value = {
    id_periodo: '',
    gradeKey: '',
    subjectKey: '',
    descripcion: '',
    id_dimension: '',
  }
}

const onFormContextChange = async (arg?: number | Event) => {
  const competencyId = typeof arg === 'number' ? arg : undefined
  const gradeKey = competencyForm.value.gradeKey
  const subjectKey = competencyForm.value.subjectKey

  if (!gradeKey || !subjectKey) {
    availableFormDba.value = []
    formDbaVersion.value = null
    showFormDba.value = false
    return
  }

  const targets = assignmentChoices.value.filter((item) => {
    if (item.gradeKey !== gradeKey) return false
    if (item.subjectKey !== subjectKey) return false
    return true
  })

  if (!targets.length) {
    availableFormDba.value = []
    formDbaVersion.value = null
    showFormDba.value = false
    return
  }

  const target = targets[0]
  try {
    loadingFormDba.value = true
    showFormDba.value = true
    const resData: any = await academicService.getDbaPlaneacionDisponibles(schoolId.value, {
      id_grupo: target.id_grupo,
      id_materia: target.id_materia,
      id_periodo: competencyForm.value.id_periodo || undefined,
      id_competencia: competencyId || undefined
    })
    availableFormDba.value = resData.dba || []
    formDbaVersion.value = resData.versionCurricular
  } catch (error) {
    console.error('Error fetching available DBA for form:', error)
    availableFormDba.value = []
    formDbaVersion.value = null
  } finally {
    loadingFormDba.value = false
  }
}

const openCreateModal = () => {
  resetForm()
  availableFormDba.value = []
  formDbaVersion.value = null
  checkedFormDbaEvidences.value = []
  showFormDba.value = false
  editingCompetencyIsUsed.value = false
  editingCompetencyOriginalEvidences.value = []
  competencyModal.value = true
}

const openEditModal = async (item: CompetencyItem) => {
  competencyForm.value = {
    id_periodo: String(item.id_periodo),
    gradeKey: `${item.nivel_nombre}:${item.tipo_grado_nombre}`,
    subjectKey: String(item.id_materia),
    descripcion: item.descripcion,
    id_dimension: item.id_dimension || '',
  }
  checkedFormDbaEvidences.value = item.evidencias
    ? item.evidencias.filter(e => e.id_evidencia_dba).map(e => e.id_evidencia_dba as number)
    : []
  
  editingCompetencyOriginalEvidences.value = [...checkedFormDbaEvidences.value]
  editingCompetencyIsUsed.value = false
  
  competencyModal.value = true
  
  try {
    const data = await academicService.checkCompetencyUsage(item.id_competencia, schoolId.value)
    editingCompetencyIsUsed.value = data.isUsed
  } catch (error) {
    console.error('Error checking competency usage:', error)
  }

  await onFormContextChange(item.id_competencia)
}

const saveCompetency = async () => {
  if (!competencyForm.value.id_periodo || !competencyForm.value.gradeKey || !competencyForm.value.subjectKey || !competencyForm.value.descripcion.trim()) {
    notify.addNotification('Selecciona grado, materia, periodo y escribe la competencia.', 'warning')
    return
  }

  const isPreescolar = competencyForm.value.gradeKey.startsWith('PREESCOLAR:')
  if (isPreescolar && !competencyForm.value.id_dimension) {
    notify.addNotification('Selecciona la dimensión o área de desarrollo para preescolar.', 'warning')
    return
  }

  if (isPeriodClosed(competencyForm.value.id_periodo)) {
    notify.addNotification('No se pueden asignar ni modificar competencias en periodos cerrados.', 'error')
    return
  }

  const targets = assignmentChoices.value.filter((item) => {
    if (item.gradeKey !== competencyForm.value.gradeKey) return false
    if (item.subjectKey !== competencyForm.value.subjectKey) return false
    return true
  })

  if (!targets.length) {
    notify.addNotification('No hay cursos disponibles para esa materia dentro del grado seleccionado.', 'warning')
    return
  }

  try {
    saving.value = true
    const assignment = targets[0]
    await academicService.saveCompetency({
      schoolId: schoolId.value,
      id_grupo: assignment.id_grupo,
      id_materia: assignment.id_materia,
      id_periodo: Number(competencyForm.value.id_periodo),
      descripcion: competencyForm.value.descripcion.trim(),
      id_evidencias_dba: checkedFormDbaEvidences.value,
      id_dimension: competencyForm.value.id_dimension ? Number(competencyForm.value.id_dimension) : null,
    })
    competencyModal.value = false
    resetForm()
    await loadData()
    notify.addNotification('Competencia guardada correctamente', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'No fue posible guardar la competencia', 'error')
  } finally {
    saving.value = false
  }
}

const handleGradeFilterChange = () => {
  selectedSubject.value = ''
}

const handleFormGradeChange = () => {
  competencyForm.value.subjectKey = ''
  onFormContextChange()
}

const handleFormSubjectChange = () => {
  onFormContextChange()
}

const newEvidencia = ref<Record<number, string>>({})
const editingEvidencia = ref<number | null>(null)
const editEvidenciaText = ref('')

const addEvidencia = async (competencia: CompetencyItem) => {
  const desc = newEvidencia.value[competencia.id_competencia]?.trim()
  if (!desc) return

  try {
    saving.value = true
    const data = await academicService.createCurriculumEvidence(competencia.id_competencia, {
      schoolId: schoolId.value,
      descripcion: desc
    })
    if (!competencia.evidencias) competencia.evidencias = []
    competencia.evidencias.push(data)
    newEvidencia.value[competencia.id_competencia] = ''
    notify.addNotification('Evidencia agregada correctamente', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al agregar evidencia', 'error')
  } finally {
    saving.value = false
  }
}

const startEditEvidencia = (evidencia: any) => {
  editingEvidencia.value = evidencia.id_evidencia
  editEvidenciaText.value = evidencia.descripcion
}

const saveEditEvidencia = async (evidencia: any) => {
  const desc = editEvidenciaText.value.trim()
  if (!desc || desc === evidencia.descripcion) {
    editingEvidencia.value = null
    return
  }

  try {
    saving.value = true
    await academicService.updateCurriculumEvidence(evidencia.id_evidencia, {
      schoolId: schoolId.value,
      descripcion: desc
    })
    evidencia.descripcion = desc
    editingEvidencia.value = null
    notify.addNotification('Evidencia actualizada correctamente', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al actualizar evidencia', 'error')
  } finally {
    saving.value = false
  }
}

const removeEvidencia = async (competencia: CompetencyItem, evidenciaId: number) => {
  const ok = await confirm({
    title: 'Eliminar Evidencia Curricular',
    message: '¿Está seguro de que desea eliminar esta evidencia?',
    confirmText: 'Eliminar Evidencia',
    type: 'danger'
  })
  if (!ok) return

  try {
    saving.value = true
    await academicService.deleteCurriculumEvidence(evidenciaId, schoolId.value)
    competencia.evidencias = competencia.evidencias.filter((e: any) => e.id_evidencia !== evidenciaId)
    toast.success('Evidencia eliminada correctamente')
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al eliminar evidencia')
  } finally {
    saving.value = false
  }
}


const openDbaModal = async (competencia: CompetencyItem) => {
  selectedCompetenciaForDba.value = competencia
  dbaModal.value = true
  loadingDba.value = true
  availableDba.value = []
  dbaVersion.value = null
  dbaSearch.value = ''
  
  // Initialize checked evidences
  checkedDbaEvidences.value = competencia.evidencias
    .filter(e => e.id_evidencia_dba)
    .map(e => e.id_evidencia_dba as number)

  try {
    const resData: any = await academicService.getDbaPlaneacionDisponibles(schoolId.value, {
      id_grupo: competencia.id_grupo,
      id_materia: competencia.id_materia,
      id_periodo: competencia.id_periodo,
      id_competencia: competencia.id_competencia
    })
    availableDba.value = resData.dba || []
    dbaVersion.value = resData.versionCurricular
  } catch (error) {
    console.error('Error fetching available DBA:', error)
    notify.addNotification('No fue posible cargar el catálogo de DBA', 'error')
  } finally {
    loadingDba.value = false
  }
}

const saveDbaEvidencias = async () => {
  if (!selectedCompetenciaForDba.value) return

  try {
    saving.value = true
    await academicService.linkDbaEvidences(selectedCompetenciaForDba.value.id_competencia, {
      schoolId: schoolId.value,
      id_evidencias_dba: checkedDbaEvidences.value
    })
    dbaModal.value = false
    selectedCompetenciaForDba.value = null
    await loadData()
    notify.addNotification('Evidencias del DBA vinculadas correctamente', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al vincular evidencias de DBA', 'error')
  } finally {
    saving.value = false
  }
}


const filteredAvailableDba = computed(() => {
  const q = dbaSearch.value.toLowerCase().trim()
  if (!q) return availableDba.value
  return availableDba.value
    .map(dba => {
      const matchesDba = dba.enunciado?.toLowerCase().includes(q) || String(dba.numero_dba).includes(q)
      const filteredEvidencias = (dba.evidencias || []).filter((ev: any) =>
        ev.descripcion?.toLowerCase().includes(q)
      )
      if (matchesDba) return dba
      if (filteredEvidencias.length > 0) return { ...dba, evidencias: filteredEvidencias }
      return null
    })
    .filter(Boolean)
})

const filteredFormDba = computed(() => {
  const q = formDbaSearch.value.toLowerCase().trim()
  if (!q) return availableFormDba.value
  return availableFormDba.value
    .map(dba => {
      const matchesDba = dba.enunciado?.toLowerCase().includes(q) || String(dba.numero_dba).includes(q)
      const filteredEvidencias = (dba.evidencias || []).filter((ev: any) =>
        ev.descripcion?.toLowerCase().includes(q)
      )
      if (matchesDba) return dba
      if (filteredEvidencias.length > 0) return { ...dba, evidencias: filteredEvidencias }
      return null
    })
    .filter(Boolean)
})

const originalDbaId = computed(() => {
  if (editingCompetencyOriginalEvidences.value.length === 0 || !availableFormDba.value) return null
  for (const dba of availableFormDba.value) {
    if (dba.evidencias?.some((ev: any) => editingCompetencyOriginalEvidences.value.includes(ev.id_evidencia_dba))) {
      return dba.id_dba
    }
  }
  return null
})

const isCheckboxDisabled = (dbaId: number, evId: number): boolean => {
  if (!editingCompetencyIsUsed.value) return false
  
  // 1. Si ya estaba asignada originalmente a esta competencia, no permitir deseleccionar (no quitar evidencias)
  if (editingCompetencyOriginalEvidences.value.includes(evId)) {
    return true
  }
  
  // 2. Si pertenece a un DBA distinto del original, no permitir seleccionar (no cambiar de DBA)
  if (originalDbaId.value !== null && dbaId !== originalDbaId.value) {
    return true
  }
  
  return false
}

const completedDbaSuggestions = computed(() => {
  if (!showFormDba.value || availableFormDba.value.length === 0) return []

  const suggestions: { id_dba: number; numero_dba: number; enunciado: string }[] = []

  for (const dbaItem of availableFormDba.value) {
    if (!dbaItem.evidencias || dbaItem.evidencias.length === 0) continue

    // 1. Todas las evidencias del DBA deben estar completamente libres (ninguna asignada previamente a otra competencia)
    const hasAnyAssigned = dbaItem.evidencias.some((ev: any) => ev.asignada)
    if (hasAnyAssigned) continue

    // 2. El usuario debe haber marcado el 100% de las evidencias de este DBA en el formulario actual
    const allChecked = dbaItem.evidencias.every((ev: any) =>
      checkedFormDbaEvidences.value.includes(ev.id_evidencia_dba)
    )

    if (allChecked) {
      suggestions.push({
        id_dba: dbaItem.id_dba,
        numero_dba: dbaItem.numero_dba,
        enunciado: dbaItem.enunciado
      })
    }
  }

  return suggestions
})

const applyDbaEnunciado = (enunciado: string) => {
  competencyForm.value.descripcion = enunciado
  notify.addNotification('Enunciado del DBA asignado a la descripción', 'info')
}

onMounted(() => {
  yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
  loadData()
})

watch(() => yearStore.selectedYearId, loadData)
</script>

<template>
  <div class="space-y-8">
    <div class="overflow-hidden rounded-[32px] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_42%),linear-gradient(135deg,#081c15_0%,#0f3d2e_52%,#14532d_100%)] p-8 text-white shadow-sm md:p-10 dark:border-emerald-900/30">
      <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div class="max-w-3xl">
          <router-link
            to="/dashboard/configuracion-academica"
            class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white/90 transition hover:bg-white/15"
          >
            <ArrowLeft class="h-4 w-4" />
            Volver a configuración académica
          </router-link>
          <h1 class="mt-5 text-3xl font-black tracking-tight md:text-4xl">Gestión de competencias</h1>
          <p class="mt-3 max-w-2xl text-sm font-semibold text-emerald-50/90 md:text-base">
            Define la competencia base por curso, materia y periodo. Esta configuración es la base operativa de la institución.
          </p>
        </div>

        <button
          type="button"
          @click="openCreateModal"
          class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black text-emerald-700 shadow-lg shadow-black/10 transition hover:bg-emerald-50 uppercase tracking-widest"
        >
          <Plus class="h-4 w-4" />
          Asignar competencia
        </button>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-5">
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-[10px] uppercase font-black tracking-widest text-emerald-50/70">Registradas</p>
          <p class="mt-2 text-3xl font-black">{{ competencyStats.total }}</p>
        </div>
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-[10px] uppercase font-black tracking-widest text-emerald-50/70">Materias</p>
          <p class="mt-2 text-3xl font-black">{{ competencyStats.subjects }}</p>
        </div>
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-[10px] uppercase font-black tracking-widest text-emerald-50/70">Contextos</p>
          <p class="mt-2 text-3xl font-black">{{ competencyStats.contexts }}</p>
        </div>
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-[10px] uppercase font-black tracking-widest text-emerald-50/70">Pendientes</p>
          <p class="mt-2 text-3xl font-black text-orange-200">{{ competencyStats.pending }}</p>
        </div>
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-[10px] uppercase font-black tracking-widest text-emerald-50/70">Definidas</p>
          <p class="mt-2 text-3xl font-black text-emerald-300">{{ competencyStats.defined }}</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500">
      Cargando competencias académicas...
    </div>

    <template v-else>
      <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:p-8 dark:bg-slate-900 dark:border-slate-800">
        <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">Explorar asignaciones</h2>
            <p class="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Filtra por periodo o contexto para revisar y actualizar competencias.</p>
          </div>
          <div class="grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Buscar</span>
              <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:bg-slate-800 dark:border-slate-700">
                <Search class="h-4 w-4 text-slate-400" />
                <input v-model="search" type="text" placeholder="Buscar..." class="w-full bg-transparent text-sm font-semibold text-slate-700 dark:text-white outline-none" />
              </div>
            </label>
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Grado</span>
              <select v-model="selectedGrade" @change="handleGradeFilterChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none">
                <option value="">Todos los grados</option>
                <option v-for="item in gradeChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Materia</span>
              <select v-model="selectedSubject" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none">
                <option value="">Todas las materias</option>
                <option v-for="item in subjectChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Estado</span>
              <select v-model="selectedStatus" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none">
                <option value="">Todos los estados</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="DEFINIDA">Definida</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Periodo</span>
              <select v-model="selectedPeriod" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none">
                <option value="">Todos los periodos</option>
                <option v-for="period in periods" :key="period.id_periodo" :value="String(period.id_periodo)">
                  {{ period.nombre }}
                </option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div class="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 md:flex-row md:items-center md:justify-between dark:border-slate-800">
          <div class="flex items-center gap-3">
            <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <BookOpenCheck class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white">Competencias configuradas</h2>
              <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">{{ filteredCompetencies.length }} resultados visibles</p>
            </div>
          </div>

          <button
            type="button"
            @click="openCreateModal"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500 uppercase tracking-widest"
          >
            <Plus class="h-4 w-4" />
            Nueva competencia
          </button>
        </div>

        <!-- Diagnostic Banner DBA -->
        <div v-if="diagnosticData && (diagnosticData.unusedDbaCount > 0 || diagnosticData.freeEvidencesCount > 0)" class="mb-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-6 dark:bg-amber-950/20 dark:border-amber-900/40 shadow-sm animate-in fade-in duration-300">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles class="h-6 w-6" />
              </div>
              <div class="space-y-1">
                <h4 class="text-base font-black text-amber-950 dark:text-amber-200">
                  Diagnóstico de Cobertura DBA para el Grado Seleccionado
                </h4>
                <div class="text-xs font-semibold text-amber-900/90 dark:text-amber-300/90 space-y-1">
                  <p v-if="diagnosticData.unusedDbaCount > 0">
                    ⚠️ <strong>{{ diagnosticData.unusedDbaCount }} {{ diagnosticData.unusedDbaCount === 1 ? 'DBA oficial' : 'DBAs oficiales' }}</strong> no {{ diagnosticData.unusedDbaCount === 1 ? 'posee' : 'poseen' }} ninguna evidencia planeada aún: <span class="font-black text-amber-950 dark:text-amber-100">{{ diagnosticData.unusedDbas.join(', ') }}</span>.
                  </p>
                  <p v-if="diagnosticData.freeEvidencesCount > 0">
                    💡 <strong>{{ diagnosticData.freeEvidencesCount }} {{ diagnosticData.freeEvidencesCount === 1 ? 'evidencia' : 'evidencias' }} de aprendizaje</strong> {{ diagnosticData.freeEvidencesCount === 1 ? 'permanece libre / disponible' : 'permanecen libres / disponibles' }} para vincular a competencias.
                  </p>
                </div>
              </div>
            </div>
            <button @click="fetchDiagnostic" class="text-amber-600 hover:text-amber-800 p-2 dark:text-amber-400">
              <RefreshCw class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- Zero state -->
        <div v-if="filteredCompetencies.length === 0" class="px-6 py-16 text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600">
            <Sparkles class="h-7 w-7" />
          </div>
          <p class="mt-5 text-base font-black text-slate-700 dark:text-slate-400">No hay coincidencias con los filtros actuales.</p>
          <p class="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-500">Ajusta la búsqueda o crea una nueva asignación de competencia.</p>
        </div>

        <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
          <article v-for="item in filteredCompetencies" :key="item.id_competencia" class="px-6 py-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    {{ item.periodo_nombre }}
                  </span>
                  <span
                    :class="item.estado === 'DEFINIDA' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'"
                    class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                  >
                    {{ item.estado === 'DEFINIDA' ? 'Definida' : 'Pendiente' }}
                  </span>
                  <span v-if="item.dimension_nombre" class="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                    Dimensión: {{ item.dimension_nombre }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-widest">
                    {{ item.tipo_grado_nombre }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-widest">
                    {{ item.nivel_nombre }}
                  </span>
                </div>
                <h3 class="mt-4 text-xl font-black text-slate-900 dark:text-white tracking-tight">{{ item.materia_nombre }}</h3>
                <p class="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">Operativa para todos los cursos de este grado durante el periodo.</p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  v-if="!isPeriodClosed(item.id_periodo)"
                  type="button"
                  @click="openEditModal(item)"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 uppercase tracking-widest"
                >
                  <PenSquare class="h-4 w-4" />
                  Editar
                </button>
                <button
                  v-if="!isPeriodClosed(item.id_periodo)"
                  type="button"
                  @click="promptDeleteCompetencia(item)"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-900/40 uppercase tracking-widest"
                >
                  <Trash2 class="h-4 w-4" />
                  Eliminar
                </button>
                <span v-else class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-xs font-black uppercase text-slate-400 dark:bg-slate-800 dark:text-slate-500 tracking-wider">
                  Periodo Cerrado
                </span>
              </div>
            </div>

            <div class="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 shadow-inner">
              <p class="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-300 italic">"{{ item.descripcion }}"</p>

              <div v-if="item.estado === 'DEFINIDA'" class="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
                <h4 class="text-xs font-black text-slate-900 dark:text-white mb-5 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles class="h-3.5 w-3.5 text-emerald-500" />
                  Evidencias de aprendizaje
                  <span v-if="item.usa_dba" class="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 tracking-wider">Catálogo DBA</span>
                </h4>
                
                <ul v-if="item.evidencias?.length" class="space-y-4 mb-6">
                  <li v-for="ev in item.evidencias" :key="ev.id_evidencia" class="flex items-start gap-3 group">
                    <div class="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <div v-if="editingEvidencia === ev.id_evidencia" class="flex-1 flex gap-2">
                      <input type="text" v-model="editEvidenciaText" @keyup.enter="saveEditEvidencia(ev)" class="flex-1 rounded-xl border border-emerald-200 px-4 py-2 text-sm outline-none focus:border-emerald-500 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                      <button @click="saveEditEvidencia(ev)" class="text-emerald-600 hover:text-emerald-700 p-2 dark:text-emerald-400"><Check class="h-5 w-5" /></button>
                      <button @click="editingEvidencia = null" class="text-slate-400 hover:text-slate-600 p-2"><X class="h-5 w-5" /></button>
                    </div>
                    <div v-else class="flex-1 flex justify-between items-start gap-4">
                      <div class="space-y-1">
                        <div v-if="ev.id_evidencia_dba || ev.numero_dba" class="flex items-center gap-2">
                          <span class="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-indigo-200/60 dark:border-indigo-800/60">
                            <Sparkles class="h-3 w-3 text-indigo-500" />
                            DBA #{{ ev.numero_dba || 'Asignado' }}
                          </span>
                          <span v-if="ev.dba_enunciado" class="text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-md" :title="ev.dba_enunciado">
                            - {{ ev.dba_enunciado }}
                          </span>
                        </div>
                        <span class="text-sm font-semibold text-slate-700 dark:text-slate-300 block leading-relaxed">{{ ev.descripcion }}</span>
                      </div>
                      <div v-if="!ev.id_evidencia_dba && !isPeriodClosed(item.id_periodo)" class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button @click="startEditEvidencia(ev)" class="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"><PenSquare class="h-4 w-4" /></button>
                        <button @click="removeEvidencia(item, ev.id_evidencia)" class="text-slate-400 hover:text-red-500"><Trash2 class="h-4 w-4" /></button>
                      </div>
                    </div>
                  </li>
                </ul>
                <div v-else class="text-sm text-slate-500 dark:text-slate-600 italic mb-6">No hay evidencias definidas para esta competencia.</div>
                
                <div v-if="item.usa_dba && !isPeriodClosed(item.id_periodo)" class="flex justify-start">
                  <button @click="openDbaModal(item)" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-black text-white hover:bg-emerald-500 uppercase tracking-widest transition-all shadow-sm">
                    <Sparkles class="h-4 w-4" /> Vincular Evidencias del DBA
                  </button>
                </div>
                <div v-else-if="!isPeriodClosed(item.id_periodo)" class="flex gap-3">
                  <input type="text" v-model="newEvidencia[item.id_competencia]" @keyup.enter="addEvidencia(item)" placeholder="Agregar evidencia..." class="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold outline-none transition focus:border-emerald-400 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:focus:ring-2 dark:focus:ring-emerald-500/20" />
                  <button @click="addEvidencia(item)" :disabled="!newEvidencia[item.id_competencia]?.trim() || saving" class="inline-flex items-center justify-center rounded-xl bg-slate-100 px-6 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 uppercase tracking-widest">
                    <Plus class="h-4 w-4 mr-1.5" /> Agregar
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>

    <!-- Modal de Creación/Edición -->
    <div v-if="competencyModal" class="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all">
      <div class="flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
        <!-- Backdrop close handler -->
        <div class="fixed inset-0 bg-transparent" @click="competencyModal = false; resetForm()"></div>

        <!-- Modal content card -->
        <div class="relative w-full max-w-3xl rounded-[2.5rem] bg-white shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div class="border-b border-slate-100 px-6 py-5 md:px-8 dark:border-slate-800/60">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="h-11 w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-inner">
                   <Plus class="h-5 w-5" v-if="!competencyForm.id_periodo" />
                   <PenSquare class="h-5 w-5" v-else />
                </div>
                <div>
                  <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Asignar competencia</h2>
                  <p class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mt-1">Definición académica base</p>
                </div>
              </div>
              <button
                type="button"
                @click="competencyModal = false; resetForm()"
                class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
          </div>
          <div class="px-6 py-6 md:px-8 md:py-8">
            <div class="mb-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 dark:bg-emerald-950/10 dark:border-emerald-900/30">
              <p class="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Consistencia garantizada</p>
              <p class="mt-2 text-sm font-semibold leading-relaxed text-emerald-900 dark:text-emerald-300/80">
                La competencia definida se replicará automáticamente a todos los cursos del grado seleccionado para mantener la uniformidad pedagógica.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
              <label class="space-y-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Grado académico</span>
                <select v-model="competencyForm.gradeKey" @change="handleFormGradeChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="">Selecciona un grado</option>
                  <option v-for="item in gradeChoices" :key="item.key" :value="item.key">
                    {{ item.label }}
                  </option>
                </select>
              </label>
              <div class="space-y-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Cobertura institucional</span>
                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 leading-relaxed italic">
                  Se aplicará a todos los cursos disponibles del grado seleccionado.
                </div>
              </div>
              <label class="space-y-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Periodo lectivo</span>
                <select v-model="competencyForm.id_periodo" @change="onFormContextChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="">Selecciona un periodo</option>
                  <option v-for="period in periods" :key="period.id_periodo" :value="String(period.id_periodo)" :disabled="period.estado === 'CERRADO'">
                    {{ period.nombre }}{{ period.estado === 'CERRADO' ? ' (CERRADO)' : '' }}
                  </option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Materia / Asignatura</span>
                <select v-model="competencyForm.subjectKey" @change="handleFormSubjectChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="">Selecciona una materia</option>
                  <option v-for="item in formSubjectChoices" :key="item.key" :value="item.key">
                    {{ item.label }}
                  </option>
                </select>
              </label>
              
              <!-- Selector de Dimensiones para Preescolar -->
              <label v-if="competencyForm.gradeKey && competencyForm.gradeKey.startsWith('PREESCOLAR:')" class="space-y-2 md:col-span-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Dimensión / Área de Desarrollo</span>
                <select v-model="competencyForm.id_dimension" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="">Selecciona una dimensión</option>
                  <option v-for="dim in dimensions" :key="dim.id_dimension" :value="dim.id_dimension">
                    {{ dim.nombre }}
                  </option>
                </select>
              </label>

              <label class="space-y-2 md:col-span-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Descripción pedagógica</span>
                <textarea v-model="competencyForm.descripcion" rows="4" placeholder="Indica el aprendizaje esperado..." class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
              </label>

              <!-- Sugerencia Automática de Enunciado DBA -->
              <div 
                v-for="sug in completedDbaSuggestions" 
                :key="sug.id_dba"
                class="md:col-span-2 rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4 dark:bg-emerald-950/30 dark:border-emerald-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
              >
                <div class="flex items-start gap-3">
                  <Sparkles class="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div class="space-y-0.5">
                    <p class="text-xs font-black text-emerald-950 dark:text-emerald-200">
                      ¡Has seleccionado todas las evidencias del DBA #{{ sug.numero_dba }}!
                    </p>
                    <p class="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 line-clamp-2 italic">"{{ sug.enunciado }}"</p>
                  </div>
                </div>
                <button
                  type="button"
                  @click="applyDbaEnunciado(sug.enunciado)"
                  class="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 transition-all uppercase tracking-wider shadow-sm flex items-center gap-1.5"
                >
                  <Check class="h-3.5 w-3.5" />
                  Usar Enunciado
                </button>
              </div>

              <!-- Vinculación de Evidencias DBA desde el modal de creación -->
              <div v-if="showFormDba" class="md:col-span-2 space-y-4">
                <div class="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <BookOpenCheck class="h-4 w-4 text-emerald-600" />
                    Vincular Evidencias del DBA
                  </h3>
                  <span v-if="formDbaVersion" class="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 tracking-widest">
                    {{ formDbaVersion }}
                  </span>
                </div>
                
                <div v-if="loadingFormDba" class="py-6 text-center text-sm font-semibold text-slate-400">
                  Cargando evidencias del catálogo oficial DBA...
                </div>
                
                <div v-else-if="availableFormDba.length === 0" class="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center dark:bg-slate-800/40 dark:border-slate-800">
                  <p class="text-xs font-bold text-slate-500">No hay catálogo DBA activo para este grado/materia.</p>
                </div>
                
                <div v-else class="space-y-3">
                  <!-- Buscador en creación -->
                  <div class="relative">
                    <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      v-model="formDbaSearch"
                      type="text"
                      placeholder="Buscar evidencia..."
                      class="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                  </div>

                  <div v-if="filteredFormDba.length === 0" class="py-4 text-center text-xs font-semibold text-slate-400">
                    No se encontraron evidencias.
                  </div>

                  <div class="max-h-[300px] overflow-y-auto pr-2 space-y-4">
                    <div v-for="dbaItem in filteredFormDba" :key="dbaItem.id_dba" class="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:bg-slate-800/30 dark:border-slate-800">
                      <div class="flex items-start gap-3">
                        <span class="rounded-xl bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[10px] font-black dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0">
                          DBA #{{ dbaItem.numero_dba }}
                        </span>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                          {{ dbaItem.enunciado }}
                        </p>
                      </div>

                      <div class="mt-4 border-t border-slate-200/50 pt-3 dark:border-slate-700/50 space-y-2">
                        <label
                          v-for="ev in dbaItem.evidencias"
                          :key="ev.id_evidencia_dba"
                          :class="[
                            'flex items-start gap-2.5 rounded-xl border p-3 transition-colors',
                            ev.asignada
                              ? 'border-amber-200/50 bg-amber-50/30 cursor-not-allowed dark:bg-amber-950/10 dark:border-amber-900/30'
                              : isCheckboxDisabled(dbaItem.id_dba, ev.id_evidencia_dba)
                                ? 'border-slate-100 bg-slate-100/50 cursor-not-allowed dark:bg-slate-800/10 dark:border-slate-800 opacity-60'
                                : 'border-slate-200/40 bg-white hover:bg-emerald-50/20 cursor-pointer dark:bg-slate-900 dark:border-slate-800'
                          ]"
                        >
                          <input
                            v-if="!ev.asignada"
                            type="checkbox"
                            v-model="checkedFormDbaEvidences"
                            :value="ev.id_evidencia_dba"
                            :disabled="isCheckboxDisabled(dbaItem.id_dba, ev.id_evidencia_dba)"
                            class="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <div v-else class="mt-0.5 h-4 w-4 rounded border border-amber-300 bg-amber-100 flex items-center justify-center shrink-0 dark:bg-amber-900/30 dark:border-amber-700">
                            <svg class="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                          </div>
                          <div class="flex-1 min-w-0">
                            <span :class="ev.asignada ? 'text-amber-700/70 dark:text-amber-400/70' : 'text-slate-600 dark:text-slate-400'" class="text-xs font-semibold leading-relaxed block">
                              {{ ev.descripcion }}
                            </span>
                            <div v-if="ev.asignada && ev.asignada_a" class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700 tracking-wider dark:bg-amber-900/40 dark:text-amber-400">
                                {{ ev.asignada_a.periodo_nombre }}
                              </span>
                              <span class="text-[9px] font-semibold text-amber-600/70 dark:text-amber-400/50 truncate max-w-[200px]" :title="ev.asignada_a.competencia_descripcion">
                                {{ ev.asignada_a.competencia_descripcion }}
                              </span>
                            </div>
                            <!-- Alertas de bloqueo por actividades -->
                            <div v-if="editingCompetencyIsUsed" class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <span v-if="editingCompetencyOriginalEvidences.includes(ev.id_evidencia_dba)" class="rounded-full bg-red-50 dark:bg-red-950/20 px-2 py-0.5 text-[8px] font-black uppercase text-red-700 dark:text-red-400 tracking-wider">
                                Bloqueada (Tiene Actividades)
                              </span>
                              <span v-else-if="originalDbaId !== null && dbaItem.id_dba !== originalDbaId" class="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                Bloqueada (DBA Distinto)
                              </span>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-end">
              <button type="button" @click="competencyModal = false; resetForm()" class="px-8 py-3.5 rounded-2xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest">Cancelar</button>
              <button type="button" @click="saveCompetency" :disabled="saving" class="inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-10 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-200/20 dark:shadow-none hover:bg-emerald-500 transition-all disabled:opacity-50 uppercase tracking-widest">
                <Plus class="h-4 w-4" />
                {{ saving ? 'Guardando...' : 'Guardar competencia' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Vinculación de Evidencias DBA (Fase 2) -->
    <div v-if="dbaModal" class="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all animate-in fade-in duration-200">
      <div class="flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
        <div class="fixed inset-0 bg-transparent" @click="dbaModal = false; selectedCompetenciaForDba = null"></div>

        <div class="relative w-full max-w-4xl rounded-[2.5rem] bg-white shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div class="border-b border-slate-100 px-6 py-5 md:px-8 dark:border-slate-800/60">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="h-11 w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-inner">
                   <BookOpenCheck class="h-5 w-5" />
                </div>
                <div>
                  <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Vincular Evidencias DBA</h2>
                  <p class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mt-1">Catálogo Oficial del Ministerio de Educación</p>
                </div>
              </div>
              <button
                type="button"
                @click="dbaModal = false; selectedCompetenciaForDba = null"
                class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div class="px-6 py-6 md:px-8 md:py-8 max-h-[60vh] overflow-y-auto">
            <div v-if="loadingDba" class="py-12 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              Cargando evidencias del catálogo oficial DBA...
            </div>
            <div v-else-if="availableDba.length === 0" class="py-12 text-center">
              <p class="text-base font-black text-slate-700 dark:text-slate-400">No hay catálogo DBA asignado.</p>
              <p class="mt-2 text-sm font-semibold text-slate-500 max-w-md mx-auto leading-relaxed">
                Este grado o materia no tiene una versión curricular del catálogo DBA asociada a la institución académica.
              </p>
            </div>
            <div v-else class="space-y-6">
              <div class="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 dark:bg-emerald-950/10 dark:border-emerald-900/30">
                <span class="rounded-full bg-emerald-600 px-3 py-1 text-[9px] font-black uppercase text-white tracking-widest">
                  Versión Activa: {{ dbaVersion }}
                </span>
                <h3 class="mt-3 text-sm font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                  {{ selectedCompetenciaForDba?.materia_nombre }} — Grado {{ selectedCompetenciaForDba?.tipo_grado_nombre }}
                </h3>
                <p class="mt-2 text-xs font-semibold text-emerald-800/80 dark:text-emerald-400 leading-relaxed">
                  Selecciona qué evidencias oficiales formarán parte de tu planeación académica. Las evidencias bloqueadas ya fueron asignadas a otra competencia.
                </p>
              </div>

              <!-- Buscador -->
              <div class="relative">
                <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  v-model="dbaSearch"
                  type="text"
                  placeholder="Buscar evidencia por texto o número de DBA..."
                  class="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div v-if="filteredAvailableDba.length === 0" class="py-8 text-center text-sm font-semibold text-slate-400">
                No se encontraron evidencias que coincidan con tu búsqueda.
              </div>

              <div class="space-y-6">
                <div v-for="dbaItem in filteredAvailableDba" :key="dbaItem.id_dba" class="rounded-3xl border border-slate-100 bg-slate-50 p-6 dark:bg-slate-800/50 dark:border-slate-800 shadow-sm">
                  <div class="flex items-start gap-4">
                    <span class="rounded-2xl bg-emerald-100 text-emerald-800 px-3 py-2 text-xs font-black dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0">
                      DBA #{{ dbaItem.numero_dba }}
                    </span>
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {{ dbaItem.enunciado }}
                    </p>
                  </div>

                  <div class="mt-6 border-t border-slate-200/60 pt-5 dark:border-slate-700/60 space-y-4">
                    <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Evidencias Oficiales:
                    </h4>
                    <div class="grid grid-cols-1 gap-3">
                      <!-- Evidencia (seleccionable si es libre o pertenece a esta competencia) -->
                      <label
                        v-for="ev in dbaItem.evidencias"
                        :key="ev.id_evidencia_dba"
                        :class="[
                          'flex items-start gap-3 rounded-2xl border p-4 transition-colors',
                          ev.asignada && !ev.asignada_a_esta_competencia
                            ? 'border-amber-200/60 bg-amber-50/40 cursor-not-allowed dark:bg-amber-950/10 dark:border-amber-900/30'
                            : ev.asignada_a_esta_competencia
                            ? 'border-emerald-200 bg-emerald-50/50 cursor-pointer dark:bg-emerald-950/20 dark:border-emerald-900/40'
                            : 'border-slate-200/50 bg-white hover:bg-emerald-50/20 cursor-pointer dark:bg-slate-900 dark:border-slate-800'
                        ]"
                      >
                        <input
                          v-if="!ev.asignada || ev.asignada_a_esta_competencia"
                          type="checkbox"
                          v-model="checkedDbaEvidences"
                          :value="ev.id_evidencia_dba"
                          class="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div v-else class="mt-1 h-4.5 w-4.5 rounded border border-amber-300 bg-amber-100 flex items-center justify-center shrink-0 dark:bg-amber-900/30 dark:border-amber-700">
                          <svg class="h-3 w-3 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                        </div>
                        <div class="flex-1 min-w-0">
                          <span :class="ev.asignada && !ev.asignada_a_esta_competencia ? 'text-amber-800/70 dark:text-amber-400/70' : 'text-slate-700 dark:text-slate-300'" class="text-xs font-semibold leading-relaxed block">
                            {{ ev.descripcion }}
                          </span>
                          <div v-if="ev.asignada && ev.asignada_a && !ev.asignada_a_esta_competencia" class="mt-2 flex items-center gap-2 flex-wrap">
                            <span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase text-amber-700 tracking-wider dark:bg-amber-900/40 dark:text-amber-400">
                              Asignada · {{ ev.asignada_a.periodo_nombre }}
                            </span>
                            <span class="text-[10px] font-semibold text-amber-600/80 dark:text-amber-400/60 truncate max-w-xs" :title="ev.asignada_a.competencia_descripcion">
                              {{ ev.asignada_a.competencia_descripcion }}
                            </span>
                          </div>
                          <div v-else-if="ev.asignada_a_esta_competencia" class="mt-2 flex items-center gap-2 flex-wrap">
                            <span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-700 tracking-wider dark:bg-emerald-950/60 dark:text-emerald-300">
                              Vinculada a esta competencia (Editable)
                            </span>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="border-t border-slate-100 px-6 py-5 md:px-8 dark:border-slate-800/60 flex flex-col gap-4 sm:flex-row sm:justify-end bg-slate-50 dark:bg-slate-900/40">
            <button
              type="button"
              @click="dbaModal = false; selectedCompetenciaForDba = null"
              class="px-8 py-3.5 rounded-2xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="saveDbaEvidencias"
              :disabled="saving || loadingDba || availableDba.length === 0"
              class="inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-10 py-3.5 text-sm font-black text-white hover:bg-emerald-500 transition-all disabled:opacity-50 uppercase tracking-widest shadow-xl shadow-emerald-600/10 dark:shadow-none"
            >
              <Check class="h-4 w-4" />
              {{ saving ? 'Guardando...' : 'Guardar Vinculación' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmación y Advertencia de Eliminación de Competencia -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div class="relative w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 bg-rose-500/10 p-6 md:px-8 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-md">
              <Trash2 class="h-6 w-6" />
            </div>
            <div>
              <h3 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Eliminación de Competencia</h3>
              <p class="text-xs font-semibold text-rose-600 dark:text-rose-400">Verificación de impacto y docentes involucrados</p>
            </div>
          </div>
          <button @click="showDeleteModal = false" class="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X class="h-6 w-6" /></button>
        </div>

        <!-- Body -->
        <div class="p-6 md:p-8 space-y-6">
          <div v-if="loadingDeleteCheck" class="py-10 text-center space-y-3">
            <RefreshCw class="h-8 w-8 text-rose-500 animate-spin mx-auto" />
            <p class="text-xs font-bold text-slate-500">Verificando uso por docentes y calificaciones registradas...</p>
          </div>

          <template v-else-if="deleteUsageInfo">
            <!-- Competency Description -->
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Competencia a Eliminar:</p>
              <p class="text-sm font-bold text-slate-900 dark:text-white mt-1 italic">"{{ deleteUsageInfo.descripcion }}"</p>
            </div>

            <!-- Usage Warning -->
            <div v-if="deleteUsageInfo.isUsed" class="space-y-4">
              <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/40 space-y-2">
                <h4 class="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle class="h-4 w-4 text-rose-600" />
                  ¡ADVERTENCIA CRÍTICA DE DESVINCULACIÓN DE NOTAS!
                </h4>
                <p class="text-xs font-semibold text-rose-900/90 dark:text-rose-200 leading-relaxed">
                  Esta competencia ya ha sido utilizada por docentes para evaluar estudiantes. Si confirmas la eliminación, el sistema iniciará una <strong>transacción segura</strong> que desvinculará las notas y actividades de esta competencia.
                </p>
              </div>

              <!-- Teachers list -->
              <div class="space-y-2">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Docentes y Cursos Afectados:</p>
                <div class="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                  <div 
                    v-for="(t, idx) in deleteUsageInfo.teachersUsage" 
                    :key="idx"
                    class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold"
                  >
                    <div>
                      <p class="text-slate-900 dark:text-white">{{ t.docente_nombre }}</p>
                      <p class="text-[10px] font-semibold text-slate-500">{{ t.materia_nombre }} · {{ t.grupo_nombre }}</p>
                    </div>
                    <div class="text-right">
                      <span class="rounded-lg bg-rose-100 text-rose-700 px-2 py-1 text-[10px] font-black dark:bg-rose-950 dark:text-rose-300">
                        {{ t.total_notas }} {{ t.total_notas === 1 ? 'nota' : 'notas' }} / {{ t.total_actividades }} {{ t.total_actividades === 1 ? 'actividad' : 'actividades' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              ✓ Esta competencia no tiene actividades ni notas registradas. Puede eliminarse limpiamente.
            </div>
          </template>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              @click="showDeleteModal = false"
              class="rounded-xl px-5 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button 
              @click="confirmDeleteCompetencia"
              :disabled="saving"
              class="rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-black text-white hover:bg-rose-500 uppercase tracking-wider shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 class="h-4 w-4" />
              {{ deleteUsageInfo?.isUsed ? 'Sí, Eliminar y Desvincular' : 'Sí, Eliminar Competencia' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
