<script setup lang="ts">
import { ref } from 'vue'
import { Eye, Plus, Search, MessageSquare, ShieldAlert, Award, Lightbulb } from 'lucide-vue-next'

const observations = ref([
  { id: 1, student: 'Juan Pérez', type: 'fortaleza', text: 'Muestra gran interés por la resolución de problemas lógicos.', date: '2024-05-10' },
  { id: 2, student: 'María García', type: 'debilidad', text: 'Se distrae con facilidad durante las explicaciones teóricas.', date: '2024-05-12' },
  { id: 3, student: 'Carlos López', type: 'recomendacion', text: 'Se sugiere reforzar el estudio de las tablas de multiplicar.', date: '2024-05-14' },
])

const getTypeStyles = (type: string) => {
  switch (type) {
    case 'fortaleza': return { icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' }
    case 'debilidad': return { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' }
    case 'recomendacion': return { icon: Lightbulb, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' }
    default: return { icon: MessageSquare, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' }
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Observador del Estudiante</h1>
        <p class="text-gray-500 text-lg">Consulta y registra el seguimiento convivencial y académico.</p>
      </div>
      <button class="bg-amber-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all flex items-center gap-2">
        <Plus :size="24" />
        Nueva Anotación
      </button>
    </div>

    <!-- Search and Quick Stats -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div class="lg:col-span-2 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center px-6">
        <Search class="text-gray-400 mr-4" :size="24" />
        <input type="text" placeholder="Buscar por estudiante..." class="w-full border-0 focus:ring-0 text-lg placeholder-gray-300" />
      </div>
      <div class="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center justify-between">
        <div class="text-emerald-600 font-bold">Fortalezas</div>
        <div class="text-2xl font-black text-emerald-700">124</div>
      </div>
      <div class="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-center justify-between">
        <div class="text-red-600 font-bold">Debilidades</div>
        <div class="text-2xl font-black text-red-700">12</div>
      </div>
    </div>

    <!-- Observations Timeline/List -->
    <div class="bg-white rounded-3xl border border-amber-200 p-8 shadow-sm">
      <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-10">
        <Eye class="text-amber-600" :size="28" />
        Consulta y Registros por Periodo
      </h2>

      <div class="space-y-8 relative before:absolute before:left-12 before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-100">
        <div v-for="obs in observations" :key="obs.id" class="relative pl-20 group">
          <!-- Timeline Marker -->
          <div :class="[getTypeStyles(obs.type).bg, getTypeStyles(obs.type).color, 'absolute left-8 -translate-x-1/2 top-0 h-10 w-10 rounded-full flex items-center justify-center z-10 shadow-sm group-hover:scale-125 transition-transform']">
            <component :is="getTypeStyles(obs.type).icon" :size="20" />
          </div>

          <div :class="[getTypeStyles(obs.type).border, 'bg-white p-8 rounded-3xl border-2 shadow-sm group-hover:shadow-xl transition-all duration-300']">
            <div class="flex items-center justify-between mb-4">
              <div>
                <span :class="[getTypeStyles(obs.type).color, 'text-xs font-bold uppercase tracking-widest']">{{ obs.type }}</span>
                <h3 class="text-xl font-black text-gray-800 mt-1">{{ obs.student }}</h3>
              </div>
              <span class="text-sm font-medium text-gray-400">{{ obs.date }}</span>
            </div>
            <p class="text-gray-600 leading-relaxed text-lg italic">"{{ obs.text }}"</p>
            
            <div class="mt-6 pt-6 border-t border-gray-50 flex items-center justify-end gap-4">
              <button class="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">Editar</button>
              <button class="text-sm font-bold text-red-400 hover:text-red-600 transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
