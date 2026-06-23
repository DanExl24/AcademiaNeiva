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
  Zap
} from 'lucide-vue-next'

const schoolForm = ref({
  name: '',
  dane: '',
  contact: '',
  email: ''
})

const submitSchoolRequest = () => {
  // Aquí se manejaría el registro del colegio
  console.log('Solicitud enviada:', schoolForm.value)
  alert('Solicitud enviada con éxito. Nuestro equipo se pondrá en contacto pronto.')
  schoolForm.value = { name: '', dane: '', contact: '', email: '' }
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
    <nav class="fixed top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-2">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <School :size="24" />
          </div>
          <span class="text-xl font-bold tracking-tight text-gray-900">Academia <span class="text-indigo-600">Neiva</span></span>
        </div>
        
        <div class="hidden md:flex md:items-center md:gap-8">
          <a href="#beneficios" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Beneficios</a>
          <a href="#roles" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Roles</a>
          <a href="#registro" class="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Registrar Colegio</a>
          <router-link to="/login" class="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-all hover:shadow-indigo-200">
            Ingresar
          </router-link>
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

    <!-- Registro Section -->
    <section id="registro" class="bg-gray-900 py-24 sm:py-32 relative overflow-hidden">
      <!-- Decoración -->
      <div class="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"></div>
      
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center mb-16">
          <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">¿Eres un colegio en Neiva?</h2>
          <p class="mt-4 text-lg leading-8 text-gray-400">
            Regístrate para solicitar el acceso a la plataforma para tu institución educativa.
          </p>
        </div>
        
        <form @submit.prevent="submitSchoolRequest" class="mx-auto max-w-xl bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 shadow-2xl">
          <div class="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
            <div class="sm:col-span-2">
              <label for="school-name" class="block text-sm font-semibold leading-6 text-white">Nombre del Colegio</label>
              <div class="mt-2.5">
                <input v-model="schoolForm.name" type="text" id="school-name" class="block w-full rounded-xl border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6" required placeholder="Ej: Colegio San Pedro">
              </div>
            </div>
            <div>
              <label for="dane" class="block text-sm font-semibold leading-6 text-white">Código DANE</label>
              <div class="mt-2.5">
                <input v-model="schoolForm.dane" type="text" id="dane" class="block w-full rounded-xl border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6" required placeholder="Código 12 dígitos">
              </div>
            </div>
            <div>
              <label for="contact" class="block text-sm font-semibold leading-6 text-white">Contacto (Tel/Cel)</label>
              <div class="mt-2.5">
                <input v-model="schoolForm.contact" type="tel" id="contact" class="block w-full rounded-xl border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6" required placeholder="3XX XXX XXXX">
              </div>
            </div>
            <div class="sm:col-span-2">
              <label for="email" class="block text-sm font-semibold leading-6 text-white">Correo Institucional</label>
              <div class="mt-2.5">
                <input v-model="schoolForm.email" type="email" id="email" class="block w-full rounded-xl border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6" required placeholder="secretaria@colegio.edu.co">
              </div>
            </div>
          </div>
          <div class="mt-10">
            <button type="submit" class="block w-full rounded-xl bg-indigo-500 px-3.5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-all active:scale-95">
              Enviar Solicitud
            </button>
          </div>
          <p class="mt-4 text-center text-xs text-gray-400">
            * Su solicitud será revisada por el administrador global.
          </p>
        </form>
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
            <a href="#" class="hover:text-indigo-600 transition-colors">Soporte</a>
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
