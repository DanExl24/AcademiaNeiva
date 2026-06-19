<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { ArrowLeft, BookOpenCheck, PenSquare, Plus, Search, Sparkles, Check, Trash2, X } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

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
  evidencias: {
    id_evidencia: number
    descripcion: string
    orden: number
  }[]
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const saving = ref(false)
const competencyModal = ref(false)

const periods = ref<AcademicPeriod[]>([])
const assignments = ref<AssignmentOption[]>([])
const competencies = ref<CompetencyItem[]>([])

const search = ref('')
const selectedPeriod = ref('')
const selectedGrade = ref('')
const selectedSubject = ref('')
const selectedStatus = ref('')

const competencyForm = ref({
  id_periodo: '',
  gradeKey: '',
  subjectKey: '',
  descripcion: '',
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
    label: `${item.tipo_grado_nombre} ${item.seccion_nombre} · ${item.jornada_nombre} · ${item.materia_nombre}`,
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
      item.jornada_nombre.toLowerCase().includes(term) ||
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
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`)
    periods.value = response.data.periods
    assignments.value = response.data.assignments
    competencies.value = response.data.competencies
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
  }
}

const openCreateModal = () => {
  resetForm()
  competencyModal.value = true
}

const openEditModal = (item: CompetencyItem) => {
  competencyForm.value = {
    id_periodo: String(item.id_periodo),
    gradeKey: `${item.nivel_nombre}:${item.tipo_grado_nombre}`,
    subjectKey: String(item.id_materia),
    descripcion: item.descripcion,
  }
  competencyModal.value = true
}

const saveCompetency = async () => {
  if (!competencyForm.value.id_periodo || !competencyForm.value.gradeKey || !competencyForm.value.subjectKey || !competencyForm.value.descripcion.trim()) {
    alert('Selecciona grado, materia, periodo y escribe la competencia.')
    return
  }

  const targets = assignmentChoices.value.filter((item) => {
    if (item.gradeKey !== competencyForm.value.gradeKey) return false
    if (item.subjectKey !== competencyForm.value.subjectKey) return false
    return true
  })

  if (!targets.length) {
    alert('No hay cursos disponibles para esa materia dentro del grado seleccionado.')
    return
  }

  try {
    saving.value = true
    const assignment = targets[0]
    await axios.post('http://localhost:3000/api/academic-admin/settings/competencies', {
      schoolId: schoolId.value,
      id_grupo: assignment.id_grupo,
      id_materia: assignment.id_materia,
      id_periodo: Number(competencyForm.value.id_periodo),
      descripcion: competencyForm.value.descripcion.trim(),
    })
    competencyModal.value = false
    resetForm()
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible guardar la competencia')
  } finally {
    saving.value = false
  }
}

const handleGradeFilterChange = () => {
  selectedSubject.value = ''
}

const handleFormGradeChange = () => {
  competencyForm.value.subjectKey = ''
}

const newEvidencia = ref<Record<number, string>>({})
const editingEvidencia = ref<number | null>(null)
const editEvidenciaText = ref('')

const addEvidencia = async (competencia: CompetencyItem) => {
  const desc = newEvidencia.value[competencia.id_competencia]?.trim()
  if (!desc) return

  try {
    saving.value = true
    const response = await axios.post(`http://localhost:3000/api/academic-admin/settings/competencies/${competencia.id_competencia}/evidencias`, {
      schoolId: schoolId.value,
      descripcion: desc
    })
    if (!competencia.evidencias) competencia.evidencias = []
    competencia.evidencias.push(response.data)
    newEvidencia.value[competencia.id_competencia] = ''
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al agregar evidencia')
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
    await axios.put(`http://localhost:3000/api/academic-admin/settings/evidencias/${evidencia.id_evidencia}`, {
      schoolId: schoolId.value,
      descripcion: desc
    })
    evidencia.descripcion = desc
    editingEvidencia.value = null
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al actualizar evidencia')
  } finally {
    saving.value = false
  }
}

const removeEvidencia = async (competencia: CompetencyItem, evidenciaId: number) => {
  if (!confirm('¿Eliminar esta evidencia?')) return

  try {
    saving.value = true
    await axios.delete(`http://localhost:3000/api/academic-admin/settings/evidencias/${evidenciaId}`, {
      params: { schoolId: schoolId.value }
    })
    competencia.evidencias = competencia.evidencias.filter((e: any) => e.id_evidencia !== evidenciaId)
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al eliminar evidencia')
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
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
          <div class="grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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

        <div v-if="filteredCompetencies.length === 0" class="p-12 text-center">
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

              <button
                type="button"
                @click="openEditModal(item)"
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 uppercase tracking-widest"
              >
                <PenSquare class="h-4 w-4" />
                Editar
              </button>
            </div>

            <div class="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 shadow-inner">
              <p class="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-300 italic">"{{ item.descripcion }}"</p>

              <div v-if="item.estado === 'DEFINIDA'" class="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
                <h4 class="text-xs font-black text-slate-900 dark:text-white mb-5 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles class="h-3.5 w-3.5 text-emerald-500" />
                  Evidencias de aprendizaje
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
                      <span class="text-sm font-semibold text-slate-700 dark:text-slate-400">{{ ev.descripcion }}</span>
                      <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button @click="startEditEvidencia(ev)" class="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"><PenSquare class="h-4 w-4" /></button>
                        <button @click="removeEvidencia(item, ev.id_evidencia)" class="text-slate-400 hover:text-red-500"><Trash2 class="h-4 w-4" /></button>
                      </div>
                    </div>
                  </li>
                </ul>
                <div v-else class="text-sm text-slate-500 dark:text-slate-600 italic mb-6">No hay evidencias definidas para esta competencia.</div>
                
                <div class="flex gap-3">
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
                <select v-model="competencyForm.id_periodo" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="">Selecciona un periodo</option>
                  <option v-for="period in periods" :key="period.id_periodo" :value="String(period.id_periodo)">{{ period.nombre }}</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Materia / Asignatura</span>
                <select v-model="competencyForm.subjectKey" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="">Selecciona una materia</option>
                  <option v-for="item in formSubjectChoices" :key="item.key" :value="item.key">
                    {{ item.label }}
                  </option>
                </select>
              </label>
              <label class="space-y-2 md:col-span-2">
                <span class="block text-xs font-black text-slate-700 dark:text-slate-300 ml-1 uppercase tracking-widest">Descripción pedagógica</span>
                <textarea v-model="competencyForm.descripcion" rows="4" placeholder="Indica el aprendizaje esperado..." class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
              </label>
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
  </div>
</template>
