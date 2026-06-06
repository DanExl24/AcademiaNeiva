<script setup lang="ts">
import { ref } from 'vue'
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  School,
  GraduationCap,
  CalendarCheck,
  Eye,
  Lock,
  Layers3,
  LibraryBig,
  SlidersHorizontal,
  Sun,
  Moon,
  FileText,
  BookOpen,
  MessageSquare
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const isCollapsed = ref(false)

const switchRole = (newRole: string) => {
  auth.setActiveRole(newRole)
  router.push('/dashboard')
}

const menuItems = computed(() => {
  const role = auth.activeRole?.toLowerCase()
  
  if (role === 'docente') {
    return [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Mis Cursos', icon: GraduationCap, path: '/dashboard/mis-cursos' },
      { name: 'Calificaciones', icon: ClipboardList, path: '/dashboard/calificaciones' },
      { name: 'Asistencia', icon: CalendarCheck, path: '/dashboard/asistencia' },
      { name: 'Observador', icon: Eye, path: '/dashboard/observador' },
      { name: 'Cierre de Periodo', icon: Lock, path: '/dashboard/cierre-periodo' },
    ]
  }

  if (role === 'padre') {
    return [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Mis Hijos', icon: Users, path: '/dashboard/hijos' },
      { name: 'Calificaciones', icon: ClipboardList, path: '/dashboard/notas-hijos' },
      { name: 'Asistencia', icon: CalendarCheck, path: '/dashboard/asistencia-hijos' },
      { name: 'Observaciones', icon: MessageSquare, path: '/dashboard/observaciones-hijos' },
    ]
  }

  if (role === 'estudiante') {
    return [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Mis Notas', icon: BookOpen, path: '/dashboard/mis-notas' },
      { name: 'Mi Asistencia', icon: CalendarCheck, path: '/dashboard/mi-asistencia' },
      { name: 'Observaciones', icon: MessageSquare, path: '/dashboard/mi-observacion' },
    ]
  }
  
  // Default (Admin/Directivo)
  return [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Gestión Matrículas', icon: ClipboardList, path: '/dashboard/gestion-matriculas' },
    { name: 'Gestión de Grados', icon: Layers3, path: '/dashboard/gestion-grados' },
    { name: 'Gestión de Materias', icon: LibraryBig, path: '/dashboard/gestion-materias' },
    { name: 'Docentes', icon: Users, path: '/dashboard/docentes' },
    { name: 'Configuración Académica', icon: SlidersHorizontal, path: '/dashboard/configuracion-academica' },
    { name: 'Boletines', icon: FileText, path: '/dashboard/boletines' },
  ]
})

const hasMultipleRoles = computed(() => (auth.user?.roles?.length || 0) > 1)
const otherRole = computed(() => {
  if (!hasMultipleRoles.value) return null
  return auth.user?.roles.find(r => r !== auth.activeRole)
})

const handleLogout = () => {
  auth.logout()
  router.push('/')
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
    <!-- Sidebar -->
    <aside 
      :class="[
        isCollapsed ? 'w-20' : 'w-64',
        'bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-40'
      ]"
    >
      <!-- Logo Area -->
      <div class="h-16 flex items-center px-6 border-b border-gray-100 dark:border-slate-800">
        <School class="text-indigo-600 flex-shrink-0" :size="28" />
        <span v-if="!isCollapsed" class="ml-3 font-bold text-gray-900 dark:text-white truncate">AcademiaNeiva</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <router-link 
          v-for="item in menuItems" 
          :key="item.name"
          :to="item.path"
          class="flex items-center gap-3 p-3 rounded-xl text-gray-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
          active-class="bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white shadow-lg shadow-indigo-100 dark:shadow-none"
        >
          <component :is="item.icon" :size="22" />
          <span v-if="!isCollapsed" class="font-medium">{{ item.name }}</span>
        </router-link>
      </nav>

      <!-- Bottom Actions -->
      <div class="p-4 border-t border-gray-100 dark:border-slate-800 space-y-1">
        <button 
          @click="theme.toggleTheme"
          class="w-full flex items-center gap-3 p-3 rounded-xl text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <component :is="theme.isDark ? Sun : Moon" :size="22" />
          <span v-if="!isCollapsed" class="font-medium">{{ theme.isDark ? 'Modo Claro' : 'Modo Oscuro' }}</span>
        </button>

        <button 
          @click="handleLogout"
          class="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <LogOut :size="22" />
          <span v-if="!isCollapsed" class="font-medium">Cerrar Sesión</span>
        </button>
        <button 
          @click="isCollapsed = !isCollapsed"
          class="mt-4 w-full flex justify-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          <ChevronLeft v-if="!isCollapsed" :size="20" />
          <ChevronRight v-else :size="20" />
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Navbar -->
      <header class="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-8 z-30 transition-colors duration-300">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-white">
          {{ $route.name || 'Panel de Gestión' }}
        </h2>
        
        <div class="flex items-center gap-4">
          <div class="text-right hidden sm:block">
            <p class="text-sm font-bold text-gray-900 dark:text-white">{{ auth.user?.name || 'Usuario' }}</p>
            <p class="text-xs text-gray-500 dark:text-slate-400 capitalize flex items-center justify-end gap-1">
              {{ auth.activeRole || 'Rol' }}
              <button v-if="hasMultipleRoles" @click="switchRole(otherRole!)" 
                class="ml-2 text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold hover:bg-indigo-600 hover:text-white transition-all">
                Cambiar a {{ otherRole }}
              </button>
            </p>
          </div>
          <div class="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold">
            {{ (auth.user?.name || 'U').charAt(0) }}
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div class="max-w-7xl mx-auto">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
</style>
