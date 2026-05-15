import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  name?: string
  email: string
  roles: string[]
  schoolId: string
  schoolName?: string
  docenteId?: string
  padreId?: string
  studentId?: string
  directivoId?: string
  gradoId?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isAuthenticated = computed(() => !!token.value)

  function setUser(userData: User, userToken: string) {
    user.value = userData
    token.value = userToken
    localStorage.setItem('token', userToken)
    // También podríamos guardar el usuario en localStorage o recuperarlo vía API
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return {
    user,
    token,
    isAuthenticated,
    setUser,
    logout
  }
})
