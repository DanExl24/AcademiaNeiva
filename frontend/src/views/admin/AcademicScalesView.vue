<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { ArrowLeft, HelpCircle, Lock, PenSquare, Scale, SlidersHorizontal, GraduationCap, CheckCircle2 } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'

interface SchoolDefaultSettings {
  nota_minima: number
  nota_maxima: number
  nota_aprobacion: number
  escala_modo: 'AUTOMATICO' | 'MANUAL'
  materias_reprobatorias_promocion?: number
}

interface ValuationScale {
  id_escalavaloracion: number
  nivel: string
  valor_minimo: number
  valor_maximo: number
  notas_count: number
}

const auth = useAuthStore()
const yearStore = useAcademicYearStore()

const schoolId = computed(() => Number(auth.user?.schoolId || 0))
const isYearClosed = computed(() => {
  if (!yearStore.selectedYear) return false
  const status = String(yearStore.selectedYear.estado || '').toUpperCase()
  return status === 'CERRADO' || status === 'INACTIVO'
})

const loading = ref(true)
const defaultsSaving = ref(false)
const promotionSaving = ref(false)

const scales = ref<ValuationScale[]>([])
const defaultSettings = ref<SchoolDefaultSettings | null>(null)

const defaultsForm = ref({
  nota_minima: '',
  nota_maxima: '',
  nota_aprobacion: '',
  escala_modo: 'AUTOMATICO' as 'AUTOMATICO' | 'MANUAL'
})

const promotionForm = ref({
  materias_reprobatorias_promocion: '3'
})

const manualScaleForm = ref({
  basico_max: '',
  alto_max: '',
})

const showConfirmModal = ref(false)
const confirmMessage = ref('')
const pendingSettings = ref<{
  nota_minima: number
  nota_maxima: number
  nota_aprobacion: number
  escala_modo: 'AUTOMATICO' | 'MANUAL'
} | null>(null)

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const params: any = { keys: 'scales,defaults' }
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const response = await axios.get(`/api/academic-admin/settings/${schoolId.value}`, { params })
    scales.value = response.data.scales || []
    defaultSettings.value = response.data.defaultSettings || null
    
    if (response.data.defaultSettings) {
      defaultsForm.value = {
        nota_minima: String(response.data.defaultSettings.nota_minima),
        nota_maxima: String(response.data.defaultSettings.nota_maxima),
        nota_aprobacion: String(response.data.defaultSettings.nota_aprobacion),
        escala_modo: response.data.defaultSettings.escala_modo || 'AUTOMATICO'
      }
      promotionForm.value = {
        materias_reprobatorias_promocion: String(response.data.defaultSettings.materias_reprobatorias_promocion || 3)
      }
    }
    if (response.data.scales) {
      const basico = response.data.scales.find((item: ValuationScale) => item.nivel === 'BASICO')
      const alto = response.data.scales.find((item: ValuationScale) => item.nivel === 'ALTO')
      manualScaleForm.value = {
        basico_max: basico ? String(basico.valor_maximo) : '',
        alto_max: alto ? String(alto.valor_maximo) : '',
      }
    }
  } catch (error) {
    console.error('Error al cargar ajustes académicos:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
  loadData()
})

watch(() => yearStore.selectedYearId, loadData)

const saveDefaultSettings = async (bypassConfirm = false) => {
  if (defaultsSaving.value) return
  if (isYearClosed.value) {
    alert(`El año lectivo ${yearStore.selectedYear?.calendario || ''} está CERRADO. No es posible modificar la configuración en un ciclo escolar cerrado.`)
    return
  }
  if (defaultsForm.value.nota_minima === '' || defaultsForm.value.nota_maxima === '' || defaultsForm.value.nota_aprobacion === '') {
    alert('Completa la nota mínima, máxima y aprobatoria del colegio.')
    return
  }

  const nextMin = Number(defaultsForm.value.nota_minima)
  const nextMax = Number(defaultsForm.value.nota_maxima)
  const nextAprob = Number(defaultsForm.value.nota_aprobacion)
  const nextMode = defaultsForm.value.escala_modo

  // Verificar si hay cambio de rango para mostrar advertencia
  if (!bypassConfirm && defaultSettings.value) {
    const rangeChanged = 
      Number(defaultSettings.value.nota_minima) !== nextMin || 
      Number(defaultSettings.value.nota_maxima) !== nextMax

    if (rangeChanged) {
      confirmMessage.value = `Has cambiado el rango de calificación (de ${defaultSettings.value.nota_minima}-${defaultSettings.value.nota_maxima} a ${nextMin}-${nextMax}). Todas las notas existentes se rescalarán proporcionalmente (Ej: un 3.8/5 pasará a ser ~7.6/10). ¿Deseas continuar?`
      pendingSettings.value = {
        nota_minima: nextMin,
        nota_maxima: nextMax,
        nota_aprobacion: nextAprob,
        escala_modo: nextMode
      }
      showConfirmModal.value = true
      return
    }
  }

  try {
    defaultsSaving.value = true
    await axios.put('/api/academic-admin/settings/defaults', {
      schoolId: schoolId.value,
      yearId: yearStore.selectedYearId,
      nota_minima: nextMin,
      nota_maxima: nextMax,
      nota_aprobacion: nextAprob,
      escala_modo: nextMode,
      materias_reprobatorias_promocion: Number(promotionForm.value.materias_reprobatorias_promocion || 3)
    })
    showConfirmModal.value = false
    pendingSettings.value = null
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible guardar la configuración predeterminada')
  } finally {
    defaultsSaving.value = false
  }
}

const savePromotionPolicy = async () => {
  if (promotionSaving.value) return
  if (isYearClosed.value) {
    alert(`El año lectivo ${yearStore.selectedYear?.calendario || ''} está CERRADO. No es posible modificar la política de promoción.`)
    return
  }

  const rawVal = Number(promotionForm.value.materias_reprobatorias_promocion)
  if (Number.isNaN(rawVal) || rawVal < 1 || rawVal > 10) {
    alert('Ingresa un número válido de materias reprobatorias entre 1 y 10.')
    return
  }

  try {
    promotionSaving.value = true
    await axios.put('/api/academic-admin/settings/promotion-policy', {
      schoolId: schoolId.value,
      yearId: yearStore.selectedYearId,
      materias_reprobatorias_promocion: Math.round(rawVal)
    })
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar el criterio de promoción')
  } finally {
    promotionSaving.value = false
  }
}

const saveManualScales = async () => {
  if (defaultsSaving.value) return
  if (isYearClosed.value) {
    alert(`El año lectivo ${yearStore.selectedYear?.calendario || ''} está CERRADO. No es posible modificar las escalas en un ciclo escolar cerrado.`)
    return
  }
  if (manualScaleForm.value.basico_max === '' || manualScaleForm.value.alto_max === '') {
    alert('Define los cortes máximos de BASICO y ALTO para el modo manual.')
    return
  }

  try {
    defaultsSaving.value = true
    await axios.put('/api/academic-admin/settings/scales/manual', {
      schoolId: schoolId.value,
      yearId: yearStore.selectedYearId,
      basico_max: Number(manualScaleForm.value.basico_max),
      alto_max: Number(manualScaleForm.value.alto_max),
    })
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible guardar las escalas manuales')
  } finally {
    defaultsSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-8 animate-fade-in pb-12">
    <!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <RouterLink to="/admin/configuracion" class="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest">
            <ArrowLeft class="w-3.5 h-3.5" />
            Volver a Configuración
          </RouterLink>
        </div>
        <h1 class="text-3xl font-black text-slate-900 dark:text-white">Escalas y Rango de Notas</h1>
        <p class="mt-1 text-slate-500 dark:text-slate-400">Configura el rango global de la institución, las escalas valorativas y el criterio de promoción S.I.E.E.</p>
      </div>
    </div>

    <!-- Alerta Informativa: Año Lectivo Cerrado (Modo Solo Lectura) -->
    <div v-if="isYearClosed" class="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-3xl flex items-start gap-3.5 text-xs text-amber-900 dark:text-amber-300 shadow-sm">
      <Lock class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div class="space-y-1">
        <p class="font-bold text-amber-950 dark:text-amber-200 text-sm">🔒 Año Lectivo {{ yearStore.selectedYear?.calendario || '' }} (Modo Solo Lectura)</p>
        <p>
          El año lectivo seleccionado se encuentra <strong>CERRADO</strong>. Los parámetros institucionales y las escalas de valoración de este ciclo escolar permanecen bloqueados y no pueden ser modificados.
        </p>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500">
      Cargando configuración...
    </div>

    <div v-else class="grid grid-cols-1 gap-8 xl:grid-cols-2">
      <!-- Columna Izquierda: Rango de Notas y Criterio de Promoción -->
      <div class="space-y-8">
        <!-- Tarjeta 1: Rango de Calificación y Escalas -->
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                <SlidersHorizontal class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white">Rango Institucional de Calificación</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">Define el espectro numérico y la nota mínima de aprobación.</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-5 p-6 sm:grid-cols-3">
            <label class="flex flex-col justify-between space-y-2">
              <span class="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 ml-1">Nota mínima</span>
              <input v-model="defaultsForm.nota_minima" :disabled="isYearClosed" type="number" step="0.1" :class="[isYearClosed ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : 'bg-slate-50 dark:bg-slate-800']" class="w-full rounded-2xl border border-slate-200 p-3.5 font-semibold outline-none dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-amber-500/20" />
            </label>
            <label class="flex flex-col justify-between space-y-2">
              <span class="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 ml-1">Nota máxima</span>
              <input v-model="defaultsForm.nota_maxima" :disabled="isYearClosed" type="number" step="0.1" :class="[isYearClosed ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : 'bg-slate-50 dark:bg-slate-800']" class="w-full rounded-2xl border border-slate-200 p-3.5 font-semibold outline-none dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-amber-500/20" />
            </label>
            <label class="flex flex-col justify-between space-y-2">
              <span class="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 ml-1">Nota aprobatoria</span>
              <input v-model="defaultsForm.nota_aprobacion" :disabled="isYearClosed" type="number" step="0.1" :class="[isYearClosed ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : 'bg-slate-50 dark:bg-slate-800']" class="w-full rounded-2xl border border-slate-200 p-3.5 font-semibold outline-none dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-amber-500/20" />
            </label>
          </div>

          <div class="border-t border-slate-100 px-6 py-6 dark:border-slate-800">
            <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Modo de cálculo de escalas</span>
            <div class="mt-4 flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                :disabled="isYearClosed"
                @click="defaultsForm.escala_modo = 'AUTOMATICO'"
                :class="[defaultsForm.escala_modo === 'AUTOMATICO' ? 'border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/50' : 'border-slate-200 bg-white text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400', isYearClosed ? 'opacity-60 cursor-not-allowed pointer-events-none' : '', 'rounded-2xl border px-5 py-4 text-left text-sm font-black transition flex-1 cursor-pointer']"
              >
                Automático por sistema
              </button>
              <button
                type="button"
                :disabled="isYearClosed"
                @click="defaultsForm.escala_modo = 'MANUAL'"
                :class="[defaultsForm.escala_modo === 'MANUAL' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50' : 'border-slate-200 bg-white text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400', isYearClosed ? 'opacity-60 cursor-not-allowed pointer-events-none' : '', 'rounded-2xl border px-5 py-4 text-left text-sm font-black transition flex-1 cursor-pointer']"
              >
                Manual por directivo
              </button>
            </div>
            <p class="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              El modo automático distribuye las escalas de forma equitativa con base en el rango institucional. El modo manual te permite ajustar los cortes internos.
            </p>
          </div>

          <div class="border-t border-slate-100 px-6 py-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                Afecta directamente la ponderación y cálculo de notas en el sistema.
              </p>
              <button 
                type="button" 
                @click="() => saveDefaultSettings()" 
                :disabled="defaultsSaving || isYearClosed" 
                :class="[isYearClosed ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60' : 'bg-amber-500 hover:bg-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500 cursor-pointer']"
                class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-black text-white shadow-sm transition disabled:opacity-50 uppercase tracking-widest shrink-0"
              >
                <Lock v-if="isYearClosed" class="h-4 w-4" />
                <PenSquare v-else class="h-4 w-4" />
                {{ isYearClosed ? 'Año Cerrado' : (defaultsSaving ? 'Guardando...' : 'Guardar rango y escalas') }}
              </button>
            </div>
          </div>
        </section>

        <!-- Tarjeta 2: Criterio de Promoción Escolar (S.I.E.E. - Decreto 1290) -->
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                <GraduationCap class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white">Criterio de Promoción Anual (S.I.E.E.)</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">Directrices del Sistema Institucional de Evaluación de los Estudiantes (Decreto 1290).</p>
              </div>
            </div>
          </div>

          <div class="p-6 space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Materias reprobatorias para no promoción</span>
                  <HelpCircle class="h-4 w-4 text-emerald-600 dark:text-emerald-400 cursor-help" title="Número mínimo de asignaturas con desempeño BAJO que ocasionan la no promoción del estudiante al grado siguiente." />
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Si un alumno reprueba este número o más de asignaturas al cierre del año, su estado de promoción será <strong>REPROBADO</strong>.
                </p>
              </div>

              <div class="w-full sm:w-32 shrink-0">
                <input 
                  v-model="promotionForm.materias_reprobatorias_promocion" 
                  :disabled="isYearClosed" 
                  type="number" 
                  min="1" 
                  max="10" 
                  step="1" 
                  :class="[isYearClosed ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : 'bg-white dark:bg-slate-800']" 
                  class="w-full rounded-2xl border border-emerald-200 dark:border-emerald-800 p-3.5 text-center font-black text-lg outline-none dark:text-white focus:ring-2 focus:ring-emerald-500/30" 
                  placeholder="3" 
                />
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 px-6 py-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                Utilizado exclusivamente en el Seguimiento Académico y actas de promoción.
              </p>
              <button 
                type="button" 
                @click="savePromotionPolicy" 
                :disabled="promotionSaving || isYearClosed" 
                :class="[isYearClosed ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60' : 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer']"
                class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-black text-white shadow-sm transition disabled:opacity-50 uppercase tracking-widest shrink-0"
              >
                <Lock v-if="isYearClosed" class="h-4 w-4" />
                <CheckCircle2 v-else class="h-4 w-4" />
                {{ isYearClosed ? 'Año Cerrado' : (promotionSaving ? 'Guardando...' : 'Guardar criterio de promoción') }}
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- Columna Derecha: Escalas de Valoración (Automático / Manual) -->
      <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div class="border-b border-slate-100 p-6 dark:border-slate-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                <Scale class="h-6 w-6" />
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white">Escalas de Valoración Vigentes</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {{ defaultsForm.escala_modo === 'MANUAL' ? 'Ajusta los cortes internos. El sistema protege continuidad y cobertura total.' : 'Generadas automáticamente para el rango institucional.' }}
                </p>
              </div>
            </div>
            <div :class="[defaultsForm.escala_modo === 'MANUAL' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400', 'rounded-2xl px-4 py-3 text-[10px] uppercase font-black tracking-widest shrink-0']">
              {{ defaultsForm.escala_modo === 'MANUAL' ? 'Modo manual' : 'Modo automático' }}
            </div>
          </div>
        </div>

        <div v-if="defaultsForm.escala_modo === 'MANUAL'" class="border-b border-slate-100 bg-amber-50/60 px-6 py-5 dark:bg-amber-950/10 dark:border-slate-800">
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Máximo de BASICO</span>
              <input v-model="manualScaleForm.basico_max" :disabled="isYearClosed" type="number" step="0.1" :class="[isYearClosed ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : 'bg-white dark:bg-slate-800']" class="w-full rounded-2xl border border-amber-200 p-4 font-semibold outline-none dark:border-amber-900/30 dark:text-white focus:ring-2 focus:ring-amber-500/20" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Máximo de ALTO</span>
              <input v-model="manualScaleForm.alto_max" :disabled="isYearClosed" type="number" step="0.1" :class="[isYearClosed ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : 'bg-white dark:bg-slate-800']" class="w-full rounded-2xl border border-amber-200 p-4 font-semibold outline-none dark:border-amber-900/30 dark:text-white focus:ring-2 focus:ring-amber-500/20" />
            </label>
          </div>
          <div class="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-400 italic max-w-xs">
              BAJO y SUPERIOR se recalibran para cubrir todo el espectro institucional.
            </p>
            <button type="button" @click="saveManualScales" :disabled="defaultsSaving || isYearClosed" :class="[isYearClosed ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60' : 'bg-amber-600 hover:bg-amber-500']" class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white shadow-sm transition disabled:opacity-50 uppercase tracking-widest">
              <Lock v-if="isYearClosed" class="h-4 w-4" />
              <PenSquare v-else class="h-4 w-4" />
              {{ isYearClosed ? 'Año Cerrado (Solo Lectura)' : (defaultsSaving ? 'Guardando...' : 'Aplicar cortes') }}
            </button>
          </div>
        </div>

        <div v-if="scales.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-600">
          No hay escalas de valoración configuradas.
        </div>

        <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="scale in scales" :key="scale.id_escalavaloracion" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div>
              <p class="text-base font-black text-slate-900 dark:text-white">{{ scale.nivel }}</p>
              <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Rango: <span class="text-slate-900 dark:text-white font-black">{{ Number(scale.valor_minimo).toFixed(1) }}</span> - <span class="text-slate-900 dark:text-white font-black">{{ Number(scale.valor_maximo).toFixed(1) }}</span></p>
              <p class="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ scale.notas_count }} relaciones académicas</p>
            </div>
            <div :class="[defaultsForm.escala_modo === 'MANUAL' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', 'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest']">
              {{ defaultsForm.escala_modo === 'MANUAL' ? 'Corte manual' : 'Automático' }}
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Modal de Confirmación de Rescalado -->
    <div v-if="showConfirmModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 transition-all">
      <div class="w-full max-w-lg rounded-[2.5rem] bg-white p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-300 dark:bg-slate-900 dark:border-slate-800">
        <div class="flex items-center gap-5 mb-8">
          <div class="h-16 w-16 rounded-[2rem] bg-amber-50 flex items-center justify-center text-amber-500 dark:bg-amber-950/30 dark:text-amber-400 shadow-inner">
            <Scale class="h-8 w-8" />
          </div>
          <div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Aviso de Rescalado</h3>
            <p class="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-1">Acción crítica detectada</p>
          </div>
        </div>
        
        <p class="text-slate-600 dark:text-slate-400 leading-relaxed font-semibold text-lg">
          {{ confirmMessage }}
        </p>

        <div class="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
          <button 
            type="button" 
            @click="showConfirmModal = false; pendingSettings = null"
            class="px-8 py-4 rounded-2xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            @click="saveDefaultSettings(true)"
            class="px-10 py-4 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-xl hover:bg-slate-800 transition-all dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 uppercase tracking-widest cursor-pointer"
          >
            Confirmar y Rescalar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
