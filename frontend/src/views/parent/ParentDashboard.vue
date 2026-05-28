<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import { 
  Users, 
  GraduationCap, 
  CalendarCheck,
  ClipboardCheck,
  TrendingUp,
  MessageSquare,
  Bell
} from 'lucide-vue-next'

const auth = useAuthStore()

const children = [
  { name: 'Juan Manuel Pérez', grade: '3º A', avatar: 'J', status: 'Al día', performance: 'Excelente' }
]

const recentGrades = [
  { subject: 'Matemáticas', score: '4.8', date: 'Hace 2 días' },
  { subject: 'Lenguaje', score: '4.2', date: 'Hace 5 días' }
]
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-700">
    <!-- Premium Welcome Header -->
    <div class="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-emerald-100 relative overflow-hidden">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div class="space-y-4">
          <div class="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-bold">
            <Bell :size="16" />
            Panel de Padre de Familia
          </div>
          <h1 class="text-5xl font-black tracking-tight">¡Bienvenido, {{ auth.user?.name.split(' ')[0] }}! 🏠</h1>
          <p class="text-emerald-50 text-xl max-w-lg leading-relaxed">
            Sigue el progreso académico y la asistencia de tus hijos en tiempo real.
          </p>
        </div>
        <div class="flex flex-wrap gap-4">
          <button class="bg-white text-emerald-700 hover:bg-emerald-50 px-8 py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center gap-2 text-lg">
            <CalendarCheck :size="24" />
            Ver Asistencia
          </button>
        </div>
      </div>
      <!-- Abstract Decorations -->
      <div class="absolute -right-20 -top-20 h-96 w-96 bg-white/10 rounded-full blur-3xl"></div>
      <div class="absolute left-1/2 -bottom-10 h-64 w-64 bg-emerald-400/20 rounded-full blur-2xl"></div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left Column: Children Status -->
      <div class="lg:col-span-2 space-y-8">
        <div class="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <h3 class="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            <Users class="text-emerald-600" :size="32" />
            Mis Hijos Matriculados
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-for="child in children" :key="child.name" class="group bg-gray-50/50 hover:bg-white p-6 rounded-3xl border border-transparent hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-50 transition-all duration-300">
              <div class="flex items-center gap-5">
                <div class="h-16 w-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-200">
                  {{ child.avatar }}
                </div>
                <div>
                  <h4 class="text-xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{{ child.name }}</h4>
                  <p class="text-gray-500 font-medium">{{ child.grade }}</p>
                </div>
              </div>
              <div class="mt-8 grid grid-cols-2 gap-4">
                <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Estado</p>
                  <p class="text-emerald-600 font-black">{{ child.status }}</p>
                </div>
                <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Desempeño</p>
                  <p class="text-indigo-600 font-black">{{ child.performance }}</p>
                </div>
              </div>
              <button class="mt-6 w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                Ver Detalles Académicos
                <TrendingUp :size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Quick Stats / Updates -->
      <div class="space-y-8">
        <!-- Recent Grades Card -->
        <div class="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <h3 class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ClipboardCheck class="text-amber-500" />
            Últimas Calificaciones
          </h3>
          <div class="space-y-4">
            <div v-for="grade in recentGrades" :key="grade.subject" class="p-4 rounded-2xl bg-gray-50 flex items-center justify-between">
              <div>
                <p class="font-bold text-gray-800">{{ grade.subject }}</p>
                <p class="text-xs text-gray-500">{{ grade.date }}</p>
              </div>
              <div class="text-2xl font-black text-emerald-600">{{ grade.score }}</div>
            </div>
          </div>
          <button class="mt-6 w-full text-emerald-600 font-bold hover:underline flex items-center justify-center gap-2">
            Ver todas las notas
            <ChevronRight :size="18" />
          </button>
        </div>

        <!-- Communications -->
        <div class="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-100">
          <MessageSquare class="mb-4" :size="32" />
          <h3 class="text-xl font-bold mb-2">Mensajes del Colegio</h3>
          <p class="text-indigo-100 text-sm mb-6 leading-relaxed">
            Mantente en contacto con los docentes y directivos de la institución.
          </p>
          <button class="w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl font-bold transition-all">
            Ir a Mensajería
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-in {
  animation-fill-mode: both;
}
.fade-in {
  animation-name: fadeIn;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
