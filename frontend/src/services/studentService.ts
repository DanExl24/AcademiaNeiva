import apiClient from './api'
import type { Student, AttendanceRecord, ObservationRecord, StudentSanction } from '../types/student.types'

export const studentService = {
  async getStudentsBySchool(schoolId: number, params?: any): Promise<Student[]> {
    const res = await apiClient.get<Student[]>(`/api/student/school/${schoolId}`, { params })
    return res.data
  },

  async getStudentSummary(studentId: number): Promise<any> {
    const res = await apiClient.get(`/api/student/${studentId}/summary`)
    return res.data
  },

  async getStudentInfo(studentId: number): Promise<Student> {
    const res = await apiClient.get<Student>(`/api/student/info/${studentId}`)
    return res.data
  },

  async updateStudent(studentId: number, data: Partial<Student>): Promise<Student> {
    const res = await apiClient.put<Student>(`/api/student/${studentId}`, data)
    return res.data
  },

  async applySanction(studentId: number, sanction: Partial<StudentSanction>): Promise<any> {
    const res = await apiClient.post(`/api/student/${studentId}/sanction`, sanction)
    return res.data
  },

  async recordAttendance(payload: { id_detallegrado: number; fecha: string; asistencias: AttendanceRecord[] }): Promise<any> {
    const res = await apiClient.post('/api/attendance/bulk', payload)
    return res.data
  },

  async getAttendance(id_detallegrado: number, fecha: string): Promise<AttendanceRecord[]> {
    const res = await apiClient.get<AttendanceRecord[]>('/api/attendance', {
      params: { id_detallegrado, fecha }
    })
    return res.data
  },

  async getObservations(studentId: number): Promise<ObservationRecord[]> {
    const res = await apiClient.get<ObservationRecord[]>(`/api/observations/student/${studentId}`)
    return res.data
  },

  async saveObservation(data: Partial<ObservationRecord>): Promise<ObservationRecord> {
    const res = await apiClient.post<ObservationRecord>('/api/observations', data)
    return res.data
  }
}

export default studentService
