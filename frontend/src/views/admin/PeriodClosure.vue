<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { ArrowLeft, CheckCircle2, Lock, Unlock, FileX, SlidersHorizontal, AlertCircle, Search, ChevronDown } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const detailsLoading = ref(false)

const periods = ref<any[]>([])
const selectedPeriodId = ref<number | null>(null)
const periodDetails = ref<any>(null)
const teachers = ref<any[]>([])

const expandedTeachers = ref(new Set<number>())
const toggleTeacher = (id: number) => {
  if (expandedTeachers.value.has(id)) {
    expandedTeachers.value.delete(id)
  } else {
    expandedTeachers.value.add(id)
  }
}

const filterStatus = ref<'TODOS' | 'PENDIENTE' | 'CERRADO'>('TODOS')

const searchQuery = ref('')
const filteredTeachers = computed(() => {
  if (!teachers.value) return []
  const q = (searchQuery.value || '').toLowerCase()
  
  return teachers.value.map(t => {
    let filteredAsig = t.asignaciones;
    if (filterStatus.value !== 'TODOS') {
      filteredAsig = filteredAsig.filter((a: any) => a.estado === filterStatus.value)
    }

    const teacherMatch = t.docente_nombre.toLowerCase().includes(q) || (t.docente_email && t.docente_email.toLowerCase().includes(q))
    
    if (!teacherMatch && q) {
      filteredAsig = filteredAsig.filter((a: any) => 
        a.materia_nombre.toLowerCase().includes(q) ||
        (a.grado && a.grado.toLowerCase().includes(q))
      )
    }
    
    if (filteredAsig.length === 0 && (!teacherMatch || filterStatus.value !== 'TODOS' || q)) {
      return null;
    }
    
    const materiasMap = new Map<string, any[]>()
    filteredAsig.forEach((a: any) => {
      if (!materiasMap.has(a.materia_nombre)) {
        materiasMap.set(a.materia_nombre, [])
      }
      materiasMap.get(a.materia_nombre)!.push(a)
    })
    
    const materias = Array.from(materiasMap.entries()).map(([nombre, cursos]) => ({
      nombre,
      cursos
    }))
    
    return {
      ...t,
      filteredMaterias: materias,
      visibleAsigCount: filteredAsig.length
    }
  }).filter(t => t !== null)
})

const closingPeriod = ref(false)
const closePeriodPending = ref<any[]>([])
const forceCloseModal = ref(false)

const loadInitialData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`)
    periods.value = response.data.periods
    const openPeriod = periods.value.find(p => p.estado === 'ABIERTO')
    if (openPeriod) {
      selectedPeriodId.value = openPeriod.id_periodo
    }
  } catch (error) {
    console.error('Error loading periods:', error)
  } finally {
    loading.value = false
  }
}

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
                <span class="h-3 w-3 rounded-full bg-slate-400 dark:bg-slate-500" v-else></span>
                <span class="text-sm font-black tracking-wide" :class="periodDetails.estado === 'ABIERTO' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'">PERIODO {{ periodDetails.estado }}</span>
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
            
            <div v-if="filteredTeachers.length === 0" class="text-center py-16 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
              <Search class="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-4" />
              <h3 class="text-lg font-bold text-slate-600 dark:text-slate-300">No se encontraron resultados</h3>
              <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Intenta ajustando tu término de búsqueda. "{{ searchQuery }}"</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <!-- Teacher Cards -->
              <div 
                v-for="teacher in filteredTeachers" 
                :key="teacher.id_docente"
                class="rounded-[24px] border bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
                :class="teacher.cerradas === teacher.total_asignaciones ? 'border-emerald-100 dark:border-emerald-900' : (teacher.cerradas === 0 ? 'border-rose-100/60 dark:border-rose-900/60' : 'border-amber-100/60 dark:border-amber-900/60')"
              >
                <div class="p-5 border-b border-slate-100/60 dark:border-slate-700/60 cursor-pointer select-none group" 
                     :class="teacher.cerradas === teacher.total_asignaciones ? 'bg-emerald-50/40 dark:bg-emerald-900/20 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/40' : 'bg-white dark:bg-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-700/50'"
                     @click="toggleTeacher(teacher.id_docente)"
                >
                  <div class="flex items-start justify-between mb-3">
                    <div class="overflow-hidden pr-3">
                      <h3 class="font-black text-slate-900 dark:text-slate-100 border-b border-transparent truncate text-base group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" :title="teacher.docente_nombre">
                        {{ teacher.docente_nombre.split(' ')[0] }} {{ teacher.docente_nombre.split(' ')[2] || teacher.docente_nombre.split(' ')[1] }}
                      </h3>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">{{ teacher.docente_email }}</p>
                    </div>
                    <div class="flex items-center gap-3">
                      <div 
                        class="rounded-xl px-2.5 py-1 text-[11px] font-black shrink-0 shadow-sm"
                        :class="[
                          teacher.cerradas === teacher.total_asignaciones ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 
                          (teacher.cerradas === 0 ? 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300')
                        ]"
                      >
                        {{ filterStatus !== 'TODOS' ? teacher.visibleAsigCount : teacher.cerradas + '/' + teacher.total_asignaciones }}
                      </div>
                      <div class="w-8 h-8 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-100 dark:border-slate-600 shadow-sm transition-transform duration-300 group-hover:border-rose-200 dark:group-hover:border-rose-800 group-hover:text-rose-600 dark:group-hover:text-rose-400" :class="{'rotate-180 bg-rose-50 dark:bg-rose-900/50 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400': expandedTeachers.has(teacher.id_docente)}">
                        <ChevronDown class="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                  <!-- Progress Bar -->
                  <div v-if="filterStatus === 'TODOS'" class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div class="h-1.5 rounded-full transition-all duration-1000 ease-out" 
                         :class="teacher.cerradas === teacher.total_asignaciones ? 'bg-emerald-400' : (teacher.cerradas === 0 ? 'bg-rose-400' : 'bg-amber-400')"
                         :style="`width: ${(teacher.total_asignaciones > 0 ? (teacher.cerradas / teacher.total_asignaciones) * 100 : 0)}%`">
                    </div>
                  </div>
                </div>
                
                <div v-show="expandedTeachers.has(teacher.id_docente)" class="p-4 bg-slate-50/50 dark:bg-slate-900/50 flex-1 flex flex-col gap-3 border-t border-slate-100/50 dark:border-slate-700/50">
                  <div 
                    v-for="materia in teacher.filteredMaterias" 
                    :key="materia.nombre"
                    class="bg-white dark:bg-slate-800 rounded-[16px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-700 overflow-hidden text-sm transition-all hover:ring-slate-200 dark:hover:ring-slate-600"
                  >
                    <div class="bg-slate-50/80 dark:bg-slate-900/80 px-3.5 py-2.5 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100/80 dark:border-slate-700/80 text-[13px] flex items-center gap-2">
                       <span class="w-1.5 h-1.5 rounded-full bg-slate-400/60 dark:bg-slate-500/60"></span>
                       <span class="truncate tracking-tight" :title="materia.nombre">{{ materia.nombre }}</span>
                    </div>
                    <div class="p-1.5 flex flex-col gap-0.5">
                      <div 
                        v-for="curso in materia.cursos" 
                        :key="curso.id_detallegrado"
                        class="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors group"
                      >
                        <div class="flex items-center gap-3 overflow-hidden">
                          <div class="rounded-full bg-white dark:bg-slate-900 p-0.5 shadow-sm">
                            <CheckCircle2 v-if="curso.estado === 'CERRADO'" class="w-4 h-4 text-emerald-500 shrink-0" />
                            <FileX v-else class="w-4 h-4 text-rose-400 shrink-0" />
                          </div>
                          <div class="truncate">
                            <p class="text-[12px] font-bold text-slate-600 dark:text-slate-400 truncate group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{{ curso.grado }}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <span 
                            class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 ring-1 ring-inset"
                            :class="curso.estado === 'CERRADO' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-500/20' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 ring-rose-500/20'"
                          >
                            {{ curso.estado }}
                          </span>
                          <button
                            v-if="curso.estado === 'CERRADO'"
                            @click.stop="attemptReopenSubject(curso)"
                            :disabled="reopeningSubject === curso.id_detallegrado"
                            class="p-1 px-1.5 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:text-amber-700 dark:hover:text-amber-400 transition"
                            title="Deshacer el cierre de esta materia para el profesor"
                          >
                            <Unlock class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">{{ item.tipo_grado_nombre }} {{ item.seccion_nombre }} · {{ item.jornada_nombre }}</p>
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
