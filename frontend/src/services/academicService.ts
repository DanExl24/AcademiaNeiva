import api from './api'

export const academicService = {
  async getPeriods(schoolId?: number | string, yearId?: number | string): Promise<any[]> {
    const params: any = {}
    if (schoolId) params.schoolId = schoolId
    if (yearId) params.yearId = yearId
    const res = await api.get('/periodos', { params })
    return res.data?.data || res.data || []
  },

  async createPeriod(payload: any): Promise<any> {
    const res = await api.post('/periodos', payload)
    return res.data
  },

  async updatePeriod(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/periodos/${id}`, payload)
    return res.data
  },

  async deletePeriod(id: number | string): Promise<any> {
    const res = await api.delete(`/periodos/${id}`)
    return res.data
  },

  async getScales(schoolId?: number | string): Promise<any[]> {
    const params = schoolId ? { schoolId } : {}
    const res = await api.get('/academic-scales', { params })
    return res.data?.data || res.data || []
  },

  async saveScales(payload: any): Promise<any> {
    const res = await api.post('/academic-scales', payload)
    return res.data
  },

  async getSubjects(schoolId?: number | string): Promise<any[]> {
    const params = schoolId ? { schoolId } : {}
    const res = await api.get('/academic-admin/materias', { params })
    return res.data?.data || res.data || []
  },

  async createSubject(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/materias', payload)
    return res.data
  },

  async updateSubject(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/academic-admin/materias/${id}`, payload)
    return res.data
  },

  async deleteSubject(id: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/materias/${id}`)
    return res.data
  },

  async getSettings(schoolId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/academic-admin/settings/${schoolId}`, { params })
    return res.data
  },

  async updateSettings(schoolId: number | string, payload: any): Promise<any> {
    const res = await api.put(`/academic-admin/settings/${schoolId}`, payload)
    return res.data
  }
}

export default academicService
