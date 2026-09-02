<script setup lang="ts">
import { 
  BookOpen, X, Search, RefreshCw, AlertTriangle, ChevronDown, ChevronUp 
} from 'lucide-vue-next'

defineProps<{
  show: boolean
  catalogLoading: boolean
  catalogStats: {
    totalEvidences: number
    plannedEvidences: number
    freeEvidences: number
    pct: number
  }
  catalogSearchTerm: string
  catalogGradeFilter: string
  catalogSubjectFilter: string
  catalogStatusFilter: string
  grades: string[]
  subjects: { id_materia: number; nombre: string }[]
  filteredCatalog: any[]
  isCatalogDbaCardCollapsed: (id: number) => boolean
  getGroupedPlaneaciones: (planeaciones: any[]) => any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:catalogSearchTerm', val: string): void
  (e: 'update:catalogGradeFilter', val: string): void
  (e: 'update:catalogSubjectFilter', val: string): void
  (e: 'update:catalogStatusFilter', val: string): void
  (e: 'toggleCatalogDbaCard', id: number): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md">
      <div class="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <!-- Header Modal -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-2.5 sm:p-3 text-amber-600 dark:text-amber-400 shrink-0">
              <BookOpen class="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">Catálogo Global DBA</h3>
              <p class="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">Consulta las evidencias oficializadas y su estado de planeación.</p>
            </div>
          </div>
          <button @click="emit('close')" class="rounded-xl sm:rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition cursor-pointer shrink-0">
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Filter Controls Modal -->
        <div class="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 sm:p-6 space-y-3.5 sm:space-y-4 shrink-0">
          <!-- Stats Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Evidencias Totales</p>
              <p class="text-xl font-black text-slate-900 dark:text-white mt-0.5">{{ catalogStats.totalEvidences }}</p>
            </div>
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-emerald-500">Evidencias Planificadas</p>
              <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{{ catalogStats.plannedEvidences }}</p>
            </div>
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-amber-500">Evidencias Libres</p>
              <p class="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{{ catalogStats.freeEvidences }}</p>
            </div>
            <div class="rounded-2xl bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
              <p class="text-[10px] font-black uppercase tracking-wider text-indigo-500">% Integración Escolar</p>
              <p class="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{{ catalogStats.pct }}%</p>
            </div>
          </div>

          <!-- Selects & Search -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div class="sm:col-span-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 dark:bg-slate-800 dark:border-slate-700">
              <Search class="h-4 w-4 text-slate-400 shrink-0" />
              <input 
                :value="catalogSearchTerm" 
                @input="emit('update:catalogSearchTerm', ($event.target as HTMLInputElement).value)" 
                type="text" 
                placeholder="Buscar evidencia, DBA o competencia..." 
                class="w-full bg-transparent text-xs font-semibold text-slate-700 outline-none dark:text-white" 
              />
            </div>

            <select 
              :value="catalogGradeFilter" 
              @change="emit('update:catalogGradeFilter', ($event.target as HTMLSelectElement).value)" 
              class="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="TODOS">Todos los grados</option>
              <option v-for="gName in grades" :key="gName" :value="gName">Grado {{ gName }}</option>
            </select>

            <select 
              :value="catalogSubjectFilter" 
              @change="emit('update:catalogSubjectFilter', ($event.target as HTMLSelectElement).value)" 
              class="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="TODOS">Todas las áreas</option>
              <option v-for="s in subjects" :key="s.id_materia" :value="String(s.id_materia)">{{ s.nombre }}</option>
            </select>

            <select 
              :value="catalogStatusFilter" 
              @change="emit('update:catalogStatusFilter', ($event.target as HTMLSelectElement).value)" 
              class="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="PLANEADAS">Planeadas</option>
              <option value="LIBRES">Libres</option>
            </select>
          </div>
        </div>

        <!-- Content Body Modal -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div v-if="catalogLoading" class="py-16 text-center text-slate-400 font-bold">
            <RefreshCw class="mx-auto h-8 w-8 animate-spin text-amber-500 mb-2" />
            Cargando catálogo oficial...
          </div>

          <div v-else-if="filteredCatalog.length === 0" class="py-16 text-center text-slate-400 font-bold">
            <AlertTriangle class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
            No se encontraron Derechos Básicos de Aprendizaje con los filtros seleccionados.
          </div>

          <div v-else class="space-y-6">
            <div 
              v-for="dba in filteredCatalog" 
              :key="dba.id_dba"
              class="rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6 space-y-4 shadow-sm"
            >
              <!-- Clickable Accordion Header -->
              <div 
                @click="emit('toggleCatalogDbaCard', dba.id_dba)"
                class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 cursor-pointer select-none group"
                :class="!isCatalogDbaCardCollapsed(dba.id_dba) ? 'border-b border-slate-200/60 dark:border-slate-800 pb-3' : ''"
              >
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="rounded-lg bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/40">
                      DBA #{{ dba.numero_dba }}
                    </span>
                    <span class="text-xs font-extrabold text-slate-700 dark:text-slate-300">{{ dba.area }} — Grado {{ dba.grado }}</span>
                    <span class="text-[10px] font-bold text-slate-400">({{ dba.version_curricular }})</span>
                  </div>
                  <h4 class="text-sm font-black text-slate-900 dark:text-white leading-relaxed group-hover:text-amber-600 transition-colors">{{ dba.dba_enunciado }}</h4>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="px-3 py-1 rounded-full text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {{ dba.evidencias.length }} evidencias
                  </span>
                  <div class="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 group-hover:border-amber-400 group-hover:text-amber-600 transition-colors">
                    <ChevronUp v-if="!isCatalogDbaCardCollapsed(dba.id_dba)" class="w-4 h-4" />
                    <ChevronDown v-else class="w-4 h-4" />
                  </div>
                </div>
              </div>

              <!-- Collapsible Evidencias Body -->
              <div v-if="!isCatalogDbaCardCollapsed(dba.id_dba)" class="space-y-3 pt-1 animate-in fade-in duration-200">
                <div 
                  v-for="ev in dba.evidencias" 
                  :key="ev.id_evidencia_dba"
                  class="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700/60 space-y-2 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                      <span class="text-slate-400 font-extrabold mr-1">#{{ ev.orden }}</span>
                      {{ ev.descripcion }}
                    </p>
                    <span 
                      :class="ev.planeaciones && ev.planeaciones.length > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border-slate-200'"
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0"
                    >
                      {{ ev.planeaciones && ev.planeaciones.length > 0 ? 'PLANEADA' : 'LIBRE' }}
                    </span>
                  </div>

                  <!-- Planeaciones Vinculadas agrupadas -->
                  <div v-if="ev.planeaciones && ev.planeaciones.length > 0" class="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Vinculada en la planeación curricular de:</p>
                    <div 
                      v-for="(grpPlan, pIdx) in getGroupedPlaneaciones(ev.planeaciones)" 
                      :key="pIdx"
                      class="flex flex-wrap items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/60 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 border border-slate-100/80 dark:border-slate-800"
                    >
                      <div>
                        <span class="font-extrabold text-amber-700 dark:text-amber-400 mr-2">{{ grpPlan.materia_nombre }}</span>
                        <span class="font-semibold text-slate-500">({{ grpPlan.periodo_nombre }})</span>
                        <p v-if="grpPlan.competencia_descripcion" class="text-[11px] text-slate-600 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                          "{{ grpPlan.competencia_descripcion }}"
                        </p>
                      </div>
                      <div class="flex flex-wrap gap-1 mt-1 sm:mt-0">
                        <span v-for="gName in grpPlan.grupos" :key="gName" class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] border border-indigo-100/30">
                          {{ gName }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/80 flex justify-end">
          <button @click="emit('close')" class="rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer">
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
