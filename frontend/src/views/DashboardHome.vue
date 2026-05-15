<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp 
} from 'lucide-vue-next'

const auth = useAuthStore()

const stats = [
  { name: 'Estudiantes', value: '1,234', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-100' },
  { name: 'Docentes', value: '45', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { name: 'Materias', value: '12', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { name: 'Rendimiento', value: '88%', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Welcome -->
    <div class="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
      <div class="relative z-10">
        <h1 class="text-3xl font-bold">¡Bienvenido, {{ auth.user?.name || 'Usuario' }}!</h1>
        <p class="mt-2 text-indigo-100 max-w-md">
          Tienes el rol de <span class="font-bold underline">{{ auth.user?.roles?.join(', ') }}</span>. Aquí tienes un resumen de lo que está sucediendo hoy en tu institución.
        </p>
      </div>
      <!-- Decoration -->
      <div class="absolute -right-10 -bottom-10 h-64 w-64 bg-white/10 rounded-full blur-3xl"></div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="stat in stats" :key="stat.name" class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div :class="[stat.bg, stat.color, 'p-4 rounded-2xl']">
          <component :is="stat.icon" :size="28" />
        </div>
        <div>
          <p class="text-sm font-medium text-gray-500">{{ stat.name }}</p>
          <p class="text-2xl font-bold text-gray-900">{{ stat.value }}</p>
        </div>
      </div>
    </div>

    <!-- Placeholder Section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-64 flex flex-col items-center justify-center text-gray-400">
        <TrendingUp :size="48" class="mb-4" />
        <p>Gráficos de rendimiento en construcción...</p>
      </div>
      <div class="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-64 flex flex-col items-center justify-center text-gray-400">
        <Users :size="48" class="mb-4" />
        <p>Listado rápido...</p>
      </div>
    </div>
  </div>
</template>
