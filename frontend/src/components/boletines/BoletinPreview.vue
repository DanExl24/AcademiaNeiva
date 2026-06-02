<template>
  <div class="boletin-preview bg-white shadow-xl rounded-xl p-8 max-w-4xl mx-auto my-8 print:shadow-none print:m-0 print:p-0" ref="boletinRef">
    <!-- Parte Superior -->
    <header class="flex justify-between items-center border-b-4 border-indigo-600 pb-6 mb-6">
      <div class="flex items-center space-x-6">
        <div class="h-24 w-24 bg-indigo-100 rounded-full flex items-center justify-center border-2 border-indigo-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
          </svg>
        </div>
        <div>
          <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">{{ data?.estudiante?.colegio_nombre?.toUpperCase() || 'INSTITUCIÓN EDUCATIVA' }}</h1>
          <p class="text-gray-500 font-medium mt-1">Sede: {{ data?.estudiante?.sede || 'Principal' }}</p>
          <div class="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
            Boletín de Calificaciones - {{ data?.periodo }}
          </div>
        </div>
      </div>
      <div class="text-right text-sm text-gray-600 font-medium">
        <p><span class="font-bold text-gray-900">Estudiante:</span> {{ data?.estudiante?.nombre }} {{ data?.estudiante?.apellido }}</p>
        <p><span class="font-bold text-gray-900">Código:</span> {{ data?.estudiante?.codigo }}</p>
        <p><span class="font-bold text-gray-900">Grado:</span> {{ data?.estudiante?.grado_nombre }} - {{ data?.estudiante?.seccion }}</p>
      </div>
    </header>

    <!-- Parte Media -->
    <main>
      <div class="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Materia & Docente</th>
              <th scope="col" class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Calificación</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Desempeño</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Observaciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-for="(materia, index) in data?.materias" :key="index">
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                  <div class="text-sm font-bold text-gray-900">{{ materia.materia }}</div>
                  <div class="text-xs text-gray-500 mt-1">{{ materia.docente_nombre }} {{ materia.docente_apellido }}</div>
                </td>
                <td class="px-6 py-4 text-center">
                  <span class="inline-flex items-center justify-center px-3 py-1 rounded-md font-bold text-lg"
                        :class="getGradeColor(materia.calificacion)">
                    {{ materia.calificacion }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="getPerformanceBadge(materia.desempeno)">
                    {{ materia.desempeno || 'SC' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs">
                  <p v-if="materia.fortalezas"><strong class="text-green-600">▲</strong> {{ materia.fortalezas }}</p>
                  <p v-if="materia.debilidades"><strong class="text-red-500">▼</strong> {{ materia.debilidades }}</p>
                  <p v-if="materia.recomendaciones" class="italic mt-1 text-gray-500">{{ materia.recomendaciones }}</p>
                  <span v-if="!materia.fortalezas && !materia.debilidades && !materia.recomendaciones" class="text-gray-400">Sin observaciones</span>
                </td>
              </tr>
            </template>
            <tr v-if="!data?.materias?.length">
              <td colspan="4" class="px-6 py-8 text-center text-gray-500 italic">No hay calificaciones registradas para este periodo.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <!-- Parte Final -->
    <footer class="mt-8">
      <div class="grid grid-cols-2 gap-8 mb-12">
        <div class="bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest">Promedio General</h3>
            <p class="text-4xl font-extrabold text-indigo-600 mt-2">{{ data?.promedioGeneral }}</p>
          </div>
          <div class="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
        
        <div class="bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Resumen de Asistencia</h3>
          <div class="flex justify-between items-center text-sm">
            <div class="text-center">
              <p class="font-bold text-gray-900 text-xl">{{ data?.asistencia?.faltasInjustificadas || 0 }}</p>
              <p class="text-gray-500">Faltas</p>
            </div>
            <div class="text-center">
              <p class="font-bold text-gray-900 text-xl">{{ data?.asistencia?.faltasJustificadas || 0 }}</p>
              <p class="text-gray-500">Justificadas</p>
            </div>
            <div class="text-center">
              <p class="font-bold text-gray-900 text-xl">{{ data?.asistencia?.retardos || 0 }}</p>
              <p class="text-gray-500">Retardos</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-16 pt-8 mt-12 mx-8">
        <div class="text-center">
          <div class="border-t border-gray-400 pt-2 text-sm font-bold text-gray-700">Firma Director de Grupo</div>
        </div>
        <div class="text-center">
          <div class="border-t border-gray-400 pt-2 text-sm font-bold text-gray-700">Firma Coordinación</div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  data: any
}>()

const boletinRef = ref<HTMLElement | null>(null)

defineExpose({
  boletinRef
})

const getGradeColor = (grade: string | number) => {
  const g = parseFloat(String(grade))
  if (isNaN(g)) return 'bg-gray-100 text-gray-800'
  if (g >= 4.6) return 'bg-blue-50 text-blue-700'
  if (g >= 4.0) return 'bg-green-50 text-green-700'
  if (g >= 3.0) return 'bg-yellow-50 text-yellow-700'
  return 'bg-red-50 text-red-700'
}

const getPerformanceBadge = (performance: string) => {
  if (!performance) return 'bg-gray-100 text-gray-800'
  const p = performance.toUpperCase()
  if (p.includes('SUPERIOR')) return 'bg-blue-100 text-blue-800'
  if (p.includes('ALTO')) return 'bg-green-100 text-green-800'
  if (p.includes('BÁSICO') || p.includes('BASICO')) return 'bg-yellow-100 text-yellow-800'
  if (p.includes('BAJO')) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
}
</script>

<style scoped>
@media print {
  @page {
    margin: 1cm;
    size: letter portrait;
  }
}
</style>
