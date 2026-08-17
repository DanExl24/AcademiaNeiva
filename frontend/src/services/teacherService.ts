import api from './api'

export const teacherService = {
  async getTeachersBySchool(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/academic-admin/teachers/${schoolId}`, { params })
    return res.data?.teachers || res.data?.data || res.data || []
  },

  async getAllTeachers(): Promise<any[]> {
    const res = await api.get('/teacher/all')
    return res.data?.teachers || res.data?.data || res.data || []
  },

  async getCourses(teacherId: number | string, yearId?: number): Promise<any[]> {
    const params = yearId ? { yearId } : {}
    const res = await api.get(`/teacher/courses/${teacherId}`, { params })
    return res.data || []
  },

  async getClosureStatus(idDetalleGrado: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/teacher/closure-status/${idDetalleGrado}/${periodId}`)
    return res.data
  },

  async submitClosure(payload: any): Promise<any> {
    const res = await api.post('/teacher/closure', payload)
    return res.data
  },

  async getObservations(params?: any): Promise<any[]> {
    const res = await api.get('/teacher/observations', { params })
    return res.data?.data || res.data || []
  },

  async saveObservation(payload: any): Promise<any> {
    const res = await api.post('/teacher/observations', payload)
    return res.data
  }
}

export default teacherService
