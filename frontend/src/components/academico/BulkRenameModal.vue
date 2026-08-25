<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  bulkTarget: any | null
  bulkRenaming: boolean
  bulkCourseCount: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { prefijo: string; separador: string; tipo_ordinal: 'NUMERO' | 'LETRA' }): void
}>()

const bulkPrefijo = ref('')
const bulkSeparador = ref('-')
const bulkOrdinalType = ref<'NUMERO' | 'LETRA'>('NUMERO')

const sepOptions = [
  { label: 'Guión  ( - )', value: '-' },
  { label: 'Punto  ( . )', value: '.' },
  { label: 'Espacio (   )', value: ' ' },
  { label: 'Sin Separador', value: '' },
]

const bulkPrefijoError = computed(() => {
  if (!bulkPrefijo.value.trim()) return null
  const cleaned = bulkPrefijo.value.trim().toUpperCase()
  if (cleaned.length > 8) return 'El prefijo no puede tener más de 8 caracteres'
  if (!/^[A-Z0-9]+$/.test(cleaned)) return 'Solo se permiten letras y números sin caracteres especiales'
  return null
})

const previewNames = computed(() => {
  if (!bulkPrefijo.value.trim() || bulkPrefijoError.value) return []
  const count = props.bulkCourseCount || 3
  const p = bulkPrefijo.value.trim().toUpperCase()
  const sep = bulkSeparador.value
  const result: string[] = []

  for (let i = 0; i < count; i++) {
    const ordinal = bulkOrdinalType.value === 'NUMERO' 
      ? String(i + 1) 
      : String.fromCharCode(65 + i)
    result.push(`${p}${sep}${ordinal}`)
  }
  return result
})

watch(() => props.show, (newVal) => {
  if (!newVal) {
    bulkPrefijo.value = ''
    bulkSeparador.value = '-'
    bulkOrdinalType.value = 'NUMERO'
  }
})

const handleSave = () => {
  if (!props.bulkTarget || props.bulkRenaming || bulkPrefijoError.value) return
  emit('save', {
    prefijo: bulkPrefijo.value.trim().toUpperCase(),
    separador: bulkSeparador.value,
    tipo_ordinal: bulkOrdinalType.value
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show && bulkTarget" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('close')"></div>
      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
        <div class="p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <RefreshCw :size="24" />
            </div>
            <div>
              <h3 class="text-xl font-black text-slate-900 dark:text-white">Renombre Masivo</h3>
              <p class="text-sm font-medium text-slate-500">Grado: {{ bulkTarget.nombre }} | {{ bulkCourseCount }} Cursos</p>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Prefix input -->
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Estructura Base (Prefijo)</label>
              <input 
                v-model="bulkPrefijo" 
                type="text"
                maxlength="10"
                placeholder="Ej: 10, DECIMO, 6"
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white uppercase transition-all"
              />
              <p class="text-[10px] font-bold text-slate-400 ml-1 uppercase">Se convertirá automáticamente a mayúsculas.</p>
            </div>

            <!-- Ordinal Type selection -->
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Tipo de Sufijo (Ordinal)</label>
              <div class="flex gap-4">
                <label class="flex-1 flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl cursor-pointer border-2 border-transparent hover:border-indigo-500/20 transition-all">
                  <span class="text-sm font-bold text-slate-850 dark:text-slate-200">Números (1, 2, 3...)</span>
                  <input type="radio" value="NUMERO" v-model="bulkOrdinalType" class="accent-indigo-600 w-4 h-4" />
                </label>
                <label class="flex-1 flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl cursor-pointer border-2 border-transparent hover:border-indigo-500/20 transition-all">
                  <span class="text-sm font-bold text-slate-850 dark:text-slate-200">Letras (A, B, C...)</span>
                  <input type="radio" value="LETRA" v-model="bulkOrdinalType" class="accent-indigo-600 w-4 h-4" />
                </label>
              </div>
            </div>

            <!-- Separator option -->
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Separador con el Ordinal</label>
              <select 
                v-model="bulkSeparador" 
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white appearance-none cursor-pointer transition-all"
              >
                <option v-for="opt in sepOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <!-- Real-time Preview -->
            <div v-if="previewNames.length > 0" class="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50">
              <h4 class="text-xs font-black uppercase text-slate-400 dark:text-slate-500 mb-2">Vista Previa de los Cursos:</h4>
              <div class="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                <span 
                  v-for="(pName, idx) in previewNames" 
                  :key="idx"
                  class="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-black border border-indigo-200/50 dark:border-indigo-900/50"
                >
                  {{ pName }}
                </span>
              </div>
            </div>

            <p v-if="bulkPrefijoError" class="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-950">
              {{ bulkPrefijoError }}
            </p>
          </div>

          <div class="flex gap-3 mt-8">
            <button @click="emit('close')" class="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
            <button 
              @click="handleSave"
              :disabled="bulkRenaming || !!bulkPrefijoError"
              class="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-none hover:translate-y-[-1px] transition-all disabled:opacity-50"
            >
              {{ bulkRenaming ? 'Aplicando...' : 'Aplicar Renombre' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
