<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { ArrowLeft, BookMarked, PenSquare, Plus, Info, Trash2, Play, Lock, ShieldAlert, Check } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface AcademicYear {
  id_anio: number
  calendario: string | null
  tipo_calendario?: string | null
  estado?: string
}

interface AcademicPeriod {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO' | 'PENDIENTE'
  porcentaje: number
  mes_inicio: number | null
  dia_inicio: number | null
  mes_fin: number | null
  dia_fin: number | null
  meses_referencia?: string | null
  id_anio: number
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

// Success year creation alert state
const yearSuccessMessage = ref<string | null>(null)
const yearSuccessPeriods = ref<any[]>([])
const showYearSuccessAlert = ref(false)

// Editor mode states
const editorModeActive = ref(false)
const showEditorWarningModal = ref(false)
const deletingYearId = ref<number | null>(null)
const togglingYearId = ref<number | null>(null)

const toggleYearStatus = async (year: AcademicYear) => {
  if (togglingYearId.value) return
  const currentStatus = year.estado || 'ABIERTO'
  const targetStatus = currentStatus === 'ABIERTO' ? 'CERRADO' : 'ABIERTO'
  try {
    togglingYearId.value = year.id_anio
    const response = await axios.patch(`http://localhost:3000/api/academic-admin/settings/years/${year.id_anio}/status`, {
      schoolId: schoolId.value,
      estado: targetStatus,
    })
    
    // Update local state
    const updated = response.data
    const found = academicYears.value.find(y => y.id_anio === year.id_anio)
    if (found) {
      found.estado = updated.estado
    }
    if (currentYear.value?.id_anio === year.id_anio) {
      currentYear.value.estado = updated.estado
    }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar el estado del año lectivo')
  } finally {
    togglingYearId.value = null
  }
}

const deleteYear = async (year: AcademicYear) => {
  if (deletingYearId.value) return
  const confirmStr = prompt(`¿Está seguro de eliminar el año lectivo ${year.calendario}? Esta acción borrará permanentemente el año y todos sus periodos.\n\nEscriba "ELIMINAR" para confirmar:`)
  if (confirmStr !== 'ELIMINAR') {
    return
  }

  try {
    deletingYearId.value = year.id_anio
    await axios.delete(`http://localhost:3000/api/academic-admin/settings/years/${year.id_anio}`, {
      data: { schoolId: schoolId.value }
    })
    
    alert(`Año lectivo ${year.calendario} eliminado correctamente.`)
    
    if (selectedYearId.value === year.id_anio) {
      selectedYearId.value = null
    }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar el año lectivo')
  } finally {
    deletingYearId.value = null
  }
}

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
  id_anio: '',
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

const selectedYearId = ref<number | null>(null)

const selectedYearObj = computed(() =>
  academicYears.value.find(y => y.id_anio === selectedYearId.value)
)

const filteredPeriods = computed(() => {
  if (!selectedYearId.value) return periods.value
  return periods.value.filter(p => p.id_anio === selectedYearId.value)
})

const totalPeriodPercentage = computed(() =>
  filteredPeriods.value.reduce((sum, item) => sum + Number(item.porcentaje), 0)
)

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`)
    currentYear.value = response.data.currentYear
    academicYears.value = response.data.academicYears || []
    periods.value = response.data.periods
    
    // Set selected year to current active year on first load if not already set
    if (!selectedYearId.value && currentYear.value) {
      selectedYearId.value = currentYear.value.id_anio
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
      id_anio: selectedYearId.value,
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

const approvePeriod = async (period: AcademicPeriod) => {
  const confirmApprove = confirm(`¿Está seguro de aprobar y activar el periodo "${period.nombre}"? Esta acción cerrará el periodo actual si está abierto.`)
  if (!confirmApprove) return

  try {
    loading.value = true
    await axios.post(`http://localhost:3000/api/academic-admin/settings/periods/${period.id_periodo}/approve`, {
      schoolId: schoolId.value,
    })
    alert('Periodo académico aprobado y activado correctamente.')
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible aprobar el periodo')
  } finally {
    loading.value = false
  }
}

const createAcademicYear = async () => {
  if (yearSaving.value) return
  if (!academicYearForm.value.id_anio) {
    alert('Ingresa el año lectivo que deseas configurar.')
    return
  }

  try {
    yearSaving.value = true
    const response = await axios.post('http://localhost:3000/api/academic-admin/settings/years', {
      schoolId: schoolId.value,
      id_anio: Number(academicYearForm.value.id_anio),
      calendario: academicYearForm.value.calendario,
    })
    
    // Store message and periods to display in modal
    yearSuccessMessage.value = response.data.message
    yearSuccessPeriods.value = response.data.periods || []
    showYearSuccessAlert.value = true
    selectedYearId.value = response.data.id_anio

    academicYearForm.value = { id_anio: '', calendario: 'A' }
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
        Año lectivo activo: {{ currentYear ? currentYear.calendario : 'No configurado' }}
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500">
      Cargando configuración de tiempos académicos...
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-sky-50 p-3 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400">
                <BookMarked class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white">Años lectivos del colegio</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">Registra los años lectivos configurados. El más reciente queda como referencia activa.</p>
              </div>
            </div>
            <button
              type="button"
              @click="editorModeActive ? editorModeActive = false : showEditorWarningModal = true"
              :class="[
                editorModeActive 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200/50' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md dark:shadow-none shrink-0 uppercase tracking-wider'
              ]"
            >
              <ShieldAlert class="h-4 w-4" />
              {{ editorModeActive ? 'Salir Editor' : 'Modo Editor' }}
            </button>
          </div>

          <div class="grid grid-cols-1 gap-6 border-b border-slate-100 p-6 md:grid-cols-[1fr_140px_auto] dark:border-slate-800">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300">Año lectivo</span>
              <input v-model="academicYearForm.id_anio" type="number" min="2000" max="2100" placeholder="2026" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300">Calendario</span>
              <select v-model="academicYearForm.calendario" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                <option value="A">Calendario A</option>
                <option value="B">Calendario B</option>
              </select>
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
            <div 
              v-for="year in academicYears" 
              :key="year.id_anio"
              @click="selectedYearId = year.id_anio"
              :class="[
                selectedYearId === year.id_anio ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-l-4 border-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent',
                'flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between transition-all cursor-pointer'
              ]"
            >
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <p class="text-base font-black text-slate-900 dark:text-white">{{ year.calendario || 'Sin definir' }}</p>
                  <span 
                    :class="[
                      year.estado === 'CERRADO' 
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' 
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
                      'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider'
                    ]"
                  >
                    {{ year.estado === 'CERRADO' ? 'Cerrado' : 'Abierto' }}
                  </span>
                </div>
                <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Calendario: {{ year.tipo_calendario || 'Sin definir' }}</p>
              </div>

              <div class="flex items-center gap-3 shrink-0" @click.stop>
                <template v-if="editorModeActive">
                  <button
                    type="button"
                    @click="toggleYearStatus(year)"
                    :disabled="togglingYearId === year.id_anio"
                    title="Alternar estado abierto/cerrado del año"
                    class="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    <component :is="year.estado === 'CERRADO' ? Play : Lock" class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    @click="deleteYear(year)"
                    :disabled="deletingYearId === year.id_anio"
                    title="Eliminar año lectivo permanentemente"
                    class="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 transition"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </template>
                <template v-else>
                  <span :class="[currentYear?.id_anio === year.id_anio ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', 'rounded-full px-3 py-1 text-sm font-black']">
                    {{ currentYear?.id_anio === year.id_anio ? 'Activo en el módulo' : 'Configurado' }}
                  </span>
                </template>
              </div>
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

          <div v-if="filteredPeriods.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-600">
            No hay periodos académicos configurados para este año.
          </div>

          <div v-else class="divide-y divide-slate-100 overflow-y-auto max-h-[500px] dark:divide-slate-800">
            <div v-for="period in filteredPeriods" :key="period.id_periodo" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <p class="text-base font-black text-slate-900 dark:text-white">{{ period.nombre }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Estado: 
                  <span 
                    :class="[
                      period.estado === 'ABIERTO' ? 'text-emerald-600 dark:text-emerald-400 font-black' :
                      period.estado === 'PENDIENTE' ? 'text-amber-600 dark:text-amber-500 font-black' :
                      'text-slate-400'
                    ]"
                  >
                    {{ period.estado }}
                  </span> 
                  · Año: {{ selectedYearObj ? selectedYearObj.calendario : period.id_anio }}
                </p>
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
                  v-if="period.estado === 'PENDIENTE'"
                  type="button"
                  @click="approvePeriod(period)"
                  class="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-3.5 py-3 text-xs font-black text-emerald-700 hover:bg-emerald-100 transition-all dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  title="Aprobar y activar periodo"
                >
                  <Check class="h-4 w-4" />
                  Aprobar
                </button>

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

      <!-- Referencia de Calendarios Escolares (A y B) -->
      <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div class="flex items-center gap-3 mb-6">
          <div class="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
            <Info class="h-6 w-6" />
          </div>
          <div>
            <h2 class="text-lg font-black text-slate-900 dark:text-white">Guía de Calendarios Académicos</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Referencia oficial para configurar los rangos de fechas de periodos según el tipo de calendario en Colombia.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Calendario A -->
          <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/70 p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="text-2xl">📚</span>
                <h3 class="text-base font-black text-slate-900 dark:text-white">Calendario A</h3>
              </div>
              <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                Inicia generalmente entre <strong>enero y febrero</strong> y finaliza entre <strong>noviembre y diciembre</strong>. Es el esquema estándar de la mayoría de colegios en Colombia. Se divide comúnmente en 4 periodos académicos.
              </p>
              
              <div class="space-y-2.5">
                <h4 class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Distribución sugerida de periodos:</h4>
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 1</span>
                    <span class="text-slate-500 dark:text-slate-400">Ene/Feb → Marzo</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 2</span>
                    <span class="text-slate-500 dark:text-slate-400">Abril → Junio</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 3</span>
                    <span class="text-slate-500 dark:text-slate-400">Julio → Sept</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 4</span>
                    <span class="text-slate-500 dark:text-slate-400">Sept → Nov</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-4 text-[11px] text-slate-400 font-medium">
              * Nota: Incluye receso de mitad de año entre junio y julio.
            </div>
          </div>

          <!-- Calendario B -->
          <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/70 p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="text-2xl">🌎</span>
                <h3 class="text-base font-black text-slate-900 dark:text-white">Calendario B</h3>
              </div>
              <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                Inicia generalmente entre <strong>agosto y septiembre</strong> y termina en <strong>junio o julio del año siguiente</strong>. Común en colegios internacionales, bilingües y alineados con el hemisferio norte.
              </p>
              
              <div class="space-y-2.5">
                <h4 class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Distribución sugerida de periodos:</h4>
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 col-span-2">
                    <span class="font-black block text-slate-800 dark:text-white">Primer Semestre (Periodo 1 & 2)</span>
                    <span class="text-slate-500 dark:text-slate-400">Agosto → Diciembre (Cierre antes de Navidad)</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 col-span-2">
                    <span class="font-black block text-slate-800 dark:text-white">Segundo Semestre (Periodo 3 & 4)</span>
                    <span class="text-slate-500 dark:text-slate-400">Enero → Junio/Julio (Cierre de año escolar)</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-4 text-[11px] text-slate-400 font-medium">
              * Nota: Incluye vacaciones de fin de año entre diciembre y enero.
            </div>
          </div>
        </div>
      </section>
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

    <!-- Modal Success Year Creation -->
    <div v-if="showYearSuccessAlert" class="fixed inset-0 z-[120] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-lg rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800 p-8">
        <div class="text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 mb-4">
            <BookMarked class="h-6 w-6" />
          </div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">¡Año Lectivo Creado!</h2>
          <p class="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">{{ yearSuccessMessage }}</p>
        </div>

        <div class="mt-6 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
          <p class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Periodos autogenerados:</p>
          <div v-for="p in yearSuccessPeriods" :key="p.id_periodo" class="flex items-center justify-between text-xs py-1.5 border-b border-dashed border-slate-200 dark:border-slate-700 last:border-b-0">
            <span class="font-bold text-slate-800 dark:text-slate-200">{{ p.nombre }}</span>
            <span class="text-slate-500 dark:text-slate-400">
              📅 {{ months[p.mes_inicio - 1].name }} {{ p.dia_inicio }} - {{ months[p.mes_fin - 1].name }} {{ p.dia_fin }}
            </span>
          </div>
        </div>

        <div class="mt-8 flex justify-center">
          <button type="button" @click="showYearSuccessAlert = false" class="w-full rounded-2xl bg-sky-600 py-4 text-sm font-black text-white hover:bg-sky-500 transition-all dark:bg-sky-500 dark:hover:bg-sky-400 uppercase tracking-widest">
            Entendido
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Warning Editor Mode -->
    <div v-if="showEditorWarningModal" class="fixed inset-0 z-[120] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-lg rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800 p-8">
        <div class="text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 mb-4">
            <ShieldAlert class="h-6 w-6" />
          </div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">¡Atención - Zona de Riesgo!</h2>
          <p class="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
            El modo editor es una herramienta delicada. Le permitirá <strong>eliminar, abrir o cerrar</strong> años lectivos completos.
          </p>
          <div class="mt-4 p-4 rounded-2xl bg-rose-50/50 border border-rose-100 text-left text-xs font-semibold text-rose-700 dark:bg-rose-950/10 dark:border-rose-900/30 dark:text-rose-400 leading-relaxed">
            ⚠️ <strong>Riesgos asociados:</strong>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li>Cerrar un año evitará que se realicen modificaciones académicas.</li>
              <li>Eliminar un año borrará todos los periodos y estructuras asociadas de forma irreversible.</li>
              <li>Si hay matrículas o notas activas, el borrado será bloqueado para proteger la consistencia de datos.</li>
            </ul>
          </div>
          <p class="mt-4 text-xs font-bold text-slate-400 dark:text-slate-500">
            ¿Desea ingresar bajo su propia responsabilidad?
          </p>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <button 
            type="button" 
            @click="showEditorWarningModal = false" 
            class="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 uppercase tracking-widest"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            @click="editorModeActive = true; showEditorWarningModal = false" 
            class="flex-1 rounded-2xl bg-rose-600 py-3.5 text-xs font-black text-white hover:bg-rose-500 transition-all dark:bg-rose-500 dark:hover:bg-rose-400 uppercase tracking-widest shadow-lg shadow-rose-200/50 dark:shadow-none"
          >
            Entendido, activar
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
