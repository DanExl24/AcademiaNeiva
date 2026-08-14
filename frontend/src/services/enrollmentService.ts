import apiClient from './api'
import type { EnrollmentRequest, EnrollmentStatus } from '../types/enrollment.types'

export const enrollmentService = {
  async getEnrollments(schoolId: number, params?: { estado?: string; yearId?: number }): Promise<EnrollmentRequest[]> {
    const res = await apiClient.get<EnrollmentRequest[]>(`/api/matriculas/filtered/${schoolId}`, { params })
    return res.data
  },

  async getEnrollmentDetails(id: number): Promise<EnrollmentRequest> {
    const res = await apiClient.get<EnrollmentRequest>(`/api/matriculas/${id}`)
    return res.data
  },

  async updateStatus(id: number, estado: EnrollmentStatus, motivo?: string): Promise<any> {
    const res = await apiClient.patch(`/api/matriculas/${id}/estado`, { estado, motivo })
    return res.data
  },

  async requestCorrection(id: number, payload: { observaciones: string; documentos: any[] }): Promise<any> {
    const res = await apiClient.post(`/api/matriculas/${id}/solicitar-correccion`, payload)
    return res.data
  },

  async finalizeRegistration(id: number, payload: any): Promise<any> {
    const res = await apiClient.post(`/api/matriculas/${id}/finalizar-registro`, payload)
    return res.data
  },

  async trackEnrollment(token: string): Promise<EnrollmentRequest> {
    const res = await apiClient.get<EnrollmentRequest>(`/api/matriculas/tracking/${token}`)
    return res.data
  }
}

export default enrollmentService
