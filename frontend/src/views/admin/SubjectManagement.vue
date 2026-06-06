<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { BookOpen, Plus, Trash2, Search, Info, Layers, GraduationCap } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface SubjectItem {
  id_materia: number
  nombre: string
  asignaciones_count: number
  competencias_count: number
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const subjects = ref<SubjectItem[]>([])
const searchTerm = ref('')
const createModalOpen = ref(false)
const deleteModal = ref<SubjectItem | null>(null)

const newSubject = ref({
  nombre: ''
})

const filteredSubjects = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return subjects.value
  return subjects.value.filter(s => s.nombre.toLowerCase().includes(term))
})

const loadSubjects = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/subjects/${schoolId.value}`)
    subjects.value = response.data
  } catch (error) {
    console.error('Error loading subjects:', error)
  } finally {
    loading.value = false
  }
}

const createSubject = async () => {
  if (saving.value) return
  if (!newSubject.value.nombre.trim()) {
    alert('Escribe el nombre de la materia antes de crearla.')
    return
  }

  try {
    saving.value = true
    await axios.post('http://localhost:3000/api/academic-admin/subjects', {
      schoolId: schoolId.value,
      nombre: newSubject.value.nombre,
    })
    newSubject.value.nombre = ''
    createModalOpen.value = false
    await loadSubjects()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear la materia')
  } finally {
    saving.value = false
  }
}

const confirmDelete = async (item: SubjectItem) => {
  try {
    deleting.value = true
    await axios.delete(`http://localhost:3000/api/academic-admin/subjects/${item.id_materia}`, {
      params: { schoolId: schoolId.value },
    })
    deleteModal.value = null
    await loadSubjects()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar la materia')
  } finally {
    deleting.value = false
  }
}

onMounted(loadSubjects)
</script>

<template>
  <div class="max-w-[1200px] mx-auto space-y-6">
    <!-- Modern Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <BookOpen :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Gestión de Materias</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Administra el catálogo global de asignaturas institucionales.</p>
          </div>
        </div>
        
        <button @click="createModalOpen = true" class="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none whitespace-nowrap">
          <Plus :size="20" />
          Nueva Materia
        </button>
      </div>
    </div>

    <!-- Stats & Search Bar -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="md:col-span-3 relative">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="18" />
        <input 
          v-model="searchTerm" 
          type="text" 
          placeholder="Buscar materia por nombre..."
          class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold outline-none text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-emerald-500/10 transition-all"
        />
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400">
            <Layers :size="16" />
          </div>
          <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Total</span>
        </div>
        <span class="text-xl font-black text-slate-900 dark:text-white">{{ subjects.length }}</span>
      </div>
    </div>

    <!-- Subjects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-if="loading" class="col-span-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center text-slate-400 font-bold">
        Cargando catálogo...
      </div>
      
      <template v-else>
        <div v-if="filteredSubjects.length === 0" class="col-span-full h-64 flex flex-col items-center justify-center text-slate-400">
          <Search :size="48" class="mb-4 opacity-20" />
          <p class="font-bold">No se encontraron materias</p>
        </div>

        <div 
          v-for="item in filteredSubjects" 
          :key="item.id_materia"
          class="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900 transition-all flex flex-col justify-between"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center rounded-xl font-black text-sm">
                {{ item.nombre.charAt(0).toUpperCase() }}
              </div>
              <h4 class="font-black text-slate-800 dark:text-white text-lg truncate max-w-[150px]">{{ item.nombre }}</h4>
            </div>
            <button @click="deleteModal = item" class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all">
              <Trash2 :size="18" />
            </button>
          </div>

          <div class="flex items-center gap-4 mt-2">
            <div class="flex-1 flex flex-col">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Asignaciones</span>
              <div class="flex items-center gap-1.5 mt-1">
                <GraduationCap :size="14" class="text-indigo-400" />
                <span class="text-sm font-black text-slate-700 dark:text-slate-300">{{ item.asignaciones_count }}</span>
              </div>
            </div>
            <div class="flex-1 flex flex-col border-l border-slate-50 dark:border-slate-800 pl-4">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Competencias</span>
              <div class="flex items-center gap-1.5 mt-1">
                <Info :size="14" class="text-amber-400" />
                <span class="text-sm font-black text-slate-700 dark:text-slate-300">{{ item.competencias_count }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Info Banner -->
    <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-3xl flex items-start gap-4 border border-emerald-100/50 dark:border-emerald-900/50">
      <div class="p-2 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-xl">
        <Info :size="20" />
      </div>
      <p class="text-emerald-700/80 dark:text-emerald-400/80 text-sm font-medium leading-relaxed">
        Las materias creadas aquí forman el catálogo global de la escuela. Luego podrás asignarlas a diferentes cursos y docentes desde el módulo de "Docentes" o "Mis Cursos".
      </p>
    </div>

    <!-- Modals (Teleported) -->
    <Teleport to="body">
      <!-- Create Modal -->
      <div v-if="createModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="createModalOpen = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
          <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Plus :size="24" class="text-emerald-600" />
              Nueva Materia
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Define el nombre de la asignatura para el catálogo.</p>
          </div>

          <div class="p-8 space-y-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nombre de la Materia</label>
                <input 
                  v-model="newSubject.nombre" 
                  type="text" 
                  placeholder="Ej. Física Teórica" 
                  class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400" 
                />
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="createModalOpen = false" class="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button @click="createSubject" :disabled="saving" class="flex-[2] bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50">
                {{ saving ? 'Registrando...' : 'Confirmar Registro' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Modal -->
      <div v-if="deleteModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="deleteModal = null"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
          <div class="p-8 text-center">
            <div class="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 :size="32" />
            </div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">¿Eliminar esta materia?</h2>
            <p class="text-slate-500 dark:text-slate-400 font-medium mt-3 leading-relaxed">
              Vas a eliminar <span class="font-black text-slate-800 dark:text-white">{{ deleteModal.nombre }}</span>. 
              Esta acción puede fallar si existen asignaciones docentes o registros activos vinculados.
            </p>
            <div v-if="deleteModal.asignaciones_count > 0 || deleteModal.competencias_count > 0" class="mt-4 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-bold ring-1 ring-amber-100 dark:ring-amber-900">
              Advertencia: Tiene {{ deleteModal.asignaciones_count }} asignaciones y {{ deleteModal.competencias_count }} competencias activas.
            </div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-3">
            <button @click="deleteModal = null" class="flex-1 px-6 py-3 rounded-xl font-black text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button 
              @click="confirmDelete(deleteModal)"
              :disabled="deleting"
              class="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-600 transition-all disabled:opacity-50"
            >
              {{ deleting ? 'Eliminando...' : 'Sí, Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
