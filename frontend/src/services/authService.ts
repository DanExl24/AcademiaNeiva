import apiClient from './api'
import type { LoginResponse, User } from '../types/auth.types'

export const authService = {
  async login(credentials: { email: string; password: string; id_colegio?: number }): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/api/auth/login', credentials)
    return res.data
  },

  async verifyToken(): Promise<{ ok: boolean; user?: User }> {
    const res = await apiClient.get('/api/auth/verify')
    return res.data
  },

  async getProfile(): Promise<User> {
    const res = await apiClient.get<User>('/api/auth/profile')
    return res.data
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const res = await apiClient.put<User>('/api/auth/profile', data)
    return res.data
  },

  async changePassword(data: { currentPassword?: string; newPassword: string }): Promise<{ message: string }> {
    const res = await apiClient.post('/api/auth/change-password', data)
    return res.data
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const res = await apiClient.post('/api/auth/forgot-password', { email })
    return res.data
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const res = await apiClient.post(`/api/auth/reset-password/${token}`, { newPassword })
    return res.data
  }
}

export default authService
