import api from './api'
import type { Enrollment } from '../types/enrollment.types'

export const enrollmentService = {
  async getPending(schoolId: number): Promise<Enrollment[]> {
    const res = await api.get(`/matriculas/pending/${schoolId}`)
    return res.data?.data || res.data || []
  },

  async getFiltered(schoolId: number, params?: any): Promise<Enrollment[]> {
    const res = await api.get(`/matriculas/filtered/${schoolId}`, { params })
    return res.data?.data || res.data || []
  },

  async getDetails(id: number | string): Promise<any> {
    const res = await api.get(`/matriculas/${id}`)
    return res.data?.data || res.data
  },

  async validateDocument(documentId: number, estado: string, motivo?: string): Promise<any> {
    const res = await api.patch(`/matriculas/document/${documentId}`, { estado, motivo_rechazo: motivo })
    return res.data
  },

  async finalize(matriculaId: number, payload: any): Promise<any> {
    const res = await api.post(`/matriculas/finalize/${matriculaId}`, payload)
    return res.data
  },

  async cancel(matriculaId: number, motivo: string, estadoFinal: 'RETIRADO' | 'EXPULSADO'): Promise<any> {
    const res = await api.post(`/matriculas/cancel/${matriculaId}`, { motivo, estado_final: estadoFinal })
    return res.data
  }
}
