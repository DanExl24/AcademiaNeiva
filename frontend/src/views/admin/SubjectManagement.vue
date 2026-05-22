<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { BookOpen, Plus, Trash2 } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface SubjectItem {
  id_materia: number
  nombre: string
  asignaciones_count: number
  competencias_count: number
}

const auth = useAuthStore()
const schoolId = Number(auth.user?.schoolId || 0)

const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const subjects = ref<SubjectItem[]>([])
const newSubjectName = ref('')
const createModalOpen = ref(false)
const deleteModal = ref<SubjectItem | null>(null)

const loadSubjects = async () => {
  if (!schoolId) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/subjects/${schoolId}`)
    subjects.value = response.data
  } catch (error) {
    console.error('Error loading subjects:', error)
  } finally {
    loading.value = false
  }
}

const createSubject = async () => {
  if (saving.value) return
  if (!newSubjectName.value.trim()) {
    alert('Escribe el nombre de la materia antes de crearla.')
    return
  }

  try {
    saving.value = true
    await axios.post('http://localhost:3000/api/academic-admin/subjects', {
      schoolId,
      nombre: newSubjectName.value,
    })
    newSubjectName.value = ''
    createModalOpen.value = false
    await loadSubjects()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear la materia')
  } finally {
    saving.value = false
  }
}

const deleteSubject = async (item: SubjectItem) => {
  try {
    deleting.value = true
    await axios.delete(`http://localhost:3000/api/academic-admin/subjects/${item.id_materia}`, {
      params: { schoolId },
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
  <div class="space-y-8">
    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-3xl font-black text-slate-900">Gestión de Materias</h1>
          <p class="mt-2 text-slate-500">Crea y administra el catálogo global de materias del colegio.</p>
        </div>
        <button
          type="button"
          @click="createModalOpen = true"
          class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-500"
        >
          <Plus class="w-5 h-5" />
          Crear materia
        </button>
      </div>
    </div>

    <section class="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
      <div class="flex items-center gap-3">
        <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
          <BookOpen class="w-6 h-6" />
        </div>
        <div>
          <h2 class="text-xl font-black text-slate-900">Crear materia</h2>
          <p class="text-sm text-slate-500">Abre el formulario en modal para registrar nuevas materias sin exponer campos en la vista.</p>
        </div>
      </div>
    </section>

    <section class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div class="border-b border-slate-100 p-6">
        <h2 class="text-xl font-black text-slate-900">Materias del colegio</h2>
      </div>

      <div v-if="loading" class="p-16 text-center text-slate-400 font-bold">
        Cargando materias...
      </div>

      <div v-else-if="subjects.length === 0" class="p-16 text-center text-slate-400 font-bold">
        Aún no hay materias registradas.
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="item in subjects" :key="item.id_materia" class="flex items-center justify-between gap-4 p-6">
          <div>
            <p class="text-sm font-black text-slate-900">{{ item.nombre }}</p>
            <div class="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span class="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{{ item.asignaciones_count }} asignaciones</span>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{{ item.competencias_count }} competencias</span>
            </div>
          </div>
          <button @click="deleteModal = item" class="rounded-2xl bg-red-50 p-3 text-red-500 hover:bg-red-100 transition-colors">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>

    <div class="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-sm font-semibold text-emerald-700">
      Si una materia ya está asociada a asignaciones docentes o competencias, el sistema bloquea su eliminación y muestra el motivo.
    </div>

    <div v-if="createModalOpen" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 backdrop-blur-md p-4">
      <div class="w-full max-w-xl rounded-[28px] bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 md:px-8">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Creación rápida</p>
            <h2 class="mt-1 text-2xl font-black text-slate-900">Nueva materia</h2>
            <p class="mt-2 text-sm font-semibold text-slate-500">
              Registra una materia nueva. El sistema evita duplicados dentro del mismo colegio.
            </p>
          </div>
          <button type="button" @click="createModalOpen = false" class="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 transition-all hover:bg-slate-200">
            Cerrar
          </button>
        </div>

        <div class="px-6 py-6 md:px-8 md:py-8">
          <label class="space-y-2">
            <span class="block text-sm font-black text-slate-700">Nombre de la materia</span>
            <input
              v-model="newSubjectName"
              type="text"
              placeholder="Ej. Matemáticas"
              class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none"
            />
          </label>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="createModalOpen = false" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">
              Cancelar
            </button>
            <button
              type="button"
              @click="createSubject"
              :disabled="saving"
              class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
            >
              <Plus class="w-4 h-4" />
              {{ saving ? 'Creando...' : 'Crear materia' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deleteModal" class="fixed inset-0 z-[110] flex min-h-screen w-screen items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div class="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-red-400">Eliminación sensible</p>
          <h2 class="mt-1 text-2xl font-black text-slate-900">Eliminar materia</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">
            Esta acción puede afectar asignaciones docentes, competencias y otras relaciones académicas activas.
          </p>
        </div>

        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="rounded-3xl border border-red-100 bg-red-50 p-5">
            <p class="text-sm font-black text-red-700">
              Vas a eliminar la materia {{ deleteModal.nombre }}.
            </p>
            <p class="mt-3 text-sm font-semibold text-red-700/90">
              Revisa primero si esta materia tiene asignaciones docentes o competencias asociadas. Si existen, el sistema bloqueará la eliminación.
            </p>
          </div>

          <div class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            Relaciones detectadas actualmente: {{ deleteModal.asignaciones_count }} asignaciones y {{ deleteModal.competencias_count }} competencias.
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              @click="deleteModal = null"
              :disabled="deleting"
              class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="deleteSubject(deleteModal)"
              :disabled="deleting"
              class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-red-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50"
            >
              <Trash2 class="w-4 h-4" />
              {{ deleting ? 'Eliminando...' : 'Eliminar materia' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
