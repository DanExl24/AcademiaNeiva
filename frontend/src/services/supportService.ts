import apiClient from './api'
import type { SupportTicket, TicketStatus } from '../types/support.types'

export const supportService = {
  async getTickets(params?: { estado?: TicketStatus; id_colegio?: number; search?: string }): Promise<SupportTicket[]> {
    const res = await apiClient.get<SupportTicket[]>('/api/support/tickets', { params })
    return res.data
  },

  async getTicketByCode(code: string): Promise<SupportTicket> {
    const res = await apiClient.get<SupportTicket>(`/api/support/ticket/${code}`)
    return res.data
  },

  async createTicket(payload: {
    nombre_solicitante: string
    email: string
    telefono?: string
    categoria: string
    asunto: string
    descripcion: string
    id_colegio?: number
  }): Promise<{ message: string; ticketCode: string }> {
    const res = await apiClient.post('/api/support/ticket', payload)
    return res.data
  },

  async updateTicketStatus(id: number, estado: TicketStatus): Promise<any> {
    const res = await apiClient.patch(`/api/support/ticket/${id}/estado`, { estado })
    return res.data
  },

  async replyTicket(id: number, mensaje: string): Promise<any> {
    const res = await apiClient.post(`/api/support/ticket/${id}/respuesta`, { mensaje })
    return res.data
  },

  async escalateTicket(id: number): Promise<any> {
    const res = await apiClient.post(`/api/support/ticket/${id}/escalar`)
    return res.data
  }
}

export default supportService
