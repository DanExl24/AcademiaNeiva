<script setup lang="ts">
import { ref, watch } from 'vue'
import { Tag } from 'lucide-vue-next'
import { getCourseDisplayName } from '../../utils/courseHelper'

const props = defineProps<{
  show: boolean
  targetGroup: any | null
  renaming: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', newName: string): void
}>()

const renameName = ref('')

watch(() => props.show, (newVal) => {
  if (newVal && props.targetGroup) {
    renameName.value = props.targetGroup.seccion_nombre || ''
  } else {
    renameName.value = ''
  }
})

const handleSave = () => {
  const nombre = renameName.value.trim().toUpperCase()
  if (!nombre) return
  emit('save', nombre)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show && targetGroup" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('close')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
        <div class="p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <Tag :size="24" />
            </div>
            <div>
              <h3 class="text-xl font-black text-slate-900 dark:text-white">Renombrar Curso</h3>
              <p class="text-sm font-medium text-slate-500">{{ getCourseDisplayName(targetGroup) }}</p>
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nuevo Nombre del Curso</label>
              <input 
                v-model="renameName" 
                type="text"
                maxlength="10"
                placeholder="Ej. A o 601"
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white uppercase transition-all"
              />
              <p class="text-[10px] font-bold text-slate-400 ml-1 uppercase">Máximo 10 caracteres. Se guardará en mayúsculas.</p>
            </div>
          </div>

          <div class="flex gap-3 mt-8">
            <button @click="emit('close')" class="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
            <button 
              @click="handleSave"
              :disabled="renaming || !renameName.trim()"
              class="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-none hover:translate-y-[-1px] transition-all disabled:opacity-50"
            >
              {{ renaming ? 'Renombrando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
