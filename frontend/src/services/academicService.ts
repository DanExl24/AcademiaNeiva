import apiClient from './api'
import type { AcademicYear, Period, DetalleGrado, Subject, Competency } from '../types/academic.types'

export const academicService = {
  async getYears(schoolId: number): Promise<AcademicYear[]> {
    const res = await apiClient.get<AcademicYear[]>(`/api/academic-admin/school/${schoolId}/years`)
    return res.data
  },

  async getPeriods(yearId?: number): Promise<Period[]> {
    const params = yearId ? { yearId } : {}
    const res = await apiClient.get<Period[]>('/api/academic-admin/periods', { params })
    return res.data
  },

  async getGrades(schoolId: number): Promise<DetalleGrado[]> {
    const res = await apiClient.get<DetalleGrado[]>(`/api/academic-admin/grades/${schoolId}`)
    return res.data
  },

  async getSubjects(schoolId: number): Promise<Subject[]> {
    const res = await apiClient.get<Subject[]>(`/api/academic-admin/subjects/${schoolId}`)
    return res.data
  },

  async getCompetencies(params: { id_periodo: number; id_detallegrado?: number; id_materia?: number }): Promise<Competency[]> {
    const res = await apiClient.get<Competency[]>('/api/academic-admin/competencies', { params })
    return res.data
  },

  async getSchoolIdentity(schoolId: number): Promise<any> {
    const res = await apiClient.get(`/api/academic-admin/my-school/${schoolId}`)
    return res.data.school || res.data
  },

  async updateSchoolIdentity(schoolId: number, data: any): Promise<any> {
    const res = await apiClient.put(`/api/academic-admin/my-school/${schoolId}`, data)
    return res.data
  }
}

export default academicService
