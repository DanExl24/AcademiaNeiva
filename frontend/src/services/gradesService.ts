import api from './api'

export const gradesService = {
  async getTeacherCourses(teacherId: number | string, yearId?: number): Promise<any[]> {
    const params = yearId ? { yearId } : {}
    const res = await api.get(`/teacher/courses/${teacherId}`, { params })
    return res.data || []
  },

  async getPeriods(schoolId: number | string, yearId?: number): Promise<any[]> {
    const params = yearId ? { yearId } : {}
    const res = await api.get(`/teacher/periods/${schoolId}`, { params })
    return res.data || []
  },

  async getAcademicSettings(schoolId: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/settings/${schoolId}`)
    return res.data
  },

  async getStudentsByGrade(gradeId: number | string): Promise<any[]> {
    const res = await api.get(`/teacher/students/${gradeId}`)
    return res.data || []
  },

  async getGrades(gradeId: number | string, subjectId: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/teacher/grades/${gradeId}/${subjectId}/${periodId}`)
    return res.data
  },

  async getActivities(gradeId: number | string, subjectId: number | string, periodId: number | string, userId?: number | string): Promise<any> {
    const params = userId ? { userId } : {}
    const res = await api.get(`/teacher/activities/${gradeId}/${subjectId}/${periodId}`, { params })
    return res.data
  },

  async getDbaEvidences(gradeId: number | string, subjectId: number | string, schoolId: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/teacher/courses/${gradeId}/${subjectId}/evidencias-dba`, {
      params: { schoolId, periodId }
    })
    return res.data
  },

  async checkClosure(idDetalleGrado: number | string, periodId: number | string): Promise<boolean> {
    const res = await api.get(`/teacher/closure-status/${idDetalleGrado}/${periodId}`)
    return Boolean(res.data?.isClosed)
  },

  async createActivity(payload: any): Promise<any> {
    const res = await api.post('/teacher/activities', payload)
    return res.data
  },

  async updateActivity(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/teacher/activities/${id}`, payload)
    return res.data
  },

  async deleteActivity(id: number | string): Promise<any> {
    const res = await api.delete(`/teacher/activities/${id}`)
    return res.data
  },

  async createCriterion(payload: any): Promise<any> {
    const res = await api.post('/teacher/activities/criteria', payload)
    return res.data
  },

  async deleteCriterion(id: number | string): Promise<any> {
    const res = await api.delete(`/teacher/activities/criteria/${id}`)
    return res.data
  },

  async saveGrades(payload: any): Promise<any> {
    const res = await api.post('/teacher/grades', payload)
    return res.data
  }
}

export default gradesService

