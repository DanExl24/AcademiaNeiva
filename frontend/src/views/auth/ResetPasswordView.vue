<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, KeyRound } from 'lucide-vue-next'
import { authService } from '../../services/authService'

const route = useRoute()
const router = useRouter()
const token = route.params.token as string

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const message = ref('')
const error = ref('')

const handleResetPassword = async () => {
  if (!password.value || !confirmPassword.value) return

  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  if (password.value.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres.'
    return
  }

  try {
    loading.value = true
    error.value = ''
    message.value = ''

    const data = await authService.resetPassword({
      token,
      password: password.value
    })

    message.value = data.message || 'Contraseña restablecida exitosamente.'
    
    // Redirigir al login en 2 segundos
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (err: any) {

    console.error('Error resetting password:', err)
    error.value = err.response?.data?.error || 'Hubo un problema al restablecer la contraseña. El enlace puede haber expirado.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-6 sm:space-y-8 bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100">
      <div class="text-center">
        <router-link to="/login" class="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 hover:text-indigo-600 mb-6 sm:mb-8 transition-colors">
          <ArrowLeft :size="16" />
          Volver al inicio de sesión
        </router-link>
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white mx-auto shadow-lg shadow-indigo-100 mb-4">
          <KeyRound :size="24" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-gray-900">Nueva Contraseña</h2>
        <p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600">Ingresa tu nueva contraseña para ingresar al sistema</p>
      </div>

      <div v-if="error" class="p-4 bg-red-50 border border-red-100 rounded-xl">
        <p class="text-xs text-red-600 text-center font-bold">{{ error }}</p>
      </div>

      <div v-if="message" class="p-4 bg-green-50 border border-green-100 rounded-xl">
        <p class="text-xs text-green-700 text-center font-bold">{{ message }}</p>
        <p class="text-[10px] text-gray-500 text-center mt-2">Serás redirigido al inicio de sesión...</p>
      </div>
      
      <form v-if="!message" class="mt-8 space-y-6" @submit.prevent="handleResetPassword">
        <div class="rounded-md shadow-sm space-y-4">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
            <input 
              id="password" 
              v-model="password" 
              type="password" 
              required 
              class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
              placeholder="••••••••"
              :disabled="loading"
            />
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
            <input 
              id="confirmPassword" 
              v-model="confirmPassword" 
              type="password" 
              required 
              class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
              placeholder="••••••••"
              :disabled="loading"
            />
          </div>
        </div>

        <div>
          <button 
            type="submit" 
            :disabled="loading"
            class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {{ loading ? 'Restableciendo...' : 'Restablecer contraseña' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
