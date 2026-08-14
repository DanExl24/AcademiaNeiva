import axios from 'axios'

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.replace(/\/$/, '')
  }
  return 'http://localhost:3000'
}

export const API_BASE_URL = getApiBaseUrl()

// Set default baseURL for axios
axios.defaults.baseURL = API_BASE_URL

// Global request interceptor to dynamically rewrite legacy hardcoded localhost URLs
axios.interceptors.request.use(
  (config) => {
    if (config.url) {
      if (config.url.startsWith('http://localhost:3000')) {
        config.url = config.url.replace('http://localhost:3000', API_BASE_URL)
      } else if (config.url.startsWith('http://localhost:3001')) {
        config.url = config.url.replace('http://localhost:3001', API_BASE_URL)
      }
      // Failsafe: Normalize double slashes in URL path (e.g. .dev//api/ -> .dev/api/)
      config.url = config.url.replace(/([^:]\/)\/+/g, '$1')
    }

    // Inject x-school-id header for multi-school context switching
    const selectedSchoolId = localStorage.getItem('selectedSchoolId')
    if (selectedSchoolId && config.headers && !config.headers['x-school-id']) {
      config.headers['x-school-id'] = selectedSchoolId
    }

    // Inject x-academic-year-id header for academic year context
    const selectedAcademicYearId = localStorage.getItem('selectedAcademicYearId')
    if (selectedAcademicYearId && config.headers && !config.headers['x-academic-year-id']) {
      config.headers['x-academic-year-id'] = selectedAcademicYearId
    }

    return config
  },
  (error) => Promise.reject(error)
)
