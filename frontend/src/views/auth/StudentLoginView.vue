<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { GraduationCap, ArrowLeft, KeyRound, UserCircle } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'

const auth = useAuthStore()
const router = useRouter()

const selectedCollege = ref('')
const colleges = ref<any[]>([])
const isLoading = ref(false)

const fetchColleges = async () => {
  try {
    const response = await axios.get('http://localhost:3000/api/matriculas')
    colleges.value = response.data
  } catch (error) {
    console.error('Error fetching colleges:', error)
  }
}

onMounted(fetchColleges)

const loginData = ref({
  codigo: '',
  password: ''
})

const error = ref('')

const handleStudentLogin = async () => {
  if (!selectedCollege.value) {
    error.value = 'Por favor selecciona tu colegio'
    return
  }

  if (!loginData.value.codigo || !loginData.value.password) {
    error.value = 'Completa todos los campos'
    return
  }

  try {
    isLoading.value = true
    error.value = ''
    const response = await axios.post('http://localhost:3000/api/auth/student-login', {
      codigo: loginData.value.codigo,
      password: loginData.value.password,
      id_colegio: selectedCollege.value
    })

    const { user, token } = response.data
    auth.setUser(user, token)
    
    router.push('/dashboard')
  } catch (err: any) {
    console.error('Student Login error:', err)
    error.value = err.response?.data?.error || 'Código o contraseña incorrectos. Verifica tus datos.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 py-12">
    <!-- Abstract background shapes -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-24 -left-24 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div class="absolute top-1/2 -right-24 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
    </div>

    <div class="max-w-md w-full space-y-8 relative">
      <div class="bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/20">
        <div class="text-center">
          <router-link to="/login" class="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 mb-8 transition-all hover:-translate-x-1">
            <ArrowLeft :size="16" />
            Volver al ingreso general
          </router-link>
          
          <div class="relative inline-block mb-6">
            <div class="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full"></div>
            <div class="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white mx-auto shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <GraduationCap :size="40" />
            </div>
          </div>
          
          <h2 class="text-3xl font-black text-gray-900 tracking-tight">Portal Estudiantil</h2>
          <p class="mt-3 text-gray-500 font-medium">Ingresa con tu código institucional</p>
        </div>

        <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
          <p class="text-sm text-red-600 text-center font-semibold">{{ error }}</p>
        </div>
        
        <form class="mt-8 space-y-5" @submit.prevent="handleStudentLogin">
          <div class="space-y-4">
            <div class="group">
              <label for="college" class="block text-sm font-bold text-gray-700 mb-2 ml-1">Institución Educativa</label>
              <div class="relative">
                <select 
                  id="college" 
                  v-model="selectedCollege" 
                  class="appearance-none block w-full pl-4 pr-10 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl text-gray-900 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all sm:text-sm cursor-pointer group-hover:border-indigo-200"
                >
                  <option value="" disabled>Selecciona tu colegio</option>
                  <option v-for="college in colleges" :key="college.id_colegio" :value="college.id_colegio">
                    {{ college.nombre }}
                  </option>
                </select>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div v-if="selectedCollege" class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div class="group">
                <label for="codigo" class="block text-sm font-bold text-gray-700 mb-2 ml-1">Código Estudiantil</label>
                <div class="relative">
                  <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors group-focus-within:text-indigo-500">
                    <UserCircle :size="20" />
                  </div>
                  <input 
                    id="codigo" 
                    v-model="loginData.codigo" 
                    type="text" 
                    required 
                    class="block w-full pl-12 pr-4 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all sm:text-sm" 
                    placeholder="Ej: EST-001"
                  >
                </div>
              </div>
              
              <div class="group">
                <label for="password" class="block text-sm font-bold text-gray-700 mb-2 ml-1">Tu Contraseña</label>
                <div class="relative">
                  <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors group-focus-within:text-indigo-500">
                    <KeyRound :size="20" />
                  </div>
                  <input 
                    id="password" 
                    v-model="loginData.password" 
                    type="password" 
                    required 
                    class="block w-full pl-12 pr-4 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all sm:text-sm" 
                    placeholder="••••••••"
                  >
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedCollege" class="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <button 
              type="submit" 
              :disabled="isLoading"
              class="group relative w-full flex justify-center py-4 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold rounded-2xl hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98] shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:active:scale-100"
            >
              <span v-if="isLoading" class="flex items-center gap-2">
                <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando...
              </span>
              <span v-else>Entrar a Clase</span>
            </button>
          </div>
          
          <div v-else class="p-6 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-100">
            <p class="text-xs text-indigo-600 text-center font-medium leading-relaxed">
              Selecciona tu institución educativa para habilitar el portal de estudiantes.
            </p>
          </div>
        </form>

        <div class="mt-8 pt-8 border-t border-gray-100 text-center">
          <p class="text-sm text-gray-500">
            ¿Problemas con tu código? 
            <a href="#" class="text-indigo-600 font-bold hover:underline">Contacta a Secretaría</a>
          </p>
        </div>
      </div>
      
      <!-- Footer credits -->
      <p class="text-center text-gray-400 text-xs font-medium">
        &copy; 2024 AcademiaNeiva — Gestión Educativa Inteligente
      </p>
    </div>
  </div>
</template>

<style scoped>
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}

@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
</style>
