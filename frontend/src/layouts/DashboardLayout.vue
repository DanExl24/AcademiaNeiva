<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import { 
  LayoutDashboard, 
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
  MessageSquare,
  XCircle,
  ShieldAlert,
  Users,
  Bell,
  Settings
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const isCollapsed = ref(false)

const openSubmenus = ref<Record<string, boolean>>({})
const toggleSubmenu = (name: string) => {
  openSubmenus.value[name] = !openSubmenus.value[name]
}

const switchRole = (newRole: string) => {
  auth.setActiveRole(newRole)
  router.push('/dashboard')
}

const menuItems = computed(() => {
  const role = auth.activeRole?.toLowerCase()

  if (role === 'admin_general') {
    return [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      {
        name: 'Colegios',
        icon: School,
        path: '/dashboard/colegios',
        children: [
          { name: 'Lista', path: '/dashboard/colegios' },
          { name: 'Pendientes', path: '/dashboard/colegios?estado=PENDIENTE' },
          { name: 'Suspendidos', path: '/dashboard/colegios?estado=SUSPENDIDO' }
        ]
      },
      {
        name: 'Usuarios',
        icon: Users,
        path: '/dashboard/usuarios',
        children: [
          { name: 'Todos', path: '/dashboard/usuarios' },
          { name: 'Directivos', path: '/dashboard/usuarios?rol=directivo' },
          { name: 'Docentes', path: '/dashboard/usuarios?rol=docente' },
          { name: 'Padres', path: '/dashboard/usuarios?rol=padre' },
          { name: 'Estudiantes', path: '/dashboard/usuarios?rol=estudiante' }
        ]
      },
      {
        name: 'Supervisión',
        icon: ShieldAlert,
        path: '/dashboard/supervision/solicitudes',
        children: [
          { name: 'Solicitudes', path: '/dashboard/supervision/solicitudes' },
          { name: 'Activas', path: '/dashboard/supervision/activas' },
          { name: 'Historial', path: '/dashboard/supervision/historial' }
        ]
      },
      {
        name: 'Auditorías',
        icon: FileText,
        path: '/dashboard/auditorias/lecturas',
        children: [
          { name: 'Lecturas', path: '/dashboard/auditorias/lecturas' },
          { name: 'Modificaciones', path: '/dashboard/auditorias/modificaciones' },
          { name: 'Exportaciones', path: '/dashboard/auditorias/exportaciones' }
        ]
      },
      { name: 'Notificaciones', icon: Bell, path: '/dashboard/notificaciones' },
      { name: 'Configuración', icon: Settings, path: '/dashboard/configuracion' }
    ]
  }
  
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
      { name: 'Calificaciones', icon: ClipboardList, path: '/dashboard/notas-hijos' },
      { name: 'Asistencia', icon: CalendarCheck, path: '/dashboard/asistencia-hijos' },
      { name: 'Observaciones', icon: MessageSquare, path: '/dashboard/observaciones-hijos' },
      { name: 'Boletines', icon: FileText, path: '/dashboard/boletines-hijos' },
    ]
  }

  if (role === 'estudiante') {
    return [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Mis Notas', icon: BookOpen, path: '/dashboard/mis-notas' },
      { name: 'Mi Asistencia', icon: CalendarCheck, path: '/dashboard/mi-asistencia' },
      { name: 'Observaciones', icon: MessageSquare, path: '/dashboard/mi-observacion' },
      { name: 'Mi Boletín', icon: FileText, path: '/dashboard/mi-boletin' },
    ]
  }
  
  // Default (Admin/Directivo)
  return [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Mi Colegio', icon: School, path: '/dashboard/mi-colegio' },
    { name: 'Gestión Matrículas', icon: ClipboardList, path: '/dashboard/gestion-matriculas' },
    { name: 'Gestión Estudiantes', icon: GraduationCap, path: '/dashboard/gestion-estudiantes' },
    { name: 'Gestión de Grados', icon: Layers3, path: '/dashboard/gestion-grados' },
    { name: 'Gestión de Materias', icon: LibraryBig, path: '/dashboard/gestion-materias' },
    { name: 'Docentes', icon: GraduationCap, path: '/dashboard/docentes' },
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

const stopMonitoring = () => {
  const isStudent = auth.monitoringType === 'estudiante'
  auth.stopMonitoring()
  if (isStudent) {
    router.push('/dashboard/gestion-estudiantes')
  } else {
    router.push('/dashboard/docentes')
  }
}

const activeYear = ref<string>('')
const currentTime = ref<string>('')
const schoolName = ref('AcademiaNeiva')
const schoolEscudo = ref<string | null>(null)

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

const applyThemeColors = (primary: string, secondary: string) => {
  document.documentElement.style.setProperty('--color-primary', primary)
  document.documentElement.style.setProperty('--color-secondary', secondary)
  
  const rgbPrimary = hexToRgb(primary)
  if (rgbPrimary) {
    document.documentElement.style.setProperty('--color-primary-rgb', `${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}`)
  }
  
  const rgbSecondary = hexToRgb(secondary)
  if (rgbSecondary) {
    document.documentElement.style.setProperty('--color-secondary-rgb', `${rgbSecondary.r}, ${rgbSecondary.g}, ${rgbSecondary.b}`)
  }
}

const clearThemeColors = () => {
  document.documentElement.style.removeProperty('--color-primary')
  document.documentElement.style.removeProperty('--color-secondary')
  document.documentElement.style.removeProperty('--color-primary-rgb')
  document.documentElement.style.removeProperty('--color-secondary-rgb')
}

const fetchSchoolIdentity = async () => {
  const sId = auth.user?.schoolId || auth.supervision?.id_colegio || null
  if (!sId) {
    clearThemeColors()
    schoolName.value = 'AcademiaNeiva'
    schoolEscudo.value = null
    return
  }

  try {
    const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
    const response = await axios.get(`http://localhost:3000/api/auth/school-identity/${sId}`, { headers })
    if (response.data) {
      schoolName.value = response.data.nombre || 'Mi Colegio'
      schoolEscudo.value = response.data.escudo_url ? `http://localhost:3000${response.data.escudo_url}` : null
      
      const primary = response.data.color_primario || '#4f46e5'
      const secondary = response.data.color_secundario || '#0f172a'
      applyThemeColors(primary, secondary)
    }
  } catch (error) {
    console.error('Error fetching school identity:', error)
  }
}

watch(() => [auth.user?.schoolId, auth.supervision?.id_colegio], () => {
  fetchSchoolIdentity()
}, { immediate: true })


const fetchActiveYear = async () => {
  const schoolId = auth.user?.schoolId
  if (!schoolId) return
  try {
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId}`)
    if (response.data?.activeYear) {
      activeYear.value = response.data.activeYear.calendario
    }
  } catch (error) {
    console.error('Error fetching active year:', error)
  }
}

const updateClock = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}

const supervisionTimeLeft = ref('')
let clockInterval: any
let supervisionTimer: any = null

const updateSupervisionTimer = () => {
  if (!auth.isSupervising || !auth.supervision) {
    supervisionTimeLeft.value = ''
    if (supervisionTimer) {
      clearInterval(supervisionTimer)
      supervisionTimer = null
    }
    return
  }

  const start = new Date(auth.supervision.fecha_entrada || new Date()).getTime()
  const durationMs = auth.supervision.duracion_maxima_minutos * 60 * 1000
  const end = start + durationMs
  const now = new Date().getTime()
  const diff = end - now

  if (diff <= 0) {
    supervisionTimeLeft.value = 'Expirado'
    handleExitSupervisionAuto()
  } else {
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    supervisionTimeLeft.value = `${minutes}m ${seconds}s`
  }
}

const handleExitSupervisionAuto = async () => {
  if (supervisionTimer) {
    clearInterval(supervisionTimer)
    supervisionTimer = null
  }
  const supId = auth.supervision?.id_auditoria
  if (supId) {
    try {
      await axios.post(`http://localhost:3000/api/admin/supervision/${supId}/salir`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
    } catch (e) {
      console.error('Error auto-exiting supervision:', e)
    }
  }
  auth.stopSupervision()
  router.push('/dashboard')
}

const handleExitSupervisionManual = async () => {
  const supId = auth.supervision?.id_auditoria
  if (supId) {
    if (confirm('¿Estás seguro de que deseas salir del modo supervisión?')) {
      try {
        await axios.post(`http://localhost:3000/api/admin/supervision/${supId}/salir`, {}, {
          headers: { Authorization: `Bearer ${auth.token}` }
        })
      } catch (e) {
        console.error('Error exiting supervision:', e)
      }
      auth.stopSupervision()
      router.push('/dashboard')
    }
  } else {
    auth.stopSupervision()
    router.push('/dashboard')
  }
}

watch(() => auth.isSupervising, (newVal) => {
  if (newVal) {
    updateSupervisionTimer()
    if (!supervisionTimer) {
      supervisionTimer = setInterval(updateSupervisionTimer, 1000)
    }
  } else {
    supervisionTimeLeft.value = ''
    if (supervisionTimer) {
      clearInterval(supervisionTimer)
      supervisionTimer = null
    }
  }
}, { immediate: true })

// --- NOTIFICACIONES EN TIEMPO REAL ---
const toasts = ref<{ id: number; message: string; type: string }[]>([])
let toastId = 0
const knownActions = new Set<string>()
let checkInterval: any = null

const showToast = (message: string, type = 'info') => {
  const id = toastId++
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, 6000)
}

const checkRecentActivity = async () => {
  if (auth.activeRole !== 'admin_general' || !auth.token) return
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('http://localhost:3000/api/admin/dashboard/stats', { headers })
    const newActions = res.data.actividad || []
    
    if (knownActions.size === 0) {
      newActions.forEach((act: any) => knownActions.add(act.descripcion))
      return
    }
    
    newActions.forEach((act: any) => {
      if (!knownActions.has(act.descripcion)) {
        knownActions.add(act.descripcion)
        showToast(act.descripcion, 'success')
      }
    })
  } catch (e) {
    console.error('Error polling activity for real-time notifications:', e)
  }
}

watch(() => auth.activeRole, (newRole) => {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  knownActions.clear()
  toasts.value = []
  if (newRole === 'admin_general') {
    checkRecentActivity()
    checkInterval = setInterval(checkRecentActivity, 8000)
  }
}, { immediate: true })

onMounted(() => {
  fetchActiveYear()
  updateClock()
  clockInterval = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
  if (supervisionTimer) clearInterval(supervisionTimer)
  if (checkInterval) clearInterval(checkInterval)
  clearThemeColors()
})

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
      <div class="h-16 flex items-center px-5 border-b border-gray-100 dark:border-slate-800 gap-3">
        <div class="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
          <img v-if="schoolEscudo" :src="schoolEscudo" class="w-full h-full object-contain" alt="Escudo" />
          <School v-else class="text-indigo-600 flex-shrink-0" :size="20" />
        </div>
        <span v-if="!isCollapsed" class="font-bold text-gray-900 dark:text-white truncate text-xs leading-tight max-w-[150px]">{{ schoolName }}</span>
      </div>


      <!-- Navigation -->
      <nav class="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <div v-for="item in menuItems" :key="item.name" class="space-y-1">
          <!-- Item with children (dropdown) -->
          <div v-if="item.children">
            <button 
              @click="toggleSubmenu(item.name)"
              :class="[
                'w-full flex items-center justify-between p-3 rounded-xl text-gray-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group',
                openSubmenus[item.name] ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-slate-800/50' : ''
              ]"
            >
              <div class="flex items-center gap-3">
                <component :is="item.icon" :size="22" />
                <span v-if="!isCollapsed" class="font-medium">{{ item.name }}</span>
              </div>
              <ChevronRight 
                v-if="!isCollapsed" 
                :class="['transition-transform duration-200', openSubmenus[item.name] ? 'transform rotate-90' : '']" 
                :size="16" 
              />
            </button>
            
            <!-- Children List -->
            <div 
              v-if="openSubmenus[item.name] && !isCollapsed" 
              class="pl-9 space-y-1 mt-1 animate-in slide-in-from-top-2 duration-200"
            >
              <router-link 
                v-for="sub in item.children" 
                :key="sub.name"
                :to="sub.path"
                class="flex items-center py-2 px-3 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                active-class="text-indigo-600 dark:text-indigo-400 font-semibold"
              >
                <span>{{ sub.name }}</span>
              </router-link>
            </div>
          </div>

          <!-- Standard Item -->
          <router-link 
            v-else
            :to="item.path"
            class="flex items-center gap-3 p-3 rounded-xl text-gray-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
            active-class="bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            <component :is="item.icon" :size="22" />
            <span v-if="!isCollapsed" class="font-medium">{{ item.name }}</span>
          </router-link>
        </div>
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
      <!-- Supervision Banner -->
      <div
        v-if="auth.isSupervising"
        class="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white px-6 py-3.5 flex items-center justify-between gap-4 shrink-0 z-40 shadow-lg border-b border-indigo-500/20"
      >
        <div class="flex items-center gap-3">
          <ShieldAlert :size="20" class="shrink-0 text-indigo-200 animate-pulse" />
          <span class="text-sm font-black tracking-wide">
            MODO SUPERVISIÓN ACTIVO — 
            <span class="underline underline-offset-2 decoration-2 decoration-indigo-300">
              {{ auth.supervision?.colegio_nombre }}
            </span> 
            · Rol: Rector · Modo: 
            <span class="bg-indigo-900/60 px-2 py-0.5 rounded text-xs font-mono font-extrabold border border-indigo-500/30">
              {{ auth.supervision?.tipo_supervision }}
            </span>
          </span>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 text-xs bg-black/20 px-3 py-1.5 rounded-lg border border-white/10 font-mono">
            <span class="text-indigo-200 font-bold">Tiempo Restante:</span>
            <span class="font-extrabold text-white">{{ supervisionTimeLeft || 'Calculando...' }}</span>
          </div>
          <button
            @click="handleExitSupervisionManual"
            class="flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm active:translate-y-[1px]"
          >
            <XCircle :size="15" />
            Salir de Supervisión
          </button>
        </div>
      </div>

      <!-- Monitoring Banner -->
      <div
        v-if="auth.isMonitoring"
        class="bg-amber-500 text-white px-6 py-3 flex items-center justify-between gap-4 shrink-0 z-40 shadow-lg"
      >
        <div class="flex items-center gap-3">
          <ShieldAlert :size="20" class="shrink-0" />
          <span class="text-sm font-black">
            Modo Monitoreo — Supervisando a
            <span class="underline underline-offset-2">
              {{ auth.monitoringUser?.nombre }} {{ auth.monitoringUser?.apellido }}
            </span>
            · Solo Lectura
          </span>
        </div>
        <button
          @click="stopMonitoring"
          class="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
        >
          <XCircle :size="15" />
          Salir del Seguimiento
        </button>
      </div>

      <!-- Navbar -->
      <header class="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-8 z-30 transition-colors duration-300">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-white">
          {{ auth.isMonitoring ? `Seguimiento: ${auth.monitoringUser?.nombre} ${auth.monitoringUser?.apellido}` : (auth.isSupervising ? `Supervisando: ${auth.supervision?.colegio_nombre}` : ($route.name || 'Panel de Gestión')) }}
        </h2>
        
        <div class="flex items-center gap-6">
          <!-- Año Lectivo y Hora Actual -->
          <div class="hidden md:flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800/50">
            <div class="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700/60 pr-4">
              <span class="text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-widest text-[9px]">Año:</span>
              <span class="font-extrabold text-slate-700 dark:text-slate-200 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-100/30 dark:border-indigo-900/20">
                {{ activeYear || '...' }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 font-mono">
              <span class="text-emerald-500 dark:text-emerald-400 font-bold uppercase tracking-widest text-[9px]">Hora:</span>
              <span class="font-bold text-slate-700 dark:text-slate-200">
                {{ currentTime }}
              </span>
            </div>
          </div>

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
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div class="max-w-7xl mx-auto">
          <router-view />
        </div>
      </main>
    </div>

    <!-- Real-time Toast Notifications Container -->
    <div class="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none w-full max-w-sm">
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-y-4 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div 
          v-for="toast in toasts" 
          :key="toast.id"
          class="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xl flex items-start gap-3 w-full"
        >
          <div class="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-xl shrink-0">
            <Bell :size="18" class="animate-bounce" />
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Aviso del Sistema</h4>
            <p class="text-xs font-semibold text-slate-650 dark:text-slate-350 mt-1 leading-relaxed">{{ toast.message }}</p>
          </div>
          <button 
            @click="toasts = toasts.filter(t => t.id !== toast.id)"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <XCircle :size="16" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
</style>
