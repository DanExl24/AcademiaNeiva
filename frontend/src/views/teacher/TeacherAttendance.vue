<script setup lang="ts">
import { ref } from 'vue'
import { CalendarCheck, Search, Check, X, Minus, Download, Save } from 'lucide-vue-next'

const selectedDate = ref(new Date().toISOString().split('T')[0])

const students = ref([
  { id: 1, name: 'Juan Pérez', status: 'present' },
  { id: 2, name: 'María García', status: 'absent' },
  { id: 3, name: 'Carlos López', status: 'late' },
  { id: 4, name: 'Ana Martínez', status: 'present' },
])

const setStatus = (studentId: number, status: string) => {
  const student = students.value.find(s => s.id === studentId)
  if (student) student.status = status
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Asistencia de Grados</h1>
        <p class="text-gray-500 text-lg">Registra y controla la asistencia diaria de tus estudiantes.</p>
      </div>
      <div class="flex gap-3">
        <button class="bg-gray-100 text-gray-600 px-6 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center gap-2">
          <Download :size="20" />
          Descargar Formato
        </button>
        <button class="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2">
          <Save :size="20" />
          Guardar Asistencia
        </button>
      </div>
    </div>

    <!-- Attendance Header -->
    <div class="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex flex-wrap items-center gap-6">
      <div class="space-y-2">
        <label class="text-xs font-bold text-gray-400 uppercase ml-2">Fecha</label>
        <input type="date" v-model="selectedDate" class="bg-gray-50 border-0 rounded-2xl p-4 focus:ring-2 focus:ring-emerald-500 transition-all" />
      </div>
      <div class="space-y-2 flex-1 min-w-[200px]">
        <label class="text-xs font-bold text-gray-400 uppercase ml-2">Buscar</label>
        <div class="relative">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="20" />
          <input type="text" placeholder="Filtrar por nombre..." class="w-full bg-gray-50 border-0 rounded-2xl p-4 pl-12 focus:ring-2 focus:ring-emerald-500 transition-all" />
        </div>
      </div>
      <div class="flex items-center gap-8 px-6 border-l border-gray-100">
        <div class="text-center">
          <p class="text-xs font-bold text-gray-400 uppercase">Presentes</p>
          <p class="text-2xl font-bold text-emerald-600">32</p>
        </div>
        <div class="text-center">
          <p class="text-xs font-bold text-gray-400 uppercase">Ausentes</p>
          <p class="text-2xl font-bold text-red-500">2</p>
        </div>
      </div>
    </div>

    <!-- Attendance Grid -->
    <div class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="p-8 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
        <h2 class="text-xl font-bold text-gray-900 flex items-center gap-3">
          <CalendarCheck class="text-emerald-600" :size="24" />
          Módulo de Asistencia: Primero A
        </h2>
      </div>

      <div class="p-8">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div v-for="student in students" :key="student.id" 
            class="group p-6 rounded-3xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-xl hover:shadow-emerald-50 transition-all duration-300">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600 font-bold group-hover:scale-110 transition-transform">
                  {{ student.name.charAt(0) }}
                </div>
                <h3 class="font-bold text-gray-800 text-lg">{{ student.name }}</h3>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <button 
                @click="setStatus(student.id, 'present')"
                :class="[
                  student.status === 'present' ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-white text-gray-400 hover:bg-emerald-50 hover:text-emerald-600',
                  'flex flex-col items-center gap-2 p-4 rounded-2xl transition-all font-bold'
                ]"
              >
                <Check :size="20" />
                <span class="text-xs">Presente</span>
              </button>
              <button 
                @click="setStatus(student.id, 'absent')"
                :class="[
                  student.status === 'absent' ? 'bg-red-500 text-white ring-4 ring-red-100' : 'bg-white text-gray-400 hover:bg-red-50 hover:text-red-500',
                  'flex flex-col items-center gap-2 p-4 rounded-2xl transition-all font-bold'
                ]"
              >
                <X :size="20" />
                <span class="text-xs">Ausente</span>
              </button>
              <button 
                @click="setStatus(student.id, 'late')"
                :class="[
                  student.status === 'late' ? 'bg-amber-500 text-white ring-4 ring-amber-100' : 'bg-white text-gray-400 hover:bg-amber-50 hover:text-amber-500',
                  'flex flex-col items-center gap-2 p-4 rounded-2xl transition-all font-bold'
                ]"
              >
                <Minus :size="20" />
                <span class="text-xs">Retraso</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
