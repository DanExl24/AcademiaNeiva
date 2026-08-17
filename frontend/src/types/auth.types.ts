export interface UserSession {
  id: number
  email: string
  nombre?: string
  apellido?: string
  documento?: string
  telefono?: string
  role?: string
  roles?: string[]
  schoolId?: number | null
  schoolIds?: number[]
  activeRole?: string
  isMonitoring?: boolean
  monitoringUser?: {
    id: number
    nombre: string
    role: string
    [key: string]: any
  } | null
}

export interface LoginResponse {
  token: string
  user: UserSession
  message?: string
}

export interface VerificationResponse {
  valid: boolean
  user: UserSession
}
