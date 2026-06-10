<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { ArrowLeft, BookMarked, PenSquare, Plus } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface AcademicYear {
  id_año: number
  calendario: string | null
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

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const savingPeriod = ref(false)
const yearSaving = ref(false)

const currentYear = ref<AcademicYear | null>(null)
const academicYears = ref<AcademicYear[]>([])
const periods = ref<AcademicPeriod[]>([])

const periodModal = ref(false)
const periodEditModal = ref<AcademicPeriod | null>(null)

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

const academicYearForm = ref({
  id_año: '',
  calendario: 'A',
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

onMounted(loadData)
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="flex items-center gap-4">
        <router-link to="/dashboard/configuracion-academica" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 border border-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
          <ArrowLeft class="h-5 w-5" />
        </router-link>
        <div>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white">Años y Periodos</h1>
          <p class="mt-1 text-slate-500 dark:text-slate-400">Administra los años lectivos y sus distribuciones por periodos.</p>
        </div>
      </div>
      <div class="rounded-2xl bg-orange-50 px-5 py-4 text-sm font-black text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
        Año lectivo activo: {{ currentYear ? `${currentYear.id_año}` : 'No configurado' }}
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500">
      Cargando configuración de tiempos académicos...
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-sky-50 p-3 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400">
                <BookMarked class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white">Años lectivos del colegio</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">Registra los años lectivos configurados. El más reciente queda como referencia activa.</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 border-b border-slate-100 p-6 md:grid-cols-[1fr_140px_auto] dark:border-slate-800">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300">Año lectivo</span>
              <input v-model="academicYearForm.id_año" type="number" min="2000" max="2100" placeholder="2026" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300">Calendario</span>
              <input v-model="academicYearForm.calendario" type="text" maxlength="10" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold uppercase outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
            </label>
            <div class="flex items-end">
              <button type="button" @click="createAcademicYear" :disabled="yearSaving" class="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-400">
                <Plus class="h-4 w-4" />
                {{ yearSaving ? 'Creando...' : 'Agregar año' }}
              </button>
            </div>
          </div>

          <div v-if="academicYears.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-600">
            No hay años lectivos configurados.
          </div>

          <div v-else class="divide-y divide-slate-100 overflow-y-auto max-h-[400px] dark:divide-slate-800">
            <div v-for="year in academicYears" :key="year.id_año" class="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <p class="text-base font-black text-slate-900 dark:text-white">{{ year.id_año }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Calendario: {{ year.calendario || 'Sin definir' }}</p>
              </div>
              <span :class="[currentYear?.id_año === year.id_año ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', 'rounded-full px-3 py-1 text-sm font-black']">
                {{ currentYear?.id_año === year.id_año ? 'Activo en el módulo' : 'Configurado' }}
              </span>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex items-center gap-3">
                <div class="rounded-2xl bg-orange-50 p-3 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                  <BookMarked class="h-6 w-6" />
                </div>
                <div>
                  <h2 class="text-lg font-black text-slate-900 dark:text-white">Periodos académicos</h2>
                  <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">Total: <span class="text-orange-600 dark:text-orange-400 font-black">{{ totalPeriodPercentage.toFixed(2) }}%</span></p>
                </div>
              </div>
              <button
                type="button"
                @click="periodModal = true"
                class="inline-flex shrink-0 min-h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-orange-400 dark:bg-orange-600 dark:hover:bg-orange-500"
              >
                <Plus class="h-4 w-4" />
                Crear periodo
              </button>
            </div>
          </div>

          <div v-if="periods.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-600">
            No hay periodos académicos configurados.
          </div>

          <div v-else class="divide-y divide-slate-100 overflow-y-auto max-h-[500px] dark:divide-slate-800">
            <div v-for="period in periods" :key="period.id_periodo" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <p class="text-base font-black text-slate-900 dark:text-white">{{ period.nombre }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Estado: <span :class="period.estado === 'ABIERTO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'">{{ period.estado }}</span> · Año: {{ period.id_año }}</p>
                <p class="mt-1 text-xs font-semibold text-slate-400 italic dark:text-slate-500">
                  <span v-if="period.mes_inicio !== null">
                    📅 Desde {{ months[period.mes_inicio - 1].name }} {{ period.dia_inicio }} hasta {{ months[period.mes_fin! - 1].name }} {{ period.dia_fin }}
                  </span>
                  <span v-else class="text-slate-300 dark:text-slate-700">Rango de fechas no definido</span>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <span class="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">{{ Number(period.porcentaje).toFixed(2) }}%</span>
                <button
                  type="button"
                  @click="periodEditModal = period; periodEdit.porcentaje = String(period.porcentaje); periodEdit.mes_inicio = String(period.mes_inicio); periodEdit.dia_inicio = String(period.dia_inicio); periodEdit.mes_fin = String(period.mes_fin); periodEdit.dia_fin = String(period.dia_fin)"
                  class="inline-flex items-center justify-center rounded-2xl bg-slate-100 p-3 text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <PenSquare class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- Modal Create Period -->
    <div v-if="periodModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-2xl rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800">
        <div class="border-b border-slate-100 px-8 py-7 dark:border-slate-800">
          <h2 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Crear periodo académico</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">El porcentaje agregado no puede romper el total global del año.</p>
        </div>
        <div class="px-8 py-8">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nombre del periodo</span>
              <input v-model="newPeriod.nombre" type="text" placeholder="Ej. Primer Periodo" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Porcentaje (%)</span>
              <input v-model="newPeriod.porcentaje" type="number" min="0" step="0.01" placeholder="Ej. 25" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
            </label>
          </div>

          <div class="mt-8 space-y-6 rounded-3xl border border-orange-100 bg-orange-50/50 p-7 dark:bg-orange-950/10 dark:border-orange-900/40">
            <h3 class="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">Vigencia del periodo</h3>
            
            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Inicio del periodo</p>
                <div class="flex gap-3">
                  <select v-model="newPeriod.mes_inicio" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="newPeriod.dia_inicio" type="number" min="1" max="31" placeholder="Día" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>

              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Fin del periodo</p>
                <div class="flex gap-3">
                  <select v-model="newPeriod.mes_fin" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="newPeriod.dia_fin" type="number" min="1" max="31" placeholder="Día" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button type="button" @click="periodModal = false" class="rounded-2xl border border-slate-200 px-8 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest">Cancelar</button>
            <button type="button" @click="createPeriod" :disabled="savingPeriod" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-orange-500 px-10 py-4 text-sm font-black text-white shadow-lg shadow-orange-200/50 dark:shadow-none hover:bg-orange-600 transition-all disabled:opacity-50 uppercase tracking-widest">
              <Plus class="h-4 w-4" />
              {{ savingPeriod ? 'Creando...' : 'Crear periodo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Edit Period -->
    <div v-if="periodEditModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-2xl rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800">
        <div class="border-b border-slate-100 px-8 py-7 dark:border-slate-800">
          <h2 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Actualizar periodo</h2>
          <p class="mt-2 text-sm font-black text-orange-600 dark:text-orange-400">{{ periodEditModal.nombre }}</p>
        </div>
        <div class="px-8 py-8">
          <label class="space-y-2">
            <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Porcentaje (%)</span>
            <input v-model="periodEdit.porcentaje" type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
          </label>

          <div class="mt-8 space-y-6 rounded-3xl border border-orange-100 bg-orange-50/50 p-7 dark:bg-orange-950/10 dark:border-orange-900/40">
            <h3 class="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">Actualizar vigencia</h3>
            
            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Inicio</p>
                <div class="flex gap-3">
                  <select v-model="periodEdit.mes_inicio" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="periodEdit.dia_inicio" type="number" min="1" max="31" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>

              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Fin</p>
                <div class="flex gap-3">
                  <select v-model="periodEdit.mes_fin" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="periodEdit.dia_fin" type="number" min="1" max="31" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button type="button" @click="periodEditModal = null" class="rounded-2xl border border-slate-200 px-8 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest">Cancelar</button>
            <button type="button" @click="updatePeriodPercentage" :disabled="savingPeriod" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-orange-600 px-10 py-4 text-sm font-black text-white shadow-lg shadow-orange-200/50 dark:shadow-none hover:bg-orange-700 transition-all disabled:opacity-50 uppercase tracking-widest">
              <PenSquare class="h-4 w-4" />
              {{ savingPeriod ? 'Guardando...' : 'Actualizar periodo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
