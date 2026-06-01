<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { BookMarked, Scale, SlidersHorizontal } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface AcademicYear {
  id_año: number
  calendario: string | null
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const currentYear = ref<AcademicYear | null>(null)

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`)
    currentYear.value = response.data.currentYear
  } catch (error) {
    console.error('Error loading academic settings:', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
        
        <router-link
          to="/dashboard/configuracion-academica/periodos"
          class="group overflow-hidden rounded-3xl border border-sky-100 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_38%),linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_48%,#bae6fd_100%)] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div class="flex h-full flex-col justify-between gap-6">
            <div>
              <div class="inline-flex rounded-2xl bg-sky-600 p-3 text-white shadow-sm">
                <BookMarked class="h-6 w-6" />
              </div>
              <h2 class="mt-5 text-2xl font-black text-slate-900">Módulo de Años y Periodos</h2>
              <p class="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Abre la vista especializada para agregar años lectivos, y configurar los periodos junto con sus pesos porcentuales y rangos de fechas.
              </p>
            </div>

            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div class="flex flex-wrap gap-3">
                <span class="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-sky-700 shadow-sm">
                  Configuración primaria
                </span>
              </div>
              <span class="inline-flex items-center gap-2 text-sm font-black text-sky-700 transition group-hover:translate-x-1">
                Abrir módulo
              </span>
            </div>
          </div>
        </router-link>

        <router-link
          to="/dashboard/configuracion-academica/escalas"
          class="group overflow-hidden rounded-3xl border border-indigo-100 bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.14),_transparent_38%),linear-gradient(135deg,#f5f6ff_0%,#eef2ff_48%,#e0e7ff_100%)] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div class="flex h-full flex-col justify-between gap-6">
            <div>
              <div class="inline-flex rounded-2xl bg-indigo-600 p-3 text-white shadow-sm">
                <Scale class="h-6 w-6" />
              </div>
              <h2 class="mt-5 text-2xl font-black text-slate-900">Módulo de Escalas Valorativas</h2>
              <p class="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Ajusta el rango global de notas del colegio y define manualmente o por el sistema las escalas numéricas para calificación y aprobación.
              </p>
            </div>

            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div class="flex flex-wrap gap-3">
                <span class="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-indigo-700 shadow-sm">
                  Cortes personalizados
                </span>
              </div>
              <span class="inline-flex items-center gap-2 text-sm font-black text-indigo-700 transition group-hover:translate-x-1">
                Configurar escalas
              </span>
            </div>
          </div>
        </router-link>

        <router-link
          to="/dashboard/configuracion-academica/competencias"
          class="group overflow-hidden rounded-3xl border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(135deg,#f7fff9_0%,#ecfdf5_48%,#d1fae5_100%)] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div class="flex h-full flex-col justify-between gap-6">
            <div>
              <div class="inline-flex rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
                <SlidersHorizontal class="h-6 w-6" />
              </div>
              <h2 class="mt-5 text-2xl font-black text-slate-900">Módulo de Competencias</h2>
              <p class="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Abre la vista especializada para asignar y actualizar competencias por materia, curso y periodo sin mezclar esa gestión.
              </p>
            </div>

            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div class="flex flex-wrap gap-3">
                <span class="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-emerald-700 shadow-sm">
                  Gestión jerárquica
                </span>
              </div>
              <span class="inline-flex items-center gap-2 text-sm font-black text-emerald-700 transition group-hover:translate-x-1">
                Abrir módulo
              </span>
            </div>
          </div>
        </router-link>

        <router-link
          to="/dashboard/configuracion-academica/cierres"
          class="group overflow-hidden rounded-3xl border border-rose-100 bg-[radial-gradient(circle_at_top_left,_rgba(225,29,72,0.14),_transparent_38%),linear-gradient(135deg,#fff8f9_0%,#fff1f2_48%,#ffe4e6_100%)] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div class="flex h-full flex-col justify-between gap-6">
            <div>
              <div class="inline-flex rounded-2xl bg-rose-600 p-3 text-white shadow-sm">
                <BookMarked class="h-6 w-6" />
              </div>
              <h2 class="mt-5 text-2xl font-black text-slate-900">Módulo de Cierres Académicos</h2>
              <p class="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Accede a la vista dedicada para revisar el progreso de cierre de los docentes y efectuar el cierre oficial del periodo académico.
              </p>
            </div>

            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div class="flex flex-wrap gap-3">
                <span class="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-rose-700 shadow-sm">
                  Supervisión global
                </span>
              </div>
              <span class="inline-flex items-center gap-2 text-sm font-black text-rose-700 transition group-hover:translate-x-1">
                Abrir módulo
              </span>
            </div>
          </div>
        </router-link>
      </div>
    </template>
  </div>
</template>
