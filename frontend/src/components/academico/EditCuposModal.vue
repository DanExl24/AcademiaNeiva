<script setup lang="ts">
import { ref, watch } from 'vue'
import { Pencil } from 'lucide-vue-next'
import { getCourseDisplayName } from '../../utils/courseHelper'

const props = defineProps<{
  show: boolean
  selectedGroup: any | null
  savingCupos: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', newCupos: number): void
}>()

const cupos = ref(30)

watch(() => props.show, (newVal) => {
  if (newVal && props.selectedGroup) {
    cupos.value = props.selectedGroup.cupos_totales || 30
  }
})

const handleSave = () => {
  if (!props.selectedGroup || props.savingCupos) return
  if (cupos.value < (props.selectedGroup.matriculas_count || 0)) return
  emit('save', cupos.value)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show && selectedGroup" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('close')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3.5 sm:gap-4 mb-5 sm:mb-6">
              <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl sm:rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
                <Pencil :size="22" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">Modificar Capacidad</h3>
                <p class="text-xs sm:text-sm font-medium text-slate-500 truncate">{{ getCourseDisplayName(selectedGroup) }}</p>
              </div>
            </div>

            <div class="space-y-3.5 sm:space-y-4">
              <div class="bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-indigo-100/50">
                <div class="flex justify-between items-center text-xs sm:text-sm font-bold">
                  <span class="text-slate-500 uppercase tracking-wider">Matriculados</span>
                  <span class="text-indigo-600 dark:text-indigo-400">{{ selectedGroup.matriculas_count }} Estudiantes</span>
                </div>
              </div>

              <div class="space-y-1.5 sm:space-y-2">
                <label class="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nuevo Total de Cupos</label>
                <input 
                  v-model.number="cupos" 
                  type="number" 
                  :min="selectedGroup.matriculas_count"
                  class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white transition-all"
                />
                <p class="text-[10px] font-bold text-slate-400 ml-1 uppercase">El cupo no puede ser menor a {{ selectedGroup.matriculas_count }}</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-6 sm:mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button @click="emit('close')" class="w-full sm:w-auto flex-1 px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100 transition-all cursor-pointer">Cancelar</button>
            <button 
              @click="handleSave"
              :disabled="savingCupos || cupos < selectedGroup.matriculas_count"
              class="w-full sm:w-auto flex-[2] bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-1px] transition-all disabled:opacity-50 cursor-pointer"
            >
              {{ savingCupos ? 'Actualizando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
