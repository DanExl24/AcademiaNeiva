<template>
  <div class="boletin-preview bg-white shadow-xl rounded-xl p-8 max-w-4xl mx-auto my-8 print:shadow-none print:m-0 print:p-0" ref="boletinRef">
    <!-- Parte Superior -->
    <header class="mb-4">
      <div class="flex items-center justify-between mt-4">
        <!-- Izquierda Logo -->
        <div class="w-32 h-32 flex items-center justify-center">
            <!-- Espacio reservado para Logo Izquierdo -->
            <div class="w-24 h-24 rounded-full border border-gray-400 bg-gray-100 flex items-center justify-center overflow-hidden">
                <span class="text-xs text-gray-400 text-center px-2">Logo Colegio</span>
            </div>
        </div>

        <!-- Centro Textos Institucionales -->
        <div class="flex-1 text-center font-serif flex flex-col justify-center px-4">
          <h1 class="text-xl font-bold uppercase tracking-wider mb-1" style="font-family: 'Quicksand', sans-serif;">
            {{ data?.estudiante?.colegio_nombre?.toUpperCase() || 'INSTITUCIÓN EDUCATIVA NORMAL SUPERIOR' }}
          </h1>
          <p class="text-[13px] font-bold mb-1" style="font-family: 'Quicksand', sans-serif;">
            DANE: {{ data?.estudiante?.dane }} – NIT: {{ data?.estudiante?.nit }}
          </p>
          <div class="text-[12px] font-medium leading-tight" style="font-family: 'Quicksand', sans-serif;">
            <p>{{ (data?.estudiante?.resolucion || '').split('Expedida')[0] }}</p>
            <p v-if="(data?.estudiante?.resolucion || '').includes('Expedida')">Expedida {{ (data?.estudiante?.resolucion || '').split('Expedida')[1] }}</p>
          </div>
          <p class="text-[13px] font-bold mt-2" style="font-family: 'Quicksand', sans-serif;">{{ data?.estudiante?.ciudad }}</p>
        </div>

        <!-- Derecha Logo (Escudo Colombia) -->
        <div class="w-32 h-32 flex items-center justify-center">
             <!-- Espacio reservado para Logo Derecho -->
             <div class="w-24 h-24 border border-gray-400 bg-gray-100 flex items-center justify-center overflow-hidden" style="border-radius: 20% 20% 50% 50%;">
                <span class="text-xs text-gray-400 text-center flex-col flex items-center leading-none"><span>Escudo</span><span>Nacional</span></span>
             </div>
        </div>
      </div>

      <div class="text-center font-bold text-sm tracking-wide border-b border-black pb-1 mb-2 mt-4" style="font-family: 'Quicksand', sans-serif;">
        INFORME ACADÉMICO - AÑO LECTIVO {{ data?.ano_lectivo || '2024' }}
      </div>

      <!-- Tarjeta Moderna Datos Estudiante -->
      <div class="bg-gray-50 border border-gray-200 rounded-xl mb-6 shadow-sm overflow-hidden" style="font-family: 'Quicksand', sans-serif;">
        <div class="grid grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          
          <div class="col-span-12 md:col-span-3 bg-white p-4 flex flex-col justify-center">
            <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Código Estudiantil</span>
            <span class="text-indigo-600 font-black text-lg">{{ data?.estudiante?.codigo }}</span>
          </div>

          <div class="col-span-12 md:col-span-6 bg-white p-4 flex flex-col justify-center">
            <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Nombre del Estudiante</span>
            <span class="text-gray-900 font-extrabold text-lg uppercase truncate">{{ data?.estudiante?.apellido }} {{ data?.estudiante?.nombre }}</span>
          </div>

          <div class="col-span-12 md:col-span-3 bg-indigo-50 p-4 flex flex-col justify-center relative overflow-hidden">
            <div class="absolute -right-4 -top-8 text-indigo-100 opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            </div>
            <span class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1 relative z-10">Periodo</span>
            <span class="text-indigo-700 font-black text-lg uppercase relative z-10">{{ data?.periodo }}</span>
          </div>
        </div>

        <div class="bg-gray-100 border-t border-gray-200 px-6 py-2 grid grid-cols-3 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-500 uppercase">Grado:</span>
            <span class="font-bold text-gray-900 shadow-sm bg-white px-2 py-0.5 rounded-full border border-gray-200">{{ data?.estudiante?.grado_nombre }} {{ data?.estudiante?.seccion }}</span>
          </div>
          <div class="flex items-center justify-center gap-2">
            <span class="font-bold text-gray-500 uppercase">Jornada:</span>
            <span class="font-bold text-gray-900">{{ data?.estudiante?.jornada_nombre || 'ÚNICA' }}</span>
          </div>
          <div class="flex items-center justify-end gap-2">
            <span class="font-bold text-gray-500 uppercase">Calendario:</span>
            <span class="font-bold text-gray-900">{{ data?.estudiante?.calendario || 'A' }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Parte Media -->
    <main class="space-y-6">
      <template v-for="(materia, index) in data?.materias" :key="index">
        <!-- Tarjeta de Materia -->
        <div class="border border-indigo-100 bg-white rounded-xl shadow-sm overflow-hidden break-inside-avoid">
          <!-- Cabecera de la Materia -->
          <div class="bg-indigo-50/70 border-b border-indigo-100 px-5 py-3 flex flex-wrap lg:flex-nowrap justify-between items-center gap-4 print:bg-gray-100">
            <div class="flex-1">
              <h3 class="text-sm font-black text-indigo-900 uppercase tracking-widest print:text-black">{{ materia.materia }}</h3>
              <p class="text-xs font-bold text-indigo-700/80 mt-0.5 uppercase italic print:text-gray-700">{{ materia.docente_nombre }} {{ materia.docente_apellido }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <div class="bg-white border border-indigo-100 rounded-lg px-4 py-2 text-center shadow-sm w-24">
                <span class="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">Ausencias</span>
                <span class="block text-sm font-black text-gray-800">{{ materia.ausencias }}</span>
              </div>
              
              <!-- Notas Historicas -->
              <template v-for="nota in materia.notas_historicas" :key="nota.id_periodo">
                <div class="bg-white border border-indigo-100 rounded-lg px-4 py-2 text-center shadow-sm w-32"
                     :class="{'ring-2 ring-indigo-400 bg-indigo-50 transform scale-105 print:transform-none': nota.periodo_nombre === data?.periodo}">
                  <span class="block text-[9px] font-bold uppercase truncate" :class="nota.periodo_nombre === data?.periodo ? 'text-indigo-600 print:text-black' : 'text-gray-400'">
                    {{ (nota.periodo_nombre || '').replace('Periodo', 'Per.') }}
                  </span>
                  <div class="flex items-center justify-center gap-1.5 mt-0.5">
                    <span class="text-sm font-black text-gray-900">{{ nota.calificacion }}</span>
                    <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase" :class="getPerformanceBadge(nota.desempeno)">{{ (nota.desempeno || 'SC').substring(0,3) }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
          
          <!-- Cuerpo de la Materia (Logros y Fortalezas) -->
          <div class="p-5 grid grid-cols-1 gap-5 text-xs text-gray-700">
            <!-- Desempeños / Competencias -->
            <div v-if="materia.desempenos?.length" class="space-y-2">
              <div class="flex justify-between border-b border-gray-100 pb-1.5">
                <span class="font-extrabold text-gray-800 uppercase tracking-widest text-[10px]">Desempeños</span>
                <span class="font-extrabold text-gray-500 uppercase tracking-widest text-[9px]">Superado</span>
              </div>
              <ul class="space-y-2 list-none m-0 p-0 text-[11px] leading-relaxed">
                <li v-for="(desempeno, idx) in materia.desempenos" :key="idx" class="flex justify-between items-start gap-4">
                  <div class="flex items-start gap-2.5 flex-1">
                    <span class="text-indigo-400 font-bold mt-0.5 text-sm leading-none pt-0.5">•</span>
                    <span class="font-medium">{{ desempeno }}</span>
                  </div>
                  <span class="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md text-[10px] shrink-0 border border-indigo-100 print:border-gray-300 print:bg-white print:text-black">
                    <template v-if="getCurrentCalificacion(materia) >= 3.0">SI</template>
                    <template v-else>NO</template>
                  </span>
                </li>
              </ul>
            </div>

            <!-- Fortalezas / Observaciones -->
            <div v-if="materia.fortalezas?.length || materia.debilidades?.length || materia.recomendaciones" class="space-y-2">
              <div class="border-b border-gray-100 pb-1.5 mt-1">
                <span class="font-extrabold text-gray-800 uppercase tracking-widest text-[10px]">Observaciones</span>
              </div>
              <ul class="space-y-2 list-none m-0 p-0 text-[11px] leading-relaxed">
                <li v-for="(fortaleza, idx) in materia.fortalezas" :key="'f'+idx" class="flex items-start gap-2.5">
                  <span class="text-green-500 font-bold mt-0.5 text-sm leading-none pt-0.5">▲</span>
                  <span class="font-medium">{{ fortaleza }}</span>
                </li>
                <li v-for="(debilidad, idx) in materia.debilidades" :key="'d'+idx" class="flex items-start gap-2.5">
                  <span class="text-red-500 font-bold mt-0.5 text-sm leading-none pt-0.5">▼</span>
                  <span class="font-medium">{{ debilidad }}</span>
                </li>
                <li v-for="(rec, idx) in (typeof materia.recomendaciones === 'string' && materia.recomendaciones ? [materia.recomendaciones] : [])" :key="'r'+idx" class="flex items-start gap-2.5 italic">
                  <span class="text-yellow-500 font-bold mt-0.5 text-sm leading-none pt-0.5">■</span>
                  <span class="font-medium">{{ rec }}</span>
                </li>
              </ul>
            </div>
            
            <!-- Vacio -->
            <div v-if="!materia.desempenos?.length && !materia.fortalezas?.length && !materia.debilidades?.length && !materia.recomendaciones" class="text-gray-400 italic text-center py-3 border border-dashed border-gray-200 rounded-lg">
              Sin registros cualitativos de observación.
            </div>
          </div>
        </div>
      </template>

      <!-- Pantalla Vacia Completa -->
      <div v-if="!data?.materias?.length" class="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
        <span class="text-gray-500 italic font-medium">No hay calificaciones registradas para este periodo.</span>
      </div>
    </main>

    <!-- Parte Final -->
    <!-- Parte Final: Resumen y Firmas -->
    <footer class="mt-8">
      <div class="grid grid-cols-12 gap-8">
        <!-- Columna Izquierda: Estadísticas y Observaciones -->
        <div class="col-span-12">
          <div class="bg-indigo-50/40 rounded-2xl p-6 border border-indigo-100 flex flex-wrap gap-8 items-center justify-between shadow-sm">
            <div class="flex items-center gap-6">
              <div class="bg-white p-3 rounded-xl shadow-sm border border-indigo-100 flex flex-col items-center min-w-[100px]">
                <span class="text-[9px] font-black uppercase text-indigo-400">Faltas Totales</span>
                <span class="text-3xl font-black text-indigo-700">{{ data?.materias?.reduce((acc: number, m: any) => acc + (m.ausencias || 0), 0) }}</span>
              </div>
              <div class="space-y-1">
                <h4 class="text-[10px] font-black uppercase text-indigo-400 tracking-widest leading-none">Estado Académico</h4>
                <div class="flex items-center gap-3">
                   <span class="px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700 border border-green-200" v-if="data?.promedioGeneral >= 3.0">PROMOVIDO / EN NIVEL</span>
                   <span class="px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200" v-else>REQUIERE NIVELACIÓN</span>
                   <div class="flex flex-col">
                     <span class="text-[9px] font-bold text-gray-400 uppercase leading-none">Promedio General</span>
                     <span class="text-xl font-black text-gray-800 leading-tight">{{ data?.promedioGeneral }}</span>
                   </div>
                </div>
              </div>
            </div>

            <!-- Observación General -->
            <div class="flex-1 max-w-lg border-l border-indigo-100 pl-6 lg:block hidden">
               <p class="text-[10px] italic text-gray-500 leading-relaxed font-medium">
                 "El éxito es la suma de pequeños esfuerzos repetidos día tras día. Te animamos a seguir cultivando la excelencia en tu proceso formativo."
               </p>
            </div>
          </div>
        </div>

        <!-- Sección de Firmas -->
        <div class="col-span-12 grid grid-cols-3 gap-12 mt-16 mb-8 px-4">
          <div class="text-center">
            <div class="h-20 flex flex-col justify-end items-center">
               <div class="w-full border-t border-gray-400 pt-3">
                 <p class="text-[10px] font-black uppercase text-gray-800 tracking-tight">Firma Director de Grupo</p>
                 <p class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Responsable del Aula</p>
               </div>
            </div>
          </div>
          <div class="text-center">
            <!-- Espacio para el sello institucional -->
            <div class="h-20 flex items-center justify-center -mt-4 opacity-[0.08]">
               <div class="w-20 h-20 rounded-full border-[1.5px] border-gray-900 flex items-center justify-center text-center text-[7px] font-black p-2 border-dashed">
                 SELLO<br/>ACADEMIA<br/>NEIVA
               </div>
            </div>
          </div>
          <div class="text-center">
            <div class="h-20 flex flex-col justify-end items-center">
               <div class="w-full border-t border-gray-400 pt-3">
                 <p class="text-[10px] font-black uppercase text-gray-800 tracking-tight">Coordinación Académica</p>
                 <p class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Autoridad Colegiada</p>
               </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="text-center pt-6 border-t border-gray-50 flex justify-between items-center px-2">
        <p class="text-[8px] text-gray-300 font-bold uppercase tracking-[0.2em]">CÓDIGO: GB-01 • VERSIÓN: 2.0</p>
        <p class="text-[8px] text-gray-300 font-bold uppercase tracking-[0.2em]">AcademiaNeiva Cloud • {{ new Date().toLocaleDateString() }}</p>
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



const getPerformanceBadge = (performance: string) => {
  if (!performance) return 'bg-gray-100 text-gray-800'
  const p = performance.toUpperCase()
  if (p.includes('SUPERIOR')) return 'bg-blue-100 text-blue-800'
  if (p.includes('ALTO')) return 'bg-green-100 text-green-800'
  if (p.includes('BÁSICO') || p.includes('BASICO')) return 'bg-yellow-100 text-yellow-800'
  if (p.includes('BAJO')) return 'bg-red-100 text-red-800 border border-red-200 print:border-gray-400 print:text-black print:bg-white'
  return 'bg-gray-100 text-gray-800'
}

const getCurrentCalificacion = (materia: any) => {
  if (!materia?.notas_historicas?.length) return 0;
  const current = materia.notas_historicas[materia.notas_historicas.length - 1];
  return parseFloat(current.calificacion) || 0;
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
