import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

export function usePermissions() {
  const auth = useAuthStore()

  const isReadOnly = computed(() => {
    // Si está en modo monitoreo (directivo viendo a estudiante/docente) o supervisión en solo lectura
    if (auth.isMonitoring) return true
    if (auth.isSupervising && auth.supervision?.tipo_supervision === 'SOLO_LECTURA') return true
    return false
  })

  const canEdit = computed(() => !isReadOnly.value)

  const hasRole = (role: string): boolean => {
    return auth.activeRole?.toLowerCase() === role.toLowerCase()
  }

  const isDirectivo = computed(() => hasRole('directivo'))
  const isDocente = computed(() => hasRole('docente'))
  const isEstudiante = computed(() => hasRole('estudiante'))
  const isPadre = computed(() => hasRole('padre'))
  const isAdminGeneral = computed(() => hasRole('admin_general'))

  return {
    isReadOnly,
    canEdit,
    hasRole,
    isDirectivo,
    isDocente,
    isEstudiante,
    isPadre,
    isAdminGeneral
  }
}
