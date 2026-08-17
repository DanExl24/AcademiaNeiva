import api from './api'
import type { Student, StudentObservation } from '../types/student.types'

export const studentService = {
  async getAll(): Promise<any> {
    const res = await api.get('/students')
    return res.data
  },

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

  async getParentChildren(parentId: number | string): Promise<any[]> {
    const res = await api.get(`/student/parent-children/${parentId}`)
    return res.data || []
  },

  async getByUserId(userId: number | string): Promise<any> {
    const res = await api.get(`/student/user-id/${userId}`)
    return res.data
  },

  async getYears(studentId: number | string): Promise<any[]> {
    const res = await api.get(`/student/years/${studentId}`)
    return res.data || []
  },

  async getInfo(studentId: number | string): Promise<any> {
    const res = await api.get(`/student/info/${studentId}`)
    return res.data
  },

  async getAllPeriods(studentId: number | string, yearId: number | string): Promise<any[]> {
    const res = await api.get(`/student/all-periods/${studentId}/${yearId}`)
    return res.data || []
  },

  async getGrades(studentId: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/student/grades/${studentId}/${periodId}`)
    return res.data
  },

  async getGradeDetails(studentId: number | string, periodId: number | string, subjectId: number | string): Promise<any> {
    const res = await api.get(`/student/grade-details/${studentId}/${periodId}/${subjectId}`)
    return res.data
  },

  async getAttendance(urlOrStudentId: string | number, periodId?: number | string): Promise<any> {
    if (typeof urlOrStudentId === 'string' && urlOrStudentId.startsWith('/api/')) {
      const path = urlOrStudentId.replace('/api', '')
      const res = await api.get(path)
      return res.data
    }
    const res = await api.get(`/student/attendance/${urlOrStudentId}/${periodId}`)
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
