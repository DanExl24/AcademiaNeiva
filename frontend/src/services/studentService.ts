import api from './api'
import type { Student, StudentObservation } from '../types/student.types'

export const studentService = {
  async getStudentsBySchool(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/student/colegio/${schoolId}`, { params })
    return res.data?.data || res.data || []
  },

  async getStudentById(id: number | string): Promise<Student> {
    const res = await api.get(`/student/${id}`)
    return res.data?.data || res.data
  },

  async getStudentSummary(studentId: number | string): Promise<any> {
    const res = await api.get(`/student/${studentId}/summary`)
    return res.data
  },

  async updateStudent(id: number | string, data: any): Promise<any> {
    const res = await api.put(`/student/${id}`, data)
    return res.data
  },

  async deleteStudent(id: number | string): Promise<any> {
    const res = await api.delete(`/student/${id}`)
    return res.data
  },

  async updateStudentStatus(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/student/${id}/status`, payload)
    return res.data
  },

  async changeStudentGrade(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/student/${id}/change-grade`, payload)
    return res.data
  },

  async graduateStudent(id: number | string, payload: any): Promise<any> {
    const res = await api.post(`/student/${id}/graduate`, payload)
    return res.data
  },

  async getSanctionTypes(): Promise<any[]> {
    const res = await api.get('/student/sanctions/types')
    return res.data || []
  },

  async getObservations(studentId: number | string): Promise<StudentObservation[]> {
    const res = await api.get(`/observations/student/${studentId}`)
    return res.data?.data || res.data || []
  }
}

export default studentService
