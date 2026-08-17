import api from './api'

export const supervisionService = {
  // Directivo / Admin del colegio
  async getSupervisionesColegio(schoolId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/admin/colegio/${schoolId}/supervisiones`, { params })
    return res.data
  },

  async aprobarSupervision(idAuditoria: number | string): Promise<any> {
    const res = await api.post(`/admin/supervision/${idAuditoria}/aprobar`, {})
    return res.data
  },

  async revocarSupervision(idAuditoria: number | string, payload: { motivo: string }): Promise<any> {
    const res = await api.post(`/admin/supervision/${idAuditoria}/revocar`, payload)
    return res.data
  },

  async getAccionesDirectivo(idAuditoria: number | string): Promise<any> {
    const res = await api.get(`/admin/supervision/${idAuditoria}/acciones-directivo`)
    return res.data
  },

  // Admin General / Superadmin
  async getHistorial(params?: any): Promise<any> {
    const res = await api.get('/admin/supervision/historial', { params })
    return res.data
  },

  async solicitarSupervision(payload: any): Promise<any> {
    const res = await api.post('/admin/supervision/solicitar', payload)
    return res.data
  },

  async entrarSupervision(idAuditoria: number | string, payload?: any): Promise<any> {
    const res = await api.post(`/admin/supervision/${idAuditoria}/entrar`, payload || {})
    return res.data
  },

  async salirSupervision(idAuditoria: number | string): Promise<any> {
    const res = await api.post(`/admin/supervision/${idAuditoria}/salir`, {})
    return res.data
  },

  async getAcciones(idAuditoria: number | string): Promise<any> {
    const res = await api.get(`/admin/supervision/${idAuditoria}/acciones`)
    return res.data
  },

  async exportarSupervision(idAuditoria: number | string): Promise<any> {
    const res = await api.post(`/admin/supervision/${idAuditoria}/exportar`, {})
    return res.data
  }
}

export default supervisionService
