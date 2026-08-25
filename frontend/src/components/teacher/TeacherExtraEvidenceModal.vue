<script setup lang="ts">
import { AlertTriangle, X } from 'lucide-vue-next'

defineProps<{
  showWarningModal: boolean
  showExtraModal: boolean
  extraDbaItems: any[]
  selectedEvidenciasDba: number[]
  getLinkedActivityForEvidence: (id: any) => any
}>()




const emit = defineEmits<{
  (e: 'closeWarning'): void
  (e: 'proceedToExtra'): void
  (e: 'closeExtra'): void
  (e: 'toggleEvidence', id: number): void
}>()
</script>

<template>
  <Teleport to="body">
    <!-- Modal 1: Advertencia de Evidencias Extra -->
    <div v-if="showWarningModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        <div class="flex items-center gap-3 text-amber-500 dark:text-amber-400">
          <div class="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl">
            <AlertTriangle :size="24" />
          </div>
          <h3 class="text-base font-black uppercase tracking-wide text-slate-850 dark:text-white">Advertencia de Evidencias</h3>
        </div>
        <p class="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
          Las evidencias que se mostrarán ya fueron planeadas en periodos anteriores/futuros, o no tienen alguna planeación. Si elige vincular una de estas evidencias con el registro de notas, el estado de la evidencia pasará a <span class="text-blue-600 font-extrabold uppercase">EXTRA</span> para este periodo académico.
        </p>
        <div class="flex gap-2 pt-2">
          <button @click="emit('closeWarning')" class="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border border-slate-200 dark:border-slate-800 rounded-2xl">Cancelar</button>
          <button @click="emit('proceedToExtra')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-xs font-black uppercase active:scale-95 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Entendido, continuar</button>
        </div>
      </div>
    </div>

    <!-- Modal 2: Catálogo de Evidencias Extras/Sin Planear -->
    <div v-if="showExtraModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] space-y-4 animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-white">Evidencias Extras disponibles</h3>
          <button @click="emit('closeExtra')" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-855"><X :size="16" /></button>
        </div>

        <div class="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
          <div v-if="extraDbaItems.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic py-8 text-center">
            No hay más evidencias disponibles en el catálogo de DBA para este curso.
          </div>

          <div v-for="dbaItem in extraDbaItems" :key="dbaItem.id_dba" class="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
            <div class="flex items-start gap-2">
              <span class="rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[9px] font-black dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
                DBA #{{ dbaItem.numero_dba }}
              </span>
              <p class="text-xs font-bold text-slate-700 dark:text-slate-350 leading-normal">
                {{ dbaItem.enunciado }}
              </p>
            </div>
            
            <div class="pl-4 space-y-1.5">
              <label 
                v-for="ev in dbaItem.evidencias" 
                :key="ev.id_evidencia_dba" 
                :class="getLinkedActivityForEvidence(ev.id_evidencia_dba) ? 'opacity-60 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/10' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'" 
                class="flex flex-col gap-1 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 transition-all"
              >
                <div class="flex items-start gap-2 text-xs font-bold text-slate-650 dark:text-slate-300">
                  <input 
                    type="checkbox" 
                    :checked="selectedEvidenciasDba.includes(ev.id_evidencia_dba)" 
                    :disabled="!!getLinkedActivityForEvidence(ev.id_evidencia_dba)" 
                    @change="emit('toggleEvidence', ev.id_evidencia_dba)"
                    class="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" 
                  />
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span>{{ ev.descripcion }}</span>
                    <span class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                      EXTRA
                    </span>
                    <span v-if="ev.planeada_otro_periodo_nombre" class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/30">
                      Planeada en: {{ ev.planeada_otro_periodo_nombre }}
                    </span>
                    <span v-if="getLinkedActivityForEvidence(ev.id_evidencia_dba)" class="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 rounded px-1.5 py-0.5 text-[8px] font-bold border border-red-200/40 uppercase tracking-wide">
                      Asignada a: {{ getLinkedActivityForEvidence(ev.id_evidencia_dba) }}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button @click="emit('closeExtra')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase active:scale-95 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Confirmar Selección</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
