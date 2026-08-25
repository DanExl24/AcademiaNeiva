import api from './api'

export interface DbaFilterParams {
  page?: number
  limit?: number
  area?: string
  grado?: string
  version?: string
  estado?: string
  busqueda?: string
}

export const dbaService = {
  async getStats(): Promise<any> {
    const res = await api.get('/admin/dba/estadisticas')
    return res.data
  },

  async getAreas(): Promise<string[]> {
    const res = await api.get('/admin/dba/areas')
    return res.data || []
  },

  async getVersions(): Promise<string[]> {
    const res = await api.get('/admin/dba/versiones')
    return res.data || []
  },

  async getExisting(): Promise<Array<{ area: string; version_curricular: string }>> {
    const res = await api.get('/admin/dba/existentes')
    return res.data || []
  },

  async getColleges(): Promise<any[]> {
    const res = await api.get('/admin/colegios')
    return res.data || []
  },

  async getDbaList(params?: DbaFilterParams): Promise<{ data: any[]; totalCount: number }> {
    const res = await api.get('/admin/dba', { params })
    const totalHeader = res.headers['x-total-count']
    const totalCount = totalHeader ? Number(totalHeader) : (res.data?.length || 0)
    return { data: res.data || [], totalCount }
  },

  async getDbaDetails(id: number | string): Promise<any> {
    const res = await api.get(`/admin/dba/${id}`)
    return res.data
  },

  async createDba(payload: any): Promise<any> {
    const res = await api.post('/admin/dba', payload)
    return res.data
  },

  async updateDba(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/admin/dba/${id}`, payload)
    return res.data
  },

  async deleteDba(id: number | string): Promise<any> {
    const res = await api.delete(`/admin/dba/${id}`)
    return res.data
  },

  async createEvidence(payload: any): Promise<any> {
    const res = await api.post('/admin/dba/evidencias', payload)
    return res.data
  },

  async updateEvidence(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/admin/dba/evidencias/${id}`, payload)
    return res.data
  },

  async deleteEvidence(id: number | string): Promise<any> {
    const res = await api.delete(`/admin/dba/evidencias/${id}`)
    return res.data
  },

  async importDba(formData: FormData): Promise<any> {
    const res = await api.post('/admin/dba/importar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },

  async getSchoolAssignments(schoolId: number | string): Promise<any[]> {
    const res = await api.get(`/admin/dba/asignaciones/${schoolId}`)
    return res.data || []
  },

  async assignDbaToSchool(payload: any): Promise<any> {
    const res = await api.post('/admin/dba/asignar', payload)
    return res.data
  },

  async unassignDbaFromSchool(id: number | string): Promise<any> {
    const res = await api.delete(`/admin/dba/asignar/${id}`)
    return res.data
  },

  async getSchoolCoherenciaReport(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/academic-admin/settings/dba-reportes/coherencia/${schoolId}`, { params })
    return res.data || []
  },

  async getSchoolCoberturaReport(schoolId: number | string, params?: any): Promise<{ resumen: any[]; detalles: any[] }> {
    const res = await api.get(`/academic-admin/settings/dba-reportes/cobertura/${schoolId}`, { params })
    return res.data || { resumen: [], detalles: [] }
  },

  async getSchoolCatalogData(schoolId: number | string, yearId?: number): Promise<any[]> {
    const params = yearId ? { yearId } : {}
    const res = await api.get(`/academic-admin/settings/dba-catalogo/${schoolId}`, { params })
    return res.data || []
  },

  async getSchoolSubjectAssignments(schoolId: number | string, yearId?: number): Promise<any[]> {
    const params = yearId ? { yearId } : {}
    const res = await api.get(`/academic-admin/settings/asignaciones/${schoolId}`, { params })
    return res.data || []
  }
}

export default dbaService


