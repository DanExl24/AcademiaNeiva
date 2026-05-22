<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { Layers3, Plus, Search, School2, Trash2 } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

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

const loading = ref(true)
const savingGrade = ref(false)
const savingGroup = ref(false)
const activeView = ref<'records' | 'crud'>('records')
const crudMode = ref<'grade' | 'course'>('grade')
const searchMode = ref<'grade' | 'course'>('grade')
const searchTerm = ref('')
const createModal = ref<null | 'grade' | 'course'>(null)
const deleting = ref(false)

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

const newGradeType = ref({
  id_nivel: '',
  nombre: '',
})

const newGroup = ref({
  id_nivel: '',
  id_tipo_grado: '',
  id_jornada: '',
  id_seccion: '',
  cupos_totales: 30,
})

const filteredGradeTypes = computed(() =>
  tiposGrado.value.filter((item) =>
    !newGroup.value.id_nivel || item.id_nivel === Number(newGroup.value.id_nivel)
  )
)

const visibleGradeTypes = computed(() => {
  const term = searchMode.value === 'grade' ? searchTerm.value.trim().toLowerCase() : ''
  if (!term) return tiposGrado.value

  return tiposGrado.value.filter((item) =>
    item.nombre.toLowerCase().includes(term) ||
    item.nivel_nombre.toLowerCase().includes(term)
  )
})

const visibleGroups = computed(() => {
  const term = searchMode.value === 'course' ? searchTerm.value.trim().toLowerCase() : ''
  if (!term) return grupos.value

  return grupos.value.filter((item) =>
    item.tipo_grado_nombre.toLowerCase().includes(term) ||
    item.nivel_nombre.toLowerCase().includes(term) ||
    item.jornada_nombre.toLowerCase().includes(term) ||
    item.seccion_nombre.toLowerCase().includes(term)
  )
})

const openCreateModal = (mode: 'grade' | 'course') => {
  createModal.value = mode
}

const closeCreateModal = () => {
  createModal.value = null
}

const openDeleteGradeModal = (item: TipoGrado) => {
  deleteModal.value = { kind: 'grade', item }
}

const openDeleteCourseModal = (item: Grupo) => {
  deleteModal.value = { kind: 'course', item }
}

const closeDeleteModal = () => {
  if (deleting.value) return
  deleteModal.value = null
}

const fetchCatalogs = async () => {
  const [catalogsRes, gradesRes] = await Promise.all([
    axios.get('http://localhost:3000/api/academic-admin/catalogs'),
    axios.get(`http://localhost:3000/api/academic-admin/grades/${schoolId.value}`),
  ])

  secciones.value = catalogsRes.data.secciones
  niveles.value = gradesRes.data.niveles
  jornadas.value = gradesRes.data.jornadas
  tiposGrado.value = gradesRes.data.tiposGrado
  grupos.value = gradesRes.data.grupos
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

const createGradeType = async () => {
  if (savingGrade.value) return
  if (!newGradeType.value.id_nivel || !newGradeType.value.nombre.trim()) {
    alert('Completa nivel académico y nombre del grado antes de crearlo.')
    return
  }

  try {
    savingGrade.value = true
    await axios.post('http://localhost:3000/api/academic-admin/grade-types', {
      schoolId: schoolId.value,
      id_nivel: Number(newGradeType.value.id_nivel),
      nombre: newGradeType.value.nombre,
    })
    newGradeType.value = { id_nivel: '', nombre: '' }
    await loadData()
    closeCreateModal()
    activeView.value = 'records'
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear el grado')
  } finally {
    savingGrade.value = false
  }
}

const createGroup = async () => {
  const payload = newGroup.value
  if (savingGroup.value) return
  if (!payload.id_nivel || !payload.id_tipo_grado || !payload.id_jornada || !payload.id_seccion) {
    alert('Completa nivel, grado, jornada y sección antes de crear el curso.')
    return
  }
  if (Number(payload.cupos_totales) < 0) {
    alert('Los cupos del curso no pueden ser negativos.')
    return
  }

  try {
    savingGroup.value = true
    await axios.post('http://localhost:3000/api/academic-admin/groups', {
      schoolId: schoolId.value,
      id_nivel: Number(payload.id_nivel),
      id_tipo_grado: Number(payload.id_tipo_grado),
      id_jornada: Number(payload.id_jornada),
      id_seccion: Number(payload.id_seccion),
      cupos_totales: Number(payload.cupos_totales),
    })
    newGroup.value = {
      id_nivel: '',
      id_tipo_grado: '',
      id_jornada: '',
      id_seccion: '',
      cupos_totales: 30,
    }
    await loadData()
    closeCreateModal()
    activeView.value = 'records'
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear el curso')
  } finally {
    savingGroup.value = false
  }
}

const deleteGradeType = async (item: TipoGrado) => {
  try {
    deleting.value = true
    await axios.delete(`http://localhost:3000/api/academic-admin/grade-types/${item.id_tipo_grado}`, {
      params: { schoolId: schoolId.value },
    })
    closeDeleteModal()
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar el grado')
  } finally {
    deleting.value = false
  }
}

const deleteGroup = async (item: Grupo) => {
  try {
    deleting.value = true
    await axios.delete(`http://localhost:3000/api/academic-admin/groups/${item.id_grupo}`, {
      params: { schoolId: schoolId.value },
    })
    closeDeleteModal()
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar el curso')
  } finally {
    deleting.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-10">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-3xl font-black text-slate-900">Gestión de Grados</h1>
          <p class="mt-2 text-slate-500">Consulta rápida en vista compacta o administración completa en la vista CRUD.</p>
        </div>

        <div class="inline-flex rounded-2xl bg-slate-100 p-1.5">
          <button
            @click="activeView = 'records'"
            :class="[
              activeView === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              'rounded-xl px-4 py-2 text-sm font-black transition-all'
            ]"
          >
            Registros
          </button>
          <button
            @click="activeView = 'crud'"
            :class="[
              activeView === 'crud' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              'rounded-xl px-4 py-2 text-sm font-black transition-all'
            ]"
          >
            CRUD
          </button>
        </div>
      </div>

      <div class="mt-8 flex flex-col gap-4 md:flex-row">
          <button
          type="button"
          @click="openCreateModal('grade')"
          class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-base font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800"
        >
          <Plus class="h-5 w-5" />
          Crear grado
        </button>
          <button
          type="button"
          @click="openCreateModal('course')"
          class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-500"
        >
          <School2 class="h-5 w-5" />
          Crear curso
        </button>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 font-bold">
      Cargando estructura académica...
    </div>

    <template v-else-if="activeView === 'records'">
      <section class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="border-b border-slate-100 p-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 class="text-lg font-black text-slate-900">Búsqueda rápida</h2>
              <p class="text-sm text-slate-500">Elige si quieres consultar grados o cursos y filtra en una sola vista.</p>
            </div>
            <div class="flex w-full flex-col gap-3 md:flex-row lg:max-w-2xl">
              <select v-model="searchMode" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4.5 text-sm font-black text-slate-700 outline-none md:w-52">
                <option value="grade">Ver grados</option>
                <option value="course">Ver cursos</option>
              </select>
              <div class="relative flex-1">
                <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  v-model="searchTerm"
                  type="text"
                  :placeholder="searchMode === 'grade' ? 'Buscar grado o nivel' : 'Buscar curso, jornada o sección'"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4.5 pl-10 pr-4 text-sm font-semibold outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-if="searchMode === 'grade'" class="max-h-[620px] overflow-auto">
          <div class="flex items-center justify-between bg-amber-50 px-6 py-4">
            <div>
              <h3 class="text-sm font-black uppercase tracking-[0.2em] text-amber-700">Grados existentes</h3>
              <p class="text-sm font-semibold text-amber-900">{{ visibleGradeTypes.length }} resultados de {{ tiposGrado.length }}</p>
            </div>
            <button
              type="button"
              @click="openCreateModal('grade')"
              class="rounded-2xl bg-white px-5 py-3 text-sm font-black text-amber-700 shadow-sm transition-all hover:-translate-y-0.5"
            >
              Nuevo grado
            </button>
          </div>
          <table class="w-full text-left">
            <thead class="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-400">
              <tr>
                <th class="px-5 py-3">Grado</th>
                <th class="px-5 py-3">Nivel</th>
                <th class="px-5 py-3 text-center">Cursos</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              <tr v-for="item in visibleGradeTypes" :key="item.id_tipo_grado" class="hover:bg-slate-50/70">
                <td class="px-5 py-4 font-black text-slate-800">{{ item.nombre }}</td>
                <td class="px-5 py-4 font-semibold text-slate-500">{{ item.nivel_nombre }}</td>
                <td class="px-5 py-4 text-center">
                  <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{{ item.cursos_count }}</span>
                </td>
              </tr>
              <tr v-if="visibleGradeTypes.length === 0">
                <td colspan="3" class="px-5 py-10 text-center text-sm font-semibold text-slate-400">No se encontraron grados.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="max-h-[620px] overflow-auto">
          <div class="flex items-center justify-between bg-indigo-50 px-6 py-4">
            <div>
              <h3 class="text-sm font-black uppercase tracking-[0.2em] text-indigo-700">Cursos existentes</h3>
              <p class="text-sm font-semibold text-indigo-900">{{ visibleGroups.length }} resultados de {{ grupos.length }}</p>
            </div>
            <button
              type="button"
              @click="openCreateModal('course')"
              class="rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5"
            >
              Nuevo curso
            </button>
          </div>
          <table class="w-full text-left">
            <thead class="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-400">
              <tr>
                <th class="px-5 py-3">Curso</th>
                <th class="px-5 py-3">Cupos</th>
                <th class="px-5 py-3 text-center">Uso</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              <tr v-for="item in visibleGroups" :key="item.id_grupo" class="hover:bg-slate-50/70">
                <td class="px-5 py-4">
                  <p class="font-black text-slate-800">{{ item.tipo_grado_nombre }} {{ item.seccion_nombre }}</p>
                  <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">{{ item.nivel_nombre }} · {{ item.jornada_nombre }}</p>
                </td>
                <td class="px-5 py-4 font-black text-slate-700">{{ item.cupos_totales }}</td>
                <td class="px-5 py-4">
                  <div class="flex flex-wrap justify-center gap-1.5 text-[10px] font-black">
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{{ item.matriculas_count }} M</span>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{{ item.asignaciones_count }} A</span>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{{ item.competencias_count }} C</span>
                  </div>
                </td>
              </tr>
              <tr v-if="visibleGroups.length === 0">
                <td colspan="3" class="px-5 py-10 text-center text-sm font-semibold text-slate-400">No se encontraron cursos.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="mb-6 inline-flex rounded-2xl bg-slate-100 p-1.5">
        <button
          type="button"
          @click="crudMode = 'grade'"
          :class="[
            crudMode === 'grade' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
            'rounded-xl px-5 py-3 text-sm font-black transition-all'
          ]"
        >
          Formulario de grado
        </button>
        <button
          type="button"
          @click="crudMode = 'course'"
          :class="[
            crudMode === 'course' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
            'rounded-xl px-5 py-3 text-sm font-black transition-all'
          ]"
        >
          Formulario de curso
        </button>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section v-if="crudMode === 'grade'" class="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-9">
          <div class="mb-6 flex items-center gap-3">
            <div class="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <Layers3 class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900">Crear grado</h2>
              <p class="text-sm text-slate-500">Abre el formulario en modal para registrar el grado sin exponer campos en la vista.</p>
            </div>
          </div>

          <button type="button" @click="openCreateModal('grade')" class="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-base font-black text-white shadow-sm">
            <Plus class="h-4 w-4" />
            Abrir formulario de grado
          </button>

          <div class="mt-7 rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <h3 class="text-sm font-black text-slate-700">Eliminar grado</h3>
            <div class="mt-4 space-y-3">
              <button
                v-for="item in tiposGrado"
                :key="item.id_tipo_grado"
                @click="openDeleteGradeModal(item)"
                class="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-left hover:border-red-200 hover:bg-red-50 transition-all"
              >
                <div>
                  <p class="text-sm font-black text-slate-800">{{ item.nombre }}</p>
                  <p class="text-[11px] font-bold uppercase tracking-widest text-slate-400">{{ item.nivel_nombre }}</p>
                </div>
                <Trash2 class="h-4 w-4 text-red-500" />
              </button>
            </div>
          </div>
        </section>

        <section v-else class="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-9">
          <div class="mb-6 flex items-center gap-3">
            <div class="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <School2 class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900">Crear curso</h2>
              <p class="text-sm text-slate-500">Abre el formulario en modal para registrar el curso con jornada, grado, sección y cupos.</p>
            </div>
          </div>

          <button type="button" @click="openCreateModal('course')" class="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-black text-white shadow-sm">
            <Plus class="h-4 w-4" />
            Abrir formulario de curso
          </button>

          <div class="mt-7 rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <h3 class="text-sm font-black text-slate-700">Eliminar curso</h3>
            <div class="mt-4 space-y-3 max-h-64 overflow-auto pr-1">
              <button
                v-for="item in grupos"
                :key="item.id_grupo"
                @click="openDeleteCourseModal(item)"
                class="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-left hover:border-red-200 hover:bg-red-50 transition-all"
              >
                <div>
                  <p class="text-sm font-black text-slate-800">{{ item.tipo_grado_nombre }} {{ item.seccion_nombre }}</p>
                  <p class="text-[11px] font-bold uppercase tracking-widest text-slate-400">{{ item.nivel_nombre }} · {{ item.jornada_nombre }}</p>
                </div>
                <Trash2 class="h-4 w-4 text-red-500" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <div class="rounded-3xl border border-indigo-100 bg-indigo-50 p-7 text-sm font-semibold text-indigo-700">
        La vista CRUD concentra creación y eliminación. La vista de registros está optimizada para búsqueda rápida y revisión sin tanto scroll.
      </div>
    </template>

    <div v-if="createModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 backdrop-blur-md p-4">
      <div class="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 md:px-8">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Creación rápida</p>
            <h2 class="mt-1 text-2xl font-black text-slate-900">
              {{ createModal === 'grade' ? 'Nuevo grado' : 'Nuevo curso' }}
            </h2>
            <p class="mt-2 text-sm font-semibold text-slate-500">
              {{ createModal === 'grade' ? 'Define nivel académico y nombre base del grado.' : 'Completa jornada, grado, sección y cupos del curso.' }}
            </p>
          </div>
          <button type="button" @click="closeCreateModal" class="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 transition-all hover:bg-slate-200">
            Cerrar
          </button>
        </div>

        <div v-if="createModal === 'grade'" class="px-6 py-6 md:px-8 md:py-8">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nivel académico</span>
              <select v-model="newGradeType.id_nivel" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona un nivel</option>
                <option v-for="nivel in niveles" :key="nivel.id_nivel" :value="nivel.id_nivel">{{ nivel.nombre }}</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nombre del grado</span>
              <input v-model="newGradeType.nombre" type="text" placeholder="Ej. Sexto" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="closeCreateModal" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">
              Cancelar
            </button>
            <button type="button" @click="createGradeType" :disabled="savingGrade" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50">
              <Plus class="h-4 w-4" />
              {{ savingGrade ? 'Creando...' : 'Crear grado' }}
            </button>
          </div>
        </div>

        <div v-else class="px-6 py-6 md:px-8 md:py-8">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nivel académico</span>
              <select v-model="newGroup.id_nivel" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona un nivel</option>
                <option v-for="nivel in niveles" :key="nivel.id_nivel" :value="nivel.id_nivel">{{ nivel.nombre }}</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Tipo de grado</span>
              <select v-model="newGroup.id_tipo_grado" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona un grado</option>
                <option v-for="tipo in filteredGradeTypes" :key="tipo.id_tipo_grado" :value="tipo.id_tipo_grado">{{ tipo.nombre }}</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Jornada</span>
              <select v-model="newGroup.id_jornada" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona una jornada</option>
                <option v-for="jornada in jornadas" :key="jornada.id_jornada" :value="jornada.id_jornada">{{ jornada.nombre }}</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Sección / Letra</span>
              <select v-model="newGroup.id_seccion" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona una sección</option>
                <option v-for="seccion in secciones" :key="seccion.id_seccion" :value="seccion.id_seccion">{{ seccion.nombre }}</option>
              </select>
            </label>
            <label class="space-y-2 md:col-span-2">
              <span class="block text-sm font-black text-slate-700">Cupos</span>
              <input v-model.number="newGroup.cupos_totales" type="number" min="0" placeholder="Ej. 30" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="closeCreateModal" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">
              Cancelar
            </button>
            <button type="button" @click="createGroup" :disabled="savingGroup" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50">
              <Plus class="h-4 w-4" />
              {{ savingGroup ? 'Creando...' : 'Crear curso' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deleteModal" class="fixed inset-0 z-[110] flex min-h-screen w-screen items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div class="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-red-400">Eliminación sensible</p>
          <h2 class="mt-1 text-2xl font-black text-slate-900">
            {{ deleteModal.kind === 'grade' ? 'Eliminar grado' : 'Eliminar curso' }}
          </h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">
            Esta acción puede impactar la estructura académica del colegio y está bloqueada si existen relaciones activas.
          </p>
        </div>

        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="rounded-3xl border border-red-100 bg-red-50 p-5">
            <p class="text-sm font-black text-red-700">
              {{ deleteModal.kind === 'grade'
                ? `Vas a eliminar el grado ${deleteModal.item.nombre} del nivel ${deleteModal.item.nivel_nombre}.`
                : `Vas a eliminar el curso ${deleteModal.item.tipo_grado_nombre} ${deleteModal.item.seccion_nombre} de ${deleteModal.item.jornada_nombre}.` }}
            </p>
            <p class="mt-3 text-sm font-semibold text-red-700/90">
              Antes de continuar, verifica que no tenga matrículas, asignaciones docentes, competencias u otras relaciones académicas dependientes.
            </p>
          </div>

          <div class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            Si el registro tiene vínculos activos, el sistema rechazará la eliminación y mostrará el motivo.
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              @click="closeDeleteModal"
              :disabled="deleting"
              class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              v-if="deleteModal.kind === 'grade'"
              type="button"
              @click="deleteGradeType(deleteModal.item)"
              :disabled="deleting"
              class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-red-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
            >
              <Trash2 class="h-4 w-4" />
              {{ deleting ? 'Eliminando...' : 'Eliminar grado' }}
            </button>
            <button
              v-else
              type="button"
              @click="deleteGroup(deleteModal.item)"
              :disabled="deleting"
              class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-red-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
            >
              <Trash2 class="h-4 w-4" />
              {{ deleting ? 'Eliminando...' : 'Eliminar curso' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
