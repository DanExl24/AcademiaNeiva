<script setup lang="ts">
import { ref } from 'vue'
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ClipboardList, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  School,
  GraduationCap,
  CalendarCheck,
  Eye,
  UserCircle
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const auth = useAuthStore()
const router = useRouter()
const isCollapsed = ref(false)

const menuItems = computed(() => {
  const role = auth.user?.role?.toLowerCase()
  
  if (role === 'docente') {
    return [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Mis Cursos', icon: GraduationCap, path: '/dashboard/mis-cursos' },
      { name: 'Calificaciones', icon: ClipboardList, path: '/dashboard/calificaciones' },
      { name: 'Asistencia', icon: CalendarCheck, path: '/dashboard/asistencia' },
      { name: 'Observador', icon: Eye, path: '/dashboard/observador' },
      { name: 'Modo Padre', icon: UserCircle, path: '/dashboard/modo-padre' },
    ]
  }
  
  // Default (Admin/Directivo)
  return [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Gestión Matrículas', icon: ClipboardList, path: '/dashboard/gestion-matriculas' },
    { name: 'Docentes', icon: Users, path: '/dashboard/docentes' },
    { name: 'Académico', icon: BookOpen, path: '/dashboard/academico' },
    { name: 'Configuración', icon: Settings, path: '/dashboard/config' },
  ]
})

const handleLogout = () => {
  auth.logout()
  router.push('/')
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 overflow-hidden">
    <!-- Sidebar -->
    <aside 
      :class="[
        isCollapsed ? 'w-20' : 'w-64',
        'bg-white border-r border-gray-200 transition-all duration-300 flex flex-col z-40'
      ]"
    >
      <!-- Logo Area -->
      <div class="h-16 flex items-center px-6 border-b border-gray-100">
        <School class="text-indigo-600 flex-shrink-0" :size="28" />
        <span v-if="!isCollapsed" class="ml-3 font-bold text-gray-900 truncate">AcademiaNeiva</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <router-link 
          v-for="item in menuItems" 
          :key="item.name"
          :to="item.path"
          class="flex items-center gap-3 p-3 rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
          active-class="bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white shadow-lg shadow-indigo-100"
        >
          <component :is="item.icon" :size="22" />
          <span v-if="!isCollapsed" class="font-medium">{{ item.name }}</span>
        </router-link>
      </nav>

      <!-- Bottom Actions -->
      <div class="p-4 border-t border-gray-100">
        <button 
          @click="handleLogout"
          class="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut :size="22" />
          <span v-if="!isCollapsed" class="font-medium">Cerrar Sesión</span>
        </button>
        <button 
          @click="isCollapsed = !isCollapsed"
          class="mt-4 w-full flex justify-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft v-if="!isCollapsed" :size="20" />
          <ChevronRight v-else :size="20" />
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Navbar -->
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-30">
        <h2 class="text-xl font-semibold text-gray-800">
          {{ $route.name || 'Panel de Gestión' }}
        </h2>
        
        <div class="flex items-center gap-4">
          <div class="text-right hidden sm:block">
            <p class="text-sm font-bold text-gray-900">{{ auth.user?.name || 'Usuario' }}</p>
            <p class="text-xs text-gray-500 capitalize">{{ auth.user?.role || 'Rol' }}</p>
          </div>
          <div class="h-10 w-10 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center text-indigo-600 font-bold">
            {{ (auth.user?.name || 'U').charAt(0) }}
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-8">
        <div class="max-w-7xl mx-auto">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>
