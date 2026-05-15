<script setup lang="ts">
import { ref } from 'vue'
import { GraduationCap, ArrowLeft, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useNotificationStore } from '../stores/notifications'

const auth = useAuthStore()
const router = useRouter()
const notify = useNotificationStore()

const studentCode = ref('')
const password = ref('')
const isLoading = ref(false)

const handleStudentLogin = async () => {
  if (!studentCode.value || !password.value) {
    notify.addNotification('Por favor ingresa tu código y contraseña', 'warning')
    return
  }

  isLoading.value = true
  try {
    const response = await axios.post('http://localhost:3000/api/auth/student-login', {
      studentCode: studentCode.value,
      password: password.value
    })

    const userData = {
      ...response.data.user,
      schoolName: 'Institución Educativa' // Podríamos traer el nombre del colegio en la respuesta si fuera necesario
    }

    auth.setUser(userData, response.data.token)
    notify.addNotification('Bienvenido de nuevo', 'success')
    router.push('/panel-control')
  } catch (error: any) {
    notify.addNotification(error.response?.data?.message || 'Código estudiantil inválido', 'error')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-md w-full space-y-8 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 relative overflow-hidden">
      <!-- Background Decorations -->
      <div class="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
      <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>

      <div class="relative text-center">
        <router-link to="/login" class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-8 transition-all hover:-translate-x-1">
          <ArrowLeft :size="16" />
          Volver al ingreso general
        </router-link>

        <div class="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-white mx-auto shadow-2xl shadow-indigo-200 mb-6 transform hover:rotate-6 transition-transform duration-300">
          <GraduationCap :size="40" />
        </div>

        <h2 class="text-4xl font-extrabold text-gray-900 tracking-tight">Portal Estudiantil</h2>
        <p class="mt-4 text-gray-500 leading-relaxed">
          Ingresa con tu código único de estudiante para acceder a tus notas y reportes.
        </p>
      </div>

      <form class="mt-10 space-y-6 relative" @submit.prevent="handleStudentLogin">
          <div>
            <label for="studentCode" class="block text-sm font-bold text-gray-700 mb-2 ml-1">Código Estudiantil</label>
            <input 
              id="studentCode" 
              v-model="studentCode" 
              type="text" 
              required 
              class="appearance-none block w-full px-6 py-4 border-2 border-gray-100 rounded-2xl placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-lg font-medium bg-gray-50/50" 
              placeholder="Ej: ACM-1099..."
            >
          </div>

          <div>
            <label for="password" class="block text-sm font-bold text-gray-700 mb-2 ml-1">Contraseña</label>
            <input 
              id="password" 
              v-model="password" 
              type="password" 
              required 
              class="appearance-none block w-full px-6 py-4 border-2 border-gray-100 rounded-2xl placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-lg font-medium bg-gray-50/50" 
              placeholder="••••••••"
            >
          </div>


        <div class="pt-4">
          <button 
            type="submit" 
            :disabled="isLoading"
            class="group relative w-full flex justify-center py-4 px-6 border border-transparent text-lg font-bold rounded-2xl text-white bg-gray-900 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 shadow-xl shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="isLoading" class="animate-spin mr-2" :size="24" />
            <span v-else>Ingresar al Panel</span>
          </button>
        </div>

        <div class="mt-8 pt-8 border-t border-gray-50">
          <div class="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <p class="text-xs text-amber-700 text-center font-medium">
              Si no conoces tu código, por favor solicítalo en la coordinación de tu institución o consúltalo con tu acudiente.
            </p>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* Transiciones suaves */
.router-link-active {
  color: #4f46e5;
}
</style>
