<script setup lang="ts">
import { ref } from 'vue'
import { GraduationCap, ArrowLeft, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'

const auth = useAuthStore()
const router = useRouter()

const loginData = ref({
  emailOrCode: '',
  password: ''
})

const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  if (!loginData.value.emailOrCode || !loginData.value.password) {
    error.value = 'Por favor ingresa tus credenciales.'
    return
  }

  try {
    error.value = ''
    loading.value = true
    
    const response = await axios.post('/api/auth/login', {
      email: loginData.value.emailOrCode,
      password: loginData.value.password
    })

    const { user, token } = response.data
    auth.setUser(user, token)
    
    if (user.schoolIds && user.schoolIds.length > 1) {
      router.push('/select-school')
    } else {
      router.push('/dashboard')
    }
  } catch (err: any) {
    console.error('Login error:', err)
    error.value = err.response?.data?.error || 'Error al iniciar sesión. Verifica tus credenciales.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
    <!-- Background premium gradients -->
    <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-950 -z-10"></div>
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-[80px] -z-10 animate-pulse"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full filter blur-[80px] -z-10 animate-pulse"></div>

    <div class="max-w-md w-full space-y-8 bg-slate-950/40 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-slate-800/80">
      <div class="text-center">
        <router-link to="/" class="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 mb-8 transition-colors group">
          <ArrowLeft :size="16" class="transition-transform group-hover:-translate-x-1" />
          Volver al inicio
        </router-link>
        
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white mx-auto shadow-xl shadow-indigo-500/20 mb-6 border border-indigo-400/20">
          <GraduationCap :size="36" />
        </div>
        
        <h2 class="text-3xl font-extrabold text-white tracking-tight">AcademiaNeiva</h2>
        <p class="mt-2 text-sm text-slate-400">Portal de Acceso Único e Inteligente</p>
      </div>

      <div v-if="error" class="mt-4 p-4 bg-red-950/40 border border-red-500/20 rounded-2xl animate-in fade-in zoom-in duration-300">
        <p class="text-xs text-red-400 text-center font-bold">{{ error }}</p>
      </div>
      
      <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <div class="space-y-5">
          <div>
            <label for="emailOrCode" class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Correo electrónico o Código Estudiantil</label>
            <input 
              id="emailOrCode" 
              v-model="loginData.emailOrCode" 
              type="text" 
              required 
              class="appearance-none block w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm" 
              placeholder="usuario@colegio.edu.co o EST-1-1"
              :disabled="loading"
            >
          </div>
          
          <div>
            <div class="flex justify-between items-center mb-2">
              <label for="password" class="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Contraseña</label>
              <router-link to="/forgot-password" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                ¿Olvidaste tu contraseña?
              </router-link>
            </div>
            <input 
              id="password" 
              v-model="loginData.password" 
              type="password" 
              required 
              class="appearance-none block w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm" 
              placeholder="••••••••"
              :disabled="loading"
            >
          </div>
        </div>

        <div>
          <button 
            type="submit" 
            :disabled="loading"
            class="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98] shadow-xl shadow-indigo-500/10 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
            <span v-else>Acceder al sistema</span>
          </button>
        </div>

        <div class="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/60 text-center">
          <p class="text-[11px] text-slate-500 leading-relaxed">
            Este portal unificado detectará de manera automática si eres Administrador General, Directivo, Docente, Padre de Familia o Estudiante.
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
