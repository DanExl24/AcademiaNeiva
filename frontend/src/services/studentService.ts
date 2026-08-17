import api from './api'
import type { Student, StudentObservation } from '../types/student.types'

export const studentService = {
  async getStudentsBySchool(schoolId: number): Promise<Student[]> {
    const res = await api.get(`/student/school/${schoolId}`)
    return res.data?.data || res.data || []
  },

  async getStudentById(id: number): Promise<Student> {
    const res = await api.get(`/student/${id}`)
    return res.data?.data || res.data
  },

  async updateStudent(id: number, data: Partial<Student>): Promise<Student> {
    const res = await api.put(`/student/${id}`, data)
    return res.data?.data || res.data
  },

  async updateStudentStatus(id: number, estado: string, motivo?: string): Promise<any> {
    const res = await api.patch(`/student/${id}/status`, { estado, motivo_estado: motivo })
    return res.data
  },

  async getObservations(studentId: number): Promise<StudentObservation[]> {
    const res = await api.get(`/observations/student/${studentId}`)
    return res.data?.data || res.data || []
  }
}

export default studentService

