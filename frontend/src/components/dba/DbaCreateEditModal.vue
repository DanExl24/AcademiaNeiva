<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{
  show: boolean
  selectedDba: any | null
  dbaForm: {
    area: string
    version_curricular: string
    grado: string
    numero_dba: number
    enunciado: string
  }
  gradeOptions: string[]
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-black text-slate-900 dark:text-white">
            {{ selectedDba ? 'Editar Derecho Básico' : 'Registrar Derecho Básico (DBA)' }}
          </h3>
          <button @click="emit('close')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Área -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Área Académica *</label>
            <input v-model="dbaForm.area" type="text" placeholder="Ej. Ciencias Naturales" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Versión Curricular -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Versión Curricular *</label>
            <input v-model="dbaForm.version_curricular" type="text" placeholder="Ej. 2016" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Grado -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Grado *</label>
            <select v-model="dbaForm.grado" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </div>

          <!-- Número -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Número de DBA *</label>
            <input v-model.number="dbaForm.numero_dba" type="number" min="1" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Enunciado -->
          <div class="sm:col-span-2">
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Enunciado (Aprendizaje Estructurante) *</label>
            <textarea v-model="dbaForm.enunciado" rows="4" placeholder="Escribe el enunciado de aprendizaje..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="emit('close')" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Cancelar
          </button>
          <button :disabled="saving" @click="emit('save')" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
            <span v-if="saving" class="animate-spin border-2 border-white border-t-transparent rounded-full h-4 w-4"></span>
            Guardar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
