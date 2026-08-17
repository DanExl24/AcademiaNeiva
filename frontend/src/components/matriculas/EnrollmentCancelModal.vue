<script setup lang="ts">
import { ref, watch } from 'vue'
import { XCircle, X, Trash2 } from 'lucide-vue-next'

interface Props {
  show: boolean
  submitting?: boolean
  tipoMatricula?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', data: { motivo: string; detalles: string; estado_estudiante: 'RETIRADO' | 'EXPULSADO' }): void
}>()

const motivo = ref('Inconsistencias Graves en Documentos')
const detalles = ref('')
const estadoEstudiante = ref<'RETIRADO' | 'EXPULSADO'>('RETIRADO')

const motivosPreset = [
  'Inconsistencias Graves en Documentos',
  'Falsedad en Documentos Aportados',
  'Cupo No Disponible / Sobrecupo',
  'Retiro Voluntario del Acudiente',
  'Duplicidad de Solicitud',
  'Otro Motivo Institucional'
]

watch(() => props.show, (newVal) => {
  if (newVal) {
    motivo.value = 'Inconsistencias Graves en Documentos'
    detalles.value = ''
    estadoEstudiante.value = 'RETIRADO'
  }
})

const handleConfirm = () => {
  emit('confirm', {
    motivo: motivo.value,
    detalles: detalles.value.trim(),
    estado_estudiante: estadoEstudiante.value
  })
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
          <div class="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/60 shadow-xs">
            <XCircle class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              Cancelar / Rechazar Matrícula
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Esta acción revocará la solicitud de matrícula
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

      <!-- Form Content -->
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Motivo Principal *
          </label>
          <select
            v-model="motivo"
            class="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-hidden transition-all"
          >
            <option v-for="m in motivosPreset" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Detalles Adicionales / Justificación (Opcional)
          </label>
          <textarea
            v-model="detalles"
            rows="3"
            placeholder="Especifica detalles de la cancelación para registro en el historial institucional..."
            class="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-hidden transition-all resize-none"
          ></textarea>
        </div>

        <div v-if="tipoMatricula !== 'REINGRESO'">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Estado Académico Final del Estudiante
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <input type="radio" v-model="estadoEstudiante" value="RETIRADO" class="text-red-600 focus:ring-red-500" />
              <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">RETIRADO (Regular)</span>
            </label>
            <label class="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <input type="radio" v-model="estadoEstudiante" value="EXPULSADO" class="text-red-600 focus:ring-red-500" />
              <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">EXPULSADO (Sanción)</span>
            </label>
          </div>
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
          Volver
        </button>
        <button
          type="button"
          @click="handleConfirm"
          :disabled="submitting"
          class="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors"
        >
          <Trash2 class="w-4 h-4" />
          <span>{{ submitting ? 'Cancelando...' : 'Confirmar Cancelación' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
