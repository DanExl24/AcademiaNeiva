<script setup lang="ts">
import { ref, watch } from 'vue'
import { Sun, Trash2, ArrowRightLeft } from 'lucide-vue-next'
import { getCourseDisplayName } from '../../utils/courseHelper'

const props = defineProps<{
  showCreate: boolean
  availableJornadasToAdd: string[]
  savingJornada: boolean
  showDelete: boolean
  targetJornadaToDelete: any | null
  deletingJornada: boolean
  showReassign: boolean
  targetGroupToReassign: any | null
  reassigningJornada: boolean
  jornadas: any[]
}>()

const emit = defineEmits<{
  (e: 'closeCreate'): void
  (e: 'confirmCreate', name: string): void
  (e: 'closeDelete'): void
  (e: 'confirmDelete'): void
  (e: 'closeReassign'): void
  (e: 'confirmReassign', newJornadaId: number): void
}>()

const newJornadaName = ref('MAÑANA')
const newTargetJornadaId = ref<number | null>(null)

watch(() => props.availableJornadasToAdd, (list) => {
  if (list && list.length > 0 && !list.includes(newJornadaName.value)) {
    newJornadaName.value = list[0]
  }
}, { immediate: true })

watch(() => props.targetGroupToReassign, (group) => {
  if (group) {
    newTargetJornadaId.value = group.id_jornada
  } else {
    newTargetJornadaId.value = null
  }
})

const handleCreate = () => {
  if (!newJornadaName.value || props.savingJornada) return
  emit('confirmCreate', newJornadaName.value)
}

const handleReassign = () => {
  if (!newTargetJornadaId.value || props.reassigningJornada) return
  emit('confirmReassign', newTargetJornadaId.value)
}
</script>

<template>
  <Teleport to="body">
    <!-- Create Jornada Modal -->
    <div v-if="showCreate" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('closeCreate')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-5 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 sm:mb-6">
              <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shrink-0">
                <Sun :size="22" />
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">Habilitar Nueva Jornada</h3>
                <p class="text-xs text-slate-400 font-medium">Activa una jornada institucional para asociar cursos</p>
              </div>
            </div>

            <div class="space-y-2.5 sm:space-y-3">
              <label class="text-xs font-bold text-slate-600 dark:text-slate-300">Seleccionar Tipo de Jornada:</label>
              <div class="grid grid-cols-2 gap-2 sm:gap-2.5">
                <button
                  v-for="name in availableJornadasToAdd"
                  :key="name"
                  type="button"
                  @click="newJornadaName = name"
                  :class="[
                    'p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-center font-black text-xs transition-all cursor-pointer',
                    newJornadaName === name
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  ]"
                >
                  {{ name }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row items-center gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button 
              @click="emit('closeCreate')"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              @click="handleCreate"
              :disabled="savingJornada || !newJornadaName"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {{ savingJornada ? 'Habilitando...' : 'Habilitar Jornada' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Jornada Modal -->
    <div v-if="showDelete && targetJornadaToDelete" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="emit('closeDelete')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden shadow-2xl max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-6 sm:p-8 text-center overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div>
            <div class="w-14 h-14 sm:w-16 sm:h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shrink-0">
              <Trash2 class="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">¿Eliminar Jornada {{ targetJornadaToDelete.nombre }}?</h2>
            <p class="text-slate-500 dark:text-slate-400 font-medium mt-2 sm:mt-3 text-xs leading-relaxed">
              Esta jornada no posee cursos asignados y será retirada de la institución. Esta acción no afecta cursos existentes.
            </p>
          </div>
          
          <div class="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button @click="emit('closeDelete')" class="w-full sm:w-auto flex-1 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">Cancelar</button>
            <button 
              @click="emit('confirmDelete')"
              :disabled="deletingJornada"
              class="w-full sm:w-auto flex-1 bg-red-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              {{ deletingJornada ? 'Eliminando...' : 'Sí, Retirar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reassign Group Jornada Modal -->
    <div v-if="showReassign && targetGroupToReassign" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('closeReassign')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-5 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 sm:mb-6">
              <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shrink-0">
                <ArrowRightLeft :size="22" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">Reasignar Jornada</h3>
                <p class="text-xs text-slate-400 font-medium truncate">{{ getCourseDisplayName(targetGroupToReassign) }}</p>
              </div>
            </div>

            <div class="space-y-3">
              <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl text-xs space-y-1">
                <p class="text-slate-400 font-medium">Jornada Actual: <span class="font-bold text-slate-900 dark:text-white">{{ targetGroupToReassign.jornada_nombre }}</span></p>
                <p class="text-slate-400 font-medium">Estudiantes Vinculados: <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ targetGroupToReassign.matriculas_count }}</span></p>
              </div>

              <label class="text-xs font-bold text-slate-600 dark:text-slate-300 block">Nueva Jornada de Destino:</label>
              <select 
                v-model="newTargetJornadaId"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 font-bold outline-none text-xs text-slate-900 dark:text-white cursor-pointer"
              >
                <option v-for="j in jornadas" :key="j.id_jornada" :value="j.id_jornada">
                  {{ j.nombre }} {{ j.id_jornada === targetGroupToReassign.id_jornada ? '(Actual)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row items-center gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button 
              @click="emit('closeReassign')"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              @click="handleReassign"
              :disabled="reassigningJornada || !newTargetJornadaId || newTargetJornadaId === targetGroupToReassign.id_jornada"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {{ reassigningJornada ? 'Reasignando...' : 'Confirmar Cambio' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
