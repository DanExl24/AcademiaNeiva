<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { ArrowLeft, BookOpenCheck, PenSquare, Plus, Search, Sparkles } from 'lucide-vue-next'
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
  materia_nombre: string
  periodo_nombre: string
  nivel_nombre: string
  tipo_grado_nombre: string
  seccion_nombre: string
  jornada_nombre: string
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
const selectedCourse = ref('')
const selectedSubject = ref('')

const competencyForm = ref({
  id_periodo: '',
  gradeKey: '',
  courseKey: '',
  subjectKey: '',
  applyToWholeGrade: false,
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

const courseChoices = computed(() => {
  const map = new Map<string, { key: string; gradeKey: string; label: string }>()

  for (const item of assignmentChoices.value) {
    if (selectedGrade.value && item.gradeKey !== selectedGrade.value) continue

    if (!map.has(item.courseKey)) {
      map.set(item.courseKey, {
        key: item.courseKey,
        gradeKey: item.gradeKey,
        label: `${item.tipo_grado_nombre} ${item.seccion_nombre} · ${item.jornada_nombre}`,
      })
    }
  }

  return Array.from(map.values())
})

const subjectChoices = computed(() => {
  const map = new Map<string, { key: string; label: string }>()

  for (const item of assignmentChoices.value) {
    if (selectedGrade.value && item.gradeKey !== selectedGrade.value) continue
    if (selectedCourse.value && item.courseKey !== selectedCourse.value) continue

    if (!map.has(item.subjectKey)) {
      map.set(item.subjectKey, {
        key: item.subjectKey,
        label: item.materia_nombre,
      })
    }
  }

  return Array.from(map.values())
})

const formCourseChoices = computed(() => {
  const map = new Map<string, { key: string; label: string }>()

  for (const item of assignmentChoices.value) {
    if (competencyForm.value.gradeKey && item.gradeKey !== competencyForm.value.gradeKey) continue

    if (!map.has(item.courseKey)) {
      map.set(item.courseKey, {
        key: item.courseKey,
        label: `${item.tipo_grado_nombre} ${item.seccion_nombre} · ${item.jornada_nombre}`,
      })
    }
  }

  return Array.from(map.values())
})

const formSubjectChoices = computed(() => {
  const map = new Map<string, { key: string; label: string }>()

  for (const item of assignmentChoices.value) {
    if (competencyForm.value.gradeKey && item.gradeKey !== competencyForm.value.gradeKey) continue
    if (competencyForm.value.courseKey && item.courseKey !== competencyForm.value.courseKey) continue

    if (!map.has(item.subjectKey)) {
      map.set(item.subjectKey, {
        key: item.subjectKey,
        label: item.materia_nombre,
      })
    }
  }

  return Array.from(map.values())
})

const bulkTargetCount = computed(() => {
  if (!competencyForm.value.gradeKey || !competencyForm.value.subjectKey) return 0

  return assignmentChoices.value.filter(
    (item) =>
      item.gradeKey === competencyForm.value.gradeKey &&
      item.subjectKey === competencyForm.value.subjectKey
  ).length
})

const filteredCompetencies = computed(() => {
  const term = search.value.trim().toLowerCase()

  return competencies.value.filter((item) => {
    const gradeKey = `${item.nivel_nombre}:${item.tipo_grado_nombre}`
    const courseKey = String(item.id_grupo)
    const subjectKey = String(item.id_materia)
    const matchesPeriod = !selectedPeriod.value || String(item.id_periodo) === selectedPeriod.value
    const matchesGrade = !selectedGrade.value || gradeKey === selectedGrade.value
    const matchesCourse = !selectedCourse.value || courseKey === selectedCourse.value
    const matchesSubject = !selectedSubject.value || subjectKey === selectedSubject.value
    const matchesSearch =
      !term ||
      item.materia_nombre.toLowerCase().includes(term) ||
      item.descripcion.toLowerCase().includes(term) ||
      item.tipo_grado_nombre.toLowerCase().includes(term) ||
      item.seccion_nombre.toLowerCase().includes(term) ||
      item.jornada_nombre.toLowerCase().includes(term) ||
      item.periodo_nombre.toLowerCase().includes(term)

    return matchesPeriod && matchesGrade && matchesCourse && matchesSubject && matchesSearch
  })
})

const competencyStats = computed(() => {
  const uniqueSubjects = new Set(competencies.value.map((item) => item.id_materia)).size
  const uniqueContexts = new Set(competencies.value.map((item) => `${item.id_grupo}:${item.id_materia}:${item.id_periodo}`)).size

  return {
    total: competencies.value.length,
    subjects: uniqueSubjects,
    contexts: uniqueContexts,
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
    courseKey: '',
    subjectKey: '',
    applyToWholeGrade: false,
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
    courseKey: String(item.id_grupo),
    subjectKey: String(item.id_materia),
    applyToWholeGrade: false,
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
    if (competencyForm.value.applyToWholeGrade) return true
    return item.courseKey === competencyForm.value.courseKey
  })

  if (!targets.length) {
    alert(
      competencyForm.value.applyToWholeGrade
        ? 'No hay cursos disponibles para esa materia dentro del grado seleccionado.'
        : 'Selecciona un curso válido para asignar la competencia.'
    )
    return
  }

  try {
    saving.value = true
    await Promise.all(
      targets.map((assignment) =>
        axios.post('http://localhost:3000/api/academic-admin/settings/competencies', {
          schoolId: schoolId.value,
          id_grupo: assignment.id_grupo,
          id_materia: assignment.id_materia,
          id_periodo: Number(competencyForm.value.id_periodo),
          descripcion: competencyForm.value.descripcion.trim(),
        })
      )
    )
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
  selectedCourse.value = ''
  selectedSubject.value = ''
}

const handleCourseFilterChange = () => {
  selectedSubject.value = ''
}

const handleFormGradeChange = () => {
  competencyForm.value.courseKey = ''
  competencyForm.value.subjectKey = ''
  competencyForm.value.applyToWholeGrade = false
}

const handleFormCourseChange = () => {
  competencyForm.value.subjectKey = ''
}

const handleFormScopeChange = () => {
  if (competencyForm.value.applyToWholeGrade) {
    competencyForm.value.courseKey = ''
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-8">
    <div class="overflow-hidden rounded-[32px] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_42%),linear-gradient(135deg,#081c15_0%,#0f3d2e_52%,#14532d_100%)] p-8 text-white shadow-sm md:p-10">
      <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div class="max-w-3xl">
          <router-link
            to="/dashboard/configuracion-academica"
            class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white/90 transition hover:bg-white/15"
          >
            <ArrowLeft class="h-4 w-4" />
            Volver a configuración académica
          </router-link>
          <h1 class="mt-5 text-3xl font-black tracking-tight md:text-4xl">Gestión de competencias por materia</h1>
          <p class="mt-3 max-w-2xl text-sm font-semibold text-emerald-50/90 md:text-base">
            Esta vista concentra la definición académica más sensible del directivo: la competencia base por curso, materia y periodo.
          </p>
        </div>

        <button
          type="button"
          @click="openCreateModal"
          class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black text-emerald-700 shadow-lg shadow-black/10 transition hover:bg-emerald-50"
        >
          <Plus class="h-4 w-4" />
          Asignar competencia
        </button>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-sm font-bold text-emerald-50/80">Competencias registradas</p>
          <p class="mt-3 text-3xl font-black">{{ competencyStats.total }}</p>
        </div>
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-sm font-bold text-emerald-50/80">Materias con competencia</p>
          <p class="mt-3 text-3xl font-black">{{ competencyStats.subjects }}</p>
        </div>
        <div class="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p class="text-sm font-bold text-emerald-50/80">Contextos configurados</p>
          <p class="mt-3 text-3xl font-black">{{ competencyStats.contexts }}</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm">
      Cargando competencias académicas...
    </div>

    <template v-else>
      <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
        <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 class="text-xl font-black text-slate-900">Explorar asignaciones</h2>
            <p class="mt-2 text-sm font-semibold text-slate-500">Filtra por periodo, contexto o palabras clave para revisar y actualizar competencias.</p>
          </div>
          <div class="grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label class="space-y-2">
              <span class="text-sm font-black text-slate-700">Buscar</span>
              <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search class="h-4 w-4 text-slate-400" />
                <input v-model="search" type="text" placeholder="Materia, periodo o descripción" class="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none" />
              </div>
            </label>
            <label class="space-y-2">
              <span class="text-sm font-black text-slate-700">Grado</span>
              <select v-model="selectedGrade" @change="handleGradeFilterChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none">
                <option value="">Todos los grados</option>
                <option v-for="item in gradeChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-sm font-black text-slate-700">Curso</span>
              <select v-model="selectedCourse" @change="handleCourseFilterChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none">
                <option value="">Todos los cursos</option>
                <option v-for="item in courseChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-sm font-black text-slate-700">Materia</span>
              <select v-model="selectedSubject" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none">
                <option value="">Todas las materias</option>
                <option v-for="item in subjectChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-sm font-black text-slate-700">Periodo</span>
              <select v-model="selectedPeriod" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none">
                <option value="">Todos los periodos</option>
                <option v-for="period in periods" :key="period.id_periodo" :value="String(period.id_periodo)">
                  {{ period.nombre }}
                </option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div class="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-3">
            <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <BookOpenCheck class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900">Competencias configuradas</h2>
              <p class="text-sm font-semibold text-slate-500">{{ filteredCompetencies.length }} resultados visibles</p>
            </div>
          </div>

          <button
            type="button"
            @click="openCreateModal"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500"
          >
            <Plus class="h-4 w-4" />
            Nueva competencia
          </button>
        </div>

        <div v-if="filteredCompetencies.length === 0" class="p-12 text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
            <Sparkles class="h-7 w-7" />
          </div>
          <p class="mt-5 text-base font-black text-slate-700">No hay coincidencias con los filtros actuales.</p>
          <p class="mt-2 text-sm font-semibold text-slate-500">Ajusta la búsqueda o crea una nueva asignación de competencia.</p>
        </div>

        <div v-else class="divide-y divide-slate-100">
          <article v-for="item in filteredCompetencies" :key="item.id_competencia" class="px-6 py-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                    {{ item.periodo_nombre }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {{ item.tipo_grado_nombre }} {{ item.seccion_nombre }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {{ item.jornada_nombre }}
                  </span>
                </div>
                <h3 class="mt-4 text-xl font-black text-slate-900">{{ item.materia_nombre }}</h3>
                <p class="mt-2 text-sm font-semibold text-slate-500">La competencia asignada a esta materia será la base operativa para el docente.</p>
              </div>

              <button
                type="button"
                @click="openEditModal(item)"
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <PenSquare class="h-4 w-4" />
                Editar
              </button>
            </div>

            <div class="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <p class="text-sm font-semibold leading-7 text-slate-700">{{ item.descripcion }}</p>
            </div>
          </article>
        </div>
      </section>
    </template>

    <div v-if="competencyModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md">
      <div class="w-full max-w-3xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <h2 class="text-2xl font-black text-slate-900">Asignar competencia a materia</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">Puedes asignarla a un curso puntual o replicarla de forma masiva en todos los cursos del mismo grado.</p>
        </div>
        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="mb-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <p class="text-sm font-black text-emerald-800">Modo de asignación</p>
            <label class="mt-4 flex items-start gap-3">
              <input v-model="competencyForm.applyToWholeGrade" @change="handleFormScopeChange" type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span class="text-sm font-semibold leading-6 text-emerald-900">
                Aplicar esta misma competencia a todos los cursos del grado seleccionado para la materia elegida.
                <span v-if="competencyForm.gradeKey && competencyForm.subjectKey" class="block text-emerald-700">
                  Cursos impactados: {{ bulkTargetCount }}
                </span>
              </span>
            </label>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Grado</span>
              <select v-model="competencyForm.gradeKey" @change="handleFormGradeChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona un grado</option>
                <option v-for="item in gradeChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label v-if="!competencyForm.applyToWholeGrade" class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Curso</span>
              <select v-model="competencyForm.courseKey" @change="handleFormCourseChange" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona un curso</option>
                <option v-for="item in formCourseChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <div v-else class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Cobertura</span>
              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Se aplicará a todos los cursos disponibles del grado seleccionado.
              </div>
            </div>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Periodo</span>
              <select v-model="competencyForm.id_periodo" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona un periodo</option>
                <option v-for="period in periods" :key="period.id_periodo" :value="String(period.id_periodo)">{{ period.nombre }}</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Materia</span>
              <select v-model="competencyForm.subjectKey" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none">
                <option value="">Selecciona una materia</option>
                <option v-for="item in formSubjectChoices" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="space-y-2 md:col-span-2">
              <span class="block text-sm font-black text-slate-700">Descripción de la competencia</span>
              <textarea v-model="competencyForm.descripcion" rows="6" placeholder="Describe el aprendizaje esperado para esta materia en el periodo seleccionado." class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
          </div>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="competencyModal = false; resetForm()" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">Cancelar</button>
            <button type="button" @click="saveCompetency" :disabled="saving" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50">
              <Plus class="h-4 w-4" />
              {{ saving ? 'Guardando...' : 'Guardar competencia' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
