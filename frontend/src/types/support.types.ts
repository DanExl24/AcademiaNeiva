export interface SupervisionSession {
  id_supervision: number
  id_colegio: number
  id_usuario_admin: number
  motivo: string
  duracion_minutos: number
  estado: 'PENDIENTE' | 'ACTIVA' | 'EXPIRADA' | 'RECHAZADA' | 'FINALIZADA'
  fecha_solicitud: string
  fecha_inicio?: string
  fecha_fin?: string
}

export interface SupportTicket {
  id_ticket: number
  codigo_ticket: string
  nombre_remitente: string
  correo_remitente: string
  tipo_incidencia: string
  asunto: string
  descripcion: string
  estado: 'ABIERTO' | 'EN_PROCESO' | 'ESCALADO' | 'RESUELTO'
  fecha_escalado?: string
  observaciones?: any[]
  id_colegio?: number
}
