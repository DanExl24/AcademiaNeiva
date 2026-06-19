<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck, ArrowLeft, Mail, Lock } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'

const auth = useAuthStore()
const router = useRouter()
const isLoading = ref(false)

const loginData = ref({
  email: '',
  password: ''
})

const error = ref('')

const handleAdminLogin = async () => {
  if (!loginData.value.email || !loginData.value.password) {
    error.value = 'Por favor completa todos los campos'
    return
  }

  try {
    isLoading.value = true
    error.value = ''
    
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email: loginData.value.email,
      password: loginData.value.password
    })

    const { user, token } = response.data
    
    // Validar que el usuario efectivamente tenga el rol de administrador general
    if (!user.roles || !user.roles.includes('admin_general')) {
      error.value = 'Acceso denegado. Este portal es exclusivo para el Administrador General.'
      isLoading.value = false
      return
    }

    auth.setUser(user, token)
    router.push('/dashboard')
  } catch (err: any) {
    console.error('Admin Login error:', err)
    error.value = err.response?.data?.error || 'Credenciales incorrectas. Verifica tus datos.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
    <!-- Abstract premium background decoration -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] opacity-70"></div>
      <div class="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] opacity-70"></div>
      
      <!-- Grid pattern overlay -->
      <div class="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>
    </div>

    <div class="max-w-md w-full space-y-8 relative z-10">
      <div class="bg-slate-800/60 backdrop-blur-2xl p-10 rounded-[2.5rem] shadow-2xl border border-slate-700/50">
        <div class="text-center">
          <router-link to="/login" class="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-indigo-400 mb-8 transition-all hover:-translate-x-1">
            <ArrowLeft :size="16" />
            Volver al ingreso general
          </router-link>
          
          <div class="relative inline-block mb-6">
            <div class="absolute inset-0 bg-indigo-500 blur-2xl opacity-30 rounded-full animate-pulse"></div>
            <div class="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white mx-auto shadow-xl border border-indigo-400/30">
              <ShieldCheck :size="40" />
            </div>
          </div>
          
          <h2 class="text-3xl font-black text-white tracking-tight">Administración General</h2>
          <p class="mt-3 text-slate-400 font-medium">Acceso exclusivo para control global del sistema</p>
        </div>

        <div v-if="error" class="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
          <p class="text-sm text-red-400 text-center font-semibold">{{ error }}</p>
        </div>
        
        <form class="mt-8 space-y-5" @submit.prevent="handleAdminLogin">
          <div class="space-y-4">
            <div class="group">
              <label for="email" class="block text-sm font-bold text-slate-300 mb-2 ml-1">Correo Electrónico</label>
              <div class="relative">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none transition-colors group-focus-within:text-indigo-400">
                  <Mail :size="20" />
                </div>
                <input 
                  id="email" 
                  v-model="loginData.email" 
                  type="email" 
                  required 
                  class="block w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all sm:text-sm" 
                  placeholder="admin@ejemplo.com"
                >
              </div>
            </div>
            
            <div class="group">
              <label for="password" class="block text-sm font-bold text-slate-300 mb-2 ml-1">Contraseña</label>
              <div class="relative">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none transition-colors group-focus-within:text-indigo-400">
                  <Lock :size="20" />
                </div>
                <input 
                  id="password" 
                  v-model="loginData.password" 
                  type="password" 
                  required 
                  class="block w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all sm:text-sm" 
                  placeholder="••••••••"
                >
              </div>
            </div>
          </div>

          <div class="pt-4">
            <button 
              type="submit" 
              :disabled="isLoading"
              class="group relative w-full flex justify-center py-4 px-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-bold rounded-2xl hover:from-indigo-600 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/30 disabled:opacity-50 disabled:active:scale-100"
            >
              <span v-if="isLoading" class="flex items-center gap-2">
                <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Autenticando...
              </span>
              <span v-else>Iniciar Control</span>
            </button>
          </div>
        </form>
      </div>
      
      <!-- Footer credits -->
      <p class="text-center text-slate-500 text-xs font-medium">
        &copy; 2026 AcademiaNeiva — Panel de Control General
      </p>
    </div>
  </div>
</template>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.15; }
}
</style>
