<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import {
  Briefcase,
  GraduationCap,
  Info,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserMinus,
  Users,
  X,
  BookOpen,
  ChevronRight,
  Eye,
  Download,
  Edit2,
  UserCheck,
  Filter
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import { getCourseDisplayName } from '../../utils/courseHelper'
import { useAcademicYearStore } from '../../stores/academicYear'

interface DocumentType {
  id_tipodocumento: number
  tipo: string
}

interface TeacherItem {
  id_docente: number
  id_usuario: number
  nombre: string
  apellido: string
  documento: string
  id_tipodocumento: number
  tipo_documento: string
  email: string
  email_padre?: string
  es_padre?: boolean
  activo: boolean
  estado: 'ACTIVO' | 'INACTIVO' | 'DESVINCULADO'
  asignaciones_count: number
}

interface SubjectItem {
  id_materia: number
  nombre: string
}

interface GroupItem {
  id_grupo: number
  nivel_nombre: string
  tipo_grado_nombre: string
  seccion_nombre: string
  jornada_nombre: string
}

interface AssignmentItem {
  id_detallegrado: number
  id_docente: number
  id_materia: number
  id_grupo: number
  materia_nombre: string
  docente_nombre: string
  docente_apellido: string
  nivel_nombre: string
  tipo_grado_nombre: string
  seccion_nombre: string
  jornada_nombre: string
}

interface ConflictTeacher {
  id_docente: number
  nombre: string
  apellido: string
}

const auth = useAuthStore()
const router = useRouter()
const yearStore = useAcademicYearStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const savingTeacher = ref(false)
const savingAssignment = ref(false)
const deletingAssignment = ref(false)
const updatingStatus = ref(false)

const teacherSearch = ref('')
const selectedTeacherId = ref<number | null>(null)
const drawerOpen = ref(false)
const createTeacherModal = ref(false)
const deleteAssignmentModal = ref<AssignmentItem | null>(null)
const statusModal = ref<{ estado: 'ACTIVO' | 'INACTIVO' | 'DESVINCULADO' } | null>(null)
const replaceAssignmentModal = ref<{
  currentTeacher: ConflictTeacher
  payload: { id_docente: number; id_materia: number; id_grupo: number }
} | null>(null)
const statusReason = ref('')

const documentTypes = ref<DocumentType[]>([])
const teachers = ref<TeacherItem[]>([])
const subjects = ref<SubjectItem[]>([])
const groups = ref<GroupItem[]>([])
const assignments = ref<AssignmentItem[]>([])

const newTeacher = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: '',
  email: '',
  password: '',
})

const assignmentForm = ref({
  id_grupo: '',
  id_materia: '',
})

// Filtros divididos para selección de curso en asignaciones
const selectedFilterNivel = ref('')
const selectedFilterGrado = ref('')
const selectedFilterSeccion = ref('')
const selectedFilterJornada = ref('')

const availableNiveles = computed(() => {
  const set = new Set<string>()
  groups.value.forEach((g) => {
    if (g.nivel_nombre) set.add(g.nivel_nombre)
  })
  return Array.from(set).sort()
})

const availableGrados = computed(() => {
  const set = new Set<string>()
  groups.value.forEach((g) => {
    if (selectedFilterNivel.value && g.nivel_nombre !== selectedFilterNivel.value) return
    if (g.tipo_grado_nombre) set.add(g.tipo_grado_nombre)
  })
  return Array.from(set).sort()
})

const availableSecciones = computed(() => {
  const set = new Set<string>()
  groups.value.forEach((g) => {
    if (selectedFilterNivel.value && g.nivel_nombre !== selectedFilterNivel.value) return
    if (selectedFilterGrado.value && g.tipo_grado_nombre !== selectedFilterGrado.value) return
    if (g.seccion_nombre) set.add(g.seccion_nombre)
  })
  return Array.from(set).sort()
})

const availableJornadas = computed(() => {
  const set = new Set<string>()
  groups.value.forEach((g) => {
    if (selectedFilterNivel.value && g.nivel_nombre !== selectedFilterNivel.value) return
    if (selectedFilterGrado.value && g.tipo_grado_nombre !== selectedFilterGrado.value) return
    if (selectedFilterSeccion.value && g.seccion_nombre !== selectedFilterSeccion.value) return
    if (g.jornada_nombre) set.add(g.jornada_nombre)
  })
  return Array.from(set).sort()
})

const filteredGroups = computed(() => {
  return groups.value.filter((g) => {
    if (selectedFilterNivel.value && g.nivel_nombre !== selectedFilterNivel.value) return false
    if (selectedFilterGrado.value && g.tipo_grado_nombre !== selectedFilterGrado.value) return false
    if (selectedFilterSeccion.value && g.seccion_nombre !== selectedFilterSeccion.value) return false
    if (selectedFilterJornada.value && g.jornada_nombre !== selectedFilterJornada.value) return false
    return true
  })
})

const onCourseFilterChange = () => {
  if (assignmentForm.value.id_grupo) {
    const exists = filteredGroups.value.some((g) => String(g.id_grupo) === String(assignmentForm.value.id_grupo))
    if (!exists) {
      assignmentForm.value.id_grupo = ''
    }
  }
  if (filteredGroups.value.length === 1) {
    assignmentForm.value.id_grupo = String(filteredGroups.value[0].id_grupo)
  }
}

const onGroupSelectChange = () => {
  if (!assignmentForm.value.id_grupo) return
  const g = groups.value.find((gr) => String(gr.id_grupo) === String(assignmentForm.value.id_grupo))
  if (g) {
    selectedFilterNivel.value = g.nivel_nombre || ''
    selectedFilterGrado.value = g.tipo_grado_nombre || ''
    selectedFilterSeccion.value = g.seccion_nombre || ''
    selectedFilterJornada.value = g.jornada_nombre || ''
  }
}

const resetCourseFilters = () => {
  selectedFilterNivel.value = ''
  selectedFilterGrado.value = ''
  selectedFilterSeccion.value = ''
  selectedFilterJornada.value = ''
  assignmentForm.value.id_grupo = ''
}

// Filtros divididos para Carga Horaria Actual
const workloadFilterSubjectId = ref<number | null>(null)
const workloadFilterNivel = ref<string>('')
const workloadFilterGrado = ref<string>('')
const workloadFilterSeccion = ref<string>('')
const workloadFilterJornada = ref<string>('')
const workloadFilterGroupId = ref<number | null>(null)

// Asignaciones del docente seleccionado antes de aplicar filtros de carga
const rawTeacherAssignments = computed(() => {
  if (!selectedTeacherId.value) return []
  return assignments.value.filter((a) => a.id_docente === selectedTeacherId.value)
})

// Materias disponibles en la carga del docente
const workloadAvailableSubjects = computed(() => {
  const map = new Map<number, SubjectItem>()
  rawTeacherAssignments.value.forEach((a) => {
    if (a.id_materia && !map.has(a.id_materia)) {
      map.set(a.id_materia, { id_materia: a.id_materia, nombre: a.materia_nombre })
    }
  })
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
})

// Niveles disponibles en las asignaciones del docente
const workloadAvailableNiveles = computed(() => {
  const set = new Set<string>()
  rawTeacherAssignments.value.forEach((a) => {
    if (a.nivel_nombre) set.add(a.nivel_nombre)
  })
  return Array.from(set).sort()
})

// Grados disponibles en las asignaciones del docente (filtrados por Nivel)
const workloadAvailableGrados = computed(() => {
  const set = new Set<string>()
  rawTeacherAssignments.value.forEach((a) => {
    if (workloadFilterNivel.value && a.nivel_nombre !== workloadFilterNivel.value) return
    if (a.tipo_grado_nombre) set.add(a.tipo_grado_nombre)
  })
  return Array.from(set).sort()
})

// Secciones disponibles en las asignaciones del docente (filtradas por Nivel y Grado)
const workloadAvailableSecciones = computed(() => {
  const set = new Set<string>()
  rawTeacherAssignments.value.forEach((a) => {
    if (workloadFilterNivel.value && a.nivel_nombre !== workloadFilterNivel.value) return
    if (workloadFilterGrado.value && a.tipo_grado_nombre !== workloadFilterGrado.value) return
    if (a.seccion_nombre) set.add(a.seccion_nombre)
  })
  return Array.from(set).sort()
})

// Jornadas disponibles en las asignaciones del docente
const workloadAvailableJornadas = computed(() => {
  const set = new Set<string>()
  rawTeacherAssignments.value.forEach((a) => {
    if (workloadFilterNivel.value && a.nivel_nombre !== workloadFilterNivel.value) return
    if (workloadFilterGrado.value && a.tipo_grado_nombre !== workloadFilterGrado.value) return
    if (workloadFilterSeccion.value && a.seccion_nombre !== workloadFilterSeccion.value) return
    if (a.jornada_nombre) set.add(a.jornada_nombre)
  })
  return Array.from(set).sort()
})

// Grupos filtrados en las asignaciones del docente
const workloadFilteredGroups = computed(() => {
  const map = new Map<number, GroupItem>()
  rawTeacherAssignments.value.forEach((a) => {
    if (workloadFilterNivel.value && a.nivel_nombre !== workloadFilterNivel.value) return
    if (workloadFilterGrado.value && a.tipo_grado_nombre !== workloadFilterGrado.value) return
    if (workloadFilterSeccion.value && a.seccion_nombre !== workloadFilterSeccion.value) return
    if (workloadFilterJornada.value && a.jornada_nombre !== workloadFilterJornada.value) return
    if (a.id_grupo && !map.has(a.id_grupo)) {
      map.set(a.id_grupo, {
        id_grupo: a.id_grupo,
        nivel_nombre: a.nivel_nombre,
        tipo_grado_nombre: a.tipo_grado_nombre,
        seccion_nombre: a.seccion_nombre,
        jornada_nombre: a.jornada_nombre
      })
    }
  })
  return Array.from(map.values())
})

const onWorkloadCourseFilterChange = () => {
  if (workloadFilterGroupId.value) {
    const exists = workloadFilteredGroups.value.some((g) => g.id_grupo === workloadFilterGroupId.value)
    if (!exists) {
      workloadFilterGroupId.value = null
    }
  }
}

const resetWorkloadFilters = () => {
  workloadFilterSubjectId.value = null
  workloadFilterNivel.value = ''
  workloadFilterGrado.value = ''
  workloadFilterSeccion.value = ''
  workloadFilterJornada.value = ''
  workloadFilterGroupId.value = null
}

const hasActiveWorkloadFilters = computed(() => {
  return Boolean(
    workloadFilterSubjectId.value ||
    workloadFilterNivel.value ||
    workloadFilterGrado.value ||
    workloadFilterSeccion.value ||
    workloadFilterJornada.value ||
    workloadFilterGroupId.value
  )
})

const visibleTeachers = computed(() => {
  const term = teacherSearch.value.trim().toLowerCase()
  if (!term) return teachers.value
  return teachers.value.filter((t) =>
    `${t.nombre} ${t.apellido}`.toLowerCase().includes(term) ||
    t.documento.toLowerCase().includes(term) ||
    t.email.toLowerCase().includes(term)
  )
})

const selectedTeacher = computed(() =>
  teachers.value.find((t) => t.id_docente === selectedTeacherId.value) || null
)

const selectedTeacherAssignments = computed(() => {
  let list = rawTeacherAssignments.value
  if (workloadFilterSubjectId.value) {
    list = list.filter((a) => a.id_materia === workloadFilterSubjectId.value)
  }
  if (workloadFilterNivel.value) {
    list = list.filter((a) => a.nivel_nombre === workloadFilterNivel.value)
  }
  if (workloadFilterGrado.value) {
    list = list.filter((a) => a.tipo_grado_nombre === workloadFilterGrado.value)
  }
  if (workloadFilterSeccion.value) {
    list = list.filter((a) => a.seccion_nombre === workloadFilterSeccion.value)
  }
  if (workloadFilterJornada.value) {
    list = list.filter((a) => a.jornada_nombre === workloadFilterJornada.value)
  }
  if (workloadFilterGroupId.value) {
    list = list.filter((a) => a.id_grupo === workloadFilterGroupId.value)
  }
  return list
})

// Stats
const activeCount = computed(() => teachers.value.filter(t => t.estado === 'ACTIVO').length)
const inactiveCount = computed(() => teachers.value.filter(t => t.estado === 'INACTIVO').length)
const totalAssignments = computed(() => teachers.value.reduce((acc, t) => acc + t.asignaciones_count, 0))

const teacherStatusClass = (estado: TeacherItem['estado']) => {
  if (estado === 'ACTIVO') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
  if (estado === 'INACTIVO') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
}

const teacherStatusLabel = (estado: TeacherItem['estado']) => {
  if (estado === 'ACTIVO') return 'Activo'
  if (estado === 'INACTIVO') return 'Inactivo'
  return 'Desvinculado'
}

const openDrawer = (teacherId: number) => {
  selectedTeacherId.value = teacherId
  resetCourseFilters()
  resetWorkloadFilters()
  assignmentForm.value = { id_grupo: '', id_materia: '' }
  drawerOpen.value = true
}

const closeDrawer = () => {
  drawerOpen.value = false
}

const goToTeacherMonitoring = () => {
  if (!selectedTeacher.value) return
  
  if (!selectedTeacher.value.id_usuario) {
    alert('Este docente no tiene un usuario activo registrado, no es posible monitorear su panel.')
    return
  }

  auth.startMonitoring({
    id: selectedTeacher.value.id_usuario,
    nombre: selectedTeacher.value.nombre,
    apellido: selectedTeacher.value.apellido,
    email: selectedTeacher.value.email
  })
  closeDrawer()
  router.push('/dashboard')
}

const DEFAULT_DOCUMENT_TYPES: DocumentType[] = [
  { id_tipodocumento: 1, tipo: 'Registro Civil' },
  { id_tipodocumento: 2, tipo: 'Tarjeta de Identidad' },
  { id_tipodocumento: 3, tipo: 'Cédula de Ciudadanía' },
  { id_tipodocumento: 4, tipo: 'Cédula de Extranjería' },
  { id_tipodocumento: 5, tipo: 'PEP / PPT' },
  { id_tipodocumento: 6, tipo: 'Pasaporte' }
]

const documentTypes = ref<DocumentType[]>(DEFAULT_DOCUMENT_TYPES)
const teachers = ref<TeacherItem[]>([])
const subjects = ref<SubjectItem[]>([])
const groups = ref<GroupItem[]>([])
const assignments = ref<AssignmentItem[]>([])

const newTeacher = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: '',
  email: '',
  password: '',
})

const assignmentForm = ref({
  id_materia: '',
  id_grupo: '',
})

// Close drawer on Escape
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeDrawer()
}

const fetchData = async () => {
  const params: Record<string, any> = {}
  if (yearStore.selectedYearId) params.yearId = yearStore.selectedYearId
  const response = await axios.get(`/api/academic-admin/teachers/${schoolId.value}`, { params })
  const fetchedDocTypes = response.data.documentTypes || response.data.tipos_documento
  if (Array.isArray(fetchedDocTypes) && fetchedDocTypes.length > 0) {
    documentTypes.value = fetchedDocTypes
  }
  teachers.value = response.data.teachers || []
  subjects.value = response.data.subjects || []
  groups.value = response.data.groups || []
  assignments.value = response.data.assignments || []
}

const isAutoFilledUser = ref(false)
const autoFilledUserName = ref('')
const existingUserEmail = ref('')
const lookingUpUser = ref(false)

const isDifferentEmailSuggestion = computed(() => {
  if (!isAutoFilledUser.value || !existingUserEmail.value || !newTeacher.value.email) return false
  return newTeacher.value.email.trim().toLowerCase() !== existingUserEmail.value.trim().toLowerCase()
})

const handleAutoLookup = async () => {
  const doc = newTeacher.value.documento.trim()
  const email = newTeacher.value.email.trim()

  if (!doc && !email) {
    isAutoFilledUser.value = false
    autoFilledUserName.value = ''
    existingUserEmail.value = ''
    return
  }

  try {
    lookingUpUser.value = true
    const params: any = { schoolId: schoolId.value }
    if (doc) params.documento = doc
    else if (email) params.email = email

    const res = await axios.get('/api/academic-admin/users/lookup', {
      params,
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    if (res.data && res.data.found && res.data.user) {
      const u = res.data.user
      existingUserEmail.value = u.email || ''

      if (u.nombre) newTeacher.value.nombre = u.nombre
      if (u.apellido) newTeacher.value.apellido = u.apellido
      if (!newTeacher.value.email) {
        newTeacher.value.email = u.email
      }
      if (u.id_tipodocumento) newTeacher.value.id_tipodocumento = String(u.id_tipodocumento)
      if (u.documento) newTeacher.value.documento = u.documento

      isAutoFilledUser.value = true
      autoFilledUserName.value = `${u.nombre} ${u.apellido}`
    } else {
      isAutoFilledUser.value = false
      autoFilledUserName.value = ''
      existingUserEmail.value = ''
    }
  } catch (e) {
    console.error('Error auto-looking up user identity:', e)
  } finally {
    lookingUpUser.value = false
  }
}

const resetAutoFilledUser = () => {
  isAutoFilledUser.value = false
  autoFilledUserName.value = ''
  existingUserEmail.value = ''
  newTeacher.value.nombre = ''
  newTeacher.value.apellido = ''
  newTeacher.value.id_tipodocumento = ''
  newTeacher.value.documento = ''
  newTeacher.value.email = ''
}

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    await fetchData()
  } catch (error) {
    console.error('Error loading teacher management:', error)
  } finally {
    loading.value = false
  }
}

const createTeacher = async (addRoleIfParent: boolean | any = false) => {
  if (yearStore.isReadonlyYear) {
    alert('Acción no permitida: El año académico seleccionado se encuentra CERRADO.')
    return
  }
  const isParentFlag = addRoleIfParent === true;
  if (savingTeacher.value && !isParentFlag) return
  const p = newTeacher.value
  if (!p.nombre.trim() || !p.apellido.trim() || !p.documento.trim() || !p.id_tipodocumento || !p.email.trim() || !p.password.trim()) {
    alert('Completa todos los campos antes de crear el docente.')
    return
  }
  try {
    savingTeacher.value = true
    await axios.post('/api/academic-admin/teachers', {
      schoolId: schoolId.value, nombre: p.nombre, apellido: p.apellido,
      documento: p.documento, id_tipodocumento: Number(p.id_tipodocumento),
      email: p.email, password: p.password,
      addRoleIfParent: isParentFlag
    })
    resetAutoFilledUser()
    p.password = ''
    createTeacherModal.value = false
    await loadData()
  } catch (error: any) {
    if (error.response?.status === 409 && error.response?.data?.isParent) {
      const confirmAdd = confirm(`${error.response.data.message}`)
      if (confirmAdd) {
        await createTeacher(true)
        return
      }
    } else {
      alert(error.response?.data?.error || 'No fue posible crear el docente')
    }
  } finally {
    savingTeacher.value = false
  }
}

const editTeacherModal = ref(false)
const editTeacherForm = ref({
  id_docente: 0,
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: '',
  email: '',
  es_padre: false
})

const openEditTeacherModal = () => {
  if (!selectedTeacher.value) return
  const t = selectedTeacher.value
  editTeacherForm.value = {
    id_docente: t.id_docente,
    nombre: t.nombre,
    apellido: t.apellido,
    documento: t.documento,
    id_tipodocumento: String(t.id_tipodocumento),
    email: t.email,
    es_padre: Boolean(t.es_padre)
  }
  editTeacherModal.value = true
}

const updateTeacher = async () => {
  if (yearStore.isReadonlyYear) {
    alert('Acción no permitida: El año académico seleccionado se encuentra CERRADO.')
    return
  }
  const f = editTeacherForm.value
  if (!f.nombre.trim() || !f.apellido.trim() || !f.documento.trim() || !f.id_tipodocumento || !f.email.trim()) {
    alert('Completa todos los campos.')
    return
  }

  try {
    loading.value = true
    await axios.put(`/api/academic-admin/teachers/${f.id_docente}`, {
      schoolId: schoolId.value,
      nombre: f.nombre.trim(),
      apellido: f.apellido.trim(),
      documento: f.documento.trim(),
      id_tipodocumento: Number(f.id_tipodocumento),
      email: f.email.trim()
    })
    alert('Docente actualizado con éxito.')
    editTeacherModal.value = false
    drawerOpen.value = false
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar el docente')
  } finally {
    loading.value = false
  }
}

const deleteTeacher = async (teacher: TeacherItem) => {
  if (yearStore.isReadonlyYear) {
    alert('Acción no permitida: El año académico seleccionado se encuentra CERRADO.')
    return
  }
  const confirmDelete = confirm(`¿Estás seguro de que deseas ELIMINAR permanentemente al docente "${teacher.nombre} ${teacher.apellido}"? Esta acción borrará todas sus asignaciones académicas y su usuario asociado de forma irreversible.`)
  if (!confirmDelete) return

  try {
    loading.value = true
    await axios.delete(`/api/academic-admin/teachers/${teacher.id_docente}`, {
      params: { schoolId: schoolId.value }
    })
    alert('Docente eliminado con éxito.')
    drawerOpen.value = false
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar el docente')
  } finally {
    loading.value = false
  }
}

const assignCourseSubject = async (replaceExisting = false) => {
  if (yearStore.isReadonlyYear) {
    alert('Acción no permitida: El año académico seleccionado se encuentra CERRADO.')
    return
  }
  if (!selectedTeacher.value || savingAssignment.value) return
  if (!assignmentForm.value.id_grupo || !assignmentForm.value.id_materia) {
    alert('Selecciona curso y materia.'); return
  }
  const selectedGroup = groups.value.find((g: any) => g.id_grupo === Number(assignmentForm.value.id_grupo))
  const selectedSubject = subjects.value.find((s: any) => s.id_materia === Number(assignmentForm.value.id_materia))
  if (selectedGroup && selectedGroup.tipo_grado_nombre === 'TRANSICION') {
    if (selectedSubject && selectedSubject.nombre !== 'Desarrollo Integral' && selectedSubject.nombre !== 'Desarrollo Integral (Transición)') {
      alert('El grado Transición únicamente puede tener asignada la materia Desarrollo Integral.')
      return
    }
  }
  try {
    savingAssignment.value = true
    await axios.post('/api/academic-admin/teacher-assignments', {
      schoolId: schoolId.value,
      id_docente: selectedTeacher.value.id_docente,
      id_grupo: Number(assignmentForm.value.id_grupo),
      id_materia: Number(assignmentForm.value.id_materia),
      replaceExisting,
    })
    assignmentForm.value = { id_grupo: '', id_materia: '' }
    replaceAssignmentModal.value = null
    await loadData()
  } catch (error: any) {
    if (error.response?.status === 409 && error.response?.data?.currentTeacher) {
      replaceAssignmentModal.value = {
        currentTeacher: error.response.data.currentTeacher,
        payload: { id_docente: selectedTeacher.value.id_docente, id_materia: Number(assignmentForm.value.id_materia), id_grupo: Number(assignmentForm.value.id_grupo) },
      }; return
    }
    alert(error.response?.data?.error || 'No fue posible asignar')
  } finally {
    savingAssignment.value = false
  }
}

const confirmReplaceAssignment = async () => {
  if (!replaceAssignmentModal.value) return
  await assignCourseSubject(true)
}

const removeAssignment = async () => {
  if (yearStore.isReadonlyYear) {
    alert('Acción no permitida: El año académico seleccionado se encuentra CERRADO.')
    return
  }
  if (!deleteAssignmentModal.value || deletingAssignment.value) return
  try {
    deletingAssignment.value = true
    await axios.delete(`/api/academic-admin/teacher-assignments/${deleteAssignmentModal.value.id_detallegrado}`, {
      params: { schoolId: schoolId.value },
    })
    deleteAssignmentModal.value = null
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar la asignación')
  } finally {
    deletingAssignment.value = false
  }
}

const submitTeacherStatus = async () => {
  if (yearStore.isReadonlyYear) {
    alert('Acción no permitida: El año académico seleccionado se encuentra CERRADO.')
    return
  }
  if (!selectedTeacher.value || !statusModal.value || updatingStatus.value) return
  try {
    updatingStatus.value = true
    await axios.patch(`/api/academic-admin/teachers/${selectedTeacher.value.id_docente}/status`, {
      schoolId: schoolId.value, estado: statusModal.value.estado, reason: statusReason.value,
    })
    statusModal.value = null; statusReason.value = ''
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar el estado')
  } finally {
    updatingStatus.value = false
  }
}

const exportTeachersToCSV = () => {
  if (teachers.value.length === 0) return

  const headers = [
    'ID Docente',
    'Nombres',
    'Apellidos',
    'Tipo Documento',
    'Documento',
    'Email',
    'Estado',
    'Cursos y Materias Asignados',
    'Total Asignaciones'
  ]

  const rows = teachers.value.map(t => {
    const teacherAssignments = assignments.value
      .filter(a => a.id_docente === t.id_docente)
      .map(a => `${a.materia_nombre} (${getCourseDisplayName({ tipo_grado_nombre: a.tipo_grado_nombre, seccion_nombre: a.seccion_nombre })} - ${a.jornada_nombre})`)
      .join('; ')

    return [
      t.id_docente,
      `"${t.nombre.replace(/"/g, '""')}"`,
      `"${t.apellido.replace(/"/g, '""')}"`,
      `"${(t.tipo_documento || '').replace(/"/g, '""')}"`,
      t.documento || '',
      t.email || '',
      t.estado,
      `"${teacherAssignments.replace(/"/g, '""')}"`,
      t.asignaciones_count || 0
    ]
  })

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `nomina_docentes_${new Date().toLocaleDateString('es-CO').replace(/\//g, '-')}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  loadData()
  document.addEventListener('keydown', handleKeydown)
})

watch(() => yearStore.selectedYearId, () => {
  loadData()
  drawerOpen.value = false
})
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div class="flex items-center gap-4">
        <div class="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl text-blue-600 dark:text-blue-400">
          <Users :size="28" />
        </div>
        <div>
          <h1 class="text-xl font-black text-slate-900 dark:text-white">Gestión de Docentes</h1>
          <p class="text-slate-400 dark:text-slate-500 text-sm font-medium">Administra docentes, carga horaria y estados académicos.</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button 
          v-if="teachers.length > 0"
          @click="exportTeachersToCSV" 
          class="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm transition-all shadow-sm whitespace-nowrap active:scale-95"
        >
          <Download :size="18" />
          Exportar Excel (CSV)
        </button>
        <button 
          v-if="!yearStore.isReadonlyYear"
          @click="createTeacherModal = true" 
          class="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-100/60 dark:shadow-none whitespace-nowrap active:scale-95"
        >
          <Plus :size="18" />
          Nuevo Docente
        </button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-3">
        <div class="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 dark:text-blue-400"><Users :size="18" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ teachers.length }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total</p>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-3">
        <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400"><ShieldCheck :size="18" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ activeCount }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Activos</p>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-3">
        <div class="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 dark:text-amber-400"><ShieldAlert :size="18" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ inactiveCount }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Inactivos</p>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-3">
        <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400"><Briefcase :size="18" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ totalAssignments }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Asignaciones</p>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="18" />
      <input
        v-model="teacherSearch"
        type="text"
        placeholder="Buscar docente por nombre, documento o email..."
        class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold outline-none text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500/10 transition-all"
      />
    </div>

    <!-- Teacher Grid -->
    <div v-if="loading" class="h-64 flex items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
      <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mr-4"></div>
      Cargando nómina docente...
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-if="visibleTeachers.length === 0" class="col-span-full h-48 flex flex-col items-center justify-center text-slate-400">
        <Search :size="48" class="mb-3 opacity-10" />
        <p class="font-black uppercase text-sm tracking-widest">Sin resultados</p>
      </div>

      <button
        v-for="teacher in visibleTeachers"
        :key="teacher.id_docente"
        @click="openDrawer(teacher.id_docente)"
        class="group relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] p-5 text-left hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-xl hover:shadow-blue-50/50 dark:hover:shadow-none transition-all"
      >
        <!-- Status dot -->
        <div :class="[
          teacher.estado === 'ACTIVO' ? 'bg-emerald-500' : teacher.estado === 'INACTIVO' ? 'bg-amber-500' : 'bg-red-500',
          'absolute top-5 right-5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900'
        ]"></div>

        <!-- Avatar -->
        <div :class="[
          teacher.estado === 'ACTIVO' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' :
          teacher.estado === 'INACTIVO' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-950/30 text-red-400',
          'h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl mb-4 transition-transform group-hover:scale-105'
        ]">
          {{ teacher.nombre.charAt(0) }}{{ teacher.apellido.charAt(0) }}
        </div>

        <h4 class="font-black text-slate-900 dark:text-white leading-tight pr-5">{{ teacher.nombre }} {{ teacher.apellido }}</h4>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{{ teacher.tipo_documento }} {{ teacher.documento }}</p>
        <p v-if="teacher.email_padre" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
          <Users :size="10" /> Padre: {{ teacher.email_padre }}
        </p>

        <div class="mt-4 flex items-center justify-between">
          <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
            <Briefcase :size="11" class="text-indigo-500" />
            <span class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">{{ teacher.asignaciones_count }} cursos</span>
          </div>
          <div class="flex items-center gap-1 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-[10px] font-black uppercase tracking-widest">Ver</span>
            <ChevronRight :size="14" />
          </div>
        </div>
      </button>
    </div>

    <!-- Info Banner -->
    <div class="bg-blue-50/50 dark:bg-blue-950/20 p-5 rounded-3xl flex items-start gap-4 border border-blue-100/50 dark:border-blue-900/50">
      <div class="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl max-h-fit shrink-0"><Info :size="18" /></div>
      <p class="text-blue-700/80 dark:text-blue-400/80 text-xs font-medium leading-relaxed">
        Haz clic en la tarjeta de un docente para abrir su panel de gestión. Desde allí podrás actualizar su estado o administrar su carga horaria, sin perder de vista la nómina completa.
      </p>
    </div>
  </div>

  <!-- SLIDE-OVER DRAWER -->
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-[200] flex" @keydown.esc="closeDrawer">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm" @click="closeDrawer"></div>

        <!-- Panel -->
        <Transition name="drawer-slide">
          <div v-if="drawerOpen" class="fixed right-0 top-0 h-full w-full max-w-[680px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
            
            <!-- Drawer Header -->
            <div v-if="selectedTeacher" class="px-8 py-7 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-900 dark:to-indigo-900 flex items-start justify-between gap-4 shrink-0">
              <div class="flex items-center gap-4">
                <div class="h-16 w-16 bg-white/15 dark:bg-white/5 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-inner">
                  {{ selectedTeacher.nombre.charAt(0) }}{{ selectedTeacher.apellido.charAt(0) }}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-xl font-black text-white uppercase">{{ selectedTeacher.nombre }} {{ selectedTeacher.apellido }}</h2>
                    <span :class="[teacherStatusClass(selectedTeacher.estado), 'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest']">
                      {{ teacherStatusLabel(selectedTeacher.estado) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3 mt-1.5 text-blue-100 dark:text-blue-300 text-xs font-medium">
                    <span class="flex items-center gap-1"><Mail :size="12" /> {{ selectedTeacher.email }}</span>
                  </div>
                  <div v-if="selectedTeacher.email_padre" class="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/20 dark:bg-white/15 backdrop-blur-md rounded-full text-white text-[11px] font-bold shadow-sm">
                    <Users :size="12" class="text-blue-100" />
                    <span>Correo Padre:</span>
                    <span class="underline underline-offset-2">{{ selectedTeacher.email_padre }}</span>
                  </div>
                  <p class="text-blue-200 dark:text-blue-400 text-[10px] font-black uppercase mt-1 tracking-widest">{{ selectedTeacher.tipo_documento }} {{ selectedTeacher.documento }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <!-- Monitoring Button -->
                <button
                  @click="goToTeacherMonitoring"
                  class="flex items-center gap-1.5 bg-white/15 hover:bg-white/30 border border-white/30 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                  title="Ver el panel del docente en modo solo lectura"
                >
                  <Eye :size="15" />
                  Ir a Seguimiento
                </button>
                <button @click="closeDrawer" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all mt-1 shrink-0">
                  <X :size="20" />
                </button>
              </div>
            </div>

            <!-- Drawer Body -->
            <div class="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

              <!-- Status Controls -->
              <div v-if="selectedTeacher && !yearStore.isReadonlyYear">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Acciones de Gestión de Docente</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    @click="statusModal = { estado: selectedTeacher.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' }; statusReason = ''"
                    :class="[
                      selectedTeacher.estado === 'ACTIVO'
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40',
                      'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all'
                    ]"
                  >
                    {{ selectedTeacher.estado === 'ACTIVO' ? 'Suspender Acceso' : 'Habilitar Acceso' }}
                  </button>
                  <button
                    v-if="selectedTeacher.estado !== 'DESVINCULADO'"
                    @click="statusModal = { estado: 'DESVINCULADO' }; statusReason = ''"
                    class="bg-red-50 text-red-650 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                  >
                    Desvincular
                  </button>
                  <button
                    @click="openEditTeacherModal"
                    class="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/40 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                  >
                    Editar Datos
                  </button>
                  <button
                    @click="deleteTeacher(selectedTeacher)"
                    class="bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                  >
                    Eliminar Docente
                  </button>
                </div>
              </div>

              <!-- Assignment Form -->
              <div v-if="!yearStore.isReadonlyYear" class="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-6 space-y-5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl"><GraduationCap :size="20" /></div>
                    <div>
                      <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Nueva Asignación</h3>
                      <p class="text-[10px] font-bold text-slate-400 mt-0.5">Filtra por Nivel, Grado, Sección y Jornada para asignar</p>
                    </div>
                  </div>
                  <button 
                    v-if="selectedFilterNivel || selectedFilterGrado || selectedFilterSeccion || selectedFilterJornada" 
                    @click="resetCourseFilters" 
                    class="text-[10px] font-black text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-all"
                  >
                    Limpiar filtros
                  </button>
                </div>

                <!-- Filtros divididos para Selección de Curso -->
                <div class="space-y-3 bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Filter :size="12" class="text-emerald-500" />
                    Filtros de Curso:
                  </p>

                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <!-- 1. Nivel -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Nivel</label>
                      <select 
                        v-model="selectedFilterNivel" 
                        @change="onCourseFilterChange"
                        class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      >
                        <option value="">Todos</option>
                        <option v-for="n in availableNiveles" :key="n" :value="n">{{ n }}</option>
                      </select>
                    </div>

                    <!-- 2. Grado -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Grado</label>
                      <select 
                        v-model="selectedFilterGrado" 
                        @change="onCourseFilterChange"
                        class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      >
                        <option value="">Todos</option>
                        <option v-for="g in availableGrados" :key="g" :value="g">{{ g }}</option>
                      </select>
                    </div>

                    <!-- 3. Sección -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Sección</label>
                      <select 
                        v-model="selectedFilterSeccion" 
                        @change="onCourseFilterChange"
                        class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      >
                        <option value="">Todas</option>
                        <option v-for="s in availableSecciones" :key="s" :value="s">{{ s }}</option>
                      </select>
                    </div>

                    <!-- 4. Jornada -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Jornada</label>
                      <select 
                        v-model="selectedFilterJornada" 
                        @change="onCourseFilterChange"
                        class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      >
                        <option value="">Todas</option>
                        <option v-for="j in availableJornadas" :key="j" :value="j">{{ j }}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Selección de Curso Resultante y Materia -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Curso ({{ filteredGroups.length }} {{ filteredGroups.length === 1 ? 'disponible' : 'disponibles' }})
                    </label>
                    <select 
                      v-model="assignmentForm.id_grupo" 
                      @change="onGroupSelectChange"
                      class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    >
                      <option value="">Seleccionar curso...</option>
                      <option v-for="group in filteredGroups" :key="group.id_grupo" :value="group.id_grupo">
                        {{ getCourseDisplayName({ tipo_grado_nombre: group.tipo_grado_nombre, seccion_nombre: group.seccion_nombre }) }} ({{ group.jornada_nombre }})
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Materia</label>
                    <select v-model="assignmentForm.id_materia" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 transition-all">
                      <option value="">Seleccionar materia...</option>
                      <option v-for="subject in subjects" :key="subject.id_materia" :value="subject.id_materia">{{ subject.nombre }}</option>
                    </select>
                  </div>
                </div>

                <button
                  @click="assignCourseSubject(false)"
                  :disabled="savingAssignment"
                  class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer"
                >
                  {{ savingAssignment ? 'Registrando...' : 'Confirmar Asignación' }}
                </button>
              </div>

              <!-- Current Assignments -->
              <div>
                <div class="flex items-center justify-between mb-4">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <BookOpen :size="14" />
                    Carga Horaria Actual
                  </p>
                  <div class="flex items-center gap-2">
                    <button 
                      v-if="hasActiveWorkloadFilters" 
                      @click="resetWorkloadFilters" 
                      class="text-[10px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                    <span class="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black">{{ selectedTeacherAssignments.length }} asignaciones</span>
                  </div>
                </div>

                <!-- Assignment Filters Divididos (Materia, Nivel, Grado, Sección, Jornada, Curso) -->
                <div class="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 mb-6">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Filter :size="12" class="text-indigo-500" />
                    Filtrar Asignaciones Registradas:
                  </p>

                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <!-- 1. Materia -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Materia</label>
                      <select 
                        v-model="workloadFilterSubjectId" 
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white transition-all focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option :value="null">Todas</option>
                        <option v-for="s in workloadAvailableSubjects" :key="s.id_materia" :value="s.id_materia">{{ s.nombre }}</option>
                      </select>
                    </div>

                    <!-- 2. Nivel -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Nivel</label>
                      <select 
                        v-model="workloadFilterNivel" 
                        @change="onWorkloadCourseFilterChange"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white transition-all focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="">Todos</option>
                        <option v-for="n in workloadAvailableNiveles" :key="n" :value="n">{{ n }}</option>
                      </select>
                    </div>

                    <!-- 3. Grado -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Grado</label>
                      <select 
                        v-model="workloadFilterGrado" 
                        @change="onWorkloadCourseFilterChange"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white transition-all focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="">Todos</option>
                        <option v-for="g in workloadAvailableGrados" :key="g" :value="g">{{ g }}</option>
                      </select>
                    </div>

                    <!-- 4. Sección -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Sección</label>
                      <select 
                        v-model="workloadFilterSeccion" 
                        @change="onWorkloadCourseFilterChange"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white transition-all focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="">Todas</option>
                        <option v-for="sec in workloadAvailableSecciones" :key="sec" :value="sec">{{ sec }}</option>
                      </select>
                    </div>

                    <!-- 5. Jornada -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Jornada</label>
                      <select 
                        v-model="workloadFilterJornada" 
                        @change="onWorkloadCourseFilterChange"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white transition-all focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="">Todas</option>
                        <option v-for="j in workloadAvailableJornadas" :key="j" :value="j">{{ j }}</option>
                      </select>
                    </div>

                    <!-- 6. Curso Específico -->
                    <div class="space-y-1">
                      <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Curso Específico</label>
                      <select 
                        v-model="workloadFilterGroupId" 
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white transition-all focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option :value="null">Todos los cursos</option>
                        <option v-for="g in workloadFilteredGroups" :key="g.id_grupo" :value="g.id_grupo">
                          {{ getCourseDisplayName({ tipo_grado_nombre: g.tipo_grado_nombre, seccion_nombre: g.seccion_nombre }) }} ({{ g.jornada_nombre }})
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div v-if="selectedTeacherAssignments.length === 0" class="text-center py-12 text-slate-400">
                  <GraduationCap :size="48" class="mb-3 mx-auto opacity-10" />
                  <p class="text-xs font-black uppercase tracking-widest">Sin asignaciones activas</p>
                </div>

                <div class="space-y-3">
                  <div
                    v-for="assignment in selectedTeacherAssignments"
                    :key="assignment.id_detallegrado"
                    class="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md transition-all"
                  >
                    <div>
                      <p class="font-black text-slate-900 dark:text-white text-sm">{{ assignment.materia_nombre }}</p>
                      <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{{ getCourseDisplayName({ tipo_grado_nombre: assignment.tipo_grado_nombre, seccion_nombre: assignment.seccion_nombre }) }} · {{ assignment.jornada_nombre }}</p>
                    </div>
                    <button
                      v-if="!yearStore.isReadonlyYear"
                      @click="deleteAssignmentModal = assignment"
                      class="p-2 text-slate-300 dark:text-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <UserMinus :size="18" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Create Teacher Modal -->
    <div v-if="createTeacherModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="createTeacherModal = false"></div>
      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 class="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Plus :size="22" class="text-blue-600" />Alta de Nuevo Docente</h2>
          <p class="text-slate-400 dark:text-slate-500 text-sm font-medium mt-1">Completa los datos personales y las credenciales de acceso inicial.</p>
        </div>
        <div class="p-8 space-y-5 overflow-y-auto">
          <!-- Banner de Usuario Encontrado / Precargado -->
          <div v-if="isAutoFilledUser" class="space-y-2">
            <div class="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                  <UserCheck :size="18" />
                </div>
                <p class="text-xs font-bold text-emerald-900 dark:text-emerald-300 leading-relaxed">
                  👤 Usuario encontrado en el sistema: <strong>{{ autoFilledUserName }}</strong>. Se han bloqueado sus datos personales para preservar la identidad.
                </p>
              </div>
              <button type="button" @click="resetAutoFilledUser" class="text-[11px] font-black text-emerald-700 dark:text-emerald-400 hover:underline shrink-0 uppercase tracking-wider">
                Limpiar
              </button>
            </div>

            <!-- Advertencia/Sugerencia si se ingresa un correo diferente -->
            <div v-if="isDifferentEmailSuggestion" class="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-3.5 flex items-center gap-3 animate-in fade-in duration-200">
              <div class="p-2 bg-blue-600 text-white rounded-xl shrink-0">
                <Info :size="18" />
              </div>
              <div class="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
                <p class="font-black uppercase tracking-wider text-[10px]">💡 Cuenta Institucional Independiente:</p>
                <p class="font-medium mt-0.5">
                  <strong>{{ autoFilledUserName }}</strong> tiene registrada una cuenta previa con el correo <strong>{{ existingUserEmail }}</strong>. El nuevo correo <strong>{{ newTeacher.email }}</strong> se asignará como su cuenta de acceso exclusiva para sus funciones de Docente.
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombres</span>
              <input v-model="newTeacher.nombre" :disabled="isAutoFilledUser" type="text" placeholder="Ej. Laura Elena" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80" />
            </label>
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellidos</span>
              <input v-model="newTeacher.apellido" :disabled="isAutoFilledUser" type="text" placeholder="Ej. Gómez" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80" />
            </label>
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo Doc.</span>
              <select v-model="newTeacher.id_tipodocumento" :disabled="isAutoFilledUser" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80">
                <option value="">Seleccionar...</option>
                <option v-for="type in documentTypes" :key="type.id_tipodocumento" :value="type.id_tipodocumento">{{ type.tipo }}</option>
              </select>
            </label>
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</span>
              <input v-model="newTeacher.documento" :disabled="isAutoFilledUser" @blur="handleAutoLookup" type="text" placeholder="Documento de identidad" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80" />
            </label>
            <label class="col-span-2 space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Institucional</span>
              <input v-model="newTeacher.email" @blur="handleAutoLookup" type="email" placeholder="docente@institucion.edu" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white" />
            </label>
            <label class="col-span-2 space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña Temporal</span>
              <input v-model="newTeacher.password" type="text" placeholder="Clave provisoria de acceso" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white" />
            </label>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="createTeacherModal = false; resetAutoFilledUser()" class="flex-1 py-4 rounded-xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm uppercase tracking-widest">Cancelar</button>
            <button @click="createTeacher" :disabled="savingTeacher" class="flex-[2] bg-blue-600 text-white py-4 rounded-xl font-black shadow-xl shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all disabled:opacity-50 text-sm uppercase tracking-widest">
              {{ savingTeacher ? 'Registrando...' : 'Crear Docente' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Teacher Modal -->
    <div v-if="editTeacherModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="editTeacherModal = false"></div>
      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 class="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Edit2 :size="22" class="text-blue-600" />Modificar Datos de Docente</h2>
          <p class="text-slate-400 dark:text-slate-500 text-sm font-medium mt-1">Actualiza únicamente el correo electrónico institucional del docente para esta institución.</p>
        </div>
        <div class="p-8 space-y-5 overflow-y-auto font-sans">
          <!-- Advertencia de protección de identidad global -->
          <div class="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-3.5 flex items-center gap-3 animate-in fade-in duration-200">
            <div class="p-2 bg-blue-600 text-white rounded-xl shrink-0">
              <Info :size="18" />
            </div>
            <div class="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
              <p class="font-black uppercase tracking-wider text-[10px]">🔒 Protección de Identidad del Usuario:</p>
              <p class="font-medium mt-0.5">
                Los datos personales (nombres, apellidos y documento de identidad) permanecen protegidos para no alterar la cuenta global de la persona. En esta ventana únicamente se puede modificar el <strong>Email Institucional</strong> asignado a esta institución.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombres</span>
              <input v-model="editTeacherForm.nombre" :disabled="true" type="text" placeholder="Ej. Laura Elena" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80" />
            </label>
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellidos</span>
              <input v-model="editTeacherForm.apellido" :disabled="true" type="text" placeholder="Ej. Gómez" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80" />
            </label>
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo Doc.</span>
              <select v-model="editTeacherForm.id_tipodocumento" :disabled="true" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80">
                <option value="">Seleccionar...</option>
                <option v-for="type in documentTypes" :key="type.id_tipodocumento" :value="type.id_tipodocumento">{{ type.tipo }}</option>
              </select>
            </label>
            <label class="space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</span>
              <input v-model="editTeacherForm.documento" :disabled="true" type="text" placeholder="Documento de identidad" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-800/80" />
            </label>
            <label class="col-span-2 space-y-1.5">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Institucional</span>
              <input v-model="editTeacherForm.email" type="email" placeholder="docente@institucion.edu" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20" />
            </label>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="editTeacherModal = false" class="flex-1 py-4 rounded-xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm uppercase tracking-widest">Cancelar</button>
            <button @click="updateTeacher" class="flex-[2] bg-blue-600 text-white py-4 rounded-xl font-black shadow-xl shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all text-sm uppercase tracking-widest">
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Modal -->
    <div v-if="statusModal && selectedTeacher" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="statusModal = null"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden shadow-2xl">
        <div class="p-8 text-center">
          <div :class="[statusModal.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-500' : statusModal.estado === 'INACTIVO' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500', 'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5']">
            <ShieldAlert v-if="statusModal.estado !== 'ACTIVO'" :size="30" />
            <ShieldCheck v-else :size="30" />
          </div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase">Cambio de Estado</h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-2">
            Cambiando a <strong>{{ selectedTeacher.nombre }}</strong> al estado <span class="font-black uppercase" :class="statusModal.estado === 'ACTIVO' ? 'text-emerald-600' : statusModal.estado === 'INACTIVO' ? 'text-amber-600' : 'text-red-600'">{{ statusModal.estado }}</span>.
          </p>
        </div>
        <div class="px-8 pb-8 space-y-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observación (Opcional)</label>
            <textarea v-model="statusReason" rows="3" placeholder="Motivo del cambio..." class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 text-sm font-bold outline-none text-slate-900 dark:text-white"></textarea>
          </div>
          <div class="flex gap-3">
            <button @click="statusModal = null" class="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase tracking-widest">Cancelar</button>
            <button @click="submitTeacherStatus" :disabled="updatingStatus" :class="[statusModal.estado === 'ACTIVO' ? 'bg-emerald-600 shadow-emerald-100' : statusModal.estado === 'INACTIVO' ? 'bg-amber-500 shadow-amber-100' : 'bg-red-600 shadow-red-100', 'flex-[2] text-white py-3 rounded-xl font-black shadow-lg dark:shadow-none transition-all disabled:opacity-50 text-xs uppercase tracking-widest']">
              {{ updatingStatus ? 'Aplicando...' : 'Confirmar Cambio' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Assignment Conflict Modal -->
    <div v-if="replaceAssignmentModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-amber-950/40 backdrop-blur-md" @click="replaceAssignmentModal = null"></div>
      <div class="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden shadow-2xl">
        <div class="p-8 text-center">
          <div class="w-14 h-14 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><ShieldAlert :size="28" /></div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase">Conflicto de Carga</h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-3 leading-relaxed">Ya asignada a <strong class="text-amber-600">{{ replaceAssignmentModal.currentTeacher.nombre }} {{ replaceAssignmentModal.currentTeacher.apellido }}</strong>. ¿Transferir al docente actual?</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800/50 px-8 py-6 flex gap-3">
          <button @click="replaceAssignmentModal = null" class="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-white transition-all text-xs uppercase">Mantener</button>
          <button @click="confirmReplaceAssignment" :disabled="savingAssignment" class="flex-2 bg-amber-600 text-white px-6 py-3 rounded-xl font-black transition-all disabled:opacity-50 text-xs uppercase">{{ savingAssignment ? 'Transfiriendo...' : 'Transferir' }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Assignment Modal -->
    <div v-if="deleteAssignmentModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="deleteAssignmentModal = null"></div>
      <div class="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden shadow-2xl">
        <div class="p-8 text-center">
          <div class="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5"><UserMinus :size="28" /></div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase">Retirar Asignación</h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed">¿Retirar <strong class="text-slate-900 dark:text-white">{{ deleteAssignmentModal.materia_nombre }}</strong> del grupo asignado?</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800/50 px-8 py-6 flex gap-3">
          <button @click="deleteAssignmentModal = null" class="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-white transition-all text-xs uppercase">Cancelar</button>
          <button @click="removeAssignment" :disabled="deletingAssignment" class="flex-2 bg-red-600 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-700 transition-all disabled:opacity-50 text-xs uppercase">{{ deletingAssignment ? 'Retirando...' : 'Confirmar' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}

.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
</style>
