import axios, { type InternalAxiosRequestConfig } from 'axios'

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.replace(/\/$/, '')
  }
  return 'http://localhost:3000'
}

export const API_BASE_URL = getApiBaseUrl()

// Configurar baseURL por defecto en la instancia global para retrocompatibilidad
axios.defaults.baseURL = API_BASE_URL

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Función común de intercepción de peticiones para inyección de headers y seguridad de modo monitoreo
 */
const handleRequestConfig = (config: InternalAxiosRequestConfig) => {
  // Normalizar URLs legadas de localhost
  if (config.url) {
    if (config.url.startsWith('http://localhost:3000')) {
      config.url = config.url.replace('http://localhost:3000', API_BASE_URL)
    } else if (config.url.startsWith('http://localhost:3001')) {
      config.url = config.url.replace('http://localhost:3001', API_BASE_URL)
    }
    config.url = config.url.replace(/([^:]\/)\/+/g, '$1')
  }

  // 1. Inyección de Token de Autorización
  const token = localStorage.getItem('token')
  if (token && config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // 2. Inyección de x-school-id (unificado con selectedSchoolId)
  const schoolId = localStorage.getItem('selectedSchoolId') || localStorage.getItem('activeSchoolId')
  if (schoolId && config.headers && !config.headers['x-school-id']) {
    config.headers['x-school-id'] = schoolId
  }

  // 3. Inyección de x-academic-year-id
  const selectedYearId = localStorage.getItem('selectedAcademicYearId')
  if (selectedYearId && config.headers && !config.headers['x-academic-year-id']) {
    config.headers['x-academic-year-id'] = selectedYearId
  }

  // 4. Verificación de Modo Monitoreo / Supervisión Solo Lectura
  const monitoringUser = localStorage.getItem('monitoringUser')
  const isMonitoring = !!(monitoringUser && monitoringUser !== 'null')

  let isReadOnlySupervision = false
  const supervisionRaw = localStorage.getItem('supervision')
  if (supervisionRaw && supervisionRaw !== 'null') {
    try {
      const supervision = JSON.parse(supervisionRaw)
      if (supervision?.tipo_supervision === 'SOLO_LECTURA') {
        isReadOnlySupervision = true
      }
    } catch {
      // Ignorar error de parsing
    }
  }

  if (isMonitoring && config.headers) {
    config.headers['X-Monitoring-Mode'] = 'true'
  }

  const isReadOnlyMode = isMonitoring || isReadOnlySupervision
  if (isReadOnlyMode) {
    const method = config.method?.toUpperCase()
    const isExitRoute = config.url?.includes('/salir') || config.url?.includes('/stop-monitoring') || false
    if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isExitRoute) {
      return Promise.reject(new Error('Acceso denegado. El Modo Monitoreo es estrictamente de SOLO LECTURA.'))
    }
  }

  return config
}

// Interceptor de peticiones para instancia dedicada 'api'
api.interceptors.request.use(
  handleRequestConfig,
  (error) => Promise.reject(error)
)

// Interceptor de peticiones para instancia global 'axios' (compatibilidad con vistas existentes)
axios.interceptors.request.use(
  handleRequestConfig,
  (error) => Promise.reject(error)
)

// Manejador común de respuestas
const handleResponseError = (error: any) => {
  if (error.response?.status === 401) {
    const currentPath = window.location.pathname
    if (currentPath !== '/login' && currentPath !== '/') {
      console.warn('[API Interceptor] Sesión expirada o token no autorizado.')
    }
  }
  return Promise.reject(error)
}

api.interceptors.response.use((response) => response, handleResponseError)
axios.interceptors.response.use((response) => response, handleResponseError)

export default api
