<script setup lang="ts">
import { 
  X, Upload, CheckCircle, AlertTriangle 
} from 'lucide-vue-next'

defineProps<{
  show: boolean
  importForm: {
    area: string
    version_curricular: string
    start_page: number
  }
  importFile: File | null
  importResult: { message: string; summary: string } | null
  existingCombinations: { area: string; version_curricular: string }[]
  isExistingDba: boolean
  importOverwrite: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'fileChange', event: Event): void
  (e: 'selectCombination', comb: { area: string; version_curricular: string }): void
  (e: 'update:importOverwrite', val: boolean): void
  (e: 'import'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-xl p-8 flex flex-col max-h-[85vh]">
        <!-- FIXED HEADER -->
        <div class="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Upload :size="20" class="text-indigo-500" />
            Importar DBA desde PDF Curricular
          </h3>
          <button @click="emit('close')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <!-- SCROLLABLE BODY -->
        <div class="overflow-y-auto py-6 pr-2 flex-1 min-h-0 space-y-5">
          <!-- If result exists, show success summary -->
          <div v-if="importResult" class="space-y-4">
            <div class="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center gap-3">
              <CheckCircle :size="24" />
              <div>
                <p class="text-sm font-bold">{{ importResult.message }}</p>
              </div>
            </div>

            <div class="p-5 bg-slate-50 dark:bg-slate-800/55 rounded-2xl border border-slate-100 dark:border-slate-850">
              <span class="text-[10px] font-black uppercase text-slate-400 block mb-2">Resumen del Procesamiento</span>
              <pre class="text-xs font-semibold text-slate-750 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{{ importResult.summary }}</pre>
            </div>
          </div>

          <!-- Form layout -->
          <div v-else class="space-y-4">
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Sube el archivo PDF oficial emitido por el MEN para el área académica correspondiente. El sistema detectará las páginas del catálogo, estructurará las columnas visuales y poblará las evidencias de forma automática.
            </p>

            <!-- Existing combinations -->
            <div v-if="existingCombinations.length > 0" class="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span class="text-[10px] font-black uppercase text-slate-400 block mb-2">Materias con DBA ya existentes (Haz clic para autocompletar):</span>
              <div class="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                <span 
                  v-for="c in existingCombinations" 
                  :key="c.area + c.version_curricular" 
                  class="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-350 text-[10px] font-bold rounded-lg border border-slate-200/50 dark:border-slate-700 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-all"
                  @click="emit('selectCombination', c)"
                >
                  {{ c.area }} ({{ c.version_curricular }})
                </span>
              </div>
            </div>

            <!-- File selector -->
            <div class="border-2 border-dashed border-slate-205 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-indigo-500 transition-all relative">
              <input type="file" @change="emit('fileChange', $event)" accept=".pdf" class="absolute inset-0 opacity-0 cursor-pointer" />
              <div class="space-y-2">
                <Upload class="mx-auto text-slate-400" :size="32" />
                <div class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {{ importFile ? importFile.name : 'Selecciona o arrastra el archivo PDF' }}
                </div>
                <p class="text-xs text-slate-400">Tamaño máximo recomendado: 15MB</p>
              </div>
            </div>

            <!-- Area & Version -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Área Académica *</label>
                <input v-model="importForm.area" type="text" placeholder="Ej. Ciencias Naturales" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Versión Curricular *</label>
                <input v-model="importForm.version_curricular" type="text" placeholder="Ej. 2016" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div class="sm:col-span-2">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Página de Inicio en el PDF *</label>
                <input v-model.number="importForm.start_page" type="number" min="1" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span class="text-[10px] font-bold text-slate-400 mt-1 block">Número de página física (1-indexed) donde inician los DBA, descartando introducciones.</span>
              </div>

              <!-- Overwrite warning and options -->
              <div v-if="isExistingDba" class="sm:col-span-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-250/30 dark:border-amber-900/30 rounded-2xl space-y-3">
                <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-black">
                  <AlertTriangle :size="16" />
                  Esta combinación de Materia y Versión ya tiene DBAs cargados
                </div>
                <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-normal">
                  Selecciona si deseas sobreescribir los datos existentes (eliminará los registros anteriores de esta materia/versión antes de la importación) o mantenerlos para combinarlos.
                </p>
                <div class="flex gap-4">
                  <label class="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input type="radio" :checked="importOverwrite === true" @change="emit('update:importOverwrite', true)" class="text-indigo-600 focus:ring-indigo-500" />
                    Sobreescribir y limpiar anterior
                  </label>
                  <label class="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input type="radio" :checked="importOverwrite === false" @change="emit('update:importOverwrite', false)" class="text-indigo-600 focus:ring-indigo-500" />
                    Mantener y combinar
                  </label>
                </div>
              </div>
            </div>

            <!-- Spinner showing progress -->
            <div v-if="saving" class="flex flex-col items-center justify-center p-4 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-2xl border border-indigo-50/50 dark:border-indigo-950/20">
              <div class="animate-spin rounded-full h-8 w-8 border-3 border-indigo-600 border-t-transparent"></div>
              <p class="mt-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold text-center">
                Parseando PDF e importando evidencias... Esto puede tomar unos segundos.
              </p>
            </div>
          </div>
        </div>

        <!-- FIXED FOOTER -->
        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="emit('close')" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Cancelar
          </button>
          <template v-if="importResult">
            <button @click="emit('close')" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
              Aceptar
            </button>
          </template>
          <template v-else>
            <button :disabled="saving || !importFile" @click="emit('import')" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
              Importar
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
