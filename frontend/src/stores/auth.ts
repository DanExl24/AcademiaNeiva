import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  id_usuario?: number
  name: string
  email: string
  role: 'admin' | 'directivo' | 'docente' | 'padre' | 'estudiante'
  roles: string[]
  schoolId?: string
}

export interface MonitoredTeacher {
  id: number
  nombre: string
  apellido: string
  email: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref<string | null>(localStorage.getItem('token'))
  const activeRole = ref<string | null>(localStorage.getItem('activeRole') || (user.value?.role || null))
  
  // Modo monitoreo: directivo observando el panel de un docente (solo lectura)
  const monitoringUser = ref<MonitoredTeacher | null>(null)
  const isMonitoring = computed(() => !!monitoringUser.value)

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

  function startMonitoring(teacher: MonitoredTeacher) {
    monitoringUser.value = teacher
  }

  function stopMonitoring() {
    monitoringUser.value = null
  }

  function logout() {
    user.value = null
    token.value = null
    activeRole.value = null
    monitoringUser.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('activeRole')
  }

  return {
    user,
    token,
    activeRole,
    isAuthenticated,
    monitoringUser,
    isMonitoring,
    setUser,
    setActiveRole,
    startMonitoring,
    stopMonitoring,
    logout
  }
})
