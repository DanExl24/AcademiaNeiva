<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import { 
  GraduationCap, 
  BookOpen, 
  ClipboardList, 
  CalendarCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-vue-next'

const auth = useAuthStore()

const teacherStats = [
  { name: 'Mis Cursos', value: '3', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-100' },
  { name: 'Estudiantes', value: '83', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { name: 'Pendientes Nota', value: '12', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
  { name: 'Asistencia Hoy', value: '98%', icon: CalendarCheck, color: 'text-emerald-600', bg: 'bg-emerald-100' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Welcome Teacher -->
    <div class="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-10 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 class="text-4xl font-black">¡Hola, Profe {{ auth.user?.name.split(' ')[0] }}! 🍎</h1>
          <p class="mt-3 text-indigo-100 text-lg max-w-md">
            Tienes <span class="font-bold underline">3 clases</span> programadas para hoy. Tu próxima clase es Matemáticas en 1º A.
          </p>
        </div>
        <div class="flex gap-4">
          <router-link to="/dashboard/calificaciones" class="bg-white/20 hover:bg-white/30 backdrop-blur-md px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2">
            <ClipboardList :size="20" />
            Subir Notas
          </router-link>
        </div>
      </div>
      <!-- Decoration -->
      <div class="absolute -right-10 -bottom-10 h-80 w-80 bg-white/10 rounded-full blur-3xl"></div>
      <div class="absolute right-20 top-0 h-40 w-40 bg-indigo-400/20 rounded-full blur-2xl animate-pulse"></div>
    </div>

    <!-- Teacher Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="stat in teacherStats" :key="stat.name" class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <div :class="[stat.bg, stat.color, 'p-4 rounded-2xl']">
          <component :is="stat.icon" :size="28" />
        </div>
        <div>
          <p class="text-sm font-medium text-gray-400 uppercase tracking-wider">{{ stat.name }}</p>
          <p class="text-2xl font-black text-gray-900">{{ stat.value }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Recent Activity / Timeline -->
      <div class="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <h3 class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp class="text-indigo-600" />
          Actividad Académica Reciente
        </h3>
        <div class="space-y-6">
          <div v-for="i in 3" :key="i" class="flex gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
            <div class="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <CalendarCheck class="text-gray-400" />
            </div>
            <div>
              <p class="font-bold text-gray-800">Asistencia tomada en 1º A</p>
              <p class="text-sm text-gray-500">Hace 2 horas • Matemáticas</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions / Alerts -->
      <div class="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <h3 class="text-xl font-bold text-gray-900 mb-6">Alertas de Grado</h3>
        <div class="space-y-4">
          <div class="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
            <AlertCircle class="text-amber-600 mt-0.5" :size="20" />
            <div>
              <p class="text-sm font-bold text-amber-900">Periodo 1 por cerrar</p>
              <p class="text-xs text-amber-700">Quedan 3 días para completar todas las notas.</p>
            </div>
          </div>
          <div class="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
            <GraduationCap class="text-blue-600 mt-0.5" :size="20" />
            <div>
              <p class="text-sm font-bold text-blue-900">Nueva Matrícula</p>
              <p class="text-xs text-blue-700">Se ha asignado un nuevo estudiante a 2º B.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
