import apiClient from './api'
import type { Activity, Criterion, GradeScale, CourseAssignment } from '../types/grade.types'

export const gradeService = {
  async getTeacherCourses(): Promise<CourseAssignment[]> {
    const res = await apiClient.get<CourseAssignment[]>('/api/grades/teacher-courses')
    return res.data
  },

  async getActivities(id_materia: number, id_periodo: number, id_detallegrado: number): Promise<Activity[]> {
    const res = await apiClient.get<Activity[]>('/api/grades/activities', {
      params: { id_materia, id_periodo, id_detallegrado }
    })
    return res.data
  },

  async saveActivity(data: Partial<Activity>): Promise<Activity> {
    const res = await apiClient.post<Activity>('/api/grades/activities', data)
    return res.data
  },

  async updateActivity(id: number, data: Partial<Activity>): Promise<Activity> {
    const res = await apiClient.put<Activity>(`/api/grades/activities/${id}`, data)
    return res.data
  },

  async deleteActivity(id: number): Promise<{ message: string }> {
    const res = await apiClient.delete(`/api/grades/activities/${id}`)
    return res.data
  },

  async saveCriterion(data: Partial<Criterion>): Promise<Criterion> {
    const res = await apiClient.post<Criterion>('/api/grades/criteria', data)
    return res.data
  },

  async deleteCriterion(id: number): Promise<{ message: string }> {
    const res = await apiClient.delete(`/api/grades/criteria/${id}`)
    return res.data
  },

  async getGradesMatrix(params: { id_materia: number; id_periodo: number; id_detallegrado: number }): Promise<any> {
    const res = await apiClient.get('/api/grades/matrix', { params })
    return res.data
  },

  async saveGrades(payload: { id_materia: number; id_periodo: number; id_detallegrado: number; calificaciones: any[] }): Promise<any> {
    const res = await apiClient.post('/api/grades/save-bulk', payload)
    return res.data
  },

  async getScales(schoolId?: number): Promise<GradeScale[]> {
    const res = await apiClient.get<GradeScale[]>('/api/academic-admin/scales', {
      params: schoolId ? { schoolId } : {}
    })
    return res.data
  }
}

export default gradeService
