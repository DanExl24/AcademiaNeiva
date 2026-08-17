import api from './api'

export const trasladoService = {
  async getTraslados(params?: any): Promise<any[]> {
    const res = await api.get('/traslados', { params })
    return res.data || []
  },

  async getTrasladoById(id: number | string): Promise<any> {
    const res = await api.get(`/traslados/${id}`)
    return res.data
  },

  async createTraslado(payload: any): Promise<any> {
    const res = await api.post('/traslados', payload)
    return res.data
  },

  async processApproval(id: number | string, payload: any): Promise<any> {
    const res = await api.post(`/traslados/${id}/aprobacion`, payload)
    return res.data
  },

  async getDisponibilidadCupos(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.get(`/traslados/${id}/disponibilidad-cupos`, { params: { id_colegio: schoolId } })
    return res.data
  },

  async getMisVinculaciones(): Promise<any[]> {
    const res = await api.get('/traslados/mis-vinculaciones')
    return res.data || []
  },

  async getPersonalColegio(schoolId: number | string): Promise<any[]> {
    const res = await api.get(`/traslados/personal/${schoolId}`)
    return res.data || []
  },

  async getDirectivosColegio(schoolId: number | string): Promise<any[]> {
    const res = await api.get(`/traslados/directivos/${schoolId}`)
    return res.data || []
  }
}

export default trasladoService
