<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { academicService } from '../../services/academicService'
import { 
  Layers3, Plus, Search, School2, Trash2, Info, Pencil, Tag, RefreshCw, Lock, 
  Calendar, Eye, Users, GraduationCap, X, Sun, Sunset, Moon, Globe, 
  SlidersHorizontal, Layers
} from 'lucide-vue-next'

import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'
import { useAcademicYearStore } from '../../stores/academicYear'
import { getCourseDisplayName, getNextSectionName } from '../../utils/courseHelper'
import CreateGradeOrGroupModal from '../../components/academico/CreateGradeOrGroupModal.vue'
import EditCuposModal from '../../components/academico/EditCuposModal.vue'
import RenameCourseModal from '../../components/academico/RenameCourseModal.vue'
import BulkRenameModal from '../../components/academico/BulkRenameModal.vue'
import CourseMembersModal from '../../components/academico/CourseMembersModal.vue'
import JornadaManagementModals from '../../components/academico/JornadaManagementModals.vue'



const yearStore = useAcademicYearStore()

interface Nivel {
  id_nivel: number
  nombre: string
}

interface Jornada {
  id_jornada: number
  nombre: string
}

interface Seccion {
  id_seccion: number
  nombre: string
}

interface TipoGrado {
  id_tipo_grado: number
  nombre: string
  id_nivel: number
  nivel_nombre: string
  cursos_count: number
}

interface Grupo {
  id_grupo: number
  id_nivel: number
  id_jornada: number
  id_seccion: number
  id_tipo_grado: number
  cupos_totales: number
  nivel_nombre: string
  tipo_grado_nombre: string
  jornada_nombre: string
  seccion_nombre: string
  matriculas_count: number
  asignaciones_count: number
  competencias_count: number
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))
const notify = useNotificationStore()

const activeMainTab = ref<'grades_courses' | 'jornadas'>('grades_courses')
const selectedJornadaId = ref<number | null>(null)
const showCreateJornadaModal = ref(false)
const newJornadaName = ref<string>('MAÑANA')
const savingJornada = ref(false)
const deleteJornadaModal = ref(false)
const targetJornadaToDelete = ref<Jornada | null>(null)
const deletingJornada = ref(false)
const reassignJornadaModal = ref(false)
const targetGroupToReassign = ref<Grupo | null>(null)
const newTargetJornadaId = ref<number | null>(null)
const reassigningJornada = ref(false)

const loading = ref(true)
const savingGrade = ref(false)
const savingGroup = ref(false)
const searchMode = ref<'grade' | 'course'>('grade')
const searchTerm = ref('')
const createModal = ref<null | 'grade' | 'course'>(null)
const deleting = ref(false)
const savingCupos = ref(false)
const editCuposModal = ref(false)
const selectedGroup = ref<Grupo | null>(null)
const selectedGradeId = ref<number | null>(null)

// Reactives for Renaming
const renameModal = ref(false)
const renameTarget = ref<Grupo | null>(null)
const renameName = ref('')
const renaming = ref(false)

const bulkModal = ref(false)
const bulkTarget = ref<TipoGrado | null>(null)
const bulkPrefijo = ref('')
const bulkSeparador = ref('-')
const bulkOrdinalType = ref<'NUMERO' | 'LETRA'>('NUMERO')
const bulkRenaming = ref(false)

type DeleteModalState =
  | { kind: 'grade'; item: TipoGrado }
  | { kind: 'course'; item: Grupo }
  | null

const deleteModal = ref<DeleteModalState>(null)

const niveles = ref<Nivel[]>([])
const jornadas = ref<Jornada[]>([])
const secciones = ref<Seccion[]>([])
const tiposGrado = ref<TipoGrado[]>([])
const grupos = ref<Grupo[]>([])

const newGroup = ref({
  id_nivel: '',
  id_tipo_grado: '',
  id_jornada: '',
  id_seccion: '',
  cupos_totales: 30,
})


// Grados & Cursos Filters State

const selectedNivelFilter = ref<number | null>(null)
const selectedJornadaFilter = ref<number | null>(null)
const gradeStatusFilter = ref<'TODOS' | 'CON_CURSOS' | 'SIN_CURSOS'>('TODOS')

// Grados & Cursos KPI Metrics
const totalMatriculas = computed(() => grupos.value.reduce((acc, g) => acc + (g.matriculas_count || 0), 0))
const totalCupos = computed(() => grupos.value.reduce((acc, g) => acc + (g.cupos_totales || 0), 0))
const globalOcupacionPct = computed(() => totalCupos.value > 0 ? Math.round((totalMatriculas.value / totalCupos.value) * 100) : 0)
const avgEstudiantesPorCurso = computed(() => grupos.value.length > 0 ? (totalMatriculas.value / grupos.value.length).toFixed(1) : '0')
const fullCapacityCoursesCount = computed(() => grupos.value.filter(g => (g.matriculas_count || 0) >= (g.cupos_totales || 30)).length)
const availableCapacityCoursesCount = computed(() => grupos.value.filter(g => (g.matriculas_count || 0) < (g.cupos_totales || 30)).length)
const uniqueNivelesCount = computed(() => new Set(tiposGrado.value.map(t => t.id_nivel)).size)
const gradesWithoutCoursesCount = computed(() => tiposGrado.value.filter(t => t.cursos_count === 0).length)

const hasActiveFilters = computed(() => {
  return selectedGradeId.value !== null ||
    selectedNivelFilter.value !== null ||
    selectedJornadaFilter.value !== null ||
    cupoFilter.value !== 'TODOS' ||
    gradeStatusFilter.value !== 'TODOS' ||
    searchTerm.value.trim() !== ''
})

const resetAllFilters = () => {
  selectedGradeId.value = null
  selectedNivelFilter.value = null
  selectedJornadaFilter.value = null
  cupoFilter.value = 'TODOS'
  gradeStatusFilter.value = 'TODOS'
  searchTerm.value = ''
}

const visibleGradeTypes = computed(() => {
  let list = tiposGrado.value

  // Filter by level
  if (selectedNivelFilter.value !== null) {
    list = list.filter(item => item.id_nivel === selectedNivelFilter.value)
  }

  // Filter by status (with or without courses)
  if (gradeStatusFilter.value === 'CON_CURSOS') {
    list = list.filter(item => item.cursos_count > 0)
  } else if (gradeStatusFilter.value === 'SIN_CURSOS') {
    list = list.filter(item => item.cursos_count === 0)
  }

  // Filter by search term
  const term = searchTerm.value.trim().toLowerCase()
  if (term) {
    list = list.filter((item) =>
      item.nombre.toLowerCase().includes(term) ||
      item.nivel_nombre.toLowerCase().includes(term)
    )
  }

  return list
})

type CupoFilterOption = 'TODOS' | 'CON_CUPOS' | 'SIN_CUPOS' | 'BAJA_OCUPACION' | 'ALTA_OCUPACION' | 'MENOS_10' | 'ENTRE_10_25' | 'MAS_25'

const cupoFilter = ref<CupoFilterOption>('TODOS')

const getCupoFilterLabel = (val: CupoFilterOption): string => {
  switch (val) {
    case 'CON_CUPOS': return 'Con cupos disponibles'
    case 'SIN_CUPOS': return 'Cupos llenos (100%)'
    case 'BAJA_OCUPACION': return 'Baja ocupación (< 50%)'
    case 'ALTA_OCUPACION': return 'Alta ocupación (≥ 80%)'
    case 'MENOS_10': return '< 10 estudiantes'
    case 'ENTRE_10_25': return '10 a 25 estudiantes'
    case 'MAS_25': return '> 25 estudiantes'
    default: return 'Todos los cupos'
  }
}

const visibleGroups = computed(() => {
  let list = grupos.value

  // Filter by selected grade if any
  if (selectedGradeId.value) {
    list = list.filter(item => item.id_tipo_grado === selectedGradeId.value)
  }

  // Filter by level
  if (selectedNivelFilter.value !== null) {
    list = list.filter(item => item.id_nivel === selectedNivelFilter.value)
  }

  // Filter by jornada
  if (selectedJornadaFilter.value !== null) {
    list = list.filter(item => item.id_jornada === selectedJornadaFilter.value)
  }

  // Filter by search term
  const term = searchTerm.value.trim().toLowerCase()
  if (term) {
    list = list.filter((item) =>
      item.tipo_grado_nombre.toLowerCase().includes(term) ||
      item.nivel_nombre.toLowerCase().includes(term) ||
      item.jornada_nombre.toLowerCase().includes(term) ||
      item.seccion_nombre.toLowerCase().includes(term)
    )
  }

  // Filter by cupos / occupation
  if (cupoFilter.value !== 'TODOS') {
    list = list.filter(item => {
      const count = item.matriculas_count || 0
      const total = item.cupos_totales || 30
      const pct = total > 0 ? (count / total) * 100 : 0

      switch (cupoFilter.value) {
        case 'CON_CUPOS': return count < total
        case 'SIN_CUPOS': return count >= total
        case 'BAJA_OCUPACION': return pct < 50
        case 'ALTA_OCUPACION': return pct >= 80
        case 'MENOS_10': return count < 10
        case 'ENTRE_10_25': return count >= 10 && count <= 25
        case 'MAS_25': return count > 25
        default: return true
      }
    })
  }

  // Sort list naturally
  return [...list].sort((a, b) => {
    const levelCompare = a.nivel_nombre.localeCompare(b.nivel_nombre, undefined, { sensitivity: 'base' })
    if (levelCompare !== 0) return levelCompare

    const gradeCompare = a.tipo_grado_nombre.localeCompare(b.tipo_grado_nombre, undefined, { numeric: true, sensitivity: 'base' })
    if (gradeCompare !== 0) return gradeCompare

    const sectionCompare = a.seccion_nombre.localeCompare(b.seccion_nombre, undefined, { numeric: true, sensitivity: 'base' })
    if (sectionCompare !== 0) return sectionCompare

    return a.jornada_nombre.localeCompare(b.jornada_nombre, undefined, { sensitivity: 'base' })
  })
})

const selectedGrade = computed(() => {
  if (!selectedGradeId.value) return undefined
  return tiposGrado.value.find(t => t.id_tipo_grado === selectedGradeId.value)
})

const bulkCourseCount = computed(() => {
  if (!bulkTarget.value) return 0
  return grupos.value.filter(g => g.id_tipo_grado === bulkTarget.value!.id_tipo_grado).length
})

const computedNextSectionName = computed(() => {
  const gradeId = Number(newGroup.value.id_tipo_grado)
  if (!gradeId) return ''
  const gradeGroups = grupos.value.filter(g => g.id_tipo_grado === gradeId)
  const existingNames = gradeGroups.map(g => g.seccion_nombre)
  return getNextSectionName(existingNames)
})


const toggleGradeSelection = (id: number) => {

  if (selectedGradeId.value === id) {
    selectedGradeId.value = null
  } else {
    selectedGradeId.value = id
  }
}

const onYearChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target && target.value) {
    yearStore.setSelectedYearId(Number(target.value))
  }
}

const openCreateModal = (mode: 'grade' | 'course') => {
  if (yearStore.isClosedYear) {
    notify.addNotification('El año lectivo seleccionado se encuentra cerrado. Todas las acciones están en modo solo lectura.', 'warning')
    return
  }
  createModal.value = mode
}

const closeCreateModal = () => {
  createModal.value = null
}

const openDeleteGradeModal = (item: TipoGrado) => {
  if (yearStore.isClosedYear) {
    notify.addNotification('El año lectivo seleccionado se encuentra cerrado. No se puede eliminar.', 'warning')
    return
  }
  deleteModal.value = { kind: 'grade', item }
}

const openDeleteCourseModal = (item: Grupo) => {
  if (yearStore.isClosedYear) {
    notify.addNotification('El año lectivo seleccionado se encuentra cerrado. No se puede eliminar.', 'warning')
    return
  }
  deleteModal.value = { kind: 'course', item }
}

const closeDeleteModal = () => {
  if (deleting.value) return
  deleteModal.value = null
}

const openEditCuposModal = (group: Grupo) => {
  if (yearStore.isClosedYear) {
    notify.addNotification('El año lectivo seleccionado se encuentra cerrado. No se pueden editar cupos.', 'warning')
    return
  }
  selectedGroup.value = { ...group }
  editCuposModal.value = true
}

const openRenameModal = (group: Grupo) => {
  if (yearStore.isClosedYear) {
    notify.addNotification('El año lectivo seleccionado se encuentra cerrado. No se puede renombrar.', 'warning')
    return
  }
  renameTarget.value = group
  renameName.value = group.seccion_nombre
  renameModal.value = true
}

const openBulkRenameModal = (gradeType: TipoGrado) => {
  if (yearStore.isClosedYear) {
    notify.addNotification('El año lectivo seleccionado se encuentra cerrado. No se pueden renombrar cursos.', 'warning')
    return
  }
  bulkTarget.value = gradeType
  bulkPrefijo.value = gradeType.nombre
  bulkSeparador.value = '-'
  bulkOrdinalType.value = 'NUMERO'
  bulkModal.value = true
}

const closeEditCuposModal = () => {
  if (savingCupos.value) return
  editCuposModal.value = false
  selectedGroup.value = null
}

const fetchCatalogs = async () => {
  const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
  const [catalogsData, gradesData] = await Promise.all([
    academicService.getCatalogs(),
    academicService.getGradesAndGroups(schoolId.value, params),
  ])

  secciones.value = catalogsData.secciones
  niveles.value = gradesData.niveles
  jornadas.value = gradesData.jornadas
  tiposGrado.value = gradesData.tiposGrado
  grupos.value = gradesData.grupos
}

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    await fetchCatalogs()
  } catch (error) {
    console.error('Error loading grade management:', error)
  } finally {
    loading.value = false
  }
}

const handleCreateGrade = async (payload: { id_nivel: number; nombre: string }) => {
  try {

    savingGrade.value = true
    await academicService.createGradeType({
      schoolId: schoolId.value,
      id_nivel: payload.id_nivel,
      nombre: payload.nombre,
    })
    await loadData()
    closeCreateModal()
    notify.addNotification('Grado creado exitosamente.', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al crear el grado', 'error')
  } finally {
    savingGrade.value = false
  }
}

const handleCreateGroup = async (payload: { id_nivel: number; id_tipo_grado: number; id_jornada: number; cupos_totales: number }) => {
  if (savingGroup.value) return
  if (!computedNextSectionName.value) {
    notify.addNotification('Completa nivel, grado, jornada y sección antes de crear el curso.', 'warning')
    return
  }
  if (payload.cupos_totales < 0) {
    notify.addNotification('Los cupos del curso no pueden ser negativos.', 'warning')
    return
  }

  try {
    savingGroup.value = true
    await academicService.createGroup({
      schoolId: schoolId.value,
      id_nivel: payload.id_nivel,
      id_tipo_grado: payload.id_tipo_grado,
      id_jornada: payload.id_jornada,
      seccion_nombre: computedNextSectionName.value,
      cupos_totales: payload.cupos_totales,
    })
    await loadData()
    closeCreateModal()
    notify.addNotification('Curso creado exitosamente.', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al crear el curso', 'error')
  } finally {
    savingGroup.value = false
  }
}

const deleteGradeType = async (item: TipoGrado) => {
  try {
    deleting.value = true
    await academicService.deleteGradeType(item.id_tipo_grado, schoolId.value)
    closeDeleteModal()
    await loadData()
    notify.addNotification('Grado eliminado exitosamente.', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'No fue posible eliminar el grado', 'error')
  } finally {
    deleting.value = false
  }
}
const deleteGroup = async (item: Grupo) => {
  try {
    deleting.value = true
    await academicService.deleteGroup(item.id_grupo, schoolId.value)
    closeDeleteModal()
    await loadData()
    notify.addNotification('Curso eliminado exitosamente.', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'No fue posible eliminar el curso', 'error')
  } finally {
    deleting.value = false
  }
}

const handleUpdateGroupCupos = async (newCupos: number) => {
  if (!selectedGroup.value || savingCupos.value) return
  
  if (newCupos < selectedGroup.value.matriculas_count) {
    notify.addNotification(`No puedes reducir el cupo por debajo de la cantidad de estudiantes matriculados (${selectedGroup.value.matriculas_count}).`, 'warning')
    return
  }

  try {
    savingCupos.value = true
    await academicService.updateGroupCupos(selectedGroup.value.id_grupo, {
      schoolId: schoolId.value,
      cupos_totales: newCupos
    })
    await loadData()
    closeEditCuposModal()
    notify.addNotification('Capacidad de cupos actualizada exitosamente.', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al actualizar cupos', 'error')
  } finally {
    savingCupos.value = false
  }
}

const closeRenameModal = () => {
  if (renaming.value) return
  renameModal.value = false
  renameTarget.value = null
  renameName.value = ''
}

const handleConfirmRename = async (nombre: string) => {
  if (!renameTarget.value || renaming.value) return
  if (nombre.length > 10) {
    notify.addNotification('El nombre del curso no puede superar los 10 caracteres', 'warning')
    return
  }

  renaming.value = true
  try {
    await academicService.renameGroup(renameTarget.value.id_grupo, {
      schoolId: schoolId.value,
      nuevo_nombre: nombre
    })
    await loadData()
    closeRenameModal()
    notify.addNotification('Curso renombrado exitosamente.', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al renombrar el curso', 'error')
  } finally {
    renaming.value = false
  }
}

const closeBulkModal = () => {
  if (bulkRenaming.value) return
  bulkModal.value = false
  bulkTarget.value = null
  bulkPrefijo.value = ''
  bulkOrdinalType.value = 'NUMERO'
}

const handleConfirmBulkRename = async (payload: { prefijo: string; separador: string; tipo_ordinal: 'NUMERO' | 'LETRA' }) => {
  if (!bulkTarget.value || bulkRenaming.value) return
  bulkRenaming.value = true
  try {
    await academicService.bulkRenameGroups(bulkTarget.value.id_tipo_grado, {
      schoolId: schoolId.value,
      prefijo: payload.prefijo,
      separador: payload.separador,
      tipo_ordinal: payload.tipo_ordinal
    })
    await loadData()
    closeBulkModal()
    notify.addNotification('Cursos renombrados masivamente con éxito.', 'success')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al renombrar los cursos', 'error')
  } finally {
    bulkRenaming.value = false
  }
}


// Group Members Modal (Estudiantes y Docentes)
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

const membersModalOpen = ref(false)
const loadingMembers = ref(false)
const membersData = ref<GroupDetails | null>(null)
const activeMembersTab = ref<'students' | 'teachers'>('students')
const membersSearchTerm = ref('')

const openCourseMembersModal = async (group: Grupo) => {
  try {
    membersModalOpen.value = true
    loadingMembers.value = true
    membersData.value = null
    activeMembersTab.value = 'students'
    membersSearchTerm.value = ''

    const res = await academicService.getCourseMembers(group.id_grupo, schoolId.value, yearStore.selectedYearId || undefined)
    membersData.value = res
  } catch (error: any) {
    console.error('Error fetching course members:', error)
    notify.addNotification('No se pudieron cargar los integrantes del curso', 'error')
  } finally {
    loadingMembers.value = false
  }
}



interface JornadaStat {
  id_jornada: number
  nombre: string
  grupos_count: number
  cupos_totales: number
  matriculas_count: number
  porcentaje_ocupacion: number
  grados_cubiertos: string[]
  grupos: Grupo[]
}

const jornadasStats = computed<JornadaStat[]>(() => {
  return jornadas.value.map((j) => {
    const gruposJornada = grupos.value.filter((g) => g.id_jornada === j.id_jornada)
    const grupos_count = gruposJornada.length
    const cupos_totales = gruposJornada.reduce((acc, g) => acc + (g.cupos_totales || 0), 0)
    const matriculas_count = gruposJornada.reduce((acc, g) => acc + (g.matriculas_count || 0), 0)
    const porcentaje_ocupacion = cupos_totales > 0 ? Math.round((matriculas_count / cupos_totales) * 100) : 0
    const grados_cubiertos = [...new Set(gruposJornada.map((g) => g.tipo_grado_nombre))].filter(Boolean)

    return {
      id_jornada: j.id_jornada,
      nombre: j.nombre,
      grupos_count,
      cupos_totales,
      matriculas_count,
      porcentaje_ocupacion,
      grados_cubiertos,
      grupos: gruposJornada
    }
  })
})

const availableJornadasToAdd = computed(() => {
  const all = ['MAÑANA', 'TARDE', 'UNICA', 'NOCTURNA']
  const currentNames = jornadas.value.map(j => j.nombre)
  return all.filter(name => !currentNames.includes(name))
})

const jornadaSearchTerm = ref('')

const visibleJornadaCursos = computed(() => {
  let list = grupos.value
  if (selectedJornadaId.value) {
    list = list.filter(g => g.id_jornada === selectedJornadaId.value)
  }
  const term = jornadaSearchTerm.value.trim().toLowerCase()
  if (term) {
    list = list.filter(g => 
      g.tipo_grado_nombre.toLowerCase().includes(term) ||
      g.seccion_nombre.toLowerCase().includes(term) ||
      g.nivel_nombre.toLowerCase().includes(term) ||
      g.jornada_nombre.toLowerCase().includes(term)
    )
  }
  return list
})

const getJornadaColorConfig = (nombre: string) => {
  const norm = String(nombre || '').toUpperCase()
  if (norm.includes('MAÑANA')) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800/40',
      borderActive: 'border-amber-500 ring-2 ring-amber-500/20',
      text: 'text-amber-700 dark:text-amber-300',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
      accent: 'text-amber-500',
      progress: 'bg-amber-500',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      label: 'Jornada Mañana'
    }
  }
  if (norm.includes('TARDE')) {
    return {
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-200 dark:border-orange-800/40',
      borderActive: 'border-orange-500 ring-2 ring-orange-500/20',
      text: 'text-orange-700 dark:text-orange-300',
      badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      accent: 'text-orange-500',
      progress: 'bg-orange-500',
      iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      label: 'Jornada Tarde'
    }
  }
  if (norm.includes('UNICA') || norm.includes('COMPLETA')) {
    return {
      bg: 'bg-indigo-50 dark:bg-indigo-950/20',
      border: 'border-indigo-200 dark:border-indigo-800/40',
      borderActive: 'border-indigo-500 ring-2 ring-indigo-500/20',
      text: 'text-indigo-700 dark:text-indigo-300',
      badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
      accent: 'text-indigo-500',
      progress: 'bg-indigo-600',
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      label: 'Jornada Única / Completa'
    }
  }
  return {
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    border: 'border-purple-200 dark:border-purple-800/40',
    borderActive: 'border-purple-500 ring-2 ring-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    accent: 'text-purple-500',
    progress: 'bg-purple-600',
    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    label: 'Jornada Nocturna'
  }
}

const openCreateJornadaModal = () => {
  if (availableJornadasToAdd.value.length > 0) {
    newJornadaName.value = availableJornadasToAdd.value[0]
  }
  showCreateJornadaModal.value = true
}

const handleCreateJornada = async () => {
  if (!newJornadaName.value || savingJornada.value) return
  savingJornada.value = true
  try {
    await academicService.createJornada({
      schoolId: schoolId.value,
      nombre: newJornadaName.value
    })
    notify.addNotification(`Jornada ${newJornadaName.value} habilitada exitosamente.`, 'success')
    showCreateJornadaModal.value = false
    await loadData()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al habilitar jornada', 'error')
  } finally {
    savingJornada.value = false
  }
}

const openDeleteJornadaModal = (j: Jornada) => {
  targetJornadaToDelete.value = j
  deleteJornadaModal.value = true
}

const confirmDeleteJornada = async () => {
  if (!targetJornadaToDelete.value || deletingJornada.value) return
  deletingJornada.value = true
  try {
    await academicService.deleteJornada(targetJornadaToDelete.value.id_jornada, schoolId.value)
    notify.addNotification(`Jornada eliminada con éxito.`, 'success')
    deleteJornadaModal.value = false
    if (selectedJornadaId.value === targetJornadaToDelete.value.id_jornada) {
      selectedJornadaId.value = null
    }
    targetJornadaToDelete.value = null
    await loadData()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al eliminar jornada', 'error')
  } finally {
    deletingJornada.value = false
  }
}

const openReassignJornadaModal = (group: Grupo) => {
  targetGroupToReassign.value = group
  newTargetJornadaId.value = group.id_jornada
  reassignJornadaModal.value = true
}
void openReassignJornadaModal; // Preservado para cuando se reactive la reasignación de jornada

const confirmReassignJornada = async () => {
  if (!targetGroupToReassign.value || !newTargetJornadaId.value || reassigningJornada.value) return
  reassigningJornada.value = true
  try {
    await academicService.reassignGroupJornada(targetGroupToReassign.value.id_grupo, {
      schoolId: schoolId.value,
      id_jornada: newTargetJornadaId.value
    })
    notify.addNotification('Curso reasignado de jornada exitosamente.', 'success')
    reassignJornadaModal.value = false
    targetGroupToReassign.value = null
    await loadData()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al reasignar curso de jornada', 'error')
  } finally {
    reassigningJornada.value = false
  }
}


onMounted(async () => {
  await yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
  loadData()
})

watch(() => yearStore.selectedYearId, () => {
  loadData()
})
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Clean Header with Year Selector -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="p-5 sm:p-7 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
        <div class="flex items-center gap-3.5 sm:gap-4">
          <div class="p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl sm:rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <Layers3 class="h-6 w-6 sm:h-8 sm:w-8" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">Estructura Académica</h1>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Gestión integral de niveles, grados y cursos institucionales.</p>
          </div>
        </div>
        
        <div class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          <!-- Year Selector Dropdown -->
          <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-3.5 py-2.5 shadow-sm">
            <Calendar :size="18" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span class="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Año:</span>
            <select 
              :value="yearStore.selectedYearId" 
              @change="onYearChange"
              class="bg-transparent text-xs sm:text-sm font-black text-slate-900 dark:text-white outline-none cursor-pointer flex-1"
            >
              <option v-for="y in yearStore.availableYears" :key="y.id_anio" :value="y.id_anio">
                {{ y.calendario }} {{ y.estado === 'CERRADO' ? '(Cerrado / Inactivo)' : '(Vigente)' }}
              </option>
            </select>
          </div>

          <button 
            v-if="!yearStore.isClosedYear"
            @click="openCreateModal('grade')" 
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-md cursor-pointer"
          >
            <Plus :size="18" />
            Nuevo Grado
          </button>
          <button 
            v-if="!yearStore.isClosedYear"
            @click="openCreateModal('course')" 
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-indigo-700 transition-all shadow-md cursor-pointer"
          >
            <School2 :size="18" />
            Nuevo Curso
          </button>
        </div>
      </div>
    </div>

    <!-- Closed Year Warning Banner -->
    <div v-if="yearStore.isClosedYear" class="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 text-amber-950 dark:text-amber-200 shadow-sm animate-in fade-in duration-300">
      <div class="p-2.5 sm:p-3 bg-amber-500 text-white rounded-xl sm:rounded-2xl shrink-0 shadow-md">
        <Lock class="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-xs sm:text-sm font-black uppercase tracking-wider">Año Lectivo {{ yearStore.selectedYear?.calendario }} — CERRADO (Solo Lectura)</h3>
        <p class="text-xs text-amber-800 dark:text-amber-300 font-medium mt-0.5 leading-relaxed">
          Este año académico se encuentra cerrado. Toda la estructura de niveles, grados y cursos se presenta en modo de consulta histórica y no se pueden realizar modificaciones.
        </p>
      </div>
    </div>

    <!-- Main Sub-Navigation Tabs -->
    <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <button 
        @click="activeMainTab = 'grades_courses'"
        :class="[
          'flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shrink-0 cursor-pointer',
          activeMainTab === 'grades_courses'
            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        ]"
      >
        <Layers3 :size="16" />
        <span>Grados & Cursos</span>
      </button>

      <button 
        @click="activeMainTab = 'jornadas'"
        :class="[
          'flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shrink-0 cursor-pointer',
          activeMainTab === 'jornadas'
            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        ]"
      >
        <Sun :size="16" />
        <span>Gestión de Jornadas</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          {{ jornadas.length }}
        </span>
      </button>
    </div>

    <!-- SUB-VIEW 1: GRADOS & CURSOS -->
    <div v-if="activeMainTab === 'grades_courses'" class="space-y-6 animate-in fade-in duration-300">
      
      <!-- Top Overview KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <!-- KPI 1: Grados Base -->
        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Grados Base</p>
            <p class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{{ tiposGrado.length }}</p>
            <p class="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {{ uniqueNivelesCount }} niveles <span v-if="gradesWithoutCoursesCount > 0" class="text-amber-500 font-bold">({{ gradesWithoutCoursesCount }} vacíos)</span>
            </p>
          </div>
          <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shrink-0">
            <Layers3 class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <!-- KPI 2: Cursos / Aulas -->
        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Cursos & Salones</p>
            <p class="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{{ grupos.length }}</p>
            <p class="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {{ availableCapacityCoursesCount }} con cupos
            </p>
          </div>
          <div class="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl shrink-0">
            <School2 class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <!-- KPI 3: Aforo & Matrículas -->
        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Aforo & Matrículas</p>
            <p class="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {{ totalMatriculas }} <span class="text-xs sm:text-sm font-bold text-slate-400">/ {{ totalCupos }}</span>
            </p>
            <div class="flex items-center gap-1.5 mt-1">
              <div class="h-1.5 w-12 sm:w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full" :style="`width: ${Math.min(100, globalOcupacionPct)}%`"></div>
              </div>
              <span class="text-[9px] sm:text-[10px] font-black text-slate-400">{{ globalOcupacionPct }}%</span>
            </div>
          </div>
          <div class="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl sm:rounded-2xl shrink-0">
            <GraduationCap class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <!-- KPI 4: Densidad de Estudiantes -->
        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Promedio por Aula</p>
            <p class="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              ~{{ avgEstudiantesPorCurso }} <span class="text-xs font-bold text-slate-400">est</span>
            </p>
            <p class="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {{ fullCapacityCoursesCount }} llenos (100%)
            </p>
          </div>
          <div class="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl sm:rounded-2xl shrink-0">
            <Users class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      <!-- Interactive Filters Toolbar -->
      <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        
        <!-- Filter Pills / Dropdowns Group -->
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <!-- Level Filter Pills -->
          <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-slate-700/60 max-w-full overflow-x-auto scrollbar-none">
            <span class="text-[10px] font-black uppercase text-slate-400 px-2 flex items-center gap-1 shrink-0">
              <Layers :size="12" /> Nivel:
            </span>
            <button
              @click="selectedNivelFilter = null"
              :class="[
                'px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                selectedNivelFilter === null
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              ]"
            >
              Todos
            </button>
            <button
              v-for="nivel in niveles"
              :key="nivel.id_nivel"
              @click="selectedNivelFilter = selectedNivelFilter === nivel.id_nivel ? null : nivel.id_nivel"
              :class="[
                'px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                selectedNivelFilter === nivel.id_nivel
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              ]"
            >
              {{ nivel.nombre }}
            </button>
          </div>

          <!-- Jornada Quick Dropdown Filter -->
          <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
            <span class="text-[10px] font-black uppercase text-slate-400 px-2 flex items-center gap-1 shrink-0">
              <Sun :size="12" /> Jornada:
            </span>
            <select
              v-model="selectedJornadaFilter"
              class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-2"
            >
              <option :value="null">Todas las Jornadas</option>
              <option v-for="j in jornadas" :key="j.id_jornada" :value="j.id_jornada">
                {{ j.nombre }}
              </option>
            </select>
          </div>

          <!-- Grade Status Filter Dropdown -->
          <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
            <span class="text-[10px] font-black uppercase text-slate-400 px-2 flex items-center gap-1 shrink-0">
              <SlidersHorizontal :size="12" /> Estado Grado:
            </span>
            <select
              v-model="gradeStatusFilter"
              class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-2"
            >
              <option value="TODOS">Todos los grados</option>
              <option value="CON_CURSOS">Con cursos asignados</option>
              <option value="SIN_CURSOS">Sin cursos asignados (0)</option>
            </select>
          </div>
        </div>

        <!-- Reset & Status indicator -->
        <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 justify-between sm:justify-start w-full lg:w-auto">
          <button
            v-if="hasActiveFilters"
            @click="resetAllFilters"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition-all border border-rose-200/60 dark:border-rose-900/60 cursor-pointer"
          >
            <X :size="14" />
            <span>Limpiar Filtros</span>
          </button>
          
          <span class="text-xs font-bold text-slate-400">
            Mostrando: <span class="text-slate-900 dark:text-white font-black">{{ visibleGradeTypes.length }}</span> grados / <span class="text-slate-900 dark:text-white font-black">{{ visibleGroups.length }}</span> cursos
          </span>
        </div>
      </div>

      <!-- Unified Dashboard: 2 Column Layout -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      
      <!-- Left Panel: Grades (Compact List) -->
      <div class="xl:col-span-5 space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[520px] sm:h-[600px] xl:h-[700px]">
          <div class="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <h3 class="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Layers3 :size="16" />
              Grados Base
            </h3>
            <span class="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2.5 sm:px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              {{ tiposGrado.length }} Registrados
            </span>
          </div>

          <div class="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
              <input 
                v-model="searchTerm" 
                v-if="searchMode === 'grade'"
                type="text" 
                placeholder="Buscar por nombre o nivel..."
                class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-xs sm:text-sm font-medium outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
            <div v-if="visibleGradeTypes.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 p-6 sm:p-8">
              <Search :size="48" class="mb-4 opacity-20" />
              <p class="font-bold text-xs sm:text-sm">No se encontraron grados</p>
            </div>
            
            <div class="grid gap-2.5 sm:gap-3">
              <div 
                v-for="item in visibleGradeTypes" 
                :key="item.id_tipo_grado"
                @click="toggleGradeSelection(item.id_tipo_grado)"
                :class="[
                  selectedGradeId === item.id_tipo_grado 
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/30' 
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900',
                  'group p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between hover:border-indigo-200 dark:hover:border-indigo-900 hover:shadow-md hover:shadow-indigo-50/50 dark:hover:shadow-none transition-all cursor-pointer border'
                ]"
              >
                <div class="min-w-0 flex-1 mr-2">
                  <h4 class="font-black text-slate-800 dark:text-white text-sm sm:text-base truncate">{{ item.nombre }}</h4>
                  <p class="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{{ item.nivel_nombre }}</p>
                </div>
                
                <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div class="text-right mr-1 sm:mr-2">
                    <p class="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Cursos</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-xs sm:text-sm">{{ item.cursos_count }}</p>
                  </div>
                  <button 
                    v-if="item.cursos_count > 0 && !yearStore.isClosedYear"
                    @click.stop="openBulkRenameModal(item)"
                    class="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer"
                    title="Renombrar Cursos en Masa"
                  >
                    <RefreshCw :size="16" />
                  </button>
                  <button 
                    v-if="!yearStore.isClosedYear"
                    @click.stop="openDeleteGradeModal(item)"
                    class="p-1.5 sm:p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all cursor-pointer"
                    title="Eliminar Grado"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Courses (Interactive Grid) -->
      <div class="xl:col-span-7 space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[520px] sm:h-[600px] xl:h-[700px]">
          <div class="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-slate-900">
            <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {{ selectedGradeId ? 'Cursos del Grado' : 'Cursos & Secciones' }}
              </h3>
              <div v-if="selectedGradeId" class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span class="bg-indigo-600 text-white px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase">Filtro Activo</span>
                <button @click="selectedGradeId = null" class="text-[9px] sm:text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase underline mr-1 sm:mr-2 cursor-pointer">Limpiar</button>
                <button 
                  v-if="selectedGrade && selectedGrade.cursos_count > 0 && !yearStore.isClosedYear"
                  @click="openBulkRenameModal(selectedGrade)"
                  class="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] sm:text-[10px] font-black uppercase hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all border border-indigo-100/50 dark:border-indigo-900/50 cursor-pointer"
                  title="Renombrar en Masa"
                >
                  <RefreshCw :size="10" />
                  Renombrar en Masa
                </button>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full md:w-auto">
              <!-- Capacity / Student Filter Dropdown -->
              <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                <Users :size="14" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <select
                  v-model="cupoFilter"
                  class="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer w-full sm:w-auto"
                >
                  <option value="TODOS">Todos los cupos</option>
                  <option value="CON_CUPOS">🟢 Con cupos disponibles</option>
                  <option value="SIN_CUPOS">🔴 Cupos llenos (100%)</option>
                  <option value="BAJA_OCUPACION">📉 Baja ocupación (&lt; 50%)</option>
                  <option value="ALTA_OCUPACION">📈 Alta ocupación (≥ 80%)</option>
                  <option value="MENOS_10">👥 &lt; 10 estudiantes</option>
                  <option value="ENTRE_10_25">👥 10 a 25 estudiantes</option>
                  <option value="MAS_25">👥 &gt; 25 estudiantes</option>
                </select>
              </div>

              <div class="relative w-full sm:w-52">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="14" />
                <input 
                  v-model="searchTerm" 
                  type="text" 
                  placeholder="Filtrar cursos..."
                  class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 pl-9 pr-4 text-xs font-medium outline-none text-slate-900 dark:text-white shadow-inner"
                />
              </div>
            </div>
          </div>

          <!-- Active Cupo Filter Bar Banner -->
          <div v-if="cupoFilter !== 'TODOS'" class="px-4 sm:px-6 py-2 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100/60 dark:border-indigo-900/60 flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
            <span>Filtro: {{ getCupoFilterLabel(cupoFilter) }} ({{ visibleGroups.length }})</span>
            <button @click="cupoFilter = 'TODOS'" class="underline hover:text-indigo-900 dark:hover:text-white text-[11px]">Limpiar filtro</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-950/10 custom-scrollbar">
            <div v-if="grupos.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 py-10">
              <School2 :size="64" class="mb-4 opacity-20" />
              <p class="font-bold text-sm">No hay cursos configurados</p>
              <button v-if="!yearStore.isClosedYear" @click="openCreateModal('course')" class="mt-4 text-indigo-600 font-bold text-xs sm:text-sm hover:underline cursor-pointer">Comenzar a crear cursos</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              <div 
                v-for="item in visibleGroups" 
                :key="item.id_grupo"
                class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all border-l-4"
                :class="item.jornada_nombre === 'MAÑANA' ? 'border-l-amber-400' : item.jornada_nombre === 'TARDE' ? 'border-l-indigo-400' : 'border-l-emerald-400'"
              >
                <div class="flex items-start justify-between mb-3.5 sm:mb-4 gap-2">
                  <div class="min-w-0 flex-1">
                    <h4 class="font-black text-slate-900 dark:text-white text-base sm:text-lg tracking-tight truncate">
                      {{ getCourseDisplayName(item) }}
                    </h4>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                      <span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        {{ item.nivel_nombre }}
                      </span>
                      <span class="text-xs font-bold text-slate-400">•</span>
                      <span class="text-xs font-bold text-slate-500 dark:text-slate-400">{{ item.jornada_nombre }}</span>
                    </div>
                  </div>
                  
                  <div v-if="!yearStore.isClosedYear" class="flex items-center gap-1 shrink-0">
                    <button @click="openRenameModal(item)" class="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer" title="Renombrar Curso">
                      <Tag :size="16" />
                    </button>
                    <button @click="openEditCuposModal(item)" class="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer" title="Editar Cupos">
                      <Pencil :size="16" />
                    </button>
                    <button @click="openDeleteCourseModal(item)" class="p-1.5 sm:p-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" title="Eliminar Curso">
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2 py-2.5 sm:py-3 border-y border-slate-50 dark:border-slate-800 mb-3.5 sm:mb-4">
                  <div class="text-center">
                    <p class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight">Estudiantes</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-xs sm:text-sm">{{ item.matriculas_count }}</p>
                  </div>
                  <div class="text-center border-x border-slate-50 dark:border-slate-800">
                    <p class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight">Materias</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-xs sm:text-sm">{{ item.asignaciones_count }}</p>
                  </div>
                  <div class="text-center">
                    <p class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight">Logros</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-xs sm:text-sm">{{ item.competencias_count }}</p>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-12 sm:w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        class="h-full bg-indigo-500" 
                        :style="`width: ${(item.matriculas_count / item.cupos_totales) * 100}%`"
                      ></div>
                    </div>
                    <span class="text-[9px] sm:text-[10px] font-black text-slate-400">{{ Math.round((item.matriculas_count / item.cupos_totales) * 100) }}%</span>
                  </div>
                  <div class="text-[9px] sm:text-[10px] font-black bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-500">
                    {{ item.cupos_totales }} CUPOS
                  </div>
                </div>

                <button
                  @click="openCourseMembersModal(item)"
                  class="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-xl font-black text-xs transition-all border border-indigo-100/60 dark:border-indigo-900/60 shadow-sm active:scale-98 cursor-pointer min-h-10"
                >
                  <Eye :size="15" />
                  Ver Integrantes (Estudiantes & Docentes)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="activeMainTab === 'jornadas'" class="space-y-6 animate-in fade-in duration-300">
    <!-- SUB-VIEW 2: GESTIÓN Y ANÁLISIS DE JORNADAS -->
      
      <!-- Top Overview Stats Bar -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Jornadas Habilitadas</p>
            <p class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{{ jornadas.length }}</p>
          </div>
          <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shrink-0">
            <Sun class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Cursos / Salones</p>
            <p class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{{ grupos.length }}</p>
          </div>
          <div class="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl shrink-0">
            <School2 class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Matrículas Totales</p>
            <p class="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {{ grupos.reduce((acc, g) => acc + (g.matriculas_count || 0), 0) }}
            </p>
          </div>
          <div class="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl sm:rounded-2xl shrink-0">
            <GraduationCap class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Cupos Disponibles</p>
            <p class="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {{ Math.max(0, grupos.reduce((acc, g) => acc + (g.cupos_totales || 0), 0) - grupos.reduce((acc, g) => acc + (g.matriculas_count || 0), 0)) }}
            </p>
          </div>
          <div class="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl sm:rounded-2xl shrink-0">
            <Users class="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      <!-- Action Bar for Jornadas -->
      <div class="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <span class="text-[11px] sm:text-xs font-black uppercase text-slate-400 tracking-wider">Filtro de Jornada:</span>
          <button 
            @click="selectedJornadaId = null"
            :class="[
              'px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
              selectedJornadaId === null
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            ]"
          >
            Todas ({{ jornadas.length }})
          </button>
          <button 
            v-for="j in jornadas" 
            :key="j.id_jornada"
            @click="selectedJornadaId = selectedJornadaId === j.id_jornada ? null : j.id_jornada"
            :class="[
              'px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
              selectedJornadaId === j.id_jornada
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            ]"
          >
            {{ j.nombre }}
          </button>
        </div>

        <button 
          v-if="!yearStore.isClosedYear && availableJornadasToAdd.length > 0"
          @click="openCreateJornadaModal"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
        >
          <Plus :size="16" />
          <span>Habilitar Nueva Jornada</span>
        </button>
      </div>

      <!-- Jornadas KPI Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <div 
          v-for="j in jornadasStats" 
          :key="j.id_jornada"
          @click="selectedJornadaId = selectedJornadaId === j.id_jornada ? null : j.id_jornada"
          :class="[
            'p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer shadow-sm relative flex flex-col justify-between space-y-4 hover:shadow-md',
            selectedJornadaId === j.id_jornada 
              ? getJornadaColorConfig(j.nombre).borderActive + ' ' + getJornadaColorConfig(j.nombre).bg
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900'
          ]"
        >
          <div>
            <!-- Header of card -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div :class="['p-2 sm:p-2.5 rounded-xl sm:rounded-2xl', getJornadaColorConfig(j.nombre).iconBg]">
                  <Sun v-if="j.nombre === 'MAÑANA'" :size="20" />
                  <Sunset v-else-if="j.nombre === 'TARDE'" :size="20" />
                  <Globe v-else-if="j.nombre === 'UNICA'" :size="20" />
                  <Moon v-else :size="20" />
                </div>
                <div>
                  <h3 class="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                    {{ j.nombre }}
                  </h3>
                  <span :class="['px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider', getJornadaColorConfig(j.nombre).badge]">
                    {{ getJornadaColorConfig(j.nombre).label }}
                  </span>
                </div>
              </div>

              <button 
                v-if="!yearStore.isClosedYear && j.grupos_count === 0"
                @click.stop="openDeleteJornadaModal(j)"
                class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                title="Eliminar jornada sin cursos"
              >
                <Trash2 :size="16" />
              </button>
            </div>

            <!-- Stats in Card -->
            <div class="space-y-2 pt-2">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="text-slate-400 uppercase tracking-tight">Ocupación / Aforo</span>
                <span class="text-slate-900 dark:text-white font-black">{{ j.matriculas_count }} / {{ j.cupos_totales }}</span>
              </div>
              <div class="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  :class="['h-full transition-all duration-500 rounded-full', getJornadaColorConfig(j.nombre).progress]" 
                  :style="`width: ${Math.min(100, j.porcentaje_ocupacion)}%`"
                ></div>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 font-medium">{{ j.porcentaje_ocupacion }}% ocupado</span>
                <span class="font-bold text-slate-600 dark:text-slate-300">{{ j.grupos_count }} Curso(s)</span>
              </div>
            </div>

            <!-- Grados Cubiertos Tags -->
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">Grados Operando:</p>
              <div v-if="j.grados_cubiertos.length === 0" class="text-[11px] text-slate-400 italic">
                Sin cursos registrados
              </div>
              <div v-else class="flex flex-wrap gap-1">
                <span 
                  v-for="grado in j.grados_cubiertos" 
                  :key="grado"
                  class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-bold"
                >
                  {{ grado }}
                </span>
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button 
              class="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{{ selectedJornadaId === j.id_jornada ? '✓ Filtro Aplicado' : 'Ver Cursos de ' + j.nombre }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Cursos Section under Jornadas -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <School2 class="text-indigo-600 dark:text-indigo-400" :size="20" />
              <span>
                {{ selectedJornadaId ? 'Cursos en ' + (jornadas.find(j => j.id_jornada === selectedJornadaId)?.nombre || '') : 'Todos los Cursos por Jornada' }}
              </span>
            </h3>
            <p class="text-xs text-slate-400 font-medium mt-0.5">Reasigna cursos de jornada o inspecciona su cupo y miembros</p>
          </div>

          <div class="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <div class="relative flex-1 sm:w-64">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="14" />
              <input 
                v-model="jornadaSearchTerm" 
                type="text" 
                placeholder="Buscar curso o grado..."
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-4 text-xs font-medium outline-none text-slate-900 dark:text-white"
              />
            </div>
            <button 
              v-if="selectedJornadaId"
              @click="selectedJornadaId = null"
              class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
            >
              Ver Todas
            </button>
          </div>
        </div>

        <!-- Cursos Grid -->
        <div v-if="visibleJornadaCursos.length === 0" class="p-8 sm:p-12 text-center text-slate-400 space-y-3">
          <School2 :size="40" class="mx-auto opacity-20" />
          <p class="font-bold text-xs sm:text-sm">No se encontraron cursos para la jornada o búsqueda seleccionada.</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <div 
            v-for="item in visibleJornadaCursos" 
            :key="item.id_grupo"
            class="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 sm:space-y-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
          >
            <div>
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <h4 class="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                    {{ getCourseDisplayName(item) }}
                  </h4>
                  <p class="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest">{{ item.nivel_nombre }}</p>
                </div>
                <span :class="['px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border shrink-0', getJornadaColorConfig(item.jornada_nombre).badge]">
                  {{ item.jornada_nombre }}
                </span>
              </div>

              <!-- Cupos Progress -->
              <div class="mt-3 sm:mt-4 space-y-1.5">
                <div class="flex items-center justify-between text-xs font-bold">
                  <span class="text-slate-400">Estudiantes:</span>
                  <span class="text-slate-900 dark:text-white font-black">{{ item.matriculas_count }} / {{ item.cupos_totales }}</span>
                </div>
                <div class="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-indigo-600 rounded-full transition-all"
                    :style="`width: ${Math.min(100, Math.round((item.matriculas_count / item.cupos_totales) * 100))}%`"
                  ></div>
                </div>
                <div class="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{{ Math.round((item.matriculas_count / item.cupos_totales) * 100) }}% ocupación</span>
                  <span>{{ item.asignaciones_count }} Materias</span>
                </div>
              </div>
            </div>

            <!-- Actions on Card -->
            <div class="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center gap-2">
              <button 
                disabled
                class="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 rounded-xl font-bold text-xs cursor-not-allowed border border-slate-200/50 dark:border-slate-700/50 select-none opacity-80"
                title="Reasignación de jornada deshabilitada temporalmente por política institucional de matrículas"
              >
                <Lock :size="12" class="text-slate-400" />
                <span>Reasignación Restringida</span>
              </button>

              <button 
                @click="openCourseMembersModal(item)"
                class="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Ver Estudiantes y Docentes"
              >
                <Eye :size="15" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Modals (Remained roughly same but with better styling) -->
    <Teleport to="body">
      <!-- Create Grade or Group Modal -->
      <CreateGradeOrGroupModal
        :show="createModal"
        :niveles="niveles"
        :tipos-grados="tiposGrado"
        :jornadas="jornadas"
        :saving-grade="savingGrade"

        :saving-group="savingGroup"
        :computed-next-section-name="computedNextSectionName"
        @close="closeCreateModal"
        @create-grade="handleCreateGrade"
        @create-group="handleCreateGroup"
        @update-group-nivel="newGroup.id_nivel = $event as any"
        @update-group-grade="newGroup.id_tipo_grado = $event as any"
        @update-group-jornada="newGroup.id_jornada = $event as any"
      />

      <!-- Delete Confirmation Modal -->
      <div v-if="deleteModal" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
        <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="closeDeleteModal"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden shadow-2xl max-h-[90dvh] flex flex-col">
          <div class="p-6 sm:p-8 text-center overflow-y-auto custom-scrollbar flex-1">
            <div class="w-14 h-14 sm:w-16 sm:h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shrink-0">
              <Trash2 class="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">¿Confirmas la eliminación?</h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-2 sm:mt-3 leading-relaxed">
              Estás a punto de eliminar 
              <span class="font-black text-slate-800 dark:text-slate-200">
                {{ deleteModal.kind === 'grade' ? deleteModal.item.nombre : getCourseDisplayName(deleteModal.item) }}
              </span>. 
              Esta acción no se puede deshacer si el registro tiene dependencias.
            </p>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 shrink-0">
            <button @click="closeDeleteModal" class="w-full sm:w-auto flex-1 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer">Cancelar</button>
            <button 
              @click="deleteModal.kind === 'grade' ? deleteGradeType(deleteModal.item) : deleteGroup(deleteModal.item)"
              :disabled="deleting"
              class="w-full sm:w-auto flex-1 bg-red-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              {{ deleting ? 'Eliminando...' : 'Sí, Eliminar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Cupos Modal -->
      <EditCuposModal
        :show="editCuposModal"
        :selected-group="selectedGroup"
        :saving-cupos="savingCupos"
        @close="closeEditCuposModal"
        @save="handleUpdateGroupCupos"
      />

      <!-- Rename Single Course Modal -->
      <RenameCourseModal
        :show="renameModal"
        :target-group="renameTarget"
        :renaming="renaming"
        @close="closeRenameModal"
        @save="handleConfirmRename"
      />

      <!-- Bulk Rename Modal -->
      <BulkRenameModal
        :show="bulkModal"
        :bulk-target="bulkTarget"
        :bulk-renaming="bulkRenaming"
        :bulk-course-count="bulkCourseCount"
        @close="closeBulkModal"
        @save="handleConfirmBulkRename"
      />

      <!-- Course Members Modal -->
      <CourseMembersModal
        :show="membersModalOpen"
        :loading="loadingMembers"
        :members-data="membersData"
        @close="membersModalOpen = false"
      />

      <!-- Jornada Management Modals (Create, Delete, Reassign) -->
      <JornadaManagementModals
        :show-create="showCreateJornadaModal"
        :available-jornadas-to-add="availableJornadasToAdd"
        :saving-jornada="savingJornada"
        :show-delete="deleteJornadaModal"
        :target-jornada-to-delete="targetJornadaToDelete"
        :deleting-jornada="deletingJornada"
        :show-reassign="reassignJornadaModal"
        :target-group-to-reassign="targetGroupToReassign"
        :reassigning-jornada="reassigningJornada"
        :jornadas="jornadas"
        @close-create="showCreateJornadaModal = false"
        @confirm-create="handleCreateJornada"
        @close-delete="deleteJornadaModal = false"
        @confirm-delete="confirmDeleteJornada"
        @close-reassign="reassignJornadaModal = false"
        @confirm-reassign="confirmReassignJornada"
      />
    </Teleport>


    <!-- Info Tip -->
    <div class="bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-3xl flex items-start gap-4 border border-indigo-100/50 dark:border-indigo-900/50 transition-colors">
      <div class="p-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl">
        <Info :size="20" />
      </div>
      <div>
        <p class="text-sm font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Tip de Gestión</p>
        <p class="text-indigo-700/80 dark:text-indigo-400/80 text-sm mt-1 font-medium leading-relaxed">
          Los grados son la estructura base (ej: Sexto, Séptimo), mientras que los cursos son las secciones operativas con una jornada específica (ej: 6-A Tarde). 
          Asegúrate de configurar los grados antes de proceder con los cursos.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
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
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>
