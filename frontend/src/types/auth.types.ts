export type Role = 'admin_general' | 'directivo' | 'docente' | 'estudiante' | 'padre'

export interface User {
  id: number
  id_usuario?: number
  name: string
  nombre?: string
  apellido?: string
  email: string
  documento?: string
  id_tipodocumento?: number
  roles: string[]
  role?: string
  schoolId?: number
  id_colegio?: number
  schoolIds?: number[]
  escudo?: string
  escudo_url?: string
}

export interface AuthState {
  token: string | null
  user: User | null
  activeRole: string | null
  selectedSchoolId: number | null
  isSupervising: boolean
  supervision: SupervisionSession | null
  isMonitoring: boolean
  monitoringType: 'estudiante' | 'docente' | 'padre' | null
  monitoringUser: any | null
}

export interface SupervisionSession {
  id_auditoria: number
  id_colegio: number
  colegio_id?: number
  colegio_nombre: string
  fecha_entrada: string
  duracion_maxima_minutos: number
  tipo_supervision: 'SOLO_LECTURA' | 'EDITOR'
}

export interface LoginResponse {
  token: string
  user: User
  colegios?: { id_colegio: number; nombre: string; rol: string }[]
}
