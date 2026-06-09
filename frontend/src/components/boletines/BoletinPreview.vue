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
          
          <div class="col-span-12 md:col-span-12 lg:col-span-3 bg-white p-4 flex flex-col justify-center">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Código Estudiantil</span>
            <span class="text-slate-700 font-black text-lg">{{ data?.estudiante?.codigo }}</span>
          </div>

          <div class="col-span-12 md:col-span-12 lg:col-span-6 bg-white p-4 flex flex-col justify-center border-x border-gray-100">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Nombre del Estudiante</span>
            <span class="text-gray-900 font-black text-base uppercase leading-tight">{{ data?.estudiante?.apellido }} {{ data?.estudiante?.nombre }}</span>
          </div>

          <div class="col-span-12 md:col-span-12 lg:col-span-3 bg-indigo-50/50 p-4 flex flex-col justify-center relative overflow-hidden">
            <div class="absolute -right-2 -top-4 text-indigo-200/30">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            </div>
            <span class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1 relative z-10">Periodo</span>
            <span class="text-indigo-700 font-black text-sm uppercase relative z-10">{{ data?.periodo }}</span>
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
            <div class="flex flex-nowrap items-center gap-1.5 shrink-0 ml-auto">
              <!-- Caja Ausencias -->
              <div class="bg-white border border-indigo-100 rounded-lg px-2 py-1.5 text-center shadow-sm w-20 shrink-0">
                <span class="block text-[8px] font-bold text-gray-400 uppercase tracking-tight">Ausencias</span>
                <span class="block text-xs font-black text-slate-800">{{ materia.ausencias }}</span>
              </div>
              
              <!-- Notas Historicas -->
              <template v-for="nota in materia.notas_historicas" :key="nota.id_periodo">
                <div class="bg-white border border-indigo-100 rounded-lg px-2 py-1.5 text-center shadow-sm w-20 shrink-0"
                     :class="{'ring-1 ring-indigo-400 bg-indigo-50/50 transform scale-105 print:transform-none print:ring-0': nota.periodo_nombre === data?.periodo}">
                  <span class="block text-[8px] font-bold uppercase" :class="nota.periodo_nombre === data?.periodo ? 'text-indigo-600 print:text-black font-black' : 'text-gray-400'">
                    {{ (nota.periodo_nombre || '').replace(/periodo/i, 'P.') }}
                  </span>
                  <div class="flex items-center justify-center gap-1 mt-0.5">
                    <span class="text-xs font-black text-gray-900">{{ nota.calificacion }}</span>
                    <span class="text-[7px] font-black px-1 py-0.5 rounded leading-none" :class="getPerformanceBadge(nota.desempeno)">{{ (nota.desempeno || 'SC').substring(0,3) }}</span>
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

            <!-- Fortalezas / Observaciones Compactas -->
            <div v-if="materia.observaciones?.length" class="space-y-4">
              <div class="border-b border-gray-100 pb-1 mt-1">
                <span class="font-black text-gray-800 uppercase tracking-widest text-[9px]">Observaciones y Retroalimentación</span>
              </div>
              <ul class="space-y-1.5 list-none m-0 p-0 text-[10px] leading-snug">
                <template v-for="(obs, oIdx) in materia.observaciones" :key="oIdx">
                  <!-- Fortalezas -->
                  <li v-for="(fortaleza, fIdx) in obs.fortalezas" :key="'f'+oIdx+fIdx" class="flex items-start gap-2">
                    <span class="text-green-600 font-bold mt-0.5 text-xs leading-none">▲</span>
                    <span class="font-medium text-gray-700">{{ fortaleza }} <span class="text-[8px] font-black text-gray-400 uppercase ml-1">- {{ getTypeLabel(obs.tipo) }}</span></span>
                  </li>
                  <!-- Debilidades -->
                  <li v-for="(debilidad, dIdx) in obs.debilidades" :key="'d'+oIdx+dIdx" class="flex items-start gap-2">
                    <span class="text-red-500 font-bold mt-0.5 text-xs leading-none">▼</span>
                    <span class="font-medium text-gray-700">{{ debilidad }} <span class="text-[8px] font-black text-gray-400 uppercase ml-1">- {{ getTypeLabel(obs.tipo) }}</span></span>
                  </li>
                  <!-- Recomendaciones -->
                  <li v-if="obs.recomendaciones" :key="'r'+oIdx" class="flex items-start gap-2 italic text-gray-500">
                    <span class="text-indigo-400 font-bold mt-0.5 text-xs leading-none">■</span>
                    <span class="font-bold">{{ obs.recomendaciones }} <span class="text-[8px] font-black text-gray-400 uppercase not-italic ml-1">- {{ getTypeLabel(obs.tipo) }}</span></span>
                  </li>
                </template>
              </ul>
            </div>
            
            <!-- Vacio -->
            <div v-else class="text-gray-400 italic text-center py-2 border border-dashed border-gray-200 rounded-lg text-[10px]">
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
    <!-- Parte Final: Resumen, Escala y Firmas (Estilo Premium) -->
    <footer class="mt-12 space-y-8">
      <!-- Tabla de Datos Finales (Modernizada) -->
      <div class="grid grid-cols-3 gap-6">
        <div class="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col items-center">
          <span class="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-1">Promedio Periodo</span>
          <span class="text-2xl font-black text-indigo-900">{{ data?.promedioGeneral }}</span>
        </div>
        <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col items-center">
          <span class="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">Nivel Desempeño</span>
          <span class="text-lg font-black text-blue-900 uppercase">
             {{ data?.nivelDesempeno || '—' }}
          </span>
        </div>
        <div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex flex-col items-center">
          <span class="text-[9px] font-black uppercase text-purple-400 tracking-widest mb-1">Puesto Académico</span>
          <div class="flex items-baseline gap-1">
            <span class="text-2xl font-black text-purple-900">{{ data?.ranking?.puesto ?? '—' }}</span>
            <span class="text-xs font-bold text-purple-400" v-if="data?.ranking?.total">de {{ data.ranking.total }}</span>
          </div>
        </div>
      </div>

      <!-- Escala de Valoración (con colores por nivel) -->
      <div class="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
        <div class="flex items-center gap-6">
          <span class="text-[9px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Escala de Valoración:</span>
          <div class="flex flex-1 justify-around">
            <template v-if="data?.escala && data.escala.length > 0">
              <div v-for="item in data.escala" :key="item.nivel" class="flex flex-col items-center gap-1">
                <span
                  class="px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                  :class="{
                    'bg-red-100 text-red-700':    item.nivel?.toLowerCase().includes('bajo'),
                    'bg-amber-100 text-amber-700': item.nivel?.toLowerCase().includes('b') && !item.nivel?.toLowerCase().includes('bajo'),
                    'bg-green-100 text-green-700': item.nivel?.toLowerCase().includes('alto'),
                    'bg-blue-100 text-blue-700':   item.nivel?.toLowerCase().includes('superior'),
                  }"
                >{{ item.nivel }}</span>
                <span class="text-[8px] font-bold text-gray-400">({{ item.valor_minimo }} – {{ item.valor_maximo }})</span>
              </div>
            </template>
            <template v-else>
              <div class="flex flex-col items-center gap-1">
                <span class="px-3 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-700">Bajo</span>
                <span class="text-[8px] font-bold text-gray-400">(0.0 – 2.9)</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <span class="px-3 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-700">Básico</span>
                <span class="text-[8px] font-bold text-gray-400">(3.0 – 3.8)</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <span class="px-3 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-100 text-green-700">Alto</span>
                <span class="text-[8px] font-bold text-gray-400">(3.9 – 4.5)</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <span class="px-3 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700">Superior</span>
                <span class="text-[8px] font-bold text-gray-400">(4.6 – 5.0)</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Mensaje Motivacional -->
      <div class="bg-gradient-to-r from-indigo-50/60 via-blue-50/40 to-purple-50/60 rounded-xl border border-indigo-100/50 p-5 text-center">
        <p class="text-[10px] italic text-indigo-600/80 leading-relaxed font-medium tracking-wide">
          "El éxito es la suma de pequeños esfuerzos repetidos día tras día.<br>Te animamos a seguir cultivando la excelencia en tu proceso formativo."
        </p>
        <div class="mt-2 flex justify-center">
          <div class="w-8 h-0.5 rounded-full bg-gradient-to-r from-indigo-300 to-purple-300"></div>
        </div>
      </div>

      <!-- Sección de Firmas (Quicksand + Elegancia Clásica) -->
      <div class="grid grid-cols-2 gap-32 px-12 pt-16">
        <div class="text-center group">
          <div class="h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent mb-4"></div>
          <p class="text-xs font-black uppercase text-gray-900 tracking-tight transition-all duration-300 group-hover:tracking-widest" style="font-family: 'Quicksand', sans-serif;">
            {{ data?.firmas?.rector || 'RECTORÍA' }}
          </p>
          <p class="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-tighter">Rectoría Institucional</p>
        </div>
        <div class="text-center group">
          <div class="h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent mb-4"></div>
          <p class="text-xs font-black uppercase text-gray-900 tracking-tight transition-all duration-300 group-hover:tracking-widest" style="font-family: 'Quicksand', sans-serif;">
             {{ data?.firmas?.titular || 'DIRECTOR(A) DE GRUPO' }}
          </p>
          <p class="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-tighter">Director(a) de Grupo</p>
        </div>
      </div>
      
      <!-- Pie de Página Técnico -->
      <div class="text-center pt-12 border-t border-gray-50 flex justify-between items-center px-4">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
          <p class="text-[7px] text-gray-400 font-bold uppercase tracking-[0.2em]">SISTEMA DE GESTIÓN ACADÉMICA • CÓDIGO: GB-01 • v2.5</p>
        </div>
        <p class="text-[7px] text-gray-300 font-bold uppercase tracking-[0.2em]">Generado por AcademiaNeiva Cloud • {{ new Date().toLocaleDateString() }}</p>
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

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'ACADEMICA': return 'Académica'
    case 'DISCIPLINARIA': return 'Disciplinaria'
    case 'CONVIVENCIAL': return 'Convivencial'
    default: return type
  }
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
