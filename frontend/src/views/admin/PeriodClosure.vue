<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { ArrowLeft, CheckCircle2, Lock, Unlock, SlidersHorizontal, AlertCircle, Search } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { getCourseDisplayName } from '../../utils/courseHelper'

import { useAcademicYearStore } from '../../stores/academicYear'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const detailsLoading = ref(false)

const periods = ref<any[]>([])
const selectedPeriodId = ref<number | null>(null)
const periodDetails = ref<any>(null)
const teachers = ref<any[]>([])

const filterStatus = ref<'TODOS' | 'PENDIENTE' | 'CERRADO'>('TODOS')
const searchQuery = ref('')

const filteredAssignments = computed(() => {
  const list: any[] = []
  if (!teachers.value) return []
  
  teachers.value.forEach(t => {
    if (t.asignaciones) {
      t.asignaciones.forEach((a: any) => {
        list.push({
          id_detallegrado: a.id_detallegrado,
          id_docente: t.id_docente,
          docente_nombre: t.docente_nombre,
          docente_email: t.docente_email,
          materia_nombre: a.materia_nombre,
          grado: a.grado,
          estado: a.estado
        })
      })
    }
  })

  let res = list
  if (filterStatus.value !== 'TODOS') {
    res = res.filter(a => a.estado === filterStatus.value)
  }

  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    res = res.filter(a => 
      a.docente_nombre.toLowerCase().includes(q) ||
      a.materia_nombre.toLowerCase().includes(q) ||
      a.grado.toLowerCase().includes(q)
    )
  }

  return res
})

const closingPeriod = ref(false)
const closePeriodPending = ref<any[]>([])
const forceCloseModal = ref(false)

const loadInitialData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const params: any = {}
    if (yearStore.selectedYearId) {
      params.yearId = yearStore.selectedYearId
    }
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`, { params })
    periods.value = (response.data.periods || []).filter((p: any) => p.estado !== 'PENDIENTE')
    const openPeriod = periods.value.find(p => p.estado === 'ABIERTO')
    if (openPeriod) {
      selectedPeriodId.value = openPeriod.id_periodo
    } else if (periods.value.length > 0) {
      selectedPeriodId.value = periods.value[0].id_periodo
    } else {
      selectedPeriodId.value = null
      periodDetails.value = null
      teachers.value = []
    }
  } catch (error) {
    console.error('Error loading periods:', error)
  } finally {
    loading.value = false
  }
}

watch(() => yearStore.selectedYearId, () => {
  loadInitialData()
})

const loadClosureDetails = async () => {
  if (!schoolId.value || !selectedPeriodId.value) return
  try {
    detailsLoading.value = true
    closePeriodPending.value = []
    forceCloseModal.value = false
    const response = await axios.get(
      `http://localhost:3000/api/academic-admin/settings/closure-details/${schoolId.value}/${selectedPeriodId.value}`
    )
    periodDetails.value = response.data.periodo
    teachers.value = response.data.teachers
  } catch (error) {
    console.error('Error loading closure details:', error)
    periodDetails.value = null
    teachers.value = []
  } finally {
    detailsLoading.value = false
  }
}

watch(selectedPeriodId, () => {
  if (selectedPeriodId.value) {
    loadClosureDetails()
  }
})

const totalPending = computed(() => {
  let count = 0
  teachers.value.forEach(t => {
    t.asignaciones.forEach((a: any) => {
      if (a.estado !== 'CERRADO') count++
    })
  })
  return count
})

const totalClosed = computed(() => {
  let count = 0
  teachers.value.forEach(t => {
    count += t.cerradas
  })
  return count
})

const attemptClosePeriod = async (force = false) => {
  if (!selectedPeriodId.value) return
  try {
    closingPeriod.value = true
    await axios.post(`http://localhost:3000/api/academic-admin/settings/periods/${selectedPeriodId.value}/close`, {
      schoolId: schoolId.value,
      force,
    })
    
    forceCloseModal.value = false
    closePeriodPending.value = []
    
    // Refresh periods and details
    if (periodDetails.value) {
      periodDetails.value.estado = 'CERRADO'
    }
    const targetPeriod = periods.value.find(p => p.id_periodo === selectedPeriodId.value)
    if (targetPeriod) targetPeriod.estado = 'CERRADO'
    
    await loadClosureDetails()
  } catch (error: any) {
    if (error.response?.status === 409 && error.response?.data?.pending) {
      forceCloseModal.value = true
      closePeriodPending.value = error.response.data.pending
      return
    }
    alert(error.response?.data?.error || 'No fue posible cerrar el periodo')
  } finally {
    closingPeriod.value = false
  }
}

const reopeningPeriod = ref(false)

const attemptReopenPeriod = async () => {
  if (!selectedPeriodId.value) return
  if (!confirm('¿Estás seguro de que deseas REABRIR el periodo académico? Esto cambiará globalmente el periodo de nuevo a ABIERTO.')) return
  
  try {
    reopeningPeriod.value = true
    await axios.post(`http://localhost:3000/api/academic-admin/settings/periods/${selectedPeriodId.value}/reopen`, {
      schoolId: schoolId.value
    })
    
    if (periodDetails.value) {
      periodDetails.value.estado = 'ABIERTO'
    }
    const targetPeriod = periods.value.find(p => p.id_periodo === selectedPeriodId.value)
    if (targetPeriod) targetPeriod.estado = 'ABIERTO'
    
    await loadClosureDetails()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible reabrir el periodo')
  } finally {
    reopeningPeriod.value = false
  }
}

const reopeningSubject = ref<number | null>(null)

const attemptReopenSubject = async (curso: any) => {
  if (!selectedPeriodId.value) return
  if (!confirm(`¿Estás seguro de que deseas DESHACER el cierre de ${curso.grado}? El docente podrá volver a modificar e ingresar notas.`)) return
  
  try {
    reopeningSubject.value = curso.id_detallegrado
    await axios.post(`http://localhost:3000/api/academic-admin/settings/periods/${selectedPeriodId.value}/reopen-subject/${curso.id_detallegrado}`, {
      schoolId: schoolId.value
    })
    
    await loadClosureDetails()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible deshacer el cierre de esta materia.')
  } finally {
    reopeningSubject.value = null
  }
}

onMounted(() => {
  loadInitialData()
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    
    <div class="flex items-center gap-4">
      <router-link to="/dashboard/configuracion-academica" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-100 dark:border-slate-800">
        <ArrowLeft class="h-5 w-5" />
      </router-link>
      <div>
        <h1 class="text-3xl font-black text-slate-900 dark:text-white">Control de Cierre de Periodo</h1>
        <p class="mt-1 text-slate-500 dark:text-slate-400">Supervisa qué docentes han finalizado la carga académica y ejecuta cierres formales de notas.</p>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 text-center font-bold text-slate-400 shadow-sm">
      Cargando configuración...
    </div>

    <template v-else>
      <div class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div class="border-b border-slate-100 dark:border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-3 text-rose-600 dark:text-rose-400">
              <Lock class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white">Seleccionar periodo</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Puedes ver estados y forzar el cierre del periodo en curso.</p>
            </div>
          </div>
          <select 
            v-model="selectedPeriodId"
            class="min-w-[200px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 font-black text-slate-900 dark:text-slate-100 outline-none focus:border-rose-300 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-shadow"
          >
            <option :value="null">Selecciona un periodo</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }} ({{ p.estado }})
            </option>
          </select>
        </div>

        <div v-if="selectedPeriodId && !detailsLoading" class="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-900/50">
          
          <div v-if="periodDetails" class="mb-8 flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
            <div class="flex gap-4">
              <div class="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
                <span class="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total asignaciones</span>
                <span class="text-2xl font-black text-slate-900 dark:text-white">{{ teachers.reduce((sum, t) => sum + t.total_asignaciones, 0) }}</span>
              </div>
              <div class="flex flex-col rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-5 py-4 shadow-sm text-rose-900 dark:text-rose-100">
                <span class="text-[11px] font-black uppercase tracking-widest text-rose-500 dark:text-rose-400">Módulos cerrados</span>
                <span class="text-2xl font-black text-rose-700 dark:text-rose-300">{{ totalClosed }}</span>
              </div>
              <div class="flex flex-col rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 shadow-sm text-amber-900 dark:text-amber-100">
                <span class="text-[11px] font-black uppercase tracking-widest text-amber-500 dark:text-amber-400">Faltantes</span>
                <span class="text-2xl font-black text-amber-700 dark:text-amber-300">{{ totalPending }}</span>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2 mr-2">
                <span class="h-3 w-3 rounded-full bg-emerald-500" v-if="periodDetails.estado === 'ABIERTO'"></span>
                <span class="h-3 w-3 rounded-full bg-amber-500" v-else-if="periodDetails.estado === 'PENDIENTE'"></span>
                <span class="h-3 w-3 rounded-full bg-slate-400 dark:bg-slate-500" v-else></span>
                <span 
                  class="text-sm font-black tracking-wide" 
                  :class="[
                    periodDetails.estado === 'ABIERTO' ? 'text-emerald-700 dark:text-emerald-400' : 
                    periodDetails.estado === 'PENDIENTE' ? 'text-amber-700 dark:text-amber-400' : 
                    'text-slate-700 dark:text-slate-300'
                  ]"
                >
                  PERIODO {{ periodDetails.estado }}
                </span>
              </div>

              <template v-if="periodDetails.estado === 'ABIERTO'">
                <button
                  type="button"
                  @click="attemptClosePeriod(false)"
                  :disabled="closingPeriod"
                  class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-rose-500 disabled:opacity-50 hover:shadow-rose-600/20"
                >
                  <Lock class="h-4 w-4" />
                  {{ closingPeriod ? 'Procesando...' : 'Proceder con Cierre' }}
                </button>
              </template>
              <template v-else-if="periodDetails.estado === 'PENDIENTE'">
                <div class="flex flex-col sm:flex-row items-center gap-4">
                  <div class="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl text-amber-700 dark:text-amber-400 font-bold text-xs flex gap-2 items-center border border-amber-200 dark:border-amber-900/40">
                    <AlertCircle class="w-5 h-5 shrink-0" />
                    <span>Periodo pendiente de aprobación. No se pueden gestionar cierres.</span>
                  </div>
                  <router-link
                    to="/dashboard/configuracion-academica/periodos"
                    class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-black text-white hover:bg-amber-600 transition-all shadow-md shadow-amber-200/50 dark:shadow-none"
                  >
                    <span>Configurar y Aprobar</span>
                  </router-link>
                </div>
              </template>
              <template v-else>
                <div class="px-5 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 font-bold text-sm flex gap-2 items-center border border-slate-200 dark:border-slate-700">
                  <CheckCircle2 class="w-5 h-5" />
                  Cierre Completado
                </div>
                <button
                  type="button"
                  @click="attemptReopenPeriod"
                  :disabled="reopeningPeriod"
                  class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-slate-700 px-6 py-3 text-sm font-black transition-all hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50 ring-1 ring-inset ring-slate-200 hover:ring-amber-200"
                  title="Permite volver a recibir correcciones temporalmente"
                >
                  <Unlock class="h-4 w-4" />
                  {{ reopeningPeriod ? 'Abriendo...' : 'Reabrir Periodo' }}
                </button>
              </template>
            </div>
          </div>

          <div v-if="teachers.length === 0" class="text-center py-20 opacity-60">
            <SlidersHorizontal class="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 class="text-lg font-bold text-slate-600 dark:text-slate-300">Sin carga académica</h3>
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">No hay docentes asignados en este periodo.</p>
          </div>

          <div v-else class="space-y-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 class="text-lg font-black text-slate-900 dark:text-white px-1">Progreso por Docente</h2>
              
              <div class="flex flex-col sm:flex-row items-center gap-3">
                <div class="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl w-full sm:w-auto">
                  <button 
                    @click="filterStatus = 'TODOS'"
                    class="px-4 py-2 rounded-xl text-[13px] font-bold transition-all w-full sm:w-auto"
                    :class="filterStatus === 'TODOS' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'"
                  >Todos</button>
                  <button 
                    @click="filterStatus = 'PENDIENTE'"
                    class="px-4 py-2 rounded-xl text-[13px] font-bold transition-all w-full sm:w-auto"
                    :class="filterStatus === 'PENDIENTE' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600/70 dark:text-amber-500/70 hover:text-amber-700 dark:hover:text-amber-400'"
                  >Pendientes</button>
                  <button 
                    @click="filterStatus = 'CERRADO'"
                    class="px-4 py-2 rounded-xl text-[13px] font-bold transition-all w-full sm:w-auto"
                    :class="filterStatus === 'CERRADO' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600/70 dark:text-emerald-500/70 hover:text-emerald-700 dark:hover:text-emerald-400'"
                  >Cerrados</button>
                </div>

                <div class="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 hover:border-slate-300 dark:hover:border-slate-600 transition-colors focus-within:ring-4 focus-within:ring-rose-500/10 focus-within:border-rose-300 dark:focus-within:border-rose-500 w-full md:w-80">
                  <Search class="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Buscar docente o materia..."
                    class="bg-transparent border-none outline-none w-full text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-1"
                  />
                </div>
              </div>
            </div>
            
            <div v-if="filteredAssignments.length === 0" class="text-center py-16 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
              <Search class="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-4" />
              <h3 class="text-lg font-bold text-slate-600 dark:text-slate-300">No se encontraron resultados</h3>
              <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Intenta ajustando tu término de búsqueda o filtros. "{{ searchQuery }}"</p>
            </div>

            <div v-else class="overflow-x-auto bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Docente</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Asignatura / Materia</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Curso / Grupo</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center">Estado</th>
                    <th class="p-5 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50 dark:divide-slate-700/50">
                  <tr 
                    v-for="asig in filteredAssignments" 
                    :key="asig.id_detallegrado"
                    class="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group"
                  >
                    <td class="p-5">
                      <div class="font-extrabold text-slate-900 dark:text-slate-100">
                        {{ asig.docente_nombre }}
                      </div>
                      <div class="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                        {{ asig.docente_email }}
                      </div>
                    </td>
                    <td class="p-5">
                      <span class="font-bold text-slate-700 dark:text-slate-300">
                        {{ asig.materia_nombre }}
                      </span>
                    </td>
                    <td class="p-5">
                      <span class="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl px-3 py-1.5 text-xs border border-indigo-100/30">
                        {{ asig.grado }}
                      </span>
                    </td>
                    <td class="p-5 text-center">
                      <span 
                        class="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full ring-1 ring-inset"
                        :class="asig.estado === 'CERRADO' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-500/20' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 ring-rose-500/20'"
                      >
                        {{ asig.estado }}
                      </span>
                    </td>
                    <td class="p-5 text-right">
                      <div class="flex justify-end items-center gap-2">
                        <button
                          v-if="asig.estado === 'CERRADO'"
                          @click="attemptReopenSubject(asig)"
                          :disabled="reopeningSubject === asig.id_detallegrado"
                          class="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 hover:bg-amber-100 transition-all dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40 disabled:opacity-50 border border-amber-200/30 cursor-pointer"
                          title="Habilitar docente para modificar e ingresar calificaciones"
                        >
                          <Unlock class="w-3.5 h-3.5" />
                          <span>Habilitar</span>
                        </button>
                        <span v-else class="text-xs font-bold text-slate-400 dark:text-slate-500 italic pr-3 select-none">
                          No requiere acción
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div v-else-if="detailsLoading" class="p-16 text-center text-slate-400 font-bold">
          Obteniendo estado de cierres...
        </div>
      </div>
    </template>

    <!-- Force Close Modal -->
    <div v-if="forceCloseModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md">
      <div class="w-full max-w-2xl rounded-[28px] bg-white dark:bg-slate-900 shadow-2xl">
        <div class="border-b border-slate-100 dark:border-slate-800 px-6 py-5 md:px-8">
          <div class="flex gap-3 items-center text-rose-600 dark:text-rose-500 mb-2">
            <AlertCircle class="w-8 h-8" />
            <h2 class="text-2xl font-black text-slate-900 dark:text-white">Cierre Forzado Requerido</h2>
          </div>
          <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Aún existen {{ closePeriodPending.length }} asignaciones que los docentes no han marcado como completadas.
          </p>
        </div>
        <div class="px-6 py-6 md:px-8 md:py-8">
          
          <div class="rounded-3xl border border-rose-100 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-5 mb-6">
            <p class="text-sm font-black text-rose-800 dark:text-rose-300">
              Si procedes, el sistema insertará registros de cierre forzoso en cada una de las materias listadas. Esto bloqueará la posibilidad de que los docentes implicados suban notas o modifiquen su registro posteriormente.
            </p>
          </div>

          <div class="max-h-60 overflow-y-auto pr-2 space-y-3">
            <div v-for="item in closePeriodPending" :key="item.id_detallegrado" class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm">
              <div>
                <p class="font-black text-slate-700 dark:text-slate-200">{{ item.materia_nombre }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">{{ getCourseDisplayName({ tipo_grado_nombre: item.tipo_grado_nombre, seccion_nombre: item.seccion_nombre }) }} · {{ item.jornada_nombre }}</p>
              </div>
              <span class="inline-flex bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider">Pendiente</span>
            </div>
          </div>

          <div class="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
            <button type="button" @click="forceCloseModal = false" class="rounded-2xl border border-slate-200 dark:border-slate-700 px-6 py-4 text-sm font-black text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button type="button" @click="attemptClosePeriod(true)" :disabled="closingPeriod" class="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-8 py-4 text-base font-black text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50">
              <Lock class="w-5 h-5" />
              {{ closingPeriod ? 'Procesando...' : 'Confirmar Cierre Forzado' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
