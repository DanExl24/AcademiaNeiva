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

  async cancelOrReject(idMatricula: number | string, tipo: string | undefined, payload: CancelEnrollmentPayload, isPending = false): Promise<any> {
    const fullReason = `${payload.motivo}${payload.detalles ? ': ' + payload.detalles : ''}`
    if (tipo === 'REINGRESO') {
      const res = await api.post(`/academic-admin/matriculas/reingreso/${idMatricula}/rechazar`, { motivo: fullReason })
      return res.data
    } else if (tipo === 'EXTRAORDINARIA' && isPending) {
      const res = await api.post(`/academic-admin/matriculas/extraordinaria/${idMatricula}/rechazar`, { motivo: fullReason })
      return res.data
    } else {
      const res = await api.post(`/matriculas/cancel/${idMatricula}`, {
        motivo: payload.motivo,
        detalles: payload.detalles,
        estado_estudiante: payload.estado_estudiante || 'RETIRADO'
      })
      return res.data
    }
  },

  async finalize(matriculaId: number | string, payload: any): Promise<any> {
    const res = await api.post(`/matriculas/finalize/${matriculaId}`, payload)
    return res.data
  }
}

export default enrollmentService

