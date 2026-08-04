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
    }
    return config
  },
  (error) => Promise.reject(error)
)
