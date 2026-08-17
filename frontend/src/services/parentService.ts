import api from './api'

export const parentService = {
  async getParentsBySchool(schoolId: number | string, params?: any): Promise<{ parents: any[]; catalogs?: any }> {
    const res = await api.get(`/parents/school/${schoolId}`, { params })
    return res.data || { parents: [] }
  },

  async getParentDetail(parentId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/parents/${parentId}/detail`, { params })
    return res.data
  },

  async updateParent(parentId: number | string, payload: any): Promise<any> {
    const res = await api.put(`/parents/${parentId}`, payload)
    return res.data
  },

  async toggleAccountStatus(parentId: number | string, activo: boolean): Promise<any> {
    const res = await api.patch(`/parents/${parentId}/status`, { activo })
    return res.data
  }
}

export default parentService
