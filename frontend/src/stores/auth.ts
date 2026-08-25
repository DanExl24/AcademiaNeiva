import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  id_usuario?: number
  name: string
  email: string
  role: 'admin' | 'admin_general' | 'directivo' | 'docente' | 'padre' | 'estudiante'
  roles: string[]
  schoolId?: string
  schoolIds?: number[]
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
  
  // Selected school context for multi-school parents / general users
  const selectedSchoolId = ref<number | null>(
    localStorage.getItem('selectedSchoolId') ? Number(localStorage.getItem('selectedSchoolId')) : 
    (user.value?.schoolIds?.[0] ? Number(user.value.schoolIds[0]) : (user.value?.schoolId ? Number(user.value.schoolId) : null))
  )

  // Modo monitoreo: directivo observando el panel de un docente o estudiante (solo lectura)
  const monitoringUser = ref<MonitoredTeacher | null>(JSON.parse(localStorage.getItem('monitoringUser') || 'null'))
  const previousRole = ref<string | null>(localStorage.getItem('previousRole'))
  const monitoringType = ref<'docente' | 'estudiante' | 'padre' | null>(localStorage.getItem('monitoringType') as any || null)
  const isMonitoring = computed(() => !!monitoringUser.value)

  // Modo supervisión: admin general observando/editando el panel de rector de un colegio
  const supervision = ref<any>(JSON.parse(localStorage.getItem('supervision') || 'null'))
  const isSupervising = computed(() => !!supervision.value)

  const isAuthenticated = computed(() => !!token.value)

  function setSelectedSchoolId(schoolId: number | null) {
    selectedSchoolId.value = schoolId
    if (schoolId) {
      localStorage.setItem('selectedSchoolId', String(schoolId))
    } else {
      localStorage.removeItem('selectedSchoolId')
    }
  }

  function setUser(userData: User, userToken: string) {
    user.value = userData
    token.value = userToken
    activeRole.value = userData.role // Rol inicial
    localStorage.setItem('token', userToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('activeRole', userData.role)

    // Auto-select school context
    if (userData.schoolIds && userData.schoolIds.length > 0) {
      setSelectedSchoolId(userData.schoolIds[0])
    } else if (userData.schoolId) {
      setSelectedSchoolId(Number(userData.schoolId))
    } else {
      setSelectedSchoolId(null)
    }
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

  function startParentMonitoring(parent: MonitoredTeacher) {
    // Guardar el rol actual para poder restaurarlo después
    previousRole.value = activeRole.value
    localStorage.setItem('previousRole', activeRole.value || '')
    
    monitoringUser.value = parent
    localStorage.setItem('monitoringUser', JSON.stringify(parent))

    monitoringType.value = 'padre'
    localStorage.setItem('monitoringType', 'padre')
    
    // Cambiar automáticamente a rol padre para ver su panel
    setActiveRole('padre')
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
    setSelectedSchoolId(Number(supervisionData.id_colegio))
  }

  function stopSupervision() {
    supervision.value = null
    localStorage.removeItem('supervision')

    if (user.value) {
      const updatedUser = { ...user.value }
      delete updatedUser.schoolId
      user.value = updatedUser
      localStorage.setItem('user', JSON.stringify(user.value))
    }

    // Restaurar rol previo
    if (previousRole.value) {
      setActiveRole(previousRole.value)
      previousRole.value = null
      localStorage.removeItem('previousRole')
    }

    if (user.value?.schoolIds && user.value.schoolIds.length > 0) {
      setSelectedSchoolId(user.value.schoolIds[0])
    } else if (user.value?.schoolId) {
      setSelectedSchoolId(Number(user.value.schoolId))
    } else {
      setSelectedSchoolId(null)
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
    selectedSchoolId.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('activeRole')
    localStorage.removeItem('monitoringUser')
    localStorage.removeItem('previousRole')
    localStorage.removeItem('monitoringType')
    localStorage.removeItem('supervision')
    localStorage.removeItem('selectedSchoolId')

    // Resetear la verificación del router guard via sessionStorage
    sessionStorage.removeItem('_sessionVerified')
  }

  return {
    user,
    token,
    activeRole,
    isAuthenticated,
    selectedSchoolId,
    monitoringUser,
    monitoringType,
    isMonitoring,
    supervision,
    isSupervising,
    setUser,
    setActiveRole,
    setSelectedSchoolId,
    startMonitoring,
    startStudentMonitoring,
    startParentMonitoring,
    stopMonitoring,
    startSupervision,
    stopSupervision,
    logout
  }
})


