<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { School, ArrowLeft } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'

const auth = useAuthStore()
const router = useRouter()

const selectedCollege = ref('')
const colleges = ref<any[]>([])

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
  email: '',
  password: ''
})

const error = ref('')

const handleLogin = async () => {
  if (!selectedCollege.value) {
    error.value = 'Por favor selecciona un colegio'
    return
  }

  try {
    error.value = ''
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email: loginData.value.email,
      password: loginData.value.password,
      id_colegio: selectedCollege.value
    })

    const { user, token } = response.data
    auth.setUser(user, token)
    
    router.push('/dashboard')
  } catch (err: any) {
    console.error('Login error:', err)
    error.value = err.response?.data?.error || 'Error al iniciar sesión. Verifica tus credenciales.'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
      <div class="text-center">
        <router-link to="/" class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-8 transition-colors">
          <ArrowLeft :size="16" />
          Volver al inicio
        </router-link>
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white mx-auto shadow-lg shadow-indigo-100 mb-4">
          <School :size="28" />
        </div>
        <h2 class="text-3xl font-extrabold text-gray-900">Ingreso al Sistema</h2>
        <p class="mt-2 text-sm text-gray-600">Selecciona tu institución para continuar</p>
      </div>

      <div v-if="error" class="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl animate-in fade-in zoom-in duration-300">
        <p class="text-xs text-red-600 text-center font-bold">{{ error }}</p>
      </div>
      
      <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <div class="rounded-md shadow-sm space-y-4">
          <div>
            <label for="college" class="block text-sm font-medium text-gray-700 mb-1">Institución Educativa</label>
            <select id="college" v-model="selectedCollege" class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-gray-50">
              <option value="" disabled>Selecciona tu colegio</option>
              <option v-for="college in colleges" :key="college.id_colegio" :value="college.id_colegio">{{ college.nombre }}</option>
            </select>
          </div>
          
          <div v-if="selectedCollege">
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input id="email" v-model="loginData.email" type="email" required class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="usuario@ejemplo.com">
          </div>
          
          <div v-if="selectedCollege">
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input id="password" v-model="loginData.password" type="password" required class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="••••••••">
          </div>
        </div>

        <div v-if="selectedCollege">
          <button type="submit" class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-100">
            Acceder
          </button>
        </div>
        
        <div v-else class="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <p class="text-xs text-indigo-700 text-center">
            Debes seleccionar una institución educativa para habilitar el inicio de sesión.
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
