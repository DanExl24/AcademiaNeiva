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
  },

  async getProfile(params?: any): Promise<any> {
    const res = await api.get('/auth/profile', { params })
    return res.data
  },

  async requestEmailChange(payload: any): Promise<any> {
    const res = await api.post('/auth/profile/request-email-change', payload)
    return res.data
  },

  async verifyEmailChange(payload: any): Promise<any> {
    const res = await api.post('/auth/profile/verify-email-change', payload)
    return res.data
  },

  async updatePhone(payload: any): Promise<any> {
    const res = await api.put('/auth/profile/phone', payload)
    return res.data
  },

  async updatePassword(payload: any): Promise<any> {
    const res = await api.put('/auth/profile/password', payload)
    return res.data
  },

  async getMisVinculaciones(): Promise<any> {
    const res = await api.get('/traslados/mis-vinculaciones')
    return res.data
  }
}

export default authService
