<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { BookOpen, GraduationCap, Mail, Plus, Search, Trash2, UserSquare2, Users } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface DocumentType {
  id_tipodocumento: number
  tipo: string
}

interface TeacherItem {
  id_docente: number
  nombre: string
  apellido: string
  documento: string
  id_tipodocumento: number
  tipo_documento: string
  email: string
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
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const savingTeacher = ref(false)
const savingAssignment = ref(false)
const deletingAssignment = ref(false)
const updatingStatus = ref(false)

const teacherSearch = ref('')
const selectedTeacherId = ref<number | null>(null)
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

const visibleTeachers = computed(() => {
  const term = teacherSearch.value.trim().toLowerCase()
  if (!term) return teachers.value

  return teachers.value.filter((teacher) =>
    `${teacher.nombre} ${teacher.apellido}`.toLowerCase().includes(term) ||
    teacher.documento.toLowerCase().includes(term) ||
    teacher.email.toLowerCase().includes(term)
  )
})

const selectedTeacher = computed(() =>
  teachers.value.find((teacher) => teacher.id_docente === selectedTeacherId.value) || null
)

const selectedTeacherAssignments = computed(() =>
  assignments.value.filter((assignment) => assignment.id_docente === selectedTeacherId.value)
)

const teacherStatusLabel = (estado: TeacherItem['estado']) => {
  if (estado === 'ACTIVO') return 'Activo'
  if (estado === 'INACTIVO') return 'Inactivo'
  return 'Desvinculado'
}

const teacherStatusClass = (estado: TeacherItem['estado']) => {
  if (estado === 'ACTIVO') return 'bg-emerald-50 text-emerald-700'
  if (estado === 'INACTIVO') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

const fetchData = async () => {
  const response = await axios.get(`http://localhost:3000/api/academic-admin/teachers/${schoolId.value}`)
  documentTypes.value = response.data.documentTypes
  teachers.value = response.data.teachers
  subjects.value = response.data.subjects
  groups.value = response.data.groups
  assignments.value = response.data.assignments

  if (teachers.value.length === 0) {
    selectedTeacherId.value = null
    return
  }

  const stillExists = teachers.value.some((teacher) => teacher.id_docente === selectedTeacherId.value)
  if (!selectedTeacherId.value || !stillExists) {
    selectedTeacherId.value = teachers.value[0].id_docente
  }
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

const closeCreateTeacherModal = () => {
  createTeacherModal.value = false
}

const createTeacher = async () => {
  if (savingTeacher.value) return

  const payload = newTeacher.value
  if (!payload.nombre.trim() || !payload.apellido.trim() || !payload.documento.trim() || !payload.id_tipodocumento || !payload.email.trim() || !payload.password.trim()) {
    alert('Completa todos los campos del docente antes de crearlo.')
    return
  }

  try {
    savingTeacher.value = true
    await axios.post('http://localhost:3000/api/academic-admin/teachers', {
      schoolId: schoolId.value,
      nombre: payload.nombre,
      apellido: payload.apellido,
      documento: payload.documento,
      id_tipodocumento: Number(payload.id_tipodocumento),
      email: payload.email,
      password: payload.password,
    })

    newTeacher.value = {
      nombre: '',
      apellido: '',
      documento: '',
      id_tipodocumento: '',
      email: '',
      password: '',
    }
    closeCreateTeacherModal()
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible crear el docente')
  } finally {
    savingTeacher.value = false
  }
}

const assignCourseSubject = async (replaceExisting = false) => {
  if (!selectedTeacher.value || savingAssignment.value) return
  if (!assignmentForm.value.id_grupo || !assignmentForm.value.id_materia) {
    alert('Selecciona curso y materia antes de asignar.')
    return
  }

  try {
    savingAssignment.value = true
    await axios.post('http://localhost:3000/api/academic-admin/teacher-assignments', {
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
        payload: {
          id_docente: selectedTeacher.value.id_docente,
          id_grupo: Number(assignmentForm.value.id_grupo),
          id_materia: Number(assignmentForm.value.id_materia),
        },
      }
      return
    }
    alert(error.response?.data?.error || 'No fue posible asignar el curso y la materia al docente')
  } finally {
    savingAssignment.value = false
  }
}

const confirmReplaceAssignment = async () => {
  if (!replaceAssignmentModal.value || !selectedTeacher.value) return
  await assignCourseSubject(true)
}

const removeAssignment = async () => {
  if (!deleteAssignmentModal.value || deletingAssignment.value) return

  try {
    deletingAssignment.value = true
    await axios.delete(`http://localhost:3000/api/academic-admin/teacher-assignments/${deleteAssignmentModal.value.id_detallegrado}`, {
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
  if (!selectedTeacher.value || !statusModal.value || updatingStatus.value) return

  try {
    updatingStatus.value = true
    await axios.patch(`http://localhost:3000/api/academic-admin/teachers/${selectedTeacher.value.id_docente}/status`, {
      schoolId: schoolId.value,
      estado: statusModal.value.estado,
      reason: statusReason.value,
    })
    statusModal.value = null
    statusReason.value = ''
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar el estado del docente')
  } finally {
    updatingStatus.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-8">
    <div class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm md:p-10">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-3xl font-black text-slate-900">Gestión de Docentes</h1>
          <p class="mt-2 text-slate-500">Crea docentes y administra qué materias y cursos tiene asignados cada uno.</p>
        </div>
        <button
          type="button"
          @click="createTeacherModal = true"
          class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-base font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-500"
        >
          <Plus class="h-5 w-5" />
          Crear docente
        </button>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm">
      Cargando docentes y asignaciones...
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div class="border-b border-slate-100 p-6">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <Users class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900">Docentes registrados</h2>
                <p class="text-sm text-slate-500">{{ visibleTeachers.length }} resultados de {{ teachers.length }}</p>
              </div>
            </div>

            <div class="relative mt-5">
              <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                v-model="teacherSearch"
                type="text"
                placeholder="Buscar por nombre, documento o correo"
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-10 pr-4 text-sm font-semibold outline-none"
              />
            </div>
          </div>

          <div v-if="visibleTeachers.length === 0" class="p-10 text-center text-sm font-semibold text-slate-400">
            No se encontraron docentes.
          </div>

          <div v-else class="max-h-[780px] space-y-3 overflow-auto p-4">
            <button
              v-for="teacher in visibleTeachers"
              :key="teacher.id_docente"
              type="button"
              @click="selectedTeacherId = teacher.id_docente"
              :class="[
                selectedTeacherId === teacher.id_docente ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50',
                'w-full rounded-3xl border p-5 text-left transition-all'
              ]"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-base font-black text-slate-900">{{ teacher.nombre }} {{ teacher.apellido }}</p>
                  <p class="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ teacher.tipo_documento }} · {{ teacher.documento }}</p>
                </div>
                <span class="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 shadow-sm">{{ teacher.asignaciones_count }}</span>
              </div>

              <div class="mt-4 space-y-2 text-sm font-semibold text-slate-500">
                <p class="flex items-center gap-2">
                  <Mail class="h-4 w-4 text-slate-400" />
                  {{ teacher.email }}
                </p>
                <p class="flex items-center gap-2">
                  <BookOpen class="h-4 w-4 text-slate-400" />
                  {{ teacher.asignaciones_count }} asignaciones activas
                </p>
              </div>
            </button>
          </div>
        </section>

        <section class="space-y-8">
          <div v-if="!selectedTeacher" class="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
            Selecciona un docente para gestionar sus asignaciones.
          </div>

          <template v-else>
            <section class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div class="flex items-center gap-4">
                  <div class="rounded-3xl bg-blue-50 p-4 text-blue-600">
                    <UserSquare2 class="h-8 w-8" />
                  </div>
                  <div>
                    <h2 class="text-2xl font-black text-slate-900">{{ selectedTeacher.nombre }} {{ selectedTeacher.apellido }}</h2>
                    <p class="mt-1 text-sm font-semibold text-slate-500">{{ selectedTeacher.tipo_documento }} · {{ selectedTeacher.documento }}</p>
                    <p class="mt-2 text-sm font-semibold text-slate-500">{{ selectedTeacher.email }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="rounded-2xl bg-slate-50 px-5 py-4">
                    <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Estado</p>
                    <p class="mt-2 inline-flex rounded-full px-3 py-1 text-sm font-black" :class="teacherStatusClass(selectedTeacher.estado)">
                      {{ teacherStatusLabel(selectedTeacher.estado) }}
                    </p>
                  </div>
                  <div class="rounded-2xl bg-slate-50 px-5 py-4">
                    <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Asignaciones</p>
                    <p class="mt-2 text-sm font-black text-slate-800">{{ selectedTeacher.asignaciones_count }}</p>
                  </div>
                </div>
              </div>

              <div class="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  @click="statusModal = { estado: selectedTeacher.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' }; statusReason = ''"
                  :class="[
                    selectedTeacher.estado === 'ACTIVO' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-blue-600 hover:bg-blue-500',
                    'inline-flex min-h-12 items-center justify-center rounded-2xl px-6 py-3 text-sm font-black text-white shadow-sm transition-all'
                  ]"
                >
                  {{ selectedTeacher.estado === 'ACTIVO' ? 'Inactivar docente' : 'Activar docente' }}
                </button>
                <button
                  v-if="selectedTeacher.estado !== 'DESVINCULADO'"
                  type="button"
                  @click="statusModal = { estado: 'DESVINCULADO' }; statusReason = ''"
                  class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-red-500"
                >
                  Desvincular docente
                </button>
              </div>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <GraduationCap class="h-6 w-6" />
                </div>
                <div>
                  <h3 class="text-lg font-black text-slate-900">Asignar curso y materia</h3>
                  <p class="text-sm text-slate-500">Cada combinación de curso y materia solo puede quedar en un docente a la vez.</p>
                </div>
              </div>

              <div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <label class="space-y-2">
                  <span class="block text-sm font-black text-slate-700">Curso</span>
                  <select v-model="assignmentForm.id_grupo" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                    <option value="">Selecciona un curso</option>
                    <option v-for="group in groups" :key="group.id_grupo" :value="group.id_grupo">
                      {{ group.tipo_grado_nombre }} {{ group.seccion_nombre }} · {{ group.jornada_nombre }} · {{ group.nivel_nombre }}
                    </option>
                  </select>
                </label>

                <label class="space-y-2">
                  <span class="block text-sm font-black text-slate-700">Materia</span>
                  <select v-model="assignmentForm.id_materia" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                    <option value="">Selecciona una materia</option>
                    <option v-for="subject in subjects" :key="subject.id_materia" :value="subject.id_materia">
                      {{ subject.nombre }}
                    </option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                @click="assignCourseSubject()"
                :disabled="savingAssignment"
                class="mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
              >
                <Plus class="h-4 w-4" />
                {{ savingAssignment ? 'Asignando...' : 'Asignar al docente' }}
              </button>
            </section>

            <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div class="border-b border-slate-100 px-6 py-5">
                <h3 class="text-lg font-black text-slate-900">Asignaciones actuales</h3>
                <p class="mt-1 text-sm text-slate-500">Materias y cursos que ya están vinculados a este docente.</p>
              </div>

              <div v-if="selectedTeacherAssignments.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400">
                Este docente aún no tiene asignaciones registradas.
              </div>

              <div v-else class="divide-y divide-slate-100">
                <div v-for="assignment in selectedTeacherAssignments" :key="assignment.id_detallegrado" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p class="text-base font-black text-slate-900">{{ assignment.materia_nombre }}</p>
                    <p class="mt-1 text-sm font-semibold text-slate-500">
                      {{ assignment.tipo_grado_nombre }} {{ assignment.seccion_nombre }} · {{ assignment.jornada_nombre }} · {{ assignment.nivel_nombre }}
                    </p>
                  </div>
                  <button
                    type="button"
                    @click="deleteAssignmentModal = assignment"
                    class="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-5 py-3 text-sm font-black text-red-600 transition-all hover:bg-red-100"
                  >
                    <Trash2 class="h-4 w-4" />
                    Desasignar
                  </button>
                </div>
              </div>
            </section>
          </template>
        </section>
      </div>
    </template>

    <div class="rounded-3xl border border-blue-100 bg-blue-50 p-6 text-sm font-semibold text-blue-700">
      Este primer módulo concentra creación de docentes y administración de asignaciones por combinación curso + materia, que es la unidad real de trabajo usada por el sistema académico.
    </div>

    <div v-if="createTeacherModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md">
      <div class="w-full max-w-3xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-blue-400">Nuevo docente</p>
          <h2 class="mt-1 text-2xl font-black text-slate-900">Crear docente</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">
            Se crea el registro académico del docente y también su cuenta de acceso.
          </p>
        </div>

        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nombre</span>
              <input v-model="newTeacher.nombre" type="text" placeholder="Ej. Laura" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>

            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Apellido</span>
              <input v-model="newTeacher.apellido" type="text" placeholder="Ej. Gómez" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>

            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Tipo de documento</span>
              <select v-model="newTeacher.id_tipodocumento" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona un tipo</option>
                <option v-for="type in documentTypes" :key="type.id_tipodocumento" :value="type.id_tipodocumento">{{ type.tipo }}</option>
              </select>
            </label>

            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Documento</span>
              <input v-model="newTeacher.documento" type="text" placeholder="Número de documento" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>

            <label class="space-y-2 md:col-span-2">
              <span class="block text-sm font-black text-slate-700">Correo de acceso</span>
              <input v-model="newTeacher.email" type="email" placeholder="docente@colegio.edu" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>

            <label class="space-y-2 md:col-span-2">
              <span class="block text-sm font-black text-slate-700">Contraseña temporal</span>
              <input v-model="newTeacher.password" type="text" placeholder="Contraseña inicial del docente" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="closeCreateTeacherModal" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">
              Cancelar
            </button>
            <button
              type="button"
              @click="createTeacher"
              :disabled="savingTeacher"
              class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
            >
              <Plus class="h-4 w-4" />
              {{ savingTeacher ? 'Creando...' : 'Crear docente' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="replaceAssignmentModal" class="fixed inset-0 z-[110] flex min-h-screen w-screen items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div class="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-400">Conflicto de asignación</p>
          <h2 class="mt-1 text-2xl font-black text-slate-900">Curso y materia ya ocupados</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">
            Esa combinación ya está asignada a otro docente. Puedes mantenerla o reemplazar al docente actual.
          </p>
        </div>

        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="rounded-3xl border border-amber-100 bg-amber-50 p-5">
            <p class="text-sm font-black text-amber-700">
              La asignación actual pertenece a {{ replaceAssignmentModal.currentTeacher.nombre }} {{ replaceAssignmentModal.currentTeacher.apellido }}.
            </p>
            <p class="mt-3 text-sm font-semibold text-amber-700/90">
              Si continúas, la combinación `curso + materia` pasará al docente que tienes seleccionado.
            </p>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="replaceAssignmentModal = null" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">
              Mantener asignación actual
            </button>
            <button
              type="button"
              @click="confirmReplaceAssignment"
              :disabled="savingAssignment"
              class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-amber-500 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
            >
              <Plus class="h-4 w-4" />
              {{ savingAssignment ? 'Reasignando...' : 'Reasignar al docente seleccionado' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deleteAssignmentModal" class="fixed inset-0 z-[110] flex min-h-screen w-screen items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div class="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-red-400">Eliminar asignación</p>
          <h2 class="mt-1 text-2xl font-black text-slate-900">Desasignar curso y materia</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">
            Esta acción retira la relación actual entre el docente, el curso y la materia.
          </p>
        </div>

        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="rounded-3xl border border-red-100 bg-red-50 p-5">
            <p class="text-sm font-black text-red-700">
              Vas a desasignar {{ deleteAssignmentModal.materia_nombre }} de {{ deleteAssignmentModal.tipo_grado_nombre }} {{ deleteAssignmentModal.seccion_nombre }}.
            </p>
            <p class="mt-3 text-sm font-semibold text-red-700/90">
              El curso quedará sin docente responsable para esa materia hasta que hagas una nueva asignación.
            </p>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="deleteAssignmentModal = null" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">
              Cancelar
            </button>
            <button
              type="button"
              @click="removeAssignment"
              :disabled="deletingAssignment"
              class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-red-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
            >
              <Trash2 class="h-4 w-4" />
              {{ deletingAssignment ? 'Desasignando...' : 'Confirmar desasignación' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="statusModal && selectedTeacher" class="fixed inset-0 z-[110] flex min-h-screen w-screen items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div class="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <p class="text-xs font-black uppercase tracking-[0.24em]" :class="statusModal.estado === 'ACTIVO' ? 'text-blue-400' : statusModal.estado === 'INACTIVO' ? 'text-amber-400' : 'text-red-400'">
            Estado del docente
          </p>
          <h2 class="mt-1 text-2xl font-black text-slate-900">
            {{ statusModal.estado === 'ACTIVO' ? 'Activar docente' : statusModal.estado === 'INACTIVO' ? 'Inactivar docente' : 'Desvincular docente' }}
          </h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">
            Se notificará por correo al docente sobre este cambio de estado.
          </p>
        </div>

        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="rounded-3xl border p-5" :class="statusModal.estado === 'ACTIVO' ? 'border-blue-100 bg-blue-50' : statusModal.estado === 'INACTIVO' ? 'border-amber-100 bg-amber-50' : 'border-red-100 bg-red-50'">
            <p class="text-sm font-black" :class="statusModal.estado === 'ACTIVO' ? 'text-blue-700' : statusModal.estado === 'INACTIVO' ? 'text-amber-700' : 'text-red-700'">
              {{ statusModal.estado === 'ACTIVO'
                ? `Vas a activar la cuenta de ${selectedTeacher.nombre} ${selectedTeacher.apellido}.`
                : statusModal.estado === 'INACTIVO'
                  ? `Vas a inactivar la cuenta de ${selectedTeacher.nombre} ${selectedTeacher.apellido}.`
                  : `Vas a desvincular a ${selectedTeacher.nombre} ${selectedTeacher.apellido}.` }}
            </p>
            <p class="mt-3 text-sm font-semibold" :class="statusModal.estado === 'ACTIVO' ? 'text-blue-700/90' : statusModal.estado === 'INACTIVO' ? 'text-amber-700/90' : 'text-red-700/90'">
              {{ statusModal.estado === 'ACTIVO'
                ? 'El docente podrá volver a ingresar a la plataforma.'
                : statusModal.estado === 'INACTIVO'
                  ? 'El docente no podrá iniciar sesión mientras permanezca inactivo.'
                  : 'El docente perderá acceso al sistema y sus asignaciones activas serán retiradas.' }}
            </p>
          </div>

          <label class="mt-6 block space-y-2">
            <span class="block text-sm font-black text-slate-700">Motivo o detalle para el correo</span>
            <textarea
              v-model="statusReason"
              rows="4"
              placeholder="Escribe un detalle opcional que se incluirá en la notificación"
              class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none"
            />
          </label>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="statusModal = null; statusReason = ''" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">
              Cancelar
            </button>
            <button
              type="button"
              @click="submitTeacherStatus"
              :disabled="updatingStatus"
              :class="[
                statusModal.estado === 'ACTIVO' ? 'bg-blue-600' : statusModal.estado === 'INACTIVO' ? 'bg-amber-500' : 'bg-red-600',
                'inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50'
              ]"
            >
              {{ updatingStatus ? 'Guardando...' : statusModal.estado === 'ACTIVO' ? 'Confirmar activación' : statusModal.estado === 'INACTIVO' ? 'Confirmar inactivación' : 'Confirmar desvinculación' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
