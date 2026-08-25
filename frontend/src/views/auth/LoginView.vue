<script setup lang="ts">
import { ref } from 'vue'
import { GraduationCap, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import { authService } from '../../services/authService'

const auth = useAuthStore()
const router = useRouter()

const loginData = ref({
  emailOrCode: '',
  password: ''
})

const showPassword = ref(false)
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
    
    const data = await authService.login({
      email: loginData.value.emailOrCode,
      password: loginData.value.password
    })

    const { user, token } = data
    auth.setUser(user, token)
    
    const userRoles: string[] = user.roles || (user.role ? [user.role] : [])
    const isOnlyPadre = userRoles.length === 1 && userRoles[0] === 'padre'

    const uniqueSchoolIds = Array.from(new Set(user.schoolIds || []))
    if (uniqueSchoolIds.length > 1 && !isOnlyPadre) {
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
  <div class="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8 sm:py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
    <!-- Background premium gradients -->
    <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-950 -z-10"></div>
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-[80px] -z-10 animate-pulse"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full filter blur-[80px] -z-10 animate-pulse"></div>

    <div class="max-w-md w-full space-y-6 sm:space-y-8 bg-slate-950/60 backdrop-blur-xl p-6 sm:p-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800/80">
      <div class="text-center">
        <router-link to="/" class="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-400 hover:text-indigo-400 mb-6 sm:mb-8 transition-colors group">
          <ArrowLeft :size="16" class="transition-transform group-hover:-translate-x-1" />
          Volver al inicio
        </router-link>
        
        <div class="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white mx-auto shadow-xl shadow-indigo-500/20 mb-4 sm:mb-6 border border-indigo-400/20">
          <GraduationCap :size="32" class="sm:w-9 sm:h-9" />
        </div>
        
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">AcademiaNeiva</h2>
        <p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-400">Portal de Acceso Único e Inteligente</p>
      </div>

      <div v-if="error" class="p-3.5 sm:p-4 bg-red-950/50 border border-red-500/30 rounded-2xl animate-in fade-in zoom-in duration-300">
        <p class="text-xs text-red-300 text-center font-bold">{{ error }}</p>
      </div>
      
      <form class="space-y-5" @submit.prevent="handleLogin">
        <div class="space-y-4 sm:space-y-5">
          <div>
            <label for="emailOrCode" class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Correo electrónico o Código</label>
            <input 
              id="emailOrCode" 
              v-model="loginData.emailOrCode" 
              type="text" 
              required 
              class="appearance-none block w-full px-4 py-3 sm:py-3.5 bg-slate-900/80 border border-slate-800 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm h-12" 
              placeholder="usuario@colegio.edu.co o EST-1-1"
              :disabled="loading"
            >
          </div>
          
          <div>
            <div class="flex justify-between items-center mb-2">
              <label for="password" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">Contraseña</label>
              <router-link to="/forgot-password" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                ¿Olvidaste tu contraseña?
              </router-link>
            </div>
            <div class="relative">
              <input 
                id="password" 
                v-model="loginData.password" 
                :type="showPassword ? 'text' : 'password'" 
                required 
                class="appearance-none block w-full px-4 py-3 sm:py-3.5 pr-12 bg-slate-900/80 border border-slate-800 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm h-12" 
                placeholder="••••••••"
                :disabled="loading"
              >
              <button 
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg focus:outline-none"
                :aria-label="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
              >
                <EyeOff v-if="showPassword" :size="18" />
                <Eye v-else :size="18" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <button 
            type="submit" 
            :disabled="loading"
            class="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98] shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:pointer-events-none h-12 cursor-pointer"
          >
            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
            <span v-else>Acceder al sistema</span>
          </button>
        </div>

        <div class="p-3.5 sm:p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 text-center">
          <p class="text-xs text-slate-400 leading-relaxed font-medium">
            El sistema detectará automáticamente tu perfil (Directivo, Docente, Estudiante o Acudiente).
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
