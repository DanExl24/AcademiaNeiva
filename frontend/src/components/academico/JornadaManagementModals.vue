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
    <div v-if="showCreate" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('closeCreate')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
        <div class="p-8 space-y-6">
          <div class="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div class="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Sun :size="24" />
            </div>
            <div>
              <h3 class="text-lg font-black text-slate-900 dark:text-white">Habilitar Nueva Jornada</h3>
              <p class="text-xs text-slate-400 font-medium">Activa una jornada institucional para asociar cursos</p>
            </div>
          </div>

          <div class="space-y-3">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-300">Seleccionar Tipo de Jornada:</label>
            <div class="grid grid-cols-2 gap-2.5">
              <button
                v-for="name in availableJornadasToAdd"
                :key="name"
                type="button"
                @click="newJornadaName = name"
                :class="[
                  'p-3.5 rounded-2xl border text-center font-black text-xs transition-all',
                  newJornadaName === name
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/30'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                ]"
              >
                {{ name }}
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              @click="emit('closeCreate')"
              class="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              @click="handleCreate"
              :disabled="savingJornada || !newJornadaName"
              class="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {{ savingJornada ? 'Habilitando...' : 'Habilitar Jornada' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Jornada Modal -->
    <div v-if="showDelete && targetJornadaToDelete" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="emit('closeDelete')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
        <div class="p-8 text-center">
          <div class="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 :size="32" />
          </div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white">¿Eliminar Jornada {{ targetJornadaToDelete.nombre }}?</h2>
          <p class="text-slate-500 dark:text-slate-400 font-medium mt-3 text-xs leading-relaxed">
            Esta jornada no posee cursos asignados y será retirada de la institución. Esta acción no afecta cursos existentes.
          </p>
        </div>
        
        <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-3">
          <button @click="emit('closeDelete')" class="flex-1 px-6 py-3 rounded-xl font-black text-xs text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all">Cancelar</button>
          <button 
            @click="emit('confirmDelete')"
            :disabled="deletingJornada"
            class="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-600 transition-all disabled:opacity-50"
          >
            {{ deletingJornada ? 'Eliminando...' : 'Sí, Retirar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reassign Group Jornada Modal -->
    <div v-if="showReassign && targetGroupToReassign" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('closeReassign')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
        <div class="p-8 space-y-6">
          <div class="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div class="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <ArrowRightLeft :size="24" />
            </div>
            <div>
              <h3 class="text-lg font-black text-slate-900 dark:text-white">Reasignar Jornada</h3>
              <p class="text-xs text-slate-400 font-medium">{{ getCourseDisplayName(targetGroupToReassign) }}</p>
            </div>
          </div>

          <div class="space-y-3">
            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs space-y-1">
              <p class="text-slate-400 font-medium">Jornada Actual: <span class="font-bold text-slate-900 dark:text-white">{{ targetGroupToReassign.jornada_nombre }}</span></p>
              <p class="text-slate-400 font-medium">Estudiantes Vinculados: <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ targetGroupToReassign.matriculas_count }}</span></p>
            </div>

            <label class="text-xs font-bold text-slate-600 dark:text-slate-300 block">Nueva Jornada de Destino:</label>
            <select 
              v-model="newTargetJornadaId"
              class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 font-bold outline-none text-xs text-slate-900 dark:text-white"
            >
              <option v-for="j in jornadas" :key="j.id_jornada" :value="j.id_jornada">
                {{ j.nombre }} {{ j.id_jornada === targetGroupToReassign.id_jornada ? '(Actual)' : '' }}
              </option>
            </select>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              @click="emit('closeReassign')"
              class="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              @click="handleReassign"
              :disabled="reassigningJornada || !newTargetJornadaId || newTargetJornadaId === targetGroupToReassign.id_jornada"
              class="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {{ reassigningJornada ? 'Reasignando...' : 'Confirmar Cambio' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
