<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, X, Send } from 'lucide-vue-next'

interface Props {
  show: boolean
  submitting?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', observations: string): void
}>()

const observations = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    observations.value = ''
  }
})

const handleConfirm = () => {
  if (!observations.value.trim()) return
  emit('confirm', observations.value.trim())
}
</script>

<template>
  <div 
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
  >
    <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 overflow-hidden text-left">
      <!-- Modal Header -->
      <div class="flex items-start justify-between gap-3 mb-5">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60 shadow-xs">
            <AlertTriangle class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              Solicitar Corrección de Documentos
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Notificar al acudiente para subsanar inconsistencias documentales
            </p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Cerrar"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Observaciones e Instrucciones para el Acudiente *
          </label>
          <textarea
            v-model="observations"
            rows="4"
            placeholder="Describe claramente los documentos o campos que presentan errores y deben ser corregidos (ej: El documento de identidad es ilegible, adjuntar en formato PDF nítido)..."
            class="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-hidden transition-all resize-none"
          ></textarea>
        </div>

        <div class="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <p class="font-semibold mb-1">Información Importante:</p>
          <p>Al confirmar, la matrícula pasará al estado <strong>EN CORRECCIÓN</strong> y se enviará un correo electrónico al acudiente con un enlace seguro para subsanar los archivos.</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          @click="emit('close')"
          :disabled="submitting"
          class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          @click="handleConfirm"
          :disabled="submitting || !observations.trim()"
          class="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors"
        >
          <Send class="w-4 h-4" />
          <span>{{ submitting ? 'Enviando...' : 'Enviar a Corrección' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
