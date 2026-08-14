import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { API_BASE_URL } from '../config/api'

// Instancia centralizada de Axios para la capa de servicios
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Interceptor de Solicitudes: Adjuntar Token y contexto institucional
apiClient.interceptors.request.use(
  (config) => {
    // 1. Obtener token del almacenamiento
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 2. Contexto de Colegio Seleccionado
    const selectedSchoolId = localStorage.getItem('selectedSchoolId')
    if (selectedSchoolId && config.headers && !config.headers['x-school-id']) {
      config.headers['x-school-id'] = selectedSchoolId
    }

    // 3. Contexto de Año Lectivo Seleccionado
    const selectedAcademicYearId = localStorage.getItem('selectedAcademicYearId')
    if (selectedAcademicYearId && config.headers && !config.headers['x-academic-year-id']) {
      config.headers['x-academic-year-id'] = selectedAcademicYearId
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor de Respuestas: Manejo uniforme de expiración de sesión (401)
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[API Client] Sesión no autorizada o expirada (401).')
    }
    return Promise.reject(error)
  }
)

export default apiClient
