export type EnrollmentStatus = 'PENDIENTE' | 'CORREGIDA' | 'CORRECCION' | 'ACTIVA' | 'APROBADA' | 'TRASLADADA' | 'CANCELADA' | 'RECHAZADA'

export interface EnrollmentDocument {
  id_documento: number
  id_matricula: number
  tipo_documento: string
  url: string
  estado: 'PENDIENTE' | 'VALIDO' | 'CORREGIR' | 'RECHAZADO'
  observacion?: string
}

export interface EnrollmentRequest {
  id_matricula: number
  id_colegio: number
  id_anio?: number
  tipo: 'NUEVA' | 'REINGRESO' | 'TRASLADO'
  estado: EnrollmentStatus
  estudiante_nombre: string
  estudiante_apellido: string
  estudiante_documento: string
  tipo_documento?: string
  grado_solicitado?: string
  id_grado?: number
  acudiente_nombre: string
  acudiente_telefono: string
  acudiente_email: string
  fecha_solicitud: string
  token_seguimiento?: string
  es_traslado?: boolean
  documentos?: EnrollmentDocument[]
  observaciones?: string
}
