<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { Layers3, Plus, Search, School2, Trash2, Info } from 'lucide-vue-next'
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
const searchMode = ref<'grade' | 'course'>('grade')
const searchTerm = ref('')
const createModal = ref<null | 'grade' | 'course'>(null)
const deleting = ref(false)
const selectedGradeId = ref<number | null>(null)

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
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return tiposGrado.value

  return tiposGrado.value.filter((item) =>
    item.nombre.toLowerCase().includes(term) ||
    item.nivel_nombre.toLowerCase().includes(term)
  )
})

const visibleGroups = computed(() => {
  let list = grupos.value

  // Filter by selected grade if any
  if (selectedGradeId.value) {
    list = list.filter(item => item.id_tipo_grado === selectedGradeId.value)
  }

  // Filter by search term
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return list

  return list.filter((item) =>
    item.tipo_grado_nombre.toLowerCase().includes(term) ||
    item.nivel_nombre.toLowerCase().includes(term) ||
    item.jornada_nombre.toLowerCase().includes(term) ||
    item.seccion_nombre.toLowerCase().includes(term)
  )
})

const toggleGradeSelection = (id: number) => {
  if (selectedGradeId.value === id) {
    selectedGradeId.value = null
  } else {
    selectedGradeId.value = id
  }
}

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
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Clean Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Layers3 :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Estructura Académica</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Gestión integral de niveles, grados y cursos institucionales.</p>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          <button @click="openCreateModal('grade')" class="flex items-center gap-2 px-5 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg shadow-slate-200 dark:shadow-none">
            <Plus :size="18" />
            Nuevo Grado
          </button>
          <button @click="openCreateModal('course')" class="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">
            <School2 :size="18" />
            Nuevo Curso
          </button>
        </div>
      </div>
    </div>

    <!-- Unified Dashboard -->
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      
      <!-- Left Panel: Grades (Compact List) -->
      <div class="xl:col-span-5 space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <h3 class="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Layers3 :size="16" />
              Grados Base
            </h3>
            <span class="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              {{ tiposGrado.length }} Registrados
            </span>
          </div>

          <div class="p-4 border-b border-slate-100 dark:border-slate-800">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
              <input 
                v-model="searchTerm" 
                v-if="searchMode === 'grade'"
                type="text" 
                placeholder="Buscar por nombre o nivel..."
                class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-3 pl-10 pr-4 text-sm font-medium outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div v-if="visibleGradeTypes.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 p-8">
              <Search :size="48" class="mb-4 opacity-20" />
              <p class="font-bold">No se encontraron grados</p>
            </div>
            
            <div class="grid gap-3">
              <div 
                v-for="item in visibleGradeTypes" 
                :key="item.id_tipo_grado"
                @click="toggleGradeSelection(item.id_tipo_grado)"
                :class="[
                  selectedGradeId === item.id_tipo_grado 
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/30' 
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900',
                  'group p-4 rounded-2xl flex items-center justify-between hover:border-indigo-200 dark:hover:border-indigo-900 hover:shadow-md hover:shadow-indigo-50/50 dark:hover:shadow-none transition-all cursor-pointer border'
                ]"
              >
                <div>
                  <h4 class="font-black text-slate-800 dark:text-white text-base truncate">{{ item.nombre }}</h4>
                  <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{{ item.nivel_nombre }}</p>
                </div>
                
                <div class="flex items-center gap-3">
                  <div class="text-right mr-2">
                    <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Cursos</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-sm">{{ item.cursos_count }}</p>
                  </div>
                  <button 
                    @click="openDeleteGradeModal(item)"
                    class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                    title="Eliminar Grado"
                  >
                    <Trash2 :size="18" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Courses (Interactive Grid) -->
      <div class="xl:col-span-7 space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-black text-slate-900 dark:text-white">
                {{ selectedGradeId ? 'Cursos del Grado' : 'Cursos & Secciones' }}
              </h3>
              <div v-if="selectedGradeId" class="flex items-center gap-2">
                <span class="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">Filtro Activo</span>
                <button @click="selectedGradeId = null" class="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase underline">Limpiar</button>
              </div>
            </div>
            <div class="relative w-64">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="14" />
              <input 
                v-model="searchTerm" 
                type="text" 
                placeholder="Filtrar cursos..."
                class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2.5 pl-9 pr-4 text-xs font-medium outline-none text-slate-900 dark:text-white shadow-inner"
              />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/10 custom-scrollbar">
            <div v-if="grupos.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400">
              <School2 :size="64" class="mb-4 opacity-20" />
              <p class="font-bold">No hay cursos configurados</p>
              <button @click="openCreateModal('course')" class="mt-4 text-indigo-600 font-bold text-sm hover:underline">Comenzar a crear cursos</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                v-for="item in visibleGroups" 
                :key="item.id_grupo"
                class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all border-l-4"
                :class="item.jornada_nombre === 'MAÑANA' ? 'border-l-amber-400' : item.jornada_nombre === 'TARDE' ? 'border-l-indigo-400' : 'border-l-emerald-400'"
              >
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <h4 class="font-black text-slate-900 dark:text-white text-lg leading-tight">{{ item.tipo_grado_nombre }} {{ item.seccion_nombre }}</h4>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{{ item.jornada_nombre }} | {{ item.nivel_nombre }}</p>
                  </div>
                  <button @click="openDeleteCourseModal(item)" class="p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 :size="16" />
                  </button>
                </div>

                <div class="grid grid-cols-3 gap-2 py-3 border-y border-slate-50 dark:border-slate-800 mb-4">
                  <div class="text-center">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Estudiantes</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-sm">{{ item.matriculas_count }}</p>
                  </div>
                  <div class="text-center border-x border-slate-50 dark:border-slate-800">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Materias</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-sm">{{ item.asignaciones_count }}</p>
                  </div>
                  <div class="text-center">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Logros</p>
                    <p class="font-black text-slate-800 dark:text-slate-300 text-sm">{{ item.competencias_count }}</p>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        class="h-full bg-indigo-500" 
                        :style="`width: ${(item.matriculas_count / item.cupos_totales) * 100}%`"
                      ></div>
                    </div>
                    <span class="text-[10px] font-black text-slate-400">{{ Math.round((item.matriculas_count / item.cupos_totales) * 100) }}% ocupado</span>
                  </div>
                  <div class="text-[10px] font-black bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-500">
                    {{ item.cupos_totales }} CUPOS
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals (Remained roughly same but with better styling) -->
    <Teleport to="body">
      <div v-if="createModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="closeCreateModal"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-indigo-500/10 overflow-hidden border border-white/20">
          <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Plus :size="24" class="text-indigo-600" />
              {{ createModal === 'grade' ? 'Configurar Nuevo Grado' : 'Configurar Nuevo Curso' }}
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Completa la información necesaria para el registro.</p>
          </div>

          <div v-if="createModal === 'grade'" class="p-8 space-y-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nivel Académico</label>
                <select v-model="newGradeType.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white transition-all appearance-none cursor-pointer">
                  <option value="">Selecciona un nivel</option>
                  <option v-for="nivel in niveles" :key="nivel.id_nivel" :value="nivel.id_nivel">{{ nivel.nombre }}</option>
                </select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nombre Descriptivo</label>
                <input v-model="newGradeType.nombre" type="text" placeholder="Ej. Grado Sexto" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white placeholder:text-slate-400" />
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="closeCreateModal" class="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button @click="createGradeType" :disabled="savingGrade" class="flex-[2] bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50">
                {{ savingGrade ? 'Registrando...' : 'Confirmar Registro' }}
              </button>
            </div>
          </div>

          <div v-else class="p-8 space-y-5">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2 space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nivel Académico</label>
                <select v-model="newGroup.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20">
                  <option value="">Seleccionar Nivel</option>
                  <option v-for="nivel in niveles" :key="nivel.id_nivel" :value="nivel.id_nivel">{{ nivel.nombre }}</option>
                </select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Grado Relacionado</label>
                <select v-model="newGroup.id_tipo_grado" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20">
                  <option value="">Seleccionar Grado</option>
                  <option v-for="tipo in filteredGradeTypes" :key="tipo.id_tipo_grado" :value="tipo.id_tipo_grado">{{ tipo.nombre }}</option>
                </select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Jornada</label>
                <select v-model="newGroup.id_jornada" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20">
                  <option value="">Seleccionar Jornada</option>
                  <option v-for="jornada in jornadas" :key="jornada.id_jornada" :value="jornada.id_jornada">{{ jornada.nombre }}</option>
                </select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Sección</label>
                <select v-model="newGroup.id_seccion" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20">
                  <option value="">Seleccionar Sección</option>
                  <option v-for="seccion in secciones" :key="seccion.id_seccion" :value="seccion.id_seccion">{{ seccion.nombre }}</option>
                </select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Capacidad (Cupos)</label>
                <input v-model.number="newGroup.cupos_totales" type="number" min="0" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20" />
              </div>
            </div>

            <div class="flex gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
              <button @click="closeCreateModal" class="flex-1 px-4 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
              <button @click="createGroup" :disabled="savingGroup" class="flex-[2] bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-none hover:translate-y-[-2px] transition-all disabled:opacity-50">
                {{ savingGroup ? 'Creando...' : 'Registrar Curso' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="deleteModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="closeDeleteModal"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
          <div class="p-8 text-center">
            <div class="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 :size="32" />
            </div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">¿Confirmas la eliminación?</h2>
            <p class="text-slate-500 dark:text-slate-400 font-medium mt-3 leading-relaxed">
              Estás a punto de eliminar 
              <span class="font-black text-slate-800 dark:text-slate-200">
                {{ deleteModal.kind === 'grade' ? deleteModal.item.nombre : `${deleteModal.item.tipo_grado_nombre} ${deleteModal.item.seccion_nombre}` }}
              </span>. 
              Esta acción no se puede deshacer si el registro tiene dependencias.
            </p>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-3">
            <button @click="closeDeleteModal" class="flex-1 px-6 py-3 rounded-xl font-black text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button 
              @click="deleteModal.kind === 'grade' ? deleteGradeType(deleteModal.item) : deleteGroup(deleteModal.item)"
              :disabled="deleting"
              class="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-600 transition-all disabled:opacity-50"
            >
              {{ deleting ? 'Eliminando...' : 'Sí, Eliminar' }}
            </button>
          </div>
        </div>
      </div>
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
