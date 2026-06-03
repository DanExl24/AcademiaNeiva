<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import {
  GraduationCap,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  History,
  MessageSquare,
  Star,
  ChevronRight,
  Sparkles
} from 'lucide-vue-next'

const auth = useAuthStore()

const studentName = auth.user?.name?.split(' ')[0] || 'Estudiante'

const modules = [
  {
    id: 'notas',
    title: 'Mis Notas',
    description: 'Consulta tus calificaciones por materia y periodo académico.',
    icon: BookOpen,
    color: 'from-indigo-500 to-indigo-700',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
    borderColor: 'hover:border-indigo-200 dark:hover:border-indigo-800',
    comingSoon: false,
  },
  {
    id: 'asistencia',
    title: 'Mi Asistencia',
    description: 'Revisa tu historial de asistencia por materia y fecha.',
    icon: CalendarCheck,
    color: 'from-emerald-500 to-emerald-700',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
    borderColor: 'hover:border-emerald-200 dark:hover:border-emerald-800',
    comingSoon: true,
  },
  {
    id: 'observaciones',
    title: 'Observaciones',
    description: 'Ve las observaciones académicas registradas por tus docentes.',
    icon: MessageSquare,
    color: 'from-amber-500 to-amber-700',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    borderColor: 'hover:border-amber-200 dark:hover:border-amber-800',
    comingSoon: true,
  },
  {
    id: 'historial',
    title: 'Historial Académico',
    description: 'Consulta tu evolución y rendimiento académico a lo largo del tiempo.',
    icon: History,
    color: 'from-purple-500 to-purple-700',
    textColor: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'hover:border-purple-200 dark:hover:border-purple-800',
    comingSoon: true,
  },
]
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

    <!-- Welcome Hero Banner -->
    <div class="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 rounded-3xl p-8 md:p-10 text-white shadow-2xl">
      <!-- Background Accents -->
      <div class="absolute -right-24 -top-20 h-72 w-72 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute left-1/2 -bottom-16 h-56 w-56 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none"></div>
      <div class="absolute right-1/4 top-6 h-24 w-24 bg-violet-400/30 rounded-full blur-xl animate-pulse pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2 mb-5">
            <Sparkles :size="16" class="text-yellow-300" />
            <span class="text-sm font-bold text-white/90">Portal Estudiantil</span>
          </div>
          <h1 class="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            ¡Hola, <span class="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">{{ studentName }}</span>! 🎓
          </h1>
          <p class="mt-4 text-indigo-100 text-lg font-medium max-w-lg leading-relaxed">
            Bienvenido a tu portal académico. Aquí podrás consultar tus notas, asistencias, observaciones y tu historial académico.
          </p>
        </div>
        
        <!-- Student Card Avatar -->
        <div class="shrink-0 flex flex-col items-center gap-3">
          <div class="h-24 w-24 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-xl">
            <GraduationCap :size="48" class="text-white" />
          </div>
          <div class="flex items-center gap-1.5 bg-emerald-400/20 border border-emerald-400/30 rounded-full px-3 py-1">
            <div class="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span class="text-emerald-200 text-xs font-bold">Activo</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Stats Banner -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="item in [
          { label: 'Notas', icon: ClipboardList, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
          { label: 'Materias', icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          { label: 'Asistencia', icon: CalendarCheck, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
          { label: 'Logros', icon: Star, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' }
        ]"
        :key="item.label"
        class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 shadow-sm cursor-default"
      >
        <div :class="[item.bg, item.color, 'p-3 rounded-xl']">
          <component :is="item.icon" :size="22" stroke-width="2.5" />
        </div>
        <div>
          <p class="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{{ item.label }}</p>
          <p class="text-base font-black text-slate-500 dark:text-slate-400 mt-0.5 italic">Próximamente</p>
        </div>
      </div>
    </div>

    <!-- Modules Grid -->
    <div>
      <div class="flex items-center gap-3 mb-6">
        <h2 class="text-xl font-black text-slate-800 dark:text-white">Mis Módulos</h2>
        <span class="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">Panel PF01</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <router-link
          v-for="mod in modules"
          :key="mod.id"
          :to="mod.id === 'notas' ? '/dashboard/mis-notas' : '#'"
          class="group relative bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 p-7 transition-all duration-300 hover:shadow-xl cursor-pointer overflow-hidden"
          :class="mod.borderColor"
        >
          <!-- Module top accent bar -->
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-3xl" :class="mod.color"></div>

          <div class="flex items-start gap-5">
            <div :class="[mod.bgColor, mod.textColor, 'p-4 rounded-2xl shrink-0 group-hover:scale-110 transition-transform duration-300']">
              <component :is="mod.icon" :size="28" stroke-width="2" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5">
                <h3 class="text-lg font-black text-slate-800 dark:text-white">{{ mod.title }}</h3>
                <span v-if="mod.comingSoon" class="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">Próximamente</span>
              </div>
              <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{{ mod.description }}</p>
            </div>
            <ChevronRight :size="20" class="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 group-hover:translate-x-1 transition-all duration-300 mt-1" />
          </div>
        </router-link>
      </div>
    </div>

    <!-- Footer info message -->
    <div class="p-6 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 text-center">
      <Sparkles :size="20" class="text-indigo-400 mx-auto mb-3" />
      <p class="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        Los módulos de consulta académica estarán disponibles próximamente.
      </p>
      <p class="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
        Podrás consultar tus notas, asistencias, observaciones e historial desde este portal.
      </p>
    </div>

  </div>
</template>
