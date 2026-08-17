import api from './api'

export const authService = {
  async checkDocument(documento: string): Promise<any> {
    const res = await api.get(`/auth/check-document/${documento}`)
    return res.data
  },

  async login(credentials: any): Promise<any> {
    const res = await api.post('/auth/login', credentials)
    return res.data
  },

  async forgotPassword(email: string): Promise<any> {
    const res = await api.post('/auth/forgot-password', { email })
    return res.data
  },

  async resetPassword(payload: any): Promise<any> {
    const res = await api.post('/auth/reset-password', payload)
    return res.data
  }
}

export default authService
