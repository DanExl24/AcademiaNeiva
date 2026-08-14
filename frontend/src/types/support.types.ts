export type TicketStatus = 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO' | 'ESCALADO' | 'CERRADO'
export type TicketCategory = 'TECNICO' | 'ACADEMICO' | 'MATRICULA' | 'PLATAFORMA' | 'OTRO'

export interface SupportTicket {
  id_ticket: number
  codigo: string
  nombre_solicitante: string
  email: string
  telefono?: string
  categoria: TicketCategory
  asunto: string
  descripcion: string
  id_colegio?: number
  colegio_nombre?: string
  estado: TicketStatus
  fecha_creacion: string
  fecha_actualizacion?: string
  escalado_a_admin_general?: boolean
  respuestas?: TicketResponse[]
}

export interface TicketResponse {
  id_respuesta: number
  id_ticket: number
  autor_nombre: string
  es_staff: boolean
  mensaje: string
  fecha_creacion: string
}
