<script setup lang="ts">
import { ref } from 'vue'
import { 
  School, 
  Users, 
  BookOpen, 
  BarChart3, 
  ClipboardCheck, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  LifeBuoy, 
  HelpCircle,
  Menu,
  X,
  LogIn,
  Search
} from 'lucide-vue-next'

const isMobileMenuOpen = ref(false)

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const benefits = [
  {
    title: 'Matrícula 100% Digital',
    description: 'Elimina las filas y el papeleo. Gestión de documentos y validación en línea.',
    icon: ClipboardCheck,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  {
    title: 'Boletines Automáticos',
    description: 'Generación masiva de boletines en PDF con un solo clic al cerrar el periodo.',
    icon: BookOpen,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100'
  },
  {
    title: 'Analítica en Tiempo Real',
    description: 'Dashboard estadístico para directivos y docentes sobre el rendimiento académico.',
    icon: BarChart3,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100'
  },
  {
    title: 'Control de Asistencia',
    description: 'Registro diario simplificado y notificaciones automáticas de inasistencias.',
    icon: Zap,
    color: 'text-amber-600',
    bg: 'bg-amber-100'
  }
]

const roles = [
  { name: 'Directivos', desc: 'Control total de la gestión académica y reportes.', icon: ShieldCheck },
  { name: 'Docentes', desc: 'Carga de notas, asistencia y seguimiento de grupos.', icon: Users },
  { name: 'Estudiantes', desc: 'Consulta de notas, historial y descarga de boletines.', icon: School },
  { name: 'Padres', desc: 'Seguimiento cercano del proceso de sus hijos.', icon: Users }
]
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-gray-900">
    <!-- Navbar -->
    <nav class="fixed top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md transition-all">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <!-- Brand Logo -->
        <router-link to="/" class="flex items-center gap-2 group">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
            <School :size="22" />
          </div>
          <span class="text-xl font-bold tracking-tight text-gray-900">Academia <span class="text-indigo-600">Neiva</span></span>
        </router-link>
        
        <!-- Desktop Nav Links -->
        <div class="hidden md:flex md:items-center md:gap-8">
          <a href="#beneficios" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Beneficios</a>
          <a href="#roles" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Roles</a>
          <router-link to="/matricula" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Matrículas</router-link>
          <router-link to="/docs" class="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1">
            <BookOpen :size="15" />
            <span>Documentación</span>
          </router-link>
          <router-link to="/soporte" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Soporte</router-link>
          <router-link to="/login" class="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-all hover:shadow-indigo-200">
            Ingresar
          </router-link>
        </div>

        <!-- Mobile Action Buttons & Hamburger Toggle -->
        <div class="flex items-center gap-2 md:hidden">
          <router-link 
            to="/login" 
            class="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <LogIn :size="14" />
            <span>Ingresar</span>
          </router-link>

          <button 
            @click="isMobileMenuOpen = !isMobileMenuOpen" 
            class="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Abrir menú de navegación"
          >
            <Menu v-if="!isMobileMenuOpen" :size="22" />
            <X v-else :size="22" class="text-indigo-600" />
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown Menu -->
      <div 
        v-if="isMobileMenuOpen" 
        class="border-b border-gray-100 bg-white/95 backdrop-blur-xl px-4 pt-2 pb-6 md:hidden animate-in slide-in-from-top-4 duration-200 shadow-xl"
      >
        <div class="flex flex-col gap-2 pt-2">
          <a 
            href="#beneficios" 
            @click="closeMobileMenu"
            class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <Zap :size="18" class="text-indigo-500" />
            <span>Beneficios de la plataforma</span>
          </a>

          <a 
            href="#roles" 
            @click="closeMobileMenu"
            class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <Users :size="18" class="text-indigo-500" />
            <span>Roles y Perfiles</span>
          </a>

          <router-link 
            to="/matricula" 
            @click="closeMobileMenu"
            class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <ClipboardCheck :size="18" class="text-indigo-500" />
            <span>Iniciar Matrícula Digital</span>
          </router-link>

          <router-link 
            to="/matricula/seguimiento" 
            @click="closeMobileMenu"
            class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <Search :size="18" class="text-indigo-500" />
            <span>Consultar Estado de Matrícula</span>
          </router-link>

          <router-link 
            to="/docs" 
            @click="closeMobileMenu"
            class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors"
          >
            <BookOpen :size="18" class="text-indigo-600" />
            <span>Documentación del Sistema (21 Módulos)</span>
          </router-link>

          <router-link 
            to="/soporte" 
            @click="closeMobileMenu"
            class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <HelpCircle :size="18" class="text-emerald-500" />
            <span>Mesa de Ayuda y Soporte</span>
          </router-link>

          <div class="mt-3 pt-3 border-t border-gray-100">
            <router-link 
              to="/login" 
              @click="closeMobileMenu"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3.5 text-center text-sm font-bold text-white shadow-lg hover:bg-gray-800 active:scale-98 transition-all"
            >
              <LogIn :size="18" />
              <span>Entrar al Sistema</span>
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
      <!-- Background elements -->
      <div class="absolute top-0 left-1/2 -z-10 h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-indigo-50/50 blur-3xl"></div>
      
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h1 class="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-gray-900 sm:text-7xl">
            Gestión Académica de <span class="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent text-shadow-sm">Vanguardia</span> para Neiva
          </h1>
          <p class="mx-auto mt-8 max-w-2xl text-lg leading-8 text-gray-600">
            La solución integral multi-colegio para simplificar la matrícula, controlar el rendimiento estudiantil y generar boletines automáticos en segundos.
          </p>
          <div class="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <router-link to="/login" class="group flex items-center gap-2 rounded-full bg-gray-900 px-8 py-4 text-lg font-semibold text-white shadow-xl hover:bg-gray-800 transition-all">
              Entrar al Sistema
              <ArrowRight :size="20" class="group-hover:translate-x-1 transition-transform" />
            </router-link>
            <router-link to="/matricula" class="text-lg font-semibold leading-6 text-gray-900 hover:text-indigo-600 transition-colors">
              Iniciar Matrícula <span aria-hidden="true">→</span>
            </router-link>
            <router-link to="/matricula/seguimiento" class="text-lg font-semibold leading-6 text-indigo-600 hover:text-indigo-700 transition-colors">
              Consultar Estado <span aria-hidden="true">→</span>
            </router-link>
            <router-link to="/soporte" class="text-lg font-semibold leading-6 text-emerald-600 hover:text-emerald-700 transition-colors">
              Soporte Técnico <span aria-hidden="true">→</span>
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Beneficios Section -->
    <section id="beneficios" class="bg-gray-50 py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:text-center">
          <h2 class="text-base font-semibold leading-7 text-indigo-600 uppercase tracking-widest">Capacidades</h2>
          <p class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Todo lo que tu colegio necesita</p>
          <p class="mt-6 text-lg leading-8 text-gray-600">
            Nuestra arquitectura modular permite a cada institución gestionar sus procesos de manera independiente pero centralizada.
          </p>
        </div>
        
        <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            <div v-for="benefit in benefits" :key="benefit.title" class="flex flex-col items-start bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div :class="[benefit.bg, 'p-3 rounded-2xl mb-6']">
                <component :is="benefit.icon" :class="[benefit.color, 'h-6 w-6']" />
              </div>
              <dt class="text-xl font-bold leading-7 text-gray-900">{{ benefit.title }}</dt>
              <dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p class="flex-auto">{{ benefit.description }}</p>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>

    <!-- Roles Section -->
    <section id="roles" class="py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Roles y Responsabilidades</h2>
            <p class="mt-6 text-lg leading-8 text-gray-600">
              Seguridad basada en roles (RBAC) que garantiza que cada usuario acceda únicamente a la información que le compete, respetando siempre la privacidad del colegio.
            </p>
            <div class="mt-10 space-y-4">
              <div v-for="role in roles" :key="role.name" class="flex items-center gap-4 p-4 rounded-2xl hover:bg-indigo-50 transition-colors">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <component :is="role.icon" :size="24" />
                </div>
                <div>
                  <h3 class="font-bold text-gray-900">{{ role.name }}</h3>
                  <p class="text-sm text-gray-600">{{ role.desc }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="relative">
            <div class="aspect-square rounded-3xl bg-indigo-600/5 p-8 flex items-center justify-center">
              <!-- Illustration/Icon Cloud -->
              <div class="grid grid-cols-2 gap-8">
                <div class="animate-bounce" style="animation-duration: 3s">
                   <Users :size="120" class="text-indigo-200" />
                </div>
                <div class="animate-pulse" style="animation-duration: 4s">
                   <ShieldCheck :size="100" class="text-indigo-300" />
                </div>
                <div class="animate-pulse" style="animation-duration: 2s">
                   <Zap :size="80" class="text-indigo-400" />
                </div>
                <div class="animate-bounce" style="animation-duration: 5s">
                   <BarChart3 :size="140" class="text-indigo-100" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Soporte Section -->
    <section id="soporte" class="bg-gray-900 py-24 sm:py-32 relative overflow-hidden">
      <!-- Decoración -->
      <div class="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"></div>
      
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 mb-6">
            <LifeBuoy :size="32" class="text-indigo-400" />
          </div>
          <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">¿Necesitas ayuda?</h2>
          <p class="mt-4 text-lg leading-8 text-gray-400">
            Si tienes problemas con la plataforma, inconvenientes de inicio de sesión, dudas sobre calificaciones o cualquier otra incidencia, nuestro equipo de soporte está disponible para ti.
          </p>
          <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <router-link to="/soporte" class="group flex items-center gap-2 rounded-full bg-indigo-500 px-8 py-4 text-lg font-semibold text-white shadow-xl hover:bg-indigo-400 transition-all">
              <HelpCircle :size="20" />
              Ir a Soporte Técnico
              <ArrowRight :size="20" class="group-hover:translate-x-1 transition-transform" />
            </router-link>
          </div>
          <p class="mt-6 text-sm text-gray-500">
            También puedes consultar el estado de tu ticket con tu código de seguimiento.
          </p>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-100">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div class="flex items-center gap-2">
            <School :size="24" class="text-indigo-600" />
            <span class="text-lg font-bold text-gray-900">Academia Neiva</span>
          </div>
          <div class="flex gap-6 text-sm text-gray-500">
            <a href="#" class="hover:text-indigo-600 transition-colors">Términos</a>
            <a href="#" class="hover:text-indigo-600 transition-colors">Privacidad</a>
            <router-link to="/soporte" class="hover:text-indigo-600 transition-colors">Soporte</router-link>
          </div>
          <p class="text-sm text-gray-400">
            &copy; 2026 Academia Neiva. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.text-shadow-sm {
  text-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

@keyframes bounce {
  0%, 100% { transform: translateY(-5%); }
  50% { transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
