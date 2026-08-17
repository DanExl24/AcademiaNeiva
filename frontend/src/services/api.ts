import axios from 'axios'
import { API_BASE_URL } from '../config/api'


export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const schoolId = localStorage.getItem('activeSchoolId')
  if (schoolId) {
    config.headers['x-school-id'] = schoolId
  }

  const selectedYearId = localStorage.getItem('selectedAcademicYearId')
  if (selectedYearId) {
    config.headers['x-academic-year-id'] = selectedYearId
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Manejo de token expirado o sesión revocada
    }
    return Promise.reject(error)
  }
)

export default api
