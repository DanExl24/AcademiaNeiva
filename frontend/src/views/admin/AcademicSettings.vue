<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { BookMarked, PenSquare, Plus, Scale, SlidersHorizontal } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface AcademicYear {
  id_año: number
  calendario: string | null
}

interface SchoolDefaultSettings {
  nota_minima: number
  nota_maxima: number
  nota_aprobacion: number
  escala_modo: 'AUTOMATICO' | 'MANUAL'
}

interface AcademicPeriod {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO'
  porcentaje: number
  mes_inicio: number | null
  dia_inicio: number | null
  mes_fin: number | null
  dia_fin: number | null
  meses_referencia?: string | null
  id_año: number
}

interface ValuationScale {
  id_escalavaloracion: number
  nivel: string
  valor_minimo: number
  valor_maximo: number
  notas_count: number
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

interface ClosureSummaryItem {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO'
  total_asignaciones: number
  asignaciones_cerradas: number
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const savingPeriod = ref(false)

const currentYear = ref<AcademicYear | null>(null)
const academicYears = ref<AcademicYear[]>([])
const periods = ref<AcademicPeriod[]>([])
const scales = ref<ValuationScale[]>([])
const competencies = ref<CompetencyItem[]>([])
const closureSummary = ref<ClosureSummaryItem[]>([])
const defaultSettings = ref<SchoolDefaultSettings | null>(null)

const periodModal = ref(false)
const periodEditModal = ref<AcademicPeriod | null>(null)
const closePeriodModal = ref<ClosureSummaryItem | null>(null)
const closePeriodPending = ref<any[]>([])
const defaultsSaving = ref(false)
const yearSaving = ref(false)

const newPeriod = ref({
  nombre: '',
  porcentaje: '',
  mes_inicio: '',
  dia_inicio: '',
  mes_fin: '',
  dia_fin: '',
})

const periodEdit = ref({
  porcentaje: '',
  mes_inicio: '',
  dia_inicio: '',
  mes_fin: '',
  dia_fin: '',
})

const defaultsForm = ref({
  nota_minima: '',
  nota_maxima: '',
  nota_aprobacion: '',
  escala_modo: 'AUTOMATICO' as 'AUTOMATICO' | 'MANUAL',
})

const academicYearForm = ref({
  id_año: '',
  calendario: 'A',
})

const manualScaleForm = ref({
  basico_max: '',
  alto_max: '',
})

const months = [
  { id: 1, name: 'Enero' },
  { id: 2, name: 'Febrero' },
  { id: 3, name: 'Marzo' },
  { id: 4, name: 'Abril' },
  { id: 5, name: 'Mayo' },
  { id: 6, name: 'Junio' },
  { id: 7, name: 'Julio' },
  { id: 8, name: 'Agosto' },
  { id: 9, name: 'Septiembre' },
  { id: 10, name: 'Octubre' },
  { id: 11, name: 'Noviembre' },
  { id: 12, name: 'Diciembre' },
]

const totalPeriodPercentage = computed(() =>
  periods.value.reduce((sum, item) => sum + Number(item.porcentaje), 0)
)

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`)
    currentYear.value = response.data.currentYear
    academicYears.value = response.data.academicYears || []
    periods.value = response.data.periods
    scales.value = response.data.scales
    competencies.value = response.data.competencies
    closureSummary.value = response.data.closureSummary
    defaultSettings.value = response.data.defaultSettings
    defaultsForm.value = {
      nota_minima: response.data.defaultSettings ? String(response.data.defaultSettings.nota_minima) : '',
      nota_maxima: response.data.defaultSettings ? String(response.data.defaultSettings.nota_maxima) : '',
      nota_aprobacion: response.data.defaultSettings ? String(response.data.defaultSettings.nota_aprobacion) : '',
      escala_modo: response.data.defaultSettings?.escala_modo || 'AUTOMATICO',
    }
    manualScaleForm.value = {
      basico_max: response.data.scales?.find((item: ValuationScale) => item.nivel === 'BASICO') ? String(response.data.scales.find((item: ValuationScale) => item.nivel === 'BASICO').valor_maximo) : '',
      alto_max: response.data.scales?.find((item: ValuationScale) => item.nivel === 'ALTO') ? String(response.data.scales.find((item: ValuationScale) => item.nivel === 'ALTO').valor_maximo) : '',
    }
  } catch (error) {
    console.error('Error loading academic settings:', error)
  } finally {
    loading.value = false
  }
}

const createPeriod = async () => {
  if (savingPeriod.value) return
  const mesInicio = Number(newPeriod.value.mes_inicio)
  const diaInicio = Number(newPeriod.value.dia_inicio)
  const mesFin = Number(newPeriod.value.mes_fin)
  const diaFin = Number(newPeriod.value.dia_fin)

  if (!mesInicio || !diaInicio || !mesFin || !diaFin) {
    alert('Debe definir el rango de fechas (Mes y Día de inicio y fin).')
    return
  }

  try {
    savingPeriod.value = true
    await axios.post('http://localhost:3000/api/academic-admin/settings/periods', {
      schoolId: schoolId.value,
      nombre: newPeriod.value.nombre,
      porcentaje: Number(newPeriod.value.porcentaje),
      mes_inicio: mesInicio,
      dia_inicio: diaInicio,
      mes_fin: mesFin,
      dia_fin: diaFin,
    })
    newPeriod.value = { nombre: '', porcentaje: '', mes_inicio: '', dia_inicio: '', mes_fin: '', dia_fin: '' }
    periodModal.value = false
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible crear el periodo')
  } finally {
    savingPeriod.value = false
  }
}

const updatePeriodPercentage = async () => {
  if (!periodEditModal.value || savingPeriod.value) return
  const mesInicio = Number(periodEdit.value.mes_inicio)
  const diaInicio = Number(periodEdit.value.dia_inicio)
  const mesFin = Number(periodEdit.value.mes_fin)
  const diaFin = Number(periodEdit.value.dia_fin)

  if (!mesInicio || !diaInicio || !mesFin || !diaFin) {
    alert('Debe definir el rango de fechas completo.')
    return
  }

  try {
    savingPeriod.value = true
    await axios.patch(`http://localhost:3000/api/academic-admin/settings/periods/${periodEditModal.value.id_periodo}/percentage`, {
      schoolId: schoolId.value,
      porcentaje: Number(periodEdit.value.porcentaje),
      mes_inicio: mesInicio,
      dia_inicio: diaInicio,
      mes_fin: mesFin,
      dia_fin: diaFin,
    })
    periodEditModal.value = null
    periodEdit.value = { porcentaje: '', mes_inicio: '', dia_inicio: '', mes_fin: '', dia_fin: '' }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar la configuración del periodo')
  } finally {
    savingPeriod.value = false
  }
}

const saveDefaultSettings = async () => {
  if (defaultsSaving.value) return
  if (defaultsForm.value.nota_minima === '' || defaultsForm.value.nota_maxima === '' || defaultsForm.value.nota_aprobacion === '') {
    alert('Completa la nota mínima, máxima y aprobatoria del colegio.')
    return
  }

  try {
    defaultsSaving.value = true
    await axios.put('http://localhost:3000/api/academic-admin/settings/defaults', {
      schoolId: schoolId.value,
      nota_minima: Number(defaultsForm.value.nota_minima),
      nota_maxima: Number(defaultsForm.value.nota_maxima),
      nota_aprobacion: Number(defaultsForm.value.nota_aprobacion),
      escala_modo: defaultsForm.value.escala_modo,
    })
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible guardar la configuración predeterminada')
  } finally {
    defaultsSaving.value = false
  }
}

const saveManualScales = async () => {
  if (defaultsSaving.value) return
  if (manualScaleForm.value.basico_max === '' || manualScaleForm.value.alto_max === '') {
    alert('Define los cortes máximos de BASICO y ALTO para el modo manual.')
    return
  }

  try {
    defaultsSaving.value = true
    defaultsForm.value.escala_modo = 'MANUAL'
    await axios.put('http://localhost:3000/api/academic-admin/settings/scales/manual', {
      schoolId: schoolId.value,
      basico_max: Number(manualScaleForm.value.basico_max),
      alto_max: Number(manualScaleForm.value.alto_max),
    })
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible guardar la configuración manual de escalas')
  } finally {
    defaultsSaving.value = false
  }
}

const createAcademicYear = async () => {
  if (yearSaving.value) return
  if (!academicYearForm.value.id_año) {
    alert('Ingresa el año lectivo que deseas configurar.')
    return
  }

  try {
    yearSaving.value = true
    await axios.post('http://localhost:3000/api/academic-admin/settings/years', {
      schoolId: schoolId.value,
      id_año: Number(academicYearForm.value.id_año),
      calendario: academicYearForm.value.calendario,
    })
    academicYearForm.value = { id_año: '', calendario: 'A' }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible crear el año lectivo')
  } finally {
    yearSaving.value = false
  }
}

const openClosePeriodModal = (item: ClosureSummaryItem) => {
  closePeriodModal.value = item
  closePeriodPending.value = []
}

const submitClosePeriod = async (force = false) => {
  if (!closePeriodModal.value) return

  try {
    await axios.post(`http://localhost:3000/api/academic-admin/settings/periods/${closePeriodModal.value.id_periodo}/close`, {
      schoolId: schoolId.value,
      force,
    })
    closePeriodModal.value = null
    closePeriodPending.value = []
    await loadData()
  } catch (error: any) {
    if (error.response?.status === 409 && error.response?.data?.pending) {
      closePeriodPending.value = error.response.data.pending
      return
    }
    alert(error.response?.data?.error || 'No fue posible cerrar el periodo')
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-8">
    <div class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm md:p-10">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-3xl font-black text-slate-900">Configuración Académica</h1>
          <p class="mt-2 text-slate-500">Define los periodos y escalas que sostienen calificaciones, competencias, cierres y boletines.</p>
        </div>
        <div class="rounded-2xl bg-orange-50 px-5 py-4 text-sm font-black text-orange-700">
          Año lectivo activo: {{ currentYear ? `${currentYear.id_año}` : 'No configurado' }}
        </div>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm">
      Cargando configuración académica...
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div class="border-b border-slate-100 p-6">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <SlidersHorizontal class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900">Configuración predeterminada</h2>
                <p class="text-sm text-slate-500">Define el rango global de notas y la nota mínima de aprobación del colegio.</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nota mínima</span>
              <input v-model="defaultsForm.nota_minima" type="number" step="0.1" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nota máxima</span>
              <input v-model="defaultsForm.nota_maxima" type="number" step="0.1" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nota aprobatoria</span>
              <input v-model="defaultsForm.nota_aprobacion" type="number" step="0.1" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
          </div>

          <div class="border-t border-slate-100 px-6 py-6">
            <span class="block text-sm font-black text-slate-700">Modo de escalas valorativas</span>
            <div class="mt-4 flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                @click="defaultsForm.escala_modo = 'AUTOMATICO'"
                :class="[defaultsForm.escala_modo === 'AUTOMATICO' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600', 'rounded-2xl border px-5 py-4 text-left text-sm font-black transition']"
              >
                Automático por sistema
              </button>
              <button
                type="button"
                @click="defaultsForm.escala_modo = 'MANUAL'"
                :class="[defaultsForm.escala_modo === 'MANUAL' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600', 'rounded-2xl border px-5 py-4 text-left text-sm font-black transition']"
              >
                Manual por directivo
              </button>
            </div>
            <p class="mt-3 text-sm font-semibold text-slate-500">
              El modo automático distribuye las escalas solo con base en el rango institucional. El modo manual te deja ajustar los cortes internos sin solapes ni huecos.
            </p>
          </div>

          <div class="border-t border-slate-100 px-6 py-5">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p class="text-sm font-semibold text-slate-500">
                Estos valores sirven como base institucional para escalas, aprobación, recalibración de notas y futuras reglas académicas.
              </p>
              <button type="button" @click="saveDefaultSettings" :disabled="defaultsSaving" class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-400 disabled:opacity-50">
                <PenSquare class="h-4 w-4" />
                {{ defaultsSaving ? 'Guardando...' : 'Guardar configuración' }}
              </button>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div class="border-b border-slate-100 p-6">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-sky-50 p-3 text-sky-600">
                <BookMarked class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900">Años lectivos del colegio</h2>
                <p class="text-sm text-slate-500">Registra los años lectivos configurados. El más reciente queda como referencia activa del módulo.</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 border-b border-slate-100 p-6 md:grid-cols-[1fr_140px_auto]">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Año lectivo</span>
              <input v-model="academicYearForm.id_año" type="number" min="2000" max="2100" placeholder="2026" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Calendario</span>
              <input v-model="academicYearForm.calendario" type="text" maxlength="10" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold uppercase outline-none" />
            </label>
            <div class="flex items-end">
              <button type="button" @click="createAcademicYear" :disabled="yearSaving" class="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50">
                <Plus class="h-4 w-4" />
                {{ yearSaving ? 'Creando...' : 'Agregar año' }}
              </button>
            </div>
          </div>

          <div v-if="academicYears.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400">
            No hay años lectivos configurados.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div v-for="year in academicYears" :key="year.id_año" class="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-base font-black text-slate-900">{{ year.id_año }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500">Calendario: {{ year.calendario || 'Sin definir' }}</p>
              </div>
              <span :class="[currentYear?.id_año === year.id_año ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600', 'rounded-full px-3 py-1 text-sm font-black']">
                {{ currentYear?.id_año === year.id_año ? 'Activo en el módulo' : 'Configurado' }}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div class="border-b border-slate-100 p-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex items-center gap-3">
                <div class="rounded-2xl bg-orange-50 p-3 text-orange-600">
                  <BookMarked class="h-6 w-6" />
                </div>
                <div>
                  <h2 class="text-lg font-black text-slate-900">Periodos académicos</h2>
                  <p class="text-sm text-slate-500">Maneja los periodos académicos definiendo meses y días de duración. El sistema abrirá automáticamente el periodo actual.</p>
                </div>
              </div>
              <button
                type="button"
                @click="periodModal = true"
                class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-orange-400"
              >
                <Plus class="h-4 w-4" />
                Crear periodo
              </button>
            </div>
          </div>

          <div class="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <p class="text-sm font-black text-slate-700">Total configurado: {{ totalPeriodPercentage.toFixed(2) }}%</p>
          </div>

          <div v-if="periods.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400">
            No hay periodos académicos configurados.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div v-for="period in periods" :key="period.id_periodo" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-base font-black text-slate-900">{{ period.nombre }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500">Estado: {{ period.estado }} · Año: {{ period.id_año }}</p>
                <p class="mt-1 text-xs font-semibold text-slate-400 italic">
                  <span v-if="period.mes_inicio !== null">
                    📅 Desde {{ months[period.mes_inicio - 1].name }} {{ period.dia_inicio }} hasta {{ months[period.mes_fin! - 1].name }} {{ period.dia_fin }}
                  </span>
                  <span v-else class="text-slate-300">Rango de fechas no definido</span>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <span class="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-orange-700">{{ Number(period.porcentaje).toFixed(2) }}%</span>
                <button
                  type="button"
                  @click="periodEditModal = period; periodEdit.porcentaje = String(period.porcentaje); periodEdit.mes_inicio = String(period.mes_inicio); periodEdit.dia_inicio = String(period.dia_inicio); periodEdit.mes_fin = String(period.mes_fin); periodEdit.dia_fin = String(period.dia_fin)"
                  class="inline-flex items-center justify-center rounded-2xl bg-slate-100 p-3 text-slate-600 transition-all hover:bg-slate-200"
                >
                  <PenSquare class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div class="border-b border-slate-100 p-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex items-center gap-3">
                <div class="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                  <Scale class="h-6 w-6" />
                </div>
                <div>
                  <h2 class="text-lg font-black text-slate-900">Escalas de valoración</h2>
                  <p class="text-sm text-slate-500">
                    {{ defaultsForm.escala_modo === 'MANUAL' ? 'El directivo ajusta los cortes internos y el sistema protege continuidad y cobertura total.' : 'Estas escalas se generan automáticamente a partir de la configuración predeterminada del colegio.' }}
                  </p>
                </div>
              </div>
              <div :class="[defaultsForm.escala_modo === 'MANUAL' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700', 'rounded-2xl px-4 py-3 text-sm font-black']">
                {{ defaultsForm.escala_modo === 'MANUAL' ? 'Modo manual activo' : 'Modo automático activo' }}
              </div>
            </div>
          </div>

          <div v-if="defaultsForm.escala_modo === 'MANUAL'" class="border-b border-slate-100 bg-amber-50/60 px-6 py-5">
            <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label class="space-y-2">
                <span class="block text-sm font-black text-slate-700">Máximo de BASICO</span>
                <input v-model="manualScaleForm.basico_max" type="number" step="0.1" class="w-full rounded-2xl border border-amber-200 bg-white p-4 font-semibold outline-none" />
              </label>
              <label class="space-y-2">
                <span class="block text-sm font-black text-slate-700">Máximo de ALTO</span>
                <input v-model="manualScaleForm.alto_max" type="number" step="0.1" class="w-full rounded-2xl border border-amber-200 bg-white p-4 font-semibold outline-none" />
              </label>
            </div>
            <div class="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p class="text-sm font-semibold text-slate-600">
                BAJO y SUPERIOR se recalculan automáticamente para cubrir todo el rango sin interceptarse ni dejar vacíos.
              </p>
              <button type="button" @click="saveManualScales" :disabled="defaultsSaving" class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-50">
                <PenSquare class="h-4 w-4" />
                {{ defaultsSaving ? 'Guardando...' : 'Guardar cortes manuales' }}
              </button>
            </div>
          </div>

          <div v-if="scales.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400">
            No hay escalas de valoración configuradas.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div v-for="scale in scales" :key="scale.id_escalavaloracion" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-base font-black text-slate-900">{{ scale.nivel }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500">Rango: {{ Number(scale.valor_minimo).toFixed(1) }} - {{ Number(scale.valor_maximo).toFixed(1) }}</p>
                <p class="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ scale.notas_count }} relaciones académicas</p>
              </div>
              <div :class="[defaultsForm.escala_modo === 'MANUAL' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600', 'rounded-full px-3 py-1 text-sm font-black']">
                {{ defaultsForm.escala_modo === 'MANUAL' ? 'Corte manual protegido' : 'Derivada del rango institucional' }}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <router-link
          to="/dashboard/configuracion-academica/competencias"
          class="group overflow-hidden rounded-3xl border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(135deg,#f7fff9_0%,#ecfdf5_48%,#d1fae5_100%)] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div class="flex h-full flex-col justify-between gap-6">
            <div>
              <div class="inline-flex rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
                <SlidersHorizontal class="h-6 w-6" />
              </div>
              <h2 class="mt-5 text-2xl font-black text-slate-900">Módulo de competencias</h2>
              <p class="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Abre la vista especializada para asignar y actualizar competencias por materia, curso y periodo sin mezclar esa gestión con el resto de la configuración académica.
              </p>
            </div>

            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div class="flex flex-wrap gap-3">
                <span class="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-emerald-700 shadow-sm">
                  {{ competencies.length }} competencias base
                </span>
                <span class="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-slate-600 shadow-sm">
                  Gestión centrada en materias
                </span>
              </div>
              <span class="inline-flex items-center gap-2 text-sm font-black text-emerald-700 transition group-hover:translate-x-1">
                Abrir módulo
                <Plus class="h-4 w-4" />
              </span>
            </div>
          </div>
        </router-link>

        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div class="border-b border-slate-100 p-6">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-rose-50 p-3 text-rose-600">
                <BookMarked class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900">Cierre de periodo</h2>
                <p class="text-sm text-slate-500">Permite cerrar un periodo cuando todas las asignaciones estén completas o forzarlo con advertencia.</p>
              </div>
            </div>
          </div>

          <div v-if="closureSummary.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400">
            No hay periodos disponibles para cierre.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div v-for="item in closureSummary" :key="item.id_periodo" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-base font-black text-slate-900">{{ item.nombre }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500">Cerradas: {{ item.asignaciones_cerradas }} / {{ item.total_asignaciones }}</p>
              </div>
              <div class="flex items-center gap-3">
                <span :class="[item.estado === 'CERRADO' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700', 'rounded-full px-3 py-1 text-sm font-black']">
                  {{ item.estado }}
                </span>
                <button
                  v-if="item.estado !== 'CERRADO'"
                  type="button"
                  @click="openClosePeriodModal(item)"
                  class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-rose-500"
                >
                  Cerrar periodo
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <SlidersHorizontal class="h-6 w-6" />
          </div>
          <div>
            <h3 class="text-lg font-black text-slate-900">Siguiente capa del módulo</h3>
            <p class="text-sm text-slate-500">Competencias, actividades y reglas de cierre dependen de esta configuración base y se pueden acoplar encima de estos datos.</p>
          </div>
        </div>
      </section>
    </template>

    <div v-if="periodModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md">
      <div class="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <h2 class="text-2xl font-black text-slate-900">Crear periodo académico</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">El porcentaje agregado no puede romper el total global del año y debes asignar el trimestre correspondiente.</p>
        </div>
        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Nombre del periodo</span>
              <input v-model="newPeriod.nombre" type="text" placeholder="Ej. Primer Periodo" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700">Porcentaje</span>
              <input v-model="newPeriod.porcentaje" type="number" min="0" step="0.01" placeholder="Ej. 25" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
            </label>
          </div>

          <div class="mt-6 space-y-6 rounded-3xl border border-orange-100 bg-orange-50/50 p-6">
            <h3 class="text-sm font-black text-orange-700">Vigencia del periodo</h3>
            
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div class="space-y-4">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Inicio del periodo</p>
                <div class="flex gap-3">
                  <select v-model="newPeriod.mes_inicio" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="newPeriod.dia_inicio" type="number" min="1" max="31" placeholder="Día" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none" />
                </div>
              </div>

              <div class="space-y-4">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Fin del periodo</p>
                <div class="flex gap-3">
                  <select v-model="newPeriod.mes_fin" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="newPeriod.dia_fin" type="number" min="1" max="31" placeholder="Día" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="periodModal = false" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">Cancelar</button>
            <button type="button" @click="createPeriod" :disabled="savingPeriod" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-orange-500 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50">
              <Plus class="h-4 w-4" />
              {{ savingPeriod ? 'Creando...' : 'Crear periodo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="periodEditModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md">
      <div class="w-full max-w-xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <h2 class="text-2xl font-black text-slate-900">Actualizar periodo</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">{{ periodEditModal.nombre }}</p>
        </div>
        <div class="px-6 py-6 md:px-8 md:py-8">
          <label class="space-y-2">
            <span class="block text-sm font-black text-slate-700">Porcentaje</span>
            <input v-model="periodEdit.porcentaje" type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none" />
          </label>

          <div class="mt-6 space-y-6 rounded-3xl border border-orange-100 bg-orange-50/50 p-6">
            <h3 class="text-sm font-black text-orange-700">Actualizar vigencia</h3>
            
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div class="space-y-4">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Inicio</p>
                <div class="flex gap-3">
                  <select v-model="periodEdit.mes_inicio" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="periodEdit.dia_inicio" type="number" min="1" max="31" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none" />
                </div>
              </div>

              <div class="space-y-4">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Fin</p>
                <div class="flex gap-3">
                  <select v-model="periodEdit.mes_fin" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="periodEdit.dia_fin" type="number" min="1" max="31" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="periodEditModal = null" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">Cancelar</button>
            <button type="button" @click="updatePeriodPercentage" :disabled="savingPeriod" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-orange-500 px-8 py-4 text-base font-black text-white shadow-sm disabled:opacity-50">
              <PenSquare class="h-4 w-4" />
              {{ savingPeriod ? 'Guardando...' : 'Actualizar periodo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="closePeriodModal" class="fixed inset-0 z-[110] flex min-h-screen w-screen items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div class="w-full max-w-3xl rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-6 py-5 md:px-8">
          <h2 class="text-2xl font-black text-slate-900">Cerrar periodo académico</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500">{{ closePeriodModal.nombre }}</p>
        </div>
        <div class="px-6 py-6 md:px-8 md:py-8">
          <div class="rounded-3xl border border-rose-100 bg-rose-50 p-5">
            <p class="text-sm font-black text-rose-700">Asignaciones cerradas actualmente: {{ closePeriodModal.asignaciones_cerradas }} / {{ closePeriodModal.total_asignaciones }}</p>
            <p class="mt-3 text-sm font-semibold text-rose-700/90">Si aún existen pendientes, el sistema te pedirá confirmación para un cierre forzado.</p>
          </div>

          <div v-if="closePeriodPending.length > 0" class="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5">
            <p class="text-sm font-black text-amber-700">Hay asignaciones pendientes en este periodo:</p>
            <div class="mt-4 max-h-56 space-y-3 overflow-auto pr-1">
              <div v-for="item in closePeriodPending" :key="item.id_detallegrado" class="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                {{ item.tipo_grado_nombre }} {{ item.seccion_nombre }} · {{ item.jornada_nombre }} · {{ item.materia_nombre }}
              </div>
            </div>
          </div>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="closePeriodModal = null; closePeriodPending = []" class="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700">Cancelar</button>
            <button type="button" @click="submitClosePeriod(false)" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-rose-600 px-8 py-4 text-base font-black text-white shadow-sm">
              Intentar cierre normal
            </button>
            <button v-if="closePeriodPending.length > 0" type="button" @click="submitClosePeriod(true)" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-amber-500 px-8 py-4 text-base font-black text-white shadow-sm">
              Forzar cierre
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
