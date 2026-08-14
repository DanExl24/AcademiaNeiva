export type SupervisionStatus = 'PENDIENTE' | 'ACTIVA' | 'EXPIRADA' | 'FINALIZADA' | 'REVOCADA'
export type SupervisionMode = 'SOLO_LECTURA' | 'EDITOR'

export interface SupervisionRequest {
  id_solicitud?: number
  id_colegio: number
  colegio_nombre?: string
  id_admin?: number
  admin_nombre?: string
  motivo: string
  duracion_solicitada_minutos: number
  tipo_supervision: SupervisionMode
  estado: SupervisionStatus
  fecha_creacion?: string
}

export interface ActiveSupervision {
  id_auditoria: number
  id_colegio: number
  colegio_nombre: string
  admin_nombre: string
  admin_email?: string
  fecha_entrada: string
  duracion_maxima_minutos: number
  tipo_supervision: SupervisionMode
  estado_supervision: 'ACTIVA' | 'FINALIZADA' | 'REVOCADA'
}
