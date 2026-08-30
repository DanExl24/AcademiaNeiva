import api from './api'
import type { Enrollment } from '../types/enrollment.types'

export interface FilterEnrollmentsParams {
  estado?: string
  yearId?: number
  tipo?: string
  idNivel?: number
}

export interface CancelEnrollmentPayload {
  motivo: string
  detalles?: string
  estado_estudiante?: 'RETIRADO' | 'EXPULSADO'
}

export const enrollmentService = {
  async getAllSchools(): Promise<any[]> {
    const res = await api.get('/matriculas')
    return res.data || []
  },

  async getFiltered(schoolId: number | string, params?: FilterEnrollmentsParams): Promise<Enrollment[]> {
    const res = await api.get(`/matriculas/filtered/${schoolId}`, { params })
    return res.data?.data || res.data || []
  },

  async getDetails(id: number | string): Promise<any> {
    const res = await api.get(`/matriculas/${id}`)
    return res.data?.data || res.data
  },

  async getStudentSummary(studentId: number | string): Promise<any> {
    const res = await api.get(`/student/${studentId}/summary`)
    return res.data?.data || res.data
  },

  async assignGrade(idMatricula: number | string, idGrado: number): Promise<any> {
    const res = await api.post(`/matriculas/assign-grade/${idMatricula}`, { idGrado })
    return res.data
  },

  async updateDocumentStatus(documentId: number | string, estado: string, motivo?: string): Promise<any> {
    const res = await api.patch(`/matriculas/document/${documentId}`, { estado, motivo_rechazo: motivo })
    return res.data
  },

  async notifyInconsistencies(idMatricula: number | string): Promise<any> {
    const res = await api.post(`/matriculas/notify-inconsistencies/${idMatricula}`)
    return res.data
  },

  async requestCorrection(idMatricula: number | string, tipo: string | undefined, observaciones: string): Promise<any> {
    const endpoint = tipo === 'REINGRESO'
      ? `/academic-admin/matriculas/reingreso/${idMatricula}/corregir`
      : `/academic-admin/matriculas/extraordinaria/${idMatricula}/corregir`
    const res = await api.post(endpoint, { observaciones: observaciones.trim() })
    return res.data
  },

  async cancelEnrollment(idMatricula: number | string, payload: any): Promise<any> {
    const res = await api.post(`/matriculas/cancel/${idMatricula}`, payload)
    return res.data
  },

  async cancelOrReject(idMatricula: number | string, tipo: string | undefined, payload: CancelEnrollmentPayload, isPending = false): Promise<any> {
    const fullReason = `${payload.motivo}${payload.detalles ? ': ' + payload.detalles : ''}`
    if (tipo === 'REINGRESO') {
      const res = await api.post(`/academic-admin/matriculas/reingreso/${idMatricula}/rechazar`, { motivo: fullReason })
      return res.data
    }
    const endpoint = isPending
      ? `/academic-admin/matriculas/solicitud/${idMatricula}/rechazar`
      : `/academic-admin/matriculas/anular/${idMatricula}`
    const res = await api.post(endpoint, {
      motivo: fullReason,
      estado_estudiante: payload.estado_estudiante
    })
    return res.data
  },

  async finalize(matriculaId: number | string, payload: any): Promise<any> {
    const res = await api.post(`/matriculas/finalize/${matriculaId}`, payload)
    return res.data
  },

  // Public Enrollment
  async getAvailableGrades(schoolId: number | string): Promise<any[]> {
    const res = await api.get(`/grados/available/${schoolId}`)
    return res.data || []
  },

  async getByToken(token: string): Promise<any> {
    try {
      const res = await api.get(`/matriculas/public/by-token/${token}`)
      return res.data?.data || res.data
    } catch (e) {
      const res = await api.get(`/matriculas/${token}`)
      return res.data?.data || res.data
    }
  },

  async getSchoolEnrollmentConfig(schoolId: number | string): Promise<any> {
    const res = await api.get(`/matriculas/school/${schoolId}/enrollment-config`)
    return res.data
  },

  async sendEmailCode(payload: { email: string; schoolId: number | string }): Promise<any> {
    const res = await api.post('/matriculas/send-email-code', payload)
    return res.data
  },

  async verifyEmailCode(payload: { email: string; code: string; schoolId: number | string }): Promise<any> {
    const res = await api.post('/matriculas/verify-email-code', payload)
    return res.data
  },

  async submitEnrollment(formData: FormData): Promise<any> {
    const res = await api.post('/matriculas/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },

  async updateDocuments(token: string, formData: FormData): Promise<any> {
    const res = await api.post(`/matriculas/update-documents/${token}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  }
}

export default enrollmentService

