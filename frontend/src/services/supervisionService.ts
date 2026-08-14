import apiClient from './api'
import type { SupervisionRequest, ActiveSupervision } from '../types/supervision.types'

export const supervisionService = {
  async verifyActiveSupervision(): Promise<{ activa: boolean; estado?: string; revocador_nombre?: string; motivo_revocacion?: string }> {
    const res = await apiClient.get('/api/admin/supervision/verificar-activa')
    return res.data
  },

  async exitSupervision(auditoriaId: number): Promise<any> {
    const res = await apiClient.post(`/api/admin/supervision/${auditoriaId}/salir`)
    return res.data
  },

  async revokeSupervision(auditoriaId: number, motivo: string): Promise<any> {
    const res = await apiClient.post(`/api/admin/supervision/${auditoriaId}/revocar`, { motivo })
    return res.data
  },

  async getActiveSupervisions(schoolId: number): Promise<ActiveSupervision[]> {
    const res = await apiClient.get<ActiveSupervision[]>(`/api/admin/colegio/${schoolId}/supervisiones`)
    return res.data
  },

  async requestSupervision(data: Partial<SupervisionRequest>): Promise<any> {
    const res = await apiClient.post('/api/admin/supervision/solicitar', data)
    return res.data
  }
}

export default supervisionService
