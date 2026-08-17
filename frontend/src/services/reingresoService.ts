import api from './api'

export const reingresoService = {
  async getTicketContext(ticketId: number | string): Promise<any> {
    const res = await api.get(`/reingreso/ticket-context/${ticketId}`)
    return res.data
  },

  async getCatalogs(schoolId: number | string): Promise<any> {
    const res = await api.get('/reingreso/catalogs', { params: { schoolId } })
    return res.data
  },

  async getGroups(nivelId: number | string, schoolId: number | string): Promise<any[]> {
    const res = await api.get('/reingreso/groups', { params: { nivelId, schoolId } })
    return res.data || []
  },

  async getStudentHistory(studentId: number | string): Promise<any> {
    const res = await api.get(`/reingreso/student-history/${studentId}`)
    return res.data
  },

  async submitReingresoLink(payload: any): Promise<any> {
    const res = await api.post('/reingreso/send-link', payload)
    return res.data
  },

  async sendParentLink(payload: any): Promise<any> {
    const res = await api.post('/reingreso/send-parent-link', payload)
    return res.data
  },

  async getReingresosList(params?: any): Promise<any[]> {
    const res = await api.get('/reingreso/list', { params })
    return res.data || []
  },

  async notifyNonExistent(ticketId: number | string, motivo: string): Promise<any> {
    const res = await api.post(`/reingreso/notify-nonexistent/${ticketId}`, { motivo })
    return res.data
  }
}

export default reingresoService

