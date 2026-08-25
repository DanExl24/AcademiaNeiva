import api from './api'

export const supportService = {
  async getTickets(params?: any): Promise<any> {
    const res = await api.get('/support/tickets', { params })
    return res.data
  },

  async createTicket(payload: any): Promise<any> {
    const res = await api.post('/support/tickets', payload)
    return res.data
  },

  async updateTicketStatus(ticketId: number | string, status: string): Promise<any> {
    const res = await api.put(`/support/tickets/${ticketId}/status`, { estado: status })
    return res.data
  },

  async escalateTicket(ticketId: number | string): Promise<any> {
    const res = await api.post(`/support/tickets/${ticketId}/escalar`, {})
    return res.data
  },

  async trackTicket(code: string): Promise<any> {
    const res = await api.get(`/support/tickets/track/${code}`)
    return res.data
  },

  async addObservation(ticketId: number | string, payload: { observacion: string; remitente?: string }): Promise<any> {
    const res = await api.post(`/support/tickets/${ticketId}/observaciones`, payload)
    return res.data
  },

  async authorizeExtraordinaryEnrollment(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/matriculas/extraordinaria', payload)
    return res.data
  }
}

export default supportService
