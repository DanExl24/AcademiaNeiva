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
  
  // Modo monitoreo: directivo observando el panel de un docente o estudiante (solo lectura)
  const monitoringUser = ref<MonitoredTeacher | null>(JSON.parse(localStorage.getItem('monitoringUser') || 'null'))
  const previousRole = ref<string | null>(localStorage.getItem('previousRole'))
  const monitoringType = ref<'docente' | 'estudiante' | null>(localStorage.getItem('monitoringType') as any || null)
  const isMonitoring = computed(() => !!monitoringUser.value)

  // Modo supervisión: admin general observando/editando el panel de rector de un colegio
  const supervision = ref<any>(JSON.parse(localStorage.getItem('supervision') || 'null'))
  const isSupervising = computed(() => !!supervision.value)

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
    // Guardar el rol actual para poder restaurarlo después
    previousRole.value = activeRole.value
    localStorage.setItem('previousRole', activeRole.value || '')
    
    monitoringUser.value = teacher
    localStorage.setItem('monitoringUser', JSON.stringify(teacher))

    monitoringType.value = 'docente'
    localStorage.setItem('monitoringType', 'docente')
    
    // Cambiar automáticamente a rol docente para ver su panel
    setActiveRole('docente')
  }

  function startStudentMonitoring(student: MonitoredTeacher) {
    // Guardar el rol actual para poder restaurarlo después
    previousRole.value = activeRole.value
    localStorage.setItem('previousRole', activeRole.value || '')
    
    monitoringUser.value = student
    localStorage.setItem('monitoringUser', JSON.stringify(student))

    monitoringType.value = 'estudiante'
    localStorage.setItem('monitoringType', 'estudiante')
    
    // Cambiar automáticamente a rol estudiante para ver su panel
    setActiveRole('estudiante')
  }

  function stopMonitoring() {
    monitoringUser.value = null
    localStorage.removeItem('monitoringUser')

    monitoringType.value = null
    localStorage.removeItem('monitoringType')
    
    // Restaurar el rol previo si existe
    if (previousRole.value) {
      setActiveRole(previousRole.value)
      previousRole.value = null
      localStorage.removeItem('previousRole')
    }
  }

  function startSupervision(supervisionData: any) {
    // Guardar rol previo
    previousRole.value = activeRole.value
    localStorage.setItem('previousRole', activeRole.value || '')

    supervision.value = supervisionData
    localStorage.setItem('supervision', JSON.stringify(supervisionData))

    // Heredar rol de Rector (directivo en el menu) y asignar schoolId
    setActiveRole('directivo')
    if (user.value) {
      user.value.schoolId = String(supervisionData.id_colegio)
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  function stopSupervision() {
    supervision.value = null
    localStorage.removeItem('supervision')

    if (user.value) {
      delete user.value.schoolId
      localStorage.setItem('user', JSON.stringify(user.value))
    }

    // Restaurar rol previo
    if (previousRole.value) {
      setActiveRole(previousRole.value)
      previousRole.value = null
      localStorage.removeItem('previousRole')
    }
  }

  function logout() {
    user.value = null
    token.value = null
    activeRole.value = null
    monitoringUser.value = null
    previousRole.value = null
    monitoringType.value = null
    supervision.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('activeRole')
    localStorage.removeItem('monitoringUser')
    localStorage.removeItem('previousRole')
    localStorage.removeItem('monitoringType')
    localStorage.removeItem('supervision')
  }

  return {
    user,
    token,
    activeRole,
    isAuthenticated,
    monitoringUser,
    monitoringType,
    isMonitoring,
    supervision,
    isSupervising,
    setUser,
    setActiveRole,
    startMonitoring,
    startStudentMonitoring,
    stopMonitoring,
    startSupervision,
    stopSupervision,
    logout
  }
})

