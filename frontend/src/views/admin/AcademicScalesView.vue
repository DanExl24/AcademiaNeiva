<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { ArrowLeft, PenSquare, Scale, SlidersHorizontal } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface SchoolDefaultSettings {
  nota_minima: number
  nota_maxima: number
  nota_aprobacion: number
  escala_modo: 'AUTOMATICO' | 'MANUAL'
}

interface ValuationScale {
  id_escalavaloracion: number
  nivel: string
  valor_minimo: number
  valor_maximo: number
  notas_count: number
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const defaultsSaving = ref(false)

const scales = ref<ValuationScale[]>([])
const defaultSettings = ref<SchoolDefaultSettings | null>(null)

const defaultsForm = ref({
  nota_minima: '',
  nota_maxima: '',
  nota_aprobacion: '',
  escala_modo: 'AUTOMATICO' as 'AUTOMATICO' | 'MANUAL',
})

const manualScaleForm = ref({
  basico_max: '',
  alto_max: '',
})

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`)
    scales.value = response.data.scales || []
    defaultSettings.value = response.data.defaultSettings || null
    
    if (response.data.defaultSettings) {
      defaultsForm.value = {
        nota_minima: String(response.data.defaultSettings.nota_minima),
        nota_maxima: String(response.data.defaultSettings.nota_maxima),
        nota_aprobacion: String(response.data.defaultSettings.nota_aprobacion),
        escala_modo: response.data.defaultSettings.escala_modo || 'AUTOMATICO',
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
    console.error('Error loading academic settings:', error)
  } finally {
    loading.value = false
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

onMounted(loadData)
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div class="flex items-center gap-4">
      <router-link to="/dashboard/configuracion-academica" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 border border-slate-100">
        <ArrowLeft class="h-5 w-5" />
      </router-link>
      <div>
        <h1 class="text-3xl font-black text-slate-900">Escalas y Rango de Notas</h1>
        <p class="mt-1 text-slate-500">Configura el rango global de la institución y define cómo se calculan las escalas valorativas.</p>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm">
      Cargando configuración...
    </div>

    <div v-else class="grid grid-cols-1 gap-8 xl:grid-cols-2">
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
  </div>
</template>
