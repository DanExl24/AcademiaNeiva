import api from './api'

export const teacherService = {
  // Admin docente management
  async getTeachersData(schoolId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/academic-admin/teachers/${schoolId}`, { params })
    return res.data
  },

  async getTeachersBySchool(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/academic-admin/teachers/${schoolId}`, { params })
    return res.data?.teachers || res.data?.data || res.data || []
  },

  async lookupUser(params: any): Promise<any> {
    const res = await api.get('/academic-admin/users/lookup', { params })
    return res.data
  },

  async createTeacher(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/teachers', payload)
    return res.data
  },

  async updateTeacher(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/academic-admin/teachers/${id}`, payload)
    return res.data
  },

  async deleteTeacher(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/teachers/${id}`, { params: { schoolId } })
    return res.data
  },

  async assignCourseSubject(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/teacher-assignments', payload)
    return res.data
  },

  async removeAssignment(idDetalleGrado: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/teacher-assignments/${idDetalleGrado}`, { params: { schoolId } })
    return res.data
  },

  async updateTeacherStatus(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/teachers/${id}/status`, payload)
    return res.data
  },

  // Portal Docente
  async getAllTeachers(): Promise<any[]> {
    const res = await api.get('/teacher/all')
    return res.data?.teachers || res.data?.data || res.data || []
  },

  async getCourses(teacherId: number | string, paramsOrYearId?: any): Promise<any[]> {
    const params = typeof paramsOrYearId === 'number' ? { yearId: paramsOrYearId } : paramsOrYearId
    const res = await api.get(`/teacher/courses/${teacherId}`, { params })
    return res.data || []
  },

  async getPeriods(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/teacher/periods/${schoolId}`, { params })
    return res.data?.periodos || res.data?.data || res.data || []
  },

  async getStudents(gradeId: number | string): Promise<any[]> {
    const res = await api.get(`/teacher/students/${gradeId}`)
    return res.data?.estudiantes || res.data?.data || res.data || []
  },

  async getDashboard(userId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/teacher/dashboard/${userId}`, { params })
    return res.data
  },

  async getObservationTypes(): Promise<any[]> {
    const res = await api.get('/teacher/observations/types')
    return res.data?.tipos || res.data?.data || res.data || []
  },

  async getObservations(params?: any): Promise<any[]> {
    const res = await api.get('/teacher/observations', { params })
    return res.data?.observaciones || res.data?.data || res.data || []
  },

  async getObservationsByCoursePeriod(idDetalleGrado: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/teacher/observations/${idDetalleGrado}/${periodId}`)
    return res.data
  },


  async saveObservation(payload: any): Promise<any> {
    const res = await api.post('/teacher/observations', payload)
    return res.data
  },

  async updateObservation(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/teacher/observations/${id}`, payload)
    return res.data
  },

  async deleteObservation(id: number | string): Promise<any> {
    const res = await api.delete(`/teacher/observations/${id}`)
    return res.data
  },

  async getClosureStatus(idDetalleGrado: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/teacher/closure-status/${idDetalleGrado}/${periodId}`)
    return res.data
  },

  async closePeriod(payload: any): Promise<any> {
    const res = await api.post('/teacher/close-period', payload)
    return res.data
  },

  async getAttendance(idDetalleGrado: number | string, date: string): Promise<any[]> {
    const res = await api.get(`/teacher/attendance/${idDetalleGrado}/${date}`)
    return res.data?.asistencia || res.data?.data || res.data || []
  },

  async getAttendanceHistory(idDetalleGrado: number | string): Promise<any[]> {
    const res = await api.get(`/teacher/attendance-history/${idDetalleGrado}`)
    return res.data?.historial || res.data?.data || res.data || []
  },

  async saveAttendance(payload: any): Promise<any> {
    const res = await api.post('/teacher/attendance', payload)
    return res.data
  }
}

export default teacherService
