import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'directivo' | 'docente' | 'padre' | 'estudiante'
  roles: string[]
  schoolId?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref<string | null>(localStorage.getItem('token'))
  const activeRole = ref<string | null>(localStorage.getItem('activeRole') || (user.value?.role || null))
  
  const isAuthenticated = computed(() => !!token.value)

  function setUser(userData: User, userToken: string) {
    user.value = userData
    token.value = userToken
    activeRole.value = userData.role // Rol inicial
    localStorage.setItem('token', userToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('activeRole', userData.role)
  }

  function setActiveRole(role: string) {
    activeRole.value = role
    localStorage.setItem('activeRole', role)
  }

  function logout() {
    user.value = null
    token.value = null
    activeRole.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('activeRole')
  }

  return {
    user,
    token,
    activeRole,
    isAuthenticated,
    setUser,
    setActiveRole,
    logout
  }
})
