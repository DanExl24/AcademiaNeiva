<script setup lang="ts">
import { 
  Search, RefreshCw, GraduationCap, Calendar 
} from 'lucide-vue-next'

defineProps<{
  historySearchQuery: string
  historyLoading: boolean
  studentHistory: any | null
  formatDecisionLabel: (dec: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:historySearchQuery', val: string): void
  (e: 'search'): void
}>()
</script>

<template>
  <div class="tab-content space-y-6">
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Buscar estudiante por número de documento:</label>
      <div class="flex gap-3">
        <input 
          :value="historySearchQuery" 
          @input="emit('update:historySearchQuery', ($event.target as HTMLInputElement).value)"
          type="text" 
          placeholder="Ingrese documento de identidad (ej: 1075283921)..."
          class="flex-1 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @keyup.enter="emit('search')"
        />
        <button 
          class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50" 
          :disabled="historyLoading" 
          @click="emit('search')"
        >
          <Search class="w-4 h-4" /> 
          {{ historyLoading ? 'Buscando...' : 'Buscar Historial' }}
        </button>
      </div>
    </div>

    <div v-if="historyLoading" class="loading-spinner p-8 text-center text-slate-500">
      <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
      <span>Consultando historial del estudiante...</span>
    </div>

    <div v-if="studentHistory" class="history-results space-y-6">
      <!-- Tarjeta de Perfil -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md">
            {{ studentHistory.estudiante.nombre?.charAt(0) }}{{ studentHistory.estudiante.apellido?.charAt(0) }}
          </div>
          <div>
            <h3 class="text-xl font-black text-slate-800 dark:text-white">{{ studentHistory.estudiante.apellido }} {{ studentHistory.estudiante.nombre }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Documento: <strong class="text-slate-700 dark:text-slate-200">{{ studentHistory.estudiante.documento }}</strong> • 
              Colegio: <span class="text-indigo-600 dark:text-indigo-400 font-semibold">{{ studentHistory.estudiante.colegio_nombre }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Línea de Tiempo de Matrículas y Promociones -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-6 flex items-center gap-2">
          <GraduationCap class="w-4 h-4 text-indigo-600" />
          Trayectoria Académica y Matrículas Registradas
        </h4>

        <div v-if="studentHistory.historial_matriculas && studentHistory.historial_matriculas.length > 0" class="relative pl-8 space-y-6 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          <div 
            v-for="mat in studentHistory.historial_matriculas" 
            :key="mat.id_matricula" 
            class="relative"
          >
            <div class="absolute -left-8 top-1 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Calendar class="w-3.5 h-3.5" />
            </div>
            <div class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-2">
              <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                <h5 class="font-bold text-slate-800 dark:text-white text-sm">
                  Año Lectivo {{ mat.calendario || mat.id_anio }} — Grado: {{ mat.grado_nombre }} {{ mat.grupo_nombre }}
                  <span v-if="mat.jornada_nombre" class="text-xs text-indigo-600 dark:text-indigo-400 font-normal ml-1">(Jornada {{ mat.jornada_nombre }})</span>
                </h5>
                <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold" :class="mat.estado_matricula === 'CULMINADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'">
                  Estado: {{ mat.estado_matricula }}
                </span>
              </div>
              <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <p v-if="mat.resultado_calculado">
                  Resultado Anual: 
                  <span 
                    class="font-bold ml-1"
                    :class="{
                      'text-emerald-700 dark:text-emerald-400': mat.resultado_calculado === 'APROBADO',
                      'text-rose-700 dark:text-rose-400': mat.resultado_calculado === 'NO_PROMOVIDO',
                      'text-amber-700 dark:text-amber-400': mat.resultado_calculado === 'PENDIENTE_RECUPERACION'
                    }"
                  >
                    {{ mat.resultado_calculado }}
                  </span>
                </p>
                <p v-if="mat.decision_tomada">
                  Decisión Institucional: 
                  <span class="text-indigo-600 dark:text-indigo-400 font-bold ml-1">{{ formatDecisionLabel(mat.decision_tomada) }}</span>
                </p>
                <p v-if="mat.observacion" class="p-2.5 bg-white dark:bg-slate-900 rounded-lg text-slate-600 dark:text-slate-400 italic mt-1 border border-slate-200/50 dark:border-slate-800">
                  "{{ mat.observacion }}"
                </p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-6 text-slate-400 text-xs italic">
          El estudiante no posee historial de matrículas registrado en el sistema.
        </div>
      </div>
    </div>
  </div>
</template>
